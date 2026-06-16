import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UpdateCheckContextType {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  dismissUpdate: () => void;
  checkForUpdates: () => Promise<void>;
}

const UpdateCheckContext = createContext<UpdateCheckContextType | undefined>(undefined);

export const UpdateCheckProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState("1.0.0");
  const [latestVersion, setLatestVersion] = useState("1.0.0");
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdates = async () => {
    if (dismissed) return;

    try {
      // Obter versão atual do localStorage ou package.json
      const storedVersion = localStorage.getItem("app_version") || "1.0.0";
      setCurrentVersion(storedVersion);

      // Buscar versão mais recente do Supabase
      const { data, error } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "latest_version")
        .single();

      if (error) {
        console.warn("Erro ao verificar versão:", error);
        return;
      }

      const latest = data?.value || "1.0.0";
      setLatestVersion(latest);

      // Compara versões (ex: "1.0.0" vs "1.0.1")
      const needsUpdate = compareVersions(storedVersion, latest) < 0;
      setUpdateAvailable(needsUpdate);
    } catch (error) {
      console.error("Erro ao verificar atualizações:", error);
    }
  };

  const compareVersions = (version1: string, version2: string): number => {
    const v1Parts = version1.split(".").map(Number);
    const v2Parts = version2.split(".").map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const part1 = v1Parts[i] || 0;
      const part2 = v2Parts[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    return 0;
  };

  const dismissUpdate = () => {
    setDismissed(true);
    setUpdateAvailable(false);
    // Salva que o usuário dispensou a notificação
    localStorage.setItem("update_dismissed", "true");
  };

  useEffect(() => {
    const checkDismissed = localStorage.getItem("update_dismissed");
    if (checkDismissed) {
      setDismissed(true);
    }
    checkForUpdates();

    // Verificar atualizações a cada 5 minutos
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <UpdateCheckContext.Provider
      value={{
        updateAvailable,
        currentVersion,
        latestVersion,
        dismissUpdate,
        checkForUpdates,
      }}
    >
      {children}
    </UpdateCheckContext.Provider>
  );
};

export const useUpdateCheck = () => {
  const context = useContext(UpdateCheckContext);
  if (context === undefined) {
    throw new Error("useUpdateCheck deve ser usado dentro de UpdateCheckProvider");
  }
  return context;
};
