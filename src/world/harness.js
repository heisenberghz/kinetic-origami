export const travelPresets = {
  cathedral: { x: -14, z: -14.6, yaw: 0 },
  lagoon: { x: -30, z: 11.6, yaw: 0 },
  shoals: { x: 28, z: 12.6, yaw: Math.PI },
  open: { x: 0, z: 0, yaw: 0.5 }
};

function numberParam(params, key, scale = 1) {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value * scale : null;
}

function pairParam(params, key) {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") return null;
  const parts = raw.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 2 || !parts.every((value) => Number.isFinite(value))) return null;
  return { x: parts[0], z: parts[1] };
}

export function readHarnessParams(search) {
  const params = new URLSearchParams(search);
  const at = params.get("at");
  const go = params.get("go");
  const mood = params.get("mood");
  return {
    at: pairParam(params, "at"),
    go: go && travelPresets[go] ? go : null,
    mood: mood === "midnight" || mood === "dawn" ? mood : null,
    yaw: numberParam(params, "yaw", Math.PI / 180),
    pitch: numberParam(params, "pitch", Math.PI / 180),
    speed: numberParam(params, "speed"),
    look: params.get("look") === "flip" ? -1 : params.get("look") === "normal" ? 1 : null,
    stats: params.has("stats")
  };
}

export function createStatsPanel(document) {
  const panel = document.createElement("div");
  panel.setAttribute("aria-hidden", "true");
  panel.style.cssText = [
    "position:fixed",
    "top:12px",
    "right:12px",
    "z-index:6",
    "padding:9px 12px",
    "border-radius:7px",
    "pointer-events:none",
    "white-space:pre",
    'font:11px/1.55 "Cascadia Mono","SFMono-Regular","Liberation Mono",monospace',
    "letter-spacing:.02em",
    "color:#f6ecd6",
    "background:rgba(22,18,14,.74)",
    "box-shadow:0 2px 14px rgba(0,0,0,.28)"
  ].join(";");
  document.body.appendChild(panel);

  let average = 16.7;
  let since = 0;
  let header = "harness";
  let draws = 0;
  let triangles = 0;
  let dpr = 0;
  let x = 0;
  let z = 0;
  let yawDegrees = 0;
  let pitchDegrees = 0;
  let speed = 0;

  function render() {
    panel.textContent = [
      header,
      `fps    ${(1000 / average).toFixed(1)}`,
      `frame  ${average.toFixed(2)} ms`,
      `draws  ${draws}`,
      `tris   ${triangles}`,
      `dpr    ${dpr.toFixed(2)}`,
      `at ${x.toFixed(1)}, ${z.toFixed(1)}  spd ${speed.toFixed(1)}`,
      `yaw ${yawDegrees}  pitch ${pitchDegrees}`
    ].join("\n");
  }

  return {
    setHeader(text) { header = text; },
    setPresence(presenceState) {
      x = presenceState.x;
      z = presenceState.z;
      speed = Math.hypot(presenceState.velocityX, presenceState.velocityZ);
      yawDegrees = Math.round((presenceState.yaw * 180) / Math.PI);
      pitchDegrees = Math.round((presenceState.pitch * 180) / Math.PI);
    },
    sample(info, currentDpr) { draws = info.render.calls; triangles = info.render.triangles; dpr = currentDpr; },
    update(frameMilliseconds) {
      if (frameMilliseconds <= 0 || frameMilliseconds > 500) return;
      average += (frameMilliseconds - average) * 0.08;
      since += frameMilliseconds;
      if (since < 250) return;
      since = 0;
      render();
    }
  };
}
