'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { AnalyticsData } from '@/lib/types';

/* ── colour palette ───────────────────────────────────────────────── */
const PALETTE = {
  indigo: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
};

const PIE_COLORS: Record<string, string> = {
  APPLIED: PALETTE.sky,
  SANCTIONED: PALETTE.indigo,
  DISBURSED: PALETTE.emerald,
  CLOSED: PALETTE.violet,
  REJECTED: PALETTE.rose,
};

const STAGE_COLORS: Record<string, string> = {
  REGISTERED: '#94a3b8',
  DETAILS_SUBMITTED: PALETTE.sky,
  DOCUMENT_UPLOADED: PALETTE.indigo,
  BRE_REJECTED: PALETTE.rose,
  CONVERTED: PALETTE.emerald,
};

/* ── helper to shorten "2025-03" → "Mar" ─────────────────────────── */
function shortMonth(ym: string): string {
  const [year, month] = ym.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleString('en-IN', { month: 'short' });
}

function inrK(value: number): string {
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value}`;
}

/* ── chart card wrapper ───────────────────────────────────────────── */
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <p className="mb-4 text-sm font-semibold text-black">{title}</p>
      {children}
    </div>
  );
}

/* ── custom tooltip ───────────────────────────────────────────────── */
interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}
function CustomTooltip({
  active,
  payload,
  label,
  currency = false,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  currency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 shadow-lg text-xs">
      {label && <p className="mb-1 font-medium text-black">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          {p.name}:{' '}
          <span className="font-semibold">
            {currency ? inrK(p.value) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════════════ */
export function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  const regData = data.registrationsOverTime.map((d) => ({
    ...d,
    label: shortMonth(d.month),
  }));

  const actData = data.monthlyLoanActivity.map((d) => ({
    ...d,
    label: shortMonth(d.month),
  }));

  const pieData = data.loanStatusBreakdown.map((d) => ({
    name: d.status,
    value: d.count,
    fill: PIE_COLORS[d.status] ?? '#9ca3af',
  }));

  const funnelData = [...data.leadStages].reverse(); // show biggest at top

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* 1 ── Registrations over time */}
      <ChartCard title="New Borrower Registrations (12 months)">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={regData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PALETTE.indigo} stopOpacity={0.25} />
                <stop offset="95%" stopColor={PALETTE.indigo} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              name="Registrations"
              stroke={PALETTE.indigo}
              strokeWidth={2}
              fill="url(#regGrad)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2 ── Monthly loan sanctions & disbursements (₹) */}
      <ChartCard title="Monthly Sanctions & Disbursements (₹)">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={actData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={inrK}
            />
            <Tooltip content={<CustomTooltip currency />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="sanctioned" name="Sanctioned" fill={PALETTE.indigo} radius={[3, 3, 0, 0]} />
            <Bar dataKey="disbursed" name="Disbursed" fill={PALETTE.emerald} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3 ── Loan status donut */}
      <ChartCard title="Loan Status Distribution">
        {pieData.length === 0 ? (
          <p className="py-16 text-center text-xs text-muted">No loans yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="42%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [value, name]}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value) =>
                  value
                    .split('_')
                    .map((w: string) => w.charAt(0) + w.slice(1).toLowerCase())
                    .join(' ')
                }
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 4 ── Lead funnel horizontal bars */}
      <ChartCard title="Lead Funnel Breakdown">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            layout="vertical"
            data={funnelData}
            margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="stage"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={120}
              tickFormatter={(v: string) =>
                v
                  .split('_')
                  .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
                  .join(' ')
              }
            />
            <Tooltip />
            <Bar dataKey="count" name="Users" radius={[0, 4, 4, 0]}>
              {funnelData.map((entry, index) => (
                <Cell key={index} fill={STAGE_COLORS[entry.stage] ?? '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
