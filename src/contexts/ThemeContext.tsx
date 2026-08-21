import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type ThemePreference = "light" | "dark";

type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
  isThemeLoading: boolean;
  isThemeSaving: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Novo padrão visual: light executivo. A preferência salva do usuário continua tendo prioridade.
const fallbackTheme: ThemePreference = "light";

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
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
      return () => { ativo = false; };
    }

    setIsThemeLoading(true);
    void (async () => {
      const { data } = await (supabase as any)
        .from("user_profiles")
        .select("tema_preferido")
        .eq("id", user.id)
        .maybeSingle();
      if (!ativo) return;
      const saved = data?.tema_preferido === "light" || data?.tema_preferido === "dark" ? data.tema_preferido : initial;
      setThemeState(saved);
      window.localStorage.setItem(localKey, saved);
      applyTheme(saved);
      setIsThemeLoading(false);
    })();

    return () => { ativo = false; };
  }, [user?.id]);

  const setTheme = useCallback(async (next: ThemePreference) => {
    setThemeState(next);
    applyTheme(next);
    const localKey = user?.id ? `share-theme:${user.id}` : "share-theme:guest";
    window.localStorage.setItem(localKey, next);
    if (!user?.id) return;

    setIsThemeSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("user_profiles")
        .update({ tema_preferido: next, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;
    } finally {
      setIsThemeSaving(false);
    }
  }, [user?.id]);

  const toggleTheme = useCallback(async () => {
    await setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme, isThemeLoading, isThemeSaving }), [theme, setTheme, toggleTheme, isThemeLoading, isThemeSaving]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  return context;
}
