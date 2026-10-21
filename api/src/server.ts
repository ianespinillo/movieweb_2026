import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectMongo } from './config/mongo.js';
import { errorHandler, notFoundHandler } from './http/middleware.js';
import { ok } from './http/response.js';
import authRouter from './routes/auth.js';
import tmdbRouter from './routes/tmdb.js';
import moviesRouter   from './routes/movies.js';
import keywordsRouter from './routes/keywords.js';
import peopleRouter   from './routes/people.js';
import usersRouter    from './routes/users.js';
// Uncomment as each route file is implemented:
// import activityRouter from './routes/activity.js';

const app = express();
const PORT = Number(process.env.PORT) || 3500;

app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200' }));
app.use(express.json());

// Public routes
app.use('/api/auth', authRouter);
app.use('/api/tmdb', tmdbRouter);
app.use('/api/movies',   moviesRouter);
app.use('/api/keywords', keywordsRouter);
app.use('/api/people',   peopleRouter);

// Protected routes (authenticate middleware applied inside each router)
app.use('/api/users',    usersRouter);
// app.use('/api/activity', activityRouter);

app.get('/api/health', (_req, res) => ok(res, { status: 'ok' }));

// Must stay last: unknown /api routes → 404, then any error → ErrorResponse
app.use('/api', notFoundHandler);
app.use(errorHandler);

async function bootstrap() {
  await connectMongo();
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
}

bootstrap().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
