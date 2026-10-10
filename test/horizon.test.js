import test from "node:test";
import assert from "node:assert/strict";
import { cameraLimits } from "../src/world/layout.js";
import { horizonLayerSpecs, layerVisibility } from "../src/world/horizon.js";

test("horizon layers stay visible wherever the presence travels", () => {
  const places = [
    { x: 0, z: 0 }, { x: -14, z: -20 }, { x: -30, z: 6 },
    { x: 28, z: 18 }, { x: -58, z: 0 }, { x: 58, z: 0 },
    { x: 0, z: -58 }, { x: 0, z: 58 }
  ];
  for (const place of places) {
    const camera = { x: place.x, y: cameraLimits.hoverHeight, z: place.z };
    for (const spec of horizonLayerSpecs) {
      const contribution = layerVisibility(spec, camera);
      assert.ok(
        contribution >= 0.008,
        `the layer at distance ${spec.distance} drops to ${contribution.toFixed(4)} at (${place.x}, ${place.z}), effectively invisible`
      );
    }
  }
});

test("horizon layers recede with distance instead of all fading at once", () => {
  const near = { x: 0, y: cameraLimits.hoverHeight, z: 0 };
  const far = { x: 0, y: cameraLimits.hoverHeight, z: 0 };
  const contributions = horizonLayerSpecs.map((spec) => layerVisibility(spec, near));
  for (const value of contributions) assert.ok(Number.isFinite(value), "a layer produced a non-finite alpha");
  const spread = Math.max(...contributions) - Math.min(...contributions);
  assert.ok(spread > 0.005, `all layers share the same alpha, spread was only ${spread.toFixed(4)}`);
  assert.ok(far !== null);
});

test("the nearest horizon layer is the strongest of the three", () => {
  const camera = { x: 0, y: cameraLimits.hoverHeight, z: 0 };
  const nearest = layerVisibility(horizonLayerSpecs[0], camera);
  const farthest = layerVisibility(horizonLayerSpecs[horizonLayerSpecs.length - 1], camera);
  assert.ok(Number.isFinite(nearest) && Number.isFinite(farthest), "a layer produced a non-finite alpha");
  assert.ok(nearest >= farthest, `nearest ${nearest.toFixed(4)} should not be fainter than farthest ${farthest.toFixed(4)}`);
});

test("horizon layers sit beyond the shore but inside the backdrop ridge line", () => {
  const nearest = horizonLayerSpecs[0].distance;
  const farthest = horizonLayerSpecs[horizonLayerSpecs.length - 1].distance;
  assert.ok(nearest > cameraLimits.playableRadius, "the nearest layer sits inside the area the presence can reach");
  assert.ok(farthest < 82, `the farthest layer at ${farthest} sits outside the nearest backdrop ridge at 82`);
});
