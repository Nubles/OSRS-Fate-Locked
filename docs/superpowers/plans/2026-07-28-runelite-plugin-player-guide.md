# RuneLite Plugin Player Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete player-facing RuneLite Plugin Guide inside the Fate Locked companion app using annotated screenshots captured from the actual live Plugin Hub build.

**Architecture:** Keep authentic source captures and their audit manifest under `public/guides/runelite/`, while typed guide content and screenshot metadata live in `data/runeliteGuide.ts`. Small guide components render screenshots, annotations, settings, navigation, and error states; `App.tsx` only owns lazy loading, entry points, focus return, and direct-query state.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, jsdom, Vite, RuneLite/Swing, Windows Graphics Capture, GitHub Pages.

## Global Constraints

- The guide is player-facing only and does not duplicate the full tracker reference or developer architecture.
- All instructional RuneLite images come from live Plugin Hub source commit `1e118ec73f5a0fad17fc7b0704461a602d169041` running inside RuneLite.
- Do not use recreated, AI-generated, or fabricated plugin screenshots or warning states.
- Use a dedicated fictional demo run; no personal account, Run ID, pairing code, unrelated chat, or identifying local path may be published.
- Preserve source screenshot pixels; annotations are responsive SVG/HTML overlays and accessible text.
- The guide contains 16 chapters, all seven panel sections, and all 30 retained settings.
- Exact sidebar labels are **Keys**, **Omni Keys**, and **Chaos Keys**.
- Privacy wording states that RuneLite retrieves rules, the relay sees the request IP address, and RuneLite does not upload gameplay data.
- Strict Mode is optional, off by default, blocks only exact proven-Locked actions, and fails open when uncertain.
- `?open=runelite-guide` opens the handbook without allowing the unseen What's New modal to cover it.
- The guide must lazy-load and must not enter the initial application bundle.
- External links open with `target="_blank"` and `rel="noopener noreferrer"`.
- Every player-facing implementation commit includes a current What's New release entry.
- No production dependency is added.

---

## File map

- `public/guides/runelite/*.png`: authentic, privacy-safe source captures.
- `public/guides/runelite/manifest.json`: capture commit/date/dimensions/purpose/redactions/annotation audit record.
- `data/runeliteGuide.ts`: guide types, 16 chapter definitions, seven section names, 30 settings, screenshot metadata, recommended configurations, troubleshooting, and glossary.
- `data/runeliteGuide.test.ts`: authored-content and screenshot-contract tests.
- `components/runelite-guide/GuideScreenshot.tsx`: authentic image, SVG markers/leader lines, accessible callouts, original-size link, and error fallback.
- `components/runelite-guide/GuideSettingsTable.tsx`: consistent setting/default/purpose/result/change guidance.
- `components/runelite-guide/RunelitePluginGuide.tsx`: full-screen guide shell, contents navigation, chapter layout, responsive behaviour, and focus trap.
- `components/runelite-guide/GuideScreenshot.dom.test.tsx`: annotation and missing-image DOM coverage.
- `components/runelite-guide/RunelitePluginGuide.test.tsx`: semantic handbook rendering and inventory coverage.
- `components/runelite-guide/RunelitePluginGuide.dom.test.tsx`: navigation, focus, Escape, and reduced-motion coverage.
- `utils/runeliteGuideState.ts`: direct-query parsing and safe removal while preserving unrelated query parameters.
- `utils/runeliteGuideState.test.ts`: exact query-state behaviour.
- `components/CommandPalette.tsx`: RuneLite guide command.
- `components/CommandPalette.test.tsx`: command label/target contract.
- `App.tsx`: lazy import, menu item, direct open, command event, focus target, and modal ownership.
- `App.lifecycle.test.tsx`: startup/direct-query/changelog deferral contract.
- `data/changelog.ts`: mandatory player-facing release note.
- `data/changelog.test.ts`: release-note contract.

---

### Task 1: Capture and validate authentic Plugin Hub screenshots

**Files:**
- Create: `public/guides/runelite/01-plugin-hub-install.png`
- Create: `public/guides/runelite/02-panel-disconnected.png`
- Create: `public/guides/runelite/03-companion-confirmation.png`
- Create: `public/guides/runelite/04-panel-connected.png`
- Create: `public/guides/runelite/05-unified-panel.png`
- Create: `public/guides/runelite/06-current-chunk.png`
- Create: `public/guides/runelite/07-guardian.png`
- Create: `public/guides/runelite/08-roll-inbox.png`
- Create: `public/guides/runelite/09-run-keys.png`
- Create: `public/guides/runelite/10-bundle-recovery.png`
- Create: `public/guides/runelite/11-warnings.png`
- Create: `public/guides/runelite/12-rendering.png`
- Create: `public/guides/runelite/13-world-map-tooltip.png`
- Create: `public/guides/runelite/14-scene-minimap-hud.png`
- Create when safely reproducible: `public/guides/runelite/15-locked-warning.png`
- Create: `public/guides/runelite/manifest.json`
- Create: `data/runeliteGuideAssets.test.ts`

**Interfaces:**
- Produces: 14 required authentic PNG captures plus one safe-availability warning capture.
- Produces: manifest version `1`, `pluginCommit`, `capturedAt`, and an `entries` array keyed by stable screenshot IDs.
- Preserves: unannotated source pixels; annotations remain metadata until `GuideScreenshot` renders them.

- [ ] **Step 1: Write the failing asset-contract test**

Create `data/runeliteGuideAssets.test.ts` with this inventory and PNG header validation:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const required = [
  'plugin-hub-install', 'panel-disconnected', 'companion-confirmation',
  'panel-connected', 'unified-panel', 'current-chunk', 'guardian',
  'roll-inbox', 'run-keys', 'bundle-recovery', 'warnings', 'rendering',
  'world-map-tooltip', 'scene-minimap-hud',
] as const;

const root = resolve('public/guides/runelite');

describe('RuneLite guide screenshot assets', () => {
  it('records the exact live Plugin Hub source and every required capture', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
    expect(manifest.version).toBe(1);
    expect(manifest.pluginCommit).toBe('1e118ec73f5a0fad17fc7b0704461a602d169041');
    expect(manifest.entries.map((entry: { id: string }) => entry.id))
      .toEqual(expect.arrayContaining(required));
  });

  it.each(required)('%s is a real non-empty PNG with dimensions', (id) => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
    const entry = manifest.entries.find((candidate: { id: string }) => candidate.id === id);
    expect(entry).toBeTruthy();
    const path = resolve(root, entry.filename);
    expect(existsSync(path)).toBe(true);
    const png = readFileSync(path);
    expect([...png.subarray(1, 4)]).toEqual([80, 78, 71]);
    expect(png.readUInt32BE(16)).toBe(entry.width);
    expect(png.readUInt32BE(20)).toBe(entry.height);
    expect(entry.width).toBeGreaterThan(200);
    expect(entry.height).toBeGreaterThan(150);
  });
});
```

- [ ] **Step 2: Run the asset test and verify the red state**

Run:

```powershell
npx vitest run data/runeliteGuideAssets.test.ts
```

Expected: failure because `public/guides/runelite/manifest.json` and the source captures do not exist.

- [ ] **Step 3: Prepare a privacy-safe real capture session**

Use the installed Plugin Hub listing for the install screenshot. For panel
captures, run source commit `1e118ec73f5a0fad17fc7b0704461a602d169041`
inside RuneLite with a dedicated temporary RuneLite home, then create/connect a
fictional **Guide Demo** tracker profile. Before saving each capture, inspect
the entire frame and exclude pairing codes, real account names, real Run IDs,
unrelated chat, and identifying local paths.

Do not copy RuneLite credentials into the temporary home. If signed-in game
state is required for map/scene captures, use the user's already-running live
Plugin Hub client only for read-only capture and crop unrelated player data.

- [ ] **Step 4: Capture the exact inventory**

Save the 14 required files using the exact filenames in the file map. Capture
`15-locked-warning.png` only if the installed plugin produces a genuine warning
through a safe player action; otherwise omit it and record the availability
reason in the manifest. Do not stage image-generation output or reconstructed
Swing panels.

- [ ] **Step 5: Author the manifest**

Create `public/guides/runelite/manifest.json` with this concrete shape for
every image:

```json
{
  "version": 1,
  "pluginCommit": "1e118ec73f5a0fad17fc7b0704461a602d169041",
  "capturedAt": "2026-07-28",
  "entries": [
    {
      "id": "panel-disconnected",
      "filename": "02-panel-disconnected.png",
      "chapter": "connect-tracker",
      "purpose": "Locate the Connect tracker control and connection status rows.",
      "width": 0,
      "height": 0,
      "redactions": [],
      "annotations": [
        { "id": "connect-button", "marker": 1, "x": 0.5, "y": 0.16 },
        { "id": "connection-state", "marker": 2, "x": 0.28, "y": 0.28 }
      ]
    }
  ]
}
```

Replace each `0` dimension with the actual PNG IHDR values and use normalized
`x`/`y` coordinates from `0` through `1`. Entries with redactions list the
specific excluded field; entries without redactions keep `[]`.

- [ ] **Step 6: Run the asset test and verify the green state**

Run:

```powershell
npx vitest run data/runeliteGuideAssets.test.ts
```

Expected: all screenshot IDs, commit metadata, files, PNG signatures, and dimensions pass.

- [ ] **Step 7: Commit the authentic asset set**

```powershell
git add -- public/guides/runelite data/runeliteGuideAssets.test.ts
git commit -m "docs: capture live RuneLite plugin guide screens"
```

### Task 2: Author the complete typed player-guide content

**Files:**
- Create: `data/runeliteGuide.ts`
- Create: `data/runeliteGuide.test.ts`

**Interfaces:**
- Produces: `GuideChapterId`, `GuideChapter`, `GuideScreenshot`, `GuideCallout`, `GuideSetting`, `GuidePreset`, `GuideTroubleshootingItem`, and `GuideGlossaryItem`.
- Produces: `RUNELITE_GUIDE_CHAPTERS`, `RUNELITE_PANEL_SECTIONS`, `RUNELITE_GUIDE_SETTINGS`, `RUNELITE_GUIDE_SCREENSHOTS`, `RUNELITE_GUIDE_PRESETS`, `RUNELITE_GUIDE_TROUBLESHOOTING`, and `RUNELITE_GUIDE_GLOSSARY`.
- Consumes: the exact screenshot IDs and manifest coordinates from Task 1.

- [ ] **Step 1: Write the failing authored-content test**

Create `data/runeliteGuide.test.ts` with exact contracts:

```ts
import { describe, expect, it } from 'vitest';
import {
  RUNELITE_GUIDE_CHAPTERS, RUNELITE_GUIDE_SETTINGS,
  RUNELITE_GUIDE_SCREENSHOTS, RUNELITE_PANEL_SECTIONS,
} from './runeliteGuide';

describe('RuneLite player guide authored content', () => {
  it('contains the approved 16 chapters and seven real panel sections', () => {
    expect(RUNELITE_GUIDE_CHAPTERS.map(chapter => chapter.id)).toEqual([
      'what-it-does', 'install-plugin-hub', 'connect-tracker',
      'connection-privacy', 'unified-panel', 'current-chunk', 'guardian',
      'roll-inbox', 'run-and-keys', 'bundle-recovery', 'warnings',
      'rendering', 'in-game-overlays', 'recommended-configurations',
      'troubleshooting', 'glossary',
    ]);
    expect(RUNELITE_PANEL_SECTIONS).toEqual([
      'Current chunk', 'Guardian', 'Roll inbox', 'Run',
      'Bundle', 'Warnings', 'Rendering',
    ]);
  });

  it('documents all 30 settings once and labels all three Keys exactly', () => {
    expect(RUNELITE_GUIDE_SETTINGS).toHaveLength(30);
    expect(new Set(RUNELITE_GUIDE_SETTINGS.map(setting => setting.key)).size).toBe(30);
    const guide = JSON.stringify(RUNELITE_GUIDE_CHAPTERS);
    expect(guide).toContain('Keys');
    expect(guide).toContain('Omni Keys');
    expect(guide).toContain('Chaos Keys');
  });

  it('keeps the privacy and Strict Mode truth in player copy', () => {
    const guide = JSON.stringify(RUNELITE_GUIDE_CHAPTERS);
    expect(guide).toContain('does not upload gameplay data');
    expect(guide).toContain('IP address');
    expect(guide).toContain('off by default');
    expect(guide).toContain('fails open');
    expect(guide).toContain('60 seconds');
  });

  it('references only authentic screenshot IDs', () => {
    const ids = new Set(RUNELITE_GUIDE_SCREENSHOTS.map(image => image.id));
    for (const chapter of RUNELITE_GUIDE_CHAPTERS) {
      for (const id of chapter.screenshotIds) expect(ids.has(id)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the authored-content test and verify the red state**

Run:

```powershell
npx vitest run data/runeliteGuide.test.ts
```

Expected: failure because `data/runeliteGuide.ts` does not exist.

- [ ] **Step 3: Define the guide types and exact inventories**

Create `data/runeliteGuide.ts` with these public shapes:

```ts
export const RUNELITE_GUIDE_CHAPTER_IDS = [
  'what-it-does', 'install-plugin-hub', 'connect-tracker',
  'connection-privacy', 'unified-panel', 'current-chunk', 'guardian',
  'roll-inbox', 'run-and-keys', 'bundle-recovery', 'warnings',
  'rendering', 'in-game-overlays', 'recommended-configurations',
  'troubleshooting', 'glossary',
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
```

Author all 16 exact IDs from the failing test. Transcribe the approved chapter
facts from the design specification into `summary`, `paragraphs`, and `bullets`
without developer jargon. Define all 30 settings using the exact labels/defaults
from the specification and the actual descriptions in `FateLockedConfig.java`.

- [ ] **Step 4: Add screenshots, presets, troubleshooting, and glossary**

Map every manifest entry to `/guides/runelite/<filename>` and author accessible
callout labels/bodies for every annotation ID. Add the four approved presets:
Balanced defaults, High visibility, Minimal screen, and Strict travel. Add all
ten troubleshooting scenarios and the approved glossary terms from the spec.

- [ ] **Step 5: Run the authored-content test and verify the green state**

Run:

```powershell
npx vitest run data/runeliteGuide.test.ts data/runeliteGuideAssets.test.ts
```

Expected: 16 chapters, seven sections, 30 settings, privacy contracts, Key definitions, screenshot references, and assets all pass.

- [ ] **Step 6: Commit the typed guide content**

```powershell
git add -- data/runeliteGuide.ts data/runeliteGuide.test.ts
git commit -m "docs: author complete RuneLite player guide"
```

### Task 3: Render authentic screenshots and settings accessibly

**Files:**
- Create: `components/runelite-guide/GuideScreenshot.tsx`
- Create: `components/runelite-guide/GuideSettingsTable.tsx`
- Create: `components/runelite-guide/GuideScreenshot.dom.test.tsx`
- Create: `components/runelite-guide/GuideSettingsTable.test.tsx`

**Interfaces:**
- Consumes: `GuideScreenshot` and `GuideSetting` from `data/runeliteGuide.ts`.
- Produces: `GuideScreenshot({ screenshot })` and `GuideSettingsTable({ settings })`.

- [ ] **Step 1: Write the failing screenshot DOM test**

Mount a two-callout fixture and assert the authentic `<img>`, percentage-based
marker positions, numbered accessible callout list, safe original-size link,
and missing-image fallback after dispatching `error` on the image.

```tsx
expect(host.querySelector('img')?.getAttribute('src')).toBe('/guides/runelite/demo.png');
expect(host.querySelectorAll('[data-guide-marker]')).toHaveLength(2);
expect(host.textContent).toContain('1. Connect tracker');
expect(host.querySelector('a')?.rel.split(/\s+/).sort()).toEqual(['noopener', 'noreferrer']);
```

- [ ] **Step 2: Write the failing settings rendering test**

Render one On and one Off fixture with `renderToStaticMarkup` and assert the
label, default, purpose, visible result, and change guidance are all visible in
semantic rows.

- [ ] **Step 3: Run both component tests and verify the red state**

Run:

```powershell
npx vitest run components/runelite-guide/GuideScreenshot.dom.test.tsx components/runelite-guide/GuideSettingsTable.test.tsx
```

Expected: failure because both components are absent.

- [ ] **Step 4: Implement `GuideScreenshot`**

Render a `<figure>` containing the untouched `<img>`, an absolute SVG overlay
with amber marker circles at `left: ${x * 100}%` and `top: ${y * 100}%`, a
numbered `<figcaption><ol>`, and a safe **Open original size** link. Set an
`imageFailed` state on `onError` and replace only the image/overlay with an
explicit unavailable message while preserving title and callout text.

- [ ] **Step 5: Implement `GuideSettingsTable`**

Use a semantic desktop table and stacked mobile cards driven by the same
setting array. Show Default, What it does, What you see, and Change it when.
Use text plus color for On/Off so the default never relies on color alone.

- [ ] **Step 6: Run both component tests and verify the green state**

Run:

```powershell
npx vitest run components/runelite-guide/GuideScreenshot.dom.test.tsx components/runelite-guide/GuideSettingsTable.test.tsx
```

Expected: both rendering suites pass.

- [ ] **Step 7: Commit the reusable guide primitives**

```powershell
git add -- components/runelite-guide/GuideScreenshot.tsx components/runelite-guide/GuideSettingsTable.tsx components/runelite-guide/GuideScreenshot.dom.test.tsx components/runelite-guide/GuideSettingsTable.test.tsx
git commit -m "feat: render annotated RuneLite guide content"
```

### Task 4: Build the responsive guided handbook

**Files:**
- Create: `components/runelite-guide/RunelitePluginGuide.tsx`
- Create: `components/runelite-guide/RunelitePluginGuide.test.tsx`
- Create: `components/runelite-guide/RunelitePluginGuide.dom.test.tsx`

**Interfaces:**
- Consumes: all guide exports from `data/runeliteGuide.ts` and both Task 3 components.
- Produces: `RunelitePluginGuide({ onClose, returnFocusTarget? })`.

- [ ] **Step 1: Write the failing semantic render test**

Render the guide to static markup and assert the labelled full-screen dialog,
five-minute setup, 16 stable chapter anchors, seven panel names, all 30 setting
labels, authentic screenshot paths, four presets, troubleshooting, glossary,
and two accessible close controls.

- [ ] **Step 2: Write the failing DOM navigation/focus test**

Mount the guide with a persistent opener. Click the `guardian` contents link,
assert `scrollIntoView` receives reduced-motion-aware behaviour, assert the
link becomes `aria-current="location"`, press Escape, and prove focus returns
to the persistent opener.

- [ ] **Step 3: Run both guide suites and verify the red state**

Run:

```powershell
npx vitest run components/runelite-guide/RunelitePluginGuide.test.tsx components/runelite-guide/RunelitePluginGuide.dom.test.tsx
```

Expected: failure because `RunelitePluginGuide` does not exist.

- [ ] **Step 4: Implement the handbook shell**

Use `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, the existing
`useFocusTrap`, and the existing `useEscapeKey`. Render a sticky desktop
contents rail, mobile `<details>` contents, article chapters, screenshots,
settings tables, presets, troubleshooting, glossary, and top/bottom close
buttons. Lazy loading is handled by `App.tsx`, not inside this component.

- [ ] **Step 5: Implement chapter navigation**

On contents activation, call `scrollIntoView({ behavior: reducedMotion ?
'auto' : 'smooth', block: 'start' })`, update active chapter state, and close
the mobile contents element. Use a single `IntersectionObserver` to update the
active link while the player scrolls; disconnect it on unmount.

- [ ] **Step 6: Run both guide suites and verify the green state**

Run:

```powershell
npx vitest run components/runelite-guide/RunelitePluginGuide.test.tsx components/runelite-guide/RunelitePluginGuide.dom.test.tsx
```

Expected: handbook content, semantics, navigation, Escape, reduced motion, and focus restoration pass.

- [ ] **Step 7: Commit the handbook**

```powershell
git add -- components/runelite-guide/RunelitePluginGuide.tsx components/runelite-guide/RunelitePluginGuide.test.tsx components/runelite-guide/RunelitePluginGuide.dom.test.tsx
git commit -m "feat: add guided RuneLite plugin handbook"
```

### Task 5: Wire menu, command palette, direct query, and modal ownership

**Files:**
- Create: `utils/runeliteGuideState.ts`
- Create: `utils/runeliteGuideState.test.ts`
- Create: `components/CommandPalette.test.tsx`
- Modify: `components/CommandPalette.tsx`
- Modify: `App.tsx`
- Modify: `App.lifecycle.test.tsx`

**Interfaces:**
- Produces: `hasRuneliteGuideQuery(search: string): boolean` and `removeRuneliteGuideQuery(search: string): string`.
- Dispatches/consumes: `fate:nav` target `open:runelite-guide`.
- Adds: `HeaderProps.onOpenRuneliteGuide(returnFocusTarget)`.

- [ ] **Step 1: Write the failing query tests**

```ts
expect(hasRuneliteGuideQuery('?open=runelite-guide')).toBe(true);
expect(hasRuneliteGuideQuery('?open=other')).toBe(false);
expect(removeRuneliteGuideQuery('?open=runelite-guide&foo=bar')).toBe('?foo=bar');
expect(removeRuneliteGuideQuery('?open=runelite-guide')).toBe('');
```

- [ ] **Step 2: Write the failing menu/command/startup contracts**

Add a Command Palette render contract for title **RuneLite Plugin Guide**,
keywords `runelite plugin connect guardian warnings rendering`, and target
`open:runelite-guide`. Extend `App.lifecycle.test.tsx` to assert that the
lazy import, settings/help menu label, header callback, command-event mapping,
and direct-query helpers are wired. Add a changelog-state test proving a
pending direct guide prevents automatic What's New from taking the top layer.

- [ ] **Step 3: Run the focused tests and verify the red state**

Run:

```powershell
npx vitest run utils/runeliteGuideState.test.ts components/CommandPalette.test.tsx App.lifecycle.test.tsx utils/changelogState.test.ts
```

Expected: failures because query helpers, menu/command entries, modal state, and deferral do not exist.

- [ ] **Step 4: Implement query helpers**

Parse with `URLSearchParams`; match only the exact value `runelite-guide`.
`removeRuneliteGuideQuery` deletes only `open` and preserves all unrelated
parameters and ordering supported by `URLSearchParams`.

- [ ] **Step 5: Add the command and menu entry**

Add an Account-group command with `BookOpen`, title **RuneLite Plugin Guide**,
subtitle **Install, connect, configure and troubleshoot RuneLite**, and target
`open:runelite-guide`. Add the same label to the settings/help menu above
What's New; pass the persistent settings trigger as the manual focus target.

- [ ] **Step 6: Add lazy modal state and direct opening**

Lazy-import `components/runelite-guide/RunelitePluginGuide`. Initialize
`showRuneliteGuide` from `hasRuneliteGuideQuery(window.location.search)`, then
replace the URL with `removeRuneliteGuideQuery` while preserving pathname and
hash. Add `open:runelite-guide` to the `fate:nav` map. Include the guide in
top-level Escape/modal ownership and suppress underlying App/global modals
while it is open. Pass the manual opener through `returnFocusTarget`.

- [ ] **Step 7: Defer automatic What's New for the direct guide**

Add optional `hasPendingGuidePrompt` to `shouldAutoOpenChangelog` and require it
to be false. Pass the direct-query/guide state from `App.tsx`, preserving all
existing sync, pairing, onboarding, and game-mode precedence.

- [ ] **Step 8: Run the focused tests and verify the green state**

Run:

```powershell
npx vitest run utils/runeliteGuideState.test.ts components/CommandPalette.test.tsx App.lifecycle.test.tsx utils/changelogState.test.ts components/runelite-guide
```

Expected: menu, command, direct query, modal precedence, focus, and handbook suites pass.

- [ ] **Step 9: Commit integration**

```powershell
git add -- App.tsx App.lifecycle.test.tsx components/CommandPalette.tsx components/CommandPalette.test.tsx utils/runeliteGuideState.ts utils/runeliteGuideState.test.ts utils/changelogState.ts utils/changelogState.test.ts
git commit -m "feat: integrate RuneLite plugin guide"
```

### Task 6: Add mandatory release notes and maintenance contracts

**Files:**
- Modify: `data/changelog.test.ts`
- Modify: `data/changelog.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: a new latest player-facing release titled **RuneLite Plugin Guide**.
- Produces: a README link to `?open=runelite-guide` under the RuneLite integration section.

- [ ] **Step 1: Write the failing release-note test**

Assert the latest release title is **RuneLite Plugin Guide** and its Added
section contains:

```text
A complete RuneLite Plugin Guide now covers installation, connection, every panel section and setting, overlays, privacy, recommended configurations, and troubleshooting with annotated screenshots from the live plugin.
```

- [ ] **Step 2: Run the changelog test and verify the red state**

Run:

```powershell
npx vitest run data/changelog.test.ts
```

Expected: failure because the new latest release is absent.

- [ ] **Step 3: Add the release and README link**

Prepend a unique 28 July 2026 release ID and the exact tested Added note.
Link the README's RuneLite section to
`https://nubles.github.io/OSRS-Fate-Locked/?open=runelite-guide` and state that
the guide is player-facing and uses the current Plugin Hub interface.

- [ ] **Step 4: Run the release-note and mandatory gate tests**

Run:

```powershell
npx vitest run data/changelog.test.ts
npm run changelog:verify
```

Expected: both pass and the gate recognises the guide as documented player-facing work.

- [ ] **Step 5: Commit the release documentation**

```powershell
git add -- data/changelog.ts data/changelog.test.ts README.md
git commit -m "docs: announce RuneLite plugin guide"
```

### Task 7: Verify layout, release, and production deployment

**Files:**
- Verify: all branch changes
- Publish: GitHub pull request targeting `main`

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: merged production guide and verified GitHub Pages deployment.

- [ ] **Step 1: Run the complete local release gate**

```powershell
npm run release:verify
git diff --check origin/main...HEAD
git status --short --branch
```

Expected: changelog gate, all Vitest suites, TypeScript, deterministic content checks, production build, and whitespace checks pass; the worktree is clean.

- [ ] **Step 2: Start the production preview**

Run the built `dist` with the existing hidden Vite preview convention at
`http://127.0.0.1:4173/`. Verify HTTP 200 for both `/` and
`/?open=runelite-guide`.

- [ ] **Step 3: Perform desktop visual verification**

Open `http://127.0.0.1:4173/?open=runelite-guide` at approximately 1440 × 1000.
Verify the sticky contents, quick start, authentic image crops, annotation
alignment, settings tables, active chapter state, original-size links, and
top/bottom close controls. Save a review screenshot outside the published
asset directory so it cannot be mistaken for a Plugin Hub capture.

- [ ] **Step 4: Perform mobile visual verification**

Repeat at approximately 390 × 844. Verify collapsible contents, stacked
settings cards, readable markers/callouts, horizontal overflow absence,
original-size access, focus indicators, and reduced-motion behaviour.

- [ ] **Step 5: Review scope, screenshot privacy, and secrets**

```powershell
git diff --stat origin/main...HEAD
git diff --name-status origin/main...HEAD
git log --oneline origin/main..HEAD
rg -n "runelite-pair=|[0-9a-f]{32}|%USERPROFILE%\\\\Users|C:\\\\Users\\" public/guides/runelite data/runeliteGuide.ts
```

Expected: only guide/spec/plan/integration/release files appear; no pairing
code, personal account, personal Run ID, identifying path, save data, or
unrelated worktree changes appear.

- [ ] **Step 6: Push and open the pull request**

Push `docs/runelite-plugin-player-guide` and open a ready PR titled:

```text
Add the complete RuneLite plugin player guide
```

The body links the live Plugin Hub listing, names source commit `1e118ec...`,
states that every screenshot is authentic and privacy-reviewed, lists the 16
chapters/seven sections/30 settings, and includes exact verification results.

- [ ] **Step 7: Wait for hosted CI and merge**

Wait for `CI / quality` on the exact PR head SHA. Merge only after success and
only if the PR remains clean and mergeable.

- [ ] **Step 8: Confirm GitHub Pages deployment**

Wait for the merge-triggered **Deploy to GitHub Pages** workflow. Confirm HTTP
200 for:

```text
https://nubles.github.io/OSRS-Fate-Locked/
https://nubles.github.io/OSRS-Fate-Locked/?open=runelite-guide
https://nubles.github.io/OSRS-Fate-Locked/version.json
```

Verify `version.json` contains the merge commit and the deployed JavaScript
contains **RuneLite Plugin Guide**, the 16 chapter IDs, the privacy sentence,
and source references for all required authentic screenshots.

- [ ] **Step 9: Confirm the live player journey**

Open the production direct link, use the contents to navigate to Guardian,
open one source screenshot at original size, close the guide, reopen it from
the settings/help menu, and confirm the tracker run remains unchanged.
