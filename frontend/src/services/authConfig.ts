export type AuthProviderMode = "clerk" | "legacy" | "none";
export const clerkPublishableKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  "";
export const isClerkConfigured =
  (!import.meta.env.VITE_AUTH_PROVIDER || import.meta.env.VITE_AUTH_PROVIDER === "clerk") &&
  /^(pk_test_|pk_live_)/.test(clerkPublishableKey) &&
  !clerkPublishableKey.includes("placeholder");
export const authProviderMode: AuthProviderMode =
  import.meta.env.VITE_AUTH_PROVIDER === "legacy"
    ? "legacy"
    : import.meta.env.VITE_AUTH_PROVIDER === "clerk" || isClerkConfigured
      ? "clerk"
      : import.meta.env.VITE_AUTH_PROVIDER
        ? "none"
        : "legacy";
