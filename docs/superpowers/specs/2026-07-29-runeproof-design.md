# RuneProof Design

## Summary

RuneProof is Fate Locked's proof-carrying goal and requirement engine. It
answers whether a quest, diary, activity, or item is obtainable from the
current Fate run by combining exact chunk reachability with every verified
acquisition and production route available inside those chunks.

RuneProof replaces overlapping planner heuristics with one canonical reasoning
pipeline. It does not inspect the player's inventory or bank, recommend future
Fate rolls, or automate gameplay. Its question is deliberately narrower:

> Given this Fate Locked ruleset and this exact reachable chunk network, what
> goals and items can the account obtain?

Every positive answer includes a replayable witness rooted in the current run.
Every blocked answer identifies the missing unlocks on each known route and
which blockers, if any, are unavoidable. Incomplete relevant data produces
`UNKNOWN`, never a false impossibility claim.

## Product Decisions

The approved product decisions are:

- RuneProof is deeply integrated with Fate Locked rather than launched as a
  general restricted-account engine.
- It reasons from the current run only. It does not recommend Key tables,
  estimate future Fate unlocks, or suggest how to spend Keys.
- Exact chunk and section reachability is authoritative. Named regions are
  descriptive and may not substitute for chunk truth in Chunked mode.
- An unlocked but stranded chunk contributes no capabilities.
- Dungeons and instances are gated child sections of their entrance chunk.
  They become reachable only when the entrance chunk and every entry
  requirement pass; their internal coordinates do not need separate rolls.
- RuneProof reasons about what the current reachable chunks make obtainable.
  It does not read or infer current inventory, equipment, bank, or storage
  contents.
- The preferred route is ranked by deterministic, explainable rules. Every
  other valid route remains available.
- The Fate Locked app owns modelling, solving, and proof generation. The
  RuneLite plugin displays versioned results and verifies their freshness; it
  does not contain a second solver.

## Goals

RuneProof must:

- evaluate quests, diaries, activities, and items against the current Fate run;
- understand exact unlocked and reachable chunks, child sections, connections,
  transport, shortcuts, and entry gates;
- index all verified item sources and production capabilities contributed by
  reachable chunks;
- recursively prove item acquisition through shops, spawns, drops, gathering,
  pickpocketing, activities, rewards, services, and production;
- respect skill tiers, effective level caps, quests, activities, merchants,
  mobility, equipment tiers, and other Fate unlocks;
- distinguish deterministic and random acquisition;
- retain exact source chunks, prerequisites, quantities, yields, repeatability,
  randomness, and provenance in every derivation;
- detect cycles rather than allowing self-supporting acquisition chains;
- explain route-specific and unavoidable missing unlocks;
- return `UNKNOWN` when relevant source or requirement coverage is incomplete;
- produce deterministic, replayable proof reports bound to the run and content
  versions; and
- replace independent planner reconstructions with a shared canonical result.

## Non-Goals

The initial RuneProof release does not:

- track whether an obtainable item is currently owned;
- import inventory, equipment, bank, looting-bag, or storage contents;
- recommend future chunk, region, skill, merchant, activity, or other Fate
  unlocks;
- recommend Key-table spending or estimate expected Keys for a future unlock;
- claim that a random drop is guaranteed;
- automate movement, combat, acquisition, skilling, or any other gameplay;
- model arbitrary non-Fate-Locked challenge rules;
- solve transient UIM inventory packing, tile budgets, or other non-monotone
  state-planning problems;
- treat missing source data as proof that no source exists; or
- require a SAT solver for queries that ordinary graph evaluation can answer.

## Prerequisites

RuneProof depends on the reviewed quest, geography, and chunk-source work
already planned for Fate Locked. Implementation begins only after the
canonical quest evaluator and pinned chunk transformation establish:

- exact and reproducible chunk, section, connection, and entry-gate data;
- one canonical interpretation of quest and diary access requirements;
- deterministic source manifests and transformation accounting; and
- explicit `unresolved` coverage rather than silent exclusions.

The existing Resource Engine is a useful source catalogue, not yet sufficient
proof data. Region-wide or `Any` source locations, incomplete drops, implicit
merchant mappings, and unreviewed enrichment records must be resolved to exact
locations and stable evidence before they can support `IMPOSSIBLE`.

## Result Semantics

Every query returns exactly one top-level status:

- `OBTAINABLE`: at least one complete route exists and every acquisition step
  on the preferred route is deterministic.
- `OBTAINABLE_RNG`: at least one complete route exists, but no fully
  deterministic route exists. Every complete route contains at least one
  non-guaranteed reward.
- `BLOCKED`: known route families exist, but none pass under the current Fate
  unlock snapshot. The result lists missing unlocks and other failed
  requirements without recommending how to acquire them.
- `IMPOSSIBLE`: every complete known route is prohibited by permanent run
  rules or the audited model proves that no legal route exists. This status is
  allowed only when all relevant requirement and source coverage is verified.
- `UNKNOWN`: incomplete, conflicting, stale, or unresolved evidence could
  change the answer.

`BLOCKED` and `IMPOSSIBLE` are intentionally different. A locked chunk or
merchant is a current blocker even when a later Fate roll could theoretically
unlock it. RuneProof reports that blocker but does not plan the future roll.

## Canonical Model

RuneProof uses five core record families.

### Facts

A fact records a truth supplied by the current Fate snapshot, including:

- run ID, run revision, mode, and rules version;
- unlocked chunks and other static unlock categories;
- completed quests, diaries, and activities;
- skill tiers, observed levels, and effective Fate level caps;
- equipment tiers;
- unlocked merchants, mobility, banks, guilds, minigames, bosses, farming,
  Slayer, storage, housing, and Arcana capabilities; and
- content and source-audit versions.

Possession facts are absent by design.

### Locations

A location is an exact surface chunk or a child section such as a dungeon,
interior, underground area, or instance. It contains:

- a stable location ID;
- canonical chunk coordinates for a surface location or a parent entrance ID
  for a child section;
- entry requirements;
- directed connections to other locations;
- transport or shortcut requirements;
- coverage and provenance metadata; and
- content-source references.

### Sources

A source is anchored to one or more exact locations and represents a shop,
monster, floor or object spawn, gatherable resource, pickpocket target, stall,
activity, reward, NPC service, or production facility. It contains:

- stable source and entity IDs;
- exact location IDs;
- source type;
- source prerequisites;
- output items, quantities, and probability;
- stock, limit, or repeatability semantics;
- required Fate unlocks;
- evidence and coverage state; and
- a reviewed source reference.

### Actions

An action turns satisfied requirements and optional inputs into outputs. An
action records:

- prerequisites;
- consumed and reusable inputs;
- produced outputs and yields;
- required facility or source;
- whether it is repeatable;
- whether its output is deterministic or random;
- probability or rate metadata when known; and
- a stable action ID used by proof replay.

### Requirements

Requirements are typed expressions:

- `all` for conjunction;
- `any` for alternative routes;
- `atLeast` for threshold requirements;
- `quantity` for consumable amounts;
- `fact` for an exact run fact;
- `reachable` for a location;
- `obtainable` for an item and quantity; and
- `manual` or `unknown` for reviewed conditions that are not machine-provable.

Quest, diary, activity, and item goals compile into this shared representation.
UI components may render the result but may not reconstruct eligibility.

## Exact Reachability

RuneProof builds the reachable location graph from the run's canonical home
chunk. A location is reachable only when:

1. its surface chunk is unlocked, or its parent entrance is reachable;
2. there is a path from the home chunk through reachable locations;
3. every traversed connection is legal;
4. every quest and activity gate on the path is satisfied;
5. every required mobility, transport, or shortcut unlock is satisfied; and
6. every required skill and effective level passes.

An unlocked location with no legal route from home is `STRANDED` and contributes
no sources. Unknown connections or gates do not become passable by default.

Dungeons and instances inherit ownership from the reachable entrance but retain
their own entry requirements. They contribute content only after those
requirements pass.

## Chunk Capability Index

For each reachable location, RuneProof activates every verified source whose
local requirements pass. The resulting index contains:

- directly obtainable deterministic items;
- directly obtainable random items;
- legal production facilities;
- legal monsters and their reviewed drops;
- accessible shop stock and currencies;
- spawns and gatherable resources;
- activities and rewards;
- NPC services;
- transport capabilities; and
- the exact witness from the run snapshot to the capability.

The index is computed once per run-revision, rules-version, and content-hash
tuple. Goal queries consume the same immutable index.

## Recursive Obtainability

RuneProof evaluates obtainability to a least fixed point:

1. Build exact reachable locations.
2. Activate direct sources in those locations.
3. Add direct deterministic and random outputs.
4. Activate production actions whose facilities, unlocks, skills, quests, and
   inputs are obtainable.
5. Add their outputs while retaining complete derivations.
6. Repeat until no new capability or item route appears.
7. Evaluate the selected goal against the completed capability graph.

A repeatable source can satisfy any finite quantity requirement, subject to its
inputs. A limited source contributes only its proven remaining or claimable
yield. When the engine cannot prove whether a one-time source remains
claimable, that route is `UNKNOWN`.

Random acquisition proves only that a legal source has non-zero probability.
The proof report carries the rate and labels the route as RNG-dependent.

Cycles are evaluated using strongly connected components and action support.
A component that has no externally supported seed item or capability produces
nothing. Therefore `A requires B` and `B requires A` cannot prove either item.

## Route Enumeration and Ranking

RuneProof preserves every non-dominated valid acquisition witness. Equivalent
routes may be grouped for display, but their source and chunk identities remain
inspectable.

The preferred route uses this stable lexicographic order:

1. deterministic acquisition before random acquisition;
2. fewer unmet or intermediate prerequisites;
3. fewer recursive ingredient dependencies;
4. shorter route through the reachable location graph;
5. higher known probability among otherwise equal random routes; and
6. stable source ID as the final tie-breaker.

This ranking is deliberately explainable. It does not claim to optimise real
play time, attention, combat risk, or expected future Fate unlocks.

## Selective Solving

Most RuneProof queries use graph traversal, fixed-point evaluation,
topological ordering, strongly connected components, and stable route ranking.

Selective solving is reserved for:

- SAT-style feasibility across interacting alternatives;
- pseudo-Boolean quantity and threshold constraints;
- inclusion-minimal and minimum-cardinality blocker queries;
- weighted relaxation only when the weights are explicit domain facts;
- counterfactual queries that test whether a prerequisite is unavoidable; and
- shortest legal paths through the exact location graph.

Binary decision diagrams and general state-transition planners are not required
for the initial release. Solver choice is an internal detail behind the
canonical requirement and proof interfaces.

## Proof Reports

Every report contains:

- goal identity and result status;
- run ID, run revision, mode, rules version, and content hash;
- preferred route;
- all alternative valid route families;
- exact chunks and child sections used;
- recursive item and facility dependencies;
- deterministic or random classification and known rates;
- rejected route families and their blockers;
- unavoidable blockers when they exist;
- coverage warnings and unresolved evidence;
- stable requirement, source, action, and location IDs; and
- enough information for a small independent verifier to replay the witness.

In the initial release, "proof" means a deterministic domain witness or blocker
derivation replayable against the same canonical data. Emitting a general SAT
proof format for formal theorem checking is not required.

## App Experience

RuneProof replaces the current Goal Planner surface. The player selects a
quest, diary, activity, or item and sees:

1. a clear status and freshness indicator;
2. the preferred route and why it ranked first;
3. exact chunks, child sections, and connection path;
4. recursive inputs and facilities;
5. deterministic or RNG-dependent acquisition labels;
6. alternative valid routes;
7. route-specific blockers;
8. blockers shared by every route; and
9. source evidence and coverage warnings.

The UI uses player language rather than solver terminology. Advanced proof
details remain available in a disclosure panel.

RuneProof does not display a "recommended Fate unlock" or "best Key table."
When blocked, it reports only what the current route families require.

## RuneLite Integration

The app remains the sole solver and proof author. A versioned RuneLite bundle
may include:

- pinned RuneProof goal summaries;
- proof status and freshness metadata;
- compact preferred-route steps;
- blocker summaries; and
- proof identifiers bound to the run revision and content version.

The plugin displays the compact status and can open the full app result. It
marks a result stale when the imported run revision, rules version, or content
version differs. It does not solve, infer possession, recommend unlocks, or
perform gameplay.

## Error Handling and Trust

RuneProof fails conservatively:

- missing relevant source coverage produces `UNKNOWN`;
- stale run or content versions produce a stale result, not a reused proof;
- malformed requirements identify the exact record and path;
- unsupported cycles identify the component and actions involved;
- solver time or resource limits return a partial `UNKNOWN` result;
- contradictory source facts identify their evidence records;
- unauthored chunks and sections contribute no implicit content; and
- unknown transport or entry requirements never silently pass.

Every source category has reviewed coverage metadata. An impossibility result
is legal only when all source families capable of satisfying the failed
requirements have verified coverage.

## Performance

RuneProof:

- builds the reachable graph and capability index once per versioned snapshot;
- caches immutable results by run revision, rules version, and content hash;
- memoizes item and requirement evaluations;
- performs expensive enumeration or solving away from the UI thread;
- groups equivalent display routes without discarding proof identities; and
- applies deterministic search bounds that convert overflow into `UNKNOWN`.

## Testing Strategy

### Reachability

Tests cover:

- owned and reachable chunks;
- owned but stranded chunks;
- locked chunks;
- directed connections;
- quest-gated entries;
- mobility and shortcut requirements;
- dungeon and instance child sections; and
- unknown connection data.

### Sources and actions

Tests cover:

- every supported source type;
- exact source-to-location anchoring;
- shop stock and currencies;
- monster drops and rates;
- floor and object spawns;
- gathering and production facilities;
- recursive inputs and quantities;
- repeatable, limited, and one-time sources;
- deterministic and random outputs; and
- unresolved source coverage.

### Reasoning

Tests cover:

- fixed-point closure;
- alternative route enumeration;
- unsupported dependency cycles;
- externally seeded cycles;
- deterministic route ranking;
- minimum and unavoidable blockers;
- `BLOCKED`, `IMPOSSIBLE`, and `UNKNOWN` boundaries;
- proof replay; and
- stable results across repeated evaluation.

### Cross-surface parity

Shared fixtures prove that the Goal Planner replacement, quest and diary
eligibility, item/resource surfaces, chunk panels, app completion guards, and
RuneLite summaries consume compatible canonical results.

### Required end-to-end fixtures

The suite includes:

- a Plank requirement where shop and production routes fail but a reachable
  floor or drop source proves obtainability;
- a source in an unlocked but stranded chunk that must not prove an item;
- a dungeon source that activates only through its reachable, legal entrance;
- a recursive production chain with exact quantities;
- an item supported only by an RNG route;
- an apparent recipe cycle with no seed that must remain unobtainable;
- route families with a shared missing unlock;
- route families with no shared blocker;
- incomplete drop coverage that must return `UNKNOWN`; and
- a stale proof rejected after the run revision changes.

### Properties

Property tests establish that:

- adding a valid unlock cannot remove an existing obtainable route;
- every witness uses reachable locations and satisfied prerequisites;
- every rejected route contains an explicit failed requirement;
- no unsupported cycle creates an item from nothing;
- every deterministic preferred route outranks an otherwise equal random route;
- proof replay reaches the reported goal; and
- identical snapshots produce byte-identical proof reports.

## Delivery Phases

### Phase 1: Foundation

- Canonical RuneProof facts, locations, sources, actions, and requirements.
- Exact reachable-location graph.
- Chunk capability index.
- Item obtainability and recursive production.
- Conservative coverage and `UNKNOWN` handling.
- One end-to-end complex quest/item vertical slice.

### Phase 2: Complete app experience

- Quest, diary, activity, and item compilation.
- Route alternatives, blockers, unavoidable requirements, and stable ranking.
- Proof reports and app UI.
- Migration of overlapping Goal Planner and Resource Engine reasoning to the
  canonical result.

### Phase 3: RuneLite presentation

- Versioned proof summaries in the app-authored bundle.
- Pinned goal and blocker presentation.
- Freshness and stale-result handling.
- Cross-language replay fixtures for the compact verifier.

## Acceptance Criteria

RuneProof is ready when:

- the same exact chunk graph drives reachability, source activation, and proof
  reports;
- every supported source is anchored to verified exact locations;
- every positive result has a replayable witness;
- every blocked route exposes at least one explicit failed requirement;
- missing relevant coverage prevents `IMPOSSIBLE`;
- deterministic-first ranking is stable and alternatives remain inspectable;
- the Plank fixture selects a reachable drop or spawn after shop and production
  routes are rejected;
- no possession data or future Fate unlock recommendation enters the result;
- existing planner consumers migrate to canonical RuneProof output;
- RuneLite shows only app-authored, version-matched summaries; and
- focused, property, integration, and full release verification pass.
