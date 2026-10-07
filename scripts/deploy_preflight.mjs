import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { distHashes } from "./frontend_build_config.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  const expected =
    process.env.EXPECTED_COMMIT ||
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  const metadata = JSON.parse(
    readFileSync(path.join(root, "frontend/dist/build-metadata.json")),
  );
  if (
    metadata.commit !== expected ||
    metadata.authProvider !== process.env.AUTH_PROVIDER
  )
    throw new Error("revision or auth mode mismatch");
  if (JSON.stringify(metadata.files) !== JSON.stringify(distHashes()))
    throw new Error("bundle hashes mismatch");
  if (!existsSync(path.join(root, "shared/studio-actions.json")))
    throw new Error("action registry missing");
  console.log("FRONTEND DIST / REVISION / AUTH MODE / REGISTRY: PASS");
} catch {
  console.error(
    "FRONTEND DIST: FAIL. Rebuild this revision and match AUTH_PROVIDER.",
  );
  process.exitCode = 1;
}
