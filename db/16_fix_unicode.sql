-- db/16_fix_unicode.sql
-- Repara los acentos de los datos de películas. Los scripts originales (01 a 12) perdieron la
-- barra de los códigos Unicode: traen 'Ricardo Daru00edn' en lugar de 'Ricardo Darín'.
-- Esos archivos no se tocan: este script corrige los datos después de cargarlos.
-- Correr después de 00_load_all.sql. Se puede correr más de una vez.
SET search_path TO movies, public;

-- Una función temporal: desaparece sola al cerrar la conexión.
--
-- No alcanza con reemplazar todo lo que parezca un código: en 'Todd Duffee' o 'quebec' también
-- hay una u seguida de cuatro letras hexadecimales. Por eso un código se decodifica solo si:
--   - tiene algún dígito (u00ed), o viene pegado a otro código (ubcfcuc2a4, nombres coreanos);
--   - y es un carácter válido: ni control, ni sustituto suelto, ni de uso privado, ni especial.
CREATE OR REPLACE FUNCTION pg_temp.fix_unicode_escapes(input text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  run_pattern CONSTANT text := '(?:u[0-9a-f]{4})+';  -- sin captura: substring devolvería solo el último
  result text := '';
  rest text := input;
  run text;
  decoded text;
  tokens text[];
  token text;
  code int;
  low int;
  i int;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;

  LOOP
    run := substring(rest FROM run_pattern);
    EXIT WHEN run IS NULL;

    result := result || left(rest, position(run IN rest) - 1);
    rest := substr(rest, position(run IN rest) + length(run));

    IF length(run) = 5 AND run !~ '[0-9]' THEN
      result := result || run;  -- una sola u + cuatro letras: es parte de una palabra
      CONTINUE;
    END IF;

    decoded := '';
    tokens := ARRAY(SELECT m[1] FROM regexp_matches(run, 'u[0-9a-f]{4}', 'g') AS m);
    i := 1;
    WHILE i <= array_length(tokens, 1) LOOP
      token := tokens[i];
      code := ('x' || lpad(substr(token, 2), 8, '0'))::bit(32)::int;

      IF code BETWEEN 55296 AND 56319 AND i < array_length(tokens, 1) THEN  -- par sustituto (emojis)
        low := ('x' || lpad(substr(tokens[i + 1], 2), 8, '0'))::bit(32)::int;
        IF low BETWEEN 56320 AND 57343 THEN
          decoded := decoded || chr(65536 + (code - 55296) * 1024 + (low - 56320));
          i := i + 2;
          CONTINUE;
        END IF;
      END IF;

      IF code < 32 OR code BETWEEN 55296 AND 63743 OR code >= 65520 THEN
        decoded := decoded || token;
      ELSE
        decoded := decoded || chr(code);
      END IF;
      i := i + 1;
    END LOOP;

    result := result || decoded;
  END LOOP;

  -- NFC: une letra + acento combinado (a + u0301) en un solo carácter, así la búsqueda los encuentra
  RETURN normalize(result || rest, NFC);
END;
$$;

UPDATE person             SET person_name    = pg_temp.fix_unicode_escapes(person_name)    WHERE person_name    ~ 'u[0-9a-f]{4}';
UPDATE movie_cast         SET character_name = pg_temp.fix_unicode_escapes(character_name) WHERE character_name ~ 'u[0-9a-f]{4}';
UPDATE movie              SET overview       = pg_temp.fix_unicode_escapes(overview)       WHERE overview       ~ 'u[0-9a-f]{4}';
UPDATE movie              SET tagline        = pg_temp.fix_unicode_escapes(tagline)        WHERE tagline        ~ 'u[0-9a-f]{4}';
UPDATE keyword            SET keyword_name   = pg_temp.fix_unicode_escapes(keyword_name)   WHERE keyword_name   ~ 'u[0-9a-f]{4}';
UPDATE language           SET language_name  = pg_temp.fix_unicode_escapes(language_name)  WHERE language_name  ~ 'u[0-9a-f]{4}';
UPDATE production_company SET company_name   = pg_temp.fix_unicode_escapes(company_name)   WHERE company_name   ~ 'u[0-9a-f]{4}';
