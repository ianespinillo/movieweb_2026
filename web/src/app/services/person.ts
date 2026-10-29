import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import type { ApiResponse, PersonDetail, TmdbPersonMeta, TmdbMovieMeta } from '@movieweb/contracts';
import { Person } from '../models/person.model';
import { PEOPLE_ROUTES, TMDB_ROUTES } from './api-routes';
import { unwrap } from './api-response';

export interface PeopleSearchPage {
  items: Person[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PeopleSearchResponse {
  success: true;
  data: PeopleSearchPage;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class PersonService {
  private readonly http = inject(HttpClient);

  searchPeople(query: string, page = 1, limit = 20) {
    return this.http.get<PeopleSearchResponse>(
      PEOPLE_ROUTES.search,
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

  getPersonById(id: string | number): Observable<PersonDetail> {
    return this.http
      .get<ApiResponse<PersonDetail>>(PEOPLE_ROUTES.detail(id))
      .pipe(unwrap());
  }

  getTmdbPerson(id: string | number): Observable<TmdbPersonMeta> {
    return this.http
      .get<ApiResponse<TmdbPersonMeta>>(TMDB_ROUTES.person(id))
      .pipe(unwrap());
  }

  getTmdbMovie(id: string | number): Observable<TmdbMovieMeta> {
    return this.http
      .get<ApiResponse<TmdbMovieMeta>>(TMDB_ROUTES.movie(id))
      .pipe(unwrap());
  }
}
