# One-Click RuneLite Pairing Design

**Date:** 2026-07-26
**Status:** Approved for implementation planning
**Repositories:** `Nubles/OSRS-Fate-Locked`, `Nubles/RS3-Fate-Locked-Runelite`

## Purpose

Replace the current copy-and-paste pairing-code setup with a one-click handoff
from the RuneLite plugin to the GitHub Pages tracker. Keep the existing
outbound-only HTTPS relay, explicit network consent, manual recovery paths, and
Plugin Hub compliance boundaries.

The intended first-time experience is:

1. The player enables **Online sync** in RuneLite and accepts RuneLite's
   existing third-party-server warning.
2. The player presses **Connect tracker** in the Fate Locked side panel.
3. RuneLite opens the GitHub Pages tracker with a one-time pairing request.
4. The tracker explains what will be shared and asks the player to press
   **Connect**.
5. The tracker uploads the current run bundle.
6. RuneLite validates and imports the bundle, then acknowledges success.
7. Both surfaces show the successful import.

There is no pairing-code copying, JSON pasting, directory selection, local
server, or browser extension.

## Goals

- Make normal pairing a two-action, one-time flow: enable network sync in
  RuneLite, then confirm the browser handoff.
- Preserve RuneLite's mandatory network warning and default-off behavior.
- Keep all plugin networking outbound and asynchronous.
- Report success only after RuneLite has parsed and applied a valid bundle.
- Keep clipboard and file imports as clearly labelled recovery options.
- Prevent a pairing code from being mistaken for a run bundle.

## Non-goals

- Removing the relay or supporting offline automatic sync.
- Starting a localhost HTTP or WebSocket server.
- Automatically enabling network sync or bypassing RuneLite's warning.
- Automatically rolling, awarding keys, moving the player, or performing any
  gameplay action.
- Replacing the Roll Inbox event protocol.
- Adding authentication accounts or a general-purpose cloud backend.

## Compliance boundaries

The implementation must remain straightforward for Plugin Hub review:

- **Online sync remains off by default.**
- The existing `@ConfigItem` IP-address warning remains unchanged and must be
  accepted by the player.
- Pressing **Connect tracker** is an explicit user action.
- The plugin uses the injected `OkHttpClient` for outbound HTTPS only.
- The plugin opens the tracker with RuneLite's existing `LinkBrowser` utility.
- The plugin starts no listener, server, subprocess, or external program.
- The plugin uses no reflection, JNI, native code, runtime-downloaded code, or
  unreviewable dependency.
- The pairing flow sends no RuneScape credentials, cookies, chat history, or
  full inventory.
- The plugin continues to observe and display state only; it never performs a
  gameplay action or invokes the app's roll path.

Every Plugin Hub update will include focused tests and a concise description of
the network-flow change for reviewers.

## User experience

### RuneLite side panel

The sync-health card gains a primary **Connect tracker** button.

When Online sync is disabled, the card says:

> Enable Online sync in the plugin settings first.

It does not generate a code, open the browser, or make a network request.

When Online sync is enabled, pressing **Connect tracker**:

1. generates a fresh pairing code;
2. stores it as the plugin's configured sync code;
3. clears state tied to the previous code;
4. opens `https://nubles.github.io/OSRS-Fate-Locked/#runelite-pair=<code>`;
5. changes the card to **Waiting for tracker confirmation**.

The existing editable sync-code setting remains under the advanced/manual
configuration path for recovery.

### Tracker

On startup, the app consumes a valid `#runelite-pair=<code>` fragment, removes
the fragment from the visible URL immediately, and displays a confirmation
dialog:

> Connect this Fate Locked run to RuneLite?
>
> This sends your run rules and progress through the temporary Fate Locked
> relay. It never sends RuneScape credentials.

The dialog shows the active profile and bound account when present. If the
browser already has a relay session, it states that continuing will replace
the previous RuneLite connection.

**Connect** adopts the plugin-generated code, creates a fresh private browser
write token, and uploads the current run bundle. **Cancel** makes no session or
network change.

The dialog waits for RuneLite's successful-import acknowledgement. It then
shows **Connected** and closes. A timeout leaves the session available for retry
and offers the manual pairing code under **Advanced help**.

## Pairing protocol

### Pairing code

RuneLite generates a 32-character lowercase hexadecimal UUID value with the
hyphens removed. This provides approximately 122 bits of randomness while
remaining compatible with the relay's existing 4-to-40-character route.

The pairing code is a read capability. The browser's existing private write
token remains separate and is never placed in the URL.

The URL fragment is used so GitHub Pages does not receive the pairing code in
the initial HTTP request. The app clears the fragment before making relay
requests or rendering normal navigation.

### Browser session adoption

`RelaySyncService` gains an explicit `adoptCode(code)` operation:

- reject values outside the pairing-code contract;
- create a new private write token;
- replace the previous relay session only after browser confirmation;
- persist the new session using the existing storage key;
- emit one state change so `OnlineSyncDriver` performs its normal debounced
  bundle upload.

The worker's main `/r/:code` resource and first-writer token model remain
unchanged.

### Plugin import acknowledgement

The plugin resets `lastRelayVersion` and `lastTrackerSync` whenever the pairing
code rotates. Otherwise an ETag from the previous code could incorrectly turn a
new slot's first response into `304 Not Modified`.

The relay response is not considered a successful connection by itself.
RuneLite must:

1. receive the payload;
2. parse and validate the complete bundle;
3. atomically replace the previous valid bundle;
4. update the side panel;
5. post the existing `/state` acknowledgement.

`postStateAck` must only run after the client-thread import returns success. A
malformed or future bundle retains the previous rules and produces no success
acknowledgement.

## State model

The visible connection state is one of:

- **Off** — Online sync is disabled.
- **Ready to connect** — consent is enabled, but there is no active pairing.
- **Waiting for tracker** — a new code was generated and the browser was opened.
- **Importing** — a payload arrived and is being validated.
- **Connected · last import _time_** — a valid bundle was applied.
- **Offline** — relay communication failed after a pairing existed.
- **Import failed** — a payload arrived but was invalid; previous rules remain.

The tracker distinguishes **bundle uploaded** from **RuneLite confirmed**. It
never labels an HTTP `POST` alone as connected.

## Manual recovery and input safety

Clipboard and file imports remain available under **Advanced recovery**.

Before JSON or compressed-bundle parsing, the plugin detects values that match a
pairing-code shape. Instead of parsing them, it displays:

> This looks like a pairing code. Use Online sync or Connect tracker; it is not
> a run bundle.

Repeated attempts with the same invalid clipboard value are rate-limited so a
held hotkey cannot flood the log or client thread. Other malformed inputs show
one concise failure while retaining the previous rules.

The web tracker's current copy-code flow remains temporarily available during
one compatibility release and can later move under **Advanced help**.

## Failure handling

- **Online sync disabled:** Connect tracker makes no network request and directs
  the player to the reviewed configuration toggle.
- **Malformed fragment:** the tracker discards it without creating a session.
- **Player cancels:** the fragment is cleared; the existing session is
  unchanged.
- **Existing browser session:** replacement requires explicit confirmation.
- **Relay unavailable:** both surfaces show offline/retry guidance; RuneLite
  keeps its last valid bundle.
- **Invalid bundle:** RuneLite rejects it atomically and sends no success
  acknowledgement.
- **Browser confirmation timeout:** keep the new pairing active and allow Retry,
  rather than generating another code automatically.
- **Repeated Connect clicks:** rotate to one new code, clear prior ETag/sync
  state, and invalidate the pending UI state for the older code.
- **RuneLite restart:** the stored code resumes normal polling only when Online
  sync remains enabled.

## Component changes

### App and relay repository

- `services/relaySync.ts`
  - add pairing-code validation and `adoptCode`;
  - preserve the existing private write-token behavior.
- `components/RunelitePairingDialog.tsx`
  - render confirmation, replacement warning, pending, success, timeout, and
    error states.
- `App.tsx`
  - consume and clear the `#runelite-pair=` fragment;
  - mount the pairing dialog.
- `components/RuneLiteOnboarding.tsx`
  - keep manual code setup as compatibility/advanced help;
  - use accurate upload-versus-confirmed wording.
- No relay worker route or storage migration is required for the basic pairing
  flow.

### Standalone plugin

- `FateLockedPanel`
  - add the Connect tracker callback and pairing state copy.
- `FateLockedPlugin`
  - generate and persist the code;
  - clear prior-code state;
  - open the fragment URL;
  - acknowledge only successful imports;
  - detect pairing codes in manual bundle import.
- `FateLockedConfig`
  - preserve the current Online sync warning and manual sync-code field.

After standalone verification, mirror the reviewed plugin source into the app
repository and update the Plugin Hub manifest only through its normal reviewed
release process.

## Testing

### App tests

- valid fragments open the confirmation dialog and are removed from the URL;
- malformed fragments create no session;
- Cancel preserves the previous session and makes no request;
- Connect adopts the supplied code and generates a fresh write token;
- replacing an existing session requires confirmation;
- `OnlineSyncDriver` pushes exactly one current bundle after adoption;
- upload success does not display Connected before `/state` confirms;
- timeout and relay failure preserve retry and manual recovery;
- Online sync disabled produces no polling from other drivers.

### Plugin tests

- generated codes match the 32-character contract and consecutive pairings
  differ;
- no code is generated and no browser is opened while Online sync is disabled;
- the tracker URL uses the fragment contract and URL-safe code;
- rotating a code clears the previous ETag and last-sync timestamp;
- a valid bundle applies before `/state` is posted;
- an invalid bundle retains previous rules and posts no acknowledgement;
- a pairing code sent to clipboard import produces guidance instead of parsing;
- repeated identical invalid imports are rate-limited;
- no network call occurs behind a disabled consent gate.

### Manual release matrix

1. Fresh Plugin Hub installation and fresh browser profile.
2. Existing valid pairing replaced with a new pairing.
3. Browser confirmation cancelled.
4. Relay unavailable during pairing, then restored.
5. Malformed payload delivered to a pending code.
6. RuneLite restarted before and after confirmation.
7. Tracker refreshed while waiting for confirmation.
8. Clipboard and file recovery paths still import valid bundles.
9. Online sync disabled throughout a play session produces no relay traffic.

## Success criteria

- A first-time player never copies or pastes a pairing code during the normal
  flow.
- The only required first-time actions are accepting RuneLite's network consent,
  pressing **Connect tracker**, and confirming in the browser.
- The tracker never shows Connected before RuneLite applies a valid bundle.
- Pairing-code input cannot trigger JSON parse-log flooding.
- The plugin remains outbound-only, default-off, non-automating, and suitable
  for normal Plugin Hub review.
