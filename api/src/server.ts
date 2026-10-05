import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectMongo } from './config/mongo.js';
import authRouter from './routes/auth.js';
import tmdbRouter from './routes/tmdb.js';
// Uncomment as each route file is implemented:
// import moviesRouter   from './routes/movies.js';
// import peopleRouter   from './routes/people.js';
// import keywordsRouter from './routes/keywords.js';
// import usersRouter    from './routes/users.js';
// import activityRouter from './routes/activity.js';

const app = express();
const PORT = Number(process.env.PORT) || 3500;

app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200' }));
app.use(express.json());

// Public routes
app.use('/api/auth', authRouter);
app.use('/api/tmdb', tmdbRouter);
// app.use('/api/movies',   moviesRouter);
// app.use('/api/people',   peopleRouter);
// app.use('/api/keywords', keywordsRouter);

// Protected routes (authenticate middleware applied inside each router)
// app.use('/api/users',    usersRouter);
// app.use('/api/activity', activityRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

await connectMongo();
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
