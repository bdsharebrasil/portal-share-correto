import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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

/* ============================================================
   TIPOS DO BANCO
============================================================ */

type PernaVooInsert =
  Database["public"]["Tables"]["pernas_voo"]["Insert"];

type PernaVooUpdate =
  Database["public"]["Tables"]["pernas_voo"]["Update"];

/* ============================================================
   CLIENT
============================================================ */

const sb = supabase as any;

/* ============================================================
   HELPERS
============================================================ */

const iso = (d: Date) =>
  format(d, "yyyy-MM-dd");

const TIME_SUFFIX = (
  value?: string | null,
) =>
  value
    ? `${value}:00`
    : null;

function normalizarDateTimeUtc(
  data: string,
  hora: string,
) {
  return new Date(
    `${data}T${hora}:00Z`,
  );
}

function formatarHora(
  dataIso: string,
) {
  return new Date(
    dataIso,
  )
    .toISOString()
    .slice(11, 16);
}

/* ============================================================
   STATUS
============================================================ */

export type SolicitacaoStatus =
  | "pendente"
  | "confirmado"
  | "em_voo"
  | "em_rota"
  | "pousado"
  | "concluido"
  | "rejeitado"
  | "cancelado";

/* ============================================================
   AERONAVE
============================================================ */

export interface Aeronave {
  id: string;
  matricula: string;
  modelo: string | null;
  fabricante: string | null;
  status: string | null;
  url_imagem: string | null;
}

/* ============================================================
   SOLICITAÇÃO
============================================================ */

export interface Solicitacao {
  id: string;

  cliente_id:
    | string
    | null;

  aeronave_id:
    | string
    | null;

  origem:
    | string
    | null;

  destino:
    | string
    | null;

  data_agendada: string;

  horario_previsto_agendamento:
    | string
    | null;

  data_partida?:
    | string
    | null;

  horario_acionamento?:
    | string
    | null;

  horario_decolagem?:
    | string
    | null;

  horario_pouso?:
    | string
    | null;

  horario_corte?:
    | string
    | null;

  dias_duracao:
    | number
    | null;

  qtd_passageiros:
    | number
    | null;

  status: string;

  observacoes:
    | string
    | null;

  motivo_rejeicao:
    | string
    | null;

  piloto_id:
    | string
    | null;

  copiloto_id:
    | string
    | null;

  aprovado_por?:
    | string
    | null;

  aprovado_em?:
    | string
    | null;

  ciclo_voo_id?:
    | string
    | null;

  numero_voo?:
    | string
    | null;

  criado_em: string;

  atualizado_em?:
    | string
    | null;

  horario_partida?:
    | string
    | null;

  cliente_nome?:
    | string
    | null;

  aeronave?:
    | Aeronave
    | null;
}

/* ============================================================
   TRIPULANTE
============================================================ */

export interface Tripulante {
  id: string;

  user_id:
    | string
    | null;

  nome_completo: string;

  status:
    | string
    | null;

  url_avatar:
    | string
    | null;

  telefone:
    | string
    | null;

  validade_cma:
    | string
    | null;

  source?:
    | "membros_tripulacao"
    | "tripulacao";
}

/* ============================================================
   ESCALA
============================================================ */

export interface EscalaItem {
  id: string;

  membro_id: string;

  aeronave_id:
    | string
    | null;

  solicitacao_id:
    | string
    | null;

  funcao: string;

  data_inicio: string;

  data_fim: string;

  status: string;

  observacoes:
    | string
    | null;
}

/* ============================================================
   JORNADA
============================================================ */

export interface JornadaVoo {
  id: string;

  solicitacao_id: string;

  aeronave_id:
    | string
    | null;

  numero_jornada: number;

  data_jornada: string;

  apresentacao_em: string;

  inicio_em:
    | string
    | null;

  fim_em:
    | string
    | null;

  minutos_pos_corte: 30 | 45;

  status:
    | "aberta"
    | "encerrada"
    | "cancelada";

  observacoes:
    | string
    | null;
}

/* ============================================================
   PERNA
============================================================ */

export interface PernaVoo {
  id: string;

  solicitacao_id: string;

  jornada_id:
    | string
    | null;

  numero_perna: number;

  data_perna: string;

  origem: string;

  destino: string;

  horario_acionamento:
    | string
    | null;

  horario_decolagem:
    | string
    | null;

  horario_pouso:
    | string
    | null;

  horario_corte:
    | string
    | null;

  qtd_passageiros:
    | number
    | null;

  observacoes:
    | string
    | null;

  numero_voo?:
    | string
    | null;
}

/* ============================================================
   FÉRIAS
============================================================ */

export interface FeriasItem {
  id: string;

  user_id: string;

  start_date: string;

  end_date: string;
}

/* ============================================================
   BLOQUEIOS
============================================================ */

export interface DataBloqueada {
  id: string;

  aeronave_id:
    | string
    | null;

  data_bloqueio: string;

  motivo:
    | string
    | null;

  bloqueado_por:
    | string
    | null;

  frota_inteira:
    | boolean
    | null;

  criado_em: string;
}

/* ============================================================
   FROTA
============================================================ */

export interface StatusFrota {
  id: string;

  aeronave_id: string;

  status_atual: string;

  localizacao_atual:
    | string
    | null;

  chegada_prevista:
    | string
    | null;
}

export interface DisponibilidadeAeronave {
  id: string;

  registro: string;

  modelo:
    | string
    | null;

  status_atual:
    | string
    | null;

  localizacao_atual:
    | string
    | null;

  dias_bloqueados:
    | number
    | null;
}

export interface ConfigAgendamentoAeronave {
  id: string;

  aeronave_id: string;

  habilitado_agendamento: boolean;

  atualizado_em:
    | string
    | null;
}

/* ============================================================
   DISPONIBILIDADE DO TRIPULANTE
============================================================ */

export type DisponibilidadeTripulante = {
  tripulante: Tripulante;

  situacao:
    | "disponivel"
    | "em_voo"
    | "ferias"
    | "cma_vencido"
    | "inativo";

  detalhe?: string;
};

/* ============================================================
   COLUNAS DA SOLICITAÇÃO
============================================================ */

const SOLICITACAO_COLUMNS = [
  "cliente_id",
  "aeronave_id",
  "origem",
  "destino",
  "data_agendada",
  "horario_previsto_agendamento",
  "dias_duracao",
  "qtd_passageiros",
  "status",
  "observacoes",
  "motivo_rejeicao",
  "aprovado_por",
  "aprovado_em",
  "piloto_id",
  "copiloto_id",
  "horario_acionamento",
  "horario_decolagem",
  "horario_pouso",
  "horario_corte",
  "ciclo_voo_id",
  "data_partida",
  "numero_voo",
] as const;

export function sanitizeSolicitacaoPayload(
  payload: Record<
    string,
    any
  >,
) {
  const src = {
    ...payload,
  };

  if (
    src.horario_partida &&
    !src.horario_previsto_agendamento
  ) {
    src.horario_previsto_agendamento =
      src.horario_partida;
  }

  const out: Record<
    string,
    any
  > = {};

  SOLICITACAO_COLUMNS.forEach(
    (col) => {
      if (
        src[col] !==
        undefined
      ) {
        out[col] =
          src[col];
      }
    },
  );

  return out;
}

/* ============================================================
   DISPONIBILIDADE TRIPULANTE
============================================================ */

export function calcularDisponibilidadeTripulante(
  tripulante: Tripulante,
  data: Date,
  ferias: FeriasItem[],
  escala: EscalaItem[],
): DisponibilidadeTripulante {
  const dia = iso(data);

  if (
    tripulante.status &&
    ![
      "ativo",
      "ativa",
    ].includes(
      tripulante.status.toLowerCase(),
    )
  ) {
    return {
      tripulante,
      situacao:
        "inativo",
      detalhe: "Inativo",
    };
  }

  if (
    tripulante.validade_cma &&
    tripulante.validade_cma <
      dia
  ) {
    return {
      tripulante,
      situacao:
        "cma_vencido",
      detalhe: `CMA venceu em ${tripulante.validade_cma}`,
    };
  }

  const deFerias =
    tripulante.user_id
      ? ferias.some(
          (f) =>
            f.user_id ===
              tripulante.user_id &&
            isWithinInterval(
              data,
              {
                start: parseISO(
                  f.start_date,
                ),
                end: parseISO(
                  f.end_date,
                ),
              },
            ),
        )
      : false;

  if (deFerias) {
    return {
      tripulante,
      situacao:
        "ferias",
      detalhe:
        "Em férias",
    };
  }

  const escalado =
    escala.find(
      (e) =>
        e.membro_id ===
          tripulante.id &&
        e.data_inicio <=
          dia &&
        e.data_fim >=
          dia &&
        e.status !==
          "cancelado",
    );

  if (escalado) {
    return {
      tripulante,
      situacao:
        "em_voo",
      detalhe:
        escalado.funcao.toUpperCase(),
    };
  }

  return {
    tripulante,
    situacao:
      "disponivel",
  };
}

/* ============================================================
   SITUAÇÃO DA AERONAVE
============================================================ */

export type SituacaoAeronave =
  | "disponivel"
  | "em_voo"
  | "manutencao"
  | "reservado";

export function calcularSituacaoAeronave(
  aeronave: Aeronave,
  data: Date,
  bloqueios: DataBloqueada[],
  statusFrota: StatusFrota[],
): {
  situacao: SituacaoAeronave;
  detalhe?: string;
} {
  const dia =
    iso(data);

  const status =
    statusFrota.find(
      (s) =>
        s.aeronave_id ===
        aeronave.id,
    );

  if (
    (
      aeronave.status ??
      ""
    ).toLowerCase() ===
      "manutencao" ||
    status?.status_atual ===
      "manutencao"
  ) {
    return {
      situacao:
        "manutencao",
      detalhe:
        "Em manutenção",
    };
  }

  if (
    status?.status_atual ===
    "em_voo"
  ) {
    return {
      situacao:
        "em_voo",
      detalhe:
        status.localizacao_atual ??
        undefined,
    };
  }

  const bloqueio =
    bloqueios.find(
      (b) =>
        b.data_bloqueio ===
          dia &&
        (
          b.frota_inteira ||
          b.aeronave_id ===
            aeronave.id
        ),
    );

  if (bloqueio) {
    const manut =
      (
        bloqueio.motivo ??
        ""
      )
        .toLowerCase()
        .includes(
          "manuten",
        );

    return {
      situacao:
        manut
          ? "manutencao"
          : "reservado",
      detalhe:
        bloqueio.motivo ??
        undefined,
    };
  }

  return {
    situacao:
      "disponivel",
  };
}

/* ============================================================
   VOO COBRE DIA
============================================================ */

export function vooCobreDia(
  solicitacao: Solicitacao,
  dia: string,
) {
  const dias =
    Math.max(
      1,
      solicitacao.dias_duracao ??
        1,
    );

  const inicio =
    parseISO(
      solicitacao.data_agendada,
    );

  const fim =
    addDays(
      inicio,
      dias - 1,
    );

  const alvo =
    parseISO(dia);

  return (
    alvo >=
      parseISO(
        iso(inicio),
      ) &&
    alvo <=
      parseISO(
        iso(fim),
      )
  );
}

/* ============================================================
   QUERIES
============================================================ */

/* ------------------------------------------------------------
   AERONAVES
------------------------------------------------------------ */

export function useAeronavesAgendamento() {
  return useQuery({
    queryKey: [
      "agv",
      "aeronaves",
    ],

    queryFn:
      async (): Promise<
        Aeronave[]
      > => {
        const {
          data,
          error,
        } = await sb
          .from("aeronave")
          .select(
            "id, matricula, modelo, fabricante, status, url_imagem",
          )
          .eq(
            "status",
            "ativa",
          )
          .order(
            "matricula",
          );

        if (error)
          throw error;

        return (
          data ?? []
        ) as Aeronave[];
      },
  });
}

/* ------------------------------------------------------------
   SOLICITAÇÕES
------------------------------------------------------------ */

export function useSolicitacoes() {
  return useQuery({
    queryKey: [
      "agv",
      "solicitacoes",
    ],

    queryFn:
      async (): Promise<
        Solicitacao[]
      > => {
        const {
          data,
          error,
        } = await sb
          .from(
            "solicitacoes_reserva_voo",
          )
          .select("*")
          .order(
            "data_agendada",
            {
              ascending:
                true,
            },
          )
          .order(
            "horario_previsto_agendamento",
            {
              ascending:
                true,
            },
          );

        if (error)
          throw error;

        const rows =
          (data ??
            []) as any[];

        const clienteIds =
          [
            ...new Set(
              rows
                .map(
                  (r) =>
                    r.cliente_id,
                )
                .filter(
                  Boolean,
                ),
            ),
          ] as string[];

        const aeronaveIds =
          [
            ...new Set(
              rows
                .map(
                  (r) =>
                    r.aeronave_id,
                )
                .filter(
                  Boolean,
                ),
            ),
          ] as string[];

        const [
          clientesRes,
          aeronavesRes,
        ] =
          await Promise.all([
            clienteIds.length
              ? sb
                  .from(
                    "clientes",
                  )
                  .select(
                    "id, razao_social",
                  )
                  .in(
                    "id",
                    clienteIds,
                  )
              : Promise.resolve({
                  data: [],
                }),

            aeronaveIds.length
              ? sb
                  .from(
                    "aeronave",
                  )
                  .select(
                    "id, matricula, modelo, fabricante, status, url_imagem",
                  )
                  .in(
                    "id",
                    aeronaveIds,
                  )
              : Promise.resolve({
                  data: [],
                }),
          ]);

        const clientes =
          new Map<
            string,
            any
          >(
            (
              clientesRes.data ??
              []
            ).map(
              (c: any) => [
                c.id,
                c,
              ],
            ),
          );

        const aeronaves =
          new Map<
            string,
            any
          >(
            (
              aeronavesRes.data ??
              []
            ).map(
              (a: any) => [
                a.id,
                a,
              ],
            ),
          );

        return rows.map(
          (r) =>
            ({
              ...r,

              horario_partida:
                r.horario_previsto_agendamento ??
                null,

              cliente_nome:
                r.cliente_id
                  ? clientes.get(
                      r.cliente_id,
                    )
                      ?.razao_social ??
                    null
                  : null,

              aeronave:
                r.aeronave_id
                  ? aeronaves.get(
                      r.aeronave_id,
                    ) ??
                    null
                  : null,
            }) as Solicitacao,
        );
      },
  });
}

/* ------------------------------------------------------------
   TRIPULANTES
------------------------------------------------------------ */

export function useTripulantes() {
  return useQuery({
    queryKey: [
      "agv",
      "tripulantes",
    ],

    queryFn:
      async (): Promise<
        Tripulante[]
      > => {
        const [
          membrosRes,
          tripulacaoRes,
        ] =
          await Promise.all([
            sb
              .from(
                "membros_tripulacao",
              )
              .select(
                "id, user_id, nome_completo, status, url_avatar, telefone",
              )
              .eq(
                "status",
                "ativo",
              )
              .order(
                "nome_completo",
              ),

            sb
              .from(
                "tripulacao",
              )
              .select(
                "id, nome_completo, status, url_avatar, telefone",
              )
              .eq(
                "status",
                "ativo",
              )
              .order(
                "nome_completo",
              ),
          ]);

        if (
          membrosRes.error
        ) {
          throw membrosRes.error;
        }

        if (
          tripulacaoRes.error
        ) {
          throw tripulacaoRes.error;
        }

        const membros =
          (
            membrosRes.data ??
            []
          ).map(
            (m: any) => ({
              ...m,
              user_id:
                m.user_id ??
                null,
              validade_cma:
                null,
              source:
                "membros_tripulacao" as const,
            }),
          );

        const tripulacao =
          (
            tripulacaoRes.data ??
            []
          ).map(
            (t: any) => ({
              id: t.id,
              user_id:
                null,
              nome_completo:
                t.nome_completo,
              status:
                t.status,
              url_avatar:
                t.url_avatar ??
                null,
              telefone:
                t.telefone ??
                null,
              validade_cma:
                null,
              source:
                "tripulacao" as const,
            }),
          );

        const {
          data: habs,
        } = await sb
          .from(
            "habilitacoes_tripulante",
          )
          .select(
            "membro_tripulacao_id, validade_cma",
          );

        const cmaPorMembro =
          new Map<
            string,
            string
          >();

        (
          habs ?? []
        ).forEach(
          (h: any) => {
            if (
              !h.membro_tripulacao_id ||
              !h.validade_cma
            ) {
              return;
            }

            const atual =
              cmaPorMembro.get(
                h.membro_tripulacao_id,
              );

            if (
              !atual ||
              h.validade_cma >
                atual
            ) {
              cmaPorMembro.set(
                h.membro_tripulacao_id,
                h.validade_cma,
              );
            }
          },
        );

        return [
          ...membros.map(
            (m: Tripulante) => ({
              ...m,
              validade_cma:
                cmaPorMembro.get(
                  m.id,
                ) ??
                null,
            }),
          ),

          ...tripulacao,
        ];
      },
  });
}

/* ------------------------------------------------------------
   FÉRIAS
------------------------------------------------------------ */

export function useFerias() {
  return useQuery({
    queryKey: [
      "agv",
      "ferias",
    ],

    queryFn:
      async (): Promise<
        FeriasItem[]
      > => {
        const {
          data,
          error,
        } = await sb
          .from(
            "vacation_requests",
          )
          .select(
            "id, user_id, start_date, end_date, status",
          )
          .in(
            "status",
            [
              "aprovado",
              "approved",
              "aprovada",
            ],
          );

        if (error)
          throw error;

        return (
          data ?? []
        ) as FeriasItem[];
      },
  });
}

/* ------------------------------------------------------------
   ESCALA
------------------------------------------------------------ */

export function useEscala() {
  return useQuery({
    queryKey: [
      "agv",
      "escala",
    ],

    queryFn:
      async (): Promise<
        EscalaItem[]
      > => {
        const {
          data,
          error,
        } = await sb
          .from(
            "escala_tripulacao",
          )
          .select("*")
          .order(
            "data_inicio",
          );

        if (error)
          throw error;

        return (
          data ?? []
        ) as EscalaItem[];
      },
  });
}

/* ------------------------------------------------------------
   PERNAS
------------------------------------------------------------ */

export function usePernasVoo(
  solicitacaoId?:
    | string
    | null,
) {
  return useQuery({
    queryKey: [
      "agv",
      "pernas",
      solicitacaoId,
    ],

    enabled:
      !!solicitacaoId,

    queryFn:
      async (): Promise<
        PernaVoo[]
      > => {
        const {
          data,
          error,
        } = await sb
          .from(
            "pernas_voo",
          )
          .select("*")
          .eq(
            "solicitacao_id",
            solicitacaoId,
          )
          .order(
            "numero_perna",
            {
              ascending:
                true,
            },
          );

        if (error)
          throw error;

        return (
          data ?? []
        ) as PernaVoo[];
      },
  });
}

/* ------------------------------------------------------------
   JORNADAS
------------------------------------------------------------ */

export function useJornadasVoo(
  solicitacaoId?:
    | string
    | null,
) {
  return useQuery({
    queryKey: [
      "agv",
      "jornadas",
      solicitacaoId,
    ],

    enabled:
      !!solicitacaoId,

    queryFn:
      async (): Promise<
        JornadaVoo[]
      > => {
        const {
          data,
          error,
        } = await sb
          .from(
            "jornadas_voo",
          )
          .select("*")
          .eq(
            "solicitacao_id",
            solicitacaoId,
          )
          .order(
            "numero_jornada",
            {
              ascending:
                true,
            },
          );

        if (error)
          throw error;

        return (
          data ?? []
        ) as JornadaVoo[];
      },
  });
}

/* ------------------------------------------------------------
   ESCALA DE UM VOO
------------------------------------------------------------ */

export function useEscalaTripulacao(
  solicitacaoId?:
    | string
    | null,
) {
  return useQuery({
    queryKey: [
      "agv",
      "escala",
      solicitacaoId,
    ],

    enabled:
      !!solicitacaoId,

    queryFn:
      async () => {
        const {
          data,
          error,
        } = await sb
          .from(
            "escala_tripulacao",
          )
          .select("*")
          .eq(
            "solicitacao_id",
            solicitacaoId,
          )
          .order(
            "data_inicio",
            {
              ascending:
                true,
            },
          );

        if (error)
          throw error;

        return (
          data ?? []
        ) as EscalaItem[];
      },
  });
}

/* ------------------------------------------------------------
   BLOQUEIOS
------------------------------------------------------------ */

export function useDatasBloqueadas(
  aeronaveId?:
    | string
    | null,
) {
  return useQuery({
    queryKey: [
      "agv",
      "bloqueios",
      aeronaveId,
    ],

    queryFn:
      async (): Promise<
        DataBloqueada[]
      > => {
        let query = sb
          .from(
            "datas_bloqueadas_voo",
          )
          .select("*")
          .order(
            "data_bloqueio",
            {
              ascending:
                true,
            },
          );

        if (aeronaveId) {
          query = query.or(
            `aeronave_id.eq.${aeronaveId},frota_inteira.eq.true`,
          );
        }

        const {
          data,
          error,
        } = await query;

        if (error)
          throw error;

        return (
          data ?? []
        ) as DataBloqueada[];
      },
  });
}

/* ------------------------------------------------------------
   STATUS DA FROTA
------------------------------------------------------------ */

export function useStatusFrota() {
  return useQuery({
    queryKey: [
      "agv",
      "status-frota",
    ],

    queryFn:
      async (): Promise<
        StatusFrota[]
      > => {
        const {
          data,
          error,
        } = await sb
          .from(
            "status_tempo_real_aeronave",
          )
          .select("*");

        if (error)
          throw error;

        return (
          data ?? []
        ) as StatusFrota[];
      },
  });
}

/* ------------------------------------------------------------
   DISPONIBILIDADE AERONAVE
------------------------------------------------------------ */

export function useDisponibilidadeAeronave() {
  return useQuery({
    queryKey: [
      "agv",
      "disponibilidade-aeronave",
    ],

    queryFn:
      async (): Promise<
        DisponibilidadeAeronave[]
      > => {
        const {
          data,
          error,
        } = await sb
          .from(
            "disponibilidade_aeronave",
          )
          .select(
            "id, registro, modelo, status_atual, localizacao_atual, dias_bloqueados",
          )
          .order(
            "registro",
          );

        if (error)
          throw error;

        return (
          data ?? []
        ) as DisponibilidadeAeronave[];
      },
  });
}

/* ------------------------------------------------------------
   CONFIGURAÇÃO DE AGENDAMENTO
------------------------------------------------------------ */

export function useConfigAgendamento() {
  return useQuery({
    queryKey: [
      "agv",
      "config-agendamento",
    ],

    queryFn:
      async (): Promise<
        ConfigAgendamentoAeronave[]
      > => {
        const {
          data,
          error,
        } = await sb
          .from(
            "config_agendamento_aeronave",
          )
          .select(
            "id, aeronave_id, habilitado_agendamento, atualizado_em",
          );

        if (error)
          throw error;

        return (
          data ?? []
        ) as ConfigAgendamentoAeronave[];
      },
  });
}

export function isAgendamentoHabilitado(
  aeronaveId: string,
  configs: ConfigAgendamentoAeronave[],
) {
  const cfg =
    configs.find(
      (c) =>
        c.aeronave_id ===
        aeronaveId,
    );

  return cfg
    ? cfg.habilitado_agendamento
    : true;
}

/* ============================================================
   REALTIME
============================================================ */

export function useAgendamentoRealtime() {
  const qc =
    useQueryClient();

  useEffect(() => {
    const channel =
      supabase
        .channel(
          "agendamento-voo",
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "solicitacoes_reserva_voo",
          },
          (payload: any) => {
            qc.invalidateQueries(
              {
                queryKey: [
                  "agv",
                ],
              },
            );

            if (
              payload.eventType ===
              "INSERT"
            ) {
              toast.info(
                "Nova solicitação de voo",
                {
                  description: `${payload.new?.origem ?? "?"} → ${payload.new?.destino ?? "?"}`,
                },
              );
            }
          },
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "config_agendamento_aeronave",
          },
          () => {
            qc.invalidateQueries(
              {
                queryKey: [
                  "agv",
                  "config-agendamento",
                ],
              },
            );
          },
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "escala_tripulacao",
          },
          () => {
            qc.invalidateQueries(
              {
                queryKey: [
                  "agv",
                  "escala",
                ],
              },
            );
          },
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "status_tempo_real_aeronave",
          },
          () => {
            qc.invalidateQueries(
              {
                queryKey: [
                  "agv",
                  "status-frota",
                ],
              },
            );

            qc.invalidateQueries(
              {
                queryKey: [
                  "agv",
                  "disponibilidade-aeronave",
                ],
              },
            );
          },
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "datas_bloqueadas_voo",
          },
          () => {
            qc.invalidateQueries(
              {
                queryKey: [
                  "agv",
                  "bloqueios",
                ],
              },
            );
          },
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "pernas_voo",
          },
          () => {
            qc.invalidateQueries(
              {
                queryKey: [
                  "agv",
                  "pernas",
                ],
              },
            );
          },
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "jornadas_voo",
          },
          () => {
            qc.invalidateQueries(
              {
                queryKey: [
                  "agv",
                  "jornadas",
                ],
              },
            );
          },
        )

        .subscribe();

    return () => {
      supabase.removeChannel(
        channel,
      );
    };
  }, [qc]);
}

/* ============================================================
   HISTÓRICO
============================================================ */

async function registrarHistoricoStatus(
  solicitacaoId: string,
  statusAnterior:
    | string
    | null,
  statusNovo: string,
  alteradoPor:
    | string
    | null,
  observacao?:
    | string
    | null,
) {
  const {
    error,
  } = await sb
    .from(
      "historico_status_solicitacao",
    )
    .insert({
      solicitacao_id:
        solicitacaoId,

      status_anterior:
        statusAnterior,

      status_novo:
        statusNovo,

      alterado_por:
        alteradoPor,

      atualizado_em:
        new Date().toISOString(),

      observacao:
        observacao ??
        null,
    });

  if (error) {
    console.warn(
      "Erro ao registrar histórico:",
      error,
    );
  }
}

/* ============================================================
   STATUS DA AERONAVE
============================================================ */

async function upsertStatusAeronave(
  aeronaveId: string,
  status: string,
  vooId:
    | string
    | null,
  extra?: Record<
    string,
    unknown
  >,
) {
  const {
    data: userData,
  } =
    await supabase.auth.getUser();

  const {
    data: existente,
  } = await sb
    .from(
      "status_tempo_real_aeronave",
    )
    .select("id")
    .eq(
      "aeronave_id",
      aeronaveId,
    )
    .maybeSingle();

  const payload = {
    aeronave_id:
      aeronaveId,

    status_atual:
      status,

    voo_atual_id:
      vooId,

    atualizado_por:
      userData?.user?.id ??
      null,

    atualizado_em:
      new Date().toISOString(),

    ...(extra ?? {}),
  };

  if (existente?.id) {
    const {
      error,
    } = await sb
      .from(
        "status_tempo_real_aeronave",
      )
      .update(
        payload,
      )
      .eq(
        "id",
        existente.id,
      );

    if (error)
      throw error;
  } else {
    const {
      error,
    } = await sb
      .from(
        "status_tempo_real_aeronave",
      )
      .insert(
        payload,
      );

    if (error)
      throw error;
  }
}

/* ============================================================
   BUSCAR JORNADA DO DIA
============================================================ */

async function buscarJornadaDoDia(
  solicitacaoId: string,
  dataJornada: string,
) {
  const {
    data,
    error,
  } = await sb
    .from(
      "jornadas_voo",
    )
    .select("*")
    .eq(
      "solicitacao_id",
      solicitacaoId,
    )
    .eq(
      "data_jornada",
      dataJornada,
    )
    .maybeSingle();

  if (error)
    throw error;

  return (
    data as JornadaVoo | null
  );
}

/* ============================================================
   CRIAR / LOCALIZAR JORNADA
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

  minutosPosCorte:
    | 30
    | 45;

  userId:
    | string
    | null;
}) {
  const existente =
    await buscarJornadaDoDia(
      solicitacao.id,
      dataJornada,
    );

  if (existente) {
    if (
      existente.status ===
      "encerrada"
    ) {
      throw new Error(
        `A jornada de ${dataJornada} já foi encerrada.`,
      );
    }

    if (
      existente.status ===
      "cancelada"
    ) {
      throw new Error(
        `A jornada de ${dataJornada} está cancelada.`,
      );
    }

    return existente;
  }

  const apresentacaoEm =
    normalizarDateTimeUtc(
      dataJornada,
      horarioApresentacao,
    );

  const {
    data: ultimaJornada,
    error:
      ultimaJornadaError,
  } = await sb
    .from(
      "jornadas_voo",
    )
    .select(
      "numero_jornada",
    )
    .eq(
      "solicitacao_id",
      solicitacao.id,
    )
    .order(
      "numero_jornada",
      {
        ascending:
          false,
      },
    )
    .limit(1)
    .maybeSingle();

  if (
    ultimaJornadaError
  ) {
    throw ultimaJornadaError;
  }

  const numeroJornada =
    (ultimaJornada?.numero_jornada ??
      0) +
    1;

  const {
    data,
    error,
  } = await sb
    .from(
      "jornadas_voo",
    )
    .insert({
      solicitacao_id:
        solicitacao.id,

      aeronave_id:
        solicitacao.aeronave_id,

      numero_jornada:
        numeroJornada,

      data_jornada:
        dataJornada,

      apresentacao_em:
        apresentacaoEm.toISOString(),

      inicio_em:
        apresentacaoEm.toISOString(),

      fim_em: null,

      minutos_pos_corte:
        minutosPosCorte,

      status:
        "aberta",

      criado_por:
        userId,
    })
    .select("*")
    .single();

  if (error)
    throw error;

  return (
    data as JornadaVoo
  );
}

/* ============================================================
   MUTATIONS
============================================================ */

export function useAgendamentoMutations() {
  const qc =
    useQueryClient();

  const invalidate =
    () =>
      qc.invalidateQueries(
        {
          queryKey: [
            "agv",
          ],
        },
      );

  /* ==========================================================
     CRIAR SOLICITAÇÃO
  ========================================================== */

  const criarSolicitacao =
    useMutation({
      mutationFn:
        async (
          payload: Partial<Solicitacao>,
        ) => {
          const row =
            sanitizeSolicitacaoPayload(
              payload as Record<
                string,
                any
              >,
            );

          if (
            !row.aeronave_id
          ) {
            throw new Error(
              "Selecione a aeronave.",
            );
          }

          if (!row.origem) {
            throw new Error(
              "Informe a origem.",
            );
          }

          if (!row.destino) {
            throw new Error(
              "Informe o destino.",
            );
          }

          if (
            !row.data_agendada
          ) {
            throw new Error(
              "Informe a data do voo.",
            );
          }

          if (
            !row.horario_previsto_agendamento
          ) {
            throw new Error(
              "Informe o horário previsto de partida.",
            );
          }

          const {
            error,
          } = await sb
            .from(
              "solicitacoes_reserva_voo",
            )
            .insert(
              row,
            );

          if (error)
            throw error;
        },

      onSuccess:
        () => {
          toast.success(
            "Agendamento criado",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao criar agendamento",
          ),
    });

  /* ==========================================================
     ATUALIZAR SOLICITAÇÃO
  ========================================================== */

  const atualizarSolicitacao =
    useMutation({
      mutationFn:
        async ({
          id,
          dados,
        }: {
          id: string;
          dados: Partial<Solicitacao>;
        }) => {
          const row =
            sanitizeSolicitacaoPayload(
              dados as Record<
                string,
                any
              >,
            );

          if (
            Object.keys(row)
              .length === 0
          ) {
            return;
          }

          const {
            error,
          } = await sb
            .from(
              "solicitacoes_reserva_voo",
            )
            .update(
              row,
            )
            .eq(
              "id",
              id,
            );

          if (error)
            throw error;
        },

      onSuccess:
        () => {
          toast.success(
            "Agendamento atualizado",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao atualizar agendamento",
          ),
    });

  /* ==========================================================
     CONFIRMAR
  ========================================================== */

  const confirmarVoo =
    useMutation({
      mutationFn:
        async (
          solicitacao: Solicitacao,
        ) => {
          const {
            data: userData,
          } =
            await supabase.auth.getUser();

          const userId =
            userData
              ?.user?.id ??
            null;

          let numeroVoo =
            solicitacao.numero_voo ??
            null;

          if (
            !numeroVoo &&
            solicitacao.cliente_id
          ) {
            const {
              data:
                gerado,
              error:
                rpcError,
            } =
              await sb.rpc(
                "gerar_numero_voo",
                {
                  p_cliente_id:
                    solicitacao.cliente_id,
                },
              );

            if (rpcError)
              throw rpcError;

            numeroVoo =
              gerado as string;
          }

          const {
            error,
          } = await sb
            .from(
              "solicitacoes_reserva_voo",
            )
            .update({
              status:
                "confirmado",

              numero_voo:
                numeroVoo,

              aprovado_por:
                userId,

              aprovado_em:
                new Date().toISOString(),
            })
            .eq(
              "id",
              solicitacao.id,
            );

          if (error)
            throw error;

          await registrarHistoricoStatus(
            solicitacao.id,
            solicitacao.status,
            "confirmado",
            userId,
          );

          return numeroVoo;
        },

      onSuccess:
        (numeroVoo) => {
          toast.success(
            numeroVoo
              ? `Voo ${numeroVoo} confirmado`
              : "Voo confirmado",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao confirmar voo",
          ),
    });

  /* ==========================================================
     APROVAR E ESCALAR
  ========================================================== */

  const aprovar =
    useMutation({
      mutationFn:
        async ({
          solicitacao,
          pilotoId,
          copilotoId,
          dados,
        }: {
          solicitacao: Solicitacao;

          pilotoId?:
            | string
            | null;

          copilotoId?:
            | string
            | null;

          dados?: Partial<Solicitacao>;
        }) => {
          const {
            data: userData,
          } =
            await supabase.auth.getUser();

          const userId =
            userData
              ?.user?.id ??
            null;

          const dadosAtualizados =
            sanitizeSolicitacaoPayload(
              dados as Record<
                string,
                any
              > ?? {},
            );

          let numeroVoo =
            solicitacao.numero_voo ??
            null;

          if (
            !numeroVoo &&
            solicitacao.cliente_id
          ) {
            const {
              data:
                gerado,
              error:
                rpcError,
            } =
              await sb.rpc(
                "gerar_numero_voo",
                {
                  p_cliente_id:
                    solicitacao.cliente_id,
                },
              );

            if (rpcError)
              throw rpcError;

            numeroVoo =
              gerado as string;
          }

          const {
            error,
          } = await sb
            .from(
              "solicitacoes_reserva_voo",
            )
            .update({
              ...dadosAtualizados,

              status:
                "confirmado",

              piloto_id:
                pilotoId ??
                null,

              copiloto_id:
                copilotoId ??
                null,

              numero_voo:
                numeroVoo,

              aprovado_por:
                userId,

              aprovado_em:
                new Date().toISOString(),
            })
            .eq(
              "id",
              solicitacao.id,
            );

          if (error)
            throw error;

          await registrarHistoricoStatus(
            solicitacao.id,
            solicitacao.status,
            "confirmado",
            userId,
          );

          return numeroVoo;
        },

      onSuccess:
        (numeroVoo) => {
          toast.success(
            numeroVoo
              ? `Voo ${numeroVoo} confirmado`
              : "Voo confirmado",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao confirmar voo",
          ),
    });

  /* ==========================================================
     ESCALAR TRIPULAÇÃO
  ========================================================== */

  const escalarTripulacao =
    useMutation({
      mutationFn:
        async ({
          solicitacao,
          pilotoId,
          copilotoId,
          observacoes,
        }: {
          solicitacao: Solicitacao;

          pilotoId: string;

          copilotoId?:
            | string
            | null;

          observacoes?:
            | string
            | null;
        }) => {
          if (!pilotoId) {
            throw new Error(
              "Selecione o piloto em comando (PIC).",
            );
          }

          const {
            data: userData,
          } =
            await supabase.auth.getUser();

          const userId =
            userData
              ?.user?.id ??
            null;

          const {
            error:
              updError,
          } = await sb
            .from(
              "solicitacoes_reserva_voo",
            )
            .update({
              piloto_id:
                pilotoId,

              copiloto_id:
                copilotoId ??
                null,
            })
            .eq(
              "id",
              solicitacao.id,
            );

          if (updError)
            throw updError;

          await sb
            .from(
              "escala_tripulacao",
            )
            .delete()
            .eq(
              "solicitacao_id",
              solicitacao.id,
            );

          const dias =
            Math.max(
              1,
              solicitacao.dias_duracao ??
                1,
            );

          const dataFim =
            iso(
              addDays(
                parseISO(
                  solicitacao.data_agendada,
                ),
                dias - 1,
              ),
            );

          const escalas = [
            {
              membro_id:
                pilotoId,
              funcao:
                "pic",
            },

            ...(copilotoId
              ? [
                  {
                    membro_id:
                      copilotoId,
                    funcao:
                      "sic",
                  },
                ]
              : []),
          ].map(
            (e) => ({
              ...e,

              aeronave_id:
                solicitacao.aeronave_id,

              solicitacao_id:
                solicitacao.id,

              data_inicio:
                solicitacao.data_agendada,

              data_fim:
                dataFim,

              status:
                "escalado",

              observacoes:
                observacoes ??
                `Voo ${solicitacao.numero_voo ?? ""} • ${solicitacao.origem ?? "—"} → ${solicitacao.destino ?? "—"}`,

              criado_por:
                userId,
            }),
          );

          const {
            error:
              escalaError,
          } = await sb
            .from(
              "escala_tripulacao",
            )
            .insert(
              escalas,
            );

          if (
            escalaError
          ) {
            throw escalaError;
          }
        },

      onSuccess:
        () => {
          toast.success(
            "Tripulação escalada",
          );

          invalidate();

          qc.invalidateQueries(
            {
              queryKey: [
                "agv",
                "escala",
              ],
            },
          );
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao escalar tripulação",
          ),
    });

  /* ==========================================================
     REJEITAR
  ========================================================== */

  const rejeitar =
    useMutation({
      mutationFn:
        async ({
          id,
          motivo,
        }: {
          id: string;
          motivo: string;
        }) => {
          const {
            error,
          } = await sb
            .from(
              "solicitacoes_reserva_voo",
            )
            .update({
              status:
                "rejeitado",

              motivo_rejeicao:
                motivo,
            })
            .eq(
              "id",
              id,
            );

          if (error)
            throw error;
        },

      onSuccess:
        () => {
          toast.success(
            "Solicitação rejeitada",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao rejeitar",
          ),
    });

  /* ==========================================================
     INICIAR PERNA
  ========================================================== */

  const iniciarVoo =
    useMutation({
      mutationFn:
        async ({
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

          pilotoId?:
            | string
            | null;

          copilotoId?:
            | string
            | null;

          qtdPassageiros?:
            | number;

          minutosPosCorte:
            | 30
            | 45;
        }) => {
          if (
            solicitacao.status ===
            "concluido"
          ) {
            throw new Error(
              "Esta viagem já foi concluída.",
            );
          }

          if (
            !horarioApresentacao
          ) {
            throw new Error(
              "Informe o horário de apresentação.",
            );
          }

          if (
            !horarioAcionamento
          ) {
            throw new Error(
              "Informe o horário de acionamento.",
            );
          }

          if (
            !horarioDecolagem
          ) {
            throw new Error(
              "Informe o horário de decolagem.",
            );
          }

          /* --------------------------------------------------
             GARANTE QUE A PERNA AINDA NÃO FOI INICIADA
          -------------------------------------------------- */

          const {
            data:
              pernaAtual,
            error:
              pernaAtualError,
          } = await sb
            .from(
              "pernas_voo",
            )
            .select(
              "id, jornada_id, horario_decolagem, horario_pouso, horario_corte",
            )
            .eq(
              "id",
              perna.id,
            )
            .single();

          if (
            pernaAtualError
          ) {
            throw pernaAtualError;
          }

          if (
            pernaAtual?.horario_decolagem
          ) {
            throw new Error(
              `A perna ${perna.numero_perna} já foi iniciada.`,
            );
          }

          const {
            data: userData,
          } =
            await supabase.auth.getUser();

          const userId =
            userData
              ?.user?.id ??
            null;

          /* --------------------------------------------------
             GARANTE QUE NÃO EXISTE OUTRA JORNADA ABERTA
             EM OUTRO DIA
          -------------------------------------------------- */

          const {
            data:
              jornadasAbertas,
            error:
              jornadasError,
          } = await sb
            .from(
              "jornadas_voo",
            )
            .select("*")
            .eq(
              "solicitacao_id",
              solicitacao.id,
            )
            .eq(
              "status",
              "aberta",
            );

          if (jornadasError) {
            throw jornadasError;
          }

          const jornadaAbertaOutroDia =
            (
              jornadasAbertas ??
              []
            ).find(
              (j: JornadaVoo) =>
                j.data_jornada !==
                dataPartida,
            );

          if (
            jornadaAbertaOutroDia
          ) {
            throw new Error(
              `Existe uma jornada aberta em ${jornadaAbertaOutroDia.data_jornada}. Encerre essa jornada antes de iniciar uma nova.`,
            );
          }

          /* --------------------------------------------------
             CRIA OU RECUPERA A JORNADA DO DIA
          -------------------------------------------------- */

          const jornada =
            await criarJornadaDoDia({
              solicitacao,
              dataJornada:
                dataPartida,
              horarioApresentacao,
              minutosPosCorte,
              userId,
            });

          if (
            jornada.status !==
            "aberta"
          ) {
            throw new Error(
              "A jornada deste dia não está aberta.",
            );
          }

          /* --------------------------------------------------
             PASSAGEIROS
          -------------------------------------------------- */

          const passageiros =
            Math.max(
              1,
              qtdPassageiros ??
                solicitacao.qtd_passageiros ??
                1,
            );

          /* --------------------------------------------------
             VINCULA A PERNA À JORNADA
          -------------------------------------------------- */

          const {
            error:
              pernaError,
          } = await sb
            .from(
              "pernas_voo",
            )
            .update({
              jornada_id:
                jornada.id,

              data_perna:
                dataPartida,

              horario_acionamento:
                TIME_SUFFIX(
                  horarioAcionamento,
                ),

              horario_decolagem:
                TIME_SUFFIX(
                  horarioDecolagem,
                ),

              horario_pouso:
                null,

              horario_corte:
                null,

              numero_voo:
                solicitacao.numero_voo ??
                null,

              qtd_passageiros:
                passageiros,
            })
            .eq(
              "id",
              perna.id,
            );

          if (pernaError)
            throw pernaError;

          /* --------------------------------------------------
             SOLICITAÇÃO
          -------------------------------------------------- */

          const {
            error:
              vooError,
          } = await sb
            .from(
              "solicitacoes_reserva_voo",
            )
            .update({
              status:
                "em_rota",

              data_partida:
                dataPartida,

              horario_acionamento:
                TIME_SUFFIX(
                  horarioAcionamento,
                ),

              horario_decolagem:
                TIME_SUFFIX(
                  horarioDecolagem,
                ),

              horario_pouso:
                null,

              horario_corte:
                null,

              piloto_id:
                pilotoId ??
                solicitacao.piloto_id ??
                null,

              copiloto_id:
                copilotoId ??
                solicitacao.copiloto_id ??
                null,

              qtd_passageiros:
                passageiros,
            })
            .eq(
              "id",
              solicitacao.id,
            );

          if (vooError)
            throw vooError;

          /* --------------------------------------------------
             AERONAVE
          -------------------------------------------------- */

          if (
            solicitacao.aeronave_id
          ) {
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

                chegada_prevista:
                  null,
              },
            );
          }

          /* --------------------------------------------------
             ESCALA
          -------------------------------------------------- */

          await sb
            .from(
              "escala_tripulacao",
            )
            .update({
              status:
                "em_voo",
            })
            .eq(
              "solicitacao_id",
              solicitacao.id,
            );

          await registrarHistoricoStatus(
            solicitacao.id,
            solicitacao.status,
            "em_rota",
            userId,
            `Jornada ${jornada.numero_jornada} iniciada • apresentação ${horarioApresentacao} • perna ${perna.numero_perna}`,
          );

          return jornada;
        },

      onSuccess:
        () => {
          toast.success(
            "Perna iniciada e jornada registrada",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao iniciar a perna",
          ),
    });

  /* ==========================================================
     POUSAR PERNA
  ========================================================== */

  const registrarPousoPerna =
    useMutation({
      mutationFn:
        async ({
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
          const {
            data: userData,
          } =
            await supabase.auth.getUser();

          const userId =
            userData
              ?.user?.id ??
            null;

          if (
            !horarioPouso
          ) {
            throw new Error(
              "Informe o horário de pouso.",
            );
          }

          if (
            !horarioCorte
          ) {
            throw new Error(
              "Informe o horário de corte.",
            );
          }

          if (
            !perna.jornada_id
          ) {
            throw new Error(
              "Esta perna ainda não está vinculada a uma jornada.",
            );
          }

          if (
            !perna.horario_decolagem
          ) {
            throw new Error(
              "Esta perna ainda não foi iniciada.",
            );
          }

          const corteIso =
            normalizarDateTimeUtc(
              dataPerna,
              horarioCorte,
            ).toISOString();

          /* --------------------------------------------------
             ATUALIZA PERNA
          -------------------------------------------------- */

          const {
            error:
              pernaError,
          } = await sb
            .from(
              "pernas_voo",
            )
            .update({
              data_perna:
                dataPerna,

              horario_pouso:
                TIME_SUFFIX(
                  horarioPouso,
                ),

              horario_corte:
                corteIso,

              numero_voo:
                solicitacao.numero_voo ??
                null,
            })
            .eq(
              "id",
              perna.id,
            );

          if (pernaError)
            throw pernaError;

          /* --------------------------------------------------
             SOLICITAÇÃO = POUSADO
          -------------------------------------------------- */

          const {
            error:
              vooError,
          } = await sb
            .from(
              "solicitacoes_reserva_voo",
            )
            .update({
              status:
                "pousado",

              data_partida:
                dataPerna,

              horario_pouso:
                TIME_SUFFIX(
                  horarioPouso,
                ),

              horario_corte:
                corteIso,
            })
            .eq(
              "id",
              solicitacao.id,
            );

          if (vooError)
            throw vooError;

          /* --------------------------------------------------
             AERONAVE EM SOLO
          -------------------------------------------------- */

          if (
            solicitacao.aeronave_id
          ) {
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
            `Perna ${perna.numero_perna} pousada às ${horarioPouso}, corte às ${horarioCorte}. Jornada permanece aberta.`,
          );

          return {
            perna,
            podeContinuar:
              true,
          };
        },

      onSuccess:
        () => {
          toast.success(
            "Pouso registrado. A jornada continua aberta.",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao registrar pouso",
          ),
    });

  /* ==========================================================
     ENCERRAR JORNADA
  ========================================================== */

  const encerrarJornada =
    useMutation({
      mutationFn:
        async ({
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
          const {
            data: userData,
          } =
            await supabase.auth.getUser();

          const userId =
            userData
              ?.user?.id ??
            null;

          if (
            jornada.status !==
            "aberta"
          ) {
            throw new Error(
              "Esta jornada já foi encerrada.",
            );
          }

          if (
            !horarioCorte
          ) {
            throw new Error(
              "Informe o corte final dos motores.",
            );
          }

          /* --------------------------------------------------
             CÁLCULO DO FIM DA JORNADA
          -------------------------------------------------- */

          const corte =
            normalizarDateTimeUtc(
              dataPerna,
              horarioCorte,
            );

          const fimJornada =
            addMinutes(
              corte,
              jornada.minutos_pos_corte,
            );

          const {
            data:
              jornadaEncerrada,
            error:
              jornadaError,
          } = await sb
            .from(
              "jornadas_voo",
            )
            .update({
              fim_em:
                fimJornada.toISOString(),

              status:
                "encerrada",

              atualizado_em:
                new Date().toISOString(),
            })
            .eq(
              "id",
              jornada.id,
            )
            .eq(
              "status",
              "aberta",
            )
            .select("*")
            .single();

          if (jornadaError)
            throw jornadaError;

          /* --------------------------------------------------
             ÚLTIMA PERNA
          -------------------------------------------------- */

          const {
            data:
              ultimaPerna,
            error:
              ultimaPernaError,
          } = await sb
            .from(
              "pernas_voo",
            )
            .select(
              "id, numero_perna, origem, destino, data_perna, horario_pouso, horario_corte",
            )
            .eq(
              "solicitacao_id",
              solicitacao.id,
            )
            .order(
              "numero_perna",
              {
                ascending:
                  false,
              },
            )
            .limit(1)
            .maybeSingle();

          if (
            ultimaPernaError
          ) {
            throw ultimaPernaError;
          }

          if (!ultimaPerna) {
            throw new Error(
              "Não foi encontrada nenhuma perna para encerrar a jornada.",
            );
          }

          /* --------------------------------------------------
             VERIFICA SE É A JORNADA FINAL DA VIAGEM
          -------------------------------------------------- */

          const dias =
            Math.max(
              1,
              solicitacao.dias_duracao ??
                1,
            );

          const dataFinal =
            iso(
              addDays(
                parseISO(
                  solicitacao.data_agendada,
                ),
                dias - 1,
              ),
            );

          const chegouNaBase =
            (
              solicitacao.origem ??
              ""
            )
              .trim()
              .toUpperCase() ===
            (
              ultimaPerna.destino ??
              ""
            )
              .trim()
              .toUpperCase();

          const finalDaViagem =
            ultimaPerna.data_perna >=
              dataFinal &&
            chegouNaBase;

          /* --------------------------------------------------
             SE NÃO É A ÚLTIMA:
             A VIAGEM CONTINUA
          -------------------------------------------------- */

          if (!finalDaViagem) {
            await registrarHistoricoStatus(
              solicitacao.id,
              solicitacao.status,
              "pousado",
              userId,
              `Jornada ${jornada.numero_jornada} encerrada. Fim da jornada: ${formatarHora(
                jornadaEncerrada.fim_em,
              )}. Próxima jornada será iniciada com nova apresentação.`,
            );

            return {
              finalDaViagem:
                false,
              jornada:
                jornadaEncerrada as JornadaVoo,
            };
          }

          /* --------------------------------------------------
             ÚLTIMA JORNADA
          -------------------------------------------------- */

          const {
            error:
              vooError,
          } = await sb
            .from(
              "solicitacoes_reserva_voo",
            )
            .update({
              status:
                "concluido",

              horario_corte:
                ultimaPerna.horario_corte,
            })
            .eq(
              "id",
              solicitacao.id,
            );

          if (vooError)
            throw vooError;

          /* --------------------------------------------------
             AERONAVE DISPONÍVEL
          -------------------------------------------------- */

          if (
            solicitacao.aeronave_id
          ) {
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
          }

          /* --------------------------------------------------
             CICLO CONCLUÍDO
          -------------------------------------------------- */

          if (
            solicitacao.ciclo_voo_id
          ) {
            const {
              error:
                cicloError,
            } = await sb
              .from(
                "ciclos_voo",
              )
              .update({
                status:
                  "concluido",

                concluido_em:
                  new Date().toISOString(),
              })
              .eq(
                "id",
                solicitacao.ciclo_voo_id,
              );

            if (
              cicloError
            ) {
              console.warn(
                "Erro ao concluir ciclo:",
                cicloError,
              );
            }
          }

          /* --------------------------------------------------
             ESCALA CONCLUÍDA
          -------------------------------------------------- */

          await sb
            .from(
              "escala_tripulacao",
            )
            .update({
              status:
                "concluido",
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
            `Última jornada encerrada às ${formatarHora(
              jornadaEncerrada.fim_em,
            )}. Viagem concluída.`,
          );

          return {
            finalDaViagem:
              true,

            jornada:
              jornadaEncerrada as JornadaVoo,
          };
        },

      onSuccess:
        ({
          finalDaViagem,
        }) => {
          toast.success(
            finalDaViagem
              ? "Viagem concluída"
              : "Jornada encerrada. A próxima jornada será iniciada com nova apresentação.",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao encerrar jornada",
          ),
    });

  /* ==========================================================
     ADICIONAR PERNA
  ========================================================== */

  const adicionarPerna =
    useMutation({
      mutationFn:
        async ({
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

          qtdPassageiros?:
            | number
            | null;

          observacoes?:
            | string
            | null;
        }) => {
          const {
            data:
              ultimaPerna,
            error:
              ultimaPernaError,
          } = await sb
            .from(
              "pernas_voo",
            )
            .select(
              "numero_perna",
            )
            .eq(
              "solicitacao_id",
              solicitacao.id,
            )
            .order(
              "numero_perna",
              {
                ascending:
                  false,
              },
            )
            .limit(1)
            .maybeSingle();

          if (
            ultimaPernaError
          ) {
            throw ultimaPernaError;
          }

          const numero =
            (
              ultimaPerna?.numero_perna ??
              0
            ) + 1;

          const perna: PernaVooInsert =
            {
              solicitacao_id:
                solicitacao.id,

              numero_perna:
                numero,

              data_perna:
                dataPerna,

              origem:
                origem
                  .toUpperCase()
                  .trim(),

              destino:
                destino
                  .toUpperCase()
                  .trim(),

              horario_acionamento:
                null,

              horario_decolagem:
                null,

              horario_pouso:
                null,

              horario_corte:
                null,

              qtd_passageiros:
                qtdPassageiros ??
                solicitacao.qtd_passageiros ??
                1,

              observacoes:
                observacoes ??
                null,

              numero_voo:
                solicitacao.numero_voo ??
                null,

              jornada_id:
                null,
            } as PernaVooInsert;

          const {
            data,
            error:
              insertError,
          } = await sb
            .from(
              "pernas_voo",
            )
            .insert(
              perna,
            )
            .select("*")
            .single();

          if (
            insertError
          ) {
            throw insertError;
          }

          return data as PernaVoo;
        },

      onSuccess:
        (perna) => {
          toast.success(
            `Perna ${perna.numero_perna} criada`,
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao criar nova perna",
          ),
    });

  /* ==========================================================
     ADICIONAR ESCALA
  ========================================================== */

  const adicionarEscala =
    useMutation({
      mutationFn:
        async (payload: {
          membro_id: string;

          aeronave_id?:
            | string
            | null;

          solicitacao_id?:
            | string
            | null;

          funcao: string;

          data_inicio: string;

          data_fim: string;

          status?: string;

          observacoes?:
            | string
            | null;
        }) => {
          const {
            data:
              userData,
          } =
            await supabase.auth.getUser();

          const {
            data,
            error,
          } = await sb
            .from(
              "escala_tripulacao",
            )
            .insert({
              membro_id:
                payload.membro_id,

              aeronave_id:
                payload.aeronave_id ??
                null,

              solicitacao_id:
                payload.solicitacao_id ??
                null,

              funcao:
                payload.funcao,

              data_inicio:
                payload.data_inicio,

              data_fim:
                payload.data_fim,

              status:
                payload.status ??
                "escalado",

              observacoes:
                payload.observacoes ??
                null,

              criado_por:
                userData
                  ?.user?.id ??
                null,
            })
            .select("*")
            .single();

          if (error)
            throw error;

          return data;
        },

      onSuccess:
        () => {
          toast.success(
            "Tripulante escalado com sucesso",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao criar escala",
          ),
    });

  /* ==========================================================
     EXCLUIR ESCALA
  ========================================================== */

  const excluirEscala =
    useMutation({
      mutationFn:
        async (
          escalaId: string,
        ) => {
          const {
            error,
          } = await sb
            .from(
              "escala_tripulacao",
            )
            .delete()
            .eq(
              "id",
              escalaId,
            );

          if (error)
            throw error;
        },

      onSuccess:
        () => {
          toast.success(
            "Escala removida",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao remover escala",
          ),
    });

  /* ==========================================================
     ALIAS PARA COMPATIBILIDADE
  ========================================================== */

  const removerEscala =
    excluirEscala;

  /* ==========================================================
     ALTERAR STATUS
  ========================================================== */

  const alterarStatusVoo =
    useMutation({
      mutationFn:
        async ({
          solicitacao,
          status,
        }: {
          solicitacao: Solicitacao;

          status:
            | SolicitacaoStatus;
        }) => {
          const {
            data:
              userData,
          } =
            await supabase.auth.getUser();

          const userId =
            userData
              ?.user?.id ??
            null;

          const {
            error,
          } = await sb
            .from(
              "solicitacoes_reserva_voo",
            )
            .update({
              status,
            })
            .eq(
              "id",
              solicitacao.id,
            );

          if (error)
            throw error;

          await registrarHistoricoStatus(
            solicitacao.id,
            solicitacao.status,
            status,
            userId,
          );

          if (
            status ===
            "cancelado"
          ) {
            await sb
              .from(
                "escala_tripulacao",
              )
              .delete()
              .eq(
                "solicitacao_id",
                solicitacao.id,
              );
          }

          if (
            status ===
            "concluido"
          ) {
            if (
              solicitacao.aeronave_id
            ) {
              await upsertStatusAeronave(
                solicitacao.aeronave_id,
                "disponivel",
                null,
                {
                  localizacao_atual:
                    solicitacao.destino ??
                    null,
                },
              );
            }

            await sb
              .from(
                "escala_tripulacao",
              )
              .update({
                status:
                  "concluido",
              })
              .eq(
                "solicitacao_id",
                solicitacao.id,
              );
          }
        },

      onSuccess:
        () => {
          toast.success(
            "Status atualizado",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao alterar status",
          ),
    });

  /* ==========================================================
     EXCLUIR SOLICITAÇÃO
  ========================================================== */

  const excluirSolicitacao =
    useMutation({
      mutationFn:
        async (
          solicitacao: Solicitacao,
        ) => {
          if (
            ![
              "cancelado",
              "rejeitado",
            ].includes(
              solicitacao.status,
            )
          ) {
            throw new Error(
              "Somente solicitações canceladas ou rejeitadas podem ser excluídas.",
            );
          }

          if (
            solicitacao.aeronave_id
          ) {
            await sb
              .from(
                "datas_bloqueadas_voo",
              )
              .delete()
              .eq(
                "aeronave_id",
                solicitacao.aeronave_id,
              )
              .gte(
                "data_bloqueio",
                solicitacao.data_agendada,
              );

            await sb
              .from(
                "escala_tripulacao",
              )
              .delete()
              .eq(
                "solicitacao_id",
                solicitacao.id,
              );
          }

          const {
            error,
          } = await sb
            .from(
              "solicitacoes_reserva_voo",
            )
            .delete()
            .eq(
              "id",
              solicitacao.id,
            );

          if (error)
            throw error;
        },

      onSuccess:
        () => {
          toast.success(
            "Voo excluído",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao excluir voo",
          ),
    });

  /* ==========================================================
     DEFINIR STATUS AERONAVE
  ========================================================== */

  const definirStatusAeronave =
    useMutation({
      mutationFn:
        async ({
          aeronaveId,
          status,
        }: {
          aeronaveId: string;
          status: string;
        }) => {
          await upsertStatusAeronave(
            aeronaveId,
            status,
            null,
          );

          const {
            error,
          } = await sb
            .from(
              "aeronave",
            )
            .update({
              status:
                status ===
                "manutencao"
                  ? "manutencao"
                  : "ativa",
            })
            .eq(
              "id",
              aeronaveId,
            );

          if (error)
            throw error;
        },

      onSuccess:
        () => {
          toast.success(
            "Situação da aeronave atualizada",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao atualizar aeronave",
          ),
    });

  /* ==========================================================
     CONFIGURAÇÃO DE AGENDAMENTO
  ========================================================== */

  const definirAgendamentoHabilitado =
    useMutation({
      mutationFn:
        async ({
          aeronaveId,
          habilitado,
        }: {
          aeronaveId: string;

          habilitado: boolean;
        }) => {
          const {
            data:
              userData,
          } =
            await supabase.auth.getUser();

          const {
            error,
          } = await sb
            .from(
              "config_agendamento_aeronave",
            )
            .upsert(
              {
                aeronave_id:
                  aeronaveId,

                habilitado_agendamento:
                  habilitado,

                atualizado_em:
                  new Date().toISOString(),

                atualizado_por:
                  userData
                    ?.user?.id ??
                  null,
              },
              {
                onConflict:
                  "aeronave_id",
              },
            );

          if (error)
            throw error;
        },

      onSuccess:
        (
          _,
          vars,
        ) => {
          toast.success(
            vars.habilitado
              ? "Aeronave liberada para agendamento"
              : "Aeronave bloqueada para agendamento",
          );

          qc.invalidateQueries(
            {
              queryKey: [
                "agv",
                "config-agendamento",
              ],
            },
          );
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao atualizar configuração",
          ),
    });

  /* ==========================================================
     CRIAR ESCALA COMPATIBILIDADE
  ========================================================== */

  const criarEscala =
    useMutation({
      mutationFn:
        async (
          payload: Partial<EscalaItem>,
        ) => {
          const {
            data:
              userData,
          } =
            await supabase.auth.getUser();

          const {
            error,
          } = await sb
            .from(
              "escala_tripulacao",
            )
            .insert({
              ...payload,

              criado_por:
                userData
                  ?.user?.id ??
                null,
            });

          if (error)
            throw error;
        },

      onSuccess:
        () => {
          toast.success(
            "Escala salva",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao salvar escala",
          ),
    });

  /* ==========================================================
     REMOVER ESCALA COMPATIBILIDADE
  ========================================================== */

  const removerEscalaMutation =
    useMutation({
      mutationFn:
        async (
          id: string,
        ) => {
          const {
            error,
          } = await sb
            .from(
              "escala_tripulacao",
            )
            .delete()
            .eq(
              "id",
              id,
            );

          if (error)
            throw error;
        },

      onSuccess:
        () => {
          toast.success(
            "Escala removida",
          );

          invalidate();
        },

      onError:
        (e: any) =>
          toast.error(
            e.message ??
              "Erro ao remover escala",
          ),
    });

  /* ==========================================================
     RETORNO
  ========================================================== */

  return {
    criarSolicitacao,

    atualizarSolicitacao,

    adicionarPerna,

    aprovar,

    confirmarVoo,

    escalarTripulacao,

    rejeitar,

    alterarStatusVoo,

    iniciarVoo,

    registrarPousoPerna,

    encerrarJornada,

    definirStatusAeronave,

    definirAgendamentoHabilitado,

    criarEscala,

    removerEscala,

    removerEscalaMutation,

    excluirEscala,

    excluirSolicitacao,
  };
}