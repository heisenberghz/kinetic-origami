import { regions, paperSpanPath } from "./layout.js";

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
const shoalSailWidth = 1.55;
const shoalSailDepth = 0.95;
const shoalSailHeight = 2.9;
const reedRise = 0.92;
const shoalScaleSpread = 0.4;
const shoalScaleBase = 0.92;
const reedScaleSpread = 0.13;
const reedScaleBase = 0.85;
const terracedPlateCount = 7;
const terracedPlateSize = 1.5;
const terracedRise = 2.2;
const archivePageCount = 12;
const archivePlateSize = 1.4;
const archiveRise = 1.8;
const kilnPlateCount = 8;
const kilnPlateSize = 1.6;
const kilnRise = 2.0;
const emberCount = 10;

const landmarkScale = 2.35;

export const landmarkMetrics = {
  cathedral: { planRadius: plinthSize * 0.5 * landmarkScale, height: (finialBase + finialRise) * landmarkScale, beaconHeight: 26, beacon: "#e8b25a" },
  lagoon: { planRadius: (reedRingRadius + reedSize * 0.5) * landmarkScale, height: reedRise * (reedScaleBase + reedScaleSpread) * landmarkScale, basinInnerRadius: basinInnerRadius * landmarkScale, reedRingRadius: reedRingRadius * landmarkScale, beaconHeight: 20, beacon: "#8fc7bd" },
  shoals: { planRadius: (shoalArcRadius + shoalSailWidth * 0.5) * landmarkScale, height: shoalSailHeight * (shoalScaleBase + reedScaleSpread) * landmarkScale, beaconHeight: 23, beacon: "#e0704f" },
  terraces: { planRadius: 4.4, height: 12, beaconHeight: 22, beacon: "#c9a24b" },
  archive: { planRadius: 3.4, height: 20, beaconHeight: 24, beacon: "#b9a6d8" },
  kiln: { planRadius: 3.4, height: 10, beaconHeight: 20, beacon: "#f08a3c" }
};

export function createLandmarks({ THREE, scene, qualityTier, materials, occluders }) {
  const group = new THREE.Group();
  const transform = new THREE.Object3D();
  const anchors = [];
  const controllers = [];

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
    const foot = [-half * 0.55, 0, depth * 0.55];
    return geometryFromTriangles([
      [[0, 0, 0], apex, front],
      [[0, 0, 0], front, back],
      [apex, back, front],
      [[0, 0, 0], front, foot],
      [[0, 0, 0], foot, back],
      [front, foot, back]
    ]);
  }

  function buildCathedral(district, region) {
    const spin = new THREE.Group();
    district.add(spin);
    const spireParts = [];
    function addSpirePart(size, rise, skew, y, material) {
      const mesh = new THREE.Mesh(foldedPlate(size, rise, skew), material);
      mesh.position.y = y;
      mesh.rotation.y = spireParts.length * 0.52;
      spin.add(mesh);
      occluders.push(mesh);
      spireParts.push({ mesh, phase: spireParts.length * 0.85 });
    }
    addSpirePart(plinthSize, 0.45, 0.3, 0, materials.cream);
    addSpirePart(spireBase, 3.6, 0.35, 0.35, materials.indigo);
    addSpirePart(corniceLow, 0.35, -0.25, 1.5, materials.vermilion);
    addSpirePart(corniceHigh, 0.3, 0.2, 2.9, materials.cream);
    addSpirePart(finialSize, finialRise, 0.15, finialBase, materials.gold);
    anchors.push({ sectionId: region.id, x: region.x, z: region.z, scale: landmarkMetrics.cathedral.planRadius });
    return {
      update(sceneTime, motion) {
        spin.rotation.y = 0.16 + Math.sin(sceneTime * 0.047) * 0.07 * motion;
        spin.rotation.z = Math.sin(sceneTime * 0.23) * 0.014 * motion;
        for (let index = 0; index < spireParts.length; index += 1) {
          spireParts[index].mesh.scale.y = 1 + Math.sin(sceneTime * 0.4 + spireParts[index].phase) * 0.04 * motion;
        }
      }
    };
  }

  function buildLagoon(district, region) {
    const basin = new THREE.Mesh(scallopedBand(basinInnerRadius, basinOuterRadius, qualityTier === "light" ? 20 : 30, 0.05, 0.05), materials.cream);
    basin.position.y = 0.03;
    district.add(basin);

    const reeds = new THREE.InstancedMesh(foldedPlate(reedSize, reedRise, 0.3), materials.vermilion, qualityTier === "light" ? 9 : 14);
    reeds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    reeds.frustumCulled = false;
    district.add(reeds);
    const reedSpecs = [];
    const reedCount = reeds.count;
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
    anchors.push({ sectionId: region.id, x: region.x, z: region.z, scale: landmarkMetrics.lagoon.planRadius * 0.45 });
    return {
      update(sceneTime, motion) {
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
      }
    };
  }

  function buildShoals(district, region) {
    const spillwayMesh = new THREE.Mesh(spillway(1.75, -66, 66, 16, 0.55, 0.16), materials.cream);
    spillwayMesh.position.y = 0.02;
    district.add(spillwayMesh);

    const shards = new THREE.InstancedMesh(foldedSail(shoalSailHeight, shoalSailWidth, shoalSailDepth), materials.gold, qualityTier === "light" ? 5 : 8);
    shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    shards.frustumCulled = false;
    district.add(shards);
    const shardSpecs = [];
    const shardCount = shards.count;
    const shardTints = [new THREE.Color(1, 1, 1), new THREE.Color(0.82, 0.5, 0.38), new THREE.Color(1, 0.92, 0.72)];
    for (let index = 0; index < shardCount; index += 1) {
      const u = shardCount === 1 ? 0.5 : index / (shardCount - 1);
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
    anchors.push({ sectionId: region.id, x: region.x, z: region.z, scale: landmarkMetrics.shoals.planRadius * 0.45 });
    return {
      update(sceneTime, motion) {
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
    };
  }

  function buildTerraces(district, region) {
    const plates = [];
    for (let index = 0; index < terracedPlateCount; index += 1) {
      const material = index % 2 === 0 ? materials.indigo : materials.cream;
      const mesh = new THREE.Mesh(foldedPlate(terracedPlateSize, terracedRise, 0.25 + index * 0.05), material);
      mesh.position.y = index * terracedRise;
      mesh.rotation.y = index * 0.22;
      plates.push(mesh);
      occluders.push(mesh);
    }
    for (const mesh of plates) district.add(mesh);
    anchors.push({ sectionId: region.id, x: region.x, z: region.z, scale: landmarkMetrics.terraces.planRadius });
    return { update() {} };
  }

  function buildArchive(district, region) {
    const pages = [];
    for (let index = 0; index < archivePageCount; index += 1) {
      const material = index % 2 === 0 ? materials.cream : materials.gold;
      const mesh = new THREE.Mesh(foldedPlate(archivePlateSize, archiveRise, 0.2), material);
      mesh.position.y = index * archiveRise;
      mesh.rotation.y = index * 0.1;
      pages.push(mesh);
      occluders.push(mesh);
    }
    for (const mesh of pages) district.add(mesh);
    anchors.push({ sectionId: region.id, x: region.x, z: region.z, scale: landmarkMetrics.archive.planRadius });
    return { update() {} };
  }

  function buildKiln(district, region) {
    const plates = [];
    for (let index = 0; index < kilnPlateCount; index += 1) {
      const mesh = new THREE.Mesh(foldedPlate(kilnPlateSize, kilnRise, 0.3), materials.vermilion);
      mesh.position.y = index * kilnRise;
      mesh.rotation.y = index * 0.18;
      plates.push(mesh);
      occluders.push(mesh);
    }
    for (const mesh of plates) district.add(mesh);

    const embers = new THREE.InstancedMesh(foldedSail(0.5, 0.35, 0.3), materials.gold, emberCount);
    embers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    embers.frustumCulled = false;
    district.add(embers);
    const emberSpecs = [];
    for (let index = 0; index < emberCount; index += 1) {
      const u = index / (emberCount - 1 || 1);
      emberSpecs.push({
        x: 0.4 + Math.sin(u * 5.1 + index * 1.7) * 0.8,
        z: -0.5 + Math.cos(u * 4.3 + index * 0.9) * 0.6,
        phase: u * TAU + index,
        rise: 0.4 + Math.sin(index * 2.1) * 0.3
      });
    }
    return {
      update(sceneTime, motion) {
        for (let index = 0; index < emberSpecs.length; index += 1) {
          const ember = emberSpecs[index];
          const drift = Math.sin(sceneTime * 0.6 + ember.phase) * motion * 0.5;
          transform.position.set(ember.x, 6 + drift * 6, ember.z);
          transform.rotation.set(drift * 0.4, ember.phase * 0.3, drift);
          transform.scale.setScalar(0.5 + ember.phase * 0.01);
          transform.updateMatrix();
          embers.setMatrixAt(index, transform.matrix);
        }
        embers.instanceMatrix.needsUpdate = true;
      }
    };
  }

  function buildPaperSpan(district) {
    const start = paperSpanPath.start;
    const end = paperSpanPath.end;
    const count = paperSpanPath.count;
    const teeth = [];
    for (let index = 0; index < count; index += 1) {
      const u = count === 1 ? 0.5 : index / (count - 1);
      const x = start[0] + (end[0] - start[0]) * u;
      const z = start[1] + (end[1] - start[1]) * u;
      const mesh = new THREE.Mesh(foldedPlate(1.5, 1.2, 0.2), materials.cream);
      mesh.position.set(x, 0.15, z);
      mesh.rotation.y = u * TAU * 0.9;
      teeth.push(mesh);
      occluders.push(mesh);
    }
    for (const mesh of teeth) district.add(mesh);
    return { update() {} };
  }

  function addBeacon(district, metric) {
    const height = metric.beaconHeight;
    const geometry = new THREE.CylinderGeometry(metric.planRadius * 0.14, metric.planRadius * 0.5, height, 12, 1, true);
    geometry.translate(0, height * 0.5, 0);
    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(metric.beacon) } },
      vertexShader: "varying float vFade;\nvoid main(){\nvFade = uv.y;\ngl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);\n}",
      fragmentShader: "uniform vec3 uColor;\nvarying float vFade;\nvoid main(){\nfloat a = pow(vFade, 2.2) * 0.42;\ngl_FragColor = vec4(uColor, a);\n}",
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.2;
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    district.add(mesh);
    return mesh;
  }

  const builders = {
    cathedral: buildCathedral,
    lagoon: buildLagoon,
    shoals: buildShoals,
    terraces: buildTerraces,
    archive: buildArchive,
    kiln: buildKiln
  };

  const scaledDistricts = new Set(["cathedral", "lagoon", "shoals"]);

  const groupsById = {};
  function buildDistrict(region) {
    const district = new THREE.Group();
    district.position.set(region.x, 0, region.z);
    const controller = builders[region.id](district, region);
    if (scaledDistricts.has(region.id)) {
      const inner = new THREE.Group();
      while (district.children.length) inner.add(district.children[0]);
      inner.scale.setScalar(landmarkScale);
      district.add(inner);
    }
    controllers.push(controller);
    group.add(district);
    groupsById[region.id] = district;
  }

  for (const region of regions) buildDistrict(region);

  const paperSpan = new THREE.Group();
  const paperSpanController = buildPaperSpan(paperSpan);
  controllers.push(paperSpanController);
  group.add(paperSpan);

  for (const region of regions) {
    addBeacon(groupsById[region.id], landmarkMetrics[region.id]);
  }

  scene.add(group);

  function update(sceneTime, motion) {
    for (const controller of controllers) controller.update(sceneTime, motion);
  }

  update(0, 1);

  return { group, anchors, update, groupsById };
}
