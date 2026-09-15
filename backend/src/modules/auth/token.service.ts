import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import type { Role } from '../../types/enums';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  email: string;
  tokenVersion: number;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion: number;
}

const ISSUER = 'lms-api';
const AUDIENCE = 'lms-client';

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    issuer: ISSUER,
    audience: AUDIENCE,
  } as SignOptions);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
    issuer: ISSUER,
    audience: AUDIENCE,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as AccessTokenPayload;
  } catch {
    throw ApiError.unauthorized('Session expired or invalid. Please sign in again.');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as RefreshTokenPayload;
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }
}

/** Converts "15m" / "7d" / "3600" into milliseconds for cookie maxAge. */
export function ttlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])?$/.exec(ttl.trim());
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * (multipliers[unit] ?? 1000);
}
