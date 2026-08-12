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
import { AbastecimentoPreVooDialog } from "@/components/PreVoo/AbastecimentoPreVooDialog";
import { DocumentosAeronaveDialog, docsCompletos } from "@/components/PreVoo/DocumentosAeronaveDialog";
import {
  usePreVooChecklist,
  usePreVooChecklistMutations,
  respostasVazias,
  type ChecklistRespostas,
} from "@/hooks/usePreVooChecklist";
import {
  ArrowLeft, CheckCircle2, ClipboardCheck, Fuel, Lock, Plane, Save, Circle,
  Droplets, ListChecks, ShieldCheck, Loader2, Eye, ChevronDown, AlertTriangle, XCircle,
} from "lucide-react";


const db = supabase as any;

export default function ChecklistPreVoo() {
  const { solicitacaoId } = useParams<{ solicitacaoId: string }>();
  const navigate = useNavigate();

  const { data: voo } = useQuery({
    queryKey: ["pre-voo-solicitacao", solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await db
        .from("solicitacoes_reserva_voo")
        .select("*, aeronave:aeronave_id(id, matricula, modelo), clientes:cliente_id(razao_social)")
        .eq("id", solicitacaoId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: checklist, isLoading } = usePreVooChecklist(solicitacaoId);
  const { salvar } = usePreVooChecklistMutations();

  const [respostas, setRespostas] = useState<ChecklistRespostas>(respostasVazias);
  const [precisaAbastecer, setPrecisaAbastecer] = useState<boolean | null>(null);
  const [abastecimentoId, setAbastecimentoId] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [abastOpen, setAbastOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [colapsadas, setColapsadas] = useState<Record<string, boolean>>({});

  const readOnly = checklist?.status === "concluido";

  // Só sincroniza o formulário com o servidor quando é de fato um checklist
  // diferente (troca de solicitação) ou o primeiro carregamento — nunca por
  // causa de um refetch em segundo plano do mesmo checklist, senão qualquer
  // edição em andamento (ex: texto do reporte) seria apagada no meio da
  // digitação.
  const checklistIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!checklist) return;
    if (checklistIdRef.current === checklist.id) return;
    checklistIdRef.current = checklist.id;
    setRespostas(checklist.respostas || respostasVazias);
    setPrecisaAbastecer(checklist.precisa_abastecer);
    setAbastecimentoId(checklist.abastecimento_id);
    setObservacoes(checklist.observacoes || "");
  }, [checklist]);

  const { data: abastecimento } = useQuery({
    queryKey: ["pre-voo-abastecimento", abastecimentoId],
    enabled: !!abastecimentoId,
    queryFn: async () => {
      const { data, error } = await db
        .from("abastecimentos")
        .select("id, trecho, litros, valor_total, status, tipo_faturamento")
        .eq("id", abastecimentoId)
        .maybeSingle();
      if (error) return null;
      return data as any;
    },
  });

  type ItemStatus = "feito" | "nao_feito" | "reporte";

  const statusOf = (item: ChecklistItem): ItemStatus | null => {
    const r = respostas.itens?.[item.id];
    if (r?.status) return r.status;
    return r?.ok ? "feito" : null;
  };

  const itemOk = (item: ChecklistItem) => {
    if (item.kind === "abastecimento") {
      if (precisaAbastecer === false) return true;
      return precisaAbastecer === true && !!abastecimentoId;
    }
    if (item.kind === "documentos") return docsCompletos(respostas.docs || {});
    const r = respostas.itens?.[item.id];
    const st = statusOf(item);
    if (!st) return false;
    if (st === "nao_feito") return !!r?.motivo?.trim();
    if (st === "reporte") return !!r?.obs?.trim();
    if (item.kind === "oleo") return !!r?.oleo_lh?.trim() && !!r?.oleo_rh?.trim();
    return true;
  };

  const setStatus = (item: ChecklistItem, status: ItemStatus | null) => {
    if (readOnly) return;
    if (item.kind === "abastecimento" || item.kind === "documentos") return;
    if (status === "feito" && item.kind === "oleo") {
      const r = respostas.itens?.[item.id];
      if (!r?.oleo_lh?.trim() || !r?.oleo_rh?.trim()) {
        toast.error("Informe os níveis de óleo LH e RH antes de marcar como concluído");
        return;
      }
    }
    setRespostas((prev) => ({
      ...prev,
      itens: {
        ...prev.itens,
        [item.id]: {
          ...(prev.itens?.[item.id] || {}),
          ok: status === "feito" || status === "reporte",
          status: status ?? undefined,
        },
      },
    }));
  };

  const setCampo = (item: ChecklistItem, field: "motivo" | "obs", value: string) => {
    setRespostas((prev) => ({
      ...prev,
      itens: {
        ...prev.itens,
        [item.id]: { ...(prev.itens?.[item.id] || { ok: false }), [field]: value },
      },
    }));
  };

  const setOleo = (field: "oleo_lh" | "oleo_rh", value: string) => {
    setRespostas((prev) => ({
      ...prev,
      itens: {
        ...prev.itens,
        desp_nivel_oleo: { ...(prev.itens?.desp_nivel_oleo || { ok: false }), [field]: value },
      },
    }));
  };

  const sectionCompleta = (index: number) =>
    PRE_VOO_SECTIONS[index].items.every((item) => itemOk(item));

  const sectionLiberada = (index: number) => {
    for (let i = 0; i < index; i++) if (!sectionCompleta(i)) return false;
    return true;
  };

  const concluidos = useMemo(
    () => PRE_VOO_SECTIONS.reduce((acc, s) => acc + s.items.filter((i) => itemOk(i)).length, 0),
    [respostas, precisaAbastecer, abastecimentoId],
  );
  const progresso = Math.round((concluidos / TOTAL_ITENS) * 100);
  const tudoConcluido = concluidos === TOTAL_ITENS;

  const alertas = useMemo(
    () =>
      PRE_VOO_SECTIONS.flatMap((s) =>
        s.items
          .filter((i) => respostas.itens?.[i.id]?.status === "reporte")
          .map((i) => ({ label: i.label, obs: respostas.itens?.[i.id]?.obs || "" })),
      ),
    [respostas],
  );
  const naoFeitos = useMemo(
    () =>
      PRE_VOO_SECTIONS.flatMap((s) =>
        s.items
          .filter((i) => respostas.itens?.[i.id]?.status === "nao_feito")
          .map((i) => ({ label: i.label, motivo: respostas.itens?.[i.id]?.motivo || "" })),
      ),
    [respostas],
  );


  const handleSalvar = async (concluir: boolean) => {
    if (!solicitacaoId) return;
    if (concluir) {
      if (precisaAbastecer === null) return toast.error("Informe se precisa abastecer");
      if (precisaAbastecer && !abastecimentoId)
        return toast.error("Preencha o registro de abastecimento para concluir o checklist");
      if (!tudoConcluido) return toast.error("Conclua todos os itens do checklist");
    }

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;
    let nome = authData?.user?.email ?? null;
    if (userId) {
      const { data: perfil } = await db
        .from("user_profiles")
        .select("full_name, display_name")
        .eq("id", userId)
        .maybeSingle();
      nome = perfil?.full_name || perfil?.display_name || nome;
    }

    salvar.mutate({
      id: checklist?.id ?? null,
      solicitacao_id: solicitacaoId,
      aeronave_id: voo?.aeronave_id ?? null,
      cliente_id: voo?.cliente_id ?? null,
      respostas,
      precisa_abastecer: precisaAbastecer,
      abastecimento_id: abastecimentoId,
      observacoes,
      concluir,
      executado_por: userId,
      executado_por_nome: nome,
    });
  };

  const SECTION_ICONS = [ListChecks, Fuel, ShieldCheck];

  // Autosalvar rascunho ao sair da tela sem concluir
  const autoSaveRef = useRef<() => void>(() => {});
  autoSaveRef.current = () => {
    if (!solicitacaoId || readOnly) return;
    const temAlgo =
      Object.keys(respostas.itens || {}).length > 0 ||
      Object.keys(respostas.docs || {}).length > 0 ||
      precisaAbastecer !== null ||
      !!observacoes;
    if (!temAlgo) return;
    salvar.mutate({
      id: checklist?.id ?? null,
      solicitacao_id: solicitacaoId,
      aeronave_id: voo?.aeronave_id ?? null,
      cliente_id: voo?.cliente_id ?? null,
      respostas,
      precisa_abastecer: precisaAbastecer,
      abastecimento_id: abastecimentoId,
      observacoes,
      concluir: false,
    });
  };

  useEffect(() => {
    return () => {
      autoSaveRef.current();
    };
  }, []);

  return (
    <Layout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-card p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-2">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 gap-1 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <h1 className="flex items-center gap-2 text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
                <ClipboardCheck className="h-6 w-6 text-primary" /> Checklist de preparação de voo
              </h1>
              <p className="text-sm text-muted-foreground">
                {voo ? (
                  <>
                    <Plane className="mr-1 inline h-4 w-4" />
                    {voo.aeronave?.matricula ?? "Aeronave —"} · {voo.origem ?? "—"} → {voo.destino ?? "—"} ·{" "}
                    {voo.data_agendada ? format(parseISO(voo.data_agendada), "dd 'de' MMMM yyyy", { locale: ptBR }) : "—"}
                    {voo.clientes?.razao_social ? ` · ${voo.clientes.razao_social}` : ""}
                  </>
                ) : (
                  "Carregando voo..."
                )}
              </p>
            </div>

            <div className="shrink-0 space-y-2 sm:w-64">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progresso</span>
                <span className="font-semibold text-foreground">{concluidos}/{TOTAL_ITENS}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              {readOnly && (
                <p className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-400">
                  <Eye className="h-3.5 w-3.5" />
                  Concluído por {checklist?.executado_por_nome || "—"}
                  {checklist?.concluido_em
                    ? ` em ${format(parseISO(checklist.concluido_em), "dd/MM/yyyy HH:mm")}`
                    : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {(alertas.length > 0 || naoFeitos.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {alertas.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-400">
                  <AlertTriangle className="h-4 w-4" /> {alertas.length} item(ns) com reporte — verificar depois
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-200/90">
                  {alertas.map((a) => (
                    <li key={a.label}>
                      <span className="font-medium">{a.label}</span>
                      {a.obs ? ` — ${a.obs}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {naoFeitos.length > 0 && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-rose-400">
                  <XCircle className="h-4 w-4" /> {naoFeitos.length} item(ns) não realizados
                </p>
                <ul className="mt-2 space-y-1 text-xs text-rose-200/90">
                  {naoFeitos.map((a) => (
                    <li key={a.label}>
                      <span className="font-medium">{a.label}</span>
                      {a.motivo ? ` — ${a.motivo}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}



        {isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card p-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando checklist...
          </div>
        ) : (
          <div className="space-y-5">
            {PRE_VOO_SECTIONS.map((section, index) => {
              const liberada = sectionLiberada(index);
              const completa = sectionCompleta(index);
              const Icon = SECTION_ICONS[index] ?? ListChecks;
              const recolhida = colapsadas[section.id] ?? false;
              const feitos = section.items.filter((i) => itemOk(i)).length;
              return (
                <section
                  key={section.id}
                  className={cn(
                    "overflow-hidden rounded-2xl border bg-card transition-all",
                    completa ? "border-emerald-500/40" : "border-border/60",
                    !liberada && "opacity-60",
                  )}
                >
                  <header
                    role="button"
                    tabIndex={0}
                    onClick={() => setColapsadas((p) => ({ ...p, [section.id]: !recolhida }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setColapsadas((p) => ({ ...p, [section.id]: !recolhida }));
                      }
                    }}
                    className="flex cursor-pointer select-none flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/10 px-4 py-3 transition-colors hover:bg-muted/20 sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "rounded-xl border p-2",
                          completa
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                            : "border-primary/30 bg-primary/10 text-primary",
                        )}
                      >
                        {liberada ? <Icon className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold uppercase tracking-wide text-foreground">
                          {index + 1}. {section.title}
                        </h2>
                        {section.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{section.subtitle}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {feitos}/{section.items.length}
                      </span>
                      <span
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                          completa
                            ? "bg-emerald-500/15 text-emerald-400"
                            : liberada
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {completa ? "Concluída" : liberada ? "Em andamento" : "Bloqueada"}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          recolhida && "-rotate-90",
                        )}
                      />
                    </div>
                  </header>

                  <ul
                    className={cn(
                      "divide-y divide-border/40",
                      !liberada && "pointer-events-none",
                      recolhida && "hidden",
                    )}
                  >
                    {section.items.map((item) => {
                      const ok = itemOk(item);
                      const st = statusOf(item);
                      const auto = item.kind === "abastecimento" || item.kind === "documentos";
                      const r = respostas.itens?.[item.id];
                      return (
                        <li
                          key={item.id}
                          className={cn(
                            "px-4 py-3 transition-colors sm:px-5",
                            st === "reporte" && "bg-amber-500/[0.06]",
                            st === "nao_feito" && "bg-rose-500/[0.06]",
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                                st === "reporte"
                                  ? "border-amber-500/50 bg-amber-500/20 text-amber-400"
                                  : ok
                                    ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                                    : st === "nao_feito"
                                      ? "border-rose-500/50 bg-rose-500/15 text-rose-400"
                                      : "border-border/60 text-muted-foreground",
                              )}
                            >
                              {st === "reporte" ? (
                                <AlertTriangle className="h-4 w-4" />
                              ) : ok ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : st === "nao_feito" ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <Circle className="h-3.5 w-3.5" />
                              )}
                            </span>
                            <span className={cn("min-w-0 flex-1 text-sm", ok ? "text-foreground" : "text-muted-foreground")}>
                              {item.label}
                              {st === "reporte" && (
                                <span className="ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-400">
                                  verificar depois
                                </span>
                              )}
                            </span>

                            {!auto && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {([
                                  { key: "feito", label: "Feito", cls: "border-emerald-500/50 bg-emerald-500/15 text-emerald-400" },
                                  { key: "nao_feito", label: "Não feito", cls: "border-rose-500/50 bg-rose-500/15 text-rose-400" },
                                  { key: "reporte", label: "Reporte", cls: "border-amber-500/50 bg-amber-500/15 text-amber-400" },
                                ] as const).map((opt) => (
                                  <button
                                    key={opt.key}
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => setStatus(item, st === opt.key ? null : opt.key)}
                                    className={cn(
                                      "rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                                      st === opt.key
                                        ? opt.cls
                                        : "border-border/60 text-muted-foreground hover:bg-accent/40",
                                    )}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {item.kind === "abastecimento" && (
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  disabled={readOnly}
                                  onClick={() => { setPrecisaAbastecer(true); setAbastOpen(true); }}
                                  className={cn(
                                    "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                                    precisaAbastecer === true
                                      ? "border-primary/50 bg-primary/15 text-primary"
                                      : "border-border/60 text-muted-foreground hover:bg-accent/40",
                                  )}
                                >
                                  Sim, abastecer
                                </button>
                                <button
                                  type="button"
                                  disabled={readOnly}
                                  onClick={() => { setPrecisaAbastecer(false); setAbastecimentoId(null); }}
                                  className={cn(
                                    "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                                    precisaAbastecer === false
                                      ? "border-rose-500/50 bg-rose-500/15 text-rose-400"
                                      : "border-border/60 text-muted-foreground hover:bg-accent/40",
                                  )}
                                >
                                  Não
                                </button>
                                {precisaAbastecer === true && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={abastecimentoId ? "outline" : "default"}
                                    onClick={() => setAbastOpen(true)}
                                    disabled={readOnly && !abastecimentoId}
                                    className="h-8 gap-1.5 text-xs"
                                  >
                                    <Fuel className="h-3.5 w-3.5" />
                                    {abastecimentoId ? "Abastecimento registrado" : "Preencher abastecimento"}
                                  </Button>
                                )}
                              </div>
                            )}

                            {item.kind === "documentos" && (
                              <Button
                                type="button"
                                size="sm"
                                variant={ok ? "outline" : "default"}
                                onClick={() => setDocsOpen(true)}
                                className="h-8 gap-1.5 text-xs"
                              >
                                <ClipboardCheck className="h-3.5 w-3.5" />
                                {ok ? "Ver verificação" : "Abrir checklist"}
                              </Button>
                            )}
                          </div>

                          {st === "nao_feito" && (
                            <div className="mt-3 pl-10">
                              <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-rose-400">
                                Por que não foi feito?
                              </Label>
                              <Textarea
                                value={r?.motivo || ""}
                                onChange={(e) => setCampo(item, "motivo", e.target.value)}
                                disabled={readOnly}
                                placeholder="Descreva o motivo"
                                className="min-h-[64px] rounded-xl border-rose-500/30 text-sm"
                              />
                            </div>
                          )}

                          {st === "reporte" && (
                            <div className="mt-3 pl-10">
                              <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                                Reporte — item concluído, precisa ser verificado depois
                              </Label>
                              <Textarea
                                value={r?.obs || ""}
                                onChange={(e) => setCampo(item, "obs", e.target.value)}
                                disabled={readOnly}
                                placeholder="Descreva o que precisa ser verificado"
                                className="min-h-[64px] rounded-xl border-amber-500/30 text-sm"
                              />
                            </div>
                          )}

                          {item.kind === "oleo" && (
                            <div className="mt-3 grid grid-cols-1 gap-3 pl-10 sm:max-w-md sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label className="flex items-center gap-1 text-xs">
                                  <Droplets className="h-3.5 w-3.5" /> Nível LH
                                </Label>
                                <Input
                                  value={respostas.itens?.desp_nivel_oleo?.oleo_lh || ""}
                                  onChange={(e) => setOleo("oleo_lh", e.target.value)}
                                  disabled={readOnly}
                                  placeholder="Ex: 6 QT"
                                  className="h-9 rounded-lg text-sm"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="flex items-center gap-1 text-xs">
                                  <Droplets className="h-3.5 w-3.5" /> Nível RH
                                </Label>
                                <Input
                                  value={respostas.itens?.desp_nivel_oleo?.oleo_rh || ""}
                                  onChange={(e) => setOleo("oleo_rh", e.target.value)}
                                  disabled={readOnly}
                                  placeholder="Ex: 6 QT"
                                  className="h-9 rounded-lg text-sm"
                                />
                              </div>
                            </div>
                          )}

                          {item.kind === "abastecimento" && abastecimento && (
                            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                              <Fuel className="h-3.5 w-3.5" />
                              <span>{abastecimento.trecho}</span>
                              <span>{Number(abastecimento.litros || 0).toLocaleString("pt-BR")} L</span>
                              <span>
                                {Number(abastecimento.valor_total || 0).toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                              </span>
                              <span className="rounded-md bg-background/40 px-2 py-0.5 uppercase">
                                {abastecimento.status || "pendente"}
                              </span>
                            </div>
                          )}
                        </li>
                      );
                    })}

                  </ul>
                </section>
              );
            })}

            <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Observações gerais
              </Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                disabled={readOnly}
                placeholder="Anotações da preparação do voo"
                className="min-h-[90px] rounded-xl"
              />
            </section>

            {!readOnly && (
              <div className="sticky bottom-4 flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/95 p-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => handleSalvar(false)}
                  disabled={salvar.isPending}
                  className="w-full gap-2 sm:w-auto"
                >
                  <Save className="h-4 w-4" /> Salvar rascunho
                </Button>
                <Button
                  onClick={() => handleSalvar(true)}
                  disabled={salvar.isPending || !tudoConcluido}
                  className="w-full gap-2 sm:w-auto sm:min-w-56"
                >
                  {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Concluir checklist
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <AbastecimentoPreVooDialog
        open={abastOpen}
        onOpenChange={setAbastOpen}
        defaultClienteId={voo?.cliente_id ?? null}
        defaultAeronaveId={voo?.aeronave_id ?? null}
        defaultData={voo?.data_partida || voo?.data_agendada}
        onSaved={(id) => {
          setAbastecimentoId(id);
          setPrecisaAbastecer(true);
        }}
      />

      <DocumentosAeronaveDialog
        open={docsOpen}
        onOpenChange={setDocsOpen}
        docs={respostas.docs || {}}
        onChange={(docs) => setRespostas((prev) => ({ ...prev, docs }))}
        readOnly={readOnly}
      />
    </Layout>
  );
}