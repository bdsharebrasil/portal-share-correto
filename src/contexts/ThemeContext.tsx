import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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

    let active = true;
    const localKey = user?.id ? `share-theme:${user.id}` : "share-theme:guest";

    const loadTheme = async () => {
      let initial = readThemePreference(localKey, "share-theme:guest");

      if (user?.id) {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("tema_preferido")
          .eq("id", user.id)
          .maybeSingle();

        if (error) console.warn("Não foi possível carregar a preferência de tema:", error.message);
        if (data?.tema_preferido === "light" || data?.tema_preferido === "dark") {
          initial = data.tema_preferido;
          window.localStorage.setItem(localKey, initial);
          window.localStorage.setItem("share-theme:guest", initial);
        }
      }

      if (!active) return;
      setThemeState(initial);
      applyTheme(initial);
      setIsThemeLoading(false);
    };

    void loadTheme();
    return () => {
      active = false;
    };
  }, [user?.id, isAuthLoading]);

  const setTheme = useCallback(async (next: ThemePreference) => {
    setThemeState(next);
    applyTheme(next);
    const localKey = user?.id ? `share-theme:${user.id}` : "share-theme:guest";
    window.localStorage.setItem(localKey, next);
    window.localStorage.setItem("share-theme:guest", next);

    if (!user?.id) return;

    setIsThemeSaving(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ tema_preferido: next })
        .eq("id", user.id);
      if (error) console.warn("Não foi possível salvar a preferência de tema:", error.message);
    } finally {
      setIsThemeSaving(false);
    }
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
