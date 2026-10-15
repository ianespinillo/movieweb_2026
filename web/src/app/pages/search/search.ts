import { Component, inject, signal } from '@angular/core';
import { forkJoin, of, catchError, finalize, map, switchMap } from 'rxjs';

import { Movie } from '../../models/movie.model';
import { Person, PeopleSearchResponse } from '../../models/person.model';
import { Movie as MovieService } from '../../services/movie';
import { PersonService } from '../../services/person';

@Component({
  selector: 'app-search',
  imports: [],
  templateUrl: './search.html',
  styleUrl: './search.css',
})
export class Search {
  private movieService = inject(MovieService);
  private personService = inject(PersonService);

  searchQuery = signal('');
  submittedQuery = signal('');
  hasSearched = signal(false);
  isLoading = signal(false);

  moviesError = signal(false);
  peopleError = signal(false);

  movies: Movie[] = [];
  actors: Person[] = [];
  directors: Person[] = [];

  private searchVersion = 0;

  search(): void {
    const query = this.searchQuery().trim();

    if (!query) {
      return;
    }

    const currentVersion = ++this.searchVersion;

    this.submittedQuery.set(query);
    this.hasSearched.set(true);
    this.isLoading.set(true);

    this.moviesError.set(false);
    this.peopleError.set(false);

    this.movies = [];
    this.actors = [];
    this.directors = [];

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
            data: {
              actors: [],
              directors: [],
            } as PeopleSearchResponse,
            failed: true,
          });
        })
      ),
    }).subscribe({
      next: ({ movies, people }) => {
        if (currentVersion !== this.searchVersion) {
          return;
        }

        this.movies = movies.data;
        this.actors = people.data.actors;
        this.directors = people.data.directors;

        this.moviesError.set(movies.failed);
        this.peopleError.set(people.failed);

        this.isLoading.set(false);
      },
    });
  }
}