import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

const STORAGE_KEY = "denthub-theme";
const CLASS_NAME = "dark";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle(CLASS_NAME, theme === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#050d1a" : "#0a1628");
  }
}

interface ThemeState {
  theme: Theme | null;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  initTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: null,

      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      toggleTheme: () => {
        const next: Theme = get().theme === "dark" ? "light" : "dark";
        get().setTheme(next);
      },

      initTheme: () => {
        const current = get().theme;
        const theme: Theme = current ?? (systemPrefersDark() ? "dark" : "light");
        set({ theme });
        applyTheme(theme);

        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => {
          if (get().theme === null) {
            const next: Theme = media.matches ? "dark" : "light";
            set({ theme: next });
            applyTheme(next);
          }
        };
        media.addEventListener("change", onChange);
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);
