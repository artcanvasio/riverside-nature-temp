/* Riverside Nature — the scene behind the round window. Loaded by index.html in this folder.
   The painted landscape turns behind a fixed round window: turn the phone, or drag, to look around. That is always on
   (there is no button for it); the app has asked for the motion sensor together with the camera. */
import * as THREE from '../../vendor/three.module.min.js';
import { ic } from '../../icons.js';
import { askMotion, hasGyro, findGyro } from '../../motion.js';

/* inside the Watermarks XR app (the address ends in ?embed) the app shows the title and passes on the room the phone's notch and home bar need */
const PARAMS = new URLSearchParams(location.search), EMBED = PARAMS.has('embed'), DEV = PARAMS.has('dev');
const TURN = PARAMS.get('turn') !== '0';   // "turn the phone to look around" can be switched off in the app's settings; dragging always works
if (EMBED) { const d = document.documentElement; d.classList.add('embed'); for (const k of ['sat', 'sab']) { const v = parseFloat(PARAMS.get(k)); if (v >= 0 && v < 200) d.style.setProperty('--' + k, v + 'px'); } }

const $ = (id) => document.getElementById(id);
let toastT;
// a short line above the buttons: a message in a pill, or (plain) a quiet hint like the ones under the other landmarks
// (the "Sound credits" link shares that line, and steps aside while a message is up)
function toast(m, ms = 2600, plain = false) {
  const t = $('toast'), c = $('credits'); t.textContent = m; t.classList.toggle('plain', plain); t.hidden = false; c.classList.add('wait');
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; c.classList.remove('wait'); }, ms);
}

/* ---------- world scale: the window (radius 1000 design units) is 0.6 m wide in the room ---------- */
const BRAND = 0x51eccf;  // the app's one colour
const RW = 0.6;          // window radius in metres
const DE = 1.3;          // design eye distance: from here every layer lines up exactly with the painting
const EYE_NEAR = 0.66;   // closest the viewer can step
let L;                   // layout.json

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 1);
$('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 300);
const rig = new THREE.Group(); scene.add(rig); rig.add(camera);
const world = new THREE.Group(); scene.add(world);
// the painted landscape hangs from a pivot at the viewer's eye, so it can turn behind the fixed window like a panorama
const pano = new THREE.Group(); pano.position.set(0, 0, DE); world.add(pano);
const land = new THREE.Group(); land.position.set(0, 0, -DE); pano.add(land);

const maxAniso = renderer.capabilities.getMaxAnisotropy();
const loadTex = (url) => new Promise((res, rej) => new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; res(t); }, undefined, rej));

// design point (x right, y down, window radius 1000) at a distance d behind the window
const K = RW / 1000;
const sc = (d) => (DE + d) / DE;
const d2w = (x, y, d) => new THREE.Vector3(x * K * sc(d), -y * K * sc(d), -d);
// the river surface: inverse distance is linear in screen height (horizon y=70 at 12 m, y=1000 at 1 m)
const waterDepth = (y) => 1 / (1 / 12 + ((y - 70) / 930) * (1 - 1 / 12));

const anim = [];
const waterTime = { value: 0 };
const hotspots = [];
const objs = {};

function card(name, box, depth, tex, order) {
  const [x0, y0, x1, y1] = box, s = sc(depth);
  const m = new THREE.Mesh(new THREE.PlaneGeometry((x1 - x0) * K * s, (y1 - y0) * K * s),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  const c = d2w((x0 + x1) / 2, (y0 + y1) / 2, depth);
  m.position.copy(c); m.userData.base = c.clone(); m.userData.s = s; m.userData.depth = depth;
  m.renderOrder = 1 + order; land.add(m); objs[name] = m; return m;
}

/* plants bend with the wind: the top of each layer moves more than its roots */
function makeSway(m, box, depth, ampDesign, start) {
  const [x0, y0, x1, y1] = box, s = sc(depth), w = (x1 - x0) * K * s, h = (y1 - y0) * K * s;
  m.geometry.dispose(); m.geometry = new THREE.PlaneGeometry(w, h, Math.min(220, Math.ceil((x1 - x0) / 35)), 14);
  const u = { uAmp: { value: ampDesign * K * s }, uStart: { value: start }, uDesignW: { value: x1 - x0 }, uDesignX: { value: x0 } };
  m.material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, sway);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uGust, uAmp, uStart, uDesignW, uDesignX;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hgt = smoothstep(uStart, 1.0, uv.y); hgt *= hgt;
        float dx = uDesignX + uv.x * uDesignW;                       // design x: neighbours move together
        float ph = dx / 150.0;
        float w = sin(uTime * 1.5 + ph) * 0.6 + sin(uTime * 2.6 + ph * 1.9 + 1.7) * 0.25 + sin(uTime * 4.1 + ph * 3.1) * 0.08;
        transformed.x += (w * (0.35 + uGust) + uGust * 0.7) * uAmp * hgt;
        transformed.y -= abs(w) * uGust * uAmp * 0.12 * hgt;`);
  };
  m.material.needsUpdate = true;
}

async function build() {
  L = await (await fetch('layout.json')).json();
  const names = L.layers.filter((l) => l.kind !== 'water').map((l) => l.name);
  const extra = ['water', 'beak_closed', 'beak_open', 'bee_farwing', 'bee_body', 'bee_nearwing', 'bee_head'];
  const texList = await Promise.all([...names, ...extra].map((n) => loadTex(`${n}.webp`)));
  const T = {}; [...names, ...extra].forEach((n, i) => (T[n] = texList[i]));

  for (const l of L.layers) {
    if (l.kind === 'water') {
      /* --- the river: one sloped surface, near at the bottom, far at the horizon --- */
      const [x0, y0, x1, y1] = l.box, NX = 24, NY = 90;
      const g = new THREE.PlaneGeometry(1, 1, NX, NY); const p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const u = uv.getX(i), v = 1 - uv.getY(i);
        const y = y0 + v * (y1 - y0), x = x0 + u * (x1 - x0), d = waterDepth(y);
        const w = d2w(x, y, d); p.setXYZ(i, w.x, w.y, w.z);
      }
      p.needsUpdate = true; g.computeBoundingSphere();
      /* the river moves: ripples bend the reflections, light bands drift downstream toward you,
         sun glitter twinkles, and white water streams away from the weir */
      const wMat = new THREE.MeshBasicMaterial({ map: T.water, transparent: true, depthWrite: false });
      wMat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = waterTime;
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
            uniform float uTime;
            float wHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`)
          .replace('#include <map_fragment>', `
            vec2 wuv = vMapUv;
            float ydes = 66.0 + (1.0 - wuv.y) * 2034.0;               // design height (horizon at 70)
            float xdes = -4500.0 + wuv.x * 9000.0;
            float invd = 1.0 / 12.0 + (ydes - 70.0) / 930.0 * (11.0 / 12.0);
            float d = 1.0 / max(invd, 0.075);                           // metres behind the window
            float wx = xdes * 0.0006 * (1.3 + d) / 1.3;                  // metres across the river
            // ripples travelling downstream (toward the viewer)
            float ph1 = d * 38.0 + uTime * 1.9 + sin(wx * 5.0 + uTime * 0.4) * 1.6;
            float ph2 = d * 23.0 + wx * 9.0 + uTime * 1.3;
            float r1 = sin(ph1), r2 = sin(ph2);
            wuv.x += (r1 * 0.55 + r2 * 0.45) * 0.0009 / d;
            wuv.y += (sin(wx * 14.0 + uTime * 1.2) * 0.6 + r2 * 0.4) * 0.0018 / d;
            vec4 sampledDiffuseColor = texture2D(map, wuv);
            diffuseColor *= sampledDiffuseColor;
            // soft light bands on the wave crests
            float crest = pow(max(0.0, sin(d * 55.0 + uTime * 2.4 + sin(wx * 11.0) * 1.8)), 14.0);
            diffuseColor.rgb += vec3(1.0, 0.96, 0.86) * crest * (0.05 + 0.10 / d);
            // twinkling sun glitter, strongest under the low sun
            vec2 cell = floor(vec2(wx * 70.0, d * 30.0));
            float h = wHash(cell);
            float tw = pow(max(0.0, sin(uTime * 2.6 + h * 60.0)), 24.0);
            float sunMask = exp(-pow((xdes + 560.0) / 700.0, 2.0)) * 0.9 + 0.12;
            diffuseColor.rgb += vec3(1.0, 0.93, 0.74) * step(0.9, h) * tw * sunMask * 0.9;
            // white water fed by the two falls: bright at the plunge, then carried downstream toward you,
            // fading into the colour of the river
            float down = ydes - 66.0;
            float spr = max(down, 0.0);
            float a1 = 1.0 - smoothstep(66.0 + spr * 0.45, 92.0 + spr * 0.75, abs(xdes - 416.0));
            float a2 = 1.0 - smoothstep(66.0 + spr * 0.45, 92.0 + spr * 0.75, abs(xdes - 618.0));
            float across = max(a1, a2);
            float plunge = exp(-spr / 34.0), trail = exp(-spr / 220.0);
            float fmask = across * (0.85 * plunge + 0.6 * trail) * smoothstep(-8.0, 2.0, down);
            float flowLines = pow(0.5 + 0.5 * sin(xdes * 0.27 + sin(d * 2.5 + xdes * 0.013) * 1.6), 3.0);
            float bubbles = 0.5 + 0.5 * sin(d * 62.0 + uTime * 5.2 + xdes * 0.07);
            float foamAmt = clamp(fmask * (0.35 + 0.65 * flowLines * bubbles + plunge * 0.8), 0.0, 0.95);
            vec3 foamCol = mix(vec3(0.97, 0.96, 0.91), vec3(0.85, 0.87, 0.78), 1.0 - plunge);
            diffuseColor.rgb = mix(diffuseColor.rgb, foamCol, foamAmt);
          `);
      };
      const water = new THREE.Mesh(g, wMat);
      water.renderOrder = 1 + l.order; land.add(water);
      anim.push((t) => { waterTime.value = t; });
      continue;
    }
    card(l.name, l.box, l.depth, T[l.name], l.order);
  }

  /* --- wind: trees, reeds, flowers and grass sway; the gust curve also drives the wind sound --- */
  const SWAY = { trees: [5, 0.35], reeds_left: [16, 0.05], reeds_right: [18, 0.05], bank_left: [16, 0.2], bank_right: [16, 0.2], meadow: [14, 0.62] };
  for (const l of L.layers) if (SWAY[l.name]) makeSway(objs[l.name], l.box, l.depth, SWAY[l.name][0], SWAY[l.name][1]);
  anim.push((t) => { sway.uTime.value = t; sway.uGust.value = gust(t); updateWindSound(t); });

  /* --- the weir's falls: drawn in the same water palette as the river, pouring into it as foam --- */
  {
    const fb = [300, -56, 745, 108], fd = L.layers.find((x) => x.name === 'weir').depth, s = sc(fd);
    const geo = new THREE.PlaneGeometry((fb[2] - fb[0]) * K * s, (fb[3] - fb[1]) * K * s);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: waterTime },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform float uTime;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          float xd = ${fb[0].toFixed(1)} + vUv.x * ${(fb[2] - fb[0]).toFixed(1)};
          float yd = ${fb[3].toFixed(1)} - vUv.y * ${(fb[3] - fb[1]).toFixed(1)};
          // the two openings between the piers (the piers are painted on top)
          float in1 = smoothstep(326.0, 334.0, xd) * (1.0 - smoothstep(500.0, 508.0, xd));
          float in2 = smoothstep(528.0, 536.0, xd) * (1.0 - smoothstep(701.0, 709.0, xd));
          float inFall = max(in1, in2);
          float v = clamp((yd + 52.0) / 118.0, 0.0, 1.0);          // 0 at the lip, 1 where it meets the river
          float n1 = vnoise(vec2(xd * 0.085, v * 5.0 - uTime * 2.4));
          float n2 = vnoise(vec2(xd * 0.24, v * 13.0 - uTime * 3.6));
          float n = n1 * 0.62 + n2 * 0.38;
          vec3 cLip = vec3(0.47, 0.55, 0.44), cSheet = vec3(0.74, 0.78, 0.66), cFoam = vec3(0.97, 0.96, 0.91);
          vec3 col = mix(cLip, cSheet, smoothstep(0.0, 0.3, v));
          col = mix(col, cFoam, smoothstep(0.38, 0.78, n) * (0.3 + 0.7 * v));     // white streaks grow as it falls
          col += vec3(1.0, 0.97, 0.88) * smoothstep(0.07, 0.0, abs(v - 0.06)) * 0.18; // light on the curve of the lip
          float base = smoothstep(0.62, 1.0, v);
          col = mix(col, cFoam, base * (0.8 + 0.2 * n));
          float a = inFall * step(yd, 66.0) * 0.97;
          // the plunge: bubbling foam spills out over the river surface below the falls
          float dn = max(yd - 60.0, 0.0);
          float wide = max(1.0 - smoothstep(70.0 + dn * 1.2, 92.0 + dn * 1.6, abs(xd - 416.0)), 1.0 - smoothstep(70.0 + dn * 1.2, 92.0 + dn * 1.6, abs(xd - 618.0)));
          float boil = vnoise(vec2(xd * 0.12 + uTime * 0.3, yd * 0.35 - uTime * 1.8)) * 0.6 + vnoise(vec2(xd * 0.3, yd * 0.9 - uTime * 2.6)) * 0.4;
          float spill = wide * smoothstep(52.0, 62.0, yd) * exp(-dn / 26.0) * smoothstep(0.18, 0.55, boil + 0.35 * exp(-dn / 10.0));
          col = mix(col, cFoam, step(66.0, yd));
          a = max(a, spill * 0.95);
          if (a < 0.003) discard;
          gl_FragColor = vec4(col, a);
        }`,
    });
    const falls = new THREE.Mesh(geo, mat);
    falls.position.copy(d2w((fb[0] + fb[2]) / 2, (fb[1] + fb[3]) / 2, fd + 0.002));
    falls.renderOrder = objs.weir.renderOrder - 0.2; land.add(falls);
  }

  /* --- rings spreading around the swan --- */
  const rc = document.createElement('canvas'); rc.width = 256; rc.height = 64; const rx = rc.getContext('2d');
  rx.strokeStyle = 'rgba(255,250,236,.9)'; rx.lineWidth = 3; rx.beginPath(); rx.ellipse(128, 32, 122, 28, 0, 0, Math.PI * 2); rx.stroke();
  const ringTex = new THREE.CanvasTexture(rc);
  const swanL = L.layers.find((x) => x.name === 'swan'); const sy = swanL.box[3] - (swanL.box[3] - swanL.box[1]) * 0.12;
  const rings = [];
  for (let i = 0; i < 4; i++) { const m = card('ring' + i, [-130, sy - 18, 130, sy + 18], swanL.depth + 0.01, ringTex, swanL.order - 0.5); m.material.blending = THREE.AdditiveBlending; rings.push(m); }
  anim.push((t) => { const sw = objs.swan; rings.forEach((m, i) => { const ph = ((t * 0.22 + i / rings.length) % 1); const s = 0.5 + ph * 1.6;
    m.scale.set(s, s, 1); m.position.x = sw.position.x + 0.004; m.position.y = m.userData.base.y; m.material.opacity = 0.55 * (1 - ph) * Math.min(1, ph * 6); }); });

  /* --- the bee: body, head and two sets of wings that beat from the shoulder --- */
  {
    const bee = objs.bee, bl = L.layers.find((x) => x.name === 'bee'), [bx0, by0, bx1, by1] = bl.box;
    const s = sc(bl.depth), bsc = (bx1 - bx0) / 475;               // design units per source pixel (source crop 170..645 x 120..565)
    const W = (bx1 - bx0) * K * s, H = (by1 - by0) * K * s;
    bee.material.map = T.bee_body; bee.material.needsUpdate = true;
    const part = (tex, order, hinge) => {
      // the plane is the full bee frame; shift it so the hinge point sits at the mesh origin
      const g = new THREE.PlaneGeometry(W, H);
      const hx = ((hinge[0] - 170) / 475 - 0.5) * W, hy = (0.5 - (hinge[1] - 120) / 445) * H;
      g.translate(-hx, -hy, 0);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      m.position.set(hx, hy, 0.0005 * order); m.renderOrder = bee.renderOrder + order * 0.05; bee.add(m); return m;
    };
    const far = part(T.bee_farwing, -1, [405, 335]), near = part(T.bee_nearwing, 1, [400, 318]);
    part(T.bee_head, 2, [300, 350]);
    // a faint second image of each wing at the other end of its stroke reads as motion blur
    const farB = part(T.bee_farwing, -1.1, [405, 335]), nearB = part(T.bee_nearwing, 0.9, [400, 318]);
    farB.material.opacity = nearB.material.opacity = 0.32;
    anim.push((t) => {
      const ph = t * Math.PI * 2 * 22;                               // ~22 beats a second (as fast as the frame rate allows)
      const a = Math.sin(ph), b = Math.sin(ph + Math.PI);
      near.rotation.z = -0.15 + a * 0.38; near.scale.y = 0.78 + 0.22 * Math.abs(Math.cos(ph));
      far.rotation.z = -0.1 + a * 0.32; far.scale.y = 0.8 + 0.2 * Math.abs(Math.cos(ph));
      nearB.rotation.z = -0.15 + b * 0.38; farB.rotation.z = -0.1 + b * 0.32;
      near.material.opacity = 0.82 + 0.15 * Math.abs(a); far.material.opacity = 0.78 + 0.15 * Math.abs(a);
    });
  }

  /* --- gentle life --- */
  anim.push((t) => { const m = objs.swan, b = m.userData.base, s = m.userData.s; m.position.set(b.x + Math.sin(t * 0.22) * 0.02 * s, b.y + Math.sin(t * 1.3) * 0.0025 * s, b.z); });
  anim.push((t) => { const m = objs.bee, b = m.userData.base, s = m.userData.s; m.position.set(b.x + Math.sin(t * 0.9) * 0.014 * s, b.y + Math.sin(t * 1.8) * 0.009 * s, b.z + Math.sin(t * 0.6) * 0.05); m.rotation.z = Math.sin(t * 3.1) * 0.06; });
  anim.push((t) => { const m = objs.blackbird, b = m.userData.base; m.scale.setScalar(1 + Math.sin(t * 2.2) * 0.006); m.position.y = b.y + Math.sin(t * 2.2) * 0.0015; });
  objs.notes.visible = false;

  /* --- the blackbird sings every so often: beak opens, song arcs and notes spread out --- */
  const bbL = L.layers.find((x) => x.name === 'blackbird');
  const beakC = card('beak_closed', bbL.box, bbL.depth, T.beak_closed, bbL.order - 0.1);
  const beakO = card('beak_open', bbL.box, bbL.depth, T.beak_open, bbL.order - 0.1); beakO.visible = false;
  const bsc = (bbL.box[2] - bbL.box[0]) / 655;                        // design units per source pixel
  const tip = [bbL.box[0] + (238 - 210) * bsc, bbL.box[1] + (330 - 245) * bsc];
  const arcTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
    x.shadowColor = 'rgba(255,214,120,.9)'; x.shadowBlur = 10; x.strokeStyle = 'rgba(255,246,214,.95)'; x.lineWidth = 7; x.lineCap = 'round';
    x.beginPath(); x.arc(118, 128, 100, Math.PI * 0.72, Math.PI * 1.28); x.stroke(); return new THREE.CanvasTexture(c); })();
  const noteTex = [0, 1].map((k) => { const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
    x.fillStyle = '#fff6dc'; x.strokeStyle = '#fff6dc'; x.shadowColor = 'rgba(255,200,90,.9)'; x.shadowBlur = 8; x.lineWidth = 6;
    const head = (hx, hy) => { x.beginPath(); x.ellipse(hx, hy, 13, 9.5, -0.45, 0, Math.PI * 2); x.fill(); x.beginPath(); x.moveTo(hx + 11, hy - 3); x.lineTo(hx + 11, hy - 50); x.stroke(); };
    if (k === 0) { head(36, 74); x.beginPath(); x.moveTo(47, 24); x.quadraticCurveTo(70, 34, 66, 56); x.stroke(); }
    else { head(26, 76); head(64, 68); x.lineWidth = 9; x.beginPath(); x.moveTo(37, 26); x.lineTo(75, 18); x.stroke(); }
    return new THREE.CanvasTexture(c); });
  const songFx = [];
  const spawnArc = (delay) => { const m = card('arc', [tip[0] - 34, tip[1] - 70, tip[0] + 0, tip[1] + 70], bbL.depth + 0.002, arcTex, bbL.order + 0.2); m.material.blending = THREE.AdditiveBlending; m.material.opacity = 0; songFx.push({ m, kind: 'arc', t0: performance.now() / 1000 + delay, life: 2.0 }); };
  const spawnNote = (delay) => { const m = card('note', [tip[0] - 60, tip[1] - 60, tip[0] - 0, tip[1] + 0], bbL.depth + 0.002, noteTex[Math.random() < 0.5 ? 0 : 1], bbL.order + 0.2); m.material.opacity = 0; songFx.push({ m, kind: 'note', t0: performance.now() / 1000 + delay, life: 2.6, dx: -(0.05 + Math.random() * 0.05), dy: 0.03 + Math.random() * 0.04, rot: (Math.random() - 0.5) * 0.6 }); };
  // recorded blackbird phrases; each note is [start, length] in seconds, measured from the recording,
  // so the beak opens exactly while the real bird is singing
  const SONG = await (await fetch('audio/blackbird.json')).json();
  let songUntil = 0, phrase = null, songStart = 0, nextSong = performance.now() / 1000 + 3.5, lastIdx = -1;
  function sing() {
    let i = Math.floor(Math.random() * SONG.length); if (i === lastIdx) i = (i + 1) % SONG.length; lastIdx = i;
    const now = performance.now() / 1000, rec = SONG[i]; phrase = rec.notes; songStart = now;
    const end = phrase[phrase.length - 1]; songUntil = now + end[0] + end[1];
    let k = 0; phrase.forEach(([st, ln]) => { if (ln >= 0.07) { spawnArc(st); if (k++ % 2 === 0) spawnNote(st + 0.05); } });
    if (audio.on) playBird(i);
    nextSong = songUntil + 7 + Math.random() * 6;
  }
  anim.push(() => {
    const now = performance.now() / 1000;
    if (now > nextSong && !document.hidden) sing();
    let open = false;
    if (phrase && now < songUntil + 0.05) { const e = now - songStart; open = phrase.some(([st, ln]) => e >= st && e <= st + ln); }
    beakO.visible = open; beakC.visible = !open;
    // keep the beak glued to the breathing bird
    beakO.position.copy(objs.blackbird.position); beakC.position.copy(objs.blackbird.position); beakO.scale.copy(objs.blackbird.scale); beakC.scale.copy(objs.blackbird.scale);
    for (let i = songFx.length - 1; i >= 0; i--) {
      const f = songFx[i], k = (now - f.t0) / f.life, b = f.m.userData.base;
      if (k < 0) continue;
      if (k >= 1) { land.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); songFx.splice(i, 1); continue; }
      if (f.kind === 'arc') { const sc2 = 0.6 + k * 3.2; f.m.scale.set(sc2, sc2, 1); f.m.position.set(b.x - k * 0.09, b.y + k * 0.01, b.z); f.m.material.opacity = Math.min(1, k * 8) * Math.pow(1 - k, 1.4); }
      else { f.m.position.set(b.x + f.dx * k * 1.6, b.y + f.dy * k * 1.6 + Math.sin(k * 9) * 0.004, b.z); f.m.rotation.z = f.rot * k; f.m.material.opacity = Math.min(1, k * 6) * (1 - k * k); }
    }
  });
  objs.blackbird.userData.sing = sing;
  anim.push((t) => { const m = objs.branch, b = m.userData.base, g = gust(t); m.rotation.z = Math.sin(t * 0.9) * (0.002 + g * 0.004); m.position.y = b.y + Math.sin(t * 0.9) * (0.0006 + g * 0.0012); });

  /* --- drifting golden sparkles at many depths --- */
  const N = 170, sp = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const d = 0.4 + Math.pow(Math.random(), 1.6) * 9, a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 1.6;
    const p = d2w(Math.cos(a) * r * 1000, Math.sin(a) * r * 700 - 150, d); sp.set([p.x, p.y, p.z], i * 3); seed[i] = Math.random() * 100;
  }
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(sp.slice(), 3));
  const dot = document.createElement('canvas'); dot.width = dot.height = 64; const dg = dot.getContext('2d');
  const grad = dg.createRadialGradient(32, 32, 0, 32, 32, 32); grad.addColorStop(0, 'rgba(255,246,214,1)'); grad.addColorStop(0.25, 'rgba(255,217,138,.85)'); grad.addColorStop(1, 'rgba(255,217,138,0)');
  dg.fillStyle = grad; dg.fillRect(0, 0, 64, 64);
  const spMat = new THREE.PointsMaterial({ size: 0.02, map: new THREE.CanvasTexture(dot), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const sparkles = new THREE.Points(spGeo, spMat); sparkles.renderOrder = 30; land.add(sparkles);
  anim.push((t) => { const a = spGeo.attributes.position; for (let i = 0; i < N; i++) { const s0 = seed[i]; a.setXYZ(i, sp[i * 3] + Math.sin(t * 0.3 + s0) * 0.02, sp[i * 3 + 1] + Math.sin(t * 0.45 + s0 * 1.3) * 0.02, sp[i * 3 + 2]); } a.needsUpdate = true; spMat.opacity = 0.7 + 0.2 * Math.sin(t * 0.7); });

  /* --- the window (window plane, z = 0): a round opening set deep into a dark plastered wall --- */
  // The daylight falls on the sides of the opening; the wall itself stays dark, lit only a little near the window.
  // Everything on the wall's face is one group, hidden in a headset, where the visitor's own room is the wall.
  const wall = new THREE.Group(); wall.renderOrder = 40; world.add(wall);
  const put = (mesh, order, parent = wall) => { mesh.renderOrder = order; parent.add(mesh); return mesh; };
  // invisible occluder: it hides the painting everywhere except through the window
  const occ = new THREE.Mesh(new THREE.RingGeometry(RW * 0.996, 40, 128), new THREE.MeshBasicMaterial({ colorWrite: false }));
  occ.position.z = -0.002; occ.renderOrder = -1; world.add(occ);
  // the plaster: a small tileable texture (soft blotches and grain), drawn once; the same wall every time
  const TILE = 1.6;   // metres of wall one copy of the texture covers
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();
  const plaster = (() => {
    const n = 256, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
    x.fillStyle = '#d9d9d9'; x.fillRect(0, 0, n, n);
    for (let i = 0; i < 260; i++) {
      const r = 8 + rnd() * 34, px = rnd() * n, py = rnd() * n, g = x.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, rnd() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { x.setTransform(1, 0, 0, 1, px + ox, py + oy); x.fillStyle = g; x.fillRect(-r, -r, 2 * r, 2 * r); }
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    const im = x.getImageData(0, 0, n, n), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const k = 1 + (rnd() - 0.5) * 0.1; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
    x.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  })();
  // a ring of wall whose brightness depends on where each point is: shade(r, angle) -> 0..1 between two colours
  const ring = (r0, r1, steps, dark, light, shade) => {
    const g = new THREE.RingGeometry(r0, r1, 160, steps), p = g.attributes.position, cols = [], uv = [], D = new THREE.Color(dark), L = new THREE.Color(light);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), c = D.clone().lerp(L, Math.max(0, Math.min(1, shade(Math.hypot(x, y), Math.atan2(y, x))))); cols.push(c.r, c.g, c.b); uv.push(x / TILE + 0.5, y / TILE + 0.5); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, map: plaster }));
  };
  // the light from the window spills onto the wall around it: strongest at the edge and from above, gone within about a radius
  put(ring(RW, RW * 3.2, 30, '#14171b', '#2f353c', (r, a) => 0.9 * Math.exp(-(r - RW) / (RW * 0.5)) * (1 + 0.3 * Math.cos(a + Math.PI / 2))), 40);
  put(ring(RW * 3.2, 40, 2, '#14171b', '#14171b', () => 0), 40);
  // the depth of the opening: a tube, lit from outside by the evening sky (brightest low down and near the glass)
  const DEPTH = 0.22, tun = new THREE.CylinderGeometry(RW * 0.99, RW * 0.99, DEPTH, 128, 4, true); tun.rotateX(Math.PI / 2); tun.translate(0, 0, -DEPTH / 2);
  const cols = [], tp = tun.attributes.position, lit = new THREE.Color('#7c767d'), shade = new THREE.Color('#1b1e23');
  for (let i = 0; i < tp.count; i++) { const a = Math.atan2(tp.getY(i), tp.getX(i)), l = Math.pow(0.5 + 0.5 * Math.cos(a + 1.9), 1.3), k = 0.5 + 0.5 * (-tp.getZ(i) / DEPTH), c = shade.clone().lerp(lit, l).multiplyScalar(k); cols.push(c.r, c.g, c.b); }
  tun.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const tunnel = new THREE.Mesh(tun, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })); tunnel.renderOrder = 39; world.add(tunnel);
  // the arris, where the wall's face turns into the opening
  put(new THREE.Mesh(new THREE.RingGeometry(RW * 0.99, RW * 1.003, 192), new THREE.MeshBasicMaterial({ color: 0x59616a, transparent: true, opacity: 0.7 })), 42);
  // deep inside, the window's own slim frame, with a hairline in the brand colour
  const frame = new THREE.Group(); frame.position.z = -DEPTH; world.add(frame);
  put(new THREE.Mesh(new THREE.RingGeometry(RW * 0.945, RW * 0.992, 192), new THREE.MeshBasicMaterial({ color: 0x0b0e11 })), 38, frame);
  put(new THREE.Mesh(new THREE.RingGeometry(RW * 0.941, RW * 0.947, 192), new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.9 })), 38, frame);
  const glow = new THREE.Object3D();   // (the former look's glow; kept so the headset code can hide it as before)
  objs.wall = wall; objs.glow = glow; objs.occ = occ; objs.tunnel = tunnel;

  /* --- hotspots --- */
  const INFO = {
    swan: { obj: 'swan', at: [-585, 205], tag: 'Bird', title: 'Mute Swan', sci: 'Cygnus olor', text: 'The elegant white swans along the Lech River are almost always Mute Swans. Despite their name, they aren’t silent: their wings produce a distinctive rhythmic whooshing sound in flight that can be heard from surprisingly far away, even before the birds come into view.' },
    blackbird: { obj: 'blackbird', at: [330, 350], tag: 'Songbird', title: 'Eurasian Blackbird', sci: 'Turdus merula', text: 'One of the most familiar songbirds in Augsburg’s parks and riverbanks. Only the males are jet black with a bright orange-yellow beak; females are brown. Its rich, fluting song is often the first you hear at dawn and the last at dusk.' },
    bee: { obj: 'bee', at: [738, -168], tag: 'Pollinator', title: 'Red Mason Bee', sci: 'Osmia bicornis', text: 'Unlike honey bees, the Red Mason Bee lives alone. Each female builds her own nest, carefully sealing every chamber with mud and leaving behind just enough pollen for her offspring. Despite its solitary lifestyle, it is one of Europe’s most efficient pollinators, often outperforming honey bees in spring orchards.' },
    loosestrife: { obj: 'bank_left', at: [-1053, -120], tag: 'Riverbank plant', title: 'Purple Loosestrife', sci: 'Lythrum salicaria', text: 'Tall magenta flower spikes that line wet riverbanks from early summer into autumn. Native to Europe, it is a rich source of nectar, visited by bees, butterflies and hoverflies, and its roots help hold the soft banks of the river together.' },
    rathaus: { obj: 'city', at: [-814, -430], tag: 'Landmark', title: 'Augsburg Town Hall', sci: 'Rathaus · Elias Holl, 1615–1620', text: 'One of the most important Renaissance buildings north of the Alps. At 57 m it was the tallest building in Germany until 1917. The council wanted no towers; the city architect Elias Holl insisted on the two onion domes and got his way in 1618. The gable is crowned by a pine cone, the emblem of Augsburg.' },
    perlach: { obj: 'city', at: [-392, -470], tag: 'Landmark', title: 'Perlach Tower', sci: 'Perlachturm', text: 'The slender 70 m tower beside the Town Hall began as a medieval watchtower. Elias Holl raised it to its present height in 1614–1616 and gave it the green onion dome, so the Town Hall’s bells could hang here while the new building went up.' },
    weir: { obj: 'weir', at: [520, -70], tag: 'Water heritage', title: 'Hochablass Weir', sci: 'on the Lech, Augsburg', text: 'Since at least 1346 Augsburg has dammed the Lech here to send water into the city’s canals. A flood destroyed the old weir in 1910; it was rebuilt in 1911–1912. It also feeds the Eiskanal, the canoe slalom course of the 1972 Olympics, and is part of the Augsburg Water Management System, a UNESCO World Heritage site.' },
  };
  for (const [key, info] of Object.entries(INFO)) {
    const o = objs[info.obj];
    const b = document.createElement('button'); b.className = 'hotspot'; b.setAttribute('aria-label', `About the ${info.title}`);
    $('hotspots').appendChild(b);
    const local = d2w(info.at[0], info.at[1], o.userData.depth).sub(o.userData.base);
    const h = { key, info, el: b, obj: o, local };
    b.addEventListener('click', (e) => { e.stopPropagation(); openCard(h); });
    b.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) openCard(h); });
    hotspots.push(h);
  }
}

/* ---------- wind: one gust curve drives both the swaying plants and the wind you hear ---------- */
const gust = (t) => Math.min(1, Math.max(0, 0.45 + 0.28 * Math.sin(t * 0.21) + 0.18 * Math.sin(t * 0.53 + 1.3) + 0.09 * Math.sin(t * 1.37 + 0.4)));
const sway = { uTime: { value: 0 }, uGust: { value: 0.5 } };

/* ---------- sound: real recordings (river, weir, blackbird) and soft wind, off until the visitor asks ---------- */
const audio = { on: false, ctx: null, master: null, bird: [], ready: null, wind: null, leaves: null };
async function loadBuf(url) { const r = await fetch(url); const ab = await r.arrayBuffer(); return new Promise((res, rej) => audio.ctx.decodeAudioData(ab, res, rej)); }   // callback form also works on older iPhones
function loopSrc(buf, gain, dest) {
  const src = audio.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  src.loopStart = 0.06; src.loopEnd = buf.duration - 0.06;            // skip the mp3 padding so the loop is seamless
  const g = audio.ctx.createGain(); g.gain.value = gain; src.connect(g).connect(dest); src.start(0, 0.06); return g;
}
function audioInit() {
  if (audio.ctx) return audio.ready;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return Promise.resolve();
  const ctx = new AC(); audio.ctx = ctx; audio.master = ctx.createGain(); audio.master.gain.value = 0; audio.master.connect(ctx.destination);
  // wind: brown-ish noise through a moving band-pass, plus a faint leafy rustle
  const len = ctx.sampleRate * 3, nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
  let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const wn = ctx.createBufferSource(); wn.buffer = nb; wn.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.7;
  audio.wind = ctx.createGain(); audio.wind.gain.value = 0; wn.connect(bp).connect(audio.wind).connect(audio.master); audio.windBP = bp;
  const wb = ctx.createBuffer(1, len, ctx.sampleRate), wd = wb.getChannelData(0); for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1;
  const ln = ctx.createBufferSource(); ln.buffer = wb; ln.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3800;
  audio.leaves = ctx.createGain(); audio.leaves.gain.value = 0; ln.connect(hp).connect(audio.leaves).connect(audio.master);
  wn.start(); ln.start();
  audio.ready = (async () => {
    const [river, weir, ...birds] = await Promise.all(['audio/river_loop.mp3', 'audio/weir_loop.mp3', 'audio/blackbird_1.mp3', 'audio/blackbird_2.mp3', 'audio/blackbird_3.mp3', 'audio/blackbird_4.mp3'].map(loadBuf));
    loopSrc(river, 0.55, audio.master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.connect(audio.master);   // the weir is across the river
    loopSrc(weir, 0.32, lp);
    audio.bird = birds;
  })().catch((e) => { console.error(e); toast('Some sounds could not be loaded.'); });
  return audio.ready;
}
function playBird(i) {
  const buf = audio.bird[i]; if (!buf) return;
  const src = audio.ctx.createBufferSource(); src.buffer = buf; const g = audio.ctx.createGain(); g.gain.value = 0.9;
  src.connect(g).connect(audio.master); src.start();
}
function updateWindSound(t) {
  if (!audio.on || !audio.wind) return; const g = gust(t), now = audio.ctx.currentTime;
  audio.wind.gain.setTargetAtTime(0.05 + g * g * 0.5, now, 0.4);
  audio.leaves.gain.setTargetAtTime(g * g * 0.022, now, 0.4);
  audio.windBP.frequency.setTargetAtTime(300 + g * 380, now, 0.6);
}
/* phones: everything that starts audio must happen inside the tap itself */
function unlockAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}   // iPhone: play even when the silent switch is on
  if (!audio.el) { const el = new Audio('audio/silence.mp3'); el.loop = true; el.setAttribute('playsinline', ''); audio.el = el; }
  audio.el.play().catch(() => {});                                    // an <audio> element puts iOS into "media playback" mode
  try { const b = audio.ctx.createBuffer(1, 1, 22050), src = audio.ctx.createBufferSource(); src.buffer = b; src.connect(audio.ctx.destination); src.start(0); } catch (e) {}
  if (audio.ctx.state !== 'running') audio.ctx.resume().catch(() => {});
}
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let iosHint = false;
async function setSound(on) {
  audio.on = on;
  $('soundBtn').setAttribute('aria-pressed', String(on)); icon('soundBtn', on ? 'vol' : 'voloff'); $('credits').hidden = !on;
  if (on) {
    audioInit(); if (!audio.ctx) { toast('Sound is not supported in this browser.'); return; }
    unlockAudio();
    if (isIOS && !iosHint) { iosHint = true; toast('Can’t hear it? Turn up the volume and check the silent switch.', 3800); }
    await audio.ready;
  } else if (audio.el) audio.el.pause();
  if (!audio.ctx) return;
  audio.master.gain.setTargetAtTime(on ? 1 : 0, audio.ctx.currentTime, 0.25);
  if (on && audio.ctx.state !== 'running') toast('Tap “Sound” once more to start the audio.', 3200);
  if (on && objs.blackbird && objs.blackbird.userData.sing) setTimeout(() => objs.blackbird.userData.sing(), 600);
}
// phones suspend audio in the background or after a call: wake it on return or on the next touch
document.addEventListener('visibilitychange', () => { if (!document.hidden && audio.on && audio.ctx) { audio.ctx.resume().catch(() => {}); if (audio.el) audio.el.play().catch(() => {}); } });
addEventListener('pointerdown', () => { if (audio.on && audio.ctx && audio.ctx.state !== 'running') unlockAudio(); }, true);
$('soundBtn').addEventListener('click', () => setSound(!audio.on));
function showCredits(on) { $('creditsPop').hidden = !on; $('creditsBtn').setAttribute('aria-expanded', String(on)); }
$('creditsBtn').addEventListener('click', (e) => { e.stopPropagation(); showCredits($('creditsPop').hidden); });
document.addEventListener('click', (e) => { if (!$('credits').contains(e.target)) showCredits(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') showCredits(false); });

/* ---------- info card ---------- */
let openH = null;
function openCard(h) {
  openH = h;
  $('cardTag').textContent = h.info.tag; $('cardTitle').textContent = h.info.title; $('cardSci').textContent = h.info.sci; $('cardBody').textContent = h.info.text;
  $('card').classList.add('show'); placeCard();
}
function closeCard() { $('card').classList.remove('show'); openH = null; }
$('cardClose').addEventListener('click', closeCard);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCard(); });
renderer.domElement.addEventListener('pointerdown', () => closeCard());
function placeCard() {
  if (!openH || innerWidth <= 640) return;
  const r = openH.el.getBoundingClientRect(), c = $('card'), w = c.offsetWidth, hgt = c.offsetHeight;
  let x = r.left + r.width / 2 + 22, y = r.top - hgt / 2;
  if (x + w > innerWidth - 12) x = r.left - w - 22;
  y = Math.max(12, Math.min(innerHeight - hgt - 80, y));
  c.style.left = `${x}px`; c.style.top = `${y}px`;
}

/* ---------- looking around: turn the phone (or drag) and the scene turns behind the fixed window ---------- */
// the painting reaches about 52° to each side, 50° up and 46° down from the design eye
const LOOK_H = 52, LOOK_UP = 50, LOOK_DN = 46;
const look = { yaw: 0, pitch: 0, gyroYaw: 0, gyroPitch: 0, dragYaw: 0, dragPitch: 0, q0: null, e0: 0, gyro: false, settled: false };
const _q = new THREE.Quaternion(), _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), _qs = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _rel = new THREE.Quaternion(), _qr = new THREE.Quaternion();
const _e = new THREE.Euler(), _y = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, 1);
const past = (v, lo, hi) => (v > hi ? v - hi : v < lo ? v - lo : 0);   // how far a value lies outside its range
const wrap = (a) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));     // an angle brought back to -180°..180°
function onOrientLook(e) {
  // only with a real gyroscope: without one the phone's angles tremble, and the view is better left to the finger
  if (!TURN || !hasGyro() || e.alpha == null || e.beta == null || e.gamma == null) return;
  const D = Math.PI / 180, orient = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * D;
  _e.set(e.beta * D, e.alpha * D, -e.gamma * D, 'YXZ');
  _q.setFromEuler(_e).multiply(_q1).multiply(_qs.setFromAxisAngle(_z, -orient));     // the phone's attitude, as a camera looking out of its back
  const rise = Math.asin(Math.max(-1, Math.min(1, 2 * (_q.w * _q.x - _q.y * _q.z))));  // how far above the horizon it looks
  // "straight ahead" is how the phone is held when the scene comes on show (Reset takes a new one)
  if (!look.q0 || !look.settled) { look.q0 = (look.q0 || new THREE.Quaternion()).copy(_q); look.e0 = rise; }
  // since then: how far the phone has turned about the vertical (whichever way it is tilted), and how far its view has risen
  _rel.copy(_q).multiply(_qa.copy(look.q0).invert());
  let yaw = wrap(2 * Math.atan2(_rel.y, _rel.w)), pitch = rise - look.e0;
  // Turned past the edge of the painting, "straight ahead" turns along with the phone: turning back then moves the view
  // at once, instead of first having to undo the whole overshoot
  const lim = lookLimits(), oy = past(yaw + look.dragYaw, -lim.y, lim.y), op = past(pitch + look.dragPitch, -lim.dn, lim.up);
  if (oy) { look.q0.premultiply(_qa.setFromAxisAngle(_y, oy)); yaw -= oy; }
  if (op) { look.e0 += op; pitch -= op; }
  look.gyroYaw = yaw; look.gyroPitch = pitch; look.gyro = true;
}
/* The motion sensor. Inside the app it has been asked for already (together with the camera), and asking again here only
   picks that answer up, without a question. On its own, this page asks at the first touch. */
if (TURN) {
  addEventListener('deviceorientation', onOrientLook);
  findGyro();
  const tryMotion = () => askMotion().then((a) => a === 'granted' && findGyro());
  tryMotion(); for (const ms of [1500, 4000, 8000]) setTimeout(tryMotion, ms);
  addEventListener('pointerdown', tryMotion, { once: true, capture: true });
}
function lookLimits() {
  // how far the scene may turn before the painting's edge would come into view. What you can see is whichever is
  // narrower: the window opening or the screen itself. After zooming in, the window is bigger than a phone screen,
  // so the screen sets the limit and there is much more room to turn toward the sides.
  const R = THREE.MathUtils.degToRad, margin = R(4);
  const win = Math.atan(RW / Math.max(0.3, eye.z));
  const scrV = R(camera.fov) / 2, scrH = Math.atan(Math.tan(scrV) * camera.aspect);
  const h = Math.min(win, scrH), v = Math.min(win, scrV);
  return { y: Math.max(0, R(LOOK_H) - h - margin), up: Math.max(0, R(LOOK_UP) - v - margin), dn: Math.max(0, R(LOOK_DN) - v - margin), win };
}

/* ---------- viewpoint: a small lean with the turn, and stepping closer ---------- */
const eye = { x: 0, y: 0, z: DE }, target = { x: 0, y: 0, z: DE };

// drag (finger or mouse) turns the scene too, on top of the phone's own turning.
// With a mouse, simply moving it over the picture looks around the panorama: right edge = as far right as it goes, and so on.
let drag = null;
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' && !drag) {
    const L2 = lookLimits(), nx = Math.max(-1, Math.min(1, (e.clientX / innerWidth) * 2 - 1)), ny = Math.max(-1, Math.min(1, (e.clientY / innerHeight) * 2 - 1));
    look.dragYaw = -nx * L2.y;
    look.dragPitch = ny < 0 ? -ny * L2.up : -ny * L2.dn;
    return;
  }
  if (!drag || pointers.size !== 1) return;
  const L2 = lookLimits(), span = THREE.MathUtils.degToRad(camera.fov) * camera.aspect;
  // the finger offset is kept within the painting so it never runs away past the edges
  look.dragYaw = Math.max(-L2.y - look.gyroYaw, Math.min(L2.y - look.gyroYaw, drag.yaw + (e.clientX - drag.cx) / innerWidth * span));
  look.dragPitch = Math.max(-L2.dn - look.gyroPitch, Math.min(L2.up - look.gyroPitch, drag.pitch + (e.clientY - drag.cy) / innerHeight * THREE.MathUtils.degToRad(camera.fov)));
});
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
const pointers = new Map(); let pinch0 = null;
renderer.domElement.addEventListener('pointerdown', (e) => { pointers.set(e.pointerId, e); drag = { cx: e.clientX, cy: e.clientY, yaw: look.dragYaw, pitch: look.dragPitch }; if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: target.z }; } });
renderer.domElement.addEventListener('pointermove', (e) => { if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, e); if (pointers.size === 2 && pinch0) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); setZ(pinch0.z - (d - pinch0.d) / 400); } });
const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = null; if (!pointers.size) drag = null; };
renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointercancel', up);
renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); setZ(target.z + e.deltaY * 0.0012); }, { passive: false });
function updZoomBtns() {
  $('zoomInBtn').disabled = target.z <= EYE_NEAR + 1e-3; $('zoomOutBtn').disabled = target.z >= DE - 1e-3;
}
function setZ(z) { target.z = Math.max(EYE_NEAR, Math.min(DE, z)); updZoomBtns(); }
const ZSTEP = (DE - EYE_NEAR) / 3;     // three steps from the starting view to the closest look
$('zoomInBtn').addEventListener('click', () => setZ(target.z - ZSTEP));
$('zoomOutBtn').addEventListener('click', () => setZ(target.z + ZSTEP));
setZ(DE);
// Reset: back to the starting distance, looking straight ahead (however the phone is held right now)
$('resetBtn').addEventListener('click', () => { setZ(DE); look.q0 = null; look.dragYaw = look.dragPitch = 0; look.gyroYaw = look.gyroPitch = 0; });

/* ---------- fit the window to any screen (portrait phones, tablets, wide desktops) ---------- */
// The window takes the middle of the room that the title above and the buttons below leave free. On a phone held sideways
// the buttons stand in a column at the right and the title keeps to the left, so there the window takes the full height.
const TITLE = Math.max(6, parseFloat(PARAMS.get('sat')) || 0) + 56;   // inside the app: where its bar with the title ends
const RING = 1.13;                                                    // the opening with its dotted ring, as a share of the opening
let winDown = 0;                                                      // how far below the middle of the screen the window's centre sits, in px
function layout() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h;
  const bar = $('bar').getBoundingClientRect(), side = getComputedStyle($('bar')).flexDirection === 'column';
  const top = side ? 6 : EMBED ? TITLE : $('title').getBoundingClientRect().bottom + 10;
  const bottom = side ? h - 6 : bar.top - 26;                         // 26: one line of help fits between the window and the buttons
  const half = Math.max(60, Math.min((bottom - top) / 2, side ? bar.left - w / 2 : w / 2));
  winDown = (top + bottom) / 2 - h / 2;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((RW * RING * (h / 2)) / (DE * half))); camera.updateProjectionMatrix(); placeCard();
}
addEventListener('resize', layout); layout();

/* ---------- headset: VR, or mixed reality with the window placed in your room ---------- */
async function setupXR() {
  if (EMBED || !navigator.xr) return;   // inside the app the four buttons are all there is
  let mode = null;
  try { if (await navigator.xr.isSessionSupported('immersive-ar')) mode = 'immersive-ar'; else if (await navigator.xr.isSessionSupported('immersive-vr')) mode = 'immersive-vr'; } catch (e) { return; }
  if (!mode) return;
  renderer.xr.enabled = true;
  $('xrBtn').hidden = false; $('xrLbl').textContent = mode === 'immersive-ar' ? 'In your room' : 'In VR';
  $('xrBtn').addEventListener('click', async () => {
    const session = await navigator.xr.requestSession(mode, { optionalFeatures: ['local-floor'] });
    renderer.xr.setReferenceSpaceType('local-floor');
    await renderer.xr.setSession(session);
    if (mode === 'immersive-ar') renderer.setClearAlpha(0);
    objs.wall.visible = objs.glow.visible = false;
    world.position.set(0, 1.45, -1.3);   // the window floats at eye height, a step in front of you
    rig.position.set(0, 0, 0); camera.position.set(0, 0, 0); camera.clearViewOffset();
    session.addEventListener('end', () => { world.position.set(0, 0, 0); renderer.setClearAlpha(1); objs.wall.visible = objs.glow.visible = true; layout(); });
  });
}

/* ---------- loop ---------- */
const clock = new THREE.Clock(); const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
let winPx = 1;
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  if (!renderer.xr.isPresenting) {
    {
      const lim = lookLimits();
      const ty = Math.max(-lim.y, Math.min(lim.y, look.gyroYaw + look.dragYaw)), tp = Math.max(-lim.dn, Math.min(lim.up, look.gyroPitch + look.dragPitch));
      look.yaw += (ty - look.yaw) * 0.2; look.pitch += (tp - look.pitch) * 0.2;
      // a small lean in the turning direction adds depth between the layers
      target.x = Math.sin(look.yaw) * -0.22; target.y = Math.sin(look.pitch) * 0.16;
    }
    // turn the landscape around where you actually stand (after zooming in that is closer to the window)
    pano.position.set(0, 0, eye.z); land.position.set(0, 0, -eye.z);
    _e.set(look.pitch, look.yaw, 0, 'YXZ'); _qr.setFromEuler(_e).invert(); pano.quaternion.copy(_qr);
    {
      const a = 0.1;
      eye.x += (target.x - eye.x) * a; eye.y += (target.y - eye.y) * a; eye.z += (target.z - eye.z) * a;
      camera.position.set(eye.x, eye.y, eye.z); camera.quaternion.identity();
      // off-axis view, like looking through a real window: the camera stays square to the wall and the view is
      // shifted so the window's centre always lands on its place on the screen, whatever the lean or the zoom
      const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), th = tv * camera.aspect, W = innerWidth, H = innerHeight;
      const ez = Math.max(0.05, eye.z), nx = -eye.x / ez / th, ny = -eye.y / ez / tv;
      camera.setViewOffset(W, H, nx * W / 2, -ny * H / 2 - winDown, W, H);
    }
  }
  for (const f of anim) f(t);
  tmp3.set(RW, 0, 0); world.localToWorld(tmp3); tmp3.project(camera); tmp2.set(0, 0, 0); world.localToWorld(tmp2); tmp2.project(camera); winPx = Math.abs(tmp3.x - tmp2.x) * innerWidth / 2;
  for (const h of hotspots) {
    tmp.copy(h.local).add(h.obj.position); h.obj.parent.localToWorld(tmp); tmp.project(camera);
    tmp2.set(0, 0, 0); world.localToWorld(tmp2); tmp2.project(camera);
    const ex = (tmp.x - tmp2.x) * innerWidth / 2, ey = (tmp.y - tmp2.y) * innerHeight / 2;
    const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05 && Math.hypot(ex, ey) < winPx * 0.97 && !renderer.xr.isPresenting;
    h.el.style.display = vis ? '' : 'none';
    h.el.style.left = `${(tmp.x * 0.5 + 0.5) * innerWidth}px`; h.el.style.top = `${(-tmp.y * 0.5 + 0.5) * innerHeight}px`;
  }
  if (openH) placeCard();
  renderer.render(scene, camera);
});

/* a still picture of the scene, for the app's photo button */
window.wxrSnapshot = () => { renderer.render(scene, camera); return renderer.domElement; };

/* the buttons take their icons from the app's own set */
function icon(id, name) { $(id).querySelector('.disc').innerHTML = ic(name); }
icon('soundBtn', 'voloff'); icon('zoomOutBtn', 'zoomout'); icon('zoomInBtn', 'zoomin'); icon('resetBtn', 'reset'); icon('xrBtn', 'cube');
$('cardClose').innerHTML = ic('x', 20);
if (DEV) window.__rs = { look, eye, target, objs, limits: lookLimits };

build().then(() => {
  $('loader').classList.add('done'); setupXR();
  setTimeout(() => { look.settled = true; }, 700);   // from here on the view follows the phone's turning
  // one line of help, once it is known whether this phone can be turned to look around
  setTimeout(() => toast(look.gyro ? 'Turn your phone to look around' : 'Drag to look around', 4200, true), 1100);
}).catch((e) => { console.error(e); $('loader').querySelector('p').textContent = 'The scene could not be loaded. Please reload the page.'; });
