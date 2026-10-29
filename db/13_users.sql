-- db/13_users.sql
-- Tablas del TP para usuarios y sus películas (PDF 2.5).
-- Correr después de 00_load_all.sql. Para borrarlas: drop_tp_tables.sql.
-- Datos de prueba: 15_seed_users.sql.
SET search_path TO movies, public;

-- El alta la hace POST /api/auth/register, que guarda la contraseña como hash bcrypt.
CREATE TABLE IF NOT EXISTS users (
  user_id       SERIAL       PRIMARY KEY,
  user_username VARCHAR(50)  NOT NULL UNIQUE,
  user_name     VARCHAR(100),
  user_email    VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL
);

-- Una fila por usuario y película: si es favorita, si la vio y cuántas estrellas le puso.
-- Una misma película puede ser favorita y vista a la vez. Las reseñas no van acá:
-- se guardan en MongoDB (PDF 3.2).
CREATE TABLE IF NOT EXISTS user_movies (
  user_id     INT         NOT NULL REFERENCES users (user_id)  ON DELETE CASCADE,
  movie_id    INT         NOT NULL REFERENCES movie (movie_id) ON DELETE CASCADE,
  is_favorite BOOLEAN     NOT NULL DEFAULT FALSE,
  watched     BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Estrellas de 1 a 5. NULL = todavía no la puntuó.
  rating      SMALLINT    CHECK (rating BETWEEN 1 AND 5),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- También sirve de índice para "las películas de un usuario" (empieza por user_id).
  CONSTRAINT pk_user_movies PRIMARY KEY (user_id, movie_id),
  -- Una fila sin ninguna marca no dice nada: cuando el usuario saca todo, se borra la fila.
  CONSTRAINT user_movies_has_mark CHECK (is_favorite OR watched OR rating IS NOT NULL)
);
