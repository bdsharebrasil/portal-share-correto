/**
 * Extrai automaticamente um setor/identificador do nome do site
 * Detecta padrões como "PR-MDL", "PR-XYZ", "PRX-123", etc.
 *
 * @param site - Nome do site/sistema (ex: "PR-MDL Login 1", "TARIFAS DECEA")
 * @returns O setor detectado ou null se não encontrado
 */
export function extractSetor(site: string): string | null {
  if (!site || site.trim().length === 0) {
    return null;
  }

  // Padrão: 2-4 caracteres maiúsculos, hífen, números/letras
  // Exemplos: PR-MDL, PRX-123, ABC-1, PR-001
  const setorPattern = /^([A-Z]{2,4}-[A-Z0-9]{1,4})\b/i;
  const match = site.match(setorPattern);

  if (match && match[1]) {
    return match[1].toUpperCase();
  }

  return null;
}

/**
 * Gera uma sugestão de setor baseado no site
 * Útil para exibir ao usuário enquanto digita
 */
export function getSuggestedSetor(site: string): string | null {
  return extractSetor(site);
}
