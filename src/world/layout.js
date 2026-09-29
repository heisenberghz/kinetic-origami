export const regions = [
  { id: "cathedral", name: "Folded Cathedral", x: -4, z: -8.6, radius: 5 },
  { id: "lagoon", name: "Lotus Lagoon", x: -9.6, z: 4.4, radius: 4.4 },
  { id: "shoals", name: "Windbreak Shoals", x: 8.6, z: 3.6, radius: 4.6 }
];

export function regionAt(x, z) {
  for (let index = 0; index < regions.length; index += 1) {
    const region = regions[index];
    const offsetX = x - region.x;
    const offsetZ = z - region.z;
    if (offsetX * offsetX + offsetZ * offsetZ <= region.radius * region.radius) return region;
  }
  return null;
}

export const islandSpecs = [
  [-1.6, -6.0, 0.62, 2], [-6.6, -5.6, 0.5, 1], [0.6, -9.4, 0.55, 0],
  [-13.0, 2.2, 0.6, 1], [-5.8, 7.0, 0.52, 0], [-11.8, 8.2, 0.44, 2],
  [12.0, 0.8, 0.58, 2], [5.6, 6.8, 0.5, 0], [12.4, 6.0, 0.42, 1],
  [0.0, 6.5, 0.62, 1], [-2.0, 0.0, 0.7, 0],
  [2.5, 9.0, 0.66, 2], [-2.0, 11.0, 0.5, 1]
];

export const lotusSpecs = [
  [-8.47, 0.1, 5.53, 0.62], [-10.73, 0.08, 5.53, 0.3],
  [-10.73, 0.11, 3.27, 0.2], [-8.47, 0.1, 3.27, 0.28],
  [2.0, 0.1, -5.0, 0.3], [7.0, 0.1, -6.0, 0.16], [-1.0, 0.1, 8.5, 0.12], [5.0, 0.11, 9.5, 0.14]
];

export const craneSpecs = [
  [-1.6, 5.6, -6.4], [-6.4, 6.2, -7.0], [-4.6, 5.0, -11.2], [-7.6, 6.6, -10.4],
  [-7.4, 5.0, 2.6], [-11.8, 5.4, 4.0], [-10.2, 4.6, 7.2], [-12.0, 5.8, 6.2],
  [6.2, 4.8, 1.6], [10.8, 5.2, 2.2], [9.4, 4.4, 6.4], [11.8, 6.0, 5.6]
];

export const foregroundSailSpecs = [
  [-7.4, 0, 10.4, 0.48, 1.9, -0.32],
  [8.6, 0, 9.8, -0.42, 1.75, 0.28]
];

export const planRadii = {
  island: 1.044,
  lotus: 1,
  sail: 1.5
};

export const cameraLimits = {
  smallestDefaultRadius: 18.5,
  minZoomRadius: 8.2,
  maxZoomRadius: 25.5,
  oceanRadius: 23.5,
  landmarkClearance: 0.6,
  minPhi: 0.48,
  maxPhi: 1.39,
  targetY: 0.52
};

export function pushOutOfLandmarks(x, z, cameraY, metrics, out) {
  out.x = x;
  out.z = z;
  for (let index = 0; index < regions.length; index += 1) {
    const region = regions[index];
    const metric = metrics[region.id];
    if (cameraY >= metric.height) continue;
    const limit = metric.planRadius + cameraLimits.landmarkClearance;
    const offsetX = out.x - region.x;
    const offsetZ = out.z - region.z;
    const distanceSquared = offsetX * offsetX + offsetZ * offsetZ;
    if (distanceSquared >= limit * limit || distanceSquared < 1e-6) continue;
    const distance = Math.sqrt(distanceSquared);
    out.x = region.x + (offsetX / distance) * limit;
    out.z = region.z + (offsetZ / distance) * limit;
  }
  return out;
}

export const islandCount = islandSpecs.length;
export const lotusCount = lotusSpecs.length;
export const craneCount = craneSpecs.length;
export const foregroundSailCount = foregroundSailSpecs.length;
