# Submitting to the RuneLite Plugin Hub

The Plugin Hub is the **only** install path that needs no developer mode and no
jar handling — users click *Install* inside RuneLite and that's it. Getting
there is a one-time process gated on the RuneLite team's review.

This plugin is already hub-compliant: it makes **no external network calls**
(everything is local JSON), declares its class in `runelite-plugin.properties`,
and builds with the standard shadow setup.

## Why it can't be auto-submitted

The Hub references a **standalone GitHub repo** whose Gradle project sits at the
repo root. This plugin lives in a *subdirectory* (`runelite-plugin/`) of the
tracker monorepo, and submission is a PR **to RuneLite's own repo** from your
account — neither of which can be automated from here. The steps below are what
you do once.

## One-time steps

1. **Create a standalone repo** for the plugin, e.g. `Nubles/fate-locked-runelite`
   (public). Copy the **contents** of `runelite-plugin/` to its **root**, so the
   layout is:
   ```
   build.gradle
   settings.gradle
   runelite-plugin.properties
   src/main/java/com/fatelocked/…
   icon.png            (optional, 48×48 — shown in the Hub list)
   ```
   Commit and push. Copy the full commit SHA (`git rev-parse HEAD`).

2. **Verify it builds standalone:** `gradle shadowJar` at the repo root should
   produce `build/libs/fatelocked-0.1.0-all.jar`. (Our GitHub Action already
   proves the same source compiles — see `.github/workflows/runelite-plugin.yml`.)

3. **Fork** [`runelite/plugin-hub`](https://github.com/runelite/plugin-hub) and
   add a single file `plugins/fate-locked-ironman` (no extension) containing:
   ```properties
   repository=https://github.com/Nubles/fate-locked-runelite.git
   commit=<the full SHA from step 1>
   ```

4. **Open a PR** to `runelite/plugin-hub`. Their CI builds your plugin in a
   sandbox and a reviewer checks it. Approval can take days to weeks. Once
   merged, "Fate Locked Ironman" appears in every user's Plugin Hub.

## Updating after approval

To ship a new version, push to the standalone repo and bump the `commit=` line
in your `plugins/fate-locked-ironman` file via another small PR.

## Interim: the sideload jar

Until the Hub PR lands, users can use the auto-built jar from the repo's
**Releases** (tag `runelite-plugin-latest`) — drop it in
`~/.runelite/sideloaded-plugins/` and launch RuneLite with `--developer-mode`.
See [README.md](README.md).
