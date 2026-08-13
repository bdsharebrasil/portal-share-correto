import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

export interface RespostaItem {
  ok: boolean;
  /** feito | nao_feito | reporte (concluído com alerta) */
  status?: "feito" | "nao_feito" | "reporte";
  motivo?: string;
  obs?: string;
  oleo_lh?: string;
  oleo_rh?: string;
}

export interface ChecklistRespostas {
  itens: Record<string, RespostaItem>;
  docs: Record<string, "sim" | "nao">;
}

export interface ChecklistPreVoo {
  id: string;
  solicitacao_id: string | null;
  aeronave_id: string | null;
  cliente_id: string | null;
  status: "rascunho" | "concluido";
  precisa_abastecer: boolean | null;
  abastecimento_id: string | null;
  respostas: ChecklistRespostas;
  observacoes: string | null;
  executado_por: string | null;
  executado_por_nome: string | null;
  concluido_em: string | null;
  criado_em: string;
  atualizado_em: string | null;
}

export const respostasVazias: ChecklistRespostas = { itens: {}, docs: {} };

export function usePreVooChecklist(solicitacaoId?: string | null) {
  return useQuery({
    queryKey: ["checklist-pre-voo", solicitacaoId],
    enabled: !!solicitacaoId,
    // Evita que um refetch em segundo plano (ex: troca de aba/foco na janela)
    // sobrescreva edições em andamento no formulário.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ChecklistPreVoo | null> => {
      const { data, error } = await db
        .from("checklists_pre_voo")
        .select("*")
        .eq("solicitacao_id", solicitacaoId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        respostas: { itens: {}, docs: {}, ...(data.respostas || {}) },
      } as ChecklistPreVoo;
    },
  });
}

export interface SalvarChecklistInput {
  id?: string | null;
  solicitacao_id: string;
  aeronave_id?: string | null;
  cliente_id?: string | null;
  respostas: ChecklistRespostas;
  precisa_abastecer: boolean | null;
  abastecimento_id?: string | null;
  observacoes?: string | null;
  concluir?: boolean;
  executado_por?: string | null;
  executado_por_nome?: string | null;
}

export function usePreVooChecklistMutations() {
  const qc = useQueryClient();

  const salvar = useMutation({
    mutationFn: async (input: SalvarChecklistInput) => {
      const payload: Record<string, any> = {
        solicitacao_id: input.solicitacao_id,
        aeronave_id: input.aeronave_id ?? null,
        cliente_id: input.cliente_id ?? null,
        respostas: input.respostas,
        precisa_abastecer: input.precisa_abastecer,
        abastecimento_id: input.abastecimento_id ?? null,
        observacoes: input.observacoes ?? null,
        status: input.concluir ? "concluido" : "rascunho",
      };

      if (input.concluir) {
        payload.concluido_em = new Date().toISOString();
        payload.executado_por = input.executado_por ?? null;
        payload.executado_por_nome = input.executado_por_nome ?? null;
      }

      if (input.id) {
        const { data, error } = await db
          .from("checklists_pre_voo")
          .update(payload)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      payload.criado_por = input.executado_por ?? null;
      const { data, error } = await db
        .from("checklists_pre_voo")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, vars) => {
      // Atualiza o cache direto com o retorno da mutation, sem forçar um
      // novo fetch — evita a corrida entre "usuário ainda digitando" e
      // "refetch chegando" que apagava edições em andamento (ex: campo de
      // observação do reporte).
      qc.setQueryData(["checklist-pre-voo", vars.solicitacao_id], {
        ...data,
        respostas: { itens: {}, docs: {}, ...(data.respostas || {}) },
      });
      qc.invalidateQueries({ queryKey: ["checklists-pre-voo-lista"] });
      toast.success(vars.concluir ? "Checklist concluído" : "Rascunho salvo");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar checklist"),
  });

  return { salvar };
}

/** Checklists concluídos/rascunho por lista de voos (para exibir estado nos cards) */
export function useChecklistsPreVooPorVoos(ids: string[]) {
  const key = ids.slice().sort().join(",");
  return useQuery({
    queryKey: ["checklists-pre-voo-lista", key],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await db
        .from("checklists_pre_voo")
        .select("id, solicitacao_id, status, precisa_abastecer, abastecimento_id, executado_por_nome, concluido_em")
        .in("solicitacao_id", ids);
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach((r: any) => {
        if (r.solicitacao_id) map[r.solicitacao_id] = r;
      });
      return map;
    },
  });
}
/** Status do checklist pré-voo de várias solicitações (para habilitar/bloquear ações nos cards) */
export function usePreVooChecklistsStatus(solicitacaoIds: string[]) {
  const ids = [...new Set(solicitacaoIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: ["checklists-pre-voo-status", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await db
        .from("checklists_pre_voo")
        .select("solicitacao_id, status")
        .in("solicitacao_id", ids);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((c: any) => [c.solicitacao_id, c.status]));
    },
  });
}
