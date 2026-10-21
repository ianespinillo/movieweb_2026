import { Request } from 'express';
import type { PaginatedResponse } from '@movieweb/contracts';
import { badRequest } from './errors.js';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface Pagination {
  page: number;
  limit: number;
  /** For SQL OFFSET: (page - 1) * limit */
  offset: number;
}

function readPositiveInt(req: Request, name: string, fallback: number): number {
  const raw = req.query[name];
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) < 1) {
    throw badRequest(`Query param ${name} must be a positive integer`);
  }
  return Number(raw);
}

/** Reads `?page=&limit=` (defaults 1 and 20; limit is capped at 100). */
export function readPagination(req: Request): Pagination {
  const page  = readPositiveInt(req, 'page', 1);
  const limit = Math.min(readPositiveInt(req, 'limit', DEFAULT_LIMIT), MAX_LIMIT);
  return { page, limit, offset: (page - 1) * limit };
}

/** Builds the page from the rows and the total (from a COUNT(*)). */
export function paginated<T>(items: T[], total: number, { page, limit }: Pagination): PaginatedResponse<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
