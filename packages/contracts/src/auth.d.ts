/** A user as returned by the API (never includes the password hash). */
export interface AuthUser {
  user_id: number;
  user_username: string;
  user_name: string | null;
  user_email: string;
}

/** POST /api/auth/login and /api/auth/register */
export interface AuthResponse {
  user: AuthUser;
  /** JWT to send as `Authorization: Bearer <token>` */
  token: string;
}

/** Body of POST /api/auth/login */
export interface LoginRequest {
  user_email: string;
  password: string;
}

/** Body of POST /api/auth/register */
export interface RegisterRequest extends LoginRequest {
  user_username: string;
  user_name?: string;
}
