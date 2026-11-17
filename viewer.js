/* Watermarks XR · Digital overlays — the four overlays of the app on one page, with a switch between them.
   The overlays themselves (overlays/, models/) are the app's own files, copied by sync.sh; this page only frames them,
   with the same controls the app shows (without Story, Photo and Next, which belong to the app's journey).
   The address remembers the overlay: #towers, #fountain, #kanal, #river. */
import { LM, ORDER, OVERLAYS, RIVERSIDE } from './data.js';
import { ic } from './icons.js';
import { askMotion } from './motion.js';

const $ = (id) => document.getElementById(id);
const xp = $('xp'), stage = $('xstage'), ctl = $('xctl'), load = $('xload'), ring = $('xring'), msg = $('xmsg'), cap = $('xcap'), bar = $('switch');
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SHORT = { towers: 'Towers', fountain: 'Fountain', kanal: 'Ice Kanal', river: 'Riverside' };
let ov = null, ac = null, current = null, hintT = 0;

bar.innerHTML = ORDER.map((id) => `<button data-id="${id}" aria-current="false" aria-label="${LM[id].name}">${ic(LM[id].icon, 20)}<span>${SHORT[id]}</span></button>`).join('');
bar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (!b) return;
  askMotion(); // the phone may ask once, in this tap; the Ice Kanal and Riverside then follow the phone's turning
  if (b.dataset.id !== current) location.hash = b.dataset.id;
});

const cbtn = (b) => `<button class="cbtn" data-b="${b.id}" aria-pressed="${!!b.on}"><span class="disc">${ic(b.icon)}</span><em>${b.label}</em></button>`;
const paint = () => (ctl.innerHTML = ov && ov.buttons ? ov.buttons.map(cbtn).join('') : '');
ctl.addEventListener('click', (e) => {
  const k = e.target.closest('[data-b]');
  const b = k && ov && ov.buttons.find((x) => x.id === k.dataset.b);
  if (!b) return;
  b.tap();
  if (navigator.vibrate) navigator.vibrate(15);
  paint();
});

function close() {
  if (ac) ac.abort();
  if (ov) {
    try { ov.destroy(); } catch (e) {}
    ov = null;
  }
  clearTimeout(hintT);
  document.querySelectorAll('.xp-hint').forEach((h) => h.remove());
  stage.textContent = '';
  ctl.textContent = '';
  cap.textContent = '';
  xp.classList.remove('immersive');
}

function fail(text, id) {
  load.hidden = false;
  load.classList.add('err');
  msg.textContent = text;
  const b = document.createElement('button');
  b.className = 'again';
  b.textContent = 'Try again';
  b.onclick = () => { current = null; show(id); };
  load.appendChild(b);
}

async function show(id) {
  if (!LM[id]) id = ORDER[0];
  if (id === current) return;
  close();
  current = id;
  const l = LM[id], mine = (ac = new AbortController());
  document.title = `${l.name} · Watermarks XR`;
  $('xname').textContent = l.name;
  bar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.id === id)));
  load.querySelector('.again')?.remove();
  load.classList.remove('err');
  load.hidden = false;
  ring.style.strokeDashoffset = '176';
  msg.textContent = `Loading ${l.name}`;

  if (id === 'river') {
    // Riverside Nature is a small page of its own; it draws its own round buttons, placed above the switch
    const f = document.createElement('iframe'), barTop = innerHeight - bar.getBoundingClientRect().top;
    f.className = 'xp-frame';
    f.title = l.name;
    f.setAttribute('allow', 'accelerometer; gyroscope; magnetometer; autoplay; fullscreen');
    f.addEventListener('load', () => (load.hidden = true));
    setTimeout(() => current === id && (load.hidden = true), 6000);
    f.src = `${RIVERSIDE}?embed=1&sat=0&sab=${Math.round(Math.max(0, barTop - 6))}`;
    cap.textContent = 'A window onto the Lech';
    stage.appendChild(f);
    return;
  }

  try {
    const mod = await OVERLAYS[id]();
    if (mine.signal.aborted) return;
    const r = stage.getBoundingClientRect();
    const made = await mod.open(stage, {
      signal: mine.signal,
      reduce: REDUCE,
      motion: true,
      inset: { top: 64, bottom: Math.max(0, r.bottom - bar.getBoundingClientRect().top + 100) },
      progress: (k) => (ring.style.strokeDashoffset = (176 * (1 - k)).toFixed(1)),
      caption: (t) => current === id && (cap.textContent = t),
      refresh: () => current === id && paint()
    });
    if (mine.signal.aborted) { made.destroy(); return; }
    ov = made;
    load.hidden = true;
    xp.classList.toggle('immersive', !!ov.immersive);
    paint();
    if (ov.hint) {
      xp.insertAdjacentHTML('beforeend', `<p class="xp-hint" aria-hidden="true">${ov.hint}</p>`);
      const h = xp.lastElementChild;
      hintT = setTimeout(() => h.remove(), 4200);
    }
  } catch (e) {
    if (mine.signal.aborted || (e && e.name === 'AbortError')) return;
    console.error('The overlay could not open', e);
    fail(/WebGL/.test(String(e && e.message)) ? 'This browser can’t show 3D here. Try another browser, or a newer phone.' : `${l.name} could not be loaded. Check your connection, then try again.`, id);
  }
}

const route = () => show(location.hash.slice(1));
addEventListener('hashchange', route);
route();
