// @ts-nocheck — colunas legadas fora dos types gerados
import { supabase } from "@/integrations/supabase/client";

export interface SalaryPaymentComponents {
  /** Fluxo novo: valor líquido efetivamente pago do holerite. */
  salary_net?: number | string | null;
  /** Fluxo legado: valor do salário/holerite. */
  base_salary_holerite?: number | string | null;
  horas_voo?: number | string | null;
  benefit?: number | string | null;
  benefit_card?: number | string | null;
  benefit_other?: number | string | null;
  extra?: number | string | null;
  ferias?: number | string | null;
  decimo_terceiro_parcela1?: number | string | null;
  decimo_terceiro_parcela2?: number | string | null;
  comprovante_url?: string | null;
  obs?: string | null;
  banco?: string | null;
  data_pagamento?: string | null;
}

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value).trim().replace(/\s/g, "");
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const COMPONENT_LABELS: Array<{ key: keyof SalaryPaymentComponents; label: string; categoria: string }> = [
  { key: "salary_net", label: "Salário líquido (holerite)", categoria: "SALARIOS HOLERITE" },
  { key: "base_salary_holerite", label: "Salário (holerite)", categoria: "SALARIOS HOLERITE" },
  { key: "horas_voo", label: "Valor horas de voo", categoria: "PAGAMENTO DE HORAS DE VOO " },
  { key: "benefit_card", label: "Cartão alimentação", categoria: "CARTÃO BENEFICIO CAJU" },
  { key: "benefit_other", label: "Outros benefícios", categoria: "BENEFÍCIOS" },
  { key: "benefit", label: "Benefício", categoria: "CARTÃO BENEFICIO CAJU" },
  { key: "extra", label: "Bonificação/Extra", categoria: "SALARIOS HOLERITE" },
  { key: "ferias", label: "Férias", categoria: "PAGAMENTO DE FÉRIAS" },
  { key: "decimo_terceiro_parcela1", label: "13º salário (1ª parcela)", categoria: "DÉCIMO TERCEIRO SALÁRIO" },
  { key: "decimo_terceiro_parcela2", label: "13º salário (2ª parcela)", categoria: "DÉCIMO TERCEIRO SALÁRIO" },
];

async function resolveCategoryIds(names: string[]) {
  const map = new Map<string, string>();
  if (names.length === 0) return map;
  const { data } = await supabase
    .from("categorias_movimentacao")
    .select("id, nome")
    .in("nome", names);
  for (const row of data || []) map.set(row.nome, row.id);
  return map;
}

/**
 * Cria os lançamentos no fluxo de caixa (tabela `movimentacoes`) referentes a um
 * pagamento de salário. Cada componente com valor > 0 vira uma despesa do caixa share.
 */
export async function syncSalaryPaymentToFinancial(
  paymentId: string,
  userId: string,
  employeeName: string,
  employeeId: string,
  components: SalaryPaymentComponents
): Promise<{ success: boolean; error?: string }> {
  try {
    // Evita duplicatas: remove lançamentos anteriores deste pagamento
    await deleteSalaryPaymentFromFinancial(paymentId);

    const dataPagamento = components.data_pagamento || new Date().toISOString().slice(0, 10);
    const categoryIds = await resolveCategoryIds(COMPONENT_LABELS.map((c) => c.categoria));

    const rows = COMPONENT_LABELS.map((component) => {
      const valor = toNumber(components[component.key]);
      if (valor <= 0) return null;
      return {
        descricao: `${component.label} — ${employeeName}`,
        fluxo: "despesa",
        tipo_caixa: "share",
        categoria_id: categoryIds.get(component.categoria) ?? null,
        categoria_nome: component.categoria,
        grupo_categoria: "FOLHA DE PAGAMENTO",
        valor_rateado: valor,
        data_emissao: dataPagamento,
        data_pagamento: dataPagamento,
        status: "pago",
        conta_bancaria: components.banco ?? null,
        comprovante_url: components.comprovante_url ?? null,
        observacoes: components.obs ?? null,
        fornecedor_nome: employeeName,
        reference_type: "pagamento_salario_funcionario",
        reference_id: paymentId,
        criado_por: userId,
      };
    }).filter(Boolean);

    if (rows.length === 0) {
      return { success: true };
    }

    const { error } = await supabase.from("movimentacoes").insert(rows);
    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/** Remove do fluxo de caixa todos os lançamentos gerados por um pagamento de salário. */
export async function deleteSalaryPaymentFromFinancial(paymentId: string): Promise<boolean> {
  const { error } = await supabase
    .from("movimentacoes")
    .delete()
    .eq("reference_type", "pagamento_salario_funcionario")
    .eq("reference_id", paymentId);

  if (error) {
    console.error("Erro ao remover lançamentos do pagamento de salário:", error);
    return false;
  }
  return true;
}
