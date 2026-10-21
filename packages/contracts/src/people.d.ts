import type { Movie, PersonRef } from './movies';

/** Item of GET /api/people/search — only people who acted in or directed a movie. */
export interface PersonSearchResult extends PersonRef {
  /** Appears in the cast of at least one movie. */
  is_actor: boolean;
  /** Directed at least one movie. */
  is_director: boolean;
}

/** A movie in a person's filmography. */
export type FilmographyMovie = Pick<Movie, 'movie_id' | 'title' | 'release_date' | 'vote_average'>;

/** A movie the person acted in. */
export interface ActingCredit extends FilmographyMovie {
  /** Character played. Several characters in the same movie are joined with ' / '. */
  character_name: string | null;
}

/** A job the person did on a movie's crew. */
export interface CrewCredit extends FilmographyMovie {
  department_name: string;
  job: string;
}

/** GET /api/people/:id — the person and every movie they took part in, with their role. */
export interface PersonDetail extends PersonRef {
  as_actor: ActingCredit[];
  /** Crew credits whose job is 'Director'. */
  as_director: CrewCredit[];
  /** Every other crew job (producer, writer, ...). A movie can be here and in as_director. */
  as_crew: CrewCredit[];
}
