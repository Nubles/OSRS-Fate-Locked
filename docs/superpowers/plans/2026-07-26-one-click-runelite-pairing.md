# One-Click RuneLite Pairing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the RuneLite Plugin Hub plugin open the GitHub Pages tracker with a secure pairing request so the user can connect both apps on the same PC with one browser confirmation and no copied code.

**Architecture:** RuneLite remains the pairing initiator and generates a fresh 32-character lowercase hexadecimal code only after the existing online-sync consent setting is enabled. It opens the tracker with the code in a URL fragment, which is not sent to GitHub Pages. The tracker validates and removes the fragment, asks the user to confirm the active profile, adopts the code with a fresh private relay write token, and lets the existing always-mounted sync driver upload the bundle. RuneLite polls the existing outbound-only relay, applies the bundle on the client thread, and posts the existing state acknowledgement only after a successful import. Clipboard, file, and manual-code setup remain available under recovery/advanced controls for one compatibility release.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Vite/GitHub Pages, Java 11, Swing, JUnit 4, Mockito, OkHttp MockWebServer, Gradle, RuneLite Plugin Hub.

## Global Constraints

- Keep `FateLockedConfig.onlineSync()` off by default and preserve its required third-party IP-address warning.
- When online sync is off, the plugin must not generate/store a pairing code, open the browser, poll the relay, or perform any other relay request.
- Keep all RuneLite networking outbound-only through the injected `OkHttpClient`; do not add a localhost server, inbound sockets, subprocesses, reflection, JNI, or gameplay automation.
- The pairing fragment must be exactly `#runelite-pair=<32 lowercase hex characters>`. Remove a valid fragment from the address bar before the user confirms or cancels.
- Cancelling in the tracker must leave the existing relay session, private token, and run data unchanged.
- Confirming must create a fresh private write token, replace the relay session atomically, persist it under `fate_relay_session_v1`, and notify subscribers so `OnlineSyncDriver` uploads the current bundle.
- A relay upload is not proof of a RuneLite connection. Show connected only after RuneLite successfully parses and applies the bundle and `/state` returns that acknowledgement.
- Reset both the cached relay version and displayed last-import time whenever online sync, pairing code, or relay URL changes.
- Do not acknowledge an invalid bundle. Do not discard the previously valid rules after an invalid clipboard, paste, file, or relay payload.
- Detect pairing codes before JSON parsing. Show one useful instruction and suppress repeat handling/logging of an identical held clipboard value for 30 seconds.
- Preserve the current manual pairing-code field and web-generated eight-character code for one compatibility release, but label them as advanced/recovery paths.
- Do not change the relay worker's existing `/r/:code`, `/r/:code/state`, `/suggest`, or event endpoints.
- Implement and verify the standalone plugin first. Mirror its release source into the tracker only after its tests pass.
- Preserve the user-modified root `README.md`, `.superpowers/`, `docs/media/`, and unrelated worktree changes.
- Do not update the Plugin Hub manifest until the standalone commit has been pushed, the GitHub Pages build has passed, and the local side-by-side trial succeeds.

---

## Task 1: Add validated relay-session adoption in the tracker

**Files:**

- Create: `services/relaySync.test.ts`
- Modify: `services/relaySync.ts`

**Interfaces:**

```ts
export const RUNELITE_PAIR_CODE_PATTERN: RegExp;
export function isRunelitePairCode(value: string): boolean;
export class RelaySyncService {
  adoptCode(code: string): boolean;
}
```

- [ ] **Step 1: Write failing tests for validation and atomic adoption**

Create `services/relaySync.test.ts` with a `localStorage` stub and deterministic `crypto.getRandomValues`. Cover:

```ts
expect(isRunelitePairCode('0123456789abcdef0123456789abcdef')).toBe(true);
expect(isRunelitePairCode('0123456789ABCDEF0123456789ABCDEF')).toBe(false);
expect(isRunelitePairCode('ABCD1234')).toBe(false);
expect(service.adoptCode('invalid')).toBe(false);
expect(service.enabled).toBe(false);

const adopted = service.adoptCode('0123456789abcdef0123456789abcdef');
expect(adopted).toBe(true);
expect(service.code).toBe('0123456789abcdef0123456789abcdef');
expect(JSON.parse(localStorage.getItem('fate_relay_session_v1')!)).toEqual({
  code: '0123456789abcdef0123456789abcdef',
  token: '070707070707070707070707070707070707',
});
expect(listener).toHaveBeenCalledTimes(1);
```

Add a replacement assertion proving that a second valid adoption gets a different mocked token and does not mutate the first session until `adoptCode` is called.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```powershell
npx vitest run services/relaySync.test.ts
```

Expected: failure because the validator, exported class, and `adoptCode` do not exist.

- [ ] **Step 3: Implement validation and adoption**

Modify `services/relaySync.ts`:

```ts
export const RUNELITE_PAIR_CODE_PATTERN = /^[0-9a-f]{32}$/;

export const isRunelitePairCode = (value: string): boolean =>
  RUNELITE_PAIR_CODE_PATTERN.test(value);

export class RelaySyncService {
  adoptCode(code: string): boolean {
    if (!isRunelitePairCode(code)) return false;
    const nextSession: Session = { code, token: randomToken() };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    } catch {
      return false;
    }
    this.session = nextSession;
    this.status = 'syncing';
    this.lastError = null;
    this.lastSyncAt = null;
    this.emit();
    return true;
  }
}
```

Keep `enable()` unchanged as the temporary web-first compatibility path.

- [ ] **Step 4: Run the focused test**

Run:

```powershell
npx vitest run services/relaySync.test.ts
```

Expected: all relay-session adoption tests pass.

- [ ] **Step 5: Commit the tracker service change**

Run:

```powershell
git add services/relaySync.ts services/relaySync.test.ts
git commit -m "feat: adopt RuneLite pairing sessions"
```

---

## Task 2: Consume the pairing fragment and require browser confirmation

**Files:**

- Create: `utils/runelitePairing.ts`
- Create: `utils/runelitePairing.test.ts`
- Create: `components/RunelitePairingDialog.tsx`
- Create: `components/RunelitePairingDialog.test.tsx`
- Modify: `App.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

```ts
export const RUNELITE_PAIR_HASH_PREFIX = '#runelite-pair=';
export function parseRunelitePairFragment(hash: string): string | null;

export interface RunelitePairingDialogProps {
  code: string;
  replacing: boolean;
  profileName: string;
  linkedAccount?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}
```

- [ ] **Step 1: Add the existing UI-test dependencies used by the feature worktree**

Run:

```powershell
npm install --save-dev @testing-library/react@^16.3.2 @testing-library/user-event@^14.6.1 jsdom@^29.1.1
```

Expected: `package.json` and `package-lock.json` contain the three development dependencies.

- [ ] **Step 2: Write failing fragment-parser tests**

Create `utils/runelitePairing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseRunelitePairFragment } from './runelitePairing';

describe('parseRunelitePairFragment', () => {
  it('accepts only the RuneLite-generated fragment', () => {
    expect(parseRunelitePairFragment(
      '#runelite-pair=0123456789abcdef0123456789abcdef',
    )).toBe('0123456789abcdef0123456789abcdef');
  });

  it('ignores malformed, uppercase, legacy, and unrelated hashes', () => {
    expect(parseRunelitePairFragment('#runelite-pair=ABCD1234')).toBeNull();
    expect(parseRunelitePairFragment('#runelite-pair=0123456789ABCDEF0123456789ABCDEF')).toBeNull();
    expect(parseRunelitePairFragment('#sync=ABCD1234')).toBeNull();
    expect(parseRunelitePairFragment('#/overlay?code=ABCD1234')).toBeNull();
  });
});
```

- [ ] **Step 3: Implement the pure fragment parser**

Create `utils/runelitePairing.ts`:

```ts
import { isRunelitePairCode } from '../services/relaySync';

export const RUNELITE_PAIR_HASH_PREFIX = '#runelite-pair=';

export const parseRunelitePairFragment = (hash: string): string | null => {
  if (!hash.startsWith(RUNELITE_PAIR_HASH_PREFIX)) return null;
  const code = hash.slice(RUNELITE_PAIR_HASH_PREFIX.length);
  return isRunelitePairCode(code) ? code : null;
};
```

- [ ] **Step 4: Write failing dialog behavior tests**

Create `components/RunelitePairingDialog.test.tsx` with `// @vitest-environment jsdom`. Render the dialog and assert:

```ts
expect(screen.getByText('Main profile')).toBeTruthy();
expect(screen.getByText('Nubles UIM')).toBeTruthy();
expect(screen.getByText(/replace the current RuneLite connection/i)).toBeTruthy();
await user.click(screen.getByRole('button', { name: /connect tracker/i }));
expect(onConfirm).toHaveBeenCalledTimes(1);
expect(onCancel).not.toHaveBeenCalled();
```

Add a cancel test that clicks `Cancel` and proves only `onCancel` runs.

- [ ] **Step 5: Implement the confirmation dialog**

Create `components/RunelitePairingDialog.tsx` as a modal matching the app's existing dark surfaces. It must:

- say that RuneLite requested the connection;
- show `profileName` and `linkedAccount || 'No bound account'`;
- warn when `replacing` is true;
- expose exactly two actions, `Cancel` and `Connect tracker`;
- never call `relaySync` directly.

- [ ] **Step 6: Wire fragment consumption into `GameLayout`**

Modify `App.tsx` to read `activeProfileName` from `useProfiles()` and `linkedAccount` from `useGame()`. Add:

```ts
const [runelitePairCode, setRunelitePairCode] = useState<string | null>(null);

useEffect(() => {
  const code = parseRunelitePairFragment(window.location.hash);
  if (!code) return;
  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search,
  );
  setRunelitePairCode(code);
}, []);
```

Render `RunelitePairingDialog` with:

```tsx
{runelitePairCode && (
  <RunelitePairingDialog
    code={runelitePairCode}
    replacing={relaySync.enabled}
    profileName={activeProfileName}
    linkedAccount={linkedAccount}
    onCancel={() => setRunelitePairCode(null)}
    onConfirm={() => {
      if (relaySync.adoptCode(runelitePairCode)) {
        setRunelitePairCode(null);
      }
    }}
  />
)}
```

Include this dialog in the existing Escape-key modal state. Do not disturb the separate legacy `#sync=` deep link or `#/overlay` route.

- [ ] **Step 7: Run focused tests and the production build**

Run:

```powershell
npx vitest run services/relaySync.test.ts utils/runelitePairing.test.ts components/RunelitePairingDialog.test.tsx
npm run build
```

Expected: all focused tests pass and Vite builds the GitHub Pages app.

- [ ] **Step 8: Commit the tracker confirmation flow**

Run:

```powershell
git add App.tsx components/RunelitePairingDialog.tsx components/RunelitePairingDialog.test.tsx utils/runelitePairing.ts utils/runelitePairing.test.ts package.json package-lock.json
git commit -m "feat: confirm RuneLite pairing links"
```

---

## Task 3: Make the tracker status and recovery wording accurate

**Files:**

- Create: `components/RuneLiteOnboarding.test.tsx`
- Modify: `components/RuneLiteOnboarding.tsx`

**Interfaces:**

```ts
type PairingStatus = 'off' | 'waiting' | 'connected' | 'upload-error';
```

- [ ] **Step 1: Write failing onboarding copy/status tests**

In `components/RuneLiteOnboarding.test.tsx`, mock `relaySync` and cover these rendered states:

- no session: primary copy says to start from RuneLite's `Connect tracker` button;
- session with no `/state`: says `Waiting for RuneLite to import this profile`;
- session with an acknowledgement: says `Connected` and shows the last-import time;
- upload error: says the connection will retry and recovery imports remain available;
- advanced controls still expose the pairing code, copy action, web-generated legacy code, overlay URL, and disconnect action.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```powershell
npx vitest run components/RuneLiteOnboarding.test.tsx
```

Expected: failures because the current card still presents copy/paste as the primary flow.

- [ ] **Step 3: Reword and reorganize the onboarding card**

Make RuneLite-initiated pairing the primary three-step flow:

1. Install `Fate Locked Ironman` from Plugin Hub.
2. Enable online sync in RuneLite and accept its IP warning.
3. Click `Connect tracker`, then confirm this profile in the opened browser tab.

Move the current `relaySync.enable()` action, pairing-code display/copy action, clipboard/file explanation, and manual-code instructions into a collapsed `Advanced / recovery` section. Keep the current `fetchPluginState()` polling and require a non-null state acknowledgement before showing connected.

- [ ] **Step 4: Run the focused test and build**

Run:

```powershell
npx vitest run components/RuneLiteOnboarding.test.tsx
npm run build
```

Expected: the card tests pass and the production build succeeds.

- [ ] **Step 5: Commit the tracker status change**

Run:

```powershell
git add components/RuneLiteOnboarding.tsx components/RuneLiteOnboarding.test.tsx
git commit -m "fix: make RuneLite connection status truthful"
```

---

## Task 4: Add the Plugin Hub-safe connection action and visible states

**Repository:** `C:\Users\alexa\Downloads\flitest-main\RS3-Fate-Locked-Runelite`

**Files:**

- Create: `src/main/java/com/fatelocked/PairingSupport.java`
- Create: `src/main/java/com/fatelocked/TrackerConnectionState.java`
- Create: `src/test/java/com/fatelocked/PairingSupportTest.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPanel.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`
- Modify: `src/test/java/com/fatelocked/FateLockedPanelStatusTest.java`

**Interfaces:**

```java
final class PairingSupport
{
    static String newCode();
    static boolean isPairingCode(String value);
    static String trackerPairingUrl(String trackerUrl, String code);
}

enum TrackerConnectionState
{
    OFF, READY, WAITING, IMPORTING, CONNECTED, OFFLINE, IMPORT_FAILED
}

void FateLockedPanel.setCallbacks(
    Consumer<String> onImport,
    Runnable onReload,
    Runnable onConnect);

void FateLockedPanel.updateSyncHealth(
    int pending,
    int readyHint,
    int warnings,
    Instant lastSync,
    TrackerConnectionState connectionState);
```

- [ ] **Step 1: Write failing pairing-support tests**

Create `PairingSupportTest.java`:

```java
@Test
public void generatesStrongLowercaseHexCodes()
{
    String first = PairingSupport.newCode();
    String second = PairingSupport.newCode();
    assertTrue(first.matches("[0-9a-f]{32}"));
    assertTrue(second.matches("[0-9a-f]{32}"));
    assertNotEquals(first, second);
}

@Test
public void buildsAFragmentOnlyPairingUrl()
{
    assertEquals(
        "https://nubles.github.io/OSRS-Fate-Locked/#runelite-pair=0123456789abcdef0123456789abcdef",
        PairingSupport.trackerPairingUrl(
            FateLockedPanel.TRACKER_URL,
            "0123456789abcdef0123456789abcdef"));
}
```

Also assert that uppercase, eight-character legacy codes, whitespace, and JSON are rejected by `isPairingCode`.

- [ ] **Step 2: Implement the pairing helper and state enum**

Use `UUID.randomUUID().toString().replace("-", "")` for `newCode()`. `trackerPairingUrl` must accept only a valid code and append `#runelite-pair=` to a tracker URL normalized to one trailing slash.

- [ ] **Step 3: Extend the panel tests for all seven connection states**

Update `FateLockedPanelStatusTest` so each enum value produces these exact labels:

```text
Off
Ready to connect
Waiting for tracker
Importing
Connected · HH:mm:ss UTC
Offline · retrying
Import failed · previous rules kept
```

Add a button test that installs an `onConnect` callback, clicks the `Connect tracker` button through a package-private test accessor, and observes one callback invocation.

- [ ] **Step 4: Add the primary Connect tracker control**

In `FateLockedPanel`:

- add `Connect tracker` below `Open web tracker`;
- keep import-from-clipboard, pasted JSON, and reload-from-file controls under the existing bundle/recovery section;
- make `setCallbacks` accept the connect callback;
- render the enum state in the compact sync-health area;
- expose only package-private button/label accessors needed by the Swing tests.

- [ ] **Step 5: Implement the consent-gated plugin action**

Add `beginTrackerPairing()` to `FateLockedPlugin`:

```java
private void beginTrackerPairing()
{
    if (!config.onlineSync())
    {
        panel.flashStatus("enable online sync in settings first", false);
        connectionState = TrackerConnectionState.OFF;
        updatePanelSyncHealth();
        return;
    }

    String code = PairingSupport.newCode();
    configManager.setConfiguration(FateLockedConfig.GROUP, "syncCode", code);
    lastRelayVersion = null;
    lastTrackerSync = null;
    connectionState = TrackerConnectionState.WAITING;
    panel.setRollInboxLink(FateLockedPanel.TRACKER_URL, code);
    updatePanelSyncHealth();
    LinkBrowser.browse(PairingSupport.trackerPairingUrl(
        FateLockedPanel.TRACKER_URL, code));
}
```

Wire it through `panel.setCallbacks`. On startup and `ConfigChanged`, derive `OFF`, `READY`, or `WAITING` from `onlineSync()` and `syncCode()`, and clear both `lastRelayVersion` and `lastTrackerSync` when `onlineSync`, `syncCode`, or `relayUrl` changes.

- [ ] **Step 6: Run focused plugin tests**

Run:

```powershell
.\gradlew.bat test --tests com.fatelocked.PairingSupportTest --tests com.fatelocked.FateLockedPanelStatusTest
```

Expected: pairing helper and all connection-state tests pass.

- [ ] **Step 7: Commit the standalone plugin action**

Run:

```powershell
git add src/main/java/com/fatelocked/PairingSupport.java src/main/java/com/fatelocked/TrackerConnectionState.java src/main/java/com/fatelocked/FateLockedPanel.java src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/PairingSupportTest.java src/test/java/com/fatelocked/FateLockedPanelStatusTest.java
git commit -m "feat: open one-click tracker pairing"
```

---

## Task 5: Acknowledge only successful imports and suppress bad clipboard loops

**Repository:** `C:\Users\alexa\Downloads\flitest-main\RS3-Fate-Locked-Runelite`

**Files:**

- Create: `src/main/java/com/fatelocked/RepeatedValueLimiter.java`
- Create: `src/test/java/com/fatelocked/RepeatedValueLimiterTest.java`
- Create: `src/test/java/com/fatelocked/FateLockedRelayImportTest.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`

**Interfaces:**

```java
final class RepeatedValueLimiter
{
    RepeatedValueLimiter(long windowMillis);
    boolean shouldReport(String value, long nowMillis);
}

private boolean applyPastedBundle(String json, ImportSource source);

private enum ImportSource
{
    CLIPBOARD, PASTE, RELAY
}
```

- [ ] **Step 1: Write failing repeat-limiter tests**

Create `RepeatedValueLimiterTest.java` and assert that:

- the first value reports;
- the same value within 30 seconds does not report;
- a different value reports immediately;
- the original value reports again after 30 seconds.

- [ ] **Step 2: Implement the repeat limiter**

Store only the last value, its last-report timestamp, and the configured window. Use `Objects.equals` so no hashing collision can suppress a distinct clipboard value.

- [ ] **Step 3: Write a failing relay import/ack integration test**

Create `FateLockedRelayImportTest.java` using `MockWebServer`, a mocked `ClientThread` whose `invoke(Runnable)` executes the runnable, and the existing Gson/OkHttp dependencies. Cover two relay payloads:

1. a valid bundle fixture causes one bundle apply, one `/state` POST, `CONNECTED`, and a non-null last-import time;
2. the JSON string `"0123456789abcdef0123456789abcdef"` or malformed JSON causes no `/state` POST, leaves the previous bundle active, and produces `IMPORT_FAILED`.

Also assert that a `304` response does not advance the last-import time.

- [ ] **Step 4: Make bundle application return success**

Change `applyPastedBundle` to return `true` only after `FateLockedBundle.loadFromJson` succeeds, the active bundle is replaced, and `refreshPanel()` completes. On failure return `false` and retain the old bundle.

Before parsing manual input:

```java
String trimmed = json == null ? "" : json.trim();
if (source != ImportSource.RELAY && PairingSupport.isPairingCode(trimmed))
{
    if (invalidClipboardLimiter.shouldReport(trimmed, System.currentTimeMillis()))
    {
        panel.flashStatus("pairing code detected — use Connect tracker", false);
        log.info("Pairing code entered as bundle; directing user to Connect tracker");
    }
    return false;
}
```

Use a 30-second `RepeatedValueLimiter` for clipboard/paste failures. Do not emit another warning or stack trace for the same held value until the window expires.

- [ ] **Step 5: Move relay acknowledgement onto the successful client-thread path**

In `pollRelay`, do not set `lastTrackerSync` for a generic successful response or `304`. After a new message is decoded:

```java
final String acceptedVersion = etag != null
    ? etag
    : String.valueOf(msg.version);
clientThread.invoke(() -> {
    connectionState = TrackerConnectionState.IMPORTING;
    updatePanelSyncHealth();
    boolean imported = applyPastedBundle(payload, ImportSource.RELAY);
    lastRelayVersion = acceptedVersion;
    if (imported)
    {
        lastTrackerSync = Instant.now();
        connectionState = TrackerConnectionState.CONNECTED;
        postStateAck(trimmedCode, msg.version);
    }
    else
    {
        connectionState = TrackerConnectionState.IMPORT_FAILED;
    }
    updatePanelSyncHealth();
});
```

Set `OFFLINE` only on transport failure. On a successful `304`, retain `CONNECTED` when `lastTrackerSync` is non-null and otherwise retain `WAITING`.

- [ ] **Step 6: Run the focused and full plugin suites**

Run:

```powershell
.\gradlew.bat test --tests com.fatelocked.RepeatedValueLimiterTest --tests com.fatelocked.FateLockedRelayImportTest
.\gradlew.bat test
.\gradlew.bat clean jar
```

Expected: all JUnit tests pass and the standard unshaded Plugin Hub jar builds.

- [ ] **Step 7: Commit the standalone reliability fix**

Run:

```powershell
git add src/main/java/com/fatelocked/RepeatedValueLimiter.java src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/RepeatedValueLimiterTest.java src/test/java/com/fatelocked/FateLockedRelayImportTest.java
git commit -m "fix: acknowledge only successful RuneLite imports"
```

---

## Task 6: Mirror the verified standalone plugin into the tracker repository

**Files in tracker repository:**

- Create or update: `scripts/check-runelite-mirror.mjs`
- Create or update: `scripts/check-runelite-mirror.test.ts`
- Modify: `package.json`
- Replace from standalone source: `runelite-plugin/build.gradle`
- Replace from standalone source: `runelite-plugin/settings.gradle`
- Replace from standalone source: `runelite-plugin/gradle.properties`
- Replace from standalone source: `runelite-plugin/README.md`
- Replace from standalone source: `runelite-plugin/CONTRIBUTING.md`
- Replace from standalone source: `runelite-plugin/src/main/java/**`
- Replace from standalone source: `runelite-plugin/src/main/resources/**`
- Modify: `runelite-plugin/SOURCE_COMMIT`

**Interface:**

```json
"runelite:mirror-check": "node scripts/check-runelite-mirror.mjs"
```

- [ ] **Step 1: Bring the existing mirror verifier onto the implementation branch**

Use the already-tested verifier from `feature/fate-guardian`. Its compared paths must remain:

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

Run:

```powershell
npx vitest run scripts/check-runelite-mirror.test.ts
```

Expected: the verifier's drift test passes.

- [ ] **Step 2: Copy the verified release source and pin its commit**

Copy only the paths listed in `COMPARED` from the standalone checkout into `runelite-plugin`. Set `runelite-plugin/SOURCE_COMMIT` to the exact output of this command run in the standalone repository:

```powershell
git rev-parse HEAD
```

Do not copy standalone `.git`, build outputs, Gradle caches, IDE files, or test reports.

- [ ] **Step 3: Prove the mirror is byte-for-byte identical**

Run in the tracker repository:

```powershell
$env:RUNELITE_SOURCE_DIR='C:\Users\alexa\Downloads\flitest-main\RS3-Fate-Locked-Runelite'
npm run runelite:mirror-check
npm test
npm run build
```

Expected: the mirror matches the pinned standalone commit, the complete tracker test suite passes, and the GitHub Pages build succeeds.

- [ ] **Step 4: Commit the mirror**

Run:

```powershell
git add package.json package-lock.json scripts/check-runelite-mirror.mjs scripts/check-runelite-mirror.test.ts runelite-plugin
git commit -m "chore: mirror one-click RuneLite pairing"
```

---

## Task 7: Perform the same-PC trial before any public release

**Files:**

- Modify only if a discovered defect requires it: files from Tasks 1–6

- [ ] **Step 1: Start the tracker locally**

Run:

```powershell
npm run dev -- --host 127.0.0.1
```

Use the local Vite URL only for tracker-side checks. The final plugin URL remains the production GitHub Pages URL.

- [ ] **Step 2: Sideload the standalone plugin jar**

Build the plugin:

```powershell
.\gradlew.bat clean jar
```

Copy the produced jar into RuneLite's documented `sideloaded-plugins` directory for the local trial. Do not replace or modify the installed Plugin Hub copy.

- [ ] **Step 3: Verify the consent and connection matrix**

Perform and record these checks:

| Scenario | Expected result |
|---|---|
| Online sync off, click Connect tracker | Instruction shown; no code, browser, or relay request |
| Enable online sync | RuneLite displays the existing IP-address warning |
| Click Connect tracker | Fresh 32-character code stored; GitHub Pages opens with fragment |
| Tracker has no prior session | One confirmation names the active profile/account |
| Tracker already has a session | Confirmation explicitly warns that it will replace the current connection |
| Cancel | Old tracker session remains untouched; no upload caused by the request |
| Confirm | Fragment disappears; tracker adopts code and uploads current bundle |
| Valid relay bundle | RuneLite imports; `/state` acknowledgement makes tracker show connected |
| Malformed relay bundle | Old rules remain; no acknowledgement; plugin shows import failed |
| Relay temporarily offline | Old rules remain; plugin shows retrying and later recovers |
| Hold clipboard hotkey on a pairing code | One guidance message/log per 30 seconds, not a log flood |
| Restart RuneLite with sync enabled | Polling resumes and no inbound listener is created |
| Disable online sync | Polling and relay writes stop |

- [ ] **Step 4: Re-run automated verification after any trial fix**

Run:

```powershell
npm test
npm run build
```

Run in the standalone plugin repository:

```powershell
.\gradlew.bat test
.\gradlew.bat clean jar
```

Expected: both complete suites and both production artifacts succeed.

---

## Task 8: Publish through the normal GitHub and Plugin Hub review path

**Repositories:**

- Tracker GitHub repository
- Standalone plugin GitHub repository
- `C:\Users\alexa\Downloads\flitest-main\plugin-hub`

**Files:**

- Modify after push: `plugin-hub/plugins/fate-locked-ironman`

- [ ] **Step 1: Review and push the tracker and standalone plugin branches**

Confirm each branch contains only the intended pairing commits and preserved pre-existing work. Push both branches and open normal pull requests. Wait for tracker tests/build and standalone Gradle checks to pass.

- [ ] **Step 2: Verify the public GitHub Pages build**

Open:

```text
https://nubles.github.io/OSRS-Fate-Locked/#runelite-pair=0123456789abcdef0123456789abcdef
```

Expected: the production tracker removes the fragment, shows the confirmation dialog, and does not replace the existing relay session until confirmed. Cancel the verification dialog.

- [ ] **Step 3: Pin Plugin Hub to the reviewed standalone commit**

After the standalone feature is merged, run:

```powershell
git rev-parse HEAD
```

In `plugin-hub/plugins/fate-locked-ironman`, keep:

```text
repository=https://github.com/Nubles/RS3-Fate-Locked-Runelite.git
```

Replace only the `commit=` value with that exact merged standalone commit SHA.

- [ ] **Step 4: Commit the Plugin Hub manifest update**

Run:

```powershell
git add plugins/fate-locked-ironman
git commit -m "Fate Locked Ironman: one-click pairing"
```

Open the Plugin Hub pull request and let RuneLite's dependency verification, build, and human review complete. Do not bypass the review path or distribute the sideload jar as the public release.

