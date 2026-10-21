import { Request, Response, Router } from 'express';
import { pool } from '../config/postgres.js';
import { badRequest } from '../http/errors.js';
import { asyncHandler } from '../http/middleware.js';
import { paginated, readPagination } from '../http/pagination.js';
import { ok } from '../http/response.js';
import { containsPattern, readSearchTerm } from '../utils/search.js';
import { KeywordMovie } from '../types/index.js';

const router = Router();

// GET /api/keywords/search?q=:term&page=&limit= — movies that have a keyword containing the term
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const q = readSearchTerm(req);
  if (!q) throw badRequest('Query param q is required');

  const pagination = readPagination(req);
  const pattern = containsPattern(q);

  const [pageResult, countResult] = await Promise.all([
    // One row per movie: a movie can match several keywords ("space", "space war", ...),
    // so we group by movie and collect the matching ones. Grouping by the primary key
    // lets us select the other movie columns without listing them in GROUP BY.
    pool.query<KeywordMovie>(
      `SELECT m.movie_id, m.title, m.release_date, m.overview, m.vote_average, m.vote_count,
              array_agg(k.keyword_name ORDER BY k.keyword_name) AS matched_keywords
       FROM movie m
       JOIN movie_keywords mk ON mk.movie_id = m.movie_id
       JOIN keyword k         ON k.keyword_id = mk.keyword_id
       WHERE k.keyword_name ILIKE $1
       GROUP BY m.movie_id
       ORDER BY m.vote_count DESC NULLS LAST, m.title, m.movie_id
       LIMIT $2 OFFSET $3`,
      [pattern, pagination.limit, pagination.offset]
    ),
    // Movies, not keyword links: a movie matching three keywords counts once.
    pool.query<{ total: number }>(
      `SELECT COUNT(DISTINCT mk.movie_id) AS total
       FROM movie_keywords mk
       JOIN keyword k ON k.keyword_id = mk.keyword_id
       WHERE k.keyword_name ILIKE $1`,
      [pattern]
    ),
  ]);

  ok(res, paginated(pageResult.rows, countResult.rows[0].total, pagination));
}));

export default router;
