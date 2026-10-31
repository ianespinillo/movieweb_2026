// Prepara las bases para desarrollar o corregir el TP. Lo corre `npm run dev:setup`.
//
//   node scripts/setup-db.mjs           crea la base y lo que falte (no borra nada)
//   node scripts/setup-db.mjs --reset   recarga todo desde cero (PostgreSQL y la actividad de Mongo)
//   node scripts/setup-db.mjs --drop    borra solo lo que agrega el TP (db/drop_tp_tables.sql)
//
// Usa la librería pg de la API en lugar de psql, así funciona en cualquier sistema
// operativo sin tener psql en el PATH. Las credenciales salen de api/.env.
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import pg from 'pg';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbDir = join(apiDir, '..', 'db');
const envPath = join(apiDir, '.env');

const args = new Set(process.argv.slice(2));
const RESET = args.has('--reset');
const DROP = args.has('--drop');

// Datos de películas del enunciado, en el orden de db/00_load_all.sql
const MOVIE_DATA_FILES = [
  '01_reference_data.sql', '02_keyword.sql', '03_person.sql', '04_production_company.sql',
  '05_movie.sql', '06_movie_cast.sql', '07_movie_company.sql', '08_movie_crew.sql',
  '09_movie_genres.sql', '10_movie_keywords.sql', '11_movie_languages.sql',
  '12_production_country.sql',
];
// Lo que agrega el TP. Se puede correr más de una vez sin duplicar nada.
const TP_FILES = ['13_users.sql', '14_people_indexes.sql', '15_seed_users.sql'];
// Colecciones de Mongo que se vacían con --reset, así la API vuelve a cargar su actividad
// de ejemplo para los usuarios de prueba recién creados.
const MONGO_COLLECTIONS = ['user_activity', 'reviews'];

function step(msg) { console.log(`\n> ${msg}`); }
function info(msg) { console.log(`  ${msg}`); }
function fail(msg, hint) {
  console.error(`\nERROR: ${msg}`);
  if (hint) console.error(`Qué hacer: ${hint}`);
  process.exit(1);
}

function readSql(file) {
  return readFileSync(join(dbDir, file), 'utf8');
}

// ─── Configuración ───────────────────────────────────────────────────────────

if (!existsSync(envPath)) {
  copyFileSync(join(apiDir, '.env.example'), envPath);
  info('Se creó api/.env a partir de api/.env.example. Revisá DB_PASSWORD si falla la conexión.');
}
dotenv.config({ path: envPath });

const database = process.env.DB_DATABASE ?? 'movies';
const schema = process.env.DB_SCHEMA ?? 'movies';
const connection = {
  user:     process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD,
  host:     process.env.DB_HOST ?? 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
};

// CREATE DATABASE no acepta parámetros ($1), así que el nombre se valida antes de usarlo
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(database)) {
  fail(`DB_DATABASE="${database}" no es un nombre válido.`, 'Usá solo letras, números y _ en api/.env.');
}

function explainPgError(err) {
  if (err.code === '28P01') {
    fail('PostgreSQL rechazó la contraseña.', 'Poné la contraseña de tu usuario de PostgreSQL en DB_PASSWORD (api/.env).');
  }
  if (err.code === 'ECONNREFUSED') {
    fail(`PostgreSQL no responde en ${connection.host}:${connection.port}.`, 'Arrancá el servicio de PostgreSQL o revisá DB_HOST y DB_PORT en api/.env.');
  }
  throw err;
}

// ─── PostgreSQL ──────────────────────────────────────────────────────────────

async function ensureDatabase() {
  const admin = new pg.Client({ ...connection, database: 'postgres' });
  await admin.connect().catch(explainPgError);
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${database}" ENCODING 'UTF8'`);
      info(`Base "${database}" creada.`);
    } else {
      info(`La base "${database}" ya existe.`);
    }
  } finally {
    await admin.end();
  }
}

async function moviesLoaded(client) {
  const table = await client.query('SELECT to_regclass($1) AS t', [`${schema}.movie`]);
  if (table.rows[0].t === null) return false;
  const count = await client.query(`SELECT COUNT(*)::int AS n FROM "${schema}".movie`);
  return count.rows[0].n > 0;
}

/**
 * Carga los datos de películas en una sola transacción: si algo falla, no queda nada a
 * medias. Los scripts originales terminan con un COMMIT suelto (sin BEGIN) que cortaría
 * la transacción, así que se saca antes de ejecutarlos.
 */
async function loadMovieData(client) {
  await client.query('BEGIN');
  try {
    for (const file of MOVIE_DATA_FILES) {
      const started = Date.now();
      await client.query(readSql(file).replace(/^\s*COMMIT\s*;\s*$/gim, ''));
      info(`${file} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function runInTransaction(client, file) {
  await client.query('BEGIN');
  try {
    await client.query(readSql(file));
    await client.query('COMMIT');
    info(file);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function printSummary(client) {
  const { rows } = await client.query(`
    SELECT (SELECT COUNT(*) FROM movie)       AS movies,
           (SELECT COUNT(*) FROM person)      AS people,
           (SELECT COUNT(*) FROM users)       AS users,
           (SELECT COUNT(*) FROM user_movies) AS user_movies`);
  const r = rows[0];
  info(`${r.movies} películas · ${r.people} personas · ${r.users} usuarios · ${r.user_movies} películas marcadas`);
}

// ─── MongoDB ─────────────────────────────────────────────────────────────────

async function resetMongo() {
  const uri = process.env.MONGO_URI ?? 'mongodb://localhost:27017/movieweb';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
  } catch {
    info('AVISO: MongoDB no responde, no se pudo vaciar la actividad. Arrancá el servicio y repetí --reset.');
    return;
  }
  try {
    const existing = (await mongoose.connection.db.listCollections().toArray()).map(c => c.name);
    for (const name of MONGO_COLLECTIONS.filter(n => existing.includes(n))) {
      const { deletedCount } = await mongoose.connection.db.collection(name).deleteMany({});
      info(`${name}: ${deletedCount} documentos borrados`);
    }
    info('La API vuelve a cargar la actividad de ejemplo la próxima vez que arranque.');
  } finally {
    await mongoose.disconnect();
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`MovieWeb: preparando la base "${database}" en ${connection.host}:${connection.port}`);

  step('Base de datos');
  await ensureDatabase();

  const client = new pg.Client({
    ...connection,
    database,
    options: `-c search_path=${schema},public`,
  });
  await client.connect().catch(explainPgError);

  try {
    if (DROP) {
      step('Borrando lo que agrega el TP (las películas quedan)');
      await runInTransaction(client, 'drop_tp_tables.sql');
      console.log('\nListo. Para volver a crearlo: npm run dev:setup');
      return;
    }

    step('Datos de películas');
    if (RESET || !(await moviesLoaded(client))) {
      info(RESET ? 'Recargando desde cero (--reset)...' : 'Cargando por primera vez, puede tardar hasta un minuto...');
      await loadMovieData(client);
    } else {
      info('Ya están cargados. Para recargarlos desde cero: npm run dev:reset');
    }

    step('Tablas de usuarios, índices y datos de prueba');
    for (const file of TP_FILES) await runInTransaction(client, file);

    step('Resumen');
    await printSummary(client);
  } finally {
    await client.end();
  }

  if (RESET) {
    step('MongoDB');
    await resetMongo();
  }

  console.log('\nListo. Para levantar la app: npm start');
  console.log('Usuarios de prueba: ana@movieweb.test, bruno@movieweb.test, carla@movieweb.test, diego@movieweb.test (contraseña movieweb2026)');
}

main().catch((err) => {
  console.error('\nERROR inesperado:', err.message);
  process.exit(1);
});
