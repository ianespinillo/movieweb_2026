import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, from, map, mergeMap, of, switchMap, tap } from 'rxjs';

import type {
  ActingCredit,
  CrewCredit,
  FilmographyMovie,
  PersonDetail as PersonDetailModel,
  TmdbPersonMeta,
} from '@movieweb/contracts';

import { PersonService } from '../../services/person';
import { AuthService } from '../../services/auth';
import { AuthModal } from '../../components/auth-modal/auth-modal';

type FilmographyTab = 'actor' | 'director' | 'crew';

@Component({
  selector: 'app-person-detail',
  imports: [RouterLink, AuthModal],
  templateUrl: './person-detail.html',
  styleUrl: './person-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly personService = inject(PersonService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly person = signal<PersonDetailModel | null>(null);
  readonly tmdb = signal<TmdbPersonMeta | null>(null);

  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly tmdbError = signal(false);

  readonly searchQuery = signal<string | null>(null);
  readonly activeTab = signal<FilmographyTab>('actor');
  readonly showFullBio = signal(false);

  // User session
  readonly currentUser = this.authService.currentUser;
  readonly showAuthModal = signal(false);

  logout(): void {
    this.authService.logout();
  }

  readonly moviePosters = signal<Record<number, string | null>>({});

  readonly roles = computed(() => {
    const p = this.person();
    if (!p) return [];
    const list: string[] = [];
    if (p.as_actor.length > 0) list.push('Actor');
    if (p.as_director.length > 0) list.push('Director');
    if (p.as_crew.length > 0) list.push('Equipo técnico');
    return list;
  });

  readonly totalCredits = computed(() => {
    const p = this.person();
    if (!p) return 0;
    return p.as_actor.length + p.as_director.length + p.as_crew.length;
  });

  readonly profileUrl = computed(() => {
    const path = this.tmdb()?.profile_path;
    return path ? `https://image.tmdb.org/t/p/w342${path}` : null;
  });

  readonly activeCredits = computed(() => {
    const p = this.person();
    if (!p) return [];
    switch (this.activeTab()) {
      case 'actor':
        return p.as_actor;
      case 'director':
        return p.as_director;
      case 'crew':
        return p.as_crew;
    }
  });

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.searchQuery.set(params.get('q'));
      });

    this.route.paramMap
      .pipe(
        tap(() => {
          this.isLoading.set(true);
          this.hasError.set(false);
          this.tmdbError.set(false);
          this.person.set(null);
          this.tmdb.set(null);
          this.moviePosters.set({});
          this.showFullBio.set(false);
        }),
        switchMap(params => {
          const id = params.get('id');
          if (!id || !/^[1-9]\d*$/.test(id)) {
            return of({ person: null, tmdb: null });
          }

          return forkJoin({
            person: this.personService.getPersonById(id).pipe(
              catchError(err => {
                console.error('Error al cargar persona:', err);
                return of(null);
              })
            ),
            tmdb: this.personService.getTmdbPerson(id).pipe(
              catchError(err => {
                console.warn('Error al consultar TMDB:', err);
                this.tmdbError.set(true);
                return of(null);
              })
            ),
          });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ person, tmdb }) => {
        this.person.set(person);
        this.tmdb.set(tmdb);
        this.hasError.set(person === null);
        this.isLoading.set(false);

        if (person) {
          if (person.as_actor.length > 0) {
            this.activeTab.set('actor');
          } else if (person.as_director.length > 0) {
            this.activeTab.set('director');
          } else {
            this.activeTab.set('crew');
          }

          this.loadPostersForCredits([
            ...person.as_actor,
            ...person.as_director,
            ...person.as_crew,
          ]);
        }
      });
  }

  setTab(tab: FilmographyTab): void {
    this.activeTab.set(tab);
  }

  toggleBio(): void {
    this.showFullBio.update(val => !val);
  }

  getYear(date: string | null): string {
    return date ? date.substring(0, 4) : 'Sin año';
  }

  formatDate(date: string | null): string {
    if (!date) return 'Sin información';
    const parts = date.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return date;
  }

  getActorRole(credit: FilmographyMovie): string {
    return (credit as ActingCredit).character_name || 'Personaje no especificado';
  }

  getCrewRole(credit: FilmographyMovie): string {
    const c = credit as CrewCredit;
    return c.job ? `${c.job} (${c.department_name})` : c.department_name;
  }

  private loadPostersForCredits(credits: FilmographyMovie[]): void {
    const uniqueIds = Array.from(new Set(credits.map(c => c.movie_id))).slice(0, 30);

    from(uniqueIds)
      .pipe(
        mergeMap(
          movieId =>
            this.personService.getTmdbMovie(movieId).pipe(
              map(meta => ({
                id: movieId,
                url: meta.poster_path ? `https://image.tmdb.org/t/p/w342${meta.poster_path}` : null,
              })),
              catchError(() => of({ id: movieId, url: null }))
            ),
          3
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ id, url }) => {
        this.moviePosters.update(curr => ({
          ...curr,
          [id]: url,
        }));
      });
  }
}
