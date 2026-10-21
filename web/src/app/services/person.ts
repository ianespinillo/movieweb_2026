
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

import { Person } from '../models/person.model';

interface PeopleSearchResponse {
  success: true;
  data: {
    items: Person[];
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
export class PersonService {
  private http = inject(HttpClient);

  searchPeople(query: string) {
    return this.http.get<PeopleSearchResponse>(
      'http://localhost:3500/api/people/search',
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
