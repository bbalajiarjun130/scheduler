import { create } from "zustand";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const resolved =
    theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
  root.classList.toggle("dark", resolved === "dark");
}

function readStoredTheme(): Theme {
  try {
    return (localStorage.getItem("theme") as Theme) ?? "system";
  } catch {
    return "system";
  }
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const initial = readStoredTheme();
  if (typeof document !== "undefined") applyTheme(initial);

  return {
    theme: initial,
    setTheme: (theme) => {
      try {
        localStorage.setItem("theme", theme);
      } catch {
        // ignore storage errors (private mode, etc.)
      }
      applyTheme(theme);
      set({ theme });
    },
  };
});
