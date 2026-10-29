import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

import type {
  Keyword,
  KeywordMovie,
  MovieDetail,
  TmdbMovieMeta,
  TmdbVideo,
} from '@movieweb/contracts';

import { Movie as MovieModel } from '../models/movie.model';
import { KEYWORD_ROUTES, MOVIE_ROUTES, TMDB_ROUTES } from './api-routes';

export interface MovieSearchPage {
  items: MovieModel[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface KeywordSearchPage {
  items: KeywordMovie[];
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

  searchMovies(query: string, page = 1, limit = 20) {
    return this.http.get<ApiResponse<MovieSearchPage>>(
      MOVIE_ROUTES.search,
      {
        params: {
          q: query,
          page: String(page),
          limit: String(limit),
        },
      }
    ).pipe(
      map(response => response.data)
    );
  }

  searchByKeyword(query: string, page = 1, limit = 20) {
    return this.http.get<ApiResponse<KeywordSearchPage>>(
      KEYWORD_ROUTES.search,
      {
        params: {
          q: query,
          page: String(page),
          limit: String(limit),
        },
      }
    ).pipe(
      map(response => response.data)
    );
  }

  suggestKeywords(query: string, limit = 5) {
    return this.http.get<ApiResponse<Keyword[]>>(
      KEYWORD_ROUTES.suggest,
      {
        params: {
          q: query,
          limit: String(limit),
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
