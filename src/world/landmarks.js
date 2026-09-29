import { regions } from "./layout.js";

const TAU = Math.PI * 2;

const plinthSize = 4;
const spireBase = 2.7;
const corniceLow = 3.1;
const corniceHigh = 2.4;
const finialSize = 0.85;
const finialRise = 1.45;
const finialBase = 3.9;
const basinInnerRadius = 2.45;
const basinOuterRadius = 3.2;
const reedRingRadius = 3.05;
const reedSize = 0.72;
const shoalArcRadius = 2.9;
const shoalSailWidth = 1.05;
const shoalSailHeight = 2.9;
const reedRise = 0.92;
const shoalScaleSpread = 0.4;
const shoalScaleBase = 0.92;
const reedScaleSpread = 0.13;
const reedScaleBase = 0.85;

export const landmarkMetrics = {
  cathedral: { planRadius: plinthSize * 0.5, height: finialBase + finialRise },
  lagoon: { planRadius: reedRingRadius + reedSize * 0.5, height: reedRise * (reedScaleBase + reedScaleSpread), basinInnerRadius, reedRingRadius },
  shoals: { planRadius: shoalArcRadius + shoalSailWidth * 0.5, height: shoalSailHeight * (shoalScaleBase + shoalScaleSpread) }
};

export function createLandmarks({ THREE, scene, qualityTier, materials, occluders }) {
  const group = new THREE.Group();
  const transform = new THREE.Object3D();
  const anchors = [];

  function geometryFromTriangles(triangles) {
    const positions = [];
    const uvs = [];
    for (const triangle of triangles) {
      for (const point of triangle) {
        positions.push(point[0], point[1], point[2]);
        uvs.push(point[0] * 0.18 + 0.5, point[2] * 0.18 + 0.5);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    return geometry;
  }

  function foldedPlate(size, rise, skew) {
    const half = size * 0.5;
    const apex = [skew * 0.5, rise, skew * 0.7];
    return geometryFromTriangles([
      [[-half, 0, 0], [0, 0, half], apex],
      [[0, 0, half], [half, 0, 0], apex],
      [[half, 0, 0], [0, 0, -half], apex],
      [[0, 0, -half], [-half, 0, 0], apex]
    ]);
  }

  function scallopedBand(innerRadius, outerRadius, segments, waves, height) {
    const positions = [];
    const indices = [];
    for (let index = 0; index <= segments; index += 1) {
      const angle = (index / segments) * TAU;
      const scallop = 1 + Math.sin(angle * 7 + 0.6) * waves + Math.sin(angle * 3 - 1.2) * waves * 0.7;
      positions.push(Math.cos(angle) * innerRadius * scallop, 0, Math.sin(angle) * innerRadius * scallop);
      positions.push(Math.cos(angle) * outerRadius * scallop, height, Math.sin(angle) * outerRadius * scallop);
      if (index < segments) {
        const current = index * 2;
        indices.push(current, current + 1, current + 2, current + 1, current + 3, current + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function spillway(radius, fromDegrees, toDegrees, segments, width, height) {
    const positions = [];
    const indices = [];
    for (let index = 0; index <= segments; index += 1) {
      const u = index / segments;
      const angle = (fromDegrees + (toDegrees - fromDegrees) * u) * (Math.PI / 180);
      const taper = Math.sin(u * Math.PI) * 0.6 + 0.4;
      const half = width * taper;
      positions.push(Math.cos(angle) * (radius - half), 0, Math.sin(angle) * (radius - half));
      positions.push(Math.cos(angle) * (radius + half), height * taper, Math.sin(angle) * (radius + half));
      if (index < segments) {
        const current = index * 2;
        indices.push(current, current + 1, current + 2, current + 1, current + 3, current + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function foldedSail(height, width, depth) {
    const half = width * 0.5;
    const apex = [0, height, 0];
    const front = [half, height * 0.42, depth];
    const back = [-half * 0.7, height * 0.5, -depth * 0.4];
    return geometryFromTriangles([
      [[0, 0, 0], apex, front],
      [[0, 0, 0], front, back],
      [apex, back, front]
    ]);
  }

  const cathedral = new THREE.Group();
  cathedral.position.set(regions[0].x, 0, regions[0].z);
  const cathedralSpin = new THREE.Group();
  cathedral.add(cathedralSpin);

  const spireParts = [];
  function addSpirePart(size, rise, skew, y, material) {
    const mesh = new THREE.Mesh(foldedPlate(size, rise, skew), material);
    mesh.position.y = y;
    mesh.rotation.y = spireParts.length * 0.52;
    cathedralSpin.add(mesh);
    occluders.push(mesh);
    spireParts.push({ mesh, phase: spireParts.length * 0.85 });
  }

  addSpirePart(plinthSize, 0.45, 0.3, 0, materials.cream);
  addSpirePart(spireBase, 3.6, 0.35, 0.35, materials.indigo);
  addSpirePart(corniceLow, 0.35, -0.25, 1.5, materials.vermilion);
  addSpirePart(corniceHigh, 0.3, 0.2, 2.9, materials.cream);
  addSpirePart(finialSize, finialRise, 0.15, finialBase, materials.gold);
  anchors.push({ x: regions[0].x, z: regions[0].z, scale: landmarkMetrics.cathedral.planRadius });

  const lagoon = new THREE.Group();
  lagoon.position.set(regions[1].x, 0, regions[1].z);
  const basin = new THREE.Mesh(scallopedBand(basinInnerRadius, basinOuterRadius, qualityTier === "light" ? 20 : 30, 0.05, 0.05), materials.cream);
  basin.position.y = 0.03;
  lagoon.add(basin);

  const reedCount = qualityTier === "light" ? 9 : 14;
  const reeds = new THREE.InstancedMesh(foldedPlate(reedSize, reedRise, 0.3), materials.vermilion, reedCount);
  reeds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  reeds.frustumCulled = false;
  lagoon.add(reeds);
  const reedSpecs = [];

  for (let index = 0; index < reedCount; index += 1) {
    const u = index / reedCount;
    const angle = u * TAU + 0.24;
    const radius = reedRingRadius + Math.sin(angle * 7 + 0.6) * 0.15;
    reedSpecs.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      angle,
      phase: u * TAU,
      scale: reedScaleBase + Math.sin(index * 2.3) * reedScaleSpread
    });
  }
  anchors.push({ x: regions[1].x, z: regions[1].z, scale: landmarkMetrics.lagoon.planRadius * 0.45 });

  const shoals = new THREE.Group();
  shoals.position.set(regions[2].x, 0, regions[2].z);
  const spillwayMesh = new THREE.Mesh(spillway(1.75, -66, 66, 16, 0.55, 0.16), materials.cream);
  spillwayMesh.position.y = 0.02;
  shoals.add(spillwayMesh);

  const shoalCount = qualityTier === "light" ? 5 : 8;
  const shardGeometry = foldedSail(shoalSailHeight, shoalSailWidth, 0.34);
  const shards = new THREE.InstancedMesh(shardGeometry, materials.gold, shoalCount);
  shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shards.frustumCulled = false;
  shoals.add(shards);
  const shardSpecs = [];
  const shardTints = [new THREE.Color(1, 1, 1), new THREE.Color(0.86, 0.64, 0.52)];

  for (let index = 0; index < shoalCount; index += 1) {
    const u = shoalCount === 1 ? 0.5 : index / (shoalCount - 1);
    const angle = (-72 + 144 * u) * (Math.PI / 180);
    const radius = shoalArcRadius + Math.sin(u * 5.2) * 0.3;
    shardSpecs.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      yaw: angle,
      lean: 0.1 + u * 0.15,
      scale: shoalScaleBase + Math.sin(u * 3.1 + 0.6) * shoalScaleSpread,
      phase: u * 4.2
    });
    shards.setColorAt(index, shardTints[index % shardTints.length]);
  }
  shards.instanceColor.needsUpdate = true;
  anchors.push({ x: regions[2].x, z: regions[2].z, scale: landmarkMetrics.shoals.planRadius * 0.45 });

  group.add(cathedral, lagoon, shoals);
  scene.add(group);

  function update(sceneTime, motion) {
    cathedralSpin.rotation.y = 0.16 + Math.sin(sceneTime * 0.047) * 0.07 * motion;
    cathedralSpin.rotation.z = Math.sin(sceneTime * 0.23) * 0.014 * motion;
    for (let index = 0; index < spireParts.length; index += 1) {
      spireParts[index].mesh.scale.y = 1 + Math.sin(sceneTime * 0.4 + spireParts[index].phase) * 0.04 * motion;
    }

    for (let index = 0; index < reedSpecs.length; index += 1) {
      const reed = reedSpecs[index];
      const sway = Math.sin(sceneTime * 0.9 + reed.phase) * 0.13 * motion;
      transform.position.set(reed.x, 0.02, reed.z);
      transform.rotation.set(sway * 0.5, reed.angle, sway);
      transform.scale.setScalar(reed.scale);
      transform.updateMatrix();
      reeds.setMatrixAt(index, transform.matrix);
    }
    reeds.instanceMatrix.needsUpdate = true;

    for (let index = 0; index < shardSpecs.length; index += 1) {
      const shard = shardSpecs[index];
      const gust = Math.sin(sceneTime * 1.15 - shard.phase * 1.6) * 0.16 * motion;
      transform.position.set(shard.x, 0, shard.z);
      transform.rotation.set(shard.lean + gust, shard.yaw, gust * 0.6);
      transform.scale.set(0.8 * shard.scale, shard.scale, 0.8 * shard.scale);
      transform.updateMatrix();
      shards.setMatrixAt(index, transform.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;
  }

  update(0, 1);

  return { group, anchors, update };
}
