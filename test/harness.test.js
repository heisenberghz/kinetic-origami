import test from "node:test";
import assert from "node:assert/strict";
import { regions, cameraLimits } from "../src/world/layout.js";
import { readHarnessParams, posePresets, createStatsPanel } from "../src/world/harness.js";

test("harness ignores unknown or malformed params instead of breaking the boot", () => {
  const empty = readHarnessParams("");
  assert.equal(empty.pose, null);
  assert.equal(empty.mood, null);
  assert.equal(empty.theta, null);
  assert.equal(empty.phi, null);
  assert.equal(empty.radius, null);
  assert.equal(empty.stats, false);

  const junk = readHarnessParams("?pose=nowhere&mood=neon&orbit=abc&zoom=&phi=xyz");
  assert.equal(junk.pose, null, "unknown pose must not be accepted");
  assert.equal(junk.mood, null, "unknown mood must not be accepted");
  assert.equal(junk.theta, null, "non-numeric orbit must be ignored");
  assert.equal(junk.radius, null);
  assert.equal(junk.phi, null);
});

test("harness converts degrees to radians and treats zero as a value", () => {
  const harness = readHarnessParams("?orbit=180&phi=90&zoom=12");
  assert.ok(Math.abs(harness.theta - Math.PI) < 1e-9, "orbit degrees should become radians");
  assert.ok(Math.abs(harness.phi - Math.PI / 2) < 1e-9, "phi degrees should become radians");
  assert.equal(harness.radius, 12);
  const zero = readHarnessParams("?orbit=0&zoom=0");
  assert.equal(zero.theta, 0, "zero must be a value, not treated as absent");
  assert.equal(zero.radius, 0);
});

test("stats flag is only set when present", () => {
  assert.equal(readHarnessParams("?pose=lagoon").stats, false);
  assert.equal(readHarnessParams("?stats").stats, true);
  assert.equal(readHarnessParams("?stats=0").stats, true);
  assert.equal(readHarnessParams("?stats=1").stats, true);
});

test("the stats panel accepts a plain string header and renders without a DOM crash", () => {
  const stubElement = {
    textContent: "",
    setAttribute() {},
    style: {}
  };
  const appended = [];
  const stubDocument = {
    createElement: () => stubElement,
    body: { appendChild: (node) => appended.push(node) }
  };
  const panel = createStatsPanel(stubDocument);
  assert.equal(appended.length, 1, "the panel should be appended to the document body");
  panel.setHeader("pose:open  dawn");
  panel.setCamera(1.15, 18.5, 0.64);
  panel.sample({ render: { calls: 47, triangles: 6120 } }, 1.25);
  panel.update(300);
  assert.match(stubElement.textContent, /pose:open {2}dawn/);
  assert.match(stubElement.textContent, /draws {2}47/);
  assert.match(stubElement.textContent, /tris {3}6120/);
  assert.match(stubElement.textContent, /fps/);
});

test("every harness pose matches its landmark centre and stays inside the camera shell", () => {
  for (const [name, preset] of Object.entries(posePresets)) {
    if (name === "open") {
      assert.equal(preset.x, 0, "the open pose should look at the origin");
      assert.equal(preset.z, 0);
      continue;
    }
    const region = regions.find((entry) => entry.id === name);
    assert.ok(region, `pose "${name}" has no matching region`);
    assert.equal(preset.x, region.x, `pose "${name}" drifted from its region centre`);
    assert.equal(preset.z, region.z, `pose "${name}" drifted from its region centre`);
    assert.ok(preset.radius < cameraLimits.smallestDefaultRadius, `pose "${name}" sits outside the default camera radius`);
  }
});
