/** Body of PUT /api/users/:id/movies/:movieId/review. Text is trimmed: 1 to 2000 characters. */
export interface ReviewRequest {
  text: string;
}

/** A text review, stored in MongoDB (collection `reviews`). One per user and movie. */
export interface Review {
  review_id: string;
  user_id: number;
  movie_id: number;
  movie_title: string | null;
  text: string;
  /** ISO 8601 */
  created_at: string;
  /** ISO 8601 */
  updated_at: string;
}

/** A review in GET /api/movies/:id/reviews, with its author from PostgreSQL. */
export interface MovieReview extends Review {
  user_username: string;
  user_name: string | null;
}

/** The review attached to a movie of a user's list (GET /api/users/:id/movies). */
export interface UserMovieReview {
  review_id: string;
  text: string;
  /** ISO 8601 */
  updated_at: string;
}
