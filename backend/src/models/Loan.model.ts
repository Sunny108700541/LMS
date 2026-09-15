import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { LoanStatus } from '../types/enums';

export interface ILoan {
  _id: Types.ObjectId;
  loanRef: string;
  userId: Types.ObjectId;
  applicationId: Types.ObjectId;

  principal: number;
  tenureDays: number;
  interestRate: number; // annual %, fixed at 12
  simpleInterest: number;
  totalRepayment: number;

  amountPaid: number;
  outstanding: number;

  status: LoanStatus;

  appliedAt: Date;
  sanctionedBy: Types.ObjectId | null;
  sanctionedAt: Date | null;
  rejectedBy: Types.ObjectId | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  disbursedBy: Types.ObjectId | null;
  disbursedAt: Date | null;
  closedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export type LoanDocument = HydratedDocument<ILoan>;

const loanSchema = new Schema<ILoan>(
  {
    loanRef: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },

    principal: { type: Number, required: true, min: 50_000, max: 500_000 },
    tenureDays: { type: Number, required: true, min: 30, max: 365 },
    interestRate: { type: Number, required: true, default: 12 },
    simpleInterest: { type: Number, required: true },
    totalRepayment: { type: Number, required: true },

    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    outstanding: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: Object.values(LoanStatus),
      default: LoanStatus.APPLIED,
      index: true,
    },

    appliedAt: { type: Date, default: () => new Date() },
    sanctionedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sanctionedAt: { type: Date, default: null },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null, maxlength: 500 },
    disbursedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    disbursedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Queue reads are always "status + newest first".
loanSchema.index({ status: 1, createdAt: -1 });

export const Loan: Model<ILoan> = model<ILoan>('Loan', loanSchema);
