import type { Request } from 'express';
import { Types } from 'mongoose';
import { Application, type IApplication } from '../../models/Application.model';
import { FileMeta } from '../../models/Document.model';
import { ApiError } from '../../utils/ApiError';
import { env } from '../../config/env';
import { ApplicationStatus, AuditAction, Role } from '../../types/enums';
import { evaluateBre } from '../../rules/bre.rules';
import { blindIndex, encrypt, decrypt, sha256 } from '../../utils/crypto';
import { maskPan } from '../../utils/mask';
import { auditService } from '../audit/audit.service';
import { storageService } from '../documents/storage.service';
import { sniffMimeType, ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from '../../middleware/upload';
import type { PersonalDetailsInput } from './application.validation';

const ACTIVE_STATUSES = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.DOCUMENT_UPLOADED,
  ApplicationStatus.SUBMITTED,
];

export interface ApplicationView {
  id: string;
  fullName: string;
  panMasked: string;
  dateOfBirth: Date;
  monthlySalary: number;
  employmentMode: string;
  status: ApplicationStatus;
  bre: IApplication['bre'];
  hasDocument: boolean;
  documentId: string | null;
  submittedAt: Date | null;
  createdAt: Date;
}

/** Default projection: PAN is only ever returned masked. */
export function toApplicationView(app: IApplication): ApplicationView {
  return {
    id: app._id.toString(),
    fullName: app.fullName,
    panMasked: app.panMasked,
    dateOfBirth: app.dateOfBirth,
    monthlySalary: app.monthlySalary,
    employmentMode: app.employmentMode,
    status: app.status,
    bre: app.bre,
    hasDocument: Boolean(app.documentId),
    documentId: app.documentId ? app.documentId.toString() : null,
    submittedAt: app.submittedAt,
    createdAt: app.createdAt,
  };
}

/**
 * Step 2 — capture personal details and run the BRE.
 *
 * A failing evaluation is still written down (status BRE_REJECTED) rather than
 * discarded: rejections are a regulated record and the Sales module needs to
 * see them. It does not occupy the "one active application" slot, so the
 * borrower can correct their details and retry.
 */
export async function submitPersonalDetails(
  userId: string,
  input: PersonalDetailsInput,
  req: Request,
): Promise<{ application: ApplicationView; breFailures: { rule: string; message: string }[] }> {
  const existing = await Application.findOne({ userId, status: { $in: ACTIVE_STATUSES } });
  if (existing) {
    throw ApiError.conflict('You already have an application in progress');
  }

  const bre = evaluateBre({
    pan: input.pan,
    dateOfBirth: input.dateOfBirth,
    monthlySalary: input.monthlySalary,
    employmentMode: input.employmentMode,
  });

  const panHash = blindIndex(input.pan);

  // One PAN cannot run two live applications, even across accounts.
  if (bre.passed) {
    const panInUse = await Application.findOne({
      panHash,
      status: { $in: ACTIVE_STATUSES },
      userId: { $ne: new Types.ObjectId(userId) },
    }).select('_id');
    if (panInUse) throw ApiError.conflict('An application already exists for this PAN');
  }

  const application = await Application.create({
    userId,
    fullName: input.fullName,
    panEncrypted: encrypt(input.pan),
    panHash,
    panMasked: maskPan(input.pan),
    dateOfBirth: input.dateOfBirth,
    monthlySalary: input.monthlySalary,
    employmentMode: input.employmentMode,
    status: bre.passed ? ApplicationStatus.DRAFT : ApplicationStatus.BRE_REJECTED,
    bre: {
      passed: bre.passed,
      failures: bre.failures,
      evaluatedAt: new Date(),
      snapshot: {
        age: bre.age,
        monthlySalary: input.monthlySalary,
        employmentMode: input.employmentMode,
      },
    },
  });

  await auditService.record({
    action: bre.passed ? AuditAction.APPLICATION_CREATED : AuditAction.APPLICATION_BRE_REJECTED,
    entityType: 'Application',
    entityId: application._id.toString(),
    metadata: { failures: bre.failures.map((f) => f.rule) },
    req,
  });

  if (!bre.passed) {
    throw ApiError.unprocessable(
      'You are not eligible for a loan based on the details provided',
      bre.failures,
    );
  }

  return {
    application: toApplicationView(application.toObject() as IApplication),
    breFailures: bre.failures,
  };
}

/** Step 3 — salary slip upload. Bytes to Supabase, metadata to MongoDB. */
export async function uploadSalarySlip(
  userId: string,
  applicationId: string,
  file: Express.Multer.File,
  req: Request,
): Promise<{ documentId: string; originalName: string; sizeBytes: number }> {
  const application = await Application.findOne({ _id: applicationId, userId });
  if (!application) throw ApiError.notFound('Application not found');
  if (application.status === ApplicationStatus.BRE_REJECTED) {
    throw ApiError.forbidden('This application was rejected at the eligibility stage');
  }
  if (application.status === ApplicationStatus.SUBMITTED) {
    throw ApiError.conflict('This application has already been submitted');
  }
  if (file.size > MAX_FILE_BYTES) throw ApiError.tooLarge('File must be 5 MB or smaller');

  // Trust the bytes, not the declared Content-Type.
  const sniffed = sniffMimeType(file.buffer);
  if (!sniffed || !ALLOWED_MIME_TYPES.includes(sniffed as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw ApiError.badRequest('File contents must be a valid PDF, JPG or PNG');
  }

  const storagePath = storageService.buildStoragePath(userId, file.originalname);
  await storageService.uploadObject(storagePath, file.buffer, sniffed);

  let documentId: string;
  try {
    const doc = await FileMeta.create({
      userId,
      applicationId: application._id,
      kind: 'SALARY_SLIP',
      bucket: env.SUPABASE_BUCKET,
      storagePath,
      // Original filename is stored for display only; it is never used as a path.
      originalName: file.originalname.slice(0, 200),
      mimeType: sniffed,
      sizeBytes: file.size,
      checksumSha256: sha256(file.buffer.toString('base64')),
    });
    documentId = doc._id.toString();

    // Replace any earlier slip on this application, then point the application at the new one.
    if (application.documentId) {
      const previous = await FileMeta.findById(application.documentId);
      if (previous) {
        await storageService.removeObject(previous.storagePath);
        await previous.deleteOne();
      }
    }

    application.documentId = doc._id;
    application.status = ApplicationStatus.DOCUMENT_UPLOADED;
    await application.save();
  } catch (err) {
    await storageService.removeObject(storagePath); // no orphaned objects in the bucket
    throw err;
  }

  await auditService.record({
    action: AuditAction.DOCUMENT_UPLOADED,
    entityType: 'Document',
    entityId: documentId,
    metadata: { applicationId, sizeBytes: file.size, mimeType: sniffed },
    req,
  });

  return { documentId, originalName: file.originalname, sizeBytes: file.size };
}

/**
 * Signed URL for a stored slip. The borrower who owns it, the admin, and the
 * executives who need it for a credit decision can open it; nobody else.
 */
export async function getDocumentUrl(
  documentId: string,
  actor: { id: string; role: Role },
  req: Request,
): Promise<{ url: string; expiresIn: number; originalName: string; mimeType: string }> {
  const doc = await FileMeta.findById(documentId);
  if (!doc) throw ApiError.notFound('Document not found');

  const isOwner = doc.userId.toString() === actor.id;
  const reviewerRoles: Role[] = [Role.ADMIN, Role.SANCTION, Role.DISBURSEMENT, Role.COLLECTION];
  const isReviewer = reviewerRoles.includes(actor.role);
  if (!isOwner && !isReviewer) throw ApiError.forbidden('You cannot view this document');

  const signed = await storageService.createSignedUrl(doc.storagePath);

  await auditService.record({
    action: AuditAction.DOCUMENT_VIEWED,
    entityType: 'Document',
    entityId: documentId,
    req,
  });

  return { ...signed, originalName: doc.originalName, mimeType: doc.mimeType };
}

export async function getMyApplication(userId: string): Promise<ApplicationView | null> {
  const app = await Application.findOne({ userId, status: { $in: ACTIVE_STATUSES } }).sort({
    createdAt: -1,
  });
  return app ? toApplicationView(app.toObject() as IApplication) : null;
}

export async function getApplicationHistory(userId: string): Promise<ApplicationView[]> {
  const apps = await Application.find({ userId }).sort({ createdAt: -1 }).limit(20);
  return apps.map((a) => toApplicationView(a.toObject() as IApplication));
}

/**
 * Full PAN, for a credit decision only. Reading it is a privileged act, so it
 * is restricted to reviewing roles and written to the audit log by the caller.
 */
export async function revealPan(applicationId: string): Promise<string> {
  const app = await Application.findById(applicationId).select('+panEncrypted');
  if (!app) throw ApiError.notFound('Application not found');
  return decrypt(app.panEncrypted);
}

export const applicationService = {
  submitPersonalDetails,
  uploadSalarySlip,
  getDocumentUrl,
  getMyApplication,
  getApplicationHistory,
  revealPan,
  toApplicationView,
};
