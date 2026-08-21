import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type ThemePreference = "light" | "dark";

// Tipagem corrigida
type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
  isThemeLoading: boolean;
  isThemeSaving: boolean;
};

// Contexto corrigido
const ThemeContext = createContext<ThemeContextValue | null>(null);

const fallbackTheme: ThemePreference = "light";

function readThemePreference(...keys: string[]): ThemePreference {
  for (const key of keys) {
    const theme = window.localStorage.getItem(key);
    if (theme === "light" || theme === "dark") return theme;
  }
  return fallbackTheme;
}

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  // Limpa classes anteriores para evitar conflito
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const themeColor = theme === "light" ? "#e8edf3" : "#0f172a";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [theme, setThemeState] = useState<ThemePreference>(fallbackTheme);
  const [isThemeLoading, setIsThemeLoading] = useState(true);
  const [isThemeSaving, setIsThemeSaving] = useState(false);

  useEffect(() => {
    if (isAuthLoading) {
      setIsThemeLoading(true);
      return;
    }

    const localKey = user?.id ? `share-theme:${user.id}` : "share-theme:guest";
    const initial = readThemePreference(localKey, "share-theme:guest");

    setThemeState(initial);
    applyTheme(initial);
    setIsThemeLoading(false);
  }, [user?.id, isAuthLoading]);

  const setTheme = useCallback(async (next: ThemePreference) => {
    setThemeState(next);
    applyTheme(next);
    const localKey = user?.id ? `share-theme:${user.id}` : "share-theme:guest";
    window.localStorage.setItem(localKey, next);
    window.localStorage.setItem("share-theme:guest", next);

    if (!user?.id) return;

    // Persistência local por usuário; tema_preferido não existe em user_profiles.
    setIsThemeSaving(false);
  }, [user?.id]);

  const toggleTheme = useCallback(async () => {
    await setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(() => ({ 
    theme, setTheme, toggleTheme, isThemeLoading, isThemeSaving 
  }), [theme, setTheme, toggleTheme, isThemeLoading, isThemeSaving]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  return context;
}
