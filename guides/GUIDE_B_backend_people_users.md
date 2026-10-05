# LLM Guide — Integrante B: Backend Personas + Usuarios

> Pegá este archivo junto con `CONTEXT.md` al inicio de tu sesión con el LLM.

---

## Tu rol

Implementás los endpoints de **personas** y **usuarios** en TypeScript. Los usuarios ya tienen auth — las rutas de escritura (agregar favorito, calificar, reseñar) deben estar protegidas con el middleware `authenticate`.

**Archivos que vas a crear:**
- `db/13_users.sql` ← ya existe, revisarlo
- `api/src/routes/people.ts`
- `api/src/routes/users.ts`

**Archivos de referencia:**
- `CONTEXT.md`
- `app.js` (raíz) — queries de actor/director originales
- `api/src/types/index.ts` — `PersonRow`, `PersonSearchRow`, `UserRow`, `MovieUserRow`, etc.
- `api/src/middleware/authenticate.ts` — el middleware JWT ya está implementado

---

## Setup previo

```bash
cd api && cp .env.example .env && npm install && npm run dev
psql -d movies -U postgres -f db/13_users.sql
```

---

## Middleware de auth — cómo usarlo

```typescript
import { authenticate } from '../middleware/authenticate.js';
import { AuthRequest } from '../types/index.js';

// Ruta pública
router.get('/', async (req: Request, res: Response) => { ... });

// Ruta protegida — el userId viene del token
router.post('/:id/movies', authenticate, async (req: Request, res: Response): Promise<void> => {
  const tokenUserId = (req as AuthRequest).user.sub;
  const paramUserId = Number(req.params.id);

  // Seguridad: solo podés modificar TU propio perfil
  if (tokenUserId !== paramUserId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  // ...
});
```

---

## `api/src/routes/people.ts`

### `GET /api/people/search?q=:term`

```typescript
import { Request, Response, Router } from 'express';
import { pool } from '../config/postgres.js';
import { PersonSearchRow } from '../types/index.js';

router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const q = req.query['q'] as string | undefined;
  if (!q) { res.status(400).json({ error: 'q is required' }); return; }

  try {
    const result = await pool.query<PersonSearchRow>(
      `SELECT DISTINCT
         p.person_id,
         p.person_name,
         EXISTS(
           SELECT 1 FROM movie_cast mc WHERE mc.person_id = p.person_id
         ) AS is_actor,
         EXISTS(
           SELECT 1 FROM movie_crew mw
           WHERE mw.person_id = p.person_id AND mw.job = 'Director'
         ) AS is_director
       FROM person p
       WHERE p.person_name ILIKE $1
       LIMIT 50`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### `GET /api/people/:id`

Carga info de la persona + filmografía como actor + filmografía como director en paralelo.

```typescript
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const personId = Number(req.params.id);
  if (isNaN(personId)) { res.status(400).json({ error: 'Invalid id' }); return; }

  try {
    const [infoRes, actorRes, directorRes] = await Promise.all([
      pool.query<PersonRow>(
        'SELECT person_id, person_name FROM person WHERE person_id = $1', [personId]
      ),
      pool.query<MovieRow>(
        `SELECT DISTINCT m.movie_id, m.title, m.release_date, m.vote_average, mc.character_name
         FROM movie m
         JOIN movie_cast mc ON m.movie_id = mc.movie_id
         WHERE mc.person_id = $1
         ORDER BY m.release_date DESC`, [personId]
      ),
      pool.query<MovieRow>(
        `SELECT DISTINCT m.movie_id, m.title, m.release_date, m.vote_average
         FROM movie m
         JOIN movie_crew mw ON m.movie_id = mw.movie_id
         WHERE mw.person_id = $1 AND mw.job = 'Director'
         ORDER BY m.release_date DESC`, [personId]
      ),
    ]);

    if (infoRes.rows.length === 0) {
      res.status(404).json({ error: 'Person not found' }); return;
    }

    res.json({
      ...infoRes.rows[0],
      as_actor:    actorRes.rows,
      as_director: directorRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## `api/src/routes/users.ts`

### Rutas públicas (sin auth)

```typescript
// GET /api/users — listar todos
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const result = await pool.query<Omit<UserRow, 'password_hash'>>(
    'SELECT user_id, user_username, user_name, user_email FROM users ORDER BY user_id'
  );
  res.json(result.rows);
});

// GET /api/users/:id/movies — favoritos del usuario
router.get('/:id/movies', async (req: Request, res: Response): Promise<void> => {
  const result = await pool.query<MovieUserWithTitle>(
    `SELECT m.movie_id, m.title, m.release_date, mu.rating, mu.review, mu.added_at
     FROM movie_user mu
     JOIN movie m ON mu.movie_id = m.movie_id
     WHERE mu.user_id = $1
     ORDER BY mu.added_at DESC`,
    [req.params.id]
  );
  res.json(result.rows);
});
```

### Rutas protegidas (requieren token del usuario correcto)

```typescript
// POST /api/users/:id/movies — agregar/actualizar favorito
router.post('/:id/movies', authenticate, async (req: Request, res: Response): Promise<void> => {
  const tokenUserId = (req as AuthRequest).user.sub;
  const paramUserId = Number(req.params.id);
  if (tokenUserId !== paramUserId) { res.status(403).json({ error: 'Forbidden' }); return; }

  const { movie_id, rating, review } = req.body as {
    movie_id: number;
    rating?: number;
    review?: string;
  };

  const result = await pool.query<MovieUserRow>(
    `INSERT INTO movie_user (user_id, movie_id, rating, review)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, movie_id) DO UPDATE SET rating = $3, review = $4
     RETURNING *`,
    [paramUserId, movie_id, rating ?? null, review ?? null]
  );
  res.status(201).json(result.rows[0]);
});

// DELETE /api/users/:id/movies/:movieId — quitar favorito
router.delete('/:id/movies/:movieId', authenticate, async (req: Request, res: Response): Promise<void> => {
  const tokenUserId = (req as AuthRequest).user.sub;
  const paramUserId = Number(req.params.id);
  if (tokenUserId !== paramUserId) { res.status(403).json({ error: 'Forbidden' }); return; }

  await pool.query(
    'DELETE FROM movie_user WHERE user_id = $1 AND movie_id = $2',
    [paramUserId, req.params.movieId]
  );
  res.status(204).send();
});

// PUT /api/users/:id — editar perfil propio
router.put('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  const tokenUserId = (req as AuthRequest).user.sub;
  const paramUserId = Number(req.params.id);
  if (tokenUserId !== paramUserId) { res.status(403).json({ error: 'Forbidden' }); return; }

  const { user_username, user_name, user_email } = req.body as Partial<UserRow>;
  const result = await pool.query<Omit<UserRow, 'password_hash'>>(
    `UPDATE users SET user_username=$1, user_name=$2, user_email=$3
     WHERE user_id=$4
     RETURNING user_id, user_username, user_name, user_email`,
    [user_username, user_name, user_email, paramUserId]
  );
  if (result.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(result.rows[0]);
});
```

---

## Activar en `server.ts`

```typescript
import peopleRouter from './routes/people.js';
import usersRouter  from './routes/users.js';

app.use('/api/people', peopleRouter);
app.use('/api/users',  usersRouter);
```

---

## Imports que vas a necesitar en cada archivo

```typescript
import { Request, Response, Router } from 'express';
import { pool } from '../config/postgres.js';
import { authenticate } from '../middleware/authenticate.js';
import {
  AuthRequest,
  UserRow,
  MovieRow,
  PersonRow,
  PersonSearchRow,
  MovieUserRow,
  MovieUserWithTitle,
} from '../types/index.js';
```
