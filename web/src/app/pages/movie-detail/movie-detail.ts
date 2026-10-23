
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { catchError, forkJoin, of, switchMap, tap } from 'rxjs';

import type {
  MovieDetail as MovieDetailModel,
  TmdbMovieMeta,
  TmdbVideo,
} from '@movieweb/contracts';

import { Movie as MovieService } from '../../services/movie';

@Component({
  selector: 'app-movie-detail',
  imports: [RouterLink],
  templateUrl: './movie-detail.html',
  styleUrl: './movie-detail.css',
})
export class MovieDetail {
  private route = inject(ActivatedRoute);
  private movieService = inject(MovieService);
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(DomSanitizer);

  movie = signal<MovieDetailModel | null>(null);
  tmdb = signal<TmdbMovieMeta | null>(null);
  videos = signal<TmdbVideo[]>([]);

  isLoading = signal(true);
  hasError = signal(false);
  tmdbError = signal(false);

  constructor() {
    this.route.paramMap.pipe(
      tap(() => {
        this.isLoading.set(true);
        this.hasError.set(false);
        this.tmdbError.set(false);

        this.movie.set(null);
        this.tmdb.set(null);
        this.videos.set([]);
      }),

      switchMap(params => {
        const id = params.get('id');

        if (!id || !/^[1-9]\d*$/.test(id)) {
          return of({ movie: null, tmdb: null, videos: [] });
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
              console.warn('No se pudo cargar TMDB:', error);
              this.tmdbError.set(true);
              return of(null);
            })
          ),

          videos: this.movieService.getMovieVideos(id).pipe(
            catchError(error => {
              console.warn('No se pudieron cargar los videos:', error);
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
    });
  }

  getImageUrl(path: string | null, size = 'w500'): string | null {
    if (!path) return null;

    return `https://image.tmdb.org/t/p/${size}${path}`;
  }

  getTrailer(): TmdbVideo | null {
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
  }

  getTrailerUrl(): SafeResourceUrl | null {
    const trailer = this.getTrailer();

    if (!trailer) return null;

    const url = `https://www.youtube-nocookie.com/embed/${trailer.key}`;

    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  getYear(date: string | null): string {
    if (!date) return 'Año desconocido';

    return date.substring(0, 4);
  }

  formatRuntime(minutes: number | null): string {
    if (minutes === null) return 'Sin información';

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours === 0) return `${remainingMinutes} min`;

    return `${hours} h ${remainingMinutes} min`;
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
