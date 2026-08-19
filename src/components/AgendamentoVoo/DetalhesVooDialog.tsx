import { useMemo, useState } from "react";
import {
  useNavigate,
} from "react-router-dom";

import {
  format,
  parseISO,
} from "date-fns";

import { ptBR } from "date-fns/locale";

import {
  useQuery,
} from "@tanstack/react-query";

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Pencil,
  Plus,
  PlaneTakeoff,
  Trash2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Label } from "@/components/ui/label";

import {
  JornadaVoo,
  Solicitacao,
  SolicitacaoStatus,
  useAgendamentoMutations,
  useJornadasVoo,
  usePernasVoo,
  useTripulantes,
} from "@/hooks/useAgendamentoVoo";

import { supabase } from "@/integrations/supabase/client";

import { EditarAgendamentoDialog } from "./EditarAgendamentoDialog";
import { NovaPernaDialog } from "./NovaPernaDialog";
import { IniciarVooDialog } from "./IniciarVooDialog";

import {
  usePreVooChecklist,
} from "@/hooks/usePreVooChecklist";
import { cn } from "@/lib/utils";

/* ==========================================================================
   PROPS
========================================================================== */

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (
    open: boolean,
  ) => void;
}

/* ==========================================================================
   HISTÓRICO
========================================================================== */

interface StatusHistory {
  status_anterior:
    | string
    | null;

  status_novo: string;

  alterado_por:
    | string
    | null;

  atualizado_em:
    | string
    | null;

  observacao:
    | string
    | null;
}

/* ==========================================================================
   STATUS
========================================================================== */

function statusLabel(
  status: string,
  voo?: Solicitacao,
) {
  if (
    voo?.status ===
    "concluido"
  ) {
    return "Concluído";
  }

  switch (status) {
    case "pendente":
      return "Pendente";

    case "confirmado":
      return "Agendado";

    case "em_rota":
    case "em_voo":
      return "Em Voo";

    case "pouso":
    case "pousado":
      return "Pousado";

    case "concluido":
      return "Concluído";

    case "rejeitado":
      return "Rejeitado";

    case "cancelado":
      return "Cancelado";

    default:
      return status
        .split("_")
        .map(
          (p) =>
            p.charAt(0).toUpperCase() +
            p.slice(1),
        )
        .join(" ");
  }
}

/* ==========================================================================
   FORMATAÇÃO
========================================================================== */

function formatarHora(
  value?:
    | string
    | null,
) {
  if (!value) {
    return "--:--";
  }

  if (
    value.includes("T")
  ) {
    return value.slice(
      11,
      16,
    );
  }

  return value.slice(
    0,
    5,
  );
}

/* ==========================================================================
   COMPONENTE
========================================================================== */

export function DetalhesVooDialog({
  voo,
  open,
  onOpenChange,
}: Props) {
  const {
    alterarStatusVoo,
    excluirSolicitacao,
  } =
    useAgendamentoMutations();

  const navigate =
    useNavigate();

  const {
    data: tripulantes = [],
    isLoading:
      tripulantesLoading,
  } =
    useTripulantes();

  const [
    editarAberto,
    setEditarAberto,
  ] = useState(false);

  const [
    exclusaoAberta,
    setExclusaoAberta,
  ] = useState(false);

  const [
    pernaAberta,
    setPernaAberta,
  ] = useState(false);

  const [
    iniciarAberto,
    setIniciarAberto,
  ] = useState(false);

  /* ==========================================================================
     PERNAS
  ========================================================================== */

  const {
    data: pernas = [],
  } =
    usePernasVoo(
      open
        ? voo?.id
        : null,
    );

  /* ==========================================================================
     JORNADAS
  ========================================================================== */

  const {
    data: jornadas = [],
  } =
    useJornadasVoo(
      open
        ? voo?.id
        : null,
    );

  /* ==========================================================================
     PRÉ-VOO
  ========================================================================== */

  const {
    data:
      checklistPreVoo,
  } =
    usePreVooChecklist(
      open
        ? voo?.id
        : null,
    );

  /* ==========================================================================
     HISTÓRICO
  ========================================================================== */

  const {
    data: history = [],
    isLoading:
      historyLoading,
  } =
    useQuery<
      StatusHistory[]
    >({
      queryKey: [
        "historico-status",
        voo?.id,
      ],

      queryFn:
        async (): Promise<
          StatusHistory[]
        > => {
          const {
            data,
            error,
          } =
            await supabase
              .from(
                "historico_status_solicitacao",
              )
              .select(
                "status_anterior, status_novo, alterado_por, atualizado_em, observacao",
              )
              .eq(
                "solicitacao_id",
                voo!.id,
              )
              .order(
                "atualizado_em",
                {
                  ascending:
                    false,
                },
              );

          if (error)
            throw error;

          return (
            data ??
            []
          ) as StatusHistory[];
        },

      enabled:
        !!voo?.id &&
        open,
    });

  /* ==========================================================================
     AUTORES
  ========================================================================== */

  const autorIds =
    [
      ...new Set(
        history
          .map(
            (h) =>
              h.alterado_por,
          )
          .filter(
            Boolean,
          ),
      ),
    ] as string[];

  const {
    data: autores = {},
  } =
    useQuery<
      Record<
        string,
        string
      >
    >({
      queryKey: [
        "historico-status-autores",
        autorIds
          .slice()
          .sort()
          .join(","),
      ],

      enabled:
        autorIds.length >
        0,

      queryFn:
        async () => {
          const {
            data,
            error,
          } =
            await supabase
              .from(
                "user_profiles",
              )
              .select(
                "id, full_name, display_name, email",
              )
              .in(
                "id",
                autorIds,
              );

          if (error)
            throw error;

          return Object.fromEntries(
            (
              data ??
              []
            ).map(
              (
                u: any,
              ) => [
                u.id,
                u.display_name ||
                  u.full_name ||
                  u.email ||
                  "Usuário",
              ],
            ),
          );
        },
    });

  /* ==========================================================================
     DERIVAÇÕES
  ========================================================================== */

  const pernasOrdenadas =
    useMemo(
      () =>
        [...pernas].sort(
          (a, b) =>
            a.numero_perna -
            b.numero_perna,
        ),
      [pernas],
    );

  const jornadasOrdenadas =
    useMemo(
      () =>
        [...jornadas].sort(
          (a, b) =>
            a.numero_jornada -
            b.numero_jornada,
        ),
      [jornadas],
    );

  const jornadaAberta =
    jornadasOrdenadas.find(
      (j) =>
        j.status ===
        "aberta",
    ) ?? null;

  const ultimaJornada =
    jornadasOrdenadas[
      jornadasOrdenadas.length -
        1
    ] ?? null;

  const temPouso =
    Boolean(
      voo?.horario_pouso,
    );

  const preVooConcluido =
    checklistPreVoo?.status ===
    "concluido";

  const podeEditar =
    !!voo &&
    ![
      "concluido",
      "cancelado",
      "rejeitado",
    ].includes(
      voo.status,
    );

  const nomeTripulante = (
    id:
      | string
      | null,
  ) => {
    if (!id) {
      return "Não informado";
    }

    if (
      tripulantesLoading
    ) {
      return "Carregando...";
    }

    return (
      tripulantes.find(
        (
          tripulante,
        ) =>
          tripulante.id ===
          id,
      )?.nome_completo ??
      "Tripulante não encontrado"
    );
  };

  /* ==========================================================================
     STATUS
  ========================================================================== */

  const handleStatusUpdate =
    (
      novoStatus: SolicitacaoStatus,
    ) => {
      if (!voo) return;

      alterarStatusVoo.mutate(
        {
          solicitacao:
            voo,

          status:
            novoStatus,
        },
      );
    };

  if (!voo) {
    return null;
  }

  /* ==========================================================================
     RENDER
  ========================================================================== */

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={
          onOpenChange
        }
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-3xl">

          <DialogHeader>

            <DialogTitle className="flex flex-wrap items-center gap-2">
              <PlaneTakeoff className="h-5 w-5 text-primary" />

              Detalhes do Voo

              {voo.numero_voo && (
                <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                  {voo.numero_voo}
                </span>
              )}
            </DialogTitle>

            <DialogDescription>
              {voo.aeronave
                ?.matricula ??
                "Aeronave"}{" "}
              ·{" "}
              {voo.origem ??
                "—"}{" "}
              →{" "}
              {voo.destino ??
                "—"}
            </DialogDescription>

          </DialogHeader>

          <div className="grid gap-4 py-4">

            {/* ================================================================
                STATUS / CLIENTE
            ================================================================ */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              <div className="rounded-xl border border-border bg-background/80 p-4">

                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Status da viagem
                </p>

                <Badge className="mt-2 bg-primary/10 text-primary">
                  {statusLabel(
                    voo.status,
                    voo,
                  )}
                </Badge>

              </div>

              <div className="rounded-xl border border-border bg-background/80 p-4">

                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Cliente
                </p>

                <p className="mt-2 text-sm text-foreground">
                  {voo.cliente_nome ??
                    "Cliente não informado"}
                </p>

              </div>
            </div>

            {/* ================================================================
                AGENDAMENTO / EXECUÇÃO
            ================================================================ */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              <div className="rounded-xl border border-border bg-background/80 p-4">

                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Agendamento
                </p>

                <p className="mt-2 text-sm text-foreground">
                  {format(
                    parseISO(
                      voo.data_agendada,
                    ),
                    "dd/MM/yyyy",
                    {
                      locale:
                        ptBR,
                    },
                  )}

                  <br />

                  {voo.horario_previsto_agendamento?.slice(
                    0,
                    5,
                  ) ??
                    "--:--"}{" "}
                  UTC
                </p>

              </div>

              <div className="rounded-xl border border-border bg-background/80 p-4">

                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Execução da última perna
                </p>

                <p className="mt-2 text-sm text-foreground">

                  {voo.data_partida
                    ? format(
                        parseISO(
                          voo.data_partida,
                        ),
                        "dd/MM/yyyy",
                        {
                          locale:
                            ptBR,
                        },
                      )
                    : "—"}

                  <br />

                  AC:{" "}
                  {formatarHora(
                    voo.horario_acionamento,
                  )}{" "}
                  UTC

                  <br />

                  DEP:{" "}
                  {formatarHora(
                    voo.horario_decolagem,
                  )}{" "}
                  UTC

                  {voo.horario_pouso && (
                    <>
                      <br />

                      ARR:{" "}
                      {formatarHora(
                        voo.horario_pouso,
                      )}{" "}
                      UTC
                    </>
                  )}

                  {voo.horario_corte && (
                    <>
                      <br />

                      CORT:{" "}
                      {formatarHora(
                        voo.horario_corte,
                      )}{" "}
                      UTC
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* ================================================================
                TRIPULAÇÃO
            ================================================================ */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

              <div className="min-w-0 rounded-xl border border-border bg-background/80 p-4">

                <Label className="text-xs text-muted-foreground">
                  Piloto
                </Label>

                <p className="mt-1 break-words text-sm text-foreground">
                  {nomeTripulante(
                    voo.piloto_id,
                  )}
                </p>

              </div>

              <div className="min-w-0 rounded-xl border border-border bg-background/80 p-4">

                <Label className="text-xs text-muted-foreground">
                  Copiloto
                </Label>

                <p className="mt-1 break-words text-sm text-foreground">
                  {nomeTripulante(
                    voo.copiloto_id,
                  )}
                </p>

              </div>

              <div className="rounded-xl border border-border bg-background/80 p-4">

                <Label className="text-xs text-muted-foreground">
                  Passageiros
                </Label>

                <p className="mt-1 text-sm text-foreground">
                  {voo.qtd_passageiros ??
                    1}
                </p>

              </div>
            </div>

            {/* ================================================================
                JORNADAS
            ================================================================ */}

            <div className="rounded-xl border border-border bg-background/80 p-4">

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Jornadas de trabalho
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Cada apresentação inicia uma nova jornada.
                  </p>
                </div>

                {jornadaAberta && (
                  <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-400">
                    Jornada{" "}
                    {
                      jornadaAberta.numero_jornada
                    }{" "}
                    aberta
                  </Badge>
                )}
              </div>

              {jornadasOrdenadas.length ===
              0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">

                  <CalendarClock className="mx-auto h-5 w-5 text-muted-foreground" />

                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhuma jornada iniciada.
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    A jornada será criada quando a tripulação se apresentar e iniciar a primeira perna.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">

                  {jornadasOrdenadas.map(
                    (
                      jornada,
                    ) => {

                      const cor =
                        jornada.status ===
                        "aberta"
                          ? "border-amber-500/30 bg-amber-500/5"
                          : jornada.status ===
                              "encerrada"
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : "border-border bg-background/40";

                      return (
                        <div
                          key={
                            jornada.id
                          }
                          className={cn(
                            "rounded-lg border p-3",
                            cor,
                          )}
                        >

                          <div className="flex flex-wrap items-start justify-between gap-3">

                            <div>

                              <p className="text-sm font-semibold text-foreground">
                                Jornada{" "}
                                {
                                  jornada.numero_jornada
                                }
                              </p>

                              <p className="text-xs text-muted-foreground">
                                {format(
                                  parseISO(
                                    jornada.data_jornada,
                                  ),
                                  "dd/MM/yyyy",
                                  {
                                    locale:
                                      ptBR,
                                  },
                                )}
                              </p>

                            </div>

                            <Badge
                              className={
                                jornada.status ===
                                "aberta"
                                  ? "bg-amber-500/15 text-amber-400"
                                  : jornada.status ===
                                      "encerrada"
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-muted text-muted-foreground"
                              }
                            >
                              {jornada.status ===
                              "aberta"
                                ? "Aberta"
                                : jornada.status ===
                                    "encerrada"
                                  ? "Encerrada"
                                  : "Cancelada"}
                            </Badge>

                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">

                            <div>
                              <p className="text-muted-foreground">
                                Apresentação
                              </p>

                              <p className="mt-0.5 font-mono font-semibold text-foreground">
                                {formatarHora(
                                  jornada.apresentacao_em,
                                )}{" "}
                                UTC
                              </p>
                            </div>

                            <div>
                              <p className="text-muted-foreground">
                                Início
                              </p>

                              <p className="mt-0.5 font-mono font-semibold text-foreground">
                                {formatarHora(
                                  jornada.inicio_em,
                                )}{" "}
                                UTC
                              </p>
                            </div>

                            <div>
                              <p className="text-muted-foreground">
                                Fim
                              </p>

                              <p className="mt-0.5 font-mono font-semibold text-foreground">
                                {jornada.fim_em
                                  ? `${formatarHora(
                                      jornada.fim_em,
                                    )} UTC`
                                  : "Em andamento"}
                              </p>
                            </div>

                            <div>
                              <p className="text-muted-foreground">
                                Pós-corte
                              </p>

                              <p className="mt-0.5 font-mono font-semibold text-foreground">
                                {
                                  jornada.minutos_pos_corte
                                }{" "}
                                min
                              </p>
                            </div>

                          </div>

                          {jornada.fim_em && (
                            <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">

                              <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />

                              <span className="text-muted-foreground">
                                A jornada terminou após o corte regulamentar.
                              </span>

                              <span className="font-mono font-semibold text-foreground">
                                {formatarHora(
                                  jornada.fim_em,
                                )}{" "}
                                UTC
                              </span>

                            </div>
                          )}

                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            {/* ================================================================
                PERNAS
            ================================================================ */}

            <div className="rounded-xl border border-border bg-background/80 p-4">

              <div className="flex flex-wrap items-center justify-between gap-2">

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Pernas de voo
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    O pouso encerra a perna, não necessariamente a jornada.
                  </p>
                </div>

                {voo.status !==
                  "concluido" &&
                  voo.status !==
                    "cancelado" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPernaAberta(
                          true,
                        )
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />

                      Nova perna
                    </Button>
                  )}
              </div>

              {pernasOrdenadas.length ===
              0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nenhuma perna registrada ainda.
                </p>
              ) : (
                <div className="mt-3 space-y-2">

                  {pernasOrdenadas.map(
                    (p) => {

                      const jornada =
                        p.jornada_id
                          ? jornadasOrdenadas.find(
                              (
                                j,
                              ) =>
                                j.id ===
                                p.jornada_id,
                            )
                          : null;

                      const completa =
                        Boolean(
                          p.horario_pouso &&
                            p.horario_corte,
                        );

                      return (
                        <div
                          key={p.id}
                          className={cn(
                            "rounded-lg border bg-background/50 p-3",
                            completa
                              ? "border-emerald-500/20"
                              : "border-amber-500/20",
                          )}
                        >

                          <div className="flex flex-wrap items-start justify-between gap-3">

                            <div>

                              <p className="font-medium text-foreground">
                                #{p.numero_perna} ·{" "}
                                {p.origem}{" "}
                                →{" "}
                                {p.destino}
                              </p>

                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {p.data_perna
                                  ? format(
                                      parseISO(
                                        p.data_perna,
                                      ),
                                      "dd/MM/yyyy",
                                      {
                                        locale:
                                          ptBR,
                                      },
                                    )
                                  : "—"}

                                {jornada
                                  ? ` · Jornada ${jornada.numero_jornada}`
                                  : ""}
                              </p>

                            </div>

                            <Badge
                              className={
                                completa
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-amber-500/15 text-amber-400"
                              }
                            >
                              {completa
                                ? "Pousada"
                                : p.horario_decolagem
                                  ? "Em rota"
                                  : "Não iniciada"}
                            </Badge>

                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">

                            <div>
                              <p className="text-muted-foreground">
                                AC
                              </p>

                              <p className="font-mono font-semibold text-foreground">
                                {formatarHora(
                                  p.horario_acionamento,
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-muted-foreground">
                                DEP
                              </p>

                              <p className="font-mono font-semibold text-foreground">
                                {formatarHora(
                                  p.horario_decolagem,
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-muted-foreground">
                                ARR
                              </p>

                              <p className="font-mono font-semibold text-foreground">
                                {formatarHora(
                                  p.horario_pouso,
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-muted-foreground">
                                CORT
                              </p>

                              <p className="font-mono font-semibold text-foreground">
                                {formatarHora(
                                  p.horario_corte,
                                )}
                              </p>
                            </div>

                          </div>

                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            {/* ================================================================
                OBSERVAÇÕES
            ================================================================ */}

            {(voo.observacoes ||
              voo.motivo_rejeicao) && (
              <div className="space-y-2 rounded-xl border border-border bg-background/80 p-4">

                {voo.observacoes && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Observações
                    </Label>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {
                        voo.observacoes
                      }
                    </p>
                  </div>
                )}

                {voo.motivo_rejeicao && (
                  <div>
                    <Label className="text-xs text-destructive">
                      Motivo de Rejeição/Cancelamento
                    </Label>

                    <p className="mt-1 text-sm text-destructive/90">
                      {
                        voo.motivo_rejeicao
                      }
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ================================================================
                HISTÓRICO
            ================================================================ */}

            <div className="rounded-xl border border-border bg-background/80 p-4">

              <div className="flex items-center justify-between">

                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Histórico de status
                </p>

                {historyLoading && (
                  <span className="text-[11px] text-muted-foreground">
                    Carregando...
                  </span>
                )}

              </div>

              {history.length ===
              0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhuma alteração registrada ainda.
                </p>
              ) : (
                <div className="mt-3 max-h-56 space-y-3 overflow-y-auto">

                  {history.map(
                    (
                      item,
                      index,
                    ) => (
                      <div
                        key={
                          `${item.atualizado_em ?? "hist"}-${index}`
                        }
                        className="rounded-lg border border-border bg-background/50 p-3"
                      >

                        <div className="flex flex-col gap-1 text-[11px] uppercase text-muted-foreground sm:flex-row sm:items-center sm:justify-between">

                          <span>
                            {item.atualizado_em
                              ? format(
                                  parseISO(
                                    item.atualizado_em,
                                  ),
                                  "dd/MM/yyyy HH:mm",
                                  {
                                    locale:
                                      ptBR,
                                  },
                                )
                              : "—"}
                          </span>

                          <span className="sm:text-right">
                            {item.alterado_por
                              ? autores[
                                  item.alterado_por
                                ] ??
                                "Usuário"
                              : "Sistema"}
                          </span>

                        </div>

                        <p className="mt-1 text-sm text-foreground">

                          {item.status_anterior
                            ? `${statusLabel(
                                item.status_anterior,
                              )} → `
                            : ""}

                          <strong>
                            {statusLabel(
                              item.status_novo,
                              voo,
                            )}
                          </strong>

                        </p>

                        {item.observacao && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {
                              item.observacao
                            }
                          </p>
                        )}

                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            {/* ================================================================
                AÇÕES
            ================================================================ */}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

              <Button
                variant="outline"
                onClick={() =>
                  onOpenChange(
                    false,
                  )
                }
              >
                Fechar
              </Button>

              {podeEditar && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    setEditarAberto(
                      true,
                    )
                  }
                >
                  <Pencil className="mr-1 h-4 w-4" />

                  Editar agendamento
                </Button>
              )}

              {voo.status ===
                "confirmado" && (
                <Button
                  variant={
                    preVooConcluido
                      ? "outline"
                      : "default"
                  }
                  onClick={() => {
                    onOpenChange(
                      false,
                    );

                    navigate(
                      `/pre-voo/${voo.id}`,
                    );
                  }}
                >
                  <ClipboardCheck className="mr-1 h-4 w-4" />

                  {preVooConcluido
                    ? "Ver pré-voo"
                    : "Iniciar Pré-Voo"}
                </Button>
              )}

              {voo.status ===
                "confirmado" &&
                preVooConcluido && (
                  <Button
                    onClick={() =>
                      setIniciarAberto(
                        true,
                      )
                    }
                  >
                    <PlaneTakeoff className="mr-1 h-4 w-4" />

                    Iniciar primeira perna
                  </Button>
                )}

              {voo.status ===
                "em_rota" && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    onOpenChange(
                      false,
                    );
                  }}
                >
                  <Clock3 className="mr-1 h-4 w-4" />

                  Registrar pouso / operação
                </Button>
              )}

              {voo.status ===
                "pousado" && (
                <Button
                  onClick={() =>
                    onOpenChange(
                      false,
                    )
                  }
                >
                  <CalendarClock className="mr-1 h-4 w-4" />

                  Continuar operação
                </Button>
              )}

              {podeEditar && (
                <Button
                  variant="destructive"
                  onClick={() =>
                    handleStatusUpdate(
                      "cancelado",
                    )
                  }
                  disabled={
                    alterarStatusVoo.isPending
                  }
                >
                  <XCircle className="mr-1 h-4 w-4" />

                  Cancelar voo
                </Button>
              )}

              {(voo.status ===
                "cancelado" ||
                voo.status ===
                  "rejeitado") && (
                <Button
                  variant="destructive"
                  onClick={() =>
                    setExclusaoAberta(
                      true,
                    )
                  }
                >
                  <Trash2 className="mr-1 h-4 w-4" />

                  Excluir voo
                </Button>
              )}

              {voo.status ===
                "concluido" && (
                <Button
                  disabled
                  variant="secondary"
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" />

                  Viagem concluída
                </Button>
              )}

            </div>

            {/* ================================================================
                STATUS OPERACIONAL
            ================================================================ */}

            {voo.status ===
              "pousado" &&
              !jornadaAberta &&
              ultimaJornada?.status ===
                "encerrada" && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">

                  <div className="flex items-center gap-2 font-semibold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />

                    Jornada encerrada
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    A jornada atual já foi encerrada. Para continuar a operação em outro dia, a tripulação deverá realizar uma nova apresentação.
                  </p>

                </div>
              )}

          </div>
        </DialogContent>
      </Dialog>

      {/* ==========================================================================
          EXCLUSÃO
      ========================================================================== */}

      <AlertDialog
        open={
          exclusaoAberta
        }
        onOpenChange={
          setExclusaoAberta
        }
      >
        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle className="flex items-center gap-2">

              <AlertTriangle className="h-5 w-5 text-destructive" />

              Excluir voo?

            </AlertDialogTitle>

            <AlertDialogDescription>
              Tem certeza que deseja excluir
              o voo{" "}

              <strong className="text-foreground">
                {voo.aeronave
                  ?.matricula ??
                  "—"}{" "}
                (
                {voo.origem ??
                  "—"}{" "}
                →
                {voo.destino ??
                  "—"}
                )
              </strong>
              ?

              <br />

              Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>
              Cancelar
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={() => {
                excluirSolicitacao.mutate(
                  voo,
                );

                setExclusaoAberta(
                  false,
                );

                onOpenChange(
                  false,
                );
              }}
              disabled={
                excluirSolicitacao.isPending
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluirSolicitacao.isPending
                ? "Excluindo..."
                : "Excluir"}
            </AlertDialogAction>

          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==========================================================================
          OUTROS DIALOGS
      ========================================================================== */}

      <EditarAgendamentoDialog
        voo={voo}
        open={
          editarAberto
        }
        onOpenChange={
          setEditarAberto
        }
      />

      <NovaPernaDialog
        voo={voo}
        open={
          pernaAberta
        }
        onOpenChange={
          setPernaAberta
        }
      />

      <IniciarVooDialog
        voo={voo}
        open={
          iniciarAberto
        }
        onOpenChange={
          setIniciarAberto
        }
      />
    </>
  );
}

export default DetalhesVooDialog;