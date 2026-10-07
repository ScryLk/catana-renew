import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFrontendConfig } from "./frontend_build_config.mjs";
test("required Clerk build rejects missing, malformed and placeholder keys", () => {
  for (const key of ["", "pk_test_placeholder", "pk_test_notbase64"])
    assert.throws(() =>
      validateFrontendConfig({
        VITE_AUTH_PROVIDER: "clerk",
        VITE_CLERK_PUBLISHABLE_KEY: key,
      }),
    );
});
test("safe test key validates wiring without a Clerk network call", () => {
  assert.equal(
    validateFrontendConfig({
      VITE_AUTH_PROVIDER: "clerk",
      VITE_CLERK_PUBLISHABLE_KEY:
        "pk_test_" +
        Buffer.from("example.clerk.accounts.dev$").toString("base64"),
    }),
    "clerk",
  );
});
test("legacy is explicit and does not require Clerk; missing mode fails", () => {
  assert.equal(
    validateFrontendConfig({ VITE_AUTH_PROVIDER: "legacy" }),
    "legacy",
  );
  assert.throws(() => validateFrontendConfig({}));
});
