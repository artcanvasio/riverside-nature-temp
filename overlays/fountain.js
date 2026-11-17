/* Watermarks XR — overlay: the Augustus Fountain in white marble and dark bronze.
   It turns slowly; the visitor can pause it and drag to look at it from any side.
   Textures follow the fountain as it turns (they are projected from three sides, so the model needs no texture coordinates). */
import { THREE, GL, loadModel, loadTexture, environment, orbit, disposeTree, frame, asset } from './kit.js';

const MODEL = { path: 'models/fountain.glb', bytes: 1121124 };
const TURN = 30; // seconds for one full turn
const TARGET = new THREE.Vector3(0, 3.3, 0),
  FROM = new THREE.Vector3(15.5, 3.9, 15.5).normalize(),
  RADIUS = 6.8;
const STONE = new Set(['Fountain_Base', 'Centre_Pedestal']),
  WATER = 'Water_Basin';

/* A standard material whose colour comes from a texture projected along the three axes of the fountain.
   map: colour texture (optional) · bumpMap: grey height texture that drifts, for water (optional) · crease: darkens sharp folds a little */
function material(
  shared,
  { color = 0xffffff, map = null, tile = 1, roughness = 0.5, metalness = 0, env = 0.55, crease = 0, bumpMap = null, bump = 0, flow = 0 }
) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: env });
  const u = {
    uTpMap: { value: map },
    uTpBump: { value: bumpMap },
    uTpScale: { value: 1 / tile },
    uBump: { value: bump },
    uFlow: { value: flow },
    uCrease: { value: crease }
  };
  if (map) mat.defines.TP_MAP = '';
  if (bumpMap) mat.defines.TP_BUMP = '';
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, shared);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uRootInv;\nvarying vec3 vTpPos;\nvarying vec3 vTpNrm;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vTpPos = (uRootInv * modelMatrix * vec4(transformed, 1.0)).xyz;
        vTpNrm = normalize(mat3(uRootInv) * mat3(modelMatrix) * objectNormal);`
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uTpMap; uniform sampler2D uTpBump; uniform float uTpScale, uBump, uFlow, uTime, uCrease;
        varying vec3 vTpPos; varying vec3 vTpNrm;
        vec4 tpSample(sampler2D s, vec3 p, vec3 w) { return texture2D(s, p.zy) * w.x + texture2D(s, p.xz) * w.y + texture2D(s, p.xy) * w.z; }
        vec3 tpPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float fd) {
          vec3 sx = dFdx(surfPos), sy = dFdy(surfPos), r1 = cross(sy, surfNorm), r2 = cross(surfNorm, sx);
          float det = dot(sx, r1) * fd; vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
          return normalize(abs(det) * surfNorm - grad); }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 tpW = pow(abs(normalize(vTpNrm)), vec3(4.0)); tpW /= (tpW.x + tpW.y + tpW.z);
        vec3 tpP = vTpPos * uTpScale + vec3(uTime * uFlow, 0.0, uTime * uFlow * 0.6);
        #ifdef TP_MAP
          diffuseColor.rgb *= tpSample(uTpMap, tpP, tpW).rgb;
        #endif`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        #ifdef TP_BUMP
          float tpH = tpSample(uTpBump, tpP, tpW).r;
          normal = tpPerturb(-vViewPosition, normal, vec2(dFdx(tpH), dFdy(tpH)) * uBump, faceDirection);
        #endif
        diffuseColor.rgb *= 1.0 - clamp(length(fwidth(normal)) * uCrease, 0.0, 0.45);`
      );
  };
  mat.customProgramCacheKey = () => `tp${map ? 1 : 0}${bumpMap ? 1 : 0}`;
  return mat;
}

/** Fetch the model ahead of time (the camera screen calls this as soon as the drawing is recognised), so Explore opens without a wait. */
export const preload = () =>
  fetch(asset(MODEL.path))
    .then((r) => r.arrayBuffer())
    .catch(() => {});

export async function open(stage, ctx) {
  const [gltf, marble, ripples] = await Promise.all([
    loadModel(MODEL.path, { bytes: MODEL.bytes, progress: ctx.progress, signal: ctx.signal }),
    loadTexture('overlays/tex/marble.webp'),
    loadTexture('overlays/tex/ripples.webp', { srgb: false })
  ]);
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200),
    pivot = new THREE.Group();
  scene.environment = environment();
  scene.add(new THREE.HemisphereLight(0xf3f1ea, 0x5d5a54, 0.3));
  const sun = new THREE.DirectionalLight(0xfff3df, 2.6);
  sun.position.set(9, 15, 7);
  const rim = new THREE.DirectionalLight(0x9fd8ff, 1.5);
  rim.position.set(-9, 7, -10); // a cool light from behind lifts the dark bronze figures off the black background
  scene.add(sun, rim, pivot);

  const shared = { uRootInv: { value: new THREE.Matrix4() }, uTime: { value: 0 } };
  const stone = material(shared, { map: marble, tile: 3, roughness: 0.13, env: 0.7, crease: 1.1 });
  const bronze = material(shared, { color: 0x17181a, roughness: 0.42, metalness: 0.35, env: 2, crease: 0.4 });
  const water = material(shared, { color: 0x4f8790, roughness: 0.06, env: 1, tile: 1.4, bumpMap: ripples, bump: 0.03, flow: 0.04 });
  const partOf = (o) => {
    for (let p = o; p; p = p.parent) {
      if (STONE.has(p.name)) return stone;
      if (p.name === WATER) return water;
    }
    return bronze;
  };
  gltf.scene.traverse((o) => {
    if (o.isMesh) {
      o.material = partOf(o);
      if (o.material === water) o.renderOrder = 2;
    }
  });
  pivot.add(gltf.scene);

  let playing = !ctx.reduce,
    resumeAt = 0,
    orb = null,
    dist = 22;
  const view = {
    scene,
    camera,
    maxPixelRatio: 2,
    setup(r) {
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 0.95;
    },
    onSize(w) {
      camera.fov = w < 720 ? 46 : 35;
      camera.updateProjectionMatrix();
      dist = Math.min(45, frame(view, RADIUS, ctx.inset));
      if (orb) {
        orb.controls.minDistance = dist * 0.42;
        orb.controls.maxDistance = dist * 1.25;
        if (!orb.touched) {
          camera.position.copy(FROM).multiplyScalar(dist).add(TARGET);
          orb.controls.update();
        }
      }
    },
    update(t, dt) {
      const turning = playing && !orb.busy && t >= resumeAt; // the fountain waits while a finger is on it
      if (turning) pivot.rotation.y = (pivot.rotation.y + (dt * 2 * Math.PI) / TURN) % (2 * Math.PI);
      pivot.updateMatrixWorld();
      shared.uRootInv.value.copy(pivot.matrixWorld).invert();
      shared.uTime.value += dt;
      const moved = orb.update();
      return playing || moved || orb.busy;
    }
  };
  camera.position.copy(FROM).multiplyScalar(dist).add(TARGET);
  if (!GL.attach(view, stage)) {
    disposeTree(scene);
    throw new Error('WebGL is not available');
  }
  orb = orbit(view, { target: TARGET, min: 8, max: 45, minPolar: 0.25 });
  orb.onEnd = () => {
    resumeAt = view.now + 1.2;
  };
  view.onSize(view.w, view.h);

  const spin = {
    id: 'spin',
    get icon() {
      return playing ? 'pause' : 'play';
    },
    get label() {
      return playing ? 'Pause' : 'Turn';
    },
    get on() {
      return playing;
    },
    tap() {
      playing = !playing;
      resumeAt = 0;
      view.invalidate();
    }
  };
  return {
    view,
    buttons: [spin],
    hint: 'Drag to look around',
    destroy() {
      orb.dispose();
      GL.detach(view);
      disposeTree(scene);
      marble.dispose();
      ripples.dispose();
    }
  };
}
