/* Watermarks XR — icons and guidance signs, as inline SVG.
   ic(name, size)        a thin line icon; the stroke stays one pixel wide at any size
   logo(width, stroke)   the water wheel over two waves
   SIGNS / signHTML()    the small animated signs the camera screen shows when a visitor needs help */

const STILL = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const IC = {
  home: '<path d="M21 19v-6.73a4 4 0 0 0-1.25-2.9l-6.37-6.06a2 2 0 0 0-2.76 0L4.25 9.37A4 4 0 0 0 3 12.27V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2Z"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  book: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  scan: '<path d="M4 9V5.5Q4 4 5.5 4H9M15 4h3.5Q20 4 20 5.5V9M20 15v3.5q0 1.5-1.5 1.5H15M9 20H5.5Q4 20 4 18.5V15M7.5 12h9"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  pin: '<g transform="scale(1.0909)"><path d="M14.15 10.1a3.15 3.15 0 1 1-6.3 0 3.15 3.15 0 0 1 6.3 0Z"/><path d="M11 2c4.38 0 8.1 3.63 8.1 8.03 0 4.47-3.78 7.62-7.27 9.75a1.7 1.7 0 0 1-1.67 0C6.68 17.63 2.9 14.52 2.9 10.03 2.9 5.63 6.62 2 11 2Z"/></g>',
  nav: '<path d="M3 11 22 2l-9 19-2-8-8-2z"/>',
  read: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  cam: '<g transform="scale(1.0909)"><path d="M11 3.34h1.92c.87 0 1.7.45 2.14 1.2l.06.12c.2.34.48.62.82.81.34.19.73.29 1.12.29a3.01 3.01 0 0 1 3.02 3.01v3.28c0 2.54 0 3.82-.63 4.73-.25.37-.57.69-.94.94-.91.62-2.18.62-4.73.62H8.22c-2.55 0-3.82 0-4.73-.62a3.6 3.6 0 0 1-.94-.94c-.62-.91-.62-2.19-.62-4.73V8.76a3.01 3.01 0 0 1 3.01-3.01c.8 0 1.53-.42 1.94-1.11l.06-.1c.45-.75 1.25-1.2 2.12-1.2H11Z"/><path d="M17.38 8.79a.4.4 0 1 1-.8 0 .4.4 0 0 1 .8 0Z"/><path d="M11 15.35a3.54 3.54 0 1 0 0-7.09 3.54 3.54 0 0 0 0 7.09Z"/></g>',
  camoff: '<path d="M2 2l20 20M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16M9.5 4h5L17 7h3a2 2 0 0 1 2 2v7.5M14.121 15.121A3 3 0 1 1 9.88 10.88"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
  down: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
  vol: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  voloff:
    '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="m22 9-6 6M16 9l6 6"/>',
  zoomin: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
  zoomout: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  vib: '<path d="m2 8 2 2-2 2 2 2-2 2M22 8l-2 2 2 2-2 2 2 2"/><rect width="8" height="14" x="8" y="5" rx="1"/>',
  motion:
    '<g transform="scale(1.0909) translate(-17 -18)"><path d="M17.59 29h5.49M19.79 24.61h3.84M19.79 33.39h3.84M26.1 29a6.04 6.04 0 1 0 12.08 0 6.04 6.04 0 1 0-12.08 0Z"/></g>',
  trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>',
  play: '<path d="M6 3l14 9-14 9z"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  out: '<path d="M7 17 17 7M8 7h9v9"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  layers:
    '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83zM22 17.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  cube: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.3 7l8.7 5 8.7-5M12 22V12"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  tune: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  towers: '<g transform="scale(.9231)"><path d="M6.23 16.79h13.54c.5 0 .99.2 1.34.56.36.35.56.84.56 1.34v2.71c0 .5-.2.99-.56 1.34-.35.36-.84.56-1.34.56H6.23c-.5 0-.99-.2-1.34-.56a1.9 1.9 0 0 1-.56-1.34v-2.71c0-.5.2-.99.56-1.34.35-.36.84-.56 1.34-.56ZM8.4 10.29h9.2c.5 0 .99.2 1.34.56.36.35.56.84.56 1.34v2.71c0 .5-.2.99-.56 1.34-.35.36-.84.56-1.34.56H8.4c-.5 0-.99-.2-1.34-.56-.36-.35-.56-.84-.56-1.34v-2.71c0-.5.2-.99.56-1.34.35-.36.84-.56 1.34-.56ZM12.99 9.95l4.4-.95c.42-.09.79-.34 1.02-.7.23-.35.32-.79.23-1.21l-.44-2.23a1.64 1.64 0 0 0-1.94-1.27l-4.4.94c-.42.09-.79.34-1.02.7-.23.35-.32.79-.23 1.21l.44 2.23a1.64 1.64 0 0 0 1.94 1.27Z"/></g>',
  fountain: '<g transform="scale(.9231)"><path d="M13 18.96V4.33M10.02 5.96c-2.35.36-3.88 2.53-4.6 6.5M15.98 5.96c2.35.36 3.88 2.53 4.6 6.5M2.71 18.96c0 1 1.08 1.97 3.01 2.68 1.93.71 4.55 1.11 7.28 1.11s5.35-.4 7.28-1.11c1.93-.71 3.01-1.68 3.01-2.68s-1.08-1.97-3.01-2.68c-1.93-.71-4.55-1.11-7.28-1.11s-5.35.4-7.28 1.11c-1.93.71-3.01 1.68-3.01 2.68Z"/></g>',
  waves:
    '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.850-5.360 5.080-6C9.500 14.520 12 13 13 12"/>',
  flash: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>'
};
export const ic = (k, s = 22, cls = '') =>
  `<svg${cls ? ` class="${cls}"` : ''} width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${(24 / s).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
export const logo = (w, sw) =>
  `<svg width="${w}" height="${Math.round(w * 0.825)}" viewBox="20 44 160 132" fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M40 112a60 60 0 0 1 120 0M87.9 105L48 82M93 99.9L70 60M100 98V52M107 99.9L130 60M112.1 105L152 82M86 112a14 14 0 0 1 28 0"/><path stroke="#51ECCF" d="M28 138q18-17 36 0t36 0t36 0t36 0M28 164q18-17 36 0t36 0t36 0t36 0"/></svg>`;

/* guidance signs: a small pictogram that moves, plus one or two words */
const wheelG = (cx, cy, r = 10) => {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + 0.52;
    d += `M${(cx + 3.6 * Math.cos(a)).toFixed(1)} ${(cy + 3.6 * Math.sin(a)).toFixed(1)}L${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}"/><circle cx="${cx}" cy="${cy}" r="2"/><path d="${d}"/>`;
};
const RAYS = (() => {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    d += `M${(14 + 7.4 * Math.cos(a)).toFixed(1)} ${(14 + 7.4 * Math.sin(a)).toFixed(1)}L${(14 + 10.6 * Math.cos(a)).toFixed(1)} ${(14 + 10.6 * Math.sin(a)).toFixed(1)}`;
  }
  return d;
})();
/* the corner marks of the scan frame, as they appear inside several signs */
const MARKS = 'M3 9V5.5Q3 3 5.5 3H9M19 3h3.5Q25 3 25 5.5V9M25 19v3.5Q25 25 22.5 25H19M9 25H5.5Q3 25 3 22.5V19';
/* "face the drawing": a card seen from one side (the nearer edge looks longer) that turns until it is seen straight-on */
const CARD = {
  flat: '5,7 23,7 23,21 5,21',
  right: '9,10 21,5 21,23 9,18',
  left: '7,5 19,10 19,18 7,23',
  up: '3,9 25,9 20,19 8,19',
  down: '8,9 20,9 25,19 3,19'
};
const turnCard = (near) => {
  const from = CARD[near],
    steps = from ? [from, from, CARD.flat, CARD.flat, from] : [CARD.right, CARD.flat, CARD.left, CARD.flat, CARD.right],
    times = from ? '0;.15;.6;.9;1' : '0;.25;.5;.75;1';
  return `<polygon points="${from || CARD.right}">${STILL ? '' : `<animate attributeName="points" dur="${from ? 2.4 : 3.6}s" repeatCount="indefinite" calcMode="spline" keyTimes="${times}" keySplines=".4 0 .2 1;.4 0 .2 1;.4 0 .2 1;.4 0 .2 1" values="${steps.join(';')}"/>`}</polygon>`;
};
/* "centre the drawing": where the little card starts from, 9 units out in the direction the drawing really is */
const startAt = (dx = -1, dy = 0) => {
  const l = Math.hypot(dx, dy) || 1;
  return `--sx:${((dx / l) * 9).toFixed(1)}px;--sy:${((dy / l) * 9).toFixed(1)}px`;
};

/* Each sign: w (width of its picture), label, sub (an optional second line), when (the explanation on the Guidelines screen)
   and svg: the picture, or a function of what the camera sees ({ near }, { dx, dy }) that returns it. */
export const SIGNS = {
  frame: {
    w: 28,
    label: 'Point at a drawing on the wheel',
    sub: 'Hold it a hand’s length away',
    when: 'The camera has looked for a few seconds and sees nothing to read.',
    svg: `<path class="a fr" d="${MARKS}"/><circle cx="14" cy="14" r="4.6"/><circle cx="14" cy="14" r="1"/>`
  },
  closer: {
    w: 28,
    label: 'Move closer',
    when: 'The drawing is recognised, but it is still far away and small.',
    svg: `<path class="a" d="${MARKS}"/><rect class="grow" x="10" y="11" width="8" height="6" rx="1"/>`
  },
  back: {
    w: 28,
    label: 'Move back a little',
    when: 'The phone is so close that the drawing is blurred or no longer fits in the picture. The sign stays until you have moved back.',
    svg: `<path class="a" d="${MARKS}"/><rect class="grow" x="10" y="11" width="8" height="6" rx="1"/>`
  },
  centre: {
    w: 28,
    label: 'Bring the drawing to the middle',
    when: 'The drawing is recognised near the edge of the picture. An arrow on the camera picture shows the way.',
    svg: (o = {}) => `<path class="a" d="${MARKS}"/><rect class="slide" x="9.5" y="10.5" width="9" height="7" rx="1" style="${startAt(o.dx, o.dy)}"/>`
  },
  face: {
    w: 28,
    label: 'Turn the drawing to face the camera',
    when: 'The drawing is seen from the side. The picture shows which edge is nearer; turn the wheel or move the phone until it looks straight.',
    svg: (o = {}) => `<path class="a" d="${MARKS}"/>${turnCard(o.near)}`
  },
  light: {
    w: 28,
    label: 'More light',
    when: 'The picture is too dark to read the drawing.',
    svg: `<circle cx="14" cy="14" r="4.2"/><path class="a rays" d="${RAYS}"/>`
  },
  steady: {
    w: 44,
    label: 'Hold steady',
    when: 'The phone or the wheel is moving too fast.',
    svg: `<rect class="ph" x="15" y="3" width="14" height="22" rx="3"/><path class="a arc" d="M10 8q-4 6 0 12M5 10.5q-2.4 3.5 0 7M34 8q4 6 0 12M39 10.5q2.4 3.5 0 7"/>`
  },
  wrong: {
    w: 28,
    label: 'Can’t see a souvenir drawing here',
    sub: 'Hold one a hand’s length away, facing the camera',
    when: 'The camera sees something clearly, but it is not one of the four drawings: another object, another side of the wheel, or a drawing too far away to read.',
    svg: '<circle cx="14" cy="14" r="10.5"/><path class="a no" d="M6.6 6.6 21.4 21.4"/><path d="M10.5 12h7v6.5h-7z" stroke-opacity=".55"/>'
  },
  turn: {
    w: 48,
    label: 'Turn the wheel to the next drawing',
    when: 'After you tap Next, until another drawing comes into view.',
    svg: `<g class="wh">${wheelG(24, 17, 8)}</g><path class="a" d="M11.8 12.6A13 13 0 0 1 36.2 12.6M15.5 10L11.8 12.6L10.6 8.2M32.5 10L36.2 12.6L37.4 8.2"/>`
  },
  same: {
    w: 48,
    label: 'You’ve just explored this one',
    sub: 'Turn the wheel to the next drawing',
    when: 'After you tap Next, while the drawing you came from is still in view.',
    svg: `<g class="wh">${wheelG(24, 17, 8)}</g><path class="a" d="M11.8 12.6A13 13 0 0 1 36.2 12.6M15.5 10L11.8 12.6L10.6 8.2M32.5 10L36.2 12.6L37.4 8.2"/>`
  }
};
/* signHTML(kind, { live, near, dx, dy }): `live` = on the camera screen (animated in); the rest picks the picture's variant */
export const signPic = (k, o = {}) => {
  const s = SIGNS[k];
  return `<svg class="pic pic-${k === 'same' ? 'turn' : k}" width="${s.w}" height="28" viewBox="0 0 ${s.w} 28" aria-hidden="true">${typeof s.svg === 'function' ? s.svg(o) : s.svg}</svg>`;
};
export const signHTML = (k, o = {}) => {
  const s = SIGNS[k];
  return `<div class="sign${s.sub ? ' two' : ''}" data-k="${k}">${signPic(k, o)}<span>${s.label}${s.sub ? `<small>${s.sub}</small>` : ''}</span></div>`;
};
