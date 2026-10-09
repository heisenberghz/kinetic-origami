import test from "node:test";
import assert from "node:assert/strict";
import { createOcean } from "../src/world/ocean.js";

class FakeAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.count = array.length / itemSize;
    this.usage = 0;
    this.needsUpdate = false;
  }
  setUsage(usage) {
    this.usage = usage;
    return this;
  }
}

class FakeGeometry {
  constructor() {
    this.attributes = {};
  }
  setAttribute(name, attribute) {
    this.attributes[name] = attribute;
    return this;
  }
  setIndex(index) {
    this.index = new FakeAttribute(new Uint32Array(index), 1);
    return this;
  }
  toNonIndexed() {
    const source = this.attributes.position.array;
    const expanded = new Float32Array(source.length * 3);
    for (let triangle = 0; triangle < this.index.array.length; triangle += 1) {
      const corners = [this.index.array[triangle], this.index.array[triangle + 1], this.index.array[triangle + 2]];
      for (let corner = 0; corner < 3; corner += 1) {
        const from = corners[corner] * 3;
        const to = (triangle * 3 + corner) * 3;
        expanded[to] = source[from];
        expanded[to + 1] = source[from + 1];
        expanded[to + 2] = source[from + 2];
      }
    }
    const geometry = new FakeGeometry();
    geometry.setAttribute("position", new FakeAttribute(expanded, 3));
    return geometry;
  }
  computeVertexNormals() {
    return this;
  }
  dispose() {
    this.disposed = true;
    return this;
  }
  computeBoundingSphere() {
    this.boundingSphere = true;
    return this;
  }
}

class FakeColor {
  setRGB(red, green, blue) {
    this.r = red;
    this.g = green;
    this.b = blue;
    return this;
  }
}

const fakeThree = {
  BufferGeometry: FakeGeometry,
  Float32BufferAttribute: FakeAttribute,
  BufferAttribute: FakeAttribute,
  DynamicDrawUsage: 35048,
  Color: FakeColor,
  Mesh: class {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.name = "";
    }
  }
};

function fakeScene() {
  const added = [];
  return { added, add(object) { added.push(object); } };
}

function createTestOcean(qualityTier = "full", material = { customProgramCacheKey: null }) {
  const scene = fakeScene();
  const ocean = createOcean({ THREE: fakeThree, scene, qualityTier, material });
  return { scene, ocean, material };
}

function foldPoint(x, z) {
  return { x, z, impulse: 0.6, width: 0.4, sign: 1, speed: 0, decay: 1 };
}

function settle(ocean, steps = 24, delta = 1 / 60) {
  for (let step = 0; step < steps; step += 1) ocean.relax(delta);
}

function fold(ocean, start, end, frames = 20, decayPower = 0.72) {
  for (let frame = 0; frame < frames; frame += 1) {
    ocean.clearTarget();
    ocean.stampSegment(start, end, Math.pow(1 - frame / frames, decayPower));
    ocean.relax(1 / 60);
  }
}

test("the field target is cleared before stamping, never after", () => {
  const { ocean } = createTestOcean();
  ocean.stampSegment(foldPoint(-3, 0), foldPoint(3, 0), 1);
  ocean.clearTarget();
  ocean.relax(1 / 60);
  assert.equal(ocean.sample(0, 0.2), 0, "a stale target survived the clear and kept pushing the water");
});

function allFinite(array) {
  return Array.from(array).every((value) => Number.isFinite(value));
}

test("the ocean joins the scene as a named paper mesh", () => {
  const { scene, ocean, material } = createTestOcean();
  assert.equal(scene.added.length, 1);
  assert.equal(scene.added[0], ocean.mesh);
  assert.equal(ocean.mesh.name, "faceted paper ocean");
  assert.match(material.customProgramCacheKey(), /^paper-creases-/);
});

test("the light quality tier builds fewer vertices than the full tier", () => {
  const light = createTestOcean("light").ocean;
  const full = createTestOcean("full").ocean;
  const lightCount = light.geometry.attributes.position.count;
  const fullCount = full.geometry.attributes.position.count;
  assert.ok(lightCount < fullCount, `expected light ${lightCount} below full ${fullCount}`);
  assert.equal(lightCount % 3, 0);
  assert.equal(fullCount % 3, 0);
});

test("every triangle carries a usable barycentric crease attribute", () => {
  const { ocean } = createTestOcean();
  const count = ocean.geometry.attributes.position.count;
  const barycentric = ocean.geometry.attributes.barycentric.array;
  assert.equal(barycentric.length, count * 3);
  for (let vertex = 0; vertex < count; vertex += 3) {
    for (let corner = 0; corner < 3; corner += 1) {
      const slice = [barycentric[(vertex + corner) * 3], barycentric[(vertex + corner) * 3 + 1], barycentric[(vertex + corner) * 3 + 2]];
      assert.equal(slice.filter((value) => value === 1).length, 1);
      assert.equal(slice.reduce((sum, value) => sum + value, 0), 1);
    }
  }
});

test("base vertex colors stay finite, non black, and within the shading headroom", () => {
  const { ocean } = createTestOcean();
  const colors = ocean.geometry.attributes.color.array;
  assert.ok(allFinite(colors));
  for (const channel of colors) {
    assert.ok(channel > 0, `color channel ${channel} falls to black`);
    assert.ok(channel <= 1.1, `color channel ${channel} leaves the shading headroom`);
  }
});

test("sampling an untouched field reads zero everywhere", () => {
  const { ocean } = createTestOcean();
  for (const point of [[0, 0], [4.5, -2.25], [-12, 12], [23.9, -23.9]]) {
    assert.equal(ocean.sample(point[0], point[1]), 0);
  }
});

test("sampling outside the field bounds never reads memory", () => {
  const { ocean } = createTestOcean();
  assert.equal(ocean.sample(24.5, 0), 0);
  assert.equal(ocean.sample(0, -24.5), 0);
  assert.equal(ocean.sample(-30, 30), 0);
});

test("a held crease pushes water to opposite sides while the finger drags", () => {
  const { ocean } = createTestOcean();
  fold(ocean, foldPoint(-3, 0), foldPoint(3, 0));
  const profile = [];
  for (let z = -2; z <= 2.0001; z += 0.05) profile.push({ z, value: ocean.sample(0, z) });
  const lowest = profile.reduce((worst, entry) => (entry.value < worst.value ? entry : worst));
  const highest = profile.reduce((best, entry) => (entry.value > best.value ? entry : best));
  assert.ok(highest.value > 0.01, `the crease never rose above ${highest.value}`);
  assert.ok(lowest.value < -0.01, `the crease never sank below ${lowest.value}`);
  assert.ok(highest.value - lowest.value > 0.02, "the fold is too shallow to read as a crease");
  assert.ok(Math.abs(highest.z - lowest.z) <= 2, "the ridge and the trough landed on opposite ends of the crease");
  assert.ok(Math.abs(ocean.sample(0, 8)) < 0.02, `the crease leaked ${ocean.sample(0, 8)} at 8 units away`);
});

test("a zero length segment is ignored instead of dividing by zero", () => {
  const { ocean } = createTestOcean();
  ocean.stampSegment(foldPoint(2, 2), foldPoint(2, 2), 1);
  settle(ocean);
  assert.equal(ocean.sample(2, 2), 0);
  assert.ok(allFinite(ocean.geometry.attributes.position.array));
});

test("manta wakes are rate limited and only accepted above the speed gate", () => {
  const { ocean } = createTestOcean();
  assert.equal(ocean.depositWake(0, 0, 6, 0.45, 0, 1), true);
  assert.equal(ocean.depositWake(0, 0, 6, 0.45, 1, 1.05), false);
  assert.equal(ocean.depositWake(0, 0, 6, 0.45, 1, 4), true);
  assert.equal(ocean.depositWake(0, 0, 0.2, 0.45, 0, 20), false);
  assert.ok(ocean.sample(0, 0) < 0, "a wake pushes the surface downward but the field stayed positive");
});

test("the crease field follows the player across the whole playable area", () => {
  const { ocean } = createTestOcean();
  const halfWidth = 24;
  const waypoints = [
    { x: 0, z: 0 }, { x: 20, z: 18 }, { x: -20, z: -18 }, { x: 40, z: 30 },
    { x: -40, z: -30 }, { x: 58, z: 0 }, { x: 0, z: -58 }, { x: -58, z: 40 }, { x: 0, z: 0 }
  ];
  let x = 0;
  let z = 0;
  let steps = 0;
  let worst = 0;
  for (let index = 1; index < waypoints.length; index += 1) {
    const target = waypoints[index];
    for (let guard = 0; guard < 200000; guard += 1) {
      const dx = target.x - x;
      const dz = target.z - z;
      const distance = Math.hypot(dx, dz);
      if (distance <= 1e-6) {
        x = target.x;
        z = target.z;
        break;
      }
      const travel = Math.min(distance, 2.4 / 60);
      x += (dx / distance) * travel;
      z += (dz / distance) * travel;
      if (Math.hypot(target.x - x, target.z - z) <= 2.4 / 60) {
        x = target.x;
        z = target.z;
      }
      ocean.update(1 / 60, { reducedMotion: false, motionEnergy: 0, sceneTime: steps / 60, originX: x, originZ: z });
      if (Number.isFinite(ocean.originX) && Number.isFinite(ocean.originZ)) {
        worst = Math.max(worst, Math.abs(ocean.originX - x), Math.abs(ocean.originZ - z));
      }
      steps += 1;
    }
    assert.ok(worst <= halfWidth, `on the way to (${target.x}, ${target.z}) the player drifted up to ${worst.toFixed(2)} units from the field centre`);
  }
  assert.ok(steps > 1000, `the walk was only ${steps} steps, so it never actually crossed the map`);
  assert.ok(Number.isFinite(worst), "the field centre became a non-finite value while travelling");
  assert.ok(worst > 0, "the field centre never moved, so it cannot follow the player");
  assert.ok(worst <= halfWidth, `the player drifted up to ${worst.toFixed(2)} units from the field centre, past its ${halfWidth} unit half-width`);
});

test("a fold made far from the origin still deforms the water", () => {
  const { ocean } = createTestOcean();
  const far = { x: 44, z: -26 };
  for (let frame = 0; frame < 4; frame += 1) {
    ocean.update(1 / 60, { reducedMotion: false, motionEnergy: 0, sceneTime: frame / 60, originX: far.x, originZ: far.z });
  }
  fold(ocean, foldPoint(far.x - 3, far.z), foldPoint(far.x + 3, far.z));
  let deepest = 0;
  let highest = 0;
  for (let frame = 0; frame < 60; frame += 1) {
    ocean.update(1 / 60, { reducedMotion: false, motionEnergy: 0.4, sceneTime: frame / 60, originX: far.x, originZ: far.z });
    const positions = ocean.geometry.attributes.position.array;
    for (let index = 1; index < positions.length; index += 3) {
      deepest = Math.min(deepest, positions[index]);
      highest = Math.max(highest, positions[index]);
    }
  }
  assert.ok(allFinite(ocean.geometry.attributes.position.array));
  assert.ok(highest - deepest > 0.05, "the distant fold produced no readable ridge or trough");
});

test("a fold stays where it was made after the player travels away", () => {
  const { ocean } = createTestOcean();
  fold(ocean, foldPoint(0, 0), foldPoint(4, 0));
  const folded = Math.abs(ocean.sample(0, -0.2)) + Math.abs(ocean.sample(0, 0.2));
  assert.ok(folded > 0.01, "the test fold never took effect");
  ocean.update(1 / 60, { reducedMotion: false, motionEnergy: 0, sceneTime: 0, originX: 30, originZ: 0 });
  const afterMove = Math.abs(ocean.sample(0, -0.2)) + Math.abs(ocean.sample(0, 0.2));
  assert.ok(Math.abs(afterMove - folded) < 0.02, `the fold moved with the player, ${folded.toFixed(4)} became ${afterMove.toFixed(4)}`);
});

test("memory that scrolls off the field is discarded, not wrapped around", () => {
  const { ocean } = createTestOcean();
  fold(ocean, foldPoint(-20, 0), foldPoint(-20, 4));
  assert.ok(Math.abs(ocean.sample(-20, -0.2)) > 0.001, "the starting fold never took effect");
  for (let frame = 0; frame < 6; frame += 1) {
    ocean.update(1 / 60, { reducedMotion: false, motionEnergy: 0, sceneTime: frame / 60, originX: 50, originZ: 0 });
  }
  assert.equal(ocean.sample(-20, -0.2), 0, "stale crease memory wrapped into the new field instead of being dropped");
});

test("the field stays centred on the player without chattering", () => {
  const { ocean } = createTestOcean();
  let shifts = 0;
  let previousX = ocean.originX;
  for (let frame = 0; frame < 600; frame += 1) {
    ocean.update(1 / 60, { reducedMotion: false, motionEnergy: 0, sceneTime: frame / 60, originX: frame * 0.05, originZ: 0 });
    if (ocean.originX !== previousX) shifts += 1;
    previousX = ocean.originX;
  }
  assert.ok(shifts > 0, "the field never recentred while the player walked 30 units");
  assert.ok(shifts < 120, `the field recentred ${shifts} times over 600 frames, which will show as a stutter`);
});

test("clearing the field wipes crease memory and velocity", () => {
  const { ocean } = createTestOcean();
  fold(ocean, foldPoint(-3, 0), foldPoint(3, 0));
  assert.notEqual(ocean.sample(0, -0.2), 0);
  assert.notEqual(ocean.sample(0, 0.2), 0);
  ocean.clearField();
  assert.equal(ocean.sample(0, -0.2), 0);
  assert.equal(ocean.sample(0, 0.2), 0);
  settle(ocean);
  assert.equal(ocean.sample(0, -0.2), 0);
  assert.equal(ocean.sample(0, 0.2), 0);
});

test("updating a calm ocean keeps every vertex finite and near its rest height", () => {
  const { ocean } = createTestOcean();
  const base = new Float32Array(ocean.geometry.attributes.position.array);
  let tallest = 0;
  for (let frame = 0; frame < 90; frame += 1) {
    ocean.update(1 / 60, { reducedMotion: false, motionEnergy: 0, sceneTime: frame / 60 });
    const positions = ocean.geometry.attributes.position.array;
    assert.ok(allFinite(positions));
    for (let index = 1; index < positions.length; index += 3) {
      tallest = Math.max(tallest, Math.abs(positions[index] - base[index]));
    }
  }
  assert.ok(tallest > 0.001, "the ambient swell never moved the surface");
  assert.ok(tallest < 0.5, `ambient swell peaked at ${tallest.toFixed(3)}, which is far too tall`);
  assert.ok(allFinite(ocean.geometry.attributes.color.array));
});

test("reduced motion keeps the same surface but with a smaller swell", () => {
  const full = createTestOcean().ocean;
  const reduced = createTestOcean("full").ocean;
  for (let frame = 0; frame < 60; frame += 1) {
    full.update(1 / 60, { reducedMotion: false, motionEnergy: 0, sceneTime: frame / 60 });
    reduced.update(1 / 60, { reducedMotion: true, motionEnergy: 0, sceneTime: frame / 60 });
  }
  const amplitude = (ocean) => {
    let sum = 0;
    for (let index = 1; index < ocean.geometry.attributes.position.array.length; index += 3) {
      sum += Math.abs(ocean.geometry.attributes.position.array[index]);
    }
    return sum;
  };
  assert.ok(amplitude(reduced) < amplitude(full) * 0.75, "reduced motion did not calm the swell");
});

test("a folded crease deepens the water where the user dragged", () => {
  const { ocean } = createTestOcean();
  for (let frame = 0; frame < 60; frame += 1) {
    ocean.stampSegment(foldPoint(-2, 1.5), foldPoint(2, 1.5), Math.pow(1 - frame / 60, 0.72));
    settle(ocean, 1);
    ocean.update(1 / 60, { reducedMotion: false, motionEnergy: 0.5, sceneTime: frame / 60 });
  }
  const positions = ocean.geometry.attributes.position.array;
  const creaseIndex = Math.floor(positions.length / 3);
  let deepest = 0;
  let highest = 0;
  for (let index = 1; index < positions.length; index += 3) {
    deepest = Math.min(deepest, positions[index]);
    highest = Math.max(highest, positions[index]);
  }
  assert.ok(allFinite(positions));
  assert.ok(highest - deepest > 0.05, "the fold never produced a readable ridge or trough");
  assert.ok(creaseIndex > 0);
});

test("the crease shader stays attached to the shared material", () => {
  const material = { customProgramCacheKey: null };
  const { ocean } = createTestOcean("full", material);
  const shader = { vertexShader: "#include <common>\nvoid main() { #include <begin_vertex> }", fragmentShader: "#include <common>\nvoid main() { #include <color_fragment> }" };
  material.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /attribute vec3 barycentric/);
  assert.match(shader.fragmentShader, /creaseLine/);
  assert.equal(ocean.mesh.material, material);
});
