import type { UserRole } from '~/types';

export interface JwtPayload {
  userId?: string;
  phone?: string;
  role?: UserRole;
  exp?: number;
}

/** Cookie / JWT lifetime for storefront sessions (1 month). */
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;

    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join('')
    );

    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  const payload = parseJwtPayload(token);
  if (!payload?.exp) return false;
  // Small skew so we clear just before the API starts rejecting.
  return payload.exp * 1000 <= Date.now() + 5_000;
}

export function getRoleFromToken(token: string | null | undefined): JwtPayload['role'] | null {
  if (!token) return null;
  return parseJwtPayload(token)?.role ?? null;
}
