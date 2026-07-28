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
    id: '2026-07-28-runelite-plugin-guide',
    title: 'RuneLite Plugin Guide',
    date: '2026-07-28',
    sections: {
      added: [
        'A complete RuneLite Plugin Guide now covers installation, connection, every panel section and setting, overlays, privacy, recommended configurations, and troubleshooting with annotated screenshots from the live plugin.',
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
