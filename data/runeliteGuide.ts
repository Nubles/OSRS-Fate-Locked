import {
  RUNELITE_SETTINGS,
  RUNELITE_SIDEBAR_CARDS,
  RUNELITE_TERMS,
  type RuneliteSettingSection,
} from './runeliteWording';

export const RUNELITE_GUIDE_CHAPTER_IDS = [
  'start',
  'sidebar',
  'status',
  'here',
  'strict-mode',
  'run',
  'roll-inbox',
  'connection-and-backup',
  'in-game',
  'settings',
  'troubleshooting',
  'glossary',
] as const;

export type GuideChapterId = typeof RUNELITE_GUIDE_CHAPTER_IDS[number];

/**
 * Where a picture comes from: drawn by the plugin's own code, in RuneLite's own theme, or
 * captured from the companion.
 */
export type GuideFigureSource = 'rendered' | 'web-capture';

/** The outline of what a callout names, as fractions of its picture: x, y, width, height. */
export type GuideBox = readonly [number, number, number, number];

export interface GuideCallout {
  readonly id: string;
  readonly marker: number;
  readonly box: GuideBox;
  readonly label: string;
  readonly body: string;
}

export interface GuideFigure {
  readonly id: string;
  readonly src: string;
  readonly source: GuideFigureSource;
  readonly title: string;
  readonly alt: string;
  /** The file's size, in pixels. */
  readonly width: number;
  readonly height: number;
  /** The file's pixels to each pixel of what it shows: 2 for a picture drawn at twice the detail. */
  readonly scale: number;
  readonly callouts: readonly GuideCallout[];
}

/** One picture of a set shown side by side, such as the status card's states. */
export interface GuideGalleryItem {
  readonly figureId: string;
  readonly title: string;
  readonly body: string;
}

export interface GuideStep {
  readonly title: string;
  readonly body: string;
}

export interface GuideTerm {
  readonly term: string;
  readonly text: string;
}

/** One piece of a chapter, in reading order. */
export type GuideBlock =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'heading'; readonly text: string }
  | { readonly kind: 'steps'; readonly steps: readonly GuideStep[] }
  | { readonly kind: 'list'; readonly items: readonly string[] }
  | { readonly kind: 'terms'; readonly items: readonly GuideTerm[] }
  | { readonly kind: 'note'; readonly title: string; readonly text: string }
  | { readonly kind: 'figure'; readonly figureId: string }
  | { readonly kind: 'gallery'; readonly items: readonly GuideGalleryItem[] }
  | { readonly kind: 'settings' }
  | { readonly kind: 'presets' }
  | { readonly kind: 'troubleshooting' }
  | { readonly kind: 'resources' }
  | { readonly kind: 'glossary' };

export interface GuideChapter {
  readonly id: GuideChapterId;
  readonly number: number;
  readonly title: string;
  /** One sentence under the title: what the chapter is for. */
  readonly lede: string;
  /** The OSRS Wiki picture beside the title. */
  readonly icon: string;
  readonly blocks: readonly GuideBlock[];
}

export interface GuideNavGroup {
  readonly label: string;
  readonly chapterIds: readonly GuideChapterId[];
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
  readonly id: 'plugin-hub' | 'source' | 'support';
  readonly label: string;
  readonly description: string;
  readonly href: string;
}

/** The sidebar's cards below the status card, top to bottom, as the plugin names them. */
export const RUNELITE_SIDEBAR_CARD_TITLES = RUNELITE_SIDEBAR_CARDS;

/** The OSRS Wiki picture beside the guide's title: the plugin's own crystal key. */
export const RUNELITE_GUIDE_ICON = 'Crystal_key.png';

export const RUNELITE_GUIDE_NAV_GROUPS: readonly GuideNavGroup[] = [
  { label: 'Start here', chapterIds: ['start', 'sidebar'] },
  {
    label: 'The cards',
    chapterIds: ['status', 'here', 'strict-mode', 'run', 'roll-inbox', 'connection-and-backup'],
  },
  { label: 'In game', chapterIds: ['in-game', 'settings'] },
  { label: 'Help', chapterIds: ['troubleshooting', 'glossary'] },
];

export const RUNELITE_GUIDE_RESOURCES: readonly GuideExternalResource[] = [
  {
    id: 'plugin-hub',
    label: 'Fate Locked Ironman on the Plugin Hub',
    description: 'RuneLite’s own page for the plugin.',
    href: 'https://runelite.net/plugin-hub/show/fate-locked-ironman',
  },
  {
    id: 'source',
    label: 'The plugin’s source code',
    description: 'Every line RuneLite reviewed, in the open.',
    href: 'https://github.com/Nubles/OSRS-Fate-Locked-Runelite',
  },
  {
    id: 'support',
    label: 'Report a problem',
    description: 'Tell us what went wrong, without sharing your pairing page.',
    href: 'https://github.com/Nubles/OSRS-Fate-Locked/issues/new/choose',
  },
];

const callout = (
  id: string,
  marker: number,
  box: GuideBox,
  label: string,
  body: string,
): GuideCallout => ({ id, marker, box, label, body });

/** A state of the status card, drawn alone; the chapter says what each one means. */
const statusCard = (id: string, height: number, title: string): GuideFigure => ({
  id,
  src: `/guides/runelite/${id}.png`,
  source: 'rendered',
  title,
  alt: `The status card saying ${title}.`,
  width: 442,
  height,
  scale: 2,
  callouts: [],
});

export const RUNELITE_GUIDE_FIGURES: readonly GuideFigure[] = [
  {
    id: 'sidebar',
    src: '/guides/runelite/sidebar.png',
    source: 'rendered',
    title: 'The sidebar at a glance',
    alt: 'The Fate Locked sidebar: the crystal key and Open tracker, the status card saying Rules up to date, and the five cards, closed.',
    width: 450,
    height: 616,
    scale: 2,
    callouts: [
      callout('open-tracker', 1, [0.649, 0.026, 0.324, 0.091], 'Open tracker', 'Opens the companion in your browser.'),
      callout('status', 2, [0.027, 0.143, 0.947, 0.221], 'Status card', 'Whether your rules are current and for this character, and the one thing to do about it.'),
      callout('cards', 3, [0.027, 0.383, 0.947, 0.5], 'Five cards', 'Here, Strict Mode, Run, Roll inbox and Connection & backup. Each opens and closes on its own.'),
      callout('more-settings', 4, [0.027, 0.903, 0.947, 0.078], 'More settings', 'Everything else is in RuneLite’s configuration, under Fate Locked Ironman.'),
    ],
  },
  statusCard('status-up-to-date', 152, 'Rules up to date'),
  statusCard('status-not-connected', 256, 'Not connected'),
  statusCard('status-waiting', 248, 'Waiting for confirmation'),
  statusCard('status-out-of-date', 280, 'Rules may be out of date'),
  statusCard('status-expired', 248, 'Tracker copy expired'),
  statusCard('status-backup', 280, 'Using a backup'),
  statusCard('status-different-character', 184, 'Different character'),
  {
    id: 'companion-confirmation',
    src: '/guides/runelite/companion-confirmation.png',
    source: 'web-capture',
    title: 'Confirm the profile in the companion',
    alt: 'The companion’s Connect RuneLite tracker dialog for the fictional Iron Example profile, with Cancel and Connect tracker.',
    width: 896,
    height: 692,
    scale: 2,
    callouts: [
      callout('privacy', 1, [0.038, 0.273, 0.924, 0.169], 'Only your rules', 'RuneLite fetches the profile’s rules and uploads nothing.'),
      callout('profile', 2, [0.067, 0.525, 0.866, 0.048], 'Check the profile', 'Make sure this is the run you want RuneLite to follow.'),
      callout('confirm', 3, [0.692, 0.847, 0.27, 0.104], 'Connect tracker', 'Confirm once, then go back to RuneLite.'),
    ],
  },
  {
    id: 'here',
    src: '/guides/runelite/here.png',
    source: 'rendered',
    title: 'Here, in a locked place',
    alt: 'The Here card for Sorcerer’s Tower: Locked, Unlock Seers’ Village, the counts, the arrow pointing at the nearest Magic tree, and Skilling open at Woodcutting.',
    width: 442,
    height: 796,
    scale: 2,
    callouts: [
      callout('place', 1, [0.054, 0.075, 0.891, 0.04], 'Place and status', 'The place’s name, and its status in a word.'),
      callout('reason', 2, [0.054, 0.166, 0.891, 0.04], 'Why', 'The tracker’s reason, in its own words.'),
      callout('counts', 3, [0.054, 0.216, 0.891, 0.095], 'Counts', 'What you can do here, what isn’t ready yet, and what’s locked.'),
      callout('arrow', 4, [0.054, 0.322, 0.891, 0.06], 'Arrow', 'After you click a row: the game’s arrow points at the nearest one. Clear takes it down.'),
      callout('categories', 5, [0.054, 0.41, 0.891, 0.04], 'Categories', 'Each opens and closes, and says what it holds while closed.'),
      callout('skills', 6, [0.1, 0.465, 0.846, 0.04], 'Skills', 'Skilling opens skill by skill, with your level and cap.'),
    ],
  },
  {
    id: 'here-way',
    src: '/guides/runelite/here-way.png',
    source: 'rendered',
    title: 'The way to one you’ve seen',
    alt: 'The Here card saying Shortest Path shows the way to the nearest Magic tree you’ve seen in Sorcerer’s Tower, with Clear.',
    width: 442,
    height: 610,
    scale: 2,
    callouts: [
      callout('way', 1, [0.054, 0.42, 0.891, 0.118], 'The way', 'With none near you, the way to the nearest one you’ve seen. Clear takes the arrow, the pin and the route down.'),
    ],
  },
  {
    id: 'strict-mode',
    src: '/guides/runelite/strict-mode.png',
    source: 'rendered',
    title: 'Strict Mode, paused',
    alt: 'The Strict Mode card: switched on, Paused with 42 seconds left, a Resume button, and two recently stopped teleports.',
    width: 442,
    height: 286,
    scale: 2,
    callouts: [
      callout('switch', 1, [0.819, 0.028, 0.127, 0.182], 'On or off', 'The same switch as the setting.'),
      callout('pause', 2, [0.054, 0.21, 0.891, 0.168], 'Status and pause', 'Active, Paused, Off, or Inactive with why. While paused, Resume brings Strict Mode back at once.'),
      callout('stopped', 3, [0.054, 0.441, 0.891, 0.476], 'Recently stopped', 'The teleports it stopped, and when.'),
    ],
  },
  {
    id: 'run',
    src: '/guides/runelite/run.png',
    source: 'rendered',
    title: 'Run',
    alt: 'The Run card: Iron Example (you), 15 of 187 areas unlocked, 3 Keys, 1 Omni-Key, 0 Chaos Keys, 12 Fate Points and the Ritual of Clarity.',
    width: 442,
    height: 454,
    scale: 2,
    callouts: [
      callout('character', 1, [0.054, 0.132, 0.891, 0.07], 'Character', 'Whose run this is, with (you) when you’re logged in on it.'),
      callout('progress', 2, [0.054, 0.308, 0.891, 0.07], 'Progress', 'How much of the run you’ve unlocked.'),
      callout('keys', 3, [0.054, 0.454, 0.891, 0.3], 'Keys', 'Keys, Omni-Keys and Chaos Keys, as the companion counts them.'),
      callout('fate-points', 4, [0.054, 0.771, 0.891, 0.088], 'Fate Points', 'What your failed rolls have built up.'),
      callout('ritual', 5, [0.054, 0.877, 0.891, 0.07], 'Ritual', 'The ritual waiting on your next roll, if any.'),
    ],
  },
  {
    id: 'roll-inbox',
    src: '/guides/runelite/roll-inbox.png',
    source: 'rendered',
    title: 'Roll inbox',
    alt: 'The Roll inbox card: 3 new events, Attack Level 71 and Vorkath, a Gargoyles Slayer task that needs checking, and Cook’s Assistant, already copied. Below them, Copy for tracker, 1 active warning, and Open web Roll Inbox.',
    width: 442,
    height: 452,
    scale: 2,
    callouts: [
      callout('events', 1, [0.054, 0.133, 0.891, 0.075], 'New events', 'What RuneLite noticed this run, newest first, each with its own icon.'),
      callout('needs-checking', 2, [0.054, 0.319, 0.891, 0.075], 'Needs checking', 'The tracker asks you to confirm these before they roll.'),
      callout('copied', 3, [0.054, 0.412, 0.891, 0.075], 'Copied', 'Already copied. Pasting an event twice brings it in once.'),
      callout('copy', 4, [0.054, 0.504, 0.891, 0.106], 'Copy for tracker', 'Puts this run’s events on your clipboard, only when you click.'),
      callout('warnings', 5, [0.054, 0.628, 0.891, 0.071], 'Warnings', 'Rule warnings that apply right now.'),
      callout('open', 6, [0.054, 0.841, 0.891, 0.106], 'Open web Roll Inbox', 'Opens the tracker’s Roll Inbox, where you paste and roll.'),
    ],
  },
  {
    id: 'connection',
    src: '/guides/runelite/connection.png',
    source: 'rendered',
    title: 'Connection & backup',
    alt: 'The Connection & backup card: Online sync on, the pairing, Re-pair tracker, Disconnect, Check now, Import from clipboard and Load newest backup file.',
    width: 442,
    height: 560,
    scale: 2,
    callouts: [
      callout('sync', 1, [0.054, 0.107, 0.891, 0.057], 'Online sync', 'Turns the relay on or off. Your pairing is kept either way.'),
      callout('pairing', 2, [0.054, 0.25, 0.887, 0.086], 'Re-pair or disconnect', 'Re-pair tracker… pairs another profile; Disconnect forgets the pairing and keeps your rules as a backup.'),
      callout('check', 3, [0.054, 0.35, 0.891, 0.086], 'Check now', 'Asks for your rules at once.'),
      callout('backups', 4, [0.054, 0.525, 0.891, 0.186], 'Backups', 'Load your rules from the clipboard or a file, without the relay.'),
    ],
  },
];

/** What the guide says about each setting, beside what the contract fixes. */
const SETTING_PROSE: Readonly<Record<string, Pick<GuideSetting, 'purpose' | 'visibleResult' | 'changeWhen'>>> = {
  trackerNetworkAccess: {
    purpose: 'Lets RuneLite fetch your run’s rules from the Fate Locked relay. Connect tracker asks before turning it on.',
    visibleResult: 'The status card says Rules up to date and when they last synced. With it off, RuneLite never contacts the relay; backups still work.',
    changeWhen: 'Leave it on to keep your rules current. Turn it off to contact no server; your pairing is kept for later.',
  },
  strictMode: {
    purpose: 'Stops a teleport only when the tracker’s travel table matches it exactly and fresh rules for your character lock where it goes.',
    visibleResult: 'A stopped teleport shows a banner with the tracker’s reason and Pause 60s. The Strict Mode card says Active, Paused, Off, or Inactive with why.',
    changeWhen: 'Turn it on for a safety net against teleporting somewhere locked by mistake.',
  },
  pauseStrictModeHotkey: {
    purpose: 'Pauses Strict Mode for 60 seconds from the keyboard, like the Pause 60s button.',
    visibleResult: 'The Strict Mode card and the HUD count the pause down, then Strict Mode comes back by itself.',
    changeWhen: 'Set it if you pause often, on a key neither RuneLite nor the game uses.',
  },
  lockedAreaAlert: {
    purpose: 'What happens when you walk into a locked area: a chat line, and if you like, a sound and one short fade.',
    visibleResult: 'The chat line names the area and why it’s locked. The sound and fade come only when you arrive from unlocked land.',
    changeWhen: 'Pick Chat for a quieter run, or Off if the map and borders are enough.',
  },
  announceAreaChanges: {
    purpose: 'A chat line whenever you walk into another area the tracker maps, locked or not.',
    visibleResult: 'The chatbox names each new area and its status, once per area rather than once per chunk.',
    changeWhen: 'Turn it off if these lines crowd your chat; locked areas still alert.',
  },
  ruleWarnings: {
    purpose: 'Warns about a bank you haven’t unlocked, a Slayer task in locked areas, and gear above your unlocked tier.',
    visibleResult: 'A chat line when it happens; the Slayer and gear warnings also stay on the HUD while they apply.',
    changeWhen: 'Leave it on unless your run doesn’t lock banks, Slayer tasks or gear tiers.',
  },
  tagLockedOptions: {
    purpose: 'Adds (Locked) to right-click options on NPCs, objects, items on the ground and teleports your rules lock.',
    visibleResult: 'The tag follows the option in the locked colour. It only tells you; it never blocks a click.',
    changeWhen: 'Turn it off if you’d rather see menus as the game shows them.',
  },
  rollNudges: {
    purpose: 'A chat reminder when a level-up, quest, diary, boss kill or collection log entry may be worth a roll.',
    visibleResult: 'The reminder says what happened. It never rolls and never changes your run.',
    changeWhen: 'Turn it off if you roll in the companion on your own schedule.',
  },
  useNotifier: {
    purpose: 'Also sends locked-area alerts and rule warnings as RuneLite notifications.',
    visibleResult: 'They arrive however RuneLite delivers notifications, such as a tray message while the client is in the background.',
    changeWhen: 'Turn it on if you often play with RuneLite behind other windows.',
  },
  hudMode: {
    purpose: 'A box over the game. Compact shows where you are, its status and why, Strict Mode, and the nearest bank and shop.',
    visibleResult: 'Detailed adds your progress, Keys, Fate Points and what the place holds. On another character it says only that the run isn’t theirs.',
    changeWhen: 'Pick Detailed while planning a route, Compact for play, or Off for a clear screen.',
  },
  worldMapMode: {
    purpose: 'Shades locked land on the world map like fog, and in Chunked mode lightly fills the frontier.',
    visibleResult: 'Hovering a chunk shows its area and status, and with contents what it holds.',
    changeWhen: 'Drop the contents or the tooltip if the map feels busy; Off leaves the map as the game draws it.',
  },
  worldMapOutline: {
    purpose: 'A dashed line on the world map where your unlocked land meets locked land.',
    visibleResult: 'Off keeps the shading and the tooltip, without the line.',
    changeWhen: 'Turn it off if the lines make the map feel busy.',
  },
  worldMapMarkers: {
    purpose: 'A pin on each area you haven’t unlocked.',
    visibleResult: 'Clicking a pin moves the world map there.',
    changeWhen: 'Turn it on to see what’s left to unlock at a glance.',
  },
  chunkBorders: {
    purpose: 'Lines on the ground where chunks meet.',
    visibleResult: 'Locked edges are dashed over a dark underlay, fixed to the tiles, and hidden behind whatever stands in front. All edges adds a thin line between unlocked chunks.',
    changeWhen: 'Pick All edges while learning the chunk grid, or Off to leave the ground alone.',
  },
  shadeNearbyLocked: {
    purpose: 'Darkens a band of locked land along each locked edge, in the game view and on the minimap.',
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
    visibleResult: 'Each box has its own OSRS icon and moves on its own. One with nothing to count isn’t shown.',
    changeWhen: 'Turn it on to keep your Keys in sight without the Detailed HUD.',
  },
  colourPreset: {
    purpose: 'The plugin’s colours: the default set, a set safe for colour-blind players, or your own.',
    visibleResult: 'Changes every colour the plugin draws, in the sidebar, the HUD, the borders, the minimap and the world map.',
    changeWhen: 'Pick Colour-blind safe if red and green are hard to tell apart, or Custom to choose your own.',
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
    visibleResult: 'The status card says Using a backup, where the rules came from and when they were exported.',
    changeWhen: 'Set it if you copy rules from the companion often, for example with online sync off.',
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
    summary: 'What a new profile starts with: alerts in chat with a sound and fade, a Compact HUD, and Strict Mode off.',
    adjustments: [
      'Keep every default as it comes.',
      `${label('showInfoBoxes')}, ${label('worldMapMarkers')} and ${label('useNotifier')} stay off.`,
    ],
  },
  {
    id: 'high-visibility',
    title: 'Everything on',
    summary: 'For players who want the run in view all the time.',
    adjustments: [
      `Set ${label('hudMode')} to Detailed and ${label('chunkBorders')} to All edges.`,
      `Turn on ${label('showInfoBoxes')}, ${label('worldMapMarkers')} and ${label('useNotifier')}.`,
    ],
  },
  {
    id: 'minimal-screen',
    title: 'Clear screen',
    summary: 'The world map and the sidebar tell you everything; the game view stays clear.',
    adjustments: [
      `Set ${label('hudMode')} to Off and ${label('lockedAreaAlert')} to Chat.`,
      `Turn off ${label('shadeNearbyLocked')} and ${label('announceAreaChanges')}.`,
    ],
  },
  {
    id: 'strict-travel',
    title: 'Strict travel',
    summary: 'The defaults with Strict Mode on. It still fails open whenever it can’t be sure.',
    adjustments: [
      `Turn on ${label('strictMode')}.`,
      `Set a ${label('pauseStrictModeHotkey')} if you often need to go somewhere it would stop.`,
    ],
  },
];

export const RUNELITE_GUIDE_TROUBLESHOOTING: readonly GuideTroubleshootingItem[] = [
  {
    id: 'waiting-for-confirmation',
    symptom: 'The status card keeps saying Waiting for confirmation.',
    likelyCause: 'The profile hasn’t been confirmed in the page RuneLite opened, or was confirmed in an older page. After 10 minutes without one, the card says No profile arrived.',
    fix: [
      'Select Open page again, and confirm the profile in that page.',
      'Keep RuneLite open until the card says Rules up to date.',
      'To start over, select Cancel, then Connect tracker.',
    ],
  },
  {
    id: 'not-connected-or-sync-off',
    symptom: 'The status card says Not connected, or Online sync is off.',
    likelyCause: 'No profile is paired, or online sync is off, so RuneLite doesn’t contact the relay.',
    fix: [
      'For Not connected, select Connect tracker and confirm the profile.',
      'For Online sync is off, select Turn on online sync; your pairing is kept.',
      'To play without the relay, use a backup instead.',
    ],
  },
  {
    id: 'out-of-date-or-expired',
    symptom: 'The status card says Rules may be out of date, Tracker copy expired, or Tracker has older rules.',
    likelyCause: 'RuneLite couldn’t reach the relay for more than 15 minutes, the companion hasn’t sent your rules in 24 hours, or the relay has an older copy than yours. Your current rules stay in use.',
    fix: [
      'For Rules may be out of date, check your internet connection, then select Check now.',
      'For the others, select Open web tracker: opening your profile there sends the rules again.',
      'Strict Mode waits until the rules are fresh; everything else keeps working.',
    ],
  },
  {
    id: 'not-usable-or-update',
    symptom: 'The status card says Tracker rules not usable, Couldn’t apply the tracker’s rules, or Plugin update needed.',
    likelyCause: 'The companion sent rules this plugin couldn’t read, or in a newer format than it knows. Your current rules stay in use.',
    fix: [
      'For Plugin update needed, restart RuneLite to get the latest Fate Locked from the Plugin Hub.',
      'For the others, select Open web tracker to send the rules again.',
      'Never edit the rules by hand; a backup from the companion is always safe to import.',
    ],
  },
  {
    id: 'different-character',
    symptom: 'The status card says Different character.',
    likelyCause: 'The rules belong to another character than the one logged in, so warnings and Strict Mode are off and Here checks nothing.',
    fix: [
      'Log in on the character the card names.',
      'Or pair this character’s profile: Re-pair tracker… in Connection & backup.',
    ],
  },
  {
    id: 'here-empty',
    symptom: 'Here says Log in to see the place you’re standing in, or The tracker doesn’t map this place.',
    likelyCause: 'You aren’t logged in, or you’re somewhere the tracker leaves Uncharted, such as some dungeons and instances.',
    fix: [
      'Log in and step into the game world.',
      'In an instance, Here names the place it copies when the tracker maps it.',
    ],
  },
  {
    id: 'no-way-shown',
    symptom: 'Clicking a row in Here says it can’t find one near you.',
    likelyCause: 'None is loaded near you, and you haven’t been near one in that place since the plugin started remembering.',
    fix: [
      'Walk near one once; after that, clicking the row shows the way back.',
      'Inside an instance or on a boat, the way can’t be shown; step back onto the main map.',
    ],
  },
  {
    id: 'missing-display',
    symptom: 'The HUD, borders, minimap lines, world map shading or infoboxes don’t show.',
    likelyCause: 'The setting is off, the rules are for another character, or no rules are loaded yet.',
    fix: [
      'Open RuneLite’s configuration, select Fate Locked Ironman, and check the Display section.',
      'Check the status card: nothing is drawn for another character’s run.',
    ],
  },
  {
    id: 'tooltip-missing-content',
    symptom: 'The world map tooltip shows a chunk’s status but not what it holds.',
    likelyCause: `${label('worldMapMode')} is set to Shading and tooltip, or the tracker lists nothing in that chunk.`,
    fix: [
      `Set ${label('worldMapMode')} to Shading, tooltip and contents.`,
    ],
  },
  {
    id: 'clipboard-import',
    symptom: 'Import from clipboard doesn’t load your rules.',
    likelyCause: 'The clipboard doesn’t hold one complete copy of your rules from the companion.',
    fix: [
      'Copy the rules again in the companion.',
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
    ],
  },
  {
    id: 'strict-mode-allows-action',
    symptom: 'Strict Mode doesn’t stop a teleport you expected it to.',
    likelyCause: 'It stops only a trip the travel table matches exactly, to one place your rules lock, with fresh rules for your character. It fails open whenever it can’t be sure.',
    fix: [
      'Read the Strict Mode card: Inactive says what’s missing, such as fresh rules.',
      'The (Locked) tag and the locked-area alert still cover what Strict Mode leaves alone.',
    ],
  },
];

export const RUNELITE_GUIDE_GLOSSARY: readonly GuideGlossaryItem[] = [
  { term: RUNELITE_TERMS.UNLOCKED, definition: 'Your run can go there or do it.' },
  { term: RUNELITE_TERMS.CAN_DO, definition: 'Something in a place that your run can do now.' },
  {
    term: RUNELITE_TERMS.NOT_READY,
    definition: 'Unlocked, but waiting on something first: a quest, a level, or a way to get there.',
  },
  { term: RUNELITE_TERMS.LOCKED, definition: 'Your run hasn’t unlocked it yet.' },
  {
    term: RUNELITE_TERMS.NEEDS_CHECKING,
    definition: 'An event RuneLite noticed but can’t be sure of. The tracker asks you to confirm it before it rolls.',
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
    definition: 'The rules belong to another character than the one logged in; nothing is checked until you switch.',
  },
  {
    term: RUNELITE_TERMS.COPY_FOR_TRACKER,
    definition: 'The Roll inbox card’s button. It copies what RuneLite noticed, only when you click, and uploads nothing.',
  },
  {
    term: RUNELITE_TERMS.PASTE_FROM_RUNELITE,
    definition: 'The tracker’s Roll Inbox button that brings in what you copied, a row for each event to roll or skip.',
  },
  { term: RUNELITE_TERMS.NEW, definition: 'In the Roll inbox card, an event RuneLite noticed that you haven’t copied yet.' },
  {
    term: RUNELITE_TERMS.COPIED,
    definition: 'In the Roll inbox card, an event you’ve copied for the tracker. Pasting it twice brings it in once.',
  },
  {
    term: RUNELITE_TERMS.STRICT_MODE,
    definition: 'An optional guard, off by default, that stops a teleport only when the travel table matches it exactly and fresh rules lock where it goes.',
  },
  { term: RUNELITE_TERMS.KEYS, definition: 'Spend one on a table you choose for a random unlock from it.' },
  { term: RUNELITE_TERMS.OMNI_KEYS, definition: 'Spend one to choose the exact unlock you want.' },
  {
    term: RUNELITE_TERMS.CHAOS_KEYS,
    definition: 'Spend one for a random unlock from any table; you don’t choose the table.',
  },
  {
    term: RUNELITE_TERMS.FATE_POINTS,
    definition: 'What a failed roll gives instead of a Key. Enough of them bring a Pity Key, and rituals spend them.',
  },
  { term: 'Ritual of Clarity', definition: 'Your next roll is made twice, and the better result is kept.' },
  {
    term: 'Ritual of Greed',
    definition: 'If your next roll succeeds you get 2 Keys; if it fails, half the Fate Points come back.',
  },
  { term: 'Chunk', definition: 'A 64 by 64 tile square of the game map, the unit the tracker locks and unlocks.' },
  {
    term: 'Relay',
    definition: 'The one fixed Fate Locked service that hands RuneLite your paired profile’s rules. It sees your IP address, as any internet service does.',
  },
  { term: 'Backup', definition: 'Your rules copied from the companion to the clipboard or a file, for playing without the relay.' },
];

export const RUNELITE_GUIDE_CHAPTERS: readonly GuideChapter[] = [
  {
    id: 'start',
    number: 1,
    title: 'Get started',
    lede: 'Install the plugin, open its sidebar and connect it to your tracker. It takes about five minutes.',
    icon: 'Crystal_key.png',
    blocks: [
      {
        kind: 'steps',
        steps: [
          {
            title: 'Install it',
            body: 'In RuneLite, open the configuration (the wrench), choose Plugin Hub, search for Fate Locked Ironman and select Install. Updates arrive the same way, once RuneLite has reviewed them.',
          },
          {
            title: 'Open the sidebar',
            body: 'Select the crystal key in RuneLite’s sidebar. The status card at the top says Not connected.',
          },
          {
            title: 'Connect your tracker',
            body: 'Select Connect tracker. The first time, RuneLite asks to turn on online sync and warns that the relay sees your IP address. Your browser then opens the companion.',
          },
          {
            title: 'Confirm the profile',
            body: 'Check that the page names your run, then select Connect tracker. Keep RuneLite open while you do.',
          },
          {
            title: 'Play',
            body: 'Back in RuneLite, the status card says Rules up to date. Everything the plugin shows now comes from your run.',
          },
        ],
      },
      { kind: 'figure', figureId: 'companion-confirmation' },
      {
        kind: 'gallery',
        items: [
          { figureId: 'status-not-connected', title: 'Before', body: 'Connect tracker starts, or use a backup instead.' },
          { figureId: 'status-waiting', title: 'While you confirm', body: 'RuneLite checks every few seconds.' },
          { figureId: 'status-up-to-date', title: 'Done', body: 'Your rules are loaded and current.' },
        ],
      },
      {
        kind: 'note',
        title: 'It only reads your run',
        text: 'RuneLite downloads your run’s rules and does not upload gameplay data. It never rolls, spends Keys or unlocks anything: the companion is still where your run changes.',
      },
      {
        kind: 'text',
        text: 'Rather not use the relay, or playing offline? Load your rules from a backup instead; Connection & backup shows how.',
      },
    ],
  },
  {
    id: 'sidebar',
    number: 2,
    title: 'The sidebar at a glance',
    lede: 'A status card at the top, then five cards that open and close.',
    icon: 'Stats_icon.png',
    blocks: [
      { kind: 'figure', figureId: 'sidebar' },
      {
        kind: 'terms',
        items: [
          { term: 'Here', text: 'Your rules for the place you’re standing in. It starts open.' },
          { term: 'Strict Mode', text: 'The optional guard against teleporting somewhere locked.' },
          { term: 'Run', text: 'Your progress, Keys and Fate Points.' },
          { term: 'Roll inbox', text: 'Things you did in game that may be worth a roll.' },
          { term: 'Connection & backup', text: 'Online sync, your pairing and backups.' },
        ],
      },
      {
        kind: 'text',
        text: 'Opening or closing a card never changes your settings or your run, and what you leave open stays open.',
      },
    ],
  },
  {
    id: 'status',
    number: 3,
    title: 'The status card',
    lede: 'Read it first when something looks wrong: it says what state your rules are in, and the one thing to do.',
    icon: 'Achievement_Diaries_icon.png',
    blocks: [
      {
        kind: 'gallery',
        items: [
          { figureId: 'status-up-to-date', title: 'Rules up to date', body: 'Synced recently, for this character. Nothing to do.' },
          { figureId: 'status-out-of-date', title: 'Rules may be out of date', body: 'RuneLite couldn’t check for more than 15 minutes. Your rules stay in use; Strict Mode waits.' },
          { figureId: 'status-expired', title: 'Tracker copy expired', body: 'The companion hasn’t sent your rules in 24 hours. Open it to send them again.' },
          { figureId: 'status-backup', title: 'Using a backup', body: 'Rules from the clipboard or a file. Connect tracker goes back to the relay.' },
          { figureId: 'status-different-character', title: 'Different character', body: 'The rules are another character’s, so warnings and Strict Mode are off.' },
          { figureId: 'status-not-connected', title: 'Not connected', body: 'Connect your tracker, or use a backup instead.' },
        ],
      },
      {
        kind: 'text',
        text: 'You may also see Waiting for confirmation, No profile arrived, Online sync is off, Tracker has older rules, Tracker rules not usable, Couldn’t apply the tracker’s rules or Plugin update needed. In every case your current rules stay in use, and the card’s button is the fix. Troubleshooting has more on each.',
      },
    ],
  },
  {
    id: 'here',
    number: 4,
    title: 'Here',
    lede: 'Your rules for the place you’re standing in, and a way to find what’s there.',
    icon: 'World_map_icon.png',
    blocks: [
      { kind: 'figure', figureId: 'here' },
      {
        kind: 'terms',
        items: [
          { term: RUNELITE_TERMS.CAN_DO, text: 'Your run can do it now.' },
          { term: RUNELITE_TERMS.NOT_READY, text: 'Unlocked, but waiting on something first, such as a quest or a level.' },
          { term: RUNELITE_TERMS.LOCKED, text: 'Your run hasn’t unlocked it.' },
          { term: RUNELITE_TERMS.UNCHARTED, text: 'The tracker doesn’t map this place, so nothing is checked.' },
        ],
      },
      {
        kind: 'text',
        text: 'Where the tracker can’t see a requirement, such as a quest you’ve started, quest points, a free-to-play world or a light source you carry, RuneLite checks it in game. A row that isn’t ready names only what’s left.',
      },
      { kind: 'heading', text: 'Find it' },
      {
        kind: 'text',
        text: 'Click a skilling spot, monster, bank or shop and the game’s own arrow points at the nearest one around you. It comes down when you get there, when you click the row again or select Clear, or when you leave the chunk.',
      },
      { kind: 'figure', figureId: 'here-way' },
      {
        kind: 'text',
        text: 'With none near enough to be loaded, the card shows the way to the nearest one you’ve seen in that place. The arrow goes on that spot, your minimap points toward it and the world map has a pin. If you run the Shortest Path plugin from the Plugin Hub, it draws the walking route too. The way stays up as you cross other chunks, and the arrow moves onto the thing itself once it comes into view.',
      },
      {
        kind: 'note',
        title: 'Remembered on your computer',
        text: 'The plugin notes where you’ve seen things as you play, and keeps it on your computer; nothing is sent anywhere. Somewhere you’ve never been near, it can’t show the way yet.',
      },
    ],
  },
  {
    id: 'strict-mode',
    number: 5,
    title: 'Strict Mode',
    lede: 'An optional safety net against teleporting somewhere your rules lock.',
    icon: 'Magic_icon.png',
    blocks: [
      {
        kind: 'text',
        text: 'Strict Mode is off by default. Turn it on with the switch on its card, or in the settings.',
      },
      { kind: 'figure', figureId: 'strict-mode' },
      { kind: 'heading', text: 'What it stops' },
      {
        kind: 'list',
        items: [
          'A spell, tablet, scroll or teleport item option that the tracker’s travel table matches exactly, going to one place your rules lock.',
          'Only with fresh rules for the character you’re on.',
        ],
      },
      { kind: 'heading', text: 'What it never stops' },
      {
        kind: 'list',
        items: [
          'Walking, and clicks on NPCs, objects, banks and equipment.',
          'An option that picks its place after the click, such as a jewellery Rub.',
          'Fairy rings, spirit trees, charters and boats. These get the (Locked) tag instead.',
          'Anything when the rules are stale, for another character, or don’t decide the trip. Strict Mode fails open rather than guessing.',
        ],
      },
      {
        kind: 'text',
        text: 'When it stops a teleport, a banner over the game gives the tracker’s reason with a Pause 60s button. A pause lets every click through for 60 seconds, from the banner, the card or an optional hotkey, and the HUD counts it down.',
      },
    ],
  },
  {
    id: 'run',
    number: 6,
    title: 'Run',
    lede: 'Whose run this is, how far it has come, and what it holds.',
    icon: 'Brass_key.png',
    blocks: [
      { kind: 'figure', figureId: 'run' },
      {
        kind: 'terms',
        items: [
          { term: RUNELITE_TERMS.KEYS, text: 'Choose a table; Fate picks the unlock from it.' },
          { term: RUNELITE_TERMS.OMNI_KEYS, text: 'Choose the exact unlock.' },
          { term: RUNELITE_TERMS.CHAOS_KEYS, text: 'A random unlock from any table.' },
          { term: RUNELITE_TERMS.FATE_POINTS, text: 'What a failed roll gives. Enough of them bring a Pity Key, and rituals spend them.' },
        ],
      },
      {
        kind: 'text',
        text: 'The card only reads your run. Rolling, spending Keys and unlocking all happen in the companion.',
      },
    ],
  },
  {
    id: 'roll-inbox',
    number: 7,
    title: 'Roll inbox',
    lede: 'What you did in game that may be worth a roll, ready to copy to the tracker.',
    icon: 'Mystery_box.png',
    blocks: [
      { kind: 'figure', figureId: 'roll-inbox' },
      {
        kind: 'text',
        text: 'RuneLite notices level-ups, quests, achievement diaries, combat tasks, boss and raid kills, clue scrolls, collection log entries and Slayer tasks. It keeps the last 30 days on this computer, up to 250 events. The card lists the newest and counts the rest.',
      },
      { kind: 'heading', text: 'Rolling what RuneLite noticed' },
      {
        kind: 'steps',
        steps: [
          {
            title: `Select ${RUNELITE_TERMS.COPY_FOR_TRACKER}`,
            body: 'RuneLite puts this run’s events on your clipboard, and they show as Copied.',
          },
          {
            title: `Choose ${RUNELITE_TERMS.PASTE_FROM_RUNELITE}`,
            body: 'In the tracker’s Roll Inbox, each event becomes a row to roll or skip. Skip any you’ve already logged by hand.',
          },
        ],
      },
      {
        kind: 'text',
        text: 'Needs checking marks an event the tracker asks you to confirm first, such as which master gave a Slayer task. Dismiss (×) takes an event off the card. If your run isn’t linked to a character, the card and the tracker both say which character the events came from.',
      },
      {
        kind: 'note',
        title: 'Only when you click',
        text: 'Copy for tracker uses your clipboard, never the relay, and RuneLite doesn’t upload anything. Noticing an event never rolls or changes your run, and logging by hand in the tracker works as it always has.',
      },
    ],
  },
  {
    id: 'connection-and-backup',
    number: 8,
    title: 'Connection & backup',
    lede: 'Online sync, your pairing, and ways to load your rules without the relay.',
    icon: 'Friends_List.png',
    blocks: [
      { kind: 'figure', figureId: 'connection' },
      {
        kind: 'text',
        text: 'Disconnect forgets the pairing and keeps the rules you have as a backup. RuneLite also keeps the last rules it accepted, and uses them when it starts, even offline.',
      },
      { kind: 'heading', text: 'Without the relay' },
      {
        kind: 'steps',
        steps: [
          {
            title: 'From the clipboard',
            body: 'Copy your rules in the companion, then select Import from clipboard, or press the import hotkey if you’ve set one.',
          },
          {
            title: 'From a file',
            body: 'Save your rules from the companion as fate-locked-bundle-*.json in %USERPROFILE%\\.runelite\\fate-locked\\ on Windows, then select Load newest backup file.',
          },
        ],
      },
      {
        kind: 'text',
        text: 'A backup that can’t be read, is older than yours, or is for another run keeps the rules you had.',
      },
      {
        kind: 'note',
        title: 'Your privacy',
        text: 'RuneLite contacts one fixed Fate Locked relay, and only to fetch your rules. The relay sees your IP address, as any internet service does. RuneLite does not upload gameplay data. Your pairing page is private: leave it out of screenshots and support messages.',
      },
    ],
  },
  {
    id: 'in-game',
    number: 9,
    title: 'In game',
    lede: 'Your rules drawn where you play. Each part has its own setting, and every one can be turned off.',
    icon: 'Compass.png',
    blocks: [
      {
        kind: 'terms',
        items: [
          {
            term: 'Chunk borders',
            text: 'Dashed lines on the ground where locked land starts, over a dark underlay so they read on any ground. The dashes are fixed to the tiles, and whatever stands in front of a line, such as a tree, a wall or you, hides it. All edges adds a thin line between unlocked chunks too.',
          },
          { term: 'Shade', text: 'A band of shade two tiles deep on the locked side of each locked edge.' },
          { term: 'Minimap', text: 'The same edges on the minimap, and locked land shaded.' },
          {
            term: 'World map',
            text: 'Locked land shaded like fog and your unlocked land outlined; in Chunked mode, a light fill on the frontier. Hover a chunk for its area and status, and what it holds if you like. The outline has its own switch, and pins on locked areas are optional.',
          },
          {
            term: 'HUD',
            text: 'A box over the game. Compact shows where you are, its status and why, Strict Mode, and the nearest bank and shop. Detailed adds your progress, Keys, Fate Points and what the place holds.',
          },
          {
            term: 'Alerts',
            text: 'Walking into a locked area posts a chat line naming it and why, and if you like a sound and one short fade. The same area alerts again only after a minute.',
          },
          { term: 'Menu tags', text: '(Locked) after right-click options your rules lock. It never blocks a click.' },
          {
            term: 'Warnings',
            text: 'A chat line for a bank you haven’t unlocked, a Slayer task in locked areas, and gear above your unlocked tier.',
          },
          { term: 'Infoboxes', text: 'Boxes for Keys, Fate Points and progress, each with its OSRS icon.' },
        ],
      },
      {
        kind: 'text',
        text: 'All of it uses one set of colours: Default, Colour-blind safe, or your own. Nothing is drawn or checked for another character’s run.',
      },
    ],
  },
  {
    id: 'settings',
    number: 10,
    title: 'Settings',
    lede: `All ${RUNELITE_SETTINGS.length} settings, in RuneLite’s configuration under Fate Locked Ironman.`,
    icon: 'Hammer.png',
    blocks: [
      {
        kind: 'text',
        text: 'Open RuneLite’s configuration (the wrench) and select Fate Locked Ironman; its sections follow the sidebar. Settings change only what RuneLite shows and how it warns you. They never unlock anything, roll or change your run.',
      },
      { kind: 'settings' },
      { kind: 'heading', text: 'Suggested setups' },
      { kind: 'presets' },
    ],
  },
  {
    id: 'troubleshooting',
    number: 11,
    title: 'Troubleshooting',
    lede: 'Start with the status card: its title and its button explain most problems.',
    icon: 'Herblore_icon.png',
    blocks: [
      { kind: 'troubleshooting' },
      { kind: 'heading', text: 'Links' },
      { kind: 'resources' },
    ],
  },
  {
    id: 'glossary',
    number: 12,
    title: 'Glossary',
    lede: 'The words the plugin and the companion share, and what they mean.',
    icon: 'Quest_point_icon.png',
    blocks: [{ kind: 'glossary' }],
  },
];
