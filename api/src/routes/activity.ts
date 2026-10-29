import { Request, Response, Router } from 'express';
import mongoose, { Document, Schema } from 'mongoose';
import { authenticate } from '../middleware/authenticate.js';
import { AuthRequest } from '../types/index.js';
import { ok } from '../http/response.js';
import { badRequest } from '../http/errors.js';
import { asyncHandler } from '../http/middleware.js';
import type { ActivityType } from '@movieweb/contracts';

export interface IActivity extends Document {
  userId: string;
  type: ActivityType;
  timestamp: Date;
  details: {
    movieId?: number;
    movieTitle?: string;
    rating?: number;
    reviewId?: string;
  };
}

const activitySchema = new Schema<IActivity>(
  {
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['RATED_MOVIE', 'ADDED_TO_FAVORITES', 'WROTE_REVIEW'],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    details: {
      movieId: Number,
      movieTitle: String,
      rating: Number,
      reviewId: String,
    },
  },
  { collection: 'user_activity' }
);

export const Activity = mongoose.model<IActivity>('Activity', activitySchema);

const router = Router();

// GET /api/activity/:userId — timeline de actividad del usuario
router.get(
  '/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.params.userId);
    const events = await Activity.find({ userId })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    ok(res, events);
  })
);

// POST /api/activity — registrar evento de actividad
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const currentUserId = String((req as AuthRequest).user.sub);
    const { userId, type, details } = req.body ?? {};

    if (!userId || String(userId) !== currentUserId) {
      throw badRequest('Cannot record activity for another user');
    }
    if (!type || !['RATED_MOVIE', 'ADDED_TO_FAVORITES', 'WROTE_REVIEW'].includes(type)) {
      throw badRequest('Invalid activity type');
    }

    const event = await Activity.create({
      userId: String(userId),
      type,
      details: details ?? {},
      timestamp: new Date(),
    });

    ok(res, event, 201);
  })
);

/**
 * Inserta actividad de demostración para los usuarios semilla si la colección está vacía.
 */
export async function seedInitialActivity(): Promise<void> {
  const count = await Activity.countDocuments();
  if (count > 0) return;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const sampleEvents = [
    // Usuario 1 (ana_cine)
    {
      userId: '1',
      type: 'ADDED_TO_FAVORITES' as ActivityType,
      timestamp: new Date(now - 20 * dayMs),
      details: { movieId: 603, movieTitle: 'The Matrix' },
    },
    {
      userId: '1',
      type: 'RATED_MOVIE' as ActivityType,
      timestamp: new Date(now - 20 * dayMs + 3600000),
      details: { movieId: 603, movieTitle: 'The Matrix', rating: 5 },
    },
    {
      userId: '1',
      type: 'ADDED_TO_FAVORITES' as ActivityType,
      timestamp: new Date(now - 12 * dayMs),
      details: { movieId: 27205, movieTitle: 'Inception' },
    },
    {
      userId: '1',
      type: 'RATED_MOVIE' as ActivityType,
      timestamp: new Date(now - 12 * dayMs + 1800000),
      details: { movieId: 27205, movieTitle: 'Inception', rating: 5 },
    },
    {
      userId: '1',
      type: 'RATED_MOVIE' as ActivityType,
      timestamp: new Date(now - 6 * dayMs),
      details: { movieId: 157336, movieTitle: 'Interstellar', rating: 4 },
    },
    {
      userId: '1',
      type: 'ADDED_TO_FAVORITES' as ActivityType,
      timestamp: new Date(now - 2 * dayMs),
      details: { movieId: 155, movieTitle: 'The Dark Knight' },
    },

    // Usuario 2 (bruno_m)
    {
      userId: '2',
      type: 'ADDED_TO_FAVORITES' as ActivityType,
      timestamp: new Date(now - 30 * dayMs),
      details: { movieId: 238, movieTitle: 'The Godfather' },
    },
    {
      userId: '2',
      type: 'RATED_MOVIE' as ActivityType,
      timestamp: new Date(now - 30 * dayMs + 2400000),
      details: { movieId: 238, movieTitle: 'The Godfather', rating: 5 },
    },
    {
      userId: '2',
      type: 'RATED_MOVIE' as ActivityType,
      timestamp: new Date(now - 18 * dayMs),
      details: { movieId: 769, movieTitle: 'GoodFellas', rating: 4 },
    },
    {
      userId: '2',
      type: 'ADDED_TO_FAVORITES' as ActivityType,
      timestamp: new Date(now - 9 * dayMs),
      details: { movieId: 680, movieTitle: 'Pulp Fiction' },
    },
    {
      userId: '2',
      type: 'RATED_MOVIE' as ActivityType,
      timestamp: new Date(now - 9 * dayMs + 1200000),
      details: { movieId: 680, movieTitle: 'Pulp Fiction', rating: 5 },
    },

    // Usuario 3 (carla_r)
    {
      userId: '3',
      type: 'ADDED_TO_FAVORITES' as ActivityType,
      timestamp: new Date(now - 25 * dayMs),
      details: { movieId: 13, movieTitle: 'Forrest Gump' },
    },
    {
      userId: '3',
      type: 'RATED_MOVIE' as ActivityType,
      timestamp: new Date(now - 25 * dayMs + 1800000),
      details: { movieId: 13, movieTitle: 'Forrest Gump', rating: 5 },
    },
    {
      userId: '3',
      type: 'RATED_MOVIE' as ActivityType,
      timestamp: new Date(now - 7 * dayMs),
      details: { movieId: 278, movieTitle: 'The Shawshank Redemption', rating: 5 },
    },

    // Usuario 4 (diego_p)
    {
      userId: '4',
      type: 'ADDED_TO_FAVORITES' as ActivityType,
      timestamp: new Date(now - 15 * dayMs),
      details: { movieId: 11, movieTitle: 'Star Wars' },
    },
    {
      userId: '4',
      type: 'RATED_MOVIE' as ActivityType,
      timestamp: new Date(now - 15 * dayMs + 3600000),
      details: { movieId: 11, movieTitle: 'Star Wars', rating: 5 },
    },
    {
      userId: '4',
      type: 'RATED_MOVIE' as ActivityType,
      timestamp: new Date(now - 1 * dayMs),
      details: { movieId: 13223, movieTitle: 'Gran Torino', rating: 3 },
    },
  ];

  await Activity.insertMany(sampleEvents);
  console.log(`Seeded ${sampleEvents.length} initial activity events in MongoDB`);
}

export default router;
