# RuneProof requirement images

23 September 2026. Local preview only, no deployment or new bundled assets.

The Still needed cards now show artwork corresponding to structured requirements:
canonical equipment-slot images from SLOT_CONFIG, skill and quest Wiki icons, item
images through the existing cached WikiService, and exact known-chunk crops from
the existing local world map. Other or unverified requirements retain a generic
icon. Text, step links, readiness, and confirmation guards remain independent of
image availability.

Visual identity is carried in GuideNeed metadata, including the aggregate equipment
completion fallback; no matching against display prose. Unknown location metadata
never creates a precise chunk crop. Item identity changes remount the image lookup,
and late responses or failed artwork cannot preserve stale images.

Verification:

- 12 guideNeeds tests passed (real materialized Vanilla and pure fixtures).
- 13 display tests passed: all 9 Vanilla guide cases plus 4 artwork tests covering
  async item identity changes, image errors, canonical artwork, map bounds, and
  unknown-location fallback. Item lookups were mocked. No Chunked suite executed.
- Type check and production build passed. Existing large-bundle warning remains.
- Read-only review found no actionable correctness issues.
- Actual Vanilla Preview browser: The Restless Ghost loaded Neck_slot.png and
  visibly rendered it beside Neck T1. Its Step 3 link and 1/7 saved progress remain.
- At 320 x 844, the card fit at 222px wide, with document width equal to the 320px
  viewport. Label and step link stayed readable beside the artwork. Normal viewport
  restored; no save or Journal changes.

The preview is left on the Restless Ghost example. Browser verification covered
the real slot image; item/skill/quest/crop rendering and failure behavior were also
covered by isolated display tests. A missing-chunk gameplay scenario was not run.
Remote Wiki artwork may fall back to an icon when unavailable; map artwork is local.
