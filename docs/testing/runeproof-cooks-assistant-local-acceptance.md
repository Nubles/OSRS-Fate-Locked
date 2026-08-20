# RuneProof Cook's Assistant local acceptance

This checklist is the release-blocking local acceptance gate for the private RuneProof preview. Complete every scenario in a real browser against the exact build named in the evidence record. Component tests, automated checks, and Codex screenshots are supporting evidence only: **RuneProof must not be released, publicly enabled, merged, deployed, or announced until Alex completes the local visual/playthrough review and explicitly approves it.**

## Test safety and setup

1. Keep any real run closed. Open the profile switcher, choose `New Profile`, and create a disposable profile named `RuneProof QA <date>`.
2. Confirm the new QA profile is active before importing anything. The Sync Code import overwrites the current profile.
3. Obtain the prepared, non-player QA sync codes for the exact commit under test from the ignored local handoff `.superpowers/sdd/2026-08-20-runeproof-cooks-assistant-coach/task-9-sync-fixtures.md`. Do not copy those payloads into this tracked document:
   - **Fresh:** run ID `00000000-0000-4000-8000-000000000901`; new Vanilla Cook's Assistant run with no RuneProof action or item confirmations.
   - **Mill available:** run ID `00000000-0000-4000-8000-000000000903`; Chunked mode with `50,51` and `49,51` explicitly unlocked (`50,50` is the free start chunk); Cook's Assistant incomplete.
   - **Mill blocked:** run ID `00000000-0000-4000-8000-000000000902`; Chunked mode with `50,51` explicitly unlocked and `49,51` unavailable (`50,50` is the free start chunk); Cook's Assistant incomplete.
4. Load each deterministic state only through the app: open `Sync Code`, choose `Import`, paste the prepared code, choose `Verify code`, inspect the decoded run summary, then choose `Import & overwrite this profile` and accept the warning. Do not inspect, edit, seed, or delete browser `localStorage` directly.
5. Use a fresh disposable QA profile (or a newly imported QA run with a distinct run ID) whenever a scenario calls for a fresh run. RuneProof confirmations are deliberately isolated by run ID.
6. After testing, switch to a different profile before deleting the disposable QA profile. Never delete the only profile or the active profile.

Record the commit, local URL, browser, and exact QA-state identifiers without pasting the sync-code payloads into this repository:

| Field | Value |
|---|---|
| Commit | `4d4f34c7906396b0ea918cedbf25c93c29a69a56` |
| Normal-build URL | `http://127.0.0.1:4174/` |
| Preview-build URL | `http://127.0.0.1:4175/` |
| Browser/version | Codex in-app Browser (Chromium; browser runtime `26.818.21641`) |
| Fresh QA state ID | `00000000-0000-4000-8000-000000000901` |
| Mill-available QA state ID | `00000000-0000-4000-8000-000000000903` |
| Mill-blocked QA state ID | `00000000-0000-4000-8000-000000000902` |
| Tester/date | Codex supporting review / 2026-08-20 |

## Reviewed route text

The route timeline must preserve this exact order and player-visible wording:

1. `Talk to the Cook in Lumbridge Castle.` — chunk `50,50`
2. `Pick up the empty pot beside the Cook in Lumbridge Castle.` — chunk `50,50`
3. `Pick up the bucket from the Lumbridge Castle cellar.` — chunk `50,50`
4. `Use the bucket on a dairy cow in the Lumbridge cow field.` — chunk `50,51`
5. `Pick up the egg at the chicken farm beside the cow field.` — chunk `50,51`
6. `Pick grain outside Mill Lane Mill.` — chunk `49,51`
7. `Use the grain in Mill Lane Mill and collect the flour in the pot.` — chunk `49,51`
8. `Return to the Cook with the bucket of milk, egg, and pot of flour.` — chunk `50,50`
9. `Cook's Assistant complete.` — chunk `50,50`

The main journey must use only these reviewed instructions. Generic resolver output is evidence under `Other legal sources`; it must never replace or reorder this route.

## Eleven required scenarios

For each scenario, mark `PASS` or `FAIL`, record the build and QA state used, and link the screenshot or short note that proves the result. A scenario is not passed by DOM text alone: inspect visible hierarchy, scrolling, overlap, focus order, responsive behavior, and the actual interaction.

### 1. Normal build remains Goal Planner

- [ ] PASS  [ ] FAIL
- Open the **normal build** with the preview flag absent, then inspect the Dashboard and open the planner.
- The Dashboard entry must say exactly `Goal Planner` and its tooltip/title must remain `Plan the route to any quest, diary, or region`.
- The modal keeps the ordinary `Goal Planner` heading and `Pick a target — get the full ordered roadmap to unlock it.` introduction.
- There must be no `RuneProof` Dashboard entry, no `Next action` coach, and no private proof wording such as `Proof and sources`, `Wiki revision:`, `Revision captured:`, `Chunk Picker:`, `Reviewed source wording`, or `Route diagnostics`.
- Evidence/result: **Codex supporting review PASS.** The normal build retained the ordinary Goal Planner and contained none of the private RuneProof coach/proof surface. Screenshot: `C:\Users\alexa\.codex\visualizations\2026\08\20\01a01f71-5756-78e1-9440-0f7a4df332f9\runeproof-cooks-assistant\normal-goal-planner-final.jpg`. Alex's PASS/FAIL boxes remain intentionally blank.

### 2. Fresh preview run has one next action

- [ ] PASS  [ ] FAIL
- Load the **Fresh** QA state in the **preview build** and select the Dashboard entry `RuneProof`. With no explicit target, the workspace must open on `Cook's Assistant`.
- `Next action` appears before `Route`. Its single current card must show `Do now` and exactly `Talk to the Cook in Lumbridge Castle.`
- The progress reads `0/9 complete`. Every later route row is `Available next`; no later action is presented as a second current action.
- The current card exposes `Show on map` and `Mark action complete`; timeline rows do not duplicate these controls.
- Evidence/result (capture the fresh next-action view): **Codex supporting review PASS.** Fresh import opened Cook's Assistant at `0/9 complete` with one `Do now` card for `Talk to the Cook in Lumbridge Castle.` Screenshot: `C:\Users\alexa\.codex\visualizations\2026\08\20\01a01f71-5756-78e1-9440-0f7a4df332f9\runeproof-cooks-assistant\fresh-coach-final.jpg`. Alex's PASS/FAIL boxes remain intentionally blank.

### 3. Manual progression advances one step and survives reload

- [ ] PASS  [ ] FAIL
- Starting from the Fresh state, use only `Mark action complete` for each current manual action.
- Confirming `Talk to the Cook in Lumbridge Castle.` advances exactly once to `Pick up the empty pot beside the Cook in Lumbridge Castle.` and changes the first row to `Completed`.
- Confirming the pot advances exactly once to `Pick up the bucket from the Lumbridge Castle cellar.`; confirming the bucket advances exactly once to the milk action.
- Continue the same check when `Pick grain outside Mill Lane Mill.` and `Return to the Cook with the bucket of milk, egg, and pot of flour.` become current.
- After each manual confirmation, reload the page, reopen `RuneProof`, and verify that the same next action and completed count return. A confirmation must not change canonical quest completion, unlock unrelated actions, or advance two steps.
- Evidence/result: **Codex supporting review PASS.** The coach advanced one action per confirmation through the manual route, and reload/remount checks restored the same completed count and next action from the run-scoped preview store without changing canonical quest completion. Alex's PASS/FAIL boxes remain intentionally blank.

### 4. Ingredient confirmation closes the relevant prerequisite chain

- [ ] PASS  [ ] FAIL
- Reach each item-backed action through the normal coach journey, then use its `Mark action complete` control:
  - milk: `Use the bucket on a dairy cow in the Lumbridge cow field.`
  - egg: `Pick up the egg at the chicken farm beside the cow field.`
  - flour: `Use the grain in Mill Lane Mill and collect the flour in the pot.`
- Each confirmation must mark that ingredient action `Completed`, conservatively close only its transitive prerequisite chain, update the completed count, and select exactly the first remaining incomplete action.
- Reload after each confirmation and verify the item-backed progress survives. No ingredient confirmation may mark `Cook's Assistant complete.` or an unrelated branch complete.
- Evidence/result: **Codex supporting review PASS.** Milk, egg, and flour confirmations advanced only their relevant Cook chain, survived remount/reload coverage, and did not complete the quest or unrelated branches. Alex's PASS/FAIL boxes remain intentionally blank.

### 5. Available Mill Lane route outranks Black Knight

- [ ] PASS  [ ] FAIL
- Import the **Mill available** QA state, then use the visible confirmation controls to reach the grain step.
- The primary `Next action` must be `Pick grain outside Mill Lane Mill.` with location/method information for the reviewed local route. `Black Knight` must not appear anywhere in the main journey.
- Open `Other legal sources` only after confirming the primary route is correct. `Black Knight` may appear there as a secondary flour source, never as the recommendation.
- Confirm the grain action. The next primary action must be exactly `Use the grain in Mill Lane Mill and collect the flour in the pot.`
- Collapse alternatives and confirm the primary Mill Lane instructions remain unchanged.
- Evidence/result (capture the available Mill Lane flour route and the separately opened alternatives): **Codex supporting review PASS.** At `5/9`, `Pick grain outside Mill Lane Mill.` was the primary `Do now` action with the reviewed `Mill Lane Mill` method. `Black Knight` appeared exactly once only after opening alternatives; the internal `milk-cow` identifier was absent. Screenshots: `C:\Users\alexa\.codex\visualizations\2026\08\20\01a01f71-5756-78e1-9440-0f7a4df332f9\runeproof-cooks-assistant\available-mill-final-commit.jpg`, `C:\Users\alexa\.codex\visualizations\2026\08\20\01a01f71-5756-78e1-9440-0f7a4df332f9\runeproof-cooks-assistant\mill-lane-primary-final.jpg`, and `C:\Users\alexa\.codex\visualizations\2026\08\20\01a01f71-5756-78e1-9440-0f7a4df332f9\runeproof-cooks-assistant\black-knight-secondary-final-commit.jpg`. Alex's PASS/FAIL boxes remain intentionally blank.

### 6. Blocked mill explains chunk `49,51` before alternatives

- [ ] PASS  [ ] FAIL
- Import the **Mill blocked** QA state, then use the visible confirmation controls to reach the grain step.
- The one current card must show `Blocked`, `Pick grain outside Mill Lane Mill.`, and exactly `Unlock chunk 49,51 to use Mill Lane Mill.`
- The blocker must be visible in the primary next-action card before the collapsed `Other legal sources` disclosure. The disclosure must not open automatically.
- Only after opening `Other legal sources` may `Black Knight` appear as a secondary source. It must not erase, replace, or visually outrank the `49,51` blocker.
- Evidence/result (capture the blocked-mill explanation before opening alternatives): **Codex supporting review PASS.** The primary card was visibly `Blocked` and showed exactly `Unlock chunk 49,51 to use Mill Lane Mill.` before the closed alternatives disclosure. Screenshot: `C:\Users\alexa\.codex\visualizations\2026\08\20\01a01f71-5756-78e1-9440-0f7a4df332f9\runeproof-cooks-assistant\blocked-mill-final-commit.jpg`. Alex's PASS/FAIL boxes remain intentionally blank.

### 7. Proof and sources stay hidden until requested

- [ ] PASS  [ ] FAIL
- In the Cook's Assistant coach, leave `Proof and sources` collapsed. The primary journey must not expose raw Wiki wording, route diagnostics, revision metadata, or Chunk Picker metadata.
- Open `Proof and sources`. The drawer must then show these exact review anchors:
  - `Wiki revision: 15238952`
  - `Revision captured: 2026-06-24T23:03:17Z`
  - `Wiki licence: CC BY-NC-SA 3.0`
  - `Chunk Picker: source-chunk/chunk-picker-v2; commit ba2fcebf8b26c84c74f8d9ab328a0ede802be926`
  - `Chunk Picker reuse status: UNVERIFIED`
  - headings `Reviewed source wording` and `Route diagnostics`
- Close the drawer and verify the technical material disappears without changing the current action.
- Evidence/result (capture collapsed and opened proof states): **Codex supporting review PASS.** Technical proof stayed out of the main journey while collapsed; opening the disclosure showed the exact Wiki revision/date/licence, Chunk Picker commit/reuse status, reviewed wording, and route diagnostics, then closed without changing progress. Screenshot: `C:\Users\alexa\.codex\visualizations\2026\08\20\01a01f71-5756-78e1-9440-0f7a4df332f9\runeproof-cooks-assistant\proof-final.jpg`. Alex's PASS/FAIL boxes remain intentionally blank.

### 8. Current-action map handoff uses the reviewed chunk

- [ ] PASS  [ ] FAIL
- On a current action with a reviewed location, choose `Show on map`.
- RuneProof must close and the world map must open on that action's exact reviewed chunk. Verify at least the fresh action (`50,50`) and one Mill Lane action (`49,51`); the cow/egg actions map to `50,51`.
- Return to RuneProof and verify the action/progress state is unchanged by map navigation.
- A malformed, missing, or unrelated chunk must never create a map button or send the player to a guessed location.
- Evidence/result (capture the map handoff and selected chunk): **Codex supporting review PASS.** Fresh Cook mapped to `50,50`; the blocked Mill action mapped to the selected `Lumbridge Mill`, `chunk (49, 51)`, visibly `Locked`, with the coach progress preserved. Screenshots: `C:\Users\alexa\.codex\visualizations\2026\08\20\01a01f71-5756-78e1-9440-0f7a4df332f9\runeproof-cooks-assistant\map-handoff-50-50.png` and `C:\Users\alexa\.codex\visualizations\2026\08\20\01a01f71-5756-78e1-9440-0f7a4df332f9\runeproof-cooks-assistant\mill-map-handoff-final-commit.jpg`. Alex's PASS/FAIL boxes remain intentionally blank.

### 9. Daddy's Home remains the ordinary planner

- [ ] PASS  [ ] FAIL
- In the preview build, use the target picker to select `Daddy's Home`.
- The ordinary planner must show the `Daddy's Home` target and its existing prerequisites/route behavior. It must not show the Cook's Assistant strategy coach, `Next action`, the nine-step Cook route, or Cook progress.
- Switch back to `Cook's Assistant`; the RuneProof coach must return without stale Daddy's Home content.
- Evidence/result (capture the unsupported-target fallback): **Codex supporting review PASS.** Daddy's Home used the existing ordinary planner with no Cook coach or nine-step route; switching back restored the Cook coach without stale Daddy's Home content. Screenshot: `C:\Users\alexa\.codex\visualizations\2026\08\20\01a01f71-5756-78e1-9440-0f7a4df332f9\runeproof-cooks-assistant\daddys-home-final.jpg`. Alex's PASS/FAIL boxes remain intentionally blank.

### 10. Mobile layout at 390 × 844

- [ ] PASS  [ ] FAIL
- Set the viewport to exactly **390 × 844** and open the Cook's Assistant coach.
- `Next action` must visibly precede `Route`. The primary instruction, state, progress, and controls must fit without clipping or horizontal overflow.
- Verify `Change objective`, `Show on map`, `Mark action complete`, `Other legal sources`, `Proof and sources`, and `Close` remain reachable by scrolling and keyboard focus. Opening the mobile target picker must not cover or strand the close control.
- Expand the current route row, alternatives, and proof in turn. Text must wrap, disclosure content must stay within the viewport, and the page behind the modal must not become the scrolling surface.
- Evidence/result (capture the fresh mobile next-action view): **Codex supporting review PASS.** At exactly `390x844`, the dialog and root were width-clean, the document behind the modal was locked, and vertical scrolling moved only the coach surface while all controls/disclosures remained reachable. Screenshot: `C:\Users\alexa\.codex\visualizations\2026\08\20\01a01f71-5756-78e1-9440-0f7a4df332f9\runeproof-cooks-assistant\fresh-mobile-final-390x844-scroll-locked.jpg`. Alex's PASS/FAIL boxes remain intentionally blank.

### 11. Desktop layout at 1440 × 900

- [ ] PASS  [ ] FAIL
- Set the viewport to exactly **1440 × 900** and open the Cook's Assistant coach.
- The visible hierarchy must read, in order: `RuneProof`, `Cook's Assistant`, recommendation/progress, `Next action`, `Route`, `Other legal sources`, then `Proof and sources`.
- The target picker should occupy roughly one third of the workspace and must not dominate the coach. The coach must have enough width for readable instructions, while the modal remains fully on-screen.
- Inspect scrolling, overlap, focus indication, contrast, expanded disclosures, and the close control. No content may be cut off or require horizontal scrolling.
- Evidence/result (capture the fresh desktop next-action view): **Codex supporting review PASS.** At exactly `1440x900`, the target list and coach retained the required hierarchy, readable proportions, internal scrolling, visible focus/controls, and no horizontal overflow. Screenshot: `C:\Users\alexa\.codex\visualizations\2026\08\20\01a01f71-5756-78e1-9440-0f7a4df332f9\runeproof-cooks-assistant\fresh-desktop-final-1440x900-scroll-locked.jpg`. Alex's PASS/FAIL boxes remain intentionally blank.

## Required visual evidence

Attach or link screenshots for all of the following, with commit and viewport in the filename or evidence note:

- desktop fresh next-action view at `1440x900`;
- mobile fresh next-action view at `390x844`;
- available Mill Lane flour route (primary journey visible);
- blocked-mill explanation before alternatives open;
- proof drawer open;
- Daddy's Home ordinary-planner fallback;
- map handoff showing a reviewed chunk.

## Sign-off

| Gate | Status | Tester | Evidence/notes |
|---|---|---|---|
| All eleven real-browser scenarios | **CODEX SUPPORTING REVIEW PASS; ALEX RUN REQUIRED** | Codex | All eleven scenarios exercised locally against the normal/preview builds above; the unchecked scenario boxes are reserved for Alex's independent run. |
| Automated gates for the same commit | **PASS** | Codex | Serial suite: 227 files / 2,754 tests; typecheck, walkthrough verification, content verification, preview build, and normal OFF build passed. `data/modelManifest.ts` remained unchanged. |
| Codex visual review | **PASS** | Codex | Exact mobile and desktop viewports, primary/blocked routes, compact alternatives, proof, Daddy's Home fallback, and reviewed map handoffs inspected; browser console was clean. |
| Alex local visual/playthrough approval | **REQUIRED — NOT GRANTED** | Alex | |

Known limitations, deviations, or failures:

- Codex evidence is supporting review only and does not replace Alex's local visual/playthrough pass. Release remains blocked until Alex marks all eleven scenarios and explicitly approves it.
- The first concurrent Windows test runs exposed unrelated five-second timeout contention; the required full suite passed serially with all 2,754 tests.
- Earlier in the session, Windows security blocked repeated PowerShell activity under the heuristic `CMD:Heur.BZC.ZFV.Boxter.957.B82FC004`. Work paused, then resumed using Command Prompt only; the warning did not recur and no antivirus exclusion or security setting was changed.
