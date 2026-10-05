import { Pool } from 'pg';

export const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port:     Number(process.env.DB_PORT) || 5432,
  options:  `-c search_path=${process.env.DB_SCHEMA ?? 'movies'},public`,
});
