/** Successful response: every endpoint wraps its payload in `data`. */
export interface ApiResponse<T> {
  success: true;
  data: T;
  /** ISO 8601 */
  timestamp: string;
}

/** Error response: same shape for every 4xx/5xx status. */
export interface ErrorResponse {
  success: false;
  statusCode: number;
  /** ISO 8601 */
  timestamp: string;
  /** Requested path, without the query string. */
  path: string;
  method: string;
  /** User-facing message; validation errors may send one message per rule. */
  message: string | string[];
  /** HTTP status name: 'Bad Request', 'Not Found', ... */
  error: string;
  /** Extra structured data for some errors. */
  details?: unknown;
}

/**
 * What any endpoint can return. `success` discriminates the union:
 * `if (res.success) { res.data } else { res.message }`.
 */
export type ApiResult<T> = ApiResponse<T> | ErrorResponse;

/** A page of results. Goes inside `data`: `ApiResponse<PaginatedResponse<T>>`. */
export interface PaginatedResponse<T> {
  items: T[];
  /** Total results across all pages. */
  total: number;
  /** 1-based. */
  page: number;
  limit: number;
  totalPages: number;
}

/** Query params of paginated endpoints (`?page=1&limit=20`, limit capped at 100). */
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

/** GET /api/health */
export interface HealthStatus {
  status: 'ok';
}
