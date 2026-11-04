import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  model,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../services/auth';
import { apiErrorMessage } from '../../services/api-response';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './auth-modal.html',
  styleUrl: './auth-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'close()',
  },
})
export class AuthModal {
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // The modal lives in the navbar, which stays mounted across pages: close it on navigation.
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe(event => {
        if (event instanceof NavigationEnd) this.close();
      });
  }

  readonly isOpen = model(false);
  readonly mode = signal<'login' | 'register'>('login');

  readonly loginIdentifier = signal('');
  readonly loginPassword = signal('');

  readonly regUsername = signal('');
  readonly regName = signal('');
  readonly regEmail = signal('');
  readonly regPassword = signal('');

  readonly errorMessage = signal<string | null>(null);
  readonly isLoading = signal(false);

  setMode(mode: 'login' | 'register'): void {
    this.mode.set(mode);
    this.errorMessage.set(null);
  }

  close(): void {
    this.isOpen.set(false);
    // The component outlives the dialog: without this it reopens on the last tab, passwords included
    this.mode.set('login');
    this.loginIdentifier.set('');
    this.loginPassword.set('');
    this.regUsername.set('');
    this.regName.set('');
    this.regEmail.set('');
    this.regPassword.set('');
    this.errorMessage.set(null);
    this.isLoading.set(false);
  }

  submitLogin(): void {
    const identifier = this.loginIdentifier().trim();
    const password = this.loginPassword();

    if (!identifier || !password) {
      this.errorMessage.set('Completá el usuario/email y la contraseña');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService
      .login({ user_email: identifier, password })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.close();
        },
        error: err => {
          this.isLoading.set(false);
          this.errorMessage.set(this.authErrorMessage(err));
        },
      });
  }

  submitRegister(): void {
    const user_username = this.regUsername().trim();
    const user_name = this.regName().trim() || undefined;
    const user_email = this.regEmail().trim();
    const password = this.regPassword();

    if (!user_username || !user_email || !password) {
      this.errorMessage.set('Completá el nombre de usuario, email y contraseña');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService
      .register({ user_username, user_name, user_email, password })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.close();
        },
        error: err => {
          this.isLoading.set(false);
          this.errorMessage.set(this.authErrorMessage(err));
        },
      });
  }

  /** The API answers in English; the people using this form read Spanish. */
  private authErrorMessage(err: { status?: number }): string {
    if (err.status === 401) return 'Usuario o contraseña incorrectos';
    if (err.status === 409) return 'Ese nombre de usuario o correo ya está en uso';
    if (err.status === 400) return 'Revisá los datos: el correo tiene que ser válido y el usuario, de hasta 50 caracteres';
    return apiErrorMessage(err);
  }

  loginDemoUser(user_email: string): void {
    this.loginIdentifier.set(user_email);
    this.loginPassword.set('movieweb2026');
    this.submitLogin();
  }
}
