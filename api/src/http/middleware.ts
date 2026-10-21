import { STATUS_CODES } from 'node:http';
import { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import type { ErrorResponse } from '@movieweb/contracts';
import { HttpError, notFound } from './errors.js';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Express 4 does not catch rejected promises from async routes: without this, a failed
 * query leaves the request hanging. The wrapper forwards the error to `errorHandler`.
 */
export function asyncHandler(route: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    route(req, res, next).catch(next);
  };
}

/** For any /api/* request that matched no route. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound(`Route ${req.method} ${req.originalUrl.split('?')[0]} not found`));
};

function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;

  // express.json() errors (malformed body, payload too large, ...) carry a 4xx status.
  const httpLike = err as { status?: number; type?: string; expose?: boolean; message?: string };
  if (httpLike.expose && typeof httpLike.status === 'number' && httpLike.status < 500) {
    const message = httpLike.type === 'entity.parse.failed' ? 'Malformed JSON body' : httpLike.message ?? 'Bad request';
    return new HttpError(httpLike.status, message);
  }

  return new HttpError(500, 'Internal server error');
}

/** Last middleware: turns any error into an ErrorResponse. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const httpError = toHttpError(err);
  if (httpError.statusCode >= 500) console.error(err);

  const body: ErrorResponse = {
    success: false,
    statusCode: httpError.statusCode,
    timestamp: new Date().toISOString(),
    path: req.originalUrl.split('?')[0],
    method: req.method,
    message: httpError.userMessage,
    error: STATUS_CODES[httpError.statusCode] ?? 'Error',
    ...(httpError.details !== undefined && { details: httpError.details }),
  };
  res.status(httpError.statusCode).json(body);
};
