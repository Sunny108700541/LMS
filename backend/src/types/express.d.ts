import type { Role } from './enums';

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      role: Role;
      email: string;
      tokenVersion: number;
    }
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

export {};
