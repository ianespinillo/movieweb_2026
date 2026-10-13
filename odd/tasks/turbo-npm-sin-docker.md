# Feature: Monorepo npm + Turborepo (sin Docker)

## Objetivo

Convertir el repo en un **monorepo npm** (workspaces) orquestado por **Turborepo**, y
eliminar por completo Docker del proyecto. PostgreSQL y MongoDB pasan a ser
instalaciones **nativas de Windows** (sus puertos por defecto: 5432 y 27017).

## Problema / Por qué

- Docker levantaba 4 servicios (`postgres`, `mongo`, `api`, `web`). El usuario quiere
  tooling estándar (`npm` + `turbo`) y sacar Docker.
- El `package.json` raíz es el **prototipo EJS legado** (`app.js` + `views/*.ejs`), el
  `node_modules` raíz está instalado con **pnpm** y `web/` declara **npm** → mezcla de
  gestores sin un root coherente.
- Los `.cmd` de la raíz y `scripts/dev.ps1` dependen 100% de `docker compose`: quedan
  **rotos** en cuanto se saca Docker.

## Alcance

- `package.json` (raíz) → **workspace root**: `private: true`, `workspaces: ["api","web"]`,
  `devDependency` `turbo`, scripts `dev` / `build` / `test`. Se quitan las deps legacy
  (`express`, `ejs`, `pg`, `dotenv`, que pertenecían a `app.js`).
- `turbo.json` (Turborepo v2, clave `tasks`): `dev` (persistent, sin cache), `build`
  (`outputs: dist/**`, `dependsOn: ^build`), `test`.
- `web/package.json`: agregar script `dev` (`ng serve`) para que Turbo lo ejecute.
- Borrar: `docker-compose.yml`, `api/Dockerfile.dev`, `web/Dockerfile.dev`,
  `docker/init-db.sh`.
- `scripts/dev.ps1` reescrito **sin Docker**: `start` (valida Node/npm, genera `api/.env`,
  avisa de TMDB y de las bases nativas, `npm install` si falta, `npm run dev`);
  `stop` (libera 3500/4200); `reset` (re-seed de PostgreSQL desde `db/` con `psql`).
- `.gitignore`: dejar de ignorar `package-lock.json`, agregar `.turbo/` y `dist/`.
- `README.md` + `CONTEXT.md`: reemplazar la puesta en marcha Docker por npm/Turbo + DBs
  nativas.
- Borrar `pnpm-lock.yaml` (sin trackear) y regenerar el lockfile con npm.

## Fuera de alcance

- `app.js` y `views/` (prototipo EJS legado): se dejan **intactos** pero **desconectados**
  del root (su deps salen del `package.json` raíz). Si el usuario quiere, se borran aparte.
- Cambios en el código de la app (rutas, Angular, features).
- Instalación/configuración nativa de PostgreSQL o MongoDB (asumimos que ya están).

## Restricciones

- Windows / PowerShell 5.1 (los `.cmd` invocan `powershell`, no `pwsh`); `dev.ps1` debe
  guardarse en **UTF-8 con BOM** para que los acentos rendericen bien.
- No imprimir valores de `api/.env` (solo presencia/ausencia de la key TMDB).
- No ejecutar nada destructivo (drop de DB) sin confirmación explícita del humano.
- Idioma de artefactos: español (repo y público argentino).

## Criterios de aceptación

1. `npm install` en la raíz instala `api` + `web` (workspaces) y `turbo`.
2. `npm run dev` levanta `api` (3500) y `web` (4200) vía Turbo.
3. `npm run build` construye `api` y `web`. ⚠️ `web` compila; `api` **no** por un error
   de TypeScript **preexistente** (ver Evidencia de verificación).
4. No queda **ninguna** referencia a Docker (ni archivos ni docs).
5. `npx turbo run build --dry` resuelve el grafo sin errores.

## Ruta por tarea (declaración de delegación)

- Trigger de writer disparado (2+ archivos). El change-set es una **migración de
  configuración mecánica, ya entendida y especificada**, con un archivo sensible a
  encoding (`scripts/dev.ps1` requiere **UTF-8 + BOM** para PS 5.1). Ejecutado
  **inline** para garantizar el encoding exacto; la sesión previa documentó además que
  la delegación por subagente estaba **bloqueada** por el runtime del cliente.

## Forecast de entrega

~300 líneas escritas (package.json + turbo.json + dev.ps1 + docs) → menor a 400 →
estrategia `ask-on-risk`: sin split ni `size:exception`. Feature branch, work-unit commits.

## Progreso

- [x] T1 Exploración del entorno (compose, scripts, api, web, git, DBs, lockfiles)
- [x] T2 Este documento + espejo engram
- [x] T3 Root `package.json` → workspace root + `turbo.json`
- [x] T4 `web/package.json`: script `dev`
- [x] T5 Borrar Docker (`docker-compose.yml`, Dockerfiles, `docker/`)
- [x] T6 Reescribir `scripts/dev.ps1` sin Docker
- [x] T7 `.gitignore` (lockfile, `.turbo/`, `dist/`)
- [x] T8 README + CONTEXT
- [x] T9 Reinstalar con npm + verificar Turbo

### Evidencia de verificación

Ejecutado el 2026-10-13 (Windows, PowerShell 7 shell / PS 5.1 para `.cmd`).

**Verde:**

- `npm install` en la raíz → `added 476 packages in 1m`, exit 0. Resuelve los workspaces
  `movieweb-api` (api) y `web`, más `turbo 2.11.7` en `node_modules/.bin`.
- `npx turbo run build --dry` → `Packages in scope: movieweb-api, web`; grafo correcto,
  `build` en 2 paquetes.
- `npx turbo run dev --dry` → `dev` resuelve en 2 paquetes (ambos tienen script `dev`).
- `npx turbo run build --filter=web` → exit 0; bundle en `web/dist/web` (216.81 kB);
  Turbo registra cache-miss y la tarea como `successful`.
- `node -e "require('bcrypt')"` (cwd `api`) → **OK**; `require('esbuild').version` →
  `0.28.2`. Los avisos `allow-scripts` de npm 11.16 **no** rompieron los binarios nativos.
- `dev.ps1`: parseo de AST sin errores de sintaxis; guardado UTF-8 **con BOM** (`EF BB BF`).
- `git grep -i docker` sobre `*.md/*.json/*.yml/*.ps1/*.cmd` (excluyendo el doc histórico
  `odd/tasks/entorno-a-prueba-de-boludos.md`) → **0 resultados**.

**Rojo (preexistente, ajeno a esta migración):**

- `npm run build` (completo, vía Turbo) → **falla en `movieweb-api`**:
  `src/middleware/authenticate.ts(18,21): error TS2352: Conversion of type
  'string | JwtPayload' to type 'AuthPayload'`.
  - Origen: commit inicial `176ba78` — código **no tocado** por esta feature.
  - Por qué apareció ahora: Docker levantaba la API con `tsx watch` (dev), nunca corría
    `tsc`; el nuevo `turbo run build` sí lo ejecuta y expone el error.
  - Fix sugerido (1 línea, **pendiente de autorización** por estar fuera de alcance):
    en `authenticate.ts:18` → `jwt.verify(token, JWT_SECRET) as unknown as AuthPayload`.

**No verificado a propósito:**

- `npm run dev` end-to-end (api 3500 + web 4200): requiere **MongoDB** nativo en `27017`,
  que en este equipo está **cerrado** (PostgreSQL `5432` sí escucha, PID 6876). Fallaría
  por entorno, no por la migración. La *conexión* de Turbo al `dev` sí quedó verificada vía
  `--dry`.
- `dev.ps1 -Action reset` (re-seed): destructivo y depende de `psql` + las bases nativas.
- `INICIAR.cmd` / `DETENER.cmd` end-to-end: wrappers sin cambios que llaman a `dev.ps1`
  (ya validado por parseo).

**Pendiente de decisión del humano:**

- Confirmar/modificar el fix del error TS de `api` (criterio 3).
- Commit de la migración (los cambios están sin commitear sobre la rama `feat/entorno-apb`).
