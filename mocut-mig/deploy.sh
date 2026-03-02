#!/bin/bash
set -euo pipefail

VPS_USER="root"
VPS_IP="94.143.140.232"
REMOTE_PATH="/home/webs/web/macout.es/public_html"

echo "🚀 Deploying..."
rsync -avz \
  --exclude='.DS_Store' \
  --exclude='.git' \
  --exclude='.env.local' \
  --exclude='deploy.sh' \
  server.js \
  package.json \
  public/ \
  data/ \
  $VPS_USER@$VPS_IP:$REMOTE_PATH/

echo "♻️ Restarting + fixing Nginx (single SSH session)..."
ssh "$VPS_USER@$VPS_IP" 'bash -s' <<EOF
set -euo pipefail

REMOTE_PATH="$REMOTE_PATH"
HTTP_CONF="/etc/nginx/conf.d/domains/macout.es.conf"
HTTPS_CONF="/etc/nginx/conf.d/domains/macout.es.ssl.conf"
HTTP_INCLUDE="/home/webs/conf/web/macout.es/nginx.conf_api.conf"
HTTPS_INCLUDE="/home/webs/conf/web/macout.es/nginx.ssl.conf_api.conf"

read -r -d "" SNIPPET << "BLOCK" || true
        location /api/ {
                proxy_pass http://127.0.0.1:9010;
                proxy_http_version 1.1;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
        }

        location = /dashboard {
                return 302 /dashboard.html;
        }

BLOCK

cd "\$REMOTE_PATH"
npm install --omit=dev
pm2 restart macout-pm2 || pm2 start server.js --name macout-pm2

sanitize_conf() {
  local conf="$1"
  [ -f "$conf" ] || return 0
  perl -0777 -i -pe 's@\n\s*location /api/ \{.*?\n\s*\}\n@@sg; s@\n\s*location = /dashboard \{.*?\n\s*\}\n@@sg' "$conf"
}

patch_conf() {
  local conf="$1"
  sanitize_conf "$conf"

  local tmp
  tmp="$(mktemp)"
  awk -v snippet="$SNIPPET" '
    /^[[:space:]]*location \/ \{/ && !done {
      print snippet
      done = 1
    }
    { print }
  ' "$conf" > "$tmp"
  cp "$tmp" "$conf"
  rm -f "$tmp"
  echo "Patched: $conf"
}

# Avoid duplicate location blocks loaded from Hestia includes.
mkdir -p /home/webs/conf/web/macout.es
: > "$HTTP_INCLUDE"
: > "$HTTPS_INCLUDE"

patch_conf "$HTTP_CONF"
patch_conf "$HTTPS_CONF"

nginx -t
systemctl reload nginx
EOF

echo "🩺 Checking public endpoints..."
curl -sS -o /dev/null -w "api_health_http=%{http_code}\n" "https://www.macout.es/api/health" || true
curl -sS -o /dev/null -w "dashboard_html_http=%{http_code}\n" "https://www.macout.es/dashboard.html" || true

echo "✅ Done!"
