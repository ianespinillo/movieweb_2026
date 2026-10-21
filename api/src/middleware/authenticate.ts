import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { unauthorized } from '../http/errors.js';
import { AuthPayload, AuthRequest } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];

  if (!header?.startsWith('Bearer ')) {
    next(unauthorized('Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice(7);

  let payload: AuthPayload;
  try {
    // The token is signed with `{ sub: number, username: string }` (see routes/auth.ts),
    // but jsonwebtoken types `JwtPayload.sub` as `string | undefined`, so the assertion
    // needs the `unknown` bridge. Only widened here: the signing side owns the shape.
    payload = jwt.verify(token, JWT_SECRET) as unknown as AuthPayload;
  } catch {
    next(unauthorized('Invalid or expired token'));
    return;
  }

  // Outside the try: an error thrown further down the chain is not an auth failure.
  (req as AuthRequest).user = payload;
  next();
}
