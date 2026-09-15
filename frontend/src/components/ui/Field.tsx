'use client';

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm text-black">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  'w-full border border-line bg-white px-3 py-2 text-sm text-black placeholder:text-neutral-400 focus:border-black disabled:bg-subtle disabled:text-muted';

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${className}`} />;
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputClass} ${className}`}>
      {children}
    </select>
  );
}
