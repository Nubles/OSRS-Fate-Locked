# Vanilla follow-up repairs — 24 September 2026

Local implementation of the confirmed findings in [the audit handoff](2026-09-24-next-audit-priorities.md). This report distinguishes repaired behavior from the remaining source-review and real-game coverage. No public deployment is implied.

## Diary requirements

The source snapshot and generator now support typed equipment slots/tiers, Mobility and Arcana unlocks in both common requirements and alternatives. The shared evaluator feeds Diary suggestions, completion guards, goal plans, routes and unlock-impact suggestions. A manual confirmation cannot bypass a known locked slot or transport unlock.

The review covers all 492 task descriptions, source requirements and alternatives, with 90 unique rows corrected (51 equipment, 27 Mobility, 17 Arcana, with overlap, plus two purchase gates). Worn equipment is distinguished from inventory-only tools. Unreviewed named gear requires an unlocked slot and a manual item/permission check; an automatically estimated tier is not promoted to a hard rule. Alternative equipment and routes remain alternatives.

The original examples are covered: team capes require Cape T1, the desert outfit requires its worn slots, and Ardougne Zoo fairy-ring travel requires the separate Fairy Rings unlock. Fresh review also found Dragontooth Isle worn-item alternatives, two purchase permissions, and 17 Arcana casting/spellbook peers. Those corrections use existing Fate unlock names, rather than creating new rules. See the [diary audit and exception evidence](2026-09-24-diary-equipment-mobility-audit.md).

## Guide saves and recovery

Guide item and action checks now belong to the run's canonical save. They travel in exports, protective backups and recovery checkpoints, while remaining independent of Journal completion and rewards. Normal writer ownership, quota warnings, retry and unload protection apply.

Legacy browser-only checks migrate on a genuine local load without deleting the original keys. Imported saves and explicitly selected recovery checkpoints stamp an empty guide field if they predate guide saves, so restoring an older snapshot cannot resurrect newer browser-only checks. Action progress records the guide revision and filters obsolete action IDs.

The new tests cover a real local IndexedDB journal and save mirror, clean-storage import, earlier same-run restore, duplicate-profile isolation, stale callbacks, competing tabs, quota failure/retry/reload and malformed progress. The test suite also exposed and repaired an existing fallback restore bug: a successful synchronous replacement was rejecting its own result as stale after changing state.

## Equipment source and RuneLite permissions

All 5,436 exact item IDs remain available locally. A fixed, fingerprinted catalogue ships with the build, replacing the moving upstream fetch. Cache migration preserves equipped IDs and profile state. Unfingerprinted offline caches can display gear but cannot export definitive equipment permissions.

The reviewed snapshot exports 2,405 exact IDs with reviewed named/material rules. The remaining 3,031 IDs are omitted from both permission maps, causing the existing plugin to treat them as unknown rather than definitively locked/allowed. These are exact-ID counts, not gear-picker counts. Ghostspeak amulet is explicitly reviewed at Neck T1.

The full Vanilla relay request measures 202,926 bytes against 262,144, leaving 59,218 bytes spare. The regression now includes the real pinned catalogue and complete request envelope, reserves at least 16 KiB growth room, and receives HTTP 200 from the local Worker with mocked storage. It does not prove production relay delivery or a live RuneLite session. Existing manually imported bundles need re-export/reimport; paired clients receive the change on republish.

See [equipment source and permission maintenance](../equipment-catalogue.md).

## Combat suggestions

Boss Planner and DPS controls now use the equipped weapon's actual category, attack types and stances. A whip no longer receives stab/crush or aggressive recommendations; bows do not receive melee recommendations; spears use their real controlled/defensive choices. Unknown categories show a checking message without a fabricated damage value. Boss Planner leaves magic unassessed where no spell selection is available; DPS retains explicit spell input and uses five ticks for ordinary manual casting.

Source checks: [Wiki weapon categories](https://oldschool.runescape.wiki/w/Weapons/Categories), [Abyssal whip](https://oldschool.runescape.wiki/w/Abyssal_whip), and the [Wiki DPS calculator category/style table](https://github.com/weirdgloop/osrs-dps-calc/blob/main/src/utils.ts). The category table was captured locally during this review. These fixes do not claim support for every special attack, passive or boss mechanic.

## Reliable monster loading

The browser check reproduced a failed live monster download that prevented the DPS screen from opening. The app now ships the complete verified monster snapshot from the same primary source repository and requests it from its own origin, including hosted subpaths. It retains 2,860 raw rows and the existing 2,850 selectable targets. A fresh review caught a new validation rule wrongly rejecting the upstream unknown-size sentinel and dropping 49 targets; this was corrected before the final build and covered by full-count and real-target regressions.

Source/normalization fingerprints govern cache reuse. Matching caches work offline, stale or invalid caches refresh, empty data stays explicitly unavailable, and retry works. The capture's Git blob and SHA-256 were independently checked against GitHub. See [monster source maintenance](../monster-catalogue.md). This removes the separate live-data dependency; it does not certify every monster statistic or provide a complete offline app shell.

## Startup and documentation

Equipment Lab now loads Gear and DPS views when selected, using the app's existing retry behavior. In comparable preview builds, the entry fell from 247.98 kB gzip to 240.64 kB (7.34 kB saved); it remains above the 130 kB roadmap guidance. This is bundle measurement, not a device-speed benchmark. Collection-log maintenance documentation now matches its read-only runtime notices and reviewed catalogue updates; it no longer promises live synthetic save IDs. The workflow comment and guide-save roadmap contract were corrected too.

## Verification

- Focused integrated guide/combat/planner checks: 70 passed across ten files.
- Equipment, rule manifest and changelog checks: 126 passed across seven files.
- Vanilla full-catalogue relay and equipment permission parity: two passed (other mode cases excluded).
- Normal/preview bundle boundary: both checks passed, including an inherited preview flag. The normal build still excludes expanded private guide content.
- The guide implementation additionally passed 250 broader save/recovery checks before its final coordinator/schema additions; the final 19 focused guide tests are included in the 70-test integration result above. Counts overlap and must not be summed.
- Browser checks on the retained Vanilla Preview profile: all four basic elemental staves show T1; the lazy Gear view opens; The Restless Ghost retains 1/7 checks with Neck T1 still required. No profile unlock or reward was changed.
- The guide renders at 390 × 844 with matching client/scroll width and no horizontal overflow; the viewport was restored. This is one representative narrow-screen check, not a complete phone-device audit.
- A competing-tab warning was correctly visible. The existing profile owner was preserved; no takeover or storage clearing was used.
- Diary validation: 255 focused/source/UI/planning and selected Vanilla regression tests passed. The deterministic generator reports all 492 tasks and zero unknown references or duplicate/unresolved IDs; generated output is current. See the diary report for batch counts and skipped unrelated/mode cases.
- Monster source/service/combat-data checks: 16 passed, including hosted-subpath asset resolution, immutable cache reuse, empty/failed data retry, quota handling and full-target preservation.
- Final TypeScript, changelog verification and whitespace checks passed. Normal build isolation was exercised by the two bundle-boundary tests; the final local preview build also passed. Full mixed-mode release verification was not run under the Vanilla-only direction.
- Final preview build: `1790207906463`, entry `index-_p1beRGY.js`, 240.69 kB gzip. The actual browser loaded that exact entry from http://127.0.0.1:51945/.
- Final browser retest: DPS opens without the earlier monster-data download failure; unarmed offers only Crush and its valid stances, Ranged is disabled, the real General Graardor target loads with HP 255 / Defence 250 / Magic 80, calculations render, and ordinary magic offers Manual / autocast. No new warning/error appeared after the final reload; the log retains the earlier reproduced fetch warning.
- Journal browser check: the Wilderness team-cape action visibly shows Cape T1 and its explicit item confirmation. No task was completed or reward issued during verification.

## Remaining review coverage

The [skill-reference reconciliation](2026-09-24-skill-reference-reconciliation.json) counts 1,291 current authored rows across 24 skills. Of the historical 1,221 partially checked rows, 1,220 still match exactly by skill, tier and text; one changed. Forty current rows differ from the old inventory, largely reflecting earlier corrections and splits. All numeric row headings now sit in their matching Fate tier. This is reconciliation, not verification of every item, recipe or prerequisite in those rows. The prior Slayer-helmet source conflict and wording ambiguities remain separate evidence work.

Remaining equipment estimates still need individual rule review. The permission export change prevents those estimates becoming definitive in-game warnings; it does not certify them. The 24 F2P guide journeys still need actual Vanilla playthrough coverage, and real RuneLite integration and representative phone/offline network checks remain distinct from automated local tests. Broader startup performance work still needs measurement against the roadmap budget.

No commit, push or deployment was performed. The expanded guide pack remains private to the local preview.
