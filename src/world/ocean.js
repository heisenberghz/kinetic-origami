const TAU = Math.PI * 2;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function addCreaseShader(material, strength) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 barycentric;\nvarying vec3 vCrease;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCrease = barycentric;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCrease;")
      .replace("#include <color_fragment>", `#include <color_fragment>\nfloat creaseEdge = min(min(vCrease.x, vCrease.y), vCrease.z);\nfloat creaseAA = max(fwidth(creaseEdge), 0.0008);\nfloat creaseLine = 1.0 - smoothstep(creaseAA * 0.25, creaseAA * 1.55, creaseEdge);\ndiffuseColor.rgb *= 1.0 - creaseLine * ${strength.toFixed(3)};`);
  };
  material.customProgramCacheKey = () => `paper-creases-${strength}`;
}

export function createOcean({ THREE, scene, qualityTier, material, farMaterial }) {
  const rings = qualityTier === "light" ? 18 : 24;
  const segments = qualityTier === "light" ? 56 : 72;
  const maximumRadius = 26;
  const positions = [0, 0, 0];
  const indices = [];
  const outlineRandom = seededRandom(31415);

  for (let ring = 1; ring <= rings; ring += 1) {
    const radius = maximumRadius * Math.pow(ring / rings, 1.04);
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * TAU;
      const edgeScale = 1 + Math.sin(angle * 3 + 0.4) * 0.062 + Math.sin(angle * 7 - 0.7) * 0.034 + Math.sin(angle * 13 + 1.9) * 0.017 + (outlineRandom() - 0.5) * 0.014;
      positions.push(Math.cos(angle) * radius * edgeScale, 0, Math.sin(angle) * radius * edgeScale);
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const current = 1 + segment;
    const next = 1 + ((segment + 1) % segments);
    indices.push(0, next, current);
  }

  for (let ring = 1; ring < rings; ring += 1) {
    const innerStart = 1 + (ring - 1) * segments;
    const outerStart = 1 + ring * segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const nextSegment = (segment + 1) % segments;
      const innerCurrent = innerStart + segment;
      const innerNext = innerStart + nextSegment;
      const outerCurrent = outerStart + segment;
      const outerNext = outerStart + nextSegment;
      indices.push(innerCurrent, outerNext, outerCurrent);
      indices.push(innerCurrent, innerNext, outerNext);
    }
  }

  const indexedGeometry = new THREE.BufferGeometry();
  indexedGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  indexedGeometry.setIndex(indices);
  const geometry = indexedGeometry.toNonIndexed();
  indexedGeometry.dispose();

  const count = geometry.attributes.position.count;
  const barycentric = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const random = seededRandom(90210);
  const color = new THREE.Color();

  for (let vertex = 0; vertex < count; vertex += 1) {
    uvs[vertex * 2] = geometry.attributes.position.array[vertex * 3] / (maximumRadius * 2) + 0.5;
    uvs[vertex * 2 + 1] = geometry.attributes.position.array[vertex * 3 + 2] / (maximumRadius * 2) + 0.5;
  }

  for (let vertex = 0; vertex < count; vertex += 3) {
    const base = 0.78 + random() * 0.2;
    const warmth = 0.94 + random() * 0.06;
    for (let corner = 0; corner < 3; corner += 1) {
      const index = vertex + corner;
      barycentric[index * 3] = corner === 0 ? 1 : 0;
      barycentric[index * 3 + 1] = corner === 1 ? 1 : 0;
      barycentric[index * 3 + 2] = corner === 2 ? 1 : 0;
      const vertexX = geometry.attributes.position.array[index * 3];
      const vertexZ = geometry.attributes.position.array[index * 3 + 2];
      const radius = Math.hypot(vertexX, vertexZ);
      const foldRing = Math.sin(radius * 1.85 + 0.6) * 0.055 + Math.sin(radius * 0.71 - 1.1) * 0.042;
      const foldSpoke = Math.sin(Math.atan2(vertexZ, vertexX) * 9 + radius * 0.24) * 0.028;
      const value = clamp(base + foldRing + foldSpoke, 0.58, 1.08);
      color.setRGB(value, value * warmth, value * (warmth - 0.035));
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
  }

  geometry.setAttribute("barycentric", new THREE.BufferAttribute(barycentric, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "faceted paper ocean";
  scene.add(mesh);
  addCreaseShader(material, 0.035);

  const farRadius = 140;
  const farGeometry = new THREE.RingGeometry(maximumRadius * 0.93, farRadius, 64, 6);
  farGeometry.rotateX(-Math.PI / 2);
  const farMesh = new THREE.Mesh(farGeometry, farMaterial || material);
  farMesh.name = "distant water";
  farMesh.position.y = -0.06;
  farMesh.frustumCulled = false;
  scene.add(farMesh);

  const base = new Float32Array(geometry.attributes.position.array);
  const colorsOut = geometry.attributes.color.array;
  const baseColors = new Float32Array(colorsOut);
  const displacement = new Float32Array(base.length / 3);
  const velocity = new Float32Array(base.length / 3);
  const vertexCount = base.length / 3;

  const swellTerms = 4;
  const swellRate = new Float32Array([0.58, -0.41, 0.83, 0.26]);
  const swellGain = new Float32Array([0.1, 0.09, 0.032, 0.055]);
  const swellAxisX = new Float32Array([0.43, 0, 0.72, 0.18]);
  const swellAxisZ = new Float32Array([0, 0.36, 0.72, -0.23]);
  const swellSpace = new Float32Array(vertexCount * swellTerms);
  const swellCos = new Float32Array(vertexCount * swellTerms);
  const halfPi = Math.PI * 0.5;

  for (let index = 0; index < vertexCount; index += 1) {
    const x = base[index * 3];
    const z = base[index * 3 + 2];
    const spatial = [x * 0.43, z * 0.36 + halfPi, (x + z) * 0.72, x * 0.18 - z * 0.23];
    for (let term = 0; term < swellTerms; term += 1) {
      swellSpace[index * swellTerms + term] = Math.sin(spatial[term]);
      swellCos[index * swellTerms + term] = Math.cos(spatial[term]);
    }
  }

  const fieldResolution = qualityTier === "light" ? 49 : 65;
  const fieldSize = 48;
  const fieldStep = fieldSize / (fieldResolution - 1);
  const fieldTarget = new Float32Array(fieldResolution * fieldResolution);
  const fieldMemory = new Float32Array(fieldResolution * fieldResolution);
  const fieldVelocity = new Float32Array(fieldResolution * fieldResolution);
  let gradientX = 0;
  let gradientZ = 0;
  let fieldOriginX = 0;
  let fieldOriginZ = 0;

  function shiftField(cellsX, cellsZ) {
    if (cellsX === 0 && cellsZ === 0) return;
    for (let row = 0; row < fieldResolution; row += 1) {
      const sourceZ = row + cellsZ;
      for (let column = 0; column < fieldResolution; column += 1) {
        const sourceX = column + cellsX;
        const destination = row * fieldResolution + column;
        if (sourceX < 0 || sourceX >= fieldResolution || sourceZ < 0 || sourceZ >= fieldResolution) {
          fieldTarget[destination] = 0;
          fieldMemory[destination] = 0;
          fieldVelocity[destination] = 0;
        } else {
          const source = sourceZ * fieldResolution + sourceX;
          fieldTarget[destination] = fieldTarget[source];
          fieldMemory[destination] = fieldMemory[source];
          fieldVelocity[destination] = fieldVelocity[source];
        }
      }
    }
    fieldOriginX += cellsX * fieldStep;
    fieldOriginZ += cellsZ * fieldStep;
  }

  function recentre(worldX, worldZ) {
    const half = fieldSize * 0.5;
    const edge = half - fieldStep * 2;
    for (let pass = 0; pass < 4; pass += 1) {
      const localX = worldX - fieldOriginX;
      const localZ = worldZ - fieldOriginZ;
      let cellsX = 0;
      let cellsZ = 0;
      if (localX > edge) cellsX = Math.floor(localX - edge);
      else if (localX < -edge) cellsX = Math.floor(localX + edge);
      if (localZ > edge) cellsZ = Math.floor(localZ - edge);
      else if (localZ < -edge) cellsZ = Math.floor(localZ + edge);
      if (cellsX === 0 && cellsZ === 0) return;
      shiftField(cellsX, cellsZ);
    }
  }

  function sample(x, z) {
    const half = fieldSize * 0.5;
    const localX = x - fieldOriginX;
    const localZ = z - fieldOriginZ;
    if (localX < -half || localX > half || localZ < -half || localZ > half) {
      gradientX = 0;
      gradientZ = 0;
      return 0;
    }
    const gridX = clamp((localX + half) / fieldStep, 0, fieldResolution - 1.001);
    const gridZ = clamp((localZ + half) / fieldStep, 0, fieldResolution - 1.001);
    const x0 = Math.floor(gridX);
    const z0 = Math.floor(gridZ);
    const x1 = Math.min(x0 + 1, fieldResolution - 1);
    const z1 = Math.min(z0 + 1, fieldResolution - 1);
    const leftX = Math.max(0, x0 - 1);
    const rightX = Math.min(fieldResolution - 1, x0 + 1);
    const upZ = Math.max(0, z0 - 1);
    const downZ = Math.min(fieldResolution - 1, z0 + 1);
    const row0 = z0 * fieldResolution;
    const row1 = z1 * fieldResolution;
    gradientX = (fieldMemory[row0 + rightX] - fieldMemory[row0 + leftX]) / Math.max(fieldStep, (rightX - leftX) * fieldStep);
    gradientZ = (fieldMemory[downZ * fieldResolution + x0] - fieldMemory[upZ * fieldResolution + x0]) / Math.max(fieldStep, (downZ - upZ) * fieldStep);
    const tx = gridX - x0;
    const tz = gridZ - z0;
    const top = fieldMemory[row0 + x0] + (fieldMemory[row0 + x1] - fieldMemory[row0 + x0]) * tx;
    const bottom = fieldMemory[row1 + x0] + (fieldMemory[row1 + x1] - fieldMemory[row1 + x0]) * tx;
    return top + (bottom - top) * tz;
  }

  function stampSegment(start, end, factor) {
    const segmentX = end.x - start.x;
    const segmentZ = end.z - start.z;
    const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
    if (lengthSquared < 0.0001) return;
    const width = Math.max(0.28, (start.width + end.width) * 0.5);
    const radius = width * 2.7 + 0.22;
    const half = fieldSize * 0.5;
    const startX = start.x - fieldOriginX;
    const startZ = start.z - fieldOriginZ;
    const endX = end.x - fieldOriginX;
    const endZ = end.z - fieldOriginZ;
    const gridMinimumX = clamp(Math.floor((Math.max(-half, Math.min(startX, endX) - radius) + half) / fieldStep), 0, fieldResolution - 1);
    const gridMaximumX = clamp(Math.ceil((Math.min(half, Math.max(startX, endX) + radius) + half) / fieldStep), 0, fieldResolution - 1);
    const gridMinimumZ = clamp(Math.floor((Math.max(-half, Math.min(startZ, endZ) - radius) + half) / fieldStep), 0, fieldResolution - 1);
    const gridMaximumZ = clamp(Math.ceil((Math.min(half, Math.max(startZ, endZ) + radius) + half) / fieldStep), 0, fieldResolution - 1);
    const inverseLengthSquared = 1 / lengthSquared;
    const amplitude = (start.impulse + end.impulse) * 0.5 * (start.decay + end.decay) * 0.5;

    for (let gridZ = gridMinimumZ; gridZ <= gridMaximumZ; gridZ += 1) {
      const z = -half + (gridZ + 0.5) * fieldStep;
      for (let gridX = gridMinimumX; gridX <= gridMaximumX; gridX += 1) {
        const x = -half + (gridX + 0.5) * fieldStep;
        const offsetX = x - startX;
        const offsetZ = z - startZ;
        const projection = clamp((offsetX * segmentX + offsetZ * segmentZ) * inverseLengthSquared, 0, 1);
        const closestX = offsetX - segmentX * projection;
        const closestZ = offsetZ - segmentZ * projection;
        const distanceSquared = closestX * closestX + closestZ * closestZ;
        if (distanceSquared > radius * radius) continue;
        const signedSide = Math.tanh((segmentX * closestZ - segmentZ * closestX) / Math.max(0.08, width * 0.58));
        const profile = Math.exp(-distanceSquared / (width * width));
        fieldTarget[gridZ * fieldResolution + gridX] += amplitude * profile * signedSide * factor;
      }
    }
  }

  function depositWake(x, z, speed, minimumSpeed, lastAt, now) {
    if (now - lastAt < 0.12 || speed < minimumSpeed) return false;
    const radius = 1.1 + Math.min(0.8, speed * 0.035);
    const amplitude = clamp(speed * 0.0025, 0.004, 0.025);
    const half = fieldSize * 0.5;
    const localX = x - fieldOriginX;
    const localZ = z - fieldOriginZ;
    const gridMinimumX = clamp(Math.floor((localX - radius + half) / fieldStep), 0, fieldResolution - 1);
    const gridMaximumX = clamp(Math.ceil((localX + radius + half) / fieldStep), 0, fieldResolution - 1);
    const gridMinimumZ = clamp(Math.floor((localZ - radius + half) / fieldStep), 0, fieldResolution - 1);
    const gridMaximumZ = clamp(Math.ceil((localZ + radius + half) / fieldStep), 0, fieldResolution - 1);
    for (let gridZ = gridMinimumZ; gridZ <= gridMaximumZ; gridZ += 1) {
      const sampleZ = -half + (gridZ + 0.5) * fieldStep;
      for (let gridX = gridMinimumX; gridX <= gridMaximumX; gridX += 1) {
        const sampleX = -half + (gridX + 0.5) * fieldStep;
        const distance = Math.hypot(sampleX - localX, sampleZ - localZ);
        if (distance > radius) continue;
        const fieldIndex = gridZ * fieldResolution + gridX;
        fieldMemory[fieldIndex] = clamp(fieldMemory[fieldIndex] - amplitude * (1 - distance / radius), -0.72, 0.72);
      }
    }
    return true;
  }

  function clearTarget() {
    fieldTarget.fill(0);
  }

  function relax(delta) {
    const damping = Math.exp(-6.4 * delta);
    for (let index = 0; index < fieldMemory.length; index += 1) {
      const target = clamp(fieldTarget[index], -0.72, 0.72);
      const nextVelocity = (fieldVelocity[index] + (target - fieldMemory[index]) * 54 * delta) * damping;
      fieldVelocity[index] = nextVelocity;
      fieldMemory[index] += nextVelocity * delta;
    }
  }

  function clearField() {
    fieldTarget.fill(0);
    fieldMemory.fill(0);
    fieldVelocity.fill(0);
  }

  function update(delta, state) {
    const motion = state.reducedMotion ? 0.32 : 1;
    const safeX = Number.isFinite(state.originX) ? state.originX : 0;
    const safeZ = Number.isFinite(state.originZ) ? state.originZ : 0;
    recentre(safeX, safeZ);
    mesh.position.x = safeX;
    mesh.position.z = safeZ;
    farMesh.position.x = safeX;
    farMesh.position.z = safeZ;
    const out = geometry.attributes.position.array;
    const damping = Math.exp(-8.4 * delta);
    const ambientGain = motion * (1 + state.motionEnergy * 0.72);
    const offsetX = Number.isFinite(state.originX) ? state.originX : 0;
    const offsetZ = Number.isFinite(state.originZ) ? state.originZ : 0;
    const phase0 = state.sceneTime * swellRate[0] + swellAxisX[0] * offsetX + swellAxisZ[0] * offsetZ;
    const phase1 = state.sceneTime * swellRate[1] + swellAxisX[1] * offsetX + swellAxisZ[1] * offsetZ;
    const phase2 = state.sceneTime * swellRate[2] + swellAxisX[2] * offsetX + swellAxisZ[2] * offsetZ;
    const phase3 = state.sceneTime * swellRate[3] + swellAxisX[3] * offsetX + swellAxisZ[3] * offsetZ;
    const s0 = Math.sin(phase0);
    const c0 = Math.cos(phase0);
    const s1 = Math.sin(phase1);
    const c1 = Math.cos(phase1);
    const s2 = Math.sin(phase2);
    const c2 = Math.cos(phase2);
    const s3 = Math.sin(phase3);
    const c3 = Math.cos(phase3);

    for (let index = 0; index < vertexCount; index += 1) {
      const positionIndex = index * 3;
      const tableIndex = index * swellTerms;
      const x = base[positionIndex];
      const z = base[positionIndex + 2];
      const ambient = (
        (swellSpace[tableIndex] * c0 + swellCos[tableIndex] * s0) * swellGain[0] +
        (swellSpace[tableIndex + 1] * c1 + swellCos[tableIndex + 1] * s1) * swellGain[1] +
        (swellSpace[tableIndex + 2] * c2 + swellCos[tableIndex + 2] * s2) * swellGain[2] +
        (swellSpace[tableIndex + 3] * c3 + swellCos[tableIndex + 3] * s3) * swellGain[3]
      ) * ambientGain;
      const hinge = sample(x + offsetX, z + offsetZ);
      const lateralScale = 0.16 + Math.abs(hinge) * 0.62;
      const displacedX = x + clamp(gradientX * lateralScale, -0.3, 0.3);
      const displacedZ = z + clamp(gradientZ * lateralScale, -0.3, 0.3);
      const target = ambient + hinge * 1.45;
      const directionalShade = clamp(hinge * 0.9 - gradientX * 0.22 + gradientZ * 0.14, -0.55, 0.75);
      const shadeFactor = 1 + directionalShade;
      const highlight = clamp(directionalShade * 0.16, -0.06, 0.12);
      colorsOut[positionIndex] = clamp(baseColors[positionIndex] * shadeFactor + highlight, 0, 1);
      colorsOut[positionIndex + 1] = clamp(baseColors[positionIndex + 1] * shadeFactor + highlight * 0.8, 0, 1);
      colorsOut[positionIndex + 2] = clamp(baseColors[positionIndex + 2] * shadeFactor, 0, 1);
      const nextVelocity = (velocity[index] + (target - displacement[index]) * 76 * delta) * damping;
      velocity[index] = nextVelocity;
      displacement[index] += nextVelocity * delta;
      out[positionIndex] = displacedX;
      out[positionIndex + 1] = displacement[index];
      out[positionIndex + 2] = displacedZ;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }

  return {
    mesh,
    farMesh,
    farGeometry,
    maximumRadius,
    geometry,
    sample,
    stampSegment,
    depositWake,
    clearTarget,
    relax,
    clearField,
    recentre,
    update,
    get originX() { return fieldOriginX; },
    get originZ() { return fieldOriginZ; }
  };
}