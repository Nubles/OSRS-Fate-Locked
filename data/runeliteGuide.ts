import {
  RUNELITE_SETTINGS,
  RUNELITE_SIDEBAR_CARDS,
  RUNELITE_TERMS,
  type RuneliteSettingSection,
} from './runeliteWording';

export const RUNELITE_GUIDE_CHAPTER_IDS = [
  'what-it-does',
  'install-plugin-hub',
  'connect-tracker',
  'connection-privacy',
  'sidebar',
  'here',
  'strict-mode',
  'roll-inbox',
  'run-and-keys',
  'connection-and-backup',
  'settings',
  'alerts',
  'in-game-display',
  'recommended-configurations',
  'troubleshooting',
  'glossary',
] as const;

export type GuideChapterId = typeof RUNELITE_GUIDE_CHAPTER_IDS[number];

export interface GuideCallout {
  readonly id: string;
  readonly marker: number;
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly body: string;
}

/**
 * Where an image comes from: rendered from the plugin's code at a release commit, in RuneLite's
 * own theme; captured from a real RuneLite client; or captured from the companion.
 */
export type GuideScreenshotSource = 'rendered' | 'client-capture' | 'web-capture';

export interface GuideScreenshot {
  readonly id: string;
  readonly src: string;
  readonly source: GuideScreenshotSource;
  readonly title: string;
  readonly alt: string;
  readonly callouts: readonly GuideCallout[];
}

/**
 * One of the plugin's settings. Its key, section, name, default and choices come from the
 * wording contract (runeliteWording.ts), which the plugin's build checks; the guide adds the prose.
 */
export interface GuideSetting {
  readonly key: string;
  readonly section: RuneliteSettingSection;
  readonly label: string;
  readonly defaultValue: string;
  readonly options?: readonly string[];
  readonly purpose: string;
  readonly visibleResult: string;
  readonly changeWhen: string;
}

export interface GuideChapter {
  readonly id: GuideChapterId;
  readonly number: number;
  readonly title: string;
  readonly summary: string;
  readonly paragraphs: readonly string[];
  readonly bullets: readonly string[];
  readonly screenshotIds: readonly string[];
  /** The config panel's sections whose settings this chapter lists. */
  readonly settingsSections?: readonly RuneliteSettingSection[];
}

export interface GuidePreset {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly adjustments: readonly string[];
}

export interface GuideTroubleshootingItem {
  readonly id: string;
  readonly symptom: string;
  readonly likelyCause: string;
  readonly fix: readonly string[];
}

export interface GuideGlossaryItem {
  readonly term: string;
  readonly definition: string;
}

export interface GuideExternalResource {
  readonly id: 'plugin-hub' | 'plugin-hub-review' | 'support';
  readonly label: string;
  readonly description: string;
  readonly href: string;
}

/** The sidebar's cards below the status card, top to bottom, as the plugin names them. */
export const RUNELITE_SIDEBAR_CARD_TITLES = RUNELITE_SIDEBAR_CARDS;

export const RUNELITE_GUIDE_RESOURCES: readonly GuideExternalResource[] = [
  {
    id: 'plugin-hub',
    label: 'Official Plugin Hub manifest',
    description: 'Open RuneLite’s merged manifest entry for Fate Locked Ironman.',
    href: 'https://github.com/runelite/plugin-hub/blob/master/plugins/fate-locked-ironman',
  },
  {
    id: 'plugin-hub-review',
    label: 'Merged Plugin Hub review PR #14395',
    description: 'Read the RuneLite review that approved and merged this unified Plugin Hub update.',
    href: 'https://github.com/runelite/plugin-hub/pull/14395',
  },
  {
    id: 'support',
    label: 'Report a companion issue',
    description: 'Open a private-data-safe issue form in the Fate Locked companion repository.',
    href: 'https://github.com/Nubles/OSRS-Fate-Locked/issues/new/choose',
  },
];

const callout = (
  id: string,
  marker: number,
  x: number,
  y: number,
  label: string,
  body: string,
): GuideCallout => ({ id, marker, x, y, label, body });

export const RUNELITE_GUIDE_SCREENSHOTS: readonly GuideScreenshot[] = [
  {
    id: 'plugin-hub-install',
    src: '/guides/runelite/01-plugin-hub-install.png',
    source: 'client-capture',
    title: 'Install from the live Plugin Hub',
    alt: 'RuneLite Plugin Hub showing the installed Fate Locked Ironman plugin result.',
    callouts: [
      callout(
        'plugin-result',
        1,
        0.86,
        0.36,
        'Fate Locked Ironman',
        'Use this exact Plugin Hub result. The handbook captures the live reviewed build, not a separate development plugin.',
      ),
      callout(
        'installed-control',
        2,
        0.91,
        0.73,
        'Installed state',
        'RuneLite shows Remove after installation. Leave the Plugin Hub version installed for normal play.',
      ),
    ],
  },
  {
    id: 'companion-confirmation',
    src: '/guides/runelite/03-companion-confirmation.png',
    source: 'web-capture',
    title: 'Confirm the profile in the companion',
    alt: 'Fate Locked companion confirmation for a fictional unbound Vanilla profile, with the private request hidden.',
    callouts: [
      callout(
        'profile',
        1,
        0.72,
        0.44,
        'Check the profile',
        'Make sure this is the run whose rules you want RuneLite to use before confirming.',
      ),
      callout(
        'privacy-copy',
        2,
        0.39,
        0.31,
        'Inbound-only connection',
        'The confirmation states the boundary plainly: RuneLite retrieves rules and does not upload gameplay data.',
      ),
      callout(
        'confirm',
        3,
        0.76,
        0.83,
        'Connect tracker',
        'Confirm once, return to RuneLite, and wait for the status card to say Rules up to date.',
      ),
    ],
  },  {
    id: 'sidebar-not-connected',
    src: '/guides/runelite/sidebar-not-connected.png',
    source: 'rendered',
    title: 'Connect the tracker',
    alt: 'The Fate Locked sidebar before connecting: the status card says Not connected, with Connect tracker and Use a backup instead.',
    callouts: [
      callout('status', 1, 0.51, 0.16, 'Not connected', 'The status card says whether RuneLite has your rules, and what to do next.'),
      callout('connect', 2, 0.35, 0.34, 'Connect tracker', 'Opens the companion in your browser to confirm a profile. The first time, RuneLite asks to turn on online sync.'),
      callout('backup', 3, 0.34, 0.4, 'Use a backup instead', 'Opens Connection & backup, to import your rules from the clipboard or a file without the relay.'),
    ],
  },
  {
    id: 'sidebar-waiting',
    src: '/guides/runelite/sidebar-waiting.png',
    source: 'rendered',
    title: 'Wait for confirmation',
    alt: 'The status card says Waiting for confirmation, with Open page again and Cancel.',
    callouts: [
      callout('status', 1, 0.51, 0.16, 'Waiting for confirmation', 'RuneLite checks every few seconds until you confirm the profile in the browser.'),
      callout('open-again', 2, 0.36, 0.38, 'Open page again', 'Reopens the confirmation page if you closed it.'),
      callout('cancel', 3, 0.76, 0.37, 'Cancel', 'Stops waiting. Nothing changes until a profile is confirmed.'),
    ],
  },
  {
    id: 'sidebar-out-of-date',
    src: '/guides/runelite/sidebar-out-of-date.png',
    source: 'rendered',
    title: 'Rules may be out of date',
    alt: 'The status card says Rules may be out of date, with Check now, and the Strict Mode card says Inactive until the rules refresh.',
    callouts: [
      callout('status', 1, 0.51, 0.14, 'Rules may be out of date', 'RuneLite couldn’t check for more than 15 minutes. Your rules stay in use.'),
      callout('check', 2, 0.27, 0.36, 'Check now', 'Tries the tracker again at once.'),
      callout('inactive', 3, 0.29, 0.58, 'Inactive', 'Strict Mode waits until the rules are fresh again, and says why.'),
    ],
  },
  {
    id: 'sidebar-different-character',
    src: '/guides/runelite/sidebar-different-character.png',
    source: 'rendered',
    title: 'Different character',
    alt: 'The status card says Different character, and the Here card checks nothing for another character’s rules.',
    callouts: [
      callout('status', 1, 0.51, 0.14, 'Different character', 'The rules belong to another character, so warnings and Strict Mode are off.'),
      callout('here', 2, 0.5, 0.46, 'Nothing checked', 'Here still names the place, but checks nothing for another character’s rules.'),
    ],
  },
  {
    id: 'sidebar-overview',
    src: '/guides/runelite/sidebar-overview.png',
    source: 'rendered',
    title: 'The sidebar at a glance',
    alt: 'The Fate Locked sidebar with the status card saying Rules up to date and every card closed.',
    callouts: [
      callout('status', 1, 0.51, 0.19, 'Status card', 'Always at the top: whether your rules are current and for this character.'),
      callout('cards', 2, 0.5, 0.43, 'Cards', 'Here, Strict Mode, Run, Roll inbox and Connection & backup, each opening on its own.'),
      callout('more-settings', 3, 0.5, 0.94, 'More settings', 'Everything else is in RuneLite’s configuration, under Fate Locked Ironman.'),
    ],
  },
  {
    id: 'sidebar-here',
    src: '/guides/runelite/sidebar-here.png',
    source: 'rendered',
    title: 'Here, in a locked place',
    alt: 'The Here card for Sorcerer’s Tower: Locked, Unlock Seers’ Village, the counts, the arrow pointing at the nearest Magic tree, Skilling open at Woodcutting, and Quests and Combat closed, each saying what it holds.',
    callouts: [
      callout('status', 1, 0.84, 0.23, 'Status', 'The place’s status in a word: here, Locked.'),
      callout('reason', 2, 0.5, 0.28, 'Why', 'The tracker’s reason, in its own words.'),
      callout('counts', 3, 0.5, 0.33, 'Counts', 'What you can do here, what isn’t ready, and what’s locked.'),
      callout('arrow', 4, 0.42, 0.38, 'Arrow', 'Click a row and the game’s arrow points at the nearest one.'),
      callout('categories', 5, 0.55, 0.42, 'Categories', 'Each opens and closes, and says what it holds while closed.'),
      callout('skills', 6, 0.43, 0.46, 'Skills', 'Skilling opens skill by skill, with your level and cap.'),
    ],
  },
  {
    id: 'sidebar-strict-mode',
    src: '/guides/runelite/sidebar-strict-mode.png',
    source: 'rendered',
    title: 'Strict Mode, paused',
    alt: 'The Strict Mode card paused with 42 seconds left, a Resume button, and two recently stopped teleports.',
    callouts: [
      callout('switch', 1, 0.88, 0.39, 'On or off', 'Turns Strict Mode on or off, like the setting.'),
      callout('paused', 2, 0.35, 0.45, 'Paused', 'A pause lets every click through, then Strict Mode resumes by itself.'),
      callout('resume', 3, 0.8, 0.45, 'Resume', 'Ends the pause now. When Strict Mode isn’t paused, this is Pause 60s.'),
      callout('stopped', 4, 0.5, 0.52, 'Recently stopped', 'The teleports Strict Mode stopped, and when.'),
    ],
  },
  {
    id: 'sidebar-roll-inbox',
    src: '/guides/runelite/sidebar-roll-inbox.png',
    source: 'rendered',
    title: 'Roll inbox',
    alt: 'The Roll inbox card: 12 local events, 2 that need checking, 1 active warning, and Open web Roll Inbox.',
    callouts: [
      callout('events', 1, 0.22, 0.58, 'Local events', 'Events RuneLite noticed on this computer that may be worth a roll.'),
      callout('needs-checking', 2, 0.26, 0.63, 'Needs checking', 'Events RuneLite can’t be sure of.'),
      callout('open', 3, 0.5, 0.79, 'Open web Roll Inbox', 'Opens the companion’s own Roll Inbox; the local history isn’t sent to it.'),
    ],
  },
  {
    id: 'sidebar-run',
    src: '/guides/runelite/sidebar-run.png',
    source: 'rendered',
    title: 'Run and the three Keys',
    alt: 'The Run card: Iron Example (you), 15 of 187 areas unlocked, 3 Keys, 1 Omni-Key, 0 Chaos Keys, 12 Fate Points and the Ritual of Clarity.',
    callouts: [
      callout('character', 1, 0.64, 0.43, 'Character', 'Whose run this is, with (you) when you’re logged in on it.'),
      callout('progress', 2, 0.5, 0.51, 'Progress', 'How much of the run you’ve unlocked.'),
      callout('keys', 3, 0.5, 0.63, 'Keys', 'Keys, Omni-Keys and Chaos Keys, as the companion names them.'),
      callout('ritual', 4, 0.58, 0.77, 'Ritual', 'The ritual active on your next roll.'),
    ],
  },
  {
    id: 'sidebar-connection',
    src: '/guides/runelite/sidebar-connection.png',
    source: 'rendered',
    title: 'Connection & backup',
    alt: 'The Connection & backup card: Online sync on, the pairing, Re-pair tracker, Disconnect, Check now, and the two backup buttons.',
    callouts: [
      callout('sync', 1, 0.88, 0.51, 'Online sync', 'Turns the relay on or off; your pairing is kept either way.'),
      callout('repair', 2, 0.27, 0.58, 'Re-pair tracker…', 'Pairs another profile, keeping this one until the new one sends its rules.'),
      callout('check', 3, 0.5, 0.64, 'Check now', 'Asks the tracker for your rules at once.'),
      callout('clipboard', 4, 0.5, 0.72, 'Backup', 'Import from clipboard, or load the newest backup file, without the relay.'),
    ],
  },
];

/** What the guide says about each setting, beside what the contract fixes. */
const SETTING_PROSE: Readonly<Record<string, Pick<GuideSetting, 'purpose' | 'visibleResult' | 'changeWhen'>>> = {
  trackerNetworkAccess: {
    purpose: 'Lets RuneLite get your run’s rules from the Fate Locked relay. Connect tracker asks before it turns this on, and RuneLite shows its own warning that the relay sees your IP address.',
    visibleResult: 'With the tracker connected, the status card says Rules up to date and when it last synced. With it off, RuneLite never contacts the relay; clipboard imports and backup files still work.',
    changeWhen: 'Leave it on to keep your rules current. Turn it off if you’d rather contact no server; RuneLite keeps your pairing for when you turn it back on.',
  },
  strictMode: {
    purpose: 'Stops a teleport only when the tracker’s travel table matches it exactly and fresh rules for your character lock where it goes.',
    visibleResult: 'A stopped teleport shows a banner over the game with the tracker’s reason and a Pause 60s button. The sidebar’s Strict Mode card says Active, Paused, Inactive with why, or Off.',
    changeWhen: 'Turn it on for a safety net against teleporting somewhere locked by mistake. The Strict Mode card has the same switch.',
  },
  pauseStrictModeHotkey: {
    purpose: 'Pauses Strict Mode for 60 seconds from the keyboard, like the Pause 60s button.',
    visibleResult: 'The Strict Mode card and the HUD count the pause down, then Strict Mode resumes by itself.',
    changeWhen: 'Set it if you pause often, on a key RuneLite and the game don’t use.',
  },
  lockedAreaAlert: {
    purpose: 'What happens when you walk into a locked area: a chat line, and if you choose, a sound and a short fade around the game view.',
    visibleResult: 'The chat line names the area and says why it is locked, in the tracker’s words. The sound and fade come only when you arrive from unlocked land, and the same area alerts again only after a minute.',
    changeWhen: 'Pick Chat for a quieter run, or Off if the map and borders are enough.',
  },
  announceAreaChanges: {
    purpose: 'A chat line whenever you walk into another area the tracker maps, locked or not.',
    visibleResult: 'The chatbox names each new area and its status, once per area rather than once per chunk.',
    changeWhen: 'Turn it off if these lines crowd the chatbox; locked areas still alert.',
  },
  ruleWarnings: {
    purpose: 'Warns about a bank you haven’t unlocked, a Slayer task in locked areas, and gear above your unlocked tier.',
    visibleResult: 'A chat line when it happens; the Slayer and gear warnings also stay on the HUD while they apply. Each needs your rules to cover it, and stays quiet when they don’t.',
    changeWhen: 'Leave it on unless your run doesn’t lock banks, Slayer tasks or gear tiers.',
  },
  tagLockedOptions: {
    purpose: 'Adds (Locked) to right-click options on NPCs, objects, items on the ground and teleports your rules lock.',
    visibleResult: 'The tag follows the option’s name in the locked colour. It asks before you click; it never blocks.',
    changeWhen: 'Turn it off if you’d rather see menus as the game shows them.',
  },
  rollNudges: {
    purpose: 'A chat reminder when a level-up, quest, diary, boss kill or collection log entry may be worth a roll in the tracker.',
    visibleResult: 'The reminder says what happened. It never rolls and never changes your run.',
    changeWhen: 'Turn it off if you roll in the tracker on your own schedule.',
  },
  useNotifier: {
    purpose: 'Also sends locked-area alerts and rule warnings as RuneLite notifications.',
    visibleResult: 'They arrive however your RuneLite notification settings deliver them, such as a tray message while the client is in the background.',
    changeWhen: 'Turn it on if you often play with RuneLite behind other windows.',
  },
  hudMode: {
    purpose: 'A box over the game. Compact shows where you are, its status and why, Strict Mode, and the nearest bank and shop. Detailed adds your progress, Keys and Fate Points, and what the place holds.',
    visibleResult: 'Statuses are words in the palette’s colours. Detailed lists up to five things of each kind, then +N more; on another character the HUD says only that the run isn’t theirs.',
    changeWhen: 'Pick Detailed while planning a route, Compact for play, or Off for a clear screen.',
  },
  worldMapMode: {
    purpose: 'Shades locked land on the world map like fog, lightly fills the frontier in Chunked mode, and outlines your unlocked land.',
    visibleResult: 'Hovering a chunk shows its area and status, and with contents what it holds. Nothing is drawn over the overview or the surface selector.',
    changeWhen: 'Drop the contents or the tooltip if the map feels busy; Off leaves the map as the game draws it.',
  },
  worldMapMarkers: {
    purpose: 'A pin on each area you haven’t unlocked.',
    visibleResult: 'Clicking a pin moves the world map there.',
    changeWhen: 'Turn it on to see what’s left to unlock at a glance; leave it off to keep the map clean.',
  },
  chunkBorders: {
    purpose: 'Lines on the ground where chunks meet.',
    visibleResult: 'Locked edges are dashed over a dark underlay, so they read on any ground. All edges adds a thin line between unlocked chunks.',
    changeWhen: 'Pick All edges while learning the chunk grid, or Off to leave the ground alone.',
  },
  shadeNearbyLocked: {
    purpose: 'Darkens a band of locked land along a locked edge, in the game view and on the minimap.',
    visibleResult: 'The band lies on the locked side, two tiles deep, so you can tell the sides apart at a glance.',
    changeWhen: 'Turn it off if you’d rather see the ground unshaded.',
  },
  drawMinimap: {
    purpose: 'Chunk borders and locked land on the minimap.',
    visibleResult: 'The same edges as the game view, drawn on the minimap.',
    changeWhen: 'Turn it off to keep the minimap as the game draws it.',
  },
  showInfoBoxes: {
    purpose: 'RuneLite infoboxes for your Keys, Fate Points and unlock progress.',
    visibleResult: 'Each box has its own OSRS icon and moves on its own. A box with nothing to count, or on another character, isn’t shown.',
    changeWhen: 'Turn it on to keep your Keys in sight without the Detailed HUD.',
  },
  colourPreset: {
    purpose: 'The plugin’s colours: the default set, a set safe for colour-blind players, or your own.',
    visibleResult: 'Changes every colour the plugin draws, in the sidebar, the HUD, the borders, the minimap and the world map.',
    changeWhen: 'Pick Colour-blind safe if red and green are hard to tell apart, or Custom to choose the three colours below.',
  },
  unlockedColor: {
    purpose: 'The colour of unlocked land and statuses, with Colours set to Custom.',
    visibleResult: 'Used wherever the plugin says Unlocked or Can do.',
    changeWhen: 'Change it to suit your eyes or your screen; it takes effect only with Custom.',
  },
  frontierColor: {
    purpose: 'The colour of the frontier in Chunked mode, with Colours set to Custom.',
    visibleResult: 'The light fill on chunks next to yours that you can roll next.',
    changeWhen: 'Change it only if you play Chunked mode with Custom colours.',
  },
  lockedColor: {
    purpose: 'The colour of locked edges and statuses, with Colours set to Custom.',
    visibleResult: 'Used for dashed locked edges, the (Locked) tag and wherever the plugin says Locked.',
    changeWhen: 'Change it to suit your eyes or your screen; it takes effect only with Custom.',
  },
  reimportHotkey: {
    purpose: 'Imports your rules from the clipboard, as the sidebar’s Import from clipboard does.',
    visibleResult: 'The status card says Using a backup, where the rules came from and when the tracker exported them.',
    changeWhen: 'Set it if you copy rules from the tracker often, for example with online sync off.',
  },
};

export const RUNELITE_GUIDE_SETTINGS: readonly GuideSetting[] = RUNELITE_SETTINGS.map(setting => ({
  key: setting.key,
  section: setting.section,
  label: setting.name,
  defaultValue: setting.defaultValue,
  ...(setting.options ? { options: setting.options } : {}),
  ...SETTING_PROSE[setting.key],
}));

const label = (key: string) => RUNELITE_SETTINGS.find(setting => setting.key === key)?.name ?? key;

export const RUNELITE_GUIDE_PRESETS: readonly GuidePreset[] = [
  {
    id: 'balanced-defaults',
    title: 'Balanced defaults',
    summary: 'The settings a new profile starts with: alerts in chat with a sound and fade, a Compact HUD, and Strict Mode off.',
    adjustments: [
      'Keep every default as it comes.',
      `Leave ${label('showInfoBoxes')}, ${label('worldMapMarkers')} and ${label('useNotifier')} off.`,
      `Keep ${label('strictMode')} off until you choose to turn it on.`,
    ],
  },
  {
    id: 'high-visibility',
    title: 'High visibility',
    summary: 'Every channel on, for players who want the run in view all the time.',
    adjustments: [
      'Start from Balanced defaults.',
      `Set ${label('hudMode')} to Detailed.`,
      `Turn on ${label('showInfoBoxes')}, ${label('worldMapMarkers')} and ${label('useNotifier')}.`,
      `Set ${label('chunkBorders')} to All edges.`,
    ],
  },
  {
    id: 'minimal-screen',
    title: 'Minimal screen',
    summary: 'The world map and the sidebar tell you everything; the game view stays clear.',
    adjustments: [
      `Keep ${label('worldMapMode')} on, with the tooltip.`,
      `Set ${label('hudMode')} to Off, and ${label('lockedAreaAlert')} to Chat.`,
      `Turn off ${label('shadeNearbyLocked')} and ${label('announceAreaChanges')}.`,
    ],
  },
  {
    id: 'strict-travel',
    title: 'Strict travel',
    summary: 'Balanced defaults with Strict Mode on, which fails open whenever it can’t be sure.',
    adjustments: [
      `Start from Balanced defaults and turn on ${label('strictMode')}.`,
      'Remember it lets a teleport through whenever the rules are stale, for another character, or don’t decide it.',
      `Set a ${label('pauseStrictModeHotkey')} if you often need to go somewhere it would stop.`,
    ],
  },
];

export const RUNELITE_GUIDE_TROUBLESHOOTING: readonly GuideTroubleshootingItem[] = [
  {
    id: 'waiting-for-confirmation',
    symptom: 'The status card keeps saying Waiting for confirmation.',
    likelyCause: 'The profile hasn’t been confirmed in the browser page RuneLite opened, or it was confirmed in an older page. After 10 minutes without one, the card says No profile arrived.',
    fix: [
      'Select Open page again to reopen the newest page, and confirm the profile there.',
      'Keep RuneLite open until the card says Rules up to date.',
      'Select Cancel to stop waiting; select Connect tracker to start again.',
    ],
  },
  {
    id: 'not-connected-or-sync-off',
    symptom: 'The status card says Not connected, or Online sync is off.',
    likelyCause: 'No tracker profile is paired, or online sync is turned off, so RuneLite doesn’t contact the relay.',
    fix: [
      'For Not connected, select Connect tracker and confirm the profile.',
      'For Online sync is off, select Turn on online sync; your pairing is kept.',
      'To play without the relay, use a backup: Import from clipboard or Load newest backup file.',
    ],
  },
  {
    id: 'out-of-date-or-expired',
    symptom: 'The status card says Rules may be out of date, Tracker copy expired, or Tracker has older rules.',
    likelyCause: 'RuneLite couldn’t reach the tracker for more than 15 minutes, the tracker hasn’t sent your rules in 24 hours, or the relay has an older copy than yours. Your current rules stay in use.',
    fix: [
      'For Rules may be out of date, check your internet connection, then select Check now.',
      'For Tracker copy expired or Tracker has older rules, select Open web tracker; opening your profile there sends the rules again.',
      'Strict Mode waits until the rules are fresh again; warnings and the sidebar keep working.',
    ],
  },
  {
    id: 'not-usable-or-update',
    symptom: 'The status card says Tracker rules not usable, Couldn’t apply the tracker’s rules, or Plugin update needed.',
    likelyCause: 'The tracker sent rules RuneLite couldn’t read, or in a newer format than your plugin knows. Your current rules stay in use.',
    fix: [
      'For Plugin update needed, restart RuneLite; it updates Fate Locked from the Plugin Hub.',
      'For the others, select Open web tracker to send the rules again, or wait for the next check.',
      'Never edit the rules by hand; a backup from the tracker is always safe to import.',
    ],
  },
  {
    id: 'different-character',
    symptom: 'The status card says Different character.',
    likelyCause: 'The run’s rules belong to another character than the one logged in, so warnings and Strict Mode are off and the Here card checks nothing.',
    fix: [
      'Log in on the character the card names.',
      'Or connect the tracker profile for this character: Re-pair tracker… in Connection & backup.',
    ],
  },
  {
    id: 'here-empty',
    symptom: 'The Here card says Log in to see the place you’re standing in, or The tracker doesn’t map this place.',
    likelyCause: 'You aren’t logged in, or you are somewhere the tracker leaves Uncharted, such as some dungeons and instances.',
    fix: [
      'Log in and step into the game world.',
      'In an instance, the card names the place it copies when the tracker maps it.',
      'Check the tracker’s map if a place you expect stays Uncharted.',
    ],
  },
  {
    id: 'missing-display',
    symptom: 'The HUD, borders, minimap lines, world map shading or infoboxes don’t show.',
    likelyCause: 'The setting is off, the rules are for another character, or no rules are loaded yet.',
    fix: [
      'Open RuneLite’s configuration, select Fate Locked Ironman, and check the Display section.',
      'Check the status card: nothing is drawn for another character’s run.',
      'The world map draws only inside the map, never over the overview or the surface selector.',
    ],
  },
  {
    id: 'tooltip-missing-content',
    symptom: 'The world map tooltip shows a chunk’s status but not what it holds.',
    likelyCause: `${label('worldMapMode')} is set to Shading and tooltip, or the tracker lists nothing in that chunk.`,
    fix: [
      `Set ${label('worldMapMode')} to Shading, tooltip and contents.`,
      'Try a chunk you know holds something, to tell an empty chunk from the setting.',
    ],
  },
  {
    id: 'clipboard-import',
    symptom: 'Import from clipboard doesn’t load your rules.',
    likelyCause: 'The clipboard doesn’t hold one complete copy of your rules from the tracker.',
    fix: [
      'Copy the rules again from the tracker.',
      `Select Import from clipboard, or press your ${label('reimportHotkey')}, once.`,
      'A failed import keeps the rules you had.',
    ],
  },
  {
    id: 'backup-file',
    symptom: 'Load newest backup file doesn’t find your file.',
    likelyCause: 'The file isn’t in the backup folder, or isn’t named fate-locked-bundle-*.json.',
    fix: [
      'Put it in %USERPROFILE%\\.runelite\\fate-locked\\ on Windows.',
      'Name it fate-locked-bundle-*.json; the newest such file is the one read.',
      'RuneLite reads the folder only when you select the button; it doesn’t watch it.',
    ],
  },
  {
    id: 'strict-mode-allows-action',
    symptom: 'Strict Mode doesn’t stop a teleport you expected it to.',
    likelyCause: 'It stops only a trip the tracker’s travel table matches by id, going to one place your rules lock. Options that pick the place after the click, such as a jewellery Rub, and fairy rings, spirit trees, charters and boats are never stopped, nor are walking, NPCs, objects, banks and equipment. When the rules are stale, for another character, or don’t decide the trip, it lets it through.',
    fix: [
      'Read the Strict Mode card: Inactive says what’s missing, such as fresh rules.',
      'The (Locked) tag and the locked-area alert still cover what Strict Mode leaves alone.',
      'This is deliberate: Strict Mode fails open and never guesses.',
    ],
  },
];

export const RUNELITE_GUIDE_GLOSSARY: readonly GuideGlossaryItem[] = [
  {
    term: RUNELITE_TERMS.UNLOCKED,
    definition: 'Your run can go there or do it.',
  },
  {
    term: RUNELITE_TERMS.CAN_DO,
    definition: 'Something in a place that your run can do now.',
  },
  {
    term: RUNELITE_TERMS.NOT_READY,
    definition: 'Unlocked, but waiting on something first: a quest, a level, or a way to get there.',
  },
  {
    term: RUNELITE_TERMS.LOCKED,
    definition: 'Your run hasn’t unlocked it yet.',
  },
  {
    term: RUNELITE_TERMS.NEEDS_CHECKING,
    definition: 'An event RuneLite noticed but can’t be sure of, counted in the Roll inbox.',
  },
  {
    term: RUNELITE_TERMS.UNCHARTED,
    definition: 'A place the tracker doesn’t map, such as some dungeons and instances. Nothing there is checked.',
  },
  {
    term: RUNELITE_TERMS.FRONTIER,
    definition: 'In Chunked mode, a locked chunk next to one you hold, which you can roll next.',
  },
  {
    term: RUNELITE_TERMS.DIFFERENT_CHARACTER,
    definition: 'The run’s rules belong to another character than the one logged in; nothing is checked until you switch.',
  },
  {
    term: RUNELITE_TERMS.STRICT_MODE,
    definition: 'An optional guard, off by default, that stops a teleport only when the tracker’s travel table matches it exactly and fresh rules for your character lock where it goes. It never guesses.',
  },
  {
    term: RUNELITE_TERMS.KEYS,
    definition: 'Spend one on a table you choose for a random unlock from it.',
  },
  {
    term: RUNELITE_TERMS.OMNI_KEYS,
    definition: 'Spend one to choose the exact unlock you want.',
  },
  {
    term: RUNELITE_TERMS.CHAOS_KEYS,
    definition: 'Spend one for a random unlock from any table; you don’t choose the table.',
  },
  {
    term: RUNELITE_TERMS.FATE_POINTS,
    definition: 'What a failed roll gives instead of a Key. Enough of them bring a Pity Key, and you can spend them on rituals.',
  },
  {
    term: 'Ritual of Clarity',
    definition: 'Your next roll is made twice, and the better result is kept.',
  },
  {
    term: 'Ritual of Greed',
    definition: 'If your next roll succeeds you get 2 Keys; if it fails, half the Fate Points come back.',
  },
  {
    term: 'Chunk',
    definition: 'A 64 by 64 tile square of the game map, the unit the tracker locks and unlocks.',
  },
  {
    term: 'Relay',
    definition: 'The fixed Fate Locked service that hands RuneLite your paired profile’s rules. It sees your IP address, as any internet service does.',
  },
  {
    term: 'Backup',
    definition: 'Your rules copied from the tracker to the clipboard or a file, for playing without the relay.',
  },
];

export const RUNELITE_GUIDE_CHAPTERS: readonly GuideChapter[] = [
  {
    id: 'what-it-does',
    number: 1,
    title: 'What the plugin does',
    summary: 'Fate Locked Ironman shows your run’s rules in RuneLite: where you stand, what’s locked, and what your run holds.',
    paragraphs: [
      'The companion is where you create the run, roll and spend Keys, and unlock things. RuneLite gets that run’s current rules and shows them as you play.',
      'RuneLite’s warnings and what it notices are helpers. They never roll and never change your run.',
    ],
    bullets: [
      'Install the one Fate Locked Ironman plugin from the Plugin Hub.',
      'Read your run in the Fate Locked sidebar; change settings in RuneLite’s configuration.',
      'Return to the companion whenever the run itself needs to change.',
    ],
    screenshotIds: [],
  },
  {
    id: 'install-plugin-hub',
    number: 2,
    title: 'Install from Plugin Hub',
    summary: 'Install Fate Locked Ironman from RuneLite’s normal Plugin Hub.',
    paragraphs: [
      'Open RuneLite’s configuration, select Plugin Hub, and search for Fate Locked Ironman. Install the result shown in the screenshot.',
      'After installation, select the Fate Locked icon in RuneLite’s sidebar: a crystal key.',
    ],
    bullets: [
      'Use the Plugin Hub result named Fate Locked Ironman.',
      'Updates arrive through the same Plugin Hub entry after RuneLite review.',
    ],
    screenshotIds: ['plugin-hub-install'],
  },
  {
    id: 'connect-tracker',
    number: 3,
    title: 'Connect the tracker',
    summary: 'A one-time browser confirmation links your companion profile to this RuneLite client.',
    paragraphs: [
      'Select Connect tracker on the status card. The first time, RuneLite asks to turn on online sync, which lets it contact the Fate Locked relay; RuneLite shows its own warning that the relay sees your IP address.',
      'Your browser opens a confirmation page in the companion. Check the profile, confirm it, and return to RuneLite. The status card says Waiting for confirmation, then Rules up to date with when it synced.',
    ],
    bullets: [
      'Keep RuneLite open while you confirm.',
      'Open page again reopens the newest page if you closed it.',
      'Never share the private pairing page in screenshots or support messages.',
    ],
    screenshotIds: ['sidebar-not-connected', 'companion-confirmation', 'sidebar-waiting'],
    settingsSections: ['Tracker'],
  },
  {
    id: 'connection-privacy',
    number: 4,
    title: 'Connection and privacy',
    summary: 'RuneLite gets your run’s rules through a fixed, inbound-only connection, and the status card says how current they are.',
    paragraphs: [
      'RuneLite fetches your rules from the fixed Fate Locked relay. The relay sees your IP address, as any internet service does. RuneLite does not upload gameplay data.',
      'The status card at the top of the sidebar says whether your rules are current and for this character, and offers the one thing to do about it.',
    ],
    bullets: [
      'Rules up to date: synced recently for your character.',
      'Rules may be out of date: RuneLite couldn’t check for more than 15 minutes; Strict Mode waits until they refresh.',
      'Tracker copy expired: the tracker hasn’t sent your rules in 24 hours; open it to send them again.',
      'Using a backup or Using saved rules: rules from the clipboard, a backup file, or the last start.',
      'Different character: the rules belong to another character, so nothing is checked.',
      'Waiting for confirmation, No profile arrived, Not connected: the pairing steps.',
    ],
    screenshotIds: ['sidebar-out-of-date', 'sidebar-different-character'],
  },
  {
    id: 'sidebar',
    number: 5,
    title: 'The sidebar',
    summary: 'The Fate Locked sidebar leads with the status card, then a card for each part of your run.',
    paragraphs: [
      'The status card is always at the top. Below it, each card opens and closes on its own; Here starts open.',
      'Opening or closing a card never changes the others, your settings, or the run. More settings are in RuneLite’s configuration, under Fate Locked Ironman.',
    ],
    bullets: RUNELITE_SIDEBAR_CARD_TITLES,
    screenshotIds: ['sidebar-overview'],
  },
  {
    id: 'here',
    number: 6,
    title: 'Here',
    summary: 'Here explains your rules for the place you’re standing in.',
    paragraphs: [
      'When you’re logged in, the card names the place, its region and chunk, and its status in a word, with the tracker’s reason when it is locked or not ready.',
      'Below, it counts what you can do, what isn’t ready and what’s locked. Then come the place’s skilling, banks, shops, quests, combat, travel, farming and activities, each on a line that opens and closes and, while closed, says what it holds. Skilling opens skill by skill, each with your level and cap. What you leave open stays open as you walk, and an open list shows five rows with +N more.',
      'When the tracker can’t see a requirement, such as a quest started, quest points, a free-to-play world or a light source you carry, RuneLite checks it in game. Every row says Can do, Not ready or Locked, and a row that isn’t ready names only what’s left.',
      'Click a skilling spot, monster, bank or shop and the game’s own arrow points at the nearest one around you, with a line under the counts saying so. It comes down when you get there, when you click the row again or press Clear, or when you leave the chunk.',
      'If none is near enough to be loaded, the card shows the way to the nearest one you’ve seen in that chunk: the arrow goes on that spot, your minimap points toward it and the world map has a pin. If you run the Shortest Path plugin from the Plugin Hub, it draws the walking route too. The way stays up as you cross other chunks, and the arrow moves onto the thing itself once it comes into view. Where you’ve seen things is kept on your computer and never sent anywhere.',
    ],
    bullets: [
      `${RUNELITE_TERMS.CAN_DO}: your run can do it now.`,
      `${RUNELITE_TERMS.NOT_READY}: unlocked, but waiting on something first.`,
      `${RUNELITE_TERMS.LOCKED}: not unlocked by this run.`,
      `${RUNELITE_TERMS.UNCHARTED}: the tracker doesn’t map the place.`,
    ],
    screenshotIds: ['sidebar-here'],
  },
  {
    id: 'strict-mode',
    number: 7,
    title: 'Strict Mode',
    summary: 'Strict Mode is an optional, careful guard against teleporting somewhere your rules lock.',
    paragraphs: [
      'Strict Mode is off by default. When on, it stops only a trip the tracker’s travel table matches by id: a spell, tablet, scroll or teleport item option that goes to one place your rules lock. The rules must be fresh and bound to your character.',
      'An option that picks its place after the click, such as a jewellery Rub, is never stopped, and fairy rings, spirit trees, charters and boats are tagged but never stopped. Walking, NPC, object, bank and equipment clicks are never stopped either. When the rules are stale, for another character, or don’t decide the trip, Strict Mode fails open rather than guessing.',
      'The Strict Mode card says Active, Paused, Off, or Inactive with why. Pause 60s, on the card, on the banner over a stopped teleport, or on its optional hotkey, lets every click through for 60 seconds, and the HUD counts it down. Recently stopped lists what it stopped.',
    ],
    bullets: [
      'Warnings and tags keep working with Strict Mode off.',
      'Walking is never blocked, and uncertain travel is never blocked by a guess.',
      'Turn it off from the card at any time, or pause it for 60 seconds.',
    ],
    screenshotIds: ['sidebar-strict-mode'],
    settingsSections: ['Strict Mode'],
  },
  {
    id: 'roll-inbox',
    number: 8,
    title: 'Roll inbox',
    summary: 'Roll inbox is a local history of in-game events that may be worth a roll.',
    paragraphs: [
      `The card counts Local events, ${RUNELITE_TERMS.NEEDS_CHECKING} and Warnings. RuneLite keeps the newest 250 events on this computer.`,
      'Events RuneLite can’t be sure of count as Needs checking. Noticing an event never rolls and never changes your run.',
    ],
    bullets: [
      'Open web Roll Inbox opens the companion’s own Roll Inbox.',
      'RuneLite’s local history isn’t uploaded or sent to it.',
      'Roll in the companion, not from a local event alone.',
    ],
    screenshotIds: ['sidebar-roll-inbox'],
  },
  {
    id: 'run-and-keys',
    number: 9,
    title: 'Run and the three Keys',
    summary: 'Run shows whose run it is, your progress, and what the run holds, in the companion’s words.',
    paragraphs: [
      'Character names the run’s character, with (you) when you’re logged in on it, or the character you’re on when it differs. Run shows the end of the run’s id, so you can tell runs apart without sharing it.',
      `The card shows how much you’ve unlocked, your ${RUNELITE_TERMS.KEYS}, ${RUNELITE_TERMS.OMNI_KEYS} and ${RUNELITE_TERMS.CHAOS_KEYS}, your ${RUNELITE_TERMS.FATE_POINTS}, an active ritual and your next goal.`,
    ],
    bullets: [
      `${RUNELITE_TERMS.KEYS}: choose the table; Fate chooses the unlock.`,
      `${RUNELITE_TERMS.OMNI_KEYS}: choose the exact unlock.`,
      `${RUNELITE_TERMS.CHAOS_KEYS}: neither the table nor the unlock is yours to choose.`,
    ],
    screenshotIds: ['sidebar-run'],
  },
  {
    id: 'connection-and-backup',
    number: 10,
    title: 'Connection & backup',
    summary: 'Connection & backup holds online sync, the pairing, and the ways to load rules without the relay.',
    paragraphs: [
      'Online sync turns the relay on or off. Re-pair tracker… pairs another profile, and keeps the current one until the new one sends its rules. Disconnect forgets the pairing and keeps the rules you have as a backup. Check now asks the tracker at once.',
      'Import from clipboard reads rules you copied from the tracker. Load newest backup file reads the newest fate-locked-bundle-*.json in %USERPROFILE%\\.runelite\\fate-locked\\ on Windows, only when you select it. RuneLite also keeps the last rules it accepted and brings them back when it starts, even offline.',
      'A backup that can’t be read, or is older or for another run, keeps the rules you had.',
    ],
    bullets: [
      'Clipboard: copy your rules in the tracker, then select Import from clipboard.',
      'Backup file: put a file from the tracker named fate-locked-bundle-*.json in the folder, then select Load newest backup file.',
    ],
    screenshotIds: ['sidebar-connection'],
    settingsSections: ['Backup'],
  },
  {
    id: 'settings',
    number: 11,
    title: 'Settings',
    summary: 'Every setting is in RuneLite’s configuration, under Fate Locked Ironman, in sections that follow the sidebar.',
    paragraphs: [
      'Open RuneLite’s configuration, the wrench, and select Fate Locked Ironman. Tracker, Strict Mode, Alerts and Display are open; Custom colours and Backup start closed.',
      'Settings change only what RuneLite shows and how it warns you. They never unlock anything, roll, or change your run.',
    ],
    bullets: [
      'Tracker: online sync.',
      'Strict Mode: the guard and its pause hotkey.',
      'Alerts: locked areas, area changes, rule warnings, tags, reminders, notifications.',
      'Display: the HUD, the world map, borders, the minimap, infoboxes and colours.',
      'Custom colours and Backup: your own colours, and the clipboard hotkey.',
    ],
    screenshotIds: [],
  },
  {
    id: 'alerts',
    number: 12,
    title: 'Alerts',
    summary: 'Choose how RuneLite tells you about locked areas, your rules, and events worth a roll.',
    paragraphs: [
      'Walking into a locked area posts a chat line that names the area and says why, and by default a sound and a short fade around the game view. Each area alerts once; the same area again only after a minute.',
      'Rule warnings, the (Locked) tag on right-click options and roll reminders each have their own setting. None of them unlocks anything or changes the run.',
    ],
    bullets: [
      'Keep the defaults for a balanced setup.',
      'Also send RuneLite notifications helps when the client is in the background.',
      'Turn off any channel that makes too much noise.',
    ],
    screenshotIds: [],
    settingsSections: ['Alerts'],
  },
  {
    id: 'in-game-display',
    number: 13,
    title: 'In-game display',
    summary: 'The HUD, chunk borders, the minimap, the world map and infoboxes show your rules where you play.',
    paragraphs: [
      'The HUD sits over the game in Compact or Detailed. Chunk borders are dashed where locked land starts, over a dark underlay, with a band of shade on the locked side. The minimap draws the same edges.',
      'The world map shades locked land like fog of war and leaves unlocked land clear, with its edge outlined; in Chunked mode the frontier has a light fill. Hovering a chunk shows its area, status and, if you choose, what it holds.',
      'Colours come from one palette: Default, Colour-blind safe, or your own. Nothing is drawn for another character’s run.',
    ],
    bullets: [
      'Pins on locked areas are off by default, to keep the map clear.',
      'Infoboxes for Keys, Fate Points and progress are off by default.',
      'Each layer has its own setting; turning one off leaves the others.',
    ],
    screenshotIds: [],
    settingsSections: ['Display', 'Custom colours'],
  },
  {
    id: 'recommended-configurations',
    number: 14,
    title: 'Recommended configurations',
    summary: 'Start with one of four simple setups, then change only what helps you.',
    paragraphs: [
      'Balanced defaults suit most players. High visibility turns every channel on. Minimal screen keeps the game view clear and leaves the map and sidebar to tell you.',
      'Strict travel adds Strict Mode to the defaults. It still fails open when it can’t be sure, and its pause lasts 60 seconds.',
    ],
    bullets: RUNELITE_GUIDE_PRESETS.map(preset => preset.title),
    screenshotIds: [],
  },
  {
    id: 'troubleshooting',
    number: 15,
    title: 'Troubleshooting',
    summary: 'Connection, rules, display and Strict Mode problems can be read from the sidebar.',
    paragraphs: [
      'Start with the status card: its title and its one action explain most problems without changing a setting or losing your rules.',
      'Use the links below for the official Plugin Hub listing, RuneLite’s review, and companion support. Leave pairing pages, run ids, file paths and unrelated chat out of reports.',
    ],
    bullets: RUNELITE_GUIDE_TROUBLESHOOTING.map(item => item.symptom),
    screenshotIds: [],
  },
  {
    id: 'glossary',
    number: 16,
    title: 'Glossary',
    summary: 'Plain definitions for the words the companion and the RuneLite plugin share.',
    paragraphs: [
      'The sidebar, the HUD and the companion use these words the same way.',
    ],
    bullets: RUNELITE_GUIDE_GLOSSARY.map(item => `${item.term}: ${item.definition}`),
    screenshotIds: [],
  },
];
