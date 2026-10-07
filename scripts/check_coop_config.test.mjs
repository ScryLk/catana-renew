import { test } from "node:test";
import assert from "node:assert/strict";
import { readCoopConfig, validateCoopConfig } from "./check_coop_config.mjs";

test("production SPA inherits one safe edge policy and Django preserves its direct-response policy", () => {
  assert.doesNotThrow(() => validateCoopConfig(readCoopConfig()));
});

test("globally weakened and duplicate edge policies fail review", () => {
  const config = readCoopConfig();
  assert.throws(() => validateCoopConfig({ ...config, nginx: config.nginx.replaceAll("same-origin-allow-popups", "unsafe-none") }));
  assert.throws(() => validateCoopConfig({ ...config, nginx: config.nginx.replace("# Frontend React SPA", 'add_header Cross-Origin-Opener-Policy "same-origin" always;\n    # Frontend React SPA') }));
});

test("upstream duplicate suppression must apply to the entire canonical server", () => {
  const config = readCoopConfig();
  const withoutHandoff = config.nginx.replace("proxy_hide_header Cross-Origin-Opener-Policy;", "");
  assert.throws(() => validateCoopConfig({ ...config, nginx: withoutHandoff }));
  assert.throws(() => validateCoopConfig({ ...config, nginx: withoutHandoff.replace("location /api/ {", "location /api/ {\n        proxy_hide_header Cross-Origin-Opener-Policy;") }));
});

test("document header inheritance and production config mounts cannot drift silently", () => {
  const config = readCoopConfig();
  assert.throws(() => validateCoopConfig({ ...config, nginx: config.nginx.replace("root /usr/share/nginx/html;", 'root /usr/share/nginx/html;\n        add_header Cache-Control "no-cache";') }));
  assert.throws(() => validateCoopConfig({ ...config, compose: config.compose.replace("./nginx/nginx.conf:", "./nginx/unreviewed.conf:") }));
  assert.throws(() => validateCoopConfig({ ...config, django: config.django.replace("default='same-origin-allow-popups'", "default='same-origin'") }));
});
