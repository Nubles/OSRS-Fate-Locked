# Monster catalogue source

The DPS calculator and boss planner load a complete, release-pinned snapshot
from the app's own origin. First use no longer requires a browser request to
`raw.githubusercontent.com`.

The source is the [OSRS Wiki DPS calculator monster dataset](https://github.com/weirdgloop/osrs-dps-calc/blob/main/cdn/json/monsters.json).
Facts and images originate from the [Old School RuneScape Wiki](https://oldschool.runescape.wiki/).
The 22 September 2026 capture was verified against the [GitHub contents API](https://api.github.com/repos/weirdgloop/osrs-dps-calc/contents/cdn/json/monsters.json)
on 24 September 2026: its exact 2,359,359 bytes have Git blob
`c9f6dafdb70c20751d171fbc4f5b5d1701117c47` and SHA-256
`ec38284c4651cf76a568b5e95cd11cc942e2077d901d20041f770e56460dbca2`.

`data/monsterCatalogue.ts` records that identity, capture/verification dates,
2,860 raw rows, and the normalization version. The shipped filename contains
the blob identity; the source test verifies both complete byte fingerprints.
The service retains existing name/version deduplication (2,850 picker rows)
and separate light/standard/heavy ranged defences. Max hit is the largest
single hit in the wiki text: markup and hit counts ("17x2", "2 (x3)") are
ignored, and text with no number (N/A, Varies) reads as 0. That rule is
normalization version 2; version 1 took the first number, so markup-first
text such as Tormented Demons read as 0. This does not certify every
statistic or add encounter mechanics.

Normalized caches must match the source SHA-256 and normalization version and
contain valid, nonempty targets. Unfingerprinted older caches refresh from the
shipped asset. A matching fixed-source cache remains usable offline without a
time expiry; a changed source or normalization version invalidates it. Empty
or unavailable data leaves the service unready with an explicit Retry path.
Cache quota failures leave successfully loaded targets available in memory.
No profile saves or selected target IDs are rewritten.

To update, capture the complete primary JSON, verify its Git blob via GitHub,
and ship it under the new fingerprinted filename. Update the metadata and
full-source test expectations together; review changed target statistics
before release. Increment normalizationVersion when normalized semantics
change. Do not restore a mutable upstream browser fetch.
