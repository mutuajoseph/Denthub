import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Dev-time proxy: the browser talks to the Vite origin only, and `/api`
// requests are forwarded to the FastAPI backend.
const backendPort = process.env.BACKEND_PORT ?? "8000";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
    port: 5173,

    proxy: {
      "/api": {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
});
