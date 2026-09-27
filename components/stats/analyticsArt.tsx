import React from 'react';
import { WikiIcon } from '../WikiIcon';

/**
 * OSRS Wiki artwork for Fate Analytics: every card, verdict and moment shows a
 * game icon. Ordinary controls (close, sort, copy, chevrons) stay in Lucide, as
 * data/wikiUiIcons.ts has it for the rest of the app. The keys match the
 * header's: a Crystal key for Standard keys, an Enhanced crystal key for
 * Omni-Keys, and the Shield slot for pity keys, as the timelapse shows them.
 * Each file was checked on the wiki on 27 September 2026.
 */
export const ANALYTICS_ART = {
  rolls: 'Mystery_box.png',
  wins: 'Casket.png',
  omniKeys: 'Enhanced_crystal_key.png',
  pityKeys: 'Shield_slot.png',
  standardKeys: 'Crystal_key.png',
  drought: 'Waterskin(0).png',
  blessed: 'Yellow_partyhat.png',
  hot: 'Fire_rune.png',
  fair: 'Law_rune.png',
  cold: 'Ice_Barrage.png',
  forsaken: 'Slayer_icon.png',
  sampling: 'Watch.png',
  noVerdict: 'Clue_scroll.png',
  luckOverTime: 'Stats_icon.png',
  outcomes: 'Apple_pie.png',
  activities: 'Collection_log.png',
  calendar: 'Watch.png',
  moments: 'Stardust_175.png',
  luckiest: 'Lucky_impling_jar.png',
  bestActivity: 'Trailblazer_dragon_trophy.png',
} as const;

export type AnalyticsArt = keyof typeof ANALYTICS_ART;

/** A decorative game icon; the label beside it names what it stands for. */
export const AnalyticsIcon: React.FC<{ art: AnalyticsArt; size: number; className?: string }> = ({ art, size, className }) => (
  <WikiIcon file={ANALYTICS_ART[art]} alt="" size={size} className={className} />
);
