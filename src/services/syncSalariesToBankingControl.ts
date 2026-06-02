import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AgendamentoPagamento {
  id: string;
  data_agendamento: string;
  descricao: string;
  fornecedor?: string;
  valor: number | string;
  categoria?: string | null;
  status: string;
  notas?: string | null;
}

/**
 * Sincroniza um pagamento agendado para a tabela de controle bancário
 * Quando um pagamento é marcado como "pago", cria um registro correspondente no controle bancário
 *
 * Usa os campos existentes:
 * - numero_documento: armazena o ID do agendamento e o fornecedor
 * - grupo_categoria: marca como "AGENDAMENTO_PAGAMENTO"
 * - observacoes: armazena a referência do agendamento para rastreamento
 */
export async function syncAgendamentoPagamentoToControle(
  agendamento: AgendamentoPagamento,
  user_id?: string
): Promise<boolean> {
  try {
    // Cria um identificador único para evitar duplicatas
    const documento_identifier = `AGD-${agendamento.id.substring(0, 8)}`;

    // Verifica se já existe um registro no controle bancário para este agendamento
    const { data: existingRecord, error: checkError } = await supabase
      .from("controle_bancario")
      .select("id")
      .ilike("numero_documento", `%${agendamento.id}%`)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.log("Erro ao verificar registro existente:", checkError);
    }

    // Se já existe, não cria duplicado
    if (existingRecord) {
      console.log("Registro já existe no controle bancário para este agendamento");
      return true;
    }

    // Busca a categoria correspondente (pode ser null, iremos lidar com isso)
    let categoria_id = null;
    if (agendamento.categoria) {
      const { data: catData } = await supabase
        .from("categorias_movimentacao")
        .select("id")
        .ilike("nome", agendamento.categoria)
        .single();

      categoria_id = catData?.id;
    }

    // Se não encontrou categoria, tenta uma padrão para pagamentos
    if (!categoria_id) {
      const { data: defaultCat } = await supabase
        .from("categorias_movimentacao")
        .select("id")
        .ilike("nome", "%agendado%")
        .limit(1)
        .single();

      categoria_id = defaultCat?.id;
    }

    // Se ainda não tiver categoria_id, usa a primeira disponível (obrigatória na tabela)
    if (!categoria_id) {
      const { data: anyCat } = await supabase
        .from("categorias_movimentacao")
        .select("id")
        .limit(1)
        .single();

      if (!anyCat) {
        throw new Error("Nenhuma categoria de movimentação disponível no sistema");
      }
      categoria_id = anyCat.id;
    }

    // Prepara os dados para inserir no controle bancário
    const controleBancarioData = {
      data: agendamento.data_agendamento,
      descricao: `[Agendamento] ${agendamento.descricao}`,
      tipo_movimento: "saida", // Pagamentos são saídas (note: 'saida' sem acento na tabela)
      valor: parseFloat(agendamento.valor.toString()),
      categoria_id: categoria_id,
      status: "confirmado", // Marca como confirmado quando o agendamento é marcado como pago
      numero_documento: `AGD-${agendamento.id}`, // Armazena referência do agendamento
      grupo_categoria: "AGENDAMENTO_PAGAMENTO", // Marca como sincronização de agendamento
      observacoes: `Sincronizado do agendamento ${agendamento.id}\nFornecedor: ${agendamento.fornecedor || 'N/A'}\n${agendamento.notas || ''}`,
      criado_por: user_id || "00000000-0000-0000-0000-000000000000" // Será preenchido pelo backend
    };

    // Insere o registro no controle bancário
    const { data, error } = await supabase
      .from("controle_bancario")
      .insert([controleBancarioData] as any);

    if (error) {
      console.error("Erro ao inserir no controle bancário:", error);
      throw error;
    }

    console.log("Pagamento sincronizado com sucesso ao controle bancário");
    return true;
  } catch (error: any) {
    console.error("Erro ao sincronizar pagamento:", error);
    throw error;
  }
}

/**
 * Remove o registro correspondente do controle bancário quando um pagamento é marcado como cancelado
 */
export async function removeAgendamentoPagamentoFromControle(
  agendamentoId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("controle_bancario")
      .delete()
      .ilike("numero_documento", `%${agendamentoId}%`);

    if (error) {
      throw error;
    }

    console.log("Registro removido do controle bancário");
    return true;
  } catch (error: any) {
    console.error("Erro ao remover sincronização:", error);
    throw error;
  }
}

/**
 * Sincroniza múltiplos pagamentos de uma vez
 */
export async function syncMultipleAgendamentos(
  agendamentos: AgendamentoPagamento[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const agendamento of agendamentos) {
    try {
      await syncAgendamentoPagamentoToControle(agendamento);
      success++;
    } catch (error) {
      console.error(`Erro ao sincronizar agendamento ${agendamento.id}:`, error);
      failed++;
    }
  }

  return { success, failed };
}
