import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Movie as MovieModel } from '../models/movie.model';

@Injectable({
  providedIn: 'root',
})
export class Movie {
  private http = inject(HttpClient);

  searchMovies(query: string) {
    return this.http.get<MovieModel[]>(
      'http://localhost:3500/api/movies/search',
      {
        params: { q: query }
      }
    );
  }
}