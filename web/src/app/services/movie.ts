
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

import { Movie as MovieModel } from '../models/movie.model';

interface MovieSearchResponse {
  success: true;
  data: {
    items: MovieModel[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class Movie {
  private http = inject(HttpClient);

  searchMovies(query: string) {
    return this.http.get<MovieSearchResponse>(
      'http://localhost:3500/api/movies/search',
      {
        params: {
          q: query,
          page: '1',
          limit: '20',
        },
      }
    ).pipe(
      map(response => response.data.items)
    );
  }
}
