#!/bin/sh
# Genera config.js con las variables del entorno del contenedor, para que la
# misma imagen sirva en cualquier entorno sin recompilar el bundle.
set -eu

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

target="${CONFIG_JS_PATH:-/usr/share/nginx/html/config.js}"

cat > "$target" <<EOF
window.__APP_CONFIG__ = {
  "endorseApiUrl": "$(json_escape "${ENDORSE_API_URL:-}")",
  "routesApiUrl": "$(json_escape "${ROUTES_API_URL:-}")",
  "clientId": "$(json_escape "${CLIENT_ID:-}")",
  "clientSecret": "$(json_escape "${CLIENT_SECRET:-}")"
};
EOF

echo "runtime-config: $target generado"
