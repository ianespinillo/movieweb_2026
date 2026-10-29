// Contract between api/ and web/. Both import these types, so if a field changes here,
// whichever side was not updated stops compiling.
//
//   import type { ApiResponse, MovieSummary } from '@movieweb/contracts';
//
// Convention: fields are named like the PostgreSQL columns (snake_case).

export * from './http';
export * from './movies';
export * from './people';
export * from './users';
export * from './auth';
export * from './tmdb';
export * from './activity';
