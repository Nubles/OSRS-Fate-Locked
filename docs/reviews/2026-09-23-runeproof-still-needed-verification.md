# RuneProof Still needed summary

23 September 2026. Local preview at `http://127.0.0.1:51945/`; no deployment.

Added a compact gold summary before progress and the walkthrough. Each requirement
has a readable label and links to affected steps. Known requirements, items, and
unverified conditions are distinguished in words and icons. The summary derives
from the existing model and disappears when no remaining needs are represented;
this is not a claim that the whole quest is ready.

Vanilla Restless Ghost at Neck T0 shows one Neck T1 entry linked to step 3. The
completion duplicate is suppressed; when the earlier wear step was already checked,
the unmet final equipment guard remains visible at step 7. Neck T1 removes the
entry. Links scroll/focus the step without checking it off or changing the Journal.

Verification:

- 10 pure-helper tests passed, including real materialized Vanilla accounts,
  deduplication, completed steps, unknown quest stages, travel conditions, stable
  identifiers, optional coordinates, and unrelated completion conditions.
- 9 Vanilla guide UI tests passed, including step navigation, T0/T1 updates,
  uncertainty labels, equipment guards, maps, and existing controls.
- Type checking and the production build passed; the existing large-bundle warning
  remains. No Chunked or mixed-mode suite was executed.
- Desktop and 390 x 844 browser inspection passed. The summary was visible near
  the title, its link focused `the-restless-ghost:talk-to-ghost`, and saved progress
  stayed at 1/7. At 390px viewport width, document width stayed 390px.
- Normal viewport restored and the Vanilla Preview guide left open at its title.
  Browser warning/error log was empty. No save or Journal changes were made.

Review/test findings fixed before completion: aggregate equipment initially
reappeared as a completion CHECK entry; unverified QUEST_PROGRESS needed CHECK
classification; the installed icon library exports HelpCircle rather than
CircleHelp (the latter produced an invalid-element render error). Regression
checks now pass. No new quest facts or source data were introduced.
