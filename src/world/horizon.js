export function createHorizon({ THREE, scene, moods }) {
  const geometry = new THREE.CircleGeometry(52, 96);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uNear: { value: moods.dawn.under.clone() },
      uFar: { value: moods.dawn.background.clone() },
      uOpacity: { value: 0.26 }
    },
    vertexShader: `varying float vRadius;
void main(){
vRadius=length(position.xz);
gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`,
    fragmentShader: `uniform vec3 uNear;
uniform vec3 uFar;
uniform float uOpacity;
varying float vRadius;
void main(){
float inner=1.0-smoothstep(14.0,34.0,vRadius);
vec3 color=mix(uFar,uNear,inner);
gl_FragColor=vec4(color,inner*uOpacity);
}`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false
  });
  const paper = new THREE.Mesh(geometry, material);
  paper.position.y = -0.72;
  paper.renderOrder = -2;
  paper.frustumCulled = false;
  scene.add(paper);

  const layers = [];

  function addLayer(dayColor, nightColor, opacity, z, height, phase, parallax) {
    const segments = 84;
    const width = 92;
    const positions = [];
    const fades = [];
    const indices = [];

    for (let index = 0; index <= segments; index += 1) {
      const u = index / segments;
      const x = -width * 0.5 + width * u;
      const ridge = height * (0.42 + Math.sin(u * 37.62 + phase) * 0.18 + Math.sin(u * 13.86 - phase) * 0.12);
      positions.push(x, -1.6, 0, x, -0.15, 0, x, ridge, 0);
      fades.push(0, 1, 1);
      if (index < segments) {
        const current = index * 3;
        const next = current + 3;
        indices.push(current, current + 1, next, current + 1, next + 1, next);
        indices.push(current + 1, current + 2, next + 1, current + 2, next + 2, next + 1);
      }
    }

    const layerGeometry = new THREE.BufferGeometry();
    layerGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    layerGeometry.setAttribute("aFade", new THREE.Float32BufferAttribute(fades, 1));
    layerGeometry.setIndex(indices);
    const layerMaterial = new THREE.MeshBasicMaterial({ color: dayColor, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, fog: true });
    layerMaterial.forceSinglePass = true;
    layerMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aFade;\nvarying float vFade;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFade = aFade;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vFade;")
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= vFade;");
    };
    layerMaterial.customProgramCacheKey = () => "horizon-base-fade";
    const mesh = new THREE.Mesh(layerGeometry, layerMaterial);
    mesh.position.set(0, -0.32, z);
    mesh.renderOrder = -1;
    mesh.frustumCulled = false;
    scene.add(mesh);
    layers.push({ mesh, material: layerMaterial, day: new THREE.Color(dayColor), night: new THREE.Color(nightColor), baseX: 0, baseY: -0.32, phase, parallax });
  }

  addLayer("#5c5346", "#263f4d", 0.2, -22, 5.6, 0.7, 0.45);
  addLayer("#7a6d5b", "#1e3544", 0.15, -30, 7.2, 2.1, 0.8);
  addLayer("#9a8d76", "#182c3b", 0.1, -38, 9.4, 4.3, 1.2);

  function applyMood(activeMood, blend) {
    const target = moods[activeMood];
    material.uniforms.uNear.value.lerp(target.under, blend);
    material.uniforms.uFar.value.lerp(target.background, blend);
    for (let index = 0; index < layers.length; index += 1) {
      layers[index].material.color.lerp(activeMood === "dawn" ? layers[index].day : layers[index].night, blend);
    }
  }

  function update(sceneTime, theta) {
    for (let index = 0; index < layers.length; index += 1) {
      const layer = layers[index];
      layer.mesh.position.x = layer.baseX - theta * layer.parallax + Math.sin(sceneTime * 0.018 + layer.phase) * 0.16;
      layer.mesh.position.y = layer.baseY + Math.sin(sceneTime * 0.07 + layer.phase) * 0.035;
    }
  }

  return { paper, material, layers, applyMood, update };
}
