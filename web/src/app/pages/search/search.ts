
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, forkJoin, of, catchError, map, switchMap, tap } from 'rxjs';

import { Movie } from '../../models/movie.model';
import { Person } from '../../models/person.model';
import { Movie as MovieService } from '../../services/movie';
import { PersonService } from '../../services/person';

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

  searchQuery = signal('');
  submittedQuery = signal('');
  hasSearched = signal(false);
  isLoading = signal(false);

  moviesError = signal(false);
  peopleError = signal(false);

  movies: Movie[] = [];
  actors: Person[] = [];
  directors: Person[] = [];

  constructor() {
    this.searchRequests.pipe(
      tap(query => {
        this.submittedQuery.set(query);
        this.hasSearched.set(true);
        this.isLoading.set(true);

        this.moviesError.set(false);
        this.peopleError.set(false);

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
                data: [] as Movie[],
                failed: true,
              });
            })
          ),

          people: this.personService.searchPeople(query).pipe(
            map(data => ({ data, failed: false })),
            catchError(error => {
              console.error('Error buscando personas:', error);
              return of({
                data: [] as Person[],
                failed: true,
              });
            })
          ),
        })
      ),

      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ movies, people }) => {
      this.movies = movies.data;

      this.actors = people.data.filter(person => person.is_actor);
      this.directors = people.data.filter(person => person.is_director);

      this.moviesError.set(movies.failed);
      this.peopleError.set(people.failed);

      this.isLoading.set(false);
    });
  }

  search(): void {
    const query = this.searchQuery().trim();

    if (!query) {
      return;
    }

    this.searchRequests.next(query);
  }
}
