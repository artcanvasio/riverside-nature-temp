/* Watermarks XR — shared helpers for the 3D landmark overlays (fountain.js, towers.js, kanal.js).
   Every overlay module exports one function:

     open(stage, ctx) → Promise<{ view, buttons, hint, destroy() }>

   stage    the element the picture is drawn into
   ctx      { progress(0..1), signal, reduce, inset: { top, bottom }, caption(text), refresh() }
            progress  loading progress for the ring on screen
            signal    AbortSignal: the visitor left while the model was still loading
            reduce    the phone asks for less motion
            inset     pixels at the top and bottom of the stage that are covered by the app's own controls
            caption   one short line of text under the title (the Ice Kanal ride uses it for the gate count)
            refresh   call it when a button changed by itself, so the app redraws the buttons
   view     the object drawn by gl.js (see there)
   buttons  [{ id, icon, label, on, tap() }]  the overlay's own controls, at most two
   hint     one short sentence shown for a few seconds when the overlay opens */
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader, MeshoptDecoder, OrbitControls, RoomEnvironment } from '../vendor/three-extras.min.js';
import * as GL from '../gl.js';

export { THREE, GL };
export const asset = (path) => new URL('../' + path, import.meta.url).href;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ease = (k) => k * k * (3 - 2 * k);

/** Download a .glb (reporting progress) and build it. `bytes` is the file size, for the progress ring. */
export async function loadModel(path, { bytes = 0, progress, signal } = {}) {
  const url = asset(path),
    res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  let data;
  if (progress && res.body && res.body.getReader) {
    const reader = res.body.getReader(),
      parts = [];
    let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      n += value.length;
      progress(bytes ? Math.min(0.92, (0.92 * n) / bytes) : 0.5);
    }
    const all = new Uint8Array(n);
    let o = 0;
    for (const p of parts) {
      all.set(p, o);
      o += p.length;
    }
    data = all.buffer;
  } else data = await res.arrayBuffer();
  if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(data, url.slice(0, url.lastIndexOf('/') + 1));
  if (signal && signal.aborted) {
    disposeTree(gltf.scene);
    throw new DOMException('Aborted', 'AbortError');
  }
  // lights saved inside a model are not used: every overlay brings its own two
  const lights = [];
  gltf.scene.traverse((o) => {
    if (o.isLight) lights.push(o);
  });
  lights.forEach((l) => l.removeFromParent());
  if (progress) progress(1);
  return gltf;
}

export function loadTexture(path, { srgb = true, repeat = true } = {}) {
  return new Promise((res, rej) =>
    new THREE.TextureLoader().load(
      asset(path),
      (t) => {
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
        const r = GL.getRenderer();
        t.anisotropy = r ? Math.min(4, r.capabilities.getMaxAnisotropy()) : 1;
        res(t);
      },
      undefined,
      () => rej(new Error(`${path} could not be loaded`))
    )
  );
}

/* soft studio light for reflections, made once and shared */
let envTex = null;
export function environment() {
  if (envTex) return envTex;
  const r = GL.getRenderer(),
    p = new THREE.PMREMGenerator(r),
    room = new RoomEnvironment(r);
  envTex = p.fromScene(room, 0.04).texture;
  p.dispose();
  room.dispose();
  return envTex;
}

/** Turn and zoom around a fixed point with one or two fingers. Returns { controls, busy, update(), dispose() }. */
export function orbit(view, { target, min, max, minPolar = 0.12, maxPolar = Math.PI * 0.495 }) {
  const dom = GL.getRenderer().domElement,
    c = new OrbitControls(view.camera, dom);
  c.target.copy(target);
  c.enableDamping = true;
  c.dampingFactor = 0.09;
  c.enablePan = false;
  c.rotateSpeed = 0.75;
  c.zoomSpeed = 0.8;
  c.minDistance = min;
  c.maxDistance = max;
  c.minPolarAngle = minPolar;
  c.maxPolarAngle = maxPolar;
  c.update();
  const o = {
    controls: c,
    busy: false,
    touched: false,
    update: () => c.update(),
    dispose: () => {
      c.dispose();
      dom.style.touchAction = '';
    }
  };
  c.addEventListener('start', () => {
    o.busy = true;
    o.touched = true;
    if (view.invalidate) view.invalidate();
  });
  c.addEventListener('end', () => {
    o.busy = false;
    if (o.onEnd) o.onEnd();
  });
  c.addEventListener('change', () => {
    if (view.invalidate) view.invalidate();
  });
  return o;
}

/** Free everything a model holds on the graphics card. */
export function disposeTree(root) {
  const seen = new Set();
  root.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) {
      seen.add(o.geometry);
      o.geometry.dispose();
    }
    for (const m of o.material ? [].concat(o.material) : []) {
      if (seen.has(m)) continue;
      seen.add(m);
      for (const k in m) {
        const v = m[k];
        if (v && v.isTexture && !seen.has(v) && v !== envTex) {
          seen.add(v);
          v.dispose();
        }
      }
      if (m.uniforms)
        for (const k in m.uniforms) {
          const v = m.uniforms[k] && m.uniforms[k].value;
          if (v && v.isTexture && !seen.has(v)) {
            seen.add(v);
            v.dispose();
          }
        }
      m.dispose();
    }
  });
}

/** How far back the camera must be for a ball of radius r to fit the free part of the stage (and shift the picture into that part). */
export function frame(view, r, inset = { top: 0, bottom: 0 }) {
  const cam = view.camera,
    w = view.w || 1,
    h = view.h || 1,
    freeH = Math.max(160, h - inset.top - inset.bottom);
  cam.setViewOffset(w, h, 0, Math.round((inset.bottom - inset.top) / 2), w, h);
  const t = Math.tan((cam.fov * Math.PI) / 360),
    half = Math.min(Math.atan((t * freeH) / h), Math.atan((t * w) / h));
  return r / Math.sin(half);
}
