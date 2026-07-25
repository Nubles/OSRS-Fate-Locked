import React from 'react';
import { TrendingUp, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, CartesianGrid, AreaChart, Area,
} from 'recharts';

/**
 * The Stats modal's "Visualizations" tab — extracted into its own lazily-loaded
 * chunk so recharts (~300 KB) is fetched only when a player actually opens the
 * charts tab, not every time they glance at Stats. StatsModal renders this via
 * React.lazy behind a Suspense fallback.
 */

interface Props {
  /** The stats aggregate from StatsModal (luckTrend, buckets, luckScore). */
  stats: any;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-white/20 p-2 rounded shadow-xl text-xs font-mono">
        <p className="text-gray-400 mb-1">Roll #{label}</p>
        <p className="text-white font-bold">Luck: <span className={payload[0].value >= 0 ? 'text-green-400' : 'text-red-400'}>{payload[0].value.toFixed(2)}</span></p>
      </div>
    );
  }
  return null;
};

const BarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-white/20 p-2 rounded shadow-xl text-xs font-mono">
        <p className="text-gray-400 mb-1">Range {label}</p>
        <p className="text-white font-bold">Count: {payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export const StatsChartsView: React.FC<Props> = ({ stats }) => (
  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
    {/* LUCK TIMELINE */}
    <div className="bg-[#1f1f1f] border border-white/5 rounded-lg p-4 h-[300px] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
          <TrendingUp size={14} /> Cumulative Luck History
        </h3>
        <span className="text-[10px] text-gray-600 bg-black/40 px-2 py-1 rounded">Delta vs Expected</span>
      </div>
      <div className="flex-1 w-full min-h-0">
        {stats.luckTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.luckTrend}>
              <defs>
                <linearGradient id="colorLuck" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={stats.luckScore >= 0 ? '#4ade80' : '#f87171'} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={stats.luckScore >= 0 ? '#4ade80' : '#f87171'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="index" stroke="#666" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis stroke="#666" tick={{ fontSize: 10 }} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="luck"
                stroke={stats.luckScore >= 0 ? '#4ade80' : '#f87171'}
                fillOpacity={1}
                fill="url(#colorLuck)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-600 text-xs italic">Not enough data...</div>
        )}
      </div>
    </div>

    {/* ROLL DISTRIBUTION */}
    <div className="bg-[#1f1f1f] border border-white/5 rounded-lg p-4 h-[300px] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
          <BarChart3 size={14} /> Roll Distribution (0.1–100.0)
        </h3>
        <div className="flex gap-2 text-[9px] font-bold uppercase">
          <span className="text-green-500 flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Good</span>
          <span className="text-red-500 flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span> Bad</span>
        </div>
      </div>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.buckets}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis dataKey="range" stroke="#666" tick={{ fontSize: 9 }} interval={1} angle={-45} textAnchor="end" height={50} />
            <YAxis stroke="#666" tick={{ fontSize: 10 }} tickLine={false} allowDecimals={false} />
            <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {stats.buckets.map((entry: any, index: number) => (
                <Cell key={entry.range} fill={index < 5 ? '#4ade80' : index > 14 ? '#f87171' : '#fbbf24'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

export default StatsChartsView;
