import test from "node:test";
import assert from "node:assert/strict";
import {
  regions,
  regionAt,
  islandSpecs,
  lotusSpecs,
  craneSpecs,
  foregroundSailSpecs,
  planRadii,
  cameraLimits
} from "../src/world/layout.js";
import { landmarkMetrics } from "../src/world/landmarks.js";

const distance = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const region = (id) => regions.find((entry) => entry.id === id);

test("regions do not overlap, so regionAt is unambiguous", () => {
  for (let i = 0; i < regions.length; i += 1) {
    for (let j = i + 1; j < regions.length; j += 1) {
      const gap = distance(regions[i].x, regions[i].z, regions[j].x, regions[j].z) - regions[i].radius - regions[j].radius;
      assert.ok(gap > 0, `${regions[i].id} and ${regions[j].id} overlap by ${(-gap).toFixed(2)} units`);
    }
  }
});

test("regionAt resolves each region centre and rejects open water", () => {
  for (const entry of regions) {
    assert.equal(regionAt(entry.x, entry.z)?.id, entry.id, `${entry.id} centre did not resolve`);
  }
  assert.equal(regionAt(0, 0), null, "the origin should be open water");
  assert.equal(regionAt(0, 22), null, "beyond the last region should be open water");
});

test("no island intrudes on a landmark footprint", () => {
  for (const [x, z, scale] of islandSpecs) {
    for (const entry of regions) {
      const reach = landmarkMetrics[entry.id].planRadius + planRadii.island * scale;
      const gap = distance(x, z, entry.x, entry.z) - reach;
      assert.ok(gap > 0, `island at (${x}, ${z}) intrudes ${(-gap).toFixed(2)} units into ${entry.id}`);
    }
  }
});

test("no foreground sail intrudes on a landmark footprint", () => {
  for (const [x, , z, , scale] of foregroundSailSpecs) {
    for (const entry of regions) {
      const reach = landmarkMetrics[entry.id].planRadius + planRadii.sail * scale;
      const gap = distance(x, z, entry.x, entry.z) - reach;
      assert.ok(gap > 0, `foreground sail at (${x}, ${z}) intrudes ${(-gap).toFixed(2)} units into ${entry.id}`);
    }
  }
});

test("lagoon lotuses sit inside the basin and clear of the reed ring", () => {
  const lagoon = region("lagoon");
  const { basinInnerRadius, reedRingRadius } = landmarkMetrics.lagoon;
  let inside = 0;
  for (const [x, , z] of lotusSpecs) {
    const gap = distance(x, z, lagoon.x, lagoon.z);
    if (gap > reedRingRadius + planRadii.lotus) continue;
    inside += 1;
    assert.ok(gap > planRadii.lotus, `lotus at (${x}, ${z}) is too close to the basin centre at ${gap.toFixed(2)}`);
    assert.ok(gap < basinInnerRadius, `lotus at (${x}, ${z}) sits outside the basin at ${gap.toFixed(2)}`);
    assert.ok(gap < reedRingRadius - planRadii.lotus, `lotus at (${x}, ${z}) fouls the reeds at ${gap.toFixed(2)}`);
  }
  assert.ok(inside >= 4, `the lagoon needs at least four lotuses to read as a lagoon, found ${inside}`);
});

test("outlier lotuses clear every landmark footprint", () => {
  const lagoon = region("lagoon");
  for (const [x, , z] of lotusSpecs) {
    if (distance(x, z, lagoon.x, lagoon.z) <= landmarkMetrics.lagoon.planRadius + planRadii.lotus) continue;
    for (const entry of regions) {
      const reach = landmarkMetrics[entry.id].planRadius + planRadii.lotus;
      const gap = distance(x, z, entry.x, entry.z) - reach;
      assert.ok(gap > 0, `outlier lotus at (${x}, ${z}) intrudes ${(-gap).toFixed(2)} units into ${entry.id}`);
    }
  }
});

test("islands do not overlap each other", () => {
  for (let i = 0; i < islandSpecs.length; i += 1) {
    for (let j = i + 1; j < islandSpecs.length; j += 1) {
      const need = planRadii.island * (islandSpecs[i][2] + islandSpecs[j][2]);
      const got = distance(islandSpecs[i][0], islandSpecs[i][1], islandSpecs[j][0], islandSpecs[j][1]);
      assert.ok(got > need, `islands ${i} and ${j} overlap: ${got.toFixed(2)} < ${need.toFixed(2)}`);
    }
  }
});

test("islands do not overlap lotuses or foreground sails", () => {
  const others = [
    ...lotusSpecs.map(([x, , z]) => ({ x, z, radius: planRadii.lotus, kind: "lotus" })),
    ...foregroundSailSpecs.map(([x, , z, , scale]) => ({ x, z, radius: planRadii.sail * scale, kind: "sail" }))
  ];
  for (const [ix, iz, scale] of islandSpecs) {
    for (const other of others) {
      const need = planRadii.island * scale + other.radius;
      const got = distance(ix, iz, other.x, other.z);
      assert.ok(got > need, `island at (${ix}, ${iz}) overlaps ${other.kind} at (${other.x}, ${other.z}): ${got.toFixed(2)} < ${need.toFixed(2)}`);
    }
  }
});

test("lotuses do not overlap each other", () => {
  for (let i = 0; i < lotusSpecs.length; i += 1) {
    for (let j = i + 1; j < lotusSpecs.length; j += 1) {
      const need = planRadii.lotus * 2;
      const got = distance(lotusSpecs[i][0], lotusSpecs[i][2], lotusSpecs[j][0], lotusSpecs[j][2]);
      assert.ok(got > need, `lotuses ${i} and ${j} overlap: ${got.toFixed(2)} < ${need}`);
    }
  }
});

test("no content spawns inside the default camera shell", () => {
  const reachOf = (x, z, radius) => distance(x, z, 0, 0) + radius;
  const reaches = [
    ...islandSpecs.map(([x, z, scale]) => ({ kind: "island", reach: reachOf(x, z, planRadii.island * scale) })),
    ...lotusSpecs.map(([x, , z]) => ({ kind: "lotus", reach: reachOf(x, z, planRadii.lotus) })),
    ...foregroundSailSpecs.map(([x, , z, , scale]) => ({ kind: "sail", reach: reachOf(x, z, planRadii.sail * scale) })),
    ...regions.map((entry) => ({ kind: entry.id, reach: reachOf(entry.x, entry.z, landmarkMetrics[entry.id].planRadius) }))
  ];
  const outermost = reaches.reduce((worst, entry) => (entry.reach > worst.reach ? entry : worst));
  assert.ok(
    outermost.reach < cameraLimits.smallestDefaultRadius,
    `${outermost.kind} reaches ${outermost.reach.toFixed(2)}, inside the smallest default camera radius of ${cameraLimits.smallestDefaultRadius}`
  );
});

test("all content stays inside the ocean", () => {
  const reachOf = (x, z, radius) => distance(x, z, 0, 0) + radius;
  for (const [x, z, scale] of islandSpecs) {
    assert.ok(reachOf(x, z, planRadii.island * scale) < cameraLimits.oceanRadius, `island at (${x}, ${z}) escapes the ocean`);
  }
  for (const entry of regions) {
    assert.ok(reachOf(entry.x, entry.z, landmarkMetrics[entry.id].planRadius) < cameraLimits.oceanRadius, `${entry.id} escapes the ocean`);
  }
});

test("every landmark keeps satellites and cranes overhead", () => {
  for (const entry of regions) {
    const satellites = islandSpecs.filter(([x, z]) => {
      const gap = distance(x, z, entry.x, entry.z) - landmarkMetrics[entry.id].planRadius;
      return gap > 0 && gap < entry.radius;
    });
    const overhead = craneSpecs.filter(([x, , z]) => distance(x, z, entry.x, entry.z) < landmarkMetrics[entry.id].planRadius + 1.2);
    assert.ok(satellites.length >= 2, `${entry.id} has only ${satellites.length} satellite islands`);
    assert.ok(overhead.length >= 2, `${entry.id} has only ${overhead.length} cranes overhead`);
  }
});
