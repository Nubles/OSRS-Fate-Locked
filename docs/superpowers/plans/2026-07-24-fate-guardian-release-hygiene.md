# Fate Guardian Release Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the four already-finished RuneLite improvements, establish a tested plugin baseline, and make future drift between the app mirror, standalone plugin, and Plugin Hub pin visible in CI.

**Architecture:** Treat `Nubles/RS3-Fate-Locked-Runelite` as the plugin source of truth and `Nubles/OSRS-Fate-Locked/runelite-plugin` as a reviewable mirror pinned by `SOURCE_COMMIT`. A small Node verifier compares the mirror to a checked-out standalone tree, while Java tests lock down bundle parsing and map/bank parity before later protocol work starts.

**Tech Stack:** Java 11, Gradle 8.5, JUnit 4.13.2, TypeScript/Node.js, GitHub Actions, RuneLite Plugin Hub manifest.

## Global Constraints

- Release standalone commit `f450bbd87cee74d26d24061d034368ad9f0c0c86` before any Fate Guardian feature commit.
- Update the Plugin Hub pin from `fdca20aad7ffcf159b62210f7492f110c185afee` to `f450bbd87cee74d26d24061d034368ad9f0c0c86`.
- Preserve Java 11 compatibility and use RuneLite's injected dependencies; do not shade or create a second HTTP client.
- Do not add gameplay automation, automatic rolls, or Strict Mode in this release.
- Keep online sync optional and off by default.
- Do not stage unrelated local changes in `README.md`, `docs/media/`, or `.superpowers/`.
- Approved design: `docs/superpowers/specs/2026-07-24-fate-guardian-runelite-design.md`.

---

## Repository layout

- App/mirror repository: `Nubles/OSRS-Fate-Locked`
- Standalone plugin repository: `Nubles/RS3-Fate-Locked-Runelite`
- Hub repository: `runelite/plugin-hub`
- Mirror pin file: `runelite-plugin/SOURCE_COMMIT`
- Drift verifier: `scripts/check-runelite-mirror.mjs`
- Standalone plugin tests: `src/test/java/com/fatelocked/`

### Task 1: Lock the standalone plugin baseline with bundle tests

**Files:**
- Create: `src/test/java/com/fatelocked/FateLockedBundleTest.java` in `Nubles/RS3-Fate-Locked-Runelite`
- Create: `src/test/resources/bundles/v1-legacy.json`
- Create: `src/test/resources/bundles/v3-standard.json`
- Create: `src/test/resources/bundles/v3-chunked-empty.json`
- Modify: `.github/workflows/build.yml`

**Interfaces:**
- Consumes: `FateLockedBundle.loadFromJson(Gson, String)`, `lockStateAt(CanonicalChunk)`, `isBankUnlocked(CanonicalChunk)`, `isFrontierChunk(CanonicalChunk)`.
- Produces: a JUnit regression suite run by `gradle test` and `gradle build`.

- [ ] **Step 1: Add focused bundle fixtures**

Create three complete JSON fixtures. The standard fixture must contain Falador at `46,52`, Lumbridge at `50,50`, `bankLocks: true`, and only bank ID `11828` (`46 * 256 + 52`) unlocked. The empty Chunked fixture must include `"unlockedChunks":[]` so its presence, not its length, selects Chunked mode.

```json
{
  "version": 3,
  "chunks": {
    "Misthalin": [{"cx": 50, "cy": 50}],
    "Asgarnia": [{"cx": 46, "cy": 52}]
  },
  "subAreaChunks": {
    "Lumbridge": [{"cx": 50, "cy": 50}],
    "Falador": [{"cx": 46, "cy": 52}]
  },
  "regionGroups": {
    "Misthalin": ["Lumbridge"],
    "Asgarnia": ["Falador"]
  },
  "unlockedRegions": ["Falador"],
  "bankLocks": true,
  "unlockedBanks": ["11828"],
  "state": {"keys": 2, "fatePoints": 7, "linkedAccount": "Nubles"}
}
```

`v1-legacy.json`:

```json
{
  "version": 1,
  "chunks": {
    "Misthalin": [{"cx": 50, "cy": 50}],
    "Asgarnia": [{"cx": 46, "cy": 52}]
  },
  "unlockedRegions": ["Asgarnia"]
}
```

`v3-chunked-empty.json`:

```json
{
  "version": 3,
  "chunks": {"Misthalin": [{"cx": 50, "cy": 50}]},
  "subAreaChunks": {"Lumbridge": [{"cx": 50, "cy": 50}]},
  "regionGroups": {"Misthalin": ["Lumbridge"]},
  "unlockedRegions": [],
  "unlockedChunks": [],
  "state": {"keys": 3, "fatePoints": 0, "linkedAccount": "Nubles"}
}
```

- [ ] **Step 2: Write failing parity tests**

```java
private FateLockedBundle fixture(String name) throws Exception
{
    try (InputStream in = getClass().getClassLoader().getResourceAsStream(name))
    {
        assertNotNull("missing fixture " + name, in);
        String json = new String(readAllBytes(in), StandardCharsets.UTF_8);
        return FateLockedBundle.loadFromJson(new Gson(), json);
    }
}

@Test
public void legacyBundleStillUsesContinentUnlocks() throws Exception
{
    FateLockedBundle b = fixture("bundles/v1-legacy.json");
    assertEquals(FateLockedBundle.LockState.UNLOCKED,
        b.lockStateAt(new CanonicalChunk(46, 52)));
}

@Test
public void standardBundleUsesSubAreaAndBankState() throws Exception
{
    FateLockedBundle b = fixture("bundles/v3-standard.json");
    assertEquals(FateLockedBundle.LockState.UNLOCKED,
        b.lockStateAt(new CanonicalChunk(46, 52)));
    assertTrue(b.isBankUnlocked(new CanonicalChunk(46, 52)));
    assertEquals(FateLockedBundle.LockState.UNLOCKED,
        b.lockStateAt(new CanonicalChunk(50, 50)));
}

@Test
public void emptyChunkedBundleStillUnlocksTheStartChunk()
{
    FateLockedBundle b = fixture("bundles/v3-chunked-empty.json");
    assertTrue(b.isChunkedBundle());
    assertEquals(FateLockedBundle.LockState.UNLOCKED,
        b.lockStateAt(FateLockedBundle.CHUNKED_START));
}
```

- [ ] **Step 3: Run the tests and confirm the baseline**

Run: `gradle test --tests com.fatelocked.FateLockedBundleTest --no-daemon`

Expected: PASS. If a fixture exposes an actual parser mismatch, correct the parser in a separate commit before continuing; do not weaken the assertion.

- [ ] **Step 4: Make CI name the test phase explicitly**

Replace the single build step with:

```yaml
- name: Test
  run: gradle test --no-daemon
- name: Build Hub-compatible jar
  run: gradle jar --no-daemon
```

- [ ] **Step 5: Commit**

```bash
git add src/test .github/workflows/build.yml
git commit -m "test: lock RuneLite bundle parity baseline"
```

### Task 2: Pin and verify the app's plugin mirror

**Files:**
- Create: `runelite-plugin/SOURCE_COMMIT` in `Nubles/OSRS-Fate-Locked`
- Create: `scripts/check-runelite-mirror.mjs`
- Modify: `package.json`
- Create: `.github/workflows/runelite-mirror.yml`
- Modify: mirrored files under `runelite-plugin/` to match standalone commit `f450bbd...`

**Interfaces:**
- Consumes: environment variable `RUNELITE_SOURCE_DIR`, containing a checkout of the standalone repository.
- Produces: `npm run runelite:mirror-check`, exit code `0` on byte-for-byte parity and `1` with a file list on drift.

- [ ] **Step 1: Write the pin**

`runelite-plugin/SOURCE_COMMIT` must contain exactly:

```text
f450bbd87cee74d26d24061d034368ad9f0c0c86
```

- [ ] **Step 2: Write a failing verifier test through its CLI contract**

Create a temporary source tree in `scripts/check-runelite-mirror.test.ts`, copy one known file, mutate the mirror copy, and assert that the spawned verifier exits `1` and prints the relative path. Add the test to the normal Vitest suite.

```ts
expect(result.status).toBe(1);
expect(result.stdout).toContain('src/main/java/com/fatelocked/FateLockedConfig.java');
```

- [ ] **Step 3: Run the failing test**

Run: `npm test -- scripts/check-runelite-mirror.test.ts`

Expected: FAIL because `scripts/check-runelite-mirror.mjs` does not exist.

- [ ] **Step 4: Implement the verifier**

The script must recursively compare only these source-controlled paths:

```js
const COMPARED = [
  'build.gradle',
  'settings.gradle',
  'gradle.properties',
  'README.md',
  'CONTRIBUTING.md',
  'src/main/java',
  'src/main/resources',
];
```

Ignore `.gradle`, `build`, IDE files, and wrapper binaries. Require `RUNELITE_SOURCE_DIR`, read the pin, and report added, removed, and changed files. Do not download anything from inside the script.

- [ ] **Step 5: Add the package command and make the test pass**

```json
"runelite:mirror-check": "node scripts/check-runelite-mirror.mjs"
```

Run: `npm test -- scripts/check-runelite-mirror.test.ts`

Expected: PASS.

- [ ] **Step 6: Refresh the mirror from the pinned standalone checkout**

Copy the compared files from a checkout at `f450bbd...`, then run:

`$env:RUNELITE_SOURCE_DIR=(Resolve-Path ..\RS3-Fate-Locked-Runelite); npm run runelite:mirror-check`

Expected: `RuneLite mirror matches f450bbd87cee74d26d24061d034368ad9f0c0c86`.

- [ ] **Step 7: Add CI drift detection**

```yaml
name: RuneLite mirror
on:
  pull_request:
  push:
    branches: [main]
jobs:
  parity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          path: app
      - uses: actions/checkout@v4
        with:
          repository: Nubles/RS3-Fate-Locked-Runelite
          ref: f450bbd87cee74d26d24061d034368ad9f0c0c86
          path: plugin
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
        working-directory: app
      - run: npm run runelite:mirror-check
        working-directory: app
        env:
          RUNELITE_SOURCE_DIR: ${{ github.workspace }}/plugin
```

- [ ] **Step 8: Commit**

```bash
git add runelite-plugin scripts/check-runelite-mirror.mjs scripts/check-runelite-mirror.test.ts package.json .github/workflows
git commit -m "chore: pin and verify RuneLite mirror"
```

### Task 3: Correct release documentation

**Files:**
- Modify: `ROADMAP.md` in `Nubles/OSRS-Fate-Locked`
- Modify: `README.md` in `Nubles/RS3-Fate-Locked-Runelite`
- Modify: `CONTRIBUTING.md` in `Nubles/RS3-Fate-Locked-Runelite`

**Interfaces:**
- Consumes: the confirmed Hub and standalone SHAs.
- Produces: documentation that distinguishes “currently on Hub” from “next submitted commit.”

- [ ] **Step 1: Replace the stale Hub baseline**

State the exact transition:

```text
Plugin Hub currently pins fdca20aad7ffcf159b62210f7492f110c185afee.
The next maintenance submission pins f450bbd87cee74d26d24061d034368ad9f0c0c86.
```

List the four maintenance features without describing Roll Inbox or Strict Mode as released.

- [ ] **Step 2: Verify references**

Run: `rg -n "dc3823c|fdca20a|f450bbd" ROADMAP.md README.md CONTRIBUTING.md`

Expected: no statement claims `dc3823c` is the current Hub pin; all current/next wording is unambiguous.

- [ ] **Step 3: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: correct RuneLite Hub release baseline"
```

Commit the standalone documentation separately:

```bash
git add README.md CONTRIBUTING.md
git commit -m "docs: describe current plugin maintenance release"
```

### Task 4: Submit the maintenance-only Plugin Hub update

**Files:**
- Modify: `plugins/fate-locked-ironman` in `runelite/plugin-hub`

**Interfaces:**
- Consumes: standalone commit `f450bbd...` with passing `gradle test` and `gradle jar`.
- Produces: a Hub PR changing only the manifest commit.

- [ ] **Step 1: Verify the standalone commit**

Run:

```bash
git rev-parse HEAD
gradle test jar --no-daemon
```

Expected: SHA is `f450bbd87cee74d26d24061d034368ad9f0c0c86`; tests and jar build pass.

- [ ] **Step 2: Change only the Hub pin**

```properties
repository=https://github.com/Nubles/RS3-Fate-Locked-Runelite.git
commit=f450bbd87cee74d26d24061d034368ad9f0c0c86
```

- [ ] **Step 3: Inspect the manifest diff**

Run: `git diff -- plugins/fate-locked-ironman`

Expected: exactly one changed `commit=` line.

- [ ] **Step 4: Commit and open the Hub PR**

```bash
git add plugins/fate-locked-ironman
git commit -m "Fate Locked Ironman: update"
```

The PR body must name the four already-reviewed maintenance features and state: “No gameplay automation; online sync remains explicit opt-in.”

### Task 5: Release gate

**Files:**
- No new files.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: a recorded green baseline for Project 1.

- [ ] **Step 1: Triage the standalone plugin's open issues**

Run:

```bash
gh issue list --repo Nubles/RS3-Fate-Locked-Runelite --state open --limit 100 --json number,title,url,labels
```

At the 2026-07-24 baseline the open set is #1 **Not showing up in runelite configuration** and #2 **Some notes on Task Requirements**.

- Label #1 `bug` and `priority:high`. Reproduce on the Hub's current pin, then retest after the `f450bbd...` maintenance update. Close only if the plugin appears in Configuration after a clean RuneLite restart; otherwise keep it open with client/log reproduction details.
- Label #2 `enhancement` and `priority:normal`. In `Nubles/OSRS-Fate-Locked`, create three focused issues titled **Correct quest location requirements**, **Apply skill method caps to Diary doability**, and **Model coupled unlock dependencies**. Copy only the relevant bullets for Porcine/Abyss, Oak-log cap, and Pest Control/Void Knights' Outpost respectively. Add a fourth issue titled **Collect evidence before key-economy rebalance** for weighted Fate Points, early-game key pressure, and diminishing-return ideas. Link all four from plugin issue #2, then close #2 as moved to the authoritative app repository.
- Apply the same bug/enhancement/question plus priority classification to any additional issue returned by the command. Close only verified duplicates with a link to the surviving issue.

- [ ] **Step 2: Run app verification**

Run:

```bash
npm test
npm run typecheck
npm run content:verify
npm run build
```

Expected: all commands pass.

- [ ] **Step 3: Run standalone verification**

Run: `gradle clean test jar --no-daemon`

Expected: BUILD SUCCESSFUL and a non-empty jar under `build/libs/`.

- [ ] **Step 4: Manually smoke-test the maintenance release**

Verify clipboard import, online-sync import, locked bank warning, nearest bank/shop HUD, free-area behavior, and the optional current-chunk content overlay. Online sync must make no request while disabled.

- [ ] **Step 5: Record the baseline**

Add the merged Hub PR URL and merge SHA to the release section of `ROADMAP.md`, then commit:

```bash
git add ROADMAP.md
git commit -m "docs: record RuneLite maintenance release"
```
