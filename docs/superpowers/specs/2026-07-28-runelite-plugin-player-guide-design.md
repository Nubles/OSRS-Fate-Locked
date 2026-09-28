# RuneLite Plugin Player Guide Design

## Goal

Build a complete player-facing handbook for the live **Fate Locked Ironman**
RuneLite Plugin Hub plugin inside the Fate Locked companion app. The handbook
must explain installation, connection, everyday use, every unified-panel
section, all retained settings, visible overlays, recovery paths, privacy, and
troubleshooting. It must use authentic, annotated pictures of the plugin, drawn
by its own code or captured, rather than recreated interfaces (see Screenshot
policy).

When this spec was first written, the live Plugin Hub manifest pointed to
plugin source commit `1e118ec73f5a0fad17fc7b0704461a602d169041`.

## Audience and scope

The audience is a player who may have no knowledge of the tracker, RuneLite
configuration, rule bundles, or the three Key types. Copy uses plain player
language and teaches one action at a time.

The guide covers:

- installing the Plugin Hub plugin;
- the companion steps required to connect and maintain it;
- reading and operating the unified RuneLite sidebar;
- understanding plugin warnings, rendering, and optional Strict Mode;
- recovering with clipboard or file import; and
- diagnosing common connection and display problems.

The guide does not duplicate the full web tracker reference, document source
architecture, teach plugin development, or provide a RuneLite reviewer
appendix.

## Entry points and presentation

`RuneLitePluginGuide` is a lazy-loaded full-screen handbook view. It opens
from:

1. a **RuneLite Plugin Guide** item in the companion settings/help menu;
2. a **RuneLite Plugin Guide** command-palette result;
3. the direct query `?open=runelite-guide`; and
4. relevant RuneLite status or help links where a guide link is useful.

Opening and closing the handbook does not change the run. Closing a manually
opened guide returns focus to the control that opened it. Direct-query opening
uses the existing safe fallback focus behaviour.

*The September 2026 rebuild replaced this paragraph's first version.* Desktop
shows the contents in a left column, in four groups, beside a scrolling
article, and marks the chapter being read as the article scrolls. A phone
shows a **Jump to** menu under the header instead, and nothing is fixed to the
bottom of the screen. Every chapter has a stable anchor. The first screen is a
short introduction with links to Get started, Here, Strict Mode, Settings and
Troubleshooting, so a new player starts with the five-minute setup rather than
the complete reference.

## Chapter architecture

*The September 2026 rebuild replaced this section's first version, which
followed the unified panel that Stage 3 retired.* After the introduction come
twelve chapters, in four groups:

**Start here**

1. **Get started**: install from the Plugin Hub, open the sidebar, connect the
   tracker, confirm the profile in the companion, and play. The status card's
   states while connecting sit side by side. RuneLite downloads the run's rules
   and does not upload gameplay data; the companion is still where the run
   changes.
2. **The sidebar at a glance**: the status card, then five cards that open and
   close.

**The cards**

3. **The status card**: each state, what it means, and its one action.
4. **Here**: the rules for the place the player stands in, the arrow to the
   nearest spot, and the way to one seen before, drawn by Shortest Path when it
   runs. Spots seen are remembered on the player's computer.
5. **Strict Mode**: optional and off by default. It stops only a click it can
   prove leads somewhere the rules lock, fails open otherwise, and pauses for
   60 seconds.
6. **Run**: the character, progress, Keys, Omni-Keys, Chaos Keys, Fate Points
   and the ritual. The card only reads the run.
7. **Roll inbox**: events worth a roll, what needs checking, and warnings.
   Noticing an event never rolls, and the local history stays on the computer.
8. **Connection & backup**: online sync, pairing, and backups from the
   clipboard or a file. Privacy: RuneLite contacts one fixed relay, which sees
   the request's IP address.

**In game**

9. **In game**: chunk borders, shade, the minimap, the world map, the HUD,
   alerts, menu tags, warnings and infoboxes, each with its own off switch.
10. **Settings**: every setting, by RuneLite's sections, then four suggested
    setups.

**Help**

11. **Troubleshooting**: each problem as the player sees it, its likely cause
    and the fix, step by step; then the Plugin Hub page, the source, and where
    to report a problem.
12. **Glossary**: the words the plugin and the companion share.

## Exact setting inventory

*Stage 3 (September 2026) replaced this section's first version.* The settings
are no longer listed here. `data/runeliteWording.ts` holds them, with their
config panel sections, names, defaults and choices; `npm run goldens:write`
writes it to `contracts/golden-bundles/runelite-wording.json`, and the plugin's
`WordingContractTest` fails its build when its own settings differ. The guide
builds its settings table from the same list and adds only the prose, and
`data/runeliteWording.test.ts` checks every setting has it. Stage 3 has 21
settings in six sections: Tracker, Strict Mode, Alerts, Display, Custom colours
and Backup.

## Screenshot policy

*Stage 3 (September 2026) replaced the first version, which allowed only
captures from the live Plugin Hub build.* Every image says where it comes
from, in its caption and in the manifest:

- **Rendered**: the plugin's sidebar, drawn from the plugin's own code at a
  commit on its main branch, in RuneLite's own theme, by the plugin's `gradle
  guideScreenshots` task. The run is the golden bundles' fictional
  "Iron Example". Since the September 2026 rebuild each render is drawn at
  twice the detail and cut to the one card its chapter is about, with a margin
  of the sidebar round it; the sidebar at a glance stays whole. Captioned
  "Drawn by the plugin's own code, in RuneLite's theme."
- **Web capture**: the companion itself, captured at twice the detail and shown
  at its size on screen. Captioned "Captured from the companion."

A capture of a real RuneLite client, such as the Plugin Hub, is allowed but none
is shown: the install step is described in words.

Mockups, reconstructed controls, AI-generated RuneLite windows and fabricated
warning states are still not permitted. A render is the plugin's real code
drawing a real sidebar state from real rules, not a reconstruction.

Pairing codes, Run IDs, local paths containing a username, and any unrelated
account or chat information are excluded at capture time or redacted before
publication. Redaction must not hide a control being taught. Renders use a
fictional run and need none.

The source PNG remains untouched. *The September 2026 rebuild replaced the
markers drawn over the picture, which covered the words they named.* Each part
a note names is outlined in gold; its numbered marker sits in a gutter beside
the picture, joined to the outline by a thin line, and the numbered notes sit
next to the picture, or under it on a narrow screen. Pointing at or focusing a
note lights its outline and dims the others. For a render, the tool works out
each outline from where the components were laid out, usually the whole row
they sit on so no line crosses the card, and writes it beside the images, so
outlines can't drift from what they name.

In-game overlays (the HUD, borders, the minimap and the world map) are
described in words until a logged-in client capture is taken; the guide never
presents a simulated scene as a capture.

## Screenshot inventory

- Companion pairing confirmation (web capture).
- Rendered: the sidebar at a glance; the status card in each of its seven
  states (up to date, not connected, waiting, may be out of date, expired,
  using a backup, another character); Here in a locked place, and Here
  showing the way to one seen; Strict Mode paused; Run; Roll inbox; and
  Connection & backup.

`public/guides/runelite/manifest.json` (version 3) records for each image:

- stable ID and filename;
- its source: rendered or web capture;
- the plugin commit that drew it, for a render, and the RuneLite version;
- the date it was made, and its purpose;
- its size, its scale (2: two file pixels to each pixel it shows) and its
  SHA-256;
- redactions, if any; and
- annotation IDs with their outlines: x, y, width and height as fractions of
  the picture.

`data/runeliteGuideAssets.test.ts` checks each against the file itself, and that
the folder holds no image the manifest doesn't list.

## Component and data boundaries

- `components/runelite-guide/RunelitePluginGuide.tsx` owns dialog/page shell,
  table of contents, chapter scrolling, close/focus behaviour, and responsive
  layout.
- `components/runelite-guide/GuideFigure.tsx` renders an authentic image, its
  outlines and markers, the numbered notes beside it, a Full size link, and the
  missing-image fallback; also a picture of a set, at its size in RuneLite.
- `components/runelite-guide/GuideSettings.tsx` lists the settings by
  RuneLite's sections; each opens to its choices, what the player sees, and
  when to change it, and a colour default gets a swatch.
- `components/runelite-guide/GuideReference.tsx` renders the suggested setups,
  troubleshooting, external links and glossary.
- `data/runeliteGuide.ts` is the typed source of chapter metadata, copy,
  setting inventory, screenshot references, recommended configurations,
  troubleshooting, and glossary entries.
- `public/guides/runelite/` contains source captures and the screenshot
  manifest.

The guide does not parse Markdown or inject HTML. Authored React content and
typed data preserve the app's current safety and styling patterns.

## Accessibility and responsive behaviour

- The handbook has a labelled dialog/page landmark and visible title.
- Every control is keyboard reachable and has a visible focus indicator.
- Escape closes the handbook only when no child dialog owns Escape.
- Focus restoration follows the existing changelog/modal policy.
- Active chapter state is exposed without relying on color alone.
- Screenshot alt text describes the underlying UI; numbered callouts are also
  available as text and do not rely on the image.
- Every picture has a Full size link to the file itself; its notes stay
  beside or under it.
- Reduced-motion preference disables smooth scrolling and nonessential
  transitions.

## Error and fallback behaviour

- A missing screenshot renders its title, explanation, and an explicit
  unavailable-image message; it does not collapse the chapter.
- An unknown direct `open` value leaves the normal tracker view unchanged.
- If a guide anchor is invalid, the handbook opens at the top.
- External Plugin Hub, PR, and support links open safely in a new tab with
  `noopener noreferrer`.
- Closing the guide never changes profile, run data, pairing state, or plugin
  connection state.

## Verification and maintenance

Automated coverage proves:

- both menu and command palette expose the guide;
- `?open=runelite-guide` opens it directly;
- manual close restores focus correctly;
- all twelve chapters are present in order, each once in the contents;
- every setting in the wording contract is present with its default, choices
  and prose;
- the three Key definitions and privacy/Strict Mode contracts remain present;
- every picture reference resolves to a manifest entry and file, at its size,
  scale and hash;
- every outline lies inside its picture and has accessible copy, and a
  render's outlines reach the card's right side;
- markers never overlap or leave the picture, and pointing at a note lights
  its outline;
- external links use safe new-tab attributes; and
- the guide lazy-loads rather than entering the initial application bundle.

Manual release verification covers:

- desktop and mobile chapter navigation;
- screenshot legibility and annotation alignment;
- keyboard and Escape behaviour;
- the direct query on GitHub Pages;
- comparison against the installed live Plugin Hub build; and
- production HTTP/version/content confirmation after deployment.

Any player-facing plugin update that adds, removes, renames, changes the
default of, or materially changes the behaviour of a panel section or setting
must update this handbook and screenshot manifest in the same release. The
existing mandatory What's New rule also applies.

## Success criteria

A first-time player can install, connect, and verify the plugin using only the
quick start. A returning player can find any current control or connection
state from the contents list. The handbook contains every current section and
setting, uses only authentic captures, reveals no personal data, accurately
describes the inbound-only privacy boundary, and remains usable on desktop,
mobile, keyboard, and screen-reader paths.
