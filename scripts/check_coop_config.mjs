import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Inspect directive scope: an add_header in a child block disables inheritance
// of the parent's headers on Nginx versions without add_header_inherit merge.
function blocks(source, name) {
  const matches = [];
  const start = name === "server" ? /\bserver\s*\{/g : new RegExp(`\\b${name}\\s+([^{};]*?)\\{`, "g");
  for (let match; (match = start.exec(source)); ) {
    let depth = 1;
    let end = start.lastIndex;
    for (; end < source.length && depth; end++) {
      if (source[end] === "{") depth++;
      if (source[end] === "}") depth--;
    }
    if (depth) throw new Error("unclosed Nginx block");
    matches.push({ header: match[1] || "", body: source.slice(start.lastIndex, end - 1) });
    start.lastIndex = end;
  }
  return matches;
}

function ownDirectives(source) {
  let depth = 0;
  return [...source].map((character) => {
    if (character === "{") depth++;
    const visible = depth === 0 ? character : " ";
    if (character === "}") depth--;
    return visible;
  }).join("");
}

export function validateCoopConfig({ nginx, django, compose }) {
  const source = nginx.replace(/#.*$/gm, "");
  const policy = "same-origin-allow-popups";
  if (/unsafe-none/.test(source) || /unsafe-none/.test(django))
    throw new Error("COOP must not be globally weakened");
  const server = blocks(source, "server").find(({ body }) =>
    /server_name\s+usecatana\.com\.br\s*;/.test(body),
  );
  if (!server) throw new Error("canonical HTTPS document server missing");
  const own = ownDirectives(server.body);
  if (!/listen\s+443\s+ssl\s*;/.test(own))
    throw new Error("canonical document server must use TLS");
  const declarations = server.body.match(/add_header\s+Cross-Origin-Opener-Policy\b/gi) || [];
  if (declarations.length !== 1 || !new RegExp(`add_header\\s+Cross-Origin-Opener-Policy\\s+"?${policy}"?\\s+always\\s*;`, "i").test(own))
    throw new Error("one inherited document COOP policy required");
  if (!/proxy_hide_header\s+Cross-Origin-Opener-Policy\s*;/i.test(own))
    throw new Error("edge must suppress duplicate upstream COOP");
  const document = blocks(server.body, "location").find(({ header }) => header.trim() === "/");
  if (!document || !/try_files\s+\$uri\s+\$uri\/\s+\/index\.html\s*;/.test(document.body))
    throw new Error("SPA document fallback missing");
  if (/\badd_header\s/.test(ownDirectives(document.body)))
    throw new Error("document location must inherit server security headers");
  if (!/SECURE_CROSS_ORIGIN_OPENER_POLICY\s*=\s*env\(\s*['"]SECURE_CROSS_ORIGIN_OPENER_POLICY['"]\s*,\s*default=['"]same-origin-allow-popups['"]\s*\)/.test(django))
    throw new Error("Django direct-response COOP default differs");
  if (!compose.includes("./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro") ||
      !compose.includes("./frontend/dist:/usr/share/nginx/html:ro"))
    throw new Error("production must serve the audited config and frontend build");
}

export function readCoopConfig() {
  return {
    nginx: readFileSync(path.join(root, "nginx/nginx.conf"), "utf8"),
    django: readFileSync(path.join(root, "backend/catana_back/settings.py"), "utf8"),
    compose: readFileSync(path.join(root, "docker-compose.prod.yml"), "utf8"),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    validateCoopConfig(readCoopConfig());
    console.log("COOP CONFIGURATION: PASS (repository config; verify deployed headers separately)");
  } catch (error) {
    console.error(`COOP CONFIGURATION: FAIL - ${error.message}`);
    process.exitCode = 1;
  }
}
