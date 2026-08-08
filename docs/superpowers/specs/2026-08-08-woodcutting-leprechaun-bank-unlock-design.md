# Woodcutting Leprechaun Bank Unlock Design

## Goal

Represent the Forestry Woodcutting Leprechaun as one bank-service unlock without pretending the temporary event has a fixed map location.

## Context

The OSRS Wiki describes the Woodcutting Leprechaun as a temporary Forestry event that appears around active Woodcutting activity and acts as a bank deposit service. It is not a fixed NPC with a finite location list: [OSRS Wiki - Forestry event](https://oldschool.runescape.wiki/w/Forestry_event).

The current registry contains 126 physical bank/deposit chunks. Assigning the event to a physical chunk would misrepresent its dynamic coverage.

## Design

Add one virtual bank unlock:

- Stable id: `woodcutting-leprechaun`
- Player-facing label: `Woodcutting Leprechaun (Forestry)`
- Canonical chunk coverage: 0
- Pool effect: `BANK_IDS` grows from 126 to 127
- Chunk-content effect: none; `public/chunk-content.json` remains a physical-chunk dataset
- Access description: variable Forestry woodcutting area; no fixed chunk

Virtual unlocks are stored in the reviewed bank-location registry alongside their evidence and are consumed by bank-pool generation, but they are excluded from the physical chunk transform and upstream walkability checks. Physical bank ids retain the existing numeric canonical-id contract.

## Validation and generation

- Validate the virtual id as a unique non-empty stable id that cannot collide with physical numeric ids.
- Require non-empty facility and evidence strings, and require the evidence URL to be covered by the registry's source revisions.
- Generate the virtual definition after the 126 physical definitions in `data/banks.ts`.
- Keep `scripts/gen-banks.mjs --check` deterministic.
- Keep physical chunk baselines at 126 while player-facing bank totals and completion denominators update to 127 through `BANK_IDS.length`.

## Testing

- Registry tests pin the virtual id, label, evidence, and zero physical-chunk contribution.
- Generator tests pin 127 total bank unlocks and the virtual label.
- Existing physical-bank tests continue to assert 126 unique canonical chunk ids and unchanged exclusions.
- Share-summary, completion, changelog, typecheck, content verification, and production build checks must pass.

## Scope

This change adds only the one abstract Forestry event unlock. It does not enumerate Woodcutting hotspots, assign the event to the Woodcutting Guild or another proxy chunk, or include other temporary/random services.
