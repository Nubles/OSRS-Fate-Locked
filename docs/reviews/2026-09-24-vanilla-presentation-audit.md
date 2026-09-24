# Vanilla presentation and completion follow-up

Scope: local Vanilla preview, following the requirement, save and Wiki-artwork repairs. Existing profile progress was preserved. No public release or Git push was performed.

## Confirmed defects repaired

| Issue | Reproduction | Result |
| --- | --- | --- |
| Share percentage disagreed with Dashboard | Max skill tiers, equipment tiers and regions only: Share reported 100%, while the shared completion metric reported 53%. | Share percentage, rank and copied summary now use the canonical completion metric across every unlock family. |
| Completion could never reach 100% without retired content | All 976 active unlock points still had a 977-point denominator, including Aquarium. | Retired Aquarium is excluded from both completion sides and the POH grid; legacy profile data remains intact. |
| Quest Cape required optional miniquests | All 193 canonical quests were recorded, but the achievement required all 212 journal entries. | Quest milestones use the existing canonical quest roster, excluding optional miniquests and duplicate entries. |
| Alternative quest requirement disappeared or was double-counted | Desert Treasure I's decorated Slayer-or-gas-mask blocker did not match an exact skill label. The accepted alternative still displayed mandatory Slayer training and counted the requirement twice. | The list preserves structured blockers and alternative wording; the card shows the selected route's confirmation once. Eligibility rules remain unchanged. |
| Search totals mixed different populations | A single matching quest could display “1 of 212”; an empty search result displayed “0 of 212”. | Both counts use the matching quest set. |
| Vanilla still applied Chunked travel logic | The live Vanilla profile showed 14 ready quests in the Journal but only 12 in Doable, with stranded/chunk-route explanations. | Vanilla now uses canonical area and requirement checks without loading the chunk graph. Manual checks and missing requirements remain visible. |
| Journal celebrated before completion | No automatic action remained, but a quest still required manual preparation or a diary reward remained unfinished. | The summary directs the player to the pending quests or diaries. |
| Share dialog let keyboard focus escape | Opening left focus on the underlying Share Run trigger; Tab after Close reached the page body. | The outer dialog owns focus across both card styles, wraps Tab/Shift+Tab and restores focus after Escape. |
| Stats card clipped at phone width | At a 390-pixel viewport, the card had 334 pixels of usable width but 384 pixels of content. | Header, grids and controls adapt to narrow screens. |
| Share identity changed on every render | Theme/capture state used a fresh timestamp as the displayed ID. | The card uses the same history-derived run identity as the map card, omitting it before history exists. |
| Green history badge ignored replay warnings | Spending four keys from an initial balance of three produced a valid hash chain but an impossible replay. | The card uses the shared history audit and distinguishes checked, warning, broken and empty histories. The exported image identifies the check as local. |
| Map-card export lost its overlay and raised a browser error | The reader treated the current versioned map-save envelope as an array collection; rendering threw “x is not iterable”. Export also relied on a fixed delay. | The reader validates current/legacy formats and recovery data, with shipped geography as fallback. Capture waits for drawing, bounds image loading and exposes retry on failure. Stored maps are not rewritten. |

The Quest Cape rule was checked against the primary [OSRS Wiki Quest point cape page](https://oldschool.runescape.wiki/w/Quest_point_cape). Miniquests required by an ordinary quest remain part of that quest's eligibility; this change does not bypass prerequisites.

## Verification

- Final consolidated run: **105 tests passed across 11 files** covering completion, achievements, share cards, map loading/export recovery, doability, quest cards, journal recommendations and changelog content. Earlier overlapping test totals are not additional coverage.
- Final TypeScript check, player-facing changelog verification and scoped whitespace checks passed. Local RuneProof preview build passed; existing size/dependency warnings remain.
- Live Vanilla profile: Journal and Doable both report **14 ready quests**; the doability view uses area/requirement wording. Sheep Shearer remains blocked by its wool confirmation with Crafting locked. Matching and empty searches display 0/1 and 0/0 respectively.
- Quest Cape displays **0/193** in the live achievement dialog. No profile unlocks, completions, keys or guide progress were changed for this review.
- Stats card inspected at desktop and a **390 x 844** phone viewport: content fits its 334-pixel card width with no horizontal clipping. All 54 card images loaded. The temporary viewport override was reset afterward.
- Both card styles retain keyboard focus; Tab/Shift+Tab wrap and Escape returns focus to Share Run.
- Actual map PNG preview now contains green unlocked/red locked overlays. Rendering completes and export controls enable; no new browser error appears after the fix. The browser log retains the earlier reproduced pre-fix error.

## Scope still requiring separate evidence

- Full in-game playthroughs of the 24 F2P guide journeys, rather than browser-only interaction coverage.
- Individual review of equipment still labelled as estimates, and remaining skill-reference/source data.
- Live RuneLite integration and representative offline/poor-network use.
- Startup performance: the current preview entry bundle is about 239 kB gzip, above the roadmap's older 130 kB target. Existing build size and dependency warnings remain.

This review does not certify all OSRS data or Chunked mode. Current verification remains Vanilla-only.
