import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import type { ApiResponse, UserMovie, UserMovieKey, UserMovieRequest } from '@movieweb/contracts';
import { USER_ROUTES } from './api-routes';
import { unwrap } from './api-response';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly http = inject(HttpClient);

  getUserMovies(userId: number): Observable<UserMovie[]> {
    return this.http
      .get<ApiResponse<UserMovie[]>>(USER_ROUTES.movies(userId))
      .pipe(unwrap());
  }

  updateMovieMark(
    userId: number,
    movieId: number,
    marks: UserMovieRequest
  ): Observable<UserMovie | null> {
    return this.http
      .put<ApiResponse<UserMovie | null>>(USER_ROUTES.movie(userId, movieId), marks)
      .pipe(unwrap());
  }

  deleteMovieMark(userId: number, movieId: number): Observable<UserMovieKey> {
    return this.http
      .delete<ApiResponse<UserMovieKey>>(USER_ROUTES.movie(userId, movieId))
      .pipe(unwrap());
  }
}
