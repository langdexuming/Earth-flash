# Earth2 reference expansion · 2026-09-05

Reference: the running Earth2 macOS app and the user's local Unity source at `/Users/tiky/Projects/Earth2` (`/Volumes/MacDisk/Unity/Projects/Earth2`). Unity files were read only. This is a gameplay adaptation for the existing Three.js prototype, not a Unity project conversion.

## Implemented

| Reference mechanic | Browser implementation |
| --- | --- |
| Headquarters, Barracks, Factory, Airfield, Shipyard | Placeable, selectable, destructible buildings; footprint validation, construction preview and rotation |
| Per-building production recipes | Independent queues, cancellation refunds, rally points and population reservations |
| Infantry, Tank, Aircraft, Boat | Ground, flying and water domains, terrain-aware paths and combat; existing harvester retained |
| ResourceNode local force control | Four mineral sites, majority-of-nearby-ground-units control; equal forces neutralize control; recurring credit/alloy income |
| Population and energy readouts | Calculated from living completed buildings and units; overloaded supply halves production |
| tech.ballistics / reinforced_hulls / logistics | Original 260/280/320 costs, 24/26/30 second times, prerequisite, damage/armor/speed/production multipliers |
| ability.scan / overcharge | 20/30 energy, 35/45 second cooldowns; permanent scan region and +35% weapon damage for 8 seconds; 5 energy/second regeneration |
| Visibility service | Visible/explored grid, enemy and health-label concealment, mirrored minimap visibility |
| Save / load | Versioned browser-local snapshot preserving economy, orders, queues, research, fog, cooldowns and control groups |
| Combat feedback | Source gunshot/explosion/order/build sound effects and explosion sprites |

The source HUD (`RtsHudUiToolkit.RefreshCommandGrid`) explicitly disables Patrol, Guard and Focus. Patrol and Guard are deliberately implemented here as usable additions. Stop and Hold both halt movement and permit firing, matching the reference behavior. Scan duration follows the reference's permanent reveal semantics.

## Adaptations

- Retained the existing map, Chinese command-deck identity, three-tank opening, harvester loop, enemy reinforcement structure and destroy-HQ objective.
- Building construction takes 10–18 seconds here; modest alloy costs and alloy-funded repair give the alloy account an actual use. These timings/costs are browser balancing choices, not claimed exact Unity values.
- Reference unit HP, weapon damage and production prices/times are reused where applicable; speed/range are mapped to the browser's 1600×900 simulation coordinates. Existing headquarters durability remains 1800.
- The default starts with headquarters, barracks, factory and airfield (54 total population capacity); build a shoreline shipyard to unlock naval production.
- Air power crosses terrain; boats remain on the northwest lake. This is combined-arms combat on the current small map, not a large ocean campaign.
- The enemy contests the northern mine and advances in waves; later waves include aircraft. It does not reproduce the entire Unity AI profile system.
- The old baked buildings are excluded from terrain rendering so new building entities can be selected, damaged and destroyed without leaving duplicate scenery behind.

## Asset provenance

Copied from the user's Earth2 checkout for this local prototype:

- `Assets/External/EE2Converted/Models/{Aircraft,Airfield,Barracks,Factory,Headquarters}.glb` → `public/models/earth2/`.
- `Assets/Resources/UI/Icons/Thumbs/Thumb_{Aircraft,Airfield,Barracks,Factory,Headquarters}.png` → `public/assets/earth2/`.
- `Assets/Resources/Vfx/Vfx_Explosion.png` → `public/assets/earth2/`.
- Selected `Assets/Resources/Audio/Sfx_*.wav` → `public/audio/`.
- Patrol-boat geometry adapts the reference's procedural `MockupBoatVisual.cs`; the dock is a procedural Three.js structure. Boat/dock UI uses an anchor icon, not a fake image asset.

Original Earth2 asset licensing was not independently re-established; this work is a local reuse of user-provided project assets and was not publicly deployed.

## Verification and limits

`npm test` covers economy conservation, independent production, building validation, water restrictions, ship spawning, ground obstacles, patrol/guard/queued orders, research effects, ability cooldowns, building damage, supply limits, repair and save restoration, plus the original win/loss tests and Sites packaging tests.

Not ported: Unity animation/physics systems, full weather/day-night presentation, deterministic replay, AI profile/scenario selection, bilingual HUD, multiplayer, or editor tooling. Existing protected Sites configuration, worker and packaging scripts remain intact.
