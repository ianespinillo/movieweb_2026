import { Injectable } from '@angular/core';

import type { KeywordMovie } from '@movieweb/contracts';
import type { Movie } from '../models/movie.model';
import type { Person } from '../models/person.model';

export interface SavedSearch {
  query: string;
  movies: Movie[];
  keywordMovies?: KeywordMovie[];
  actors: Person[];
  directors: Person[];

  moviesPage: number;
  moviesTotalPages: number;
  keywordsPage?: number;
  keywordsTotalPages?: number;
  peoplePage: number;
  peopleTotalPages: number;

  posters: Record<number, string | null>;
  photos: Record<number, string | null>;

  scrollY: number;
}

@Injectable({
  providedIn: 'root',
})
export class SearchState {
  private savedSearch: SavedSearch | null = null;

  save(search: SavedSearch): void {
    this.savedSearch = search;
  }

  restore(): SavedSearch | null {
    return this.savedSearch;
  }

  clear(): void {
    this.savedSearch = null;
  }
}
