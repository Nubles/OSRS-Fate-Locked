# Chunked v2 Frontier Graph and Liveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace optimistic orthogonal/connect reachability with a versioned, evidence-backed Path/Passage/Voyage graph and an executable proof that every one of the 623 paid targets has a finite, non-circular route from `50,50`.

**Architecture:** Checked-in JSON manifests are the auditable graph source and are readable by both TypeScript and a dependency-light Node verifier. Travel nodes are `(chunk, plane, walkable-zone)` rather than whole chunks, preventing an ingress in one sealed pocket from activating an unrelated egress. Each paid target has one ranked proof arrival arc in a rooted directed arborescence. Runtime code derives active zones, active versus dormant ownership, destination-deduplicated frontier candidates, and blocked Fated Crossings from closed-world requirements. The graph module is dynamically imported only after exact Chunked v2 activation, then installed through Plan 1's lightweight runtime boundary.

**Tech Stack:** TypeScript 5, Vitest 4, Node `.mjs` verification, Vite dynamic imports, pinned source-chunk data, pinned OSRS cache collision evidence, permanent OSRS Wiki/Jagex evidence URLs.

**Spec:** `docs/superpowers/specs/2026-08-22-chunked-v2-fated-frontier-design.md`

**Execution status:** **BLOCKED ON ROUTE EVIDENCE.** Task 0 is a mandatory acquisition/owner-review checkpoint. No manifest-generation or runtime task may begin until its exit artifacts are pinned. Plans 3 and 4 inherit this blocker.

## Global Constraints

- Do not reuse `utils/chunkAdjacency.ts` as physical Path proof. Orthogonal coordinates can touch across water or barriers.
- Do not treat `public/chunk-content.json.connect` as authority. It is a candidate index only and currently reaches 558 of 624 authored coordinates.
- Do not use `utils/chunkLocations.ts:chunkUnlocked`; its named-area foothold semantics can activate unrelated chunks.
- `CHUNKED_TARGETS` is exactly the 624 unique `REGION_CHUNKS` coordinates minus `50,50`, sorted numerically by `(cy, cx)` to reuse the comparator pinned by `data/regionChunks.test.ts`. The paid count is 623.
- Every released target has exactly one proof arrival node, and every non-root proof node has exactly one proof-parent edge. Parent **node** rank is lower than child node rank; root rank is zero; all target ranks are unique. An owned parent coordinate is insufficient: the edge's `fromNodeId` must itself have a lower-ranked activation chain from the root.
- `PATH` requires a pinned zone-to-zone witness, including the reachable ingress-to-egress path inside each chunk; one open border tile is insufficient. `PASSAGE` and `VOYAGE` require explicit directed arcs, requirements, and separately evidenced return arcs.
- Requirement evaluation is closed-world. Unknown kinds, missing evidence, missing runtime facts, unsupported versions, temporary consumables without a source-side reacquisition certificate, and optimistic inference all evaluate false.
- A `SKILL_LEVEL` fact requires both the raw recorded level and the unlocked method tier required for that level; a reported level of 99 with tier 1 cannot satisfy a high-level route.
- Quest completion cannot gate the transport used to complete that same quest. Represent a verified earlier route stage as an explicit `ROUTE_PERMIT` with a source-side certificate.
- Sailing destination/challenge data alone does not prove an origin, navigable corridor, direction, or return route. A Voyage is not verified until those facts have authoritative evidence.
- If any one of the 623 targets cannot be certified, stop before runtime integration and report the exact target/certificate failure. Never silently exclude it or downgrade the proof.

## Known Execution Blockers at Plan Approval

- `BLOCKED_ZONE_TOPOLOGY`: the repository has no pinned plane/object/collision-derived walkable-zone artifact. Task 1 must select and pin the exact cache provider/revision/hash, XTEAs and object definitions, bridge/plane rules, and directional movement-mask semantics before a Path can be verified.
- `BLOCKED_INTERNAL_GATEWAYS`: Karamja/Kharazi, Paterdomus/Morytania, Tirannwn/Underground Pass, Entrana, Crandor, Isle of Souls, Lithkren, Pandemonium, and every other same-coordinate-component barrier require exact directed endpoints and certificates; the coordinate-component census is not an accepted manifest.
- `BLOCKED_DOCK_ONLY`: all 31 proposed Sailing first-entry arcs—30 dock destination/groups plus Rock Island Prison—currently have destination challenge evidence but not complete origin/corridor/direction/return proof. They cannot enter `routes.v1.json` with release status.
- `BLOCKED_FARES`: every fare or consumable route, including Jarvald/Waterbirth and Dragontooth, needs a permanent waiver or verified source-side reacquisition certificate.

Execution stops in Task 0 until every blocker is resolved. This is a release-data gate, not a permission to ship a smaller target manifest.

## File Structure

### Auditable graph sources

- `data/fatedFrontier/targets.v1.json` — root, source pin, and 623 sorted paid targets.
- `data/fatedFrontier/evidence.v1.json` — permanent evidence records with source kind, revision, URL, and checked claim.
- `data/fatedFrontier/routes.v1.json` — directed Path/Passage/Voyage edges and requirement expressions.
- `data/fatedFrontier/certificates.v1.json` — source-side prerequisite acquisition DAG.
- `data/fatedFrontier/proof.v1.json` — node rank/proof-parent edge for the entire proof subgraph plus an arrival-node mapping for every paid target.
- `data/sources/chunk-zone-connectivity-v1.json.gz` — generated plane/zone/intra-chunk/border evidence from a fully pinned OSRS cache/collision revision; never hand-edited.
- `docs/research/chunked-v2-route-certificates.md` — human-review ledger for every directed discrete route and exceptional zone transition.

### Pure runtime and verification

- `utils/fatedFrontier/graphModel.ts` — branded IDs and parsed manifest types.
- `utils/fatedFrontier/model.ts` — shared state types created by Plan 1 and extended with route facts.
- `utils/fatedFrontier/manifest.ts` and `.test.ts` — strict parse/load and target-source drift checks.
- `utils/fatedFrontier/requirements.ts` and `.test.ts` — closed-world requirement evaluation.
- `utils/fatedFrontier/certificates.ts` and `.test.ts` — prerequisite DAG and source-side attainability.
- `utils/fatedFrontier/graph.ts` and `.test.ts` — fixed-point active ownership, dormant ownership, frontier, and Crossing selection.
- `utils/fatedFrontier/authorization.ts` and `.test.ts` — single state-boundary chunk decision.
- `utils/fatedFrontier/graphRuntime.ts` and `.test.ts` — concrete immutable runtime assembled from verified manifests.
- `utils/fatedFrontier/loadRuntime.ts` and `.test.ts` — dynamic graph module installation.
- `utils/fatedFrontier/liveness.property.test.ts` — arbitrary legal order/state invariants.
- `scripts/verify-chunked-frontier.mjs` and `.test.ts` — dependency-light release proof.
- `scripts/build-chunk-zone-connectivity.mjs` and `.test.ts` — reproducible zone/collision extract builder/checker.
- `package.json` — extend `chunked:verify` and `content:verify`.

---

### Task 0: Acquire and owner-approve the missing route evidence

**Files:**
- Create: `docs/research/chunked-v2-evidence-inputs.md`
- Create: `data/sources/chunk-zone-connectivity-v1.source.json`
- Create: `docs/research/chunked-v2-route-certificates.md`

**Interfaces:**
- Produces the immutable input contract consumed by Task 1; it produces no gameplay code or provisional released route.
- Exit requires repository-owner approval recorded by commit/review reference.

- [ ] **Step 1: Select the topology source and legal acquisition path**

Record the exact cache/collision provider, license, immutable revision/hash, local input layout, and a reproducible acquisition command that does not rely on a mutable “latest” endpoint. Pin the XTEA source/revision, object-definition source/revision, collision flags, bridge/plane transforms, and directional movement-mask semantics. Record an offline fixture acquisition command for CI. If licensing does not permit the necessary checked-in derivative, stop and obtain an owner decision before selecting another provider.

- [ ] **Step 2: Resolve every known route blocker as evidence, not prose**

Produce candidate certificates for every `BLOCKED_INTERNAL_GATEWAYS` transition, every fare/consumable route, and all 31 `BLOCKED_DOCK_ONLY` first-entry Sailing arcs. Each Sailing record must name origin node, corridor or game transport, direction, separately proven return, first-entry rules, requirements, and permanent evidence. A destination Dock challenge is not sufficient.

- [ ] **Step 3: Obtain owner review of the input contract**

The reviewer confirms the provider/license/pins, acquisition command, topology interpretation, exceptional gateway set, fare policy, and all Sailing first-entry evidence. Record accepted evidence IDs and unresolved objections. Any unresolved row keeps this plan `BLOCKED ON ROUTE EVIDENCE`.

- [ ] **Step 4: Commit only the approved input contract**

```bash
git add docs/research/chunked-v2-evidence-inputs.md data/sources/chunk-zone-connectivity-v1.source.json docs/research/chunked-v2-route-certificates.md
git commit -m "docs: pin Chunked route evidence inputs" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

Do not check this task complete unless all four named blocker classes have zero unresolved records. Task 1 starts only from this committed checkpoint.

---

### Task 1: Certify the complete target and route source before gameplay code

**Files:**
- Create: `data/fatedFrontier/targets.v1.json`
- Create: `data/fatedFrontier/evidence.v1.json`
- Create: `data/fatedFrontier/routes.v1.json`
- Create: `data/fatedFrontier/certificates.v1.json`
- Create: `data/fatedFrontier/proof.v1.json`
- Modify: `docs/research/chunked-v2-route-certificates.md`
- Create: `scripts/build-chunk-zone-connectivity.mjs`
- Create: `scripts/build-chunk-zone-connectivity.test.ts`
- Create: `scripts/verify-chunked-frontier.mjs`
- Generate: `data/sources/chunk-zone-connectivity-v1.json.gz`
- Read: `data/regionChunks.ts`
- Read: `data/sources/chunkpicker-chunkinfo-export.json.gz`
- Read: `data/sources/chunk-content-transform-audit.json`
- Read: `public/chunk-content.json`

**Interfaces:**
- Produces complete immutable v1 source data for all later graph code.
- Every evidence reference resolves to a pinned repository commit, a permanent OSRS Wiki revision URL containing `oldid=`, or a permanent Jagex URL plus captured publication date.
- The proof source contains no `UNKNOWN`, `CANDIDATE`, `OPTIMISTIC`, or `UNVERIFIED` status.

- [ ] **Step 1: Write the target manifest from the canonical source**

Create a stable JSON object with this shape:

```json
{
  "version": 1,
  "source": {
    "file": "data/regionChunks.ts",
    "commit": "a694c16b6fccbbf394e09385eef1a14dcd176e58",
    "chunkPickerCommit": "a9a5c74760eb76dbe39f90d2b04f023fc1de3746",
    "chunkPickerRawSha256": "2D75BF70C9E6540CECC1631783A0293D8F28B440D429F6081B2CD4EE4C21CA59"
  },
  "root": "50,50",
  "paidTargets": ["39,34", "40,34", "52,34"]
}
```

The shown coordinates are the first examples after numeric sorting, not a shortened accepted manifest. The committed array must contain all 623 values. Produce it mechanically from `REGION_CHUNKS`, then review the diff; do not type 623 coordinates manually.

- [ ] **Step 2: Build pinned walkable-zone and end-to-end Path evidence**

First record the exact cache/collision provider, revision/hash, XTEAs, object definitions, plane/bridge transforms, and directional movement-mask interpretation in the generated artifact metadata. Build walkable connected components per plane after applying those rules. A Path arc is verified only when its source zone contains the already-proven ingress and has an explicit tile path to the boundary egress, the directional border step is valid, and the destination tile belongs to the recorded destination zone. Record the compressed tile-path witness and both zone IDs. The checker rejects a changed source hash, an unexplained bridge/plane transition, or an arc lacking an ingress-to-egress witness.

Run: `npx vitest run scripts/build-chunk-zone-connectivity.test.ts`

Expected initially: FAIL until the extractor and fixture are present; then PASS and reproduce the same gzip contents/hash twice.

- [ ] **Step 3: Create the human route-certificate ledger**

The ledger has one row per directed Passage/Voyage and every manually reviewed exceptional Path/zone transition, with columns: arc ID, source node, destination node, OSRS action, requirement expression, source-side acquisition, separately identified reverse arc, evidence IDs, reviewer, and verdict. Candidate `connect` entries may seed research but cannot be copied as verdicts. The final ledger is exhaustive; the table below is a known-route research seed and is not accepted as the complete conventional manifest.

The currently known conventional Passage seed rows are these exact entries:

| From | To | Passage | Required permanent fact |
|---|---|---|---|
| `47,50` Port Sarim | `28,57` Port Piscarilius | Veos ship | none |
| `52,53` Digsite | `58,59` Museum Camp | Digsite barge | Bone Voyage step 10 or completion |
| `57,54` Port Phasmatys | `57,46` Mos Le'Harmless | Bill Teach | Cabin Fever step 2 or completion |
| `40,57` Rellekka | `39,58` Waterbirth | Jarvald | verified fare reacquisition or permanent waiver |
| `41,57` Rellekka | `40,60` Miscellania | Rellekka sailor | Fremennik Trials complete |
| `40,57` Rellekka source | `34,59` Pirates' Cove | Lokar Searunner | Lunar Diplomacy step 2 or completion |
| `34,59` Pirates' Cove | `33,60` Lunar Isle | Lady Zay/Captain Bentley | Lunar Diplomacy step 5 or completion |
| `38,54` Grand Tree | `45,42` Crash Island | Daero/glider/boat chain | Monkey Madness I step 4 or completion |
| `45,42` Crash Island | `43,42` Ape Atoll | Waydar boat | Monkey Madness I step 5 or completion |
| `47,50` Port Sarim | `41,41` Void Outpost | Squire ship | none |
| `42,58` Rellekka-area source | `41,62` Iceberg | Larry boat | Cold War step 2 or completion |
| `41,57` Rellekka | `38,62` Island of Stone | Mord Gunnars | Fremennik Exiles step 7 or completion |
| `41,57` Rellekka | `35,63` Ungael | Torfinn | Dragon Slayer II step 17c1 or completion |
| `57,46` Mos Le'Harmless | `59,44` Harmony | Bill Teach | Great Brain Robbery step 1 or completion |
| `57,54` Port Phasmatys | `59,55` Dragontooth | Ghost captain | Ghosts Ahoy step 8/completion plus a source-side ecto-token reacquisition or permanent-fare certificate |
| `47,46` Pandemonium | `32,42` Shipyard | Shipyard portal | Pandemonium step 4 or completion |

Also certify internal false-Path islands that an orthogonal/optimistic graph can hide: Port Sarim to Pandemonium after Pandemonium step 1; Fossil-side rowboat to Lithkren after Dragon Slayer II step 9; Dragon Slayer I step 6 to Crandor `44,50`; East Ferox portal to the Isle of Souls/Soul Wars block; Port Sarim monks to Entrana `44,52`; and the Karamja/Kharazi, Morytania, Tirannwn/Underground Pass border gateways. A quest-complete substitute is rejected wherever it would create a route cycle.

Key honour-confirmed route permits to encode use the pinned source's stable raw challenge IDs, including `~|Bone Voyage|~ 10`, `~|Cabin Fever|~ 2`, `~|Lunar Diplomacy|~ 2`, `~|Lunar Diplomacy|~ 5`, Monkey Madness I steps 4/5, Cold War step 2, The Fremennik Exiles step 7, Dragon Slayer II steps 9/17c1, The Great Brain Robbery step 1, Ghosts Ahoy step 8, Pandemonium steps 1/4, and Dragon Slayer I step 6. Each permit records explicit player confirmation of the preceding objective; the machine verifies source-side feasibility and accepts full quest completion as the permanent alternate.

- [ ] **Step 4: Certify Sailing Voyages as a separate release gate**

The pinned chunk-picker source provides destination Dock challenges for most Sailing destinations, but not origin/corridor/direction/return proof. For every Voyage, add authoritative evidence for those missing facts and encode its permanent capability requirement. The required initial destination/component review set is:

```text
Great Conch/Summer Shore: 48,37 48,38 48,39 49,36 49,37 49,38 49,39 50,36 50,37 50,38 50,39 51,36 51,37 51,38
Laguna Aurorae: 17,43 18,42 18,43 19,43
Wyrmscraig/Auchrie: 39,34 39,35 40,34 40,35
Singleton destinations: 24,43 27,41 29,46 29,51 30,43 30,63 32,40 32,57 33,55 34,36 36,35 38,42 39,39 41,37 43,39 44,36 45,63 46,35 46,40 47,41 52,34
Coordinate-touching but route-typed islands: 29,53 30,48 32,49 34,54 36,43 47,46
Unproven source exception: 45,44 Rock Island Prison
```

The initial hazard capabilities are permanent tracker certificates for having proved/build-unlocked the capability, not assertions that a consumable ship part currently exists:

| Capability | Source requirements encoded in certificate DAG |
|---|---|
| `stormy-seas` | Construction 11, Sailing 24, oak mast, linen sails, reachable source materials |
| `fetid-seas` | Construction 37, Sailing 40, large boat, teak, steel nails, Relicym's balm route |
| `crystal-seas` | Construction 62, Sailing 66, Smithing 74, Pandemonium permit, adamant/lead source |
| `tangled-seas` | Construction 59, Sailing 72, camphor/adamant source |
| `icy-seas` | Construction 72, Sailing 78, Buccaneers' Haven rank before the schematic-dependent destinations |

Store permanent `voyageCapabilities` separately from one honour-based `activeVoyageLoadout`. A capability certificate proves the fitting can be reacquired from the active/source side; the loadout attestation proves one current vessel simultaneously carries the compatible required fittings. Attesting a different vessel/loadout atomically replaces the previous record, so fittings from mutually exclusive ships or slots can never be unioned. If the fitting is absent, the route is a Crossing with the reacquisition certificate, not a live frontier edge. Provide guarded attest/clear actions in Plan 3.

Use [Jagex Sailing Poll 1](https://secure.runescape.com/m=news/sailing-poll-1-area-expansion-quests--hybrid-training-method?oldschool=1) in the evidence ledger: it documents quest-locked Great Conch, hazards that can make seas impassable, and alternate dock access only after first sailing there. If `45,44` or any Voyage lacks authoritative first-entry proof, stop this plan with a named blocker. Do not omit the target, create a generic teleport, or mark the route verified from Dock challenge data alone.

- [ ] **Step 5: Build a node-activation proof with one arrival for all 623 targets**

Use verified Paths and certified Passages/Voyages to generate a rooted directed arborescence over every travel-zone node used by the release proof. Commit a unique `nodeRank` and `proofParentEdgeId` for each non-root proof node, plus one `arrivalNodeId` and `targetRank` for every paid chunk. For every arrival, the parent edge's `fromNodeId` must itself follow lower-ranked proof-parent node edges to `50,50#lumbridge-surface`; owning or activating a different zone in the same coordinate never satisfies this rule. A target reached through a requirement-bearing arc also references one prerequisite certificate whose dependencies have lower acquisition ranks and do not require the destination zone/component.

Add a synthetic rejection fixture in which parent chunk zone A is active but the child proof edge originates in sealed zone B. The proof verifier and runtime frontier must both reject that child until a separately proven Passage activates zone B.

- [ ] **Step 6: Validate that every machine record has the only allowed release status**

Run:

```bash
node scripts/verify-chunked-frontier.mjs --status-only
```

Implement the script's `--status-only` mode here with dependency-free JSON parsing. Expected: `623 targets; every referenced edge/certificate/evidence record is VERIFIED`. Explanatory research prose is not used as a machine gate. If the verifier finds another status or a missing record, stop before Task 2.

- [ ] **Step 7: Commit the evidence source**

```bash
git add data/fatedFrontier data/sources/chunk-zone-connectivity-v1.json.gz docs/research/chunked-v2-route-certificates.md scripts/build-chunk-zone-connectivity.mjs scripts/build-chunk-zone-connectivity.test.ts scripts/verify-chunked-frontier.mjs
git commit -m "data: certify the Chunked v2 frontier graph" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 2: Parse strict graph data and evaluate requirements closed-world

**Files:**
- Create: `utils/fatedFrontier/graphModel.ts`
- Create: `utils/fatedFrontier/manifest.ts`
- Create: `utils/fatedFrontier/manifest.test.ts`
- Create: `utils/fatedFrontier/requirements.ts`
- Create: `utils/fatedFrontier/requirements.test.ts`
- Create: `utils/fatedFrontier/certificates.ts`
- Create: `utils/fatedFrontier/certificates.test.ts`
- Modify: `utils/fatedFrontier/model.ts`

**Interfaces:**
- Consumes the four v1 JSON manifests and a `ChunkedRequirementFacts` snapshot.
- Produces a frozen `FatedFrontierGraph`, `evaluateRequirement()`, `verifyCertificateDag()`, and stable error codes.

- [ ] **Step 1: Write failing schema and closed-world tests**

Cover malformed coordinates, root in paid targets, missing/duplicate targets, duplicate arc IDs, missing evidence, unsupported kinds/version, self-arc, forbidden bidirectional shorthand, missing reverse-route evidence, unknown requirement, temporary item-only requirement, unknown route-permit ID, and a cyclic certificate DAG. Assert an unknown fact is false rather than optimistic.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/manifest.test.ts utils/fatedFrontier/requirements.test.ts utils/fatedFrontier/certificates.test.ts`

Expected: FAIL because the parsers do not exist.

- [ ] **Step 3: Implement branded graph contracts**

```ts
export type EdgeKind = 'PATH' | 'PASSAGE' | 'VOYAGE';

export type ChunkedRequirement =
  | { kind: 'TRUE' }
  | { kind: 'QUEST_COMPLETE'; questId: string }
  | { kind: 'ROUTE_PERMIT'; permitId: string }
  | { kind: 'SKILL_LEVEL'; skill: string; level: number }
  | { kind: 'CONTENT_UNLOCK'; table: TableType; item: string }
  | { kind: 'VOYAGE_CAPABILITY'; capabilityId: string }
  | { kind: 'VOYAGE_FITTING'; capabilityId: string }
  | { kind: 'ALL'; requirements: ChunkedRequirement[] }
  | { kind: 'ANY'; requirements: ChunkedRequirement[] };

export interface FatedFrontierEdge {
  id: string;
  kind: EdgeKind;
  fromNodeId: string;
  toNodeId: string;
  requirements: ChunkedRequirement;
  evidenceIds: string[];
  componentEntry: boolean;
  certificateId: string | null;
}

export interface FatedFrontierNode {
  id: string;
  chunk: ChunkKey;
  plane: number;
  zoneId: string;
}
```

All arcs are immutable and directed. A reversible route is two explicit arcs, each with its own requirements/evidence; the parser rejects a bidirectional shorthand. Same-chunk stairs, doors, portals, and other movement between disconnected zones are ordinary non-rollable `PASSAGE` arcs because their destination chunk is already owned. `TRUE` is the only unconditional requirement; null, omission, and an empty composite are rejected. Parse JSON without unchecked casts. Freeze sorted arrays so UI order, seeded selection, and proofs are stable.

- [ ] **Step 4: Implement closed-world fact evaluation and DAG validation**

`ROUTE_PERMIT` uses a manifest permit ID and reads `state.chunkedV2.routePermits`; quest completion is an explicit alternate encoded in that permit's certificate rather than raw step-number interpretation. A pre-completion permit contains an honour-based `ROUTE_STAGE_ATTESTATION` record with stable permit ID, quest ID, preceding pinned task/challenge key, source-side prerequisites, and confirmation copy. Plan 3's guarded confirmation click is the fact input path. `VOYAGE_CAPABILITY` reads permanent `voyageCapabilities`; `VOYAGE_FITTING` verifies that one current `activeVoyageLoadout` contains a compatible vessel class and all jointly required fittings. Independent attestations from different vessels may never be unioned. Skill checks require both `unlocks.levels[skill] >= level` and `unlocks.skills[skill] >= tierForLevel(level)`. Every certificate acquisition step references only an active/source-side zone or an earlier-ranked certificate. Reject destination/self/later-component dependencies.

- [ ] **Step 5: Run tests to verify pass**

Run the command from Step 2; expect PASS.

- [ ] **Step 6: Commit**

```bash
git add utils/fatedFrontier/graphModel.ts utils/fatedFrontier/manifest.ts utils/fatedFrontier/manifest.test.ts utils/fatedFrontier/requirements.ts utils/fatedFrontier/requirements.test.ts utils/fatedFrontier/certificates.ts utils/fatedFrontier/certificates.test.ts utils/fatedFrontier/model.ts
git commit -m "feat: parse certified Fated Frontier routes" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 3: Derive active ownership, dormant legacy anchors, frontier, and Crossings

**Files:**
- Create: `utils/fatedFrontier/graph.ts`
- Create: `utils/fatedFrontier/graph.test.ts`
- Create: `utils/fatedFrontier/authorization.ts`
- Create: `utils/fatedFrontier/authorization.test.ts`
- Modify: `utils/fatedFrontier/runtime.ts`

**Interfaces:**
- Produces `deriveReachabilitySnapshot()`, `getFatedFrontier()`, `selectFatedCrossing()`, and `canUnlockChunk()`.
- `canUnlockChunk()` is the only reducer authorization entry used by Plan 3.

- [ ] **Step 1: Write failing synthetic graph tests**

Use small graphs to cover one-way edges, bidirectional edges, blocked requirements, stable sorting, two live edges to one destination producing one frontier ticket, a disconnected owned legacy destination, activation after its parent route is owned, completion, an internal conditional proof edge, and route-data-error. Pin that a dormant owned node cannot activate its children. Include the sealed-parent-zone case: zone A active in an owned chunk, proof child edge sourced from inactive zone B, child absent from frontier until a certified A→B Passage activates B.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/graph.test.ts utils/fatedFrontier/authorization.test.ts`

Expected: FAIL because derivation does not exist.

- [ ] **Step 3: Implement fixed-point active ownership**

```ts
export interface ReachabilitySnapshot {
  activeNodeIds: ReadonlySet<string>;
  activeChunks: ReadonlySet<ChunkKey>;
  dormantChunks: ReadonlySet<ChunkKey>;
  traversedEdgeIds: readonly string[];
  blockedEdges: readonly BlockedFrontierEdge[];
}
```

Initialize active nodes with the certified Lumbridge Home/root arrival zone, not every zone in `50,50`. Repeatedly traverse satisfied directed arcs whose source node is active and whose destination chunk is already owned/implicit; same-chunk Passage arcs activate separately proven zones. Stop at a fixed point. `activeChunks` contains chunks with at least one active node; every remaining valid owned target is dormant. Never add a zone or chunk merely because the chunk is stored.

- [ ] **Step 4: Implement frontier and Crossing selection**

The live frontier is each distinct unowned destination reached by one or more satisfied edges from an active source, deduplicated by destination before sorting by proof rank then coordinate. Multiple proven routes never give a chunk multiple tickets. To select a Crossing, take the lowest-ranked unowned target's arrival node and trace its **node** proof-parent chain backward until the first edge leaves `activeNodeIds`; return that edge's unmet source-side-attainable certificate. Do not skip the edge merely because its source coordinate is owned or another zone in that coordinate is active. Every requirement-bearing proof edge is Crossing-eligible; `componentEntry` is display/audit metadata, not the selection predicate. If targets remain and neither exists, return `route-data-error` with stable diagnostics rather than completion.

- [ ] **Step 5: Implement one authorization result**

```ts
export type ChunkUnlockDecision =
  | { ok: true; chunk: ChunkKey; edgeId: string; kind: EdgeKind }
  | { ok: false; code: 'wrong-mode' | 'stale-revision' | 'runtime-missing' | 'not-target' | 'owned' | 'dormant-source' | 'requirements-unmet' | 'not-frontier' };
```

The decision checks exact mode/envelope/runtime version, canonical target membership, duplicate ownership, live frontier membership, and source-specific authorization. It does not deduct currency.

- [ ] **Step 6: Run tests to verify pass**

Run the command from Step 2; expect PASS.

- [ ] **Step 7: Commit**

```bash
git add utils/fatedFrontier/graph.ts utils/fatedFrontier/graph.test.ts utils/fatedFrontier/authorization.ts utils/fatedFrontier/authorization.test.ts utils/fatedFrontier/runtime.ts
git commit -m "feat: derive the proven Fated Frontier" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 4: Install the graph lazily only for exact Chunked v2

**Files:**
- Create: `utils/fatedFrontier/graphRuntime.ts`
- Create: `utils/fatedFrontier/graphRuntime.test.ts`
- Create: `utils/fatedFrontier/loadRuntime.ts`
- Create: `utils/fatedFrontier/loadRuntime.test.ts`
- Modify: `context/GameContext.tsx:1373-1416,1533-1591`
- Modify: `context/GameContext.test.tsx`
- Modify: `vite.config.ts` if an explicit Chunked graph chunk name is needed

**Interfaces:**
- Produces `loadFatedFrontierRuntime(): Promise<FatedFrontierRuntime>`.
- `GameProvider` calls the loader only after state is loaded and exact `gameModeId === 'chunked' && chunkedV2.schemaVersion === 1` is true.

- [ ] **Step 1: Write failing import-boundary tests**

Mock the loader and assert fresh Vanilla, progressed Vanilla, custom, and rejected unknown modes never call it. Assert current Chunked calls it once, installs only a matching graph version, exposes loading/error status, derives/persists the current Crossing after a legacy migration when no live frontier exists, and does not permit a graph-dependent spend before installation. Separately prove Unbroken completion remains available during loading and route-data-error. Cover a delayed load followed by Chunked → Vanilla, Chunked profile A → profile B, run reset, rejection followed by retry, and a revision change before resolution; no stale promise may install a runtime or dispatch a refresh into the new state.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/loadRuntime.test.ts context/GameContext.test.tsx utils/vanillaIsolation.test.ts`

Expected: FAIL because dynamic installation is absent.

- [ ] **Step 3: Implement the dynamic boundary**

Create `graphRuntime.ts` as the only module that statically imports/parses the verified manifests and composes `deriveReachabilitySnapshot`, authorization, Trial-candidate access, and route-state derivation into an immutable `FatedFrontierRuntime`. Test version mismatch and deep immutability. Then use a literal dynamic import from the exact-mode effect:

```ts
const loadFatedFrontierRuntime = async () => {
  const module = await import('./graphRuntime');
  return module.createFatedFrontierRuntime();
};
```

Do not trigger the promise at module initialization. Plan 1's lightweight registry has no static graph-data import and provides synchronous reducer commit-time authorization only after installation; UI-prevalidated payloads are insufficient. Reject graph-dependent spends until exact-mode async installation completes. Give every load effect an incrementing generation token plus cleanup cancellation flag. Immediately before registry installation and again before refresh dispatch, re-read the current profile, exact mode, `runId`, `runRevision`, envelope/graph version, and generation; a mismatch drops the resolved module without side effects. Clear the installed runtime and invalidate the generation when switching profiles, changing/resetting runs, leaving exact mode, or retrying after failure.

After a matching, still-current install, dispatch one expected-run-ID/revision `CHUNKED_REFRESH_ROUTE_STATE` command. Migration/import has only initialized `crossing: null` plus `routeValidationStatus: 'UNVALIDATED'`; this post-load action is the sole initial graph finalization. The reducer derives from commit-time state, stores the Crossing and `routeFactsFingerprint` (or null when a live frontier exists), and sets `VALIDATED`, without RNG/currency. It is identity/no revision when the same validated result is already present and otherwise increments revision once. Later prerequisite mutations refresh or invalidate inside their own reducer transition, never with a second dispatch/revision. A graph load/version error preserves state/currency, does not disable Unbroken, ignores any `UNVALIDATED` persisted Crossing, and surfaces `route-data-error`.

- [ ] **Step 4: Run tests and inspect bundle split**

Run:

```bash
npx vitest run utils/fatedFrontier/loadRuntime.test.ts context/GameContext.test.tsx utils/vanillaIsolation.test.ts
npx vite build
```

Expected: PASS; the graph manifests appear in a lazy Chunked asset and not in the eager entry asset.

- [ ] **Step 5: Commit**

```bash
git add utils/fatedFrontier/graphRuntime.ts utils/fatedFrontier/graphRuntime.test.ts utils/fatedFrontier/loadRuntime.ts utils/fatedFrontier/loadRuntime.test.ts context/GameContext.tsx context/GameContext.test.tsx vite.config.ts
git commit -m "perf: lazy-load the Chunked frontier graph" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 5: Ship the executable all-target and prerequisite proof

**Files:**
- Modify: `scripts/verify-chunked-frontier.mjs`
- Create: `scripts/verify-chunked-frontier.test.ts`
- Create: `utils/fatedFrontier/liveness.property.test.ts`
- Modify: `package.json`

**Interfaces:**
- Node verifier exits nonzero and prints stable target/edge/certificate error codes.
- Property tests consume only legal dedicated unlock decisions and prepared deterministic draws.

- [ ] **Step 1: Write mutation tests for the verifier**

Starting from the real manifests, mutate one case at a time: add a source target, delete a target, duplicate a rank, remove a parent, reverse a rank, create an edge cycle, create a certificate cycle, point a prerequisite into its destination component, remove evidence, add an unknown requirement, mark a route unverified, or change the root. Each case must fail with the expected code.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run scripts/verify-chunked-frontier.test.ts utils/fatedFrontier/liveness.property.test.ts`

Expected: FAIL because the verifier/properties do not exist.

- [ ] **Step 3: Implement the ranked-arborescence proof**

Verify exactly:

```text
root node rank = 0
623 paid targets = 623 distinct target arrival mappings
each non-root proof node has one proof parent arc
parent arc source node rank < destination node rank
each paid target's target rank equals its arrival node rank
each proof arrival edge's fromNodeId has its own finite lower-ranked node-activation chain from the root
each edge and certificate has verified evidence
each prerequisite certificate depends only on source-side/lower-ranked facts
every node follows parent links finitely to 50,50
```

The induction used by the liveness test is explicit: choose the minimum-ranked unowned target arrival node, then trace node proof parents backward to the first edge whose destination is outside `activeNodeIds`. If that edge is satisfied and its destination chunk is owned, fixed-point closure must activate that exact destination node; if satisfied and unowned, it is live frontier; otherwise its finite source-side certificate is the Crossing. This handles legal random order plus arbitrary migrated legacy ownership without assuming a lower-ranked owned chunk—or an unrelated active zone in it—activates the edge source.

- [ ] **Step 4: Test adversarial legal orders and migration shapes**

Run full 623-target traversals choosing first candidate, last candidate, and deterministic shuffled candidate for at least 1,000 seeds. Inject arbitrary subsets of valid disconnected legacy ownership and arbitrary active-zone subsets within owned multi-zone chunks; assert they remain dormant/sealed until their exact node proof ancestors connect. Assert every intermediate state has a frontier or attainable Crossing and every successful authorization adds exactly one distinct target.

- [ ] **Step 5: Wire the release gates**

Extend scripts without replacing existing checks:

```text
"chunked:verify": "vitest run utils/fatedFrontier/**/*.test.ts utils/vanillaIsolation.test.ts scripts/build-chunk-zone-connectivity.test.ts scripts/verify-chunked-frontier.test.ts && node scripts/verify-chunked-frontier.mjs",
"content:verify": "npm run diary:verify && npm run chunks:verify && npm run quests:verify && npm run quest-routes:verify && npm run walkthroughs:verify && vitest run data/contentBaseline.test.ts data/tasksConsistency.test.ts utils/taskIdMigrations.test.ts utils/caProgress.test.ts && npm run chunked:verify"
```

Preserve the existing `content:verify` command text before appending the new gate.

- [ ] **Step 6: Run verification**

Run:

```bash
npm run chunked:verify
npm run content:verify
npx tsc --noEmit
npx vite build
```

Expected: all pass; verifier reports `624 authored / 623 paid / 623 proven / 0 route errors`.

- [ ] **Step 7: Commit**

```bash
git add scripts/verify-chunked-frontier.mjs scripts/verify-chunked-frontier.test.ts utils/fatedFrontier/liveness.property.test.ts package.json
git commit -m "test: prove every Chunked v2 target reachable" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```
