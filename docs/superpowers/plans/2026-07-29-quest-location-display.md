# Quest Location Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Quest Log cards show only canonical completion chunks when exact geography is known, while placing incomplete chunk evidence in a separate Known steps group.

**Architecture:** Add a pure policy selector that converts `QuestData` plus summarised Chunk Picker places into a display model. Render that model through a focused geography-chip component, then make `QuestLog` use the same selected canonical arrays for both chips and progress totals.

**Tech Stack:** TypeScript, React 18, Vitest, `react-dom/server`

## Global Constraints

- `locations` quests show authored locations only.
- `regions-and-locations` quests show authored regions and locations.
- `regions` quests show authored regions plus informational Known steps.
- Known steps never affect eligibility or progress.
- Deduplicate canonical locations by ID and Known steps by `cx,cy`.
- Do not change quest audit data or completion eligibility.

---

### Task 1: Policy-driven geography selector

**Files:**
- Create: `utils/questGeographyDisplay.ts`
- Create: `utils/questGeographyDisplay.test.ts`

**Interfaces:**
- Consumes: `QuestData`, `QuestLocationRequirement`, and `QuestPlace`.
- Produces: `selectQuestGeography(quest, places): QuestGeographyDisplay`.

- [ ] **Step 1: Write failing selector tests**

```ts
import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import {
  selectQuestGeography,
  type QuestGeographyDisplay,
} from './questGeographyDisplay';

const place = (cx: number, cy: number, label: string) => ({
  cx, cy, label, subArea: label, region: 'Synthetic',
  unlocked: false, role: 'step' as const,
});

describe('selectQuestGeography', () => {
  it('shows only canonical locations for an exact location quest', () => {
    const result = selectQuestGeography(
      QUEST_DATA['A Porcine of Interest'],
      [
        place(48, 50, 'Draynor Village'),
        place(47, 51, 'Falador'),
        place(49, 52, 'Varrock'),
      ],
    );

    expect(result.regions).toEqual([]);
    expect(result.locations.map(location => location.label)).toEqual([
      'Draynor Village',
      'South Falador Farm',
    ]);
    expect(result.knownSteps).toEqual([]);
  });

  it('keeps partial evidence separate for a region-only quest', () => {
    const quest = {
      ...QUEST_DATA['A Porcine of Interest'],
      accessPolicy: 'regions' as const,
      locations: undefined,
    };
    const result = selectQuestGeography(quest, [
      place(48, 50, 'Draynor Village'),
      place(48, 50, 'South Draynor alias'),
      place(49, 52, "Champions' Guild"),
    ]);

    expect(result.regions).toEqual(['Misthalin', 'Asgarnia']);
    expect(result.locations).toEqual([]);
    expect(result.knownSteps.map(step => `${step.cx},${step.cy}`)).toEqual([
      '48,50',
      '49,52',
    ]);
  });

  it('keeps both canonical kinds and suppresses raw evidence for a combined policy', () => {
    const quest = {
      ...QUEST_DATA['A Porcine of Interest'],
      accessPolicy: 'regions-and-locations' as const,
    };
    const result = selectQuestGeography(quest, [
      place(49, 52, "Champions' Guild"),
    ]);

    expect(result.regions).toEqual(['Misthalin', 'Asgarnia']);
    expect(result.locations).toHaveLength(2);
    expect(result.knownSteps).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the selector test and verify RED**

Run: `npx vitest run utils/questGeographyDisplay.test.ts`

Expected: FAIL because `utils/questGeographyDisplay.ts` does not exist.

- [ ] **Step 3: Implement the minimal selector**

```ts
import type {
  QuestData,
  QuestLocationRequirement,
} from '../data/questData';
import type { QuestPlace } from './questLocations';

export interface QuestGeographyDisplay {
  regions: string[];
  locations: QuestLocationRequirement[];
  knownSteps: QuestPlace[];
}

const uniqueBy = <T>(values: readonly T[], keyOf: (value: T) => string): T[] =>
  [...new Map(values.map(value => [keyOf(value), value])).values()];

export function selectQuestGeography(
  quest: Pick<QuestData, 'accessPolicy' | 'regions' | 'locations'>,
  places: readonly QuestPlace[],
): QuestGeographyDisplay {
  const regions = quest.accessPolicy === 'locations'
    ? []
    : uniqueBy(quest.regions, region => region);
  const locations = quest.accessPolicy === 'regions'
    ? []
    : uniqueBy(quest.locations ?? [], location => location.id);
  const knownSteps = quest.accessPolicy === 'regions'
    ? uniqueBy(places, step => `${step.cx},${step.cy}`)
    : [];

  return { regions, locations, knownSteps };
}
```

- [ ] **Step 4: Run the selector tests and verify GREEN**

Run: `npx vitest run utils/questGeographyDisplay.test.ts`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the selector**

```bash
git add utils/questGeographyDisplay.ts utils/questGeographyDisplay.test.ts
git commit -m "fix: select quest geography by access policy"
```

### Task 2: Focused geography-chip renderer

**Files:**
- Create: `components/QuestGeographyChips.tsx`
- Create: `components/QuestGeographyChips.test.tsx`

**Interfaces:**
- Consumes: `QuestGeographyDisplay`, completion state, eligibility evidence, and a map-navigation callback.
- Produces: `QuestGeographyChips`, rendering one canonical requirement group and an optional labelled Known steps group.

- [ ] **Step 1: Write failing rendering tests**

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import { selectQuestGeography } from '../utils/questGeographyDisplay';
import { QuestGeographyChips } from './QuestGeographyChips';

describe('QuestGeographyChips', () => {
  it('renders exact Porcine requirements once without broad regions or known steps', () => {
    const display = selectQuestGeography(
      QUEST_DATA['A Porcine of Interest'],
      [],
    );
    const html = renderToStaticMarkup(
      <QuestGeographyChips
        display={display}
        completed={false}
        evidence={[]}
        onShowChunk={() => undefined}
      />,
    );

    expect(html.match(/Draynor Village/g)).toHaveLength(1);
    expect(html.match(/South Falador Farm/g)).toHaveLength(1);
    expect(html).not.toContain('Misthalin');
    expect(html).not.toContain('Asgarnia');
    expect(html).not.toContain('Known steps');
  });

  it('labels partial region-policy evidence as Known steps', () => {
    const display = selectQuestGeography(
      { ...QUEST_DATA['Getting Ahead'], accessPolicy: 'regions' },
      [{
        cx: 26, cy: 48, label: 'Civitas illa Fortis',
        subArea: 'Civitas illa Fortis', region: 'Varlamore',
        unlocked: false, role: 'step',
      }],
    );
    const html = renderToStaticMarkup(
      <QuestGeographyChips
        display={display}
        completed={false}
        evidence={[]}
        onShowChunk={() => undefined}
      />,
    );

    expect(html).toContain('Known steps');
    expect(html).toContain('Civitas illa Fortis');
  });
});
```

- [ ] **Step 2: Run the renderer test and verify RED**

Run: `npx vitest run components/QuestGeographyChips.test.tsx`

Expected: FAIL because `QuestGeographyChips.tsx` does not exist.

- [ ] **Step 3: Implement the focused renderer**

Create `QuestGeographyChips.tsx`:

```tsx
import React from 'react';
import { Map, MapPin } from 'lucide-react';
import type { QuestGeographyDisplay } from '../utils/questGeographyDisplay';

interface QuestGeographyChipsProps {
  display: QuestGeographyDisplay;
  completed: boolean;
  evidence: readonly string[];
  onShowChunk: (cx: number, cy: number) => void;
}

const requirementClass = (met: boolean) =>
  'text-[10px] px-1.5 rounded flex items-center gap-1 border ' +
  (met
    ? 'bg-black/30 text-gray-500 border-white/5'
    : 'bg-red-900/10 text-red-400 border-red-500/20');

export const QuestGeographyChips: React.FC<QuestGeographyChipsProps> = ({
  display, completed, evidence, onShowChunk,
}) => (
  <>
    {display.regions.map(region => (
      <span
        key={`region:${region}`}
        className={requirementClass(completed || evidence.includes(region))}
      >
        <Map size={8} /> {region}
      </span>
    ))}
    {display.locations.map(location => (
      <span
        key={`location:${location.id}`}
        className={requirementClass(
          completed || evidence.includes(location.label),
        )}
      >
        <MapPin size={8} /> {location.label}
      </span>
    ))}
    {display.knownSteps.length > 0 && (
      <div className="contents" data-quest-known-steps>
        <span className="text-[9px] uppercase tracking-wide text-cyan-300/70">
          Known steps
        </span>
        {display.knownSteps.slice(0, 4).map(step => (
          <button
            key={`${step.cx},${step.cy}`}
            onClick={event => {
              event.stopPropagation();
              onShowChunk(step.cx, step.cy);
            }}
            className={`text-[10px] px-1.5 rounded flex items-center gap-1 border ${
              step.unlocked
                ? 'bg-emerald-900/10 text-emerald-400/80 border-emerald-500/20'
                : 'bg-red-900/10 text-red-400 border-red-500/30'
            }`}
            title={`${step.label} — ${step.unlocked ? 'unlocked' : 'locked'} (show on map)`}
          >
            <MapPin size={8} />
            {step.subArea ?? step.region ?? step.label}
            {step.role === 'first' && <span className="text-cyan-300/80">★</span>}
          </button>
        ))}
        {display.knownSteps.length > 4 && (
          <span className="text-[10px] px-1 text-gray-600">
            +{display.knownSteps.length - 4}
          </span>
        )}
      </div>
    )}
  </>
);
```

Known steps stay outside evidence and requirement totals.

- [ ] **Step 4: Run renderer and selector tests**

Run: `npx vitest run components/QuestGeographyChips.test.tsx utils/questGeographyDisplay.test.ts`

Expected: 5 tests PASS.

- [ ] **Step 5: Commit the renderer**

```bash
git add components/QuestGeographyChips.tsx components/QuestGeographyChips.test.tsx
git commit -m "fix: separate quest requirements from known steps"
```

### Task 3: Integrate policy-selected geography into Quest Log

**Files:**
- Modify: `components/QuestLog.tsx:1-245`
- Create: `components/QuestLog.card.test.ts`

**Interfaces:**
- Consumes: `selectQuestGeography` and `QuestGeographyChips`.
- Produces: Quest cards whose chips and progress denominator share the same canonical geography arrays.

- [ ] **Step 1: Add a failing Quest Card integration regression**

Create `components/QuestLog.card.test.ts`:

```ts
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import { QuestCard } from './QuestLog';

describe('QuestCard geography integration', () => {
  it('renders Porcine exact chunks once and counts only its two geography gates', () => {
    const quest = {
      ...QUEST_DATA['A Porcine of Interest'],
      status: 'LOCKED',
      eligibility: {
        eligible: false,
        evidence: [],
        blockers: [
          { kind: 'location', label: 'Draynor Village' },
          { kind: 'location', label: 'South Falador Farm' },
        ],
      },
    };
    const html = renderToStaticMarkup(
      React.createElement(QuestCard, {
        quest,
        unlocks: { regions: [], chunks: [], skills: {}, quests: [] },
        currentQP: 0,
        onToggle: vi.fn(),
      }),
    );

    expect(html.match(/Draynor Village/g)).toHaveLength(1);
    expect(html.match(/South Falador Farm/g)).toHaveLength(1);
    expect(html).not.toContain('Misthalin');
    expect(html).not.toContain('Asgarnia');
    expect(html).toContain('0/2 reqs');
  });
});
```

- [ ] **Step 2: Run the card test and verify RED**

Run: `npx vitest run components/QuestLog.card.test.ts`

Expected: FAIL because `QuestCard` is not exported. After exporting it without
the integration, the old card also fails the duplicate-region and `0/2`
assertions.

- [ ] **Step 3: Integrate the selector and renderer**

Export `QuestCard`, then replace its direct geography arrays with:

```ts
const geography = selectQuestGeography(quest, loc.places);
const regionReqs = geography.regions;
const locationReqs = geography.locations;
```

Replace the direct region, location, and `loc.places` JSX blocks with:

```tsx
<QuestGeographyChips
  display={geography}
  completed={isCompleted}
  evidence={eligibility.evidence}
  onShowChunk={showChunkOnMap}
/>
```

Remove now-unused `Map`, `MapPin`, and direct chunk-place rendering imports only
if the rest of `QuestLog.tsx` no longer uses them. Leave all non-geography chips
unchanged.

- [ ] **Step 4: Run focused verification**

Run:

```bash
npx vitest run utils/questGeographyDisplay.test.ts components/QuestGeographyChips.test.tsx components/QuestLog.card.test.ts components/QuestLog.kind.test.ts utils/journalStatus.test.ts components/QuestDoabilityPanel.test.tsx
npm run typecheck
```

Expected: all focused tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the integration**

```bash
git add components/QuestLog.tsx components/QuestLog.card.test.ts
git commit -m "fix: show only required quest chunks"
```

### Task 4: Release verification

**Files:**
- Modify only if required by project policy: `data/changelog.ts`
- Modify only if the changelog changes: `data/changelog.test.ts`

**Interfaces:**
- Consumes: the completed Quest Log behavior.
- Produces: a release-ready branch with all repository gates green.

- [ ] **Step 1: Check player-facing changelog policy**

Run: `npm run changelog:verify`

Expected: PASS if the existing quest/chunk audit release wording covers the fix.
If it fails because player-facing files changed, add one concise bullet to the
latest `2026-07-28-quest-chunk-audit` release:

```ts
'Quest cards now show exact required chunks once and separate incomplete Chunk Picker evidence under Known steps.',
```

- [ ] **Step 2: Run complete release verification**

Run: `npm run release:verify`

Expected: changelog verification, all tests, type-checking, content verification,
and production build PASS.

- [ ] **Step 3: Inspect the final diff**

Run:

```bash
git diff --check
git status --short
git log --oneline -6
```

Expected: no whitespace errors; only intentional files are present.

- [ ] **Step 4: Commit any release metadata**

If Task 4 Step 1 required changelog changes:

```bash
git add data/changelog.ts data/changelog.test.ts
git commit -m "docs: note quest location display fix"
```

If no changelog change was required, do not create an empty commit.
