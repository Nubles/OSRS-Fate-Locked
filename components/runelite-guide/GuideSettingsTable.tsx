import React from 'react';
import type { GuideSetting } from '../../data/runeliteGuide';

interface GuideSettingsTableProps {
  readonly settings: readonly GuideSetting[];
}

/** A colour default, #aarrggbb: its colour as RGBA and as #rrggbb, and its opacity in percent. */
const colourOf = (value: string) => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(value);
  if (!match) return null;
  const [alpha, red, green, blue] = match.slice(1).map(part => parseInt(part, 16));
  return {
    rgba: `rgba(${red}, ${green}, ${blue}, ${(alpha / 255).toFixed(2)})`,
    hex: `#${match.slice(2).join('')}`,
    opacity: Math.round((alpha / 255) * 100),
  };
};

const DefaultBadge: React.FC<{ readonly value: string }> = ({ value }) => {
  const colour = colourOf(value);
  if (colour) {
    return (
      <span
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-gray-200"
        data-default-value={value}
      >
        <span
          className="h-3 w-3 rounded-sm border border-white/20"
          style={{ backgroundColor: colour.rgba }}
          aria-hidden="true"
        />
        {colour.hex} · {colour.opacity}%
      </span>
    );
  }
  const isOn = value === 'On';
  const isOff = value === 'Off';
  const tone = isOn
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
    : isOff
      ? 'border-gray-500/30 bg-gray-500/10 text-gray-300'
      : 'border-amber-400/30 bg-amber-400/10 text-amber-200';

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded border px-2 py-1 text-[11px] font-black uppercase tracking-wide ${tone}`}
      data-default-value={value}
    >
      {value}
    </span>
  );
};

export const GuideSettingsTable: React.FC<GuideSettingsTableProps> = ({ settings }) => (
  <div className="space-y-2" data-guide-settings-list>
    {settings.map(setting => (
      <article
        key={setting.key}
        className="rounded-lg border border-osrs-border bg-[#252525]"
        data-guide-setting-card={setting.key}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-3 py-2.5">
          <div>
            <h4 className="text-sm font-bold text-gray-100">{setting.label}</h4>
            {setting.options && (
              <p className="mt-1 text-xs text-gray-400" data-guide-setting-options>
                {setting.options.join(' · ')}
              </p>
            )}
          </div>
          <DefaultBadge value={setting.defaultValue} />
        </header>
        <dl
          className="grid gap-3 px-3 py-3 text-sm sm:grid-cols-2 xl:grid-cols-3"
          data-guide-setting-fields
        >
          <div>
            <dt className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              What it does
            </dt>
            <dd className="mt-1 leading-relaxed text-gray-300">{setting.purpose}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              What you see
            </dt>
            <dd className="mt-1 leading-relaxed text-gray-300">{setting.visibleResult}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              Change it when
            </dt>
            <dd className="mt-1 leading-relaxed text-gray-400">{setting.changeWhen}</dd>
          </div>
        </dl>
      </article>
    ))}
  </div>
);
