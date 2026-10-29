
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import type {
    ApiResponse,
    PaginatedResponse,
    KeywordMovie
} from '@movieweb/contracts';
import { KEYWORD_ROUTES } from './api-routes';

@Injectable({ providedIn: 'root' })
export class KeywordService {
    private readonly http = inject(HttpClient);

    search(query: string, page = 1) {
        return this.http.get<ApiResponse<PaginatedResponse<KeywordMovie>>>(
            KEYWORD_ROUTES.search,
            {
                params: {
                    q: query,
                    page: String(page),
                    limit: '20'
                }
            }
        ).pipe(
            map(response => response.data)
        );
    }
}
