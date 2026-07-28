# RuneLite Guide Native App Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle only the RuneLite Plugin Guide as a compact native Fate Locked modal while preserving all 16 chapters, 30 settings, 14 authentic screenshots, annotations, entry points, and accessibility behavior.

**Architecture:** Keep the existing typed guide data and modal ownership unchanged. Refactor presentation inside the three guide components: `RunelitePluginGuide` owns the bounded dialog, grouped navigation, overview, setup, chapter panels, and support sections; `GuideScreenshot` owns the authentic image frame and annotations; `GuideSettingsTable` owns dense responsive setting rows. Stable `data-guide-*` attributes provide presentation-test contracts without coupling behavioral tests to every Tailwind class.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, jsdom, Testing Library, Vite

## Global Constraints

- Scope is the RuneLite Plugin Guide only; do not restyle the surrounding Fate Locked dashboard or global design system.
- Do not change RuneLite plugin behavior, pairing, relay, export, game-state, progression logic, guide copy, chapter order, screenshot annotations, or screenshot capture.
- Preserve exactly 16 chapters, 30 settings, 14 authentic screenshots, four presets, troubleshooting items, official resources, glossary entries, and the seven RuneLite panel section names.
- Keep Vanilla as the demonstrated mode and keep the visible warning that Chunked mode is unfinished.
- Use `bg-black/85` for the backdrop; `bg-[#171717]`, a thin amber border, `rounded-xl`, and `shadow-2xl` for the outer dialog; `bg-osrs-panel`/`#2d2d2d` with `border-osrs-border` for primary panels; and `#1b1b1b`/`#252525` with thin white borders for secondary panels.
- Use existing sans-serif application typography; no `font-serif` guide headings.
- Use mostly `rounded-lg`; reserve `rounded-xl` for the outer dialog. Remove `rounded-2xl`, large hero gradients, oversized circular chapter numbers, floating editorial cards, and excessive pill treatments from the rendered guide.
- The desktop shell is `max-w-[96rem]` and `max-h-[92vh]`, with a fixed header, fixed footer, compact left navigation rail, and independently scrolling content.
- Group chapters as `Getting started` (1–5), `Panel sections` (6–13), `Configuration` (14), and `Help` (15–16), without changing chapter order.
- On mobile, use one collapsible contents panel below the header; selecting a chapter must collapse it.
- Preserve dialog semantics, focus trap and return, Escape-to-close, both accessible close controls, keyboard navigation, `aria-current`, reduced-motion scrolling, safe external links, visible focus rings, and image-failure behavior.
- Preserve `resolveGuideScreenshotSrc` and GitHub Pages base-path behavior.
- The exact 390×844 viewport must have no horizontal overflow, clipped controls, hidden annotation text, or off-screen close action.
- Add a newest-first player-facing What's New release in `data/changelog.ts`; `npm run changelog:verify` is mandatory.
- Do not modify `data/runeliteGuide.ts` or any file under `public/guides/runelite/`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `components/runelite-guide/RunelitePluginGuide.tsx` | Bounded modal shell, grouped desktop/mobile contents, active navigation, overview, five-minute setup, chapter panels, presets, troubleshooting, resources, glossary, and fixed footer. |
| `components/runelite-guide/RunelitePluginGuide.dom.test.tsx` | Live DOM behavior: scrolling, reduced motion, Escape, focus return, fixed-region structure, grouped navigation, and mobile contents collapse. |
| `components/runelite-guide/RunelitePluginGuide.test.tsx` | Static completeness and presentation invariants for the fully rendered handbook. |
| `components/runelite-guide/GuideScreenshot.tsx` | Native screenshot panel, deployed asset resolution, authentic image, proportional markers, annotations, safe original-size link, and failure state. |
| `components/runelite-guide/GuideScreenshot.dom.test.tsx` | Screenshot-path, marker geometry, safe-link, failure-state, and native-panel contracts. |
| `components/runelite-guide/GuideSettingsTable.tsx` | Compact responsive settings rows and semantic labeled fields. |
| `components/runelite-guide/GuideSettingsTable.test.tsx` | Completeness, default badges, and responsive row-field contracts. |
| `data/changelog.ts` | Newest-first player-facing release note for the guide visual refresh. |
| `data/changelog.test.ts` | Latest-release identity and exact player-facing message. |

No new production component is required. The local helper components already colocated in `RunelitePluginGuide.tsx` share its navigation state and guide-only data, so splitting them would add indirection without a reusable boundary.

---

### Task 1: Native Dialog Shell, Grouped Navigation, and Overview

**Files:**
- Modify: `components/runelite-guide/RunelitePluginGuide.tsx`
- Modify: `components/runelite-guide/RunelitePluginGuide.dom.test.tsx`

**Interfaces:**
- Consumes: `RUNELITE_GUIDE_CHAPTERS`, `RUNELITE_GUIDE_CHAPTER_IDS`, `GuideChapterId`, `useFocusTrap`, and `useEscapeKey`.
- Produces: rendered anchors `data-runelite-guide-backdrop`, `data-runelite-guide-shell`, `data-runelite-guide-header`, `data-runelite-guide-body`, `data-runelite-guide-nav`, `data-guide-nav-group`, `data-runelite-guide-scroll-region`, `data-guide-overview`, `data-guide-quick-start`, and `data-runelite-guide-footer`.
- Preserves: `RunelitePluginGuideProps`, chapter anchor IDs, `navigateTo(chapterId: GuideChapterId): void`, `aria-current="location"`, two close buttons, and mobile `<details>` collapse.

- [ ] **Step 1: Add a reusable DOM-test opener and write the failing native-layout test**

Add this helper below `mount` in `RunelitePluginGuide.dom.test.tsx`:

```tsx
const openGuide = async (host: HTMLDivElement) => {
  const opener = host.querySelector<HTMLButtonElement>('[data-testid="guide-opener"]');
  if (!opener) throw new Error('Missing guide opener');
  opener.focus();
  await act(async () => {
    opener.click();
  });
  return opener;
};
```

Use `openGuide(host)` in the existing navigation test, then add:

```tsx
it('renders the bounded Fate Locked shell with grouped contents and fixed regions', async () => {
  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
  const host = await mount();
  await openGuide(host);

  const backdrop = host.querySelector<HTMLElement>('[data-runelite-guide-backdrop]');
  const shell = host.querySelector<HTMLElement>('[data-runelite-guide-shell]');
  const header = host.querySelector<HTMLElement>('[data-runelite-guide-header]');
  const body = host.querySelector<HTMLElement>('[data-runelite-guide-body]');
  const scrollRegion = host.querySelector<HTMLElement>('[data-runelite-guide-scroll-region]');
  const footer = host.querySelector<HTMLElement>('[data-runelite-guide-footer]');
  const desktopNav = host.querySelector<HTMLElement>(
    '[data-runelite-guide-nav="desktop"]',
  );
  const groupLabels = new Set(
    Array.from(host.querySelectorAll<HTMLElement>('[data-guide-nav-group]'))
      .map(node => node.dataset.guideNavGroup),
  );

  expect(shell).toBeTruthy();
  expect(backdrop?.className).toContain('bg-black/85');
  expect(shell?.className).toContain('max-w-[96rem]');
  expect(shell?.className).toContain('max-h-[92vh]');
  expect(shell?.className).toContain('bg-[#171717]');
  expect(shell?.className).toContain('border-amber-400/30');
  expect(header?.parentElement).toBe(shell);
  expect(body?.parentElement).toBe(shell);
  expect(footer?.parentElement).toBe(shell);
  expect(scrollRegion?.className).toContain('overflow-y-auto');
  expect(desktopNav).toBeTruthy();
  expect(groupLabels).toEqual(new Set([
    'Getting started',
    'Panel sections',
    'Configuration',
    'Help',
  ]));
  expect(host.querySelector('[data-guide-overview]')).toBeTruthy();
  expect(host.querySelector('[data-guide-quick-start]')).toBeTruthy();

  const mobileContents = host.querySelector<HTMLDetailsElement>(
    '[data-runelite-guide-mobile-contents]',
  );
  const mobileGuardian = host.querySelector<HTMLAnchorElement>(
    '[data-runelite-guide-nav="mobile"] a[href="#runelite-guide-guardian"]',
  );
  if (!mobileContents || !mobileGuardian) {
    throw new Error('Missing mobile guide contents');
  }
  await act(async () => {
    mobileContents.open = true;
    mobileGuardian.click();
  });
  expect(mobileContents.open).toBe(false);
  expect(scrollIntoView).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused DOM test and verify the new assertions fail**

Run:

```bash
npx vitest run components/runelite-guide/RunelitePluginGuide.dom.test.tsx
```

Expected: FAIL because `data-runelite-guide-shell` and the other native-layout anchors do not exist.

- [ ] **Step 3: Define the exact chapter groups and render one shared contents component**

Add this local contract above `FiveMinuteSetup` in `RunelitePluginGuide.tsx`:

```tsx
interface GuideNavGroup {
  readonly label: string;
  readonly chapterIds: readonly GuideChapterId[];
}

const GUIDE_NAV_GROUPS: readonly GuideNavGroup[] = [
  {
    label: 'Getting started',
    chapterIds: [
      'what-it-does',
      'install-plugin-hub',
      'connect-tracker',
      'connection-privacy',
      'unified-panel',
    ],
  },
  {
    label: 'Panel sections',
    chapterIds: [
      'current-chunk',
      'guardian',
      'roll-inbox',
      'run-and-keys',
      'bundle-recovery',
      'warnings',
      'rendering',
      'in-game-overlays',
    ],
  },
  {
    label: 'Configuration',
    chapterIds: ['recommended-configurations'],
  },
  {
    label: 'Help',
    chapterIds: ['troubleshooting', 'glossary'],
  },
];
```

Add this shared component immediately below `ContentsLink`:

```tsx
interface GuideContentsProps {
  readonly mode: 'desktop' | 'mobile';
  readonly activeChapter: GuideChapterId;
  readonly onNavigate: (chapterId: GuideChapterId) => void;
}

const GuideContents: React.FC<GuideContentsProps> = ({
  mode,
  activeChapter,
  onNavigate,
}) => (
  <nav
    data-runelite-guide-nav={mode}
    aria-label={mode === 'desktop'
      ? 'RuneLite guide contents'
      : 'Mobile RuneLite guide contents'}
    className={mode === 'desktop'
      ? 'h-full overflow-y-auto p-3 custom-scrollbar'
      : 'border-t border-osrs-border p-2'}
  >
    <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
      Contents
    </p>
    <div className="space-y-4">
      {GUIDE_NAV_GROUPS.map(group => (
        <section key={group.label} data-guide-nav-group={group.label}>
          <h2 className="px-2 pb-1 text-[10px] font-black uppercase tracking-[0.14em] text-gray-600">
            {group.label}
          </h2>
          <div className="space-y-0.5">
            {group.chapterIds.map(chapterId => {
              const chapter = RUNELITE_GUIDE_CHAPTERS.find(
                candidate => candidate.id === chapterId,
              );
              if (!chapter) return null;
              return (
                <ContentsLink
                  key={chapter.id}
                  chapter={chapter}
                  activeChapter={activeChapter}
                  onNavigate={onNavigate}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  </nav>
);
```

Use this component in both the desktop rail and mobile `<details>` so chapter order and navigation behavior cannot diverge.

- [ ] **Step 4: Replace the page-like modal with the bounded fixed-region shell**

Use these exact region attributes and class contracts:

```tsx
<div
  data-runelite-guide-backdrop
  className="fixed inset-0 z-[220] flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm sm:p-4"
>
  <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="runelite-guide-title"
    aria-describedby="runelite-guide-summary"
    tabIndex={-1}
    data-runelite-guide-shell
    className="flex h-[calc(100dvh-1rem)] max-h-[92vh] w-full max-w-[96rem] flex-col overflow-hidden rounded-xl border border-amber-400/30 bg-[#171717] text-gray-200 shadow-2xl sm:h-[calc(100dvh-2rem)]"
  >
```

The direct children of the dialog must be:

```tsx
<header
  data-runelite-guide-header
  className="shrink-0 border-b border-osrs-border bg-[#1b1b1b]"
>
```

```tsx
<div
  data-runelite-guide-body
  className="flex min-h-0 flex-1 overflow-hidden"
>
```

```tsx
<footer
  data-runelite-guide-footer
  className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-osrs-border bg-[#1b1b1b] px-4 py-3 text-center sm:flex-row sm:px-5 sm:text-left"
>
```

Inside the body, render a fixed desktop rail:

```tsx
<aside className="hidden w-72 shrink-0 border-r border-osrs-border bg-[#1b1b1b] lg:block">
  <GuideContents
    mode="desktop"
    activeChapter={activeChapter}
    onNavigate={navigateTo}
  />
</aside>
```

Render the guide content in:

```tsx
<main
  ref={contentRef}
  data-runelite-guide-scroll-region
  className="min-w-0 flex-1 overflow-y-auto bg-osrs-bg custom-scrollbar"
>
```

Add `const contentRef = useRef<HTMLElement>(null);` and change the `IntersectionObserver` option from `root: dialogRef.current` to `root: contentRef.current`. Keep the existing observer thresholds, reduced-motion check, chapter IDs, `scrollIntoView`, active state, and mobile-details close behavior unchanged.

- [ ] **Step 5: Restyle the header, mobile contents, overview, quick start, and footer**

Apply these exact presentation rules:

- Header: compact amber icon tile using `rounded-lg border border-amber-400/25 bg-amber-400/10`, sans-serif title, short subtitle, and the existing close button.
- Mobile contents: `rounded-lg border border-osrs-border bg-osrs-panel`, immediately inside the scrolling main region, visible only below `lg`.
- Overview: add `data-guide-overview`; use `rounded-lg border border-osrs-border bg-osrs-panel`; show the uppercase `PLAYER HANDBOOK` label, the existing summary, a bordered Vanilla status row, and the existing Chunked warning.
- Five-minute setup: add `data-guide-quick-start`; use one compact panel with a dark header and five small action tiles. Each tile keeps its existing `aria-label`, target chapter, and focus ring.
- Footer: move the existing return-to-companion copy and second close button out of the scrolling content and into `data-runelite-guide-footer`.

Use these exact overview and setup roots:

```tsx
<section
  data-guide-overview
  className="rounded-lg border border-osrs-border bg-osrs-panel"
  aria-labelledby="runelite-guide-summary"
>
```

```tsx
<section
  data-guide-quick-start
  className="overflow-hidden rounded-lg border border-osrs-border bg-osrs-panel"
  aria-labelledby="runelite-guide-quick-start"
>
```

Give the mobile `<details>` root `data-runelite-guide-mobile-contents` so the collapse behavior remains directly testable.

Do not change any player-facing sentence or navigation target in this task.

- [ ] **Step 6: Run the focused guide tests**

Run:

```bash
npx vitest run components/runelite-guide/RunelitePluginGuide.dom.test.tsx components/runelite-guide/RunelitePluginGuide.test.tsx
```

Expected: both test files PASS, including reduced-motion navigation, Escape, focus return, complete guide content, and both close controls.

- [ ] **Step 7: Commit the native shell**

```bash
git add components/runelite-guide/RunelitePluginGuide.tsx components/runelite-guide/RunelitePluginGuide.dom.test.tsx
git commit -m "feat: restyle RuneLite guide shell"
```

---

### Task 2: Compact Chapter and Support Panels

**Files:**
- Modify: `components/runelite-guide/RunelitePluginGuide.tsx`
- Modify: `components/runelite-guide/RunelitePluginGuide.test.tsx`

**Interfaces:**
- Consumes: the Task 1 scroll region and existing `RUNELITE_GUIDE_*` collections.
- Produces: `data-guide-chapter-panel`, `data-guide-chapter-header`, `data-guide-panel-section`, `data-guide-preset`, `data-guide-troubleshooting`, `data-guide-resource`, and `data-guide-glossary-row`.
- Preserves: every chapter ID/title/summary/paragraph/bullet, all preset adjustments, all troubleshooting fixes, every resource URL, glossary copy, and settings/screenshot placement.

- [ ] **Step 1: Write failing static presentation and completeness assertions**

Add these assertions to `RunelitePluginGuide.test.tsx` after the chapter loop:

```tsx
expect(html.match(/data-guide-chapter-panel=/g)).toHaveLength(
  RUNELITE_GUIDE_CHAPTERS.length,
);
expect(html.match(/data-guide-chapter-header=/g)).toHaveLength(
  RUNELITE_GUIDE_CHAPTERS.length,
);
expect(html.match(/data-guide-panel-section=/g)).toHaveLength(
  RUNELITE_PANEL_SECTIONS.length,
);
expect(html.match(/data-guide-preset=/g)).toHaveLength(
  RUNELITE_GUIDE_PRESETS.length,
);
expect(html.match(/data-guide-resource=/g)).toHaveLength(
  RUNELITE_GUIDE_RESOURCES.length,
);
expect(html).toContain('data-guide-troubleshooting=');
expect(html).toContain('data-guide-glossary-row=');
```

- [ ] **Step 2: Run the static guide test and verify the presentation contract fails**

Run:

```bash
npx vitest run components/runelite-guide/RunelitePluginGuide.test.tsx
```

Expected: FAIL because the new chapter/support `data-guide-*` attributes are absent.

- [ ] **Step 3: Convert each chapter to the native panel pattern**

Keep the existing chapter map and data selection. Change each chapter wrapper to:

```tsx
<section
  key={chapter.id}
  id={`runelite-guide-${chapter.id}`}
  data-guide-chapter={chapter.id}
  data-guide-chapter-panel={chapter.id}
  className="scroll-mt-4 overflow-hidden rounded-lg border border-osrs-border bg-osrs-panel"
  aria-labelledby={`runelite-guide-${chapter.id}-title`}
>
```

Render its heading in a compact dark strip:

```tsx
<header
  data-guide-chapter-header={chapter.id}
  className="flex items-start gap-3 border-b border-osrs-border bg-[#1b1b1b] px-4 py-3"
>
  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-amber-400/35 bg-amber-400/10 text-xs font-black text-osrs-gold">
    {chapter.number}
  </span>
  <div className="min-w-0">
    <h2
      id={`runelite-guide-${chapter.id}-title`}
      className="text-lg font-black text-gray-100 sm:text-xl"
    >
      {chapter.title}
    </h2>
    <p className="mt-1 text-sm leading-relaxed text-gray-400">
      {chapter.summary}
    </p>
  </div>
</header>
```

Place paragraphs and optional sections inside `className="space-y-5 p-4 sm:p-5"`. Render bullets as compact bordered information rows using `rounded-lg border border-white/10 bg-[#252525] px-3 py-2.5`; retain the existing amber dot and text.

- [ ] **Step 4: Restyle the panel-section list and support helpers**

Apply these exact contracts without changing mapped data:

- Unified panel names: each `<li>` gets `data-guide-panel-section={section}` and `rounded border border-amber-400/25 bg-amber-400/[0.07] px-2.5 py-1 text-xs font-bold text-amber-100`.
- Presets: each `<article>` gets `data-guide-preset={preset.id}` and `rounded-lg border border-osrs-border bg-[#252525] p-4`; use sans-serif `text-base font-bold`.
- Troubleshooting: each `<details>` gets `data-guide-troubleshooting={item.id}` and `rounded-lg border border-osrs-border bg-[#252525]`; keep native disclosure, amber marker, cause, and numbered fix list.
- Resources: each anchor gets `data-guide-resource={resource.id}`, the existing safe external-link attributes, and compact `rounded-lg border border-osrs-border bg-[#1b1b1b] p-3`.
- Glossary: each definition wrapper gets `data-guide-glossary-row={item.term}` and `rounded-lg border border-osrs-border bg-[#252525] p-3`.
- Settings-section heading: replace `font-serif` with `text-base font-black text-gray-100`.

Use these exact JSX property sets on the mapped elements:

```tsx
data-guide-panel-section={section}
className="rounded border border-amber-400/25 bg-amber-400/[0.07] px-2.5 py-1 text-xs font-bold text-amber-100"
```

```tsx
data-guide-preset={preset.id}
className="rounded-lg border border-osrs-border bg-[#252525] p-4"
```

```tsx
data-guide-troubleshooting={item.id}
className="group rounded-lg border border-osrs-border bg-[#252525]"
```

```tsx
data-guide-resource={resource.id}
className="group rounded-lg border border-osrs-border bg-[#1b1b1b] p-3 transition-colors hover:border-amber-400/35 hover:bg-amber-400/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
```

```tsx
data-guide-glossary-row={item.term}
className="rounded-lg border border-osrs-border bg-[#252525] p-3"
```

The troubleshooting and glossary chapters currently repeat their source lists in `chapter.bullets` and their specialized panels. Keep this existing content behavior in this presentation-only task.

- [ ] **Step 5: Run the guide component tests**

Run:

```bash
npx vitest run components/runelite-guide/RunelitePluginGuide.test.tsx components/runelite-guide/RunelitePluginGuide.dom.test.tsx
```

Expected: PASS with 16 compact chapter panels, all support data, navigation behavior, and accessibility behavior intact.

- [ ] **Step 6: Commit the chapter-panel redesign**

```bash
git add components/runelite-guide/RunelitePluginGuide.tsx components/runelite-guide/RunelitePluginGuide.test.tsx
git commit -m "feat: compact RuneLite guide chapters"
```

---

### Task 3: Native Authentic-Screenshot Panels

**Files:**
- Modify: `components/runelite-guide/GuideScreenshot.tsx`
- Modify: `components/runelite-guide/GuideScreenshot.dom.test.tsx`

**Interfaces:**
- Consumes: `GuideScreenshot` data with `src`, `title`, `alt`, and normalized callout coordinates.
- Produces: `data-guide-screenshot`, `data-guide-screenshot-header`, existing `data-guide-image-stage`, existing `data-guide-marker-layer`, existing `data-guide-marker`, and `data-guide-callout`.
- Preserves: `resolveGuideScreenshotSrc(src: string, baseUrl?: string): string`, native aspect ratio, marker percentages, lazy loading, alt text, safe original-size link, and visible failure-state text.

- [ ] **Step 1: Extend the screenshot DOM test with the native-panel contract**

Add these assertions in the first `GuideScreenshot` test:

```tsx
const panel = host.querySelector<HTMLElement>('[data-guide-screenshot="demo"]');
const panelHeader = host.querySelector<HTMLElement>('[data-guide-screenshot-header]');
const calloutRows = host.querySelectorAll<HTMLElement>('[data-guide-callout]');

expect(panel).toBeTruthy();
expect(panel?.className).toContain('rounded-lg');
expect(panel?.className).toContain('border-osrs-border');
expect(panelHeader).toBeTruthy();
expect(calloutRows).toHaveLength(screenshot.callouts.length);
expect(markers[0]?.className).toContain('h-6');
expect(markers[0]?.className).toContain('w-6');
expect(panel?.className).not.toContain('rounded-2xl');
expect(panel?.innerHTML).not.toContain('font-serif');
```

Keep all existing geometry, safe-link, failure-state, and deployed-base-path assertions.

- [ ] **Step 2: Run the screenshot test and verify the native-panel assertions fail**

Run:

```bash
npx vitest run components/runelite-guide/GuideScreenshot.dom.test.tsx
```

Expected: FAIL because the figure still uses the editorial frame and lacks the new screenshot/header/callout anchors.

- [ ] **Step 3: Restyle the figure without changing image or annotation data**

Use this outer structure:

```tsx
<figure
  data-guide-screenshot={screenshot.id}
  className="overflow-hidden rounded-lg border border-osrs-border bg-[#1b1b1b]"
  aria-labelledby={titleId}
>
  <figcaption
    data-guide-screenshot-header
    className="flex flex-wrap items-center justify-between gap-3 border-b border-osrs-border bg-[#252525] px-3 py-2.5 sm:px-4"
  >
```

Keep the existing title, source note, and original-size link in this header. Use `text-sm font-bold text-gray-100` for the title and retain `target="_blank"` plus `rel="noopener noreferrer"`.

Place the authentic image in:

```tsx
<div className="relative flex min-h-48 items-center justify-center overflow-hidden bg-black p-2 sm:p-3">
```

Keep `data-guide-image-stage`, `data-guide-marker-layer`, marker percentage styles, `<img>` attributes, and error callback. Make each visual marker compact with `h-6 w-6`, a one-pixel dark border, amber background, readable black number, and restrained shadow.

Render annotations beneath the image in:

```tsx
<ol className="grid gap-2 border-t border-osrs-border bg-[#1b1b1b] p-3 md:grid-cols-2">
```

Each annotation `<li>` gets `data-guide-callout={item.id}` and `rounded-lg border border-white/10 bg-[#252525] p-2.5`. Keep the visible `{marker}. {label}` and body exactly as authored.

Keep the failure state in the same image well, with `role="status"`, `Image unavailable`, and the existing recovery guidance. The annotations remain visible after image failure and markers remain absent.

- [ ] **Step 4: Run screenshot and asset-manifest regressions**

Run:

```bash
npx vitest run components/runelite-guide/GuideScreenshot.dom.test.tsx data/runeliteGuideAssets.test.ts
```

Expected: PASS, including `/OSRS-Fate-Locked/` resolution, authentic PNG dimensions, annotation coordinates, safe external link, and image-failure behavior.

- [ ] **Step 5: Commit the screenshot treatment**

```bash
git add components/runelite-guide/GuideScreenshot.tsx components/runelite-guide/GuideScreenshot.dom.test.tsx
git commit -m "feat: restyle RuneLite guide screenshots"
```

---

### Task 4: Dense Responsive Settings Rows

**Files:**
- Modify: `components/runelite-guide/GuideSettingsTable.tsx`
- Modify: `components/runelite-guide/GuideSettingsTable.test.tsx`

**Interfaces:**
- Consumes: `readonly GuideSetting[]`.
- Produces: one `data-guide-settings-list`, one `data-guide-setting-card={setting.key}` per setting, one `data-default-value={value}` badge per setting, and three labeled `<dl>` fields per row.
- Preserves: setting label, default value, purpose, visible result, and change guidance for every setting.

- [ ] **Step 1: Replace the desktop-table expectation with a failing compact-row contract**

Update the test name to `renders every setting as a compact native row with labeled fields`, remove the `<table>`/`scope="col"` expectations, and add:

```tsx
expect(markup).toContain('data-guide-settings-list="true"');
expect(markup.match(/data-guide-setting-card=/g)).toHaveLength(settings.length);
expect(markup.match(/data-guide-setting-fields=/g)).toHaveLength(settings.length);
expect(markup).not.toContain('<table');
expect(markup).not.toContain('rounded-2xl');
expect(markup).not.toContain('rounded-full');
```

Keep the existing assertions for both setting labels, all five values per setting, both default badges, and both `data-guide-setting-card` keys.

- [ ] **Step 2: Run the focused settings test and verify it fails**

Run:

```bash
npx vitest run components/runelite-guide/GuideSettingsTable.test.tsx
```

Expected: FAIL because the component still renders a desktop table, mobile-only cards, and pill badges.

- [ ] **Step 3: Implement one responsive native row per setting**

Replace `GuideSettingsTable` with this structure:

```tsx
export const GuideSettingsTable: React.FC<GuideSettingsTableProps> = ({ settings }) => (
  <div className="space-y-2" data-guide-settings-list>
    {settings.map(setting => (
      <article
        key={setting.key}
        className="rounded-lg border border-osrs-border bg-[#252525]"
        data-guide-setting-card={setting.key}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-3 py-2.5">
          <h4 className="text-sm font-bold text-gray-100">{setting.label}</h4>
          <DefaultBadge value={setting.defaultValue} />
        </header>
        <dl
          className="grid gap-3 px-3 py-3 text-sm sm:grid-cols-2 xl:grid-cols-3"
          data-guide-setting-fields
        >
          <div>
            <dt className="text-[10px] font-black uppercase tracking-wide text-gray-500">
              What it does
            </dt>
            <dd className="mt-1 leading-relaxed text-gray-300">{setting.purpose}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-black uppercase tracking-wide text-gray-500">
              What you see
            </dt>
            <dd className="mt-1 leading-relaxed text-gray-300">{setting.visibleResult}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-black uppercase tracking-wide text-gray-500">
              Change it when
            </dt>
            <dd className="mt-1 leading-relaxed text-gray-400">{setting.changeWhen}</dd>
          </div>
        </dl>
      </article>
    ))}
  </div>
);
```

Change `DefaultBadge` to use `rounded border px-2 py-1` instead of `rounded-full border px-2.5 py-1`. Preserve the current semantic color selection for On, Off, and other values and preserve `data-default-value={value}`.

- [ ] **Step 4: Run settings and complete-handbook tests**

Run:

```bash
npx vitest run components/runelite-guide/GuideSettingsTable.test.tsx components/runelite-guide/RunelitePluginGuide.test.tsx
```

Expected: PASS with all 30 settings still rendered by the complete-handbook test and no horizontally scrolling settings table.

- [ ] **Step 5: Commit the settings redesign**

```bash
git add components/runelite-guide/GuideSettingsTable.tsx components/runelite-guide/GuideSettingsTable.test.tsx
git commit -m "feat: compact RuneLite guide settings"
```

---

### Task 5: Player-Facing Release Note and Full Verification

**Files:**
- Modify: `components/runelite-guide/RunelitePluginGuide.test.tsx`
- Modify: `data/changelog.ts`
- Modify: `data/changelog.test.ts`
- Verify unchanged: `data/runeliteGuide.ts`
- Verify unchanged: `public/guides/runelite/`

**Interfaces:**
- Consumes: every rendered guide component from Tasks 1–4 and the existing newest-first changelog model.
- Produces: `LATEST_CHANGELOG.id === '2026-07-28-runelite-guide-native-theme'` and a whole-guide ban on the retired editorial class tokens.
- Preserves: direct-query opening, Settings entry point, command-palette entry point, focus return, all content counts, all screenshots, and all deploy-time asset paths.

- [ ] **Step 1: Add failing whole-guide theme assertions**

Append these assertions to the complete handbook test:

```tsx
expect(html).not.toContain('font-serif');
expect(html).not.toContain('rounded-2xl');
expect(html).not.toContain('bg-gradient-to-br');
expect(html.match(/\brounded-xl\b/g)).toHaveLength(1);
expect(html).toContain('data-runelite-guide-backdrop=');
expect(html).toContain('data-runelite-guide-shell=');
expect(html).toContain('data-guide-overview=');
expect(html).toContain('data-guide-quick-start=');
```

- [ ] **Step 2: Add the failing latest-release test**

Change the latest ID assertion in `data/changelog.test.ts` and add a dedicated test:

```tsx
expect(LATEST_CHANGELOG.id).toBe('2026-07-28-runelite-guide-native-theme');
```

```tsx
it('announces the native RuneLite guide visual refresh', () => {
  expect(LATEST_CHANGELOG).toMatchObject({
    id: '2026-07-28-runelite-guide-native-theme',
    title: 'RuneLite Guide Visual Refresh',
    date: '2026-07-28',
  });
  expect(LATEST_CHANGELOG.sections.changed).toContain(
    'The RuneLite Plugin Guide now uses the same compact panels, navigation, typography, and amber control styling as the Fate Locked companion while preserving every chapter, setting, and authentic screenshot.',
  );
});
```

Keep the earlier `announces the complete player-facing RuneLite guide` test, but find its release by ID instead of reading `LATEST_CHANGELOG`:

```tsx
const completeGuide = CHANGELOG_RELEASES.find(
  release => release.id === '2026-07-28-runelite-guide',
);
expect(completeGuide).toMatchObject({
  id: '2026-07-28-runelite-guide',
  title: 'RuneLite Plugin Guide',
  date: '2026-07-28',
});
expect(completeGuide?.sections.added).toContain(
  'A complete RuneLite Plugin Guide now covers installation, connection, every panel section and setting, overlays, privacy, recommended configurations, and troubleshooting with annotated screenshots from the live plugin.',
);
```

- [ ] **Step 3: Run the focused tests and verify the release-note test fails**

Run:

```bash
npx vitest run components/runelite-guide/RunelitePluginGuide.test.tsx data/changelog.test.ts
```

Expected: the whole-guide style test passes after Tasks 1–4; the changelog test FAILS because the new release is not yet first.

- [ ] **Step 4: Add the mandatory newest-first What's New entry**

Insert this object at the beginning of `CHANGELOG_RELEASES` in `data/changelog.ts`:

```tsx
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
```

Do not edit or reorder any prior release.

- [ ] **Step 5: Run focused guide, asset, lifecycle, and changelog tests**

Run:

```bash
npx vitest run components/runelite-guide/RunelitePluginGuide.test.tsx components/runelite-guide/RunelitePluginGuide.dom.test.tsx components/runelite-guide/GuideScreenshot.dom.test.tsx components/runelite-guide/GuideSettingsTable.test.tsx data/runeliteGuideAssets.test.ts data/changelog.test.ts App.lifecycle.test.tsx
```

Expected: PASS. This proves the full content is retained, screenshot paths remain deploy-safe, the new release is latest, direct-link and app entry points still open the guide, and focus returns correctly.

- [ ] **Step 6: Prove the player-facing changelog gate and immutable content boundary**

Run:

```bash
npm run changelog:verify
git diff --exit-code origin/main -- data/runeliteGuide.ts public/guides/runelite
```

Expected: `What's New verified` followed by an empty content/asset diff and exit code 0.

- [ ] **Step 7: Run the full production verification**

Run:

```bash
npm run release:verify
```

Expected: changelog verification, the complete Vitest suite, TypeScript, content verification, and the Vite production build all PASS.

- [ ] **Step 8: Perform desktop and exact-mobile visual verification**

Read the `browser:control-in-app-browser` skill before browser inspection. Serve the verified production build:

```bash
npm run preview -- --host 127.0.0.1 --port 4173
```

Open:

```text
http://127.0.0.1:4173/?open=runelite-guide
```

At 1440×1000 verify:

- The dialog is visibly bounded inside the black backdrop.
- Header and footer remain visible while only the main content column scrolls.
- The left rail is fixed, shows all four group labels, and highlights the active chapter in amber.
- The overview reads as an app status panel; Vanilla and the unfinished-Chunked warning are both immediately visible.
- Chapter panels, screenshot panels, presets, resources, troubleshooting, glossary, and setting rows use the same dark surfaces, thin borders, compact spacing, sans-serif type, and amber hierarchy as Fate Locked.
- Authentic screenshots retain their aspect ratio, and every amber marker sits over the image rather than the caption.

At exactly 390×844 verify:

- `document.documentElement.scrollWidth === window.innerWidth`.
- The close action remains visible.
- Desktop navigation is hidden and the mobile contents panel expands and collapses.
- Selecting `Guardian and Strict Mode` closes the mobile contents and scrolls to chapter 7.
- Settings fields stack without horizontal scrolling.
- Screenshot annotation text is fully visible and original-size links stay inside the panel.
- The fixed footer does not obscure the bottom of the scrolling content.

Capture one desktop screenshot and one 390×844 screenshot as verification evidence in the task report; do not add generated screenshots to `public/guides/runelite/`.

- [ ] **Step 9: Commit the release note and final presentation guard**

```bash
git add components/runelite-guide/RunelitePluginGuide.test.tsx data/changelog.ts data/changelog.test.ts
git commit -m "docs: announce RuneLite guide visual refresh"
```

- [ ] **Step 10: Confirm the branch contains only the approved redesign**

Run:

```bash
git status --short
git diff --stat origin/main...HEAD
git log --oneline --decorate origin/main..HEAD
```

Expected: clean working tree; changes limited to the approved design document, this plan, the three guide components, their tests, and changelog files; one focused implementation commit per task.
