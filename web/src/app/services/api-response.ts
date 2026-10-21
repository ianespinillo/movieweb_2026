import { HttpErrorResponse } from '@angular/common/http';
import { OperatorFunction, map } from 'rxjs';
import type { ApiResponse, ErrorResponse } from '@movieweb/contracts';

/**
 * Takes `data` out of the API envelope, so components get the payload directly:
 *   this.http.get<ApiResponse<MovieDetail>>(MOVIE_ROUTES.detail(id)).pipe(unwrap())
 */
export function unwrap<T>(): OperatorFunction<ApiResponse<T>, T> {
  return map(res => res.data);
}

/** User-facing message of a failed request (falls back to a generic one if the API is down). */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse && isErrorResponse(err.error)) {
    const { message } = err.error;
    return Array.isArray(message) ? message.join('\n') : message;
  }
  return 'No se pudo conectar con el servidor';
}

function isErrorResponse(body: unknown): body is ErrorResponse {
  return typeof body === 'object' && body !== null && (body as ErrorResponse).success === false;
}
