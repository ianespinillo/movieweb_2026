import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload, AuthRequest } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = header.slice(7);

  try {
    // The token is signed with `{ sub: number, username: string }` (see routes/auth.ts),
    // but jsonwebtoken types `JwtPayload.sub` as `string | undefined`, so the assertion
    // needs the `unknown` bridge. Only widened here: the signing side owns the shape.
    const payload = jwt.verify(token, JWT_SECRET) as unknown as AuthPayload;
    (req as AuthRequest).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
