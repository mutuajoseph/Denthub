import { Toaster } from "react-hot-toast";

import { useThemeStore } from "../store/themeStore";

/**
 * Global toast host.
 *
 * Subscribes to the theme rather than reading it once at startup, so toasts
 * raised after a theme toggle match the active palette.
 */
export default function AppToaster() {
  const isDark = useThemeStore((state) => state.theme === "dark");

  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 2500,
        style: {
          background: isDark ? "#0b1f3a" : "#ffffff",
          color: isDark ? "#e5e7eb" : "#172b4d",
          border: `1px solid ${isDark ? "#1e3a5f" : "#e2e8f0"}`,
        },
      }}
    />
  );
}
