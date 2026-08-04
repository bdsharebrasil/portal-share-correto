import { supabase } from "@/integrations/supabase/client";

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

/**
 * Marca em `movimentacoes` que o lançamento foi enviado por e-mail.
 * Aceita qualquer origem (contas a pagar, contas a receber, recibos, NF de saída...),
 * tentando casar os ids informados com as colunas de vínculo da movimentação.
 */
export async function marcarMovimentacoesEnviadasPorEmail(params: {
  referenceIds?: string[];
  numerosDocumento?: string[];
}) {
  const ids = (params.referenceIds || []).map((v) => String(v)).filter(isUuid);
  const numeros = (params.numerosDocumento || []).map((v) => String(v).trim()).filter(Boolean);

  if (ids.length === 0 && numeros.length === 0) return;

  const patch = {
    enviado_por_email: true,
    enviado_por_email_em: new Date().toISOString(),
  };

  const colunasId = [
    "id",
    "reference_id",
    "contas_apagar_id",
    "contas_areceber_id",
    "movimentacao_origem_id",
    "despesa_cliente_direto_id",
  ] as const;

  const colunasNumero = ["numero_recibo", "numero_nf", "numero_doc", "numero_boleto"] as const;

  const jobs: Promise<unknown>[] = [];

  if (ids.length > 0) {
    for (const coluna of colunasId) {
      jobs.push(
        (supabase as any).from("movimentacoes").update(patch).in(coluna, ids).then(() => null, () => null),
      );
    }
  }

  if (numeros.length > 0) {
    for (const coluna of colunasNumero) {
      jobs.push(
        (supabase as any).from("movimentacoes").update(patch).in(coluna, numeros).then(() => null, () => null),
      );
    }
  }

  await Promise.all(jobs);
}