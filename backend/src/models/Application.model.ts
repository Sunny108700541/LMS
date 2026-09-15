import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { ApplicationStatus, EmploymentMode } from '../types/enums';

export interface IBreEvaluation {
  passed: boolean;
  failures: { rule: string; message: string }[];
  evaluatedAt: Date;
  snapshot: { age: number; monthlySalary: number; employmentMode: EmploymentMode };
}

export interface IApplication {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  fullName: string;
  /** AES-256-GCM ciphertext. Never returned to a client. */
  panEncrypted: string;
  /** Deterministic HMAC of the PAN — used for uniqueness/lookup only. */
  panHash: string;
  /** Display-safe form, e.g. ABCXXXXX4F. */
  panMasked: string;
  dateOfBirth: Date;
  monthlySalary: number;
  employmentMode: EmploymentMode;
  status: ApplicationStatus;
  bre: IBreEvaluation;
  documentId: Types.ObjectId | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ApplicationDocument = HydratedDocument<IApplication>;

const applicationSchema = new Schema<IApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    panEncrypted: { type: String, required: true, select: false },
    panHash: { type: String, required: true, index: true, select: false },
    panMasked: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    monthlySalary: { type: Number, required: true, min: 0 },
    employmentMode: { type: String, enum: Object.values(EmploymentMode), required: true },
    status: {
      type: String,
      enum: Object.values(ApplicationStatus),
      default: ApplicationStatus.DRAFT,
      index: true,
    },
    bre: {
      passed: { type: Boolean, required: true },
      failures: [
        {
          _id: false,
          rule: { type: String, required: true },
          message: { type: String, required: true },
        },
      ],
      evaluatedAt: { type: Date, required: true },
      snapshot: {
        age: { type: Number, required: true },
        monthlySalary: { type: Number, required: true },
        employmentMode: { type: String, enum: Object.values(EmploymentMode), required: true },
      },
    },
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', default: null },
    submittedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).panEncrypted;
        delete (ret as Record<string, unknown>).panHash;
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  },
);

/** One live application per borrower; BRE-rejected ones are excluded so they can retry. */
applicationSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [ApplicationStatus.DRAFT, ApplicationStatus.DOCUMENT_UPLOADED, ApplicationStatus.SUBMITTED] },
    },
    name: 'uniq_active_application_per_user',
  },
);

export const Application: Model<IApplication> = model<IApplication>('Application', applicationSchema);
