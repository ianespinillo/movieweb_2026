
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

import type {
  MovieDetail,
  TmdbMovieMeta,
  TmdbVideo,
} from '@movieweb/contracts';

import { Movie as MovieModel } from '../models/movie.model';
import { MOVIE_ROUTES, TMDB_ROUTES } from './api-routes';

export interface MovieSearchPage {
  items: MovieModel[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class Movie {
  private http = inject(HttpClient);

  searchMovies(query: string, page = 1) {
    return this.http.get<ApiResponse<MovieSearchPage>>(
      MOVIE_ROUTES.search,
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

  getMovieById(id: number | string) {
    return this.http.get<ApiResponse<MovieDetail>>(
      MOVIE_ROUTES.detail(id)
    ).pipe(
      map(response => response.data)
    );
  }

  getTmdbMovie(id: number | string) {
    return this.http.get<ApiResponse<TmdbMovieMeta>>(
      TMDB_ROUTES.movie(id)
    ).pipe(
      map(response => response.data)
    );
  }

  getMovieVideos(id: number | string) {
    return this.http.get<ApiResponse<TmdbVideo[]>>(
      TMDB_ROUTES.videos(id)
    ).pipe(
      map(response => response.data)
    );
  }
}
