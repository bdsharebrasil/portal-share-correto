import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import {
  PRE_VOO_SECTIONS,
  TOTAL_ITENS,
  type ChecklistItem,
} from "@/components/PreVoo/checklistStructure";

import {
  AbastecimentoPreVooDialog,
} from "@/components/PreVoo/AbastecimentoPreVooDialog";

import {
  DocumentosAeronaveDialog,
  docsCompletos,
} from "@/components/PreVoo/DocumentosAeronaveDialog";

import {
  usePreVooChecklist,
  usePreVooChecklistMutations,
  respostasVazias,
  type ChecklistRespostas,
} from "@/hooks/usePreVooChecklist";

import {
  ArrowLeft,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Circle,
  Droplets,
  Eye,
  FileCheck2,
  Fuel,
  Info,
  Loader2,
  Lock,
  Plane,
  Save,
  ShieldCheck,
  XCircle,
} from "lucide-react";

const db = supabase as any;

type ItemStatus = "feito" | "nao_feito" | "reporte";

type DraftData = {
  respostas: ChecklistRespostas;
  precisaAbastecer: boolean | null;
  abastecimentoId: string | null;
  observacoes: string;
  savedAt: number;
};

const getDraftKey = (id: string) => `prevoo-checklist-draft:${id}`;

export default function ChecklistPreVoo() {
  const { solicitacaoId } = useParams<{ solicitacaoId: string }>();
  const navigate = useNavigate();

  const { data: voo, isLoading: loadingVoo } = useQuery({
    queryKey: ["pre-voo-solicitacao", solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await db
        .from("solicitacoes_reserva_voo")
        .select(
          "*, aeronave:aeronave_id(id, matricula, modelo), clientes:cliente_id(razao_social)"
        )
        .eq("id", solicitacaoId)
        .maybeSingle();

      if (error) throw error;

      return data as any;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: checklist,
    isLoading: loadingChecklist,
  } = usePreVooChecklist(solicitacaoId);

  const { salvar } = usePreVooChecklistMutations();

  const [respostas, setRespostas] =
    useState<ChecklistRespostas>(respostasVazias);

  const [precisaAbastecer, setPrecisaAbastecer] =
    useState<boolean | null>(null);

  const [abastecimentoId, setAbastecimentoId] =
    useState<string | null>(null);

  const [observacoes, setObservacoes] = useState("");

  const [abastOpen, setAbastOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  const [colapsadas, setColapsadas] =
    useState<Record<string, boolean>>({});

  const [localDraftAvailable, setLocalDraftAvailable] =
    useState(false);

  const checklistIdRef = useRef<string | null>(null);
  const draftLoadedRef = useRef(false);

  const readOnly = checklist?.status === "concluido";

  /*
   * =========================================================
   * INICIALIZAÇÃO
   * =========================================================
   *
   * Muito importante:
   * não sincronizamos novamente toda vez que o React Query
   * fizer refetch. Isso impede que uma digitação seja apagada.
   */
  useEffect(() => {
    if (!checklist) return;

    if (checklistIdRef.current === checklist.id) return;

    checklistIdRef.current = checklist.id;

    setRespostas(checklist.respostas || respostasVazias);
    setPrecisaAbastecer(checklist.precisa_abastecer ?? null);
    setAbastecimentoId(checklist.abastecimento_id ?? null);
    setObservacoes(checklist.observacoes || "");

    // Recupera somente rascunho local mais recente.
    if (!draftLoadedRef.current && solicitacaoId && !readOnly) {
      draftLoadedRef.current = true;

      try {
        const raw = localStorage.getItem(getDraftKey(solicitacaoId));

        if (raw) {
          const draft = JSON.parse(raw) as DraftData;

          if (draft?.savedAt) {
            const serverTime = checklist.updated_at
              ? new Date(checklist.updated_at).getTime()
              : 0;

            if (draft.savedAt > serverTime) {
              setLocalDraftAvailable(true);
            }
          }
        }
      } catch {
        // Ignora erro de localStorage
      }
    }
  }, [checklist, solicitacaoId, readOnly]);

  /*
   * =========================================================
   * DADOS DE ABASTECIMENTO
   * =========================================================
   */
  const { data: abastecimento } = useQuery({
    queryKey: ["pre-voo-abastecimento", abastecimentoId],
    enabled: !!abastecimentoId,
    queryFn: async () => {
      const { data, error } = await db
        .from("abastecimentos")
        .select(
          "id, trecho, litros, valor_total, status, tipo_faturamento"
        )
        .eq("id", abastecimentoId)
        .maybeSingle();

      if (error) return null;

      return data as any;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  /*
   * =========================================================
   * RASCUNHO LOCAL
   * =========================================================
   *
   * Enquanto a pessoa digita, NÃO fazemos request para o servidor.
   * Apenas guardamos um pequeno rascunho local.
   *
   * Isso deixa o formulário fluido.
   */
  useEffect(() => {
    if (!solicitacaoId || readOnly) return;

    const timeout = window.setTimeout(() => {
      try {
        const hasData =
          Object.keys(respostas.itens || {}).length > 0 ||
          Object.keys(respostas.docs || {}).length > 0 ||
          precisaAbastecer !== null ||
          !!abastecimentoId ||
          !!observacoes.trim();

        if (!hasData) return;

        const draft: DraftData = {
          respostas,
          precisaAbastecer,
          abastecimentoId,
          observacoes,
          savedAt: Date.now(),
        };

        localStorage.setItem(
          getDraftKey(solicitacaoId),
          JSON.stringify(draft)
        );
      } catch {
        // localStorage pode estar indisponível
      }
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [
    solicitacaoId,
    readOnly,
    respostas,
    precisaAbastecer,
    abastecimentoId,
    observacoes,
  ]);

  const limparDraftLocal = () => {
    if (!solicitacaoId) return;

    localStorage.removeItem(getDraftKey(solicitacaoId));
    setLocalDraftAvailable(false);
  };

  const recuperarDraftLocal = () => {
    if (!solicitacaoId) return;

    try {
      const raw = localStorage.getItem(getDraftKey(solicitacaoId));

      if (!raw) return;

      const draft = JSON.parse(raw) as DraftData;

      setRespostas(draft.respostas || respostasVazias);
      setPrecisaAbastecer(draft.precisaAbastecer ?? null);
      setAbastecimentoId(draft.abastecimentoId ?? null);
      setObservacoes(draft.observacoes || "");

      setLocalDraftAvailable(false);

      toast.success("Rascunho recuperado");
    } catch {
      toast.error("Não foi possível recuperar o rascunho");
    }
  };

  /*
   * =========================================================
   * STATUS DOS ITENS
   * =========================================================
   */
  const statusOf = (
    item: ChecklistItem
  ): ItemStatus | null => {
    const r = respostas.itens?.[item.id];

    if (r?.status) return r.status;

    return r?.ok ? "feito" : null;
  };

  const itemOk = (item: ChecklistItem) => {
    if (item.kind === "abastecimento") {
      if (precisaAbastecer === false) return true;

      return (
        precisaAbastecer === true &&
        !!abastecimentoId
      );
    }

    if (item.kind === "documentos") {
      return docsCompletos(respostas.docs || {});
    }

    const r = respostas.itens?.[item.id];
    const st = statusOf(item);

    if (!st) return false;

    if (st === "nao_feito") {
      return !!r?.motivo?.trim();
    }

    if (st === "reporte") {
      return !!r?.obs?.trim();
    }

    if (item.kind === "oleo") {
      return (
        !!r?.oleo_lh?.trim() &&
        !!r?.oleo_rh?.trim()
      );
    }

    return true;
  };

  const setStatus = (
    item: ChecklistItem,
    status: ItemStatus | null
  ) => {
    if (readOnly) return;

    if (
      item.kind === "abastecimento" ||
      item.kind === "documentos"
    ) {
      return;
    }

    if (status === "feito" && item.kind === "oleo") {
      const r = respostas.itens?.[item.id];

      if (
        !r?.oleo_lh?.trim() ||
        !r?.oleo_rh?.trim()
      ) {
        toast.error(
          "Informe os níveis de óleo LH e RH antes de concluir."
        );
        return;
      }
    }

    setRespostas((prev) => ({
      ...prev,
      itens: {
        ...prev.itens,
        [item.id]: {
          ...(prev.itens?.[item.id] || {}),
          ok:
            status === "feito" ||
            status === "reporte",
          status: status ?? undefined,
        },
      },
    }));
  };

  const setCampo = (
    item: ChecklistItem,
    field: "motivo" | "obs",
    value: string
  ) => {
    setRespostas((prev) => ({
      ...prev,
      itens: {
        ...prev.itens,
        [item.id]: {
          ...(prev.itens?.[item.id] || {
            ok: false,
          }),
          [field]: value,
        },
      },
    }));
  };

  const setOleo = (
    field: "oleo_lh" | "oleo_rh",
    value: string
  ) => {
    setRespostas((prev) => ({
      ...prev,
      itens: {
        ...prev.itens,
        desp_nivel_oleo: {
          ...(prev.itens?.desp_nivel_oleo || {
            ok: false,
          }),
          [field]: value,
        },
      },
    }));
  };

  /*
   * =========================================================
   * PROGRESSO
   * =========================================================
   */
  const sectionCompleta = (index: number) =>
    PRE_VOO_SECTIONS[index].items.every((item) =>
      itemOk(item)
    );

  const sectionLiberada = (index: number) => {
    for (let i = 0; i < index; i++) {
      if (!sectionCompleta(i)) return false;
    }

    return true;
  };

  const concluidos = useMemo(
    () =>
      PRE_VOO_SECTIONS.reduce(
        (acc, section) =>
          acc +
          section.items.filter((item) =>
            itemOk(item)
          ).length,
        0
      ),
    [
      respostas,
      precisaAbastecer,
      abastecimentoId,
    ]
  );

  const progresso =
    TOTAL_ITENS > 0
      ? Math.round(
          (concluidos / TOTAL_ITENS) * 100
        )
      : 0;

  const tudoConcluido =
    concluidos === TOTAL_ITENS;

  const alertas = useMemo(
    () =>
      PRE_VOO_SECTIONS.flatMap((section) =>
        section.items
          .filter(
            (item) =>
              respostas.itens?.[item.id]
                ?.status === "reporte"
          )
          .map((item) => ({
            label: item.label,
            obs:
              respostas.itens?.[item.id]?.obs || "",
          }))
      ),
    [respostas]
  );

  const naoFeitos = useMemo(
    () =>
      PRE_VOO_SECTIONS.flatMap((section) =>
        section.items
          .filter(
            (item) =>
              respostas.itens?.[item.id]
                ?.status === "nao_feito"
          )
          .map((item) => ({
            label: item.label,
            motivo:
              respostas.itens?.[item.id]
                ?.motivo || "",
          }))
      ),
    [respostas]
  );

  /*
   * =========================================================
   * SALVAR
   * =========================================================
   */
  const handleSalvar = async (
    concluir: boolean
  ) => {
    if (!solicitacaoId) return;

    if (concluir) {
      if (precisaAbastecer === null) {
        toast.error(
          "Informe se a aeronave precisa abastecer."
        );
        return;
      }

      if (
        precisaAbastecer &&
        !abastecimentoId
      ) {
        toast.error(
          "Registre o abastecimento antes de concluir."
        );
        return;
      }

      if (!tudoConcluido) {
        toast.error(
          "Ainda existem itens pendentes."
        );
        return;
      }
    }

    const { data: authData } =
      await supabase.auth.getUser();

    const userId =
      authData?.user?.id ?? null;

    let nome =
      authData?.user?.email ?? null;

    if (userId) {
      const { data: perfil } = await db
        .from("user_profiles")
        .select(
          "full_name, display_name"
        )
        .eq("id", userId)
        .maybeSingle();

      nome =
        perfil?.full_name ||
        perfil?.display_name ||
        nome;
    }

    salvar.mutate(
      {
        id: checklist?.id ?? null,
        solicitacao_id: solicitacaoId,
        aeronave_id:
          voo?.aeronave_id ?? null,
        cliente_id:
          voo?.cliente_id ?? null,
        respostas,
        precisa_abastecer:
          precisaAbastecer,
        abastecimento_id:
          abastecimentoId,
        observacoes,
        concluir,
        executado_por: userId,
        executado_por_nome: nome,
      },
      {
        onSuccess: () => {
          limparDraftLocal();

          toast.success(
            concluir
              ? "Checklist concluído com sucesso."
              : "Rascunho salvo."
          );
        },
        onError: () => {
          toast.error(
            "Não foi possível salvar o checklist."
          );
        },
      }
    );
  };

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */
  const loading =
    loadingVoo || loadingChecklist;

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>

            <div className="text-center">
              <p className="font-semibold text-foreground">
                Carregando checklist
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Preparando os itens da aeronave...
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  /*
   * =========================================================
   * UI
   * =========================================================
   */
  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 pb-28 sm:p-6 lg:p-8">

          {/* =================================================
              HEADER
          ================================================= */}
          <header className="overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-sm">
            <div className="relative p-5 sm:p-7">

              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.10] via-transparent to-emerald-500/[0.06] pointer-events-none" />

              <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

                <div className="min-w-0">

                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="mb-5 inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>

                  <div className="flex items-start gap-4">

                    <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary sm:flex">
                      <ClipboardCheck className="h-7 w-7" />
                    </div>

                    <div className="min-w-0">

                      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                        Preparação operacional
                      </div>

                      <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                        Checklist de Pré-Voo
                      </h1>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">

                        <span className="inline-flex items-center gap-1.5">
                          <Plane className="h-4 w-4 text-primary" />
                          {voo?.aeronave?.matricula ||
                            "Aeronave —"}
                        </span>

                        <span className="hidden text-border sm:inline">
                          •
                        </span>

                        <span>
                          {voo?.origem || "—"} →{" "}
                          {voo?.destino || "—"}
                        </span>

                        <span className="hidden text-border sm:inline">
                          •
                        </span>

                        <span>
                          {voo?.data_agendada
                            ? format(
                                parseISO(
                                  voo.data_agendada
                                ),
                                "dd 'de' MMMM 'de' yyyy",
                                {
                                  locale: ptBR,
                                }
                              )
                            : "Data —"}
                        </span>
                      </div>

                      {voo?.clientes?.razao_social && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Cliente:{" "}
                          <span className="font-medium text-foreground">
                            {voo.clientes.razao_social}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* PROGRESS CARD */}
                <div className="w-full xl:w-[360px]">

                  <div className="rounded-2xl border border-border/60 bg-background/60 p-4">

                    <div className="flex items-center gap-4">

                      <div
                        className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: `conic-gradient(
                            hsl(var(--primary)) ${progresso}%,
                            hsl(var(--muted)) ${progresso}%
                          )`,
                        }}
                      >
                        <div className="flex h-[66px] w-[66px] flex-col items-center justify-center rounded-full bg-card">
                          <span className="text-xl font-black">
                            {progresso}%
                          </span>
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                            completo
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold">
                            Progresso
                          </span>

                          <span className="text-sm font-bold text-primary">
                            {concluidos}/{TOTAL_ITENS}
                          </span>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                            style={{
                              width: `${progresso}%`,
                            }}
                          />
                        </div>

                        <p className="mt-2 text-xs text-muted-foreground">
                          {tudoConcluido
                            ? "Todos os itens estão completos."
                            : `${TOTAL_ITENS - concluidos} item(ns) ainda pendente(s).`}
                        </p>
                      </div>
                    </div>

                    {readOnly && (
                      <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">
                        <Eye className="h-4 w-4" />
                        <span>
                          Checklist concluído por{" "}
                          <strong>
                            {checklist?.executado_por_nome ||
                              "—"}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* =================================================
              RECUPERAÇÃO DE RASCUNHO
          ================================================= */}
          {localDraftAvailable && !readOnly && (
            <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Save className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-sm font-semibold">
                    Encontramos um rascunho não salvo
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Há preenchimentos recentes armazenados neste
                    navegador.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={recuperarDraftLocal}
                >
                  Recuperar
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={limparDraftLocal}
                >
                  Ignorar
                </Button>
              </div>
            </div>
          )}

          {/* =================================================
              ALERTAS
          ================================================= */}
          {(alertas.length > 0 ||
            naoFeitos.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">

              {alertas.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                  <div className="flex items-start gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                      <AlertTriangle className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="font-semibold text-amber-500">
                        {alertas.length} item(ns) com reporte
                      </p>

                      <div className="mt-2 space-y-1.5">
                        {alertas.map((item) => (
                          <div
                            key={item.label}
                            className="text-xs text-muted-foreground"
                          >
                            <span className="font-medium text-foreground">
                              {item.label}
                            </span>

                            {item.obs && (
                              <>
                                {" — "}
                                {item.obs}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {naoFeitos.length > 0 && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4">
                  <div className="flex items-start gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                      <XCircle className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="font-semibold text-rose-500">
                        {naoFeitos.length} item(ns) não realizados
                      </p>

                      <div className="mt-2 space-y-1.5">
                        {naoFeitos.map((item) => (
                          <div
                            key={item.label}
                            className="text-xs text-muted-foreground"
                          >
                            <span className="font-medium text-foreground">
                              {item.label}
                            </span>

                            {item.motivo && (
                              <>
                                {" — "}
                                {item.motivo}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================
              CHECKLIST
          ================================================= */}
          <div className="space-y-4">

            {PRE_VOO_SECTIONS.map(
              (section, index) => {
                const liberada =
                  sectionLiberada(index);

                const completa =
                  sectionCompleta(index);

                const recolhida =
                  colapsadas[section.id] ??
                  false;

                const feitos =
                  section.items.filter((item) =>
                    itemOk(item)
                  ).length;

                return (
                  <section
                    key={section.id}
                    className={cn(
                      "overflow-hidden rounded-[24px] border bg-card shadow-sm transition-all",
                      completa
                        ? "border-emerald-500/20"
                        : "border-border/60",
                      !liberada &&
                        "opacity-70"
                    )}
                  >

                    {/* SECTION HEADER */}
                    <button
                      type="button"
                      disabled={!liberada}
                      onClick={() => {
                        if (!liberada) return;

                        setColapsadas((prev) => ({
                          ...prev,
                          [section.id]:
                            !recolhida,
                        }));
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition sm:px-6",
                        liberada
                          ? "hover:bg-muted/30"
                          : "cursor-not-allowed"
                      )}
                    >

                      <div className="flex min-w-0 items-center gap-3">

                        <div
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                            completa
                              ? "bg-emerald-500/10 text-emerald-500"
                              : liberada
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          {completa ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : liberada ? (
                            <ShieldCheck className="h-5 w-5" />
                          ) : (
                            <Lock className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">

                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                              Etapa {index + 1}
                            </span>

                            {completa && (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500">
                                Concluída
                              </span>
                            )}
                          </div>

                          <h2 className="mt-1 truncate text-base font-bold text-foreground sm:text-lg">
                            {section.title}
                          </h2>

                          {section.subtitle && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {section.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">

                        <div className="hidden text-right sm:block">
                          <div className="text-sm font-bold">
                            {feitos}/{section.items.length}
                          </div>

                          <div className="text-[10px] text-muted-foreground">
                            itens
                          </div>
                        </div>

                        <div className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-border/60 bg-background text-xs font-bold">
                          {feitos}
                        </div>

                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            recolhida
                              ? "-rotate-90"
                              : ""
                          )}
                        />
                      </div>
                    </button>

                    {/* SECTION BODY */}
                    {!recolhida &&
                      liberada && (
                        <div className="border-t border-border/50">
                          <div className="divide-y divide-border/40">
                            {section.items.map(
                              (item, itemIndex) => {
                                const ok =
                                  itemOk(item);

                                const st =
                                  statusOf(item);

                                const auto =
                                  item.kind ===
                                    "abastecimento" ||
                                  item.kind ===
                                    "documentos";

                                const r =
                                  respostas.itens?.[
                                    item.id
                                  ];

                                return (
                                  <div
                                    key={item.id}
                                    className={cn(
                                      "p-4 transition-colors sm:p-5",
                                      ok &&
                                        "bg-emerald-500/[0.018]",
                                      st ===
                                        "reporte" &&
                                        "bg-amber-500/[0.04]",
                                      st ===
                                        "nao_feito" &&
                                        "bg-rose-500/[0.04]"
                                    )}
                                  >

                                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">

                                      {/* ITEM INFO */}
                                      <div className="flex min-w-0 gap-3">

                                        <div
                                          className={cn(
                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-bold",
                                            ok
                                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                                              : st ===
                                                  "reporte"
                                                ? "border-amber-500/20 bg-amber-500/10 text-amber-500"
                                                : st ===
                                                    "nao_feito"
                                                  ? "border-rose-500/20 bg-rose-500/10 text-rose-500"
                                                  : "border-border/60 bg-muted/30 text-muted-foreground"
                                          )}
                                        >
                                          {ok ? (
                                            <Check className="h-4 w-4" />
                                          ) : st ===
                                            "reporte" ? (
                                            <AlertTriangle className="h-4 w-4" />
                                          ) : st ===
                                            "nao_feito" ? (
                                            <XCircle className="h-4 w-4" />
                                          ) : (
                                            itemIndex + 1
                                          )}
                                        </div>

                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">

                                            <p
                                              className={cn(
                                                "text-sm font-semibold leading-6",
                                                ok
                                                  ? "text-foreground"
                                                  : "text-foreground/90"
                                              )}
                                            >
                                              {item.label}
                                            </p>

                                            {st ===
                                              "reporte" && (
                                              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-500">
                                                Reporte
                                              </span>
                                            )}

                                            {st ===
                                              "nao_feito" && (
                                              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-500">
                                                Não feito
                                              </span>
                                            )}
                                          </div>

                                          {!auto &&
                                            !st && (
                                              <p className="mt-1 text-xs text-muted-foreground">
                                                Selecione o resultado desta verificação.
                                              </p>
                                            )}
                                        </div>
                                      </div>

                                      {/* STATUS */}
                                      {!auto && (
                                        <div className="grid grid-cols-3 gap-2 xl:w-[360px]">

                                          <button
                                            type="button"
                                            disabled={readOnly}
                                            onClick={() =>
                                              setStatus(
                                                item,
                                                st ===
                                                  "feito"
                                                  ? null
                                                  : "feito"
                                              )
                                            }
                                            className={cn(
                                              "min-h-10 rounded-xl border px-3 text-xs font-semibold transition",
                                              st ===
                                                "feito"
                                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                                                : "border-border/60 bg-background text-muted-foreground hover:bg-muted"
                                            )}
                                          >
                                            <span className="flex items-center justify-center gap-1.5">
                                              <Check className="h-3.5 w-3.5" />
                                              Feito
                                            </span>
                                          </button>

                                          <button
                                            type="button"
                                            disabled={readOnly}
                                            onClick={() =>
                                              setStatus(
                                                item,
                                                st ===
                                                  "nao_feito"
                                                  ? null
                                                  : "nao_feito"
                                              )
                                            }
                                            className={cn(
                                              "min-h-10 rounded-xl border px-3 text-xs font-semibold transition",
                                              st ===
                                                "nao_feito"
                                                ? "border-rose-500/30 bg-rose-500/10 text-rose-500"
                                                : "border-border/60 bg-background text-muted-foreground hover:bg-muted"
                                            )}
                                          >
                                            <span className="flex items-center justify-center gap-1.5">
                                              <XCircle className="h-3.5 w-3.5" />
                                              Não feito
                                            </span>
                                          </button>

                                          <button
                                            type="button"
                                            disabled={readOnly}
                                            onClick={() =>
                                              setStatus(
                                                item,
                                                st ===
                                                  "reporte"
                                                  ? null
                                                  : "reporte"
                                              )
                                            }
                                            className={cn(
                                              "min-h-10 rounded-xl border px-3 text-xs font-semibold transition",
                                              st ===
                                                "reporte"
                                                ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                                                : "border-border/60 bg-background text-muted-foreground hover:bg-muted"
                                            )}
                                          >
                                            <span className="flex items-center justify-center gap-1.5">
                                              <AlertTriangle className="h-3.5 w-3.5" />
                                              Reporte
                                            </span>
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    {/* NÃO FEITO */}
                                    {st ===
                                      "nao_feito" && (
                                      <div className="mt-4 ml-11 max-w-2xl">
                                        <Label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-rose-500">
                                          Motivo
                                        </Label>

                                        <Textarea
                                          value={
                                            r?.motivo ||
                                            ""
                                          }
                                          onChange={(e) =>
                                            setCampo(
                                              item,
                                              "motivo",
                                              e.target.value
                                            )
                                          }
                                          disabled={readOnly}
                                          placeholder="Descreva o motivo pelo qual o item não foi realizado..."
                                          className="min-h-[80px] rounded-2xl border-rose-500/20 bg-background/60"
                                        />
                                      </div>
                                    )}

                                    {/* REPORTE */}
                                    {st ===
                                      "reporte" && (
                                      <div className="mt-4 ml-11 max-w-2xl">
                                        <Label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-amber-500">
                                          Descrição do reporte
                                        </Label>

                                        <Textarea
                                          value={
                                            r?.obs ||
                                            ""
                                          }
                                          onChange={(e) =>
                                            setCampo(
                                              item,
                                              "obs",
                                              e.target.value
                                            )
                                          }
                                          disabled={readOnly}
                                          placeholder="Descreva o que precisa ser verificado posteriormente..."
                                          className="min-h-[80px] rounded-2xl border-amber-500/20 bg-background/60"
                                        />
                                      </div>
                                    )}

                                    {/* ÓLEO */}
                                    {item.kind ===
                                      "oleo" && (
                                      <div className="mt-4 ml-11 grid max-w-2xl gap-3 sm:grid-cols-2">

                                        <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
                                          <Label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            <Droplets className="h-3.5 w-3.5 text-primary" />
                                            Nível de óleo LH
                                          </Label>

                                          <Input
                                            value={
                                              respostas
                                                .itens
                                                ?.desp_nivel_oleo
                                                ?.oleo_lh ||
                                              ""
                                            }
                                            onChange={(
                                              e
                                            ) =>
                                              setOleo(
                                                "oleo_lh",
                                                e.target
                                                  .value
                                              )
                                            }
                                            disabled={
                                              readOnly
                                            }
                                            placeholder="Ex.: 6 QT"
                                            className="h-11 rounded-xl"
                                          />
                                        </div>

                                        <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
                                          <Label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            <Droplets className="h-3.5 w-3.5 text-primary" />
                                            Nível de óleo RH
                                          </Label>

                                          <Input
                                            value={
                                              respostas
                                                .itens
                                                ?.desp_nivel_oleo
                                                ?.oleo_rh ||
                                              ""
                                            }
                                            onChange={(
                                              e
                                            ) =>
                                              setOleo(
                                                "oleo_rh",
                                                e.target
                                                  .value
                                              )
                                            }
                                            disabled={
                                              readOnly
                                            }
                                            placeholder="Ex.: 6 QT"
                                            className="h-11 rounded-xl"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* ABASTECIMENTO */}
                                    {item.kind ===
                                      "abastecimento" && (
                                      <div className="mt-4 ml-11">
                                        <div className="flex flex-wrap gap-2">

                                          <button
                                            type="button"
                                            disabled={
                                              readOnly
                                            }
                                            onClick={() => {
                                              setPrecisaAbastecer(
                                                true
                                              );
                                              setAbastOpen(
                                                true
                                              );
                                            }}
                                            className={cn(
                                              "rounded-xl border px-4 py-2 text-xs font-semibold transition",
                                              precisaAbastecer ===
                                                true
                                                ? "border-primary/30 bg-primary/10 text-primary"
                                                : "border-border/60 bg-background hover:bg-muted"
                                            )}
                                          >
                                            <span className="flex items-center gap-2">
                                              <Fuel className="h-3.5 w-3.5" />
                                              Precisa abastecer
                                            </span>
                                          </button>

                                          <button
                                            type="button"
                                            disabled={
                                              readOnly
                                            }
                                            onClick={() => {
                                              setPrecisaAbastecer(
                                                false
                                              );
                                              setAbastecimentoId(
                                                null
                                              );
                                            }}
                                            className={cn(
                                              "rounded-xl border px-4 py-2 text-xs font-semibold transition",
                                              precisaAbastecer ===
                                                false
                                                ? "border-rose-500/30 bg-rose-500/10 text-rose-500"
                                                : "border-border/60 bg-background hover:bg-muted"
                                            )}
                                          >
                                            Não precisa
                                          </button>

                                          {precisaAbastecer ===
                                            true && (
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant={
                                                abastecimentoId
                                                  ? "outline"
                                                  : "default"
                                              }
                                              onClick={() =>
                                                setAbastOpen(
                                                  true
                                                )
                                              }
                                              className="h-10 rounded-xl"
                                            >
                                              <Fuel className="mr-2 h-4 w-4" />
                                              {abastecimentoId
                                                ? "Ver abastecimento"
                                                : "Registrar abastecimento"}
                                            </Button>
                                          )}
                                        </div>

                                        {abastecimento && (
                                          <div className="mt-3 grid gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 sm:grid-cols-4">

                                            <div>
                                              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Trecho
                                              </p>
                                              <p className="mt-1 text-sm font-semibold">
                                                {abastecimento.trecho ||
                                                  "—"}
                                              </p>
                                            </div>

                                            <div>
                                              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Litros
                                              </p>
                                              <p className="mt-1 text-sm font-semibold">
                                                {Number(
                                                  abastecimento.litros ||
                                                    0
                                                ).toLocaleString(
                                                  "pt-BR"
                                                )}{" "}
                                                L
                                              </p>
                                            </div>

                                            <div>
                                              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Valor
                                              </p>
                                              <p className="mt-1 text-sm font-semibold">
                                                {Number(
                                                  abastecimento.valor_total ||
                                                    0
                                                ).toLocaleString(
                                                  "pt-BR",
                                                  {
                                                    style:
                                                      "currency",
                                                    currency:
                                                      "BRL",
                                                  }
                                                )}
                                              </p>
                                            </div>

                                            <div>
                                              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Status
                                              </p>
                                              <span className="mt-1 inline-flex rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-semibold uppercase text-emerald-500">
                                                {abastecimento.status ||
                                                  "pendente"}
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* DOCUMENTOS */}
                                    {item.kind ===
                                      "documentos" && (
                                      <div className="mt-4 ml-11">
                                        <Button
                                          type="button"
                                          variant={
                                            ok
                                              ? "outline"
                                              : "default"
                                          }
                                          onClick={() =>
                                            setDocsOpen(
                                              true
                                            )
                                          }
                                          disabled={
                                            readOnly &&
                                            !ok
                                          }
                                          className="h-10 rounded-xl"
                                        >
                                          <FileCheck2 className="mr-2 h-4 w-4" />
                                          {ok
                                            ? "Ver documentos"
                                            : "Verificar documentos"}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>
                      )}

                    {!liberada && (
                      <div className="border-t border-border/50 bg-muted/20 px-5 py-4">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Lock className="h-4 w-4" />
                          <span>
                            Complete a etapa anterior para liberar esta seção.
                          </span>
                        </div>
                      </div>
                    )}
                  </section>
                );
              }
            )}

            {/* =================================================
                OBSERVAÇÕES
            ================================================= */}
            <section className="rounded-[24px] border border-border/60 bg-card p-5 shadow-sm sm:p-6">

              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Info className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="font-bold">
                    Observações gerais
                  </h2>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Registre qualquer informação importante sobre a preparação do voo.
                  </p>
                </div>
              </div>

              <Textarea
                value={observacoes}
                onChange={(e) =>
                  setObservacoes(e.target.value)
                }
                disabled={readOnly}
                placeholder="Ex.: observações da aeronave, pendências, condições encontradas..."
                className="min-h-[120px] rounded-2xl bg-background/50"
              />
            </section>
          </div>
        </div>

        {/* ===================================================
            BARRA FIXA INFERIOR
        =================================================== */}
        {!readOnly && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">

              <div className="hidden items-center gap-3 sm:flex">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                  {salvar.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold">
                    {salvar.isPending
                      ? "Salvando..."
                      : "Preenchimento em andamento"}
                  </p>

                  <p className="text-[10px] text-muted-foreground">
                    O sistema mantém um rascunho local enquanto você preenche.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex">

                <Button
                  variant="outline"
                  onClick={() =>
                    handleSalvar(false)
                  }
                  disabled={salvar.isPending}
                  className="h-11 rounded-xl"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Salvar rascunho
                </Button>

                <Button
                  onClick={() =>
                    handleSalvar(true)
                  }
                  disabled={
                    salvar.isPending ||
                    !tudoConcluido
                  }
                  className="h-11 rounded-xl px-5"
                >
                  {salvar.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}

                  {tudoConcluido
                    ? "Concluir checklist"
                    : `${TOTAL_ITENS - concluidos} pendente(s)`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================
          DIALOG ABASTECIMENTO
      ===================================================== */}
      <AbastecimentoPreVooDialog
        open={abastOpen}
        onOpenChange={setAbastOpen}
        defaultClienteId={
          voo?.cliente_id ?? null
        }
        defaultAeronaveId={
          voo?.aeronave_id ?? null
        }
        defaultData={
          voo?.data_partida ||
          voo?.data_agendada
        }
        onSaved={(id) => {
          setAbastecimentoId(id);
          setPrecisaAbastecer(true);
        }}
      />

      {/* =====================================================
          DIALOG DOCUMENTOS
      ===================================================== */}
      <DocumentosAeronaveDialog
        open={docsOpen}
        onOpenChange={setDocsOpen}
        docs={respostas.docs || {}}
        onChange={(docs) =>
          setRespostas((prev) => ({
            ...prev,
            docs,
          }))
        }
        readOnly={readOnly}
      />
    </Layout>
  );
}