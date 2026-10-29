import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, from, map, mergeMap, of } from 'rxjs';

import type { ActivityEvent, UserMovie } from '@movieweb/contracts';
import { AuthService } from '../../services/auth';
import { UserService } from '../../services/user';
import { ActivityService } from '../../services/activity';
import { Movie as MovieService } from '../../services/movie';

export type DashboardTab = 'timeline' | 'favorites' | 'rated';
export type SortField = 'date' | 'vote_average';
export type SortOrder = 'desc' | 'asc';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly activityService = inject(ActivityService);
  private readonly movieService = inject(MovieService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser = this.authService.currentUser;

  readonly activeTab = signal<DashboardTab>('timeline');
  readonly sortField = signal<SortField>('date');
  readonly sortOrder = signal<SortOrder>('desc');

  readonly isLoading = signal(true);
  readonly hasError = signal(false);

  readonly userMovies = signal<UserMovie[]>([]);
  readonly timeline = signal<ActivityEvent[]>([]);
  readonly posters = signal<Record<number, string | null>>({});

  // Películas favoritas (likeadas)
  readonly favoriteMovies = computed(() =>
    this.userMovies().filter(m => m.is_favorite)
  );

  // Películas calificadas por el usuario
  readonly ratedMovies = computed(() =>
    this.userMovies().filter(m => m.rating !== null)
  );

  // Listas ordenadas reactivamente
  readonly sortedFavorites = computed(() =>
    this.sortMovies(this.favoriteMovies(), this.sortField(), this.sortOrder())
  );

  readonly sortedRated = computed(() =>
    this.sortMovies(this.ratedMovies(), this.sortField(), this.sortOrder())
  );

  constructor() {
    effect(() => {
      const user = this.currentUser();
      if (user) {
        this.loadUserData(user.user_id);
      } else {
        this.userMovies.set([]);
        this.timeline.set([]);
        this.isLoading.set(false);
      }
    });
  }

  private loadUserData(userId: number): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      movies: this.userService.getUserMovies(userId).pipe(
        catchError(err => {
          console.error('Error obteniendo películas del usuario:', err);
          return of([] as UserMovie[]);
        })
      ),
      timeline: this.activityService.getUserTimeline(userId).pipe(
        catchError(err => {
          console.error('Error obteniendo timeline de actividad:', err);
          return of([] as ActivityEvent[]);
        })
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ movies, timeline }) => {
          this.userMovies.set(movies);
          this.timeline.set(timeline);
          this.isLoading.set(false);
          this.loadPosters(movies);
        },
        error: () => {
          this.hasError.set(true);
          this.isLoading.set(false);
        },
      });
  }

  private sortMovies(
    movies: UserMovie[],
    field: SortField,
    order: SortOrder
  ): UserMovie[] {
    return [...movies].sort((a, b) => {
      let comparison = 0;
      if (field === 'date') {
        const timeA = new Date(a.updated_at || a.added_at).getTime();
        const timeB = new Date(b.updated_at || b.added_at).getTime();
        comparison = timeA - timeB;
      } else if (field === 'vote_average') {
        const avgA = a.vote_average ?? 0;
        const avgB = b.vote_average ?? 0;
        comparison = avgA - avgB;
      }

      return order === 'desc' ? -comparison : comparison;
    });
  }

  private loadPosters(items: UserMovie[]): void {
    const missing = items.filter(m => !(m.movie_id in this.posters()));

    from(missing)
      .pipe(
        mergeMap(
          m =>
            this.movieService.getTmdbMovie(m.movie_id).pipe(
              map(meta => ({ id: m.movie_id, path: meta.poster_path })),
              catchError(() => of({ id: m.movie_id, path: null }))
            ),
          3
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ id, path }) => {
        const url = path ? `https://image.tmdb.org/t/p/w342${path}` : null;
        this.posters.update(curr => ({ ...curr, [id]: url }));
      });
  }

  setSortField(field: SortField): void {
    this.sortField.set(field);
  }

  toggleSortOrder(): void {
    this.sortOrder.update(curr => (curr === 'desc' ? 'asc' : 'desc'));
  }

  openLoginModal(): void {
    this.authService.openModal();
  }

  getEventIcon(type: string): string {
    switch (type) {
      case 'RATED_MOVIE':
        return '⭐';
      case 'ADDED_TO_FAVORITES':
        return '❤️';
      case 'WROTE_REVIEW':
        return '✍️';
      default:
        return '📌';
    }
  }

  getEventBadgeClass(type: string): string {
    switch (type) {
      case 'RATED_MOVIE':
        return 'badge-rated';
      case 'ADDED_TO_FAVORITES':
        return 'badge-fav';
      case 'WROTE_REVIEW':
        return 'badge-review';
      default:
        return 'badge-default';
    }
  }

  getEventActionLabel(event: ActivityEvent): string {
    switch (event.type) {
      case 'RATED_MOVIE':
        return `Calificó con ${event.details.rating ?? ''}★`;
      case 'ADDED_TO_FAVORITES':
        return 'Marcó como favorita';
      case 'WROTE_REVIEW':
        return 'Escribió una reseña';
      default:
        return 'Actividad registrada';
    }
  }
}
