# Frontier 3D prototype — visual and interaction QA

final result: passed

## Scope and reference

Source visual truth: `/Users/tiky/.codex/skills/artifact-template-rts/assets/reference.png` (2752 × 1536).
The user explicitly changed the deliverable from the raster-backed prototype to a true 3D game built with Blender models. The implementation is a low-poly interpretation retaining the blue/gold factions, octagonal bases, northwest lake, conifer borders, central ore, and diagonal supply road. It is not a photorealistic or pixel-identical reproduction. Additional HUD is required by the earlier game-interface brief.

Implementation: http://127.0.0.1:4174/ . Browser-rendered final overview: `qa/desktop-final.jpg` (1280 × 720). Desktop layout also checked at 1440 × 900. Narrow final evidence: `qa/narrow-final.jpg` (720 × 900). These captures are 1 image pixel per CSS pixel; the internal WebGL canvas uses capped display density. Source and desktop have approximately the same full-frame aspect ratio; compare world composition and materials rather than overlaying a HUD-free reference on a game UI.

State: initial deployment with three selected tanks, full bases and 640 credits. The final narrow screenshot follows the same initial deployment. `qa/victory.jpg` records the completed mission. Source and final overview were opened together in one comparison input. Focused typography evidence: `qa/header-detail.jpg`; units, production controls and commands are also readable in the full desktop and narrow captures.

## Findings and iterations

1. [P2, corrected] Sparse forest and over-bright terrain reduced reference continuity. Increased Blender conifer distribution and adjusted meadow materials and tone-map exposure. Subsequent overview confirms wooded margins, green terrain and distinguishable factions.
2. [P1, corrected] Road and landmass were omitted by the glTF mesh merge because textured primitive UV attributes differed from untextured mesh attributes. Normalized the unused UV/tangent attributes before merging, fail visibly on incompatible geometry, and corrected road winding. Final overview shows a continuous diagonal road and solid terrain edge. Final browser error log is empty.
3. [P2, corrected] Self-shadow artifacts striped the road. Disabled casting shadows for terrain, water and road material groups while retaining receiving shadows. Final overview shows clean road shading.
4. [P2, corrected] Tactical commands were hidden below 800 CSS pixels. Added the compact four-button command panel over the battlefield. All four buttons are visible at 720 × 900, and document width does not overflow.
5. [P2, corrected] World-space base label overlapped the mission panel on a narrow viewport. Put the mission panel above world labels. `qa/narrow-final.jpg` confirms that the label no longer obscures the objective/action text.

No remaining actionable P0/P1/P2 issue within the agreed desktop-first 3D prototype scope.

## Required fidelity surfaces

- Typography: Avenir Next with PingFang SC/Microsoft YaHei fallbacks; restrained uppercase metadata, readable Chinese headings, compact tactical labels. Source has no HUD typography; the HUD is an intentional addition. Header focus and full-view control labels were checked for clipping.
- Spacing/layout: persistent resource header, unobstructed battlefield center, mission card at upper left, bottom map/selection/commands. Desktop and 720px widths have no document overflow. Camera pan/zoom is the intended means to view the entire map at narrow widths.
- Colors/tokens: deep navy HUD, cyan Alliance highlights, brass enemy faction, amber ore, green meadow and turquoise water. Low-poly geometry and flat material treatment differ intentionally from the reference's realistic raster rendering.
- Asset quality: all battle-world models are genuine Blender GLB meshes. No CSS illustration substitutes. Hard-surface bevels, turret, wheels/tracks, infantry and harvester silhouettes load correctly. Imported static meshes are merged by material for runtime performance. UI portraits and minimap retain the earlier generated raster assets.
- Copy/content: Chinese gameplay instructions explain selection, attack, production, transport, camera controls and pause. Resources and mission state reflect the simulation; the fixed energy indicator is informational in this prototype.

## Interaction evidence

In an independent browser tab using the production build:

- Closed briefing, paused/resumed, selected unit cards, issued harvesting, queued a tank and commanded assault.
- Tank production reduced credits from 640 to 460, completed after its queue time, and increased friendly units from 7 to 8.
- Harvester returned 80 crystals; three defeated enemy units awarded 90 more credits, yielding 630 credits.
- Enemy headquarters reached zero HP and the visible victory modal reported 00:25, three kills, 80 crystals collected.
- Restart reset the mission to 640 credits, seven friendlies, full headquarters health and an empty queue.
- Zoom, return-to-base and reset-camera buttons responded. Middle-mouse rotation uses OrbitControls; automated middle-drag was not separately exercised.
- Final console error query returned an empty array.

`node --test tests/engine.test.js`: 7/7 passed, covering pause, production accounting, harvesting conservation, move completion, victory, defeat and reinforcement scheduling. Final `npm run build` passed. Vite reports a non-blocking large JavaScript chunk warning.

## Follow-up polish / limits

- [P3] Add richer terrain textures, water animation and weathering to approach the raster reference's visual richness.
- [P3] Add animated tracks and infantry gait. First version moves rigid models.
- This is one short single-player mission with simplified pathing, no multiplayer, saves or free building placement. Full phone touch gameplay and screen-reader spatial navigation are outside the desktop prototype scope.

## Implementation checklist

- [x] Blender source and GLB assets saved.
- [x] Model-loading errors, road render and narrow layout corrected.
- [x] Gameplay engine checks and browser completion verified.
- [x] Local production preview running; no deployment performed.
