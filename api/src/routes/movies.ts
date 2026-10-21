import { Request, Response, Router } from 'express';
import { pool } from '../config/postgres.js';
import { badRequest, notFound } from '../http/errors.js';
import { asyncHandler } from '../http/middleware.js';
import { paginated, readPagination } from '../http/pagination.js';
import { parseId } from '../http/params.js';
import { ok } from '../http/response.js';
import { containsPattern, readSearchTerm } from '../utils/search.js';
import {
  CastRow,
  CompanyRow,
  CountryRow,
  CrewRow,
  GenreRow,
  KeywordRow,
  LanguageRow,
  MovieDetail,
  MovieRow,
  MovieSummary,
} from '../types/index.js';

const router = Router();

// GET /api/movies/search?q=:term&page=&limit= — movies whose title contains the term
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const q = readSearchTerm(req);
  if (!q) throw badRequest('Query param q is required');

  const pagination = readPagination(req);
  const pattern = containsPattern(q);

  // Page and total in parallel. movie_id breaks ties so pages never overlap or skip rows.
  const [pageResult, countResult] = await Promise.all([
    pool.query<MovieSummary>(
      `SELECT movie_id, title, release_date, overview, vote_average, vote_count
       FROM movie
       WHERE title ILIKE $1
       ORDER BY vote_count DESC NULLS LAST, title, movie_id
       LIMIT $2 OFFSET $3`,
      [pattern, pagination.limit, pagination.offset]
    ),
    pool.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM movie WHERE title ILIKE $1',
      [pattern]
    ),
  ]);

  ok(res, paginated(pageResult.rows, countResult.rows[0].total, pagination));
}));

// GET /api/movies/:id — full movie detail with every related table
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const movieId = parseId(req.params.id);
  if (movieId === null) throw badRequest('Invalid movie id');

  // Independent queries run in parallel on different pool connections. One big JOIN
  // would multiply rows (cast × crew × genres × ...) and force deduplication in JS.
  const [
    movieResult,
    castResult,
    crewResult,
    genresResult,
    countriesResult,
    languagesResult,
    companiesResult,
    keywordsResult,
  ] = await Promise.all([
    pool.query<MovieRow>(
      'SELECT * FROM movie WHERE movie_id = $1',
      [movieId]
    ),
    pool.query<CastRow>(
      `SELECT p.person_id, p.person_name, mc.character_name, mc.cast_order, g.gender
       FROM movie_cast mc
       JOIN person p      ON p.person_id = mc.person_id
       LEFT JOIN gender g ON g.gender_id = mc.gender_id
       WHERE mc.movie_id = $1
       ORDER BY mc.cast_order`,
      [movieId]
    ),
    pool.query<CrewRow>(
      `SELECT p.person_id, p.person_name, d.department_name, mw.job
       FROM movie_crew mw
       JOIN person p     ON p.person_id = mw.person_id
       JOIN department d ON d.department_id = mw.department_id
       WHERE mw.movie_id = $1
       ORDER BY d.department_name, mw.job, p.person_name`,
      [movieId]
    ),
    pool.query<GenreRow>(
      `SELECT g.genre_id, g.genre_name
       FROM movie_genres mg
       JOIN genre g ON g.genre_id = mg.genre_id
       WHERE mg.movie_id = $1
       ORDER BY g.genre_name`,
      [movieId]
    ),
    pool.query<CountryRow>(
      `SELECT c.country_iso_code AS country_iso, c.country_name
       FROM production_country pc
       JOIN country c ON c.country_id = pc.country_id
       WHERE pc.movie_id = $1
       ORDER BY c.country_name`,
      [movieId]
    ),
    pool.query<LanguageRow>(
      `SELECT l.language_code AS language_iso, l.language_name, lr.language_role
       FROM movie_languages ml
       JOIN language l           ON l.language_id = ml.language_id
       LEFT JOIN language_role lr ON lr.role_id = ml.language_role_id
       WHERE ml.movie_id = $1
       ORDER BY ml.language_role_id, l.language_name`,
      [movieId]
    ),
    pool.query<CompanyRow>(
      `SELECT pco.company_id, pco.company_name
       FROM movie_company mco
       JOIN production_company pco ON pco.company_id = mco.company_id
       WHERE mco.movie_id = $1
       ORDER BY pco.company_name`,
      [movieId]
    ),
    pool.query<KeywordRow>(
      `SELECT k.keyword_id, k.keyword_name
       FROM movie_keywords mk
       JOIN keyword k ON k.keyword_id = mk.keyword_id
       WHERE mk.movie_id = $1
       ORDER BY k.keyword_name`,
      [movieId]
    ),
  ]);

  if (movieResult.rows.length === 0) throw notFound('Movie not found');

  const crew = crewResult.rows;
  const isDirector = (c: CrewRow) => c.department_name === 'Directing' && c.job === 'Director';
  const isWriter   = (c: CrewRow) => c.department_name === 'Writing';

  const detail: MovieDetail = {
    ...movieResult.rows[0],
    directors: crew.filter(isDirector),
    writers:   crew.filter(isWriter),
    cast:      castResult.rows,
    // Everyone else, including other Directing jobs (e.g. assistant directors)
    crew:      crew.filter(c => !isDirector(c) && !isWriter(c)),
    genres:    genresResult.rows,
    countries: countriesResult.rows,
    languages: languagesResult.rows,
    companies: companiesResult.rows,
    keywords:  keywordsResult.rows,
  };

  ok(res, detail);
}));

export default router;
