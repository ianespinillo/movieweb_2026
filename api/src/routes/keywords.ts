import { Request, Response, Router } from 'express';
import { pool } from '../config/postgres.js';
import { containsPattern, readSearchTerm } from '../utils/search.js';
import { KeywordMovieRow } from '../types/index.js';

const router = Router();

// GET /api/keywords/search?q=:term — movies that have a keyword containing the term
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const q = readSearchTerm(req);
  if (!q) {
    res.status(400).json({ error: 'Query param q is required' });
    return;
  }

  try {
    // One row per movie: a movie can match several keywords ("space", "space war", ...),
    // so we group by movie and collect the matching ones. Grouping by the primary key
    // lets us select the other movie columns without listing them in GROUP BY.
    const result = await pool.query<KeywordMovieRow>(
      `SELECT m.movie_id, m.title, m.release_date, m.overview, m.vote_average, m.vote_count,
              array_agg(k.keyword_name ORDER BY k.keyword_name) AS matched_keywords
       FROM movie m
       JOIN movie_keywords mk ON mk.movie_id = m.movie_id
       JOIN keyword k         ON k.keyword_id = mk.keyword_id
       WHERE k.keyword_name ILIKE $1
       GROUP BY m.movie_id
       ORDER BY m.vote_count DESC NULLS LAST, m.title
       LIMIT 50`,
      [containsPattern(q)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
