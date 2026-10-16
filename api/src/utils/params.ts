const PG_INT_MAX = 2_147_483_647;

/**
 * Parses a route param that maps to an INT id column (movie_id, person_id, user_id...).
 * Returns null for anything that is not a positive integer within PostgreSQL's INT range,
 * so the route can answer 400 instead of letting the query fail with a 500.
 */
export function parseId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;

  const id = Number(raw);
  return id > 0 && id <= PG_INT_MAX ? id : null;
}
