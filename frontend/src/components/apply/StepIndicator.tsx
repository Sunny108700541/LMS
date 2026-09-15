const STEPS = ['Your details', 'Salary slip', 'Amount and tenure'] as const;

/** The application really is a sequence, so numbering it carries information. */
export function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 border-b border-line pb-4 text-sm">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const state = step === current ? 'current' : step < current ? 'done' : 'todo';
        return (
          <li
            key={label}
            aria-current={state === 'current' ? 'step' : undefined}
            className={
              state === 'todo' ? 'text-neutral-400' : state === 'done' ? 'text-muted' : 'text-black'
            }
          >
            <span className="tabular-nums">{step}.</span> {label}
            {state === 'done' ? <span className="ml-1">✓</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
