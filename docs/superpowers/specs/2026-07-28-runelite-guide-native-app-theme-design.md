# RuneLite Plugin Guide — Native Fate Locked Theme

**Date:** 2026-07-28
**Status:** Approved design direction
**Scope:** RuneLite Plugin Guide only

## Outcome

Restyle the existing RuneLite Plugin Guide so it looks and behaves like a native
Fate Locked control panel. The guide must no longer feel like a separate
editorial website placed over the app.

The redesign changes presentation only. It preserves the complete guide,
authentic screenshots, Vanilla recommendation, unfinished-Chunked warning,
navigation, direct link, accessibility behavior, and all existing entry points.

## Scope boundaries

### In scope

- `RunelitePluginGuide`
- `GuideScreenshot`
- `GuideSettingsTable`
- Guide-specific presentation tests
- A mandatory player-facing What's New entry for the visual refresh

### Out of scope

- The surrounding Fate Locked dashboard and its global design system
- RuneLite plugin behavior or settings
- Guide copy, chapter order, screenshot annotations, or screenshot capture
- Pairing, relay, export, game-state, or progression logic
- Chunked mode implementation

## Current mismatch

The guide currently uses an editorial handbook treatment: oversized rounded
cards, serif headings, large gradients, broad spacing, and a full-page reading
layout. Fate Locked itself is denser and more operational: compact `rounded-lg`
panels, sans-serif headings, dark utility surfaces, thin borders, amber active
states, tab-like controls, and restrained shadows.

The redesign removes the guide-only visual language and composes the guide from
the same patterns already visible in the dashboard, app header, control panel,
and What's New modal.

## Visual system

The guide will use the existing application tokens and established equivalents:

| Role | Treatment |
| --- | --- |
| Backdrop | `bg-black/85` with the app's restrained blur |
| Dialog shell | `bg-[#171717]`, thin amber outer border, `rounded-xl`, `shadow-2xl` |
| Primary panel | `bg-osrs-panel` or `bg-[#2d2d2d]`, `border-osrs-border` |
| Secondary panel | `bg-[#1b1b1b]` or `bg-[#252525]`, thin `border-white/10` |
| Page background | `bg-osrs-bg` |
| Primary text | `text-gray-100` |
| Supporting text | `text-gray-400` and `text-gray-500` |
| Active/accent | `text-osrs-gold`, amber border, amber-tinted background |
| Semantic states | Emerald, cyan, violet, and red only when meaning requires them |
| Radius | Mostly `rounded-lg`; `rounded-xl` only for the outer dialog |
| Typography | Existing sans-serif app typography; no guide-only serif headings |
| Motion | Existing short transitions; no decorative motion beyond current navigation |

Large hero gradients, oversized circular chapter numbers, floating editorial
cards, and excessive pill treatments will be removed.

## Dialog architecture

The guide remains a modal so all existing ownership, focus, and URL behavior
continues to work. Its internal structure changes to match other Fate Locked
modals:

1. A compact fixed header with the amber icon tile, title, short subtitle, and
   close control.
2. A bounded two-column body on desktop.
3. A compact left navigation rail and independently scrolling guide content.
4. A fixed footer with the return-to-companion message and close button.

The dialog uses nearly the full available viewport without becoming an
unbounded page. The desktop shell uses `max-w-[96rem]` and `max-h-[92vh]`.
This keeps long-form content practical while retaining visible app modal
framing.

## Navigation rail

The existing 16 chapters remain in the same order. The desktop contents rail
becomes a native app tab list:

- Compact rows with a small numeric index.
- Amber text, border, and tinted surface for the active chapter.
- Neutral dark hover state for inactive chapters.
- Thin section labels group chapters without changing their data or order:
  `Getting started` for chapters 1–5, `Panel sections` for chapters 6–13,
  `Configuration` for chapter 14, and `Help` for chapters 15–16.
- The active-chapter tracking and click-to-scroll behavior remain unchanged.

On mobile, the rail becomes one compact expandable contents panel immediately
below the dialog header. Choosing a chapter collapses it, as it does now.

## Guide overview and five-minute setup

The current editorial introduction becomes a compact status panel:

- A small uppercase `PLAYER HANDBOOK` label.
- One concise summary line.
- A clearly bordered Vanilla status row.
- A subdued warning that Chunked mode is unfinished.

The five-minute setup becomes a five-step control strip. Each step resembles a
small dashboard action tile with a number, short title, and one-line
description. It remains keyboard-operable and continues to navigate to the
relevant chapter.

## Chapter panels

Every chapter becomes a compact Fate Locked panel:

- A dark header strip containing a square amber chapter index, sans-serif title,
  and summary.
- Body copy on the standard app surface.
- Bullets rendered as compact checklist or information rows instead of large
  cards.
- Consistent internal separators and 12–16px spacing.
- No chapter-level gradient or oversized shadow.

The seven RuneLite panel section names remain visible in the unified-panel
chapter, using the app's compact badge treatment.

## Authentic screenshot treatment

All current images and annotation coordinates are retained. Each screenshot is
placed inside a native app panel:

- Compact panel header with screenshot title, source note, and original-size
  action.
- Recessed black image well with a thin inner border.
- Existing numbered amber markers, reduced slightly to match app density while
  remaining readable.
- Annotation explanations rendered as compact numbered rows beneath the image.
- The current accessible image-failure state remains available and uses the same
  app panel styling.
- GitHub Pages base-path resolution remains unchanged and covered by tests.

No screenshot is recreated, fabricated, recolored, or cropped differently.

## Settings, presets, troubleshooting, and glossary

The 30 settings remain complete and exact.

Each setting uses a compact settings row:

- Setting name on the left and default-value badge on the right.
- `What it does`, `What you see`, and `Change it when` displayed as dense
  labeled fields.
- Two-column field layout where space permits, stacked on narrow screens.

Presets use the app's standard panel cards. Troubleshooting keeps native
collapsible rows with amber chevrons and thin dividers. Glossary entries become
compact definition rows. Official resources use the same small utility-button
and panel-link styling as the rest of Fate Locked.

## Accessibility and interaction preservation

The redesign must preserve:

- Dialog semantics, description, and title relationships.
- Focus trap and focus return.
- Escape-to-close behavior.
- Two accessible close controls.
- Keyboard-operable navigation and setup steps.
- Active chapter indication with `aria-current`.
- Reduced-motion-aware scrolling.
- Safe external links with `noopener noreferrer`.
- Legible contrast and visible focus rings.

No information may become hover-only, color-only, or visually hidden from
keyboard and screen-reader users.

## Responsive behavior

At desktop widths, the guide uses the fixed navigation rail and a separately
scrolling main content column. At tablet and mobile widths, content becomes a
single column with the expandable contents control.

The exact 390×844 mobile viewport must have no horizontal overflow, clipped
controls, hidden annotation text, or off-screen close action. Screenshot images
remain contained at their native aspect ratios.

## Verification

Implementation is complete only when:

- Existing guide content and asset-manifest tests pass.
- Presentation tests confirm native dialog structure, preserved semantics, and
  screenshot base-path behavior.
- All 16 chapters, 30 settings, 14 screenshots, presets, troubleshooting items,
  resources, and glossary entries remain present.
- The mandatory player-facing changelog gate passes.
- TypeScript, the full test suite, content verification, and production build
  pass.
- Desktop and exact 390×844 mobile visual checks confirm thematic consistency,
  readable screenshots, correct markers, and no overflow.
- The deployed direct link and Settings/command-palette entry points open the
  redesigned guide.

## Success criteria

A player opening the guide should immediately recognize it as part of Fate
Locked. The guide should share the app's panel density, typography, surfaces,
borders, control styling, and amber hierarchy while preserving every piece of
player guidance and every authentic RuneLite screenshot.
