import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/**
 * Package name for a module id, or null for first-party code.
 *
 * Ids are absolute (pnpm) paths such as
 * `…/.pnpm/@tanstack+react-query@5.102.8_react@19.2.8/node_modules/@tanstack/react-query/build/modern/index.js`,
 * so take everything after the *last* `node_modules/` and read the package off
 * the front. Never substring-match the whole id: this repo resolves inside a
 * directory called `react`, which makes `id.includes("/react/")` true for
 * every dependency.
 */
function packageName(id: string): string | null {
  const marker = "node_modules/";
  const normalized = id.replace(/\\/g, "/");
  const index = normalized.lastIndexOf(marker);

  if (index === -1) {
    return null;
  }

  const segments = normalized.slice(index + marker.length).split("/");

  if (segments[0].startsWith("@")) {
    return `${segments[0]}/${segments[1] ?? ""}`;
  }

  return segments[0];
}

const CHUNK_GROUPS: Record<string, string[]> = {
  react: ["react", "react-dom", "scheduler"],
  router: ["react-router", "react-router-dom"],
  query: ["@tanstack/query-core", "@tanstack/react-query"],
  motion: ["framer-motion", "motion-dom", "motion-utils"],
  icons: ["lucide-react"],
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL || "http://localhost:8000";

  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          /*
           * Route screens are already lazily imported (see src/App.tsx), but the
           * shared libraries still land in one entry chunk over Vite's 500 kB
           * warning threshold (issue #66). Split the big dependency groups into
           * their own long-lived chunks: each one stays under the threshold, and
           * the browser can cache them across app-only deploys.
           */
          manualChunks(id) {
            const pkg = packageName(id);

            if (pkg === null) {
              return undefined;
            }

            for (const [chunk, packages] of Object.entries(CHUNK_GROUPS)) {
              if (packages.includes(pkg)) {
                return chunk;
              }
            }

            return "vendor";
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
