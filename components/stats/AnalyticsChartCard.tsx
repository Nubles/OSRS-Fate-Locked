import React from 'react';

interface AnalyticsChartCardProps {
  title: string;
  subtitle: string;
  /** One plain sentence: what the chart says about this selection. */
  summary: string;
  empty?: string;
  icon?: React.ReactNode;
  legend?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export const AnalyticsChartCard: React.FC<AnalyticsChartCardProps> = ({
  title,
  subtitle,
  summary,
  empty,
  icon,
  legend,
  action,
  children,
}) => (
  <article aria-label={title} className="flex h-full min-h-[280px] flex-col rounded-xl border border-white/[0.06] bg-[#1a1a1a] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
    <header className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span aria-hidden="true" className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-gray-300">{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-100">{title}</h3>
          <p className="mt-0.5 text-[11px] leading-4 text-gray-500">{subtitle}</p>
        </div>
      </div>
      {action}
    </header>
    <p data-chart-summary className="mt-3 text-[13px] leading-5 text-gray-300">{summary}</p>
    {legend && !empty && <div className="mt-3">{legend}</div>}
    {empty
      ? <div role="status" className="flex min-h-40 flex-1 items-center justify-center px-4 text-center text-xs italic text-gray-600">{empty}</div>
      : <div className="mt-3 flex min-h-0 flex-1 flex-col">{children}</div>}
  </article>
);
