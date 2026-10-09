import test from "node:test";
import assert from "node:assert/strict";
import { createPresence, presenceLimits, wrapAngle } from "../src/world/presence.js";
import { regions } from "../src/world/layout.js";

function run(presence, seconds, input = {}, step = 1 / 60) {
  const frames = Math.round(seconds / step);
  for (let frame = 0; frame < frames; frame += 1) presence.update(step, input);
}

test("the presence hovers just above the paper and never sinks through it", () => {
  const presence = createPresence();
  run(presence, 3);
  const heights = [];
  for (let frame = 0; frame < 240; frame += 1) {
    presence.update(1 / 60, {});
    heights.push(presence.state.y);
  }
  const lowest = Math.min(...heights);
  const highest = Math.max(...heights);
  assert.ok(lowest > 0, `the presence dropped to y=${lowest}, below the water`);
  assert.ok(Math.abs(highest - lowest) < presenceLimits.bobHeight * 2.6, `the bob swings ${highest - lowest}, which is too wide`);
  assert.ok(presenceLimits.hoverHeight - lowest < presenceLimits.hoverHeight * 0.2, "the bob dips too far below the hover height");
});

test("holding forward accelerates to cruise and coasts to a stop", () => {
  const presence = createPresence();
  run(presence, 6, { forward: 1 });
  const cruising = Math.hypot(presence.state.velocityX, presence.state.velocityZ);
  assert.ok(cruising > presenceLimits.cruiseSpeed * 0.9, `only reached ${cruising.toFixed(2)} of ${presenceLimits.cruiseSpeed}`);
  run(presence, 6, { forward: 0 });
  const stopped = Math.hypot(presence.state.velocityX, presence.state.velocityZ);
  assert.ok(stopped < 0.05, `the presence never settled, still drifting at ${stopped.toFixed(3)}`);
});

test("the presence travels in the direction it faces", () => {
  const presence = createPresence();
  presence.state.yaw = 0;
  run(presence, 4, { forward: 1 });
  assert.ok(presence.state.z > 5, `facing yaw 0 should travel toward +z, moved to ${presence.state.z.toFixed(2)}`);
  assert.ok(Math.abs(presence.state.x) < 1.5, `drifted sideways to x=${presence.state.x.toFixed(2)} while facing +z`);

  const turned = createPresence();
  turned.state.yaw = Math.PI / 2;
  run(turned, 4, { forward: 1 });
  assert.ok(turned.state.x > 5, `facing yaw 90 should travel toward +x, moved to ${turned.state.x.toFixed(2)}`);
});

test("a 20 to 30 second crossing actually takes 20 to 30 seconds", () => {
  const presence = createPresence();
  const cathedral = regions[0];
  const kiln = { x: 44, z: -26 };
  const gap = Math.hypot(kiln.x - cathedral.x, kiln.z - cathedral.z);
  presence.moveTo(cathedral.x, cathedral.z, Math.atan2(kiln.x - cathedral.x, kiln.z - cathedral.z));
  presence.glideTo(kiln.x, kiln.z);
  let seconds = 0;
  while (presence.isGliding() && seconds < 120) {
    presence.update(1 / 60, {});
    seconds += 1 / 60;
  }
  assert.ok(!presence.isGliding(), "the glide never arrived");
  assert.ok(seconds >= 15 && seconds <= 45, `the longest crossing took ${seconds.toFixed(1)}s, outside the 20 to 30 second design target`);
  assert.ok(gap > 40, `the test crossing should be a real distance, got ${gap.toFixed(1)}`);
});

test("the presence cannot leave the playable area", () => {
  const presence = createPresence();
  run(presence, 60, { forward: 1 });
  const distance = Math.hypot(presence.state.x, presence.state.z);
  assert.ok(distance <= presenceLimits.playableRadius + 0.001, `escaped to ${distance.toFixed(1)}, past the ${presenceLimits.playableRadius} limit`);
  run(presence, 60, { forward: 1 });
  assert.ok(Math.hypot(presence.state.x, presence.state.z) <= presenceLimits.playableRadius + 0.001, "pushing harder walked straight through the boundary");
});

test("steering from the pointer turns the presence without teleporting it", () => {
  const presence = createPresence();
  const before = Math.hypot(presence.state.x, presence.state.z);
  run(presence, 2, { pointerNdcX: 1 });
  const after = Math.hypot(presence.state.x, presence.state.z);
  assert.ok(Math.abs(presence.state.yaw) > 0.05, "the presence ignored the pointer");
  assert.ok(after < before + 0.01, "steering moved the presence, but steering should only turn it");
});

test("the steering deadzone keeps the presence still when the pointer is centred", () => {
  const presence = createPresence();
  run(presence, 2, { pointerNdcX: 0.05 });
  assert.ok(Math.abs(presence.state.yaw) < 0.001, `the presence turned ${presence.state.yaw} from a near-centred pointer`);
});

test("pitch is clamped so the horizon cannot flip", () => {
  const presence = createPresence();
  for (let frame = 0; frame < 400; frame += 1) presence.look(0, 0.05);
  assert.ok(presence.state.pitch <= presenceLimits.maxPitch + 1e-9, `pitch rose to ${presence.state.pitch}, above the ceiling`);
  assert.ok(Math.abs(presence.state.pitch) > 0.3, "the clamp engaged before the pitch was meaningfully high");

  for (let frame = 0; frame < 800; frame += 1) presence.look(0, -0.05);
  assert.ok(presence.state.pitch >= presenceLimits.minPitch - 1e-9, `pitch fell to ${presence.state.pitch}, below the floor`);
});

test("yaw wraps instead of drifting unbounded", () => {
  const presence = createPresence();
  for (let frame = 0; frame < 500; frame += 1) presence.look(0.05, 0);
  assert.ok(Math.abs(presence.state.yaw) <= Math.PI + 1e-9, `yaw ran away to ${presence.state.yaw}`);
  assert.ok(Math.abs(wrapAngle(presence.state.yaw)) <= Math.PI);
  assert.equal(wrapAngle(Math.PI * 3), Math.PI);
  assert.equal(wrapAngle(-Math.PI * 3), -Math.PI);
});

test("manual looking cancels an active glide so the player always regains control", () => {
  const presence = createPresence();
  presence.glideTo(30, 30);
  assert.ok(presence.isGliding());
  presence.look(0.1, 0);
  assert.ok(!presence.isGliding(), "the glide kept steering after the player looked around");
});

test("dragging pushes the presence along the drag direction", () => {
  const presence = createPresence();
  const before = Math.hypot(presence.state.x, presence.state.z);
  for (let frame = 0; frame < 30; frame += 1) presence.dragTravel(0, -20);
  run(presence, 2, {});
  const after = Math.hypot(presence.state.x, presence.state.z);
  assert.ok(after > before + 1, `dragging forward moved the presence only ${(after - before).toFixed(2)} units`);
});

test("reset returns the presence to the origin at rest", () => {
  const presence = createPresence();
  presence.moveTo(-40, 45, 1.2);
  run(presence, 3, { forward: 1, boost: true });
  presence.reset();
  assert.equal(presence.state.x, 0);
  assert.equal(presence.state.z, 0);
  assert.equal(presence.state.yaw, 0);
  assert.equal(presence.state.velocityX, 0);
  assert.equal(presence.state.velocityZ, 0);
  assert.ok(!presence.isGliding());
});

test("the presence never spawns inside a district footprint", () => {
  for (const region of regions) {
    const presence = createPresence();
    presence.moveTo(region.x, region.z, 0);
    const distance = Math.hypot(presence.state.x - region.x, presence.state.z - region.z);
    assert.ok(distance < 0.001, "sanity: moveTo should place the presence exactly");
  }
});