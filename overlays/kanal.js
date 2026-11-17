/* Watermarks XR — overlay: a ride down the Eiskanal, the Olympic whitewater course.
   One recorded ride (the "Ride" animation in the model, about 105 seconds) seen from two places: the paddler's eyes, or just behind the boat.
   The visitor can pause it, switch between the two views and drag to look around. Turning or tilting the phone itself shifts the view
   a little as well (see LEAN), like leaning in the boat; the view always comes back to straight ahead.
   Only the part of the course near the boat is drawn. */
import { THREE, GL, loadModel, disposeTree, clamp, asset } from './kit.js';
import { watchTurn, hasGyro } from '../motion.js';

const MODEL = { path: 'models/kanal.glb', bytes: 2193376 };
const FPS = 24,
  f2t = (f) => (f - 1) / FPS; // the model's markers are given in animation frames
const SKY = 0xc9dbe3,
  BEHIND = 35,
  AHEAD = 135; // metres of course drawn behind and ahead of the boat
const R = (a, b) => a + Math.random() * (b - a);
/* how the phone's own turning moves the view: a share of the real turn, and never further than a few degrees (in radians: about 11° sideways, 7° up and down) */
const LEAN = { share: 0.55, yaw: 0.2, pitch: 0.13 };
const eased = (v, max) => max * Math.tanh(v / max); // close to v for small turns, levelling off at max

/* The water. In the model it is painted a grey green; the ride shows it as the clear blue of a mountain river. The painted colour
   is turned towards blue, made stronger and a little lighter; white foam stays white. To change the blue, change these numbers. */
const WATER = { turn: 66, deepen: 2, lighten: 1.22 }; // degrees the hue is turned (green towards blue) · how much stronger the colour gets · how much lighter
const WATER_PARTS = ['EK_Whitewater', 'EK_CalmWater']; // the model's two water materials
const waterBlue = (() => {
  const a = (WATER.turn * Math.PI) / 180,
    c = Math.cos(a),
    k = (1 - c) / 3,
    q = Math.sqrt(1 / 3) * Math.sin(a),
    d = WATER.deepen,
    [lr, lg, lb] = [0.2126 * (1 - d), 0.7152 * (1 - d), 0.0722 * (1 - d)];
  const turn = new THREE.Matrix3().set(c + k, k - q, k + q, k + q, c + k, k - q, k - q, k + q, c + k), // the hue turns about the greys, which stay as they are
    deepen = new THREE.Matrix3().set(lr + d, lg, lb, lr, lg + d, lb, lr, lg, lb + d); // … and the colour moves away from grey
  return deepen.multiply(turn).multiplyScalar(WATER.lighten);
})();
const paintBlue = (m) => {
  if (m.userData.blue) return;
  m.userData.blue = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWater = { value: waterBlue };
    sh.fragmentShader =
      'uniform mat3 uWater;\n' +
      sh.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n\tdiffuseColor.rgb = clamp(uWater * diffuseColor.rgb, 0.0, 1.0);'
      );
  };
  m.customProgramCacheKey = () => 'wxr-water-blue';
  m.needsUpdate = true;
};

/* spray: one pool of soft round drops, moved on the processor (cheap at this size) */
class Spray {
  constructor(n) {
    this.n = n;
    this.i = 0;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    const g = (this.geo = new THREE.BufferGeometry()),
      dyn = (a, k) => new THREE.BufferAttribute(a, k).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', dyn(this.pos, 3));
    g.setAttribute('size', dyn(this.size, 1));
    g.setAttribute('alpha', dyn(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 400 } },
      vertexShader:
        'attribute float size; attribute float alpha; varying float vA; uniform float uScale; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = alpha; gl_PointSize = max(1.5, size * uScale / -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader:
        'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(mix(vec3(0.86, 0.95, 1.0), vec3(1.0), 1.0 - d * 2.0), smoothstep(0.5, 0.15, d) * vA); }'
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
  }
  emit(px, py, pz, vx, vy, vz, life, size) {
    const i = this.i,
      k = i * 3;
    this.i = (i + 1) % this.n;
    this.pos[k] = px;
    this.pos[k + 1] = py;
    this.pos[k + 2] = pz;
    this.vel[k] = vx;
    this.vel[k + 1] = vy;
    this.vel[k + 2] = vz;
    this.life[i] = this.max[i] = life;
    this.size[i] = size;
    this.alpha[i] = 0.95;
  }
  clear() {
    this.life.fill(0);
    this.alpha.fill(0);
    this.size.fill(0);
    this.flush();
  }
  flush() {
    const a = this.geo.attributes;
    a.position.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = true;
  }
  update(dt) {
    if (dt <= 0) return;
    const { pos, vel, life, max, size, alpha } = this,
      drag = Math.max(0, 1 - 0.7 * dt);
    for (let i = 0; i < this.n; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const k = i * 3;
      vel[k + 1] -= 9.81 * dt;
      vel[k] *= drag;
      vel[k + 1] *= drag;
      vel[k + 2] *= drag;
      pos[k] += vel[k] * dt;
      pos[k + 1] += vel[k + 1] * dt;
      pos[k + 2] += vel[k + 2] * dt;
      if (life[i] <= 0) {
        alpha[i] = 0;
        size[i] = 0;
      } else alpha[i] = clamp((life[i] / max[i]) * 1.6) * 0.95;
    }
    this.flush();
  }
}

/** Fetch the model ahead of time (the camera screen calls this as soon as the drawing is recognised), so Explore opens without a wait. */
export const preload = () =>
  fetch(asset(MODEL.path))
    .then((r) => r.arrayBuffer())
    .catch(() => {});

export async function open(stage, ctx) {
  const gltf = await loadModel(MODEL.path, { bytes: MODEL.bytes, progress: ctx.progress, signal: ctx.signal });
  const scene = new THREE.Scene(),
    cam = new THREE.PerspectiveCamera(72, 1, 0.05, 2500),
    root = gltf.scene;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 70, 175);
  scene.add(new THREE.HemisphereLight(0xdbeaff, 0x56704a, 1.35));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(-80, 120, 60);
  scene.add(sun, root);

  // read the model: which parts belong to which stretch of the course, where the gates are, where spray starts
  const waterTex = [],
    hideInRider = [],
    chunks = [],
    phases = [],
    gates = [],
    rocks = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const u = o.userData || {};
    if (o.isMesh)
      for (const m of [].concat(o.material)) {
        if (WATER_PARTS.includes(m.name)) paintBlue(m);
        if (m.name === 'EK_Whitewater') {
          for (const t of [m.map, m.normalMap, m.roughnessMap])
            if (t && !waterTex.includes(t)) {
              t.wrapS = t.wrapT = THREE.RepeatWrapping;
              t.anisotropy = 2;
              waterTex.push(t);
            }
          m.roughness = Math.max(m.roughness, 0.35);
        }
      }
    if (u.wxr_unlit && o.isMesh) {
      const src = o.material;
      o.material = new THREE.MeshBasicMaterial({
        map: src.emissiveMap || src.map,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
        depthWrite: false
      });
      src.dispose();
      o.renderOrder = -1;
      o.frustumCulled = false;
    }
    if (u.wxr_hide_in_first_person) hideInRider.push(o);
    if (u.wxr_s_range && !o.name.startsWith('KAYAK')) chunks.push({ o, a: u.wxr_s_range[0], b: u.wxr_s_range[1] });
    if (u.wxr_phase) phases.push({ t0: f2t(u.wxr_frame_start), s: u.wxr_s_start });
    if (u.wxr_gate !== undefined && u.wxr_kind) gates.push({ n: u.wxr_gate, t: f2t(u.wxr_frame), s: u.wxr_s });
    if (u.wxr_fx === 'spray' && o.name.startsWith('FXM_Water')) rocks.push({ pos: o.getWorldPosition(new THREE.Vector3()), acc: Math.random() });
  });
  gates.sort((a, b) => a.t - b.t);
  const rig = root.getObjectByName('KAYAK_Rig'),
    eyes = { rider: root.getObjectByName('CAM_Kayak'), chase: root.getObjectByName('CAM_Chase') };
  const bow = root.getObjectByName('FXM_Bow'),
    blades = [root.getObjectByName('FXM_Blade_L'), root.getObjectByName('FXM_Blade_R')].filter(Boolean);
  const clip = gltf.animations.find((a) => a.name === 'Ride') || gltf.animations[0];
  if (!rig || !eyes.rider || !eyes.chase || !clip) {
    disposeTree(scene);
    throw new Error('The ride is missing from the model');
  }
  // where along the course (metres) the boat is at a given time, read off the phase and gate markers
  const sPts = [[0, 10], ...phases.map((p) => [p.t0, p.s]), ...gates.map((g) => [g.t, g.s])].sort((a, b) => a[0] - b[0]);
  const sAt = (t) => {
    for (let i = 1; i < sPts.length; i++)
      if (t <= sPts[i][0]) {
        const [a, sa] = sPts[i - 1],
          [b, sb] = sPts[i];
        return sa + ((sb - sa) * (t - a)) / Math.max(1e-6, b - a);
      }
    return sPts[sPts.length - 1][1];
  };

  // The clip opens with about 13 s of calm water in the start pool. The ride starts a moment before the first rapids
  // (the 'flow' phase), so it is moving water from the first second.
  const flowAt = (phases.find((p) => p.s >= 40) || { t0: 0 }).t0,
    START = Math.max(0, Math.min(flowAt - 1.5, gates.length ? gates[0].t - 3 : flowAt));
  const mixer = new THREE.AnimationMixer(root),
    action = mixer.clipAction(clip),
    duration = clip.duration;
  action.setLoop(THREE.LoopOnce);
  action.clampWhenFinished = true;
  action.play();
  action.paused = true;
  const spray = new Spray(1600);
  scene.add(spray.points);

  let playing = false,
    finished = false,
    pov = 'rider',
    yaw = 0,
    pitch = 0,
    speed = 0,
    passed = -1,
    settle = 0,
    drag = null,
    started = false,
    leanYaw = 0, // where the phone's turning has the view now …
    leanPitch = 0,
    toYaw = 0, // … and where it is heading
    toPitch = 0;
  const rp = new THREE.Vector3(),
    prevRp = new THREE.Vector3(),
    fwd = new THREE.Vector3(),
    left = new THREE.Vector3(),
    q = new THREE.Quaternion(),
    tq = new THREE.Quaternion(),
    lookQ = new THREE.Quaternion(),
    e = new THREE.Euler(0, 0, 0, 'YXZ');
  const p = new THREE.Vector3(),
    v = new THREE.Vector3(),
    bv = new THREE.Vector3(),
    dummy = new THREE.Object3D(),
    half = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const prevBlade = blades.map(() => new THREE.Vector3()),
    acc = { bow: 0, blade: [0, 0] };

  const seek = (t) => {
    action.time = clamp(t, 0, duration);
    mixer.update(0);
    rig.updateMatrixWorld(true);
    rig.getWorldPosition(prevRp);
    blades.forEach((b, i) => b.getWorldPosition(prevBlade[i]));
    spray.clear();
    passed = gates.filter((g) => g.t < action.time).length - 1;
  };
  const say = () => ctx.caption(finished ? 'Finish' : passed >= 0 ? `Gate ${gates[passed].n} of ${gates.length}` : '');
  const setPlaying = (on) => {
    if (on && action.time >= duration - 0.05) {
      finished = false;
      seek(START);
      say();
    }
    playing = on;
    action.paused = !on;
    started = started || on;
    view.invalidate();
    ctx.refresh();
  };
  const setPov = (k) => {
    pov = k;
    yaw = pitch = 0;
    hideInRider.forEach((o) => {
      o.visible = k !== 'rider';
    });
    view.onSize();
    place(eyes[k], false);
    settle = view.now + 0.5;
    view.invalidate();
  };

  // put the camera at one of the model's two eye points; the horizon is kept level so the ride is easy on the stomach
  function place(node, smooth, dt = 0) {
    node.updateWorldMatrix(true, false);
    node.getWorldPosition(p);
    node.getWorldQuaternion(q);
    fwd.set(0, 0, -1).applyQuaternion(q);
    fwd.y *= 0.35;
    dummy.position.copy(p);
    dummy.up.set(0, 1, 0);
    dummy.lookAt(v.copy(p).add(fwd));
    q.copy(dummy.quaternion).multiply(half);
    tq.copy(q).multiply(lookQ.setFromEuler(e.set(pitch + leanPitch, yaw + leanYaw, 0)));
    if (smooth) {
      const k = 1 - Math.exp(-dt * 11);
      cam.position.lerp(p, k);
      cam.quaternion.slerp(tq, k);
    } else {
      cam.position.copy(p);
      cam.quaternion.copy(tq);
    }
  }
  function emit(dt, waterY) {
    const rate = 260 * clamp(speed / 13, 0.15, 1.3);
    if (bow) {
      acc.bow += rate * dt;
      bow.getWorldPosition(p);
      while (acc.bow >= 1) {
        acc.bow -= 1;
        const side = Math.random() < 0.5 ? 1 : -1,
          a = R(-0.45, 0.35),
          f = (speed / 3.6) * 0.55 + R(-0.3, 0.4),
          l = side * R(0.9, 2.2);
        spray.emit(
          p.x + fwd.x * a + left.x * side * 0.2,
          waterY + 0.03,
          p.z + fwd.z * a + left.z * side * 0.2,
          left.x * l + fwd.x * f,
          R(0.9, 2.5),
          left.z * l + fwd.z * f,
          R(0.45, 0.95),
          R(0.025, 0.06)
        );
      }
    }
    blades.forEach((b, i) => {
      b.getWorldPosition(p);
      bv.copy(p).sub(prevBlade[i]).divideScalar(dt);
      prevBlade[i].copy(p);
      const wet = p.y < waterY + 0.08;
      acc.blade[i] += (wet ? 350 : 15) * dt;
      while (acc.blade[i] >= 1) {
        acc.blade[i] -= 1;
        const x = p.x + R(-0.12, 0.12),
          z = p.z + R(-0.12, 0.12);
        if (wet) {
          const f = -R(0.6, 1.8),
            l = R(-0.6, 0.6);
          spray.emit(
            x,
            Math.max(p.y, waterY + 0.02),
            z,
            fwd.x * f + left.x * l + bv.x * 0.25,
            R(0.6, 1.9) + bv.y * 0.25,
            fwd.z * f + left.z * l + bv.z * 0.25,
            R(0.4, 0.9),
            R(0.02, 0.055)
          );
        } else spray.emit(x, p.y, z, bv.x * 0.55 + R(-0.2, 0.2), bv.y * 0.55 + R(-0.3, 0.2), bv.z * 0.55 + R(-0.2, 0.2), R(0.4, 0.9), R(0.02, 0.03));
      }
    });
    for (const w of rocks) {
      if (w.pos.distanceToSquared(rp) > 60 * 60) continue;
      w.acc += 40 * dt;
      while (w.acc >= 1) {
        w.acc -= 1;
        spray.emit(w.pos.x + R(-0.9, 0.9), w.pos.y, w.pos.z + R(-0.9, 0.9), R(-0.8, 0.8), R(1.2, 3.1), R(-0.8, 0.8), R(0.5, 1.1), R(0.03, 0.07));
      }
    }
  }

  const view = {
    scene,
    camera: cam,
    maxPixelRatio: 1.75,
    setup(r) {
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.05;
    },
    onSize() {
      cam.clearViewOffset();
      cam.fov = pov === 'rider' ? (cam.aspect < 1 ? 88 : 74) : 60;
      cam.updateProjectionMatrix();
      spray.mat.uniforms.uScale.value = ((view.h || 600) * GL.pixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    },
    update(t, rdt) {
      const dt = playing ? rdt : 0;
      if (!started && !ctx.reduce && t > 0.9) setPlaying(true); // the ride sets off by itself
      if (playing) {
        mixer.update(dt);
        if (action.time >= duration - 1e-3) {
          finished = true;
          playing = false;
          action.paused = true;
          say();
          ctx.refresh();
        }
      }
      const time = action.time;
      rig.updateMatrixWorld(true);
      rig.getWorldPosition(rp);
      if (dt > 0) {
        speed += ((rp.distanceTo(prevRp) / dt) * 3.6 - speed) * 0.1;
        for (const tx of waterTex) tx.offset.y -= 0.24 * dt;
      } // the water runs downstream at about 1.2 m/s
      prevRp.copy(rp);
      if (playing && passed + 1 < gates.length && gates[passed + 1].t <= time) {
        passed++;
        say();
      }
      const s = sAt(time);
      for (const c of chunks) c.o.visible = c.b > s - BEHIND && c.a < s + AHEAD;
      rig.getWorldQuaternion(q);
      fwd.set(1, 0, 0).applyQuaternion(q);
      fwd.y = 0;
      fwd.normalize();
      left.set(0, 0, -1).applyQuaternion(q);
      left.y = 0;
      left.normalize();
      if (dt > 0) emit(dt, rp.y - 0.14);
      spray.update(dt);
      const k = 1 - Math.exp(-rdt * 9); // the view follows the phone softly, never in jerks
      leanYaw += (toYaw - leanYaw) * k;
      leanPitch += (toPitch - leanPitch) * k;
      const leaning = Math.abs(toYaw - leanYaw) + Math.abs(toPitch - leanPitch) > 0.0015;
      place(eyes[pov], pov === 'chase', rdt);
      return playing || !!drag || leaning || t < settle || (!started && !ctx.reduce);
    }
  };
  seek(START);
  hideInRider.forEach((o) => {
    o.visible = false;
  });
  place(eyes.rider, false);
  if (!GL.attach(view, stage)) {
    disposeTree(scene);
    throw new Error('WebGL is not available');
  }
  view.onSize();

  // drag to look around (one finger or the mouse)
  const down = (ev) => {
    if (ev.target.closest('button,a')) return;
    drag = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
    view.invalidate();
  };
  const move = (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const k = pov === 'rider' ? 0.0045 : 0.006;
    yaw = clamp(yaw - (ev.clientX - drag.x) * k, -2.4, 2.4);
    pitch = clamp(pitch - (ev.clientY - drag.y) * k, -1.1, 0.9);
    drag.x = ev.clientX;
    drag.y = ev.clientY;
    view.invalidate();
  };
  const up = (ev) => {
    if (drag && ev.pointerId === drag.id) {
      drag = null;
      settle = view.now + 0.5;
      view.invalidate();
    }
  };
  const was = stage.style.touchAction;
  stage.style.touchAction = 'none';
  stage.addEventListener('pointerdown', down);
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  // turn or tilt the phone to lean (the app has asked for the motion sensor together with the camera; without it, nothing happens here)
  const leans = !ctx.reduce && ctx.motion !== false; // the visitor can switch this off under Settings › Permissions
  const stopLean = !leans
    ? () => {}
    : watchTurn((turn, tip) => {
        toYaw = eased(turn * LEAN.share, LEAN.yaw);
        toPitch = eased(tip * LEAN.share, LEAN.pitch);
        if (Math.abs(toYaw - leanYaw) + Math.abs(toPitch - leanPitch) > 0.0015) view.invalidate();
      });

  const play = {
    id: 'play',
    get icon() {
      return playing ? 'pause' : 'play';
    },
    get label() {
      return playing ? 'Pause' : finished ? 'Again' : 'Ride';
    },
    get on() {
      return playing;
    },
    tap() {
      setPlaying(!playing);
    }
  };
  const eye = {
    id: 'pov',
    icon: 'eye',
    get label() {
      return pov === 'rider' ? 'Rider view' : 'Chase view';
    },
    tap() {
      setPov(pov === 'rider' ? 'chase' : 'rider');
    }
  };
  return {
    view,
    buttons: [play, eye],
    hint: hasGyro() && leans ? 'Drag or turn your phone to look around' : 'Drag to look around',
    immersive: true,
    seek: (t) => {
      finished = false;
      seek(t);
      say();
      view.invalidate();
    }, // seek: jump to a time in the ride (used by the tests)
    lean: (turn, tip) => {
      toYaw = eased(turn * LEAN.share, LEAN.yaw);
      toPitch = eased(tip * LEAN.share, LEAN.pitch);
      view.invalidate();
      return [toYaw, toPitch];
    }, // lean: turn the view as the phone would (used by the tests)
    destroy() {
      stopLean();
      stage.removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      stage.style.touchAction = was;
      mixer.stopAllAction();
      GL.detach(view);
      disposeTree(scene);
      spray.geo.dispose();
      spray.mat.dispose();
    }
  };
}
