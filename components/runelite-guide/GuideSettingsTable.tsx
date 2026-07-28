import React from 'react';
import type { GuideSetting } from '../../data/runeliteGuide';

interface GuideSettingsTableProps {
  readonly settings: readonly GuideSetting[];
}

const DefaultBadge: React.FC<{ readonly value: string }> = ({ value }) => {
  const isOn = value === 'On';
  const isOff = value === 'Off';
  const tone = isOn
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
    : isOff
      ? 'border-gray-500/30 bg-gray-500/10 text-gray-300'
      : 'border-amber-400/30 bg-amber-400/10 text-amber-200';

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${tone}`}
      data-default-value={value}
    >
      {value}
    </span>
  );
};

export const GuideSettingsTable: React.FC<GuideSettingsTableProps> = ({ settings }) => (
  <div>
    <div className="hidden overflow-x-auto rounded-2xl border border-white/10 lg:block">
      <table className="w-full min-w-[68rem] border-collapse text-left text-sm">
        <thead className="bg-white/[0.06] text-xs uppercase tracking-wide text-gray-400">
          <tr>
            <th className="px-4 py-3" scope="col">Setting</th>
            <th className="px-4 py-3" scope="col">Default</th>
            <th className="px-4 py-3" scope="col">What it does</th>
            <th className="px-4 py-3" scope="col">What you see</th>
            <th className="px-4 py-3" scope="col">Change it when</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/8">
          {settings.map(setting => (
            <tr key={setting.key} className="align-top transition-colors hover:bg-white/[0.025]">
              <th className="px-4 py-4 font-bold text-white" scope="row">
                {setting.label}
              </th>
              <td className="px-4 py-4">
                <DefaultBadge value={setting.defaultValue} />
              </td>
              <td className="px-4 py-4 leading-relaxed text-gray-300">{setting.purpose}</td>
              <td className="px-4 py-4 leading-relaxed text-gray-300">{setting.visibleResult}</td>
              <td className="px-4 py-4 leading-relaxed text-gray-400">{setting.changeWhen}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="grid gap-4 lg:hidden">
      {settings.map(setting => (
        <article
          key={setting.key}
          className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
          data-guide-setting-card={setting.key}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h4 className="font-bold text-white">{setting.label}</h4>
            <DefaultBadge value={setting.defaultValue} />
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[11px] font-black uppercase tracking-wide text-gray-500">What it does</dt>
              <dd className="mt-1 leading-relaxed text-gray-300">{setting.purpose}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-black uppercase tracking-wide text-gray-500">What you see</dt>
              <dd className="mt-1 leading-relaxed text-gray-300">{setting.visibleResult}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-black uppercase tracking-wide text-gray-500">Change it when</dt>
              <dd className="mt-1 leading-relaxed text-gray-400">{setting.changeWhen}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  </div>
);
