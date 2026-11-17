/* Watermarks XR — overlay: the Water Towers at the Red Gate.
   It opens with the stone walls as they stand. "Inside" turns them to glass so the machinery shows: the water wheel, the
   pumps, and the water rising in the towers. Two controls: Inside on or off, and the flow running or paused. */
import { THREE, GL, loadModel, orbit, disposeTree, frame, clamp, ease, asset } from './kit.js';

const MODEL = { path: 'models/towers.glb', bytes: 1828852 };
const TARGET = new THREE.Vector3(-1, 10, 0),
  FROM = new THREE.Vector3(35, 12, 38).normalize(),
  RADIUS = 18.5;
const GROUND = { names: ['CTX_Ground', 'CTX_Path'], centre: [-3, 0], from: 15, to: 31 }; // the lawn and path fade out in a ring around the towers (metres), so they stand like a model on the app's black

/* make a ground material fade to nothing with distance from the towers */
function ringFade(mat) {
  mat.transparent = true;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRing = { value: new THREE.Vector4(GROUND.centre[0], GROUND.centre[1], GROUND.from, GROUND.to) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRingXZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvRingXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRingXZ;\nuniform vec4 uRing;')
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\ngl_FragColor.a *= 1.0 - smoothstep(uRing.z, uRing.w, distance(vRingXZ, uRing.xy));'
      );
  };
  mat.customProgramCacheKey = () => 'ring';
  return mat;
}

/** Fetch the model ahead of time (the camera screen calls this as soon as the drawing is recognised), so Explore opens without a wait. */
export const preload = () =>
  fetch(asset(MODEL.path))
    .then((r) => r.arrayBuffer())
    .catch(() => {});

export async function open(stage, ctx) {
  const gltf = await loadModel(MODEL.path, { bytes: MODEL.bytes, progress: ctx.progress, signal: ctx.signal });
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(45, 1, 0.5, 600),
    root = gltf.scene;
  scene.add(new THREE.HemisphereLight(0xe3efff, 0x6b6250, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.3);
  sun.position.set(30, 45, 25);
  scene.add(sun, root);
  for (const n of GROUND.names) {
    const m = root.getObjectByName(n);
    if (m && m.isMesh) {
      m.material = ringFade(m.material.clone());
      m.renderOrder = -1;
    }
  }

  // the stone walls and their glass twins fade into each other; each group gets materials of its own so nothing else fades with it
  const fade = (name) => {
    const list = [],
      g = root.getObjectByName(name);
    if (g)
      g.traverse((m) => {
        if (!m.isMesh) return;
        m.material = m.material.clone();
        const mt = m.material;
        mt.userData.base = { opacity: mt.opacity, transparent: mt.transparent, depthWrite: mt.depthWrite };
        list.push(m);
      });
    return list;
  };
  const solid = fade('WT_Solid'),
    glassy = fade('WT_Glass');
  const setOpacity = (list, f) => {
    for (const m of list) {
      const mt = m.material,
        b = mt.userData.base,
        fading = f < 0.999;
      mt.opacity = b.opacity * f;
      m.visible = f > 0.01;
      if (mt.transparent !== (fading || b.transparent)) {
        mt.transparent = fading || b.transparent;
        mt.needsUpdate = true;
      }
      mt.depthWrite = fading ? false : b.depthWrite;
    }
  };

  const mixer = new THREE.AnimationMixer(root);
  gltf.animations.forEach((c) => mixer.clipAction(c).play());
  let glass = 0,
    glassTo = 0,
    flowing = true,
    orb = null,
    dist = 80;
  const showGlass = () => {
    setOpacity(solid, 1 - ease(glass));
    setOpacity(glassy, ease(glass));
  };
  showGlass();

  const view = {
    scene,
    camera,
    maxPixelRatio: 2,
    setup(r) {
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.05;
    },
    onSize() {
      dist = frame(view, RADIUS, ctx.inset);
      if (orb) {
        orb.controls.minDistance = dist * 0.3;
        orb.controls.maxDistance = dist * 1.3;
        if (!orb.touched) {
          camera.position.copy(FROM).multiplyScalar(dist).add(TARGET);
          orb.controls.update();
        }
      }
    },
    update(t, dt) {
      const fading = glass !== glassTo;
      if (fading) {
        glass = clamp(glass + (Math.sign(glassTo - glass) * dt) / 1.1);
        showGlass();
      }
      if (flowing) mixer.update(dt);
      const moved = orb.update();
      return flowing || fading || moved || orb.busy;
    }
  };
  camera.position.copy(FROM).multiplyScalar(dist).add(TARGET);
  if (!GL.attach(view, stage)) {
    disposeTree(scene);
    throw new Error('WebGL is not available');
  }
  orb = orbit(view, { target: TARGET, min: 10, max: 140, minPolar: 0.3 });
  view.onSize();

  const walls = {
    id: 'glass',
    icon: 'layers',
    label: 'Inside',
    get on() {
      return glassTo === 1;
    },
    tap() {
      glassTo = glassTo === 1 ? 0 : 1;
      view.invalidate();
    }
  };
  const flow = {
    id: 'flow',
    icon: 'waves',
    label: 'Flow',
    get on() {
      return flowing;
    },
    tap() {
      flowing = !flowing;
      view.invalidate();
    }
  };
  return {
    view,
    buttons: [walls, flow],
    hint: 'Drag to look around',
    destroy() {
      mixer.stopAllAction();
      orb.dispose();
      GL.detach(view);
      disposeTree(scene);
    }
  };
}
