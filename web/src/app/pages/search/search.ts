import { Component, inject, signal } from '@angular/core';
import { Movie } from '../../models/movie.model';
import { Person } from '../../models/person.model';
import { Movie as MovieService } from '../../services/movie';


@Component({
  imports: [],
  selector: 'app-search',
  styleUrl: './search.css',
  templateUrl: './search.html',
})
export class Search {
  private movieService = inject(MovieService);

  searchQuery = signal('');
  submittedQuery = signal('');

  movies: Movie[] = [];
  actors: Person[] = [];
  directors: Person[] = [];

  search() {
    const query = this.searchQuery().trim();

    if (query === '') {
      return;
    }

    this.submittedQuery.set(query);

    this.movieService.searchMovies(query).subscribe({
      next: (response) => {
        console.log('Respuesta del backend:', response);
      },
      error: (error) => {
        console.error('Error al buscar películas:', error);
      }
    });
  }
}