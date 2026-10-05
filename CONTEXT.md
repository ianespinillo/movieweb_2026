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
| Dev environment | Docker Compose (Postgres + Mongo) — not shipped |

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
@Injectable({ providedIn: 'root' })
export class TmdbService {
  private http = inject(HttpClient);
  private base = 'http://localhost:3500/api/tmdb';
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
    return this.http.get<TmdbMovieMeta>(`${this.base}/movie/${id}`);
  }
  getVideos(id: number | string): Observable<TmdbVideo[]> {
    return this.http.get<TmdbVideo[]>(`${this.base}/movie/${id}/videos`);
  }
  getPersonMeta(id: number | string): Observable<TmdbPersonMeta> {
    return this.http.get<TmdbPersonMeta>(`${this.base}/person/${id}`);
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

```typescript
// web/src/app/core/models/tmdb.model.ts
export interface TmdbMovieMeta {
  id: number;
  poster_path: string | null;
  backdrop_path: string | null;
  tagline: string;
}

export interface TmdbVideo {
  key: string;       // YouTube video ID
  site: string;      // 'YouTube'
  type: string;      // 'Trailer' | 'Teaser' | 'Clip'
  official: boolean;
}

export interface TmdbPersonMeta {
  id: number;
  profile_path: string | null;
  biography: string;
  birthday: string;
  place_of_birth: string;
}
```



## Repository Structure

```
movieweb_2026/
├── api/                     # Express REST API (backend)
│   └── src/
│       ├── config/
│       │   ├── postgres.js  # pg Pool — connects to PG using env vars
│       │   └── mongo.js     # Mongoose connect
│       ├── routes/
│       │   ├── movies.js    # /api/movies/*
│       │   ├── people.js    # /api/people/*
│       │   ├── keywords.js  # /api/keywords/*
│       │   ├── users.js     # /api/users/* (CRUD)
│       │   └── activity.js  # /api/activity/* (MongoDB)
│       └── server.js        # Express entry point, port 3500
├── web/                     # Angular 22 app
│   └── src/app/
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
├── docker-compose.yml       # Dev only: Postgres + Mongo
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
- `production_country` / `movie_country` — countries
- `language` / `movie_languages` — languages
- `production_company` / `movie_company` — companies

**New tables to create (migration in `db/`):**
```sql
-- Schema: movies
CREATE TABLE users (
  user_id      SERIAL PRIMARY KEY,
  user_username VARCHAR(50)  UNIQUE NOT NULL,
  user_name     VARCHAR(100),
  user_email    VARCHAR(150) UNIQUE NOT NULL
);

CREATE TABLE movie_user (
  user_id   INT REFERENCES users(user_id)  ON DELETE CASCADE,
  movie_id  INT REFERENCES movie(movie_id) ON DELETE CASCADE,
  rating    NUMERIC(3,1) CHECK (rating >= 0 AND rating <= 10),
  review    TEXT,
  PRIMARY KEY (user_id, movie_id)
);
```

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

## API Endpoints Reference

### Movies (PostgreSQL)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/movies/search?q=:term` | Search movies by title (ILIKE) |
| GET | `/api/movies/:id` | Full movie detail: cast, crew, genres, countries, keywords, languages, companies |

### People (PostgreSQL)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/people/search?q=:term` | Search actors + directors by name |
| GET | `/api/people/:id` | Person's filmography (as actor + as director) |

### Keywords (PostgreSQL)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/keywords/search?q=:term` | Movies linked to a keyword |

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

All services inject `HttpClient` and call `http://localhost:3500/api/*`:

```typescript
@Injectable({ providedIn: 'root' })
export class MovieService {
  private http = inject(HttpClient);
  private base = 'http://localhost:3500/api/movies';

  search(q: string): Observable<Movie[]> {
    return this.http.get<Movie[]>(`${this.base}/search`, { params: { q } });
  }

  getById(id: number): Observable<MovieDetail> {
    return this.http.get<MovieDetail>(`${this.base}/${id}`);
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
# 1. Start DBs
docker-compose up -d

# 2. Seed PostgreSQL
psql --single-transaction -d movies -U postgres -f db/00_load_all.sql

# 3. Start backend
cd api && npm install && npm run dev

# 4. Start frontend
cd web && npm install && ng serve
```

## Notes for the LLM

- Angular version is 22. Use **standalone components**, **inject()** function, and **Signals** where appropriate. Do NOT use NgModules.
- All forms use **ReactiveFormsModule** (`FormControl`, `FormGroup`). No template-driven forms.
- No CSS-in-JS. Use TailwindCSS utility classes exclusively. spartan/ui components handle their own styles.
- Backend routes must set `search_path` to `movies` schema for all PG queries (already in Pool options).
- MongoDB connection must handle reconnection gracefully.
- CORS must be configured in Express to allow `http://localhost:4200`.
- All SQL queries must use parameterized inputs (`$1`, `$2`) — no string interpolation.
- TypeScript strict mode is ON in the Angular project.
