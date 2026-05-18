# Resource Engine Enhancement Plan

## Current State

The Resource Engine (`SupplyChainCalculator.tsx` + `utils/supplyChain.ts`) is a modal that lets players search for items and see acquisition sources (DROP, SHOP, SKILL, SPAWN, etc.) with lock/unlock status based on their game state. It has:

- Text search across ~200+ items in `RESOURCE_MAP`
- Per-source availability analysis (regions, skills, quests, unlocks)
- Quantity calculator (scales input requirements)
- Clickable ingredient navigation with breadcrumb history
- "Used In" reverse-dependency section
- Wiki item images via `WikiService`

**Key gaps identified:**

1. `PriceService` exists with full GE price data but is **never used** in the Resource Engine
2. No way to browse by category — items are a flat alphabetical list
3. No recursive material breakdown (e.g., Super Combat needs Super Attack which needs Irit Leaf...)
4. No "what can I make right now?" filtered view
5. No cost/efficiency comparison between sources
6. No favorites or quick-access for frequently checked items

---

## Planned Enhancements (6 changes)

### 1. GE Price Integration
**Files:** `components/SupplyChainCalculator.tsx`

- Import and initialize `priceService` on mount
- Show GE price next to each item name in the detail header (gold coin icon + formatted price)
- Show prices on ingredient chips so players can gauge input costs
- Show total material cost when quantity > 1 (sum of input prices * quantities)
- Handle gracefully when prices aren't available (show "—" not errors)

### 2. Category Browser Tabs
**Files:** `data/resourceData.ts`, `components/SupplyChainCalculator.tsx`

- Export a `RESOURCE_CATEGORIES` mapping from `resourceData.ts` that groups items by their existing comment-section categories (Herbs, Potions, Secondaries, Logs, Construction, Ores, Bars, Fishing, Runes, Gear, Raids, Slayer, Minigame, Quest Items)
- Add a horizontal scrollable category pill bar above the item grid (shown when no item is selected)
- Clicking a category filters the list; "All" resets. Active category gets a highlight
- Category pills show count badge (e.g., "Potions (12)")

### 3. Recursive Material Tree ("Full Breakdown")
**Files:** `utils/supplyChain.ts`, `components/SupplyChainCalculator.tsx`

- Add `computeFullBreakdown(itemName: string, qty: number, gameState): MaterialNode[]` to `supplyChain.ts`
  - Recursively walks `inputs` for the first available SKILL-type source of each item
  - Returns a tree: `{ item, qty, children: MaterialNode[], price, isRaw }` where `isRaw = true` means no further inputs (raw material)
  - Flattens into a "raw materials needed" summary (e.g., Super Combat → Irit Leaf x1, Kwuarm x1, Cadantine x1, Torstol x1, Eye of Newt x1, etc.)
  - Cycle guard to prevent infinite recursion
- Add a collapsible "Full Breakdown" panel below the sources section in the UI
  - Shows the flattened raw material list with images, quantities, and GE prices
  - Total estimated cost at the bottom
  - Each raw material is clickable (navigates to that item)

### 4. Availability Filter ("What Can I Make?")
**Files:** `components/SupplyChainCalculator.tsx`

- Add a toggle button in the database index header: "Show Available Only"
- When active, filters the item list to only show items where at least one source has `isAvailable: true`
- Uses existing `calculateSupplyChain` per item (memoized)
- Each item card gets a small green/red dot indicator showing availability status
- This runs against the full RESOURCE_MAP so it's computed once and cached via `useMemo`

### 5. Source Efficiency Comparison
**Files:** `components/SupplyChainCalculator.tsx`

- For sources with `inputs` (craftable items), calculate total input cost using PriceService
- Show a "Cost per item" line on each source card: sum of (input GE price * input qty) / outputYield
- Sort sources by: available first, then by cost-efficiency (lowest cost/item first)
- Add a small "Best Value" badge on the cheapest available source

### 6. Favorites / Quick Access
**Files:** `components/SupplyChainCalculator.tsx`, `context/GameContext.tsx`

- Store favorites in `localStorage` under a dedicated key (`FATE_RESOURCE_FAVORITES`) — kept separate from GameState since it's UI preference, not game progress
- Add a star/bookmark icon on each item's detail header
- Show a "Favorites" section at the top of the database index (above the category browser) when favorites exist
- Compact row style with item image + name + price, clickable to navigate
- Max 20 favorites, oldest auto-removed if exceeded

---

## Implementation Order

1. **Category Browser** — foundation for browsing, no external deps
2. **GE Price Integration** — wires up PriceService, needed by steps 3 and 5
3. **Availability Filter** — uses existing chain analysis
4. **Favorites** — standalone localStorage feature
5. **Recursive Material Tree** — depends on price integration for cost display
6. **Source Efficiency Comparison** — depends on price integration

## Files Modified

| File | Changes |
|------|---------|
| `data/resourceData.ts` | Export `RESOURCE_CATEGORIES` grouping |
| `utils/supplyChain.ts` | Add `computeFullBreakdown()` function |
| `components/SupplyChainCalculator.tsx` | All 6 UI enhancements |
| `services/PriceService.ts` | No changes (already complete) |

## Risk Notes

- PriceService fetches are async and may fail — all price displays must handle `0`/missing gracefully
- Recursive breakdown needs a depth limit (max 10) and cycle detection to avoid infinite loops on circular recipes
- Availability filter over ~200 items is O(n * sources) — should be fine with useMemo but avoid recomputing on every keystroke
- Category grouping is derived from the comment structure in resourceData.ts — we'll create an explicit mapping rather than parsing comments
