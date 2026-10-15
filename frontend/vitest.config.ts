import { type UserConfig, defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// `vite.config.ts` exports a callback (it reads VITE_BACKEND_URL via loadEnv),
// which `mergeConfig` cannot merge. Resolve it first, then merge the test block
// on top. See #68.
export default defineConfig((env) => {
  const base: UserConfig =
    typeof viteConfig === "function" ? (viteConfig(env) as UserConfig) : viteConfig;

  return mergeConfig(base, {
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      css: true,
      testTimeout: 20000,
    },
  });
});
