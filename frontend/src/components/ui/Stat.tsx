export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-line px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl tabular-nums">{value}</p>
    </div>
  );
}
