export const regions = [
  { id: "cathedral", name: "Folded Cathedral", x: -14, z: -20, radius: 5 },
  { id: "lagoon", name: "Lotus Lagoon", x: -30, z: 6, radius: 4.4 },
  { id: "shoals", name: "Windbreak Shoals", x: 28, z: 18, radius: 4.6 }
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
  [-10.47, -20, 0.5, 0], [-10.12, -18.81, 0.5, 1],
  [-10.86, -18.03, 0.5, 2], [-11.28, -16.99, 0.56, 0],
  [-25.76, 6, 0.5, 1], [-25.91, 7.11, 0.5, 2],
  [-26.33, 8.14, 0.5, 0], [-27.02, 9.02, 0.5, 1],
  [32.48, 18, 0.5, 2], [32.32, 19.17, 0.5, 0],
  [31.86, 20.25, 0.5, 1], [31.15, 21.19, 0.5, 2],
  [-44.6, -6, 0.44, 0], [-3, -43.87, 0.51, 1],
  [3.4, 40, 0.44, 2], [45.4, -26, 0.44, 0],
  [21.4, 44, 0.44, 1], [-49, 20.13, 0.51, 2],
  [9.4, -14, 0.44, 0], [-22.6, 44, 0.44, 1],
  [53.4, 6, 0.44, 2], [-32.6, -30, 0.44, 0]
];

export const lotusSpecs = [
  [-28.75, 0.1, 6.53, 0.2], [-30.45, 0.1, 7.59, 0.2],
  [-31.65, 0.1, 5.94, 0.36], [-30.32, 0.1, 4.38, 0.2],
  [-46.8, 0.11, 14, 0.1], [-4.8, 0.11, -44, 0.1],
  [17.2, 0.11, 40, 0.1], [45.2, 0.11, -8, 0.1],
  [-18.8, 0.11, 34, 0.1], [7.2, 0.11, 18, 0.1]
];

export const craneSpecs = [
  [-12.88, 4.6, -20], [-12.68, 5.2, -19.98],
  [-12.49, 5.8, -19.96], [-12.29, 4.6, -19.93],
  [-28.39, 4.6, 6], [-28.1, 5.2, 6.03],
  [-27.82, 5.8, 6.06], [-27.54, 4.6, 6.1],
  [29.71, 4.6, 18], [30, 5.2, 18.03],
  [30.3, 5.8, 18.07], [30.6, 4.6, 18.11]
];

export const foregroundSailSpecs = [
  [-38, 0, 22, 0.3, 1.1, -0.3],
  [40, 0, 30, 0.3, 1.1, 0],
  [8, 0, 30, 0.3, 1.1, 0.3],
  [-10, 0, -34, 0.3, 1.1, -0.3]
];

export const planRadii = {
  island: 1.044,
  lotus: 1,
  sail: 1.5
};

export const cameraLimits = {
  playableRadius: 58,
  oceanRadius: 75,
  landmarkClearance: 0.6,
  hoverHeight: 1.2
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
