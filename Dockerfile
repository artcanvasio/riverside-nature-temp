# Watermarks XR · Digital overlays — a static site served by nginx (Coolify: build pack "Dockerfile"). No build step.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html viewer.js viewer.css data.js gl.js icons.js motion.js favicon.ico /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY fonts /usr/share/nginx/html/fonts
COPY vendor /usr/share/nginx/html/vendor
COPY models /usr/share/nginx/html/models
COPY overlays /usr/share/nginx/html/overlays
# compress text files and models once; nginx then sends the .gz files. The last line checks the configuration.
RUN find /usr/share/nginx/html -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' -o -name '*.svg' -o -name '*.glb' \) \
      | while read -r f; do gzip -9 -c "$f" > "$f.gz"; done \
 && nginx -t
EXPOSE 80
