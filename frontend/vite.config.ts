import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Backend URL from env var, for both dev proxy and production awareness.
const backendUrl = process.env.VITE_BACKEND_URL;

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,

    proxy: {
      "/api": {
        target: backendUrl || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
