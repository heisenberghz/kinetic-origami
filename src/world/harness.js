export const posePresets = {
  cathedral: { x: -4, z: -8.6, radius: 15.5 },
  lagoon: { x: -9.6, z: 4.4, radius: 13.5 },
  shoals: { x: 8.6, z: 3.6, radius: 13.5 },
  open: { x: 0, z: 0, radius: 18.5 }
};

function numberParam(params, key, scale = 1) {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value * scale : null;
}

export function readHarnessParams(search) {
  const params = new URLSearchParams(search);
  const pose = params.get("pose");
  const mood = params.get("mood");
  return {
    pose: pose && posePresets[pose] ? pose : null,
    mood: mood === "midnight" || mood === "dawn" ? mood : null,
    theta: numberParam(params, "orbit", Math.PI / 180),
    phi: numberParam(params, "phi", Math.PI / 180),
    radius: numberParam(params, "zoom"),
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
  let radius = 0;
  let theta = 0;

  function render() {
    panel.textContent = [
      header,
      `fps    ${(1000 / average).toFixed(1)}`,
      `frame  ${average.toFixed(2)} ms`,
      `draws  ${draws}`,
      `tris   ${triangles}`,
      `dpr    ${dpr.toFixed(2)}`,
      `r ${radius.toFixed(1)}  th ${theta}  ph ${(phi * 180 / Math.PI).toFixed(0)}`
    ].join("\n");
  }

  let phi = 0;

  return {
    setHeader(text) { header = text; },
    setCamera(currentPhi, currentRadius, currentTheta) {
      phi = currentPhi;
      radius = currentRadius;
      theta = Math.round((currentTheta * 180) / Math.PI);
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
