# Diary Log Valid Interactive Nesting Design

**Date:** 2026-07-26
**Status:** Approved design
**Repository:** `Nubles/OSRS-Fate-Locked`

## Objective

Make each expanded Diary Log task use valid, accessible interactive markup while
preserving its completion, explanation, training, map, and wiki behaviours.

## Evidence and Root Cause

`DiaryLog` currently renders each task row as an outer `<button>`. That outer
button contains the task completion content and, when a task has requirements,
also contains:

- an Old School Wiki `<a>`;
- unmet-skill `<button>` controls that open the training popover; and
- region `<button>` controls that open the relevant map chunk.

HTML does not allow interactive descendants inside a button. It yields invalid
markup and unreliable keyboard/focus behaviour; `stopPropagation` only prevents
the parent click handler at runtime and does not repair the nested semantics.

The outer task button dates to the May 18 Diary Log implementation. The later
manual-attestation commit (`80d3845`) added the attestation import and changed
the task handler to request confirmation, but did not introduce this structure.
The later pool-navigation commit (`2777fa8`) does not touch `DiaryLog`.
Accordingly, this is a pre-existing Diary Log issue rather than a regression
from either change.

## Chosen Design

Render every task as a noninteractive task-row container. Within that container:

1. A clearly labelled native **completion button** contains the checkbox icon,
   task description, and static requirement summary. It is the sole control
   that completes or attests the task.
2. The wiki link is a sibling interactive element, labelled `Open Wiki` (with
   the task name in its accessible name when practical), retaining its external
   link security attributes.
3. Each unmet-skill training control and each mappable-region control is a
   sibling native button. Static, met, or unmappable requirements remain text
   or disabled native controls as appropriate.

The row layout must retain the current visual grouping and responsive wrapping:
the completion button can take the flexible content column, while the wiki and
requirement controls occupy sibling action areas. It must not use a clickable
`div`, `role="button"`, nested controls, or synthetic keyboard handling.

## Behaviour and Accessibility Contract

- The completion button retains `handleTaskToggle`, including evaluation,
  manual-attestation confirmation, cancellation, and the existing completion
  coordinates. A cancelled attestation produces no completion action.
- The completed-tier and completed-task guard remains a native `disabled`
  completion button. Disabled controls are removed from the tab sequence and
  cannot fire through keyboard or pointer activation.
- The completion button has a specific accessible name, for example `Complete
  diary task: Steal a cake`, rather than relying on an icon alone. Its visual
  checkbox/description continues to communicate complete versus incomplete
  state; `aria-pressed` is not needed because this is a one-way completion
  action rather than a toggle.
- Wiki activation only opens the intended safe external link. It does not
  complete a task or expand/collapse a diary.
- Skill activation still records the button rectangle and opens the matching
  training popover. Region activation still shows its mapped chunk; an
  unavailable chunk remains non-actionable/disabled with a useful label.
- Because these controls are siblings, their task-level `stopPropagation`
  calls are no longer required and should be removed. Keep propagation control
  only where a control is genuinely nested beneath another click target; none
  is expected in the revised task row.
- Existing diary-header expand/collapse behaviour is outside this change. Its
  independent controls may retain their own handling until separately designed.

## Rejected Alternatives

**Keep the outer task button and call `stopPropagation`.** This preserves the
invalid DOM and leaves assistive technology/browser behaviour undefined.

**Replace the outer button with a clickable `div`/`role="button"`.** This would
require manual Enter/Space, focus, disabled, and semantics management and is
less reliable than a native completion button.

**Make the wiki, skill, and map affordances noninteractive.** This removes
useful existing navigation/help actions and forces players to lose context.

**Move every control outside the row.** This avoids nesting but weakens the
connection between a task and the requirements it explains. Sibling controls
inside a shared noninteractive row preserve both relation and validity.

## Test and Verification Strategy

Start red with a structural SSR regression in `components/DiaryLog.test.tsx`.
Render the real **`Steal a cake`** diary task through the existing
`renderToStaticMarkup` path and assert that:

- its task-row container is noninteractive;
- its completion control is a native button with the expected accessible label;
- its Wiki anchor and any interactive requirement controls are not descendants
  of that completion button; and
- the generated markup has no task-row button containing an anchor or button.

Use structure-aware markup assertions (scoped to the rendered `Steal a cake`
row) rather than a brittle global string check. The assertion must fail on the
current nesting before implementation, then pass after the layout change.

Keep the existing focused DiaryLog access-evidence test passing and add only
the smallest focused tests needed for the new structure. Run, in order:

1. the focused `DiaryLog` test file;
2. `npm run typecheck`;
3. the full `npm test` suite; and
4. a local browser smoke test with the developer console open: expand the
   `Steal a cake` tier/task, tab through completion/wiki/requirement controls,
   activate each independently, cancel a manual attestation, and confirm no
   console errors or nested-interactive warnings.

## Scope and Non-Goals

The implementation is limited to `components/DiaryLog.tsx` and
`components/DiaryLog.test.tsx` unless direct implementation evidence requires
a narrowly related type or test-helper adjustment. It makes no diary-content,
quest-point, manual-requirement, eligibility, fate-rate, balance, generated
data, save-format, or unlock-pool change.

## Error and Edge Handling

- Empty task descriptions still receive a deterministic completion label (for
  example, `Complete diary task`) rather than an unnamed button.
- A task without requirements renders only the completion control and any
  available Wiki action; no empty action wrapper becomes focusable.
- A completed task/tier leaves supplementary wiki/help controls available when
  they are useful, while completion remains disabled; this matches the current
  ability to inspect completed task details without re-completing them.
- If a training popover or map lookup cannot resolve its requested target, the
  existing component/helper fallback applies and no task completion is
  triggered as a side effect.

## Rollback

The change is confined to presentation markup and a regression test. Reverting
the implementation commit restores the prior layout without affecting saved
completion state or generated content.
