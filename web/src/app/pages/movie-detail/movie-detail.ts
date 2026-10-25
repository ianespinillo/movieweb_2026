
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  TmdbMovieMeta,
  TmdbPersonMeta,
  TmdbVideo,
} from '@movieweb/contracts';

import { Movie as MovieService } from '../../services/movie';
import { TMDB_ROUTES } from '../../services/api-routes';

interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

@Component({
  selector: 'app-movie-detail',
  imports: [RouterLink],
  templateUrl: './movie-detail.html',
  styleUrl: './movie-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovieDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly movieService = inject(MovieService);
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
      }
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
