import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import AppToaster from "./components/AppToaster";
import { useRegionStore } from "./store/regionStore";
import "./global.css";

useRegionStore.getState().initRegion();

// Light-only since the design revamp: drop the retired theme preference.
try {
  localStorage.removeItem("denthub-theme");
} catch {
  // Storage can be unavailable (private mode); nothing to clean up then.
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <AppToaster />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
