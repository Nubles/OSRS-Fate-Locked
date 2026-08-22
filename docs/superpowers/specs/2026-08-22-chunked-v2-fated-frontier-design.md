# Chunked v2: The Fated Frontier

**Status:** Repository-owner review draft  
**Date:** 2026-08-22  
**Target mode:** Chunked only  
**Repository baseline:** `main` at `a694c16b6fccbbf394e09385eef1a14dcd176e58`

## 1. Summary

Chunked currently uses the same Standard Key economy as the rest of Fate-Locked while adding 623 paid chunk unlocks. Its frontier only follows orthogonal coordinate adjacency, although the authored map is split into disconnected land, island, and sea components. The early deterministic Key protection ends permanently after the first paid chunk. A player can therefore exhaust useful Key sources, own a barren first expansion, or reach the edge of the walking graph without any legal next chunk.

Chunked v2 replaces that fragile loop with **The Fated Frontier**:

- Hitpoints, Attack, and Strength tier 1 form a guaranteed Chunked-only starting baseline.
- Reachable **Fated Trials** grant permanent **Threads of Fate**.
- Enough Threads automatically weave a dedicated **Frontier Key**.
- A Frontier Key unlocks one random legal chunk; Fate still decides the destination.
- **The Unbroken Thread** is a slower, permanently repeatable Lumbridge-safe Trial that prevents progress from reaching zero.
- Typed Paths, Passages, and Voyages connect the complete authored map through real transport requirements.
- When walking expansion ends, **The Loom** reveals a **Fated Crossing** and its prerequisites.
- One commit-time authorization function governs every Chunked chunk unlock.
- All new rules, state, UI, migrations, and actions are isolated to Chunked. Vanilla has zero observable changes.

The thematic contract is:

> You can guarantee that Fate will eventually open a path, but you cannot guarantee where that path leads.

## 2. Problem statement and evidence

The current implementation has several independent lock paths:

1. The authored chunk set contains 624 coordinates, but only 368 share the free `50,50` start chunk's orthogonal walking component. The remaining 256 never enter the current frontier.
2. Even the current optimistic connection data leaves 66 authored chunks unreachable, so completion requires curated transport and Sailing gateways.
3. A new Chunked save receives three Standard Keys, all of which can be spent on non-geographical content.
4. The deterministic total-level award applies only while no paid chunk is owned. It ends forever after the first chunk even when that chunk adds no renewable activity.
5. Cartographer costs 40 Fate. It cannot rescue a state with no legitimate action from which to earn failures and Fate.
6. Chunked has approximately 1,419 paid unlock units, compared with roughly 973 in Vanilla, but inherits essentially the same base Key economy.
7. Non-Vanilla random eligibility does not consistently exclude geographically unusable bosses, minigames, and banks.
8. The reducer can charge stale or duplicate actions because it does not atomically prove mode, frontier membership, affordability, and state change before deduction.
9. Save validation accepts chunk strings without proving authored membership, connection, or mode coherence.
10. Completion counts stored chunks against a set that includes the implicit free start chunk, producing an off-by-one completion condition.

This redesign treats those as structural failures rather than attempting to solve them with a larger starting Key grant or a better warning.

## 3. Goals

### 3.1 Required goals

- A valid incomplete Chunked save must always retain a deterministic, reachable route toward its next geographical unlock.
- All intended authored chunks must be reachable through walking or an explicit non-circular transport route.
- Earning geographical progress must not compete with Standard Keys used for skills, equipment, banks, and activities.
- The destination of a normal frontier unlock must remain random and recognisably Fate-Locked.
- The system must remain usable with the tracker's existing honour-based/manual interaction model.
- Invalid, duplicate, stale, or unaffordable chunk actions must be no-ops and cost nothing.
- Existing valid Chunked progress must be preserved through an idempotent migration.
- Vanilla must have zero observable behavioural, economy, state, save, or interface changes.

### 3.2 Non-goals

- Making every random content unlock immediately usable.
- Making Chunked easy, deterministic, or free from long grinds.
- Replacing RuneProof or completing exact proof coverage for every activity in this feature.
- Automatically verifying all in-game actions without RuneLite support.
- Rebalancing Vanilla or fixing unrelated shared reducer behaviour.
- Choosing final Thread thresholds or reward rates from static analysis alone.

### 3.3 Definition of chunk-locked

A valid Chunked save is **chunk-locked** when at least one versioned target chunk remains locked and no finite sequence of legal tracker actions can produce another legal chunk unlock. The no-lock guarantee must hold after any previous sequence of legal player choices. It cannot depend on favourable tracker RNG, reloading, importing, administrative repair, network access, an unbounded real-world wait, or an unbounded objective.

Normal OSRS combat and drop RNG remains part of playing Old School RuneScape, but the permanent fallback itself must use objectives that do not require a particular random drop. Every tracker-controlled random prerequisite has a finite exhaustion or pity bound.

## 4. Core liveness model

### 4.1 Player-facing invariant

While an intended chunk remains locked, the player always has a reachable repeatable Trial that makes irreversible progress toward a valid Frontier Key.

### 4.2 System invariant

For every valid Chunked state that is not complete, at least one of the following must be true:

1. `getFatedFrontier(state)` contains a legal chunk that can consume a Frontier Key now; or
2. a Fated Crossing exists whose unmet requirements form a proven, non-circular sequence achievable from the player's current anchors, and at least one reachable Fated Trial can advance Threads and the existing Standard Key/Fate economy toward those requirements.

RNG-only progress does not satisfy the invariant. Threads never reset, expire, or decrease, and The Unbroken Thread is always constructible from the guaranteed starting baseline. A Crossing that needs a Standard unlock must carry a finite progression certificate: every Unbroken Thread completion performs a real Chunked Standard-Key attempt; ordinary pity guarantees a Standard Key after at most the configured hard failure cap; every successful Chunked Standard spend changes a finite no-duplicate target table; and exhausting that table necessarily includes the required unlock. The player may choose to delay that route, but the rules cannot remove it or require one lucky tracker result.

### 4.3 Build-time map invariant

Starting from the implicit `50,50` anchor and treating satisfied typed gateways as edges, the authored target set must be exhaustible. Every disconnected component must have at least one curated entry route whose prerequisites do not depend on content exclusive to that component or a later component.

A content or gateway change that violates this invariant fails validation and cannot ship silently.

## 5. Strict Vanilla isolation

This is a hard acceptance boundary, not a balancing preference.

- New state is held in an optional Chunked-only object and is absent from Vanilla saves.
- The Chunked migration runs only when the persisted mode is exactly `chunked`.
- Attack and Strength tier 1 become free only in Chunked.
- Vanilla keeps its current initial state, Standard/Omni/Chaos Key behaviour, Fate, pity, rituals, named-region pool, bank rules, and unlock eligibility.
- The existing general `UNLOCK` action and reducer path remain unchanged for Vanilla in this feature.
- Chunked uses dedicated actions for Trial completion, Thread awards, frontier weaving, Crossings, and migration.
- Every Chunked action dispatched against a Vanilla state is an exact no-op, including currency, unlocks, timestamps, revisions, analytics, and PRNG calls.
- The Loom and transport graph are neither loaded nor rendered for Vanilla.
- Chunk data is removed from Standard/Chaos eligibility only inside the Chunked rule branch.
- Existing Vanilla save serialization must not gain empty or default Chunked fields.
- Unrelated Vanilla defects discovered during implementation are recorded separately.
- Mode checks use the exact persisted mode ID. Unknown or removed modes fail closed and cannot fall through to either Vanilla defaults or the Chunked migration.

Before implementation changes, baseline fixtures must capture Vanilla's initial state, eligible pools, seeded roll results, PRNG call count and sequence, economy totals, save export, save import, and UI snapshots. The same fixtures must pass byte-for-byte or semantically identically after Chunked v2, as appropriate for nondeterministic metadata. The transport graph is dynamically loaded only after the exact Chunked mode guard succeeds.

## 6. Chunked starting state

A fresh Chunked v2 save receives:

- the implicit `50,50` Lumbridge start chunk;
- Hitpoints tier 1 and level 10;
- Attack tier 1;
- Strength tier 1;
- the existing three Standard Keys;
- zero Frontier, Omni, and Chaos Keys;
- zero Threads of Fate;
- an initial Fated Trial hand containing **The First Omen**.

No bank, equipment slot, named area, or free paid chunk is added. The baseline only guarantees that a player can perform the start-safe combat actions used by The First Omen and The Unbroken Thread. Fate controls the wider build and route.

Lumbridge Home Teleport is an explicit permanent Chunked rule exemption from paid mobility locks. This provides a real, bounded return to the fallback's start chunk whenever the OSRS spell is mechanically available. Temporary in-game restrictions such as being in combat do not constitute a tracker lock; no tracker unlock may permanently remove the teleport exemption.

The initial Trial pool may use only actions verified in the exact free start chunk and possible without a bank, quest, equipment unlock, paid mobility unlock, or additional skill tier. Initial candidates should use ordinary start-chunk creatures such as rats, goblins, or men after confirming their transformed chunk-content records.

## 7. Fated Trials and Threads of Fate

### 7.1 The Trial hand

The Loom normally deals three active Fated Trials. A Trial definition contains:

- stable definition and instance identifiers;
- objective type and target;
- objective quantity or completion condition;
- proof source and proof status;
- required owned chunks and unlocks;
- Thread reward;
- whether the underlying action already has an ordinary Key roll;
- any Trial-specific Key chance and Fate-on-failure value;
- generation and completion timestamps/counters needed for idempotency;
- repeat/escalation metadata.

Ordinary Trials are generated only from content that is **verified reachable** in the current state. Optimistic, coarse named-area, or unknown reachability cannot generate a Trial. A Trial remains visible if later state changes invalidate it, but it becomes non-completable with an explanation and can be replaced without penalty.

Each instance snapshots its baseline progress when dealt. Only progress after that baseline can complete it; dealing a Trial after its underlying event cannot retroactively reclaim a Key attempt or Threads.

### 7.2 Reward rules

- Every first valid completion of a Trial instance grants its configured Threads exactly once.
- If the underlying event already creates a normal Key attempt, the Trial does not create a second attempt.
- A Trial based on an action that normally has no Key opportunity may create one small, explicitly labelled Fated Trial attempt.
- A failed Fated Trial attempt awards ordinary Fate using a configured source weight.
- A successful attempt follows the existing Chunked Standard/Omni success behaviour; it does not change Vanilla behaviour.
- Threads are awarded independently of Key success or failure.
- An ordinary Key success may reset ordinary Fate under existing rules but can never reset Threads.
- Thread overflow carries through a weave.
- Thread conversion requires a positive safe-integer threshold, awards `floor(totalThreads / threshold)` Frontier Keys, and retains `totalThreads % threshold`; all intermediate values are bounded non-negative safe integers.
- Thread thresholds, rewards, and repeat escalation are configuration values rather than scattered constants.
- Completion of the underlying tracked event and completion of its matching Trial are resolved as one idempotent reward transaction, preventing double rolls after refreshes or retries.

### 7.3 The First Omen

The First Omen teaches the system through a guaranteed start-safe objective. It is not a free Frontier Key. It grants an accelerated but configurable first contribution so a new player sees geographical progress early.

### 7.4 The Unbroken Thread

The Unbroken Thread is the structural fallback:

- It is always derived from the implicit start chunk and guaranteed combat baseline, not from the general reachability model.
- It is logically enabled in every incomplete Chunked save, independently of the ordinary Trial hand, reachability inference, network access, inventory, bank access, consumable items, or current Key balances.
- The interface may de-emphasise it while ordinary Trials are available, but it cannot hide or disable it.
- It is infinitely repeatable.
- Repeated objectives escalate within a bounded cycle so repeatedly using the fallback is slower than varied ordinary progression without ever creating an infinite or impossible target.
- Every valid completion still adds a positive number of Threads.
- Every valid completion performs a real low-value Chunked Standard-Key attempt, allowing ordinary Fate and its hard pity cap to produce Standard Keys needed for Crossing prerequisites.
- Its counter and rewards are commit-time validated and idempotent.

The fallback must remain possible with no bank, no equipment unlock, no quest, no paid chunk, and no Standard Key. It has no tracker cooldown or daily limit; balancing comes from finite escalating objectives rather than waiting.

### 7.5 Trial refresh

The hand refreshes when:

- a Trial completes;
- a chunk unlock changes reachable content;
- a Crossing requirement changes materially;
- a migration invalidates an old generated Trial; or
- the player uses a bounded, non-exploitable replacement action for an invalid Trial.

Refresh never removes earned Threads or consumes a Key.

Unlocking a chunk does not erase a partially completed Trial or a completed-but-unclaimed reward. Existing valid instances retain their progress until completion or explicit invalidation; only open hand slots are refilled. Invalid replacement records the old instance so it cannot later be replayed for rewards.

## 8. Frontier Keys and the Key economy

### 8.1 Dedicated geography currency

Frontier Keys are the only ordinary currency used to roll a chunk in Chunked v2. Standard Keys cannot buy chunks. Frontier Keys cannot be:

- spent on another table;
- converted into Standard or Omni Keys;
- used in Gambit, Greed, or Transmutation;
- lost when no valid frontier exists; or
- consumed by a failed, stale, duplicate, or rejected action.

Reaching the Thread threshold automatically awards a Frontier Key and preserves overflow. The actual chunk is not selected until the player chooses **Weave the Path**.

The old Chunked-only `25`-total-level bootstrap award is retired for migrated and fresh Chunked v2 saves. Previously awarded Keys are never removed. The permanent Trial loop replaces a safety valve that ended after the first chunk.

In Chunked v2, only dedicated atomic Chunked actions may add chunk ownership. Generic `UNLOCK`, Standard, Omni, or unvalidated Chaos actions cannot add a chunk. Chunked Standard spends also use a guarded Chunked-only action so every successful spend adds one permanent eligible unlock and every duplicate, stale, invalid, or unaffordable result costs nothing. Vanilla continues using its existing action path.

### 8.2 Normal weave

Weave the Path samples uniformly from the commit-time legal result of `getFatedFrontier(state)`. The player can know the eligible frontier but cannot choose the result. One atomic transaction consumes exactly one Frontier Key, adds exactly one valid distinct chunk, persists the new state revision, and only then reveals the result. Reloading or opening another tab cannot reroll a revealed outcome.

### 8.3 Cartographer

Cartographer remains the premium agency ritual:

- It is Chunked-only and retains its configured Fate cost unless evidence supports a later balance change.
- It draws three distinct legal commit-time frontier chunks when at least three exist, or all legal choices when fewer exist.
- Its exact cost is 40 ordinary Fate and no Frontier Key. Fate purchases a direct alternative route rather than improving a held Frontier Key.
- Offers and their state revision are persisted before choice; reopening cannot reroll them for free.
- The selected chunk is revalidated at commit time.
- A stale or invalidated choice costs no Fate and discards or refreshes the offer atomically.
- Cartographer does not require or consume a Frontier Key.

### 8.4 Chaos and Omni behaviour in Chunked

- Omni does not directly select a chunk; Cartographer remains the geography choice mechanism.
- Chaos contains exactly one synthetic `Fated Frontier` entry whenever a live legal frontier exists. Drawing it dispatches a dedicated validated Chunked Chaos-weave action that consumes the committed Chaos Key, consumes no Frontier Key, and adds one legal random chunk atomically. It never receives one ticket per frontier coordinate, preventing frontier size from distorting the global Chaos pool.
- The synthetic entry is absent while only an unmet Crossing exists. It contributes exactly one ordinary ticket to the Chunked Chaos pool and cannot change Vanilla's Chaos pool.

## 9. The Fated Frontier graph

### 9.1 Canonical target set

`CHUNKED_TARGETS` is a versioned canonical manifest derived from the authored, rollable chunk set. The current source has 624 authored coordinates; the implicit `50,50` start root is considered owned but excluded from paid targets, leaving 623 paid targets. Completion compares manifest set membership, never raw array length.

Every paid target in the released manifest must have a proven directed entry. The initial v2 release must prove all 623 current paid targets. A coordinate may be excluded only by an explicit, owner-reviewed manifest decision; tooling may never silently drop one merely because route data is missing. CI fails when a content update adds a target without a proven entry.

Stored chunks must be canonical valid coordinates, unique, and members of the target set excluding the implicit start.

### 9.2 Typed edges

The graph supports three explicit edge types:

1. **Path** — ordinary orthogonal movement between authored neighbouring coordinates.
2. **Passage** — ferry, ship, cave, ladder, portal, charter, teleport, quest transport, or other discrete route.
3. **Voyage** — Sailing movement from a verified port or sea position into island and open-sea content.

A Passage or Voyage record includes:

- stable edge ID;
- origin and destination chunk IDs;
- directionality;
- route category and player-facing label;
- exact state requirements;
- evidence/provenance;
- whether it may serve as a component-entry gateway;
- reciprocal edge where appropriate; and
- validation notes for circularity and source-side achievability.

Connections inferred only from prose or incomplete source data remain optimistic and cannot establish liveness until curated.

### 9.3 Ownership, reachability, and anchors

Ownership and physical reachability are separate facts. The implicit start chunk is the root expansion anchor. A normally acquired chunk becomes a reachable expansion anchor because its unlock authorization contains a proven edge from an already reachable anchor.

Valid disconnected chunks retained by migration remain owned for display and completion, but are labelled **Dormant Legacy Anchors** until a verified Path, Passage, or Voyage connects them to the reachable graph. Dormant ownership cannot generate Trials, satisfy physical-location requirements, or seed frontier expansion. Once connected, it activates without being repurchased. This preserves legacy progress without treating ownership as teleportation.

Before frontier candidates are generated, reachability computes a closure through already owned chunks and satisfied typed edges. If that closure reaches a dormant owned chunk, it activates automatically and traversal continues through it. Activation is not an unlock, consumes no currency, and is idempotent.

### 9.4 Frontier calculation

`getFatedFrontier(state)` returns unowned target chunks reachable by one currently usable Path, Passage, or Voyage from any active reachable anchor. It must:

- exclude the implicit start and owned chunks;
- exclude destinations whose edge requirements are not currently satisfied;
- use exact mode-specific predicates;
- return stable reason/evidence metadata for UI and tests;
- be deterministic before random sampling; and
- never use coarse named-area foothold reachability as proof.

### 9.5 Fated Crossings

If unowned chunks remain but the current usable frontier is empty, The Loom selects a proven component-entry gateway and reveals it as a Fated Crossing.

A Crossing displays:

- its route and destination component;
- every prerequisite;
- which prerequisites are complete;
- why each incomplete prerequisite is achievable from current anchors; and
- relevant Fated Trials or unlock categories that can advance it.

A destination behind an unmet Crossing is not rollable. The Crossing is an explicit objective chain, not permission to bypass real OSRS requirements.

Gateway validation must reject a route whose quest, skill method, item source, transport, or required location depends on entering the destination component first.

Validation covers the complete prerequisite dependency graph, not just geographic edges. Every permanent Standard-Key prerequisite remains eligible in its target table while its Crossing is active. A Crossing cannot depend on a consumable or temporary state unless reacquiring that state has a verified source-side route. Unknown evidence means not verified and cannot satisfy the proof.

## 10. Authoritative chunk authorization

All Chunked chunk mutations call one pure authorization function, conceptually:

```ts
canUnlockChunk(state, chunkId, source): ChunkUnlockDecision
```

The decision includes `allowed`, a stable rejection reason, the matching edge or ritual source, and the required currency/cost. It checks:

- exact Chunked mode;
- valid canonical target coordinate;
- not the implicit start;
- not already owned;
- membership in the live Fated Frontier;
- source-specific validity, including Cartographer offers;
- all Passage or Voyage requirements;
- sufficient non-negative currency; and
- applicable rules version; and
- expected state revision for multi-tab and cloud conflict protection.

Dedicated reducer actions apply mutations in this order:

1. Compare the action's expected state revision and reject a stale concurrent action.
2. Recompute authorization from current state.
3. Reject without mutation if not allowed.
4. Add the chunk exactly once.
5. Deduct the exact currency cost.
6. Advance the revision, record the event, and refresh relevant Trial/Crossing state.

Currency is never deducted before ownership changes. UI checks are advisory; reducer checks are authoritative.

## 11. Save migration and recovery

### 11.1 Mode-specific state

Chunked v2 adds an optional mode-specific object containing at least:

- rules and graph-data versions;
- monotonic state revision for compare-and-swap actions;
- Frontier Key count;
- Thread count and threshold progress;
- active Trial instances and fallback escalation;
- current Crossing;
- persisted Cartographer offer and revision, when present;
- migration metadata; and
- quarantined legacy chunk entries.

The object is absent from Vanilla state and serialization.

### 11.2 Idempotent legacy migration

For a legacy save whose persisted mode is exactly Chunked:

1. Preserve Standard, Omni and Chaos Keys, ordinary Fate, activities, levels, and all valid owned chunks.
2. Raise Attack and Strength to at least tier 1.
3. Refund one Standard Key for Attack tier 1 if the old save already had Attack tier 1 or above, and likewise for Strength. Record refund provenance so rerunning migration cannot refund twice.
4. Remove stored `50,50` from paid ownership because it is implicit. Do not count it toward completion.
5. Canonicalise and deduplicate valid authored chunk IDs without charging or refunding duplicates.
6. Preserve valid disconnected owned chunks as Dormant Legacy Anchors until verified transport connects them.
7. Quarantine malformed or unknown entries for a visible recovery report; do not treat them as ownership and do not silently erase their original representation from recovery metadata.
8. Initialise Frontier Keys and Threads to zero without converting or consuming existing Standard Keys. Existing Standard Keys retain their full non-geographical value but no longer buy chunks.
9. Generate a valid Trial hand and Crossing state.
10. Mark the migration version only after all steps succeed.

Past chunk purchases receive no Standard-Key refund, regardless of whether they originally came from Standard, Chaos, or Cartographer. Their full ownership progress is retained, provenance is not reliably available in legacy saves, and a blanket one-per-chunk refund would overpay non-Standard routes. Stored `50,50`, duplicate entries, and quarantined invalid entries also receive no refund. The only automatic Standard refunds are one each for previously purchased Attack tier 1 and Strength tier 1 because those exact unlocks become free under the new baseline.

Before mutation, migration keeps a recoverable copy of the relevant pre-migration Chunked fields in migration metadata or the existing backup mechanism. The migration is atomic: failure leaves the old save intact. The migration summary is informative and non-blocking. It cannot prevent the user from closing What's New or using the tracker.

### 11.3 Imports and malformed state

New imports validate mode coherence, numeric bounds, unique Trial instance IDs, authored chunk membership, implicit-start handling, currency non-negativity, and rules version before migration compensation is calculated. Invalid data is rejected or quarantined with specific reasons. Importing an older valid Chunked save after the app has previously migrated another save still migrates that imported save exactly once using its own recorded version and refund provenance. As an honour-based tracker, an imported save may still claim ownership of valid authored chunks; malformed, unknown, duplicate, or implicit-start entries cannot mint extra anchors, Keys, refunds, or migration compensation.

## 12. Interface

### 12.1 The Loom

The Chunked dashboard displays The Loom without hiding essential controls. It shows:

- current Threads and threshold progress;
- Frontier Key count;
- three active Fated Trials;
- The always-available Unbroken Thread, visually de-emphasised when ordinary Trials are available;
- current Fated Crossing and prerequisite progress; and
- the Weave the Path action.

Every Trial shows its objective, progress, Thread reward, Key opportunity, proof status, and why it is reachable.

### 12.2 Map language

The map visually distinguishes:

- ordinary Path frontier chunks;
- Passage destinations;
- Sailing Voyages;
- the active Fated Crossing;
- dormant and newly activated Legacy Anchors; and
- blocked routes with visible unmet requirements.

Normal frontier eligibility may be shown, but the random result is not revealed before weaving. Mobile presents the same information in stacked cards; required controls and explanations cannot exist only in hover tooltips or collapsed sections.

### 12.3 Unlock interface

- Standard Key tables in Chunked no longer include chunks.
- The dedicated frontier action clearly states that Fate chooses one currently legal destination.
- Cartographer clearly states its choice count and Fate cost.
- Rejected actions explain why they failed and confirm that no currency was consumed.
- Vanilla never renders any of these elements.

## 13. Error handling and recovery behaviour

- Empty frontier plus incomplete target set is a first-class liveness status, not an empty dropdown.
- If a valid Fated Crossing exists, the UI displays it.
- If corrupted or unsupported runtime data cannot produce a proven Crossing, the app enters a visible `route-data-error` state, preserves all currency, and records diagnostics. It must not invent an impossible route or silently claim completion. Such a state is outside the valid-state liveness guarantee and is a release-blocking defect when reproduced with supported data.
- The Unbroken Thread remains available during a route-data error so accumulated progress is not lost, but the release acceptance tests must prevent known valid states from reaching this condition.
- Duplicate Trial completion, duplicate chunk unlock, stale Cartographer offer, repeated migration, or replayed action ID is a no-op.
- All counters are bounded safe integers and non-negative after every reducer action.
- A graph revision re-evaluates dormant and orphaned owned components without deleting ownership, inventing reachability, or consuming currency.

## 14. Testing and proof obligations

### 14.1 Map and liveness tests

- Assert the canonical target count and implicit-start treatment.
- Enumerate connected components for Paths alone and for the complete typed graph.
- Prove every target component has a non-circular entry gateway.
- Simulate expansion from `50,50` until every intended target is owned.
- Test directional, quest, mobility, ferry, portal, and Sailing requirements.
- Assert `remaining targets > 0` implies a non-empty frontier or a proven Crossing path.
- Assert every Crossing prerequisite is source-side achievable.
- Verify every Standard-unlock prerequisite has a finite progression certificate through a reachable Trial, bounded pity, and a finite state-changing target table.
- Fail CI when the versioned target manifest or graph changes without preserving proof for every released target.

### 14.2 Reducer and property tests

- Charge if and only if a state-changing unlock succeeds.
- Reject duplicate, stale, unaffordable, wrong-mode, unknown, implicit-start, and non-frontier actions.
- Keep all currencies non-negative.
- Make Trial completion and migration idempotent.
- Fuzz random sequences of Trial completions, Key awards, spending, Cartographer offers, imports, and chunk rolls across thousands of seeds.
- Property-test arbitrary legal action sequences for the reducer invariants.
- Test two-tab and cloud-revision conflicts so the same Key, offer, Trial, or migration refund cannot commit twice.

Random simulations support pacing and balance but do not prove impossibility. The no-lock proof is decomposed into exhaustive obligations:

1. The fallback is legal in every incomplete valid state.
2. A bounded number of fallback completions produces each Frontier Key.
3. Every missing Crossing prerequisite has a bounded acquisition path.
4. Every non-complete graph state has a legal frontier or attainable Crossing.
5. Every successful geography spend adds exactly one distinct target.

### 14.3 Vanilla isolation tests

- Snapshot the pre-change Vanilla initial state and all unlock pools.
- Compare seeded Standard, Omni, Chaos, Fate, pity, ritual, and region results before and after the feature.
- Round-trip representative Vanilla saves without adding Chunked state or changing values.
- Assert no Loom component, chunk graph module, Frontier action, Trial action, or Chunked migration executes in Vanilla.
- Dispatch every Chunked action against Vanilla and assert an exact state/PRNG no-op.
- Run the existing full Vanilla suite unchanged.

### 14.4 Migration tests

- Fresh Chunked save.
- Legacy save with neither starter combat tier.
- Legacy save with one or both tiers already purchased.
- Repeated migration.
- Legacy save with stored Standard Keys that previously could have been spent on chunks.
- Stored implicit start chunk.
- Duplicate, malformed, unknown, and disconnected chunks.
- Negative or overflowing currency.
- Mode missing, unknown, Vanilla, and removed-mode saves.
- Legacy Cartographer-created distant chunks retained as owned, initially dormant anchors unless a verified route already connects them.

## 15. Balance and evidence

Final values must follow `docs/key-economy-evidence.md` rather than static intuition. The first implementation uses named configuration values and records at least:

- time and actions to first paid chunk;
- Threads earned per hour by stage;
- Frontier Keys per hour by stage;
- longest interval without a frontier unlock;
- number of verified reachable Key faucets after each chunk;
- ordinary versus fallback Trial usage;
- dead or unusable content-unlock share;
- Fate/pity frequency from Trial attempts;
- Crossing wait time and most common blocking prerequisites; and
- normal weave versus Cartographer usage.

Broad rate changes require the repository's frozen-sample protocol: at least ten runs, at least 500 scoreable attempts per stage, and materially different source mixes. Initial Thread threshold, Trial rewards, fallback escalation, Trial-specific Key chance, and first-Omen acceleration remain provisional until that evidence exists.

## 16. Acceptance criteria

Chunked v2 is acceptable only when all of the following are true:

1. A fresh player can perform The First Omen with only the guaranteed baseline.
2. Spending all Standard Keys cannot remove the ability to earn Threads or a Frontier Key.
3. Owning an unproductive first chunk cannot disable The Unbroken Thread.
4. Acquiring any number of chunks cannot permanently disable the fallback.
5. All intended authored chunks can be reached through a tested sequence of Paths, Passages, and Voyages.
6. Every incomplete valid state has a legal frontier or a proven, displayed Crossing sequence.
7. Normal weaving remains random; direct geography choice remains a costly Cartographer ritual.
8. No invalid action consumes a Key or Fate.
9. Existing valid Chunked ownership and progression survive migration.
10. Migration is idempotent and non-blocking.
11. Vanilla fixtures, behaviour, economy, saves, and UI are unchanged.
12. Final economy values are justified by measured evidence rather than sink counts alone.
13. The retired total-level bootstrap cannot award additional Keys after migration, while previously awarded Keys remain untouched.
14. The Unbroken Thread remains logically available in every incomplete valid state and produces a real Standard-Key attempt on every completion.
15. Only dedicated revision-checked Chunked actions can add chunks; generic actions and concurrent replays cannot do so.
16. All 623 paid targets in the initial versioned manifest have exhaustive path and prerequisite proofs.
17. Unknown modes fail closed and cannot trigger Vanilla defaults or Chunked migration.
18. Legacy compensation follows the documented deterministic policy and can execute only once per save.

## 17. Decisions fixed by this design

- Hybrid rules remain: skills, equipment, banks, and activities are still Fate-Locked.
- Hitpoints, Attack, and Strength tier 1 are the Chunked-only guaranteed baseline.
- Geography uses dedicated Frontier Keys earned through permanent Threads.
- Fated Trials and The Unbroken Thread provide the renewable loop.
- Fate chooses a normal frontier result.
- Cartographer provides costly limited choice.
- Typed transport and Sailing gateways replace adjacency-only completion assumptions.
- Valid disconnected legacy chunks remain owned but dormant until a verified route activates them.
- Vanilla has zero observable changes.

## 18. Implementation gate

This document defines behaviour and acceptance criteria, not the implementation sequence. No production implementation should begin until the repository owner reviews this specification. After approval, a separate test-first implementation plan should map these requirements to exact files, tests, migration steps, checkpoints, and release evidence.
