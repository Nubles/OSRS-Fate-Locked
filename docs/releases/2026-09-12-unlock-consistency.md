# Unlocks Stay Consistent

Release candidate for 12 September 2026. Prepared on the latest `main`; publication remains a separate step.

## Player-facing changes

- Random unlocks save the award and key cost together before showing the result. Reloading resumes the same reveal, and accepting it cannot charge again. A failed save offers a retry for that same roll.
- Tutorial Island is free onboarding in every mode and is removed from paid area rolls. Existing purchases receive an automatic refund.
- Khazard Battlefield and Port Khazard have separate map labels and unlocks. The western Chaos Altar is also distinct from the eastern Chaos Temple. Existing owners retain access to the formerly bundled locations.
- Generic map terrain explains which parent-region completion rule controls access and lists the remaining areas. In Chunked mode, coordinate checks require the exact chunk.
- Thirteen Wilderness diary tasks check their actual locations, with alternative entrances where appropriate. Diary map links and goal routes use those same locations.
- Strategy, activity and utility readiness now preserve quest, diary, level and entry requirements. Incomplete access data is marked for verification.
- Forecasts and goal odds use the eligible roll pool. Chunked completion and rival totals count purchased chunks while excluding the free starting chunk.
- Resource plans and inventory stay with their own run. Existing shared planning data can be copied into the run the player chooses. Unverified sources no longer appear available.
- Collection Log aliases and synchronized totals agree. The coverage metric clearly describes source ownership.
- Corrected transport, Prayer, Farming, housing and storage requirements; improved bank searches, small-screen controls and keyboard access.

## Save compatibility

The optional, validated `areaUnlockRevision: 1` marker applies the location splits once. New runs start with the marker; older Port Khazard and Chaos Temple owners receive the corresponding split location. Existing explicit parent-region ownership remains valid, with no duplicate child purchases or double-counting.

Tutorial Island refunds use the recorded purchase currency and cost. Saves without usable old payment metadata receive one regular key. If a key counter is full, the saved ownership is retained as refund credit until a future load has room. Repeated loads or imports of a migrated save do not repeat the refund. Existing history and integrity hashes are preserved, and the earlier Fate compensation migration is not replayed.

Resource-planning migration requires the player's choice of destination run and retains the old shared values as a backup.

## Verification and release scope

The candidate includes the 19 live-audit repair groups and the subsequent map reports. It preserves the newer published quest-area and RuneLite relay changes. Unfinished workspace changes, local profiles, audit captures and generated build artifacts are excluded.

A clean locked dependency install and the full local release gate passed: 256 test files / 3,252 tests, TypeScript, offline content checks, changelog verification and the production build. The build retains its existing large-bundle warnings. GitHub `CI / quality` must pass for the pull request before merge. The production build uses `/OSRS-Fate-Locked/` as its base path. No dependency metadata or deployment workflows change.

The geography regression checks use the committed Chunk Picker snapshot at `a9a5c74760eb76dbe39f90d2b04f023fc1de3746`, including the split areas and all six greater/lesser Wilderness boss entrances. Content verification stays offline and does not refresh source data.

This release does not claim a new independent audit of every catalogue entry. Incomplete bank and enriched-resource metadata remains explicitly unverified; the legacy Aquarium entry is retained with that status. Live RuneLite pairing, account binding, relay replay and Discord delivery have not been exercised end to end for this candidate.

## Publishing

Merge only after review and a successful `CI / quality` check. The main-branch Pages workflow performs its own gated build and deployment. After deployment, verify the public `version.json` commit, then smoke-test unlock recovery and the corrected map interactions using a separate audit profile before reporting the release as live. Publishing a GitHub release triggers the existing Discord release workflow and should be treated as a separate authorized publication action.
