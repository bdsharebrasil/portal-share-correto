import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Plane, Clock, RotateCcw, Wrench, FileText, Package, AlertTriangle,
  BookOpen, BarChart3, Droplets, ArrowLeft, Map, ShieldCheck, DollarSign,
} from "lucide-react";
import { Gauge } from 'lucide-react';
import { ControleManutencaoTab } from "@/components/dashboard/operador/ctm/ControleManutencaoTab";
import { MediasAeronavesTab } from "@/components/dashboard/operador/ctm/MediasAeronavesTab";
import { OrcamentosTab } from "@/components/dashboard/operador/ctm/OrcamentosTab";
import { OASTab } from "@/components/dashboard/operador/ctm/OASTab";
import { RASTab } from "@/components/dashboard/operador/ctm/RASTab";
import { AnaliseOleoTab } from "@/components/dashboard/operador/ctm/AnaliseOleoTab";
import { RastreamentoTab } from "@/components/dashboard/operador/ctm/RastreamentoTab";
import { DirectivesTab } from "@/components/dashboard/operador/ctm/DirectivesTab";
import { PecasTab } from "@/components/dashboard/operador/ctm/PecasTab";
import { MapaComponenteTab } from "@/components/dashboard/operador/ctm/MapaComponenteTab";
import { PesoBalanceamentoTab } from "@/components/dashboard/operador/ctm/PesoBalanceamentoTab";
import { DocumentosAeronaveTab } from "@/components/dashboard/operador/ctm/DocumentosAeronaveTab";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type TabId = "visao" | "programa" | "medias" | "oas" | "ras" | "orcamentos" | "componentes" | "rastreamento" | "oleo" | "diretrizes" | "pecas" | "peso" | "documentos";

const TABS: { id: TabId; label: string; icon: typeof Wrench }[] = [
  { id: "visao", label: "Visão Geral", icon: BarChart3 },
  { id: "programa", label: "Programa de Manutenção", icon: ShieldCheck },
  { id: "medias", label: "Médias", icon: BarChart3 },
  { id: "oas", label: "OAS", icon: FileText },
  { id: "ras", label: "RAS", icon: BookOpen },
  { id: "orcamentos", label: "Orçamentos", icon: DollarSign },
  { id: "componentes", label: "Mapa de Componente", icon: Map },
  { id: "pecas", label: "Peças Trocadas", icon: Package },
  { id: "peso", label: "Peso & Balanceamento", icon: Gauge },
  { id: "rastreamento", label: "Rastreamento", icon: RotateCcw },
  { id: "oleo", label: "Análise de Óleo", icon: Droplets },
  { id: "diretrizes", label: "AD & SB", icon: AlertTriangle },
  { id: "documentos", label: "Documentos da Aeronave", icon: FileText },
];



const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=60",
  "https://images.unsplash.com/photo-1474302770737-173ee21bab63?auto=format&fit=crop&w=1200&q=60",
  "https://images.unsplash.com/photo-1540962351504-03099e0a754b?auto=format&fit=crop&w=1200&q=60",
];

const brl = (v: any) =>

  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (v: any) => (v ? new Date(String(v) + (String(v).length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—");

function useCtmTable(table: string, aircraftId?: string, orderCol = "criado_em") {
  return useQuery({
    queryKey: ["ctm", table, aircraftId],
    enabled: !!aircraftId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(table)
        .select("*")
        .eq("aeronave_id", aircraftId)
        .order(orderCol, { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function Row({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="group flex items-center justify-between gap-4 rounded-xl border border-slate-800/50 bg-slate-900/40 px-4 py-3 transition-all duration-300 hover:border-slate-700/60 hover:bg-slate-900/80 hover:shadow-sm">
      <div className="min-w-0 transition-transform duration-300 group-hover:translate-x-0.5">
        <p className="truncate text-sm font-semibold text-slate-200 transition-colors group-hover:text-white">{title}</p>
        {subtitle && <p className="truncate text-xs text-slate-400/80 transition-colors group-hover:text-slate-300">{subtitle}</p>}
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="outline">N/D</Badge>;
  const s = status.toLowerCase();
  const cls = s.includes("conclu") || s.includes("complet")
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
    : s.includes("cancel")
      ? "border-red-500/30 bg-red-500/10 text-red-400"
      : s.includes("andament") || s.includes("progress")
        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
        : "border-border/60 bg-muted/30 text-muted-foreground";
  return <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize", cls)}>{status}</span>;
}

/* ---------------- Aircraft list ---------------- */
function AircraftGrid() {
  const navigate = useNavigate();
  const { data: aeronaves = [], isLoading } = useQuery({
    queryKey: ["ctm-aeronaves"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("aeronave")
        .select("id, matricula, modelo, fabricante, status, url_imagem, horas_celula_atual")
        .order("matricula");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const aeronavesAtivas = aeronaves.filter((a) => {
    const status = String(a.status || "").toLowerCase();
    return status === "ativa" || status === "active" || !status;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CTM — Controle Técnico de Manutenção</h1>
          <p className="text-sm text-muted-foreground">Selecione uma aeronave ativa para acessar OAS, RAS, componentes e diretrizes.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/operacoes')}>
          Voltar ao dashboard
        </Button>
      </div>
      
      {isLoading ? (
        <EmptyState text="Carregando aeronaves..." />
      ) : aeronavesAtivas.length === 0 ? (
        <EmptyState text="Nenhuma aeronave ativa disponível" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {aeronavesAtivas.map((a, idx) => (
            <Card
              key={a.id}
              onClick={() => navigate(`/ctm/${a.id}`)}
              // Adicionado cursor-pointer, borda translúcida e transição mais longa (duration-500)
              className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-950/80 shadow-md transition-all duration-500 ease-out hover:-translate-y-1 hover:border-slate-600/50 hover:bg-slate-900 hover:shadow-xl hover:shadow-black/20"
            >
              {/* Altura reduzida de h-44 para h-40 */}
              <div className="relative h-40 overflow-hidden bg-slate-900">
                <img
                  src={a.url_imagem || PLACEHOLDER_IMAGES[idx % PLACEHOLDER_IMAGES.length]}
                  alt={a.matricula}
                  // Escala mais suave na imagem (duration-700 ease-out)
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGES[idx % PLACEHOLDER_IMAGES.length]; }}
                />
                {/* Degradê mais escuro na base para integrar melhor com o fundo do card */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-90" />
                
                {/* Badge menor e mais discreta */}
               
              </div>
              
              <CardContent className="p-3.5">
                {/* Legenda com animação de movimento e cor no hover do card */}
                <div className="transition-all duration-500 ease-out group-hover:translate-x-1">
                  <p className="text-base font-bold text-slate-200 transition-colors duration-500 group-hover:text-white">
                    {a.matricula}
                  </p>
                  <p className="text-xs text-slate-500 transition-colors duration-500 group-hover:text-slate-300">
                    {[a.fabricante, a.modelo].filter(Boolean).join(" ") || "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Aircraft detail ---------------- */
function AircraftDetail({ aircraftId }: { aircraftId: string }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("visao");

  // Buscas de dados da aeronave e sub-tabelas
  const { data: aircraft } = useQuery({
    queryKey: ["ctm-aeronave", aircraftId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("aeronave")
        .select("*")
        .eq("id", aircraftId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const oas = useCtmTable("ctm_ordem_acompanhamento_servico", aircraftId, "data_entrada");
  const ras = useCtmTable("ctm_ras", aircraftId, "data_entrada");
  const componentes = useCtmTable("ctm_mapa_componente", aircraftId, "nome");
  const oleo = useCtmTable("ctm_analise_oleo", aircraftId, "data_analise");
  const diarioMes = useQuery({
    queryKey: ["ctm", "diario_mes", aircraftId],
    enabled: !!aircraftId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("diario_mes")
        .select("celula_atual_ttotal, celula_atual_tvoo, celula_prox_revisao_ttotal, celula_prox_revisao_tvoo, celula_disponivel_ttotal, celula_disponivel_tvoo")
        .eq("aeronave_id", aircraftId)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Horas de célula reais (maior célula lançada no diário de bordo)
  const celulaDiario = useQuery({
    queryKey: ["ctm", "celula-diario", aircraftId],
    enabled: !!aircraftId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lancamentos_diario_bordo")
        .select("celula, pousos_total")
        .eq("aeronave_id", aircraftId)
        .order("celula", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data ?? [])[0] as any;
    },
  });

  // Estatísticas rápidas
  const stats = useMemo(() => {
    const totalOas = (oas.data ?? []).length;
    const totalRas = (ras.data ?? []).length;
    const totalComp = (componentes.data ?? []).length;

    const celulaCandidatos = [
      Number(celulaDiario.data?.celula || 0),
      Number(aircraft?.horas_celula_atual || 0),
      Number(diarioMes.data?.celula_atual_ttotal || 0),
      Number(diarioMes.data?.celula_atual_tvoo || 0),
    ];
    const celula = Math.max(...celulaCandidatos);
    const horasCelula = celula > 0 ? `${celula.toFixed(1)}h` : "—";

    return [
      { label: "Horas Célula", value: horasCelula, icon: Clock, color: "text-amber-400" },
      { label: "Total OAS", value: String(totalOas), icon: FileText, color: "text-blue-400" },
      { label: "Total RAS", value: String(totalRas), icon: BookOpen, color: "text-indigo-400" },
      { label: "Componentes", value: String(totalComp), icon: Map, color: "text-emerald-400" },
    ];
  }, [oas.data, ras.data, componentes.data, aircraft, diarioMes.data, celulaDiario.data]);

  const horasCelulaNum = useMemo(() => {
    const c = Math.max(
      Number(celulaDiario.data?.celula || 0),
      Number(aircraft?.horas_celula_atual || 0),
      Number(diarioMes.data?.celula_atual_ttotal || 0),
    );
    return c > 0 ? c : undefined;
  }, [celulaDiario.data, aircraft, diarioMes.data]);


  const pecas = useMemo(() => {
    return (ras.data ?? []).flatMap((r: any) => r.pecas_trocadas || []);
  }, [ras.data]);

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <Button
        variant="ghost"
        size="sm"
        className="group -ml-2 gap-2 text-slate-400 transition-colors duration-300 hover:bg-slate-900 hover:text-white"
        onClick={() => navigate("/ctm")}
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
        Voltar para aeronaves
      </Button>

      {/* Header Principal da Aeronave */}
      <Card className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/70 backdrop-blur-md shadow-xl transition-all duration-300 hover:border-slate-700/60">
        <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          
          {/* Informações da Aeronave */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner transition-transform duration-500 hover:scale-105">
              <Plane className="h-7 w-7" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">{aircraft?.matricula ?? "—"}</h1>
              </div>
              <p className="text-sm font-medium text-slate-400">
                {[aircraft?.fabricante, aircraft?.modelo].filter(Boolean).join(" ")}
                {aircraft?.ano ? ` · ${aircraft.ano}` : ""}
              </p>
              {aircraft?.numero_serie && (
                <p className="text-xs font-mono text-slate-500">
                  S/N: <span className="text-slate-400">{aircraft.numero_serie}</span>
                </p>
              )}
            </div>
          </div>

          {/* Grid de Estatísticas / Métricas */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="group rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 transition-all duration-300 hover:border-slate-700/80 hover:bg-slate-900/80 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <s.icon className={cn("h-4 w-4 transition-transform duration-300 group-hover:scale-110", s.color)} />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
                </div>
                <p className="mt-1 text-lg font-bold text-white tracking-tight">{s.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navegação por Abas (Tabs) com Scroll Suave */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all duration-300 ease-out",
                isActive
                  ? "border-primary/50 bg-primary/10 text-primary shadow-sm shadow-primary/10 font-semibold"
                  : "border-slate-800/60 bg-slate-950/40 text-slate-400 hover:border-slate-700/60 hover:bg-slate-900/60 hover:text-slate-200"
              )}
            >
              <t.icon className={cn("h-3.5 w-3.5 transition-colors", isActive ? "text-primary" : "text-slate-400")} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo das Abas */}
      <div className="space-y-3 transition-all duration-300">
        {tab === "visao" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border border-slate-800/70 bg-slate-950/60 backdrop-blur-sm shadow-md">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between pb-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">OAS Recentes</h2>
                  <Badge variant="outline" className="border-slate-800 text-[10px] text-slate-400">Últimas 5</Badge>
                </div>
                {(oas.data ?? []).slice(0, 5).map((o: any) => (
                  <Row key={o.id} title={`OAS #${o.numero ?? "—"}`} subtitle={`${o.tipo_manutencao ?? "—"} · ${o.oficina_nome ?? "N/A"}`} right={<StatusBadge status={o.status} />} />
                ))}
                {!(oas.data ?? []).length && <EmptyState text="Nenhuma OAS registrada" />}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-800/70 bg-slate-950/60 backdrop-blur-sm shadow-md">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between pb-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">RAS Recentes</h2>
                  <Badge variant="outline" className="border-slate-800 text-[10px] text-slate-400">Últimos 5</Badge>
                </div>
                {(ras.data ?? []).slice(0, 5).map((r: any) => (
                  <Row key={r.id} title={`RAS #${r.numero ?? "—"}`} subtitle={`${r.tipo_manutencao ?? "—"} · ${brl(r.total_geral)}`} right={<StatusBadge status={r.status} />} />
                ))}
                {!(ras.data ?? []).length && <EmptyState text="Nenhum RAS registrado" />}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "programa" && (
          <ControleManutencaoTab
            aircraftId={aircraftId}
            registration={aircraft?.matricula}
            horasCelula={horasCelulaNum ?? aircraft?.horas_celula_atual}
          />
        )}

        {tab === "medias" && (
          <MediasAeronavesTab aircraftId={aircraftId} registration={aircraft?.matricula ?? ""} />
        )}

        {tab === "orcamentos" && <OrcamentosTab aircraftId={aircraftId} />}

        {tab === "oas" && <OASTab aircraftId={aircraftId} />}

        {tab === "ras" && <RASTab aircraftId={aircraftId} />}

        {tab === "componentes" && <MapaComponenteTab aircraftId={aircraftId} />}

        {tab === "pecas" && <PecasTab aircraftId={aircraftId} />}

        {tab === "peso" && <PesoBalanceamentoTab aircraftId={aircraftId} />}

        {tab === "rastreamento" && <RastreamentoTab aircraftId={aircraftId} />}

        {tab === "oleo" && <AnaliseOleoTab aircraftId={aircraftId} />}

        {tab === "diretrizes" && <DirectivesTab aircraftId={aircraftId} />}

        {tab === "documentos" && <DocumentosAeronaveTab aircraftId={aircraftId} />}
      </div>
    </div>
  );
}

export default function CTM() {
  const { aircraftId } = useParams();
  const navigate = useNavigate();

  const { data: aeronaves = [], isLoading: aircraftsLoading } = useQuery({
    queryKey: ["ctm-aeronaves"],
    enabled: !aircraftId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("aeronave")
        .select("id, matricula")
        .order("matricula");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  return (
    <Layout>
      <main className="flex-1 p-4 md:p-6">
        {aircraftId ? <AircraftDetail aircraftId={aircraftId} /> : <AircraftGrid />}
      </main>
    </Layout>
  );
}
