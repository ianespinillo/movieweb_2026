import mongoose, { Document, Schema } from 'mongoose';
import type { Review } from '@movieweb/contracts';

export const MAX_REVIEW_LENGTH = 2000;

export interface IReview extends Document {
  userId: string;
  movieId: number;
  movieTitle?: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    userId: { type: String, required: true },
    movieId: { type: Number, required: true, index: true },
    movieTitle: String,
    text: { type: String, required: true, maxlength: MAX_REVIEW_LENGTH },
  },
  { collection: 'reviews', timestamps: true }
);

// One editable review per user and movie
reviewSchema.index({ userId: 1, movieId: 1 }, { unique: true });

export const ReviewModel = mongoose.model<IReview>('Review', reviewSchema);

/** Mongo document → the snake_case shape of the contract. */
export function toReview(doc: IReview): Review {
  return {
    review_id: String(doc._id),
    user_id: Number(doc.userId),
    movie_id: doc.movieId,
    movie_title: doc.movieTitle ?? null,
    text: doc.text,
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString(),
  };
}
