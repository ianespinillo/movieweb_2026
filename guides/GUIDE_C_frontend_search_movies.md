# LLM Guide — Integrante C: Frontend Home + Search + Movie Detail

> Pegá este archivo junto con `CONTEXT.md` al inicio de tu sesión con el LLM.

---

## Tu rol

Implementás las páginas principales del frontend Angular:
- Buscador principal (Home)
- Resultados de búsqueda (películas + actores + directores)
- Detalle de película con poster, backdrop, trailer y toda la info
- Buscador por keyword

**Archivos que vas a crear:**
```
web/src/app/core/models/movie.model.ts
web/src/app/core/models/person.model.ts
web/src/app/core/models/tmdb.model.ts
web/src/app/core/services/movie.service.ts
web/src/app/core/services/person.service.ts
web/src/app/core/services/keyword.service.ts
web/src/app/core/services/tmdb.service.ts
web/src/app/shared/pipes/safe-url.pipe.ts
web/src/app/shared/components/movie-card/
web/src/app/features/home/
web/src/app/features/search-results/
web/src/app/features/movie-detail/
web/src/app/features/keyword-search/
```

**Archivo a modificar:**
- `web/src/app/app.routes.ts` — agregar las rutas de estas páginas
- `web/src/app/app.config.ts` — agregar `provideHttpClient()`

---

## Setup previo (hacer UNA sola vez entre todos)

```bash
cd web
npm install

# TailwindCSS v4
npm install tailwindcss @tailwindcss/vite

# spartan/ui
npx @spartan-ng/cli@latest init
npx @spartan-ng/cli@latest add button input badge card tabs separator skeleton
```

En `web/src/styles.css`:
```css
@import "tailwindcss";
```

---

## Modelos TypeScript

```typescript
// web/src/app/core/models/movie.model.ts
export interface Movie {
  movie_id: number;
  title: string;
  release_date: string;
  overview: string;
  vote_average: number;
}

export interface MovieDetail extends Movie {
  runtime: number;
  vote_count: number;
  tagline: string;
  directors: PersonRef[];
  writers:   PersonRef[];
  cast:      CastMember[];
  crew:      CrewMember[];
  genres:    { genre_id: number; genre_name: string }[];
  countries: { country_iso: string; country_name: string }[];
  languages: { language_iso: string; language_name: string }[];
  companies: { company_id: number; company_name: string }[];
  keywords:  { keyword_id: number; keyword_name: string }[];
}

export interface PersonRef       { person_id: number; person_name: string; }
export interface CastMember extends PersonRef { character_name: string; cast_order: number; }
export interface CrewMember extends PersonRef { department_name: string; job: string; }
```

```typescript
// web/src/app/core/models/tmdb.model.ts
export interface TmdbMovieMeta {
  id: number;
  poster_path:   string | null;
  backdrop_path: string | null;
  tagline:       string;
}

export interface TmdbVideo {
  key:      string;   // YouTube video ID
  site:     string;   // 'YouTube'
  type:     string;   // 'Trailer' | 'Teaser' | 'Clip'
  official: boolean;
  name:     string;
}

export interface TmdbPersonMeta {
  id:             number;
  profile_path:   string | null;
  biography:      string;
  birthday:       string | null;
  place_of_birth: string | null;
}
```

---

## Servicios

```typescript
// web/src/app/core/services/movie.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Movie, MovieDetail } from '../models/movie.model';

@Injectable({ providedIn: 'root' })
export class MovieService {
  private http = inject(HttpClient);
  private base = 'http://localhost:3500/api/movies';

  search(q: string): Observable<Movie[]> {
    return this.http.get<Movie[]>(`${this.base}/search`, { params: { q } });
  }

  getById(id: number | string): Observable<MovieDetail> {
    return this.http.get<MovieDetail>(`${this.base}/${id}`);
  }
}
```

```typescript
// web/src/app/core/services/tmdb.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TmdbMovieMeta, TmdbPersonMeta, TmdbVideo } from '../models/tmdb.model';

@Injectable({ providedIn: 'root' })
export class TmdbService {
  private http = inject(HttpClient);
  private base = 'http://localhost:3500/api/tmdb';
  readonly imageBase = 'https://image.tmdb.org/t/p';

  // Image URL helpers — CDN is public, no key needed in the browser
  posterUrl(path: string | null, size = 'w342'): string {
    return path ? `${this.imageBase}/${size}${path}` : '/assets/no-poster.svg';
  }
  backdropUrl(path: string | null, size = 'w780'): string | null {
    return path ? `${this.imageBase}/${size}${path}` : null;
  }
  profileUrl(path: string | null, size = 'w185'): string {
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

```typescript
// web/src/app/core/services/person.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PersonService {
  private http = inject(HttpClient);
  private base = 'http://localhost:3500/api/people';

  search(q: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/search`, { params: { q } });
  }
}
```

```typescript
// web/src/app/core/services/keyword.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Movie } from '../models/movie.model';

@Injectable({ providedIn: 'root' })
export class KeywordService {
  private http = inject(HttpClient);

  search(q: string): Observable<Movie[]> {
    return this.http.get<Movie[]>('http://localhost:3500/api/keywords/search', { params: { q } });
  }
}
```

---

## SafeUrlPipe (necesaria para el trailer)

```typescript
// web/src/app/shared/pipes/safe-url.pipe.ts
import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({ name: 'safeUrl', standalone: true })
export class SafeUrlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);
  transform(url: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
```

---

## `app.config.ts` — agregar HttpClient

```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
  ],
};
```

---

## Rutas — `app.routes.ts`

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'search',
    loadComponent: () => import('./features/search-results/search-results.component').then(m => m.SearchResultsComponent),
  },
  {
    path: 'movies/:id',
    loadComponent: () => import('./features/movie-detail/movie-detail.component').then(m => m.MovieDetailComponent),
  },
  {
    path: 'keywords',
    loadComponent: () => import('./features/keyword-search/keyword-search.component').then(m => m.KeywordSearchComponent),
  },
  // D agrega: people/:id, users, users/:id
];
```

---

## Página: Home

```typescript
// home.component.ts
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  searchControl = new FormControl('');
  private router = inject(Router);

  onSearch(): void {
    const q = this.searchControl.value?.trim();
    if (q) this.router.navigate(['/search'], { queryParams: { q } });
  }
}
```

El template: un `<input>` grande centrado con un botón de búsqueda. Al submit llama a `onSearch()`.

---

## Página: Search Results

Llama a películas + personas en paralelo. Muestra 3 secciones con `MovieCard` y links a personas.

```typescript
// search-results.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { MovieService } from '../../core/services/movie.service';
import { PersonService } from '../../core/services/person.service';
import { TmdbService } from '../../core/services/tmdb.service';

@Component({ selector: 'app-search-results', standalone: true, imports: [RouterLink], ... })
export class SearchResultsComponent implements OnInit {
  private route   = inject(ActivatedRoute);
  private movies  = inject(MovieService);
  private people  = inject(PersonService);
  readonly tmdb   = inject(TmdbService);  // expose for template (posterUrl helper)

  query     = signal('');
  movieList = signal<any[]>([]);
  actors    = signal<any[]>([]);
  directors = signal<any[]>([]);
  loading   = signal(true);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const q = params['q'] ?? '';
      this.query.set(q);
      this.loading.set(true);
      combineLatest([
        this.movies.search(q),
        this.people.search(q),
      ]).subscribe(([movies, people]) => {
        this.movieList.set(movies);
        this.actors.set(people.filter((p: any) => p.is_actor));
        this.directors.set(people.filter((p: any) => p.is_director));
        this.loading.set(false);
      });
    });
  }
}
```

**Template — 3 secciones:**
- **Películas**: grilla de `MovieCard` — cada card tiene poster (`tmdb.posterUrl` con el movie_id) y link a `/movies/:movie_id`
- **Actores**: lista con avatar (`tmdb.profileUrl`) y link a `/people/:person_id`
- **Directores**: igual que actores

> Nota: para mostrar el poster en los resultados de búsqueda, necesitás llamar a `tmdb.getMovieMeta(id)` por cada película. Para listas grandes, hacé los calls de forma lazy (solo cuando la card entra en el viewport) o limitá a los primeros 20 resultados.

---

## Página: Movie Detail

Carga datos locales (PG) + TMDB en paralelo. Muestra backdrop como hero, poster lateral, trailer en tabs.

```typescript
// movie-detail.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { MovieService } from '../../core/services/movie.service';
import { TmdbService } from '../../core/services/tmdb.service';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';

@Component({
  selector: 'app-movie-detail',
  standalone: true,
  imports: [RouterLink, SafeUrlPipe],
  templateUrl: './movie-detail.component.html',
})
export class MovieDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private movieSvc = inject(MovieService);
  readonly tmdb = inject(TmdbService);

  movie      = signal<any>(null);
  posterUrl  = signal<string>('/assets/no-poster.svg');
  backdropUrl = signal<string | null>(null);
  trailerKey = signal<string | null>(null);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    combineLatest([
      this.movieSvc.getById(id),
      this.tmdb.getMovieMeta(id),
      this.tmdb.getVideos(id),
    ]).subscribe(([movie, meta, videos]) => {
      this.movie.set(movie);
      this.posterUrl.set(this.tmdb.posterUrl(meta.poster_path, 'w500'));
      this.backdropUrl.set(this.tmdb.backdropUrl(meta.backdrop_path));
      const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube');
      this.trailerKey.set(trailer?.key ?? null);
    });
  }
}
```

**Template layout sugerido:**
1. **Hero backdrop** — imagen full-width con gradiente oscuro encima
2. **Sección principal** — poster izquierda + info derecha (título, tagline, géneros, rating, overview)
3. **Tabs** (spartan/ui `HlmTabs`):
   - **Cast** — lista con avatar + nombre + personaje, link a `/people/:person_id`
   - **Crew** — directores + escritores + resto del crew
   - **Info** — países, idiomas, compañías, presupuesto, recaudación
   - **Keywords** — badges
   - **Trailer** — iframe embed de YouTube (solo si `trailerKey()` existe)

```html
<!-- Trailer embed -->
@if (trailerKey()) {
  <iframe
    [src]="'https://www.youtube.com/embed/' + trailerKey() | safeUrl"
    class="w-full aspect-video rounded-lg"
    allowfullscreen>
  </iframe>
}
```

---

## Página: Keyword Search

Mismo patrón que Home: input → navega a `?q=:term`. Llama a `KeywordService.search(q)` y muestra grilla de `MovieCard`.

---

## MovieCard — componente compartido

```typescript
// web/src/app/shared/components/movie-card/movie-card.component.ts
@Component({
  selector: 'app-movie-card',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a [routerLink]="['/movies', movie().movie_id]"
       class="block rounded-lg overflow-hidden shadow hover:scale-105 transition-transform">
      <img [src]="posterUrl()" [alt]="movie().title" class="w-full object-cover aspect-[2/3]" loading="lazy" />
      <div class="p-2">
        <p class="font-semibold truncate">{{ movie().title }}</p>
        <p class="text-sm text-muted-foreground">{{ movie().release_date | slice:0:4 }}</p>
      </div>
    </a>
  `,
})
export class MovieCardComponent {
  movie = input.required<any>();
  posterUrl = input<string>('/assets/no-poster.svg');
}
```

La grilla de resultados pasa el `posterUrl` al card (el padre cargó el meta de TMDB).
