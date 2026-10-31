# MovieWeb (Grupo 5)

Trabajo práctico de **Bases de Datos y Recursos de Información 2026**, Universidad Austral.

Aplicación web para buscar películas, actores y directores, ver toda su información
(PostgreSQL + imágenes y tráilers de TMDB), marcar películas como favoritas o vistas,
puntuarlas, escribirles reseñas y seguir la actividad de cada usuario en un timeline (MongoDB).

## Integrantes

| Integrante | Parte del trabajo |
|---|---|
| Ian Espinillo | Estructura del proyecto, login, página de persona, dashboard y timeline, actividad y reseñas en MongoDB |
| Nicolás García Posadas | API de películas y keywords, contrato común de respuestas de la API |
| Tomás Carrizo Aslanian | Búsqueda general, detalle de película, diseño visual |
| Mateo Herrera | API de personas y usuarios, tablas de usuarios, índices y scripts de la base |

## Requisitos

- [Node.js](https://nodejs.org) 20 o superior (incluye npm).
- **PostgreSQL** corriendo en el puerto `5432`.
- **MongoDB** corriendo en el puerto `27017`.

No hace falta crear la base `movies` a mano ni tener `psql` en el PATH: lo resuelve `npm run dev:setup`.

## Instalación y ejecución

**1. Obtener el código.** Descomprimir el zip de la entrega, o clonar el repositorio:

```bash
git clone https://github.com/ianespinillo/movieweb_2026.git
cd movieweb_2026
```

**2. Instalar las dependencias** (API, frontend y herramientas, en un solo paso):

```bash
npm install
```

**3. Configurar `api/.env`.** En la entrega ya viene incluido. Si no existe, copiar `api/.env.example`
como `api/.env` (`npm run dev:setup` lo crea solo) y revisar estas variables:

| Variable | Qué poner |
|---|---|
| `DB_USER`, `DB_PASSWORD` | Usuario y contraseña de **tu** PostgreSQL |
| `DB_HOST`, `DB_PORT` | `localhost` y `5432` |
| `DB_DATABASE`, `DB_SCHEMA` | `movies` y `movies` (la base se crea sola si no existe) |
| `MONGO_URI` | `mongodb://localhost:27017/movieweb` |
| `TMDB_API_KEY` | Clave de [TMDB](https://www.themoviedb.org/settings/api). Sin ella la app anda, pero sin pósters, fotos ni tráilers |
| `JWT_SECRET`, `JWT_EXPIRES` | Cualquier texto largo, y `7d` |
| `PORT`, `CORS_ORIGIN` | `3500` y `http://localhost:4200` |

**4. Preparar las bases:**

```bash
npm run dev:setup
```

Crea la base `movies` si no existe, carga los datos de películas del enunciado, crea las tablas
del TP (usuarios y sus películas), los índices y los usuarios de prueba. La primera vez tarda
menos de un minuto. Se puede correr más de una vez: lo que ya existe no se duplica.

**5. Levantar la aplicación:**

```bash
npm start
```

Abrir **http://localhost:4200**. La API queda en http://localhost:3500 (control: http://localhost:3500/api/health).

En **Windows** también se puede usar doble clic en `INICIAR.cmd` (instala y levanta), `DETENER.cmd` y
`RESET_BD.cmd` (recarga la base desde cero, pide confirmación).

## Usuarios de prueba

Todos con la contraseña `movieweb2026`. Se puede entrar con el mail o con el nombre de usuario.

| Usuario | Mail |
|---|---|
| `ana_cine` | ana@movieweb.test |
| `bruno_m` | bruno@movieweb.test |
| `carla_r` | carla@movieweb.test |
| `diego_p` | diego@movieweb.test |

Cada uno tiene películas marcadas como favoritas, vistas o puntuadas, y actividad en su timeline.

## Bases de datos

**PostgreSQL**: base `movies`, esquema `movies`. Scripts en `db/`:

| Script | Qué hace |
|---|---|
| `01` a `12_*.sql` | Datos de películas del enunciado (`00_load_all.sql` los corre en orden con psql) |
| `13_users.sql` | Crea las tablas del TP: `users` y `user_movies` |
| `14_people_indexes.sql` | Índices para la búsqueda de personas |
| `15_seed_users.sql` | Usuarios de prueba y sus películas |
| `drop_tp_tables.sql` | Borra solo lo que agrega el TP; las películas quedan |

**MongoDB**: base `movieweb`, con dos colecciones:

- `user_activity`: la actividad de cada usuario (calificó, agregó a favoritos, escribió una reseña).
  Si está vacía, la API carga actividad de ejemplo para los usuarios de prueba al arrancar.
- `reviews`: las reseñas de texto, una por usuario y película.

| Comando | Qué hace |
|---|---|
| `npm run dev:setup` | Crea lo que falte, sin borrar nada |
| `npm run dev:reset` | Recarga todo desde cero (PostgreSQL, y vacía la actividad y las reseñas de MongoDB) |
| `npm run db:drop` | Corre `drop_tp_tables.sql` |

La forma manual, con `psql`, está en `db/instrucciones.txt`.

## Estructura

```
api/                 API REST (Express + TypeScript), puerto 3500
  src/routes/        movies, keywords, people, users, auth, activity, tmdb
  src/models/        modelos de MongoDB (reseñas)
  scripts/           setup-db.mjs (lo que corre npm run dev:setup)
web/                 Frontend (Angular), puerto 4200
packages/contracts/  Tipos compartidos entre api y web: la forma de cada respuesta
db/                  Scripts SQL
```

Todas las respuestas de la API tienen la forma `{ success, data, timestamp }`, y los errores
`{ success: false, statusCode, message, ... }`. Los tipos de cada ruta están en `packages/contracts`.
