# RuneProof place-name labels

User feedback: chunk coordinates were not useful as the primary way to read
locations. RuneProof now uses source-backed place names throughout destination
lists, transit lists, per-step walking routes, chunk blocker messages and maps.
An opt-in Show chunk coordinates control appends grid references to those names.
The underlying chunk permissions, paths and map coordinates are unchanged.

The existing pinned chunk content supplies 624 distinct names. They are emitted
to the small `data/chunkNames.ts` module by the existing chunk-content generator,
so the guide does not depend on loading the full content service just for labels.
Unnamed locations fall back to a known area/region or Unnamed area; map identity
remains the original chunk. No place names were invented for this change.

Verification:

- Full suite: 287 files, 3,772 tests passed.
- Final focused guide/integration verification: 62 tests passed.
- Typecheck, production build and pinned-source deterministic check passed.
- Actual local preview shows South Draynor, Lumbridge Castle Backyard and the
  two distinct Lumbridge Swamp areas in the walking route. Coordinates are
  absent by default and appear alongside names when enabled.
- Transit map says Walk through South Draynor on the way to step 4, and retains
  the original highlighted chunk. Closing restores the initiating button.
- Desktop and 390px phone layout inspected; named paths and summaries wrap
  without horizontal overflow. Status labels remain together when rows wrap.
- Initial integration tests found duplicate place labels after the rename
  (`Found multiple elements with the text: Lumbridge Castle`). Redundant location
  text was removed from step/map rows; the unchanged specific-query tests pass.

Logs: `../audit/chunk-names-final-tests.log`, `chunk-names-final-ui.log`, and
`chunk-names-build.log`. No public deployment or save/unlock changes.
