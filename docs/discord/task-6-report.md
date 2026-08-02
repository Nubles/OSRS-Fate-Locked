# Task 6 - Onboarding and Safety Report

- Server: Fate Locked Ironman
- Server ID: `1533446664709341357`
- Date verified: 2026-08-02
- Overall status: complete with Server Guide live-UI blocker
- Public invite created: no
- Bots, webhooks, or paid features added: no

## Onboarding

Status: pass with Discord warning.

Onboarding is enabled with exactly these seven default channels:

- `#general`
- `#introductions`
- `#help-and-strategy`
- `#theorycrafting`
- `#media-and-clips`
- `run-journals`
- `#events-and-lfg`

The three pre-join questions were saved exactly as specified:

1. Required, multiple answers: **What path are you following?**
   - Vanilla -> `Vanilla`
   - Chunked -> `Chunked`
   - Custom -> `Custom`
   - Spectator -> `Spectator`
2. Optional, multiple answers: **What do you want notifications for?**
   - Tracker and mode updates -> `Updates`
   - Community events -> `Events`
   - Weekly seed -> `Weekly Seed`
3. Optional, multiple answers: **What would you like to explore?**
   - Run journals -> `run-journals`
   - Technical support -> `support-desk`
   - Ideas and feedback -> `ideas-and-feedback`

Discord published Onboarding while showing the warning `9 of 15 public channels are assignable through Questions and Default Channels`. No extra default channels, questions, or answers were added to silence that warning.

The published Preview was opened as a new member. Before answers were selected, it exposed exactly the seven default channels. All ten answers were then selected. Preview reported seven roles and displayed `Vanilla`, `Chunked`, `Custom`, `Spectator`, `Updates`, `Events`, and `Weekly Seed` in My Profile. It also exposed `run-journals`, `support-desk`, and `ideas-and-feedback`, confirming every role and channel mapping end to end.

## Server Guide

Status: blocked-live-ui.

The welcome message was saved as:

> Hi [@username]! Welcome to Fate Locked Ironman. Start with everything locked, earn Keys through OSRS progression, and let Fate decide what opens next. Official community for the fan-made mode. Not affiliated with Jagex.

Discord's 2026 New Member To-Dos accept a title, one `@everyone`-viewable channel, and a channel-activity completion rule. They do not accept an external URL. The exact native task `Create a run journal` -> `run-journals` was saved with completion when the member posts or responds in the forum. Discord also displays its automatic, non-editable `Read the rules` item.

These required external-link actions could not be represented:

- Read the official Codex -> tracker home, with instructions to use Gear -> Rules/Codex
- Open the Fate Locked tracker -> tracker home
- Install/connect RuneLite -> RuneLite guide

No Codex deep link was invented, and no unrelated channel task was used as a substitute. Server Guide therefore remains disabled and unpublished with Discord's requirement: `You must have a welcome message and at least 3 To-Do tasks.` This did not prevent Onboarding defaults and questions from being published.

## Rules Screening

Status: pass.

Discord 2026 exposes the native rules-acceptance gate at `Server Settings` -> `Access` -> `Server Rules`. The gate is enabled and displays `Members must agree to rules before they can chat or interact in the server.` These ten approved rules were saved in source order:

1. Treat members with respect. No harassment, hate speech, or targeted abuse.
2. No NSFW, graphic, or sexualised content.
3. No scams, phishing, malware, doxxing, impersonation, or credential requests.
4. Do not facilitate real-world trading, botting, account services, or violations of Jagex or Discord rules.
5. Keep content in the correct channel and avoid spam or disruptive pings.
6. Keep relevant self-promotion in `#media-and-clips`.
7. Label Custom rules clearly. Never misrepresent a run, ruleset, or verification evidence.
8. Use the appeal process for good-faith disagreements with moderation decisions.
9. Never share webhook URLs, private reports, or other sensitive information.
10. This is a fan community and is not affiliated with Jagex.

Persistence was verified by navigating from Access to Invites and back: the Server Rules switch remained checked, all ten rules remained exact and ordered, and no unsaved-changes bar appeared. Member Preview showed all ten numbered rules beneath `Before you can talk here...`; its `I have read and agree to the rules` checkbox was successfully selected. Submit remained disabled only because email verification is unavailable in Preview.

## AutoMod

Status: pass.

- `Block Mention Spam` is enabled.
- The unique-mention limit is exactly `5`.
- Mention-raid detection remains enabled.
- Block message is enabled.
- Send alert targets `#mod-alerts`.
- Time out member is disabled.
- `Block Suspected Spam Content` is enabled.
- Its Block message response is enabled.
- Its Send alert response targets `#mod-alerts`.
- No public-channel or public-role exemption was added.

A runtime spam test was not sent because Task 6 had no authorised non-staff test account and the plan reserves live member-path testing for Task 8.

## Raid Protection

Status: pass.

- Activity Alerts are enabled.
- Safety Notifications Channel is `#mod-alerts`.
- CAPTCHA suspicious accounts before joining is enabled by default.
- CAPTCHA all accounts during a suspected raid is enabled by default.

## Moderator 2FA

Status: pass after owner handoff.

The first activation attempt opened Discord's authentication prompt, so automation stopped without inspecting or entering any credential. After the owner completed authentication and resumed the task, `Require 2FA for moderator actions` was enabled and independently reopened with its switch checked.

## Final Discord Summary

The Safety Setup overview reported:

- Raid Protection and CAPTCHA: 3 of 3 enabled
- DM and Spam Protection: 5 of 5 enabled
- AutoMod: 2 of 5 enabled
- Permissions: 2 of 3 enabled

Task 6 is complete for every control Discord 2026 exposes with matching semantics. Rules Screening passes; the three external-link Server Guide actions remain the sole live-UI blocker.
