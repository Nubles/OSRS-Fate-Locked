# Quest Helper source graph export

This exports source evidence from Quest Helper at `633ab56e2eb3eb363f21da3fd75f6f2bc0fa073a`, using its existing MockedTest initialization harness. The exporter is independently authored; existing upstream source files remain unchanged. Java 11 and the upstream Gradle 8.10.2 wrapper are used. RuneLite client, API, injected client and jshell resolve to **1.12.38**, forced by `pin.gradle`.

Run `./scripts/quest-helper-export/export.ps1` from PowerShell. An optional `-HelperDirectory` selects an existing checkout. Dependencies remain in a workspace `gradle-cache` beside the helper checkout. The script verifies the source revision, copies only the exporter test addition, and restores environment variables after the build.

`catalog-map.json` associates all 210 application entries with source enum/class identities. 207 entries have source coverage (208 helper classes, because Shield of Arrav has two gangs). Learning the Ropes, The Frozen Door and Into the Tombs need separate authored sources.

The output is `data/sources/runeproof-helper-graph.json.gz`, an offline research artifact. Do not import this raw graph into the browser bundle. The reviewed compiler produces a separate compact runtime artifact.

## Graph contract

- `catalog`: canonical quest IDs, helper enum/class/path associations, explicit missing-source diagnostics.
- `helperGraphs`: primary IRONMAN graph per helper; `profileVariants` retains NORMAL graphs for helpers whose source reads the account type.
- `roots`: numeric quest state to node reference. These are source quest states, not sequential guide-step numbers. ComplexState helpers use named root fields instead.
- `panels`: ordered panel references for presentation. Panel ordering is not a dependency DAG.
- `nodes`: identity-preserving records with `id`, `type`, `kind`, `sourcePath`, and `fields`. Field keys are `DeclaringClass.fieldName`; values reference nodes using `{ "$ref": "field:sourceVariable" }` where possible, otherwise deterministic traversal IDs.
- `conditionalEdges`: an ordered Map representation with `{key, value}` entries. A null condition is the default branch; the other conditions retain their source order. A default branch cannot run until preceding conditions are known false. Nested conditions must stay nested.
- `fieldAliases`: helper variable names to graph references, including nodes not directly listed in panels.
- `diagnostics`: custom step classes, opaque objects, initialization failures and client/account-dependent source construction. Unknown classes need explicit compiler handling, never an assumed pass.

No requirement `.check(client)` is called by the exporter. Mocked client state is needed only to initialize upstream source constructors. This does not make a particular graph universal: source conditionals may alter graph construction. Client-dependent helpers are flagged; account-type-dependent helpers have separate exports. Inventory cache nodes, rendering services and null attributes are omitted. No inventory consume/produce effects or Fate-Locked method/equipment permissions are inferred from display requirements.

`ItemRequirement.isConsumedItem` is a checklist annotation, not an action effect. Global required supplies cannot be consumed at every action that references them. Recommended items, bank checks, charged-item quantities, equip state, condition-to-hide and alternate item IDs remain distinct source fields.

Surface points are retained as source coordinates. Underground, instance, dynamic NPC and WorldEntity coordinates require reviewed normalization; raw coordinate division does not establish a surface destination. Existing app Standard permissions and travel rules remain authoritative.

Upstream source text is BSD-2-Clause licensed. Retain the source notices supplied with this exporter and provide attribution with any distributed source-derived guide text.

Offline graph files use deterministic gzip compression. `compression-integrity.json` records the original uncompressed SHA-256 values and byte lengths; contract tests verify lossless round trips. The Java exporter uses a zero-timestamp gzip stream. Public per-quest references remain ordinary JSON.
