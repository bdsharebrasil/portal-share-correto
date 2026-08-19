import type { AnexoLinha } from "@/components/dashboard/gestor/FinanceiroCotista/AnexosDinamicosField";

/**
 * Converte as linhas dinâmicas de anexos nos campos de URL/número
 * existentes na tabela `movimentacoes`.
 */
export function mapAnexosToMovimentacao(anexos: AnexoLinha[]): Record<string, any> {
  const patch: Record<string, any> = {};
  for (const a of anexos) {
    const numero = (a.numero || "").trim() || null;
    switch (a.tipo) {
      case "recibo":
        if (a.url) patch.recibo_url = a.url;
        if (numero) patch.numero_recibo = numero;
        break;
      case "nf":
        if (a.url) patch.nf_url = a.url;
        if (numero) patch.numero_nf = numero;
        break;
      case "boleto":
        if (a.url) patch.boleto_url = a.url;
        if (numero) patch.numero_boleto = numero;
        break;
      case "comanda":
        if (a.url) patch.comanda_url = a.url;
        if (numero) patch.numero_doc = patch.numero_doc || numero;
        break;
      default:
        if (a.url) patch.comprovante_url = a.url;
        if (numero) patch.numero_doc = patch.numero_doc || numero;
        break;
    }
  }
  return patch;
}