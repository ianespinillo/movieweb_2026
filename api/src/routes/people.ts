import { Request, Response, Router } from 'express';
import { pool } from '../config/postgres.js';
import { badRequest, notFound } from '../http/errors.js';
import { asyncHandler } from '../http/middleware.js';
import { paginated, readPagination } from '../http/pagination.js';
import { parseId } from '../http/params.js';
import { ok } from '../http/response.js';
import { containsPattern, readSearchTerm } from '../utils/search.js';
import { ActingCredit, CrewCredit, PersonDetail, PersonRow, PersonSearchResult } from '../types/index.js';

const router = Router();

// GET /api/people/search?q=:term&page=&limit= — actors and directors whose name contains the term
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const q = readSearchTerm(req);
  if (!q) throw badRequest('Query param q is required');

  const pagination = readPagination(req);
  const pattern = containsPattern(q);

  // Most `person` rows are crew (sound, makeup, ...), so only people who acted or directed
  // count as results. EXISTS stops at the first matching row instead of reading them all.
  // Each subquery looks up one person_id: without the indexes in db/14_people_indexes.sql
  // that means a full scan of movie_cast / movie_crew per matching person.
  const [pageResult, countResult] = await Promise.all([
    // Most credited first ("hanks" shows Tom Hanks before one-film namesakes), the same idea
    // as movies sorted by vote_count. person_id breaks ties so pages never overlap or skip rows.
    pool.query<PersonSearchResult>(
      `SELECT person_id, person_name, is_actor, is_director
       FROM (
         SELECT p.person_id, p.person_name,
                EXISTS (SELECT 1 FROM movie_cast mc WHERE mc.person_id = p.person_id) AS is_actor,
                EXISTS (SELECT 1 FROM movie_crew mw
                        WHERE mw.person_id = p.person_id AND mw.job = 'Director') AS is_director,
                (SELECT COUNT(*) FROM movie_cast mc WHERE mc.person_id = p.person_id)
              + (SELECT COUNT(*) FROM movie_crew mw
                 WHERE mw.person_id = p.person_id AND mw.job = 'Director') AS credits
         FROM person p
         WHERE p.person_name ILIKE $1
       ) matches
       WHERE is_actor OR is_director
       ORDER BY credits DESC, person_name, person_id
       LIMIT $2 OFFSET $3`,
      [pattern, pagination.limit, pagination.offset]
    ),
    pool.query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM person p
       WHERE p.person_name ILIKE $1
         AND (EXISTS (SELECT 1 FROM movie_cast mc WHERE mc.person_id = p.person_id)
              OR EXISTS (SELECT 1 FROM movie_crew mw
                         WHERE mw.person_id = p.person_id AND mw.job = 'Director'))`,
      [pattern]
    ),
  ]);

  ok(res, paginated(pageResult.rows, countResult.rows[0].total, pagination));
}));

// GET /api/people/:id — the person and every movie they took part in, with their role
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const personId = parseId(req.params.id);
  if (personId === null) throw badRequest('Invalid person id');

  const [personResult, actingResult, crewResult] = await Promise.all([
    pool.query<PersonRow>(
      'SELECT person_id, person_name FROM person WHERE person_id = $1',
      [personId]
    ),
    // One row per movie: some people play several characters in the same movie
    // (Tom Hanks in Cloud Atlas), so those characters are joined into one string.
    // Grouping by the primary key lets us select the other movie columns.
    pool.query<ActingCredit>(
      `SELECT m.movie_id, m.title, m.release_date, m.vote_average,
              string_agg(mc.character_name, ' / ' ORDER BY mc.cast_order) AS character_name
       FROM movie_cast mc
       JOIN movie m ON m.movie_id = mc.movie_id
       WHERE mc.person_id = $1
       GROUP BY m.movie_id
       ORDER BY m.release_date DESC NULLS LAST, m.title, m.movie_id`,
      [personId]
    ),
    // One row per job: on the same movie a person can be director and producer.
    pool.query<CrewCredit>(
      `SELECT m.movie_id, m.title, m.release_date, m.vote_average, d.department_name, mw.job
       FROM movie_crew mw
       JOIN movie m      ON m.movie_id = mw.movie_id
       JOIN department d ON d.department_id = mw.department_id
       WHERE mw.person_id = $1
       ORDER BY m.release_date DESC NULLS LAST, m.title, m.movie_id, d.department_name, mw.job`,
      [personId]
    ),
  ]);

  if (personResult.rows.length === 0) throw notFound('Person not found');

  // 'Director' only appears in the Directing department, so the job alone identifies it
  // (the same rule the search uses for is_director).
  const crew = crewResult.rows;
  const isDirector = (c: CrewCredit) => c.job === 'Director';

  const detail: PersonDetail = {
    ...personResult.rows[0],
    as_actor:    actingResult.rows,
    as_director: crew.filter(isDirector),
    as_crew:     crew.filter(c => !isDirector(c)),
  };

  ok(res, detail);
}));

export default router;
