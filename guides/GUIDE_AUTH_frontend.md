# LLM Guide — Auth Frontend (Angular)

> Guía compartida. Aplica a los integrantes C y D.
> Pegá junto con `CONTEXT.md` cuando implementes cualquier feature que requiera login.

---

## Qué hay implementado en el backend

| Endpoint | Acción |
|----------|--------|
| `POST /api/auth/register` | Crea usuario, devuelve `{ user, token }` |
| `POST /api/auth/login` | Login, devuelve `{ user, token }` |
| `GET /api/auth/me` | Devuelve el usuario actual (requiere token) |

El token es un **JWT** que dura 7 días. Se guarda en `localStorage`.

---

## Archivos a crear

```
web/src/app/core/
├── models/auth.model.ts
├── services/auth.service.ts
└── guards/auth.guard.ts

web/src/app/features/
├── login/
│   └── login.component.ts
└── register/
    └── register.component.ts
```

---

## Modelos

```typescript
// web/src/app/core/models/auth.model.ts
export interface AuthUser {
  user_id: number;
  user_username: string;
  user_name: string | null;
  user_email: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface LoginPayload {
  user_email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  user_username: string;
  user_name?: string;
}
```

---

## `AuthService`

Gestiona el token en `localStorage` y expone el usuario actual como un Signal.

```typescript
// web/src/app/core/services/auth.service.ts
import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { AuthResponse, AuthUser, LoginPayload, RegisterPayload } from '../models/auth.model';

const TOKEN_KEY = 'mw_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);
  private base   = 'http://localhost:3500/api/auth';

  // Signal — toda la app se suscribe a esto
  readonly currentUser = signal<AuthUser | null>(this.loadUser());

  private loadUser(): AuthUser | null {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    try {
      // Decode payload (middle part of JWT) — no verification, just read
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Check expiry
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }
      return payload as AuthUser; // fetch /me on init for full data if needed
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }

  login(payload: LoginPayload) {
    return this.http.post<AuthResponse>(`${this.base}/login`, payload).pipe(
      tap(({ user, token }) => {
        localStorage.setItem(TOKEN_KEY, token);
        this.currentUser.set(user);
      })
    );
  }

  register(payload: RegisterPayload) {
    return this.http.post<AuthResponse>(`${this.base}/register`, payload).pipe(
      tap(({ user, token }) => {
        localStorage.setItem(TOKEN_KEY, token);
        this.currentUser.set(user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  // Call this once on app init to refresh user data from /me
  refreshMe() {
    return this.http.get<AuthUser>(`${this.base}/me`).pipe(
      tap(user => this.currentUser.set(user))
    );
  }
}
```

---

## HTTP Interceptor — adjunta el token automáticamente

En lugar de agregar el header a mano en cada service, usá un interceptor funcional (Angular 22):

```typescript
// web/src/app/core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();

  if (!token) return next(req);

  const cloned = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });

  return next(cloned);
};
```

Registrarlo en `app.config.ts`:

```typescript
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

---

## Auth Guard

Protege rutas que requieren login (perfil, agregar favoritos):

```typescript
// web/src/app/core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  return router.createUrlTree(['/login']);
};
```

Usarlo en `app.routes.ts`:

```typescript
{
  path: 'users/:id',
  canActivate: [authGuard],
  loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
},
```

---

## Login Component

```typescript
// web/src/app/features/login/login.component.ts
@Component({ standalone: true, imports: [ReactiveFormsModule, RouterLink] })
export class LoginComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  form = new FormGroup({
    user_email: new FormControl('', [Validators.required, Validators.email]),
    password:   new FormControl('', Validators.required),
  });

  error = signal<string | null>(null);

  onSubmit(): void {
    if (this.form.invalid) return;

    this.auth.login(this.form.value as LoginPayload).subscribe({
      next: () => this.router.navigate(['/']),
      error: (e) => this.error.set(e.error?.error ?? 'Login failed'),
    });
  }
}
```

---

## Cómo mostrar el botón de "Like" solo si está logueado

```html
<!-- En movie-detail o search-results -->
@if (auth.isLoggedIn()) {
  <button (click)="addToFavorites()">❤️ Add to favorites</button>
} @else {
  <a routerLink="/login">Login to save movies</a>
}
```

En el componente:
```typescript
readonly auth = inject(AuthService);

addToFavorites(): void {
  const userId = this.auth.currentUser()!.user_id;
  this.userService.addMovie(userId, { movie_id: this.movie().movie_id })
    .subscribe(() => { /* mostrar feedback */ });
}
```

El interceptor adjunta el token automáticamente — no necesitás hacer nada más.

---

## Rutas de auth para agregar en `app.routes.ts`

```typescript
{ path: 'login',    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent) },
{ path: 'register', loadComponent: () => import('./features/register/register.component').then(m => m.RegisterComponent) },
```
