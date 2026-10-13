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

The browser keeps the code and the last upload's time, checksum, run id and
History length in its own record per profile (`<profile>__onlineBackup`,
`utils/onlineBackupRecord.ts`).

An upload never replaces a backup of a different run, or of a longer one,
without asking: after Reset, a new run in the same profile, or a save another
page rewrote, uploads pause (`held` in the record, `backupRun`'s `held`
outcome), "Back up now" included. A banner and the Online backup tab then
offer **Replace it** or **Keep the old backup**; keeping it leaves the relay's
copy alone, forgets its code in this browser after showing it, and puts the
code under Restore a run. A record from before run ids were recorded holds
nothing back until its next upload records one.

## The newest copy and the previous copy

The relay keeps two copies of a backup: the newest and a previous one. A
restore offers both, with when each was backed up and how much History it
holds. An upload replaces the newest copy, and the copy it replaces becomes
the previous copy when either:

- **another browser wrote it.** Each browser names the copy it writes with 16
  random bytes, made when it turns backup on or restores a run. A browser
  holding an older run therefore can't erase newer progress.
- **a day has passed since the last time this happened** (`BACKUP_ROTATE_MS`,
  24 hours). So the same browser uploading a damaged or reset run can't
  erase the run as it was a day before: the upload that first follows the
  day's mark keeps the copy it replaces, and every upload in the next 24
  hours replaces only the newest copy. After a bad upload, the copy before
  it therefore stays restorable for at least a day; after that, the next
  upload may keep the bad copy in its place.

A backup's first upload starts the day's count. The time of the last rotation
travels in the newest copy's metadata (`rotatedAt`), so an upload that keeps
nothing is still one KV write; one that keeps the previous copy costs one KV
read and one more write. Copies stored before rotations were recorded keep
their previous copy on their next upload.

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
| `POST` | `/b/<id>` | Ciphertext, `Authorization: Bearer <write token>`, `X-Backup-Writer: <copy name>` | `{ updatedAt }`. `403` for another token, `413` over the longest encrypted sync code (`MAX_BACKUP_BYTES`, about 2.67 MiB), `400` for anything but a `FLBK1.<iv>.<ciphertext>` envelope in base64url or without a copy name, `429` with `Retry-After` within a minute of the last upload or past the per-IP limits. |
| `GET` | `/b/<id>` | | The newest copy, with `X-Backup-Updated-At`, or `404`. |
| `GET` | `/b/<id>/previous` | | The previous copy (see above), or `404`. |
| `DELETE` | `/b/<id>` | `Authorization: Bearer <write token>` | `{ deleted: true }`; both copies are gone. |

An `<id>` that isn't 32 bytes in base64url is answered `400` before the relay
looks anything up, as is an upload that isn't an envelope. Uploads and deletes
count toward the relay's per-IP write limit, and a new id toward its claim
limit; see "Abuse limits" in [online-relay.md](online-relay.md).

The first upload claims the id. The relay stores the body as it arrives, with
the SHA-256 of the write token (never the token), the upload time, the copy
name and the last rotation time as KV metadata, so an upload costs one KV
write and no parsing; the body is only checked, byte by byte, to be base64url
in the envelope's shape.

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
to 20 players). An upload from a different browser than the last one, and the
first upload each day, costs one more write, to keep the copy it replaces.
Storage is far below the 1 GB limit: a copy of a run with a 330 KB save is
about 220 KB. A copy is capped at the longest sync code (2 MiB) encrypted,
about 2.67 MiB, so any run small enough for a sync code fits: even a 1.3 MB
save whose browser can't compress makes a 1.73 MB sync code and a 2.31 MB
copy.

This estimate counts backups only. The same 1,000 writes a day also pay for
every RuneLite profile publish (up to about one a minute while playing) and
every shared-progress publish, so they, not backups, use most of it.
