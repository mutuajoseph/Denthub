import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev-time proxy: the browser talks to the Vite origin only, and `/api`
// requests are forwarded to the FastAPI backend — so the client is same-origin
// and never needs to know the backend's port. BACKEND_PORT keeps the proxy in
// sync with the uvicorn port (defaults to 8000; see the root `dev` script).
const backendPort = process.env.BACKEND_PORT ?? "8000";

export default defineConfig({
  plugins: [react()],
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
