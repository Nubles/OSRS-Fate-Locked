export const RUNELITE_GUIDE_CHAPTER_IDS = [
  'what-it-does',
  'install-plugin-hub',
  'connect-tracker',
  'connection-privacy',
  'unified-panel',
  'current-chunk',
  'guardian',
  'roll-inbox',
  'run-and-keys',
  'bundle-recovery',
  'warnings',
  'rendering',
  'in-game-overlays',
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

export interface GuideScreenshot {
  readonly id: string;
  readonly src: string;
  readonly title: string;
  readonly alt: string;
  readonly callouts: readonly GuideCallout[];
}

export interface GuideSetting {
  readonly key: string;
  readonly section: 'Bundle' | 'Guardian' | 'Warnings' | 'Rendering';
  readonly label: string;
  readonly defaultValue: string;
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
  readonly settingsSection?: GuideSetting['section'];
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

export const RUNELITE_PANEL_SECTIONS = [
  'Current chunk',
  'Guardian',
  'Roll inbox',
  'Run',
  'Bundle',
  'Warnings',
  'Rendering',
] as const;

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
    id: 'panel-disconnected',
    src: '/guides/runelite/02-panel-disconnected.png',
    title: 'Start a tracker connection',
    alt: 'Fate Locked RuneLite sidebar waiting for a tracker profile to be connected.',
    callouts: [
      callout(
        'connect-button',
        1,
        0.5,
        0.24,
        'Connect tracker',
        'Select this once. RuneLite opens the companion in your browser with a private one-time request.',
      ),
      callout(
        'connection-state',
        2,
        0.67,
        0.36,
        'Waiting for tracker',
        'Keep RuneLite open while the browser page is waiting for you to confirm a profile.',
      ),
    ],
  },
  {
    id: 'companion-confirmation',
    src: '/guides/runelite/03-companion-confirmation.png',
    title: 'Confirm the profile in the companion',
    alt: 'Fate Locked companion confirmation for a fictional unbound Vanilla profile, with the private request hidden.',
    callouts: [
      callout(
        'profile',
        1,
        0.72,
        0.44,
        'Check the profile',
        'Make sure this is the run whose rules you want RuneLite to display before confirming.',
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
        'Confirm once, return to RuneLite, and wait for Connected to appear.',
      ),
    ],
  },
  {
    id: 'panel-connected',
    src: '/guides/runelite/04-panel-connected.png',
    title: 'Verify a successful connection',
    alt: 'Fate Locked RuneLite panel showing Connected, a last sync time, and synced rules.',
    callouts: [
      callout(
        'connected',
        1,
        0.69,
        0.29,
        'Connected',
        'Connected means RuneLite has accepted a valid bundle from the fixed Fate Locked relay.',
      ),
      callout(
        'last-sync',
        2,
        0.65,
        0.45,
        'Last sync',
        'This time changes after a valid refresh. It is the quickest way to check whether new tracker rules arrived.',
      ),
      callout(
        'synced-rules',
        3,
        0.26,
        0.55,
        'Synced rules',
        'This summary confirms RuneLite imported authored rule data without uploading gameplay.',
      ),
    ],
  },
  {
    id: 'unified-panel',
    src: '/guides/runelite/05-unified-panel.png',
    title: 'One plugin, one unified panel',
    alt: 'Complete Fate Locked RuneLite sidebar with connection summary and collapsible sections.',
    callouts: [
      callout(
        'connection-summary',
        1,
        0.5,
        0.21,
        'Connection summary',
        'The top of the panel always shows whether rules are current before you rely on warnings or overlays.',
      ),
      callout(
        'current-chunk',
        2,
        0.23,
        0.52,
        'Current chunk',
        'This section follows your in-game location and explains what the current rules allow there.',
      ),
      callout(
        'guardian',
        3,
        0.2,
        0.63,
        'Guardian',
        'Guardian contains optional Strict Mode and its shared temporary pause.',
      ),
      callout(
        'more-sections',
        4,
        0.2,
        0.91,
        'Independent sections',
        'Roll inbox, Run, Bundle, Warnings, and Rendering expand or collapse without opening another panel.',
      ),
    ],
  },
  {
    id: 'current-chunk',
    src: '/guides/runelite/06-current-chunk.png',
    title: 'Read Current chunk',
    alt: 'Current chunk section showing the signed-out prompt to enter the game.',
    callouts: [
      callout(
        'chunk-section',
        1,
        0.23,
        0.48,
        'Current chunk heading',
        'Expand or collapse this section independently. It starts expanded.',
      ),
      callout(
        'signed-out-prompt',
        2,
        0.5,
        0.73,
        'Enter the game',
        'Before RuneLite has a player location, the panel correctly asks you to enter the game.',
      ),
    ],
  },
  {
    id: 'guardian',
    src: '/guides/runelite/07-guardian.png',
    title: 'Guardian and Strict Mode',
    alt: 'Guardian section with Strict Mode enabled, Guardian status On, and a 60-second pause button.',
    callouts: [
      callout(
        'strict-mode',
        1,
        0.36,
        0.48,
        'Strict Mode',
        'Strict Mode is optional and off by default. Enable it only when you want proven locked actions prevented.',
      ),
      callout(
        'guardian-state',
        2,
        0.66,
        0.65,
        'Guardian status',
        'On means Strict Mode is active and not currently paused.',
      ),
      callout(
        'pause',
        3,
        0.52,
        0.84,
        'Pause for 60 seconds',
        'The shared pause affects every Strict Mode category and resumes automatically.',
      ),
    ],
  },
  {
    id: 'roll-inbox',
    src: '/guides/runelite/08-roll-inbox.png',
    title: 'Roll inbox counters',
    alt: 'Expanded Roll inbox with local events, needs review, and warnings counts.',
    callouts: [
      callout(
        'roll-inbox-header',
        1,
        0.24,
        0.62,
        'Roll inbox',
        'This history is local to RuneLite and keeps the newest 250 unique observations.',
      ),
      callout(
        'review-count',
        2,
        0.52,
        0.86,
        'Needs review',
        'Ambiguous observations wait for you here. Detection never rolls or changes tracker progression.',
      ),
    ],
  },
  {
    id: 'run-keys',
    src: '/guides/runelite/09-run-keys.png',
    title: 'Run and key balances',
    alt: 'Expanded Run section showing regular Keys, Omni Keys, and Chaos Keys for a fictional demo profile.',
    callouts: [
      callout(
        'run-header',
        1,
        0.17,
        0.28,
        'Run',
        'Profile, Account, Run ID, Fate, Buff, Goal, and balances are read-only context from the tracker bundle.',
      ),
      callout(
        'keys',
        2,
        0.5,
        0.7,
        'Keys',
        'Spend one on a chosen table for a random eligible unlock.',
      ),
      callout(
        'omni-keys',
        3,
        0.53,
        0.82,
        'Omni Keys',
        'Spend one to choose the exact eligible unlock you want.',
      ),
      callout(
        'chaos-keys',
        4,
        0.54,
        0.94,
        'Chaos Keys',
        'Spend one for a random eligible unlock from any table; you do not choose the table.',
      ),
    ],
  },
  {
    id: 'bundle-recovery',
    src: '/guides/runelite/10-bundle-recovery.png',
    title: 'Bundle recovery controls',
    alt: 'Bundle section with auto-reload, re-import hotkey, and Import from clipboard controls.',
    callouts: [
      callout(
        'auto-reload',
        1,
        0.46,
        0.58,
        'Auto-reload on change',
        'RuneLite watches for the newest matching bundle in its Fate Locked recovery folder.',
      ),
      callout(
        'hotkey',
        2,
        0.77,
        0.75,
        'Re-import hotkey',
        'Set an optional shortcut if you regularly copy a fresh bundle from the companion.',
      ),
      callout(
        'clipboard-import',
        3,
        0.5,
        0.93,
        'Import from clipboard',
        'Use this recovery path only when the normal connected relay refresh is unavailable.',
      ),
    ],
  },
  {
    id: 'warnings',
    src: '/guides/runelite/11-warnings.png',
    title: 'Warnings controls',
    alt: 'Warnings section showing enabled chat and locked-chunk warning controls.',
    callouts: [
      callout(
        'warnings-header',
        1,
        0.25,
        0.5,
        'Warnings',
        'Each warning channel can be tuned without changing the tracker run.',
      ),
      callout(
        'chat-on-entry',
        2,
        0.42,
        0.68,
        'Chat on chunk entry',
        'Posts a small location message whenever you cross into a new chunk.',
      ),
      callout(
        'locked-chunk',
        3,
        0.48,
        0.83,
        'Warn entering locked chunk',
        'Adds strong feedback when the imported rules mark your destination Locked.',
      ),
    ],
  },
  {
    id: 'rendering',
    src: '/guides/runelite/12-rendering.png',
    title: 'Rendering controls',
    alt: 'Rendering section showing world map, player scene, minimap, and locked-border controls.',
    callouts: [
      callout(
        'rendering-header',
        1,
        0.24,
        0.43,
        'Rendering',
        'These options change only what RuneLite draws; they do not unlock or roll anything.',
      ),
      callout(
        'world-map',
        2,
        0.43,
        0.59,
        'World map',
        'Tint authored chunks on RuneLite’s full world map.',
      ),
      callout(
        'player-outline',
        3,
        0.44,
        0.73,
        'Around player',
        'Tint the current chunk in the main game scene.',
      ),
      callout(
        'minimap',
        4,
        0.42,
        0.87,
        'Minimap',
        'Tint the current chunk on the minimap.',
      ),
    ],
  },
  {
    id: 'world-map-tooltip',
    src: '/guides/runelite/13-world-map-tooltip.png',
    title: 'World-map tooltip and colors',
    alt: 'Actual RuneLite rendering controls for the world-map hover tooltip and overlay colors.',
    callouts: [
      callout(
        'world-map-tooltip',
        1,
        0.48,
        0.39,
        'World map hover tooltip',
        'Hover an authored chunk to see its area name and lock status.',
      ),
      callout(
        'chunk-detail-tooltip',
        2,
        0.49,
        0.5,
        'What is in the chunk',
        'Keep this on to add monsters, shops, farming patches, and points of interest.',
      ),
      callout(
        'overlay-colors',
        3,
        0.5,
        0.8,
        'Overlay colors',
        'Unlocked, Frontier, Locked, and Unauthored each have their own translucent color.',
      ),
    ],
  },
  {
    id: 'scene-minimap-hud',
    src: '/guides/runelite/14-scene-minimap-hud.png',
    title: 'Scene and minimap controls',
    alt: 'Actual RuneLite controls that enable the world map, player scene, minimap, and border overlays.',
    callouts: [
      callout(
        'draw-world-map',
        1,
        0.42,
        0.56,
        'Draw on world map',
        'The full world map can stay visible even when optional screen elements are reduced.',
      ),
      callout(
        'draw-player',
        2,
        0.42,
        0.7,
        'Draw around player',
        'This controls the main game-scene tint around your current chunk.',
      ),
      callout(
        'draw-minimap',
        3,
        0.42,
        0.84,
        'Draw on minimap',
        'This controls the matching minimap tint.',
      ),
    ],
  },
];

export const RUNELITE_GUIDE_SETTINGS: readonly GuideSetting[] = [
  {
    key: 'autoReload',
    section: 'Bundle',
    label: 'Auto-reload on change',
    defaultValue: 'On',
    purpose: 'Reload the newest matching Fate Locked bundle file when it changes.',
    visibleResult: 'Valid exported rule changes appear in the panel without another manual import.',
    changeWhen: 'Turn it off if you keep unrelated or old matching exports in the recovery folder.',
  },
  {
    key: 'reimportHotkey',
    section: 'Bundle',
    label: 'Re-import hotkey',
    defaultValue: 'Not set',
    purpose: 'Import the current clipboard bundle without opening the sidebar.',
    visibleResult: 'Pressing your chosen shortcut attempts the same safe clipboard import as the panel button.',
    changeWhen: 'Set it when clipboard recovery is part of your regular workflow; avoid a shortcut used by RuneLite or the game.',
  },
  {
    key: 'strictMode',
    section: 'Guardian',
    label: 'Strict Mode',
    defaultValue: 'Off',
    purpose: 'Prevent only fresh, exact, account-bound actions that the current rules prove Locked.',
    visibleResult: 'A proven locked click is consumed and explained; uncertain cases are allowed.',
    changeWhen: 'Enable it when you want an extra travel safety net. Leave it off for advisory warnings only.',
  },
  {
    key: 'chatOnEnter',
    section: 'Warnings',
    label: 'Chat on chunk entry',
    defaultValue: 'On',
    purpose: 'Post a chat line each time you enter a new chunk.',
    visibleResult: 'The chatbox names the new chunk or area after a boundary crossing.',
    changeWhen: 'Turn it off if routine boundary messages make the chatbox too busy.',
  },
  {
    key: 'warnOnLocked',
    section: 'Warnings',
    label: 'Warn entering locked chunk',
    defaultValue: 'On',
    purpose: 'Warn when you step into territory the imported rules mark Locked.',
    visibleResult: 'A strong red warning appears on locked entry.',
    changeWhen: 'Keep it on for normal play; turn it off only if another warning channel is enough.',
  },
  {
    key: 'warnLockedBank',
    section: 'Warnings',
    label: 'Warn opening a locked bank',
    defaultValue: 'On',
    purpose: 'Warn bank-locked runs about a bank or deposit box not unlocked in the tracker.',
    visibleResult: 'A chat warning appears when the bank interaction conflicts with the imported rules.',
    changeWhen: 'Turn it off only for runs that do not use bank restrictions.',
  },
  {
    key: 'flashOnLocked',
    section: 'Warnings',
    label: 'Screen flash on locked entry',
    defaultValue: 'On',
    purpose: 'Make locked territory immediately visible during movement.',
    visibleResult: 'A red border pulses around the game viewport.',
    changeWhen: 'Turn it off for a calmer display or if flashes are uncomfortable.',
  },
  {
    key: 'warnAccountMismatch',
    section: 'Warnings',
    label: 'Warn on wrong account',
    defaultValue: 'On',
    purpose: 'Detect when the logged-in character differs from the account bound to the bundle.',
    visibleResult: 'A chat warning explains the account mismatch.',
    changeWhen: 'Keep it on whenever a run is account-bound.',
  },
  {
    key: 'tagLockedMenus',
    section: 'Warnings',
    label: 'Tag locked right-click targets',
    defaultValue: 'On',
    purpose: 'Mark NPC and object menu entries that stand in locked chunks.',
    visibleResult: 'Affected right-click entries gain a red (LOCKED) tag.',
    changeWhen: 'Turn it off if you prefer clean menus and rely on map or scene warnings.',
  },
  {
    key: 'tagLockedTeleports',
    section: 'Warnings',
    label: 'Tag teleports to locked chunks',
    defaultValue: 'On',
    purpose: 'Mark teleport options whose known destination is locked.',
    visibleResult: 'Spells, jewellery, and tablet menu options can gain a red (LOCKED) tag.',
    changeWhen: 'Keep it on for travel safety; turn it off if destination tags crowd your menus.',
  },
  {
    key: 'showHud',
    section: 'Warnings',
    label: 'Show in-game HUD',
    defaultValue: 'On',
    purpose: 'Show run balances, active buff, goal, and current chunk status in game.',
    visibleResult: 'A compact movable HUD appears over the game view.',
    changeWhen: 'Turn it off for a minimal screen while keeping panel and map information.',
  },
  {
    key: 'showNearest',
    section: 'Warnings',
    label: 'HUD: nearest bank & shop',
    defaultValue: 'On',
    purpose: 'Add hints for the closest unlocked bank and shop.',
    visibleResult: 'The HUD shows straight-line chunk-distance hints, not walking routes.',
    changeWhen: 'Turn it off if you do not need navigation hints or the HUD needs to stay compact.',
  },
  {
    key: 'showChunkContentBox',
    section: 'Warnings',
    label: 'Show "in this chunk" box',
    defaultValue: 'Off',
    purpose: 'List the current chunk’s monsters, shops, farming patches, and points of interest.',
    visibleResult: 'A separate draggable content box appears in the game view.',
    changeWhen: 'Enable it while learning an area; leave it off when screen space matters.',
  },
  {
    key: 'useNotifier',
    section: 'Warnings',
    label: 'Send RuneLite notifications',
    defaultValue: 'Off',
    purpose: 'Use RuneLite’s native tray, sound, or desktop notification channel for important warnings.',
    visibleResult: 'Locked entry, slayer, gear, and wrong-account events follow your global RuneLite notification settings.',
    changeWhen: 'Enable it when RuneLite is not always focused or native alerts are easier to notice.',
  },
  {
    key: 'warnLockedSlayer',
    section: 'Warnings',
    label: 'Warn on locked slayer task',
    defaultValue: 'On',
    purpose: 'Warn when the assigned slayer monster only lives in locked chunks.',
    visibleResult: 'Chat and HUD explain the locked task conflict.',
    changeWhen: 'Keep it on for normal progression; turn it off only if your run does not restrict slayer locations.',
  },
  {
    key: 'warnOverTierGear',
    section: 'Warnings',
    label: 'Warn on over-tier gear',
    defaultValue: 'On',
    purpose: 'Compare equipped items with the unlocked tier for each slot.',
    visibleResult: 'Chat and HUD warn when an item is above the imported slot tier.',
    changeWhen: 'Keep it on for tiered-equipment runs; turn it off if equipment tiers are not part of the rules.',
  },
  {
    key: 'showInfoBoxes',
    section: 'Warnings',
    label: 'Show key/fate/progress infoboxes',
    defaultValue: 'Off',
    purpose: 'Add native RuneLite infoboxes for Keys, Fate, and unlock progress.',
    visibleResult: 'Dockable counters appear in RuneLite’s normal infobox row.',
    changeWhen: 'Enable them for at-a-glance totals without opening the sidebar.',
  },
  {
    key: 'rollNudges',
    section: 'Warnings',
    label: 'Roll reminders',
    defaultValue: 'On',
    purpose: 'Remind you when a completed activity may make a tracker roll worthwhile.',
    visibleResult: 'Chat reminders follow relevant levels, journal progress, bosses, raids, and collection-log events.',
    changeWhen: 'Turn it off if you already track roll opportunities yourself.',
  },
  {
    key: 'drawWorldMap',
    section: 'Rendering',
    label: 'Draw on world map',
    defaultValue: 'On',
    purpose: 'Tint authored chunks on RuneLite’s full world map.',
    visibleResult: 'Unlocked, locked, frontier, and unauthored areas use their configured colors.',
    changeWhen: 'Turn it off if you want a completely unmodified full world map.',
  },
  {
    key: 'drawScene',
    section: 'Rendering',
    label: 'Draw around player',
    defaultValue: 'On',
    purpose: 'Tint the current chunk in the main game scene.',
    visibleResult: 'The game view shows the current chunk boundary around the player.',
    changeWhen: 'Turn it off when scene tint is distracting but keep map or minimap layers enabled.',
  },
  {
    key: 'drawMinimap',
    section: 'Rendering',
    label: 'Draw on minimap',
    defaultValue: 'On',
    purpose: 'Tint the current chunk on the minimap.',
    visibleResult: 'The minimap mirrors the current chunk’s rule color.',
    changeWhen: 'Turn it off for a clean minimap while retaining other rendering layers.',
  },
  {
    key: 'highlightLockedBorders',
    section: 'Rendering',
    label: 'Highlight locked borders',
    defaultValue: 'On',
    purpose: 'Outline current-chunk edges that border a locked chunk.',
    visibleResult: 'Locked exits gain a stronger boundary line.',
    changeWhen: 'Turn it off if nearby shading already gives enough boundary information.',
  },
  {
    key: 'shadeNearbyLocked',
    section: 'Rendering',
    label: 'Shade nearby locked chunks',
    defaultValue: 'On',
    purpose: 'Tint all visible nearby locked chunks, not only the current one.',
    visibleResult: 'The game scene and minimap show surrounding locked territory.',
    changeWhen: 'Turn it off to reduce color coverage around the player.',
  },
  {
    key: 'worldMapMarkers',
    section: 'Rendering',
    label: 'Pin locked areas on world map',
    defaultValue: 'Off',
    purpose: 'Place jump markers on authored areas that are not yet unlocked.',
    visibleResult: 'Clickable markers appear on RuneLite’s full world map.',
    changeWhen: 'Enable it for exploration planning; leave it off to avoid map clutter.',
  },
  {
    key: 'worldMapTooltip',
    section: 'Rendering',
    label: 'World map hover tooltip',
    defaultValue: 'On',
    purpose: 'Show the hovered authored chunk’s area name and lock status.',
    visibleResult: 'A tooltip appears when the pointer rests over an authored world-map chunk.',
    changeWhen: 'Turn it off if you want hover to leave the world map unobstructed.',
  },
  {
    key: 'worldMapTooltipContent',
    section: 'Rendering',
    label: 'Tooltip: what\'s in the chunk',
    defaultValue: 'On',
    purpose: 'Add monsters, shops, farming patches, and points of interest to the world-map tooltip.',
    visibleResult: 'The hover tooltip expands with current companion chunk-content data.',
    changeWhen: 'Turn it off to keep only area name and lock status.',
  },
  {
    key: 'unlockedColor',
    section: 'Rendering',
    label: 'Unlocked color',
    defaultValue: 'Green, translucent',
    purpose: 'Identify chunks inside unlocked regions.',
    visibleResult: 'Unlocked territory uses a translucent green tint by default.',
    changeWhen: 'Change it for color accessibility or stronger contrast with your map theme.',
  },
  {
    key: 'frontierColor',
    section: 'Rendering',
    label: 'Frontier color (Chunked)',
    defaultValue: 'Amber, translucent',
    purpose: 'Identify rollable frontier chunks adjacent to one already held in Chunked mode.',
    visibleResult: 'Frontier territory uses a translucent amber tint when Chunked mode supplies it.',
    changeWhen: 'Vanilla players can leave this unchanged; Chunked mode is not required for the current guide demo.',
  },
  {
    key: 'lockedColor',
    section: 'Rendering',
    label: 'Locked color',
    defaultValue: 'Red, translucent',
    purpose: 'Identify authored chunks that are not unlocked.',
    visibleResult: 'Locked territory uses a translucent red tint by default.',
    changeWhen: 'Change it for color accessibility or to separate it more clearly from warning flashes.',
  },
  {
    key: 'unauthoredColor',
    section: 'Rendering',
    label: 'Unauthored color',
    defaultValue: 'Gray, translucent',
    purpose: 'Identify chunks not claimed by any authored region.',
    visibleResult: 'Unauthored or empty-space chunks use a soft gray tint.',
    changeWhen: 'Change it when gray is too close to your map background.',
  },
];

export const RUNELITE_GUIDE_PRESETS: readonly GuidePreset[] = [
  {
    id: 'balanced-defaults',
    title: 'Balanced defaults',
    summary: 'The shipped warning and rendering defaults with Strict Mode left off.',
    adjustments: [
      'Keep all default-on warnings and rendering layers enabled.',
      'Leave the content box, native notifications, infoboxes, and world-map markers off.',
      'Keep Strict Mode off until you deliberately opt in.',
    ],
  },
  {
    id: 'high-visibility',
    title: 'High visibility',
    summary: 'Adds every useful at-a-glance channel for players who want stronger feedback.',
    adjustments: [
      'Start from Balanced defaults.',
      'Enable Send RuneLite notifications.',
      'Enable Show "in this chunk" box.',
      'Enable Show key/fate/progress infoboxes.',
    ],
  },
  {
    id: 'minimal-screen',
    title: 'Minimal screen',
    summary: 'Keeps map understanding while reducing optional overlays in the game scene.',
    adjustments: [
      'Keep Draw on world map and World map hover tooltip enabled.',
      'Disable Show in-game HUD and Show "in this chunk" box.',
      'Disable native infoboxes and screen flash if you prefer chat-only feedback.',
    ],
  },
  {
    id: 'strict-travel',
    title: 'Strict travel',
    summary: 'Balanced defaults plus the optional, fail-open Guardian.',
    adjustments: [
      'Start from Balanced defaults and enable Strict Mode.',
      'Remember that uncertain, stale, missing, future, wrong-account, or unresolved decisions fail open.',
      'Use Pause Strict Mode for 60 seconds when you need a temporary global pause.',
    ],
  },
];

export const RUNELITE_GUIDE_TROUBLESHOOTING: readonly GuideTroubleshootingItem[] = [
  {
    id: 'waiting-after-confirm',
    symptom: 'The browser page opens, but RuneLite stays Waiting for tracker.',
    likelyCause: 'The wrong request was confirmed, the request expired, or RuneLite has not completed its first valid import.',
    fix: [
      'Return to the currently open RuneLite client and select Connect tracker again.',
      'Confirm the intended profile in the newest browser page.',
      'Keep both apps open until Connected and a Last sync time appear.',
    ],
  },
  {
    id: 'not-connected-or-offline',
    symptom: 'The panel says Not connected or Offline.',
    likelyCause: 'No profile is paired, or the fixed relay cannot currently be reached.',
    fix: [
      'For Not connected, start Connect tracker and confirm the profile.',
      'For Offline, keep the last valid rules, check normal internet access, and retry later.',
      'Do not replace a valid bundle with an unknown download.',
    ],
  },
  {
    id: 'expired-rejected-stale',
    symptom: 'The panel reports expired, not found, rejected, stale, or unsupported bundle feedback.',
    likelyCause: 'The one-time request is no longer valid, or the received bundle cannot safely replace the current rules.',
    fix: [
      'Create a fresh request with Connect tracker.',
      'Confirm the same profile in the newest page.',
      'If the bundle is unsupported, update the Plugin Hub plugin and companion before retrying.',
    ],
  },
  {
    id: 'wrong-account',
    symptom: 'RuneLite warns that the tracker account does not match the logged-in character.',
    likelyCause: 'The selected run is bound to a different character.',
    fix: [
      'Check the Account row in the Run section.',
      'Switch to the matching game character or reconnect the intended tracker profile.',
      'Strict Mode fails open for wrong-account rules.',
    ],
  },
  {
    id: 'no-current-chunk',
    symptom: 'Current chunk shows Enter the game to see this chunk or no authored data.',
    likelyCause: 'The player is signed out, location is unavailable, or the bundle has no authored entry for the chunk.',
    fix: [
      'Log in and enter the game world.',
      'Verify Connected and a recent Last sync time.',
      'Check the companion map if the location remains unauthored.',
    ],
  },
  {
    id: 'missing-layer',
    symptom: 'A world-map, scene, minimap, border, marker, or nearby-shading layer is missing.',
    likelyCause: 'Its Rendering switch is off or the current location has no matching authored rule.',
    fix: [
      'Expand Rendering in the unified panel.',
      'Enable the exact layer you expect.',
      'Check Current chunk to confirm authored data is present.',
    ],
  },
  {
    id: 'tooltip-missing-content',
    symptom: 'The world-map tooltip appears but does not list what is in the chunk.',
    likelyCause: 'Tooltip: what\'s in the chunk is off, or no content is authored for that chunk.',
    fix: [
      'Keep World map hover tooltip on.',
      'Enable Tooltip: what\'s in the chunk.',
      'Try another authored chunk to distinguish missing content from a disabled setting.',
    ],
  },
  {
    id: 'clipboard-import',
    symptom: 'Import from clipboard is empty or malformed.',
    likelyCause: 'The clipboard does not contain one complete Fate Locked bundle.',
    fix: [
      'Copy the bundle again from the companion.',
      'Use Import from clipboard or Paste JSON once.',
      'An invalid import keeps the previous valid rules; never edit the JSON by hand unless you know the format.',
    ],
  },
  {
    id: 'file-auto-reload',
    symptom: 'Auto-reload watches the wrong file or does not notice an export.',
    likelyCause: 'The file is outside the recovery folder or does not match the expected fate-locked-bundle-*.json pattern.',
    fix: [
      'Use %USERPROFILE%\\.runelite\\fate-locked\\ on Windows.',
      'Keep only the intended newest matching export in that folder.',
      'Use Reload from file for a one-off bundle outside the watched folder.',
    ],
  },
  {
    id: 'strict-mode-allows-action',
    symptom: 'Strict Mode does not block an action you expected it to stop.',
    likelyCause: 'The decision is unknown, ambiguous, stale, missing, future-dated, wrong-account, or otherwise not proven Locked.',
    fix: [
      'Check Connected, Last sync, Account, and Current chunk.',
      'Treat the warning as advisory when the evidence is uncertain.',
      'This is deliberate: Strict Mode fails open and never guesses.',
    ],
  },
];

export const RUNELITE_GUIDE_GLOSSARY: readonly GuideGlossaryItem[] = [
  {
    term: 'Authored',
    definition: 'A chunk or rule that exists in the companion’s current Fate Locked dataset.',
  },
  {
    term: 'Bundle',
    definition: 'The complete, versioned set of run rules RuneLite reads from the relay, clipboard, or recovery file.',
  },
  {
    term: 'Chunk',
    definition: 'A RuneScape map tile group used by the plugin to describe location permissions and content.',
  },
  {
    term: 'Frontier',
    definition: 'In Chunked mode, a locked chunk adjacent to one already held and eligible for that mode’s progression.',
  },
  {
    term: 'Locked',
    definition: 'Authored content the current run has not unlocked.',
  },
  {
    term: 'Unauthored',
    definition: 'A chunk not claimed by any current authored region.',
  },
  {
    term: 'Relay',
    definition: 'The fixed Fate Locked service that gives RuneLite the selected profile’s rules after pairing.',
  },
  {
    term: 'Local observation',
    definition: 'A possible in-game event detected and kept on this computer; it does not roll or change progression.',
  },
  {
    term: 'Needs review',
    definition: 'A local observation that is too ambiguous to treat as confirmed.',
  },
  {
    term: 'Strict Mode',
    definition: 'An optional, default-off guard that prevents only actions fresh account-bound rules prove Locked.',
  },
  {
    term: 'Keys',
    definition: 'Spend one on a table you choose for a random eligible unlock from that table.',
  },
  {
    term: 'Omni Keys',
    definition: 'Spend one to choose the exact eligible unlock you want.',
  },
  {
    term: 'Chaos Keys',
    definition: 'Spend one for a random eligible unlock from any table; you do not choose the table.',
  },
];

export const RUNELITE_GUIDE_CHAPTERS: readonly GuideChapter[] = [
  {
    id: 'what-it-does',
    number: 1,
    title: 'What the plugin does',
    summary: 'One Plugin Hub plugin turns the companion’s run rules into a readable, warning-aware RuneLite sidebar.',
    paragraphs: [
      'The companion is where you create the run, earn and spend Keys, and author progression. RuneLite retrieves and displays that run’s current rules.',
      'RuneLite warnings and local observations are helpers. They never perform tracker rolls and never change progression.',
    ],
    bullets: [
      'Use the single Fate Locked Ironman Plugin Hub plugin.',
      'Read every feature from one unified RuneLite sidebar.',
      'Return to the companion whenever the run itself needs to change.',
    ],
    screenshotIds: ['unified-panel'],
  },
  {
    id: 'install-plugin-hub',
    number: 2,
    title: 'Install from Plugin Hub',
    summary: 'Install Fate Locked Ironman from RuneLite’s normal Plugin Hub.',
    paragraphs: [
      'Open RuneLite’s configuration sidebar, select Plugin Hub, and search for Fate Locked Ironman. Install the result shown in the screenshot.',
      'After installation, select the Fate Locked sidebar icon. You should see the unified panel rather than a second development plugin.',
    ],
    bullets: [
      'Use the Plugin Hub result named Fate Locked Ironman.',
      'Leave only the Plugin Hub version enabled for normal play.',
      'Updates arrive through the same Plugin Hub entry after RuneLite review.',
    ],
    screenshotIds: ['plugin-hub-install'],
  },
  {
    id: 'connect-tracker',
    number: 3,
    title: 'Connect the tracker',
    summary: 'A one-time browser confirmation links the chosen companion profile to this RuneLite client.',
    paragraphs: [
      'Select Connect tracker in RuneLite. Your normal browser opens a confirmation page in the companion.',
      'Check the profile name, confirm Connect tracker, return to RuneLite, and wait for Connected plus a Last sync time.',
    ],
    bullets: [
      'Keep RuneLite open while confirming.',
      'Use the newest browser request if more than one page is open.',
      'Never post the private pairing request in screenshots or support messages.',
    ],
    screenshotIds: ['panel-disconnected', 'companion-confirmation', 'panel-connected'],
  },
  {
    id: 'connection-privacy',
    number: 4,
    title: 'Connection and privacy',
    summary: 'RuneLite receives the selected run’s rules through a fixed inbound-only connection.',
    paragraphs: [
      'RuneLite retrieves a complete rules bundle from the fixed Fate Locked relay. The relay sees the request IP address, as any internet service does.',
      'RuneLite does not upload gameplay data. Pairing requests and Run IDs should still be treated as private and excluded from support screenshots.',
    ],
    bullets: [
      'Not connected: no profile is paired.',
      'Waiting: confirm the newest browser request.',
      'Connected: a valid rules bundle was accepted.',
      'Offline: the relay cannot currently be reached; the last valid bundle remains safer than an unknown replacement.',
      'Rejected, stale, or unsupported: RuneLite kept the previous valid rules.',
    ],
    screenshotIds: ['panel-connected'],
  },
  {
    id: 'unified-panel',
    number: 5,
    title: 'Unified panel overview',
    summary: 'All everyday plugin controls live in one sidebar, with sections that expand and collapse independently.',
    paragraphs: [
      'Current chunk and Guardian begin expanded. Roll inbox, Run, Bundle, Warnings, and Rendering begin collapsed.',
      'Collapsing one section never hides or changes the others, and it never changes the tracker run.',
    ],
    bullets: RUNELITE_PANEL_SECTIONS,
    screenshotIds: ['unified-panel'],
  },
  {
    id: 'current-chunk',
    number: 6,
    title: 'Current Chunk',
    summary: 'Current Chunk explains the imported rules for the location your character occupies.',
    paragraphs: [
      'When signed in, the section shows area or chunk identity, entry source, Can do, Not ready, and Locked totals, followed by category rows and their permission details.',
      'Before RuneLite knows your location, the correct message is Enter the game to see this chunk.',
    ],
    bullets: [
      'Can do: available under the current run rules.',
      'Not ready: authored but waiting on another requirement.',
      'Locked: not unlocked by this run.',
      'Unauthored: no current companion rule covers the location.',
    ],
    screenshotIds: ['current-chunk'],
  },
  {
    id: 'guardian',
    number: 7,
    title: 'Guardian and Strict Mode',
    summary: 'Strict Mode is an optional, conservative guard for actions that are certainly Locked.',
    paragraphs: [
      'Strict Mode is off by default. When enabled, it can consume only a player-selected click when fresh, exact, account-bound rules prove the destination Locked.',
      'Unknown, ambiguous, stale, missing, future, wrong-account, and unresolved cases are allowed: Strict Mode fails open rather than guessing.',
      'Pause Strict Mode for 60 seconds affects every prevention category and resumes automatically. Recent Prevented Actions is a local explanation log, not an action queue.',
    ],
    bullets: [
      'Warnings remain useful with Strict Mode off.',
      'Walking and uncertain actions are never blocked by a guess.',
      'Turn Strict Mode off immediately or use the shared temporary pause.',
    ],
    screenshotIds: ['guardian'],
    settingsSection: 'Guardian',
  },
  {
    id: 'roll-inbox',
    number: 8,
    title: 'Roll Inbox',
    summary: 'Roll Inbox is a local, review-first history of possible progression events.',
    paragraphs: [
      'The counters separate Local events, Needs review, and Warnings. RuneLite keeps the newest 250 unique observations on this computer.',
      'Ambiguous observations go to Needs review. Detection never rolls and never changes tracker progression.',
    ],
    bullets: [
      'Open web Roll Inbox launches a separate web view.',
      'RuneLite’s local history is not uploaded or transferred to that web view.',
      'Confirm progression in the companion, not from a local observation alone.',
    ],
    screenshotIds: ['roll-inbox'],
  },
  {
    id: 'run-and-keys',
    number: 9,
    title: 'Run and the three Keys',
    summary: 'Run gives read-only profile context and uses exact labels for each key balance.',
    paragraphs: [
      'Profile, Account, Run ID, Fate, Buff, and Goal help you confirm that RuneLite is reading the intended run.',
      'Keys buy a random eligible unlock from a table you choose. Omni Keys choose the exact eligible unlock. Chaos Keys give a random eligible unlock from any table, and you do not choose the table.',
    ],
    bullets: [
      'Keys: choose the table; Fate chooses an eligible result.',
      'Omni Keys: choose the exact eligible result.',
      'Chaos Keys: neither the table nor result is chosen by the player.',
    ],
    screenshotIds: ['run-keys'],
  },
  {
    id: 'bundle-recovery',
    number: 10,
    title: 'Bundle recovery',
    summary: 'The connected relay is normal; clipboard and file import are safe recovery paths.',
    paragraphs: [
      'Prefer the connected relay for routine refreshes. Use Import from clipboard, Paste JSON, or Reload from file when connection recovery is necessary.',
      'On Windows, Auto-reload watches %USERPROFILE%\\.runelite\\fate-locked\\ for the newest matching fate-locked-bundle-*.json export.',
      'Invalid, malformed, stale, or unsupported imports keep the previous valid rules.',
    ],
    bullets: [
      'Clipboard: copy one complete bundle, then select Import from clipboard.',
      'Paste JSON: paste one complete bundle into the provided field and import it.',
      'File: choose a trusted export, or place a matching export in the watched recovery folder.',
    ],
    screenshotIds: ['bundle-recovery'],
    settingsSection: 'Bundle',
  },
  {
    id: 'warnings',
    number: 11,
    title: 'Warnings',
    summary: 'Choose how strongly RuneLite explains locked travel, account, task, gear, and roll events.',
    paragraphs: [
      'Warning channels include chat, HUD text, a screen flash, RuneLite’s native notification system, right-click tags, infoboxes, and reminders.',
      'Changing a warning setting affects presentation only. It does not unlock content, roll, or alter tracker progression.',
    ],
    bullets: [
      'Keep the default warnings for a balanced setup.',
      'Use native notifications and infoboxes when RuneLite may not have your full attention.',
      'Disable individual channels that create too much visual or chat noise.',
    ],
    screenshotIds: ['warnings'],
    settingsSection: 'Warnings',
  },
  {
    id: 'rendering',
    number: 12,
    title: 'Rendering',
    summary: 'Rendering controls the world map, game scene, minimap, borders, nearby shading, markers, tooltips, and colors.',
    paragraphs: [
      'World-map, scene, and minimap layers can be tuned separately. Border and nearby-shading options add context around locked exits.',
      'Unlocked is green, Frontier is amber for Chunked mode, Locked is red, and Unauthored is gray by default. The active Guide Demo uses Vanilla because Chunked mode is not finished.',
    ],
    bullets: [
      'Markers are off by default to avoid world-map clutter.',
      'The hover tooltip shows area and lock status.',
      'Tooltip content adds monsters, shops, farming patches, and points of interest.',
    ],
    screenshotIds: ['rendering'],
    settingsSection: 'Rendering',
  },
  {
    id: 'in-game-overlays',
    number: 13,
    title: 'In-game overlays',
    summary: 'Warnings and rendering settings combine into a readable set of RuneLite-native game, map, and HUD layers.',
    paragraphs: [
      'Show in-game HUD controls run totals and current status. Show "in this chunk" box adds a separate draggable content view, while native infoboxes use RuneLite’s normal infobox row.',
      'World-map tint, markers, and hover tooltip are separate from the scene and minimap tints. Locked borders and nearby shading provide extra travel context without changing the rules.',
    ],
    bullets: [
      'Use the world-map tooltip to inspect authored areas before travelling.',
      'Use scene and minimap tint for immediate current-location context.',
      'A real warning is shown only when safely reproduced; the guide never presents a fabricated warning state.',
    ],
    screenshotIds: ['world-map-tooltip', 'scene-minimap-hud'],
  },
  {
    id: 'recommended-configurations',
    number: 14,
    title: 'Recommended configurations',
    summary: 'Start with one of four simple setups, then adjust only the channels that help you.',
    paragraphs: [
      'Balanced defaults suit most players. High visibility adds native notifications, the chunk content box, and infoboxes. Minimal screen keeps map understanding with fewer overlays.',
      'Strict travel adds optional Strict Mode to balanced defaults. It still fails open when evidence is uncertain, and its shared pause lasts 60 seconds.',
    ],
    bullets: RUNELITE_GUIDE_PRESETS.map(preset => preset.title),
    screenshotIds: ['warnings', 'rendering'],
  },
  {
    id: 'troubleshooting',
    number: 15,
    title: 'Troubleshooting',
    summary: 'Connection, bundle, display, and Strict Mode problems can be diagnosed from the unified panel.',
    paragraphs: [
      'Begin with Connection, Last sync, Account, and Current chunk. Those four rows explain most cases without deleting settings or replacing a valid bundle.',
      'For support, link the official Plugin Hub listing, the merged RuneLite review, and the project support issue. Exclude pairing requests, Run IDs, local paths, and unrelated chat.',
    ],
    bullets: RUNELITE_GUIDE_TROUBLESHOOTING.map(item => item.symptom),
    screenshotIds: ['panel-disconnected', 'panel-connected'],
  },
  {
    id: 'glossary',
    number: 16,
    title: 'Glossary',
    summary: 'Plain definitions for the words used by the companion and RuneLite plugin.',
    paragraphs: [
      'Use these definitions when a panel message or support reply refers to authored rules, local observations, Guardian decisions, or key types.',
    ],
    bullets: RUNELITE_GUIDE_GLOSSARY.map(item => `${item.term}: ${item.definition}`),
    screenshotIds: [],
  },
];
