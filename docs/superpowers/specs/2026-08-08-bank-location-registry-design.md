# Complete Bank Location Registry Design

**Date:** 2026-08-08

## Goal

Make every eligible fixed-location bank, bank chest, deposit box, deposit
object, and fixed NPC deposit service a bank-locked unlock. Each unlock remains
keyed by a canonical chunk id (`cx * 256 + cy`). The Woodcutting Leprechaun is
explicitly out of scope for this pass.

The generated bank pool currently contains 100 entries while the generated
chunk content contains 101. The reviewed result will contain 126 unique chunk
references: the current 101 plus 25 additions.

## Reviewed sources

The completeness review used the current OSRS Wiki revisions available on
2026-08-08:

- [List of banks](https://oldschool.runescape.wiki/w/List_of_banks), revision
  `15282054` from 2026-07-30.
- [Bank Deposit Box](https://oldschool.runescape.wiki/w/Bank_Deposit_Box),
  revision `15267085` from 2026-07-18.
- [Sangvesti bank](https://oldschool.runescape.wiki/w/Sangvesti_bank), revision
  `15262093` from 2026-07-12.
- [Castle Drakan](https://oldschool.runescape.wiki/w/Castle_Drakan), revision
  `15283343` from 2026-07-30.

The Wiki map coordinates were converted with the same canonical formula used
by the application. Internal and instanced facilities were compared with the
tracker's reviewed entrance mappings and connection graph.

## Scope policy

Include a facility when it is a persistent banking or depositing service and
has either:

1. a fixed physical walkable chunk;
2. a fixed NPC chunk; or
3. a stable, walkable surface entrance or access chunk for an internal area.

Multiple facilities that resolve to the same canonical chunk remain one bank
unlock. Examples include the Keldagrim bank and Dwarven Ferryman, and the Tombs
of Amascut bank and its restricted deposit pot.

Do not create unlocks for:

- **Woodcutting Leprechaun:** variable location; explicitly deferred by the
  user.
- **Tutorial Island bank:** onboarding-only and absent from the tracker's
  walkable chunk registry.
- **The Node bank:** Group Ironman onboarding-only and absent from the
  tracker's walkable chunk registry.
- **Gravedigger Mausoleum:** random-event-only internal service with no stable
  surface entrance.
- **Tool leprechauns, servants, and the Ferox mercenary:** item noting,
  fetching, or unnoting services rather than a fixed bank/deposit facility.
- **Removed or historical banks:** no longer accessible in normal play.

The Camelot PvP chest is included because it is a permanent fixed-location bank
on active PvP worlds and its surface chunk is walkable.

## Reviewed additions

### Direct physical chunks

| Chunk | Coordinates | Player-facing label |
|---:|---:|---|
| `5678` | 22,46 | Aldarin dock deposit box |
| `6454` | 25,54 | East Woodcutting Guild deposit box |
| `6458` | 25,58 | Arceuus bank and deposit box |
| `6711` | 26,55 | Saltpetre mine deposit box |
| `6712` | 26,56 | Hosidius Kitchen bank chest |
| `6961` | 27,49 | Fortis Cothon deposit box |
| `7225` | 28,57 | Port Piscarilius dock deposit box |
| `8499` | 33,51 | West Prifddinas dock deposit box |
| `8508` | 33,60 | Lunar Isle dock deposit box |
| `8751` | 34,47 | Zul-Andra deposit chest |
| `8757` | 34,53 | Gwenith deposit box |
| `8999` | 35,39 | Bank boat |
| `9274` | 36,58 | Neitiznot dock deposit box |
| `11047` | 43,39 | Red Rock bank chest |
| `11062` | 43,54 | Camelot PvP bank chest |
| `11572` | 45,52 | Falador west deposit box |
| `12082` | 47,50 | Port Sarim deposit boxes |
| `12838` | 50,38 | Great Conch Sacred Grove deposit box |

### Fixed NPC service chunks

| Chunk | Coordinates | Player-facing label |
|---:|---:|---|
| `10553` | 41,57 | Peer the Seer deposit service |
| `11056` | 43,48 | Rionasta deposit service |

The Dwarven Ferryman is already represented through Keldagrim's existing
`10810` access chunk, so it does not create a duplicate unlock.

### Stable access proxies

| Chunk | Coordinates | Player-facing label | Access represented |
|---:|---:|---|---|
| `8756` | 34,52 | Prifddinas north bank and Gauntlet deposit box | Amlodd/Hefin access |
| `11578` | 45,58 | Ancient Prison bank | God Wars Dungeon access |
| `12337` | 48,49 | Guardians of the Rift bank and deposit pool | Wizards' Tower route |
| `12849` | 50,49 | Zanaris bank | Lumbridge Swamp shed |
| `14132` | 55,52 | Sangvesti and Castle Drakan banking | Castle Drakan/Vampyrium access |

The Sangvesti bank was released after the pinned Chunk Picker source. The Wiki
places it in Vampyrium and identifies Castle Drakan as the stable Gielinor-side
location. Castle Drakan's surface coordinate resolves to `14132` and already
exists as a walkable named chunk in the tracker.

## Label corrections

The local registry will also override misleading generated chunk labels:

- `10275`: **Wyrmscraig bank chest**, replacing **Auchrie**.
- `11830`: **Ruins of Camdozaal (via Ice Mountain)**, replacing **Goblin
  Village**.

New proxy entries always use facility-first labels. The optional `accessVia`
text explains the surface reference without making the generic surface chunk
name the unlock's identity.

## Data model

Add a reviewed JSON registry under `data/sources/`. Each record contains:

- canonical string `id`;
- unique player-facing `name`;
- `referenceKind`: `physical`, `npc`, or `entrance`;
- optional `accessVia` for entrance proxies;
- `facilities`, listing the facilities covered by the chunk;
- Wiki evidence URL(s).

The same registry contains label-only overrides and explicit exclusions with a
reason. A validator rejects malformed ids, coordinate mismatches, duplicate
ids or names, unknown reference kinds, missing evidence, and entrance proxies
that are not present in the walkable chunk data.

## Generation flow

1. Read the pinned upstream Chunk Picker source.
2. Read and validate the local reviewed bank registry.
3. Union the registry additions with `rollingChunks.bank` during the chunk
   transform.
4. Generate `public/chunk-content.json` with the complete sorted bank-id set.
5. Generate `data/banks.ts` from the complete set, using registry labels before
   falling back to a chunk nickname.
6. Use `BANK_IDS.length` anywhere the UI presents the total; remove the
   hard-coded `/100` share-summary denominator.

The pinned upstream artifact remains byte-for-byte unchanged. Future upstream
refreshes cannot erase the reviewed additions, and an upstream addition that
duplicates a local id is harmless because the union is unique.

## Testing and verification

Tests will prove:

- all 25 reviewed additions are present;
- the final bank pool contains 126 unique ids and unique labels;
- Wyrmscraig and Camdozaal receive their corrected labels;
- all ids round-trip through `cx * 256 + cy`;
- every entrance proxy resolves to a walkable chunk;
- Woodcutting Leprechaun and the other explicit exclusions are absent;
- chunk-content regeneration is deterministic;
- `data/banks.ts` regeneration is deterministic;
- the share summary derives its denominator from `BANK_IDS.length`;
- the web and RuneLite bank-lock representations retain parity.

Verification will run the focused bank, transform, source, content-baseline,
share-modal, and RuneLite parity tests, followed by typechecking and a
production build.

## Non-goals

- Do not change bank-lock gameplay semantics beyond completing the fixed
  location pool.
- Do not give each facility in the same canonical chunk a separate roll.
- Do not add the Woodcutting Leprechaun or other variable-location services.
- Do not mutate the pinned upstream Chunk Picker export to encode local policy.
