import test from "node:test";
import assert from "node:assert/strict";
import { regions, cameraLimits, pushOutOfLandmarks } from "../src/world/layout.js";
import { landmarkMetrics } from "../src/world/landmarks.js";

const radiusSteps = [cameraLimits.minZoomRadius, 10, 12, 15, 18.5, 22, cameraLimits.maxZoomRadius];
const phiSteps = Array.from({ length: 12 }, (_, index) => cameraLimits.minPhi + (index / 11) * (cameraLimits.maxPhi - cameraLimits.minPhi));

function orbitPosition(theta, phi, radius) {
  const sinPhi = Math.sin(phi);
  return {
    x: Math.sin(theta) * sinPhi * radius,
    y: Math.cos(phi) * radius + cameraLimits.targetY,
    z: Math.cos(theta) * sinPhi * radius
  };
}

function intrusions() {
  const out = { x: 0, z: 0 };
  const found = [];
  for (let degrees = 0; degrees < 360; degrees += 1) {
    const theta = (degrees / 360) * Math.PI * 2;
    for (const phi of phiSteps) {
      for (const radius of radiusSteps) {
        const raw = orbitPosition(theta, phi, radius);
        pushOutOfLandmarks(raw.x, raw.z, raw.y, landmarkMetrics, out);
        for (const region of regions) {
          const metric = landmarkMetrics[region.id];
          if (raw.y >= metric.height) continue;
          const gap = Math.hypot(out.x - region.x, out.z - region.z) - metric.planRadius;
          if (gap < cameraLimits.landmarkClearance - 1e-6) {
            found.push(`${region.id} at theta ${degrees}, phi ${phi.toFixed(2)}, radius ${radius}, gap ${gap.toFixed(3)}`);
          }
        }
      }
    }
  }
  return found;
}

test("no reachable camera state ends up inside a landmark", () => {
  const found = intrusions();
  assert.equal(found.length, 0, `${found.length} camera states still clip a landmark, first: ${found[0]}`);
});

test("the push leaves an already clear camera exactly where it was", () => {
  const out = { x: 0, z: 0 };
  const samples = [
    { x: 18.5, y: 8.1, z: 0 },
    { x: 0, y: 8.1, z: 18.5 },
    { x: 12, y: 14, z: -6 },
    { x: 0, y: 1.5, z: 8.2 }
  ];
  for (const sample of samples) {
    pushOutOfLandmarks(sample.x, sample.z, sample.y, landmarkMetrics, out);
    assert.equal(out.x, sample.x, `x moved for a clear camera at (${sample.x}, ${sample.z})`);
    assert.equal(out.z, sample.z, `z moved for a clear camera at (${sample.x}, ${sample.z})`);
  }
});

test("a camera flying above a landmark is never pushed", () => {
  const out = { x: 0, z: 0 };
  const cathedral = regions.find((entry) => entry.id === "cathedral");
  for (const height of [landmarkMetrics.cathedral.height, landmarkMetrics.cathedral.height + 0.5, 20]) {
    pushOutOfLandmarks(cathedral.x, cathedral.z, height, landmarkMetrics, out);
    assert.equal(out.x, cathedral.x, `camera at y ${height} should fly over the cathedral, not be pushed`);
    assert.equal(out.z, cathedral.z);
  }
});

test("pushing does not allocate, so the per-frame path stays clean", () => {
  const out = { x: 0, z: 0 };
  pushOutOfLandmarks(3, -2, 4, landmarkMetrics, out);
  assert.ok(Number.isFinite(out.x) && Number.isFinite(out.z));
});
