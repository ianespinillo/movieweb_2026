import { Response } from 'express';
import type { ApiResponse } from '@movieweb/contracts';

/** Sends the common success shape: `{ success: true, data, timestamp }`. */
export function ok<T>(res: Response, data: T, statusCode = 200): void {
  const body: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(body);
}
