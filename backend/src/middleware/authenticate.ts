import type { NextFunction, Request, Response } from 'express';
import { User } from '../models/User.model';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../modules/auth/token.service';
import { ACCESS_COOKIE } from '../modules/auth/cookie';

/**
 * Reads the access token from the httpOnly cookie (browser) or the
 * Authorization header (API clients / Postman), then confirms the account is
 * still active and the token generation is current.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = (req.cookies?.[ACCESS_COOKIE] as string | undefined) ?? bearer;

    if (!token) throw ApiError.unauthorized('Authentication required');

    const payload = verifyAccessToken(token);

    // Re-read the user: a role change or deactivation must take effect immediately.
    const user = await User.findById(payload.sub).select('_id email role isActive tokenVersion');
    if (!user || !user.isActive) throw ApiError.unauthorized('Account is inactive or missing');
    if (user.tokenVersion !== payload.tokenVersion) {
      throw ApiError.unauthorized('Session expired, please sign in again');
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
    next();
  } catch (err) {
    next(err);
  }
}
