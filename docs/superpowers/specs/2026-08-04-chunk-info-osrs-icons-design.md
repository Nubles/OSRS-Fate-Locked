# Chunk Info OSRS icon treatment

**Date:** 2026-08-04

## Objective

Replace the six Lucide glyphs in the Chunk Info sidebar with recognizable OSRS interface artwork while preserving the existing drawer layout, spacing, section behavior, accessibility, and game-state presentation.

The approved visual direction is **Interface-led OSRS icons**. The icons should feel like navigation markers from the game rather than generic product icons or narrow item illustrations.

## Approved icon mapping

Each section keeps its existing label and order. Only the decorative icon changes:

| Section | OSRS image | Existing fallback |
| --- | --- | --- |
| Quests | `https://oldschool.runescape.wiki/images/Quest_point_icon.png` | `Sparkles` |
| Combat | `https://oldschool.runescape.wiki/images/Combat_icon.png` | `Swords` |
| Gathering | `https://oldschool.runescape.wiki/images/Stats_icon.png` | `Pickaxe` |
| Shops | `https://oldschool.runescape.wiki/images/General_store_icon_(historical).png` | `Store` |
| Travel | `https://oldschool.runescape.wiki/images/Transportations_icon.png` | `Route` |
| Other | `https://oldschool.runescape.wiki/images/Collection_log_icon.png` | `Package` |

These are hosted using the same OSRS Wiki image pattern already present elsewhere in the application. The implementation does not add local copies of copyrighted game media.

## User experience

- The current cyan-tinted icon tile remains unchanged in size, placement, border radius, and surrounding spacing.
- Images render within the existing compact tile using `object-fit: contain` and pixel-crisp scaling so the low-resolution artwork remains legible at sidebar size.
- The image is decorative: `alt=""` and `aria-hidden="true"` keep the section button's existing accessible name (`label + summary`) authoritative.
- The image loads without a placeholder or layout shift. If the Wiki image fails, the component immediately shows the mapped Lucide fallback in the same tile.
- The fallback is visual only and does not change section state, counts, summaries, accordion defaults, or content rendering.
- No hover, focus, motion, color semantics, or responsive behavior changes are introduced beyond the artwork itself.

## Component design

Add `components/chunk-info/ChunkInfoIcon.tsx` with:

- a typed section-id-to-URL mapping for the six approved images;
- a `ChunkInfoIcon` component accepting the section id and a Lucide fallback node;
- local load-failure state that swaps the image for the fallback;
- decorative accessibility attributes and compact image styling.

Keep `ChunkInfoSection`'s existing `icon: React.ReactNode` interface unchanged. `ChunkActivityPanel` remains the orchestrator and passes `ChunkInfoIcon` instances alongside the existing fallback glyphs. No domain, content, state, or summary logic moves into the icon component.

## Accessibility and failure behavior

The section heading remains a real button with its existing label, summary, `aria-expanded`, and `aria-controls` behavior. The image contributes no additional accessible name and never becomes the only indicator of a section's meaning.

An image load error is handled locally. The fallback is rendered in the same dimensions and tile, avoiding an empty icon or a broken-image indicator. Repeated errors do not trigger retries or state updates after the fallback is active.

## Testing

Add focused coverage for `ChunkInfoIcon` that verifies:

- each section id resolves to its approved URL;
- the image is decorative and preserves the compact styling contract;
- an `error` event swaps to the supplied Lucide fallback;
- the fallback remains visible without changing the parent section button's accessible name.

Retain the existing `ChunkInfoSection` and `ChunkActivityPanel` tests, and add a DOM assertion that the six rendered section headers use the approved image sources when the panel has all six groups. Run the focused tests, full Vitest suite, TypeScript check, changelog verification, and production build.

## Out of scope

- Changing section labels, order, summaries, counts, or default-open behavior.
- Changing any quest, combat, gathering, shop, travel, or other domain rules.
- Replacing icons inside section content rows.
- Bundling or modifying OSRS Wiki image files.
- Adding a new icon library, dependency, asset pipeline, or visual-regression system.
- Redesigning other panels or the broader Chunk Info drawer.

## Success criteria

- The six sidebar section tiles visibly use the approved OSRS artwork when the image host is reachable.
- A failed image leaves a recognizable existing Lucide fallback rather than a blank or broken tile.
- Section labels and accessible controls remain unchanged.
- The drawer's layout, interaction, state calculations, and content remain behaviorally identical.
- Focused tests, the full suite, typecheck, changelog verification, and production build pass.
