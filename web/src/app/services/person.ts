import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PeopleSearchResponse } from '../models/person.model';

@Injectable({
    providedIn: 'root',
})
export class PersonService {
    private http = inject(HttpClient);

    searchPeople(query: string) {
        return this.http.get<PeopleSearchResponse>(
            'http://localhost:3500/api/people/search',
            { params: { q: query } }
        );
    }
}