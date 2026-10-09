import test from "node:test";
import assert from "node:assert/strict";
import { regions } from "../src/world/layout.js";
import { presenceLimits } from "../src/world/presence.js";
import { readHarnessParams, createStatsPanel } from "../src/world/harness.js";

test("harness ignores unknown or malformed params instead of breaking the boot", () => {
  const empty = readHarnessParams("");
  assert.equal(empty.at, null);
  assert.equal(empty.mood, null);
  assert.equal(empty.yaw, null);
  assert.equal(empty.pitch, null);
  assert.equal(empty.speed, null);
  assert.equal(empty.stats, false);

  const junk = readHarnessParams("?at=nowhere&mood=neon&yaw=abc&pitch=&speed=xyz");
  assert.equal(junk.at, null, "an unparsable position must not be accepted");
  assert.equal(junk.mood, null, "unknown mood must not be accepted");
  assert.equal(junk.yaw, null, "non-numeric yaw must be ignored");
  assert.equal(junk.pitch, null);
  assert.equal(junk.speed, null);

  const wrongPair = readHarnessParams("?at=4");
  assert.equal(wrongPair.at, null, "a position needs both x and z");
  const nonNumericPair = readHarnessParams("?at=4,north");
  assert.equal(nonNumericPair.at, null, "a position must be numeric");
});

test("harness parses an explicit world position", () => {
  const harness = readHarnessParams("?at=-12.5,7");
  assert.ok(harness.at);
  assert.equal(harness.at.x, -12.5);
  assert.equal(harness.at.z, 7);
});

test("harness converts degrees to radians and treats zero as a value", () => {
  const harness = readHarnessParams("?yaw=180&pitch=90&speed=12");
  assert.ok(Math.abs(harness.yaw - Math.PI) < 1e-9, "yaw degrees should become radians");
  assert.ok(Math.abs(harness.pitch - Math.PI / 2) < 1e-9, "pitch degrees should become radians");
  assert.equal(harness.speed, 12);
  const zero = readHarnessParams("?yaw=0&speed=0");
  assert.equal(zero.yaw, 0, "zero must be a value, not treated as absent");
  assert.equal(zero.speed, 0);
});

test("the look direction can be flipped for trackpads with natural scrolling", () => {
  assert.equal(readHarnessParams("").look, null, "no override by default");
  assert.equal(readHarnessParams("?look=flip").look, -1, "flip should invert");
  assert.equal(readHarnessParams("?look=normal").look, 1, "normal should be identity");
  assert.equal(readHarnessParams("?look=nonsense").look, null, "an unknown value should be ignored, not guessed");
});

test("stats flag is only set when present", () => {
  assert.equal(readHarnessParams("?at=0,0").stats, false);
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
  panel.setHeader("dawn");
  panel.setPresence({ x: -8.4, z: 3.1, yaw: 1.2, pitch: -0.14, velocityX: 1.8, velocityZ: -0.4 });
  panel.sample({ render: { calls: 47, triangles: 6120 } }, 1.25);
  panel.update(300);
  assert.match(stubElement.textContent, /dawn/);
  assert.match(stubElement.textContent, /draws {2}47/);
  assert.match(stubElement.textContent, /tris {3}6120/);
  assert.match(stubElement.textContent, /fps/);
  assert.match(stubElement.textContent, /at -8\.4, 3\.1/, "the panel should report where the presence is");
});

test("the stats panel never leaves the document when the presence moves", () => {
  const stubElement = { textContent: "", setAttribute() {}, style: {} };
  const stubDocument = { createElement: () => stubElement, body: { appendChild() {} } };
  const panel = createStatsPanel(stubDocument);
  panel.setHeader("midnight");
  for (let frame = 0; frame < 40; frame += 1) {
    panel.setPresence({
      x: frame * 0.5,
      z: Math.sin(frame) * 6,
      yaw: frame * 0.1,
      pitch: -0.2,
      velocityX: 0.5,
      velocityZ: 0.2
    });
    panel.sample({ render: { calls: 40 + frame, triangles: 9000 } }, 1.25);
    panel.update(300);
  }
  assert.match(stubElement.textContent, /midnight/);
  assert.match(stubElement.textContent, /draws {2}79/);
});

test("a harness position inside the playable area is accepted as given", () => {
  const harness = readHarnessParams("?at=12,12");
  assert.ok(harness.at);
  assert.ok(Math.hypot(harness.at.x, harness.at.z) <= presenceLimits.playableRadius, "the test position should be inside the playable area");
});

test("every region still has a reachable vantage point in the current map", () => {
  for (const region of regions) {
    const offset = Math.hypot(region.radius * 1.6, 0);
    const vantage = Math.hypot(region.x - region.radius * 1.6, region.z);
    assert.ok(
      vantage <= presenceLimits.playableRadius,
      `${region.id} at ${Math.hypot(region.x, region.z).toFixed(1)} has no vantage point inside the ${presenceLimits.playableRadius} playable radius`
    );
    assert.ok(offset > 0);
  }
});