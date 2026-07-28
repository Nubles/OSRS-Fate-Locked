# Mandatory Player-Facing What's New Design

## Goal

Correct the missing 28 July 2026 RuneLite companion release entry and make
future player-facing pull requests fail CI when they do not update the authored
What's New history.

## Current release entry

Add a newest-first release named **RuneLite Companion Update**, dated
2026-07-28. It will tell players that:

- the companion now provides a guided RuneLite connection flow with one
  copyable pairing command;
- RuneLite reads run rules from the companion while detected gameplay events
  remain local to RuneLite;
- the complete plugin experience is presented in one panel with collapsible
  sections;
- clipped and overlapping RuneLite controls were corrected; and
- run balances are labelled **Keys**, **Omni Keys**, and **Chaos Keys**.

The entry describes the combined player-facing companion and RuneLite update
without claiming that RuneLite Plugin Hub review is already complete.

## Enforced rule

Add a small deterministic verification command that compares the current
branch with its base revision and classifies changed paths.

Player-facing production paths include the application entry points and code
under `components/`, `data/`, `hooks/`, `services/`, `utils/`, `workers/`, and
`public/`, together with root styles and shared player-facing constants/types.

The following are not player-facing by themselves:

- tests and test fixtures;
- documentation;
- GitHub workflow configuration;
- maintainer scripts and development configuration.

When at least one player-facing production path changes,
`data/changelog.ts` must also change. A missing changelog edit exits with a
clear failure message naming the player-facing files. Documentation-only,
test-only, and internal-tooling pull requests pass without a release entry.

The command includes committed, staged, and unstaged paths for useful local
checks. CI supplies the pull request base commit and uses complete Git history
so the comparison is deterministic.

## Integration

- Add `npm run changelog:verify`.
- Run it in pull-request CI before the existing test, type-check, content, and
  build gates.
- Include it in `npm run release:verify`.
- Add the rule to the maintainer release checklist.

The deployment workflow remains unchanged: it deploys only reviewed pushes to
`main`. The pull-request gate prevents a player-facing change from reaching
that workflow without an authored release entry.

## Test strategy

Write the enforcement tests before implementation:

- a player-facing source edit without `data/changelog.ts` fails;
- the same edit with `data/changelog.ts` passes;
- test-, documentation-, and internal-tooling-only changes pass;
- path normalization works for Windows and POSIX separators;
- CI checks out full history and runs the changelog gate in the required order;
- the local release command includes the gate; and
- the new authored entry is latest and contains the approved player wording.

Then run the focused tests, the entire test suite, TypeScript, deterministic
content verification, the production build, and whitespace checks.

## Release

Publish this as a focused companion-app pull request. After CI succeeds, merge
it to `main`, wait for GitHub Pages deployment, and confirm both the live app
and `version.json`. The already-open RuneLite Plugin Hub submission remains a
separate review process and does not need a new plugin commit for this
companion-only release safeguard.
