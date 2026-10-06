# Feature: Entorno a prueba de boludos (APB)

## Objetivo

Levantar MovieWeb con UN doble clic, sin que el grupo sepa nada de Node, PostgreSQL,
MongoDB ni Docker. Si alguien clona el repo y ejecuta `INICIAR.cmd`, tiene la app en
`http://localhost:4200` o muere con un mensaje claro de qué hacer.

## Problema / Por qué

- `api/.env` y `.env` están en `.gitignore` → un clone nuevo hace `docker compose up`
  y recibe el error críptico `env file ... not found`.
- El commit HEAD NO compila: `angular.json` apunta a `src/main.ts`, pero HEAD tiene
  `web/main.ts` (raíz) y falta `web/src/main.ts` (existe solo en el working copy).
- El README describe instalar Node/Postgres/Mongo a mano y `node app.js` (código EJS
  que ya no existe): instrucciones obsoletas que garantizan que el grupo se pierda.
- No hay healthcheck en el contenedor `api` ni verificación de que el stack quedó
  realmente levantado; si algo falla, el usuario no tiene feedback.

## Alcance

- `scripts/dev.ps1` — chequeo de prereqs (Docker instalado/daemon corriendo), creación
  automática de `api/.env` desde el ejemplo, chequeo de puertos ocupados, `up` con
  build, espera activa de `/api/health` y del dev server, resumen final con URLs, y
  volcado de logs + hints al fallar. Acciones: `start | stop | reset` (reset pide
  confirmación porque borra datos).
- `INICIAR.cmd`, `DETENER.cmd`, `RESET_BD.cmd` — wrappers de doble clic (ASCII, CRLF).
- `docker-compose.yml` — `env_file` con `required: false`, healthcheck en `api`,
  `web` espera `api` healthy.
- `README.md` — sección "Puesta en marcha rápida" al tope + nota de que con Docker no
  hace falta instalar el software de la sección "Instalación de software".
- Commits de los fixes preexistentes del working copy sin los cuales el clone nuevo
  no levanta (movimiento de `web/src/main.ts`, bootstrap fail-fast de `server.ts`).

## Fuera de alcance

- Cambios de código de la app (rutas, features, Angular).
- Arreglar/eliminar el `package.json` raíz legado o el `pnpm-lock.yaml` sin commitear.
- Variantes bash/macOS del script (el README cubre el comando raw de compose).
- Push, PR, o tocar el estado de contenedores de otros proyectos (vir-ttend, austral).

## Restricciones

- Windows/PowerShell 5.1 compatible (los .cmd usan `powershell`, no `pwsh`).
- `.ps1` guardado con UTF-8 BOM (acentos correctos en PS 5.1); `.cmd` solo ASCII + CRLF.
- No imprimir valores de variables de `api/.env` (solo presencia/ausencia de la key).
- Nunca correr `docker compose down -v` sin confirmación explícita del humano.
- Idioma de artefactos: español (README/ mensajes de script = público argentino).

## Criterios de aceptance

1. Con el stack caído, `INICIAR.cmd` lo levanta entero y termina con URLs correctas.
2. Con el stack arriba, `INICIAR.cmd` termina rápido en el camino feliz.
3. Sin Docker instalado / daemon apagado / puerto ocupado / build fallido: mensaje en
   español con la acción concreta a tomar (nunca stack trace crudo como única salida).
4. Clone nuevo (HEAD + esta feature): `api/.env` se auto-genera; compose no explota.
5. `DETENER.cmd` baja solo el stack de este proyecto; `RESET_BD.cmd` pide confirmación
   antes de `-v`.
6. `docker compose config` válido; cold start real verificado (down → INICIAR).

## Checkplan

- [x] `docker compose config` sin errores
- [x] Camino feliz warm: `INICIAR.cmd` con stack arriba → "TODO LISTO"
- [x] Cold start: `docker compose down` → `INICIAR.cmd` → salud + UI respondiendo
- [x] Guardas: daemon apagado y puerto ocupado producen mensaje claro
- [x] `DETENER.cmd` / `RESET_BD.cmd` (reset solo hasta la confirmación)
- [x] README refleja los comandos reales

## Ruta por tarea (declaración de delegación)

- Delegación de subagentes INTENTADA y BLOQUEADA: el runtime devolvió
  `OpenCode's free tier can only be used from within OpenCode` (fallo del proveedor
  del cliente, no del workflow). Usuario indicó "sigue nomás" → todas las tareas
  corren **inline** (trigger de writer 2+ archivos disparado; ejecutado inline por
  indisponibilidad del mecanismo).

## Forecast de entrega

~300 líneas escritas (scripts + compose + README) < 400 → estrategia `ask-on-risk`:
no requiere split ni `size:exception`. Feature branch, work-unit commits.

## Progreso

- [x] T1 Exploración del entorno (compose, db, api, web, git, herramientas)
- [x] T2 Este documento + espejo engram
- [x] T3 `scripts/dev.ps1` (start/stop/reset con checks)
- [x] T4 Wrappers `.cmd`
- [x] T5 Hardening de `docker-compose.yml`
- [x] T6 Sección de puesta en marcha en `README.md`
- [x] T7 Verificación funcional (config, warm, cold start, guardas)
- [x] T8 Commits en feature branch + cierre (memoria)

### Evidencia de verificación

- `docker compose config --quiet` → OK.
- **Cold start** (stack abajo → `cmd /c INICIAR.cmd`): EXIT=0, imprime
  `[ok] API`, `[ok] Frontend`, banner `TODO LISTO`; `docker compose ps` final
  → api/ mongo/ postgres `Up (healthy)`, web `Up`.
- **Warm**: segunda corrida → EXIT=0 sin reconstrucciones innecesarias.
- **Guarda docker ausente** (PATH aislado): EXIT=1 con instrucción de instalar
  Docker Desktop.
- **Guarda puerto duro** (web detenido + listener en 4200): EXIT=1 nombrando solo
  `4200 (frontend Angular)`; stack restaurado con `up -d`.
- **Puerto blando 5432** (servicio nativo `postgresql-x64-16` del equipo corriendo):
  AVISO amarillo + continúa; compose bindea igual y el stack queda healthy
  (convivencia probada, igual que los otros proyectos del equipo en 5434/5435/5436).
- **`DETENER.cmd`**: EXIT=0, `docker compose down` completo, mensaje de datos preservados.
- **`RESET_BD.cmd`**: con respuesta ≠ SI → EXIT=0 "Cancelado: no se tocó nada"
  (la ruta destructiva NO se ejecutó a propósito: borra datos reales).
- Bugs encontrados y corregidos durante los tests:
  1. Claves `Int32` en `[ordered]` → PowerShell resolvía `$map[$p]` como null
     (indexer posicional); migrado a lista de hashtables.
  2. `docker compose up` puede bloquearse infinito esperando un depend healthy →
     ejecutado en job con tope de 12 min + heartbeats.
  3. Contenedor que truena al arrancar solo se veía a los 7 min → detección
     `Exited/Restarting/Dead` con gracia de 20s.
  4. Ruido `NativeCommandError` al capturar stderr de docker dentro del job →
     pipeline a strings planos.
  5. Guiones `──` no renderizan en consolas legacy → ASCII en textos de salida.
- **No probado a propósito**: ruta destructiva completa de `RESET_BD.cmd`
  (borraría datos locales reales); su tramo final reutiliza `Invoke-Start`, ya
  probado en cold start.
