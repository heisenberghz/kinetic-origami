# The Kinetic Origami Archipelago

## World Identity & Next Chapters

This document defines the next evolution of the interactive paper world. The primary direction is **world building**. Interaction and performance support that world; they are not separate products.

## North Star

> A living paper sanctuary where folded mountains, tidal lotus gardens, migrating cranes, and a cursor-led manta ray move through a continuous horizon.

The experience should feel like entering a place, not operating a website. The 3D world is the primary interface. Editorial UI is quiet, optional, and always yields to the scene.

## Dev Harness

Runtime checks stay manual, but camera framing must be reproducible so screenshots are comparable across commits. `src/world/harness.js` adds URL parameters for this. They are read once at boot, and ignored entirely when absent.

| Parameter | Effect |
| --- | --- |
| `?pose=cathedral\|lagoon\|shoals\|open` | Jumps the camera target to a landmark centre at a fixed radius. Sets both pan target and current value, so there is no settle-in animation. |
| `?mood=dawn\|midnight` | Boots directly into a mood without the field menu. |
| `?orbit=245` | Sets orbit theta in degrees. |
| `?phi=70` | Sets camera elevation in degrees, clamped to the playable range. |
| `?zoom=12` | Sets orbit radius, clamped to the playable range. |
| `?stats=1` | Shows a fixed panel with fps, average frame time, draw submissions, triangles, device pixel ratio, and live camera values. |

Any malformed or unknown value is ignored rather than throwing, so a bad URL still boots. Overrides are re-applied on resize and on scene reset, so `R` returns to the framed pose rather than the default one.

Typical acceptance sweep:

```
?pose=cathedral&stats=1
?pose=lagoon&stats=1
?pose=shoals&stats=1
?pose=open&mood=midnight&stats=1
```

## Current Baseline

- ES module project, no build step. `index.html` holds markup and styles only.
- Modules: `src/main.js` (scene, ocean, crest field, islands, manta, cranes, lotuses, input, UI), `src/world/horizon.js`, `src/world/atmosphere.js`, `src/world/landmarks.js`, `src/world/backdrop.js`, `src/world/layout.js`.
- `src/world/layout.js` is the single source of truth for every world position: regions, islands, lotuses, cranes, sails, plan radii, and camera limits.
- `test/layout.test.js` runs on `node --test` with zero dependencies and asserts that nothing overlaps, nothing spawns inside the default camera shell, backdrop ridges stay beyond max zoom, and every landmark keeps its satellites and cranes.
- Procedural washi, vellum, indigo, vermilion, and gold-leaf visual language.
- Faceted low-poly paper ocean with persistent crease interaction and an organically wobbled rim.
- Three landmark regions built: Folded Cathedral, Lotus Lagoon, Windbreak Shoals.
- Distant backdrop ridge rings beyond the ocean edge, unlit and colour pre-blended toward the sky so they recede without relying on scene fog.
- Manta ray, crane flock, lotus blossoms, paper particles, ribbons, and island forms.
- Damped orbit, zoom, pointer/touch input, keyboard exploration, mood switching, pause, and reduced-motion handling.
- Field menu replaces the persistent website-style control layer; the plate line reads the current region.
- Verified manually at approximately 60 FPS on the user's integrated graphics hardware.
- No audio layer is currently included; audio is a later isolated phase.
- No headless browser or automated runtime testing is permitted for this project.

## Phase Status

- **Phase 1 World Map:** done. Regions, positions, silhouettes, and camera-facing compositions are defined and covered by tests.
- **Phase 2 World Layers:** in progress. Foreground sails and near-field islets exist, the ocean rim is organic, and backdrop ridges are in. Ridge recession and fog tuning still need wide-vista review in both moods.
- **Phase 3 to Phase 6:** not started.

## Priority 0: Acceptance Gate

Measured baseline, dawn, wide vista at the default pose, on the user's integrated AMD APU:

| Metric | Measured | Contract | Result |
| --- | --- | --- | --- |
| Frame rate | 60.0 fps | 60 fps | pass |
| Frame time | 16.67 ms | under budget | pass, vsync locked |
| Draw submissions | 66 | preferably under 50 | fail, over by 16 |
| Triangles | 7,793 | well under 60,000 | pass |
| Device pixel ratio | 1.25 | adaptive, low power | pass |

Draw submission breakdown, largest first:

- 30 — islands, as 13 separate base, shard and sail meshes
- 8 — manta body, two wings, two accents, two eyes, tail
- 5 — cathedral spire parts
- 4 — far water disc and three horizon layers
- 3 each — sun, ribbons, backdrop ridge rings, lotus instances
- 2 each — lagoon basin and reeds, shoal spillway and sails

The obvious win is instancing the islands, which share three geometries and differ only in transform and tint. That would replace roughly 30 submissions with 3 and bring the total near 40. The roadmap already asks that draw submissions must not grow with the number of landmarks, and right now they do.

Still to verify by hand: macro and working views, the midnight mood, and touch behaviour.

---

# Track 1: World Building — Primary

## 1. Give the archipelago a map

The world should have memorable regions with distinct silhouettes, depths, and behaviors. Start with three landmarks:

### The Folded Cathedral

- A cluster of tall triangular paper peaks.
- A warm gold light source behind the peaks.
- Cranes circling above the ridge.
- Deep shadowed valleys that make the paper construction readable.

### The Lotus Lagoon

- A low, wide basin with several large lotus blossoms.
- Soft ripples and reflective paper surfaces.
- A calm space where the manta passes close to the camera.
- A clear visual destination for touch exploration.

### The Windbreak Shoals

- Thin, leaning paper sails and dark shard formations.
- Stronger ambient wind and faster crane movement.
- A transitional space between the lagoon and the outer horizon.

Landmarks should be placed against the initial camera composition, then checked again after orbiting.

## 2. Build foreground, midground, and background

Every vista should contain three depth bands:

- **Foreground:** partially cropped sails, shards, or lotus petals that pass near the camera.
- **Midground:** the interactive hero cluster and the manta route.
- **Background:** softened paper ridges, sun/moon haze, and low-contrast silhouettes.

The background must never read as a row of hard cardboard cutouts. Distant forms should lose contrast, shift toward the sky color, and dissolve into fog.

## 3. Add environmental storytelling

The world should suggest a cycle without becoming a game:

- Paper motes drift with the wind and catch the key light.
- Cranes migrate between landmarks and return to their roosts.
- Lotus blossoms open near player interaction and slowly settle closed.
- The manta leaves a temporary wake that merges with player-made folds.
- Islands breathe or tilt by a few degrees, as if moved by air pressure.
- Mood changes alter the light, particles, and horizon rather than only the background color.

## 4. Establish a visual hierarchy

Use value and scale deliberately:

- Foreground forms: darkest and most contrasty.
- Interactive midground: warm cream, vermilion, and gold.
- Background forms: lower contrast and cooler/duskier.
- The focal lotus or island should be the clearest silhouette at the default camera.

Avoid filling every region equally. Empty space is part of the composition.

## 5. World identity acceptance criteria

A world-building pass is complete when:

- A first-time viewer can identify at least three memorable landmarks.
- The view feels different when orbiting or panning between landmarks.
- No wide view exposes the ocean as an isolated circular plate.
- Distant forms recede naturally into the atmosphere.
- The scene communicates motion and habitat even when the viewer does not interact.

---

# Track 2: Stronger Interaction

## 1. Make folds structural

Creases should behave like scored cardstock:

- A fold produces a raised ridge on one side and a compressed valley on the other.
- Directional light catches one facet while the opposite facet holds a cool shadow.
- The fold remains legible after release and slowly relaxes.
- Nearby lotuses, cranes, and the manta react to the fold field.
- The player can create a route or basin through repeated folds.

The crease system should never read as a brown line drawn over the ocean.

## 2. Make the fauna responsive

- Cranes startle from nearby folds, camera speed, or a direct click.
- Manta banking, altitude, and wing motion follow its flight path rather than the cursor alone.
- Lotus petals react to nearby fold energy with a small flutter or bob.
- Touches produce localized ripples and brief flock movement.
- Reactions decay naturally instead of resetting instantly.

## 3. Make exploration comfortable

- One-pointer drag folds.
- Shift/right drag orbits.
- Alt drag and WASD pan through the world.
- Wheel/pinch changes distance.
- Two fingers orbit and pinch on touch.
- The Field menu exposes controls without covering the scene.

## 4. UI subordination

The default state after the intro should contain no large editorial blocks. The Field button is the only persistent chrome. Masthead, legend, hint, and plate return only when explicitly requested or when the keyboard focus requires them.

The UI must never compete with the focal silhouette. It should feel like a museum caption that appears when approached, not a website header.

## 5. Interaction acceptance criteria

- A fold is visibly geometric, not just a drawn stroke.
- A viewer can create a local disturbance and see the world answer it.
- Camera navigation changes the composition without breaking the scene.
- Touch and mouse produce equivalent core interactions.
- Controls remain keyboard accessible even when hidden visually.

---

# Track 3: Performance

## Performance contract

- Target: 60 FPS on the user's integrated graphics hardware.
- Geometry target: well below 60,000 vertices.
- Draw target: preferably below 50 submissions; optimize when the budget grows.
- No per-frame allocations in hot interaction paths.
- No shadow maps or expensive post-processing unless measured and justified.
- Keep adaptive DPR and low-power rendering active.

## Optimization order

1. Reduce unnecessary per-frame DOM and CSS compositing.
2. Keep repeated forms instanced or merged.
3. Move only proven CPU hotspots to the GPU; do not rewrite working systems for theory.
4. Reuse typed arrays and scratch objects.
5. Measure after every structural change.

## Performance acceptance criteria

- Wide vista and macro view both hold the frame budget.
- Draw submissions do not grow with the number of landmarks.
- Adaptive DPR settles without visible oscillation.
- No long pause occurs when entering a new mood or resizing.
- The performance probe, if used, is removed before the final production commit.

---

# Proposed Execution Sequence

## Phase 1 — World Map

Define the three landmark regions, their positions, silhouettes, and camera-facing compositions. Update the layout table before adding effects.

## Phase 2 — World Layers

Add or refine the foreground, midground, and background bands. Tune fog, sky, and ridge recession against wide-vista screenshots.

## Phase 3 — Living Interaction

Connect crease energy to lotuses, cranes, manta wake, and particles. Tune reaction strength so the world feels alive but never noisy.

## Phase 4 — Navigation and Presentation

Finalize pan/orbit/zoom, Field menu behavior, keyboard exploration, reduced motion, and mobile framing.

## Phase 5 — Performance Pass

Rebaseline FPS and draw submissions manually. Instance/merge only where the measurement shows a need.

## Phase 6 — Later Audio Phase

Only after the world, interaction, and performance are stable, add the isolated Web Audio layer with paper crinkles, fold snaps, and wind/ocean synthesis.

# Definition of Done

The project is ready for a final presentation when:

- It reads as an inhabitable paper world from the first frame.
- Wide and macro views both feel intentionally composed.
- Folds, fauna, lotus, and manta feel physically connected.
- UI is quiet and optional.
- Performance is verified on the target integrated hardware.
- Runtime checks remain manual and browser automation remains prohibited.
