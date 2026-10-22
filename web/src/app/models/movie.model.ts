
export interface Movie {
  movie_id: number;
  title: string;
  release_date: string | null;
  overview: string | null;
  vote_average: number | null;
  vote_count: number | null;
}
