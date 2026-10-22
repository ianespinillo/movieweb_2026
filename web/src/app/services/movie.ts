
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

import { Movie as MovieModel } from '../models/movie.model';

export interface MovieSearchPage {
  items: MovieModel[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface MovieSearchResponse {
  success: true;
  data: MovieSearchPage;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class Movie {
  private http = inject(HttpClient);

  searchMovies(query: string, page = 1) {
    return this.http.get<MovieSearchResponse>(
      'http://localhost:3500/api/movies/search',
      {
        params: {
          q: query,
          page: String(page),
          limit: '20',
        },
      }
    ).pipe(
      map(response => response.data)
    );
  }
}
