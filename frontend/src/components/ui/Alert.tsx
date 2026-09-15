import type { ReactNode } from 'react';

type Tone = 'error' | 'success' | 'info';

const TONE: Record<Tone, string> = {
  error: 'border-negative text-negative',
  success: 'border-positive text-positive',
  info: 'border-line text-black',
};

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`border px-4 py-3 text-sm ${TONE[tone]}`}>
      {title ? <p className="mb-1 font-medium">{title}</p> : null}
      <div className="space-y-1">{children}</div>
    </div>
  );
}
