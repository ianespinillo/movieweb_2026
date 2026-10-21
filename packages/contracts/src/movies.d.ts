/** A movie with every column of the `movie` table. */
export interface Movie {
  movie_id: number;
  title: string;
  budget: number | null;
  homepage: string | null;
  overview: string | null;
  popularity: number | null;
  /** 'YYYY-MM-DD' */
  release_date: string | null;
  revenue: number | null;
  /** Minutes */
  runtime: number | null;
  movie_status: string | null;
  tagline: string | null;
  vote_average: number | null;
  vote_count: number | null;
}

/** A movie in a list of results. */
export type MovieSummary = Pick<
  Movie,
  'movie_id' | 'title' | 'release_date' | 'overview' | 'vote_average' | 'vote_count'
>;

export interface PersonRef {
  person_id: number;
  person_name: string;
}

export interface CastMember extends PersonRef {
  character_name: string;
  cast_order: number;
  /** 'Female' | 'Male' | 'Unspecified' */
  gender: string | null;
}

export interface CrewMember extends PersonRef {
  department_name: string;
  job: string;
}

export interface Genre {
  genre_id: number;
  genre_name: string;
}

export interface Country {
  country_iso: string;
  country_name: string;
}

export interface Language {
  language_iso: string;
  language_name: string;
  /** 'Original' | 'Spoken' */
  language_role: string | null;
}

export interface Company {
  company_id: number;
  company_name: string;
}

export interface Keyword {
  keyword_id: number;
  keyword_name: string;
}

/** GET /api/movies/:id — the movie columns plus all its relations. */
export interface MovieDetail extends Movie {
  directors: CrewMember[];
  writers: CrewMember[];
  cast: CastMember[];
  /** Every crew member who is not a director or a writer. */
  crew: CrewMember[];
  genres: Genre[];
  countries: Country[];
  languages: Language[];
  companies: Company[];
  keywords: Keyword[];
}

/** Item of GET /api/keywords/search */
export interface KeywordMovie extends MovieSummary {
  /** The movie's keywords that matched the search term. */
  matched_keywords: string[];
}
