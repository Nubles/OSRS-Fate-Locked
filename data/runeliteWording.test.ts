import { describe, expect, it } from 'vitest';
import {
  RUNELITE_AVOIDED_WORDS,
  RUNELITE_SETTING_SECTIONS,
  RUNELITE_SETTINGS,
  RUNELITE_SIDEBAR_CARDS,
  RUNELITE_TERMS,
  RUNELITE_WORDING,
} from './runeliteWording';

/**
 * Whether the text says this word or phrase whole, case and all: not inside a longer word, so
 * "Guardian" is in "Travel Guardian" but not in "Guardians of the Rift". The plugin's
 * WordingContractTest matches the same way.
 */
export function says(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`).test(text);
}

describe('the RuneLite wording contract', () => {
  it('lists each setting once, grouped by section in the config panel\'s order', () => {
    const keys = RUNELITE_SETTINGS.map((setting) => setting.key);
    expect(new Set(keys).size).toBe(keys.length);
    const order = RUNELITE_SETTINGS.map((setting) => RUNELITE_SETTING_SECTIONS.indexOf(setting.section));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect([...new Set(RUNELITE_SETTINGS.map((setting) => setting.section))]).toEqual([...RUNELITE_SETTING_SECTIONS]);
  });

  it('gives each setting a default the config panel can show', () => {
    for (const setting of RUNELITE_SETTINGS) {
      if (setting.options) {
        expect(new Set(setting.options).size, setting.key).toBe(setting.options.length);
        expect(setting.options, setting.key).toContain(setting.defaultValue);
      } else {
        expect(['On', 'Off', 'Not set'].includes(setting.defaultValue)
          || /^#[0-9a-f]{8}$/.test(setting.defaultValue), `${setting.key}: ${setting.defaultValue}`).toBe(true);
      }
    }
  });

  it('never avoids a word it uses itself', () => {
    const used = [
      ...Object.values(RUNELITE_TERMS),
      ...RUNELITE_SETTING_SECTIONS,
      ...RUNELITE_SETTINGS.flatMap((setting) => [setting.name, ...(setting.options ?? [])]),
      ...RUNELITE_SIDEBAR_CARDS,
    ];
    for (const { word, use } of RUNELITE_AVOIDED_WORDS) {
      expect(says(use, word), `${word} is avoided for ${use}`).toBe(false);
      for (const text of used) {
        expect(says(text, word), `"${text}" says the avoided "${word}"`).toBe(false);
      }
    }
  });

  it('matches whole words, case and all', () => {
    expect(says('Travel Guardian', 'Guardian')).toBe(true);
    expect(says('Guardians of the Rift', 'Guardian')).toBe(false);
    expect(says('Omni-Keys', 'Omni-keys')).toBe(false);
    expect(says('spend your fate points.', 'fate points')).toBe(true);
    expect(says('the Current chunk card', 'Current chunk')).toBe(true);
  });

  it('holds everything the plugin checks', () => {
    expect(Object.keys(RUNELITE_WORDING)).toEqual(['version', 'terms', 'avoidedWords', 'settingSections', 'settings',
      'sidebarCards']);
    expect(RUNELITE_WORDING.settings).toHaveLength(21);
  });
});
