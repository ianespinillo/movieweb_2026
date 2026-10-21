-- db/15_seed_users.sql
-- Datos de prueba: cuatro usuarios inventados con películas marcadas, para que la lista de
-- usuarios y los perfiles no arranquen vacíos. Correr después de 13_users.sql.
-- Se puede correr más de una vez: lo que ya existe se saltea.
--
-- Contraseña de los cuatro usuarios: movieweb2026
-- (el hash es bcrypt, generado con la misma librería que usa /api/auth/login)
SET search_path TO movies, public;

INSERT INTO users (user_username, user_name, user_email, password_hash) VALUES
  ('ana_cine', 'Ana Fernández', 'ana@movieweb.test',   '$2b$10$kznyJvQRC5qlp7QKA5fTqOwZAOhDRiTlgGsWL5/JyqqGHNyxhq97a'),
  ('bruno_m',  'Bruno Martínez', 'bruno@movieweb.test', '$2b$10$kznyJvQRC5qlp7QKA5fTqOwZAOhDRiTlgGsWL5/JyqqGHNyxhq97a'),
  ('carla_r',  'Carla Ríos',     'carla@movieweb.test', '$2b$10$kznyJvQRC5qlp7QKA5fTqOwZAOhDRiTlgGsWL5/JyqqGHNyxhq97a'),
  ('diego_p',  'Diego Paz',      'diego@movieweb.test', '$2b$10$kznyJvQRC5qlp7QKA5fTqOwZAOhDRiTlgGsWL5/JyqqGHNyxhq97a')
ON CONFLICT DO NOTHING;

-- Los user_id los asigna SERIAL, así que se buscan por username en vez de escribirlos fijos.
INSERT INTO user_movies (user_id, movie_id, is_favorite, watched, rating, added_at, updated_at)
SELECT u.user_id, v.movie_id, v.is_favorite, v.watched, v.rating,
       NOW() - v.days_ago * INTERVAL '1 day',
       NOW() - v.days_ago * INTERVAL '1 day'
FROM (VALUES
  -- username,  movie_id, favorita, vista, estrellas, hace cuántos días
  ('ana_cine',  603,    TRUE,  TRUE,  5,    20),  -- The Matrix
  ('ana_cine',  27205,  TRUE,  TRUE,  5,    12),  -- Inception
  ('ana_cine',  157336, FALSE, TRUE,  4,    6),   -- Interstellar
  ('ana_cine',  155,    TRUE,  FALSE, NULL, 2),   -- The Dark Knight (favorita sin ver todavía)
  ('bruno_m',   238,    TRUE,  TRUE,  5,    30),  -- The Godfather
  ('bruno_m',   769,    FALSE, TRUE,  4,    18),  -- GoodFellas
  ('bruno_m',   680,    TRUE,  TRUE,  5,    9),   -- Pulp Fiction
  ('bruno_m',   550,    FALSE, TRUE,  3,    4),   -- Fight Club
  ('carla_r',   13,     TRUE,  TRUE,  5,    25),  -- Forrest Gump
  ('carla_r',   296098, FALSE, TRUE,  4,    11),  -- Bridge of Spies
  ('carla_r',   278,    TRUE,  TRUE,  5,    7),   -- The Shawshank Redemption
  ('diego_p',   11,     TRUE,  TRUE,  5,    15),  -- Star Wars
  ('diego_p',   120,    FALSE, TRUE,  4,    8),   -- The Lord of the Rings
  ('diego_p',   13223,  FALSE, FALSE, 3,    1)    -- Gran Torino
) AS v (username, movie_id, is_favorite, watched, rating, days_ago)
JOIN users u ON u.user_username = v.username
ON CONFLICT DO NOTHING;
