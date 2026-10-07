import { defineConfig, mergeConfig } from 'vite';
import path from 'node:path';
import applicationConfig from './vite.config';

const provider = process.env.CATANA_SOCIAL_AUTH_TEST_PROVIDER || 'clerk';

// Explicit browser-test entry point. The normal dev/build config never aliases Clerk.
export default mergeConfig(applicationConfig, defineConfig({
  cacheDir: path.resolve(__dirname, `node_modules/.vite-social-${provider}`),
  resolve: {
    alias: {
      '@clerk/clerk-react': path.resolve(__dirname, 'e2e/fixtures/clerkSdk.tsx'),
    },
  },
  define: {
    'import.meta.env.VITE_AUTH_PROVIDER': JSON.stringify(provider),
    'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify('pk_test_browser_contract'),
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('browser-contract.apps.googleusercontent.com'),
    'import.meta.env.VITE_AUTO_LOGIN': JSON.stringify('false'),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://127.0.0.1:8000'),
  },
}));
