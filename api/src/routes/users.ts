import { Request, Response, Router } from 'express';
import { PoolClient } from 'pg';
import { pool } from '../config/postgres.js';
import { badRequest, conflict, forbidden, notFound } from '../http/errors.js';
import { asyncHandler } from '../http/middleware.js';
import { paginated, readPagination } from '../http/pagination.js';
import { parseId } from '../http/params.js';
import { ok } from '../http/response.js';
import { authenticate } from '../middleware/authenticate.js';
import {
  AuthRequest,
  UpdateUserRequest,
  User,
  UserMovie,
  UserMovieKey,
  UserMovieRequest,
} from '../types/index.js';

const router = Router();

// PostgreSQL error codes we turn into 4xx answers
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

const USER_COLUMNS = 'user_id, user_username, user_name, user_email';

// Same columns and JOIN for every route that returns a movie of a user's list
const USER_MOVIE_SELECT = `
  SELECT m.movie_id, m.title, m.release_date, m.vote_average,
         um.is_favorite, um.watched, um.rating, um.added_at, um.updated_at
  FROM user_movies um
  JOIN movie m ON m.movie_id = um.movie_id`;

function readUserId(req: Request): number {
  const userId = parseId(req.params.id);
  if (userId === null) throw badRequest('Invalid user id');
  return userId;
}

/** Write routes only let users change their own account (the id comes from the JWT). */
function requireSelf(req: Request, userId: number): void {
  if ((req as AuthRequest).user.sub !== userId) {
    throw forbidden('You can only change your own account');
  }
}

function pgCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

/** Runs `work` inside BEGIN/COMMIT on one connection; any error rolls everything back. */
async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Users ───────────────────────────────────────────────────────────────────
// Creating a user is POST /api/auth/register (it also sets the password).

// GET /api/users?page=&limit= — every user, without password hashes
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const pagination = readPagination(req);

  const [pageResult, countResult] = await Promise.all([
    pool.query<User>(
      `SELECT ${USER_COLUMNS} FROM users ORDER BY user_id LIMIT $1 OFFSET $2`,
      [pagination.limit, pagination.offset]
    ),
    pool.query<{ total: number }>('SELECT COUNT(*) AS total FROM users'),
  ]);

  ok(res, paginated(pageResult.rows, countResult.rows[0].total, pagination));
}));

// GET /api/users/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = readUserId(req);

  const result = await pool.query<User>(
    `SELECT ${USER_COLUMNS} FROM users WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length === 0) throw notFound('User not found');

  ok(res, result.rows[0]);
}));

const MAX_USERNAME = 50;
const MAX_NAME = 100;
const MAX_EMAIL = 150;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// PUT /api/users/:id — change your own username, name or email (only the fields sent)
router.put('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = readUserId(req);
  requireSelf(req, userId);

  const body = (req.body ?? {}) as UpdateUserRequest;
  const errors: string[] = [];

  let username: string | null = null;
  if (body.user_username !== undefined) {
    username = typeof body.user_username === 'string' ? body.user_username.trim() : '';
    if (!username || username.length > MAX_USERNAME) {
      errors.push(`user_username must be 1 to ${MAX_USERNAME} characters`);
    }
  }

  let email: string | null = null;
  if (body.user_email !== undefined) {
    email = typeof body.user_email === 'string' ? body.user_email.trim() : '';
    if (!EMAIL_SHAPE.test(email) || email.length > MAX_EMAIL) {
      errors.push('user_email must be a valid email address');
    }
  }

  // user_name may be cleared with null, so "not sent" and "sent as null" are different
  const nameSent = body.user_name !== undefined;
  let name: string | null = null;
  if (nameSent && body.user_name !== null) {
    name = typeof body.user_name === 'string' ? body.user_name.trim() : '';
    if (name.length > MAX_NAME) errors.push(`user_name must be at most ${MAX_NAME} characters`);
    if (name === '') name = null;
  }

  if (username === null && email === null && !nameSent) {
    errors.push('Send at least one of user_username, user_name, user_email');
  }
  if (errors.length > 0) throw badRequest(errors);

  // COALESCE keeps the current value when a field was not sent (its parameter is NULL)
  let result;
  try {
    result = await pool.query<User>(
      `UPDATE users SET
         user_username = COALESCE($2, user_username),
         user_email    = COALESCE($3, user_email),
         user_name     = CASE WHEN $5::boolean THEN $4::varchar ELSE user_name END
       WHERE user_id = $1
       RETURNING ${USER_COLUMNS}`,
      [userId, username, email, name, nameSent]
    );
  } catch (err) {
    if (pgCode(err) === UNIQUE_VIOLATION) throw conflict('Username or email already taken');
    throw err;
  }
  if (result.rows.length === 0) throw notFound('User not found');

  ok(res, result.rows[0]);
}));

// DELETE /api/users/:id — delete your own account; ON DELETE CASCADE removes its movie list
router.delete('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = readUserId(req);
  requireSelf(req, userId);

  const result = await pool.query<User>(
    `DELETE FROM users WHERE user_id = $1 RETURNING ${USER_COLUMNS}`,
    [userId]
  );
  if (result.rows.length === 0) throw notFound('User not found');

  // Pending: also delete the user's activity and reviews in MongoDB once the
  // activity and review models are exported (api/src/models).

  ok(res, result.rows[0]);
}));

// ─── A user's movies (favorites, watched, rating) ────────────────────────────

// GET /api/users/:id/movies — the user's list, last changed first
router.get('/:id/movies', asyncHandler(async (req: Request, res: Response) => {
  const userId = readUserId(req);

  const [userResult, moviesResult] = await Promise.all([
    pool.query('SELECT 1 FROM users WHERE user_id = $1', [userId]),
    pool.query<UserMovie>(
      `${USER_MOVIE_SELECT}
       WHERE um.user_id = $1
       ORDER BY um.updated_at DESC, m.title, m.movie_id`,
      [userId]
    ),
  ]);
  if (userResult.rows.length === 0) throw notFound('User not found');

  ok(res, moviesResult.rows);
}));

interface Marks {
  is_favorite: boolean;
  watched: boolean;
  rating: number | null;
}

/** Validates the body: each mark is optional, but at least one must be sent. */
function readMarks(body: UserMovieRequest): Partial<Marks> {
  const errors: string[] = [];
  const marks: Partial<Marks> = {};

  if (body.is_favorite !== undefined) {
    if (typeof body.is_favorite !== 'boolean') errors.push('is_favorite must be true or false');
    else marks.is_favorite = body.is_favorite;
  }
  if (body.watched !== undefined) {
    if (typeof body.watched !== 'boolean') errors.push('watched must be true or false');
    else marks.watched = body.watched;
  }
  if (body.rating !== undefined) {
    const valid = body.rating === null || (Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5);
    if (!valid) errors.push('rating must be an integer from 1 to 5, or null');
    else marks.rating = body.rating;
  }

  if (errors.length === 0 && Object.keys(marks).length === 0) {
    errors.push('Send at least one of is_favorite, watched, rating');
  }
  if (errors.length > 0) throw badRequest(errors);
  return marks;
}

// PUT /api/users/:id/movies/:movieId — mark a movie as favorite / watched and rate it.
// Marks not sent keep their value. If nothing is left marked, the row is deleted and
// data is null (user_movies has a CHECK that forbids rows without marks).
router.put('/:id/movies/:movieId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = readUserId(req);
  requireSelf(req, userId);
  const movieId = parseId(req.params.movieId);
  if (movieId === null) throw badRequest('Invalid movie id');

  const changes = readMarks((req.body ?? {}) as UserMovieRequest);

  let saved: UserMovie | null;
  try {
    saved = await withTransaction(async (client) => {
      // FOR UPDATE locks the row until COMMIT, so two requests at once cannot
      // read the same old value and overwrite each other's change.
      const current = await client.query<Marks>(
        `SELECT is_favorite, watched, rating FROM user_movies
         WHERE user_id = $1 AND movie_id = $2
         FOR UPDATE`,
        [userId, movieId]
      );
      const before: Marks = current.rows[0] ?? { is_favorite: false, watched: false, rating: null };
      const after: Marks = { ...before, ...changes };

      if (!after.is_favorite && !after.watched && after.rating === null) {
        await client.query('DELETE FROM user_movies WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
        return null;
      }

      const result = await client.query<UserMovie>(
        `WITH saved AS (
           INSERT INTO user_movies (user_id, movie_id, is_favorite, watched, rating)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, movie_id) DO UPDATE SET
             is_favorite = EXCLUDED.is_favorite,
             watched     = EXCLUDED.watched,
             rating      = EXCLUDED.rating,
             updated_at  = NOW()
           RETURNING *
         )
         SELECT m.movie_id, m.title, m.release_date, m.vote_average,
                s.is_favorite, s.watched, s.rating, s.added_at, s.updated_at
         FROM saved s
         JOIN movie m ON m.movie_id = s.movie_id`,
        [userId, movieId, after.is_favorite, after.watched, after.rating]
      );

      // Pending: record the timeline events in MongoDB once the activity model is
      // exported: ADDED_TO_FAVORITES when is_favorite goes from false to true, and
      // RATED_MOVIE when rating changes to a value (compare `before` and `after`).

      return result.rows[0];
    });
  } catch (err) {
    // The user comes from a valid token, so a missing row here is the movie
    if (pgCode(err) === FOREIGN_KEY_VIOLATION) throw notFound('Movie not found');
    throw err;
  }

  ok(res, saved);
}));

// DELETE /api/users/:id/movies/:movieId — take a movie out of the user's list
router.delete('/:id/movies/:movieId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = readUserId(req);
  requireSelf(req, userId);
  const movieId = parseId(req.params.movieId);
  if (movieId === null) throw badRequest('Invalid movie id');

  const result = await pool.query<UserMovieKey>(
    `DELETE FROM user_movies WHERE user_id = $1 AND movie_id = $2
     RETURNING user_id, movie_id`,
    [userId, movieId]
  );
  if (result.rows.length === 0) throw notFound('Movie is not in this user\'s list');

  ok(res, result.rows[0]);
}));

export default router;
