
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, forkJoin, of, catchError, map, switchMap, tap } from 'rxjs';

import { Movie } from '../../models/movie.model';
import { Person } from '../../models/person.model';
import { Movie as MovieService, MovieSearchPage } from '../../services/movie';
import { PersonService, PeopleSearchPage } from '../../services/person';

@Component({
  selector: 'app-search',
  imports: [RouterLink],
  templateUrl: './search.html',
  styleUrl: './search.css',
})
export class Search {
  private movieService = inject(MovieService);
  private personService = inject(PersonService);
  private destroyRef = inject(DestroyRef);

  private searchRequests = new Subject<string>();
  private searchVersion = 0;

  searchQuery = signal('');
  submittedQuery = signal('');
  hasSearched = signal(false);
  isLoading = signal(false);

  moviesError = signal(false);
  peopleError = signal(false);

  loadingMoreMovies = signal(false);
  loadingMorePeople = signal(false);

  moreMoviesError = signal(false);
  morePeopleError = signal(false);

  moviesPage = signal(0);
  moviesTotalPages = signal(0);

  peoplePage = signal(0);
  peopleTotalPages = signal(0);

  movies: Movie[] = [];
  actors: Person[] = [];
  directors: Person[] = [];

  constructor() {
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

        this.movies = [];
        this.actors = [];
        this.directors = [];
      }),

      switchMap(query =>
        forkJoin({
          movies: this.movieService.searchMovies(query).pipe(
            map(data => ({ data, failed: false })),
            catchError(error => {
              console.error('Error buscando películas:', error);
              return of({
                data: null as MovieSearchPage | null,
                failed: true,
              });
            })
          ),

          people: this.personService.searchPeople(query).pipe(
            map(data => ({ data, failed: false })),
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
        this.movies = movies.data.items;
        this.moviesPage.set(movies.data.page);
        this.moviesTotalPages.set(movies.data.totalPages);
      }

      if (people.data) {
        this.addPeople(people.data.items);
        this.peoplePage.set(people.data.page);
        this.peopleTotalPages.set(people.data.totalPages);
      }

      this.moviesError.set(movies.failed);
      this.peopleError.set(people.failed);
      this.isLoading.set(false);
    });
  }

  private addPeople(people: Person[]): void {
    this.actors = [
      ...this.actors,
      ...people.filter(person => person.is_actor),
    ];

    this.directors = [
      ...this.directors,
      ...people.filter(person => person.is_director),
    ];
  }

  search(): void {
    const query = this.searchQuery().trim();

    if (!query) {
      return;
    }

    this.searchRequests.next(query);
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
    if (this.isLoading() || this.loadingMoreMovies() || !this.hasMoreMovies()) {
      return;
    }

    const version = this.searchVersion;
    const nextPage = this.moviesPage() + 1;

    this.loadingMoreMovies.set(true);
    this.moreMoviesError.set(false);

    this.movieService.searchMovies(this.submittedQuery(), nextPage)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          if (version !== this.searchVersion) return;

          this.movies = [...this.movies, ...result.items];
          this.moviesPage.set(result.page);
          this.moviesTotalPages.set(result.totalPages);
          this.loadingMoreMovies.set(false);
        },
        error: error => {
          if (version !== this.searchVersion) return;

          console.error('Error cargando más películas:', error);
          this.moreMoviesError.set(true);
          this.loadingMoreMovies.set(false);
        },
      });
  }

  loadMorePeople(): void {
    if (this.isLoading() || this.loadingMorePeople() || !this.hasMorePeople()) {
      return;
    }

    const version = this.searchVersion;
    const nextPage = this.peoplePage() + 1;

    this.loadingMorePeople.set(true);
    this.morePeopleError.set(false);

    this.personService.searchPeople(this.submittedQuery(), nextPage)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          if (version !== this.searchVersion) return;

          this.addPeople(result.items);
          this.peoplePage.set(result.page);
          this.peopleTotalPages.set(result.totalPages);
          this.loadingMorePeople.set(false);
        },
        error: error => {
          if (version !== this.searchVersion) return;

          console.error('Error cargando más personas:', error);
          this.morePeopleError.set(true);
          this.loadingMorePeople.set(false);
        },
      });
  }
}
