import type { CookieOptions, Response } from 'express';
import { env } from '../../config/env';

export const ACCESS_COOKIE = 'lms_access_token';
export const REFRESH_COOKIE = 'lms_refresh_token';

/**
 * Tokens live in httpOnly cookies rather than localStorage: script on the page
 * cannot read them, which removes the main XSS token-theft path. sameSite=lax
 * plus a CORS allow-list covers CSRF for these endpoints, and the refresh
 * cookie is scoped to the refresh path only.
 */
function baseOptions(): CookieOptions {
  const isSecure = env.isProd || env.COOKIE_SECURE;
  const options: CookieOptions = {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    path: '/',
  };

  if (env.COOKIE_DOMAIN && env.COOKIE_DOMAIN !== 'localhost') {
    options.domain = env.COOKIE_DOMAIN;
  }

  return options;
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  ttl: { accessMs: number; refreshMs: number },
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...baseOptions(), maxAge: ttl.accessMs });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    path: `${env.API_PREFIX}/auth`,
    maxAge: ttl.refreshMs,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseOptions());
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: `${env.API_PREFIX}/auth` });
}
