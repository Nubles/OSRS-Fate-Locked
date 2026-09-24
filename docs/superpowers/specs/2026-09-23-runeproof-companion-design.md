# RuneProof companion redesign

Status: the five-guide local application slice is implemented and verified. Authorized by the user's “Ok proceed” after the Wiki-style guide rollout proposal. Public deployment and additional quest publication remain separate. See [implementation verification](../../reviews/2026-09-23-runeproof-wiki-guide-verification.md).

## Current implementation slice

Follow-up: the [walking route correction](2026-09-23-runeproof-walking-routes-design.md)
supersedes the initial unconditional travel warning with account-specific paths,
transit chunks and concrete conditions for the five public guide revisions.

Implement Details, separate Fate restrictions, the full ordered Walkthrough and Rewards in the local app for the five public guides, with Restless Ghost as the reference. Include quick/detailed reading, per-step destination access, deduplicated chunk references, existing map geometry, run-scoped selection and checklist, and explicit Undo of the last confirmation. Reuse the existing rules and checked source facts. Unreviewed travel stays visible as needing checking. Broader recovery navigation and additional quest packs are later work; this slice must not promise those controls.

## Decision

Make RuneProof a dedicated quest companion organized like an OSRS Wiki quest guide: preparation details, a browsable ordered walkthrough, and rewards. The user clarified that “OSRS style” means how the Wiki orders and treats information, rather than a game-themed visual skin. A current-step focus and useful recovery paths supplement the complete guide; the existing rules engine stays authoritative.

The player should be able to answer within five seconds: what can I do now, where do I do it, and what prevents me from finishing?

## Current problems observed

The local production build was inspected in the browser on 23 September 2026. The current dialog duplicates recommended quests and the searchable catalogue in its sidebar, then repeats the active instruction in an expanded route row. Its 80vh container and small text make the player scroll before understanding the journey. The map opens a second dialog. A mistaken checkmark has no visible undo. Equipment blockers now correctly stop readiness, but their recovery path is still mostly explanatory text.

The guide needs a clear document structure as well as a useful current action. Adding more panels to the current modal will not achieve that intent. The new workspace should make preparation, route context and recovery easy to find without hiding the walkthrough.

## Wiki-style information architecture

The default guide is a readable document with a contents list and this order:

1. **Details:** start point, difficulty and length, official OSRS requirements, required items, recommendations, and enemies encountered.
2. **Walkthrough:** named sections in quest order, with concise steps and optional detailed explanations where useful.
3. **Rewards:** source-backed quest rewards, separate from Fate Locked's completion and reward handling.

Preserve the distinctions that make a guide trustworthy: requirements versus recommendations, items to bring versus items obtained during the quest, equipment that must be worn versus items merely carried, and enemies that must be killed versus combat that can be avoided. Keep supported alternatives and exceptions beside the condition or step they modify. Do not bury a usable alternative in a general disclaimer or turn an optional recommendation into a blocker.

Show **Fate Locked checks** as a separate, clearly labeled layer near preparation and again at the relevant step. Neck T1 is a Fate equipment permission; it must not appear as an official OSRS quest requirement. Official requirements and run-specific availability should remain understandable independently.

The full route is visible and browsable by default. Contents links and a Continue at my next step control help navigation; an optional current-step focus must not replace access to the document. Only include dialogue option numbers, exact map markers and route details when reviewed source data supports them. Keep readable 15–16px body text, responsive layouts, visible keyboard focus and 44px touch targets. This is an information-architecture direction, not a demand for an exact visual copy of the Wiki.

## Proposed experience

### Next up

One catalogue, with a saved Continue choice first, then a few useful recommendations. A recommendation states its actual reason: ready with current unlocks, preparation possible, or a named missing condition. Search and the full reviewed catalogue are available on demand. Opening a current guide hides the catalogue until Choose another quest is requested.

Use separate meanings for Can finish, Can prepare, Needs an unlock, and Needs checking. Do not call an entire quest ready merely because its first action is possible. Unknown source coverage remains visible and never silently becomes ready.

### My guide

Use a dedicated app workspace rather than stacking modals. Keep the quest title, contents and guide progress easy to find. Open the complete Details → Walkthrough → Rewards document by default, with a Continue at my next step control that scrolls to the saved action. Optional focus mode presents that action clearly and retains an obvious return to the full guide.

Each walkthrough section presents concise ordered instructions, the relevant place names and supplies, and supported alternatives or exceptions inline. Expandable explanations may add context without hiding the basic route. Optional confirmation controls use specific labels such as I have the pot, with Undo last check available when appropriate. Future actions remain readable even when they cannot yet be confirmed; reading ahead is not a claim of readiness.

Place reviewed maps beside their relevant section on desktop and beneath it on mobile. Preserve the action, scroll context and active quest through map use. Show chunk coordinates as secondary detail; never invent an exact NPC/object pin from a chunk rectangle. Keep sources accessible without concealing practical alternatives in the source drawer.

The active quest is persisted per run. Reopening RuneProof resumes it rather than choosing another recommendation. Switching profiles clears the visible old account immediately and restores that run's own selection.

### Chunks at the point of use

Give each step a compact location row: a recognizable place name first, its canonical chunk ID as secondary detail, the surface/basement/instance context, and an explicit access label. Use labels such as Destination unlocked, Needs chunk unlock, or Needs checking rather than an unexplained green dot. A step involving several locations lists the reviewed destinations it actually needs. A blocked destination is explained at that step even when preparation already lists it.

Preparation includes a deduplicated list of destination chunks, with links to every affected step. Keep the place and interior context attached to those links so shared chunk IDs do not erase meaningful location differences. Present alternative destinations as “one of” choices; preserve “all of” groups where several destinations are mandatory. Do not flatten optional branches into a checklist that implies every alternative must be unlocked.

Keep destination access separate from travel access. Show route or transit chunks in a separate optional section only where reviewed evidence identifies them. Unlocking the destination alone does not prove that the player can legally reach it. Missing route coverage says Needs checking and prevents a claim that the full quest is ready; do not invent connecting chunks, routes, pins, or completeness counts. An underground or instanced destination must retain its reviewed entrance and access relationship rather than inheriting an assumed surface route.

Show on map uses the application's existing map and actual reviewed geometry, highlighting a chunk area unless an exact location is supported. Opening and returning from the map preserves the guide, active step, scroll position and keyboard focus. The concept may explain this behavior, but must not present fabricated geometry as an implemented map.

### A useful blocked state

At a blocked action, replace its completion control with a specific recovery card: what is missing, why this action needs it, and where the player can work on it. Keep the rest of the guide readable. Identify whether the condition comes from the quest itself, the player's Fate Locked rules, or missing evidence. Examples:

- Neck T1 → explain wearing the ghostspeak amulet, track the unlock, and offer a different ready quest.
- Missing item → show the reviewed acquisition method, with I already have it as a scoped manual confirmation.
- Missing quest → open that prerequisite without losing the parent goal.
- Missing chunk → show its reviewed area and the legal route/unlock context.
- Unknown condition → ask the precise confirmation or explain the source gap.

Use structured eligibility and route blockers to choose these actions. Never parse flattened display text to decide navigation. Equipment rolls remain random; the interface must not imply that a particular slot is guaranteed or silently spend a key.

Allow legal preparation before a blocker. Restless Ghost may start and supply the amulet while Neck remains locked; the wear action is blocked. When Neck T1 arrives, re-evaluate and continue at the saved action.

### Progress the player can trust

Guide checks, inventory confirmations and actual quest completion are distinct. Keep explanations close to the relevant control without repeating technical caveats on every row. No unsupported live tracking or automatic Journal completion.

Undo records an explicit confirmation transaction (scope, action/item, previous value), not an inferred completed step. Recompute dependencies after reverting it. An already verified Journal completion stays complete. Finishing a guide offers the separate Journal review action; it does not grant Keys, Fate, rewards, unlocks or sync events.

## Interactive concept

The revised conversation concept uses The Restless Ghost to demonstrate the Wiki-style structure: Details, preparation, ordered walkthrough sections and Rewards, with a contents list and separate Fate Locked checks. A Neck T1 blocker belongs beside the required wear action as well as in preparation. The concept's purpose is to demonstrate information treatment and navigation; it does not certify all quest content or prove application behavior.

The next prototype target is `runeproof-wiki-chunks.html`, extending that structure with preparation destination summaries and per-step location/access rows. Its map treatment and access claims must follow the evidence boundaries above. Verification of this new prototype is recorded separately once performed; earlier prototype checks do not cover it.

Any example account selector or confirmation state belongs only to the prototype, not the live profile or a proposed unlock shortcut. Do not simulate unsupported catalogue entries, exact map geometry or unreviewed dialogue numbers. The earlier companion and game-themed prototypes are historical explorations, superseded where they conflict with this document.

## Implementation boundaries

Reuse the reviewed strategy packs, canonical eligibility, action dependency evaluator, account/cache identities, item resolver, chunk geometry, source drawer and run-scoped confirmation hooks. Keep the public/private guide release boundary and the existing planner for unsupported goals.

Add a small presentation adapter for the guide document and readiness/recovery actions, a run-scoped active quest preference, and explicit undo transactions. Refactor the workspace and coach presentation while retaining reviewed guide facts and their provenance. Do not replace the source/rules engine, invent quest instructions, add an AI-generated route system, guess travel times, or bundle unpublished quest packs. Distinctions absent from the current data need reviewed structured fields before the interface can assert them.

Build incrementally:

1. Replace the modal presentation for the current public guides with Details, a full browsable Walkthrough, Rewards and contents navigation; add resume and a single catalogue. Validate the preparation categories and source-backed route treatment with The Restless Ghost.
2. Add the separate Fate Locked check layer, structured recovery actions and safe undo. Validate Restless Ghost at Neck T0/T1, including allowed preparation and the blocked wear step. Validate Cook's Assistant from selection through completion review.
3. Add optional current-step focus and integrate the existing map responsively without losing full-guide access. Add item alternatives only where reviewed data supports them.

## Acceptance checks

- At 1440×900 and 390×844, Details, Walkthrough and Rewards are readable and contents navigation reaches each section without hiding controls under overlays. Body text approximately 15–16px; touch targets at least 44px.
- One quest picker; the full route is browsable by default. Continue at my next step and optional focus mode preserve access to the complete guide without duplicating the current-action card.
- Official requirements, recommendations, brought items, quest-acquired items, worn equipment, carried items, mandatory kills and avoidable combat retain their distinct meanings. Supported alternatives and exceptions appear at the relevant point.
- Fate Locked checks are clearly separated from official OSRS requirements and repeated only where they help explain an affected action. Displayed dialogue numbers and exact map pins have reviewed source support.
- Each step's location row shows a recognizable place name, canonical chunk ID, surface/basement/instance context and an explicit access label. Missing location evidence remains Needs checking.
- Preparation deduplicates destination chunks and links to all affected steps; a missing destination remains visible at its affected step. Alternative destinations preserve one-of versus all-of requirements.
- Evidenced route/transit chunks remain separate from destination chunks. An unlocked destination with unreviewed travel coverage does not make the full quest ready, and no route or completeness count is guessed.
- Show on map uses actual existing geometry and preserves the guide's active step, scroll position and keyboard focus on return. Exact pins appear only when supported.
- Reload and map return preserve the active quest/action, isolated per profile/run.
- At Neck T0, earlier Restless Ghost preparation remains actionable, the wear step has no completion control, and quest completion is blocked. Unlocking Neck T1 removes only that blocker.
- A blocked prerequisite offers the correct recovery destination. Missing data remains Needs checking.
- Undo reverses only the last explicit guide/item confirmation and re-evaluates dependent work. It never reverses canonical Journal progress.
- Guide completion does not change rewards, unlocks, history, exports or plugin permissions.
- Keyboard access, focus restoration, labels, loading/error states and narrow layouts are verified in the real browser.
- The complete test suite, typecheck, content verification and production build must pass after application implementation. A prototype is not evidence of implementation correctness.

## Concept verification history

The `runeproof-wiki-chunks.html` extension was checked on 23 September 2026. Its six displayed actions use the current public Restless Ghost destination mappings: church 50,50; Urhney 49,49; graveyard 50,49; Tower basement via 48,49. The preparation summary deduplicates four destinations; it explicitly leaves transit coverage as Needs checking. A simulated Tower lock hides the step 4 confirmation, marks the destination locked in both locations, and leaves earlier preparation accessible. Unlocking it enables the guide check without claiming verified travel; confirmation and Undo restore the expected progress. Neck T0 continues to block the earlier wearing step independently. The basement explanation expands correctly, Continue focuses the blocker's requirement link, and the desktop and 320px layouts were inspected with no article overflow or browser warnings/errors. The prototype's chunk links navigate within the article; map integration remains proposed. No application code or save state changed.

The corrected `runeproof-wiki-guide.html` concept was checked in the browser on 23 September 2026. It presents Details, separate Fate restrictions, the full Ghost speak / Freeing the ghost walkthrough, and Rewards. The saved OSRS Wiki revision 15331162 supports the example quest facts. Quick and detailed reading modes preserve the route order. At Neck T0, acquiring the amulet remains possible while the wear action has no confirmation control; changing the example to T1 enables that action. Confirming and undoing the action restored the expected progress. Continue moves keyboard focus to the current checkbox or the blocked step's requirement link, and the current step has both a visible label and `aria-current="step"`. Desktop, 390px and 320px layouts were inspected; the article had no horizontal overflow and the browser reported no warnings or errors. This is concept validation only, not application implementation or release evidence.

The earlier companion prototype passed JavaScript syntax validation and browser checks for starting a guide, confirming a step, undoing it, explaining the Neck blocker, and continuing the saved guide after a simulated Neck T1 unlock. Reload retained the selected example guide. Layout was inspected at desktop size, 390px and 320px widths; no horizontal content overflow or console warnings/errors remained after a narrow-screen layout correction.

A later parchment-and-stone alternative also passed its recorded desktop and 320px layout checks, but that art direction resulted from misunderstanding the user's request. The user meant the OSRS Wiki's ordering and treatment of information. That mockup is superseded by the Wiki-style direction above. Earlier prototype checks remain historical evidence only; they do not validate the revised concept, certify all quest facts, or establish application implementation correctness. No production source file, live save or running app build was changed for these design proposals.
