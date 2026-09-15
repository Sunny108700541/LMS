import type { LoanStatus } from '@/lib/types';
import { titleCase } from '@/lib/format';

/**
 * Status is carried by the word first; the border/tint is secondary so the
 * meaning survives without colour.
 */
const TONE: Record<string, string> = {
  APPLIED: 'border-line text-black',
  SANCTIONED: 'border-positive text-positive',
  DISBURSED: 'border-black text-black',
  CLOSED: 'border-muted text-muted',
  REJECTED: 'border-negative text-negative',
  BRE_REJECTED: 'border-negative text-negative',
  DRAFT: 'border-line text-muted',
  DOCUMENT_UPLOADED: 'border-line text-black',
  SUBMITTED: 'border-black text-black',
  REGISTERED: 'border-line text-muted',
  DETAILS_SUBMITTED: 'border-line text-black',
};

export function StatusTag({ value }: { value: LoanStatus | string }) {
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-xs whitespace-nowrap ${TONE[value] ?? 'border-line text-black'}`}
    >
      {titleCase(value)}
    </span>
  );
}
