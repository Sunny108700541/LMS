import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface IPayment {
  _id: Types.ObjectId;
  loanId: Types.ObjectId;
  userId: Types.ObjectId;
  /** Unique bank reference across every payment in the system. */
  utrNumber: string;
  amount: number;
  paidAt: Date;
  note: string | null;
  recordedBy: Types.ObjectId;
  /** Snapshot of the balance after this payment — an immutable audit trail. */
  outstandingAfter: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentDocument = HydratedDocument<IPayment>;

const paymentSchema = new Schema<IPayment>(
  {
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    utrNumber: {
      type: String,
      required: true,
      unique: true, // DB-level guarantee, not just an application check
      uppercase: true,
      trim: true,
    },
    amount: { type: Number, required: true, min: 1 },
    paidAt: { type: Date, required: true },
    note: { type: String, default: null, maxlength: 300 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    outstandingAfter: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

export const Payment: Model<IPayment> = model<IPayment>('Payment', paymentSchema);
