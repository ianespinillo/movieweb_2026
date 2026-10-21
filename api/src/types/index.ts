// ─── Express augmentation ────────────────────────────────────────────────────
import { Request } from 'express';
import type {
  CastMember,
  Company,
  Country,
  CrewMember,
  Genre,
  Keyword,
  Language,
  Movie,
  MovieDetail,
  PersonRef,
} from '@movieweb/contracts';

// Everything the API sends to the frontend lives in packages/contracts.
// Re-exported here so routes keep importing from '../types/index.js'.
export type * from '@movieweb/contracts';

export interface AuthPayload {
  sub: number;
  username: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user: AuthPayload;
}

// ─── PostgreSQL row shapes ────────────────────────────────────────────────────
// Rows that leave the API are aliases of the contract types, so both stay in sync.

export interface UserRow {
  user_id: number;
  user_username: string;
  user_name: string | null;
  user_email: string;
  password_hash: string;
}

export type MovieRow = Movie;

export type PersonRow = PersonRef;

export type CastRow     = CastMember;
export type CrewRow     = CrewMember;
export type GenreRow    = Genre;
export type CountryRow  = Country;
export type LanguageRow = Language;
export type CompanyRow  = Company;
export type KeywordRow  = Keyword;

export type MovieDetailResult = MovieDetail;

/** A row of user_movies. */
export interface UserMovieRow {
  user_id: number;
  movie_id: number;
  is_favorite: boolean;
  watched: boolean;
  rating: number | null;
  added_at: Date;
  updated_at: Date;
}

// ─── TMDB shapes ─────────────────────────────────────────────────────────────
// TmdbMovieMeta, TmdbVideo and TmdbPersonMeta come from the contract.

export interface TmdbVideoRaw {
  key: string;
  site: string;
  type: string;
  official: boolean;
  name: string;
}
