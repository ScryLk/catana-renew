#!/usr/bin/env bash
# Exercise the production config with a disposable local TLS certificate and a
# mock Django upstream. No production service, credential or certificate is used.
set -euo pipefail
cd "$(dirname "$0")/.."
repo_root="$PWD"
nginx_config="${NGINX_TEST_CONFIG:-$repo_root/nginx/nginx.conf}"
test_dir="$(mktemp -d "${TMPDIR:-/tmp}/catana-coop-test.XXXXXX")"
test_container=""
docker_local() {
  env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH \
    docker --host=unix:///var/run/docker.sock "$@"
}
cleanup() {
  if [ -n "$test_container" ]; then docker_local rm -f "$test_container" >/dev/null 2>&1 || true; fi
  rm -rf "$test_dir"
}
trap cleanup EXIT
mkdir -p "$test_dir/certs" "$test_dir/html"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -subj '/CN=localhost' -addext 'subjectAltName=IP:127.0.0.1,DNS:localhost,DNS:usecatana.com.br,DNS:www.usecatana.com.br' \
  -keyout "$test_dir/certs/privkey.pem" -out "$test_dir/certs/fullchain.pem" \
  >/dev/null 2>&1
printf '<!doctype html><title>Local COOP smoke fixture</title>\n' > "$test_dir/html/index.html"
chmod 755 "$test_dir/html"
chmod 644 "$test_dir/html/index.html"
cat > "$test_dir/mock-upstream.conf" <<'NGINX'
server {
    listen 8000;
    add_header Cross-Origin-Opener-Policy "same-origin-allow-popups" always;
    add_header X-Frame-Options "DENY" always;
    location / { return 200 'mock Django response'; }
}
NGINX
test_container="$(docker_local run --detach --rm \
  --add-host backend:127.0.0.1 --publish 127.0.0.1::443 \
  --mount "type=bind,src=$nginx_config,dst=/etc/nginx/conf.d/default.conf,readonly" \
  --mount "type=bind,src=$test_dir/mock-upstream.conf,dst=/etc/nginx/conf.d/mock-upstream.conf,readonly" \
  --mount "type=bind,src=$test_dir/certs,dst=/etc/letsencrypt/live/usecatana.com.br,readonly" \
  --mount "type=bind,src=$test_dir/html,dst=/usr/share/nginx/html,readonly" \
  "${NGINX_TEST_IMAGE:-nginx:alpine}")"
docker_local exec "$test_container" nginx -t
test_port="$(docker_local port "$test_container" 443/tcp)"
test_port="${test_port##*:}"
for route in / /sign-in /api/profile/ /admin/; do
  # This address is the disposable loopback container, never the remote domain.
  curl --silent --show-error --head --max-time 5 --retry 5 --retry-connrefused --retry-delay 1 \
    --cacert "$test_dir/certs/fullchain.pem" -H 'Host: usecatana.com.br' \
    "https://127.0.0.1:$test_port$route" > "$test_dir/headers.txt"
  node --input-type=module - "$test_dir/headers.txt" "$route" <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const [file, route] = process.argv.slice(2);
const headers = readFileSync(file, 'utf8').trim().split(/\r?\n/);
assert.match(headers[0], /^HTTP\/\S+ 200\b/);
const coop = headers.filter((header) => /^cross-origin-opener-policy:/i.test(header));
assert.deepEqual(coop.map((header) => header.split(':').slice(1).join(':').trim()), ['same-origin-allow-popups']);
assert(headers.some((header) => /^strict-transport-security: max-age=31536000; includeSubDomains$/i.test(header)));
assert(headers.some((header) => /^x-content-type-options: nosniff$/i.test(header)));
assert(headers.some((header) => /^referrer-policy: no-referrer-when-downgrade$/i.test(header)));
if (route.startsWith('/api/') || route.startsWith('/admin/'))
  assert(headers.some((header) => /^x-frame-options: DENY$/i.test(header)));
console.log(`COOP local TLS ${route}: PASS (one same-origin-allow-popups header)`);
NODE
done
