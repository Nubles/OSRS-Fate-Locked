export type ChangelogSection = 'added' | 'changed' | 'fixed' | 'balance';

export interface LinkedChangelogNote {
  text: string;
  link: {
    label: string;
    href: string;
  };
}

export type ChangelogNote = string | LinkedChangelogNote;

export interface ChangelogRelease {
  id: string;
  title: string;
  date: string;
  sections: Partial<Record<ChangelogSection, readonly ChangelogNote[]>>;
}

export const CHANGELOG_RELEASES = [
  {
    id: '2026-08-04-polished-chunk-info',
    title: 'Clearer Chunk Info',
    date: '2026-08-04',
    sections: {
      changed: [
        'Chunk Info now leads with a clear availability summary and keeps detailed content in readable expandable groups.',
        'Entry requirements, entrances, and banks now share one consistent Access & facilities card.',
        'Locked content stays readable and explains its requirement without striking through the full name.',
      ],
    },
  },
  {
    id: '2026-08-04-discord-community-link',
    title: 'Official Discord Community',
    date: '2026-08-04',
    sections: {
      added: [
        'The command-centre header now includes a direct link to the official Fate Locked Ironman Discord community.',
      ],
    },
  },
  {
    id: '2026-08-02-one-physical-chunk-one-unlock',
    title: 'One Chunk, One Unlock',
    date: '2026-08-02',
    sections: {
      changed: [
        "Heroes' Guild, Ice Mountain, Ranging Guild, Otto's Grotto, and the Resource Area now share their physical chunk's single area unlock.",
        'Existing saves automatically keep the canonical area and receive one regular Key for each duplicate overlap they previously purchased.',
        'Chunk data is refreshed to the reviewed 2 August Chunk Picker revision, including newly named waters around Ardeaglais, Auchrie, and Wyrmscraig.',
        'Chunk Info now shows each reviewed entrance as locked with its chunk or available.',
      ],
      fixed: [
        "Unlocking Otto's Grotto now visibly unlocks the Baxtorian Falls chunk containing it.",
        'Twenty-four boundary chunks now use the correct parent continent, fixing labels such as Falador · Misthalin and Port Sarim · Karamja.',
        'Named dungeon, cave, mine, and basement task unlocks now follow their reviewed physical entrances instead of being omitted.',
      ],
    },
  },
  {
    id: '2026-08-02-profile-metadata-integrity',
    title: 'Safer Profile Management',
    date: '2026-08-02',
    sections: {
      fixed: [
        'Damaged profile lists now recover every valid browser save they can find instead of leaving the app on a blank screen.',
        'Creating, renaming, switching, and deleting profiles in multiple tabs no longer silently loses profile-list changes.',
        'Profiles that are still open in another tab cannot be deleted until that tab switches away or closes.',
      ],
    },
  },
  {
    id: '2026-08-02-weighted-fate',
    title: 'Weighted Fate & Milestone Keys',
    date: '2026-08-02',
    sections: {
      balance: [
        'Failed rolls now award +1/+2/+3 Fate based on the activity tier.',
        'Pity Keys use the active pity threshold, and any Fate overflow carries onto the fresh bar.',
        'Skill levels 30, 40, 50, 60, 70, 80, 90, and 99 now award a guaranteed Chaos Key.',
        'The independent 2% Chaos Key chance on skill levels is unchanged and can stack with a guaranteed milestone Key.',
      ],
    },
  },

  {
    id: '2026-08-01-cross-tab-safety',
    title: 'Safer Multi-Tab Play',
    date: '2026-08-01',
    sections: {
      added: [
        'A clear warning now appears when the same profile is open in another tab, with takeover, reload, and export recovery actions.',
      ],
      fixed: [
        'Two browser tabs can no longer silently overwrite the same profile while both appear to be saving.',
      ],
    },
  },
  {
    id: '2026-08-01-save-recovery',
    title: 'Safer Browser Saves',
    date: '2026-08-01',
    sections: {
      added: [
        'A persistent recovery banner now appears if this browser cannot save your latest progress, with Retry save and Export backup actions.',
      ],
      fixed: [
        'Failed browser writes no longer crash the app or silently discard the newest in-tab progress.',
        'Closing the page now warns you while any profile still has progress waiting to be saved.',
      ],
    },
  },
  {
    id: '2026-07-28-quest-chunk-audit',
    title: 'Verified Quest & Chunk Requirements',
    date: '2026-07-28',
    sections: {
      added: [
        'Learning the Ropes and The Blood Moon Rises are now included in the official quest list.',
      ],
      changed: [
        'All 190 quests and 19 miniquests now have reviewed requirement evidence; three remaining source discrepancies are documented and conservatively gated.',
        'The reviewed Chunk Picker source is now pinned, and chunk data refreshes are generated deterministically.',
      ],
      fixed: [
        'Quest cards now show exact required chunks once and separate incomplete Chunk Picker evidence under Known steps.',
        "Witch's Potion now checks Rimmington.",
        "Murder Mystery now checks Sinclair Mansion and Seers' Village.",
        'Quest completion remains strict: unmet machine requirements cannot be bypassed by manual confirmation, and rejected and repeated completions grant no extra rolls.',
      ],
    },
  },
  {
    id: '2026-07-28-runelite-guide-native-theme',
    title: 'RuneLite Guide Visual Refresh',
    date: '2026-07-28',
    sections: {
      changed: [
        'The RuneLite Plugin Guide now uses the same compact panels, navigation, typography, and amber control styling as the Fate Locked companion while preserving every chapter, setting, and authentic screenshot.',
      ],
    },
  },
  {
    id: '2026-07-28-runelite-guide',
    title: 'RuneLite Plugin Guide',
    date: '2026-07-28',
    sections: {
      added: [
        'A complete RuneLite Plugin Guide now covers installation, connection, every panel section and setting, overlays, privacy, recommended configurations, and troubleshooting with annotated screenshots from the live plugin.',
      ],
      fixed: [
        'Annotated RuneLite handbook screenshots now load correctly when the companion is hosted on GitHub Pages.',
      ],
    },
  },
  {
    id: '2026-07-28-tirannwn-area-accuracy',
    title: 'Tirannwn Area Accuracy',
    date: '2026-07-28',
    sections: {
      changed: [
        'Elf Camp is now treated as Iorwerth Camp everywhere and no longer appears in new area rolls.',
      ],
      fixed: [
        'Existing saves with both camp names now keep one unlock and receive one regular Key refund.',
        'Tirannwn completion totals and RuneLite exports now use the canonical Iorwerth Camp unlock.',
      ],
    },
  },
  {
    id: '2026-07-28-runelite-companion-update',
    title: 'RuneLite Companion Update',
    date: '2026-07-28',
    sections: {
      added: [
        'Connect the companion to RuneLite with one guided, copyable pairing command.',
      ],
      changed: [
        {
          text: 'The RuneLite Plugin Hub update has been approved and is now live. View the merged',
          link: {
            label: 'Plugin Hub PR #14395',
            href: 'https://github.com/runelite/plugin-hub/pull/14395',
          },
        },
        'RuneLite reads your app-authored run rules while detected gameplay events remain local to RuneLite.',
        'The complete RuneLite experience now lives in one panel with collapsible sections.',
      ],
      fixed: [
        'RuneLite controls no longer appear clipped or overlap adjacent colour settings.',
        'Run balances are now labelled Keys, Omni Keys, and Chaos Keys.',
      ],
    },
  },
  {
    id: '2026-07-26-vanilla-key-safety-valve',
    title: 'Vanilla Key Safety Valve',
    date: '2026-07-26',
    sections: {
      balance: [
        'Bosses now provide a finite, diminishing Vanilla key reserve.',
        'Brutus joins Farm Keys as a one-key early safety valve.',
        'The first three clue-earned Standard Keys share 25%, 15%, and 10% minimum chances.',
        'Standard and Chaos boss/minigame rolls now respect hard location access.',
        'The Codex now correctly explains that Vanilla area unlocks can be scattered.',
      ],
    },
  },
  {
    id: '2026-07-25-exact-skill-key-odds',
    title: 'Exact Skill Key Odds',
    date: '2026-07-25',
    sections: {
      added: [
        'Skill cards now show the exact Key chance for the next level.',
      ],
      changed: [
        'Skill level-up Key odds now use exact Level ÷ 5 values, including decimal chances such as 8.2% at level 41.',
        'Roll feedback, history, timelapses, and statistics now display Key rolls and chances to one decimal place.',
      ],
      fixed: [
        'Mode-modified rolls now show their base and effective chances clearly, and decimal roll details persist correctly after reloading.',
      ],
    },
  },
  {
    id: '2026-07-23-tracker-accuracy',
    title: 'Tracker Accuracy & Combat Powers',
    date: '2026-07-23',
    sections: {
      added: ["A What's New dialog now summarizes each player-facing release."],
      changed: [
        'Arcana is now called Combat Powers, covering spellbooks, prayers, and special combat systems such as Dwarf Cannon.',
        'Achievement Diaries now contain all 492 current tasks from the reviewed official source.',
        'Combat Achievements now contain all 646 current tasks, including the Maggot King achievements.',
        'Combat Achievement rewards now use cumulative points across every task tier.',
      ],
      fixed: [
        'Dragon Claws now list Chambers of Xeric instead of Tormented Demons.',
        'A Porcine of Interest now checks both Draynor Village and South Falador Farm.',
        'Recent quest skill, combat, prerequisite, and access requirements were refreshed.',
        'Quest and diary recommendations now respect unlocked skill-method caps as well as recorded levels.',
        'Exports now capture the run currently visible on screen.',
        'Malformed or oversized imports and backups are now rejected without overwriting progress.',
        'File imports, sync-code imports, and backup restores now report their real outcomes.',
        'Deleting a profile now also clears its local backups and profile-specific settings.',
      ],
    },
  },
] as const satisfies readonly ChangelogRelease[];

export const LATEST_CHANGELOG: ChangelogRelease = CHANGELOG_RELEASES[0];
