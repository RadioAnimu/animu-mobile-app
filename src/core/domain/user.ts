import type { AuthUser } from "animu-api";

export type {
  AuthProfile,
  AuthSession,
  AuthUser,
  LinkedProvider,
  ProviderInfo,
} from "animu-api";

/**
 * App session user: the Auth API v5 user plus the session token and a derived
 * display fallback.
 */
export interface User extends AuthUser {
  /** `PHPSESSID` used by authenticated endpoints (music requests). */
  sessionToken: string;
  /** Provider @handle, kept as a non-null display fallback. */
  nickname: string;
}

/** Display name precedence: provider handle, then account username. */
export const getUserName = (user: Pick<AuthUser, "handle" | "username">): string =>
  user.handle || user.username;
