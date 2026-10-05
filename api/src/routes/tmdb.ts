import { Request, Response, Router } from 'express';
import { TmdbMovieMeta, TmdbPersonMeta, TmdbVideo, TmdbVideoRaw } from '../types/index.js';

const router = Router();
const BASE = process.env.TMDB_BASE_URL ?? 'https://api.themoviedb.org/3';
const KEY  = process.env.TMDB_API_KEY ?? '';

async function tmdbFetch<T>(path: string): Promise<T> {
  const url = `${BASE}${path}?api_key=${KEY}&language=en-US`;
  const res = await fetch(url);

  if (!res.ok) {
    const err = new Error(`TMDB responded ${res.status} for ${path}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

// GET /api/tmdb/movie/:id
router.get('/movie/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await tmdbFetch<TmdbMovieMeta & Record<string, unknown>>(`/movie/${req.params.id}`);

    const payload: TmdbMovieMeta = {
      id:            data.id,
      poster_path:   data.poster_path,
      backdrop_path: data.backdrop_path,
      tagline:       data.tagline,
    };

    res.json(payload);
  } catch (err: unknown) {
    const typed = err as { status?: number; message: string };
    res.status(typed.status ?? 500).json({ error: typed.message });
  }
});

// GET /api/tmdb/movie/:id/videos
router.get('/movie/:id/videos', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await tmdbFetch<{ results: TmdbVideoRaw[] }>(`/movie/${req.params.id}/videos`);

    const videos: TmdbVideo[] = (data.results ?? []).map(v => ({
      key:      v.key,
      site:     v.site,
      type:     v.type,
      official: v.official,
      name:     v.name,
    }));

    res.json(videos);
  } catch (err: unknown) {
    const typed = err as { status?: number; message: string };
    res.status(typed.status ?? 500).json({ error: typed.message });
  }
});

// GET /api/tmdb/person/:id
router.get('/person/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await tmdbFetch<TmdbPersonMeta & Record<string, unknown>>(`/person/${req.params.id}`);

    const payload: TmdbPersonMeta = {
      id:             data.id,
      profile_path:   data.profile_path,
      biography:      data.biography,
      birthday:       data.birthday,
      place_of_birth: data.place_of_birth,
    };

    res.json(payload);
  } catch (err: unknown) {
    const typed = err as { status?: number; message: string };
    res.status(typed.status ?? 500).json({ error: typed.message });
  }
});

export default router;
