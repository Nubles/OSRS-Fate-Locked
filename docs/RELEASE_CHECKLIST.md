# Web release verification checklist

Use this checklist for every reviewed web-app release. It is the detailed
handoff referenced by the roadmap; live OSRS Wiki maintenance remains a
separate operation.

## Local release gate

1. If dependency metadata changed, use the committed lockfile to prove a clean
   install:

   ```powershell
   npm ci --no-audit --no-fund
   ```

   CI runs on Node.js 22. Use Node.js 22 when reproducing the runner exactly,
   and review any dependency-metadata diff before continuing. A registry or
   network failure is not a reason to rewrite the lockfile.

2. For every player-facing change, add a newest-first entry to
   `data/changelog.ts`, then run `npm run changelog:verify`. Tests,
   documentation, workflows, and maintainer-only scripts are exempt when they
   are the only files changed.
3. Run the full test suite.
4. Run the TypeScript check.
5. Run deterministic content verification.
6. Build with the production repository base when reproducing GitHub Pages
   exactly.

   ```powershell
   npm run changelog:verify
   npm test
   npx tsc --noEmit
   npm run content:verify
   $env:VITE_BASE='/OSRS-Fate-Locked/'
   npm run build
   ```

7. Review whitespace, generated data, scope, and secrets before pushing:

   - Run `git diff --check`.
   - Review the generated-data diff and confirm that generated data was updated
     through its committed source snapshot and generator, never by hand.
   - Confirm the change contains only the intended project scope.
   - Check that no save data, tokens, credentials, webhooks, or environment
     dumps are present.

8. Push the branch and wait for the actual GitHub check named `CI / quality`
   to finish successfully. A local green run does not replace that result.
9. After the workflow first appears on GitHub, a repository maintainer manually
   enables branch protection and requires `CI / quality` before merge. This
   project change does not alter repository settings automatically.

## Content command boundaries

`content:verify` is the offline, deterministic, read-only release gate. It
validates committed data and generated output without contacting the Wiki or
changing the worktree.

`content:check` is the network-backed freshness inspection. It can contact the
live OSRS Wiki and update `docs/SYNC_STATUS.md`, so it is explicit maintenance
work and is not a required release gate. Source refreshes and `content:sync`,
`diary:sync`, or `ca:sync` also remain separate, reviewed maintenance
operations.

## Deployment protection

The Pages workflow accepts pushes to main only and exposes no manual dispatch.
Workflow-level permissions are read-only; Pages and OIDC write permissions are
scoped to the deploy job. Artifact upload occurs only after install, tests, type
checking, deterministic content verification, and build all succeed, and the
deploy job depends on that gated build job.
