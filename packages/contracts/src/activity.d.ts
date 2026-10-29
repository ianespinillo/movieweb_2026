export type ActivityType = 'RATED_MOVIE' | 'ADDED_TO_FAVORITES' | 'WROTE_REVIEW';

export interface ActivityDetails {
  movieId?: number;
  movieTitle?: string;
  rating?: number;
  reviewId?: string;
}

export interface ActivityEvent {
  _id: string;
  userId: string;
  type: ActivityType;
  timestamp: string;
  details: ActivityDetails;
}
