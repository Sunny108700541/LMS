import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { Role } from '../types/enums';

export interface IUser {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  /** Bumped on logout/deactivation so previously issued refresh tokens stop working. */
  tokenVersion: number;
  refreshTokenHash: string | null;
  lastLoginAt: Date | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true },
    // select:false — a password hash must never ride along on an ordinary read.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(Role), required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    tokenVersion: { type: Number, default: 0 },
    refreshTokenHash: { type: String, default: null, select: false },
    lastLoginAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).passwordHash;
        delete (ret as Record<string, unknown>).refreshTokenHash;
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  },
);

/**
 * Partial unique index: at most one ADMIN document can ever exist.
 * Enforced by the database, not only by application code.
 */
userSchema.index(
  { role: 1 },
  { unique: true, partialFilterExpression: { role: Role.ADMIN }, name: 'uniq_single_admin' },
);

export const User: Model<IUser> = model<IUser>('User', userSchema);
