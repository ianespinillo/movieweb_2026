# MovieWeb 2026 — Project Context

## What This Is

Academic project for a Databases course. A web app called **MovieWeb** that lets users search movies, actors, and directors, explore detailed movie information, search by keyword, manage users, and view a user activity timeline.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 22 (standalone components, signals) |
| UI | spartan/ui + TailwindCSS v4 |
| Backend | Express.js REST API (`/api/`) |
| Relational DB | PostgreSQL (schema `movies`) via `pg` driver (no ORM) |
| NoSQL DB | MongoDB via Mongoose |
| External API | TMDB — images, trailers, backdrops, person photos |
| Dev environment | npm workspaces + Turborepo (bases nativas: PostgreSQL + MongoDB) |

## TMDB Integration

### Key insight
The PostgreSQL dataset uses the **same IDs as TMDB** (movie_id=11 → Star Wars, person_id=2 → Mark Hamill). This means we can call TMDB with our local IDs directly — no mapping needed.

The local DB does **not** store `poster_path`, `backdrop_path`, or `profile_path`. All images and media come from TMDB.

### Images — no API key needed

TMDB images are served from a public CDN. No auth, just build the URL:

```
https://image.tmdb.org/t/p/{size}/{path}
```

| Size token | Use |
|-----------|-----|
| `w92` | Tiny (cast rows, lists) |
| `w185` | Person photo |
| `w342` | Movie card |
| `w500` | Large card / hero |
| `w780` | Backdrop |

The `path` values (`poster_path`, `backdrop_path`, `profile_path`) come from the TMDB API — stored temporarily in memory, never persisted to our DB.

### API calls — proxied through our backend

All TMDB API calls that require a key go through our Express backend to keep the key server-side.

| Backend route | Fetches from TMDB | Returns |
|---|---|---|
| `GET /api/tmdb/movie/:id` | `/movie/:id` | `poster_path`, `backdrop_path`, `tagline` |
| `GET /api/tmdb/movie/:id/videos` | `/movie/:id/videos` | YouTube trailer key |
| `GET /api/tmdb/person/:id` | `/person/:id` | `profile_path`, biography, birthday |

> We do NOT replace our PostgreSQL data. We **enrich** it. PG is the source of truth; TMDB provides images and media.

### Environment variables (add to `api/.env`)

```
TMDB_API_KEY=your_key_here
TMDB_BASE_URL=https://api.themoviedb.org/3
TMDB_IMAGE_BASE=https://image.tmdb.org/t/p
```

Get a free key at https://www.themoviedb.org/settings/api

### `TmdbService` (Angular)

Calls our backend proxy. Image URLs are built client-side (CDN, no key):

```typescript
import type { ApiResponse, TmdbMovieMeta, TmdbPersonMeta, TmdbVideo } from '@movieweb/contracts';
import { TMDB_ROUTES } from './api-routes';
import { unwrap } from './api-response';

@Injectable({ providedIn: 'root' })
export class TmdbService {
  private http = inject(HttpClient);
  readonly imageBase = 'https://image.tmdb.org/t/p';

  posterUrl(path: string | null, size = 'w342') {
    return path ? `${this.imageBase}/${size}${path}` : '/assets/no-poster.svg';
  }
  backdropUrl(path: string | null, size = 'w780') {
    return path ? `${this.imageBase}/${size}${path}` : null;
  }
  profileUrl(path: string | null, size = 'w185') {
    return path ? `${this.imageBase}/${size}${path}` : '/assets/no-avatar.svg';
  }

  getMovieMeta(id: number | string): Observable<TmdbMovieMeta> {
    return this.http.get<ApiResponse<TmdbMovieMeta>>(TMDB_ROUTES.movie(id)).pipe(unwrap());
  }
  getVideos(id: number | string): Observable<TmdbVideo[]> {
    return this.http.get<ApiResponse<TmdbVideo[]>>(TMDB_ROUTES.videos(id)).pipe(unwrap());
  }
  getPersonMeta(id: number | string): Observable<TmdbPersonMeta> {
    return this.http.get<ApiResponse<TmdbPersonMeta>>(TMDB_ROUTES.person(id)).pipe(unwrap());
  }
}
```

### Page pattern — load PG + TMDB in parallel

```typescript
ngOnInit() {
  const id = this.route.snapshot.paramMap.get('id')!;
  combineLatest([
    this.movieService.getById(id),
    this.tmdbService.getMovieMeta(id),
    this.tmdbService.getVideos(id),
  ]).subscribe(([movie, meta, videos]) => {
    this.movie.set(movie);
    this.posterUrl.set(this.tmdbService.posterUrl(meta.poster_path, 'w500'));
    this.backdropUrl.set(this.tmdbService.backdropUrl(meta.backdrop_path));
    const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    this.trailerKey.set(trailer?.key ?? null);
  });
}
```

### Trailer embed + SafeUrlPipe

```typescript
// web/src/app/shared/pipes/safe-url.pipe.ts
@Pipe({ name: 'safeUrl', standalone: true })
export class SafeUrlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);
  transform(url: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
```

```html
<iframe *ngIf="trailerKey()"
  [src]="('https://www.youtube.com/embed/' + trailerKey()) | safeUrl"
  class="w-full aspect-video rounded-lg"
  allowfullscreen>
</iframe>
```

### TMDB TypeScript interfaces

`TmdbMovieMeta`, `TmdbVideo` and `TmdbPersonMeta` live in `packages/contracts/src/tmdb.d.ts`.
Import them from `@movieweb/contracts` — do not redeclare them in `web/`.

## Repository Structure

```
movieweb_2026/
├── packages/
│   └── contracts/           # @movieweb/contracts — types shared by api and web (see below)
├── api/                     # Express REST API (backend)
│   └── src/
│       ├── config/
│       │   ├── postgres.js  # pg Pool — connects to PG using env vars
│       │   └── mongo.js     # Mongoose connect
│       ├── http/            # ok(), HttpError, asyncHandler, errorHandler, pagination, parseId
│       ├── routes/
│       │   ├── movies.js    # /api/movies/*
│       │   ├── people.js    # /api/people/*
│       │   ├── keywords.js  # /api/keywords/*
│       │   ├── users.js     # /api/users/* (CRUD)
│       │   └── activity.js  # /api/activity/* (MongoDB)
│       └── server.js        # Express entry point, port 3500
├── web/                     # Angular 22 app
│   └── src/app/
│       ├── services/
│       │   ├── api-routes.ts    # every API URL (MOVIE_ROUTES, TMDB_ROUTES, ...)
│       │   └── api-response.ts  # unwrap() and apiErrorMessage()
│       ├── core/
│       │   ├── services/    # Angular services (HttpClient calls to /api/*)
│       │   └── models/      # TypeScript interfaces
│       ├── features/        # One folder per page/feature
│       │   ├── home/
│       │   ├── search-results/
│       │   ├── movie-detail/
│       │   ├── person-detail/
│       │   ├── keyword-search/
│       │   ├── users/
│       │   └── profile/     # User profile + MongoDB timeline
│       └── shared/
│           └── components/  # Reusable UI components (cards, badges, etc.)
├── db/                      # SQL scripts (existing, do not modify)
│   └── instrucciones.txt    # How to seed the DB
├── package.json             # npm workspace root (workspaces: api, web, packages/*)
├── turbo.json               # Turborepo pipeline (dev / build / test)
└── CONTEXT.md               # This file
```

## Key Technical Decisions

### No ORM for PostgreSQL
We use `pg` (node-postgres) directly. The TP evaluates SQL knowledge — an ORM would obscure that. All queries use parameterized statements (`$1`, `$2`).

### Mongoose for MongoDB
The activity timeline has a flexible schema (3 event types with different fields). Mongoose adds minimal validation without hiding MongoDB concepts.

### Angular Standalone Components
No NgModules. Every component is `standalone: true`. Lazy-loaded via `loadComponent` in the router.

### spartan/ui for UI
Port of shadcn/ui for Angular. Uses TailwindCSS v4. Components installed via `npx @spartan-ng/cli`.

## Database — PostgreSQL Schema `movies`

**Existing tables (from SQL scripts):**
- `movie` — main movie data
- `person` — actors and directors
- `movie_cast` — actor → movie links (with `character_name`, `cast_order`)
- `movie_crew` — crew → movie links (with `department_id`, `job`)
- `department` — department names (Directing, Writing, etc.)
- `genre` / `movie_genres` — genres
- `keyword` / `movie_keywords` — keywords
- `country` / `production_country` — countries (`country.country_iso_code`)
- `language` / `movie_languages` / `language_role` — languages (`language.language_code`, role Original/Spoken)
- `production_company` / `movie_company` — companies

**New tables (`db/13_users.sql`; drop with `db/drop_tp_tables.sql`; test data in `db/15_seed_users.sql`):**
```sql
-- Schema: movies
CREATE TABLE users (
  user_id       SERIAL       PRIMARY KEY,
  user_username VARCHAR(50)  NOT NULL UNIQUE,
  user_name     VARCHAR(100),
  user_email    VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL
);

-- One row per user and movie. Reviews are NOT here: they live in MongoDB (PDF 3.2).
CREATE TABLE user_movies (
  user_id     INT NOT NULL REFERENCES users (user_id)  ON DELETE CASCADE,
  movie_id    INT NOT NULL REFERENCES movie (movie_id) ON DELETE CASCADE,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  watched     BOOLEAN NOT NULL DEFAULT FALSE,
  rating      SMALLINT CHECK (rating BETWEEN 1 AND 5),   -- stars, NULL = not rated
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, movie_id),
  CHECK (is_favorite OR watched OR rating IS NOT NULL)   -- no empty rows: unmark all = delete
);
```
Seed users: `ana_cine`, `bruno_m`, `carla_r`, `diego_p`, all with password `movieweb2026`.

## Database — MongoDB Collection `user_activity`

Three event types, stored in a single `user_activity` collection:

```json
// RATED_MOVIE
{ "userId": "1", "type": "RATED_MOVIE",        "timestamp": ISODate, "details": { "movieId": 123, "movieTitle": "...", "rating": 5 } }
// ADDED_TO_FAVORITES
{ "userId": "1", "type": "ADDED_TO_FAVORITES", "timestamp": ISODate, "details": { "movieId": 123, "movieTitle": "..." } }
// WROTE_REVIEW
{ "userId": "1", "type": "WROTE_REVIEW",        "timestamp": ISODate, "details": { "movieId": 123, "movieTitle": "...", "reviewId": "..." } }
```

## API Response Contract (`packages/contracts`)

Every endpoint answers with the same envelope. The types live in `@movieweb/contracts` and are
imported by **both** `api/` and `web/`: if a field changes there, the side that was not updated
stops compiling. Field names match the PostgreSQL columns (snake_case: `movie_id`, `person_name`).

```typescript
// success — any 2xx
interface ApiResponse<T> { success: true; data: T; timestamp: string }

// error — any 4xx/5xx
interface ErrorResponse {
  success: false; statusCode: number; timestamp: string; path: string; method: string;
  message: string | string[]; error: string; details?: unknown;
}

// lists that can be long (searches) go paginated INSIDE data:
// ApiResponse<PaginatedResponse<MovieSummary>>, query params ?page=1&limit=20 (max 100)
interface PaginatedResponse<T> { items: T[]; total: number; page: number; limit: number; totalPages: number }
```

**Backend** (`api/src/http/`) — never build these JSON bodies by hand:

```typescript
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) throw badRequest('Invalid movie id');   // → ErrorResponse 400
  const movie = await ...;
  if (!movie) throw notFound('Movie not found');           // → ErrorResponse 404
  ok(res, movie);                                          // → ApiResponse<Movie>
}));
```

- Wrap every async route in `asyncHandler` (Express 4 does not catch async errors by itself).
- Throw `HttpError` helpers (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`);
  anything else becomes a 500. The central `errorHandler` in `server.ts` formats them.
- Paginated routes: `readPagination(req)` → `{ page, limit, offset }`, then `ok(res, paginated(rows, total, p))`.

**Frontend**: URLs come from `services/api-routes.ts`; `unwrap()` returns `data`; `apiErrorMessage(err)`
gives the user-facing message of a failed request.

## API Endpoints Reference

### Movies (PostgreSQL)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/movies/search?q=:term&page=&limit=` | Search movies by title (ILIKE) → `PaginatedResponse<MovieSummary>` |
| GET | `/api/movies/:id` | Full movie detail: cast, crew, genres, countries, keywords, languages, companies → `MovieDetail` |

### People (PostgreSQL)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/people/search?q=:term` | Search actors + directors by name |
| GET | `/api/people/:id` | Person's filmography (as actor + as director) |

### Keywords (PostgreSQL)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/keywords/search?q=:term&page=&limit=` | Movies linked to a keyword → `PaginatedResponse<KeywordMovie>` |

### Users (PostgreSQL)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |
| GET | `/api/users/:id/movies` | User's favorites with rating + review |
| POST | `/api/users/:id/movies` | Add movie to user favorites |

### Activity (MongoDB)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/activity/:userId` | User's activity timeline (sorted by timestamp desc) |
| POST | `/api/activity` | Record a new activity event |

## Angular Routes

```typescript
{ path: '',              loadComponent: () => import('./features/home/home.component') }
{ path: 'search',        loadComponent: () => import('./features/search-results/search-results.component') }
{ path: 'movies/:id',    loadComponent: () => import('./features/movie-detail/movie-detail.component') }
{ path: 'people/:id',    loadComponent: () => import('./features/person-detail/person-detail.component') }
{ path: 'keywords',      loadComponent: () => import('./features/keyword-search/keyword-search.component') }
{ path: 'users',         loadComponent: () => import('./features/users/users.component') }
{ path: 'users/:id',     loadComponent: () => import('./features/profile/profile.component') }
```

## Angular Service Pattern

Services take URLs from `services/api-routes.ts`, types from `@movieweb/contracts`, and `unwrap()` the envelope:

```typescript
import type { ApiResponse, MovieDetail, MovieSummary, PaginatedResponse } from '@movieweb/contracts';
import { MOVIE_ROUTES } from './api-routes';
import { unwrap } from './api-response';

@Injectable({ providedIn: 'root' })
export class MovieService {
  private http = inject(HttpClient);

  search(q: string, page = 1): Observable<PaginatedResponse<MovieSummary>> {
    return this.http
      .get<ApiResponse<PaginatedResponse<MovieSummary>>>(MOVIE_ROUTES.search, { params: { q, page } })
      .pipe(unwrap());
  }

  getById(id: number): Observable<MovieDetail> {
    return this.http.get<ApiResponse<MovieDetail>>(MOVIE_ROUTES.detail(id)).pipe(unwrap());
  }
}
```

## Environment Variables (`api/.env`)

```
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=movies
DB_SCHEMA=movies
MONGO_URI=mongodb://localhost:27017/movieweb
PORT=3500
CORS_ORIGIN=http://localhost:4200
```

## Running Locally

```bash
# 0. Prerrequisitos: Node 20+, PostgreSQL y MongoDB nativos corriendo

# 1. Instalar dependencias del monorepo (api + web) y turbo
npm install

# 2. Crear la base y cargar todo (datos, tablas del TP, índices, usuarios de prueba).
#    No necesita psql: api/scripts/setup-db.mjs corre db/*.sql con pg. Idempotente.
npm run dev:setup        # npm run dev:reset recarga desde cero; npm run db:drop borra lo del TP

# 3. Levantar API (3500) + frontend (4200) juntos con Turborepo
npm start                # igual que npm run dev
```

## Notes for the LLM

- Angular version is 22. Use **standalone components**, **inject()** function, and **Signals** where appropriate. Do NOT use NgModules.
- All forms use **ReactiveFormsModule** (`FormControl`, `FormGroup`). No template-driven forms.
- No CSS-in-JS. Use TailwindCSS utility classes exclusively. spartan/ui components handle their own styles.
- Backend routes must set `search_path` to `movies` schema for all PG queries (already in Pool options).
- MongoDB connection must handle reconnection gracefully.
- CORS must be configured in Express to allow `http://localhost:4200`.
- All SQL queries must use parameterized inputs (`$1`, `$2`) — no string interpolation.
- Every API response follows the contract in "API Response Contract": use `ok()` / `HttpError` / `asyncHandler` in the API and `unwrap()` in Angular. Never return raw `res.json(...)`.
- Types that cross the API boundary go in `packages/contracts` (a `.d.ts` file) and are imported from `@movieweb/contracts` on both sides. Do not redeclare them in `web/` or `api/`.
- TypeScript strict mode is ON in the Angular project.
