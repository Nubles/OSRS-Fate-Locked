# Equipment catalogue and RuneLite permissions

The app ships a fixed snapshot of the OSRS Wiki DPS calculator's equipment
data. `data/equipmentCatalogue.ts` records the upstream Git blob, capture date,
raw SHA-256 fingerprint, expected item count, and normalization version. The
public asset filename includes the upstream blob so a browser cannot silently
reuse another release's asset. The source test checks its complete byte hash.

Source: [WeirdGloop equipment data](https://github.com/weirdgloop/osrs-dps-calc/blob/main/cdn/json/equipment.json).
Item facts and images originate from the [Old School RuneScape Wiki](https://oldschool.runescape.wiki/).

All item IDs remain available to local loadouts and damage tools. Only items
with reviewed named/material rules in `utils/gearTiers.ts` appear in either
RuneLite permission map. Unreviewed items retain their clearly labelled local
estimates. Their omitted IDs mean unknown/no equipment warning in both legacy
and v4 plugin consumers; an estimate is never exported as a definitive lock.

The additive `rules.equipmentCatalogue` metadata reports source identity and
local/reviewed/estimated ID counts. Older plugins can ignore this metadata
because the permission maps already exclude estimates.

Caches must match the shipped source and normalization version. Existing
unfingerprinted caches can preserve the offline gear display while the asset
is unavailable, but export no equipment permissions. A successful load or
page reload restores reviewed permissions from the shipped asset. Profile
saves and equipped IDs are never rewritten during this migration.

To update the source, capture the complete upstream JSON, record its Git blob
and SHA-256, and add the asset under the corresponding fingerprinted name.
Update the metadata and full-catalogue test import together. Review family
and permission changes before release; do not restore a mutable `main` fetch.
Increment the normalization version if cache units or fields change.

The Vanilla relay size regression uses the actual catalogue and chunk data,
checks the complete JSON request envelope with at least 16 KiB spare, and
passes it through the Worker handler using local mock storage.
