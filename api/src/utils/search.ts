import { Request } from 'express';

const MAX_QUERY_LENGTH = 100;

/**
 * Reads and normalizes the `q` query param. Returns null when it is missing or blank.
 */
export function readSearchTerm(req: Request): string | null {
  const raw = req.query['q'];
  if (typeof raw !== 'string') return null;

  const q = raw.trim().slice(0, MAX_QUERY_LENGTH);
  return q.length > 0 ? q : null;
}

/**
 * Builds a "contains" pattern for ILIKE, escaping the LIKE wildcards typed by the user,
 * so that searching "100%" or "a_b" matches those literal characters.
 * Backslash is PostgreSQL's default LIKE escape character.
 */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`;
}
