# The Kinetic Origami Archipelago

A paper world you can walk into.

The ocean is a single folded sheet. It creases under your hands and keeps the crease
long after you have moved on. Crane flocks lift and settle when you come near. Six
districts rise out of the water, each with a coloured beam of light so you can find
it from anywhere.

You are not a character. You are a drift — a presence hovering just above the paper,
gliding, folding, looking around. There is no body, no avatar, no menu telling you
what to do.

## Run it

```
npm run dev
```

Open **http://127.0.0.1:5500/index.html** in your browser.

One note: if VS Code's Live Preview is running on port 5500, close it first. It
serves old files and the page will break in ways that look like your fault.

## Move

| | |
| --- | --- |
| `W` `A` `S` `D` | Travel |
| `Shift` | Move faster |
| Drag | Travel where you drag |
| Click a district | Glide there |
| `1` – `6` | Jump to any district |
| Hold, then drag | Fold the paper |
| Arrow keys or `Q` `E` | Look around |
| `C` / `Z` | Rise and sink |
| `Space` | Pause the world |
| `M` | Dawn or midnight |
| `R` | Start over |

Drag and hold for a moment before dragging, and the paper folds instead of moving.
It takes a beat to learn. The first time always surprises.

## The six districts

Each has a beacon of light above it, so you can spot it across open water.

| | | |
| --- | --- | --- |
| **Folded Cathedral** | west | A tall indigo spire. The anchor. You see it from most of the map. |
| **Lotus Lagoon** | west | A calm basin of reeds and opening flowers. The gentlest place. |
| **Windbreak Shoals** | east | Lean paper sails in the wind. Deliberately far from everything else. |
| **The Terraces** | south | Folded layers climbing in a slow spiral. |
| **The Archive** | north | A tall stack of folded pages. Quiet, off the main path. |
| **The Kiln** | far east | Vermilion folds with embers rising out of them. |

Between them runs **Paper Span**, a long ribbon of folded paper bridging the open
water. You cross it often. It is never hidden.

## Feeling your way around

Distances are uneven on purpose. The Cathedral is closest, so you meet it first. The
Kiln is far enough that heading there is a decision rather than a drift.

Only the two nearest districts are drawn in full. The rest stay visible — nothing you
can actually see ever blinks out — but they simplify as you get further away.

Crossing the map takes twenty to thirty seconds at a steady drift.

## Useful URL tricks

For repeatable screenshots and testing:

| | |
| --- | --- |
| `?stats=1` | Shows frame rate, draw calls, triangle count |
| `?go=kiln` | Opens facing a district |
| `?at=20,-30` | Places you at a spot |
| `?mood=midnight` | Opens at night |
| `?look=flip` | Fixes inverted look on a natural-scroll trackpad |

## What's not finished

Sails and small islands have no collision, so you can drift inside them.

The performance numbers in the roadmap were measured before the camera dropped to
water level, and nobody has re-measured them yet.

Audio was deliberately left out until the world stopped moving around.

## Under the hood

Plain ES modules and three.js from a CDN. No framework, no build step, no
dependencies. Nine test suites, 107 tests, run with:

```
npm test
```

The full design — the layout, the reasoning, what each decision was solving for —
lives in [WORLD_BUILDING_ROADMAP.md](WORLD_BUILDING_ROADMAP.md).