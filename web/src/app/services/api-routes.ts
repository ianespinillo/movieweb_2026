// Every API URL in one place. Services use these instead of hand-written strings:
//   this.http.get(MOVIE_ROUTES.detail(id))
// Response types for each route live in '@movieweb/contracts'.

export const API_URL = 'http://localhost:3500/api';

export const MOVIE_ROUTES = {
  /** ?q=&page=&limit= → PaginatedResponse<MovieSummary> */
  search: `${API_URL}/movies/search`,
  /** → MovieDetail */
  detail: (id: number | string) => `${API_URL}/movies/${id}`,
} as const;

export const KEYWORD_ROUTES = {
  /** ?q=&page=&limit= → PaginatedResponse<KeywordMovie> */
  search: `${API_URL}/keywords/search`,
  /** ?q=&limit= → Keyword[] */
  suggest: `${API_URL}/keywords`,
} as const;

export const PEOPLE_ROUTES = {
  search: `${API_URL}/people/search`,
  detail: (id: number | string) => `${API_URL}/people/${id}`,
} as const;

export const USER_ROUTES = {
  list: `${API_URL}/users`,
  detail: (id: number | string) => `${API_URL}/users/${id}`,
  movies: (id: number | string) => `${API_URL}/users/${id}/movies`,
  movie: (id: number | string, movieId: number | string) => `${API_URL}/users/${id}/movies/${movieId}`,
} as const;

export const ACTIVITY_ROUTES = {
  record: `${API_URL}/activity`,
  timeline: (userId: number | string) => `${API_URL}/activity/${userId}`,
} as const;

export const AUTH_ROUTES = {
  /** → AuthResponse */
  login: `${API_URL}/auth/login`,
  /** → AuthResponse */
  register: `${API_URL}/auth/register`,
  /** → AuthUser (needs the token) */
  me: `${API_URL}/auth/me`,
} as const;

export const TMDB_ROUTES = {
  /** → TmdbMovieMeta */
  movie: (id: number | string) => `${API_URL}/tmdb/movie/${id}`,
  /** → TmdbVideo[] */
  videos: (id: number | string) => `${API_URL}/tmdb/movie/${id}/videos`,
  /** → TmdbPersonMeta */
  person: (id: number | string) => `${API_URL}/tmdb/person/${id}`,
} as const;
