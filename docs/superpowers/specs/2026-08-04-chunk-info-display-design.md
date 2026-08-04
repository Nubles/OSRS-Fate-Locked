# Chunk Info display redesign

**Date:** 2026-08-04

## Objective

Make the map's Chunk Info drawer feel polished, readable, and visually at home in FLIM without changing the underlying unlock rules or removing detailed chunk data.

The approved direction is **Summary + Sections** with the **Fate Refined** visual treatment: a clear status summary first, a consolidated access card, and compact expandable content groups using FLIM's existing charcoal, cyan, emerald, and restrained red palette.

## Current state

`ChunkActivityPanel` is a 288-pixel-wide map-side drawer. It currently presents:

- The chunk or area title, coordinates, region, unlock status, and chunk/area switch.
- Separate notices for locked-area preview, entry requirements, entrances, and bank status.
- Collapsed `Can do here` and `Locked for now` summaries.
- A long fixed-order catalogue containing quests, bosses, monsters, farming, transport, travel links, guilds, minigames, shops, resources, objects, diary tasks, clue steps, NPCs, and item spawns.

The data is useful, but the drawer gives most content similar visual weight. Important answers compete with reference material, status is communicated through several unrelated treatments, and dense chunks require a long scan. Locked rows often use full-row red text and strike-through styling, which makes names harder to read.

## Approved experience

### Information hierarchy

The drawer presents information in this order:

1. Sticky location header.
2. Availability summary.
3. Access and facilities card, when relevant.
4. Expandable content groups.
5. Loading, empty, or failure state when content cannot be shown.

The drawer grows from 288 to 320 pixels on layouts with enough room. It retains the existing top, right, and bottom map insets. On narrow containers it must shrink to the available width while preserving the same outer margin rather than overflowing the map.

### Header

The sticky header contains:

- The resolved chunk or area name as the strongest text.
- Chunk coordinates, subarea, and region as subdued supporting metadata.
- A compact but explicit `Unlocked` or `Locked` badge.
- The existing close control.
- The existing `This chunk` / `Whole area` segmented switch when a region is available.

The header keeps location identity visible while the content scrolls. The switch remains secondary to the location name and status.

### Availability summary

Two equal summary tiles appear below the header:

- **Available now**: actionable entries whose current requirements are met.
- **Needs unlocks**: actionable entries with an unmet chunk, skill, quest, merchant, mobility, or other supported gate.

These totals include only entries for which the application can make a reliable availability decision. They exclude:

- Completed quests.
- Untracked miniquests.
- Neutral reference data such as scenery objects, NPCs, clues, and item spawns.
- Unclassified shops or other entries without a trustworthy gate.
- Access-card rows such as banks and entrances, which communicate place access rather than catalogue availability.

The summary is derived from the same presentation state used by the expanded sections. It must not maintain a second set of unlock rules. Category counts and total counts therefore cannot disagree.

`Whole area` needs one mode-aware exception. An aggregate has a uniform scope only when all physical chunks or named subareas contributing to it share the same ownership state. Chunk-based modes are always treated as mixed, and area-based modes are also mixed when sibling subareas have different ownership. Mixed aggregates show neutral `Indexed activities` and `Content groups` totals, and their section headers use neutral counts rather than a ready/locked split. Detailed rows may still show known intrinsic requirements such as Slayer, boss, guild, minigame, or merchant gates, but they do not claim final availability based only on the selected chunk or subarea.

### Access and facilities

The current stack of differently styled notices becomes one optional **Access & facilities** card. In `This chunk` mode, it may contain rows for:

- A locked-chunk preview message.
- Requirements to enter the chunk.
- Each reviewed entrance and its availability.
- Additional route requirements attached to an entrance.
- Bank presence and, in bank-locked modes, bank availability.

Each row has an icon, a concise primary label, and supporting text only when needed. Rows use a shared neutral card surface with restrained semantic accents rather than separate full-width purple, amber, green, and red banners.

Entrance Wiki links and all existing requirement semantics remain intact. Unlocking a physical chunk still controls its entrance state, and additional route requirements remain independent.

`Whole area` mode does not show chunk-specific entry, entrance, or bank rows because aggregating their mixed states would be misleading. The header shows `Unlocked` or `Locked` for a uniform scope and `Varies` for mixed ownership, while the summary follows the same mode-aware scope.

### Content groups

Detailed content is organized into six expandable groups in stable order:

1. **Quests**: quest rows and their current status.
2. **Combat**: bosses and monsters.
3. **Gathering**: resources and farming patches.
4. **Shops**: classified and unclassified shops, with stock expansion preserved.
5. **Travel**: transport nodes and travel destinations.
6. **Other**: guilds, minigames, diary tasks, objects, clue steps, NPCs, and item spawns, separated by small internal labels where needed.

Empty groups are omitted. Every collapsed header shows the group name and a compact state summary such as `17 ready · 1 locked`, `4 links`, or a neutral item count. This lets the user understand the chunk without opening every group.

Chunk-based `Whole area` mode always uses neutral group counts. It never applies the selected physical chunk's state to the whole aggregate.

Quests opens by default when present. Otherwise the first non-empty group opens in the order above. Users may keep multiple groups open at once. Choosing another chunk or switching between `This chunk` and `Whole area` resets the scroll position and open groups to the tidy default state, preventing stale expansion from one place from carrying into another.

Existing secondary expansion remains available inside an open group:

- Shop stock.
- Resource yields.
- Capped lists and `show more` behavior where a category remains unusually dense.
- Travel-link destination expansion.

The outer accordion reduces the need for aggressive caps, but it does not require every large list to render at once.

### Item states

Names remain legible in every state.

- Available items use normal high-contrast text with a small positive badge or icon where useful.
- Locked items use subdued text plus an explicit lock icon or requirement badge.
- Completed quests use a check icon and completed label.
- Manual-confirmation quests keep their distinct confirmation state and reason.
- Neutral reference entries use secondary text without implying availability.

Full-row strike-through styling is removed. Red is reserved for compact locked indicators and unmet requirement details, not the complete item name. Tooltips may provide extra context, but the visible row must contain enough text to understand its state without hovering.

## Visual system

The approved **Fate Refined** treatment builds on existing application styling rather than introducing a separate theme.

- Charcoal surfaces remain dominant.
- Cyan identifies selected controls, section icons, and navigational emphasis.
- Emerald identifies available states.
- Muted rose/red identifies locked states.
- Amber and purple remain available for genuinely distinct requirement or confirmation semantics, but do not become competing full-width panels.
- Borders and surface elevation provide most grouping, with restrained glow and transparency.
- Type size increases slightly for the drawer title and primary group labels while compact metadata remains small.
- Spacing follows a consistent card rhythm: clear separation between blocks and tighter spacing within related rows.
- Icon containers, badge shapes, border radii, and hover/focus states are consistent across groups.

The redesign must continue to read clearly over both bright and dark regions of the world map.

## Component boundaries

The implementation should reduce `ChunkActivityPanel`'s presentation burden without building a universal schema for every row type.

Use four focused display units:

1. **Chunk Info header**: location metadata, lock badge, close control, and mode switch.
2. **Chunk Info summary**: receives already-derived available and locked totals and renders the two summary tiles.
3. **Chunk Info access card**: renders normalized access/facility rows without calculating game rules.
4. **Chunk Info section shell**: owns the accessible expand/collapse button, counts, and body region while accepting category-specific content.

`ChunkActivityPanel` remains the orchestrator for existing game context, content loading, and category-specific row rendering. Small pure presentation helpers may derive totals, stable group order, and the default open group. They must consume the existing evaluated states rather than reimplementing quest, Slayer, bank, resource, mobility, or merchant rules.

The existing `ChunkEntranceNotices` behavior may be folded into the access-card row model or adapted behind the new card. Entrance availability continues to come from `ChunkContentService` and the selected chunk's existing unlock state.

## Data flow

1. The selected chunk, region, mode, whether the mode uses uniform area ownership or individual chunk ownership, player unlocks, and loaded chunk content enter `ChunkActivityPanel`.
2. Existing domain helpers evaluate quest, bank, resource, mobility, merchant, Slayer, diary, and location states.
3. Category-specific derived entries feed both their detailed rows and a small presentation summary.
4. The presentation summaries are combined into drawer totals and accordion header counts when the selected scope has a reliable uniform unlock state; otherwise the panel derives neutral indexed-content totals.
5. The drawer renders the header, optional access card, and non-empty category sections.

There is one evaluated source of truth for each item state. The summary does not infer state from colours, labels, or rendered elements.

No saved profile data, game-mode configuration, or generated chunk-content format changes as part of this work.

## Responsive and interaction behavior

- The drawer remains anchored to the map's top-right corner.
- The body scrolls independently while the header remains visible.
- At 320 pixels wide, long names truncate only in collapsed or single-line contexts; expanded content retains existing Wiki links and supporting details.
- On narrow map containers, the drawer uses the available width minus its existing outer margins.
- Section headers are real buttons with a visible hover state, keyboard focus ring, and `aria-expanded` state.
- Each section button controls an identified content region.
- Close and segmented controls retain accessible names.
- State never depends on colour alone; text and icons accompany semantic colours.
- Motion is limited to short disclosure and colour transitions and respects reduced-motion preferences already applied by the application.

## Loading, empty, and error states

The drawer header renders immediately so the selected place remains clear.

- While chunk content loads, the body shows two quiet skeleton summary tiles and compact section placeholders.
- If the selected chunk has no indexed content, the body shows a single neutral empty card explaining that no detailed content is indexed for the location.
- If content loading fails, the body shows a compact error card using the same visual system. It does not display misleading zero totals.
- Access and facility data is shown only when its source is ready; partial loading must not produce a false `available` or `locked` claim.

## Testing

Implementation follows test-first development. Required automated coverage includes:

- Summary totals count available and locked actionable items from the same evaluated states used by detailed sections.
- Completed quests, untracked quests, neutral reference items, and entries without a reliable gate are excluded from the two totals.
- Chunk-based `Whole area` mode shows neutral aggregate totals and never treats the selected physical chunk's state as the state of the whole aggregate.
- Group order is stable and empty groups are omitted.
- Quests is open by default when present; otherwise the first non-empty group is open.
- Multiple groups can be expanded concurrently.
- Changing chunk or mode resets expansion and scroll state.
- The access card combines locked preview, entry requirements, entrances, and bank state without changing their underlying semantics.
- `Whole area` mode omits chunk-specific access and facility rows; in chunk-based modes its detailed rows do not claim final availability from the selected chunk alone.
- Locked items remain readable and expose a visible reason or state without relying on a tooltip or strike-through.
- Manual-confirmation quest presentation remains distinct.
- Section controls expose correct accessible names and `aria-expanded` values.
- Loading, no-content, and failure states render without false summary counts.
- Existing shop-stock, resource-yield, travel-link, and Wiki-link interactions continue to work.

Manual verification should cover:

- A dense unlocked chunk.
- A dense locked chunk.
- A chunk with entry requirements, multiple entrances, and a bank.
- A sparse or unindexed chunk.
- `Whole area` mode with aggregated content.
- A narrow map container and a standard desktop map.
- Keyboard-only expansion, close, and mode switching.

The focused tests, full application test suite, TypeScript check, and production build must pass.

## Out of scope

- Changes to unlock rules, chunk ownership, or content-source data.
- Search, filters, sorting controls, or user-configurable category order.
- A new ranking algorithm for recommendations or `best` content.
- A separate mobile modal or full-screen sheet.
- Redesigning other panels to match Chunk Info.
- Save-schema changes or migration.
- Visual regression infrastructure that the project does not currently use.

## Success criteria

- A user can identify the selected place, its unlock state, and the balance of available versus locked activities without scrolling.
- Entry requirements, entrances, and bank information appear as one coherent block rather than competing banners.
- Dense chunks remain understandable with all detailed data still reachable.
- Locked content is legible and explained without full-row strike-through or colour-only communication.
- `This chunk` and `Whole area` modes use the same polished hierarchy without presenting misleading aggregate access states.
- The drawer remains usable at its supported narrow width and does not overflow the map container.
- Existing Wiki links, nested detail controls, and domain rules retain their behavior.
- The redesign introduces no profile, content-format, or game-rule migration.
