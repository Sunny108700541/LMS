import { z } from 'zod';
import { Role } from '../../types/enums';

/**
 * Password policy: length does more for resistance than symbol classes, but a
 * mixed-class minimum blocks the most common weak choices outright.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/\d/, 'Password must include a number');

export const emailSchema = z.string().email('Enter a valid email address').max(160).toLowerCase();

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
    .optional(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const bootstrapAdminSchema = z.object({
  bootstrapToken: z.string().min(16, 'Bootstrap token is required'),
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
    .optional(),
  password: passwordSchema,
  // Admin can mint executives and borrowers — never another admin.
  role: z.enum([Role.SALES, Role.SANCTION, Role.DISBURSEMENT, Role.COLLECTION, Role.BORROWER]),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type BootstrapAdminInput = z.infer<typeof bootstrapAdminSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
