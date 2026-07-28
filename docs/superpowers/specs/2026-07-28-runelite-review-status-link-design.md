# RuneLite Review Status Link Design

## Goal

Tell players that the submitted RuneLite Plugin Hub update is still awaiting
RuneLite review, is not live yet, and can be followed through the official
review pull request.

## Player-facing copy

Add this note to the existing **RuneLite Companion Update** release under
**Changed**:

> The RuneLite Plugin Hub update is awaiting RuneLite review and is not live
> yet. Follow the review in Plugin Hub PR #14395.

Only **Plugin Hub PR #14395** is the link. It points to:

`https://github.com/runelite/plugin-hub/pull/14395`

The link opens in a new tab so the companion run remains open.

## Data model

Existing changelog notes remain plain strings. Extend the authored note type
with one structured linked-note form containing:

- the note text;
- a descriptive link label; and
- the link destination.

`ChangelogRelease.sections` accepts either form. This avoids parsing Markdown,
HTML, or URLs from player-authored text and keeps the allowed link explicit.

## Rendering and safety

`ChangelogModal` renders string notes exactly as it does today. For a linked
note, it renders the text followed by the anchor and terminal punctuation.
The anchor uses `target=_blank` and `rel=noopener noreferrer`, with the existing
amber link styling and a visible keyboard-focus treatment.

The list key is derived from the string note or, for the structured form, the
note text and destination. No other changelog layout or interaction changes.

## Verification

Tests prove that:

- the newest RuneLite release contains the exact pending-review wording and
  official Plugin Hub PR destination;
- the modal renders the link with the expected accessible text;
- the link opens in a new tab with safe external-link attributes; and
- existing plain-string changelog notes still render normally.

Run the complete release gate, hosted pull-request CI, and GitHub Pages deploy
before confirming the notice is live.

## Status transition

This notice is intentionally temporary. When RuneLite approves and publishes
the Plugin Hub update, add a new player-facing What's New release announcing
that it is live and replace the pending wording as part of that reviewed
update. The mandatory changelog gate applies to that transition too.
