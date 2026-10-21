// TMDB data proxied by the API. Image URLs are built in the frontend as
// `https://image.tmdb.org/t/p/{size}{path}` (public CDN, no key needed).

/** GET /api/tmdb/movie/:id */
export interface TmdbMovieMeta {
  id: number;
  poster_path: string | null;
  backdrop_path: string | null;
  tagline: string;
}

/** Item of GET /api/tmdb/movie/:id/videos */
export interface TmdbVideo {
  /** YouTube video ID */
  key: string;
  /** 'YouTube' | 'Vimeo' */
  site: string;
  /** 'Trailer' | 'Teaser' | 'Clip' | ... */
  type: string;
  official: boolean;
  name: string;
}

/** GET /api/tmdb/person/:id */
export interface TmdbPersonMeta {
  id: number;
  profile_path: string | null;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
}
