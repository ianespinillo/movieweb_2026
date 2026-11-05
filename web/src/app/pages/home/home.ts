import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, from, map, mergeMap, of } from 'rxjs';
import type { TmdbVideo, UserMovie } from '@movieweb/contracts';
import type { Movie } from '../../models/movie.model';
import type { Person } from '../../models/person.model';
import { Movie as MovieService } from '../../services/movie';
import { PersonService } from '../../services/person';
import { UserService } from '../../services/user';
import { AuthService } from '../../services/auth';

interface TrailerCard {
  movie_id: number;
  title: string;
  key: string;
  name: string;
}
interface PersonCard extends Person {
  photo: string | null;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {

  @ViewChild('featuredRail') featuredRail?: ElementRef<HTMLElement>;
  @ViewChild('ratedRail') ratedRail?: ElementRef<HTMLElement>;
  @ViewChild('personalRail') personalRail?: ElementRef<HTMLElement>;
  @ViewChild('actorsRail') actorsRail?: ElementRef<HTMLElement>;

  private resetRail(rail?: ElementRef<HTMLElement>): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rail?.nativeElement.scrollTo({ left: 0, behavior: 'auto' });
      });
    });
  }

  private readonly moviesApi = inject(MovieService);
  private readonly peopleApi = inject(PersonService);
  private readonly usersApi = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser = this.auth.currentUser;
  readonly featured = signal<Movie[]>([]);
  readonly posters = signal<Record<number, string | null>>({});
  readonly people = signal<PersonCard[]>([]);
  readonly trailers = signal<TrailerCard[]>([]);
  readonly activeTrailer = signal(0);
  readonly userMovies = signal<UserMovie[]>([]);
  readonly userLoading = signal(false);
  readonly userError = signal(false);
  readonly moviesLoading = signal(true);
  readonly peopleLoading = signal(true);
  readonly trailerLoading = signal(true);

  // IDs de TMDB presentes habitualmente en la base de 4.803 películas.
  // Se omiten automáticamente las que no estén en la BD.
  private readonly featuredIds = [155, 19995, 27205, 157336, 603, 680, 13, 278, 238, 550, 120, 24428];
  private readonly trailerIds = [27205, 157336, 19995, 155, 603, 24428];
  private readonly actorQueries = [
    'Robert Downey', 'Scarlett Johansson', 'Leonardo DiCaprio',
    'Emma Stone', 'Tom Hanks', 'Natalie Portman', 'Denzel Washington',
  ];

  readonly topRated = computed(() =>
    [...this.featured()]
      .filter(movie => movie.vote_average !== null && (movie.vote_count ?? 0) >= 100)
      .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
      .slice(0, 8)
  );

  // UNA sola fila para el usuario: favoritas primero; si no tiene, vistas.
  readonly personalized = computed(() => {
    const list = this.userMovies();
    const favorites = list.filter(item => item.is_favorite);
    const selected = favorites.length ? favorites : list.filter(item => item.watched);
    return [...selected].sort((a, b) =>
      new Date(b.updated_at || b.added_at).getTime() - new Date(a.updated_at || a.added_at).getTime()
    ).slice(0, 12);
  });
  readonly personalizedKind = computed<'favorites' | 'watched'>(() =>
    this.userMovies().some(movie => movie.is_favorite) ? 'favorites' : 'watched'
  );

  readonly trailerUrl = computed<SafeResourceUrl | null>(() => {
    const item = this.trailers()[this.activeTrailer()];
    if (!item || !/^[a-zA-Z0-9_-]{11}$/.test(item.key)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${item.key}?rel=0`
    );
  });

  constructor() {
    this.loadMovies();
    this.loadPeople();
    this.loadTrailers();

    effect((onCleanup) => {
      const user = this.currentUser();
      this.userMovies.set([]);
      this.userError.set(false);
      if (!user) {
        this.userLoading.set(false);
        return;
      }
      this.userLoading.set(true);
      const sub = this.usersApi.getUserMovies(user.user_id).subscribe({
        next: items => {
          this.userMovies.set(items);
          this.userLoading.set(false);
          this.resetRail(this.personalRail);
          this.loadPosters(items);
        },
        error: () => {
          this.userError.set(true);
          this.userLoading.set(false);
        },
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  private loadMovies(): void {
    from(this.featuredIds).pipe(
      mergeMap(id => this.moviesApi.getMovieById(id).pipe(
        map(movie => ({
          movie_id: movie.movie_id,
          title: movie.title,
          overview: movie.overview,
          release_date: movie.release_date,
          vote_average: movie.vote_average,
          vote_count: movie.vote_count,
        } as Movie)),
        catchError(() => of(null))
      ), 4),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: movie => {
        if (movie) {
          this.featured.update(list => [...list, movie].sort((a, b) =>
            this.featuredIds.indexOf(a.movie_id) - this.featuredIds.indexOf(b.movie_id)
          ));
          this.loadPosters([movie]);
        }
      },
      complete: () => {
        this.moviesLoading.set(false);
        this.resetRail(this.featuredRail);
        this.resetRail(this.ratedRail);
      },
    });
  }

  private loadPosters(movies: { movie_id: number }[]): void {
    const missing = movies.filter(movie => !(movie.movie_id in this.posters()));
    from(missing).pipe(
      mergeMap(movie => this.moviesApi.getTmdbMovie(movie.movie_id).pipe(
        map(meta => ({ id: movie.movie_id, path: meta.poster_path })),
        catchError(() => of({ id: movie.movie_id, path: null }))
      ), 4),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ id, path }) => {
      this.posters.update(current => ({
        ...current,
        [id]: path ? `https://image.tmdb.org/t/p/w342${path}` : null,
      }));
    });
  }

  private loadPeople(): void {
    from(this.actorQueries).pipe(
      mergeMap(query => this.peopleApi.searchPeople(query, 1, 5).pipe(
        map(page => page.items.find(person => person.is_actor) ?? null),
        catchError(() => of(null))
      ), 3),
      mergeMap(person => person
        ? this.peopleApi.getTmdbPerson(person.person_id).pipe(
            map(meta => ({ ...person, photo: meta.profile_path
              ? `https://image.tmdb.org/t/p/w185${meta.profile_path}` : null } as PersonCard)),
            catchError(() => of({ ...person, photo: null } as PersonCard))
          )
        : of(null), 3),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: person => {
        if (person && !this.people().some(p => p.person_id === person.person_id)) {
          this.people.update(list => [...list, person]);
        }
      },
      complete: () => {
        this.peopleLoading.set(false);
        this.resetRail(this.actorsRail);
      },
    });
  }

  private loadTrailers(): void {
    from(this.trailerIds).pipe(
      mergeMap(id => forkJoin({
        movie: this.moviesApi.getMovieById(id),
        videos: this.moviesApi.getMovieVideos(id),
      }).pipe(
        map(({ movie, videos }) => {
          const youtube = videos.filter((v: TmdbVideo) =>
            v.site === 'YouTube' && /^[a-zA-Z0-9_-]{11}$/.test(v.key)
          );
          const picked = youtube.find(v => v.type === 'Trailer' && v.official)
            ?? youtube.find(v => v.type === 'Trailer') ?? youtube.find(v => v.type === 'Teaser');
          return picked ? {
            movie_id: id, title: movie.title, key: picked.key, name: picked.name,
          } as TrailerCard : null;
        }),
        catchError(() => of(null))
      ), 3),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: item => {
        if (item) this.trailers.update(list => [...list, item].sort((a, b) =>
          this.trailerIds.indexOf(a.movie_id) - this.trailerIds.indexOf(b.movie_id)
        ));
      },
      complete: () => this.trailerLoading.set(false),
    });
  }

  changeTrailer(step: number): void {
    const count = this.trailers().length;
    if (count) this.activeTrailer.update(index => (index + step + count) % count);
  }

  selectTrailer(index: number): void {
    this.activeTrailer.set(index);
  }

  openLogin(): void {
    this.auth.openModal();
  }
}
