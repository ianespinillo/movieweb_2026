# Feature: Reseñas en texto (MongoDB)

## Objetivo

Permitir que un usuario escriba, edite y borre una reseña en texto por película, listar las
reseñas de una película y del usuario, y registrar el evento `WROTE_REVIEW` en el timeline.

## Problema / Por qué

- El TP pide listar "la opinión sobre esa película" de cada usuario (README:103) y un evento
  `WROTE_REVIEW` cuyo `reviewId` apunta a otra colección (README:147).
- `CONTEXT.md` ya decidió que las reseñas viven en MongoDB, no en `user_movies`.
- El evento `WROTE_REVIEW` existe en el schema y en el dashboard, pero nada lo genera.

## Alcance

- Colección Mongo `reviews`: `{ userId, movieId, movieTitle, text, createdAt, updatedAt }`,
  índice único `{ userId, movieId }` (una reseña editable por usuario y película).
- Validación: `text` con trim, no vacío, máximo 2000 caracteres.
- API:
  - `PUT /api/users/:id/movies/:movieId/review` (upsert, auth + dueño).
  - `DELETE /api/users/:id/movies/:movieId/review` (auth + dueño).
  - `GET /api/movies/:id/reviews` (público, username desde PostgreSQL).
  - `GET /api/users/:id/movies` agrega `review` a cada película.
- `WROTE_REVIEW` se registra solo al crear la reseña, con `reviewId = review._id`; al borrar
  la reseña se borra su evento. Al borrar el usuario se borran sus reseñas.
- Tipo `Review` en `packages/contracts`.
- Frontend: textarea en el widget de `movie-detail`, lista de reseñas de la película, texto de
  la reseña en el dashboard, y el evento `WROTE_REVIEW` del timeline enlaza a la película.

## Fuera de alcance

- Varias reseñas por usuario y película, likes o comentarios sobre reseñas.
- Moderación.

## Restricciones

- La reseña es independiente de `user_movies`: quitar favorito o rating no borra la reseña.
- Respetar el contrato `ApiResponse` / `ErrorResponse` (`ok`, `asyncHandler`, `HttpError`).
- Idioma de artefactos: inglés en código y UI, siguiendo lo existente.

## Criterios de aceptación

1. Un usuario logueado puede crear, editar y borrar su reseña desde la página de la película.
2. La página de la película lista las reseñas de todos los usuarios.
3. Crear una reseña agrega un `WROTE_REVIEW` al timeline; editarla no agrega otro.
4. El dashboard muestra el texto de la reseña de cada película.
5. `npm run build` compila `api` y `web`.

## TDD

- Modo: **off** (fuente: sin configuración de TDD en el proyecto ni pedido explícito).
- Checks: `npm run build` (tsc en `api`, `ng build` en `web`).

## Entrega

- Forecast: ~550 líneas autoradas (backend ~250, frontend ~300). Supera el presupuesto de
  ~400 líneas; estrategia `ask-on-risk` y la estrategia de cadena queda pendiente de definir.
- Slices previstos: T1 (backend) y T2 (frontend).

## Tareas

- [x] **T1 — Backend + contracts + docs.** Ruta: delegada (writer, más de 2 archivos no
  triviales: `api/src/routes/*`, `packages/contracts`, `CONTEXT.md`).
  - Evidencia: `npm run build --workspace api` OK (writer y spot check del parent);
    `npm run build --workspace web` OK (solo el warning previo de budget CSS de
    `movie-detail.css`). Endpoints no probados contra Postgres/Mongo en vivo.
  - Contratos: `Review`, `MovieReview`, `UserMovieReview`, `ReviewRequest`
    (`packages/contracts/src/reviews.d.ts`); `UserMovie.review?: UserMovieReview | null`.
- [ ] **T2 — Frontend.** Ruta: delegada (writer, más de 2 archivos no triviales: servicios,
  `movie-detail`, `dashboard`).

## Progreso / Evidencia

- Rama: `feat/text-reviews`.

## Próximo paso

- T1.
