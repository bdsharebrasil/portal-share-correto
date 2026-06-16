import { supabase } from "@/integrations/supabase/client";

/**
 * Atualiza a versão mais recente da aplicação no Supabase
 * @param newVersion - Nova versão (ex: "1.0.1")
 */
export const updateLatestVersion = async (newVersion: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("app_config")
      .update({
        value: newVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("key", "latest_version");

    if (error) {
      console.error("Erro ao atualizar versão:", error);
      return false;
    }

    console.log(`Versão atualizada para ${newVersion}`);
    return true;
  } catch (error) {
    console.error("Erro ao atualizar versão:", error);
    return false;
  }
};

/**
 * Obtém a versão mais recente do Supabase
 */
export const getLatestVersion = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "latest_version")
      .single();

    if (error) {
      console.error("Erro ao obter versão:", error);
      return null;
    }

    return data?.value || null;
  } catch (error) {
    console.error("Erro ao obter versão:", error);
    return null;
  }
};

/**
 * Define a versão atual do usuário
 */
export const setCurrentVersion = (version: string): void => {
  localStorage.setItem("app_version", version);
};

/**
 * Obtém a versão atual do usuário
 */
export const getCurrentVersion = (): string => {
  return localStorage.getItem("app_version") || "1.0.0";
};

/**
 * Compara duas versões semânticas (1.0.0 vs 1.0.1)
 * Retorna: -1 se v1 < v2, 0 se v1 == v2, 1 se v1 > v2
 */
export const compareVersions = (version1: string, version2: string): number => {
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

/**
 * Verifica se há atualização disponível
 */
export const hasUpdateAvailable = async (): Promise<boolean> => {
  const latest = await getLatestVersion();
  const current = getCurrentVersion();

  if (!latest) return false;
  return compareVersions(current, latest) < 0;
};

/**
 * Força reload da página com cache bust
 */
export const reloadApp = (): void => {
  window.location.href = window.location.href + "?" + Date.now();
};
