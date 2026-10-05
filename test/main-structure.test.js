import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const mainSource = readFileSync(join(projectRoot, "src", "main.js"), "utf8");

function declaredSymbols(source) {
  const symbols = new Set();
  for (const line of source.split("\n")) {
    const declaration = line.match(/^\s*(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/);
    if (declaration) symbols.add(declaration[1]);
    const destructured = line.match(/^\s*(?:const|let)\s*\{([^}]*)\}/);
    if (destructured) {
      for (const part of destructured[1].split(",")) {
        const name = part.trim();
        if (name) symbols.add(name);
      }
    }
  }
  return symbols;
}

const symbols = declaredSymbols(mainSource);

const requiredSystems = {
  lighting: ["hemiLight", "keyLight", "rimLight", "vermilionLight", "focalLight", "ambientLight"],
  sun: ["sunRoot", "sunDisc", "sunHalo", "sunRing", "sunMaterial", "sunHaloMaterial"],
  islands: ["islands", "islandWorld"],
  landmarks: ["landmarks"],
  backdrop: ["horizon", "backdrop"],
  foregroundSails: ["foregroundSails", "sailGeometry"],
  creaseLines: ["creaseLines", "creaseLineGeometry", "creaseLineMaterial", "creaseStrokes", "creaseCursor"],
  ocean: ["oceanWorld", "ocean", "oceanMaterial"]
};

test("every world system still declares its scene objects", () => {
  for (const [system, names] of Object.entries(requiredSystems)) {
    for (const name of names) {
      assert.ok(symbols.has(name), `the ${system} system lost ${name}, which main.js still references`);
    }
  }
});

test("main.js no longer reaches into the extracted ocean internals", () => {
  const movedInternals = [
    "creaseFieldMemory", "creaseFieldVelocity", "creaseFieldTarget", "creaseFieldResolution",
    "creaseFieldSize", "creaseFieldStep", "creaseGradientX", "creaseGradientZ",
    "oceanBase", "oceanBaseColors", "oceanColors", "oceanDisplacement", "oceanVelocity",
    "oceanVertexCount", "oceanSwellRate", "oceanSwellGain", "oceanSwellSpace", "oceanSwellCos",
    "oceanSwellTerms", "oceanGeometry", "createOceanGeometry", "updateOcean", "addCreaseShader"
  ];
  for (const name of movedInternals) {
    const reference = new RegExp(`\\b${name}\\b`);
    assert.ok(!reference.test(mainSource), `${name} moved into ocean.js but is still declared in main.js`);
  }
});

test("main.js drives the ocean only through its public surface", () => {
  const oceanSource = readFileSync(join(projectRoot, "src", "world", "ocean.js"), "utf8");
  const exported = oceanSource.match(/return \{ ([^}]*) \};\s*$/m);
  assert.ok(exported, "ocean.js no longer returns a public surface");
  const surface = new Set(exported[1].split(",").map((name) => name.trim()).filter(Boolean));

  for (const required of ["mesh", "sample", "stampSegment", "depositWake", "clearTarget", "relax", "clearField", "update"]) {
    assert.ok(surface.has(required), `ocean.js stopped exporting ${required}`);
  }

  const used = new Set([...mainSource.matchAll(/oceanWorld\.(\w+)/g)].map((match) => match[1]));
  assert.ok(used.size > 0, "main.js never touches the ocean module");
  for (const member of used) {
    assert.ok(surface.has(member), `main.js calls oceanWorld.${member}, which ocean.js does not export`);
  }
});

test("the crease field is cleared before strokes are stamped into it", () => {
  const clearIndex = mainSource.indexOf("oceanWorld.clearTarget();");
  const stampIndex = mainSource.indexOf("stampCreaseSegment(stroke.points[pointIndex]");
  const relaxIndex = mainSource.indexOf("oceanWorld.relax(delta);");
  assert.ok(clearIndex > 0 && stampIndex > 0 && relaxIndex > 0, "the crease update pipeline is missing a stage");
  assert.ok(clearIndex < stampIndex, "the target is cleared after stamping, so folds never take effect");
  assert.ok(stampIndex < relaxIndex, "strokes are stamped after relaxation, so they take effect a frame late");
});

test("every extracted world module is imported by main.js", () => {
  const modules = ["atmosphere", "backdrop", "harness", "horizon", "islands", "landmarks", "layout", "migration", "ocean"];
  for (const name of modules) {
    assert.match(mainSource, new RegExp(`from "\\./world/${name}\\.js"`), `main.js never imports world/${name}.js`);
  }
});

test("main.js keeps a single import of each world module", () => {
  for (const match of mainSource.matchAll(/from "\.\/world\/([\w]+)\.js"/g)) {
    const name = match[1];
    const count = (mainSource.match(new RegExp(`from "\\./world/${name}\\.js"`, "g")) || []).length;
    assert.equal(count, 1, `world/${name}.js is imported ${count} times`);
  }
});
