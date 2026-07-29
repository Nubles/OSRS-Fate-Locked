# RuneProof

RuneProof is Fate Locked's proof-carrying goal and requirement engine. It asks a
narrow question: **what can this run obtain or complete using only the
capabilities available now?**

It supports item, quest, diary, and activity goals. The web app owns the
constraint model, route selection, blocker analysis, and proof replay. RuneLite
receives only a compact display summary.

## What "current chunks" means

In Chunked mode, a source counts only when its exact surface chunk is unlocked
**and reachable from the run's start through currently legal connections**.
Named regions are descriptive; they never replace exact chunk truth.

An unlocked chunk can still be stranded. If the current run has no legal path
to it, its shops, floor spawns, monsters, facilities, and other sources
contribute nothing to the answer.

The first production proof-grade item slice demonstrates this with the Plank
floor spawn in the Graveyard of Shadows. RuneProof traverses the reviewed
Lumbridge-to-Graveyard corridor one exact chunk at a time. All eight non-free
chunks must belong to the current run; removing any intermediate chunk strands
the spawn and the result fails closed to `UNKNOWN`.
Dungeons, basements, interiors, quest instances, islands, and similar sections
are child locations. A child is reachable only when:

1. its exact parent entrance is reachable;
2. every entry requirement is satisfied; and
3. every required transport or shortcut is currently usable.

A child's internal map coordinates do not require a separate Fate Locked roll.
They also do not bypass the parent entrance or its gates.

## Capability, not possession

RuneProof proves repeatable or otherwise modelled ways the current run can
obtain something. It does not inspect or infer inventory, equipped items, bank
contents, looting-bag contents, storage, or consumable stock.

Therefore, "Obtainable" means the current rules expose a valid acquisition
route. It does not mean the player owns the item now.

## Result meanings

- **Obtainable now (`OBTAINABLE`)** — at least one complete route exists and
  the preferred route is deterministic.
- **Obtainable now — random drop (`OBTAINABLE_RNG`)** — a complete route
  exists, but every valid route includes at least one non-guaranteed result.
- **Missing requirements (`BLOCKED`)** — known route families exist, but none
  pass the current run snapshot. RuneProof lists route-specific minimal
  blockers and identifies blockers shared by every route as unavoidable.
- **No valid route in your current chunks (`IMPOSSIBLE`)** — the audited model
  excludes every legal route. RuneProof may emit this only when the goal and
  every relevant source and requirement family have verified coverage.
- **Not enough verified data (`UNKNOWN`)** — missing, partial, conflicting,
  stale, cyclic, malformed, or safety-capped evidence could change the answer.
  Unknown never means impossible.

The preferred route is selected deterministically: guaranteed routes first,
then fewer prerequisites, fewer recursive ingredients, shorter travel, higher
random probability, and finally a stable route identifier. Other valid routes
remain available in the app.

## Proofs, export, and freshness

A positive result carries a witness containing the exact acquisition rules and
chosen requirements used to prove the goal. The app binds that witness to:

- the run ID;
- the run revision; and
- the RuneProof source version.

Before export, the app re-evaluates the selected goal, replays the witness, and
checks its proof hash. The RuneLite bundle contains a bounded summary: goal,
status, explanation, route or blocker labels, proof hash when applicable,
source version, and run revision. It contains no inventory, bank, equipment, or
private notes.

RuneLite is intentionally display-only. It marks a summary **Fresh** only when
its proof revision exactly matches the imported bundle's current run revision,
it carries a non-empty source version, and a positive proof hash has the
expected SHA-256 form. A positive summary with a missing or malformed proof
hash is **Unverified**; a malformed v1 summary with missing required fields is
not displayed. A revision mismatch is **Stale**. Re-export from the current app
run to replace a stale summary.

RuneLite does not replay the full proof or maintain a second solver. The app's
export-time replay is authoritative.

## Coverage and fail-closed behavior

RuneProof source generation accounts explicitly for verified and unresolved
quest, chunk, acquisition, and provenance records. A known positive witness can
still prove a route when unrelated global coverage is partial. Negative claims
need complete relevant coverage.

Unsupported cycles, malformed evidence, incomplete source families, and route
or blocker safety limits produce `UNKNOWN`. RuneProof never silently truncates
work and presents the partial result as complete.

## Deliberate boundaries

RuneProof stops at explaining the current answer. It does not:

- recommend a future chunk, region, skill, merchant, quest, or other unlock;
- recommend Key-table spending, estimate future rolls, or propose rule changes;
- claim a random drop is guaranteed;
- track whether an obtainable item is already owned; or
- automate movement, combat, acquisition, skilling, or any other gameplay.

The current bounded hypergraph solver is the verified implementation. Benchmark
evidence and the decision threshold for any future SAT layer are documented in
[RuneProof performance and solver decision](./runeproof-performance.md).
