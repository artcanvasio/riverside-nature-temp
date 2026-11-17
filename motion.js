/* Watermarks XR — the phone's motion sensor (gyroscope).
   It is asked for once, in the same step as the camera, so no visitor is stopped a second time.
   Used on the Ice Kanal ride: turning or tilting the phone shifts the view a little, like looking around from the boat.
   Phones without a gyroscope simply keep the view still; nothing else depends on it. */

let state = 'unknown'; // 'granted' | 'denied' | 'none' (this browser has no motion sensor) | 'unknown' (not asked yet)
let asking = null;
let gyro = false; // a real gyroscope has been heard from

export const motionState = () => state;
/** True once the phone has shown that it has a gyroscope. Without one the phone's angles tremble, and the view is better left still. */
export const hasGyro = () => gyro;

/* Listen until a gyroscope is heard from. Listening keeps the sensors awake, so it ends by itself after `ms`
   (or, with no `ms`, when the returned function is called). */
function probe(ms) {
  if (gyro) return () => {};
  const heard = (ev) => {
      const r = ev.rotationRate;
      if (r && (r.alpha != null || r.beta != null || r.gamma != null)) {
        gyro = true;
        done();
      }
    },
    done = () => removeEventListener('devicemotion', heard);
  addEventListener('devicemotion', heard);
  if (ms) setTimeout(done, ms);
  return done;
}

/** Start finding out whether there is a gyroscope, and keep at it until one is heard from (see hasGyro). Calling it again changes nothing. */
let finding = false;
export function findGyro() {
  if (finding || gyro) return;
  finding = true;
  probe();
}

/** Ask for the motion sensor. Phones that ask their owner first (iPhones, newer Android browsers) only do so when this is
    called straight from a tap; where no question is needed the answer is 'granted' at once. Never throws.
    A "no" is remembered for this visit, so nobody is asked again at every scan; `again` asks once more all the same
    (for the Permissions row in Settings, which the visitor taps on purpose). */
export function askMotion(again = false) {
  if (state === 'granted' || state === 'none' || (state === 'denied' && !again)) return Promise.resolve(state);
  if (asking) return asking;
  const M = window.DeviceMotionEvent,
    O = window.DeviceOrientationEvent;
  if (!M && !O) return Promise.resolve((state = 'none'));
  const api = M && typeof M.requestPermission === 'function' ? M : O && typeof O.requestPermission === 'function' ? O : null; // one question covers both
  if (!api) {
    probe(3000);
    return Promise.resolve((state = 'granted'));
  }
  try {
    asking = api
      .requestPermission()
      .then(
        (answer) => {
          state = answer === 'granted' ? 'granted' : 'denied';
          if (state === 'granted') probe(3000);
        },
        () => {} // not called from a tap: stay 'unknown', and ask again at the next one
      )
      .then(() => {
        asking = null;
        return state;
      });
    return asking;
  } catch (e) {
    return Promise.resolve(state);
  }
}

/* ---- the phone's attitude as a quaternion [x, y, z, w], the way a camera looking out of its back would be turned ---- */
const RAD = Math.PI / 180,
  H = Math.SQRT1_2,
  REACH = 0.6; // radians (about 34°)
const mul = (a, b) => [
  a[0] * b[3] + a[3] * b[0] + a[1] * b[2] - a[2] * b[1],
  a[1] * b[3] + a[3] * b[1] + a[2] * b[0] - a[0] * b[2],
  a[2] * b[3] + a[3] * b[2] + a[0] * b[1] - a[1] * b[0],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
];
function attitude(alpha, beta, gamma, screen) {
  const x = beta * RAD,
    y = alpha * RAD,
    z = -gamma * RAD,
    c1 = Math.cos(x / 2),
    c2 = Math.cos(y / 2),
    c3 = Math.cos(z / 2),
    s1 = Math.sin(x / 2),
    s2 = Math.sin(y / 2),
    s3 = Math.sin(z / 2);
  let q = [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3]; // the phone, turned by its three angles
  q = mul(q, [-H, 0, 0, H]); // the camera looks out of the phone's back, not its top
  return mul(q, [0, 0, -Math.sin((screen * RAD) / 2), Math.cos((screen * RAD) / 2)]); // the screen may be turned sideways
}

/** Follow how the phone is turned. `on(yaw, pitch)` gets how far it has turned to the left (+) or right (−) and up (+) or down (−),
    in radians, measured from the way it has been held lately: hold the phone still in any pose and both ease back to zero within
    a few seconds (`settle`). So "straight ahead" is always wherever the visitor is comfortable, and nobody can turn all the way round.
    Rolling the phone like a steering wheel changes nothing. Returns a function that stops it. */
export function watchTurn(on, { settle = 5 } = {}) {
  let rest = null, // the attitude the phone has lately been held in
    last = 0;
  const stopProbe = probe();
  const turned = (ev) => {
    if (!gyro || ev.alpha == null || ev.beta == null || ev.gamma == null) return;
    const so = window.screen && window.screen.orientation,
      q = attitude(ev.alpha, ev.beta, ev.gamma, so && typeof so.angle === 'number' ? so.angle : Number(window.orientation) || 0),
      t = performance.now(),
      dt = last ? Math.min(0.25, (t - last) / 1000) : 0;
    last = t;
    if (!rest) rest = q;
    let dot = rest[0] * q[0] + rest[1] * q[1] + rest[2] * q[2] + rest[3] * q[3];
    if (dot < 0) {
      rest = rest.map((v) => -v); // the same attitude can be written two ways
      dot = -dot;
    }
    // the resting attitude follows the phone slowly, and is never left further behind than REACH: after a big turn, "straight ahead" is soon found again
    const angle = 2 * Math.acos(Math.min(1, dot)),
      k = Math.max(1 - Math.exp(-dt / settle), angle > REACH ? 1 - REACH / angle : 0),
      sin = Math.sin(angle / 2),
      a = sin > 1e-4 ? Math.sin(((1 - k) * angle) / 2) / sin : 1 - k,
      b = sin > 1e-4 ? Math.sin((k * angle) / 2) / sin : k;
    rest = rest.map((v, i) => v * a + q[i] * b);
    const d = mul([-rest[0], -rest[1], -rest[2], rest[3]], q); // from the resting attitude to the present one
    on(
      Math.atan2(2 * (d[0] * d[2] + d[3] * d[1]), 1 - 2 * (d[0] * d[0] + d[1] * d[1])),
      Math.asin(Math.max(-1, Math.min(1, 2 * (d[3] * d[0] - d[1] * d[2]))))
    );
  };
  addEventListener('deviceorientation', turned);
  return () => {
    stopProbe();
    removeEventListener('deviceorientation', turned);
  };
}
