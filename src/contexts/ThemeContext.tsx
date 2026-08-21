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
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemePreference>(fallbackTheme);
  const [isThemeLoading, setIsThemeLoading] = useState(true);
  const [isThemeSaving, setIsThemeSaving] = useState(false);

  useEffect(() => {
    let ativo = true;
    const localKey = user?.id ? `share-theme:${user.id}` : "share-theme:guest";
    const localTheme = window.localStorage.getItem(localKey);
    const initial = localTheme === "light" || localTheme === "dark" ? localTheme : fallbackTheme;
    
    setThemeState(initial);
    applyTheme(initial);

    if (!user?.id) {
      setIsThemeLoading(false);
      return;
    }

    // A tabela user_profiles não possui coluna de preferência de tema no schema atual.
    // A preferência permanece isolada por usuário neste navegador até existir uma
    // coluna de tema no banco ou uma tabela de preferências dedicada.
    if (ativo) setIsThemeLoading(false);

    return () => { ativo = false; };
  }, [user?.id]);

  const setTheme = useCallback(async (next: ThemePreference) => {
    setThemeState(next);
    applyTheme(next);
    const localKey = user?.id ? `share-theme:${user.id}` : "share-theme:guest";
    window.localStorage.setItem(localKey, next);
    
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
