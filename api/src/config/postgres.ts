import { Pool, types } from 'pg';

// By default pg returns NUMERIC and BIGINT as strings (to avoid precision loss) and
// DATE as a JS Date at local midnight (which shifts the day when serialized to JSON).
// Our values fit safely in a JS number, and the API contract uses 'YYYY-MM-DD' strings.
types.setTypeParser(types.builtins.NUMERIC, (v) => parseFloat(v)); // vote_average, popularity, rating
types.setTypeParser(types.builtins.INT8, (v) => parseInt(v, 10));  // revenue, COUNT(*)
types.setTypeParser(types.builtins.DATE, (v) => v);                // release_date

export const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port:     Number(process.env.DB_PORT) || 5432,
  options:  `-c search_path=${process.env.DB_SCHEMA ?? 'movies'},public`,
});
