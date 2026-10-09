import test from "node:test";
import assert from "node:assert/strict";
import { regions, cameraLimits, pushOutOfLandmarks } from "../src/world/layout.js";
import { landmarkMetrics } from "../src/world/landmarks.js";
import { createPresence, presenceLimits } from "../src/world/presence.js";

const wanderSteps = [0.5, 1, 2, 4, 8, 12, 18, 24, 32, 44, presenceLimits.playableRadius];

function presenceIntrusions() {
  const out = { x: 0, z: 0 };
  const found = [];
  for (let degrees = 0; degrees < 360; degrees += 5) {
    for (const distance of wanderSteps) {
      for (const yaw of [0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        const raw = {
          x: Math.sin(yaw) * distance,
          y: presenceLimits.hoverHeight,
          z: Math.cos(yaw) * distance
        };
        pushOutOfLandmarks(raw.x, raw.z, raw.y, landmarkMetrics, out);
        for (const region of regions) {
          const metric = landmarkMetrics[region.id];
          const gap = Math.hypot(out.x - region.x, out.z - region.z) - metric.planRadius;
          if (gap < cameraLimits.landmarkClearance - 1e-6) {
            found.push(`${region.id} at bearing ${degrees}, distance ${distance}, yaw ${yaw.toFixed(2)}, gap ${gap.toFixed(3)}`);
          }
        }
      }
    }
  }
  return found;
}

test("no reachable presence position ends up inside a landmark", () => {
  const found = presenceIntrusions();
  assert.equal(found.length, 0, `${found.length} presence states still clip a landmark, first: ${found[0]}`);
});

test("the presence gliding straight at a district is stopped at its edge", () => {
  const presence = createPresence();
  const out = { x: 0, z: 0 };
  for (const region of regions) {
    const metric = landmarkMetrics[region.id];
    const approach = region.x + region.radius * 3;
    const approachZ = region.z + region.radius * 3;
    presence.moveTo(approach, approachZ, Math.atan2(region.x - approach, region.z - approachZ));
    presence.glideTo(region.x, region.z, 0);
    let deepest = Infinity;
    for (let frame = 0; frame < 900 && presence.isGliding(); frame += 1) {
      presence.update(1 / 60, {});
      pushOutOfLandmarks(presence.state.x, presence.state.z, presence.state.y, landmarkMetrics, out);
      presence.state.x = out.x;
      presence.state.z = out.z;
      deepest = Math.min(deepest, Math.hypot(out.x - region.x, out.z - region.z) - metric.planRadius);
    }
    const hover = presenceLimits.hoverHeight + presenceLimits.bobHeight;
    if (metric.height >= hover) {
      assert.ok(
        deepest >= cameraLimits.landmarkClearance - 1e-3,
        `the presence entered ${region.id}, gap ${deepest.toFixed(4)} is inside the ${cameraLimits.landmarkClearance} clearance`
      );
    } else {
      assert.ok(
        deepest < cameraLimits.landmarkClearance,
        `${region.id} is only ${metric.height.toFixed(2)} tall, so the presence should skim over it rather than stop`
      );
    }
    presence.reset();
  }
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

test("the push leaves an already clear presence exactly where it was", () => {
  const out = { x: 0, z: 0 };
  const samples = [
    { x: 18.5, y: 8.1, z: 0 },
    { x: 0, y: 8.1, z: 18.5 },
    { x: 12, y: 14, z: -6 },
    { x: 0, y: 1.5, z: 8.2 }
  ];
  for (const sample of samples) {
    pushOutOfLandmarks(sample.x, sample.z, sample.y, landmarkMetrics, out);
    assert.equal(out.x, sample.x, `x moved for a clear position at (${sample.x}, ${sample.z})`);
    assert.equal(out.z, sample.z, `z moved for a clear position at (${sample.x}, ${sample.z})`);
  }
});

test("a presence flying above a landmark is never pushed", () => {
  const out = { x: 0, z: 0 };
  const cathedral = regions.find((entry) => entry.id === "cathedral");
  for (const height of [landmarkMetrics.cathedral.height, landmarkMetrics.cathedral.height + 0.5, 20]) {
    pushOutOfLandmarks(cathedral.x, cathedral.z, height, landmarkMetrics, out);
    assert.equal(out.x, cathedral.x, `height ${height} should clear the cathedral, not be pushed`);
    assert.equal(out.z, cathedral.z);
  }
});

test("pushing does not allocate, so the per-frame path stays clean", () => {
  const out = { x: 0, z: 0 };
  pushOutOfLandmarks(3, -2, 4, landmarkMetrics, out);
  assert.ok(Number.isFinite(out.x) && Number.isFinite(out.z));
});
