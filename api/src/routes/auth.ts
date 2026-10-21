import { Request, Response, Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/postgres.js';
import { authenticate } from '../middleware/authenticate.js';
import { badRequest, conflict, notFound, unauthorized } from '../http/errors.js';
import { asyncHandler } from '../http/middleware.js';
import { ok } from '../http/response.js';
import {
  AuthRequest,
  AuthResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  UserRow,
} from '../types/index.js';

const router = Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
const JWT_EXPIRES = (process.env.JWT_EXPIRES ?? '7d') as jwt.SignOptions['expiresIn'];

function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.user_id, username: user.user_username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// POST /api/auth/register
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const { user_username, user_name, user_email, password } = req.body as Partial<RegisterRequest>;

  if (!user_username || !user_email || !password) {
    throw badRequest('user_username, user_email and password are required');
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  let user: AuthUser;
  try {
    const result = await pool.query<AuthUser>(
      `INSERT INTO users (user_username, user_name, user_email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, user_username, user_name, user_email`,
      [user_username, user_name ?? null, user_email, password_hash]
    );
    user = result.rows[0];
  } catch (err: unknown) {
    // 23505 = unique_violation (username or email already in use)
    if ((err as { code?: string }).code === '23505') {
      throw conflict('Username or email already taken');
    }
    throw err;
  }

  const body: AuthResponse = { user, token: signToken(user) };
  ok(res, body, 201);
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { user_email, password } = req.body as Partial<LoginRequest>;

  if (!user_email || !password) {
    throw badRequest('user_email and password are required');
  }

  const result = await pool.query<UserRow>(
    'SELECT * FROM users WHERE user_email = $1',
    [user_email]
  );

  const userRow = result.rows[0];
  if (!userRow || !(await bcrypt.compare(password, userRow.password_hash))) {
    throw unauthorized('Invalid credentials');
  }

  const { password_hash: _omit, ...user } = userRow;
  const body: AuthResponse = { user, token: signToken(user) };
  ok(res, body);
}));

// GET /api/auth/me
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.sub;

  const result = await pool.query<AuthUser>(
    'SELECT user_id, user_username, user_name, user_email FROM users WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw notFound('User not found');
  }

  ok(res, result.rows[0]);
}));

export default router;
