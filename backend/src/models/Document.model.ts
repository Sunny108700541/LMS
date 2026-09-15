import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

/**
 * File bytes live in Supabase Storage (private bucket).
 * MongoDB holds only the metadata and the storage path.
 */
export interface IDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  applicationId: Types.ObjectId;
  kind: 'SALARY_SLIP';
  bucket: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type FileDocument = HydratedDocument<IDocument>;

const documentSchema = new Schema<IDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    kind: { type: String, enum: ['SALARY_SLIP'], default: 'SALARY_SLIP' },
    bucket: { type: String, required: true },
    storagePath: { type: String, required: true, unique: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    checksumSha256: { type: String, required: true },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

export const FileMeta: Model<IDocument> = model<IDocument>('Document', documentSchema);
