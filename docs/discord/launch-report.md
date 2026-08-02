# Fate Locked Discord Launch Report

- Server: Fate Locked Ironman
- Configuration status: in progress
- Public invite: withheld until launch checks pass
- Webhook secret recorded: no
- Paid features purchased: no

## Checkpoints

| Task | Status | Evidence |
|---|---|---|
| 3 - Community server creation | pass | server ID: `1533446664709341357`; banner: deferred-no-boost |
| 4 - Roles and hierarchy | pass | 11 specified roles created and saved in matrix order; Automation deferred until a managed bot role exists; Moderator has no Administrator or Manage Webhooks grant |
| 4 - Categories and channels | pass | five public categories and STAFF COMMAND match the required order and channel types; retained prerequisite channels were moved rather than duplicated |
| 4 - Permission overrides | pass | protected public areas are member-read-only with explicit Moderator posting; staff is hidden from `@everyone`; Fatekeeper sees only `#verification-queue` in staff |
| 4 - View Server As Role | pass | `@everyone`, Fatekeeper, Verified Runner, and Moderator each matched `permission-matrix.md`; no unsaved settings remained |
| 5 - Channel topics and Notice Board content | pass | all 20 text and forum topics were saved and reopened for source comparison; the approved community header, welcome opening, rules and verification guidance, role descriptions, and pre-launch notice are published |
| 5 - Forum configuration | pass | all three forums use list view and required tags; member and staff-only tags, source guidance/templates, and the run-journal required-tag flow were verified; the clearly labelled staff test post was removed |
| 5 - Pins and content inspection | pass | exactly one primary message is pinned in `#welcome`, `#rules-and-safety`, and `#roles-and-pings`; `#announcements` has no pins; the welcome attachment, four public links, and fan-project disclaimer are present |
| 6 - Onboarding | pass-with-warning | Onboarding is enabled with the seven specified default channels and all three specified questions; published Preview exercised all ten answers and confirmed seven role grants plus the three requested channel grants; Discord warns that 9 of 15 public channels are assignable, and no extra channels or answers were added |
| 6 - Server Guide | blocked-live-ui | welcome message and `Create a run journal` -> `run-journals` are saved alongside Discord's automatic `Read the rules` item, but Server Guide remains disabled because Discord 2026 requires at least three channel-only To-Do tasks; external URL actions are unsupported, so no non-equivalent substitutions were created |
| 6 - Rules Screening | pass | the native `Server Settings` -> `Access` -> `Server Rules` gate is enabled with the ten approved rules in source order; persisted editor state and member Preview confirmed that agreement is required before chatting or interacting |
| 6 - AutoMod and raid protection | pass | Block Mention Spam is enabled at five unique mentions with message blocking and `#mod-alerts` alerts, mention-raid detection retained, and timeout disabled; suspected-spam blocking and alerts are enabled; Activity Alerts target `#mod-alerts`; both default CAPTCHA protections are enabled |
| 6 - Moderator 2FA | pass | `Require 2FA for moderator actions` is enabled; activation paused for the owner's authentication handoff and was verified after the owner resumed |
