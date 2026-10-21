import type { AuthUser } from './auth';
import type { Movie } from './movies';

/** A user as the API returns it. Same shape as AuthUser: never includes the password hash. */
export type User = AuthUser;

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
}
