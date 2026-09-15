import rateLimit from 'express-rate-limit';

const message = {
  success: false,
  error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please try again shortly.' },
};

/** Broad protection for the whole API surface. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});

/** Tight limit on credential endpoints to blunt password spraying. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});

/** Uploads are expensive; cap them per window. */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});
