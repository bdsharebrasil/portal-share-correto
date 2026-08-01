import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, format, isWithinInterval, parseISO } from "date-fns";

export type SolicitacaoStatus = "pendente" | "confirmado" | "em_voo" | "concluido" | "rejeitado" | "cancelado";

export interface Aeronave {
  id: string;
  matricula: string;
  modelo: string | null;
  fabricante: string | null;
  status: string | null;
  url_imagem: string | null;
}

export interface Solicitacao {
  id: string;
  cliente_id: string | null;
  aeronave_id: string | null;
  origem: string | null;
  destino: string | null;
  data_agendada: string;
  horario_partida: string | null;
  horario_chegada: string | null;
  dias_duracao: number | null;
  qtd_passageiros: number | null;
  status: string;
  observacoes: string | null;
  motivo_rejeicao: string | null;
  piloto_id: string | null;
  copiloto_id: string | null;
  criado_em: string;
  cliente_nome?: string | null;
  aeronave?: Aeronave | null;
}

export interface Tripulante {
  id: string;
  user_id: string | null;
  nome_completo: string;
  status: string | null;
  url_avatar: string | null;
  telefone: string | null;
  validade_cma: string | null;
}

export interface EscalaItem {
  id: string;
  membro_id: string;
  aeronave_id: string | null;
  solicitacao_id: string | null;
  funcao: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  observacoes: string | null;
}

export interface DataBloqueada {
  id: string;
  aeronave_id: string | null;
  data_bloqueio: string;
  motivo: string | null;
  frota_inteira: boolean | null;
}

export interface StatusFrota {
  id: string;
  aeronave_id: string;
  status_atual: string;
  localizacao_atual: string | null;
  chegada_prevista: string | null;
}

const sb = supabase as any;
const iso = (d: Date) => format(d, "yyyy-MM-dd");

/* ------------------------------- Queries -------------------------------- */

export function useAeronavesAgendamento() {
  return useQuery({
    queryKey: ["agv", "aeronaves"],
    queryFn: async (): Promise<Aeronave[]> => {
      const { data, error } = await sb
        .from("aeronave")
        .select("id, matricula, modelo, fabricante, status, url_imagem")
        .eq("status", "ativa")
        .order("matricula");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSolicitacoes() {
  return useQuery({
    queryKey: ["agv", "solicitacoes"],
    queryFn: async (): Promise<Solicitacao[]> => {
      const { data, error } = await sb
        .from("solicitacoes_reserva_voo")
        .select("*")
        .order("data_agendada", { ascending: true })
        .order("horario_partida", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Solicitacao[];

      const clienteIds = [...new Set(rows.map((r) => r.cliente_id).filter(Boolean))] as string[];
      const aeronaveIds = [...new Set(rows.map((r) => r.aeronave_id).filter(Boolean))] as string[];

      const [clientesRes, aeronavesRes] = await Promise.all([
        clienteIds.length
          ? sb.from("clientes").select("id, razao_social").in("id", clienteIds)
          : Promise.resolve({ data: [] }),
        aeronaveIds.length
          ? sb.from("aeronave").select("id, matricula, modelo, fabricante, status, url_imagem").in("id", aeronaveIds)
          : Promise.resolve({ data: [] }),
      ]);

      const clientes = new Map<string, any>((clientesRes.data ?? []).map((c: any) => [c.id, c]));
      const aeronaves = new Map<string, any>((aeronavesRes.data ?? []).map((a: any) => [a.id, a]));

      return rows.map((r) => ({
        ...r,
        cliente_nome: r.cliente_id ? clientes.get(r.cliente_id)?.razao_social ?? null : null,
        aeronave: r.aeronave_id ? aeronaves.get(r.aeronave_id) ?? null : null,
      }));
    },
  });
}

export function useTripulantes() {
  return useQuery({
    queryKey: ["agv", "tripulantes"],
    queryFn: async (): Promise<Tripulante[]> => {
      const { data, error } = await sb
        .from("membros_tripulacao")
        .select("id, user_id, nome_completo, status, url_avatar, telefone")
        .eq("status", "ativo")
        .order("nome_completo");
      if (error) throw error;
      const membros = (data ?? []) as Tripulante[];

      const { data: habs } = await sb
        .from("habilitacoes_tripulante")
        .select("membro_tripulacao_id, validade_cma, data_validade");

      const cmaPorMembro = new Map<string, string>();
      (habs ?? []).forEach((h: any) => {
        const v = h.validade_cma ?? null;
        if (!v || !h.membro_tripulacao_id) return;
        const atual = cmaPorMembro.get(h.membro_tripulacao_id);
        if (!atual || v > atual) cmaPorMembro.set(h.membro_tripulacao_id, v);
      });

      return membros.map((m) => ({ ...m, validade_cma: cmaPorMembro.get(m.id) ?? null }));
    },
  });
}

export function useFerias() {
  return useQuery({
    queryKey: ["agv", "ferias"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("vacation_requests")
        .select("id, user_id, start_date, end_date, status")
        .in("status", ["aprovado", "approved", "aprovada"]);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; user_id: string; start_date: string; end_date: string }>;
    },
  });
}

export function useEscala() {
  return useQuery({
    queryKey: ["agv", "escala"],
    queryFn: async (): Promise<EscalaItem[]> => {
      const { data, error } = await sb.from("escala_tripulacao").select("*").order("data_inicio");
      if (error) throw error;
      return (data ?? []) as EscalaItem[];
    },
  });
}

export function useDatasBloqueadas() {
  return useQuery({
    queryKey: ["agv", "bloqueios"],
    queryFn: async (): Promise<DataBloqueada[]> => {
      const { data, error } = await sb.from("datas_bloqueadas_voo").select("*").order("data_bloqueio");
      if (error) throw error;
      return (data ?? []) as DataBloqueada[];
    },
  });
}

export function useStatusFrota() {
  return useQuery({
    queryKey: ["agv", "status-frota"],
    queryFn: async (): Promise<StatusFrota[]> => {
      const { data, error } = await sb.from("status_tempo_real_aeronave").select("*");
      if (error) throw error;
      return (data ?? []) as StatusFrota[];
    },
  });
}

/* ------------------------------ Realtime -------------------------------- */

export function useAgendamentoRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("agendamento-voo")
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitacoes_reserva_voo" }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ["agv"] });
        if (payload.eventType === "INSERT") {
          toast.info("Nova solicitação de voo", {
            description: `${payload.new?.origem ?? "?"} → ${payload.new?.destino ?? "?"}`,
          });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "escala_tripulacao" }, () => {
        qc.invalidateQueries({ queryKey: ["agv", "escala"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "status_tempo_real_aeronave" }, () => {
        qc.invalidateQueries({ queryKey: ["agv", "status-frota"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

/* ------------------------------ Mutations ------------------------------- */

async function bloquearDiasDoVoo(solicitacao: Solicitacao, userId: string | null) {
  if (!solicitacao.aeronave_id) return;
  const dias = Math.max(1, solicitacao.dias_duracao ?? 1);
  const inicio = parseISO(solicitacao.data_agendada);
  const rows = Array.from({ length: dias }, (_, i) => ({
    aeronave_id: solicitacao.aeronave_id,
    data_bloqueio: iso(addDays(inicio, i)),
    motivo: `Voo confirmado ${solicitacao.origem ?? ""} → ${solicitacao.destino ?? ""}`.trim(),
    frota_inteira: false,
    bloqueado_por: userId,
  }));
  await sb.from("datas_bloqueadas_voo").insert(rows);
}

export function useAgendamentoMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["agv"] });

  const criarSolicitacao = useMutation({
    mutationFn: async (payload: Partial<Solicitacao>) => {
      const { error } = await sb.from("solicitacoes_reserva_voo").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento criado");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar agendamento"),
  });

  const aprovar = useMutation({
    mutationFn: async ({
      solicitacao,
      pilotoId,
      copilotoId,
    }: {
      solicitacao: Solicitacao;
      pilotoId?: string | null;
      copilotoId?: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;

      const { error } = await sb
        .from("solicitacoes_reserva_voo")
        .update({
          status: "confirmado",
          piloto_id: pilotoId || null,
          copiloto_id: copilotoId || null,
          aprovado_por: userId,
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", solicitacao.id);
      if (error) throw error;

      await bloquearDiasDoVoo(solicitacao, userId);

      const dias = Math.max(1, solicitacao.dias_duracao ?? 1);
      const dataFim = iso(addDays(parseISO(solicitacao.data_agendada), dias - 1));
      const escalas = [
        pilotoId ? { membro_id: pilotoId, funcao: "pic" } : null,
        copilotoId ? { membro_id: copilotoId, funcao: "sic" } : null,
      ].filter(Boolean) as Array<{ membro_id: string; funcao: string }>;

      if (escalas.length) {
        await sb.from("escala_tripulacao").insert(
          escalas.map((e) => ({
            ...e,
            aeronave_id: solicitacao.aeronave_id,
            solicitacao_id: solicitacao.id,
            data_inicio: solicitacao.data_agendada,
            data_fim: dataFim,
            status: "escalado",
            criado_por: userId,
          })),
        );
      }
    },
    onSuccess: () => {
      toast.success("Voo confirmado e escala atualizada");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao confirmar voo"),
  });

  const rejeitar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await sb
        .from("solicitacoes_reserva_voo")
        .update({ status: "rejeitado", motivo_rejeicao: motivo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação rejeitada");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao rejeitar"),
  });

  const alterarStatusVoo = useMutation({
    mutationFn: async ({ solicitacao, status }: { solicitacao: Solicitacao; status: SolicitacaoStatus }) => {
      const { error } = await sb.from("solicitacoes_reserva_voo").update({ status }).eq("id", solicitacao.id);
      if (error) throw error;

      if (solicitacao.aeronave_id) {
        const statusAeronave = status === "em_voo" ? "em_voo" : status === "concluido" ? "disponivel" : null;
        if (statusAeronave) await upsertStatusAeronave(solicitacao.aeronave_id, statusAeronave, solicitacao.id);
      }
      if (status === "cancelado" && solicitacao.aeronave_id) {
        await sb
          .from("datas_bloqueadas_voo")
          .delete()
          .eq("aeronave_id", solicitacao.aeronave_id)
          .gte("data_bloqueio", solicitacao.data_agendada)
          .like("motivo", "Voo confirmado%");
      }
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar status"),
  });

  const definirStatusAeronave = useMutation({
    mutationFn: async ({ aeronaveId, status }: { aeronaveId: string; status: string }) => {
      await upsertStatusAeronave(aeronaveId, status, null);
      await sb
        .from("aeronave")
        .update({ status: status === "manutencao" ? "manutencao" : "ativa" })
        .eq("id", aeronaveId);
    },
    onSuccess: () => {
      toast.success("Situação da aeronave atualizada");
      invalidate();
      qc.invalidateQueries({ queryKey: ["dashboard", "aircraft"] });
      qc.invalidateQueries({ queryKey: ["aeronave"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar aeronave"),
  });

  const criarEscala = useMutation({
    mutationFn: async (payload: Partial<EscalaItem>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await sb
        .from("escala_tripulacao")
        .insert({ ...payload, criado_por: userData?.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escala salva");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar escala"),
  });

  const removerEscala = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("escala_tripulacao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escala removida");
      invalidate();
    },
  });

  const excluirSolicitacao = useMutation({
    mutationFn: async (solicitacao: Solicitacao) => {
      if (solicitacao.aeronave_id) {
        await sb
          .from("datas_bloqueadas_voo")
          .delete()
          .eq("aeronave_id", solicitacao.aeronave_id)
          .gte("data_bloqueio", solicitacao.data_agendada)
          .like("motivo", "Voo confirmado%");

        await sb
          .from("escala_tripulacao")
          .delete()
          .eq("solicitacao_id", solicitacao.id);
      }
      const { error } = await sb.from("solicitacoes_reserva_voo").delete().eq("id", solicitacao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Voo excluído");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir voo"),
  });

  return { criarSolicitacao, aprovar, rejeitar, alterarStatusVoo, definirStatusAeronave, criarEscala, removerEscala, excluirSolicitacao };
}

async function upsertStatusAeronave(aeronaveId: string, status: string, vooId: string | null) {
  const { data: userData } = await supabase.auth.getUser();
  const { data: existente } = await sb
    .from("status_tempo_real_aeronave")
    .select("id")
    .eq("aeronave_id", aeronaveId)
    .maybeSingle();

  const payload = {
    aeronave_id: aeronaveId,
    status_atual: status,
    voo_atual_id: vooId,
    atualizado_por: userData?.user?.id ?? null,
    atualizado_em: new Date().toISOString(),
  };

  if (existente?.id) {
    await sb.from("status_tempo_real_aeronave").update(payload).eq("id", existente.id);
  } else {
    await sb.from("status_tempo_real_aeronave").insert(payload);
  }
}

/* ------------------------------ Derivações ------------------------------ */

export type DisponibilidadeTripulante = {
  tripulante: Tripulante;
  situacao: "disponivel" | "em_voo" | "ferias" | "cma_vencido" | "inativo";
  detalhe?: string;
};

export function calcularDisponibilidadeTripulante(
  tripulante: Tripulante,
  data: Date,
  ferias: Array<{ user_id: string; start_date: string; end_date: string }>,
  escala: EscalaItem[],
): DisponibilidadeTripulante {
  const dia = iso(data);

  if (tripulante.status && !["ativo", "ativa"].includes(tripulante.status.toLowerCase())) {
    return { tripulante, situacao: "inativo", detalhe: "Inativo" };
  }

  if (tripulante.validade_cma && tripulante.validade_cma < dia) {
    return {
      tripulante,
      situacao: "cma_vencido",
      detalhe: `CMA venceu em ${format(parseISO(tripulante.validade_cma), "dd/MM/yyyy")}`,
    };
  }

  const deFerias = tripulante.user_id
    ? ferias.some(
        (f) =>
          f.user_id === tripulante.user_id &&
          isWithinInterval(data, { start: parseISO(f.start_date), end: parseISO(f.end_date) }),
      )
    : false;
  if (deFerias) return { tripulante, situacao: "ferias", detalhe: "Em férias" };

  const escalado = escala.find((e) => e.membro_id === tripulante.id && e.data_inicio <= dia && e.data_fim >= dia);
  if (escalado) return { tripulante, situacao: "em_voo", detalhe: escalado.funcao.toUpperCase() };

  return { tripulante, situacao: "disponivel" };
}

export type SituacaoAeronave = "disponivel" | "em_voo" | "manutencao" | "reservado";

export function calcularSituacaoAeronave(
  aeronave: Aeronave,
  data: Date,
  bloqueios: DataBloqueada[],
  statusFrota: StatusFrota[],
): { situacao: SituacaoAeronave; detalhe?: string } {
  const dia = iso(data);
  const status = statusFrota.find((s) => s.aeronave_id === aeronave.id);

  if ((aeronave.status ?? "").toLowerCase() === "manutencao" || status?.status_atual === "manutencao") {
    return { situacao: "manutencao", detalhe: "Em manutenção" };
  }
  if (status?.status_atual === "em_voo") return { situacao: "em_voo", detalhe: status.localizacao_atual ?? undefined };

  const bloqueio = bloqueios.find(
    (b) => b.data_bloqueio === dia && (b.frota_inteira || b.aeronave_id === aeronave.id),
  );
  if (bloqueio) {
    const manut = (bloqueio.motivo ?? "").toLowerCase().includes("manuten");
    return { situacao: manut ? "manutencao" : "reservado", detalhe: bloqueio.motivo ?? undefined };
  }

  return { situacao: "disponivel" };
}
