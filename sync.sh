#!/bin/sh
# Copies the four overlays and what they need from the Watermarks XR app, so this site always shows the app's latest version.
#   ./sync.sh ../watermarksxr
# Only the files listed here are copied; the page itself (index.html, viewer.js, viewer.css) belongs to this repository.
set -e
APP="${1:-../watermarksxr}"
[ -f "$APP/overlays/kit.js" ] || { echo "Not the Watermarks XR app: $APP"; exit 1; }
rm -rf overlays models vendor fonts
mkdir -p vendor assets
cp -R "$APP/overlays" "$APP/models" "$APP/fonts" .
cp "$APP/vendor/three.module.min.js" "$APP/vendor/three-extras.min.js" vendor/
cp "$APP/gl.js" "$APP/icons.js" "$APP/motion.js" "$APP/data.js" .
cp "$APP/assets/wheel.svg" "$APP/assets/wheel-180.png" "$APP/assets/wheel-192.png" "$APP/assets/wheel-512.png" assets/
cp "$APP/favicon.ico" .
echo "Copied from $APP ($(git -C "$APP" rev-parse --short HEAD 2>/dev/null || echo '?'))" > SOURCE.txt
echo "done: $(cat SOURCE.txt)"
