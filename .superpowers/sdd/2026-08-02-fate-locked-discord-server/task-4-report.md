# Task 4 report — Discord structure and permissions

- Date: 2026-08-02
- Server: Fate Locked Ironman (`1533446664709341357`)
- Result: pass
- Secrets, invites, and webhook credentials recorded: no

## Roles

The live hierarchy is ordered `Administrator`, `Moderator`, `Fatekeeper`, `Verified Runner`, `Vanilla`, `Chunked`, `Custom`, `Spectator`, `Updates`, `Events`, `Weekly Seed`, then `@everyone`. Owner remains implicit above the managed roles. `Automation` was not created because no managed bot role exists.

Administrator has Discord's Administrator permission. Moderator has the moderation grants defined in `permission-matrix.md`; Administrator and Manage Webhooks remain disabled for Moderator. Fatekeeper, Verified Runner, identity roles, and notification roles have no moderation grants. Role colours and hoist settings match the Task 4 specification.

The first role-order change did not persist until Discord's visible **Save Changes** control was used. The saved hierarchy was reopened and verified after that correction.

## Categories and channels

The live sidebar is ordered as follows:

```text
THE NOTICE BOARD
  #welcome
  #rules-and-safety
  #roles-and-pings
  #announcements (Announcement)
ADVENTURERS' GUILD
  #general
  #introductions
  #help-and-strategy
  #theorycrafting
  #media-and-clips
FATE'S LEDGER
  run-journals (Forum)
  #verified-showcase
  #live-unlocks
THE WORKSHOP
  support-desk (Forum)
  ideas-and-feedback (Forum)
THE GATHERING
  #events-and-lfg
  The Campfire (Voice)
  Quiet Grind (Voice)
STAFF COMMAND
  #staff-chat
  #mod-alerts
  #reports-and-appeals
  #verification-queue
  #audit-log
```

The unused default voice channel and its empty category were removed. To obtain the exact Notice Board order, the original empty announcement channel was audited for messages, pins, integrations, and webhooks, renamed temporarily, replaced with a new Announcement channel in the correct position, then deleted. No content or integration was lost.

## Permission checks

- `@everyone` is read-only in THE NOTICE BOARD, `#verified-showcase`, and `#live-unlocks`; sending messages, posting in threads, creating threads/posts, and mass mentions are denied there.
- Moderator has explicit posting/thread permissions in those protected public areas while Manage Webhooks remains disabled.
- Public member text, forum, and voice areas retain the member permissions defined in the matrix.
- STAFF COMMAND denies View Channel to `@everyone` and allows Administrator and Moderator. The retained `#mod-alerts` channel has an explicit Moderator override.
- Fatekeeper has a channel-only View Channel override on `#verification-queue`; no other staff channel grants Fatekeeper access.

## View Server As Role evidence

| Role | Result | Sanitized observation |
|---|---|---|
| `@everyone` | pass | All public categories visible; STAFF COMMAND and `#verification-queue` hidden; protected public channel showed the read-only denial. |
| Fatekeeper | pass | Public categories plus only `#verification-queue`; the other four staff channels hidden; protected public channel read-only. |
| Verified Runner | pass | Same access as `@everyone`; no staff channels or additional permission grants. |
| Moderator | pass | All five staff channels visible; THE NOTICE BOARD, `#verified-showcase`, and `#live-unlocks` writable; no Manage Webhooks grant. |

The role preview was exited after verification. No unsaved Discord settings remained.
