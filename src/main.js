import { createLandmarks, regionAt } from "./world/landmarks.js";
import { createHorizon } from "./world/horizon.js";
import { createAtmosphere } from "./world/atmosphere.js";

const loadingScreen = document.querySelector("#loading");
const fallback = document.querySelector("#fallback");
const fallbackMessage = document.querySelector("#fallbackMessage");
const sceneUiSelector = "#stage, .masthead, .controls, .legend, .hint, .plate, .seal, .field-menu";
const setSceneUiEnabled = (enabled) => {
  for (const element of document.querySelectorAll(sceneUiSelector)) element.inert = !enabled;
};
const showFailure = (message) => {
  loadingScreen.hidden = true;
  fallback.hidden = false;
  fallbackMessage.textContent = message;
  setSceneUiEnabled(false);
};
let THREE;
let startupComplete = false;
const importSources = [
  "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
  "https://unpkg.com/three@0.180.0/build/three.module.js"
];
const importWithTimeout = (url, timeout = 4500) => new Promise((resolve, reject) => {
  let settled = false;
  const timer = window.setTimeout(() => {
    if (settled) return;
    settled = true;
    reject(new Error("Three.js import timed out"));
  }, timeout);
  import(url).then((module) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    resolve(module);
  }).catch((error) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    reject(error);
  });
});
window.addEventListener("error", (event) => {
  if (startupComplete) return;
  event.preventDefault();
  showFailure("The paper world could not finish initializing. Reload this page to try again.");
});
window.addEventListener("unhandledrejection", (event) => {
  if (startupComplete) return;
  event.preventDefault();
  showFailure("The paper world could not finish initializing. Reload this page to try again.");
});

try {
  let importError = null;
  for (const source of importSources) {
    try {
      THREE = await importWithTimeout(source);
      break;
    } catch (error) {
      importError = error;
    }
  }
  if (!THREE) throw importError || new Error("Three.js unavailable");
} catch (error) {
  showFailure("The Three.js archive could not be reached. Check the network connection and reload this page.");
  throw error;
}

const TAU = Math.PI * 2;
const stage = document.querySelector("#stage");
const liveStatus = document.querySelector("#liveStatus");
const plateTitle = document.querySelector("#plateTitle");
const cursorSeal = document.querySelector("#cursorSeal");
const motionButton = document.querySelector("#motionButton");
const motionLabel = document.querySelector("#motionLabel");
const fieldMenu = document.querySelector("#fieldMenu");
const moodButtons = [...document.querySelectorAll("button[data-mood]")];
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = motionPreference.matches;
let paused = reducedMotion;
const integratedPixelBudget = 1850000;
const viewportDprLimit = (width, height) => Math.sqrt(integratedPixelBudget / Math.max(1, width * height));
const initialDprLimit = Math.min(1.4, viewportDprLimit(window.innerWidth, window.innerHeight));
const initialDpr = Math.min(window.devicePixelRatio || 1, initialDprLimit);
const useAntialias = (window.devicePixelRatio || 1) <= 1.15 && window.innerWidth * window.innerHeight <= 1600000;
const deviceMemory = Number(navigator.deviceMemory) || 8;
const hardwareConcurrency = Number(navigator.hardwareConcurrency) || 8;
const constrainedMemory = deviceMemory > 0 && deviceMemory <= 4;
const qualityTier = constrainedMemory || hardwareConcurrency <= 4 || window.innerWidth < 760 ? "light" : "full";
let renderer;

try {
  renderer = new THREE.WebGLRenderer({ antialias: useAntialias, alpha: false, powerPreference: "low-power" });
} catch (error) {
  showFailure("This paper world needs WebGL. Please open it in a current browser with hardware acceleration enabled.");
  throw error;
}

const initialQualityMaxDpr = Math.min(window.innerWidth < 760 ? 1.25 : 1.4, initialDprLimit);
const quality = {
  maxDpr: initialQualityMaxDpr,
  minDpr: Math.min(0.8, initialQualityMaxDpr, initialDpr),
  dpr: initialDpr,
  averageFrameMs: 16.7,
  sampleTime: 0
};

renderer.setPixelRatio(quality.dpr);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const canvas = renderer.domElement;
canvas.tabIndex = 0;
canvas.setAttribute("role", "application");
canvas.setAttribute("aria-label", "Interactive origami ocean. Drag with one pointer or one finger to fold paper. Alt-drag or use WASD to pan, Shift-drag or right-drag to orbit, and use two fingers to pinch to zoom. Hover or tap lotus flowers. Press B to open and cycle lotuses, Enter to close the keyboard-selected lotus, Space to pause ambient motion, M for mood, and R to reset.");
stage.appendChild(canvas);

const scene = new THREE.Scene();
const viewProfileFor = (width, height) => {
  const aspect = width / Math.max(1, height);
  const portrait = aspect < 0.72;
  const narrow = aspect >= 0.72 && aspect < 1;
  const short = height < 620;
  const category = portrait ? "portrait" : narrow ? "narrow" : short ? "short" : "wide";
  return {
    category,
    compact: portrait || narrow,
    fov: portrait ? 50 : narrow ? 46 : short ? 42 : 40,
    phi: portrait ? 1.18 : narrow ? 1.16 : short ? 1.12 : 1.15,
    radius: portrait ? 24.5 : narrow ? 22 : short ? 20 : 18.5,
    targetY: portrait ? 0.6 : 0.52
  };
};
const initialViewProfile = viewProfileFor(window.innerWidth, window.innerHeight);
const camera = new THREE.PerspectiveCamera(initialViewProfile.fov, window.innerWidth / window.innerHeight, 0.25, 160);
const cameraTarget = new THREE.Vector3(0, initialViewProfile.targetY, 0);
const panTarget = new THREE.Vector2(0, 0);
const panCurrent = new THREE.Vector2(0, 0);
const previousCameraPosition = new THREE.Vector3();
const pointerNdc = new THREE.Vector2(0, 0);
const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointerWorld = new THREE.Vector3();
const keyboardCursorPoint = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const maxOrbitRadius = 25.5;
let viewProfile = initialViewProfile;
let defaultPhi = initialViewProfile.phi;
let defaultRadius = initialViewProfile.radius;
const orbit = {
  currentTheta: 0.64,
  currentPhi: defaultPhi,
  currentRadius: defaultRadius,
  targetTheta: 0.64,
  targetPhi: defaultPhi,
  targetRadius: defaultRadius,
  thetaVelocity: 0,
  phiVelocity: 0,
  radiusVelocity: 0
};

let sceneTime = 0;
let pointerSeen = false;
let hoveredLotus = null;
let keyboardLotusIndex = -1;
let keyboardCursorLotus = null;
let mantaPointerWeight = 0;
let lastScatterAt = -10;
let cameraSpeed = 0;
let foldEnergy = 0;
let motionEnergy = 0;
let revealed = false;
let renderDirty = true;
let directMotionUntil = 0;
let uiTransitionUntil = 0;
let interfaceFadeTimer = 0;
let worldSettleTimer = 0;
let lastFrameTime = performance.now();

const moods = {
  dawn: {
    background: new THREE.Color("#e8dcc0"),
    skyTop: new THREE.Color("#d9ded6"),
    skyBottom: new THREE.Color("#c2a97e"),
    fog: new THREE.Color("#e8dcc0"),
    hemiSky: new THREE.Color("#fff1cd"),
    hemiGround: new THREE.Color("#567080"),
    indigo: new THREE.Color("#24475c"),
    key: new THREE.Color("#ffd89a"),
    rim: new THREE.Color("#7ca0ad"),
    under: new THREE.Color("#425b68"),
    vermilion: new THREE.Color("#c94b32"),
    gold: new THREE.Color("#b88a32"),
    particles: new THREE.Color("#f3dfad"),
    exposure: 0.98
  },
  midnight: {
    background: new THREE.Color("#0d202d"),
    skyTop: new THREE.Color("#071522"),
    skyBottom: new THREE.Color("#07131e"),
    fog: new THREE.Color("#0d202d"),
    hemiSky: new THREE.Color("#8db5c3"),
    hemiGround: new THREE.Color("#09131e"),
    indigo: new THREE.Color("#6e93a5"),
    key: new THREE.Color("#a9d2dd"),
    rim: new THREE.Color("#db9a65"),
    under: new THREE.Color("#081722"),
    vermilion: new THREE.Color("#e15a3d"),
    gold: new THREE.Color("#d7ac57"),
    particles: new THREE.Color("#bcd6d7"),
    exposure: 0.86
  }
};

let activeMood = "dawn";
const skyGeometry = new THREE.SphereGeometry(78, 32, 16);
const skyMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTop: { value: new THREE.Color("#f0e4c8") },
    uHorizon: { value: new THREE.Color("#e8dcc0") },
    uBottom: { value: new THREE.Color("#cdb98d") }
  },
  vertexShader: `varying vec3 vDirection;
void main(){
vDirection=normalize(position);
gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`,
  fragmentShader: `uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
varying vec3 vDirection;
void main(){
float h=clamp(vDirection.y*0.5+0.5,0.0,1.0);
vec3 color=mix(uBottom,uHorizon,smoothstep(0.0,0.52,h));
color=mix(color,uTop,smoothstep(0.48,1.0,h));
float band=1.0-smoothstep(0.0,0.42,abs(vDirection.y));
color=mix(color,uHorizon,band*0.2);
gl_FragColor=vec4(color,1.0);
}`,
  side: THREE.BackSide,
  depthWrite: false,
  depthTest: false,
  fog: false,
  toneMapped: false
});
const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
skyDome.renderOrder = -10;
skyDome.frustumCulled = false;
scene.add(skyDome);
const materialStates = [];
const islands = [];
const cranes = [];
const lotusFlowers = [];
const lotusPetalOwners = [];
const lotusHitMeshes = [];
const occlusionTargets = [];
const interactivePointers = new Map();
let primaryPointer = null;
let pinchDistance = 0;
let pointerMoved = false;
let pointerStartX = 0;
let pointerStartY = 0;
let pointerLastX = 0;
let pointerLastY = 0;
let lastHoverTest = -10;
let lastFoldRaycastAt = -10;
let primaryMode = "fold";
let pointerDownLotus = null;
let pointerDownOcean = false;
let gestureHadPinch = false;
let activeFoldStroke = null;
let foldLastWorldX = 0;
let foldLastWorldZ = 0;
let foldLastPointTime = 0;
let foldHasLastPoint = false;
let orbitCenterX = 0;
let orbitCenterY = 0;
let pinchAngle = 0;
let pinchActive = false;

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createPaperTexture() {
  const size = 256;
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = size;
  textureCanvas.height = size;
  const context = textureCanvas.getContext("2d", { willReadFrequently: true });
  const image = context.createImageData(size, size);
  const random = seededRandom(74921);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const grain = Math.floor((random() - 0.5) * 17 + Math.sin(x * 0.11) * 2 + Math.cos(y * 0.07) * 2);
      image.data[index] = 231 + grain;
      image.data[index + 1] = 224 + grain;
      image.data[index + 2] = 204 + grain;
      image.data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  context.lineCap = "round";
  for (let fiber = 0; fiber < 340; fiber += 1) {
    const x = random() * size;
    const y = random() * size;
    const length = 4 + random() * 28;
    const slope = (random() - 0.5) * 0.55;
    context.strokeStyle = `rgba(82, 66, 44, ${0.025 + random() * 0.045})`;
    context.lineWidth = random() < 0.82 ? 0.45 : 0.8;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + length, y + slope * length);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4.5, 4.5);
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function createFleckTexture() {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 32;
  textureCanvas.height = 32;
  const context = textureCanvas.getContext("2d");
  context.clearRect(0, 0, 32, 32);
  context.fillStyle = "rgba(255,255,255,0.94)";
  context.beginPath();
  context.moveTo(7, 3);
  context.lineTo(27, 9);
  context.lineTo(22, 28);
  context.lineTo(5, 21);
  context.closePath();
  context.fill();
  context.strokeStyle = "rgba(70,55,38,0.35)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(8, 4);
  context.lineTo(21, 27);
  context.stroke();
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const paperTexture = createPaperTexture();
const fleckTexture = createFleckTexture();

function createPaperMaterial(dayColor, nightColor, options = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: dayColor,
    map: paperTexture,
    roughness: 0.88,
    metalness: 0,
    side: THREE.DoubleSide,
    flatShading: true,
    transparent: false,
    opacity: 1,
    emissive: new THREE.Color(dayColor).multiplyScalar(0.025),
    emissiveIntensity: 0.42,
    ...options
  });
  if (material.transparent) material.forceSinglePass = true;
  materialStates.push({
    material,
    day: new THREE.Color(dayColor),
    night: new THREE.Color(nightColor),
    emissiveStrength: material.emissiveIntensity
  });
  return material;
}

const oceanMaterial = createPaperMaterial("#d6bf8d", "#2b4b5c", {
  vertexColors: true,
  roughness: 0.94,
  opacity: 1,
  bumpMap: paperTexture,
  bumpScale: 0.045
});
const creamMaterial = createPaperMaterial("#f1dfb8", "#b9c8c3");
const innerMaterial = createPaperMaterial("#f6e7c8", "#d8cba9");
const vermilionMaterial = createPaperMaterial("#c94b32", "#e15a3d");
const indigoMaterial = createPaperMaterial("#24475c", "#547d96");
const goldMaterial = createPaperMaterial("#b88a32", "#d7ac57", { roughness: 0.68 });
const deepIndigoMaterial = createPaperMaterial("#1b3545", "#41677e", { opacity: 1 });
const rockMaterials = [
  createPaperMaterial("#d8c7a3", "#738c91"),
  createPaperMaterial("#bd7859", "#9a5546"),
  createPaperMaterial("#3a5b68", "#466b7b")
];

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

function addCreaseShader(material, strength, rim) {
  const rimInjection = rim
    ? `\nfloat rimFade = smoothstep(${rim.start.toFixed(2)}, ${rim.end.toFixed(2)}, vPaperRadius);\ndiffuseColor.rgb = mix(diffuseColor.rgb, fogColor, rimFade * ${rim.strength.toFixed(3)});`
    : "";
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 barycentric;\nvarying vec3 vCrease;\nvarying float vPaperRadius;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCrease = barycentric;\nvPaperRadius = length(position.xz);");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCrease;\nvarying float vPaperRadius;")
      .replace("#include <color_fragment>", `#include <color_fragment>\nfloat creaseEdge = min(min(vCrease.x, vCrease.y), vCrease.z);\nfloat creaseAA = max(fwidth(creaseEdge), 0.0008);\nfloat creaseLine = 1.0 - smoothstep(creaseAA * 0.25, creaseAA * 1.55, creaseEdge);\ndiffuseColor.rgb *= 1.0 - creaseLine * ${strength.toFixed(3)};${rimInjection}`);
  };
  material.customProgramCacheKey = () => `paper-creases-${strength}-${rim ? rim.start : "flat"}`;
}

function createOceanGeometry() {
  const rings = qualityTier === "light" ? 18 : 24;
  const segments = qualityTier === "light" ? 56 : 72;
  const maximumRadius = 23.5;
  const positions = [0, 0, 0];
  const indices = [];
  const outlineRandom = seededRandom(31415);

  for (let ring = 1; ring <= rings; ring += 1) {
    const radius = maximumRadius * Math.pow(ring / rings, 1.04);
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = segment / segments * TAU;
      const edgeScale = 1 + Math.sin(angle * 5 + 0.4) * 0.018 + Math.sin(angle * 11 - 0.7) * 0.009 + (outlineRandom() - 0.5) * 0.006;
      positions.push(Math.cos(angle) * radius * edgeScale, 0, Math.sin(angle) * radius * edgeScale);
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const current = 1 + segment;
    const next = 1 + (segment + 1) % segments;
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
    const value = 0.78 + random() * 0.2;
    const warmth = 0.94 + random() * 0.06;
    for (let corner = 0; corner < 3; corner += 1) {
      const index = vertex + corner;
      barycentric[index * 3] = corner === 0 ? 1 : 0;
      barycentric[index * 3 + 1] = corner === 1 ? 1 : 0;
      barycentric[index * 3 + 2] = corner === 2 ? 1 : 0;
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
  return geometry;
}

const oceanGeometry = createOceanGeometry();
const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
ocean.name = "faceted paper ocean";
scene.add(ocean);
addCreaseShader(oceanMaterial, 0.035, { start: 20.6, end: 23.5, strength: 0.82 });

const oceanBase = new Float32Array(oceanGeometry.attributes.position.array);
const oceanColors = oceanGeometry.attributes.color.array;
const oceanBaseColors = new Float32Array(oceanColors);
const oceanDisplacement = new Float32Array(oceanBase.length / 3);
const oceanVelocity = new Float32Array(oceanBase.length / 3);
const oceanVertexCount = oceanBase.length / 3;
const oceanSwellTerms = 4;
const oceanSwellRate = new Float32Array([0.58, -0.41, 0.83, 0.26]);
const oceanSwellGain = new Float32Array([0.1, 0.09, 0.032, 0.055]);
const oceanSwellSpace = new Float32Array(oceanVertexCount * oceanSwellTerms);
const oceanSwellCos = new Float32Array(oceanVertexCount * oceanSwellTerms);
const halfPi = Math.PI * 0.5;

for (let index = 0; index < oceanVertexCount; index += 1) {
  const x = oceanBase[index * 3];
  const z = oceanBase[index * 3 + 2];
  const spatial = [x * 0.43, z * 0.36 + halfPi, (x + z) * 0.72, x * 0.18 - z * 0.23];
  for (let term = 0; term < oceanSwellTerms; term += 1) {
    oceanSwellSpace[index * oceanSwellTerms + term] = Math.sin(spatial[term]);
    oceanSwellCos[index * oceanSwellTerms + term] = Math.cos(spatial[term]);
  }
}
const creaseFieldResolution = qualityTier === "light" ? 49 : 65;
const creaseFieldSize = 48;
const creaseFieldStep = creaseFieldSize / (creaseFieldResolution - 1);
const creaseFieldTarget = new Float32Array(creaseFieldResolution * creaseFieldResolution);
const creaseFieldMemory = new Float32Array(creaseFieldResolution * creaseFieldResolution);
const creaseFieldVelocity = new Float32Array(creaseFieldResolution * creaseFieldResolution);
let creaseGradientX = 0;
let creaseGradientZ = 0;
const creaseStrokeLimit = qualityTier === "light" ? 8 : 10;
const creasePointLimit = qualityTier === "light" ? 10 : 12;
const creaseStrokes = Array.from({ length: creaseStrokeLimit }, (_, strokeIndex) => ({
  active: false,
  age: 0,
  life: 10,
  count: 0,
  cursor: 0,
  sequence: strokeIndex,
  points: Array.from({ length: creasePointLimit }, () => ({ x: 0, z: 0, impulse: 0, width: 0.4, sign: 1, speed: 0, decay: 1 }))
}));
let creaseCursor = 0;
const creaseSegmentLimit = creaseStrokeLimit * (creasePointLimit - 1);
const creaseLinePositions = new Float32Array(creaseSegmentLimit * 6 * 3);
const creaseLineAlpha = new Float32Array(creaseSegmentLimit * 6);
const creaseLineTone = new Float32Array(creaseSegmentLimit * 6);
const creaseLineGeometry = new THREE.BufferGeometry();
creaseLineGeometry.setAttribute("position", new THREE.BufferAttribute(creaseLinePositions, 3).setUsage(THREE.DynamicDrawUsage));
creaseLineGeometry.setAttribute("lineAlpha", new THREE.BufferAttribute(creaseLineAlpha, 1).setUsage(THREE.DynamicDrawUsage));
creaseLineGeometry.setAttribute("lineTone", new THREE.BufferAttribute(creaseLineTone, 1).setUsage(THREE.DynamicDrawUsage));
const creaseLineMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uColor: { value: moods.dawn.gold.clone() },
    uShadow: { value: moods.dawn.indigo.clone() }
  },
  vertexShader: `attribute float lineAlpha;
attribute float lineTone;
varying float vAlpha;
varying float vTone;
void main(){
vAlpha=lineAlpha;
vTone=lineTone;
gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`,
  fragmentShader: `uniform vec3 uColor;
uniform vec3 uShadow;
varying float vAlpha;
varying float vTone;
void main(){
if(vAlpha<0.004)discard;
float tone=smoothstep(0.0,1.0,vTone);
vec3 color=mix(uShadow,uColor,tone);
gl_FragColor=vec4(color,vAlpha*(0.42+tone*0.58));
}`,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
  side: THREE.DoubleSide,
  toneMapped: false
});
creaseLineMaterial.forceSinglePass = true;
const creaseLines = new THREE.Mesh(creaseLineGeometry, creaseLineMaterial);
creaseLines.frustumCulled = false;
creaseLines.renderOrder = 4;
creaseLines.visible = false;
scene.add(creaseLines);

const horizon = createHorizon({ THREE, scene, moods });

const hemiLight = new THREE.HemisphereLight(moods.dawn.hemiSky, moods.dawn.hemiGround, 0.78);
const keyLight = new THREE.DirectionalLight(moods.dawn.key, 4.0);
keyLight.position.set(-8, 12, 6);
const rimLight = new THREE.DirectionalLight(moods.dawn.rim, 1.6);
rimLight.position.set(9, 5, -12);
const vermilionLight = new THREE.PointLight(moods.dawn.vermilion, 5.2, 16, 2);
vermilionLight.position.set(-3, 2.5, 3);
const focalLight = new THREE.PointLight(moods.dawn.gold, 2.4, 14, 2);
focalLight.position.set(-3.6, 3.2, 3.4);
const ambientLight = new THREE.AmbientLight(moods.dawn.hemiSky, 0.1);
scene.add(hemiLight, keyLight, rimLight, vermilionLight, focalLight, ambientLight);
scene.background = moods.dawn.background.clone();
scene.fog = new THREE.Fog(moods.dawn.fog, 15, 52);

const sunMaterial = new THREE.MeshBasicMaterial({ color: moods.dawn.gold, transparent: true, opacity: 0.66, depthWrite: false, side: THREE.DoubleSide });
const sunHaloMaterial = new THREE.MeshBasicMaterial({ color: moods.dawn.gold, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
const sunRoot = new THREE.Group();
const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(2.8, 48), sunMaterial);
const sunHalo = new THREE.Mesh(new THREE.CircleGeometry(4.3, 48), sunHaloMaterial);
const sunRing = new THREE.Mesh(new THREE.RingGeometry(3.05, 3.12, 48), sunHaloMaterial.clone());
sunHalo.position.z = -0.05;
sunRing.position.z = 0.02;
sunRing.material.opacity = 0.22;
sunMaterial.forceSinglePass = true;
sunHaloMaterial.forceSinglePass = true;
sunRing.material.forceSinglePass = true;
sunRoot.add(sunHalo, sunDisc, sunRing);
sunRoot.position.set(-10.5, 8.2, -16.5);
scene.add(sunRoot);

const rockGeometry = new THREE.IcosahedronGeometry(0.72, 0);
const shardGeometry = new THREE.ConeGeometry(0.64, 2.15, 4, 1, false);
shardGeometry.translate(0, 1.075, 0);
const sailGeometry = geometryFromTriangles([
  [[0, 0, 0], [0, 2.75, 0], [0.78, 1.1, 0.12]],
  [[0, 0, 0], [0.78, 1.1, 0.12], [-0.48, 1.28, -0.08]],
  [[0, 2.75, 0], [-0.48, 1.28, -0.08], [0.78, 1.1, 0.12]]
]);
const islandSpecs = [
  [-1.6, -6.0, 0.62, 2], [-6.6, -5.6, 0.5, 1], [0.6, -9.4, 0.55, 0],
  [-13.0, 2.2, 0.6, 1], [-6.6, 7.4, 0.52, 0], [-11.8, 8.2, 0.44, 2],
  [12.0, 0.8, 0.58, 2], [5.6, 6.8, 0.5, 0], [12.4, 6.0, 0.42, 1],
  [0.0, 6.5, 0.62, 1], [-2.0, 0.0, 0.7, 0],
  [2.5, 9.0, 0.66, 2], [-2.0, 11.0, 0.5, 1]
];

for (let index = 0; index < islandSpecs.length; index += 1) {
  const [x, z, scale, materialIndex] = islandSpecs[index];
  const group = new THREE.Group();
  const base = new THREE.Mesh(rockGeometry, rockMaterials[materialIndex]);
  base.scale.set(1.45 * scale, 0.5 * scale, 1.05 * scale);
  base.position.y = 0.12 * scale;
  base.rotation.set(0.1 * index, index * 0.81, 0.06 * index);
  const shard = new THREE.Mesh(shardGeometry, materialIndex === 1 ? vermilionMaterial : index % 2 ? goldMaterial : indigoMaterial);
  shard.position.set(0.28 * scale, 0.18 * scale, -0.08 * scale);
  shard.scale.set(0.72 * scale, scale, 0.72 * scale);
  shard.rotation.y = 0.6 + index * 0.47;
  group.add(base, shard);
  occlusionTargets.push(base, shard);

  if (index % 2 === 0) {
    const sail = new THREE.Mesh(sailGeometry, index % 4 === 0 ? creamMaterial : vermilionMaterial);
    sail.position.set(-0.25 * scale, 0.2 * scale, 0.18 * scale);
    sail.scale.setScalar(scale * 0.72);
    sail.rotation.y = -0.5 + index * 0.23;
    group.add(sail);
    occlusionTargets.push(sail);
  }

  group.position.set(x, -0.04, z);
  scene.add(group);
  islands.push({ group, baseY: group.position.y, phase: index * 0.83, rotation: group.rotation.y, shadowScale: scale });
}

const landmarks = createLandmarks({
  THREE,
  scene,
  qualityTier,
  occluders: occlusionTargets,
  materials: {
    cream: creamMaterial,
    vermilion: vermilionMaterial,
    indigo: indigoMaterial,
    gold: goldMaterial
  }
});

const foregroundSails = new THREE.InstancedMesh(sailGeometry, innerMaterial, 2);
foregroundSails.instanceMatrix.setUsage(THREE.StaticDrawUsage);
foregroundSails.frustumCulled = false;
const foregroundTransform = new THREE.Object3D();
const foregroundSailSpecs = [
  [-7.4, 0, 10.4, 0.48, 1.9, -0.32],
  [8.6, 0, 9.8, -0.42, 1.75, 0.28]
];
for (let index = 0; index < foregroundSailSpecs.length; index += 1) {
  const [x, y, z, rotation, scale, lean] = foregroundSailSpecs[index];
  foregroundTransform.position.set(x, y, z);
  foregroundTransform.rotation.set(lean * 0.12, rotation, lean);
  foregroundTransform.scale.set(scale, scale, scale);
  foregroundTransform.updateMatrix();
  foregroundSails.setMatrixAt(index, foregroundTransform.matrix);
    foregroundSails.setColorAt(index, index ? new THREE.Color("#c94b32") : new THREE.Color("#b88a32"));
}
foregroundSails.instanceMatrix.needsUpdate = true;
foregroundSails.instanceColor.needsUpdate = true;
scene.add(foregroundSails);
occlusionTargets.push(foregroundSails);

const mantaWingGeometry = geometryFromTriangles([
  [[0, 0.06, -0.3], [-0.68, 0.3, 0.08], [0, 0.02, 1.02]],
  [[-0.68, 0.3, 0.08], [-0.48, 0.42, 0.74], [0, 0.02, 1.02]],
  [[-0.68, 0.3, 0.08], [-1.52, 0.2, 0.48], [-0.48, 0.42, 0.74]],
  [[-1.52, 0.2, 0.48], [-3.05, 0.34, 1.12], [-0.48, 0.42, 0.74]],
  [[-1.52, 0.2, 0.48], [-1.17, 0.14, 1.38], [-3.05, 0.34, 1.12]],
  [[-1.17, 0.14, 1.38], [0, 0.02, 1.02], [-3.05, 0.34, 1.12]],
  [[-1.17, 0.14, 1.38], [-0.48, 0.42, 0.74], [0, 0.02, 1.02]],
  [[0, -0.05, -0.3], [0, -0.05, 1.02], [-0.68, 0.19, 0.08]],
  [[-0.68, 0.19, 0.08], [0, -0.05, 1.02], [-1.52, 0.09, 0.48]],
  [[-1.52, 0.09, 0.48], [0, -0.05, 1.02], [-3.05, 0.23, 1.12]],
  [[0, 0.06, -0.3], [-0.68, 0.19, 0.08], [0, 0.06, 1.02]],
  [[0, 0.06, 1.02], [-0.68, 0.19, 0.08], [-1.52, 0.09, 0.48]],
  [[-1.52, 0.09, 0.48], [-0.68, 0.19, 0.08], [-3.05, 0.23, 1.12]],
  [[-1.52, 0.09, 0.48], [-3.05, 0.23, 1.12], [0, 0.06, 1.02]],
  [[-0.68, 0.3, 0.08], [-0.68, 0.19, 0.08], [0, 0.06, -0.3]],
  [[-0.68, 0.19, 0.08], [0, -0.05, -0.3], [0, 0.06, -0.3]],
  [[-0.68, 0.3, 0.08], [-1.52, 0.2, 0.48], [-1.52, 0.09, 0.48]],
  [[-1.52, 0.09, 0.48], [-0.68, 0.19, 0.08], [-0.68, 0.3, 0.08]],
  [[-1.52, 0.2, 0.48], [-3.05, 0.34, 1.12], [-3.05, 0.23, 1.12]],
  [[-3.05, 0.23, 1.12], [-1.52, 0.09, 0.48], [-1.52, 0.2, 0.48]],
  [[-3.05, 0.34, 1.12], [0, 0.02, 1.02], [0, -0.05, 1.02]],
  [[0, -0.05, 1.02], [0, 0.02, 1.02], [-3.05, 0.23, 1.12]],
  [[-3.05, 0.23, 1.12], [0, 0.02, 1.02], [-3.05, 0.34, 1.12]]
]);
const mantaAccentGeometry = geometryFromTriangles([
  [[-0.46, 0.44, 0.1], [-1.42, 0.25, 0.47], [-0.65, 0.37, 0.83]],
  [[-1.42, 0.25, 0.47], [-2.45, 0.31, 0.94], [-0.65, 0.37, 0.83]]
]);
const mantaBodyGeometry = new THREE.OctahedronGeometry(0.78, 0);
mantaBodyGeometry.scale(0.72, 0.42, 1.6);
const mantaTailGeometry = geometryFromTriangles([
  [[-0.12, 0, 0.88], [0.12, 0, 0.88], [0.035, 0.02, 3.65]],
  [[-0.12, 0, 0.88], [0.035, 0.02, 3.65], [-0.035, 0.02, 2.62]],
  [[0.12, 0, 0.88], [0.045, 0.015, 3.35], [0.035, 0.02, 3.65]]
]);
const eyeGeometry = new THREE.SphereGeometry(0.055, 6, 4);
const manta = new THREE.Group();
manta.name = "cursor-led origami manta";
const mantaBody = new THREE.Mesh(mantaBodyGeometry, creamMaterial);
mantaBody.position.z = 0.05;
const leftWingPivot = new THREE.Group();
const rightWingPivot = new THREE.Group();
leftWingPivot.add(new THREE.Mesh(mantaWingGeometry, creamMaterial), new THREE.Mesh(mantaAccentGeometry, vermilionMaterial));
rightWingPivot.add(new THREE.Mesh(mantaWingGeometry, creamMaterial), new THREE.Mesh(mantaAccentGeometry, indigoMaterial));
rightWingPivot.scale.x = -1;
const leftEye = new THREE.Mesh(eyeGeometry, deepIndigoMaterial);
const rightEye = new THREE.Mesh(eyeGeometry, deepIndigoMaterial);
leftEye.position.set(-0.33, 0.19, -0.66);
rightEye.position.set(0.33, 0.19, -0.66);
manta.add(mantaBody, leftWingPivot, rightWingPivot, new THREE.Mesh(mantaTailGeometry, creamMaterial), leftEye, rightEye);
manta.position.set(0, 4.0, 1.6);
manta.scale.setScalar(1.45);
manta.rotation.order = "YXZ";
scene.add(manta);
occlusionTargets.push(mantaBody, leftWingPivot.children[0], rightWingPivot.children[0], leftEye, rightEye);

const shadowMaterial = new THREE.MeshBasicMaterial({ color: moods.dawn.under, transparent: true, opacity: 0.13, depthWrite: false });
const mantaShadow = new THREE.Mesh(new THREE.CircleGeometry(1, 32), shadowMaterial);
mantaShadow.rotation.x = -Math.PI / 2;
mantaShadow.scale.set(1.85, 0.92, 1);
mantaShadow.position.set(0, 0.2, 0.5);
scene.add(mantaShadow);

const craneBodyGeometry = new THREE.OctahedronGeometry(0.2, 0);
craneBodyGeometry.scale(0.78, 0.72, 1.45);
const craneWingGeometry = geometryFromTriangles([
  [[0, 0, -0.04], [0.94, 0.06, 0.2], [0.16, 0, 0.5]],
  [[0, 0, -0.04], [0.16, 0, 0.5], [0.42, 0.13, 0.18]]
]);
const craneNeckGeometry = new THREE.ConeGeometry(0.055, 0.36, 4, 1);
craneNeckGeometry.translate(0, 0.18, 0);
const craneBeakGeometry = new THREE.ConeGeometry(0.05, 0.24, 3, 1);
craneBeakGeometry.rotateX(-Math.PI / 2);
craneBeakGeometry.translate(0, 0, -0.12);
const craneTailGeometry = new THREE.ConeGeometry(0.13, 0.6, 3, 1);
craneTailGeometry.rotateX(Math.PI / 2);
craneTailGeometry.translate(0, 0, 0.29);

function mergeCraneParts(parts) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const sourcePosition = new THREE.Vector3();
  const sourceNormal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  for (const part of parts) {
    const source = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    source.applyMatrix4(part.matrix);
    normalMatrix.getNormalMatrix(part.matrix);
    const positionAttribute = source.attributes.position;
    const normalAttribute = source.attributes.normal;
    const uvAttribute = source.attributes.uv;
    for (let index = 0; index < positionAttribute.count; index += 1) {
      sourcePosition.fromBufferAttribute(positionAttribute, index);
      sourceNormal.fromBufferAttribute(normalAttribute, index).applyMatrix3(normalMatrix).normalize();
      positions.push(sourcePosition.x, sourcePosition.y, sourcePosition.z);
      normals.push(sourceNormal.x, sourceNormal.y, sourceNormal.z);
      if (uvAttribute) uvs.push(uvAttribute.getX(index), uvAttribute.getY(index));
      else uvs.push(sourcePosition.x * 0.18 + 0.5, sourcePosition.z * 0.18 + 0.5);
    }
    source.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

const identityMatrix = new THREE.Matrix4();
const neckMatrix = new THREE.Matrix4().compose(new THREE.Vector3(0, 0.05, -0.22), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.52, 0, 0)), new THREE.Vector3(1, 1, 1));
const beakMatrix = new THREE.Matrix4().compose(new THREE.Vector3(0, 0.21, -0.38), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.52, 0, 0)), new THREE.Vector3(1, 1, 1));
const tailMatrix = new THREE.Matrix4().compose(new THREE.Vector3(0, 0, 0), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
const rightWingMatrix = new THREE.Matrix4().makeScale(-1, 1, 1);
const mergedCraneGeometry = mergeCraneParts([
  { geometry: craneBodyGeometry, matrix: identityMatrix },
  { geometry: craneWingGeometry, matrix: identityMatrix },
  { geometry: craneWingGeometry, matrix: rightWingMatrix },
  { geometry: craneNeckGeometry, matrix: neckMatrix },
  { geometry: craneBeakGeometry, matrix: beakMatrix },
  { geometry: craneTailGeometry, matrix: tailMatrix }
]);
const craneMaterial = createPaperMaterial("#f1dfb8", "#b9c8c3", { side: THREE.DoubleSide });
const craneSpecs = [
  [-1.6, 5.6, -6.4], [-6.4, 6.2, -7.0], [-4.6, 5.0, -11.2], [-7.6, 6.6, -10.4],
  [-7.4, 5.0, 2.6], [-11.8, 5.4, 4.0], [-10.2, 4.6, 7.2], [-12.0, 5.8, 6.2],
  [6.2, 4.8, 1.6], [10.8, 5.2, 2.2], [9.4, 4.4, 6.4], [11.8, 6.0, 5.6]
];
const craneCount = qualityTier === "light" ? 7 : craneSpecs.length;
const craneInstances = new THREE.InstancedMesh(mergedCraneGeometry, craneMaterial, craneCount);
craneInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
craneInstances.frustumCulled = false;
craneInstances.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, 0), 26);
scene.add(craneInstances);
occlusionTargets.push(craneInstances);
const craneColors = [new THREE.Color("#f1dfb8"), new THREE.Color("#c94b32"), new THREE.Color("#24475c"), new THREE.Color("#b88a32")];
const craneTransform = new THREE.Object3D();

for (let index = 0; index < craneCount; index += 1) {
  const spec = craneSpecs[index];
  craneInstances.setColorAt(index, craneColors[index % craneColors.length]);
  cranes.push({
    baseX: spec[0],
    baseY: spec[1],
    baseZ: spec[2],
    baseYaw: index * 1.37,
    x: spec[0],
    y: spec[1],
    z: spec[2],
    vx: 0,
    vy: 0,
    vz: 0,
    energy: 0,
    spin: 0,
    phase: index * 0.83
  });
}
craneInstances.instanceColor.needsUpdate = true;

const petalGeometry = geometryFromTriangles([
  [[0, 0, 0], [-0.27, 0.025, 0.34], [0, 0.16, 0.42]],
  [[-0.27, 0.025, 0.34], [-0.2, 0.075, 0.75], [0, 0.16, 0.42]],
  [[-0.2, 0.075, 0.75], [0, 0.19, 1.02], [0, 0.16, 0.42]],
  [[0, 0.19, 1.02], [0.2, 0.075, 0.75], [0, 0.16, 0.42]],
  [[0.2, 0.075, 0.75], [0.27, 0.025, 0.34], [0, 0.16, 0.42]],
  [[0.27, 0.025, 0.34], [0, 0, 0], [0, 0.16, 0.42]]
]);
const lotusBaseGeometry = new THREE.CircleGeometry(0.42, 10);
lotusBaseGeometry.rotateX(-Math.PI / 2);
const lotusHeartGeometry = new THREE.IcosahedronGeometry(0.2, 1);
const lotusSpecs = [
  [-8.14, 0.1, 4.93, 0.62], [-9.65, 0.08, 5.95, 0.3], [-11.1, 0.11, 4.83, 0.2],
  [-10.47, 0.1, 3.11, 0.28], [-8.63, 0.1, 3.2, 0.16],
  [2.0, 0.1, -5.0, 0.3], [-1.0, 0.1, 8.5, 0.12], [5.0, 0.11, 9.5, 0.14]
];
const lotusCount = qualityTier === "light" ? 4 : lotusSpecs.length;
const petalCount = lotusCount * 15;
const lotusPetalMaterial = createPaperMaterial("#f1dfb8", "#b9c8c3", { side: THREE.DoubleSide });
const lotusBaseMaterial = createPaperMaterial("#f1dfb8", "#b9c8c3", { side: THREE.DoubleSide });
const lotusHeartMaterial = createPaperMaterial("#b88a32", "#d7ac57", { side: THREE.DoubleSide });
const lotusPetalInstances = new THREE.InstancedMesh(petalGeometry, lotusPetalMaterial, petalCount);
const lotusBaseInstances = new THREE.InstancedMesh(lotusBaseGeometry, lotusBaseMaterial, lotusCount);
const lotusHeartInstances = new THREE.InstancedMesh(lotusHeartGeometry, lotusHeartMaterial, lotusCount);
lotusPetalInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
lotusBaseInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
lotusHeartInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
lotusPetalInstances.frustumCulled = false;
lotusBaseInstances.frustumCulled = false;
lotusHeartInstances.frustumCulled = false;
lotusPetalInstances.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 20);
lotusBaseInstances.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 20);
lotusHeartInstances.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 20);
lotusPetalInstances.userData.lotusKind = "petal";
lotusBaseInstances.userData.lotusKind = "base";
lotusHeartInstances.userData.lotusKind = "heart";
scene.add(lotusPetalInstances, lotusBaseInstances, lotusHeartInstances);
lotusHitMeshes.push(lotusPetalInstances, lotusHeartInstances, lotusBaseInstances);
const lotusTransform = new THREE.Object3D();
const lotusPetalColors = [new THREE.Color("#f1dfb8"), new THREE.Color("#f6e7c8"), new THREE.Color("#c94b32"), new THREE.Color("#24475c")];

for (let flowerIndex = 0; flowerIndex < lotusCount; flowerIndex += 1) {
  const spec = lotusSpecs[flowerIndex];
  const state = {
    baseX: spec[0],
    baseY: spec[1],
    baseZ: spec[2],
    baseYaw: flowerIndex * 0.47,
    bloom: spec[3],
    initialBloom: spec[3],
    targetBloom: spec[3],
    locked: spec[3] > 0.45,
    userClosed: false,
    phase: flowerIndex * 1.31,
    petals: [],
    instanceIndex: flowerIndex,
    bloomScale: 0.92 + spec[3] * 0.08
  };
  lotusBaseInstances.setColorAt(flowerIndex, flowerIndex % 2 ? lotusPetalColors[3] : lotusPetalColors[2]);
  lotusHeartInstances.setColorAt(flowerIndex, lotusPetalColors[2]);

  for (let petalIndex = 0; petalIndex < 15; petalIndex += 1) {
    const inner = petalIndex >= 9;
    const count = inner ? 6 : 9;
    const localIndex = inner ? petalIndex - 9 : petalIndex;
    const instanceIndex = flowerIndex * 15 + petalIndex;
    const scale = inner ? 0.78 : 1.06 + (flowerIndex % 2) * 0.08;
    const colorIndex = inner ? 1 : flowerIndex % 3;
    lotusPetalInstances.setColorAt(instanceIndex, lotusPetalColors[colorIndex]);
    lotusPetalOwners[instanceIndex] = state;
    state.petals.push({
      instanceIndex,
      inner,
      scale,
      baseYaw: localIndex / count * TAU + (inner ? 0.42 : 0),
      pivotY: inner ? 0.13 : 0.07,
      phase: localIndex / count * TAU + flowerIndex * 0.31
    });
  }
  lotusFlowers.push(state);
}
lotusPetalInstances.instanceColor.needsUpdate = true;
lotusBaseInstances.instanceColor.needsUpdate = true;
lotusHeartInstances.instanceColor.needsUpdate = true;

const contactShadowGeometry = new THREE.CircleGeometry(1, 20);
contactShadowGeometry.rotateX(-Math.PI / 2);
const contactShadowMaterial = new THREE.MeshBasicMaterial({ color: moods.dawn.under, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
contactShadowMaterial.forceSinglePass = true;
const contactShadowCount = islands.length + lotusFlowers.length + landmarks.anchors.length;
const contactShadowInstances = new THREE.InstancedMesh(contactShadowGeometry, contactShadowMaterial, contactShadowCount);
contactShadowInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
contactShadowInstances.frustumCulled = false;
contactShadowInstances.renderOrder = 1;
scene.add(contactShadowInstances);
const contactShadowTransform = new THREE.Object3D();
const contactShadowStates = [];
for (const island of islands) contactShadowStates.push({ kind: "island", source: island, scale: island.shadowScale });
for (const lotus of lotusFlowers) contactShadowStates.push({ kind: "lotus", source: lotus, scale: lotus.bloomScale });
for (const anchor of landmarks.anchors) contactShadowStates.push({ kind: "anchor", source: anchor, scale: anchor.scale });

function updateContactShadows() {
  for (let index = 0; index < contactShadowStates.length; index += 1) {
    const shadow = contactShadowStates[index];
    if (shadow.kind === "island") {
      const island = shadow.source;
      contactShadowTransform.position.set(island.group.position.x, 0.025, island.group.position.z);
      contactShadowTransform.rotation.set(0, island.group.rotation.y, 0);
      contactShadowTransform.scale.set(0.95 * shadow.scale, 1, 0.5 * shadow.scale);
    } else if (shadow.kind === "anchor") {
      const anchor = shadow.source;
      contactShadowTransform.position.set(anchor.x, 0.022, anchor.z);
      contactShadowTransform.rotation.set(0, 0, 0);
      contactShadowTransform.scale.set(0.95 * shadow.scale, 1, 0.62 * shadow.scale);
    } else {
      const lotus = shadow.source;
      const unfurl = lotus.bloom;
      contactShadowTransform.position.set(lotus.baseX, 0.045, lotus.baseZ);
      contactShadowTransform.rotation.set(0, lotus.baseYaw, 0);
      contactShadowTransform.scale.set(0.42 + unfurl * 0.14, 1, 0.3 + unfurl * 0.1);
    }
    contactShadowTransform.updateMatrix();
    contactShadowInstances.setMatrixAt(index, contactShadowTransform.matrix);
  }
  contactShadowInstances.instanceMatrix.needsUpdate = true;
}

const atmosphere = createAtmosphere({ THREE, scene, qualityTier, moods, fleckTexture, seededRandom });

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function damp(current, target, lambda, delta) {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

function scheduleWorldSettle(delay = 4200) {
  window.clearTimeout(worldSettleTimer);
  worldSettleTimer = window.setTimeout(() => document.body.classList.add("world-settled"), delay);
}

function toggleFieldMenu() {
  const revealed = document.body.classList.toggle("ui-revealed");
  fieldMenu.setAttribute("aria-expanded", String(revealed));
  if (revealed) {
    window.clearTimeout(worldSettleTimer);
  } else {
    scheduleWorldSettle(1200);
  }
  announce(revealed ? "Field controls revealed." : "Field controls hidden.");
}

function markInterfaceInteraction() {
  if (!document.body.classList.contains("scene-interacting")) document.body.classList.add("scene-interacting");
  window.clearTimeout(interfaceFadeTimer);
  interfaceFadeTimer = window.setTimeout(() => document.body.classList.remove("scene-interacting"), 900);
  if (!document.body.classList.contains("ui-revealed")) scheduleWorldSettle(700);
}

function markDirectMotion(duration = 900) {
  directMotionUntil = Math.max(directMotionUntil, performance.now() + duration);
  markInterfaceInteraction();
  renderDirty = true;
}

function announce(message) {
  liveStatus.textContent = "";
  window.setTimeout(() => { liveStatus.textContent = message; }, 20);
}

let activeRegion = null;

function updateRegionReadout() {
  const region = regionAt(cameraTarget.x, cameraTarget.z);
  if (region === activeRegion) return;
  activeRegion = region;
  if (plateTitle) plateTitle.textContent = region ? `${region.name} · at anchor` : "Manta 01 · in passage";
  announce(region ? `${region.name}.` : "Open water.");
}

function projectKeyboardCursor(lotus) {
  if (!lotus) return;
  camera.updateMatrixWorld();
  keyboardCursorPoint.set(lotus.baseX, lotus.baseY + 0.42, lotus.baseZ).project(camera);
  const bounds = canvas.getBoundingClientRect();
  const x = bounds.left + (keyboardCursorPoint.x * 0.5 + 0.5) * bounds.width;
  const y = bounds.top + (-keyboardCursorPoint.y * 0.5 + 0.5) * bounds.height;
  cursorSeal.style.left = `${clamp(x, bounds.left + 16, bounds.right - 16)}px`;
  cursorSeal.style.top = `${clamp(y, bounds.top + 16, bounds.bottom - 16)}px`;
  cursorSeal.classList.add("is-visible");
}

function refreshLotusCursor() {
  const visualLotus = hoveredLotus || keyboardCursorLotus;
  cursorSeal.classList.toggle("is-blooming", Boolean(visualLotus) && !visualLotus.userClosed);
  if (!hoveredLotus && keyboardCursorLotus) projectKeyboardCursor(keyboardCursorLotus);
}

function setKeyboardCursor(lotus) {
  keyboardCursorLotus = lotus || null;
  refreshLotusCursor();
}

function setHoveredLotus(nextLotus) {
  if (hoveredLotus === nextLotus) return;
  markDirectMotion(700);
  hoveredLotus = nextLotus;
  refreshLotusCursor();
  if (nextLotus) announce(nextLotus.userClosed ? "Lotus selected. Click to open it." : "Lotus selected. It unfurls on hover and click.");
}

function setMood(name, shouldAnnounce = true) {
  if (!moods[name] || activeMood === name) return;
  activeMood = name;
  document.documentElement.dataset.mood = name;
  for (const button of moodButtons) button.setAttribute("aria-pressed", String(button.dataset.mood === name));
  document.querySelector('meta[name="theme-color"]').setAttribute("content", name === "dawn" ? "#e8dcc0" : "#0d202d");
  uiTransitionUntil = performance.now() + 1100;
  renderDirty = true;
  if (shouldAnnounce) announce(name === "dawn" ? "Dawn Vellum atmosphere." : "Midnight Ink atmosphere.");
}

function toggleLotus(lotus) {
  if (!lotus) return;
  lotus.locked = !lotus.locked;
  lotus.userClosed = !lotus.locked;
  lotus.targetBloom = lotus.locked ? 1 : 0.08;
  keyboardLotusIndex = lotus.instanceIndex;
  setKeyboardCursor(lotus);
  markDirectMotion(1200);
  renderDirty = true;
  announce(lotus.locked ? "Lotus bloom held open." : "Lotus released to drift closed.");
}

function cycleKeyboardLotus() {
  const previousIndex = keyboardLotusIndex;
  keyboardLotusIndex = (keyboardLotusIndex + 1) % lotusFlowers.length;
  if (previousIndex >= 0 && previousIndex !== keyboardLotusIndex) {
    const previous = lotusFlowers[previousIndex];
    previous.locked = false;
    previous.userClosed = true;
    previous.targetBloom = 0.08;
  }
  const lotus = lotusFlowers[keyboardLotusIndex];
  lotus.locked = true;
  lotus.userClosed = false;
  lotus.targetBloom = 1;
  setKeyboardCursor(lotus);
  markDirectMotion(1400);
  renderDirty = true;
  announce(`Lotus ${keyboardLotusIndex + 1} of ${lotusFlowers.length} selected and open. Press B for the next lotus or Enter to close it.`);
}

function closeKeyboardLotus() {
  if (keyboardLotusIndex < 0) {
    announce("Press B to select a lotus before closing it.");
    return;
  }
  const lotus = lotusFlowers[keyboardLotusIndex];
  lotus.locked = false;
  lotus.userClosed = true;
  lotus.targetBloom = 0.08;
  setKeyboardCursor(lotus);
  markDirectMotion(1200);
  renderDirty = true;
  announce(`Lotus ${keyboardLotusIndex + 1} closed.`);
}

function writeCreasePoint(stroke, x, z, impulse, width, sign, speed) {
  const index = stroke.cursor % creasePointLimit;
  const point = stroke.points[index];
  point.x = x;
  point.z = z;
  point.impulse = impulse;
  point.width = width;
  point.sign = sign;
  point.speed = speed;
  point.decay = clamp(1 - speed * 0.018, 0.48, 1);
  stroke.cursor += 1;
  stroke.count = Math.min(creasePointLimit, stroke.count + 1);
}

function beginFoldStroke(x, z, previousX, previousZ, speed, impulse, width) {
  const stroke = creaseStrokes[creaseCursor];
  creaseCursor = (creaseCursor + 1) % creaseStrokes.length;
  stroke.active = true;
  stroke.age = 0;
  stroke.life = clamp(13 + speed * 0.12, 13, 18);
  stroke.count = 0;
  stroke.cursor = 0;
  stroke.sequence = creaseCursor;
  const sign = creaseCursor % 2 ? -1 : 1;
  if (Number.isFinite(previousX) && Number.isFinite(previousZ)) writeCreasePoint(stroke, previousX, previousZ, impulse * 0.82, width, sign, speed);
  writeCreasePoint(stroke, x, z, impulse, width, sign, speed);
  activeFoldStroke = stroke;
  foldLastWorldX = x;
  foldLastWorldZ = z;
  foldHasLastPoint = true;
  return stroke;
}

function activateFoldImpulse(x, z, previousX, previousZ, velocityX, velocityZ, eventTime) {
  const speed = clamp(Math.hypot(velocityX, velocityZ), 0, 32);
  const impulse = clamp(0.11 + speed * 0.025, 0.11, 0.48);
  const width = clamp(0.34 + speed * 0.021, 0.34, 0.92);
  if (!activeFoldStroke || activeFoldStroke.count >= creasePointLimit - 1) {
    beginFoldStroke(x, z, previousX, previousZ, speed, impulse, width);
  } else {
    const sign = activeFoldStroke.count % 2 ? -activeFoldStroke.points[Math.max(0, activeFoldStroke.count - 1)].sign : activeFoldStroke.points[Math.max(0, activeFoldStroke.count - 1)].sign;
    writeCreasePoint(activeFoldStroke, x, z, impulse, width, sign, speed);
  }
  foldLastWorldX = x;
  foldLastWorldZ = z;
  foldLastPointTime = eventTime;
  foldHasLastPoint = true;
  foldEnergy = Math.min(1.2, foldEnergy + impulse * (0.45 + speed * 0.035));
  markDirectMotion(2200);
  renderDirty = true;
}

function sampleCreaseField(x, z) {
  const half = creaseFieldSize * 0.5;
  if (x < -half || x > half || z < -half || z > half) {
    creaseGradientX = 0;
    creaseGradientZ = 0;
    return 0;
  }
  const gridX = clamp((x + half) / creaseFieldStep, 0, creaseFieldResolution - 1.001);
  const gridZ = clamp((z + half) / creaseFieldStep, 0, creaseFieldResolution - 1.001);
  const x0 = Math.floor(gridX);
  const z0 = Math.floor(gridZ);
  const x1 = Math.min(x0 + 1, creaseFieldResolution - 1);
  const z1 = Math.min(z0 + 1, creaseFieldResolution - 1);
  const leftX = Math.max(0, x0 - 1);
  const rightX = Math.min(creaseFieldResolution - 1, x0 + 1);
  const upZ = Math.max(0, z0 - 1);
  const downZ = Math.min(creaseFieldResolution - 1, z0 + 1);
  const row0 = z0 * creaseFieldResolution;
  const row1 = z1 * creaseFieldResolution;
  creaseGradientX = (creaseFieldMemory[row0 + rightX] - creaseFieldMemory[row0 + leftX]) / Math.max(creaseFieldStep, (rightX - leftX) * creaseFieldStep);
  creaseGradientZ = (creaseFieldMemory[downZ * creaseFieldResolution + x0] - creaseFieldMemory[upZ * creaseFieldResolution + x0]) / Math.max(creaseFieldStep, (downZ - upZ) * creaseFieldStep);
  const tx = gridX - x0;
  const tz = gridZ - z0;
  const top = creaseFieldMemory[row0 + x0] + (creaseFieldMemory[row0 + x1] - creaseFieldMemory[row0 + x0]) * tx;
  const bottom = creaseFieldMemory[row1 + x0] + (creaseFieldMemory[row1 + x1] - creaseFieldMemory[row1 + x0]) * tx;
  return top + (bottom - top) * tz;
}

function scatterCranes(strength = 1) {
  markDirectMotion(900);
  if (sceneTime - lastScatterAt < 0.28) return;
  lastScatterAt = sceneTime;
  const motionStrength = reducedMotion ? strength * 0.45 : strength;
  for (let index = 0; index < cranes.length; index += 1) {
    const crane = cranes[index];
    const angle = index / cranes.length * TAU + crane.phase * 0.21;
    const speed = (1.4 + (index % 3) * 0.42) * motionStrength;
    crane.vx += Math.cos(angle) * speed;
    crane.vy += (1.1 + (index % 4) * 0.18) * motionStrength;
    crane.vz += Math.sin(angle) * speed;
    crane.energy = Math.min(1.4, crane.energy + motionStrength);
    crane.spin += (index % 2 ? 1 : -1) * motionStrength;
  }
}

function setPaused(nextPaused, shouldAnnounce = true) {
  paused = Boolean(nextPaused);
  motionButton.setAttribute("aria-pressed", String(paused));
  motionButton.setAttribute("aria-label", paused ? "Resume ambient motion" : "Pause ambient motion; direct manipulation remains active");
  motionLabel.textContent = paused ? "Resume" : "Pause";
  if (paused) directMotionUntil = 0;
  activeFoldStroke = null;
  foldHasLastPoint = false;
  lastFrameTime = performance.now();
  renderDirty = true;
  if (shouldAnnounce) announce(paused ? "Ambient motion paused. Direct manipulation remains active." : "Ambient motion resumed.");
}

function setPointerNdc(clientX, clientY) {
  const bounds = canvas.getBoundingClientRect();
  pointerNdc.x = (clientX - bounds.left) / bounds.width * 2 - 1;
  pointerNdc.y = -(clientY - bounds.top) / bounds.height * 2 + 1;
  pointerSeen = true;
}

function lotusAtPointer() {
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(lotusHitMeshes, false);
  const blockers = raycaster.intersectObjects(occlusionTargets, false);
  const blockerDistance = blockers.length ? blockers[0].distance : Infinity;
  for (const hit of hits) {
    if (hit.distance > blockerDistance + 0.08) break;
    if (hit.object === lotusPetalInstances) return lotusPetalOwners[hit.instanceId] || null;
    if (hit.instanceId !== undefined) return lotusFlowers[hit.instanceId] || null;
  }
  return null;
}

function oceanAtPointer() {
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObject(ocean, false);
  if (!hits.length) return null;
  const blockers = raycaster.intersectObjects(occlusionTargets, false);
  if (blockers.length && blockers[0].distance < hits[0].distance - 0.06) return null;
  return hits[0].point;
}

function updateCursor(clientX, clientY, pointerType) {
  keyboardCursorLotus = null;
  if (pointerType !== "mouse") {
    cursorSeal.classList.remove("is-visible");
    refreshLotusCursor();
    return;
  }
  cursorSeal.style.left = `${clientX}px`;
  cursorSeal.style.top = `${clientY}px`;
  cursorSeal.classList.add("is-visible");
  refreshLotusCursor();
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const pointerIsMouse = event.pointerType === "mouse";
  if (pointerIsMouse && event.button !== 0 && event.button !== 1 && event.button !== 2) return;
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  const mode = pointerIsMouse && event.altKey ? "pan" : pointerIsMouse && (event.shiftKey || event.button !== 0) ? "orbit" : "fold";
  markDirectMotion(500);
  interactivePointers.set(event.pointerId, { x: event.clientX, y: event.clientY, mode });
  setPointerNdc(event.clientX, event.clientY);
  updateCursor(event.clientX, event.clientY, event.pointerType);

  if (interactivePointers.size === 1) {
    primaryPointer = event.pointerId;
    primaryMode = mode;
    pointerMoved = false;
    pinchActive = false;
    gestureHadPinch = false;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    pointerLastX = event.clientX;
    pointerLastY = event.clientY;
    orbitCenterX = event.clientX;
    orbitCenterY = event.clientY;
    pointerDownLotus = lotusAtPointer();
    setHoveredLotus(pointerDownLotus);

    if (primaryMode === "fold" && !pointerDownLotus) {
      const oceanPoint = oceanAtPointer();
      pointerDownOcean = Boolean(oceanPoint);
      if (oceanPoint) {
        const angle = Math.atan2(pointerNdc.y, pointerNdc.x + 0.001);
        const directionX = Math.cos(angle) * 0.18;
        const directionZ = Math.sin(angle) * 0.18;
        activateFoldImpulse(oceanPoint.x + directionX, oceanPoint.z + directionZ, oceanPoint.x, oceanPoint.z, directionX * 2.4, directionZ * 2.4, performance.now());
      }
    }
  } else if (interactivePointers.size === 2) {
    const iterator = interactivePointers.values();
    const first = iterator.next().value;
    const second = iterator.next().value;
    pinchDistance = Math.hypot(first.x - second.x, first.y - second.y);
    pinchAngle = Math.atan2(second.y - first.y, second.x - first.x);
    orbitCenterX = (first.x + second.x) * 0.5;
    orbitCenterY = (first.y + second.y) * 0.5;
    primaryMode = "orbit";
    pinchActive = true;
    gestureHadPinch = true;
    pointerMoved = true;
    if (activeFoldStroke) {
      activeFoldStroke.active = false;
      activeFoldStroke.count = 0;
    }
    activeFoldStroke = null;
    foldHasLastPoint = false;
    pointerDownOcean = false;
    setHoveredLotus(null);
    for (const pointerState of interactivePointers.values()) pointerState.mode = "orbit";
  }
});

canvas.addEventListener("pointermove", (event) => {
  const stored = interactivePointers.get(event.pointerId);
  if (stored) {
    stored.x = event.clientX;
    stored.y = event.clientY;
  }
  setPointerNdc(event.clientX, event.clientY);
  updateCursor(event.clientX, event.clientY, event.pointerType);

  if (interactivePointers.size >= 2) {
    const iterator = interactivePointers.values();
    const first = iterator.next().value;
    const second = iterator.next().value;
    const centerX = (first.x + second.x) * 0.5;
    const centerY = (first.y + second.y) * 0.5;
    const distance = Math.max(18, Math.hypot(first.x - second.x, first.y - second.y));
    const angle = Math.atan2(second.y - first.y, second.x - first.x);
    const angleDelta = Math.atan2(Math.sin(angle - pinchAngle), Math.cos(angle - pinchAngle));
    orbit.targetRadius = clamp(orbit.targetRadius * (pinchDistance / distance), 8.2, maxOrbitRadius);
    orbit.targetTheta -= angleDelta * 1.15 + (centerX - orbitCenterX) * 0.0032;
    orbit.targetPhi = clamp(orbit.targetPhi + (centerY - orbitCenterY) * 0.0032, 0.48, 1.39);
    orbit.thetaVelocity = -angleDelta * 1.8;
    orbit.radiusVelocity += (pinchDistance - distance) * 0.0008;
    orbitCenterX = centerX;
    orbitCenterY = centerY;
    pinchDistance = distance;
    pinchAngle = angle;
    pointerMoved = true;
    markDirectMotion(700);
    setHoveredLotus(null);
    return;
  }

  if (event.pointerId === primaryPointer && stored) {
    const deltaX = event.clientX - pointerLastX;
    const deltaY = event.clientY - pointerLastY;
    const totalX = event.clientX - pointerStartX;
    const totalY = event.clientY - pointerStartY;
    if (totalX * totalX + totalY * totalY > 16) pointerMoved = true;

    if (stored.mode === "pan") {
      markDirectMotion(650);
      const panScale = orbit.currentRadius * 0.0016;
      const rightX = Math.cos(orbit.currentTheta);
      const rightZ = -Math.sin(orbit.currentTheta);
      const forwardX = Math.sin(orbit.currentTheta);
      const forwardZ = Math.cos(orbit.currentTheta);
      panTarget.x = clamp(panTarget.x + (-deltaX * rightX - deltaY * forwardX) * panScale, -10, 10);
      panTarget.y = clamp(panTarget.y + (-deltaX * rightZ - deltaY * forwardZ) * panScale, -10, 10);
    } else if (stored.mode === "orbit") {
      markDirectMotion(650);
      orbit.targetTheta -= deltaX * 0.0052;
      orbit.targetPhi = clamp(orbit.targetPhi - deltaY * 0.0042, 0.48, 1.39);
      orbit.thetaVelocity = -deltaX * 0.12;
      orbit.phiVelocity = -deltaY * 0.1;
    } else {
      const eventTime = performance.now();
      if (eventTime - lastFoldRaycastAt < 24) {
        pointerLastX = event.clientX;
        pointerLastY = event.clientY;
        return;
      }
      lastFoldRaycastAt = eventTime;
      const oceanPoint = oceanAtPointer();
      if (oceanPoint) {
        if (!foldHasLastPoint) {
          const angle = Math.atan2(deltaY, deltaX + 0.001);
          const directionX = Math.cos(angle) * 0.16;
          const directionZ = Math.sin(angle) * 0.16;
          activateFoldImpulse(oceanPoint.x + directionX, oceanPoint.z + directionZ, oceanPoint.x, oceanPoint.z, directionX * 2.2, directionZ * 2.2, eventTime);
        } else {
          const elapsed = Math.max(0.008, (eventTime - foldLastPointTime) / 1000);
          const worldDeltaX = oceanPoint.x - foldLastWorldX;
          const worldDeltaZ = oceanPoint.z - foldLastWorldZ;
          if (worldDeltaX * worldDeltaX + worldDeltaZ * worldDeltaZ > 0.0016) {
            activateFoldImpulse(oceanPoint.x, oceanPoint.z, foldLastWorldX, foldLastWorldZ, worldDeltaX / elapsed, worldDeltaZ / elapsed, eventTime);
          }
        }
      }
    }
    pointerLastX = event.clientX;
    pointerLastY = event.clientY;
  } else {
    const eventTime = performance.now();
    if (eventTime - lastHoverTest > 45) {
      lastHoverTest = eventTime;
      setHoveredLotus(lotusAtPointer());
    }
  }
});

function releasePointer(event, cancelled) {
  const stored = interactivePointers.get(event.pointerId);
  const wasPrimary = event.pointerId === primaryPointer;
  const releasedMode = stored ? stored.mode : primaryMode;
  const wasClick = wasPrimary && !cancelled && !gestureHadPinch && !pointerMoved && releasedMode === "fold";
  interactivePointers.delete(event.pointerId);
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

  if (wasClick) {
    setPointerNdc(event.clientX, event.clientY);
    const lotus = pointerDownLotus;
    let realHit = false;
    if (lotus) {
      toggleLotus(lotus);
      realHit = true;
    } else if (pointerDownOcean && !foldHasLastPoint) {
      const oceanPoint = oceanAtPointer();
      if (oceanPoint) {
        activateFoldImpulse(oceanPoint.x + 0.16, oceanPoint.z, oceanPoint.x, oceanPoint.z, 2.4, 0, performance.now());
        realHit = true;
      }
    } else {
      realHit = foldHasLastPoint;
    }
    if (realHit) {
      scatterCranes(1);
      announce(lotus ? "Paper lotus toggled." : "A paper crease was pressed into the ocean.");
    }
  } else if (wasPrimary && releasedMode === "fold" && !cancelled && pointerMoved && foldHasLastPoint) {
    markDirectMotion(700);
  } else if (wasPrimary && releasedMode === "orbit") {
    markDirectMotion(700);
  }

  if (releasedMode === "fold") {
    activeFoldStroke = null;
    foldHasLastPoint = false;
  }

  if (interactivePointers.size === 0) {
    primaryPointer = null;
    primaryMode = "fold";
    pinchActive = false;
    gestureHadPinch = false;
    pointerDownLotus = null;
    pointerDownOcean = false;
    if (event.pointerType !== "mouse") {
      pointerSeen = false;
      pointerWorld.set(0, 0, 0);
      mantaPointerWeight = 0;
    }
    setHoveredLotus(null);
  } else {
    const remaining = interactivePointers.entries().next().value;
    primaryPointer = remaining[0];
    const point = remaining[1];
    point.mode = "orbit";
    primaryMode = "orbit";
    pointerStartX = point.x;
    pointerStartY = point.y;
    pointerLastX = point.x;
    pointerLastY = point.y;
    orbitCenterX = point.x;
    orbitCenterY = point.y;
    pointerMoved = true;
    pinchActive = false;
  }
}

canvas.addEventListener("pointerup", (event) => releasePointer(event, false));
canvas.addEventListener("pointercancel", (event) => releasePointer(event, true));
canvas.addEventListener("pointerleave", () => {
  if (interactivePointers.size === 0) {
    pointerSeen = false;
    pointerWorld.set(0, 0, 0);
    mantaPointerWeight = 0;
    foldHasLastPoint = false;
    markDirectMotion(500);
    cursorSeal.classList.remove("is-visible");
    setHoveredLotus(null);
    renderDirty = true;
  }
});

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const zoom = clamp(event.deltaY, -120, 120);
  orbit.targetRadius = clamp(orbit.targetRadius * Math.exp(zoom * 0.00115), 8.2, maxOrbitRadius);
  orbit.radiusVelocity += zoom * 0.0008;
  markDirectMotion(900);
  if (Math.abs(zoom) > 24) scatterCranes(0.45);
  renderDirty = true;
}, { passive: false });

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

canvas.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const toggleKey = key === "b" || key === "enter" || key === " " || key === "m" || key === "r";
  if (event.ctrlKey || event.metaKey || event.altKey || (event.shiftKey && toggleKey) || (event.repeat && toggleKey)) return;
  let handled = true;
  if (key === "arrowleft" || key === "arrowright" || key === "arrowup" || key === "arrowdown" || key === "+" || key === "=" || key === "-" || key === "_" || key === "r") markDirectMotion(1000);
  const orbitAmount = event.shiftKey ? 0.9 : 0.42;
  if (key === "w" || key === "a" || key === "s" || key === "d") {
    markDirectMotion(1000);
    const panStep = event.shiftKey ? 0.9 : 0.42;
    const rightX = Math.cos(orbit.currentTheta);
    const rightZ = -Math.sin(orbit.currentTheta);
    const forwardX = Math.sin(orbit.currentTheta);
    const forwardZ = Math.cos(orbit.currentTheta);
    if (key === "w") {
      panTarget.x = clamp(panTarget.x + forwardX * panStep, -10, 10);
      panTarget.y = clamp(panTarget.y + forwardZ * panStep, -10, 10);
    } else if (key === "s") {
      panTarget.x = clamp(panTarget.x - forwardX * panStep, -10, 10);
      panTarget.y = clamp(panTarget.y - forwardZ * panStep, -10, 10);
    } else if (key === "a") {
      panTarget.x = clamp(panTarget.x - rightX * panStep, -10, 10);
      panTarget.y = clamp(panTarget.y - rightZ * panStep, -10, 10);
    } else {
      panTarget.x = clamp(panTarget.x + rightX * panStep, -10, 10);
      panTarget.y = clamp(panTarget.y + rightZ * panStep, -10, 10);
    }
  } else if (key === "arrowleft") orbit.targetTheta -= orbitAmount;
  else if (key === "arrowright") orbit.targetTheta += orbitAmount;
  else if (key === "arrowup") orbit.targetPhi = clamp(orbit.targetPhi - orbitAmount * 0.65, 0.48, 1.39);
  else if (key === "arrowdown") orbit.targetPhi = clamp(orbit.targetPhi + orbitAmount * 0.65, 0.48, 1.39);
  else if (key === "+" || key === "=") orbit.targetRadius = clamp(orbit.targetRadius - 1, 8.2, maxOrbitRadius);
  else if (key === "-" || key === "_") orbit.targetRadius = clamp(orbit.targetRadius + 1, 8.2, maxOrbitRadius);
  else if (key === "b") cycleKeyboardLotus();
  else if (key === "enter") closeKeyboardLotus();
  else if (event.code === "Space") setPaused(!paused);
  else if (key === "m") setMood(activeMood === "dawn" ? "midnight" : "dawn");
  else if (key === "r") resetScene();
  else handled = false;
  if (handled) event.preventDefault();
});

for (const button of moodButtons) button.addEventListener("click", () => setMood(button.dataset.mood));
motionButton.addEventListener("click", () => setPaused(!paused));
fieldMenu.addEventListener("click", toggleFieldMenu);

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const nextProfile = viewProfileFor(width, height);
  const profileChanged = nextProfile.category !== viewProfile.category;
  viewProfile = nextProfile;
  defaultPhi = nextProfile.phi;
  defaultRadius = nextProfile.radius;
  camera.fov = nextProfile.fov;
  cameraTarget.y = nextProfile.targetY;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (profileChanged) {
    orbit.targetPhi = nextProfile.phi;
    orbit.targetRadius = clamp(nextProfile.radius, 8.2, maxOrbitRadius);
    orbit.phiVelocity = 0;
    orbit.radiusVelocity = 0;
    markDirectMotion(1200);
  }
  quality.maxDpr = Math.min(width < 760 ? 1.25 : 1.4, viewportDprLimit(width, height));
  const deviceDprLimit = Math.min(quality.maxDpr, window.devicePixelRatio || 1);
  quality.minDpr = Math.min(0.8, deviceDprLimit);
  quality.dpr = clamp(Math.min(quality.dpr, deviceDprLimit), Math.min(quality.minDpr, deviceDprLimit), deviceDprLimit);
  renderer.setPixelRatio(quality.dpr);
  renderer.setSize(width, height);
  quality.sampleTime = 0;
  renderDirty = true;
}

window.addEventListener("resize", resize, { passive: true });
motionPreference.addEventListener?.("change", (event) => {
  reducedMotion = event.matches;
  if (reducedMotion) setPaused(true, false);
  renderDirty = true;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    for (const pointerId of interactivePointers.keys()) {
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    }
    interactivePointers.clear();
    primaryPointer = null;
    primaryMode = "fold";
    pinchActive = false;
    gestureHadPinch = false;
    pointerMoved = false;
    pointerDownLotus = null;
    pointerDownOcean = false;
    activeFoldStroke = null;
    foldHasLastPoint = false;
    pointerSeen = false;
    pointerWorld.set(0, 0, 0);
    mantaPointerWeight = 0;
    hoveredLotus = null;
    keyboardCursorLotus = null;
    cursorSeal.classList.remove("is-visible");
    refreshLotusCursor();
    lastHoverTest = -10;
    lastFoldRaycastAt = -10;
    orbit.thetaVelocity = 0;
    orbit.phiVelocity = 0;
    orbit.radiusVelocity = 0;
    directMotionUntil = 0;
  }
  lastFrameTime = performance.now();
  renderDirty = true;
});
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  renderer.setAnimationLoop(null);
  showFailure("The graphics context was interrupted. Waiting for the graphics driver to restore the paper world.");
});
canvas.addEventListener("webglcontextrestored", () => {
  fallback.hidden = true;
  setSceneUiEnabled(true);
  lastFrameTime = performance.now();
  renderDirty = true;
  renderer.setAnimationLoop(animate);
  announce("The graphics context returned. The paper archipelago is active again.");
});

let cameraInitialized = false;

function updateCamera(delta) {
  if (!primaryPointer && !pinchActive) {
    orbit.targetTheta += orbit.thetaVelocity * delta;
    orbit.targetPhi = clamp(orbit.targetPhi + orbit.phiVelocity * delta, 0.48, 1.39);
    orbit.targetRadius = clamp(orbit.targetRadius + orbit.radiusVelocity * delta, 8.2, maxOrbitRadius);
    const inertia = Math.exp(-4.2 * delta);
    orbit.thetaVelocity *= inertia;
    orbit.phiVelocity *= inertia;
    orbit.radiusVelocity *= inertia;
  } else {
    orbit.thetaVelocity *= 0.7;
    orbit.phiVelocity *= 0.7;
    orbit.radiusVelocity *= 0.7;
  }

  const cameraDamping = reducedMotion ? 13 : 7.5;
  orbit.currentTheta = damp(orbit.currentTheta, orbit.targetTheta, cameraDamping, delta);
  orbit.currentPhi = damp(orbit.currentPhi, orbit.targetPhi, cameraDamping, delta);
  orbit.currentRadius = damp(orbit.currentRadius, orbit.targetRadius, cameraDamping, delta);
  panCurrent.x = damp(panCurrent.x, panTarget.x, 3.2, delta);
  panCurrent.y = damp(panCurrent.y, panTarget.y, 3.2, delta);
  cameraTarget.x = panCurrent.x;
  cameraTarget.z = panCurrent.y;
  const sinPhi = Math.sin(orbit.currentPhi);
  camera.position.set(
    cameraTarget.x + Math.sin(orbit.currentTheta) * sinPhi * orbit.currentRadius,
    cameraTarget.y + Math.cos(orbit.currentPhi) * orbit.currentRadius,
    cameraTarget.z + Math.cos(orbit.currentTheta) * sinPhi * orbit.currentRadius
  );
  camera.lookAt(cameraTarget);

  if (!cameraInitialized) {
    previousCameraPosition.copy(camera.position);
    cameraInitialized = true;
  } else {
    const movement = camera.position.distanceToSquared(previousCameraPosition);
    cameraSpeed = damp(cameraSpeed, Math.sqrt(movement) / Math.max(delta, 0.001), 5, delta);
    if (movement > 0.014) scatterCranes(clamp(cameraSpeed * 0.1, 0.35, 0.7));
    previousCameraPosition.copy(camera.position);
  }
  updateRegionReadout();
}

function stampCreaseSegment(start, end, factor) {
  const segmentX = end.x - start.x;
  const segmentZ = end.z - start.z;
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  if (lengthSquared < 0.0001) return;
  const length = Math.sqrt(lengthSquared);
  const width = Math.max(0.28, (start.width + end.width) * 0.5);
  const radius = width * 2.7 + 0.22;
  const minimumX = Math.max(-creaseFieldSize * 0.5, Math.min(start.x, end.x) - radius);
  const maximumX = Math.min(creaseFieldSize * 0.5, Math.max(start.x, end.x) + radius);
  const minimumZ = Math.max(-creaseFieldSize * 0.5, Math.min(start.z, end.z) - radius);
  const maximumZ = Math.min(creaseFieldSize * 0.5, Math.max(start.z, end.z) + radius);
  const gridMinimumX = clamp(Math.floor((minimumX + creaseFieldSize * 0.5) / creaseFieldStep), 0, creaseFieldResolution - 1);
  const gridMaximumX = clamp(Math.ceil((maximumX + creaseFieldSize * 0.5) / creaseFieldStep), 0, creaseFieldResolution - 1);
  const gridMinimumZ = clamp(Math.floor((minimumZ + creaseFieldSize * 0.5) / creaseFieldStep), 0, creaseFieldResolution - 1);
  const gridMaximumZ = clamp(Math.ceil((maximumZ + creaseFieldSize * 0.5) / creaseFieldStep), 0, creaseFieldResolution - 1);
  const inverseLengthSquared = 1 / lengthSquared;
  const amplitude = (start.impulse + end.impulse) * 0.5 * (start.decay + end.decay) * 0.5;

  for (let gridZ = gridMinimumZ; gridZ <= gridMaximumZ; gridZ += 1) {
    const z = -creaseFieldSize * 0.5 + (gridZ + 0.5) * creaseFieldStep;
    for (let gridX = gridMinimumX; gridX <= gridMaximumX; gridX += 1) {
      const x = -creaseFieldSize * 0.5 + (gridX + 0.5) * creaseFieldStep;
      const offsetX = x - start.x;
      const offsetZ = z - start.z;
      const projection = clamp((offsetX * segmentX + offsetZ * segmentZ) * inverseLengthSquared, 0, 1);
      const closestX = offsetX - segmentX * projection;
      const closestZ = offsetZ - segmentZ * projection;
      const distanceSquared = closestX * closestX + closestZ * closestZ;
      if (distanceSquared > radius * radius) continue;
      const signedSide = Math.tanh((segmentX * closestZ - segmentZ * closestX) / Math.max(0.08, width * 0.58));
      const profile = Math.exp(-distanceSquared / (width * width));
      const fieldIndex = gridZ * creaseFieldResolution + gridX;
      creaseFieldTarget[fieldIndex] += amplitude * profile * signedSide * factor;
    }
  }
}

let lastMantaWakeAt = -10;

function depositMantaWake(x, z, speed) {
  if (sceneTime - lastMantaWakeAt < 0.12 || speed < 0.45) return;
  lastMantaWakeAt = sceneTime;
  const radius = 1.1 + Math.min(0.8, speed * 0.035);
  const amplitude = clamp(speed * 0.0025, 0.004, 0.025);
  const half = creaseFieldSize * 0.5;
  const gridMinimumX = clamp(Math.floor((x - radius + half) / creaseFieldStep), 0, creaseFieldResolution - 1);
  const gridMaximumX = clamp(Math.ceil((x + radius + half) / creaseFieldStep), 0, creaseFieldResolution - 1);
  const gridMinimumZ = clamp(Math.floor((z - radius + half) / creaseFieldStep), 0, creaseFieldResolution - 1);
  const gridMaximumZ = clamp(Math.ceil((z + radius + half) / creaseFieldStep), 0, creaseFieldResolution - 1);
  for (let gridZ = gridMinimumZ; gridZ <= gridMaximumZ; gridZ += 1) {
    const sampleZ = -half + (gridZ + 0.5) * creaseFieldStep;
    for (let gridX = gridMinimumX; gridX <= gridMaximumX; gridX += 1) {
      const sampleX = -half + (gridX + 0.5) * creaseFieldStep;
      const distance = Math.hypot(sampleX - x, sampleZ - z);
      if (distance > radius) continue;
      creaseFieldMemory[gridZ * creaseFieldResolution + gridX] = clamp(creaseFieldMemory[gridZ * creaseFieldResolution + gridX] - amplitude * (1 - distance / radius), -0.72, 0.72);
    }
  }
}

function writeCreaseLineVertex(vertexIndex, x, y, z, alpha, tone) {
  const positionIndex = vertexIndex * 3;
  creaseLinePositions[positionIndex] = x;
  creaseLinePositions[positionIndex + 1] = y;
  creaseLinePositions[positionIndex + 2] = z;
  creaseLineAlpha[vertexIndex] = alpha;
  creaseLineTone[vertexIndex] = tone;
}

function updateCreaseLines() {
  creaseLineAlpha.fill(0);
  let vertexCursor = 0;
  for (const stroke of creaseStrokes) {
    if (!stroke.active || stroke.count < 2) continue;
    const progress = clamp(stroke.age / stroke.life, 0, 1);
    const persistence = 1 - progress;
    for (let pointIndex = 0; pointIndex < stroke.count - 1; pointIndex += 1) {
      const start = stroke.points[pointIndex];
      const end = stroke.points[pointIndex + 1];
      const deltaX = end.x - start.x;
      const deltaZ = end.z - start.z;
      const length = Math.hypot(deltaX, deltaZ);
      if (length < 0.001) continue;
      const normalX = -deltaZ / length;
      const normalZ = deltaX / length;
      const midpointX = (start.x + end.x) * 0.5;
      const midpointZ = (start.z + end.z) * 0.5;
      const y = 0.1 + sampleCreaseField(midpointX, midpointZ) * 1.18;
      const width = 0.01 + (start.impulse + end.impulse) * 0.028;
      const impulse = (start.impulse + end.impulse) * 0.5;
      const alpha = clamp((0.08 + impulse * 1.15) * (0.12 + persistence * 0.72), 0, 0.55);
      const highlightTone = start.sign > 0 ? 1 : 0.86;
      const shadowTone = start.sign > 0 ? 0.08 : 0.22;
      writeCreaseLineVertex(vertexCursor++, start.x + normalX * width, y, start.z + normalZ * width, alpha, highlightTone);
      writeCreaseLineVertex(vertexCursor++, start.x - normalX * width, y, start.z - normalZ * width, alpha, shadowTone);
      writeCreaseLineVertex(vertexCursor++, end.x + normalX * width, y, end.z + normalZ * width, alpha, highlightTone);
      writeCreaseLineVertex(vertexCursor++, end.x + normalX * width, y, end.z + normalZ * width, alpha, highlightTone);
      writeCreaseLineVertex(vertexCursor++, end.x - normalX * width, y, end.z - normalZ * width, alpha, shadowTone);
      writeCreaseLineVertex(vertexCursor++, start.x - normalX * width, y, start.z - normalZ * width, alpha, shadowTone);
    }
  }
  creaseLineGeometry.attributes.position.needsUpdate = true;
  creaseLineGeometry.attributes.lineAlpha.needsUpdate = true;
  creaseLineGeometry.attributes.lineTone.needsUpdate = true;
}

function updateCreaseSystem(delta) {
  creaseFieldTarget.fill(0);
  for (const stroke of creaseStrokes) {
    if (!stroke.active) continue;
    stroke.age += delta;
    if (stroke.age >= stroke.life) {
      stroke.active = false;
      continue;
    }
    const factor = Math.pow(1 - stroke.age / stroke.life, 0.72);
    for (let pointIndex = 0; pointIndex < stroke.count - 1; pointIndex += 1) {
      stampCreaseSegment(stroke.points[pointIndex], stroke.points[pointIndex + 1], factor);
    }
  }

  const damping = Math.exp(-6.4 * delta);
  for (let index = 0; index < creaseFieldMemory.length; index += 1) {
    const target = clamp(creaseFieldTarget[index], -0.72, 0.72);
    const velocity = (creaseFieldVelocity[index] + (target - creaseFieldMemory[index]) * 54 * delta) * damping;
    creaseFieldVelocity[index] = velocity;
    creaseFieldMemory[index] += velocity * delta;
  }
  foldEnergy *= Math.exp(-1.25 * delta);
  motionEnergy = damp(motionEnergy, clamp(cameraSpeed * 0.012 + foldEnergy * 0.58, 0, 0.68), 4.2, delta);
}

function clearCreaseMemory() {
  for (const stroke of creaseStrokes) {
    stroke.active = false;
    stroke.age = 0;
    stroke.count = 0;
    stroke.cursor = 0;
  }
  creaseCursor = 0;
  creaseFieldTarget.fill(0);
  creaseFieldMemory.fill(0);
  creaseFieldVelocity.fill(0);
  creaseLinePositions.fill(0);
  creaseLineAlpha.fill(0);
  creaseLineTone.fill(0);
  creaseLineGeometry.attributes.position.needsUpdate = true;
  creaseLineGeometry.attributes.lineAlpha.needsUpdate = true;
  creaseLineGeometry.attributes.lineTone.needsUpdate = true;
  activeFoldStroke = null;
  foldHasLastPoint = false;
  foldEnergy = 0;
  motionEnergy = 0;
  lastMantaWakeAt = -10;
}

function resetScene() {
  clearCreaseMemory();
  orbit.currentTheta = 0.64;
  orbit.currentPhi = defaultPhi;
  orbit.currentRadius = defaultRadius;
  orbit.targetTheta = 0.64;
  orbit.targetPhi = defaultPhi;
  orbit.targetRadius = defaultRadius;
  orbit.thetaVelocity = 0;
  orbit.phiVelocity = 0;
  orbit.radiusVelocity = 0;
  panTarget.set(0, 0);
  panCurrent.set(0, 0);
  cameraTarget.x = 0;
  cameraTarget.z = 0;
  cameraSpeed = 0;
  cameraInitialized = false;
  keyboardLotusIndex = -1;
  hoveredLotus = null;
  keyboardCursorLotus = null;
  cursorSeal.classList.remove("is-blooming");
  for (const lotus of lotusFlowers) {
    lotus.locked = lotus.initialBloom > 0.45;
    lotus.userClosed = false;
    lotus.targetBloom = lotus.initialBloom;
    lotus.bloom = lotus.initialBloom;
  }
  for (const crane of cranes) {
    crane.x = crane.baseX;
    crane.y = crane.baseY;
    crane.z = crane.baseZ;
    crane.vx = 0;
    crane.vy = 0;
    crane.vz = 0;
    crane.energy = 0;
    crane.spin = 0;
  }
  markDirectMotion(900);
  announce("The archipelago, lotuses, cranes, and crease memory were reset.");
}

function updateOcean(delta) {
  const motion = reducedMotion ? 0.32 : 1;
  const positions = oceanGeometry.attributes.position.array;
  const count = oceanVertexCount;
  const damping = Math.exp(-8.4 * delta);
  const ambientGain = motion * (1 + motionEnergy * 0.72);
  const swellSin0 = Math.sin(sceneTime * oceanSwellRate[0]);
  const swellCos0 = Math.cos(sceneTime * oceanSwellRate[0]);
  const swellSin1 = Math.sin(sceneTime * oceanSwellRate[1]);
  const swellCos1 = Math.cos(sceneTime * oceanSwellRate[1]);
  const swellSin2 = Math.sin(sceneTime * oceanSwellRate[2]);
  const swellCos2 = Math.cos(sceneTime * oceanSwellRate[2]);
  const swellSin3 = Math.sin(sceneTime * oceanSwellRate[3]);
  const swellCos3 = Math.cos(sceneTime * oceanSwellRate[3]);
  for (let index = 0; index < count; index += 1) {
    const positionIndex = index * 3;
    const tableIndex = index * oceanSwellTerms;
    const x = oceanBase[positionIndex];
    const z = oceanBase[positionIndex + 2];
    const ambient = (
      (oceanSwellSpace[tableIndex] * swellCos0 + oceanSwellCos[tableIndex] * swellSin0) * oceanSwellGain[0] +
      (oceanSwellSpace[tableIndex + 1] * swellCos1 + oceanSwellCos[tableIndex + 1] * swellSin1) * oceanSwellGain[1] +
      (oceanSwellSpace[tableIndex + 2] * swellCos2 + oceanSwellCos[tableIndex + 2] * swellSin2) * oceanSwellGain[2] +
      (oceanSwellSpace[tableIndex + 3] * swellCos3 + oceanSwellCos[tableIndex + 3] * swellSin3) * oceanSwellGain[3]
    ) * ambientGain;
    const hinge = sampleCreaseField(x, z);
    const lateralScale = 0.16 + Math.abs(hinge) * 0.62;
    const displacedX = x + clamp(creaseGradientX * lateralScale, -0.3, 0.3);
    const displacedZ = z + clamp(creaseGradientZ * lateralScale, -0.3, 0.3);
    const target = ambient + hinge * 1.45;
    const directionalShade = clamp(hinge * 0.9 - creaseGradientX * 0.22 + creaseGradientZ * 0.14, -0.55, 0.75);
    const shadeFactor = 1 + directionalShade;
    const highlight = clamp(directionalShade * 0.16, -0.06, 0.12);
    oceanColors[positionIndex] = clamp(oceanBaseColors[positionIndex] * shadeFactor + highlight, 0, 1);
    oceanColors[positionIndex + 1] = clamp(oceanBaseColors[positionIndex + 1] * shadeFactor + highlight * 0.8, 0, 1);
    oceanColors[positionIndex + 2] = clamp(oceanBaseColors[positionIndex + 2] * shadeFactor, 0, 1);
    const velocity = (oceanVelocity[index] + (target - oceanDisplacement[index]) * 76 * delta) * damping;
    oceanVelocity[index] = velocity;
    oceanDisplacement[index] += velocity * delta;
    positions[positionIndex] = displacedX;
    positions[positionIndex + 1] = oceanDisplacement[index];
    positions[positionIndex + 2] = displacedZ;
  }
  oceanGeometry.attributes.position.needsUpdate = true;
  oceanGeometry.attributes.color.needsUpdate = true;
}

function updateManta(delta) {
  let hasPointer = false;
  if (pointerSeen) {
    raycaster.setFromCamera(pointerNdc, camera);
    hasPointer = Boolean(raycaster.ray.intersectPlane(pointerPlane, pointerWorld));
  }

  const pathTime = sceneTime * 0.24;
  const pathX = Math.sin(pathTime) * 5.2 + Math.sin(pathTime * 2 + 1.1) * 0.7;
  const pathY = 4.35 + Math.sin(pathTime * 0.72 + 0.4) * 1.25;
  const pathZ = Math.cos(pathTime) * 4.4 + Math.cos(pathTime * 0.46 + 1.4) * 1.1;
  const pathVelocityX = Math.cos(pathTime) * 5.2 + Math.cos(pathTime * 2 + 1.1) * 1.4;
  const pathVelocityZ = -Math.sin(pathTime) * 4.4 - Math.sin(pathTime * 0.46 + 1.4) * 0.5;
  const pointerX = hasPointer ? clamp(pointerWorld.x * 0.5, -5.2, 5.2) : pathX;
  const pointerZ = hasPointer ? clamp(pointerWorld.z * 0.46, -4.6, 4.6) : pathZ;
  mantaPointerWeight = damp(mantaPointerWeight, hasPointer ? 1 : 0, hasPointer ? 5 : 2.4, delta);
  const targetX = pathX + (pointerX - pathX) * mantaPointerWeight;
  const targetY = pathY + (4.15 - pathY) * mantaPointerWeight;
  const targetZ = pathZ + (pointerZ - pathZ) * mantaPointerWeight;
  const oldX = manta.position.x;
  const oldY = manta.position.y;
  const oldZ = manta.position.z;
  const follow = reducedMotion ? 2.6 : 3.6;
  manta.position.x = damp(manta.position.x, targetX, follow, delta);
  manta.position.y = damp(manta.position.y, targetY, 2.8, delta);
  manta.position.z = damp(manta.position.z, targetZ, follow, delta);
  const velocityX = (manta.position.x - oldX) / Math.max(delta, 0.001);
  const velocityZ = (manta.position.z - oldZ) / Math.max(delta, 0.001);
  const pointerSpeed = Math.hypot(velocityX, velocityZ);
  depositMantaWake(manta.position.x, manta.position.z, pointerSpeed);
  const pathYaw = Math.atan2(-pathVelocityX, -pathVelocityZ);
  const targetYaw = mantaPointerWeight > 0.08 && pointerSpeed > 0.16 ? Math.atan2(-velocityX, -velocityZ) : pathYaw;
  const pathRoll = clamp(-pathVelocityX * 0.035 + Math.sin(pathTime * 1.7) * 0.07, -0.32, 0.32);
  const targetRoll = mantaPointerWeight > 0.08 ? clamp(-velocityX * 0.08, -0.38, 0.38) : pathRoll;
  manta.rotation.y = damp(manta.rotation.y, targetYaw, 3.1, delta);
  manta.rotation.x = damp(manta.rotation.x, clamp(pathVelocityZ * 0.03, -0.18, 0.18), 3.6, delta);
  manta.rotation.z = damp(manta.rotation.z, targetRoll, 4.2, delta);
  const flap = reducedMotion ? 0.02 : 0.062;
  const flapMotion = Math.sin(sceneTime * 2.15 + Math.sin(pathTime) * 0.4) * flap;
  const counterFlap = Math.sin(sceneTime * 2.15 + Math.sin(pathTime) * 0.4 + 0.65) * flap;
  leftWingPivot.rotation.z = flapMotion + targetRoll * 0.08;
  rightWingPivot.rotation.z = -counterFlap - targetRoll * 0.08;
  mantaShadow.position.x = manta.position.x;
  mantaShadow.position.z = manta.position.z;
  mantaShadow.position.y = 0.17 + (manta.position.y - oldY) * 0.04;
  mantaShadow.scale.set(1.8 + Math.max(0, manta.position.y - 3.4) * 0.07, 0.9, 1);
  shadowMaterial.opacity = clamp(0.11 - Math.max(0, manta.position.y - 3.6) * 0.011, 0.04, 0.11);
}

function updateLotus(delta) {
  for (let index = 0; index < lotusFlowers.length; index += 1) {
    const lotus = lotusFlowers[index];
    const hoverPreview = hoveredLotus === lotus && !lotus.userClosed;
    const target = lotus.locked || hoverPreview ? 1 : lotus.targetBloom;
    lotus.bloom = damp(lotus.bloom, target, reducedMotion ? 8 : 4.3, delta);
    const unfurl = 1 - Math.pow(1 - lotus.bloom, 3);
    const creaseResponse = sampleCreaseField(lotus.baseX, lotus.baseZ);
    const bob = Math.sin(sceneTime * 0.82 + lotus.phase) * (reducedMotion ? 0.015 : 0.045) + creaseResponse * 0.08;
    const yaw = lotus.baseYaw + Math.sin(sceneTime * 0.19 + index) * 0.08;
    const flowerScale = 1.04 + unfurl * 0.12;

    for (const petal of lotus.petals) {
      const closedPitch = -1.38;
      const openPitch = petal.inner ? -0.36 : -0.045;
      const flutter = (reducedMotion ? 0.008 : Math.sin(sceneTime * 1.45 + petal.phase) * 0.025 * lotus.bloom) + creaseResponse * 0.12;
      const scale = petal.scale * flowerScale;
      lotusTransform.position.set(lotus.baseX, lotus.baseY + bob + petal.pivotY, lotus.baseZ);
      lotusTransform.rotation.set(closedPitch + (openPitch - closedPitch) * unfurl + flutter, yaw + petal.baseYaw, 0, "YXZ");
      lotusTransform.scale.setScalar(scale);
      lotusTransform.updateMatrix();
      lotusPetalInstances.setMatrixAt(petal.instanceIndex, lotusTransform.matrix);
    }

    lotusTransform.position.set(lotus.baseX, lotus.baseY + bob + 0.035, lotus.baseZ);
    lotusTransform.rotation.set(0, yaw, 0);
    lotusTransform.scale.setScalar(flowerScale);
    lotusTransform.updateMatrix();
    lotusBaseInstances.setMatrixAt(index, lotusTransform.matrix);

    lotusTransform.position.set(lotus.baseX, lotus.baseY + bob + 0.2 + unfurl * 0.18, lotus.baseZ);
    lotusTransform.rotation.set(0, sceneTime * 0.16 + index, 0);
    lotusTransform.scale.set(flowerScale, flowerScale * 0.62, flowerScale);
    lotusTransform.updateMatrix();
    lotusHeartInstances.setMatrixAt(index, lotusTransform.matrix);
  }
  lotusPetalInstances.instanceMatrix.needsUpdate = true;
  lotusBaseInstances.instanceMatrix.needsUpdate = true;
  lotusHeartInstances.instanceMatrix.needsUpdate = true;
}

function updateCranes(delta) {
  const motion = reducedMotion ? 0.28 : 1;
  const drag = Math.exp(-1.7 * delta);
  for (let index = 0; index < cranes.length; index += 1) {
    const crane = cranes[index];
    const creaseResponse = sampleCreaseField(crane.x, crane.z);
    crane.energy = Math.min(1.4, crane.energy + Math.abs(creaseResponse) * 0.45);
    crane.vy += creaseResponse * 0.6 * delta;
    crane.vx += (crane.baseX - crane.x) * 3.4 * delta;
    crane.vy += (crane.baseY - crane.y) * 3.1 * delta;
    crane.vz += (crane.baseZ - crane.z) * 3.4 * delta;
    crane.vx *= drag;
    crane.vy *= drag;
    crane.vz *= drag;
    crane.x += crane.vx * delta;
    crane.y += crane.vy * delta;
    crane.z += crane.vz * delta;
    crane.energy *= Math.exp(-1.1 * delta);
    crane.spin *= Math.exp(-1.35 * delta);
    const flight = Math.sin(sceneTime * (1.4 + index * 0.025) + crane.phase) * 0.16 * motion;
    const wingBeat = Math.sin(sceneTime * (4.1 + crane.energy * 4) + crane.phase) * (0.04 + crane.energy * 0.08) * motion;
    craneTransform.position.set(crane.x, crane.y + flight, crane.z);
    craneTransform.rotation.set(
      clamp(crane.vz * 0.045, -0.22, 0.22),
      crane.baseYaw + Math.sin(sceneTime * 0.4 + crane.phase) * 0.24 + crane.spin,
      clamp(-crane.vx * 0.12, -0.55, 0.55) + Math.sin(sceneTime * 1.2 + crane.phase) * 0.08 * motion,
      "YXZ"
    );
    craneTransform.scale.set((1 + wingBeat) * 1.24, (1 - wingBeat * 0.45) * 1.24, (1 + wingBeat * 0.2) * 1.24);
    craneTransform.updateMatrix();
    craneInstances.setMatrixAt(index, craneTransform.matrix);
  }
  craneInstances.instanceMatrix.needsUpdate = true;
}

function updateIslands(delta) {
  const motion = reducedMotion ? 0.1 : 1 + motionEnergy * 0.35;
  for (let index = 0; index < islands.length; index += 1) {
    const island = islands[index];
    island.group.position.y = island.baseY + Math.sin(sceneTime * 0.45 + island.phase) * 0.025 * motion;
    island.group.rotation.y = island.rotation + Math.sin(sceneTime * 0.18 + island.phase) * 0.025 * motion;
  }
}

function updateMood(delta) {
  const target = moods[activeMood];
  const blend = 1 - Math.exp(-3.1 * delta);
  scene.background.lerp(target.background, blend);
  scene.fog.color.copy(scene.background);
  skyMaterial.uniforms.uTop.value.lerp(target.skyTop, blend);
  skyMaterial.uniforms.uHorizon.value.lerp(target.background, blend);
  skyMaterial.uniforms.uBottom.value.lerp(target.skyBottom, blend);
  hemiLight.color.lerp(target.hemiSky, blend);
  hemiLight.groundColor.lerp(target.hemiGround, blend);
  ambientLight.color.lerp(target.hemiSky, blend);
  keyLight.color.lerp(target.key, blend);
  rimLight.color.lerp(target.rim, blend);
  vermilionLight.color.lerp(target.vermilion, blend);
  focalLight.color.lerp(target.gold, blend);
  sunMaterial.color.lerp(target.gold, blend);
  sunHaloMaterial.color.lerp(target.gold, blend);
  sunRing.material.color.lerp(target.gold, blend);
  shadowMaterial.color.lerp(target.under, blend);
  contactShadowMaterial.color.lerp(target.under, blend);
  horizon.applyMood(activeMood, blend);
  atmosphere.applyMood(activeMood, blend);
  creaseLineMaterial.uniforms.uColor.value.lerp(target.gold, blend);
  creaseLineMaterial.uniforms.uShadow.value.lerp(target.indigo, blend);
  renderer.toneMappingExposure = damp(renderer.toneMappingExposure, target.exposure, 3.1, delta);
  for (const state of materialStates) {
    const materialTarget = activeMood === "dawn" ? state.day : state.night;
    state.material.color.lerp(materialTarget, blend);
    state.material.emissive.copy(state.material.color).multiplyScalar(0.025 * state.emissiveStrength);
  }
}

function updateAdaptiveQuality(frameMilliseconds) {
  if (frameMilliseconds <= 0 || frameMilliseconds > 90) return;
  quality.averageFrameMs += (frameMilliseconds - quality.averageFrameMs) * 0.055;
  quality.sampleTime += frameMilliseconds / 1000;
  if (quality.sampleTime < 2.5) return;
  let nextDpr = quality.dpr;
  if (quality.averageFrameMs > 20.5 && quality.dpr > quality.minDpr) nextDpr = Math.max(quality.minDpr, quality.dpr - 0.15);
  else if (quality.averageFrameMs < 16.8 && quality.dpr < quality.maxDpr) nextDpr = Math.min(quality.maxDpr, quality.dpr + 0.1);
  if (Math.abs(nextDpr - quality.dpr) > 0.01) {
    quality.dpr = nextDpr;
    renderer.setPixelRatio(quality.dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  quality.sampleTime = 0;
  quality.averageFrameMs = 18;
}

function animate() {
  const now = performance.now();
  const rawDelta = Math.max(0, (now - lastFrameTime) / 1000);
  const frameMilliseconds = Math.min(rawDelta * 1000, 90);
  lastFrameTime = now;
  const moodTransitioning = now < uiTransitionUntil;
  const directActive = now < directMotionUntil;
  if (paused && !renderDirty && !moodTransitioning && !directActive) return;
  if (!paused) updateAdaptiveQuality(frameMilliseconds);

  const directDelta = directActive ? Math.min(rawDelta, 0.033) : 0;
  const sceneDelta = paused ? directDelta : Math.min(rawDelta, 0.033);
  if (!paused) sceneTime += sceneDelta;
  updateCamera(sceneDelta);
  updateCreaseSystem(sceneDelta);
  updateOcean(sceneDelta);
  updateManta(sceneDelta);
  updateLotus(sceneDelta);
  updateCranes(sceneDelta);
  if (!paused) {
    updateIslands(sceneDelta);
    landmarks.update(sceneTime, reducedMotion ? 0.12 : 1 + motionEnergy * 0.3);
    horizon.update(sceneTime, orbit.currentTheta);
    atmosphere.update(sceneTime, { reducedMotion, motionEnergy, foldEnergy });
  }
  updateContactShadows();
  updateMood(moodTransitioning ? Math.min(rawDelta, 0.033) : paused ? 0 : sceneDelta);
  sunRoot.quaternion.copy(camera.quaternion);
  if (keyboardCursorLotus && !hoveredLotus) {
    camera.updateMatrixWorld();
    projectKeyboardCursor(keyboardCursorLotus);
  }

  renderer.render(scene, camera);
  renderDirty = moodTransitioning || (paused && directActive);
  if (!revealed) {
    revealed = true;
    startupComplete = true;
    window.requestAnimationFrame(() => document.body.classList.add("is-ready"));
  }
}

scheduleWorldSettle();
setPaused(paused, false);
lastFrameTime = performance.now();
renderer.setAnimationLoop(animate);
