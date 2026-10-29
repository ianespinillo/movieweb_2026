import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  model,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
})
export class AuthModal {
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

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
          this.errorMessage.set(apiErrorMessage(err));
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
          this.errorMessage.set(apiErrorMessage(err));
        },
      });
  }

  loginDemoUser(user_email: string): void {
    this.loginIdentifier.set(user_email);
    this.loginPassword.set('movieweb2026');
    this.submitLogin();
  }
}
