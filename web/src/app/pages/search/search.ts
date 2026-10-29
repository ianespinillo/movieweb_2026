
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ViewportScroller } from '@angular/common';
import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  Subject,
  forkJoin,
  from,
  of,
  catchError,
  map,
  mergeMap,
  switchMap,
  tap,
} from 'rxjs';

import type { TmdbPersonMeta } from '@movieweb/contracts';

import { Movie } from '../../models/movie.model';
import { Person } from '../../models/person.model';

import {
  Movie as MovieService,
  MovieSearchPage,
} from '../../services/movie';

import {
  PersonService,
  PeopleSearchPage,
} from '../../services/person';

import { TMDB_ROUTES } from '../../services/api-routes';
import { SearchState } from '../../services/search-state';
import { AuthService } from '../../services/auth';
import { AuthModal } from '../../components/auth-modal/auth-modal';

interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

@Component({
  selector: 'app-search',
  imports: [RouterLink, AuthModal],
  templateUrl: './search.html',
  styleUrl: './search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Search {
  private readonly movieService = inject(MovieService);
  private readonly personService = inject(PersonService);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser = this.authService.currentUser;
  readonly showAuthModal = signal(false);

  logout(): void {
    this.authService.logout();
  }

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly searchState = inject(SearchState);
  private readonly viewportScroller = inject(ViewportScroller);

  private readonly searchRequests = new Subject<string>();
  private searchVersion = 0;

  readonly searchQuery = signal('');
  readonly submittedQuery = signal('');
  readonly hasSearched = signal(false);
  readonly isLoading = signal(false);

  readonly moviesError = signal(false);
  readonly peopleError = signal(false);

  readonly loadingMoreMovies = signal(false);
  readonly loadingMorePeople = signal(false);

  readonly moreMoviesError = signal(false);
  readonly morePeopleError = signal(false);

  readonly moviesPage = signal(0);
  readonly moviesTotalPages = signal(0);

  readonly peoplePage = signal(0);
  readonly peopleTotalPages = signal(0);

  readonly movies = signal<Movie[]>([]);
  readonly actors = signal<Person[]>([]);
  readonly directors = signal<Person[]>([]);

  readonly posters = signal<Record<number, string | null>>({});
  readonly photos = signal<Record<number, string | null>>({});

  readonly suggestedMovies = signal<Movie[]>([]);
  readonly loadingSuggestions = signal(true);

  // Películas destacadas para la portada
  private readonly suggestedIds = [
    155,
    19995,
    27205,
    157336,
  ];

  constructor() {
    this.loadSuggestions();

    // Búsqueda normal
    this.searchRequests.pipe(
      tap(query => {
        this.searchVersion++;

        this.submittedQuery.set(query);
        this.hasSearched.set(true);
        this.isLoading.set(true);

        this.moviesError.set(false);
        this.peopleError.set(false);
        this.moreMoviesError.set(false);
        this.morePeopleError.set(false);

        this.loadingMoreMovies.set(false);
        this.loadingMorePeople.set(false);

        this.moviesPage.set(0);
        this.moviesTotalPages.set(0);
        this.peoplePage.set(0);
        this.peopleTotalPages.set(0);

        this.movies.set([]);
        this.actors.set([]);
        this.directors.set([]);
      }),

      switchMap(query =>
        forkJoin({
          movies: this.movieService.searchMovies(query).pipe(
            map(data => ({
              data,
              failed: false,
            })),
            catchError(error => {
              console.error('Error buscando películas:', error);

              return of({
                data: null as MovieSearchPage | null,
                failed: true,
              });
            })
          ),

          people: this.personService.searchPeople(query).pipe(
            map(data => ({
              data,
              failed: false,
            })),
            catchError(error => {
              console.error('Error buscando personas:', error);

              return of({
                data: null as PeopleSearchPage | null,
                failed: true,
              });
            })
          ),
        })
      ),

      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ movies, people }) => {
      if (movies.data) {
        this.movies.set(movies.data.items);
        this.moviesPage.set(movies.data.page);
        this.moviesTotalPages.set(movies.data.totalPages);

        this.loadPosters(movies.data.items.slice(0, 8));
      }

      if (people.data) {
        this.addPeople(people.data.items);
        this.peoplePage.set(people.data.page);
        this.peopleTotalPages.set(people.data.totalPages);

        this.loadPhotos();
      }

      this.moviesError.set(movies.failed);
      this.peopleError.set(people.failed);
      this.isLoading.set(false);
    });

    // Recuperar búsqueda al volver de una película
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const query = params.get('q')?.trim() ?? '';

        if (!query) {
          this.searchQuery.set('');
          this.submittedQuery.set('');
          this.hasSearched.set(false);
          this.isLoading.set(false);
          return;
        }

        const saved = this.searchState.restore();

        if (saved && saved.query === query) {
          this.restoreSearch(saved);
          return;
        }

        this.searchQuery.set(query);
        this.searchRequests.next(query);
      });
  }

  // Restaurar resultados y paginación
  private restoreSearch(saved: import(
    '../../services/search-state'
  ).SavedSearch): void {
    this.searchQuery.set(saved.query);
    this.submittedQuery.set(saved.query);

    this.movies.set([...saved.movies]);
    this.actors.set([...saved.actors]);
    this.directors.set([...saved.directors]);

    this.moviesPage.set(saved.moviesPage);
    this.moviesTotalPages.set(saved.moviesTotalPages);

    this.peoplePage.set(saved.peoplePage);
    this.peopleTotalPages.set(saved.peopleTotalPages);

    this.posters.set({ ...saved.posters });
    this.photos.set({ ...saved.photos });

    this.moviesError.set(false);
    this.peopleError.set(false);
    this.moreMoviesError.set(false);
    this.morePeopleError.set(false);

    this.loadingMoreMovies.set(false);
    this.loadingMorePeople.set(false);

    this.hasSearched.set(true);
    this.isLoading.set(false);

    // Esperar a que Angular vuelva a dibujar los resultados.
    // Se limita a unos pocos intentos para no bloquear el navegador.
    let attempts = 0;
    const restoreScroll = () => {
      this.viewportScroller.scrollToPosition([0, saved.scrollY]);

      attempts++;

      const currentY = this.viewportScroller.getScrollPosition()[1];

      if (
        Math.abs(currentY - saved.scrollY) > 5 &&
        attempts < 12
      ) {
        setTimeout(restoreScroll, 50);
      }
    };

    setTimeout(restoreScroll, 50);
  }

  // Sugerencias de la portada
  private loadSuggestions(): void {
    from(this.suggestedIds).pipe(
      mergeMap(
        id => this.movieService.getMovieById(id).pipe(
          map(movie => ({
            movie_id: movie.movie_id,
            title: movie.title,
            release_date: movie.release_date,
            overview: movie.overview,
            vote_average: movie.vote_average,
            vote_count: movie.vote_count,
          } as Movie)),

          catchError(() => of(null))
        ),
        3
      ),

      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: movie => {
        if (!movie) return;

        this.suggestedMovies.update(current => [
          ...current,
          movie,
        ]);

        this.loadPosters([movie]);
      },

      complete: () => {
        this.suggestedMovies.update(current =>
          [...current].sort(
            (a, b) =>
              this.suggestedIds.indexOf(a.movie_id) -
              this.suggestedIds.indexOf(b.movie_id)
          )
        );

        this.loadingSuggestions.set(false);
      },
    });
  }

  // Pósters TMDB
  private loadPosters(items: Movie[]): void {
    const missing = items.filter(
      movie => !(movie.movie_id in this.posters())
    );

    from(missing).pipe(
      mergeMap(
        movie => this.movieService.getTmdbMovie(movie.movie_id).pipe(
          map(meta => ({
            id: movie.movie_id,
            path: meta.poster_path,
          })),

          catchError(() =>
            of({
              id: movie.movie_id,
              path: null,
            })
          )
        ),
        3
      ),

      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ id, path }) => {
      const url = path
        ? `https://image.tmdb.org/t/p/w342${path}`
        : null;

      this.posters.update(current => ({
        ...current,
        [id]: url,
      }));
    });
  }

  // Fotografías de actores y directores
  private loadPhotos(): void {
    const people = [
      ...this.actors().slice(0, 5),
      ...this.directors().slice(0, 5),
    ];

    const unique = people.filter(
      (person, index, list) =>
        list.findIndex(
          p => p.person_id === person.person_id
        ) === index &&
        !(person.person_id in this.photos())
    );

    from(unique).pipe(
      mergeMap(
        person => this.http.get<ApiResponse<TmdbPersonMeta>>(
          TMDB_ROUTES.person(person.person_id)
        ).pipe(
          map(response => ({
            id: person.person_id,
            path: response.data.profile_path,
          })),

          catchError(() =>
            of({
              id: person.person_id,
              path: null,
            })
          )
        ),
        3
      ),

      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ id, path }) => {
      const url = path
        ? `https://image.tmdb.org/t/p/w185${path}`
        : null;

      this.photos.update(current => ({
        ...current,
        [id]: url,
      }));
    });
  }

  private addPeople(people: Person[]): void {
    this.actors.update(current => [
      ...current,
      ...people.filter(person => person.is_actor),
    ]);

    this.directors.update(current => [
      ...current,
      ...people.filter(person => person.is_director),
    ]);
  }

  // Ejecutar búsqueda
  search(): void {
    const query = this.searchQuery().trim();

    if (!query) return;

    this.searchState.clear();

    if (this.route.snapshot.queryParamMap.get('q') === query) {
      this.searchRequests.next(query);
      return;
    }

    this.router.navigate(['/search'], {
      queryParams: { q: query },
    });
  }

  // Guardar búsqueda al abrir una película
  saveSearch(): void {
    if (!this.hasSearched() || this.isLoading()) return;

    this.searchState.save({
      query: this.submittedQuery(),

      movies: [...this.movies()],
      actors: [...this.actors()],
      directors: [...this.directors()],

      moviesPage: this.moviesPage(),
      moviesTotalPages: this.moviesTotalPages(),

      peoplePage: this.peoplePage(),
      peopleTotalPages: this.peopleTotalPages(),

      posters: { ...this.posters() },
      photos: { ...this.photos() },

      scrollY: this.viewportScroller.getScrollPosition()[1],
    });
  }

  hasMoreMovies(): boolean {
    return !this.moviesError()
      && this.moviesPage() > 0
      && this.moviesPage() < this.moviesTotalPages();
  }

  hasMorePeople(): boolean {
    return !this.peopleError()
      && this.peoplePage() > 0
      && this.peoplePage() < this.peopleTotalPages();
  }

  loadMoreMovies(): void {
    if (
      this.isLoading() ||
      this.loadingMoreMovies() ||
      !this.hasMoreMovies()
    ) return;

    const version = this.searchVersion;
    const nextPage = this.moviesPage() + 1;

    this.loadingMoreMovies.set(true);
    this.moreMoviesError.set(false);

    this.movieService.searchMovies(
      this.submittedQuery(),
      nextPage
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: result => {
        if (version !== this.searchVersion) return;

        this.movies.update(current => [
          ...current,
          ...result.items,
        ]);

        this.moviesPage.set(result.page);
        this.moviesTotalPages.set(result.totalPages);

        this.loadingMoreMovies.set(false);
        this.loadPosters(result.items.slice(0, 8));
      },

      error: error => {
        if (version !== this.searchVersion) return;

        console.error('Error cargando películas:', error);
        this.moreMoviesError.set(true);
        this.loadingMoreMovies.set(false);
      },
    });
  }

  loadMorePeople(): void {
    if (
      this.isLoading() ||
      this.loadingMorePeople() ||
      !this.hasMorePeople()
    ) return;

    const version = this.searchVersion;
    const nextPage = this.peoplePage() + 1;

    this.loadingMorePeople.set(true);
    this.morePeopleError.set(false);

    this.personService.searchPeople(
      this.submittedQuery(),
      nextPage
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: result => {
        if (version !== this.searchVersion) return;

        this.addPeople(result.items);

        this.peoplePage.set(result.page);
        this.peopleTotalPages.set(result.totalPages);

        this.loadingMorePeople.set(false);
        this.loadPhotos();
      },

      error: error => {
        if (version !== this.searchVersion) return;

        console.error('Error cargando personas:', error);
        this.morePeopleError.set(true);
        this.loadingMorePeople.set(false);
      },
    });
  }
}
