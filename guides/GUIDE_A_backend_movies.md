# LLM Guide — Integrante A: Backend Películas + Keywords

> Pegá este archivo junto con `CONTEXT.md` al inicio de tu sesión con el LLM.

---

## Tu rol

Implementás los endpoints de **películas** y **keywords** en el backend Express + TypeScript.

**Archivos que vas a crear:**
- `api/src/routes/movies.ts`
- `api/src/routes/keywords.ts`

**Archivos de referencia:**
- `CONTEXT.md` — arquitectura completa
- `app.js` (raíz) — queries SQL originales a expandir
- `api/src/types/index.ts` — tipos compartidos (`MovieRow`, `CastRow`, `CrewRow`, `GenreRow`, etc.)
- `api/src/config/postgres.ts` — el Pool ya existe, solo importarlo

---

## Setup previo (hacer UNA sola vez entre todos)

```bash
cd api
cp .env.example .env
# Completar DB_USER, DB_PASSWORD, TMDB_API_KEY en .env
npm install
npm run dev
# Verificar: GET http://localhost:3500/api/health → { status: 'ok' }
```

---

## Patrón base de una ruta TypeScript

Importá `Request`, `Response` de express. Los tipos de las rows vienen de `../types/index.js`.

```typescript
import { Request, Response, Router } from 'express';
import { pool } from '../config/postgres.js';
import { MovieRow } from '../types/index.js';

const router = Router();

router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const q = req.query['q'] as string | undefined;

  if (!q) {
    res.status(400).json({ error: 'Query param q is required' });
    return;
  }

  try {
    const result = await pool.query<MovieRow>(
      `SELECT movie_id, title, release_date, overview, vote_average, vote_count
       FROM movie
       WHERE title ILIKE $1
       ORDER BY vote_count DESC
       LIMIT 50`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

> **Nota clave:** `pool.query<T>()` ya tipea `result.rows` como `T[]`. No uses `any`.

---

## `GET /api/movies/search?q=:term`

Query base (expandir si querés añadir `popularity` al sort):

```sql
SELECT movie_id, title, release_date, overview, vote_average, vote_count
FROM movie
WHERE title ILIKE $1
ORDER BY vote_count DESC
LIMIT 50
```

---

## `GET /api/movies/:id`

Hay muchas tablas relacionadas. Hacé queries paralelas con `Promise.all` para no esperar de a una.

Fijate en los SQL files de `db/` para los nombres exactos de columnas en cada tabla.

```typescript
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const movieId = Number(req.params.id);

  if (isNaN(movieId)) {
    res.status(400).json({ error: 'Invalid movie id' });
    return;
  }

  try {
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
        'SELECT * FROM movie WHERE movie_id = $1', [movieId]
      ),
      pool.query<CastRow>(
        `SELECT p.person_id, p.person_name, mc.character_name, mc.cast_order
         FROM movie_cast mc
         JOIN person p ON mc.person_id = p.person_id
         WHERE mc.movie_id = $1
         ORDER BY mc.cast_order`, [movieId]
      ),
      pool.query<CrewRow>(
        `SELECT p.person_id, p.person_name, d.department_name, mw.job
         FROM movie_crew mw
         JOIN person p ON mw.person_id = p.person_id
         JOIN department d ON mw.department_id = d.department_id
         WHERE mw.movie_id = $1`, [movieId]
      ),
      // genres, countries, languages, companies, keywords — mismo patrón con su JOIN table
    ]);

    if (movieResult.rows.length === 0) {
      res.status(404).json({ error: 'Movie not found' });
      return;
    }

    const crew = crewResult.rows;

    res.json({
      ...movieResult.rows[0],
      directors: crew.filter(c => c.department_name === 'Directing' && c.job === 'Director'),
      writers:   crew.filter(c => c.department_name === 'Writing'),
      cast:      castResult.rows,
      crew:      crew.filter(c => c.department_name !== 'Directing' && c.department_name !== 'Writing'),
      genres:    genresResult.rows,
      // ... resto
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## `GET /api/keywords/search?q=:term`

```typescript
// api/src/routes/keywords.ts
pool.query<MovieRow>(
  `SELECT DISTINCT m.movie_id, m.title, m.release_date, m.overview, m.vote_average
   FROM movie m
   JOIN movie_keywords mk ON m.movie_id = mk.movie_id
   JOIN keyword k ON mk.keyword_id = k.keyword_id
   WHERE k.keyword_name ILIKE $1
   ORDER BY m.vote_count DESC
   LIMIT 50`,
  [`%${q}%`]
)
```

---

## Activar en `server.ts`

```typescript
import moviesRouter   from './routes/movies.js';
import keywordsRouter from './routes/keywords.js';

app.use('/api/movies',   moviesRouter);
app.use('/api/keywords', keywordsRouter);
```

---

## Probar sin frontend

```bash
curl "http://localhost:3500/api/movies/search?q=batman"
curl "http://localhost:3500/api/movies/268"
curl "http://localhost:3500/api/keywords/search?q=superhero"
```
