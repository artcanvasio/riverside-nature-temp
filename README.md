# Watermarks XR · Digital overlays

The four digital overlays of Watermarks XR on one page, with a switch between them:
**Water Towers**, **Augustus Fountain**, **Ice Kanal** and **Riverside Nature**.

Planned address: https://overlay.artcanvas.io · `#towers`, `#fountain`, `#kanal` and `#river` open one overlay directly.

Each overlay keeps only the controls it has in the phone app:

| Overlay           | Controls                                                       |
| ----------------- | -------------------------------------------------------------- |
| Water Towers      | Inside (walls turn to glass), Flow · drag to look around       |
| Augustus Fountain | Pause · drag to look around                                    |
| Ice Kanal         | Pause, Rider view · drag or turn the phone to look around      |
| Riverside Nature  | Sound, Zoom, Reset · tap the animals · drag or turn the phone  |

Story, Photo and Next belong to the app's journey and are left out here.

## Where the files come from

The overlays are the app's own files, never edited here. `sync.sh` copies them from a checkout of the app
(`artcanvasio/watermarksxr`), so this page always shows the latest version:

    ./sync.sh ../watermarksxr      # then commit and push

Copied: `overlays/`, `models/`, `fonts/`, `vendor/three*.js`, `gl.js`, `icons.js`, `motion.js`, `data.js`, the icons.
This repository's own files: `index.html`, `viewer.js` (the switch and the controls), `viewer.css`, `nginx.conf`, `Dockerfile`.
`SOURCE.txt` says which app commit was copied last.

## Running it

Any static server, for example `python3 -m http.server 8080`, then open http://localhost:8080/.
Phones need https for the motion sensor.

## Deploying (Coolify)

New resource → this repository, branch `main`, build pack **Dockerfile**, domain `https://overlay.artcanvas.io`.
The DNS of artcanvas.io needs a record for `overlay` pointing at the same server as `watermarks`.
The build compresses the files and checks `nginx.conf`; a mistake there stops the build, not the site.

## Security

Everything is served from this site (no fonts, libraries or trackers from elsewhere), with a strict Content Security Policy,
no camera, location or microphone (only the motion sensor, for looking around), and only reading requests are answered.
