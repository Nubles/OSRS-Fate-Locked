import React from 'react';

interface AnalyticsChartCardProps {
  title: string;
  subtitle: string;
  summary: string;
  empty?: string;
  children: React.ReactNode;
}

export const AnalyticsChartCard: React.FC<AnalyticsChartCardProps> = ({
  title,
  subtitle,
  summary,
  empty,
  children,
}) => (
  <article aria-label={title} className="flex min-h-[300px] flex-col rounded-lg border border-white/5 bg-[#1f1f1f] p-4">
    <header>
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300">{title}</h3>
      <p className="mt-1 text-[11px] text-gray-500">{subtitle}</p>
    </header>
    <p data-chart-summary className="mt-3 text-xs leading-5 text-gray-400">{summary}</p>
    {empty
      ? <div role="status" className="flex min-h-48 flex-1 items-center justify-center px-4 text-center text-xs italic text-gray-600">{empty}</div>
      : <div className="mt-4 min-h-52 flex-1">{children}</div>}
  </article>
);
