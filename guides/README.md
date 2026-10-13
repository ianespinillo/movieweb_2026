# Guides — MovieWeb 2026

Una guía por integrante. Cada archivo es autocontenido: pegarlo junto con `CONTEXT.md` al inicio de la sesión con el LLM.

| Guía | Rol | Tecnologías |
|------|-----|-------------|
| [GUIDE_A](./GUIDE_A_backend_movies.md) | Backend: Películas + Keywords | Express, PostgreSQL, TypeScript |
| [GUIDE_B](./GUIDE_B_backend_people_users.md) | Backend: Personas + Usuarios | Express, PostgreSQL, TypeScript, JWT middleware |
| [GUIDE_C](./GUIDE_C_frontend_search_movies.md) | Frontend: Home + Search + Movie Detail | Angular 22, spartan/ui, TMDB |
| [GUIDE_D](./GUIDE_D_frontend_people_users_timeline.md) | Frontend: Personas + Usuarios + Timeline | Angular 22, MongoDB, spartan/ui |
| [GUIDE_AUTH](./GUIDE_AUTH_frontend.md) | Auth frontend (compartido C y D) | AuthService, interceptor, guard, JWT |

> **Variables de entorno nuevas:** agregar `JWT_SECRET=una-cadena-secreta-larga` en `api/.env`.


## Flujo de trabajo (npm + Turborepo)

```bash
# Un solo comando en la raíz del repo levanta API + frontend:
# - API Express TS (puerto 3500, con hot-reload al editar en api/src)
# - Angular 22 (puerto 4200, con hot-reload al editar en web/src)
# Requiere PostgreSQL y MongoDB nativos corriendo.
npm run dev
```

> **Para reconstruir la base PostgreSQL desde cero:** `RESET_BD.cmd` (o `psql -f db/00_load_all.sql`).
> **Para parar todo:** `Ctrl+C` en la ventana (o `DETENER.cmd`).

```
Arranca todo con: npm run dev
  ↓
A y B editan en api/src/routes/ ─────────────┐ (hot-reload automático)
C y D editan en web/src/app/features/ ───────┤ (hot-reload automático)
                                             │
D también crea api/src/routes/activity.ts ───┘
```

## Contexto para el LLM

Siempre pegá también `CONTEXT.md` (raíz del repo) — contiene el stack, endpoints, schemas y convenciones del proyecto.
