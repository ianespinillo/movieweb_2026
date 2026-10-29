import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import type { ActivityEvent, ApiResponse } from '@movieweb/contracts';
import { ACTIVITY_ROUTES } from './api-routes';
import { unwrap } from './api-response';

@Injectable({
  providedIn: 'root',
})
export class ActivityService {
  private readonly http = inject(HttpClient);

  getUserTimeline(userId: number | string): Observable<ActivityEvent[]> {
    return this.http
      .get<ApiResponse<ActivityEvent[]>>(ACTIVITY_ROUTES.timeline(userId))
      .pipe(unwrap());
  }

  recordActivity(event: {
    userId: string;
    type: string;
    details: Record<string, unknown>;
  }): Observable<ActivityEvent> {
    return this.http
      .post<ApiResponse<ActivityEvent>>(ACTIVITY_ROUTES.record, event)
      .pipe(unwrap());
  }
}
