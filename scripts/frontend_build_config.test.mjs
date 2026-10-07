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
test("Clerk builds require no legacy Google credentials", () => {
  assert.equal(validateFrontendConfig({
    VITE_AUTH_PROVIDER: "clerk",
    VITE_CLERK_PUBLISHABLE_KEY: "pk_live_" + Buffer.from("clerk.usecatana.com.br$").toString("base64"),
  }), "clerk");
});
test("explicit authority wins when credentials for both providers are present", () => {
  const credentials = {
    VITE_GOOGLE_CLIENT_ID: "legacy-client.apps.googleusercontent.com",
    VITE_CLERK_PUBLISHABLE_KEY: "pk_test_" + Buffer.from("example.clerk.accounts.dev$").toString("base64"),
  };
  assert.equal(validateFrontendConfig({ ...credentials, VITE_AUTH_PROVIDER: "legacy" }), "legacy");
  assert.equal(validateFrontendConfig({ ...credentials, VITE_AUTH_PROVIDER: "clerk" }), "clerk");
  assert.throws(() => validateFrontendConfig({ ...credentials, VITE_AUTH_PROVIDER: "unknown" }));
});
test("encoded invalid hosts cannot pass as a safe Clerk build key", () => {
  for (const host of ["https://clerk.example.com$", "clerk..example.com$", "-clerk.example.com$", "clerk.example.com", "localhost$"])
    assert.throws(() => validateFrontendConfig({
      VITE_AUTH_PROVIDER: "clerk",
      VITE_CLERK_PUBLISHABLE_KEY: "pk_test_" + Buffer.from(host).toString("base64"),
    }));
});
