import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class Movie {
  private http = inject(HttpClient);

  searchMovies(query: string) {
    return this.http.get(
      'http://localhost:3500/api/movies/search',
      {
        params: { q: query }
      }
    );
  }
}