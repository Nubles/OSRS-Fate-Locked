import React from 'react';
import { ChevronDown } from 'lucide-react';
import { RUNELITE_SETTING_SECTIONS } from '../../data/runeliteWording';
import { RUNELITE_GUIDE_SETTINGS, type GuideSetting } from '../../data/runeliteGuide';

const COLOUR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** A colour default as RuneLite writes it, #aarrggbb: its colour and how see-through it is. */
export const describeColour = (value: string): { css: string; label: string } | null => {
  const match = COLOUR.exec(value);
  if (!match) return null;
  const [alpha, red, green, blue] = match.slice(1).map(part => parseInt(part, 16));
  const opacity = Math.round((alpha / 255) * 100);
  return {
    css: `rgba(${red}, ${green}, ${blue}, ${Math.round((alpha / 255) * 100) / 100})`,
    label: `#${match[2]}${match[3]}${match[4]} · ${opacity}%`.toLowerCase(),
  };
};

const DefaultValue: React.FC<{ readonly value: string }> = ({ value }) => {
  const colour = describeColour(value);
  return (
    <span
      data-default-value={value}
      className="inline-flex shrink-0 items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-bold text-gray-200"
    >
      {colour && (
        <span
          className="h-3 w-3 rounded-sm border border-white/20"
          style={{ backgroundColor: colour.css }}
          aria-hidden="true"
        />
      )}
      {colour ? colour.label : value}
    </span>
  );
};

const SettingRow: React.FC<{ readonly setting: GuideSetting }> = ({ setting }) => (
  <details data-guide-setting={setting.key} className="group border-t border-white/10 first:border-t-0">
    <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 [&::-webkit-details-marker]:hidden">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-gray-100">{setting.label}</span>
          <DefaultValue value={setting.defaultValue} />
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-gray-400">{setting.purpose}</span>
      </span>
      <ChevronDown
        className="mt-1 h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
        aria-hidden="true"
      />
    </summary>
    <div className="space-y-3 px-4 pb-4 text-sm leading-relaxed">
      {setting.options && (
        <p className="text-gray-400" data-guide-setting-options>
          <span className="font-semibold text-gray-300">Choices: </span>
          {setting.options.join(' · ')}
        </p>
      )}
      <p className="text-gray-400">
        <span className="font-semibold text-gray-300">What you see: </span>
        {setting.visibleResult}
      </p>
      <p className="text-gray-400">
        <span className="font-semibold text-gray-300">Change it when: </span>
        {setting.changeWhen}
      </p>
    </div>
  </details>
);

/**
 * Every setting, by the section RuneLite shows it in. Each row gives the name, the default and
 * what it's for; opening it says what you'll see and when to change it.
 */
export const GuideSettings: React.FC = () => (
  <div className="space-y-5">
    {RUNELITE_SETTING_SECTIONS.map(section => {
      const settings = RUNELITE_GUIDE_SETTINGS.filter(setting => setting.section === section);
      return (
        <section
          key={section}
          data-guide-settings-section={section}
          aria-label={`${section} settings`}
          className="overflow-hidden rounded-lg border border-white/10 bg-[#1b1b1b]"
        >
          <h4 className="flex items-center justify-between border-b border-white/10 bg-[#202020] px-4 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-amber-300">
            {section}
            <span className="text-xs font-bold normal-case tracking-normal text-gray-400">
              {settings.length === 1 ? '1 setting' : `${settings.length} settings`}
            </span>
          </h4>
          <div>
            {settings.map(setting => <SettingRow key={setting.key} setting={setting} />)}
          </div>
        </section>
      );
    })}
  </div>
);
