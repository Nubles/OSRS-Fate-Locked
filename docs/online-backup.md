# Online backup

A run lives in the browser's storage, so clearing site data erases it. Online
backup keeps an encrypted copy of a run on the Fate Locked relay
(`workers/fate-relay`), opened only by a backup code the player keeps. It is
off until the player turns it on, under **Sync Code → Online**.

## The backup code

Turning backup on makes a random backup code for the active profile's run:
20 Crockford base32 symbols (100 random bits), shown as
`ABCDE-FGHJK-MNPQR-STVWX`. The player copies it or saves it as a text file,
and confirms they kept it, before backing up starts. Typing forgives case,
spaces and dashes, and reads O as 0 and I or L as 1.

Everything else comes from the code, in the browser
(`utils/onlineBackup.ts`). HKDF-SHA-256, salted with
`fate-locked-online-backup-v1`, derives three 32-byte values from it:

| Info | Use |
|---|---|
| `id` | Where the relay keeps the backup, in base64url. |
| `write` | The write token that lets the player replace or delete it. |
| `key` | An AES-256-GCM key that never leaves the browser. |

The copy is the run's sync code (`utils/syncCode.ts`), encrypted with that key
as `FLBK1.<iv>.<ciphertext>`, with `FLBK1` as additional data. The relay sees
only the id, the write token and ciphertext. Nobody without the code, the
relay included, can read or replace a backup, and nobody can reset a lost
code.

## When it backs up

`components/OnlineBackupDriver.tsx` uploads when the run changes: 30 seconds
after a burst of changes settles, at most every 15 minutes, and earlier when
the page is hidden with a change waiting, at most every 5 minutes. **Back up
now** and turning backup on upload at once. An unchanged run is not sent again. Only the tab that owns the
save uploads. A failed upload is tried again after 5 minutes, and the Online
tab says why it failed until one works.

The browser keeps the code and the last upload's time and checksum in its own
record per profile (`<profile>__onlineBackup`, `utils/onlineBackupRecord.ts`).

## Two browsers, two copies

Each browser names the copy it writes with 16 random bytes, made when it turns
backup on or restores a run. When another browser uploads, the relay keeps
the copy it replaces as the previous copy. A browser holding an older run
therefore can't erase newer progress: a restore offers both copies, with when
each was backed up and how much History it holds. The same browser backing up
again replaces only its own copy.

## Restoring a run

**Restore a run from its backup code** fetches both copies, decrypts them and
checks them as a sync-code import does. The player picks one; it replaces the
profile's save after a confirmation, and the save it replaces is kept on the
Backups tab. The profile then keeps backing the run up with the same code, as
a new copy of its own.

## Turning it off

**Turn off** asks first, deletes both copies from the relay, and makes this
browser forget the code. Another browser that still has backup on for the run
backs it up again on its next change.

## The one-time prompt

Once a run has 10 History entries, `components/OnlineBackupPrompt.tsx` asks
once whether to turn backup on. **Set up** opens the Online tab; **Not now**
answers it for good. While the prompt is unanswered, and while online backup
has a copy from the last week, the "export a .fate backup" reminder waits.

## Relay API

| Method | Path | Request | Response |
|---|---|---|---|
| `POST` | `/b/<id>` | Ciphertext, `Authorization: Bearer <write token>`, `X-Backup-Writer: <copy name>` | `{ updatedAt }`. `403` for another token, `413` over 3 MiB, `400` for anything but a `FLBK1.` envelope or without a copy name, `429` with `Retry-After` within a minute of the last upload. |
| `GET` | `/b/<id>` | | The newest copy, with `X-Backup-Updated-At`, or `404`. |
| `GET` | `/b/<id>/previous` | | The copy another browser's upload replaced, or `404`. |
| `DELETE` | `/b/<id>` | `Authorization: Bearer <write token>` | `{ deleted: true }`; both copies are gone. |

The first upload claims the id. The relay stores the body as it arrives, with
the SHA-256 of the write token (never the token), the upload time and the copy
name as KV metadata, so an upload costs one KV write and no parsing.

## Privacy and retention

A copy holds the run's save: the same data a sync code or `.fate` file holds,
encrypted. Each copy expires 90 days after it was stored, so a run backed up
at least every 90 days keeps its backup. Turning backup off deletes both
copies at once.

## Capacity

The relay runs on Cloudflare's free plan. KV allows 1,000 writes a day for
everyone. A player uploads at most every 15 minutes, or every 5 minutes while
switching between the game and the tracker, so a two-hour session costs at
most 24 writes, and the plan covers a small community (the project expects 1
to 20 players). An upload from a different browser than the last one costs one
more write, to keep the copy it replaces. Storage is far
below the 1 GB limit: a copy of a run with a 330 KB save is about 220 KB, and
a copy is capped at 3 MiB, which any run small enough for a sync code fits.
