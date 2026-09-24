# Quest source harvest

Status: implementation authorized by the user's “Lets proceed” after the source-combination proposal. Local source ingestion and review; public guide publication remains separate.

## Outcome

Make the detailed quest information already present in Chunk Picker and Quest Helper available as reproducible, inspectable candidate evidence. Keep the Wiki-style guide design and Fate eligibility rules independent of imported source instructions.

Import the Plugin Hub-pinned Quest Helper revision, retain its BSD 2-Clause licence and per-file notices, and extract its quest/miniquest source without executing Java. Record source paths, hashes, positions, item/equipment requirements, progress states and conditional branches. Preserve unknown expressions rather than pretending to evaluate RuneLite client state.

Import every quest task in the existing pinned Chunk Picker export. Retain dependencies, source location tokens and NPC/object references. Resolve surface and interior access candidates against the existing chunk dataset; preserve alternate entrances and unresolved locations. A Chunk Picker section suffix is not a physical plane. A Quest Helper WorldPoint plane is preserved as an actual plane. Neither source alone establishes a legal travel path between destinations.

## Components

- Pure Java-source evidence extractor with conservative lexical parsing.
- Pure Chunk Picker task/location adapter and WorldPoint-to-region conversion.
- Offline source snapshot, hashes and licence attribution, with explicit opt-in refresh from an immutable revision.
- Deterministic combined candidate catalogue and coverage report. Candidate evidence cannot approve or publish a quest.
- Reviewed Restless Ghost mapping linking the two sources, pinned Wiki facts, the existing public actions, and the Neck T1 equipment gate.
- Offline verification, drift checks and source-to-guide regression tests.

The existing walkthrough importer targets an older source snapshot and a fixed reviewed roster. This harvest uses a separate evidence catalogue rather than silently changing that contract. Source artifacts remain outside `public/` and application imports. No save, rewards, Journal completion, public guide roster or deployed app is changed by this work.

## Validation

Prove that Restless Ghost retains its ten Quest Helper actions and ordered conditional branches, its equipped and non-consumed amulet requirement, its distinct surface/interior coordinates, and its four surface access destinations. Compare against the current public guide and the pinned Wiki evidence, recording discrepancies instead of silently favoring one source. Check that obtaining the amulet remains allowed before Neck T1 and wearing remains blocked until Neck T1.

Tests cover nested expressions, escaped strings/comments, unresolved coordinates, branch ordering, ambiguous entity locations, section IDs, interior entrances, integrity failures, repeatable generation and public-catalogue isolation. Run the complete repository tests, typecheck and production build after focused checks pass.
