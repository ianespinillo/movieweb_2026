import { Request, Response, Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/postgres.js';
import { authenticate } from '../middleware/authenticate.js';
import { AuthRequest, UserRow } from '../types/index.js';

const router = Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
const JWT_EXPIRES = (process.env.JWT_EXPIRES ?? '7d') as jwt.SignOptions['expiresIn'];

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { user_username, user_name, user_email, password } = req.body as {
    user_username: string;
    user_name?: string;
    user_email: string;
    password: string;
  };

  if (!user_username || !user_email || !password) {
    res.status(400).json({ error: 'user_username, user_email and password are required' });
    return;
  }

  try {
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query<Omit<UserRow, 'password_hash'>>(
      `INSERT INTO users (user_username, user_name, user_email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, user_username, user_name, user_email`,
      [user_username, user_name ?? null, user_email, password_hash]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { sub: user.user_id, username: user.user_username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.status(201).json({ user, token });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'Username or email already taken' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { user_email, password } = req.body as { user_email: string; password: string };

  if (!user_email || !password) {
    res.status(400).json({ error: 'user_email and password are required' });
    return;
  }

  try {
    const result = await pool.query<UserRow>(
      'SELECT * FROM users WHERE user_email = $1',
      [user_email]
    );

    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { sub: user.user_id, username: user.user_username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    const { password_hash: _omit, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).user.sub;

  try {
    const result = await pool.query<Omit<UserRow, 'password_hash'>>(
      'SELECT user_id, user_username, user_name, user_email FROM users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
