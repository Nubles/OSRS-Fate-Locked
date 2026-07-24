# Durable Roll Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reliably detect supported RuneLite events, queue them in the web app, and let the player explicitly roll each eligible event through the app's existing RNG and history path.

**Architecture:** RuneLite persists immutable event envelopes before delivery, the Cloudflare relay appends them idempotently, and an always-mounted app driver validates and stores them locally. Exact events may reconcile factual progress, but only a click on the Inbox's Roll button calls `rollForKey`; uncertain events require player review and never roll themselves.

**Tech Stack:** React 18, TypeScript 5, Vitest 4, Cloudflare Workers KV, Java 11, RuneLite event bus, Gson, OkHttp, JUnit 4.

## Global Constraints

- The web app remains authoritative for eligibility, Fate Points, drop rates, RNG, history, duplicate handling, and final event classification.
- RuneLite never awards a key, changes the run, invokes gameplay actions, chooses unlocks, or rolls.
- Every roll requires the player to press **Roll** in the web Roll Inbox.
- Uncertain, stale, mismatched, unknown, or heuristic events enter **Needs confirmation**, never **Ready**.
- Online sync remains explicit opt-in and off by default; no relay request is allowed while it is disabled.
- Store only minimal detector evidence; never send credentials, full inventory, chat history, or unrelated gameplay data.
- Keep the existing `/r/:code`, `/state`, and `/suggest` routes working during one compatibility release.
- Event delivery is idempotent by `eventId` and survives RuneLite, browser, and relay interruptions.
- Approved design: `docs/superpowers/specs/2026-07-24-fate-guardian-runelite-design.md`.
- Project 0 must be released before starting this plan.

---

## File structure and protocol

### App and relay repository (`Nubles/OSRS-Fate-Locked`)

- `services/fateEventProtocol.ts` — wire types and resource-bound parser.
- `services/fateEventRelay.ts` — `/events` polling and `/acks` posting.
- `services/rollInboxStore.ts` — durable local inbox and state transitions.
- `utils/fateEventEligibility.ts` — canonical mapping and classification.
- `components/RollInboxDriver.tsx` — always-mounted poll/reconcile/ack driver.
- `components/RollInbox.tsx` — player-facing Ready, confirmation, and blocked rows.
- `workers/fate-relay/protocol.js` — relay validators and append helpers.
- `workers/fate-relay/worker.test.ts` — in-memory KV route tests.

### Standalone plugin repository (`Nubles/RS3-Fate-Locked-Runelite`)

- `src/main/java/com/fatelocked/events/FateEvent.java` — immutable envelope.
- `src/main/java/com/fatelocked/events/FateEventFactory.java` — event creation and IDs.
- `src/main/java/com/fatelocked/events/FateEventOutbox.java` — atomic persistent queue.
- `src/main/java/com/fatelocked/events/FateEventRelayClient.java` — append/retry/ack transport.
- `src/main/java/com/fatelocked/detectors/` — one focused detector per RuneLite signal.

The version-1 wire shape is:

```ts
interface FateEventEnvelope {
  protocolVersion: 1;
  eventId: string;
  runId: string;
  account: string;
  runRevision: number;
  eventType: 'SKILL_LEVEL' | 'QUEST' | 'COMBAT_ACHIEVEMENT' |
    'COLLECTION_LOG' | 'CLUE_CASKET' | 'BOSS_KILL' | 'RAID_COMPLETION';
  canonicalLabel: string | null;
  occurredAt: number;
  sessionSequence: number;
  bundleVersion: number;
  rulesVersion: string;
  contentVersion: number;
  detectorId: string;
  detectorVersion: number;
  confidence: 'EXACT' | 'UNCERTAIN';
  evidence: Record<string, string | number | boolean>;
}
```

### Task 1: Add resource-bounded protocol types

**Files:**
- Create: `services/fateEventProtocol.ts`
- Create: `services/fateEventProtocol.test.ts`

**Interfaces:**
- Produces: `parseFateEvent(input: unknown): FateEventEnvelope | null`, `parseEventBatch(input: unknown): FateEventEnvelope[]`, `FATE_EVENT_PROTOCOL_VERSION`.
- Limits: 100 events per response, 8 KiB serialized per event, 32 evidence keys, 256 characters per string, timestamps within 30 days past and 5 minutes future.

- [ ] **Step 1: Write failing parser tests**

```ts
it('accepts a complete v1 event and rejects oversized evidence', () => {
  expect(parseFateEvent(validEvent())).toMatchObject({
    protocolVersion: 1,
    eventType: 'QUEST',
    canonicalLabel: 'Dragon Slayer',
  });
  expect(parseFateEvent(validEvent({
    evidence: { signature: 'x'.repeat(257) },
  }))).toBeNull();
});

it('caps a relay batch at 100 without throwing', () => {
  expect(parseEventBatch({ events: Array.from({ length: 101 }, validEvent) }))
    .toHaveLength(100);
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- services/fateEventProtocol.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement explicit validation**

Use allowlisted event types and primitive evidence only. Normalize account names with `trim().replace(/\s+/g, ' ').toLowerCase()` for comparisons, but preserve the original account in the envelope. Reject unknown protocol versions atomically.

```ts
export const FATE_EVENT_PROTOCOL_VERSION = 1 as const;
export const MAX_EVENTS_PER_BATCH = 100;
export const MAX_EVENT_BYTES = 8 * 1024;

export function parseEventBatch(input: unknown): FateEventEnvelope[] {
  if (!isRecord(input) || !Array.isArray(input.events)) return [];
  return input.events.slice(0, MAX_EVENTS_PER_BATCH)
    .map(parseFateEvent)
    .filter((event): event is FateEventEnvelope => event !== null);
}
```

- [ ] **Step 4: Verify**

Run: `npm test -- services/fateEventProtocol.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/fateEventProtocol.ts services/fateEventProtocol.test.ts
git commit -m "feat: define Fate event protocol"
```

### Task 2: Add append-and-ack relay routes

**Files:**
- Create: `workers/fate-relay/protocol.js`
- Create: `workers/fate-relay/worker.test.ts`
- Modify: `workers/fate-relay/worker.js`

**Interfaces:**
- `POST /r/:code/events` consumes `{token?: string, events: FateEventEnvelope[]}`.
- `GET /r/:code/events` produces `{version: number, events: FateEventEnvelope[]}`.
- `POST /r/:code/acks` consumes `{token?: string, acknowledgements: EventAcknowledgement[]}`.
- `GET /r/:code/acks` produces `{version: number, acknowledgements: EventAcknowledgement[]}`.
- `EventAcknowledgement` is `{eventId: string, state: 'COMPLETED'|'DISMISSED'|'DUPLICATE', acknowledgedAt: number}`.
- POST responses are `{version, token, accepted, duplicates}`.

- [ ] **Step 1: Write in-memory KV tests**

```ts
it('appends once and reports a retry as duplicate', async () => {
  const first = await post('/r/ABCD/events', { events: [event('evt-1')] });
  const token = (await first.json()).token;
  const retry = await post('/r/ABCD/events', { token, events: [event('evt-1')] });
  expect(await retry.json()).toMatchObject({
    accepted: [],
    duplicates: ['evt-1'],
  });
  expect((await get('/r/ABCD/events').then(r => r.json())).events).toHaveLength(1);
});

it('isolates tokens and pairing codes', async () => {
  const claimed = await post('/r/ABCD/events', { events: [event('evt-1')] });
  expect((await post('/r/ABCD/events', {
    token: 'wrong',
    events: [event('evt-2')],
  })).status).toBe(403);
  expect((await get('/r/WXYZ/events')).status).toBe(404);
});
```

- [ ] **Step 2: Run the failing relay tests**

Run: `npm test -- workers/fate-relay/worker.test.ts`

Expected: FAIL with 404 for `/events` and `/acks`.

- [ ] **Step 3: Implement idempotent append**

Extend the route regex to:

```js
const CODE_RE =
  /^\/r\/([A-Za-z0-9-]{4,40})(\/state|\/suggest|\/events|\/acks)?$/;
const EVENT_TTL_SECONDS = 7 * 86400;
const MAX_EVENTS = 100;
const MAX_EVENT_BYTES = 8 * 1024;
```

For `/events` and `/acks`, parse structured arrays instead of the legacy string payload. Claim one token per sub-resource, deduplicate by `eventId`, preserve first-seen ordering, reject the entire request if any event exceeds the per-record bound, and cap stored records at 100. Refresh the seven-day TTL on a successful append. Keep legacy route behavior unchanged.

- [ ] **Step 4: Add limits and acknowledgement tests**

Test invalid event bodies (`400`), request bodies over 256 KiB (`413`), repeated acknowledgements, ordering, and a simulated KV `put` failure followed by a successful retry.

- [ ] **Step 5: Verify**

Run: `npm test -- workers/fate-relay/worker.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add workers/fate-relay/worker.js workers/fate-relay/protocol.js workers/fate-relay/worker.test.ts
git commit -m "feat: append and acknowledge Fate events"
```

### Task 3: Give every run a stable identity and revision

**Files:**
- Modify: `types.ts`
- Modify: `context/GameContext.tsx`
- Modify: `context/GameContext.test.tsx`
- Modify: `utils/runeliteBundle.ts`
- Modify: `utils/runeliteExport.ts`
- Modify: `utils/runeliteBundle.test.ts`

**Interfaces:**
- Adds `runId: string` and `runRevision: number` to `GameState`.
- Exports `migrateSaveForTest(save: Partial<GameState>): GameState` and `gameReducerForTest(state, action): GameState` through the test-only module boundary used by `context/GameContext.test.tsx`.
- `gameReducer` increments `runRevision` exactly once for every persistent state mutation and not for reducer no-ops.
- Adds `runId`, `runRevision`, `gameModeId`, `rulesVersion`, `contentVersion`, and `detectorContractVersion` to the exported bundle.

- [ ] **Step 1: Write migration and revision tests**

```ts
it('assigns a stable run id to an old save', () => {
  const first = migrateSaveForTest({ version: 1, history: [] });
  const second = migrateSaveForTest(first);
  expect(first.runId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(first.runRevision).toBe(0);
  expect(second.runId).toBe(first.runId);
});

it('increments revision for a persistent mutation but not a no-op', () => {
  const start = { ...migrateSaveForTest({ version: 1, history: [] }), runRevision: 7 };
  const changed = gameReducerForTest(start, { type: 'SET_LINKED_ACCOUNT', payload: 'Nubles' });
  expect(changed.runRevision).toBe(8);
  const noOp = gameReducerForTest(changed, { type: 'SET_LINKED_ACCOUNT', payload: 'Other' });
  expect(noOp.runRevision).toBe(8);
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- context/GameContext.test.tsx utils/runeliteBundle.test.ts`

Expected: FAIL because `runId`, `runRevision`, and the new bundle fields are absent.

- [ ] **Step 3: Implement identity and monotonic revision migration**

Create `newRunId()` with `crypto.randomUUID()` and a tested random-byte fallback. Assign it only in the reducer initializer/migration path, never in the shared `initialState` constant. Migrate missing revisions to `0`. Reset creates a new run ID at revision `0`; restore/import preserves the imported run ID and revision.

After `rawReducer` and history hash chaining, return the same object for a no-op; otherwise set `runRevision: state.runRevision + 1`. Validate imported revisions as non-negative safe integers.

Use initial protocol values:

```ts
export const RULES_VERSION = '1';
export const CONTENT_VERSION = 1;
export const DETECTOR_CONTRACT_VERSION = 1;
```

- [ ] **Step 4: Export identity in the bundle**

Pass the fields through `RuneliteRunInput` and emit them at the bundle root. Do not increment the bundle version yet; Project 2 owns the v4 schema transition.

- [ ] **Step 5: Verify**

Run: `npm test -- context/GameContext.test.tsx utils/runeliteBundle.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add types.ts context/GameContext.tsx context/GameContext.test.tsx utils/runeliteBundle.ts utils/runeliteExport.ts utils/runeliteBundle.test.ts
git commit -m "feat: add stable run identity to RuneLite sync"
```

### Task 4: Build the plugin's persistent event outbox

**Files:**
- Create: `src/main/java/com/fatelocked/events/FateEvent.java`
- Create: `src/main/java/com/fatelocked/events/FateEventType.java`
- Create: `src/main/java/com/fatelocked/events/EventConfidence.java`
- Create: `src/main/java/com/fatelocked/events/FateEventFactory.java`
- Create: `src/main/java/com/fatelocked/events/FateEventOutbox.java`
- Create: `src/test/java/com/fatelocked/events/FateEventOutboxTest.java`

**Interfaces:**
- `FateEventFactory.create(FateEventType type, String canonicalLabel, EventConfidence confidence, Map<String,Object> evidence, FateLockedBundle bundle, String account): FateEvent`.
- `FateEventOutbox.enqueue(FateEvent)`, `pending(): List<FateEvent>`, `acknowledge(Set<String>)`, and `contains(String eventId)`.
- Persists to `${RuneLite.RUNELITE_DIR}/fate-locked/event-outbox.json`.

- [ ] **Step 1: Write restart and deduplication tests**

```java
@Test
public void pendingEventSurvivesRestart() throws Exception
{
    FateEventOutbox first = new FateEventOutbox(gson, temp.resolve("outbox.json"));
    first.enqueue(event("evt-1"));
    FateEventOutbox restarted = new FateEventOutbox(gson, temp.resolve("outbox.json"));
    assertEquals(Collections.singletonList("evt-1"),
        restarted.pending().stream().map(FateEvent::getEventId).collect(toList()));
}

@Test
public void acknowledgementSurvivesAndPreventsReplay() throws Exception
{
    outbox.enqueue(event("evt-1"));
    outbox.acknowledge(Collections.singleton("evt-1"));
    assertFalse(new FateEventOutbox(gson, path).contains("evt-1"));
    assertFalse(new FateEventOutbox(gson, path).enqueue(event("evt-1")));
}
```

- [ ] **Step 2: Run the failing tests**

Run: `gradle test --tests com.fatelocked.events.FateEventOutboxTest --no-daemon`

Expected: FAIL because the event package does not exist.

- [ ] **Step 3: Implement atomic persistence**

Persist `{pending:[], acknowledged:{eventId:timestamp}}` to a sibling `.tmp` file and move with `ATOMIC_MOVE`, falling back to `REPLACE_EXISTING`. Keep at most 250 pending events. Retain acknowledged IDs for 30 days and prune on load. If the file is malformed, rename it to `.corrupt-<timestamp>` and start empty; do not discard the current valid in-memory queue after a failed write.

`FateEventFactory` must use `UUID.randomUUID()` exactly once per new occurrence; retry and restart reuse the serialized ID. Increment `sessionSequence` in memory and include the bundle's run/rules/content versions.

- [ ] **Step 4: Verify**

Run: `gradle test --tests com.fatelocked.events.FateEventOutboxTest --no-daemon`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fatelocked/events src/test/java/com/fatelocked/events
git commit -m "feat: persist detected Fate events"
```

### Task 5: Add plugin append, retry, and acknowledgement transport

**Files:**
- Create: `src/main/java/com/fatelocked/events/FateEventRelayClient.java`
- Create: `src/test/java/com/fatelocked/events/FateEventRelayClientTest.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`

**Interfaces:**
- `flush(String relayBase, String code, FateEventOutbox outbox)` posts up to 20 pending events.
- `pollAcknowledgements(String relayBase, String code, FateEventOutbox outbox)` removes terminal event IDs.
- Uses the injected `OkHttpClient`, `Gson`, and `ConfigManager`.
- Persists `/events` token as `eventToken.<syncCode>` in `FateLockedConfig.GROUP`.

- [ ] **Step 1: Write MockWebServer transport tests**

Add `testImplementation 'com.squareup.okhttp3:mockwebserver:3.14.9'`. Assert that one flush sends the v1 envelope, a `500` leaves it pending, a retry reuses the same ID, and a `/acks` response removes it.

```java
assertEquals("evt-1", body.getAsJsonArray("events")
    .get(0).getAsJsonObject().get("eventId").getAsString());
assertTrue(outbox.contains("evt-1"));
```

- [ ] **Step 2: Run the failing tests**

Run: `gradle test --tests com.fatelocked.events.FateEventRelayClientTest --no-daemon`

Expected: FAIL because the relay client does not exist.

- [ ] **Step 3: Implement asynchronous transport**

Return immediately when `onlineSync` is false, code/base is blank, or another flush is in flight. Use `enqueue`, never `execute`. After a 2xx append, retain events until `/acks` confirms a terminal state; “accepted” only means the relay has the event. Poll acknowledgements every existing relay interval and use exponential retry delays of 5, 10, 20, 40, then 60 seconds.

- [ ] **Step 4: Wire lifecycle without adding detector logic**

Construct the outbox and relay client in `startUp()`, flush from the existing `onGameTick` cadence, and shut down without deleting pending events. Keep `/suggest` working until Task 10 removes its UI consumer.

- [ ] **Step 5: Verify**

Run: `gradle test --tests com.fatelocked.events.FateEventRelayClientTest --no-daemon`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add build.gradle src/main/java/com/fatelocked/events src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/events
git commit -m "feat: deliver Fate events reliably"
```

### Task 6: Implement conservative first-wave detectors

**Files:**
- Create: `src/main/java/com/fatelocked/detectors/SkillLevelDetector.java`
- Create: `src/main/java/com/fatelocked/detectors/QuestDetector.java`
- Create: `src/main/java/com/fatelocked/detectors/CombatAchievementDetector.java`
- Create: `src/main/java/com/fatelocked/detectors/CollectionLogDetector.java`
- Create: `src/main/java/com/fatelocked/detectors/ClueCasketDetector.java`
- Create: `src/main/java/com/fatelocked/detectors/BossRaidDetector.java`
- Create: `src/test/java/com/fatelocked/detectors/SkillLevelDetectorTest.java`
- Create: `src/test/java/com/fatelocked/detectors/QuestDetectorTest.java`
- Create: `src/test/java/com/fatelocked/detectors/CombatAchievementDetectorTest.java`
- Create: `src/test/java/com/fatelocked/detectors/CollectionLogDetectorTest.java`
- Create: `src/test/java/com/fatelocked/detectors/ClueCasketDetectorTest.java`
- Create: `src/test/java/com/fatelocked/detectors/BossRaidDetectorTest.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`

**Interfaces:**
- Each detector returns `Optional<DetectedEvent>`, where `DetectedEvent` contains `type`, nullable `canonicalLabel`, confidence, detector ID/version, and primitive evidence.
- All produced detections pass through one `record(DetectedEvent)` method that calls the factory and persists to the outbox.

- [ ] **Step 1: Write table-driven detector fixtures**

Cover these exact expectations:

```text
StatChanged login baseline                   -> no event
Attack 70 -> 71                              -> SKILL_LEVEL, EXACT
unique quest reward widget name              -> QUEST, EXACT
quest reward widget without a name           -> QUEST, UNCERTAIN
"Combat task: Noxious Foe"                   -> COMBAT_ACHIEVEMENT, EXACT
unmapped Combat Achievement message          -> COMBAT_ACHIEVEMENT, UNCERTAIN
unique Collection Log item                   -> COLLECTION_LOG, EXACT
duplicate item-name mapping                  -> COLLECTION_LOG, UNCERTAIN
allowlisted Hard clue loot identity          -> CLUE_CASKET, EXACT
unknown casket-like loot identity             -> CLUE_CASKET, UNCERTAIN
allowlisted Chambers of Xeric reward event    -> RAID_COMPLETION, EXACT
combat-level-only NPC loot heuristic          -> BOSS_KILL, UNCERTAIN
```

- [ ] **Step 2: Run detector tests**

Run: `gradle test --tests 'com.fatelocked.detectors.*' --no-daemon`

Expected: FAIL because the detector classes do not exist.

- [ ] **Step 3: Implement detectors with explicit allowlists**

Level, exact quest, exact CA, and unique collection-log mappings may emit `EXACT`. Clues and raids must compare normalized event identities to checked-in allowlists. NPC combat level is evidence only and must emit `UNCERTAIN`. Never promote a detector because a string merely contains “complete,” “boss,” “raid,” or “casket.”

- [ ] **Step 4: Replace direct suggestion calls**

Existing `nudge(...)` chat reminders may remain. Replace each `pushSuggestion(...)` call with `record(...)`; add the currently missing Collection Log and boss/raid delivery paths. Ensure `rollNudges=false` controls chat only, not durable detection; durable detection is gated by `onlineSync`, because without consent no event should be collected for relay delivery.

- [ ] **Step 5: Verify**

Run: `gradle test --tests 'com.fatelocked.detectors.*' --no-daemon`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fatelocked/detectors src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/detectors
git commit -m "feat: detect first-wave roll events"
```

### Task 7: Add app relay transport and durable inbox storage

**Files:**
- Create: `services/fateEventRelay.ts`
- Create: `services/fateEventRelay.test.ts`
- Create: `services/rollInboxStore.ts`
- Create: `services/rollInboxStore.test.ts`
- Modify: `services/relaySync.ts`

**Interfaces:**
- `fateEventRelay.fetchEvents(): Promise<FateEventEnvelope[]>`.
- `fateEventRelay.acknowledge(acks: EventAcknowledgement[]): Promise<boolean>`.
- `createRollInboxStore(storage: Pick<Storage, 'getItem' | 'setItem'>, runId: string): RollInboxStore`.
- `RollInboxStore.ingest(events)`, `list()`, `transition(eventId, state, reason?)`, and `subscribe(listener)`.
- Inbox states: `RECEIVED`, `READY`, `NEEDS_CONFIRMATION`, `BLOCKED`, `COMPLETED`, `DISMISSED`, `DUPLICATE`.

- [ ] **Step 1: Write storage and transport tests**

```ts
it('does not resurrect a completed event after reload or redelivery', () => {
  store.ingest([event('evt-1')]);
  store.transition('evt-1', 'COMPLETED');
  const restarted = createRollInboxStore(fakeStorage, 'run-1');
  restarted.ingest([event('evt-1')]);
  expect(restarted.list()[0].state).toBe('COMPLETED');
});

it('posts terminal acknowledgements with the app-owned token', async () => {
  await fateEventRelay.acknowledge([ack('evt-1', 'COMPLETED')]);
  expect(fetch).toHaveBeenCalledWith(expect.stringEnding('/acks'),
    expect.objectContaining({ method: 'POST' }));
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- services/fateEventRelay.test.ts services/rollInboxStore.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement relay ownership**

Add `relaySync.postOwnedSubresource(path, body)` so `/acks` reuses the app session token without exposing it publicly. `fetchEvents` is read-only. Do not fetch or post when sync is disabled.

- [ ] **Step 4: Implement local persistence**

Use key `fate_roll_inbox_v1:<runId>`. Preserve terminal event IDs for 30 days, cap active rows at 250, and sort by `occurredAt` then `sessionSequence`. Ingest is idempotent by `eventId`.

- [ ] **Step 5: Verify**

Run: `npm test -- services/fateEventRelay.test.ts services/rollInboxStore.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/relaySync.ts services/fateEventRelay.ts services/fateEventRelay.test.ts services/rollInboxStore.ts services/rollInboxStore.test.ts
git commit -m "feat: store and acknowledge Roll Inbox events"
```

### Task 8: Classify events with canonical app rules

**Files:**
- Create: `utils/fateEventEligibility.ts`
- Create: `utils/fateEventEligibility.test.ts`
- Modify: `types.ts`

**Interfaces:**
- `classifyFateEvent(event, state): EventClassification`.
- `EventClassification` is `{state:'READY', intent:RollIntent, progress:DetectedProgress}` or `{state:'NEEDS_CONFIRMATION'|'BLOCKED'|'DUPLICATE', reason:string, candidates?:Candidate[]}`.
- `RollIntent` is `{source: string, threshold: number, target: string}`.
- `DetectedProgress` is `{kind:'SKILL_LEVEL', skill:string, level:number} | {kind:'QUEST', questId:string} | {kind:'CA_TASK', taskId:string} | {kind:'COLLECTION_ITEM', itemId:number} | {kind:'NONE'}`.

- [ ] **Step 1: Write canonical classification tests**

Test account mismatch, run mismatch, stale revision, unsupported detector version, duplicate event ID in history, exact quest mapping, unknown quest, unique/ambiguous Collection Log names, clue tier rates, CA tier rates, and boss tiers from `data/bossKeyTiers.ts`.

```ts
expect(classifyFateEvent(questEvent('Dragon Slayer'), state))
  .toMatchObject({
    state: 'READY',
    intent: { source: DropSource.QUEST_EXPERIENCED,
      threshold: DROP_RATES[DropSource.QUEST_EXPERIENCED] },
  });

expect(classifyFateEvent(questEvent(null), state).state)
  .toBe('NEEDS_CONFIRMATION');
```

- [ ] **Step 2: Run the failing test**

Run: `npm test -- utils/fateEventEligibility.test.ts`

Expected: FAIL because the classifier does not exist.

- [ ] **Step 3: Implement canonical indexes**

Build normalized indexes once for `QUEST_DATA`, `ALL_CA_TASKS`, `COLLECTION_LOG_DATA`, and `BOSS_TIERS`. An exact event becomes Ready only when run/account/revision/version checks pass, the detector is approved, the source exists, the occurrence is not in history/inbox, mode rules permit it, and current prerequisites/permissions were valid. Duplicate checks use `eventId` and roll-history metadata/source occurrence—not membership in `unlocks.quests`, `completedTasks`, levels, or Collection Log—because factual reconciliation must not consume the player's pending roll. Return a concise Blocked reason for known violations; stale context returns Needs confirmation.

For skill level events, use the existing formula:

```ts
const threshold = Math.ceil(level / 5);
const source = `${skill} Level ${level}`;
```

- [ ] **Step 4: Verify**

Run: `npm test -- utils/fateEventEligibility.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/fateEventEligibility.ts utils/fateEventEligibility.test.ts types.ts
git commit -m "feat: classify detected events canonically"
```

### Task 9: Reconcile factual progress without rolling

**Files:**
- Modify: `context/GameContext.tsx`
- Modify: `context/GameContext.test.tsx`
- Modify: `types.ts`

**Interfaces:**
- Adds `reconcileDetectedProgress(progress: DetectedProgress): void`.
- Adds `meta?: GameEventMeta` as the fifth argument of `rollForKey`.
- Adds reducer action `SYNC_DETECTED_PROGRESS`.

- [ ] **Step 1: Write separation tests**

```ts
it('reconciles a quest without producing a roll history entry', () => {
  act(() => game.reconcileDetectedProgress({ kind: 'QUEST', questId: 'Dragon Slayer' }));
  expect(game.unlocks.quests).toContain('Dragon Slayer');
  expect(game.history.filter(isRollEntry)).toHaveLength(0);
});

it('records the event id only when the player invokes rollForKey', () => {
  act(() => game.rollForKey('Quest (Experienced)', 75, undefined, undefined,
    { fateEventId: 'evt-1' }));
  expect(game.history.at(-1)?.meta?.fateEventId).toBe('evt-1');
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- context/GameContext.test.tsx`

Expected: FAIL because the reconciliation action and metadata argument are absent.

- [ ] **Step 3: Implement idempotent reconciliation**

Use max semantics for skill levels, set semantics for quests/CA tasks, and set-to-at-least-one semantics for a unique Collection Log item. Replaying the same progress must not change history or counts. Do not call `levelUpSkill`, because it rolls; do not call toggle methods, because replay could undo progress.

- [ ] **Step 4: Thread event metadata through the existing roll action**

Keep RNG, pity, Omni, and hash chaining unchanged. Add `fateEventId`, `detectorId`, and `detectorVersion` to the normal roll log metadata.

- [ ] **Step 5: Verify**

Run: `npm test -- context/GameContext.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add context/GameContext.tsx context/GameContext.test.tsx types.ts
git commit -m "feat: reconcile detected progress without rolling"
```

### Task 10: Build the always-mounted driver and Roll Inbox UI

**Files:**
- Create: `components/RollInboxDriver.tsx`
- Create: `components/RollInbox.tsx`
- Create: `components/RollInbox.test.tsx`
- Modify: `components/AutoRollPanel.tsx`
- Modify: `components/Dashboard.tsx`
- Modify: `App.tsx`
- Delete: `components/SuggestionQueue.tsx`
- Delete: `components/SuggestionBanner.tsx`
- Delete: `services/suggestSync.ts`
- Delete: `services/suggestSync.test.ts`

**Interfaces:**
- `RollInboxDriver` polls every 5 seconds while connected, ingests, classifies, reconciles exact factual progress once, and posts terminal acknowledgements.
- `RollInbox` renders Ready, Needs confirmation, and Blocked groups.
- The Roll button calls `rollForKey(intent.source, intent.threshold, undefined, undefined, eventMeta)` exactly once, then transitions the event to Completed.

- [ ] **Step 1: Write UI behavior tests**

```tsx
it('never rolls on ingest or render', async () => {
  render(<RollInbox />);
  await screen.findByText('Dragon Slayer');
  expect(rollForKey).not.toHaveBeenCalled();
});

it('rolls exactly once after the player presses Roll', async () => {
  render(<RollInbox />);
  await user.click(await screen.findByRole('button', { name: /^Roll$/ }));
  expect(rollForKey).toHaveBeenCalledTimes(1);
  expect(rollForKey).toHaveBeenCalledWith(
    'Quest (Experienced)', 75, undefined, undefined,
    expect.objectContaining({ fateEventId: 'evt-1' }),
  );
});
```

Also test Review candidate selection, **Not eligible**, Dismiss, duplicate dismissal, Blocked rows having no Roll button, and refresh preserving terminal states. Candidate review may transition to Ready only after run/account/version gates pass; wrong-account and stale-run rows never expose Roll.

- [ ] **Step 2: Run the failing test**

Run: `npm test -- components/RollInbox.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the driver**

Mount it beside `OnlineSyncDriver` in `App.tsx`, not inside a lazy tab. Stop polling and clear timers when sync is disabled. Show connection health but retain the local inbox offline. Reclassify on run state changes without mutating terminal rows.

- [ ] **Step 4: Implement compact inbox rows**

Ready rows show source, canonical label, occurrence time, one prominent **Roll** button, and **Not eligible**. Needs-confirmation rows show **Review** and candidate selection. Blocked rows show one concise reason and **Dismiss**. Duplicate rows offer **Dismiss duplicate events**. `Not eligible` stores an intentional rejection reason and posts a terminal `DISMISSED` acknowledgement. Do not use “auto-roll” in the Inbox copy.

- [ ] **Step 5: Replace the suggestion UI**

Place `<RollInbox />` above the existing account sync controls in `AutoRollPanel.tsx`; keep the existing filename in this project so the migration stays focused. The Dashboard tab label remains **Sync & Roll**. Keep `/suggest` relay compatibility for one release even though the app stops consuming it.

- [ ] **Step 6: Verify focused and full app tests**

Run:

```bash
npm test -- components/RollInbox.test.tsx services/rollInboxStore.test.ts utils/fateEventEligibility.test.ts
npm test
npm run typecheck
npm run build
```

Expected: all commands pass.

- [ ] **Step 7: Commit**

```bash
git add App.tsx components services utils types.ts context
git commit -m "feat: add explicit-player Roll Inbox"
```

### Task 11: Plugin panel health summary

**Files:**
- Modify: `src/main/java/com/fatelocked/FateLockedPanel.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`
- Create: `src/test/java/com/fatelocked/FateLockedPanelStatusTest.java`

**Interfaces:**
- `panel.updateSyncHealth(int pending, int readyHint, int warnings, Instant lastSync, boolean offline)`.
- “Open Roll Inbox” uses the configured tracker URL plus `?open=roll-inbox&code=` and `URLEncoder.encode(code, StandardCharsets.UTF_8.name())`.

- [ ] **Step 1: Write view-state tests**

Assert pending count, offline label, last-success time, and URL encoding. The panel may label plugin-side exact confidence as “queued”; only the app calls an event Ready.

- [ ] **Step 2: Run the failing test**

Run: `gradle test --tests com.fatelocked.FateLockedPanelStatusTest --no-daemon`

Expected: FAIL because the sync-health API does not exist.

- [ ] **Step 3: Implement the compact status block**

Render Queued, Needs review, active warnings, and last tracker sync. Add **Open Roll Inbox** using `LinkBrowser.browse(...)`. Do not add a Roll button to RuneLite.

- [ ] **Step 4: Verify**

Run: `gradle test --tests com.fatelocked.FateLockedPanelStatusTest --no-daemon`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fatelocked/FateLockedPanel.java src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/FateLockedPanelStatusTest.java
git commit -m "feat: show Roll Inbox sync health"
```

### Task 12: End-to-end release verification

**Files:**
- Modify: `docs/online-relay.md`
- Modify: `README.md` in both repositories
- Modify: `CONTRIBUTING.md` in the plugin repository

**Interfaces:**
- Produces: documented v1 event/ack protocol, privacy limits, and migration from `/suggest`.

- [ ] **Step 1: Document exact consent and ownership**

State that RuneLite detects and queues, the app validates and rolls, the relay stores event records for seven days, and all roll actions require the web button. List the envelope fields and endpoints.

- [ ] **Step 2: Run automated verification**

App:

```bash
npm test
npm run typecheck
npm run content:verify
npm run build
```

Plugin:

```bash
gradle clean test jar --no-daemon
```

Expected: all commands pass.

- [ ] **Step 3: Run the restart matrix**

Manually verify:

1. Detect an event with the app closed; restart RuneLite; open the app; the event arrives once.
2. Disconnect the relay for one failed send; reconnect; the same event ID arrives once.
3. Render a Ready row for one minute; no roll occurs.
4. Click Roll once; exactly one normal history entry contains `fateEventId`.
5. Redeliver the event; it remains Completed and is acknowledged as duplicate.
6. Wrong-account and stale-revision events require confirmation and never expose Roll until reviewed.
7. Online sync disabled produces no event file growth and no network request.

- [ ] **Step 4: Commit documentation**

```bash
git add docs/online-relay.md README.md
git commit -m "docs: explain durable Roll Inbox protocol"
```

In the standalone plugin:

```bash
git add README.md CONTRIBUTING.md
git commit -m "docs: explain detected event delivery"
```
