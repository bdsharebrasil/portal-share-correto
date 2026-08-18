import { supabase } from "@/integrations/supabase/client";

export async function fetchFinanceiroData() {
  const [movs, rateios, clientes, socios] = await Promise.all([
    supabase.from("movimentacoes").select("*").order("data_emissao", { ascending: false }).limit(20000),
    supabase.from("rateio_despesas").select("*").limit(20000),
    supabase.from("clientes").select("id,razao_social,proprietario").order("razao_social"),
    supabase.from("socios").select("id,nome,clientes_id").order("nome"),
  ]);
  if (movs.error) throw movs.error;
  if (rateios.error) throw rateios.error;
  if (clientes.error) throw clientes.error;
  if (socios.error) throw socios.error;
  return {
    movimentacoes: movs.data ?? [],
    rateios: rateios.data ?? [],
    clientes: (clientes.data ?? []).map((c: any) => ({ id: c.id, nome: c.razao_social || c.proprietario || "Cliente sem nome" })),
    socios: socios.data ?? [],
  };
}

export async function updateMovimentacao(id: string, patch: Record<string, any>) {
  const { data, error } = await supabase.from("movimentacoes").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteMovimentacao(id: string) {
  const { error: rateioError } = await supabase.from("rateio_despesas").delete().eq("despesa_id", id).eq("fonte_despesa", "movimentacoes");
  if (rateioError) throw rateioError;
  const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
  if (error) throw error;
}
