/* Watermarks XR — what the app knows: the four landmarks, their overlays, and the settings of the camera guidance.
   Texts shown to visitors live here, so they can be changed without touching the screens in app.js. */

/* the four landmarks: names and short texts, the real place in Augsburg, and the story shown under "Story" */
export const LM = {
  towers: {
    id: 'towers',
    name: 'Water Towers',
    eyebrow: 'Explore in 3D',
    sub: 'See inside the towers',
    icon: 'towers',
    place: 'Wasserwerk am Roten Tor',
    addr: 'Am Roten Tor',
    lat: 48.3599136,
    lng: 10.9034697,
    maps: 'https://maps.app.goo.gl/2UNcC8hiNBaSYs799',
    intro:
      'Water wheels once drove pumps and Archimedes screws that lifted river water to the top of these towers. From there, gravity carried it to the city’s fountains.'
  },
  fountain: {
    id: 'fountain',
    name: 'Augustus Fountain',
    eyebrow: 'Monument',
    sub: 'Clean water, made a work of art',
    icon: 'fountain',
    place: 'Augustusbrunnen',
    addr: 'Rathausplatz',
    lat: 48.3690536,
    lng: 10.8979332,
    maps: 'https://maps.app.goo.gl/NUD3z5P5gvJmfu9fA',
    intro: 'The Augustus Fountain stands in front of the Town Hall. Four bronze figures around the basin stand for Augsburg’s waters.'
  },
  kanal: {
    id: 'kanal',
    name: 'Ice Kanal',
    eyebrow: 'First-person ride',
    sub: 'Hold on tight',
    icon: 'waves',
    place: 'Augsburg Eiskanal',
    addr: 'Am Eiskanal',
    lat: 48.3477386,
    lng: 10.9363605,
    maps: 'https://maps.app.goo.gl/VRpriZ8Syw6AvMq39',
    intro:
      'The Eiskanal was built for the canoe slalom of the 1972 Olympic Games, as the first artificial whitewater course of its kind. Paddlers still train and race here.'
  },
  river: {
    id: 'river',
    name: 'Riverside Nature',
    eyebrow: 'Wildlife window',
    sub: 'Life at the Hochablass weir',
    icon: 'leaf',
    place: 'Hochablass',
    addr: 'Lech weir',
    lat: 48.3439827,
    lng: 10.9367596,
    maps: 'https://maps.app.goo.gl/QWmHVdSsa2V3KjdZA',
    intro:
      'At the Hochablass weir, part of the Lech is led into Augsburg’s canals. Along its banks the river stays green and calm, a home for swans, gulls and grayling.'
  }
};
export const ORDER = ['towers', 'fountain', 'kanal', 'river']; // same order as the bead forms and the recognition targets
export const CENTRE = { lat: 48.3689, lng: 10.8985, label: 'Rathausplatz' };
export const STEPS = [
  'Hold the water wheel with a drawing facing you.',
  'Point your phone at the drawing to scan it.',
  'When the landmark is found, tap Explore.',
  'Turn the wheel to find the next landmark.'
];

/* each landmark's overlay is a module of its own, fetched when a visitor opens it. Riverside Nature is a small page of its own, shown in a frame. */
export const OVERLAYS = {
  towers: () => import('./overlays/towers.js'),
  fountain: () => import('./overlays/fountain.js'),
  kanal: () => import('./overlays/kanal.js')
};
export const RIVERSIDE = 'overlays/riverside/index.html';
export const EXPLORE_WITHOUT_SCAN = true; // a landmark's page offers "Explore" too, for visitors without the souvenir or a camera

/* Camera guidance: when the camera screen speaks up. Times are in milliseconds; sizes are shares of the screen.
   The "Landmark found" card is up exactly while a drawing is held towards the camera: recognised, large enough, not too close,
   near the middle and facing the phone. Held any other way, a sign says what to change, for as long as it is held that way.
   A visitor who holds the souvenir well sees none of the signs: the card simply appears. */
export const GUIDE = {
  frameAfter: 3000, // nothing recognised for this long: "Point at a drawing on the wheel"
  wrongAfter: 2500, // a clear picture of something else for this long: "Can't see a souvenir drawing here"
  failAfter: 12000, // still nothing recognised: the card "Couldn't find it" offers to choose by hand
  stuckAfter: 20000, // … and the same after this long without a "Landmark found" card, whatever has been in view (a way out, never a dead end)
  turnFor: 12000, // after "Next": how long "Turn the wheel" shows, and how long the drawing just explored is not offered again
  far: 0.2, // a recognised drawing smaller than this share of the screen's short side: "Move closer"
  sure: 0.3, // a well-held drawing at least this large is accepted the moment it is recognised
  close: 0.95, // larger than this: "Move back a little"
  closeMemory: 4000, // a drawing that filled the picture when it went out of sight came too close: "Move back a little" stays this long
  offX: 0.27, // its middle further from the frame's middle than this share of the screen width …
  offY: 0.2, // … or of the screen height: "Bring the drawing to the middle"
  tilt: 38, // seen more than this many degrees from straight-on: "Turn the drawing to face the camera" …
  tiltFrom: 0.22, // … once the drawing is at least this large (the angle of a smaller one cannot be read surely)
  letGo: 500 // a card that is up goes when its drawing has been held badly for this long (a moment's wobble does nothing)
};
