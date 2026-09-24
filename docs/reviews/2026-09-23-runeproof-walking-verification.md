# RuneProof walking-route verification

The previous unconditional warning was an implementation gap: the guide used
destination ownership, while source walking connections were not imported.
The old `Connect` graph merges source sections, symmetrizes connections and
includes transport links, so it is not a walking-permission proof.

## Change

- Generate 1,190 land-section nodes and 2,786 directed walking edges from the
  pinned Chunk Picker export, with source provenance and deterministic checks.
  Water, ocean, unresolved nodes and generic transport links are excluded.
- Preserve exact section and directed edge requirements; unknown requirement
  shapes stay explicit. Add the reviewed Al Kharid gate condition absent from
  the source: 10 coins per crossing unless Prince Ali Rescue is complete.
  Source: [OSRS Wiki, Lumbridge](https://oldschool.runescape.wiki/w/Lumbridge).
- Bind all 32 public guide actions to reviewed section endpoints and guide
  revisions. Interiors use their separately reviewed surface entrances.
- Reuse the current materialized account permissions. Search an unlocked,
  condition-satisfied path first, including detours. Otherwise display a
  source-backed candidate with concrete missing chunks or conditions.
- Show per-step walking sequences and separate transit/destination summaries.
  Transit map buttons identify the route step, and return focus to the button.
  Remove both the blanket warning and the unconditional model disclaimer.

The Restless Ghost regression owns every destination but omits 49,50 and 48,50.
The Tower journey correctly requires those bridge-route chunks. Adding them
makes the journey available. A Rune Mysteries detour through Al Kharid remains
conditional until the toll is accounted for or Prince Ali Rescue is complete;
an unlocked free detour takes precedence.

## Verification

- Full final suite: **286 files, 3,770 tests passed**.
- `npx tsc --noEmit`: exit 0.
- Final production build: exit 0. Existing bundle-size/tooling warnings remain;
  the walking graph is in the lazy GoalPlannerModal bundle, not the eager index.
- `npm run content:verify`: exit 0, including deterministic graph regeneration.
- Independent review identified the missing toll and verified endpoint,
  account-identity, direction and alternative-location handling. Toll regression
  and generator tests passed after correction.
- Browser at http://127.0.0.1:51945/: Restless Ghost retains 1/7 checks and displays
  actual missing destination and transit chunks. Step 4 includes the complete
  bridge sequence. The transit map opens 48,50; closing restores its button.
- Desktop and 390px phone layout checked. No horizontal overflow in the guide,
  article, travel summary or any walking sequence. Temporary viewport reset.
- Account permission changes, all five fully unlocked guides, one-way links,
  disconnected sections within one chunk, missing data, unknown conditions,
  alternate source invalidation and revision guards covered in automated tests.

Logs are under the local `../audit/` directory: `walking-route-final-tests.log`,
`walking-route-final-build.log`, and `walking-route-content.log`.

## Development failures resolved

- Test startup in the sandbox failed with `spawn EPERM`; the authorized worker
  runner completed successfully.
- A fixture expected `Do now` at the first step of an unreviewed guide revision;
  walking uncertainty now affects journeys after step 1. A start location does
  not imply travel from an assumed live player position.
- Source tests initially relied on object-key enumeration order and Node import
  typings absent from the app. Sorted-key assertions and the existing repository
  test import convention resolved these issues.
- Patch helper interruptions were checked against the actual files before
  retrying; final typecheck, tests and build cover the resulting files.

## Scope

These checks cover walking between reviewed guide endpoints, not navigation
from a live player position, tile-by-tile indoor movement, teleports or transport.
An unreviewed alternative source explains its specific missing endpoint instead
of borrowing the original path. No account inventory is invented to pay a toll.
Candidate missing chunks describe the displayed path, not every possible method.
No additional quest pack, deployment or account unlock was created.
