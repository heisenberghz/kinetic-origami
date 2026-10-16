export const regions = [
  { id: "cathedral", name: "Folded Cathedral", x: -14, z: -20, radius: 11.8 },
  { id: "lagoon", name: "Lotus Lagoon", x: -30, z: 6, radius: 10.4 },
  { id: "shoals", name: "Windbreak Shoals", x: 28, z: 18, radius: 10.9 },
  { id: "terraces", name: "The Terraces", x: 2, z: -40, radius: 9 },
  { id: "archive", name: "The Archive", x: -6, z: 50, radius: 7 },
  { id: "kiln", name: "The Kiln", x: 44, z: -26, radius: 6 }
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
  [-6.74, -20, 0.5, 0], [-5.39, -19.7, 0.5, 1],
  [-5.06, -18.54, 0.62, 2], [-6.85, -18.75, 0.5, 0],
  [-20.84, 6, 0.5, 1], [-20.78, 7.28, 0.5, 2],
  [-20.95, 8.46, 0.62, 0], [-21.55, 9.72, 0.5, 1],
  [37.75, 18, 0.5, 2], [37.95, 19.03, 0.5, 0],
  [37.76, 20.17, 0.56, 1], [37.17, 21.3, 0.5, 2],
  [-44, -8, 0.46, 0], [-2, -46, 0.46, 1],
  [-8, -34, 0.5, 0], [8, -30, 0.5, 1],
  [0, 46, 0.5, 0], [-10, 44, 0.5, 1],
  [46, -22, 0.5, 0], [40, -34, 0.5, 1],
  [6, 42, 0.46, 2], [49.83, -17.69, 0.54, 0],
  [26, 46, 0.46, 1], [-46.42, 22.47, 0.62, 2],
  [12, -16, 0.46, 0], [-22, 46, 0.46, 1],
  [48.34, 21.46, 0.7, 2], [-32, -32, 0.46, 0],
  [-48, -20, 0.46, 1], [32.88, -41.52, 0.54, 2]
];

export const lotusSpecs = [
  [-27.8, 0.1, 6.93, 0.16], [-27.15, 0.1, 8.86, 0.25],
  [-29.31, 0.1, 8.29, 0.16], [-30.39, 0.1, 10.02, 0.25],
  [-31.33, 0.1, 7.99, 0.16], [-46.5, 0.11, 16, 0.1],
  [-4.5, 0.11, -46, 0.1], [19.5, 0.11, 42, 0.1],
  [47.5, 0.11, -10, 0.1], [-18.5, 0.11, 36, 0.1],
  [9.5, 0.11, 20, 0.1], [-38.5, 0.11, -34, 0.1]
];

export const craneSpecs = [
  [-12.11, 5.5, -20], [-11.48, 6.6, -19.97],
  [-10.85, 7.7, -19.93], [-10.22, 5.5, -19.87],
  [-27.12, 5.5, 6], [-26.15, 6.6, 6.04],
  [-25.19, 7.7, 6.11], [-24.24, 5.5, 6.2],
  [31.07, 5.5, 18], [32.09, 6.6, 18.05],
  [33.12, 7.7, 18.12], [34.14, 5.5, 18.21],
  [2.4, 4, -39], [1.6, 6, -38], [3.2, 5, -41],
  [-5.4, 3, 47], [-7.2, 4, 51], [-4.6, 3.5, 53],
  [44.6, 4, -24], [42.8, 5, -28], [45.4, 3, -30]
];

export const foregroundSailSpecs = [
  [-39, 0, 24, 0.3, 1.15, -0.3],
  [43, 0, 32, 0.3, 1.15, 0.1],
  [13, 0, 34, 0.3, 1.15, 0.3],
  [-11, 0, -36, 0.3, 1.15, -0.3],
  [52.94, 0, -9.05, 0.3, 1.95, 0.2]
];

export const paperSpanPath = {
  start: [-46, -4],
  end: [22, 28],
  count: 12
};

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
