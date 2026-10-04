import test from "node:test";
import assert from "node:assert/strict";
import { cameraLimits } from "../src/world/layout.js";
import { horizonLayerSpecs, layerVisibility } from "../src/world/horizon.js";

const theta = 0.64;
const phi = 1.15;

function cameraAt(radius) {
  return {
    x: Math.sin(theta) * Math.sin(phi) * radius,
    y: Math.cos(phi) * radius + cameraLimits.targetY,
    z: Math.cos(theta) * Math.sin(phi) * radius
  };
}

test("every horizon layer stays visible across the whole zoom range", () => {
  for (const radius of [cameraLimits.minZoomRadius, 12, 18.5, cameraLimits.maxZoomRadius]) {
    const camera = cameraAt(radius);
    for (const spec of horizonLayerSpecs) {
      const contribution = layerVisibility(spec, camera);
      assert.ok(
        contribution >= 0.008,
        `layer at z=${spec.z} drops to ${contribution.toFixed(4)} alpha at radius ${radius}, effectively invisible`
      );
    }
  }
});

test("horizon layers recede with distance instead of all fading at once", () => {
  const camera = cameraAt(18.5);
  const contributions = horizonLayerSpecs.map((spec) => layerVisibility(spec, camera));
  for (let index = 1; index < contributions.length; index += 1) {
    assert.ok(
      contributions[index] < contributions[index - 1],
      `layer ${index + 1} should be fainter than layer ${index}, got ${contributions[index].toFixed(4)} vs ${contributions[index - 1].toFixed(4)}`
    );
  }
});

test("the farthest horizon layer is still fainter than the nearest at max zoom", () => {
  const camera = cameraAt(cameraLimits.maxZoomRadius);
  const nearest = layerVisibility(horizonLayerSpecs[0], camera);
  const farthest = layerVisibility(horizonLayerSpecs[horizonLayerSpecs.length - 1], camera);
  assert.ok(farthest < nearest, `farthest ${farthest.toFixed(4)} should stay under nearest ${nearest.toFixed(4)}`);
});