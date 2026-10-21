-- db/drop_tp_tables.sql
-- Borra lo que el TP agrega a la base movies: las tablas de usuarios y los índices de
-- personas. No toca las tablas originales de películas.
-- Para volver a crear todo: 13_users.sql, 14_people_indexes.sql y 15_seed_users.sql.
-- La actividad y las reseñas viven en MongoDB y se borran aparte.
SET search_path TO movies, public;

-- user_movies primero, porque su clave foránea apunta a users.
DROP TABLE IF EXISTS user_movies;
DROP TABLE IF EXISTS movie_user;  -- nombre de una versión anterior, por si quedó creada
DROP TABLE IF EXISTS users;

DROP INDEX IF EXISTS idx_movie_cast_person;
DROP INDEX IF EXISTS idx_movie_crew_person_job;
