const TAU = Math.PI * 2;

export const backdropRadii = [28.5, 32, 35.5];

const ringSpecs = [
  {
    day: "#a18a67",
    night: "#132530",
    drift: 0.0042,
    bands: [
      { radius: 28.5, crest: 4.6, phase: 0.4, segments: 132 },
      { radius: 30.4, crest: 3.1, phase: 2.6, segments: 116 }
    ]
  },
  {
    day: "#b1966d",
    night: "#10232f",
    drift: -0.0026,
    bands: [
      { radius: 32, crest: 6.4, phase: 1.9, segments: 124 },
      { radius: 33.9, crest: 4.2, phase: 4.2, segments: 104 }
    ]
  },
  {
    day: "#bc9e72",
    night: "#0f212e",
    drift: 0.0015,
    bands: [
      { radius: 35.5, crest: 8.4, phase: 3.3, segments: 116 },
      { radius: 37.3, crest: 5.4, phase: 5.7, segments: 96 }
    ]
  }
];

const floorY = -0.7;

function crestHeight(angle, band) {
  const wobble = Math.sin(angle * 9 + band.phase) * 0.5
    + Math.sin(angle * 19 - band.phase * 1.4) * 0.3
    + Math.sin(angle * 37 + band.phase * 0.6) * 0.15
    + Math.sin(angle * 61 + band.phase * 2.1) * 0.08;
  return Math.max(0.12, band.crest * (0.5 + wobble * 0.5));
}

function ridgeGeometry(THREE, bands) {
  const positions = [];
  const indices = [];
  let offset = 0;

  for (const band of bands) {
    for (let index = 0; index <= band.segments; index += 1) {
      const angle = (index / band.segments) * TAU;
      const top = crestHeight(angle, band);
      positions.push(Math.cos(angle) * band.radius, floorY, Math.sin(angle) * band.radius);
      positions.push(Math.cos(angle) * band.radius, top, Math.sin(angle) * band.radius);
    }
    for (let index = 0; index < band.segments; index += 1) {
      const current = offset + index * 2;
      indices.push(current, current + 1, current + 2, current + 1, current + 3, current + 2);
    }
    offset += (band.segments + 1) * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createBackdrop({ THREE, scene }) {
  const rings = [];

  for (let index = 0; index < ringSpecs.length; index += 1) {
    const spec = ringSpecs[index];
    const material = new THREE.MeshBasicMaterial({ color: spec.day, side: THREE.DoubleSide, fog: false, toneMapped: false });
    const mesh = new THREE.Mesh(ridgeGeometry(THREE, spec.bands), material);
    mesh.renderOrder = -3;
    mesh.frustumCulled = false;
    scene.add(mesh);
    rings.push({ mesh, material, drift: spec.drift, day: new THREE.Color(spec.day), night: new THREE.Color(spec.night) });
  }

  function applyMood(activeMood, blend) {
    for (let index = 0; index < rings.length; index += 1) {
      rings[index].material.color.lerp(activeMood === "dawn" ? rings[index].day : rings[index].night, blend);
    }
  }

  function update(sceneTime) {
    for (let index = 0; index < rings.length; index += 1) {
      rings[index].mesh.rotation.y = sceneTime * rings[index].drift;
    }
  }

  return { rings, applyMood, update };
}
