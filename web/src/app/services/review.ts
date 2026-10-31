import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import type { ApiResponse, MovieReview, Review, ReviewRequest } from '@movieweb/contracts';
import { MOVIE_ROUTES, USER_ROUTES } from './api-routes';
import { unwrap } from './api-response';

@Injectable({
  providedIn: 'root',
})
export class ReviewService {
  private readonly http = inject(HttpClient);

  getMovieReviews(movieId: number | string): Observable<MovieReview[]> {
    return this.http
      .get<ApiResponse<MovieReview[]>>(MOVIE_ROUTES.reviews(movieId))
      .pipe(unwrap());
  }

  saveReview(userId: number, movieId: number, body: ReviewRequest): Observable<Review> {
    return this.http
      .put<ApiResponse<Review>>(USER_ROUTES.review(userId, movieId), body)
      .pipe(unwrap());
  }

  deleteReview(userId: number, movieId: number): Observable<Review> {
    return this.http
      .delete<ApiResponse<Review>>(USER_ROUTES.review(userId, movieId))
      .pipe(unwrap());
  }
}
