# RuneLite Plugin Player Guide Design

## Goal

Build a complete player-facing handbook for the live **Fate Locked Ironman**
RuneLite Plugin Hub plugin inside the Fate Locked companion app. The handbook
must explain installation, connection, everyday use, every unified-panel
section, all retained settings, visible overlays, recovery paths, privacy, and
troubleshooting. It must use annotated screenshots captured from the actual
Plugin Hub build rather than recreated interfaces.

The live Plugin Hub manifest currently points to plugin source commit
`1e118ec73f5a0fad17fc7b0704461a602d169041`.

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

Desktop uses a sticky left table of contents and a scrollable article. Mobile
uses a collapsible table of contents above the article. Every chapter has a
stable anchor, and the active chapter is visible in the table of contents.
The first screen presents a five-minute quick start rather than making a new
player read the complete reference.

## Chapter architecture

The handbook opens with an unnumbered **Five-minute setup** card that links to
the Install and Connect chapters. It then contains these chapters in order:

1. **What the plugin does**
   - One Plugin Hub plugin and one RuneLite sidebar.
   - The companion authors the run; RuneLite reads and displays its rules.
   - RuneLite warnings and local observations do not replace tracker rolls.

2. **Install from Plugin Hub**
   - Find and install **Fate Locked Ironman** from Plugin Hub.
   - Open its sidebar.

3. **Connect the tracker**
   - Select **Connect tracker**.
   - Confirm the fictional/demo or real tracker profile in the opened page.
   - Return to RuneLite and verify **Connected**.

4. **Connection and privacy**
   - Explain Not connected, Waiting, Connected, Offline, and rejected/import
     feedback in player terms.
   - RuneLite retrieves a complete rules bundle from the fixed Fate Locked
     relay.
   - The relay sees the request IP address.
   - RuneLite does not upload gameplay data.
   - Pairing codes and Run IDs must not be shared in screenshots or support
     posts.

5. **Unified panel overview**
   - Explain that headings expand and collapse independently.
   - List the seven actual sections: Current chunk, Guardian, Roll inbox, Run,
     Bundle, Warnings, and Rendering.
   - Current chunk and Guardian start expanded; the others start collapsed.

6. **Current Chunk**
   - Area/chunk identity and entry source.
   - Can do, Not ready, and Locked counts.
   - Category rows and their permission/detail text.
   - The signed-out prompt: **Enter the game to see this chunk**.

7. **Guardian and Strict Mode**
   - Strict Mode is optional and off by default.
   - It can consume only a player-selected click when fresh, exact,
     account-bound rules prove the destination Locked.
   - Unknown, ambiguous, stale, missing, future, wrong-account, and unresolved
     cases fail open.
   - The shared pause lasts 60 seconds and resumes automatically.
   - Recent Prevented Actions is a local explanation/audit view, not an action
     queue.

8. **Roll Inbox**
   - Local events, Needs review, and Warnings counters.
   - The local history keeps the newest 250 unique observations.
   - Ambiguous observations go to Needs review.
   - Detection never rolls and never changes tracker progression.
   - **Open web Roll Inbox** opens a separate web view and does not transfer
     RuneLite's local history.

9. **Run and the three Keys**
   - Explain Profile, Account, Run ID, Fate, Buff, and Goal.
   - **Keys:** spend one on a chosen table for a random eligible unlock.
   - **Omni Keys:** choose the exact eligible unlock you want.
   - **Chaos Keys:** receive a random eligible unlock from any table; the
     player does not choose the table.
   - Use the exact sidebar labels **Keys**, **Omni Keys**, and **Chaos Keys**.

10. **Bundle recovery**
   - Normal connected relay import remains the preferred path.
   - **Auto-reload on change** watches for the newest matching bundle file.
   - **Re-import hotkey** imports the clipboard bundle without opening the
     sidebar.
   - Explain **Import from clipboard**, **Paste JSON**, and **Reload from
     file** step by step.
   - Windows recovery folder:
     `%USERPROFILE%\.runelite\fate-locked\`.
   - Invalid or unsupported imports keep the previous valid rules.

11. **Warnings**
    - Explain every retained warning control, its default, what the player
      sees, and why they might change it.
    - Distinguish chat, HUD, screen flash, native RuneLite notification,
      menu tag, info box, and reminder behaviour.

12. **Rendering**
    - Explain every retained rendering control and color.
    - Distinguish the world map, game scene, minimap, borders, nearby shading,
      markers, hover tooltip, and tooltip content.
    - Define Unlocked, Frontier, Locked, and Unauthored colors.

13. **In-game overlays**
    - Show the run HUD, current-chunk content box, native info boxes, world-map
      tint/markers/tooltip, scene tint, minimap tint, locked border, nearby
      locked shading, and real warning presentation when safely reproducible.

14. **Recommended configurations**
    - **Balanced defaults:** the shipped defaults.
    - **High visibility:** default warnings plus native notifications, content
      box, and info boxes.
    - **Minimal screen:** map rendering retained while optional HUD/content
      elements are disabled.
    - **Strict travel:** balanced defaults plus Strict Mode, with the fail-open
      and 60-second pause explanation beside it.

15. **Troubleshooting**
    - Connect button opens a page but RuneLite stays Waiting.
    - Not connected, Offline, expired/not found, stale, wrong-account, and
      unsupported bundle feedback.
    - Tracker account does not match the logged-in character.
    - No chunk appears because the player is signed out or data is absent.
    - A map/scene/minimap layer is missing because its setting is off.
    - A tooltip lacks content because its content toggle is off.
    - Clipboard import is empty or malformed.
    - File auto-reload uses the wrong folder or filename pattern.
    - Strict Mode does not block an uncertain action by design.
    - Where to link the Plugin Hub listing, current review, and support issue.

16. **Glossary**
    - Authored, bundle, chunk, frontier, locked, unauthored, relay, local
      observation, Needs review, Strict Mode, and the three Key types.

## Exact setting inventory

The handbook must name and explain all 30 current settings. A guide content
contract test asserts this exact inventory.

### Bundle (2)

| Setting | Default |
|---|---:|
| Auto-reload on change | On |
| Re-import hotkey | Not set |

### Guardian (1)

| Setting | Default |
|---|---:|
| Strict Mode | Off |

### Warnings (15)

| Setting | Default |
|---|---:|
| Chat on chunk entry | On |
| Warn entering locked chunk | On |
| Warn opening a locked bank | On |
| Screen flash on locked entry | On |
| Warn on wrong account | On |
| Tag locked right-click targets | On |
| Tag teleports to locked chunks | On |
| Show in-game HUD | On |
| HUD: nearest bank & shop | On |
| Show "in this chunk" box | Off |
| Send RuneLite notifications | Off |
| Warn on locked slayer task | On |
| Warn on over-tier gear | On |
| Show key/fate/progress infoboxes | Off |
| Roll reminders | On |

### Rendering (12)

| Setting | Default |
|---|---:|
| Draw on world map | On |
| Draw around player | On |
| Draw on minimap | On |
| Highlight locked borders | On |
| Shade nearby locked chunks | On |
| Pin locked areas on world map | Off |
| World map hover tooltip | On |
| Tooltip: what's in the chunk | On |
| Unlocked color | Green, translucent |
| Frontier color (Chunked) | Amber, translucent |
| Locked color | Red, translucent |
| Unauthored color | Gray, translucent |

## Real screenshot policy

Every instructional screenshot is captured from the live Plugin Hub build
inside RuneLite or from the real companion page opened by that build. Panel
mockups, reconstructed controls, AI-generated RuneLite windows, and fabricated
warning states are not permitted.

A dedicated demo run uses fictional account and run details. Pairing codes,
Run IDs, local paths containing a username, and any unrelated account or chat
information are excluded at capture time or redacted before publication.
Redaction must not hide a control being taught.

The source PNG remains untouched. The guide renders responsive amber numbered
markers and leader lines as SVG/HTML overlays. Each marker has an accessible
matching explanation below the image. The annotation layer may crop the source
for focus but must not replace or redraw UI pixels.

If a gameplay warning cannot be safely reproduced, the guide uses a genuine
idle-plugin screenshot and explains the verified behaviour beside it. It must
not present a simulated warning as a real capture.

When the demo account is signed out, overlay chapters use authentic settings-
panel captures and label them as controls. They must not imply that a control
crop is a logged-in gameplay scene.

## Screenshot inventory

The initial release targets these captures:

1. Plugin Hub search and install result.
2. Disconnected plugin panel.
3. Companion pairing confirmation.
4. Connected panel status.
5. Unified panel with all seven headings visible.
6. Current Chunk expanded.
7. Guardian expanded, including pause and recent actions.
8. Roll Inbox expanded.
9. Run expanded with Keys, Omni Keys, and Chaos Keys.
10. Bundle recovery controls.
11. Warnings controls, using multiple overlapping crops if needed.
12. Rendering controls, using multiple overlapping crops if needed.
13. World-map hover-tooltip and color controls.
14. Scene/minimap/HUD and locked-border controls.

`public/guides/runelite/manifest.json` records for each capture:

- stable ID and filename;
- capture date;
- live plugin source commit;
- RuneLite version when visible;
- chapter and purpose;
- crop dimensions;
- redactions, if any; and
- annotation IDs with normalized coordinates.

## Component and data boundaries

- `components/runelite-guide/RunelitePluginGuide.tsx` owns dialog/page shell,
  table of contents, chapter scrolling, close/focus behaviour, and responsive
  layout.
- `components/runelite-guide/GuideScreenshot.tsx` renders an authentic image,
  responsive annotation overlay, accessible callout list, and missing-image
  fallback.
- `components/runelite-guide/GuideSettingsTable.tsx` renders setting purpose,
  default, result, and change guidance consistently.
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
- Mobile screenshots can be expanded to a zoomable lightbox or opened at
  original resolution without losing the callout explanations.
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
- all 16 chapter IDs and all seven panel section names are present;
- all 30 setting labels and defaults are present exactly once;
- the three Key definitions and privacy/Strict Mode contracts remain present;
- every screenshot reference resolves to a manifest entry and file;
- every annotation ID has normalized coordinates and accessible copy;
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
