# First-Run Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guide a first-time visitor through their first real roll and first real key spend with a non-blocking spotlight coach, per `docs/superpowers/specs/2026-07-10-first-run-coach-design.md`.

**Architecture:** A pure state machine (`utils/firstRunCoach.ts`) derives the current coach step from game history; an always-mounted `FirstRunCoachDriver` renders a pointer-events-none spotlight + prompt card over real UI anchors and persists a per-profile done flag in localStorage (outside GameState). The OnboardingWizard's final CTA is re-worded to hand off into the coach.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, Vitest.

## Global Constraints

- Repo root: the OSRS-Fate-Locked clone. Run `npm install` once before any task if `node_modules/` is absent.
- ALL gameplay randomness goes through `GameContext.nextFloat` — this feature adds none and must not touch RNG or the history hash chain.
- The done flag lives in localStorage OUTSIDE GameState (key pattern `fate_first_run_coach_v1_<profileId>`, mirroring `fate_features_seen_v1_<profileId>` in `components/FeatureRevealDriver.tsx`) so it never travels with exports/sync codes.
- The driver must be ALWAYS-MOUNTED (same rule as SuggestionBanner/FeatureRevealDriver) and must never block input or trap focus.
- History entry types (types.ts:85): `'UNLOCK' | 'PITY' | 'ALTAR' | 'ROLL_SUCCESS' | 'ROLL_FAIL' | 'ROLL_OMNI' | 'LEVEL_UP' | 'XTREME_MILESTONE'`. Do not compare to a bare `'ROLL'`.
- Verification before completion: `npx vitest run` (406 pre-existing tests must stay green), `npx tsc --noEmit`, `npx vite build` (eager chunk stays ≈118 kB gzip).

---

### Task 1: `coachStep` pure state machine

**Files:**
- Create: `utils/firstRunCoach.ts`
- Test: `utils/firstRunCoach.test.ts`

**Interfaces:**
- Consumes: `GameState` type from `types.ts` (only `history` and `revealAllFeatures`).
- Produces: `type CoachStepId = 'roll' | 'spend' | 'done'` and `coachStep(s: CoachInput, done: boolean): CoachStepId | null`, consumed by Task 2's driver.

- [ ] **Step 1: Write the failing test**

```ts
// utils/firstRunCoach.test.ts
import { describe, it, expect } from 'vitest';
import { coachStep, type CoachInput } from './firstRunCoach';
import type { GameState } from '../types';

type Entry = GameState['history'][number];
const entry = (type: Entry['type']): Entry => ({ type } as Entry);

const input = (types: Entry['type'][], revealAll = false): CoachInput => ({
  history: types.map(entry),
  revealAllFeatures: revealAll,
});

describe('coachStep', () => {
  it('fresh run → roll', () => {
    expect(coachStep(input([]), false)).toBe('roll');
  });

  it('one failed roll → spend', () => {
    expect(coachStep(input(['ROLL_FAIL']), false)).toBe('spend');
  });

  it('one successful roll → spend', () => {
    expect(coachStep(input(['ROLL_SUCCESS']), false)).toBe('spend');
  });

  it('first unlock → done', () => {
    expect(coachStep(input(['ROLL_FAIL', 'UNLOCK']), false)).toBe('done');
  });

  it('unlock with a trailing LEVEL_UP still → done', () => {
    expect(coachStep(input(['ROLL_SUCCESS', 'UNLOCK', 'LEVEL_UP']), false)).toBe('done');
  });

  it('mature run without unlock (history ≥ 3) → null', () => {
    expect(coachStep(input(['ROLL_FAIL', 'ROLL_FAIL', 'ROLL_SUCCESS']), false)).toBe(null);
  });

  it('imported mature run with unlocks (history > 4) → null', () => {
    expect(coachStep(input(['ROLL_SUCCESS', 'UNLOCK', 'ROLL_FAIL', 'UNLOCK', 'PITY']), false)).toBe(null);
  });

  it('done flag → null even on a fresh run', () => {
    expect(coachStep(input([]), true)).toBe(null);
  });

  it('revealAllFeatures → null', () => {
    expect(coachStep(input([], true), false)).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run utils/firstRunCoach.test.ts`
Expected: FAIL — "Cannot find module './firstRunCoach'" (or equivalent resolve error).

- [ ] **Step 3: Write minimal implementation**

```ts
// utils/firstRunCoach.ts
/**
 * First-run coach — which guided step (if any) a run should see.
 *
 * Pure derivation from game state, same philosophy as featureGates.ts:
 * mature runs and imports auto-graduate to null with no migration. The
 * driver (components/FirstRunCoachDriver.tsx) owns persistence of the
 * per-profile done flag and passes it in.
 */
import type { GameState } from '../types';

export type CoachStepId = 'roll' | 'spend' | 'done';

/** The slice of GameState the coach reads — keeps tests tiny. */
export type CoachInput = Pick<GameState, 'history' | 'revealAllFeatures'>;

/** History window beyond which a run with unlocks is "mature" — never coach it. */
const DONE_WINDOW = 4;

export function coachStep(s: CoachInput, done: boolean): CoachStepId | null {
  if (done || s.revealAllFeatures) return null;
  const hasUnlock = s.history.some((h) => h.type === 'UNLOCK');
  if (hasUnlock) return s.history.length <= DONE_WINDOW ? 'done' : null;
  if (s.history.length === 0) return 'roll';
  if (s.history.length < 3) return 'spend';
  return null; // rolled ≥3 times without spending — stop nagging
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run utils/firstRunCoach.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add utils/firstRunCoach.ts utils/firstRunCoach.test.ts
git commit -m "feat: add first-run coach state machine"
```

---

### Task 2: Driver, DOM anchors, wizard CTA

**Files:**
- Create: `components/FirstRunCoachDriver.tsx`
- Modify: `components/ActionSection.tsx:483-487` (first slayer-card wrapper gets `data-coach="first-master"`)
- Modify: `components/GachaSection.tsx:372` (tables grid gets `data-coach="tables"`)
- Modify: `components/OnboardingWizard.tsx:408` (final CTA copy)
- Modify: `App.tsx` (mount driver next to `FeatureRevealDriver`, App.tsx:653)

**Interfaces:**
- Consumes: `coachStep`, `CoachStepId`, `CoachInput` from `utils/firstRunCoach` (Task 1); `useGame()` from `context/GameContext` (provides `history`, `revealAllFeatures`); `useProfiles()` from `context/ProfileContext` (provides `activeProfileId`); `showToast(message: string)` from `utils/toast`.
- Produces: `<FirstRunCoachDriver />` (no props), mounted once in App.

- [ ] **Step 1: Add the DOM anchors**

In `components/ActionSection.tsx`, the slayer card wrapper (line ~483) gains a `data-coach` on the first card only:

```tsx
            {slayers.map((master, i) => (
              <div
                key={master.name}
                data-coach={i === 0 ? 'first-master' : undefined}
                className={animationsEnabled ? 'animate-fade-in-up' : ''}
                style={animationsEnabled ? { animationDelay: `${i * 35}ms` } : undefined}
              >
```

In `components/GachaSection.tsx` line 372, add the attribute to the existing grid div:

```tsx
      <div data-coach="tables" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 custom-scrollbar content-start">
```

- [ ] **Step 2: Re-word the wizard CTA**

`components/OnboardingWizard.tsx` line 408 — change only the final-step string:

```tsx
                    {step === STEPS.length - 1 ? "Make Your First Roll" : "Next"}
```

- [ ] **Step 3: Write the driver**

```tsx
// components/FirstRunCoachDriver.tsx
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { coachStep, type CoachStepId } from '../utils/firstRunCoach';
import { showToast } from '../utils/toast';

/**
 * First-run coach — spotlights the user's first roll and first key spend.
 * Non-blocking (pointer-events: none overlay; the card itself is clickable
 * only for Skip). Steps derive from real game state via utils/firstRunCoach,
 * so imports and mature runs auto-graduate silently. Must stay
 * ALWAYS-MOUNTED (same rule as FeatureRevealDriver): step advances are
 * triggered by history changes made anywhere in the app.
 *
 * The per-profile done flag lives in localStorage OUTSIDE GameState — it
 * must never travel with exports or sync codes.
 */

const storageKey = (profileId: string) => `fate_first_run_coach_v1_${profileId}`;

const COPY: Record<Exclude<CoachStepId, 'done'>, { title: string; body: string }> = {
  roll: {
    title: 'Make your first roll',
    body: 'Click the first Slayer master card to roll for a Key. Only a 5% chance — but even a failed roll feeds your pity timer.',
  },
  spend: {
    title: 'Spend a Key',
    body: 'You start with 3 Keys. Open Spend Keys and roll any table — Fate picks what unlocks.',
  },
};

const FAIL_NOD = 'Bad luck still pays — that Fate Point is your pity timer filling. ';
const DONE_TOAST = 'Tasks in the Journal are your key farm — Fate takes it from here';

/** Selectors per step, first match wins (spend upgrades to the tables grid once visible). */
const TARGETS: Record<Exclude<CoachStepId, 'done'>, string[]> = {
  roll: ['[data-coach="first-master"]', '[data-tour="farm"]'],
  spend: ['[data-coach="tables"]', '[data-tour="spend"]'],
};

const TIP_W = 300;

export const FirstRunCoachDriver: React.FC = () => {
  const { history, revealAllFeatures } = useGame();
  const { activeProfileId } = useProfiles();
  const [dismissed, setDismissed] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Which step the coach actually displayed this session — gates the done toast.
  const shownRef = useRef<CoachStepId | null>(null);

  const done = dismissed || localStorage.getItem(storageKey(activeProfileId)) !== null;
  const step = coachStep({ history, revealAllFeatures }, done);

  const retire = useCallback((silent: boolean) => {
    localStorage.setItem(storageKey(activeProfileId), '1');
    setDismissed(true);
    if (!silent) showToast(DONE_TOAST);
  }, [activeProfileId]);

  // Terminal states: celebrate 'done' only if we coached this session.
  useEffect(() => {
    if (step === 'done') retire(shownRef.current === null);
    else if (step === null && !done && history.length > 0) retire(true);
  }, [step, done, history.length, retire]);

  // Measure the current target; re-measure on layout changes and on a slow
  // interval (targets mount/unmount as the user switches Farm/Spend tabs).
  const measure = useCallback(() => {
    if (step !== 'roll' && step !== 'spend') { setRect(null); return; }
    for (const sel of TARGETS[step]) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) { setRect(el.getBoundingClientRect()); return; }
    }
    setRect(null); // fallback corner card
  }, [step]);

  useLayoutEffect(() => { measure(); }, [measure, history.length]);
  useEffect(() => {
    if (step !== 'roll' && step !== 'spend') return;
    const id = window.setInterval(measure, 600);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step, measure]);

  if (step !== 'roll' && step !== 'spend') return null;
  shownRef.current = step;

  const copy = COPY[step];
  const lastFailed = history[0]?.type === 'ROLL_FAIL' || history[history.length - 1]?.type === 'ROLL_FAIL';
  const body = step === 'spend' && lastFailed ? FAIL_NOD + copy.body : copy.body;

  // Card position: under the target, clamped; corner fallback without a target.
  const vw = window.innerWidth, vh = window.innerHeight;
  const tipStyle: React.CSSProperties = rect
    ? {
        top: Math.min(Math.max(12, rect.bottom + 12), vh - 170),
        left: Math.min(Math.max(12, rect.left), vw - TIP_W - 12),
      }
    : { bottom: 16, left: 16 };

  return createPortal(
    <div className="fixed inset-0 z-[400] pointer-events-none" aria-live="polite">
      {rect && (
        <div
          className="fixed rounded-lg transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            border: '2px solid rgba(74,222,128,0.9)',
          }}
        />
      )}
      <div
        className="fixed w-[300px] bg-[#1c1c1c] border border-green-500/30 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] p-3.5 pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
        style={tipStyle}
        role="status"
      >
        <div className="flex items-start gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-lg bg-green-500/15 border border-green-400/30 flex items-center justify-center text-green-300 shrink-0">
            <Sparkles size={13} />
          </div>
          <h3 className="text-[14px] font-bold text-white leading-tight flex-1 pt-0.5">{copy.title}</h3>
          <button
            onClick={() => retire(true)}
            className="text-gray-600 hover:text-gray-300 shrink-0"
            aria-label="Skip the first-run coach"
          >
            <X size={15} />
          </button>
        </div>
        <p className="text-[12px] text-gray-300 leading-relaxed mb-1">{body}</p>
        <button
          onClick={() => retire(true)}
          className="text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>,
    document.body,
  );
};
```

- [ ] **Step 4: Mount the driver in App.tsx**

Add the import next to the FeatureRevealDriver import (App.tsx:24):

```tsx
import { FirstRunCoachDriver } from './components/FirstRunCoachDriver';
```

Mount it directly after `<FeatureRevealDriver />` (App.tsx:653):

```tsx
      <FeatureRevealDriver />
      {/* First-run coach — spotlights the first roll & first spend. */}
      <FirstRunCoachDriver />
```

- [ ] **Step 5: Type-check and run the full suite**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npx vitest run` — expected: all tests pass (406 pre-existing + 9 new).

- [ ] **Step 6: Commit**

```bash
git add components/FirstRunCoachDriver.tsx components/ActionSection.tsx components/GachaSection.tsx components/OnboardingWizard.tsx App.tsx
git commit -m "feat: guided first roll & spend coach on first launch"
```

---

### Task 3: End-to-end verification and push

**Files:**
- None created; browser verification + release checklist.

**Interfaces:**
- Consumes: the running dev server (`npm run dev`, port 5173) and everything from Tasks 1-2.

- [ ] **Step 1: Manual flow check in the browser (fresh profile / cleared localStorage)**

1. Load the app fresh → wizard appears; final CTA reads "Make Your First Roll".
2. Close the wizard → spotlight ring sits on the first Slayer master card with the "Make your first roll" card; the rest of the app is dimmed but still clickable.
3. Click the first master card → after the roll resolves, the coach advances to "Spend a Key", spotlighting the Spend Keys tab; if the roll failed, the copy starts with the pity-timer nod.
4. Open Spend Keys → the spotlight upgrades to the tables grid. Roll any table.
5. After the unlock reveal, the coach is gone and the Journal toast fires once.
6. Reload → the coach does not reappear (done flag persisted).
7. New scenario: clear localStorage, reload, click the coach's Skip → coach gone, reload stays gone.
8. New scenario: clear localStorage, import a mature save (or make 3+ rolls) → coach never appears and no toast fires.

- [ ] **Step 2: Production build check**

Run: `npx vite build`
Expected: success; eager `dist/assets/index-*.js` stays ≈118 kB gzip (the driver is a few hundred bytes and imports nothing new).

- [ ] **Step 3: Push**

```bash
git push origin main
```

Expected: GitHub Actions deploy workflow (test → build → publish) goes green.
