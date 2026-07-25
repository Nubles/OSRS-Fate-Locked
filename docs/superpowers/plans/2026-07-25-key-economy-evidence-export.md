# Key Economy Evidence Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a voluntary, local-only, privacy-safe aggregate export for issue #10 and publish the evidence gate required before any key-economy rebalance.

**Architecture:** Add non-gameplay metadata to future roll records so Fate earned per source is exact, while safely inferring the base value for historical records. A pure aggregator accepts explicit report metadata and emits only aggregates. The Stats modal owns the opt-in form and browser download; no network request, background collection, or automatic submission is introduced.

**Tech Stack:** React 18, TypeScript 5, Vitest 4, browser `crypto.randomUUID`, Blob downloads, existing `LogEntry`, `buildFateReport`, and `completionPercent`.

## Global Constraints

- Keep tracker issue #10 open after this implementation.
- Do not change production key rates, Fate Point awards, pity behavior, boss caps, or diminishing returns.
- Export is initiated explicitly by the player and stays local until the player chooses where to share it.
- Exclude account names, linked-account values, run IDs, raw history, event IDs, exact timestamps, relay codes/tokens, chat, and device/network identifiers.
- Include only anonymous report ID, game mode, declared stage, observed hours, aggregate source outcomes, drought summaries, schema version, and app version.
- Stage rules are fixed for schema version 1: early = 0–24% overall tracker completion, mid = 25–74%, late = 75–100%.
- Evidence review requires at least 10 independent runs, at least 500 scoreable attempts in each stage, and at least three materially different source categories in each stage.
- Publish median keys/hour, interquartile range, and drought percentiles before modeling.
- Model variants offline against the same immutable sample and require a separate approved design before any production rate change.

---

## File Structure

- `context/GameContext.tsx`: records `fatePointsEarned` metadata without changing state transitions.
- `utils/keyEconomyEvidence.ts`: schema, validation, inference, and pure aggregate builder.
- `utils/keyEconomyEvidence.test.ts`: privacy, aggregation, historical inference, and drought contracts.
- `components/KeyEconomyEvidenceExport.tsx`: explicit stage/hours form and local JSON download.
- `components/KeyEconomyEvidenceExport.test.tsx`: static form/copy contract.
- `components/StatsModal.tsx`: mounts the export on the existing Fate Report tab.
- `docs/key-economy-evidence.md`: public schema, stage rules, privacy exclusions, sample gate, and offline review protocol.

### Task 1: Record exact Fate earned by future roll entries

**Files:**
- Modify: `context/GameContext.tsx`
- Modify: `context/gameReducer.test.ts`
- Modify: `context/GameContext.test.tsx`

**Interfaces:**
- Produces optional roll metadata: `meta.fatePointsEarned: number`.
- Historical entries without the field remain valid.

- [ ] **Step 1: Add failing reducer assertions**

For ordinary failure:

```ts
expect(next.history.at(-1)).toMatchObject({
  type: 'ROLL_FAIL',
  meta: { fatePointsEarned: 1 },
});
expect(next.fatePoints).toBe(previous.fatePoints + 1);
```

For Greed failure, assert the existing refund plus base point:

```ts
expect(next.history.at(-1)?.meta?.fatePointsEarned)
  .toBe(1 + expectedGreedRefund);
```

For a pity result:

```ts
expect(next.history.at(-1)).toMatchObject({
  type: 'PITY',
  meta: { fatePointsEarned: 1 },
});
```

For `ROLL_SUCCESS` and `ROLL_OMNI`:

```ts
expect(next.history.at(-1)?.meta?.fatePointsEarned).toBe(0);
```

- [ ] **Step 2: Run the focused reducer tests**

Run: `npx vitest run context/gameReducer.test.ts context/GameContext.test.tsx`

Expected: FAIL because the metadata is absent; existing Fate balances must already pass.

- [ ] **Step 3: Add metadata to every roll outcome**

Use the already calculated values:

```ts
meta: {
  roll,
  baseThreshold,
  threshold,
  source,
  fatePointsEarned: 0,
},
```

for success and Omni; use:

```ts
fatePointsEarned: 1
```

for pity; and after `greedRefund` is known:

```ts
fatePointsEarned: 1 + greedRefund
```

for ordinary failure. Do not alter any `newState.fatePoints` line.

- [ ] **Step 4: Run the focused tests**

Run: `npx vitest run context/gameReducer.test.ts context/GameContext.test.tsx`

Expected: PASS with pre-existing state-balance assertions unchanged.

- [ ] **Step 5: Commit**

```bash
git add context/GameContext.tsx context/gameReducer.test.ts context/GameContext.test.tsx
git commit -m "feat: record aggregate-safe Fate roll metadata"
```

### Task 2: Build and validate the privacy-safe aggregate schema

**Files:**
- Create: `utils/keyEconomyEvidence.ts`
- Create: `utils/keyEconomyEvidence.test.ts`

**Interfaces:**
- Produces:

```ts
export type EvidenceStage = 'early' | 'mid' | 'late';

export interface KeyEconomyEvidenceInput {
  reportId: string;
  gameMode: string;
  stage: EvidenceStage;
  observedHours: number;
  appVersion: string;
}

export interface DroughtSummary {
  longestFailures: number;
  activeFailures: number;
}

export interface SourceEvidence {
  source: string;
  category: string;
  attempts: number;
  successes: number;
  expectedSuccesses: number;
  fatePoints: number;
  drought: DroughtSummary;
}

export interface KeyEconomyEvidenceReport {
  schemaVersion: 1;
  reportId: string;
  gameMode: string;
  stage: EvidenceStage;
  observedHours: number;
  appVersion: string;
  totals: {
    attempts: number;
    successes: number;
    expectedSuccesses: number;
    fatePoints: number;
    drought: DroughtSummary;
  };
  sources: SourceEvidence[];
}

export function stageForCompletion(percent: number): EvidenceStage;
export function buildKeyEconomyEvidence(
  history: readonly LogEntry[],
  input: KeyEconomyEvidenceInput,
): KeyEconomyEvidenceReport;
```

- [ ] **Step 1: Add failing stage and validation tests**

```ts
it.each([
  [0, 'early'],
  [24, 'early'],
  [25, 'mid'],
  [74, 'mid'],
  [75, 'late'],
  [100, 'late'],
])('classifies %s%% as %s', (percent, stage) => {
  expect(stageForCompletion(percent)).toBe(stage);
});

it.each([-1, 101, Number.NaN])('rejects invalid completion %s', percent => {
  expect(() => stageForCompletion(percent)).toThrow(/completion/i);
});

it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
  'rejects invalid observed hours %s',
  observedHours => {
    expect(() => buildKeyEconomyEvidence([], {
      reportId: 'anonymous-report',
      gameMode: 'vanilla',
      stage: 'early',
      observedHours,
      appVersion: 'test-build',
    })).toThrow(/observedHours/i);
  },
);
```

- [ ] **Step 2: Add failing aggregation and privacy tests**

Use scoreable rolls containing deliberately sensitive values:

```ts
const history: LogEntry[] = [
  roll({
    id: 'private-event-id',
    timestamp: 1_700_000_000_000,
    source: 'Boss (Mid)',
    threshold: 20,
    result: 'FAIL',
    meta: {
      fatePointsEarned: 4,
      linkedAccount: 'Sensitive Name',
      relayToken: 'secret-token',
    },
  }),
  roll({
    id: 'second-private-event-id',
    timestamp: 1_700_000_000_999,
    source: 'Boss (Mid)',
    threshold: 20,
    result: 'SUCCESS',
  }),
  roll({
    source: 'Quest (Novice)',
    threshold: 50,
    result: 'FAIL',
  }),
];
```

Assert:

```ts
expect(report.totals).toMatchObject({
  attempts: 3,
  successes: 1,
  fatePoints: 5,
  drought: { longestFailures: 1, activeFailures: 1 },
});
expect(report.totals.expectedSuccesses).toBeCloseTo(0.9);
const boss = report.sources.find(({ source }) => source === 'Boss (Mid)')!;
expect(boss).toMatchObject({
  source: 'Boss (Mid)',
  category: 'Boss',
  attempts: 2,
  successes: 1,
  fatePoints: 4,
  drought: { longestFailures: 1, activeFailures: 0 },
});
expect(boss.expectedSuccesses).toBeCloseTo(0.4);

const serialized = JSON.stringify(report);
for (const forbidden of [
  'private-event-id',
  '1700000000000',
  'Sensitive Name',
  'secret-token',
  'timestamp',
  'history',
  'linkedAccount',
  'relayToken',
]) {
  expect(serialized).not.toContain(forbidden);
}
```

Add a historical inference test:

```ts
expect(buildKeyEconomyEvidence([
  roll({ type: 'ROLL_FAIL', result: 'FAIL', meta: undefined }),
  roll({ type: 'PITY', result: 'SUCCESS', meta: undefined }),
], validInput).totals.fatePoints).toBe(2);
```

- [ ] **Step 3: Run the new tests**

Run: `npx vitest run utils/keyEconomyEvidence.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement strict input validation and stage rules**

```ts
export const stageForCompletion = (percent: number): EvidenceStage => {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('completion percent must be between 0 and 100');
  }
  if (percent < 25) return 'early';
  if (percent < 75) return 'mid';
  return 'late';
};

const validateInput = (input: KeyEconomyEvidenceInput): void => {
  if (!input.reportId.trim()) throw new Error('reportId is required');
  if (!input.gameMode.trim()) throw new Error('gameMode is required');
  if (!input.appVersion.trim()) throw new Error('appVersion is required');
  if (!['early', 'mid', 'late'].includes(input.stage)) {
    throw new Error('stage is invalid');
  }
  if (!Number.isFinite(input.observedHours) || input.observedHours <= 0) {
    throw new Error('observedHours must be a positive finite number');
  }
};
```

- [ ] **Step 5: Implement scoreable-roll and Fate inference**

```ts
const scoreableRolls = (history: readonly LogEntry[]): LogEntry[] =>
  history.filter(entry =>
    isRollEntry(entry)
    && typeof entry.threshold === 'number'
    && entry.threshold > 0
    && Boolean(entry.source)
  );

const fateEarned = (entry: LogEntry): number => {
  const exact = entry.meta?.fatePointsEarned;
  if (typeof exact === 'number' && Number.isFinite(exact) && exact >= 0) {
    return exact;
  }
  return entry.type === 'ROLL_FAIL' || entry.type === 'PITY' ? 1 : 0;
};
```

Use `rollCategory` from `utils/fateReport.ts`. Count a success when `result === 'SUCCESS'`. Expected successes are `Math.min(threshold, 100) / 100`.

- [ ] **Step 6: Implement drought aggregation without timestamps**

```ts
const droughtSummary = (rolls: readonly LogEntry[]): DroughtSummary => {
  let longestFailures = 0;
  let current = 0;
  for (const roll of rolls) {
    if (roll.result === 'FAIL') {
      current += 1;
      longestFailures = Math.max(longestFailures, current);
    } else {
      current = 0;
    }
  }
  return { longestFailures, activeFailures: current };
};
```

Sort a copy by timestamp only for internal sequence calculation; never emit the timestamps. Sort exported sources lexicographically by `source` for deterministic output.

- [ ] **Step 7: Run the focused tests**

Run: `npx vitest run utils/keyEconomyEvidence.test.ts utils/fateReport.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add utils/keyEconomyEvidence.ts utils/keyEconomyEvidence.test.ts
git commit -m "feat: build privacy-safe key economy aggregates"
```

### Task 3: Add an explicit local export to Fate Analytics

**Files:**
- Create: `components/KeyEconomyEvidenceExport.tsx`
- Create: `components/KeyEconomyEvidenceExport.test.tsx`
- Modify: `components/StatsModal.tsx`

**Interfaces:**
- Consumes: `history`, `gameModeId`, `completionPercent(unlocks)`, `__BUILD_ID__`.
- Produces:

```ts
interface KeyEconomyEvidenceExportProps {
  history: readonly LogEntry[];
  gameMode: string;
  completionPercent: number;
  appVersion: string;
}
```

- [ ] **Step 1: Add failing static presentation tests**

```tsx
const html = renderToStaticMarkup(
  <KeyEconomyEvidenceExport
    history={[]}
    gameMode="vanilla"
    completionPercent={24}
    appVersion="test-build"
  />,
);

expect(html).toContain('Export aggregate evidence');
expect(html).toContain('Observed play-hours');
expect(html).toContain('Early');
expect(html).toContain('0–24% completion');
expect(html).toContain('No account name, run ID, raw history, or timestamps');
expect(html).not.toContain('type="hidden"');
```

- [ ] **Step 2: Run the component test**

Run: `npx vitest run components/KeyEconomyEvidenceExport.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the explicit form**

Initialize:

```ts
const suggestedStage = stageForCompletion(completionPercent);
const [stage, setStage] = useState<EvidenceStage>(suggestedStage);
const [hours, setHours] = useState('');
const parsedHours = Number(hours);
const canExport = Number.isFinite(parsedHours) && parsedHours > 0;
```

Render a labeled number input with `min="0.1"` and `step="0.1"`, and three radio choices:

```ts
const STAGE_COPY = {
  early: 'Early · 0–24% completion',
  mid: 'Mid · 25–74% completion',
  late: 'Late · 75–100% completion',
} as const;
```

Show:

```text
Suggested from current tracker completion: Early/Mid/Late.
No account name, run ID, raw history, or timestamps are exported.
The JSON is downloaded locally and is not sent automatically.
```

- [ ] **Step 4: Generate and download only on button click**

```ts
const exportReport = () => {
  if (!canExport) return;
  const report = buildKeyEconomyEvidence(history, {
    reportId: crypto.randomUUID(),
    gameMode,
    stage,
    observedHours: parsedHours,
    appVersion,
  });
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `fate-key-evidence-${report.reportId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};
```

Do not store the report ID or form values in localStorage and do not call `fetch`.

- [ ] **Step 5: Mount the form in the existing Fate Report tab**

Read `unlocks` and `gameModeId` from `useGame()` and add after the per-category table:

```tsx
<KeyEconomyEvidenceExport
  history={history}
  gameMode={gameModeId}
  completionPercent={completionPercent(unlocks)}
  appVersion={__BUILD_ID__}
/>
```

Keep existing Fate Report calculations unchanged.

- [ ] **Step 6: Run component, Stats, and type tests**

Run:

```bash
npx vitest run components/KeyEconomyEvidenceExport.test.tsx components/StatsModal.test.tsx utils/keyEconomyEvidence.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/KeyEconomyEvidenceExport.tsx components/KeyEconomyEvidenceExport.test.tsx components/StatsModal.tsx
git commit -m "feat: export local key economy evidence"
```

### Task 4: Publish the evidence protocol and balance gate

**Files:**
- Create: `docs/key-economy-evidence.md`
- Modify: `README.md`

**Interfaces:**
- Documents schema version 1 and the immutable review gate.

- [ ] **Step 1: Write the protocol document**

The document must contain these exact sections and facts:

```markdown
# Key economy evidence protocol

## Consent and data flow

The tracker does not collect or transmit this report. A player explicitly
enters observed hours and clicks Export. The browser downloads aggregate JSON;
the player decides whether and where to share it.

## Stage rules (schema version 1)

- Early: 0–24% overall tracker completion.
- Mid: 25–74%.
- Late: 75–100%.

The player declares the stage for the reporting window. The form shows the
stage suggested by current tracker completion.

## Included fields

- anonymous UUID report ID;
- game mode, declared stage, observed hours, schema/app version;
- per-source attempts, successes, expected successes, Fate Points;
- overall and per-source longest and active droughts.

## Explicit exclusions

Account names, linked-account values, run IDs, raw history, event IDs, exact
timestamps, relay codes/tokens, chat, and device/network identifiers.

## Review gate

- at least 10 independent runs;
- at least 500 scoreable attempts in each of early, mid, and late;
- at least three materially different source categories in each stage;
- publish median keys/hour, interquartile range, and drought percentiles;
- freeze the accepted sample and model every candidate variant offline against
  that same sample;
- require a separate design and explicit approval before changing production
  rates.

## Deferred proposals

Brutus, diminishing odds, and per-boss lifetime caps are hypotheses to model,
not production changes in this implementation.
```

- [ ] **Step 2: Link the protocol without implying telemetry**

Add to README’s analytics/privacy area:

```markdown
Fate Analytics can export a voluntary local aggregate for the
[key-economy evidence protocol](./docs/key-economy-evidence.md). Nothing is
uploaded automatically.
```

- [ ] **Step 3: Add a documentation contract test**

In `utils/keyEconomyEvidence.test.ts`:

```ts
it('publishes the fixed privacy and sample gate', () => {
  const doc = readFileSync(
    new URL('../docs/key-economy-evidence.md', import.meta.url),
    'utf8',
  );
  for (const phrase of [
    'at least 10 independent runs',
    'at least 500 scoreable attempts',
    'three materially different source categories',
    'median keys/hour',
    'interquartile range',
    'exact timestamps',
    'Nothing is uploaded automatically',
  ]) {
    expect(doc).toContain(phrase);
  }
});
```

Use `Nothing is uploaded automatically` in the protocol document as well as README so the focused document test is self-contained.

- [ ] **Step 4: Run the evidence tests**

Run: `npx vitest run utils/keyEconomyEvidence.test.ts components/KeyEconomyEvidenceExport.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/key-economy-evidence.md README.md utils/keyEconomyEvidence.test.ts
git commit -m "docs: define key economy evidence gate"
```

### Task 5: Verify privacy and update issue #10 without closing it

**Files:**
- GitHub metadata: tracker issue #10.
- No additional local file required.

**Interfaces:**
- Produces issue evidence while retaining open state.

- [ ] **Step 1: Run the full deterministic release gate**

Run: `npm run release:verify`

Expected: all tests, typecheck, content verification, and build pass.

- [ ] **Step 2: Scan the implementation for transmission paths and sensitive schema keys**

Run:

```bash
rg -n "fetch\\(|XMLHttpRequest|sendBeacon|WebSocket|linkedAccount|relayToken|timestamp|rawHistory|runId" components/KeyEconomyEvidenceExport.tsx utils/keyEconomyEvidence.ts docs/key-economy-evidence.md
```

Expected:

- no network API in the component or aggregator;
- sensitive names appear only in the documentation’s explicit exclusion list or test fixtures;
- no sensitive field exists in `KeyEconomyEvidenceReport`.

- [ ] **Step 3: Inspect a representative JSON export**

Use the UI with at least one success, one ordinary failure, one pity, and two sources. Confirm:

1. a fresh anonymous UUID is present;
2. hours and stage match the form;
3. source and total arithmetic match Fate Analytics;
4. no event timestamp or raw entry is present;
5. no request appears in the browser Network panel.

Expected: all five pass.

- [ ] **Step 4: Comment on issue #10 and keep it open**

Use:

```text
Implemented the first evidence step: a voluntary local aggregate JSON export and a published privacy/sample protocol.

No production key rate, pity rule, boss cap, or diminishing return changed. The export excludes account/run identifiers, raw history, and exact timestamps, and it is never uploaded automatically.

The issue remains open. Rebalance review is gated on ≥10 independent runs, ≥500 scoreable attempts in every stage, and ≥3 source categories per stage, followed by published median/IQR/drought statistics and offline modeling against one frozen sample.

Deferred hypotheses retained for later modeling: Brutus, diminishing odds, and per-boss lifetime caps.
```

Do not close issue #10.

- [ ] **Step 5: Record final branch evidence**

Run:

```bash
git diff --check
git status --short
git log --oneline origin/main..HEAD
```

Expected: clean patch checks, only intentional evidence/export commits, and no generated report JSON checked into Git.
