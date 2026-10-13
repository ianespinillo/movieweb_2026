# LLM Guide — Integrante D: Frontend Personas + Usuarios + Timeline

> Pegá este archivo junto con `CONTEXT.md` al inicio de tu sesión con el LLM.

---

## Tu rol

Implementás las páginas de persona, el CRUD de usuarios en el frontend, el perfil con timeline de actividad, y también el backend de MongoDB (actividad).

**Archivos que vas a crear:**
```
api/src/routes/activity.ts          ← backend MongoDB (TypeScript)
web/src/app/core/models/user.model.ts
web/src/app/core/models/activity.model.ts
web/src/app/core/services/user.service.ts
web/src/app/core/services/activity.service.ts
web/src/app/core/services/person.service.ts  (método getById)
web/src/app/features/person-detail/
web/src/app/features/users/
web/src/app/features/profile/
```

**Archivos a modificar:**
- `web/src/app/app.routes.ts` — agregar tus rutas
- `api/src/server.ts` — descomentar tus routers cuando estén listos

---

## Setup previo (npm + Turborepo)

```bash
# En la raíz del proyecto (requiere PostgreSQL y MongoDB nativos corriendo)
npm run dev
# Listo! Levanta la API (puerto 3500) y el frontend (4200).
```

---

## PARTE 1 — Backend: actividad con MongoDB (TypeScript)

### Schema Mongoose y Ruta

```typescript
// api/src/routes/activity.ts
import { Request, Response, Router } from 'express';
import mongoose, { Document, Schema } from 'mongoose';
import { authenticate } from '../middleware/authenticate.js';
import { AuthRequest } from '../types/index.js';

export interface IActivityDetails {
  movieId?: number;
  movieTitle?: string;
  rating?: number;
  reviewId?: string;
}

export interface IActivity extends Document {
  userId: string;
  type: 'RATED_MOVIE' | 'ADDED_TO_FAVORITES' | 'WROTE_REVIEW';
  timestamp: Date;
  details: IActivityDetails;
}

const activitySchema = new Schema<IActivity>({
  userId:    { type: String, required: true, index: true },
  type:      { type: String, enum: ['RATED_MOVIE', 'ADDED_TO_FAVORITES', 'WROTE_REVIEW'], required: true },
  timestamp: { type: Date, default: Date.now },
  details: {
    movieId:    Number,
    movieTitle: String,
    rating:     Number,
    reviewId:   String,
  },
});

export const Activity = mongoose.model<IActivity>('Activity', activitySchema);

const router = Router();

// GET /api/activity/:userId — timeline público del usuario
router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const events = await Activity.find({ userId: req.params.userId })
      .sort({ timestamp: -1 })
      .limit(50);
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/activity — registrar evento (protegido por auth)
router.post('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  const currentUserId = String((req as AuthRequest).user.sub);
  const { userId, type, details } = req.body;

  if (userId !== currentUserId) {
    res.status(403).json({ error: 'Cannot record activity for another user' });
    return;
  }

  try {
    const event = await Activity.create({ userId, type, details });
    res.status(201).json(event);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
```

### Activar en `server.ts`

```typescript
import activityRouter from './routes/activity.js';
app.use('/api/activity', activityRouter);
```

---

## PARTE 2 — Frontend

### Modelos TypeScript

```typescript
// web/src/app/core/models/user.model.ts
export interface User {
  user_id: number;
  user_username: string;
  user_name: string;
  user_email: string;
}

export interface UserMovie {
  movie_id: number;
  title: string;
  release_date: string;
  rating: number | null;
  review: string | null;
  added_at: string;
}
```

```typescript
// web/src/app/core/models/activity.model.ts
export type ActivityType = 'RATED_MOVIE' | 'ADDED_TO_FAVORITES' | 'WROTE_REVIEW';

export interface ActivityEvent {
  _id: string;
  userId: string;
  type: ActivityType;
  timestamp: string;
  details: {
    movieId: number;
    movieTitle: string;
    rating?: number;
    reviewId?: string;
  };
}
```

---

### Servicios

```typescript
// web/src/app/core/services/user.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, UserMovie } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private base = 'http://localhost:3500/api/users';

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.base);
  }

  create(data: Partial<User>): Observable<User> {
    return this.http.post<User>(this.base, data);
  }

  update(id: number, data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.base}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getMovies(userId: number): Observable<UserMovie[]> {
    return this.http.get<UserMovie[]>(`${this.base}/${userId}/movies`);
  }

  addMovie(userId: number, body: { movie_id: number; rating?: number; review?: string }): Observable<UserMovie> {
    return this.http.post<UserMovie>(`${this.base}/${userId}/movies`, body);
  }
}
```

```typescript
// web/src/app/core/services/activity.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ActivityEvent, ActivityType } from '../models/activity.model';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private http = inject(HttpClient);
  private base = 'http://localhost:3500/api/activity';

  getTimeline(userId: string): Observable<ActivityEvent[]> {
    return this.http.get<ActivityEvent[]>(`${this.base}/${userId}`);
  }

  record(event: { userId: string; type: ActivityType; details: object }): Observable<ActivityEvent> {
    return this.http.post<ActivityEvent>(this.base, event);
  }
}
```

**Nota:** el método `getById` de `PersonService` lo tenés que agregar a `web/src/app/core/services/person.service.ts`:
```typescript
getById(id: number | string): Observable<PersonDetail> {
  return this.http.get<PersonDetail>(`${this.base}/${id}`);
}
```
Y el modelo `PersonDetail` incluye `person_name`, `as_actor: Movie[]`, `as_director: Movie[]`.

---

### Rutas — agregar a `app.routes.ts`

```typescript
{
  path: 'people/:id',
  loadComponent: () =>
    import('./features/person-detail/person-detail.component').then(m => m.PersonDetailComponent),
},
{
  path: 'users',
  loadComponent: () =>
    import('./features/users/users.component').then(m => m.UsersComponent),
},
{
  path: 'users/:id',
  loadComponent: () =>
    import('./features/profile/profile.component').then(m => m.ProfileComponent),
},
```

---

### Página: Person Detail

Carga datos locales (filmografía de PG) + perfil de TMDB (foto, bio, cumpleaños) en paralelo.

```typescript
import { combineLatest } from 'rxjs';
// Importar también TmdbService

@Component({ standalone: true, imports: [RouterLink], ... })
export class PersonDetailComponent implements OnInit {
  private route     = inject(ActivatedRoute);
  private personSvc = inject(PersonService);
  readonly tmdb     = inject(TmdbService);

  person     = signal<any>(null);
  profileUrl = signal<string>('/assets/no-avatar.svg');
  bio        = signal<string>('');
  birthday   = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    combineLatest([
      this.personSvc.getById(id),
      this.tmdb.getPersonMeta(id),
    ]).subscribe(([person, meta]) => {
      this.person.set(person);
      this.profileUrl.set(this.tmdb.profileUrl(meta.profile_path, 'w185'));
      this.bio.set(meta.biography);
      this.birthday.set(meta.birthday);
    });
  }
}
```

**Template layout sugerido:**
- Foto de perfil (izquierda) + nombre, cumpleaños, bio (derecha)
- Dos grillas: "Como actor" / "Como director" — cards de películas con poster (llamar a `tmdb.getMovieMeta()` lazy o mostrar sin imagen hasta que cargue)


---

### Página: Users (CRUD)

- Tabla con columnas: Username, Name, Email, Acciones (editar / borrar / ver perfil)
- Botón "Nuevo usuario" abre un formulario reactivo (modal o inline)
- Al borrar: confirmar antes con un `confirm()` o un dialog de spartan/ui
- Los nombres de usuario y email deben tener validación en el form (`Validators.required`, `Validators.email`)

```typescript
// Form de creación/edición
this.form = new FormGroup({
  user_username: new FormControl('', Validators.required),
  user_name:     new FormControl(''),
  user_email:    new FormControl('', [Validators.required, Validators.email]),
});
```

---

### Página: Profile + Timeline

```typescript
@Component({ standalone: true, imports: [RouterLink, DatePipe], ... })
export class ProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private userService = inject(UserService);
  private activityService = inject(ActivityService);

  user = signal<User | null>(null);
  timeline = signal<ActivityEvent[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.userService.getAll().subscribe(users => {
      this.user.set(users.find(u => u.user_id === +id) ?? null);
    });
    this.activityService.getTimeline(id).subscribe(events => this.timeline.set(events));
  }
}
```

**Template del timeline** — renderizar cada evento según su tipo:

| `type` | Texto a mostrar |
|--------|-----------------|
| `RATED_MOVIE` | ⭐ Calificó **[movieTitle]** con `rating` estrellas |
| `ADDED_TO_FAVORITES` | ❤️ Agregó **[movieTitle]** a favoritos |
| `WROTE_REVIEW` | ✍️ Escribió una reseña de **[movieTitle]** |

Mostrá la fecha con el pipe `date:'short'` de Angular.

**Registrar actividad:** cuando el usuario califica o agrega favoritos desde la página de perfil, llamar a `activityService.record(...)` además de `userService.addMovie(...)`.
