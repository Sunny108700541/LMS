import type { Request } from 'express';
import { AuditLog } from '../../models/AuditLog.model';
import type { AuditAction } from '../../types/enums';
import { logger } from '../../utils/logger';

interface RecordInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  req?: Request;
  actorId?: string | null;
  actorRole?: string | null;
}

/**
 * Append-only trail of who did what. Deliberately non-blocking: an audit write
 * failing must never roll back a successful business action, but it must be
 * visible in the logs when it happens.
 */
export async function record(input: RecordInput): Promise<void> {
  try {
    await AuditLog.create({
      actorId: input.actorId ?? input.req?.user?.id ?? null,
      actorRole: input.actorRole ?? input.req?.user?.role ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
      ip: input.req?.ip ?? null,
    });
  } catch (err) {
    logger.error('audit write failed', { action: input.action, err });
  }
}

export const auditService = { record };
