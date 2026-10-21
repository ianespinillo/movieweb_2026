import { Request, Response, Router } from 'express';
import { HttpError, badRequest, notFound } from '../http/errors.js';
import { asyncHandler } from '../http/middleware.js';
import { parseId } from '../http/params.js';
import { ok } from '../http/response.js';
import { TmdbMovieMeta, TmdbPersonMeta, TmdbVideo, TmdbVideoRaw } from '../types/index.js';

const router = Router();
const BASE = process.env.TMDB_BASE_URL ?? 'https://api.themoviedb.org/3';
const KEY  = process.env.TMDB_API_KEY ?? '';

async function tmdbFetch<T>(path: string): Promise<T> {
  if (!KEY) {
    throw new HttpError(503, 'TMDB is not configured (missing TMDB_API_KEY in api/.env)');
  }

  const url = `${BASE}${path}?api_key=${KEY}&language=en-US`;
  const res = await fetch(url);

  if (res.status === 404) {
    throw notFound(`TMDB has no data for ${path}`);
  }
  if (!res.ok) {
    // 401 here means our key is wrong: a server problem, not the client's.
    throw new HttpError(502, `TMDB responded ${res.status} for ${path}`);
  }

  return res.json() as Promise<T>;
}

// The id goes into the TMDB URL, so only plain numeric ids are accepted.
function readTmdbId(req: Request): number {
  const id = parseId(req.params.id);
  if (id === null) throw badRequest('Invalid id');
  return id;
}

// GET /api/tmdb/movie/:id
router.get('/movie/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = await tmdbFetch<TmdbMovieMeta & Record<string, unknown>>(`/movie/${readTmdbId(req)}`);

  const payload: TmdbMovieMeta = {
    id:            data.id,
    poster_path:   data.poster_path,
    backdrop_path: data.backdrop_path,
    tagline:       data.tagline,
  };

  ok(res, payload);
}));

// GET /api/tmdb/movie/:id/videos
router.get('/movie/:id/videos', asyncHandler(async (req: Request, res: Response) => {
  const data = await tmdbFetch<{ results: TmdbVideoRaw[] }>(`/movie/${readTmdbId(req)}/videos`);

  const videos: TmdbVideo[] = (data.results ?? []).map(v => ({
    key:      v.key,
    site:     v.site,
    type:     v.type,
    official: v.official,
    name:     v.name,
  }));

  ok(res, videos);
}));

// GET /api/tmdb/person/:id
router.get('/person/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = await tmdbFetch<TmdbPersonMeta & Record<string, unknown>>(`/person/${readTmdbId(req)}`);

  const payload: TmdbPersonMeta = {
    id:             data.id,
    profile_path:   data.profile_path,
    biography:      data.biography,
    birthday:       data.birthday,
    place_of_birth: data.place_of_birth,
  };

  ok(res, payload);
}));

export default router;
