export type ChangelogSection = 'added' | 'changed' | 'fixed';

export interface ChangelogRelease {
  id: string;
  title: string;
  date: string;
  sections: Partial<Record<ChangelogSection, readonly string[]>>;
}

export const CHANGELOG_RELEASES = [{
  id: '2026-07-23-tracker-accuracy',
  title: 'Tracker Accuracy & Combat Powers',
  date: '23 July 2026',
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
    ],
  },
}] as const satisfies readonly ChangelogRelease[];

export const LATEST_CHANGELOG: ChangelogRelease = CHANGELOG_RELEASES[0];
