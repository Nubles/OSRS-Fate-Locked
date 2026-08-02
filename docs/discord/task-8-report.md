# Task 8 - Pre-Invite Launch Audit Report

- Server: Fate Locked Ironman
- Server ID: `1533446664709341357`
- Date audited: 2026-08-02
- Overall status: `COMPLETE_BLOCKED_NO_TEST_ACCOUNT`
- Configuration status: blocked pending a genuine non-staff account and real Discord mobile client
- Temporary invite created: no
- Permanent public invite created: no
- Discord state changed during audit: no
- Webhook: skipped by owner
- Webhook secret recorded: no
- Paid features purchased: no

## Stop Condition

The owner confirmed that no second Discord account is available. Task 8 therefore stopped at the plan's explicit gate: `blocked: non-staff account required`. No temporary one-use invite and no permanent public invite were created.

This is a completed blocked audit, not a passed launch. The server must not be described as publicly launched until every remaining runtime and mobile check has passed.

## Read-Only Role Inspection

Discord's `View Server As Role` was exercised for all four required views. No permission mismatch was found, so no corrective state change was made.

| View | Result |
|---|---|
| `@everyone` | All public categories were visible, STAFF COMMAND was absent, and protected channels were read-only. |
| Fatekeeper | The public surface plus only `#verification-queue` was visible; the other four staff channels were absent; protected channels remained read-only. |
| Verified Runner | The view matched `@everyone`; the role did not expose staff channels or elevated permissions. |
| Moderator | All five staff channels were visible and intended moderation/posting access was present without the Administrator permission. |

The live role list retained the intended hierarchy: Administrator, Moderator, Fatekeeper, Verified Runner, Vanilla, Chunked, Custom, Spectator, Updates, Events, and Weekly Seed. No Automation role exists. The `@everyone` permission editor showed mass mentions, Administrator, moderation, role management, channel management, and webhook management disabled.

## Desktop and Forum Evidence

- At desktop width, the circular server icon retained an identifiable amber key.
- Category and channel names were readable without ambiguous truncation.
- The welcome header, attachment, pinned primary message, four public links, and fan-project/Jagex disclaimer rendered.
- The public server description reads: `Official community for the fan-made Fate Locked Ironman OSRS challenge mode. Let Fate decide what you unlock. Not affiliated with Jagex.`
- The `#run-journals` New Post composer exposed title, body, and tag controls. Run/state tags were visible, the disabled submit state was preserved, and the composer was closed with Clear.
- After closing, no title field, composer, draft, post, or other audit artefact remained. The forum was empty.
- Required two-tag submission semantics and staff-only tag restrictions were not claimed as passed because no post was submitted with a genuine non-staff account.

## Mobile Blocker

A responsive web inspection at 390 x 844 did not provide a usable mobile surface. Discord retained its desktop layout: the server/sidebar region consumed or clipped the viewport, the role-preview bar overlapped, and the forum content was off-screen.

Responsive Discord web is therefore not a substitute for the required test in the real Discord mobile client. Mobile icon, navigation, onboarding, Rules Screening, forum, posting, and voice checks remain blocked.

## External Links

The four links published in `#welcome` were opened from Discord and matched their documented targets:

- Tracker: `https://nubles.github.io/OSRS-Fate-Locked/` - loaded the Fate Locked Ironman application.
- RuneLite guide: `https://nubles.github.io/OSRS-Fate-Locked/?open=runelite-guide` - the single-page app opened the RuneLite Plugin Guide dialog.
- Web repository: `https://github.com/Nubles/OSRS-Fate-Locked` - loaded the expected repository.
- Plugin repository: `https://github.com/Nubles/OSRS-Fate-Locked-Runelite` - loaded the expected repository.

No standalone Codex deep link or support link exists in the published welcome content. Discord's Server Guide cannot represent the approved external-link actions, so no fake link or non-equivalent channel task was created.

## Banner and Optional Integrations

Server Profile showed `Server Icon Colour` selected and only colour presets available. The future banner remains `deferred-no-boost`; no paid feature was purchased or requested.

Discord's live settings reported:

- no active invite links;
- zero webhooks;
- zero integration channels;
- no apps;
- no Automation role.

The native rules, onboarding, forums, channels, and manual staff workflow therefore do not depend on an optional integration. There was no integration to disable and re-enable. The Task 7 webhook was skipped by owner, so webhook embed, secret-storage, channel-scope, failure, and disable/re-enable checks remain skipped/not run rather than passed.

## Test-Artefact Audit

Discord's global search did not return a reliable completed result, so every staff channel was inspected directly instead:

- `#staff-chat`: no `STAFF TEST` content;
- `#mod-alerts`: no `STAFF TEST` content;
- `#reports-and-appeals`: no `STAFF TEST` content;
- `#verification-queue`: no `STAFF TEST` content;
- `#audit-log`: no `STAFF TEST` content;
- `#run-journals`: empty, with no test post.

Task 5 records that its sole `STAFF TEST - delete before launch` forum post was deleted. No current artefact needed deletion, and no invite needed revocation because no invite exists.

## Exact Remaining Launch Work

To clear the blocker, the owner must provide or control a genuine second Discord account and use the real Discord mobile client. Then:

1. Create a short-expiry, one-use invite and join with the non-staff account.
2. Confirm Rules Screening blocks interaction before acceptance and renders all ten rules.
3. Exercise all three onboarding questions; verify the seven defaults, selected and unselected role behaviour, requested channels, and staff invisibility.
4. Confirm public-channel posting succeeds after screening and protected-channel posting is rejected.
5. Submit a run journal and prove that one run-type tag and one state tag are required; prove the member cannot self-apply staff-only tags.
6. Send the harmless six-mention test, prove the threshold of five blocks it, and confirm one `#mod-alerts` alert.
7. Run the synthetic `STAFF TEST` verification rehearsal: Fatekeeper records `Approved` in `#verification-queue`; Moderator applies Verified Runner and the staff-only Verified journal tag; confirm Fatekeeper cannot apply either change.
8. Join and leave both voice rooms on desktop and in the real Discord mobile client.
9. Repeat presentation and usability checks in the real mobile client.
10. Remove the test role, tag, queue message, journal post, AutoMod test artefacts, and one-use invite.
11. Only after every mandatory check passes, create an unlimited-use, no-expiry invite targeting `#welcome` and deliver it directly to the owner without storing its URL in the repository.

Until then, the public invite remains withheld.
