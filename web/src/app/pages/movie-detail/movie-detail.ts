import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import {
  catchError,
  forkJoin,
  from,
  map,
  mergeMap,
  of,
  switchMap,
  tap,
} from 'rxjs';

import type {
  MovieDetail as MovieDetailModel,
  MovieReview,
  TmdbMovieMeta,
  TmdbPersonMeta,
  TmdbVideo,
  UserMovie,
} from '@movieweb/contracts';

import { Movie as MovieService } from '../../services/movie';
import { AuthService } from '../../services/auth';
import { UserService } from '../../services/user';
import { ReviewService } from '../../services/review';
import { apiErrorMessage } from '../../services/api-response';
import { TMDB_ROUTES } from '../../services/api-routes';

interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

@Component({
  selector: 'app-movie-detail',
  imports: [RouterLink, DatePipe],
  templateUrl: './movie-detail.html',
  styleUrl: './movie-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovieDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly movieService = inject(MovieService);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly reviewService = inject(ReviewService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  readonly movie = signal<MovieDetailModel | null>(null);
  readonly tmdb = signal<TmdbMovieMeta | null>(null);
  readonly videos = signal<TmdbVideo[]>([]);

  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly tmdbError = signal(false);

  readonly searchQuery = signal<string | null>(null);

  readonly castPhotos = signal<Record<number, string | null>>({});
  readonly directorPhotos = signal<Record<number, string | null>>({});

  readonly showAllCast = signal(false);

  // User session and interactions
  readonly currentUser = this.authService.currentUser;
  readonly userMovie = signal<UserMovie | null>(null);
  readonly isSavingUserMovie = signal(false);
  readonly hoverRating = signal<number | null>(null);

  // Text reviews
  readonly maxReviewLength = 2000;
  readonly reviews = signal<MovieReview[]>([]);
  readonly reviewDraft = signal('');
  readonly isSavingReview = signal(false);
  readonly reviewError = signal<string | null>(null);

  readonly myReview = computed(() => {
    const user = this.currentUser();
    return user ? this.reviews().find(r => r.user_id === user.user_id) ?? null : null;
  });

  readonly reviewDirty = computed(
    () => this.reviewDraft().trim() !== (this.myReview()?.text ?? '')
  );

  readonly visibleCast = computed(() => {
    const cast = this.movie()?.cast ?? [];
    return this.showAllCast() ? cast : cast.slice(0, 10);
  });

  readonly hasMoreCast = computed(() =>
    (this.movie()?.cast.length ?? 0) > 10
  );

  readonly backdropUrl = computed(() => {
    const path = this.tmdb()?.backdrop_path;
    return path ? this.getImageUrl(path, 'original') : null;
  });

  readonly trailer = computed(() => {
    const youtubeVideos = this.videos().filter(
      video =>
        video.site === 'YouTube' &&
        /^[a-zA-Z0-9_-]{11}$/.test(video.key)
    );

    return youtubeVideos.find(
      video => video.type === 'Trailer' && video.official
    ) ?? youtubeVideos.find(
      video => video.type === 'Trailer'
    ) ?? youtubeVideos.find(
      video => video.type === 'Teaser'
    ) ?? null;
  });

  readonly trailerUrl = computed<SafeResourceUrl | null>(() => {
    const video = this.trailer();
    if (!video) return null;

    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${video.key}`
    );
  });

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.searchQuery.set(params.get('q'));
      });

    this.route.paramMap.pipe(
      tap(() => {
        this.isLoading.set(true);
        this.hasError.set(false);
        this.tmdbError.set(false);
        this.movie.set(null);
        this.tmdb.set(null);
        this.videos.set([]);
        this.castPhotos.set({});
        this.directorPhotos.set({});
        this.showAllCast.set(false);
        this.userMovie.set(null);
        this.reviews.set([]);
        this.reviewDraft.set('');
        this.reviewError.set(null);
      }),

      switchMap(params => {
        const id = params.get('id');

        if (!id || !/^[1-9]\d*$/.test(id)) {
          return of({
            movie: null,
            tmdb: null,
            videos: [] as TmdbVideo[],
          });
        }

        return forkJoin({
          movie: this.movieService.getMovieById(id).pipe(
            catchError(error => {
              console.error('Error cargando película:', error);
              return of(null);
            })
          ),

          tmdb: this.movieService.getTmdbMovie(id).pipe(
            catchError(error => {
              console.warn('Error consultando TMDB:', error);
              this.tmdbError.set(true);
              return of(null);
            })
          ),

          videos: this.movieService.getMovieVideos(id).pipe(
            catchError(error => {
              console.warn('Error cargando tráiler:', error);
              this.tmdbError.set(true);
              return of([] as TmdbVideo[]);
            })
          ),
        });
      }),

      takeUntilDestroyed(this.destroyRef)
    ).subscribe(result => {
      this.movie.set(result.movie);
      this.tmdb.set(result.tmdb);
      this.videos.set(result.videos);

      this.hasError.set(result.movie === null);
      this.isLoading.set(false);

      if (result.movie) {
        this.loadPersonPhotos(result.movie);
        this.loadUserMovie(result.movie.movie_id);
        this.loadReviews(result.movie.movie_id);
      }
    });

    effect(() => {
      const user = this.currentUser();
      const currentMovie = this.movie();
      if (user && currentMovie) {
        this.loadUserMovie(currentMovie.movie_id);
        this.loadReviews(currentMovie.movie_id);
      } else if (!user) {
        this.userMovie.set(null);
      }
    });
  }

  loadUserMovie(movieId: number): void {
    const user = this.currentUser();
    if (!user) return;

    this.userService
      .getUserMovies(user.user_id)
      .pipe(
        catchError(() => of([] as UserMovie[])),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(list => {
        const match = list.find(m => m.movie_id === movieId);
        this.userMovie.set(match ?? null);
      });
  }

  private loadReviews(movieId: number): void {
    this.reviewService
      .getMovieReviews(movieId)
      .pipe(
        catchError(() => of([] as MovieReview[])),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(list => {
        if (this.movie()?.movie_id !== movieId) return;
        this.reviews.set(list);
        this.reviewDraft.set(this.myReview()?.text ?? '');
      });
  }

  onReviewInput(event: Event): void {
    this.reviewDraft.set((event.target as HTMLTextAreaElement).value);
  }

  openLogin(): void {
    this.authService.openModal();
  }

  saveReview(): void {
    const user = this.currentUser();
    const movie = this.movie();
    if (!user || !movie) {
      this.authService.openModal();
      return;
    }

    this.isSavingReview.set(true);
    this.reviewError.set(null);
    this.reviewService
      .saveReview(user.user_id, movie.movie_id, { text: this.reviewDraft().trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSavingReview.set(false);
          this.loadReviews(movie.movie_id);
        },
        error: err => {
          this.reviewError.set(apiErrorMessage(err));
          this.isSavingReview.set(false);
        },
      });
  }

  deleteReview(): void {
    const user = this.currentUser();
    const movie = this.movie();
    if (!user || !movie) return;

    this.isSavingReview.set(true);
    this.reviewError.set(null);
    this.reviewService
      .deleteReview(user.user_id, movie.movie_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSavingReview.set(false);
          this.reviews.update(list => list.filter(r => r.user_id !== user.user_id));
          this.reviewDraft.set('');
        },
        error: err => {
          this.reviewError.set(apiErrorMessage(err));
          this.isSavingReview.set(false);
        },
      });
  }

  setRating(stars: number): void {
    const user = this.currentUser();
    const movie = this.movie();
    if (!user || !movie) {
      this.authService.openModal();
      return;
    }

    const currentRating = this.userMovie()?.rating;
    const newRating = currentRating === stars ? null : stars;

    this.isSavingUserMovie.set(true);
    this.userService
      .updateMovieMark(user.user_id, movie.movie_id, { rating: newRating })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.userMovie.set(updated);
          this.isSavingUserMovie.set(false);
        },
        error: () => {
          this.isSavingUserMovie.set(false);
        },
      });
  }

  toggleFavorite(): void {
    const user = this.currentUser();
    const movie = this.movie();
    if (!user || !movie) {
      this.authService.openModal();
      return;
    }

    const newFav = !this.userMovie()?.is_favorite;

    this.isSavingUserMovie.set(true);
    this.userService
      .updateMovieMark(user.user_id, movie.movie_id, { is_favorite: newFav })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.userMovie.set(updated);
          this.isSavingUserMovie.set(false);
        },
        error: () => {
          this.isSavingUserMovie.set(false);
        },
      });
  }

  toggleWatched(): void {
    const user = this.currentUser();
    const movie = this.movie();
    if (!user || !movie) {
      this.authService.openModal();
      return;
    }

    const newWatched = !this.userMovie()?.watched;

    this.isSavingUserMovie.set(true);
    this.userService
      .updateMovieMark(user.user_id, movie.movie_id, { watched: newWatched })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.userMovie.set(updated);
          this.isSavingUserMovie.set(false);
        },
        error: () => {
          this.isSavingUserMovie.set(false);
        },
      });
  }

  private loadPersonPhotos(movie: MovieDetailModel): void {
    const movieId = movie.movie_id;

    const castIds = movie.cast
      .slice(0, 10)
      .map(person => person.person_id);

    const directorIds = movie.directors
      .map(person => person.person_id);

    const allIds = [...new Set([...castIds, ...directorIds])];

    from(allIds).pipe(
      mergeMap(
        id => this.http.get<ApiResponse<TmdbPersonMeta>>(
          TMDB_ROUTES.person(id)
        ).pipe(
          map(response => ({
            id,
            path: response.data.profile_path,
          })),
          catchError(() => of({ id, path: null }))
        ),
        3
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ id, path }) => {
      if (this.movie()?.movie_id !== movieId) return;

      const url = path
        ? this.getImageUrl(path, 'w185')
        : null;

      if (castIds.includes(id)) {
        this.castPhotos.update(current => ({
          ...current,
          [id]: url,
        }));
      }

      if (directorIds.includes(id)) {
        this.directorPhotos.update(current => ({
          ...current,
          [id]: url,
        }));
      }
    });
  }

  toggleCast(): void {
    this.showAllCast.update(value => !value);
  }

  getImageUrl(
    path: string | null,
    size = 'w500'
  ): string | null {
    if (!path) return null;

    return `https://image.tmdb.org/t/p/${size}${path}`;
  }

  getYear(date: string | null): string {
    return date ? date.substring(0, 4) : 'Sin año';
  }

  formatRuntime(minutes: number | null): string {
    if (minutes === null) return 'Sin información';

    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;

    return hours > 0
      ? `${hours} h ${remaining} min`
      : `${remaining} min`;
  }

  formatMoney(value: number | null): string {
    if (value === null) return 'Sin información';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
