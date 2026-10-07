import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function validateFrontendConfig(env) {
  const mode = env.VITE_AUTH_PROVIDER;
  if (!["clerk", "legacy"].includes(mode))
    throw new Error("Set VITE_AUTH_PROVIDER explicitly to clerk or legacy.");
  if (mode === "clerk") {
    const key =
      env.VITE_CLERK_PUBLISHABLE_KEY ||
      env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      "";
    if (
      !/^pk_(test|live)_[A-Za-z0-9+/=]+$/.test(key) ||
      key.includes("placeholder")
    )
      throw new Error("Clerk build requires a valid publishable key.");
    const host = Buffer.from(
      key.replace(/^pk_(test|live)_/, ""),
      "base64",
    ).toString("utf8");
    if (!/^[a-zA-Z0-9.-]+\$$/.test(host))
      throw new Error("Clerk publishable key host is invalid.");
  }
  return mode;
}
export async function readFrontendConfig() {
  const { loadEnv } =
    await import("../frontend/node_modules/vite/dist/node/index.js");
  const fileEnv = loadEnv("production", path.join(root, "frontend"), "");
  return { ...fileEnv, ...process.env };
}
export function distHashes() {
  const files = [
    "index.html",
    ...readdirSync(path.join(root, "frontend/dist/assets"))
      .sort()
      .map((name) => `assets/${name}`),
  ];
  return Object.fromEntries(
    files.map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(path.join(root, "frontend/dist", file)))
        .digest("hex"),
    ]),
  );
}
export function writeBuildMetadata(mode) {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  writeFileSync(
    path.join(root, "frontend/dist/build-metadata.json"),
    JSON.stringify(
      {
        commit,
        authProvider: mode,
        builtAt: new Date().toISOString(),
        files: distHashes(),
      },
      null,
      2,
    ),
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const env = await readFrontendConfig();
    const mode = validateFrontendConfig(env);
    if (process.argv.includes("--metadata")) writeBuildMetadata(mode);
    console.log(`FRONTEND BUILD ENV: PASS (${mode})`);
  } catch {
    console.error(
      "FRONTEND BUILD ENV: FAIL. Check explicit VITE_AUTH_PROVIDER and Clerk publishable-key configuration.",
    );
    process.exitCode = 1;
  }
}
