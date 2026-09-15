import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Fail fast: the process must not boot with a half-configured environment.
 * Every value the app depends on is validated and typed here, once.
 */
const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    API_PREFIX: z.string().startsWith('/').default('/api/v1'),

    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('7d'),
    COOKIE_DOMAIN: z.string().default('localhost'),
    COOKIE_SECURE: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),

    PII_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'PII_ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),

    ADMIN_BOOTSTRAP_TOKEN: z.string().min(16, 'ADMIN_BOOTSTRAP_TOKEN must be at least 16 chars'),

    SUPABASE_URL: z.string().url(),
    SUPABASE_SECRET_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
    SUPABASE_JWKS_URL: z.string().optional(),
    SUPABASE_BUCKET: z.string().min(1).default('loan-documents'),
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),

    CORS_ORIGIN: z.string().default('http://localhost:3000'),
  })
  .superRefine((data, ctx) => {
    const secretKey = data.SUPABASE_SECRET_KEY || data.SUPABASE_SERVICE_ROLE_KEY;
    if (!secretKey || secretKey.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_SECRET_KEY'],
        message: 'SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is required.',
      });
    } else if (secretKey.startsWith('sb_publishable_')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_SECRET_KEY'],
        message:
          'SUPABASE_SECRET_KEY must be your server-side Secret Key (SUPABASE_SECRET_KEY / sb_secret_... / service_role JWT), not a publishable key (sb_publishable_...).',
      });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const secretKey = (parsed.data.SUPABASE_SECRET_KEY || parsed.data.SUPABASE_SERVICE_ROLE_KEY)!;

export const env = {
  ...parsed.data,
  SUPABASE_SECRET_KEY: secretKey,
  SUPABASE_SERVICE_ROLE_KEY: secretKey,
  isProd: parsed.data.NODE_ENV === 'production',
  corsOrigins: parsed.data.CORS_ORIGIN.split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean),
};

export type Env = typeof env;
