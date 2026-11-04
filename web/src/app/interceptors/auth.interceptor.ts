import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token && req.url.includes('/api/')) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    return next(cloned).pipe(
      catchError((err: HttpErrorResponse) => {
        // The session expired (tokens last 7 days) or the user no longer exists: ask to log in
        // again instead of letting favorites and ratings fail with no explanation.
        // A 401 from /auth/ is just a wrong password.
        if (err.status === 401 && !req.url.includes('/auth/')) {
          authService.logout();
          authService.openModal();
        }
        return throwError(() => err);
      })
    );
  }

  return next(req);
};
