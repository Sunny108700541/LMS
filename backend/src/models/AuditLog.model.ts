import { Schema, model, type Model, type Types } from 'mongoose';
import { AuditAction } from '../types/enums';

export interface IAuditLog {
  _id: Types.ObjectId;
  actorId: Types.ObjectId | null;
  actorRole: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorRole: { type: String, default: null },
    action: { type: String, enum: Object.values(AuditAction), required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: String, default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AuditLog: Model<IAuditLog> = model<IAuditLog>('AuditLog', auditLogSchema);
