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
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  forkJoin,
  from,
  map,
  mergeMap,
  of,
  switchMap,
  tap,
} from 'rxjs';

import type { Keyword, KeywordMovie, TmdbPersonMeta } from '@movieweb/contracts';

import { Movie } from '../../models/movie.model';
import { Person } from '../../models/person.model';

import {
  Movie as MovieService,
  MovieSearchPage,
  KeywordSearchPage,
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

export interface AutocompleteSuggestion {
  id: string | number;
  title: string;
  subtitle: string;
  type: 'movie' | 'person' | 'keyword';
  typeLabel: string;
  icon: string;
  route?: (string | number)[];
  keyword?: string;
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
  readonly keywordsError = signal(false);
  readonly peopleError = signal(false);

  readonly loadingMoreMovies = signal(false);
  readonly loadingMoreKeywords = signal(false);
  readonly loadingMorePeople = signal(false);

  readonly moreMoviesError = signal(false);
  readonly moreKeywordsError = signal(false);
  readonly morePeopleError = signal(false);

  readonly moviesPage = signal(0);
  readonly moviesTotalPages = signal(0);

  readonly keywordPage = signal(0);
  readonly keywordTotalPages = signal(0);

  readonly peoplePage = signal(0);
  readonly peopleTotalPages = signal(0);

  readonly movies = signal<Movie[]>([]);
  readonly keywordMovies = signal<KeywordMovie[]>([]);
  readonly actors = signal<Person[]>([]);
  readonly directors = signal<Person[]>([]);

  readonly posters = signal<Record<number, string | null>>({});
  readonly photos = signal<Record<number, string | null>>({});

  readonly suggestedMovies = signal<Movie[]>([]);
  readonly loadingSuggestions = signal(true);

  // Autocomplete
  private readonly autocompleteSubject = new Subject<string>();
  readonly autocompleteSuggestions = signal<AutocompleteSuggestion[]>([]);
  readonly isAutocompleteLoading = signal(false);
  readonly showAutocomplete = signal(false);
  readonly activeSuggestionIndex = signal(-1);
  readonly isInputFocused = signal(false);

  // Películas destacadas para la portada
  private readonly suggestedIds = [
    155,
    19995,
    27205,
    157336,
  ];

  constructor() {
    this.loadSuggestions();
    this.initAutocomplete();

    // Búsqueda normal
    this.searchRequests.pipe(
      tap(query => {
        this.searchVersion++;

        this.submittedQuery.set(query);
        this.hasSearched.set(true);
        this.isLoading.set(true);

        this.moviesError.set(false);
        this.keywordsError.set(false);
        this.peopleError.set(false);

        this.moreMoviesError.set(false);
        this.moreKeywordsError.set(false);
        this.morePeopleError.set(false);

        this.loadingMoreMovies.set(false);
        this.loadingMoreKeywords.set(false);
        this.loadingMorePeople.set(false);

        this.moviesPage.set(0);
        this.moviesTotalPages.set(0);
        this.keywordPage.set(0);
        this.keywordTotalPages.set(0);
        this.peoplePage.set(0);
        this.peopleTotalPages.set(0);

        this.movies.set([]);
        this.keywordMovies.set([]);
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

          keywordMovies: this.movieService.searchByKeyword(query).pipe(
            map(data => ({
              data,
              failed: false,
            })),
            catchError(error => {
              console.error('Error buscando por palabra clave:', error);
              return of({
                data: null as KeywordSearchPage | null,
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
    ).subscribe(({ movies, keywordMovies, people }) => {
      if (movies.data) {
        this.movies.set(movies.data.items);
        this.moviesPage.set(movies.data.page);
        this.moviesTotalPages.set(movies.data.totalPages);

        this.loadPosters(movies.data.items.slice(0, 8));
      }

      if (keywordMovies.data) {
        this.keywordMovies.set(keywordMovies.data.items);
        this.keywordPage.set(keywordMovies.data.page);
        this.keywordTotalPages.set(keywordMovies.data.totalPages);

        this.loadPosters(keywordMovies.data.items.slice(0, 8));
      }

      if (people.data) {
        this.addPeople(people.data.items);
        this.peoplePage.set(people.data.page);
        this.peopleTotalPages.set(people.data.totalPages);

        this.loadPhotos();
      }

      this.moviesError.set(movies.failed);
      this.keywordsError.set(keywordMovies.failed);
      this.peopleError.set(people.failed);
      this.isLoading.set(false);
    });

    // Recuperar búsqueda al volver de una película o persona
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

  private initAutocomplete(): void {
    this.autocompleteSubject.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(term => {
        const trimmed = term.trim();
        if (!trimmed || trimmed.length < 2) {
          return of<AutocompleteSuggestion[]>([]);
        }

        this.isAutocompleteLoading.set(true);

        return forkJoin({
          movies: this.movieService.searchMovies(trimmed, 1, 5).pipe(
            map(res => res.items),
            catchError(() => of([] as Movie[]))
          ),
          people: this.personService.searchPeople(trimmed, 1, 3).pipe(
            map(res => res.items),
            catchError(() => of([] as Person[]))
          ),
          keywords: this.movieService.suggestKeywords(trimmed, 3).pipe(
            catchError(() => of([] as Keyword[]))
          ),
        }).pipe(
          map(({ movies, people, keywords }) => {
            const list: AutocompleteSuggestion[] = [];

            // 1. Películas sugeridas
            for (const m of movies) {
              const year = m.release_date ? m.release_date.slice(0, 4) : '';
              list.push({
                id: `m_${m.movie_id}`,
                title: m.title,
                subtitle: year ? `${year} • Película` : 'Película',
                type: 'movie',
                typeLabel: 'Película',
                icon: '🎬',
                route: ['/movies', m.movie_id],
              });
            }

            // 2. Personas sugeridas (actores / directores)
            for (const p of people) {
              const role = p.is_director && p.is_actor
                ? 'Director / Actor'
                : p.is_director
                ? 'Director'
                : 'Actor';
              list.push({
                id: `p_${p.person_id}`,
                title: p.person_name,
                subtitle: role,
                type: 'person',
                typeLabel: role,
                icon: '👤',
                route: ['/people', p.person_id],
              });
            }

            // 3. Palabras clave sugeridas
            for (const k of keywords) {
              list.push({
                id: `k_${k.keyword_id}`,
                title: k.keyword_name,
                subtitle: 'Palabra clave',
                type: 'keyword',
                typeLabel: 'Keyword',
                icon: '🏷️',
                keyword: k.keyword_name,
              });
            }

            // Máximo 5 sugerencias
            return list.slice(0, 5);
          }),
          finalize(() => this.isAutocompleteLoading.set(false))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(suggestions => {
      this.autocompleteSuggestions.set(suggestions);
      this.showAutocomplete.set(suggestions.length > 0 && this.isInputFocused());
      this.activeSuggestionIndex.set(-1);
    });
  }

  // Restaurar resultados y paginación
  private restoreSearch(saved: import(
    '../../services/search-state'
  ).SavedSearch): void {
    this.searchQuery.set(saved.query);
    this.submittedQuery.set(saved.query);

    this.movies.set([...saved.movies]);
    if (saved.keywordMovies) {
      this.keywordMovies.set([...saved.keywordMovies]);
      this.keywordPage.set(saved.keywordsPage ?? 0);
      this.keywordTotalPages.set(saved.keywordsTotalPages ?? 0);
    }
    this.actors.set([...saved.actors]);
    this.directors.set([...saved.directors]);

    this.moviesPage.set(saved.moviesPage);
    this.moviesTotalPages.set(saved.moviesTotalPages);

    this.peoplePage.set(saved.peoplePage);
    this.peopleTotalPages.set(saved.peopleTotalPages);

    this.posters.set({ ...saved.posters });
    this.photos.set({ ...saved.photos });

    this.moviesError.set(false);
    this.keywordsError.set(false);
    this.peopleError.set(false);
    this.moreMoviesError.set(false);
    this.moreKeywordsError.set(false);
    this.morePeopleError.set(false);

    this.loadingMoreMovies.set(false);
    this.loadingMoreKeywords.set(false);
    this.loadingMorePeople.set(false);

    this.hasSearched.set(true);
    this.isLoading.set(false);

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
  private loadPosters(items: { movie_id: number }[]): void {
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

  // Interacción de búsqueda y autocomplete
  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.autocompleteSubject.next(value);
  }

  onInputFocus(): void {
    this.isInputFocused.set(true);
    if (this.autocompleteSuggestions().length > 0) {
      this.showAutocomplete.set(true);
    }
  }

  onInputBlur(): void {
    // Breve espera para permitir click en las sugerencias
    setTimeout(() => {
      this.isInputFocused.set(false);
      this.showAutocomplete.set(false);
    }, 220);
  }

  onKeydown(event: KeyboardEvent): void {
    const suggestions = this.autocompleteSuggestions();
    const isDropdownVisible = this.showAutocomplete() && suggestions.length > 0;

    if (event.key === 'ArrowDown') {
      if (!isDropdownVisible) return;
      event.preventDefault();
      const nextIndex = (this.activeSuggestionIndex() + 1) % suggestions.length;
      this.activeSuggestionIndex.set(nextIndex);
    } else if (event.key === 'ArrowUp') {
      if (!isDropdownVisible) return;
      event.preventDefault();
      const prevIndex = (this.activeSuggestionIndex() - 1 + suggestions.length) % suggestions.length;
      this.activeSuggestionIndex.set(prevIndex);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const activeIdx = this.activeSuggestionIndex();
      if (isDropdownVisible && activeIdx >= 0 && activeIdx < suggestions.length) {
        this.selectSuggestion(suggestions[activeIdx]);
      } else {
        this.search();
      }
    } else if (event.key === 'Escape') {
      this.showAutocomplete.set(false);
      this.activeSuggestionIndex.set(-1);
    }
  }

  selectSuggestion(item: AutocompleteSuggestion, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.showAutocomplete.set(false);

    if (item.type === 'movie' || item.type === 'person') {
      if (item.route) {
        this.saveSearch();
        this.router.navigate(item.route);
      }
    } else if (item.type === 'keyword') {
      const kw = item.keyword || item.title;
      this.searchKeyword(kw);
    }
  }

  searchKeyword(keyword: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.searchQuery.set(keyword);
    this.showAutocomplete.set(false);
    this.search();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.autocompleteSuggestions.set([]);
    this.showAutocomplete.set(false);
    this.activeSuggestionIndex.set(-1);
  }

  // Ejecutar búsqueda
  search(): void {
    const query = this.searchQuery().trim();
    this.showAutocomplete.set(false);

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

  // Guardar búsqueda al navegar
  saveSearch(): void {
    if (!this.hasSearched() || this.isLoading()) return;

    this.searchState.save({
      query: this.submittedQuery(),

      movies: [...this.movies()],
      keywordMovies: [...this.keywordMovies()],
      actors: [...this.actors()],
      directors: [...this.directors()],

      moviesPage: this.moviesPage(),
      moviesTotalPages: this.moviesTotalPages(),
      keywordsPage: this.keywordPage(),
      keywordsTotalPages: this.keywordTotalPages(),

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

  hasMoreKeywords(): boolean {
    return !this.keywordsError()
      && this.keywordPage() > 0
      && this.keywordPage() < this.keywordTotalPages();
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

  loadMoreKeywords(): void {
    if (
      this.isLoading() ||
      this.loadingMoreKeywords() ||
      !this.hasMoreKeywords()
    ) return;

    const version = this.searchVersion;
    const nextPage = this.keywordPage() + 1;

    this.loadingMoreKeywords.set(true);
    this.moreKeywordsError.set(false);

    this.movieService.searchByKeyword(
      this.submittedQuery(),
      nextPage
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: result => {
        if (version !== this.searchVersion) return;

        this.keywordMovies.update(current => [
          ...current,
          ...result.items,
        ]);

        this.keywordPage.set(result.page);
        this.keywordTotalPages.set(result.totalPages);

        this.loadingMoreKeywords.set(false);
        this.loadPosters(result.items.slice(0, 8));
      },

      error: error => {
        if (version !== this.searchVersion) return;

        console.error('Error cargando películas por palabra clave:', error);
        this.moreKeywordsError.set(true);
        this.loadingMoreKeywords.set(false);
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
