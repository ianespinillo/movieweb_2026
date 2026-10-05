-- db/13_users.sql
SET search_path TO movies, public;

CREATE TABLE IF NOT EXISTS users (
  user_id       SERIAL       PRIMARY KEY,
  user_username VARCHAR(50)  UNIQUE NOT NULL,
  user_name     VARCHAR(100),
  user_email    VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS movie_user (
  user_id   INT REFERENCES users(user_id)  ON DELETE CASCADE,
  movie_id  INT REFERENCES movie(movie_id) ON DELETE CASCADE,
  rating    NUMERIC(3,1) CHECK (rating >= 0 AND rating <= 10),
  review    TEXT,
  added_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, movie_id)
);
