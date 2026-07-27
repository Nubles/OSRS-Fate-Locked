# First-Run Coach — Design

**Date:** 2026-07-10
**Status:** Approved

## Goal

Convert curious first-time visitors into players by guiding them through their
first real roll and first real key spend — learning by doing, inside their
actual run, in about 60 seconds. This complements the existing
OnboardingWizard (concept explainer) and GuidedTour (layout tour); the gap it
closes is that neither makes the visitor *perform* the core loop.

## Non-goals

- No forced or scripted RNG outcomes. All actions go through the real engine
  and `GameContext.nextFloat`; seeded determinism and the integrity hash chain
  are untouched.
- No changes to feature gates, the wizard's step content, or the GuidedTour.
- No demo/sandbox profile.

## Shape

A new always-mounted driver (`FirstRunCoachDriver`) runs a three-step state
machine after the wizard closes:

1. **`roll`** — spotlight the Turael roll card. Prompt: one line, e.g.
   "Roll it — 5% chance. Even failure feeds your pity timer."
   Advances when the run history grows by any completed roll (success or
   failure). After a failed roll, the step-2 prompt opens with a nod to the
   Fate Point gained ("Bad luck still pays — that's your pity timer").
2. **`spend`** — spotlight the Spend Keys tab, then any table's Roll button.
   Prompt: "You start with 3 keys — spend one and let Fate pick."
   Advances on the next unlock event in history.
3. **`done`** — one closing toast pointing at the Journal ("Tasks in the
   Journal are your key farm — Fate takes it from here"), then the driver
   retires for that profile.

Every step shows a "Skip" affordance that retires the coach immediately.

## Components

### `utils/firstRunCoach.ts` (new, pure)

`coachStep(state: GameState, done: boolean): 'roll' | 'spend' | 'done' | null`

- `null` (never show) when: `done` is true, any unlock/spend already exists in
  history, history length ≥ 3, or `revealAllFeatures` is set. This makes
  imports and mature runs auto-graduate silently, mirroring
  `featureGates.ts`.
- `'roll'` when history is empty.
- `'spend'` when at least one roll exists but no unlock does.
- `'done'` once the first unlock lands (driver shows the closing toast once,
  then persists done).

### `components/FirstRunCoachDriver.tsx` (new, always mounted)

- Renders the spotlight overlay; reuses GuidedTour's spotlight/positioning
  machinery (extract shared helpers if needed rather than duplicating).
- Persists a per-profile `firstRunCoachDone` flag alongside the feature-gate
  seen-set (localStorage, outside GameState — it must not travel with
  exports/sync codes).
- Skip sets the flag immediately.
- Never blocks input or traps focus. If the spotlight's DOM target is absent
  (user navigated elsewhere), falls back to a corner card with the same copy.

### `components/OnboardingWizard.tsx` (edit)

Final step CTA text changes from "Enter the Void" to "Make your first roll →".
Same dismiss semantics as today.

## Interactions with existing systems

- **Feature gates:** unchanged. Gates already hide most surfaces at run
  start, which keeps the coach's spotlight targets unambiguous.
- **RNG / integrity:** untouched — the coach only observes history.
- **CoachStrip:** unchanged; the driver is independent. (Roadmap follow-up
  about CoachStrip referencing hidden surfaces is out of scope.)

## Testing

Unit tests for `coachStep` (mirroring `featureGates.test.ts` style):

- fresh run → `roll`
- one failed roll in history → `spend`
- first unlock in history → `done`
- imported mature run (unlocks present or history ≥ 3) → `null`
- `done` flag → `null`
- `revealAllFeatures` → `null`

Driver behavior (skip persistence, fallback card) verified manually in the
browser preview; the state machine itself stays pure and unit-tested.

## Release checklist impact

None beyond the standard: `npx vitest run`, `npx tsc --noEmit`,
`npx vite build` (driver is small; eager-bundle size should not move
meaningfully).
