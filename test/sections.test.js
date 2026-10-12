import test from "node:test";
import assert from "node:assert/strict";
import { regions } from "../src/world/layout.js";
import { buildSectionSpecs, createSections, sectionLimits, sectionDetailAt } from "../src/world/sections.js";

function makeSections(limitOverrides = {}) {
  return createSections({ specs: buildSectionSpecs(regions), limits: { ...sectionLimits, ...limitOverrides } });
}

function walk(sections, from, to, step = 0.5) {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / step));
  let worstCount = 0;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    sections.update(x, z);
    worstCount = Math.max(worstCount, sections.count);
  }
  return worstCount;
}

test("no more than two sections are ever active, anywhere on the map", () => {
  const sections = makeSections();
  const probes = [];
  for (let degrees = 0; degrees < 360; degrees += 15) {
    for (const radius of [0, 20, 40, 58, 70, 90]) {
      probes.push({ x: Math.sin((degrees / 180) * Math.PI) * radius, z: Math.cos((degrees / 180) * Math.PI) * radius });
    }
  }
  for (const district of regions) probes.push({ x: district.x, z: district.z });
  let worst = 0;
  for (const probe of probes) {
    sections.update(probe.x, probe.z);
    assert.ok(sections.count <= 2, `${sections.count} sections active at (${probe.x.toFixed(1)}, ${probe.z.toFixed(1)})`);
    worst = Math.max(worst, sections.count);
  }
  assert.ok(worst >= 2, "the cap was never actually reached, so this proves nothing");
});

test("a district the presence is standing in is always active", () => {
  const sections = makeSections();
  for (const district of regions) {
    sections.update(district.x, district.z);
    assert.ok(sections.isActive(district.id), `${district.id} deactivated while the presence stood in it`);
  }
});

test("the nearest district is always active when the cap allows", () => {
  const sections = makeSections();
  for (const district of regions) {
    sections.update(district.x, district.z);
    const nearest = [...regions].sort(
      (a, b) => Math.hypot(a.x - district.x, a.z - district.z) - Math.hypot(b.x - district.x, b.z - district.z)
    )[0];
    assert.ok(sections.isActive(nearest.id), `standing in ${district.id} but ${nearest.id}, the nearest, was dormant`);
  }
});

test("a section crossing its visibility boundary changes state exactly once", () => {
  const sections = makeSections();
  const lagoon = regions.find((entry) => entry.id === "lagoon");
  const start = { x: lagoon.x - sectionLimits.visibleRadius - 6, z: lagoon.z };
  let transitions = 0;
  let wasVisible = false;
  const steps = 200;
  for (let index = 0; index <= steps; index += 1) {
    const x = start.x + ((sectionLimits.visibleRadius + 10) / steps) * index;
    sections.update(x, lagoon.z);
    const visible = sections.isVisible("lagoon");
    if (visible !== wasVisible) transitions += 1;
    wasVisible = visible;
  }
  assert.ok(wasVisible, "the lagoon never became visible on the way in");
  assert.ok(transitions <= 2, `the lagoon changed visibility ${transitions} times on a single straight approach, which reads as a flicker`);
});

test("the full detail set is stable frame to frame while standing still", () => {
  const sections = makeSections();
  sections.update(2, -3);
  const first = sections.activeIds.slice().sort().join(",");
  let changes = 0;
  for (let frame = 0; frame < 600; frame += 1) {
    sections.update(2, -3);
    if (sections.activeIds.slice().sort().join(",") !== first) changes += 1;
  }
  assert.ok(changes === 0, `the full detail set changed ${changes} times over 600 identical frames`);
});

test("every district in view stays visible even when only two get full detail", () => {
  const sections = makeSections();
  for (const district of regions) {
    sections.update(district.x, district.z);
    for (const other of regions) {
      const gap = Math.hypot(other.x - district.x, other.z - district.z);
      if (gap <= sectionLimits.visibleRadius) {
        assert.ok(sections.isVisible(other.id), `${other.id} vanished from ${district.id} at ${gap.toFixed(1)} units, inside the visibility radius`);
      }
    }
    assert.ok(sections.count <= 2, `standing in ${district.id} gave ${sections.count} full detail sections`);
  }
});

test("a section stays visible until it is past the wider release radius", () => {
  const sections = makeSections();
  const lagoon = regions.find((entry) => entry.id === "lagoon");
  sections.update(lagoon.x, lagoon.z);
  assert.ok(sections.isVisible("lagoon"));
  const inside = sectionLimits.fullDetailRadius + 2;
  sections.update(lagoon.x + inside, lagoon.z);
  assert.ok(sections.isVisible("lagoon"), `the lagoon vanished at ${inside} units, inside the ${sectionLimits.visibleRadius} visibility radius`);
  const outside = sectionLimits.visibleRadius + 4;
  sections.update(lagoon.x + outside, lagoon.z);
  assert.ok(!sections.isVisible("lagoon"), `the lagoon stayed visible at ${outside} units, past the ${sectionLimits.visibleRadius} release radius`);
});

test("crossing the whole map never breaks the cap", () => {
  const sections = makeSections();
  const route = [
    { x: 0, z: 0 }, { x: -14, z: -20 }, { x: -30, z: 6 }, { x: 28, z: 18 },
    { x: -58, z: 0 }, { x: 0, z: 58 }, { x: 58, z: 0 }, { x: 0, z: -58 }, { x: 0, z: 0 }
  ];
  let worst = 0;
  for (let index = 1; index < route.length; index += 1) {
    worst = Math.max(worst, walk(sections, route[index - 1], route[index]));
  }
  assert.ok(worst <= 2, `the cap broke while crossing the map, reaching ${worst}`);
});

test("every section reports full, reduced, or dormant detail", () => {
  const sections = makeSections();
  sections.update(0, 0);
  const states = sections.specs.map((spec) => sectionDetailAt(sections, spec.id));
  assert.ok(states.every((value) => value === "full" || value === "reduced" || value === "dormant"), `unexpected detail states: ${states.join(", ")}`);
  assert.ok(states.includes("full"), "no section reached full detail from the origin");
  assert.ok(sections.visibleCount >= 3, `only ${sections.visibleCount} districts were visible from the origin, expected all 3`);
  sections.update(0, 0);
  const counts = { full: 0, reduced: 0, dormant: 0 };
  for (const state of states) counts[state] += 1;
  assert.ok(counts.full <= sectionLimits.maxFullDetail, `${counts.full} sections at full detail, over the budget`);
});

test("every district becomes a section spec at its real position", () => {
  const specs = buildSectionSpecs(regions);
  assert.equal(specs.length, regions.length);
  for (const region of regions) {
    const spec = specs.find((entry) => entry.id === region.id);
    assert.ok(spec, `${region.id} has no section spec`);
    assert.equal(spec.x, region.x);
    assert.equal(spec.z, region.z);
    assert.ok(spec.visibleRadius > spec.fullDetailRadius, `${region.id} loses full detail before it loses visibility`);
  }
});

test("reset returns the sections to what the origin can see", () => {
  const sections = makeSections();
  sections.update(58, 0);
  sections.reset();
  assert.ok(sections.count <= 2);
  assert.ok(sections.visibleCount >= 1, "reset left every district dormant");
  const nearest = regions.reduce((best, entry) =>
    Math.hypot(entry.x, entry.z) < Math.hypot(best.x, best.z) ? entry : best
  );
  assert.ok(sections.isActive(nearest.id), "reset did not give the nearest district full detail");
});

test("each district appears exactly once in the section specs", () => {
  const specs = buildSectionSpecs(regions);
  const ids = specs.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate section ids: ${ids.join(", ")}`);
});
