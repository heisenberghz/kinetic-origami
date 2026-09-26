const TAU = Math.PI * 2;

export function createAtmosphere({ THREE, scene, qualityTier, moods, fleckTexture, seededRandom }) {
  const particleCount = qualityTier === "light" ? 140 : 260;
  const particleBase = new Float32Array(particleCount * 3);
  const particlePhases = new Float32Array(particleCount);
  const particlePositions = new Float32Array(particleCount * 3);
  const particleGeometry = new THREE.BufferGeometry();
  const ribbons = [];

  function createParticles() {
    const colors = new Float32Array(particleCount * 3);
    const random = seededRandom(60817);
    const color = new THREE.Color();

    for (let index = 0; index < particleCount; index += 1) {
      const radius = 4 + random() * 14;
      const angle = random() * TAU;
      const x = Math.cos(angle) * radius;
      const y = 0.7 + random() * 8.2;
      const z = Math.sin(angle) * radius;
      particleBase[index * 3] = x;
      particleBase[index * 3 + 1] = y;
      particleBase[index * 3 + 2] = z;
      particlePhases[index] = random() * TAU;
      particlePositions[index * 3] = x;
      particlePositions[index * 3 + 1] = y;
      particlePositions[index * 3 + 2] = z;
      const warmth = 0.72 + random() * 0.28;
      color.setRGB(warmth, warmth * 0.9, warmth * 0.72);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }

    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage));
    particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      color: moods.dawn.particles,
      map: fleckTexture,
      size: 0.16,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      alphaTest: 0.08,
      depthWrite: false,
      vertexColors: true
    });
    scene.add(new THREE.Points(particleGeometry, material));
    return material;
  }

  const particleMaterial = createParticles();

  function createRibbon(dayColor, nightColor, phase, position, rotation) {
    const segments = qualityTier === "light" ? 40 : 56;
    const positions = new Float32Array((segments + 1) * 2 * 3);
    const indices = [];
    for (let segment = 0; segment < segments; segment += 1) {
      const current = segment * 2;
      const next = current + 2;
      indices.push(current, next, current + 1, current + 1, next, current + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(indices);
    const material = new THREE.MeshBasicMaterial({ color: dayColor, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide });
    material.forceSinglePass = true;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    scene.add(mesh);
    const state = {
      mesh,
      geometry,
      material,
      positions,
      segments,
      phase,
      day: new THREE.Color(dayColor),
      night: new THREE.Color(nightColor)
    };
    ribbons.push(state);
    return state;
  }

  createRibbon("#b88a32", "#d7ac57", 0.2, [-2.2, 4.3, -1.5], [0.08, -0.42, -0.12]);
  createRibbon("#c94b32", "#e15a3d", 2.1, [1.2, 5.4, -4.8], [-0.1, 0.35, 0.16]);
  createRibbon("#24475c", "#6e93a5", 4.4, [2.4, 3.8, 3.1], [0.12, 0.18, -0.08]);

  function applyMood(activeMood, blend) {
    particleMaterial.color.lerp(moods[activeMood].particles, blend);
    for (let index = 0; index < ribbons.length; index += 1) {
      ribbons[index].material.color.lerp(activeMood === "dawn" ? ribbons[index].day : ribbons[index].night, blend);
    }
  }

  function updateParticles(sceneTime, motion) {
    for (let index = 0; index < particleCount; index += 1) {
      const positionIndex = index * 3;
      const phase = particlePhases[index];
      particlePositions[positionIndex] = particleBase[positionIndex] + Math.sin(sceneTime * 0.17 + phase) * 0.52 * motion;
      particlePositions[positionIndex + 1] = particleBase[positionIndex + 1] + Math.sin(sceneTime * 0.31 + phase * 1.7) * 0.42 * motion;
      particlePositions[positionIndex + 2] = particleBase[positionIndex + 2] + Math.cos(sceneTime * 0.14 + phase) * 0.48 * motion;
    }
    particleGeometry.attributes.position.needsUpdate = true;
  }

  function updateRibbons(sceneTime, motion) {
    for (let index = 0; index < ribbons.length; index += 1) {
      const ribbon = ribbons[index];
      for (let segment = 0; segment <= ribbon.segments; segment += 1) {
        const u = segment / ribbon.segments;
        const x = (u - 0.5) * 12.5;
        const centerY = Math.sin(u * TAU * 1.15 + sceneTime * 0.26 + ribbon.phase) * 0.58 * motion + (u - 0.5) * 1.25;
        const centerZ = Math.cos(u * TAU * 0.82 + sceneTime * 0.19 + ribbon.phase) * 0.64 * motion;
        const width = 0.035 + Math.sin(u * Math.PI) * 0.095;
        const twist = u * TAU * 0.7 + sceneTime * 0.18;
        const offsetY = Math.cos(twist) * width;
        const offsetZ = Math.sin(twist) * width;
        const positionIndex = segment * 6;
        ribbon.positions[positionIndex] = x;
        ribbon.positions[positionIndex + 1] = centerY + offsetY;
        ribbon.positions[positionIndex + 2] = centerZ + offsetZ;
        ribbon.positions[positionIndex + 3] = x;
        ribbon.positions[positionIndex + 4] = centerY - offsetY;
        ribbon.positions[positionIndex + 5] = centerZ - offsetZ;
      }
      ribbon.geometry.attributes.position.needsUpdate = true;
      ribbon.mesh.rotation.z = Math.sin(sceneTime * 0.17 + ribbon.phase) * 0.06 * motion;
    }
  }

  function update(sceneTime, options) {
    updateParticles(sceneTime, options.reducedMotion ? 0.18 : 1 + options.motionEnergy * 0.72 + options.foldEnergy * 0.35);
    updateRibbons(sceneTime, options.reducedMotion ? 0.15 : 1 + options.motionEnergy * 1.15);
  }

  return { particleCount, particleMaterial, ribbons, applyMood, update };
}
