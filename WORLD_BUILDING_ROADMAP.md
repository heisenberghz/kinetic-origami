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
| `?mood=dawn\|midnight` | Boots directly into a mood without the field menu. |
| `?stats=1` | Shows a fixed panel with fps, average frame time, draw submissions, triangles, device pixel ratio, and live camera values. | |

Any malformed or unknown value is ignored rather than throwing, so a bad URL still boots. Overrides are re-applied on resize and on scene reset, so `R` returns to the framed pose rather than the default one.

Typical acceptance sweep:

```
?mood=dawn&stats=1
?mood=midnight&stats=1
```

Track 4 removes the pose, orbit, phi, and zoom parameters. Poses become travel destinations and every
district position changes, so carrying them forward would point the camera at nothing.

## Current Baseline

- ES module project, no build step. `index.html` holds markup and styles only.
- Modules: `src/main.js` (scene, islands, manta, lotuses, input, UI) and `src/world/` holding `atmosphere.js`, `backdrop.js`, `harness.js`, `horizon.js`, `islands.js`, `landmarks.js`, `layout.js`, `migration.js`, and `ocean.js` (ocean geometry, swell, and the crease field).
- `src/world/layout.js` is the single source of truth for world positions: regions, islands, lotuses, cranes, sails, and plan radii. Track 4 renames `regions` to districts and moves every position.
- Seven test suites run on `node --test` with zero dependencies, 52 tests passing: layout, camera, harness, migration, horizon, ocean, and main structure.
- Procedural washi, vellum, indigo, vermilion, and gold-leaf visual language.
- Faceted low-poly paper ocean with persistent crease interaction and an organically wobbled rim.
- Three district landmarks built today: Folded Cathedral, Lotus Lagoon, Windbreak Shoals. Four more are specified in Track 4.
- Distant backdrop ridge rings beyond the ocean edge, unlit and colour pre-blended toward the sky so they recede without relying on scene fog.
- Manta ray, crane flock, lotus blossoms, paper particles, ribbons, and island forms.
- Damped orbit camera with zoom, pan, pointer/touch input, keyboard exploration, mood switching, pause,
  and reduced-motion handling. Track 4 replaces this with first-person free roam; the orbit camera is
  not yet removed.
- Field menu replaces the persistent website-style control layer; the plate line reads the current region.
- Verified manually at approximately 60 FPS on the user's integrated graphics hardware.
- No audio layer is currently included; audio is a later isolated phase.
- No headless browser or automated runtime testing is permitted for this project.

## Build Status

Rather than a phase board that competes with the tracks below, this is a flat status list.

**Built and verified:**

- Three districts with positions, silhouettes, and satellites, covered by layout tests.
- Foreground, midground, and background depth bands, with an organic ocean rim and distant ridge rings.
- Structural folds: a ridge on one side, a valley on the other, directional light, slow relaxation.
- Fauna response: cranes migrate, return to their roosts, and startle; the manta leaves a wake that
  merges with player folds; lotus petals and paper motes read fold energy.
- Mood switching across both palettes, pause, reduced motion, and the Field menu.
- UI subordination, with the plate line naming the current district.
- Island instancing: 13 groups became 8 instanced meshes, holding draws at 48 against a ceiling of 50.
- Seven test suites, 52 tests, no dependencies.

**Built but unverified by hand:** macro and working views, the midnight mood, touch behaviour, the
horizon layers reading as flat slabs, and the folded-crease response after the ocean module extraction.
The Priority 0 figures below were measured at the default orbit pose only and must be re-measured at eye
level once Track 4 Phase 1 lands, because that pose does not exist yet.

**Small gaps, both cheap:** islands do not breathe or tilt, and lotus blossoms do not open from rest and
settle closed.

**Not started:** audio, by design, deferred until the world is stable.

**Superseded and removed:** the orbit camera, the pose/orbit/phi/zoom harness parameters, and the
original six-phase execution sequence, which duplicated Tracks 1 to 3.

## Priority 0: Acceptance Gate

Measured baseline, dawn, wide vista at the default pose, on the user's integrated AMD APU:

| Metric | Measured | Contract | Result |
| --- | --- | --- | --- |
| Frame rate | 60.0 fps | 60 fps | pass |
| Frame time | 16.67 ms | under budget | pass, vsync locked |
| Draw submissions | 48, down from 66 after instancing the islands | under 50, hard ceiling | pass, one slot of headroom |
| Triangles | 10,404 | well under 60,000 | pass |
| Device pixel ratio | 1.25 | adaptive, low power | pass |

Draw submission breakdown, largest first:

- 8 — islands, as 8 instanced meshes sharing 3 rock, 3 shard and 2 sail geometries
- 8 — manta body, two wings, two accents, two eyes, tail
- 5 — cathedral spire parts
- 4 — far water disc and three horizon layers
- 3 each — sun, ribbons, backdrop ridge rings, lotus instances
- 2 each — lagoon basin and reeds, shoal spillway and sails

The island instancing landed: 13 island groups became 8 instanced meshes with identical geometry, materials and transforms, verified visually and by the panel. The roadmap's "draw submissions must not grow with the number of landmarks" now holds for islands — adding one costs zero submissions.

Still to verify by hand: macro and working views, the midnight mood, touch behaviour, the horizon
slabs at their new closer distance, and the folded-crease response after the ocean module extraction.
The priority gate is measured at the default orbit pose only; it must be re-measured at eye level
once Track 4 Phase 1 lands, because that pose does not exist yet.

---

# Track 1: World Building — Primary

Status: substantially built. The three original districts, the depth bands, the fauna, and the visual
hierarchy all exist in code. Track 4 supersedes the map itself and the camera framing rule.

## 1. Give the archipelago a map

**Built.** Three districts exist at their original close-spaced positions. Track 4 replaces this map
with seven districts across a roughly six times larger area, so positions and framing are reworked there.
These descriptions stay as the character reference for the three that carry forward:

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

Landmarks are now placed for travel rather than against an orbit pose, and framing is checked at eye
level. That rule lives in Track 4.

## 2. Build foreground, midground, and background

**Built, needs review.** Foreground sails, near-field islets, the organic ocean rim, and the ridge rings
all exist. Ridge recession and fog tuning still need a wide-vista check in both moods, and the horizon
layers currently read as flat slabs. The bands themselves are in place:

- **Foreground:** partially cropped sails, shards, or lotus petals that pass near the camera.
- **Midground:** the interactive hero cluster and the manta route.
- **Background:** softened paper ridges, sun/moon haze, and low-contrast silhouettes.

The background must never read as a row of hard cardboard cutouts. Distant forms should lose contrast, shift toward the sky color, and dissolve into fog.

## 3. Add environmental storytelling

Mostly built. The world already suggests a cycle without becoming a game:

- **Built:** paper motes drift with the wind and catch the key light.
- **Built:** cranes migrate between landmarks and return to their roosts.
- **Built:** the manta leaves a temporary wake that merges with player-made folds.
- **Built:** mood changes alter the light, particles, and horizon.
- **Partial:** lotus petals react to fold energy, but they do not open from rest and settle closed.
- **Not built:** islands breathe or tilt by a few degrees, as if moved by air pressure. No code exists
  for this yet. It is a small addition, one update loop over the island transforms.

## 4. Establish a visual hierarchy

**Built.** Value and scale are used deliberately:

- Foreground forms: darkest and most contrasty.
- Interactive midground: warm cream, vermilion, and gold.
- Background forms: lower contrast and cooler/duskier.
- The focal lotus or island should be the clearest silhouette at the default camera.

Avoid filling every region equally. Empty space is part of the composition.

## 5. World identity acceptance criteria

A world-building pass is complete when:

- A first-time viewer can identify at least three memorable landmarks.
- The view feels different when travelling between landmarks, and a crossing takes 20 to 30 seconds.
- No wide view exposes the ocean as an isolated circular plate.
- Distant forms recede naturally into the atmosphere.
- The scene communicates motion and habitat even when the viewer does not interact.

---

# Track 2: Stronger Interaction

Status: folds, fauna, and UI subordination are built and verified. Exploration is the open item, and
Track 4 rewrites the controls entirely.

## 1. Make folds structural

**Built.** Creases behave like scored cardstock:

- A fold produces a raised ridge on one side and a compressed valley on the other.
- Directional light catches one facet while the opposite facet holds a cool shadow.
- The fold remains legible after release and slowly relaxes.
- Nearby lotuses, cranes, and the manta react to the fold field.
- The player can create a route or basin through repeated folds.

The crease system should never read as a brown line drawn over the ocean.

## 2. Make the fauna responsive

**Built.** Cranes startle from nearby folds, camera speed, or a direct click.
- Manta banking, altitude, and wing motion follow its flight path rather than the cursor alone.
- Lotus petals react to nearby fold energy with a small flutter or bob.
- Touches produce localized ripples and brief flock movement.
- Reactions decay naturally instead of resetting instantly.

## 3. Make exploration comfortable

**Not built.** The world is still navigated by orbit, pan, and zoom. Track 4 replaces all of it, so these
are the intended controls rather than the current ones:

- One-pointer drag travels through the world. Holding first folds instead.
- Mouse position steers heading; no pointer lock, so no permission prompt.
- WASD travels as well.
- Click a distant landmark to glide there.
- Two fingers look on touch; two-finger hold folds.
- The Field menu exposes controls without covering the scene.

## 4. UI subordination

**Built.** The default state after the intro contains no large editorial blocks. The Field button is the only persistent chrome. Masthead, legend, hint, and plate return only when explicitly requested or when the keyboard focus requires them.

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
- Draw target: below 50 submissions as a hard ceiling. Track 4 makes this load-bearing, because fog
  visibility distance and section activation radius are what enforce it.
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

- Eye-level roaming and any wide vista both hold the frame budget.
- Draw submissions do not grow with the number of landmarks.
- At most two sections are active at distance.
- Adaptive DPR settles without visible oscillation.
- No long pause occurs when entering a new mood, crossing a district boundary, or resizing.
- The performance probe, if used, is removed before the final production commit.

---

# Track 4: Inhabitable World and Travel

The active work. This track replaces the diorama camera with an inhabitable world, and revises the
Track 1 world map at roughly six times its linear scale.

## Locked decisions

| Decision | Choice |
| --- | --- |
| Camera | Free roam at water level. First-person. The orbit camera is removed. |
| Travel | Free roam by default, plus click-to-travel for distant landmarks. |
| Player | A drifting presence, like the manta. No body, no footsteps. |
| Performance | 60 FPS and under 50 draw submissions are hard ceilings. Culling is mandatory. |
| World | About 150 units across. Ocean radius 75. Fog hides the edge. |
| Folding | Drag travels. Holding for about 300ms folds instead. |
| Crossing time | 20 to 30 seconds of open water at cruise speed. |

Two decisions deferred to implementation, both made during Phase 1 rather than up front:

- **The presence glides around landmarks rather than through them.** The player is a spirit, so
  passing through a district is defensible in fiction, but the camera ends up inside geometry and the
  frame breaks. `pushOutOfLandmarks` is kept and repurposed: it previously kept the orbit camera outside
  landmark footprints, and now keeps the presence outside them. If gliding around ever feels wrong, the
  alternative is to pass through and accept the clipping.
- **Harness poses become travel destinations in Phase 4, not Phase 1.** The pose, orbit, phi, and zoom
  parameters are removed when the camera they describe is removed, so the acceptance sweep temporarily
  loses its framing. Phase 1 compensates with a `?at=x,z&yaw=` parameter that positions the presence
  directly, which is the honest equivalent for a world that no longer orbits.

## District layout

Playable area is roughly plus or minus 58 units. Distances are deliberately uneven so that reaching
a far district is a decision rather than a drift.

| District | Position | From origin | Role |
| --- | --- | --- | --- |
| Folded Cathedral | (-14, -20) | 24 | Tall indigo spire, the visual anchor, visible from most of the map |
| Lotus Lagoon | (-30, 6) | 31 | Calm low basin, the first real crossing |
| Windbreak Shoals | (28, 18) | 33 | Windy, deliberately far from the west cluster |
| Paper Span | (-46, -4) to (22, 28) | artery | Long folded ribbon bridge, threads the Lagoon west to east |
| The Terraces | (2, -40) | 40 | Stepped folded layers, ascending ramps |
| The Archive | (-6, 50) | 50 | Dense stack of folded pages, quiet, off the main path |
| The Kiln | (44, -26) | 51 | Vermilion glowing folds, warm light from below, embers rising |

Three choices worth preserving. Paper Span passes through the Lagoon so the Lagoon sits on the main
route instead of off to one side. The Shoals are far enough from the west cluster that you head
toward them deliberately. The Cathedral is nearest the origin so it is the first landmark registered.

## What the scale change breaks

Going from a 25-unit bowl to a 150-unit map while the camera drops to water level breaks five things
that are currently load-bearing. Each must be solved, not just the camera.

| Break | Why it fails | Fix |
| --- | --- | --- |
| Ocean geometry | 3456 triangles fixed over radius 23.5 means each facet becomes coarse at 6x area | High-detail ocean becomes a local patch that follows the player; cheap low-poly ocean for the distance |
| Crease field | The 65x65 grid spans 48 units, the middle third of the new map | Field recentres on the player, keeping 0.75 per cell detail anywhere |
| Backdrop and horizon | Ridge rings sit at radius 28.5 to 35.5, which would end up inside the map | Rebuild per section, scaled outward |
| Fog | Near 14 and far 46 were tuned for a 25-unit world | Re-tune for the new scale. Note that fog does not currently cull the backdrop or horizon |
| Draw submissions | 48 are already used of a 50 budget, and seven districts would need roughly 104 | At most two sections active at distance |

The draw ceiling is the governing constraint, but the first draft of this track assumed scene fog would
enforce it. Checking the code showed that assumption is wrong. `backdrop.js` and `horizon.js` both set
`fog: false` and fade on their own radius terms instead, with `horizon.js` fading across radius 14 to 34
and the ridge rings sitting at 28.5, 32, and 35.5. Scene fog governs the ocean, islands, landmarks, and
fauna only. The backdrop and horizon therefore need their own distance-based visibility design before the
culling budget can be called solved; retuning scene fog alone will not do it.

## Build order

1. **Movement.** Replace orbit with presence state: world position plus yaw and pitch, damped drift
   velocity reusing the existing damping helper, gentle bob, hover about 1.2 units over the paper.
   Remove `orbit`, `panTarget`, `panCurrent`, `cameraTarget`, and `pushOutOfLandmarks`. Widen field of
   view from the current 40 to 50 degrees to roughly 60 to 75, because a narrow field reads as a
   diorama and feels wrong at eye level.
2. **World expansion.** Ocean to radius 75, player-following detail patch, recentred crease field,
   rebuilt backdrop and horizon.
3. **Sections and culling.** Each district gets an activation radius and a detail level. Follow the
   existing island instancing precedent. Hard cap of two active sections.
4. **Click-to-travel.** Raycast landmarks at distance and glide to their anchor. Harness poses become
   travel destinations rather than orbit presets.
5. **New content.** Paper Span, Terraces, Kiln, and Archive geometry.

## Risks

| Risk | Why it matters |
| --- | --- |
| Camera tests break | `test/camera.test.js` asserts orbit push-out across 1256 states and needs rewriting for presence bounds |
| Crease field recentring | The hardest single piece. It lives in the newly extracted ocean module, so a bug here compounds |
| Fog is load-bearing | It enforces the draw budget, so visibility and activation can no longer be tuned independently |
| Landmarks were sized top-down | Contact shadows, lotus at y 0.1, cranes at y 5 all read wrong edge-on and will need rescaling |
| Presence clipping | A spirit may pass through the Cathedral, but a camera inside geometry looks broken. Needs an explicit decision |

## Input scheme

- Desktop: mouse position steers heading gently, drag travels in the drag direction, holding about
  300ms then dragging folds instead, WASD also travels.
- Touch: one finger travels, two fingers look, two-finger hold folds.
- Click a distant landmark to glide there.

Mouse-steers-heading is the least certain choice here. It suits a drifting presence and avoids a
pointer lock prompt, but it is unusual enough that it should be judged by feel in the first minute
of use. Making drag do two things needs a visible cue or it will feel unpredictable.

## Test plan

Rewrite `test/camera.test.js` for presence bounds and spawn clearance. Extend `test/layout.test.js`
for district separation. Add tests for section activation never exceeding two, crease field
recentring, and fog and activation coherence. Update the required-system list in
`test/main-structure.test.js`, since the lighting rig and orbit camera assertions change.

The crease field recentring should get its own tests early, ahead of the other phases.

---

# Definition of Done

The project is ready for a final presentation when:

- It reads as an inhabitable paper world from the first frame.
- You can travel toward something you can see, and the crossing takes 20 to 30 seconds.
- The world holds 60 FPS and under 50 draw submissions while travelling, not only while stationary.
- Macro views feel intentionally composed.
- Folds, fauna, lotus, and manta feel physically connected.
- UI is quiet and optional.
- Performance is verified on the target integrated hardware.
- Runtime checks remain manual and browser automation remains prohibited.
