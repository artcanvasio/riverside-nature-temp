/* Watermarks XR — one WebGL renderer for everything drawn in 3D (Home animation, landmark preview, landmark overlays).
   One shared drawing context keeps memory low on small phones, and it only draws while something on screen is moving.

   A view is a plain object:
     { scene, camera,
       update(t, dt)      → return false when nothing is moving, so the loop can stop until view.invalidate() is called
       setup?(renderer)   → tone mapping and the like, applied while this view is attached
       onSize?(w, h)      → the stage changed size (CSS pixels)
       maxPixelRatio?     → cap for this view (default 2)
       lineMats?          → fat-line materials that need the stage size }
   attach() adds: view.w, view.h, view.now and view.invalidate().
   The camera screen draws nothing in 3D, so this renderer is not created there. */
import * as THREE from './vendor/three.module.min.js';

let renderer = null,
  failed = false,
  active = null,
  raf = 0,
  last = 0,
  drawing = false;
let quality = 1; // lowered in steps when frames take too long, never raised again in this visit
const meter = { n: 0, sum: 0, skip: 30 };

export function getRenderer() {
  if (renderer || failed) return renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const c = renderer.domElement;
    c.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    c.addEventListener('webglcontextrestored', () => {
      if (active) {
        size(active);
        active.invalidate();
      }
    });
  } catch (e) {
    failed = true;
    renderer = null;
  }
  return renderer;
}
export const pixelRatio = () => (renderer ? renderer.getPixelRatio() : 1);
export const isActive = (view) => active === view;

function size(view) {
  const el = view.el,
    w = el.clientWidth,
    h = el.clientHeight;
  if (!w || !h) return;
  renderer.setPixelRatio(Math.max(0.6, Math.min(window.devicePixelRatio || 1, view.maxPixelRatio || 2) * quality));
  renderer.setSize(w, h, false);
  view.w = w;
  view.h = h;
  if (view.camera.isPerspectiveCamera) {
    view.camera.aspect = w / h;
    view.camera.updateProjectionMatrix();
  }
  if (view.lineMats) view.lineMats.forEach((m) => m.resolution.set(w, h));
  if (view.onSize) view.onSize(w, h);
}
function frame(ms) {
  raf = 0;
  const v = active;
  if (!v || !v.visible || v.held || document.hidden) return;
  const real = (ms - last) / 1000,
    dt = Math.min(0.1, Math.max(0, real));
  last = ms;
  v.now += dt; // a slow phone keeps real time down to 10 pictures a second; below that, motion slows down instead of jumping
  let moving = false;
  drawing = true;
  try {
    moving = v.update(v.now, dt) !== false;
    renderer.render(v.scene, v.camera);
  } finally {
    drawing = false;
  }
  if (moving) govern(real);
  if ((moving || v.dirty) && !raf) {
    v.dirty = false;
    raf = requestAnimationFrame(frame);
  } // exactly one next picture, however many things asked for it
}
// if the phone cannot keep up, draw fewer pixels instead of dropping frames
function govern(dt) {
  if (meter.skip > 0) {
    meter.skip--;
    return;
  }
  meter.n++;
  meter.sum += dt;
  if (meter.n < 40) return;
  const avg = meter.sum / meter.n;
  meter.n = 0;
  meter.sum = 0;
  if (avg > 0.036 && quality > 0.55 && active) {
    quality = Math.max(0.5, quality * 0.8);
    meter.skip = 20;
    size(active);
  }
}
export function kick() {
  if (drawing) return; // asked from inside a picture being drawn: the loop sees view.dirty and goes on by itself
  if (active && renderer && !raf && active.visible && !active.held && !document.hidden) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}
/** Freeze a view (true) or let it run again (false), for example while a sheet covers it. */
export function hold(view, on) {
  view.held = !!on;
  if (!on) {
    view.dirty = true;
    kick();
  }
}
document.addEventListener('visibilitychange', kick);

export function detach(view) {
  if (!active || (view && view !== active)) return;
  const v = active;
  if (v._ro) v._ro.disconnect();
  if (v._io) v._io.disconnect();
  active = null;
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  if (renderer) {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(0x000000, 0);
    if (renderer.domElement.parentNode) renderer.domElement.remove();
    renderer.renderLists.dispose();
  }
}
/** Show a view inside el. Returns false when WebGL is not available. */
export function attach(view, el) {
  detach();
  const r = getRenderer();
  if (!r) return false;
  active = view;
  view.el = el;
  view.visible = true;
  view.held = false;
  view.dirty = false;
  if (view.now == null) view.now = 0;
  view.invalidate = () => {
    view.dirty = true;
    kick();
  };
  meter.n = 0;
  meter.sum = 0;
  meter.skip = 30;
  r.setClearColor(0x000000, 0);
  if (view.setup) view.setup(r);
  el.appendChild(r.domElement);
  size(view);
  view._ro = new ResizeObserver(() => {
    size(view);
    view.invalidate();
  });
  view._ro.observe(el);
  view._io = new IntersectionObserver((es) => {
    view.visible = es[0].isIntersecting;
    kick();
  });
  view._io.observe(el);
  view.invalidate();
  return true;
}
/** The current picture of a view as a 2D canvas, cropped to `aspect` around the middle and drawn sharp enough for a photo W pixels wide. */
export function snapshot(view, { W = 1080, aspect = 3 / 4, glow = true } = {}) {
  if (!renderer || active !== view || !view.w) return null;
  const pr = renderer.getPixelRatio(),
    fine = Math.min(3, Math.max(pr, W / view.w));
  if (fine > pr) {
    renderer.setPixelRatio(fine);
    renderer.setSize(view.w, view.h, false);
  }
  drawing = true;
  try {
    view.update(view.now, 0);
    renderer.render(view.scene, view.camera);
  } finally {
    drawing = false;
  } // draw and copy in the same task, while the picture is still there
  const src = renderer.domElement,
    sw = src.width,
    sh = src.height,
    ch = Math.min(sh, sw / aspect),
    cw = Math.min(sw, ch * aspect);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = Math.round(W / aspect);
  const x = out.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, out.width, out.height);
  if (glow) {
    const g = x.createRadialGradient(W / 2, out.height * 0.46, 0, W / 2, out.height * 0.46, W * 0.62);
    g.addColorStop(0, 'rgba(77,200,255,.17)');
    g.addColorStop(0.6, 'rgba(77,200,255,.05)');
    g.addColorStop(1, 'rgba(77,200,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, out.width, out.height);
  }
  x.drawImage(src, (sw - cw) / 2, (sh - ch) * 0.46, cw, ch, 0, 0, out.width, out.height);
  if (fine > pr) {
    renderer.setPixelRatio(pr);
    renderer.setSize(view.w, view.h, false);
    view.dirty = true;
    kick();
  }
  return out;
}
