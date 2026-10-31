import type { AuthUser } from './auth';
import type { Movie } from './movies';
import type { UserMovieReview } from './reviews';

/** A user as the API returns it. Same shape as AuthUser: never includes the password hash. */
export type User = AuthUser;

/**
 * Body of PUT /api/users/:id. Send only the fields to change.
 * user_name can be null to clear it; username and email cannot.
 */
export interface UpdateUserRequest {
  user_username?: string;
  user_name?: string | null;
  user_email?: string;
}

/**
 * Body of PUT /api/users/:id/movies/:movieId. Send only the marks to change; the rest
 * keep their current value. rating: 1 to 5, or null to remove it.
 * If nothing is left marked, the movie leaves the list and the response data is null.
 */
export interface UserMovieRequest {
  is_favorite?: boolean;
  watched?: boolean;
  rating?: number | null;
}

/** Response of DELETE /api/users/:id/movies/:movieId */
export interface UserMovieKey {
  user_id: number;
  movie_id: number;
}

/** A movie in a user's list (GET /api/users/:id/movies). */
export interface UserMovie extends Pick<Movie, 'movie_id' | 'title' | 'release_date' | 'vote_average'> {
  is_favorite: boolean;
  watched: boolean;
  /** 1 to 5 stars, null when not rated yet. */
  rating: number | null;
  /** ISO 8601 */
  added_at: string;
  /** ISO 8601 */
  updated_at: string;
  /** The user's text review of this movie, null when there is none. Only set by the list route. */
  review?: UserMovieReview | null;
}
