# Prototype Instructions

## Earth2 reference

- The user selected the running Earth2 Unity game as the reference for filling gameplay and content gaps in this Three.js version (2026-09-05). The reference source is `/Users/tiky/Projects/Earth2` (a symlink to the Unity project).
- Preserve the browser RTS and its existing visual identity; prioritize working construction, production, resource control, combined arms, technology and abilities grounded in Earth2. Reuse local reference assets where suitable. Do not modify the Unity project.
- Distinguish implemented reference mechanics from disabled reference UI placeholders; patrol and guard are disabled in Earth2's HUD source, and are intentional functional additions here.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Current expansion direction (2026-09-14)

- The user now explicitly authorizes improving both Earth2 and Earth-flash together. This supersedes the earlier instruction to avoid Unity changes for this game expansion.
- Keep the provided UI/battlefield art in Earth2/resources/design as the visual reference: warm temperate grassland, turquoise lakes, conifer groves, blue/gold factions and separated cyan glass HUD islands.
- Both versions now expose Frontier320, TwinLakes280 and Highland360 theaters with 12 strategic resource sites. Preserve existing save compatibility and the fixed local port 5173.
