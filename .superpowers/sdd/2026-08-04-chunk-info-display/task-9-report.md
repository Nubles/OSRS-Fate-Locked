# Task 9 Report: Clearer Chunk Info release note

## Status

Complete.

## Commit

`db530cf7d9ca256572be46d024a94051bbc8b5c3` ? `docs: announce clearer chunk info`

## Delivered

- Added the newest-first `2026-08-04-polished-chunk-info` release, titled `Clearer Chunk Info`.
- Added player-facing copy for the availability summary, consolidated Access & facilities card, and readable locked content.
- Updated the changelog tests to retain the August 2 physical-chunk release assertions through an explicit release lookup.

## Verification

- RED: `npx vitest run data/changelog.test.ts` failed as expected before the release was authored: 2 failed assertions identified the missing latest release.
- Focused: `npx vitest run data/changelog.test.ts components/chunk-info components/ChunkActivityPanel.test.tsx components/ChunkActivityPanel.dom.test.tsx` ? passed, 9 files and 49 tests.
- Full suite: `npm test` ? passed, 177 files and 2044 tests.
- TypeScript: `npm run typecheck` ? passed (`tsc --noEmit`).
- Production build: `npm run build` ? passed; generated the Vite production bundle.
- Player-facing release guard: `npm run changelog:verify -- origin/main` ? passed: `What's New verified for 9 player-facing file(s).`
- Whitespace: `git diff --check` and `git diff --cached --check` ? passed.

## Browser smoke

- The local app displayed the new `Clearer Chunk Info` release and its three player-facing notes in the What's New dialog.
- In the Region Map, the default Chunk Info drawer showed visible available/locked totals, readable locked quest names with reasons, and a default-open Quests group; Whole area retained the semantic availability totals.

## Concerns

- Vitest continues to emit existing Vite esbuild/oxc deprecation warnings, and the full suite emits existing Node `--localstorage-file` warnings; no test failures resulted.
- `data/modelManifest.ts` is shown modified after the production build but has no content diff and was not staged. The pre-existing untracked plan at `docs/superpowers/plans/2026-08-04-chunk-info-display.md` was not edited, staged, or removed.

## Final fix wave (post-task-9)

### Delivered

- Restored player-visible count markers to multiplication signs and corrected corrupted tooltip punctuation in the Chunk Info drawer.
- Replaced the old Whole-area ownership hint with an explicit mixed-ownership signal. In non-chunked mode it now derives from every area chunk's sub-area owner (or parent region fallback); chunked Whole-area behavior remains deliberately neutral.
- Removed the unused ChunkActivityPanel imports and replaced the stale overview wording with an accurate scope comment.

### Regression proof

- RED before the implementation: new DOM expectations exposed literal question-mark count text and the non-chunked mixed Whole-area case incorrectly reported uniform availability; the new reachability helper was absent.
- Green after the implementation: explicit visible-text assertions cover four count types and em-dash requirement tooltips. A Falador-unlocked / Port Sarim-locked Asgarnia fixture proves non-chunked mixed ownership, while chunked Whole-area keeps its neutral summary.

### Browser smoke

- Opened a real Asgarnia chunk and switched to Whole area: the drawer showed 30 chunks and 310 locked indexed activities, including dense Quest (62), Combat (86), Gathering (24), Shops (40), Travel (91), and Other (7) groups.
- Expanded Combat; rows rendered correctly with visible multiplication counts (for example, White Knight x34) and capped-list controls.
- At a 360 x 800 viewport, the responsive drawer remained inside the narrow map surface with its close control and Whole area scope switch visible and usable; the temporary viewport override was reset afterward.
- Keyboard focus reached the close button, Whole area switch, expanded Combat accordion, and the White Knight WikiLink anchor (with its expected OSRS Wiki URL).

### Final verification

- Scoped Chunk Info suite: `npx vitest run components/chunk-info components/ChunkActivityPanel.test.tsx components/ChunkActivityPanel.dom.test.tsx utils/reachability.test.ts` - 9 files, 58 tests passed.
- Full suite: `npm test` - 177 files, 2,047 tests passed.
- TypeScript: `npm run typecheck` passed.
- Production build: `npm run build` passed.
- Player-facing release guard: `npm run changelog:verify -- origin/main` passed for 10 player-facing files.
- Whitespace: `git diff --check` passed before staging.

### Scope discipline

- The verified local Vite server used for the browser smoke was stopped by its exact verified PIDs after testing.
- `data/modelManifest.ts` remains an unstaged status-only build artifact, and the pre-existing untracked plan remains untouched and unstaged.
