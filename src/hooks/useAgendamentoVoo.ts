import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import {
  addDays,
  addMinutes,
  format,
  isWithinInterval,
  parseISO,
} from "date-fns";

type PernaVooInsert =
  Database["public"]["Tables"]["pernas_voo"]["Insert"];

type PernaVooUpdate =
  Database["public"]["Tables"]["pernas_voo"]["Update"];

const sb = supabase as any;

const iso = (d: Date) => format(d, "yyyy-MM-dd");

const TIME_SUFFIX = (value?: string | null) =>
  value ? `${value}:00` : null;

function normalizarDateTimeUtc(data: string, hora: string) {
  return new Date(`${data}T${hora}:00Z`);
}

function formatarHora(hora: Date) {
  return format(hora, "HH:mm");
}

/* ============================================================
   TIPOS
============================================================ */

export interface JornadaVoo {
  id: string;
  solicitacao_id: string;
  aeronave_id: string | null;
  numero_jornada: number;
  data_jornada: string;
  apresentacao_em: string;
  inicio_em: string | null;
  fim_em: string | null;
  minutos_pos_corte: 30 | 45;
  status: "aberta" | "encerrada" | "cancelada";
  observacoes: string | null;
}

export interface PernaVoo {
  id: string;
  solicitacao_id: string;
  jornada_id: string | null;
  numero_perna: number;
  data_perna: string;
  origem: string;
  destino: string;
  horario_acionamento: string | null;
  horario_decolagem: string | null;
  horario_pouso: string | null;
  horario_corte: string | null;
  qtd_passageiros: number | null;
  observacoes: string | null;
  numero_voo?: string | null;
}

export type SolicitacaoStatus =
  | "pendente"
  | "confirmado"
  | "em_voo"
  | "em_rota"
  | "pousado"
  | "concluido"
  | "rejeitado"
  | "cancelado";

export interface Solicitacao {
  id: string;
  cliente_id: string | null;
  aeronave_id: string | null;
  origem: string | null;
  destino: string | null;
  data_agendada: string;
  horario_previsto_agendamento: string | null;

  data_partida?: string | null;

  horario_acionamento?: string | null;
  horario_decolagem?: string | null;
  horario_pouso?: string | null;
  horario_corte?: string | null;

  dias_duracao: number | null;
  qtd_passageiros: number | null;
  status: string;

  observacoes: string | null;
  motivo_rejeicao: string | null;

  piloto_id: string | null;
  copiloto_id: string | null;

  aprovado_por?: string | null;
  aprovado_em?: string | null;

  ciclo_voo_id?: string | null;
  numero_voo?: string | null;

  criado_em: string;
  atualizado_em?: string | null;

  horario_partida?: string | null;
  cliente_nome?: string | null;
  aeronave?: any;
}


/* ============================================================
   QUERIES DE PERNAS
============================================================ */

export function usePernasVoo(solicitacaoId?: string | null) {
  return useQuery({
    queryKey: ["agv", "pernas", solicitacaoId],

    enabled: !!solicitacaoId,

    queryFn: async (): Promise<PernaVoo[]> => {
      const { data, error } = await sb
        .from("pernas_voo")
        .select("*")
        .eq("solicitacao_id", solicitacaoId)
        .order("numero_perna", {
          ascending: true,
        });

      if (error) throw error;

      return (data ?? []) as PernaVoo[];
    },
  });
}


/* ============================================================
   QUERIES DE JORNADAS
============================================================ */

export function useJornadasVoo(solicitacaoId?: string | null) {
  return useQuery({
    queryKey: ["agv", "jornadas", solicitacaoId],

    enabled: !!solicitacaoId,

    queryFn: async (): Promise<JornadaVoo[]> => {
      const { data, error } = await sb
        .from("jornadas_voo")
        .select("*")
        .eq("solicitacao_id", solicitacaoId)
        .order("numero_jornada", {
          ascending: true,
        });

      if (error) throw error;

      return (data ?? []) as JornadaVoo[];
    },
  });
}


/* ============================================================
   HISTÓRICO
============================================================ */

async function registrarHistoricoStatus(
  solicitacaoId: string,
  statusAnterior: string | null,
  statusNovo: string,
  alteradoPor: string | null,
  observacao?: string | null,
) {
  await sb
    .from("historico_status_solicitacao")
    .insert({
      solicitacao_id: solicitacaoId,
      status_anterior: statusAnterior,
      status_novo: statusNovo,
      alterado_por: alteradoPor,
      atualizado_em: new Date().toISOString(),
      observacao: observacao ?? null,
    });
}


/* ============================================================
   BUSCAR JORNADA DO DIA
============================================================ */

async function buscarJornadaDoDia(
  solicitacaoId: string,
  dataJornada: string,
) {
  const { data, error } = await sb
    .from("jornadas_voo")
    .select("*")
    .eq("solicitacao_id", solicitacaoId)
    .eq("data_jornada", dataJornada)
    .maybeSingle();

  if (error) throw error;

  return data as JornadaVoo | null;
}


/* ============================================================
   CRIAR JORNADA
============================================================ */

async function criarJornadaDoDia({
  solicitacao,
  dataJornada,
  horarioApresentacao,
  minutosPosCorte,
  userId,
}: {
  solicitacao: Solicitacao;
  dataJornada: string;
  horarioApresentacao: string;
  minutosPosCorte: 30 | 45;
  userId: string | null;
}) {
  const existente = await buscarJornadaDoDia(
    solicitacao.id,
    dataJornada,
  );

  if (existente) {
    if (existente.status === "encerrada") {
      throw new Error(
        `A jornada de ${dataJornada} já foi encerrada.`,
      );
    }

    return existente;
  }

  const apresentacaoEm = normalizarDateTimeUtc(
    dataJornada,
    horarioApresentacao,
  );

  const { data: ultimaJornada } = await sb
    .from("jornadas_voo")
    .select("numero_jornada")
    .eq("solicitacao_id", solicitacao.id)
    .order("numero_jornada", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  const numeroJornada =
    (ultimaJornada?.numero_jornada ?? 0) + 1;

  const { data, error } = await sb
    .from("jornadas_voo")
    .insert({
      solicitacao_id: solicitacao.id,
      aeronave_id: solicitacao.aeronave_id,
      numero_jornada: numeroJornada,
      data_jornada: dataJornada,
      apresentacao_em: apresentacaoEm.toISOString(),
      inicio_em: apresentacaoEm.toISOString(),
      fim_em: null,
      minutos_pos_corte: minutosPosCorte,
      status: "aberta",
      criado_por: userId,
    })
    .select("*")
    .single();

  if (error) throw error;

  return data as JornadaVoo;
}


/* ============================================================
   ENCERRAR JORNADA
============================================================ */

async function encerrarJornadaAtual({
  jornada,
  dataCorte,
  horarioCorte,
}: {
  jornada: JornadaVoo;
  dataCorte: string;
  horarioCorte: string;
}) {
  const corte = normalizarDateTimeUtc(
    dataCorte,
    horarioCorte,
  );

  const fimJornada = addMinutes(
    corte,
    jornada.minutos_pos_corte,
  );

  const { data, error } = await sb
    .from("jornadas_voo")
    .update({
      fim_em: fimJornada.toISOString(),
      status: "encerrada",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", jornada.id)
    .eq("status", "aberta")
    .select("*")
    .single();

  if (error) throw error;

  return data as JornadaVoo;
}


/* ============================================================
   VERIFICAR SE É A ÚLTIMA JORNADA
============================================================ */

function ehUltimaJornada(
  solicitacao: Solicitacao,
  dataPerna: string,
  destino: string,
) {
  const dias = Math.max(
    1,
    solicitacao.dias_duracao ?? 1,
  );

  const dataFinal = iso(
    addDays(
      parseISO(solicitacao.data_agendada),
      dias - 1,
    ),
  );

  const chegouNaBase =
    (solicitacao.origem ?? "")
      .trim()
      .toUpperCase() ===
    destino.trim().toUpperCase();

  return dataPerna >= dataFinal && chegouNaBase;
}


/* ============================================================
   MUTATIONS
============================================================ */

export function useAgendamentoMutations() {
  const qc = useQueryClient();

  const invalidate = () =>
    qc.invalidateQueries({
      queryKey: ["agv"],
    });


  /* ==========================================================
     INICIAR PERNA / CRIAR JORNADA QUANDO NECESSÁRIO
  ========================================================== */

  const iniciarVoo = useMutation({
    mutationFn: async ({
      solicitacao,
      perna,
      dataPartida,
      horarioApresentacao,
      horarioAcionamento,
      horarioDecolagem,
      pilotoId,
      copilotoId,
      qtdPassageiros,
      minutosPosCorte,
    }: {
      solicitacao: Solicitacao;

      perna: PernaVoo;

      dataPartida: string;

      horarioApresentacao: string;

      horarioAcionamento: string;

      horarioDecolagem: string;

      pilotoId?: string | null;

      copilotoId?: string | null;

      qtdPassageiros?: number;

      minutosPosCorte: 30 | 45;
    }) => {
      const { data: userData } =
        await supabase.auth.getUser();

      const userId = userData?.user?.id ?? null;

      if (!horarioApresentacao) {
        throw new Error(
          "Informe o horário de apresentação.",
        );
      }

      if (!horarioAcionamento) {
        throw new Error(
          "Informe o horário de acionamento.",
        );
      }

      if (!horarioDecolagem) {
        throw new Error(
          "Informe o horário de decolagem.",
        );
      }

      /* ------------------------------------------------------
         1. JORNADA DO DIA
      ------------------------------------------------------ */

      const jornada = await criarJornadaDoDia({
        solicitacao,
        dataJornada: dataPartida,
        horarioApresentacao,
        minutosPosCorte,
        userId,
      });

      if (jornada.status !== "aberta") {
        throw new Error(
          "A jornada deste dia não está aberta.",
        );
      }

      /* ------------------------------------------------------
         2. GARANTIR QUE ESTA PERNA PERTENCE À JORNADA
      ------------------------------------------------------ */

      const passageiros = Math.max(
        1,
        qtdPassageiros ??
          solicitacao.qtd_passageiros ??
          1,
      );

      const { error: pernaError } = await sb
        .from("pernas_voo")
        .update({
          jornada_id: jornada.id,
          data_perna: dataPartida,
          horario_acionamento:
            TIME_SUFFIX(horarioAcionamento),
          horario_decolagem:
            TIME_SUFFIX(horarioDecolagem),
          horario_pouso: null,
          horario_corte: null,
          numero_voo:
            solicitacao.numero_voo ?? null,
          qtd_passageiros: passageiros,
        })
        .eq("id", perna.id);

      if (pernaError) throw pernaError;

      /* ------------------------------------------------------
         3. ATUALIZAR SOLICITAÇÃO
      ------------------------------------------------------ */

      const { error: vooError } = await sb
        .from("solicitacoes_reserva_voo")
        .update({
          status: "em_rota",

          data_partida: dataPartida,

          horario_acionamento:
            TIME_SUFFIX(horarioAcionamento),

          horario_decolagem:
            TIME_SUFFIX(horarioDecolagem),

          horario_pouso: null,

          horario_corte: null,

          piloto_id:
            pilotoId ??
            solicitacao.piloto_id ??
            null,

          copiloto_id:
            copilotoId ??
            solicitacao.copiloto_id ??
            null,

          qtd_passageiros: passageiros,

          ciclo_voo_id:
            solicitacao.ciclo_voo_id ?? null,
        })
        .eq("id", solicitacao.id);

      if (vooError) throw vooError;

      /* ------------------------------------------------------
         4. STATUS AERONAVE
      ------------------------------------------------------ */

      if (solicitacao.aeronave_id) {
        await upsertStatusAeronave(
          solicitacao.aeronave_id,
          "em_voo",
          solicitacao.id,
          {
            localizacao_atual:
              perna.origem ??
              solicitacao.origem ??
              null,

            ultima_partida:
              new Date().toISOString(),

            chegada_prevista: null,
          },
        );
      }

      await registrarHistoricoStatus(
        solicitacao.id,
        solicitacao.status,
        "em_rota",
        userId,
        `Jornada ${jornada.numero_jornada} iniciada • apresentação ${horarioApresentacao} • perna ${perna.numero_perna}`,
      );

      await sb
        .from("escala_tripulacao")
        .update({
          status: "em_voo",
        })
        .eq("solicitacao_id", solicitacao.id);

      return jornada;
    },

    onSuccess: () => {
      toast.success(
        "Perna iniciada e jornada registrada",
      );

      invalidate();

      qc.invalidateQueries({
        queryKey: ["agv", "pernas"],
      });

      qc.invalidateQueries({
        queryKey: ["agv", "jornadas"],
      });

      qc.invalidateQueries({
        queryKey: ["ciclos-voo"],
      });

      qc.invalidateQueries({
        queryKey: ["aircraft-fleet"],
      });
    },

    onError: (e: any) => {
      toast.error(
        e.message ??
          "Erro ao iniciar a perna",
      );
    },
  });


  /* ==========================================================
     POUSAR PERNA
  ========================================================== */

  const registrarPousoPerna = useMutation({
    mutationFn: async ({
      solicitacao,
      perna,
      dataPerna,
      horarioPouso,
      horarioCorte,
    }: {
      solicitacao: Solicitacao;
      perna: PernaVoo;
      dataPerna: string;
      horarioPouso: string;
      horarioCorte: string;
    }) => {
      const { data: userData } =
        await supabase.auth.getUser();

      const userId = userData?.user?.id ?? null;

      if (!horarioPouso) {
        throw new Error(
          "Informe o horário de pouso.",
        );
      }

      if (!horarioCorte) {
        throw new Error(
          "Informe o horário de corte.",
        );
      }

      if (!perna.jornada_id) {
        throw new Error(
          "Esta perna ainda não está vinculada a uma jornada.",
        );
      }

      const corteIso =
        normalizarDateTimeUtc(
          dataPerna,
          horarioCorte,
        ).toISOString();

      /* ------------------------------------------------------
         1. FINALIZA SOMENTE A PERNA
      ------------------------------------------------------ */

      const { error: pernaError } = await sb
        .from("pernas_voo")
        .update({
          data_perna: dataPerna,

          horario_pouso:
            TIME_SUFFIX(horarioPouso),

          horario_corte: corteIso,

          numero_voo:
            solicitacao.numero_voo ?? null,
        })
        .eq("id", perna.id);

      if (pernaError) throw pernaError;

      /* ------------------------------------------------------
         2. SOLICITAÇÃO FICA POUSADA
      ------------------------------------------------------ */

      const { error: vooError } = await sb
        .from("solicitacoes_reserva_voo")
        .update({
          status: "pousado",

          data_partida: dataPerna,

          horario_pouso:
            TIME_SUFFIX(horarioPouso),

          horario_corte: corteIso,
        })
        .eq("id", solicitacao.id);

      if (vooError) throw vooError;

      /* ------------------------------------------------------
         3. AERONAVE FICA EM SOLO
      ------------------------------------------------------ */

      if (solicitacao.aeronave_id) {
        await upsertStatusAeronave(
          solicitacao.aeronave_id,
          "em_solo",
          solicitacao.id,
          {
            localizacao_atual:
              perna.destino ??
              solicitacao.destino ??
              null,
          },
        );
      }

      await registrarHistoricoStatus(
        solicitacao.id,
        solicitacao.status,
        "pousado",
        userId,
        `Perna ${perna.numero_perna} pousada às ${horarioPouso}, corte às ${horarioCorte}`,
      );

      return {
        perna,
        podeContinuar: true,
      };
    },

    onSuccess: () => {
      toast.success(
        "Pouso registrado. A jornada continua aberta.",
      );

      invalidate();

      qc.invalidateQueries({
        queryKey: ["agv", "pernas"],
      });

      qc.invalidateQueries({
        queryKey: ["agv", "jornadas"],
      });

      qc.invalidateQueries({
        queryKey: ["ciclos-voo"],
      });

      qc.invalidateQueries({
        queryKey: ["aircraft-fleet"],
      });
    },

    onError: (e: any) => {
      toast.error(
        e.message ??
          "Erro ao registrar pouso",
      );
    },
  });


  /* ==========================================================
     ENCERRAR JORNADA
  ========================================================== */

  const encerrarJornada = useMutation({
    mutationFn: async ({
      solicitacao,
      jornada,
      dataPerna,
      horarioCorte,
    }: {
      solicitacao: Solicitacao;
      jornada: JornadaVoo;
      dataPerna: string;
      horarioCorte: string;
    }) => {
      const { data: userData } =
        await supabase.auth.getUser();

      const userId = userData?.user?.id ?? null;

      if (!jornada) {
        throw new Error(
          "Jornada não encontrada.",
        );
      }

      if (jornada.status !== "aberta") {
        throw new Error(
          "Esta jornada já foi encerrada.",
        );
      }

      if (!horarioCorte) {
        throw new Error(
          "Informe o corte final dos motores.",
        );
      }

      /* ------------------------------------------------------
         ENCERRA A JORNADA
         Ex.: CORT 22:10 + 45 min = 22:55
      ------------------------------------------------------ */

      const jornadaEncerrada =
        await encerrarJornadaAtual({
          jornada,
          dataCorte: dataPerna,
          horarioCorte,
        });

      /* ------------------------------------------------------
         VERIFICAR SE ESTA ERA A ÚLTIMA JORNADA DA VIAGEM
      ------------------------------------------------------ */

      const { data: ultimaPerna } = await sb
        .from("pernas_voo")
        .select(
          "numero_perna, origem, destino, horario_pouso, horario_corte",
        )
        .eq("solicitacao_id", solicitacao.id)
        .order("numero_perna", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      const finalDaViagem =
        !!ultimaPerna &&
        ehUltimaJornada(
          solicitacao,
          dataPerna,
          ultimaPerna.destino,
        );

      /* ------------------------------------------------------
         SE NÃO FOR A ÚLTIMA JORNADA:
         permanece "pousado"/"em execução"
      ------------------------------------------------------ */

      if (!finalDaViagem) {
        await registrarHistoricoStatus(
          solicitacao.id,
          solicitacao.status,
          "pousado",
          userId,
          `Jornada ${jornada.numero_jornada} encerrada às ${formatarHora(
            new Date(jornadaEncerrada.fim_em!),
          )}. Próxima jornada será iniciada em nova apresentação.`,
        );

        return {
          finalDaViagem: false,
          jornada: jornadaEncerrada,
        };
      }

      /* ------------------------------------------------------
         ÚLTIMA JORNADA:
         AGENDAMENTO = CONCLUÍDO
      ------------------------------------------------------ */

      const { error: vooError } = await sb
        .from("solicitacoes_reserva_voo")
        .update({
          status: "concluido",
          horario_corte:
            ultimaPerna.horario_corte,
        })
        .eq("id", solicitacao.id);

      if (vooError) throw vooError;

      if (solicitacao.aeronave_id) {
        await upsertStatusAeronave(
          solicitacao.aeronave_id,
          "disponivel",
          null,
          {
            localizacao_atual:
              ultimaPerna.destino ??
              solicitacao.destino ??
              null,
          },
        );

        await sb
          .from("ciclos_voo")
          .update({
            status: "concluido",
            concluido_em:
              new Date().toISOString(),
          })
          .eq(
            "id",
            solicitacao.ciclo_voo_id,
          );
      }

      await sb
        .from("escala_tripulacao")
        .update({
          status: "concluido",
        })
        .eq(
          "solicitacao_id",
          solicitacao.id,
        );

      await registrarHistoricoStatus(
        solicitacao.id,
        solicitacao.status,
        "concluido",
        userId,
        `Última jornada encerrada. Viagem concluída.`,
      );

      return {
        finalDaViagem: true,
        jornada: jornadaEncerrada,
      };
    },

    onSuccess: ({ finalDaViagem }) => {
      toast.success(
        finalDaViagem
          ? "Viagem concluída"
          : "Jornada encerrada. Próximo dia terá nova apresentação.",
      );

      invalidate();

      qc.invalidateQueries({
        queryKey: ["agv", "pernas"],
      });

      qc.invalidateQueries({
        queryKey: ["agv", "jornadas"],
      });

      qc.invalidateQueries({
        queryKey: ["ciclos-voo"],
      });

      qc.invalidateQueries({
        queryKey: ["aircraft-fleet"],
      });
    },

    onError: (e: any) => {
      toast.error(
        e.message ??
          "Erro ao encerrar jornada",
      );
    },
  });


  /* ==========================================================
     NOVA PERNA
  ========================================================== */

  const adicionarPerna = useMutation({
    mutationFn: async ({
      solicitacao,
      dataPerna,
      origem,
      destino,
      qtdPassageiros,
      observacoes,
    }: {
      solicitacao: Solicitacao;
      dataPerna: string;
      origem: string;
      destino: string;
      qtdPassageiros?: number | null;
      observacoes?: string | null;
    }) => {
      const { data: lastLeg, error } =
        await sb
          .from("pernas_voo")
          .select("numero_perna")
          .eq(
            "solicitacao_id",
            solicitacao.id,
          )
          .order("numero_perna", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

      if (error) throw error;

      const numero =
        (lastLeg?.numero_perna ?? 0) + 1;

      const perna: PernaVooInsert = {
        solicitacao_id:
          solicitacao.id,

        numero_perna: numero,

        data_perna: dataPerna,

        origem: origem
          .toUpperCase()
          .trim(),

        destino: destino
          .toUpperCase()
          .trim(),

        horario_acionamento: null,
        horario_decolagem: null,
        horario_pouso: null,
        horario_corte: null,

        qtd_passageiros:
          qtdPassageiros ??
          solicitacao.qtd_passageiros ??
          1,

        observacoes:
          observacoes ?? null,

        numero_voo:
          solicitacao.numero_voo ??
          null,

        jornada_id: null,
      };

      const { data, error: insertError } =
        await sb
          .from("pernas_voo")
          .insert(perna)
          .select("*")
          .single();

      if (insertError) throw insertError;

      return data as PernaVoo;
    },

    onSuccess: (perna) => {
      toast.success(
        `Perna ${perna.numero_perna} criada`,
      );

      invalidate();

      qc.invalidateQueries({
        queryKey: ["agv", "pernas"],
      });
    },

    onError: (e: any) => {
      toast.error(
        e.message ??
          "Erro ao criar nova perna",
      );
    },
  });


  return {
    iniciarVoo,
    registrarPousoPerna,
    encerrarJornada,
    adicionarPerna,
  };
}


/* ============================================================
   STATUS DA AERONAVE
============================================================ */

async function upsertStatusAeronave(
  aeronaveId: string,
  status: string,
  vooId: string | null,
  extra?: Record<string, unknown>,
) {
  const { data: userData } =
    await supabase.auth.getUser();

  const { data: existente } =
    await sb
      .from("status_tempo_real_aeronave")
      .select("id")
      .eq("aeronave_id", aeronaveId)
      .maybeSingle();

  const payload = {
    aeronave_id: aeronaveId,
    status_atual: status,
    voo_atual_id: vooId,
    atualizado_por:
      userData?.user?.id ?? null,
    atualizado_em:
      new Date().toISOString(),
    ...(extra ?? {}),
  };

  if (existente?.id) {
    await sb
      .from("status_tempo_real_aeronave")
      .update(payload)
      .eq("id", existente.id);
  } else {
    await sb
      .from("status_tempo_real_aeronave")
      .insert(payload);
  }
}
