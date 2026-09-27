import React from 'react';

export interface LegendItem {
  label: string;
  swatch: React.ReactNode;
  value?: string;
}

export const Legend: React.FC<{ items: LegendItem[]; label: string }> = ({ items, label }) => (
  <ul aria-label={label} className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-gray-400">
    {items.map(item => (
      <li key={item.label} className="flex items-center gap-1.5">
        {item.swatch}
        <span>{item.label}</span>
        {item.value && <span className="font-mono text-gray-300">{item.value}</span>}
      </li>
    ))}
  </ul>
);

export const LineSwatch: React.FC<{ color: string; dashed?: boolean }> = ({ color, dashed }) => (
  <svg aria-hidden="true" width="18" height="8" className="shrink-0">
    <line x1="1" y1="4" x2="17" y2="4" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={dashed ? '4 3' : undefined} />
  </svg>
);

export const BlockSwatch: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={style} />
);

export const DiamondSwatch: React.FC<{ color: string }> = ({ color }) => (
  <svg aria-hidden="true" width="10" height="10" className="shrink-0"><path d="M5 0L10 5L5 10L0 5Z" fill={color} /></svg>
);

/** Colour plus a texture, so no series is told apart by colour alone. */
export const OUTCOME_STYLE = {
  win: { backgroundColor: '#34d399', backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 4px, rgba(6,78,59,.45) 4px 6px)' },
  omni: { backgroundColor: '#a78bfa', backgroundImage: 'radial-gradient(rgba(76,29,149,.7) 1.2px, transparent 1.4px)', backgroundSize: '5px 5px' },
  miss: { backgroundColor: '#52525b' },
  pity: { backgroundColor: '#fbbf24', backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 4px, rgba(120,53,15,.5) 4px 6px)' },
} satisfies Record<string, React.CSSProperties>;
