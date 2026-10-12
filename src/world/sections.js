export const sectionLimits = {
  maxFullDetail: 2,
  visibleRadius: 74,
  fullDetailRadius: 58
};

function distance(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

export function buildSectionSpecs(regions, limits = sectionLimits) {
  return regions.map((region) => ({
    id: region.id,
    name: region.name,
    x: region.x,
    z: region.z,
    visibleRadius: limits.visibleRadius,
    fullDetailRadius: limits.fullDetailRadius
  }));
}

export function createSections({ specs, limits = sectionLimits }) {
  const visible = new Set();
  const fullDetail = new Set();
  let lastPosition = { x: 0, z: 0 };

  function update(x, z) {
    lastPosition.x = x;
    lastPosition.z = z;
    const ordered = specs
      .map((spec) => ({ spec, gap: distance(x, z, spec.x, spec.z) }))
      .sort((a, b) => a.gap - b.gap || (a.spec.id < b.spec.id ? -1 : 1));

    for (const { spec, gap } of ordered) {
      if (visible.has(spec.id) && gap <= spec.visibleRadius) continue;
      visible.delete(spec.id);
      fullDetail.delete(spec.id);
    }

    for (const { spec, gap } of ordered) {
      if (gap <= spec.visibleRadius) visible.add(spec.id);
    }

    fullDetail.clear();
    for (const { spec, gap } of ordered) {
      if (fullDetail.size >= limits.maxFullDetail) break;
      if (gap <= spec.fullDetailRadius) fullDetail.add(spec.id);
    }

    return visible;
  }

  function forceAll() {
    visible.clear();
    fullDetail.clear();
    for (const spec of specs) visible.add(spec.id);
    for (const spec of specs.slice(0, limits.maxFullDetail)) fullDetail.add(spec.id);
    return visible;
  }

  function reset() {
    visible.clear();
    fullDetail.clear();
    update(0, 0);
    return visible;
  }

  return {
    specs,
    limits,
    update,
    reset,
    forceAll,
    isVisible: (id) => visible.has(id),
    isActive: (id) => fullDetail.has(id),
    get activeIds() {
      return [...fullDetail];
    },
    get visibleIds() {
      return [...visible];
    },
    get position() {
      return lastPosition;
    },
    get count() {
      return fullDetail.size;
    },
    get visibleCount() {
      return visible.size;
    }
  };
}

export function sectionDetailAt(sections, id) {
  if (sections.isActive(id)) return "full";
  if (sections.isVisible(id)) return "reduced";
  return "dormant";
}
