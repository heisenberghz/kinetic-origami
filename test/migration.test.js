import test from "node:test";
import assert from "node:assert/strict";
import { regions } from "../src/world/layout.js";
import { createMigration } from "../src/world/migration.js";

function fakeCranes(count, seed = 1) {
  return Array.from({ length: count }, (_, index) => ({
    baseX: regions[index % regions.length].x + 2,
    baseY: 5,
    baseZ: regions[index % regions.length].z + 2,
    x: 0,
    y: 0,
    z: 0
  }));
}

function run(cranes, seconds, step = 1 / 60) {
  for (let elapsed = 0; elapsed < seconds; elapsed += step) migration.update(step);
  return cranes;
}

let migration;

test("a migrating crane visits a foreign landmark and comes home", () => {
  const cranes = fakeCranes(1);
  const migration = createMigration({ cranes });
  const roost = { x: cranes[0].baseX, y: cranes[0].baseY, z: cranes[0].baseZ };

  const destinations = new Set();
  let returnedHome = false;

  for (let step = 0; step < 60 * 300; step += 1) {
    migration.update(1 / 60);
    const crane = cranes[0];
    for (const region of regions) {
      const gap = Math.hypot(crane.baseX - region.x, crane.baseZ - region.z);
      if (gap < 1.2 && crane.baseY > 0) destinations.add(region.id);
    }
    if (Math.hypot(crane.baseX - roost.x, crane.baseZ - roost.z) < 0.4 && Math.abs(crane.baseY - roost.y) < 0.6) {
      returnedHome = true;
    }
  }

  assert.ok(destinations.size >= 1, `expected at least one landmark visit, got ${destinations.size}`);
  assert.ok(returnedHome, "the crane never returned to its roost");
});

test("migration never leaves a crane below its roost altitude", () => {
  const cranes = fakeCranes(6);
  migration = createMigration({ cranes });
  for (let step = 0; step < 60 * 120; step += 1) {
    migration.update(1 / 60);
    for (const crane of cranes) {
      assert.ok(crane.baseY >= crane.baseY - 1e-6, "altitude went negative");
      assert.ok(crane.baseY > 4, `crane dipped to ${crane.baseY.toFixed(2)}, it should fly above its roost`);
    }
  }
});

test("reduced motion slows migration instead of stopping the world", () => {
  const fast = fakeCranes(3);
  const slow = fakeCranes(3);
  const fastMigration = createMigration({ cranes: fast });
  const slowMigration = createMigration({ cranes: slow, reducedMotion: true });

  let fastPath = 0;
  let slowPath = 0;
  let fastPrevious = fast.map((crane) => ({ x: crane.baseX, z: crane.baseZ }));
  let slowPrevious = slow.map((crane) => ({ x: crane.baseX, z: crane.baseZ }));

  for (let step = 0; step < 60 * 60; step += 1) {
    fastMigration.update(1 / 60);
    slowMigration.update(1 / 60);
    fast.forEach((crane, index) => {
      fastPath += Math.hypot(crane.baseX - fastPrevious[index].x, crane.baseZ - fastPrevious[index].z);
      fastPrevious[index] = { x: crane.baseX, z: crane.baseZ };
    });
    slow.forEach((crane, index) => {
      slowPath += Math.hypot(crane.baseX - slowPrevious[index].x, crane.baseZ - slowPrevious[index].z);
      slowPrevious[index] = { x: crane.baseX, z: crane.baseZ };
    });
  }

  assert.ok(slowPath < fastPath, `reduced motion covered ${slowPath.toFixed(2)} but full speed covered ${fastPath.toFixed(2)}`);
  assert.ok(slowPath > 0, "reduced motion should still move, not freeze the world");
});

test("reset returns every crane to its roost and clears velocity", () => {
  const cranes = fakeCranes(4);
  migration = createMigration({ cranes });
  const roosts = migration.roosts.map((roost) => ({ x: roost.x, y: roost.y, z: roost.z }));

  for (let step = 0; step < 60 * 90; step += 1) migration.update(1 / 60);

  migration.reset();
  for (const [index, crane] of cranes.entries()) {
    assert.ok(Math.hypot(crane.baseX - roosts[index].x, crane.baseZ - roosts[index].z) < 1e-6, `crane ${index} did not return to its roost`);
    assert.ok(Math.hypot(crane.x - roosts[index].x, crane.z - roosts[index].z) < 1e-6, `crane ${index} position did not reset`);
    assert.equal(crane.vx, 0);
    assert.equal(crane.vy, 0);
    assert.equal(crane.vz, 0);
  }
});

test("every crane targets a landmark other than the one it is homed to", () => {
  const cranes = fakeCranes(9);
  migration = createMigration({ cranes });
  for (const [index, route] of migration.routes.entries()) {
    const homeId = migration.roosts[index].homeId;
    if (route.outbound) {
      assert.notEqual(route.target.id, homeId, `crane ${index} picked its home region as an outbound target`);
    }
    assert.ok(regions.some((region) => region.id === route.target.id));
  }
});
