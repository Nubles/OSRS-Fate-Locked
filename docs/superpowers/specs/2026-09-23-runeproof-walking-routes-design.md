# RuneProof walking route correction

The user challenged the unconditional travel warning after reviewing the local
guide. The warning reflects missing integration, not missing player unlocks.
Replace it with a calculation using the pinned Chunk Picker walking sections
and the existing account permission snapshot.

## Scope

- Preserve directed land-section adjacency, section entry requirements and edge
  requirements. Exclude water, unknown and missing nodes. Do not reuse the old
  transport graph or invent connections across adjacent map squares.
- Review section endpoints for the existing five published guides, tied to their
  authored revisions. Interior destinations keep their reviewed surface entrance.
- Find an entirely unlocked walking route between successive guide steps first.
  If none exists, show a source-backed candidate path and its missing chunks or
  requirements. These are requirements for the shown path, not a claim that all
  possible travel methods have been searched.
- Show ordered route chunks at each step and a deduplicated transit list beside
  destinations. Remove the blanket disclaimer and replace it with account results.
- Keep specific uncertainty for unreviewed alternatives or missing source links.
  Account chunk permissions do not supply a live player position; the first step
  identifies the guide's starting location, subsequent checks link guide steps.

## Verification

Pin the Restless Ghost bridge route (including transit 49,50 and 48,50), destination
ownership without transit ownership, usable detours, directed edges, separate
sections of one chunk, unknown conditions and alternative endpoint invalidation.
Check all five real guides, changed unlock snapshots, the full automated suite,
typecheck, production build and local browser display. No public deployment.
