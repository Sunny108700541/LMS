import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { getSupabase } from '../../config/supabase';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';

export interface StoredObject {
  bucket: string;
  storagePath: string;
}

/** Strips directory components and anything that is not a safe filename character. */
function safeExtension(originalName: string): string {
  const ext = path.extname(path.basename(originalName)).toLowerCase();
  return /^\.(pdf|jpg|jpeg|png)$/.test(ext) ? ext : '';
}

/**
 * Object keys are server-generated and namespaced by user, so a caller can
 * never choose a path or guess someone else's. The bucket stays private.
 */
export function buildStoragePath(userId: string, originalName: string): string {
  return `salary-slips/${userId}/${Date.now()}-${randomUUID()}${safeExtension(originalName)}`;
}

export async function uploadObject(
  storagePath: string,
  buffer: Buffer,
  contentType: string,
): Promise<StoredObject> {
  const { error } = await getSupabase()
    .storage.from(env.SUPABASE_BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: false });

  if (error) {
    logger.error('supabase upload failed', { storagePath, message: error.message });
    throw new ApiError(502, 'STORAGE_UPLOAD_FAILED', 'Could not store the file. Please try again.');
  }

  return { bucket: env.SUPABASE_BUCKET, storagePath };
}

/** Short-lived signed URL. Issued only after the caller's access has been checked. */
export async function createSignedUrl(storagePath: string): Promise<{ url: string; expiresIn: number }> {
  const { data, error } = await getSupabase()
    .storage.from(env.SUPABASE_BUCKET)
    .createSignedUrl(storagePath, env.SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    logger.error('supabase signed url failed', { storagePath, message: error?.message });
    throw new ApiError(502, 'STORAGE_URL_FAILED', 'Could not open the document. Please try again.');
  }

  return { url: data.signedUrl, expiresIn: env.SIGNED_URL_TTL_SECONDS };
}

/** Best-effort cleanup used when the metadata write fails after an upload. */
export async function removeObject(storagePath: string): Promise<void> {
  const { error } = await getSupabase().storage.from(env.SUPABASE_BUCKET).remove([storagePath]);
  if (error) logger.warn('supabase orphan cleanup failed', { storagePath, message: error.message });
}

export const storageService = { buildStoragePath, uploadObject, createSignedUrl, removeObject };
