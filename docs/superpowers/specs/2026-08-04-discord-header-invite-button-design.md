# Discord Header Invite Button Design

## Context

The Fate Locked tracker already exposes Discord notification settings inside the
header's settings menu. The official Discord community now has a stable public
home, so the app should make joining the community easy without conflating a
community invite with the separate webhook integration.

## Goal

Add a compact, always-visible Discord join button to the existing command-centre
header. The button should open the official server invite in a new tab and work
without app state, API calls, analytics, or Cloudflare Worker usage.

## Non-goals

- No Discord OAuth, bot login, webhook setup, or server-management flow.
- No change to the existing **Discord notifications** settings item.
- No invite URL stored in Discord settings, local storage, or run data.
- No temporary, single-use, or unverifiable invite URL shipped to production.

## UI design

Place the button in the header controls row beside the existing RuneLite button.
Use the same 32px control height, rounded border, and compact typography as the
adjacent controls. The recommended treatment is Discord violet (`#5865F2`) with
a subtle border and a chat/Discord icon. On desktop it renders the icon and the
label **Discord**; at narrow breakpoints the label is hidden while the icon and
accessible name remain.

The button must be an external link with a clear accessible name such as
`Join the Fate Locked Discord`. It should include a short tooltip and retain
keyboard focus styling. The existing header should not gain a second Discord
configuration control.

## Link behavior and configuration

Define one named `DISCORD_INVITE_URL` constant in the app's shared configuration
surface. The header consumes that constant rather than embedding the URL inline.
The value must be the permanent public invite for the Fate Locked Ironman server;
temporary invite links are not acceptable. Until that invite exists, the feature
must remain unimplemented rather than shipping a placeholder.

Render the control as a normal anchor with `target="_blank"` and a safe
`rel="noreferrer"` value. The link must not read or write local storage, trigger
profile changes, or make a network request beyond the browser's normal navigation
when the user activates it.

## Testing and acceptance

Add or extend a header DOM test to verify that:

1. The accessible Discord join control is present in the header.
2. Its `href` equals `DISCORD_INVITE_URL`.
3. It opens in a new tab with the safe relationship attribute.
4. Its text is visible at the desktop breakpoint and the icon remains available
   at the narrow breakpoint.
5. The existing **Discord notifications** action remains present and opens its
   settings modal independently.

Run the focused header tests and the existing app test suite. Manually verify the
button at desktop and narrow widths, confirm the official invite opens, and
confirm tracker state is unchanged after navigation.

## Rollout constraint

The permanent invite is an external prerequisite. Create or confirm that invite
through Discord's authenticated UI only after the server's launch checks pass,
then add it to the named constant and run the tests before publishing. The invite
URL must never be committed to a Discord webhook, tracker profile, or unrelated
documentation.
