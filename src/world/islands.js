import { islandSpecs } from "./layout.js";

const SAIL_TRIANGLES = [
  [[0, 0, 0], [0, 2.75, 0], [0.78, 1.1, 0.12]],
  [[0, 0, 0], [0.78, 1.1, 0.12], [-0.48, 1.28, -0.08]],
  [[0, 2.75, 0], [-0.48, 1.28, -0.08], [0.78, 1.1, 0.12]]
];

export function createIslands({ THREE, scene, materials, occluders }) {
  const rockGeometry = new THREE.IcosahedronGeometry(0.72, 0);
  const shardGeometry = new THREE.ConeGeometry(0.64, 2.15, 4, 1, false);
  shardGeometry.translate(0, 1.075, 0);

  const sailPositions = [];
  const sailUvs = [];
  for (const triangle of SAIL_TRIANGLES) {
    for (const point of triangle) {
      sailPositions.push(point[0], point[1], point[2]);
      sailUvs.push(point[0] * 0.18 + 0.5, point[2] * 0.18 + 0.5);
    }
  }
  const sailGeometry = new THREE.BufferGeometry();
  sailGeometry.setAttribute("position", new THREE.Float32BufferAttribute(sailPositions, 3));
  sailGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(sailUvs, 2));
  sailGeometry.computeVertexNormals();

  const rockBuckets = [[], [], []];
  const shardBuckets = new Map();
  const sailBuckets = new Map();
  for (let index = 0; index < islandSpecs.length; index += 1) {
    const materialIndex = islandSpecs[index][3];
    rockBuckets[materialIndex].push(index);
    const shardKey = materialIndex === 1 ? "vermilion" : index % 2 ? "gold" : "indigo";
    if (!shardBuckets.has(shardKey)) shardBuckets.set(shardKey, []);
    shardBuckets.get(shardKey).push(index);
    if (index % 2 === 0) {
      const sailKey = index % 4 === 0 ? "cream" : "vermilion";
      if (!sailBuckets.has(sailKey)) sailBuckets.set(sailKey, []);
      sailBuckets.get(sailKey).push(index);
    }
  }

  const positionScratch = new THREE.Vector3();
  const quaternionScratch = new THREE.Quaternion();
  const eulerScratch = new THREE.Euler();
  const scaleScratch = new THREE.Vector3();
  const groupPosition = new THREE.Vector3();
  const groupQuaternion = new THREE.Quaternion();
  const groupScale = new THREE.Vector3(1, 1, 1);
  const upAxis = new THREE.Vector3(0, 1, 0);
  const groupMatrix = new THREE.Matrix4();
  const partMatrix = new THREE.Matrix4();

  function localMatrix(x, y, z, rx, ry, rz, sx, sy, sz) {
    positionScratch.set(x, y, z);
    eulerScratch.set(rx, ry, rz);
    quaternionScratch.setFromEuler(eulerScratch);
    scaleScratch.set(sx, sy, sz);
    return new THREE.Matrix4().compose(positionScratch, quaternionScratch, scaleScratch);
  }

  function spawnSet(geometry, material, members) {
    const mesh = new THREE.InstancedMesh(geometry, material, members.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
    occluders.push(mesh);
    return { mesh, members };
  }

  const rockMeshes = rockBuckets.map((members, materialIndex) => spawnSet(rockGeometry, materials.rock[materialIndex], members));
  const shardMeshes = [...shardBuckets.entries()].map(([key, members]) => spawnSet(shardGeometry, materials[key], members));
  const sailMeshes = [...sailBuckets.entries()].map(([key, members]) => spawnSet(sailGeometry, materials[key], members));

  const islands = [];
  for (let index = 0; index < islandSpecs.length; index += 1) {
    const [x, z, scale] = islandSpecs[index];
    const parts = [];
    const rockSet = rockMeshes[islandSpecs[index][3]];
    parts.push({
      mesh: rockSet.mesh,
      slot: rockSet.members.indexOf(index),
      local: localMatrix(0, 0.12 * scale, 0, 0.1 * index, index * 0.81, 0.06 * index, 1.45 * scale, 0.5 * scale, 1.05 * scale)
    });
    for (const set of shardMeshes) {
      const slot = set.members.indexOf(index);
      if (slot < 0) continue;
      parts.push({
        mesh: set.mesh,
        slot,
        local: localMatrix(0.28 * scale, 0.18 * scale, -0.08 * scale, 0, 0.6 + index * 0.47, 0, 0.72 * scale, scale, 0.72 * scale)
      });
    }
    for (const set of sailMeshes) {
      const slot = set.members.indexOf(index);
      if (slot < 0) continue;
      parts.push({
        mesh: set.mesh,
        slot,
        local: localMatrix(-0.25 * scale, 0.2 * scale, 0.18 * scale, 0, -0.5 + index * 0.23, 0, scale * 0.72, scale * 0.72, scale * 0.72)
      });
    }
    islands.push({ x, z, baseY: -0.04, phase: index * 0.83, yaw: 0, scale, parts });
  }

  function update(sceneTime, motion) {
    for (let index = 0; index < islands.length; index += 1) {
      const island = islands[index];
      const bob = Math.sin(sceneTime * 0.45 + island.phase) * 0.025 * motion;
      const sway = Math.sin(sceneTime * 0.18 + island.phase) * 0.025 * motion;
      island.yaw = sway;
      groupPosition.set(island.x, island.baseY + bob, island.z);
      groupQuaternion.setFromAxisAngle(upAxis, sway);
      groupMatrix.compose(groupPosition, groupQuaternion, groupScale);
      for (let part = 0; part < island.parts.length; part += 1) {
        partMatrix.multiplyMatrices(groupMatrix, island.parts[part].local);
        island.parts[part].mesh.setMatrixAt(island.parts[part].slot, partMatrix);
      }
    }
    for (const set of rockMeshes) set.mesh.instanceMatrix.needsUpdate = true;
    for (const set of shardMeshes) set.mesh.instanceMatrix.needsUpdate = true;
    for (const set of sailMeshes) set.mesh.instanceMatrix.needsUpdate = true;
  }

  update(0, 1);
  return { islands, update };
}
