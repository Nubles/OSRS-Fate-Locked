# Quest source evidence

This importer collects review material for RuneProof. It does not approve a guide, grant access, change progress, or publish quests. The public five-guide catalogue remains independently authored.

## Read the results

- `docs/reviews/2026-09-23-quest-source-harvest.md`: coverage and unresolved identity matches.
- `data/sources/quest-step-evidence-summary.json`: source hashes and per-helper coverage.
- `data/sources/quest-step-evidence.json.gz`: complete candidate evidence, including expressions, branch order, task dependencies and location candidates.
- `data/sources/quest-step-evidence-review.json`: reviewed Restless Ghost facts, mappings and disagreements.
- `docs/third-party/quest-helper-LICENSE.txt` and `quest-helper-NOTICES.txt`: redistribution notices. The source snapshot also preserves each original file header.

The source snapshot covers Quest Helper's quest and miniquest directories plus the supporting catalogue and requirement classes. Other helper categories, such as diaries, are outside this import. Some files contain supporting classes rather than a quest entry. Counts describe extracted source definitions, not certified complete quests.

## Verify and regenerate

`npm run quest-evidence:verify` checks the pinned source hashes and reproduces the candidate catalogue offline. The normal content verifier includes this check. The complete test suite also checks the reviewed pilot against the public guide.

`npm run quest-evidence:generate` rebuilds the candidate catalogue, summary, notices and report from the pinned sources. Review the diff before accepting new evidence. No network access is needed for generation or verification.

The initial Quest Helper archive was downloaded from the exact commit in RuneLite's Plugin Hub marker. It was inspected as text; no plugin code was built or executed. To recapture that same source, download the immutable archive URL in `data/sources/quest-helper-source.json`, extract it outside the app repository, and run:

```text
npm run quest-evidence:capture -- --source-dir=PATH --marker=PATH --archive=PATH
npm run quest-evidence:generate
npm run quest-evidence:verify
```

The marker must declare the reviewed repository and commit. Capture checks the archive against its pinned SHA-256 and compares every selected local file with the archive entry before writing anything. Offline verification additionally pins the source snapshot hash independently of its manifest. Changing the pin is a deliberate source update: review the licence and supporting APIs, update the reviewed archive/snapshot hashes, capture the new snapshot, regenerate evidence, update reviewed source mappings and rerun tests. Passing extraction never automatically promotes new guides.

## What must remain separate

- **Source section versus plane:** Chunk Picker `12849-1` retains section `1`; it is not interpreted as floor 1. A literal Quest Helper WorldPoint includes a separate physical plane.
- **Exact section gates versus normalized map gates:** raw conditions from the precise Chunk Picker section are retained separately from runtime gates, which may have been combined across sections. Neither silently replaces the other.
- **Physical region versus access chunk:** the Tower altar is in physical `48,149`; existing interior metadata links it to surface access `48,49`.
- **Destination versus travel:** targets and entrances do not verify a path through intervening chunks.
- **Candidate versus requirement:** multiple entity matches and entrances remain alternatives or ambiguities, not an inferred requirement to unlock every candidate.
- **Condition versus instruction:** ordered conditional branches are preserved. A Java expression referring to a varbit, zone, NPC or inventory is not evaluated by the importer.
- **Recommended versus required:** source lists and raw expressions are retained for review. Finding an ItemRequirement alone does not establish that an item is mandatory throughout a quest.

The Restless Ghost review proves location agreement and the worn ghostspeak requirement. It deliberately records the incorrect Urhney recovery-tooltip direction, the missing Chunk Picker worn-item detail, the optional skeleton combat detail and the final coffin wording difference. Broader guides and legal travel paths still need review.
