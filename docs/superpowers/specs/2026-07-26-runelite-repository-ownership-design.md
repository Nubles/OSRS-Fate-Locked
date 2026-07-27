# RuneLite Repository Ownership Design

## Goal

Make `Nubles/OSRS-Fate-Locked-Runelite` the only repository that owns,
builds, and distributes the RuneLite Java plugin, while preserving every
RuneLite-facing feature implemented by the `OSRS-Fate-Locked` companion app.

## Ownership Boundary

`OSRS-Fate-Locked-Runelite` owns:

- all Java plugin source, resources, Gradle configuration, and plugin tests;
- Plugin Hub submission and release documentation;
- plugin build artifacts, sideload downloads, tags, and releases;
- plugin-specific GitHub Actions.

`OSRS-Fate-Locked` continues to own:

- the web app's RuneLite onboarding and Plugin Hub link;
- rules-manifest and bundle export;
- Online sync, durable event relay, and acknowledgement handling;
- confirmation-first Roll Inbox processing;
- detector policies, eligibility checks, and privacy-safe playtest exports;
- Travel Guardian rule authority published by the app.

The companion app communicates with the plugin only through the documented
bundle and relay contracts. It does not contain or distribute a Java plugin.

## Companion Repository Removals

Remove from `OSRS-Fate-Locked`:

- the complete tracked `runelite-plugin/` mirror;
- `.github/workflows/runelite-plugin.yml`, including rolling and versioned
  plugin-download releases;
- `.github/workflows/runelite-mirror.yml`;
- `scripts/check-runelite-mirror.mjs` and its test;
- the `runelite:mirror-check` npm script;
- plugin-mirror-specific `.gitignore` entries;
- internal instructions that require copying plugin source into the companion
  repository;
- README and roadmap language describing the companion repository as a plugin
  mirror or download source.

## Companion Repository Retentions

Do not remove or weaken:

- `components/RuneLiteOnboarding.tsx`;
- `components/RollInbox.tsx` and `components/RollInboxDriver.tsx`;
- `services/fateEventProtocol.ts`, `services/fateEventRelay.ts`,
  `services/relaySync.ts`, and Roll Inbox storage/runtime services;
- `utils/runeliteBundle.ts`, `utils/runeliteExport.ts`,
  `utils/runeliteRulesManifest.ts`, and their tests;
- Worker event and acknowledgement endpoints;
- app-authored mobility, chunk, item, detector, and account/run identity rules;
- the external link to
  `https://github.com/Nubles/OSRS-Fate-Locked-Runelite`.

## Documentation

The companion README explains what the RuneLite integration does and links to
the standalone repository for source, installation, builds, and releases.
Operational plugin build and Plugin Hub instructions live only in the
standalone repository.

Archived plans and specifications may retain historical mirror language when
it is clearly part of the historical record. Active instructions must not tell
contributors to build, mirror, or publish the Java plugin from the companion
repository.

## Regression Protection

Add a repository-boundary test that fails if the companion repository again
contains:

- a tracked `runelite-plugin/` directory;
- a plugin build/download workflow;
- the mirror workflow or mirror verifier;
- a `runelite:mirror-check` package script;
- active documentation claiming the companion repository is the plugin source,
  mirror, or download location.

The test also asserts that the app-side RuneLite integration files and the
standalone repository link remain present.

## Verification

Before merge:

1. Run the new repository-boundary test through a RED/GREEN cycle.
2. Run the full Vitest suite, typecheck, content verification, and production
   build.
3. Confirm no active plugin mirror/download references remain outside archived
   plans/specifications.
4. Confirm the standalone plugin repository remains unchanged.
5. Open a focused pull request, wait for CI, and merge only when all checks pass.

## Rollback

If companion functionality regresses, revert the focused cleanup merge. Plugin
source and releases remain safe in `OSRS-Fate-Locked-Runelite`; no plugin
history or distribution artifact is deleted from the authoritative repository.
