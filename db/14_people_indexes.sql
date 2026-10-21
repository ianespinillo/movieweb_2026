-- db/14_people_indexes.sql
-- Índices para buscar personas y armar su filmografía (rutas /api/people).
--
-- PostgreSQL no crea índices para las claves foráneas por su cuenta. Sin estos, cada
-- consulta por person_id recorre entera movie_cast (~106 mil filas) o movie_crew
-- (~130 mil). Medido buscando "john" (1.295 coincidencias): 30 s sin índices, 0,15 s con.
--
-- Correr después de 00_load_all.sql, que recrea el esquema. Se puede correr más de una vez.
SET search_path TO movies, public;

CREATE INDEX IF NOT EXISTS idx_movie_cast_person ON movie_cast (person_id);

-- Compuesto porque la búsqueda pregunta "¿esta persona dirigió algo?":
-- WHERE person_id = ? AND job = 'Director'
CREATE INDEX IF NOT EXISTS idx_movie_crew_person_job ON movie_crew (person_id, job);
