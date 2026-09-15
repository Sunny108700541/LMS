import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

/**
 * Memory storage: the file goes straight to Supabase, so it never touches the
 * app server's disk. Multer's own limit rejects oversized uploads before the
 * whole body is buffered.
 */
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      cb(ApiError.badRequest('Only PDF, JPG and PNG files are accepted'));
      return;
    }
    cb(null, true);
  },
});

export function uploadSingle(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    multerUpload.single(field)(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return next(ApiError.tooLarge('File must be 5 MB or smaller'));
        return next(ApiError.badRequest(`Upload failed: ${err.message}`));
      }
      if (err) return next(err);
      next();
    });
  };
}

/**
 * A declared MIME type is caller-controlled. Verify the magic bytes so a
 * renamed executable cannot enter the bucket as "image/png".
 */
export function sniffMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  const hex = buffer.subarray(0, 4).toString('hex').toUpperCase();
  if (hex.startsWith('25504446')) return 'application/pdf'; // %PDF
  if (hex.startsWith('FFD8FF')) return 'image/jpeg';
  if (hex.startsWith('89504E47')) return 'image/png';
  return null;
}
