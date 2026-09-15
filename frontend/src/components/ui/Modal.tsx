'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus modal panel only when opening
  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open]);

  // Handle Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg border border-black bg-white"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="border border-transparent px-2 py-1 text-sm text-muted hover:border-line hover:text-black"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
