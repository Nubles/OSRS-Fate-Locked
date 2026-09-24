# All-F2P local Vanilla preview verification

23 September 2026. Local build only, served at http://127.0.0.1:51945/. No commit, push or public deployment.

## Coverage and sources

The preview has 24 quests and 227 steps: the five existing public guides retain their exact revisions and 32 steps; 19 new preview packs add 195 steps. The membership review adds Learning the Ropes and The Ides of Milk and removes members-only Daddy's Home. The 24 quests award 46 quest points in canonical quest data.

New text is independently phrased from the full pinned Wiki quest pages captured in the September requirements audit. Each pack carries its revision/timestamp and links the source. Coordinates and reviewed dungeon/instance entrances are corroborated against the pinned QuestHelper source (a52646118f0e5ea63a6b3331cefa98087a7b4d6c). Harvested candidate ordering is not promoted automatically. Tutorial locations remain unmapped.

## Implementation and review

- Packs carry supplies, article details, provenance and step metadata through the lazy preview boundary. Normal builds retain only the five public guides, even with an inherited preview environment flag.
- F2P quest-point gates use earned quest points, not the skill unlock table. Actual mandatory equipment and skill actions retain their own gates and images.
- Review caught and fixed Mining 10 incorrectly gating the first Knight's Sword conversation; it now gates mining blurite. The pickaxe accepts Bronze/Iron/Steel variants usable at the required mining level.
- Review caught partner handovers being described as available without evidence. Shield of Arrav's handovers now show explicit manual checks, remain confirmable after prior steps, and disappear after the player's check. Known skill/equipment locks cannot be bypassed by this metadata.
- Preview allows explicit unresolved destinations only on PREVIEW_ONLY definitions. The public compiler's exact/reviewed destination requirement remains intact.
- Existing Vanilla preview saves and public guide revisions are preserved. Guide checkmarks do not update the Journal or grant rewards.

## Verification results

- 113 tests passed across nine focused data, compiler, account-requirement, guide-presentation and Vanilla UI files. These include all 19 new pack compilations and item flows, exact 24-quest roster, QP gates, disguise/apron images, late Mining gate and partner manual-check behavior.
- Two production bundle boundary tests passed, verifying both normal and inherited-preview-flag builds exclude the expanded payload.
- TypeScript passed with no errors. Production and local runeproof-preview builds passed; the pre-existing large-bundle warning remains.
- A transient test-only TypeScript error (Testing Library getByRole does not accept exact) was corrected before the successful final typecheck.
- The actual browser opened all 24 quests and displayed every expected step count. The Restless Ghost retained its existing 1/7 check state.
- Black Knights' Fortress rendered the real West Falador map crop, quest-point icon, Head and Body slot images, and iron-chainbody image. Its QP and slot gates remained visible.
- Shield of Arrav showed both partner CHECK cards and a working Black Arm route link.
- X Marks the Spot check/undo changed progress 0/6 -> 1/6 -> 0/6; no net progress mutation. Journal remained 0/212.
- The 320 x 844 screenshot showed the cards fitting the narrow modal with wrapped names and step links. The browser's DOM measurement helper timed out at that viewport; the supported accessibility/screenshot APIs verified the rendered layout. Desktop viewport restored.
- Browser warning/error logs were empty. The preview is left on Black Knights' Fortress.
- No Chunked gameplay suite executed. No full in-game OSRS playthrough claimed.

## Deliberate preview limits

- New guides have reviewed destination/entrance markers; walking connections between their steps are not yet certified. One concise preview note discloses this. Existing five walking-route reviews remain active.
- Shield of Arrav implements the Phoenix path and links the Black Arm path; the player confirms partner exchanges.
- Learning the Ropes is a pre-mainland reference with no invented chunk markers.
- Ernest's oil-can sequence refers to the labelled puzzle map in its Wiki source.
- Alternative methods are explained where relevant; this preview follows one coherent route per quest. Completing every alternative route and in-game journey remains further testing work.
