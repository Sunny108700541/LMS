import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { User, type IUser } from '../../models/User.model';
import { ApiError } from '../../utils/ApiError';
import { Role, AuditAction } from '../../types/enums';
import { env } from '../../config/env';
import { sha256, safeEqual } from '../../utils/crypto';
import { auditService } from '../audit/audit.service';
import {
  signAccessToken,
  signRefreshToken,
  ttlToMs,
  verifyRefreshToken,
} from './token.service';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './cookie';
import type { BootstrapAdminInput, CreateUserInput, LoginInput, RegisterInput } from './auth.validation';

const BCRYPT_ROUNDS = 12;

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export function toPublicUser(user: IUser): PublicUser {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    ...(user.phone ? { phone: user.phone } : {}),
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Issues both tokens, persists the refresh hash, and sets the cookies. */
async function issueSession(user: IUser, res: Response): Promise<PublicUser> {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
    tokenVersion: user.tokenVersion,
  });
  const refreshToken = signRefreshToken({
    sub: user._id.toString(),
    tokenVersion: user.tokenVersion,
  });

  // Only the hash is stored: a database leak does not yield usable sessions.
  await User.updateOne(
    { _id: user._id },
    { $set: { refreshTokenHash: sha256(refreshToken), lastLoginAt: new Date() } },
  );

  setAuthCookies(
    res,
    { accessToken, refreshToken },
    { accessMs: ttlToMs(env.JWT_ACCESS_TTL), refreshMs: ttlToMs(env.JWT_REFRESH_TTL) },
  );

  return toPublicUser(user);
}

/** Public sign-up. Always a BORROWER — privileged roles are created by the admin. */
export async function register(input: RegisterInput, req: Request, res: Response): Promise<PublicUser> {
  const existing = await User.findOne({ email: input.email }).select('_id');
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({
    fullName: input.fullName,
    email: input.email,
    ...(input.phone ? { phone: input.phone } : {}),
    passwordHash: await hashPassword(input.password),
    role: Role.BORROWER,
  });

  await auditService.record({
    action: AuditAction.USER_REGISTERED,
    entityType: 'User',
    entityId: user._id.toString(),
    actorId: user._id.toString(),
    actorRole: Role.BORROWER,
    req,
  });

  return issueSession(user.toObject() as IUser, res);
}

export async function login(input: LoginInput, req: Request, res: Response): Promise<PublicUser> {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');

  // Same error text and roughly the same work either way — no account enumeration.
  if (!user) {
    await bcrypt.compare(input.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    throw ApiError.unauthorized('Incorrect email or password');
  }

  const matches = await bcrypt.compare(input.password, user.passwordHash);
  if (!matches) throw ApiError.unauthorized('Incorrect email or password');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated. Contact your admin.');

  await auditService.record({
    action: AuditAction.USER_LOGGED_IN,
    entityType: 'User',
    entityId: user._id.toString(),
    actorId: user._id.toString(),
    actorRole: user.role,
    req,
  });

  return issueSession(user.toObject() as IUser, res);
}

/** Rotates the refresh token on every use, so a replayed token is detectable and useless. */
export async function refresh(req: Request, res: Response): Promise<PublicUser> {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) throw ApiError.unauthorized('No active session');

  const payload = verifyRefreshToken(token);
  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || !user.isActive) throw ApiError.unauthorized('Account is inactive or missing');
  if (user.tokenVersion !== payload.tokenVersion) throw ApiError.unauthorized('Session revoked');
  if (!user.refreshTokenHash || !safeEqual(user.refreshTokenHash, sha256(token))) {
    // Presented token is valid but not the current one — treat as compromise.
    await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 }, $set: { refreshTokenHash: null } });
    clearAuthCookies(res);
    throw ApiError.unauthorized('Session revoked. Please sign in again.');
  }

  return issueSession(user.toObject() as IUser, res);
}

export async function logout(req: Request, res: Response): Promise<void> {
  if (req.user) {
    // Invalidate every issued token for this account, not just this browser's cookie.
    await User.updateOne(
      { _id: req.user.id },
      { $inc: { tokenVersion: 1 }, $set: { refreshTokenHash: null } },
    );
    await auditService.record({
      action: AuditAction.USER_LOGGED_OUT,
      entityType: 'User',
      entityId: req.user.id,
      req,
    });
  }
  clearAuthCookies(res);
}

/**
 * One-time admin creation. Guarded by a token from the environment and by a
 * partial unique index on role — a second admin cannot be created even if the
 * token leaks. Nothing is seeded automatically.
 */
export async function bootstrapAdmin(input: BootstrapAdminInput, req: Request): Promise<PublicUser> {
  if (!safeEqual(input.bootstrapToken, env.ADMIN_BOOTSTRAP_TOKEN)) {
    throw ApiError.forbidden('Invalid bootstrap token');
  }

  const existingAdmin = await User.findOne({ role: Role.ADMIN }).select('_id');
  if (existingAdmin) throw ApiError.conflict('An admin account already exists');

  const emailTaken = await User.findOne({ email: input.email }).select('_id');
  if (emailTaken) throw ApiError.conflict('An account with this email already exists');

  const admin = await User.create({
    fullName: input.fullName,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role: Role.ADMIN,
  });

  await auditService.record({
    action: AuditAction.ADMIN_BOOTSTRAPPED,
    entityType: 'User',
    entityId: admin._id.toString(),
    actorId: admin._id.toString(),
    actorRole: Role.ADMIN,
    req,
  });

  return toPublicUser(admin.toObject() as IUser);
}

/** Admin-driven user creation for executives and borrowers. */
export async function createUser(
  input: CreateUserInput,
  actorId: string,
  req: Request,
): Promise<PublicUser> {
  if ((input.role as Role) === Role.ADMIN) {
    throw ApiError.forbidden('The system supports exactly one admin account');
  }

  const existing = await User.findOne({ email: input.email }).select('_id');
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({
    fullName: input.fullName,
    email: input.email,
    ...(input.phone ? { phone: input.phone } : {}),
    passwordHash: await hashPassword(input.password),
    role: input.role as Role,
    createdBy: actorId,
  });

  await auditService.record({
    action: AuditAction.USER_CREATED,
    entityType: 'User',
    entityId: user._id.toString(),
    metadata: { role: user.role },
    req,
  });

  return toPublicUser(user.toObject() as IUser);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) throw ApiError.badRequest('Current password is incorrect');

  await User.updateOne(
    { _id: userId },
    {
      $set: { passwordHash: await hashPassword(newPassword), refreshTokenHash: null },
      $inc: { tokenVersion: 1 }, // sign every other session out
    },
  );
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return toPublicUser(user.toObject() as IUser);
}

export const authService = {
  register,
  login,
  refresh,
  logout,
  bootstrapAdmin,
  createUser,
  changePassword,
  getProfile,
  hashPassword,
  toPublicUser,
};
