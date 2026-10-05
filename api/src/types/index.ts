// ─── Express augmentation ────────────────────────────────────────────────────
import { Request } from 'express';

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

export interface UserRow {
  user_id: number;
  user_username: string;
  user_name: string | null;
  user_email: string;
  password_hash: string;
}

export interface MovieRow {
  movie_id: number;
  title: string;
  budget: number | null;
  homepage: string | null;
  overview: string | null;
  popularity: number | null;
  release_date: string | null;
  revenue: number | null;
  runtime: number | null;
  movie_status: string | null;
  tagline: string | null;
  vote_average: number | null;
  vote_count: number | null;
}

export interface PersonRow {
  person_id: number;
  person_name: string;
}

export interface PersonSearchRow extends PersonRow {
  is_actor: boolean;
  is_director: boolean;
}

export interface PersonDetailRow extends PersonRow {
  as_actor: MovieRow[];
  as_director: MovieRow[];
}

export interface CastRow {
  person_id: number;
  person_name: string;
  character_name: string;
  cast_order: number;
}

export interface CrewRow {
  person_id: number;
  person_name: string;
  department_name: string;
  job: string;
}

export interface GenreRow {
  genre_id: number;
  genre_name: string;
}

export interface CountryRow {
  country_iso: string;
  country_name: string;
}

export interface LanguageRow {
  language_iso: string;
  language_name: string;
}

export interface CompanyRow {
  company_id: number;
  company_name: string;
}

export interface KeywordRow {
  keyword_id: number;
  keyword_name: string;
}

export interface MovieDetailResult {
  movie: MovieRow;
  directors: CrewRow[];
  writers: CrewRow[];
  cast: CastRow[];
  crew: CrewRow[];
  genres: GenreRow[];
  countries: CountryRow[];
  languages: LanguageRow[];
  companies: CompanyRow[];
  keywords: KeywordRow[];
}

export interface MovieUserRow {
  user_id: number;
  movie_id: number;
  rating: number | null;
  review: string | null;
  added_at: string;
}

export interface MovieUserWithTitle extends MovieUserRow {
  title: string;
  release_date: string | null;
}

// ─── TMDB shapes ─────────────────────────────────────────────────────────────

export interface TmdbMovieMeta {
  id: number;
  poster_path: string | null;
  backdrop_path: string | null;
  tagline: string;
}

export interface TmdbVideoRaw {
  key: string;
  site: string;
  type: string;
  official: boolean;
  name: string;
}

export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official: boolean;
  name: string;
}

export interface TmdbPersonMeta {
  id: number;
  profile_path: string | null;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
}
