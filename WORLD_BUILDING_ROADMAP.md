# The Kinetic Origami Archipelago

## World Identity & Next Chapters

This document defines the next evolution of the interactive paper world. The primary direction is **world building**. Interaction and performance support that world; they are not separate products.

## North Star

> A living paper sanctuary where folded mountains, tidal lotus gardens, migrating cranes, and a cursor-led manta ray move through a continuous horizon.

The experience should feel like entering a place, not operating a website. The 3D world is the primary interface. Editorial UI is quiet, optional, and always yields to the scene.

## Current Baseline

- Single-file Three.js experience in `index.html`.
- Procedural washi, vellum, indigo, vermilion, and gold-leaf visual language.
- Faceted low-poly paper ocean with persistent crease interaction.
- Manta ray, crane flock, lotus blossoms, paper particles, ribbons, and island forms.
- Damped orbit, zoom, pointer/touch input, keyboard exploration, mood switching, pause, and reduced-motion handling.
- Field menu replaces the persistent website-style control layer.
- Verified manually at approximately 60 FPS on the user's integrated graphics hardware.
- No audio layer is currently included; audio is a later isolated phase.
- No headless browser or automated runtime testing is permitted for this project.

## Priority 0: Acceptance Gate

Before adding more content, manually verify the current build at three camera distances and in both moods:

1. Macro view: crease ridges, lotus petals, manta silhouette, and paper facets.
2. Working view: the hero archipelago cluster and its negative space.
3. Wide vista: horizon recession, depth layers, and the absence of a floating disk edge.

Record:

- FPS and frame-time average.
- Draw submissions and triangle count if the temporary performance probe is used.
- Touch fold, orbit, pan, and zoom behavior.
- Field menu focus and keyboard operation.
- Any visual moment that still reads as a flat diorama.

A change is not accepted because it looks good in one mood or one camera position.

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
