import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePickerCalendar } from "@/components/ui/date-picker-calendar";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { CalendarIcon, Search, Paperclip, CheckCircle2, Clock, XCircle, Trash2, DollarSign, ExternalLink, Upload, Loader2, FileDigit } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Cotista { id: string; nome: string; percentual: number; }

interface CentroLancamentosProps {
  aeronaveId: string;
  cotistas: Cotista[];
  aeronaveLabel?: string;
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const TIPOS_RATEIO = ["FIXO", "VARIAVEL_POR_HORA", "VARIAVEL_POR_VOO", "EXTRA"] as const;
const PERIODICIDADES = ["MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL", "EVENTUAL"] as const;

const COL_USO_WIDTH = 75;
const COL_RATEIO_WIDTH = 115;
const COTISTA_TOTAL_WIDTH = COL_USO_WIDTH + COL_RATEIO_WIDTH;

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  data: 112,
  doc: 120,
  valorDespesa: 140,
  fornecedor: 190,
  descricao: 200,
  categoria: 170,
  tipoRateio: 150,
  periodicidade: 130,
  fluxo: 96,
  pagoPor: 130,
};

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const formatNumberPTBR = (n: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const parsePTBRNumber = (s: string) => {
  if (!s) return 0;
  const cleaned = String(s).replace(/\./g, "").replace(/,/g, ".");
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const maskCurrencyInput = (raw: string) => {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  const cents = digits.slice(-2);
  const intPart = digits.slice(0, -2) || "0";
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intFormatted},${cents.padStart(2, "0")}`;
};

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s.length <= 10 ? s + "T00:00:00" : s);
  return format(d, "dd/MM/yyyy");
};

interface GrupoLancamento {
  chave: string;
  despesa_id: string | null;
  ids: string[];
  data_pagamento: string | null;
  data_vencimento: string | null;
  numero_doc: string | null;
  numero_nf: string | null;
  numero_recibo: string | null;
  numero_boleto: string | null;
  fornecedor_nome: string | null;
  descricao_despesa: string | null;
  categoria_custo: string | null;
  tipo_rateio: string | null;
  periodicidade: string | null;
  fluxo: string | null;
  pago_por: string | null;
  status: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  comprovante_url: string | null;
  recibo_url: string | null;
  nf_url: string | null;
  boleto_url: string | null;
  valor_total_despesa: number;
  rateiosPorCotista: Map<string, any>;
}

export function CentroLancamentos({ aeronaveId, cotistas, aeronaveLabel }: CentroLancamentosProps) {
  const qc = useQueryClient();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [busca, setBusca] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
  const [resizing, setResizing] = useState<{ key: string; startX: number; startWidth: number } | null>(null);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const [tableWidth, setTableWidth] = useState<number>(0);

  useLayoutEffect(() => {
    const update = () => {
      if (tableRef.current) setTableWidth(tableRef.current.scrollWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    if (tableRef.current) ro.observe(tableRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  });

  useEffect(() => {
    if (!resizing) return;
    const onMove = (event: MouseEvent) => {
      const nextWidth = Math.max(80, Math.min(400, resizing.startWidth + (event.clientX - resizing.startX)));
      setColumnWidths((prev) => ({ ...prev, [resizing.key]: nextWidth }));
    };
    const onUp = () => setResizing(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing]);

  const handleDragStart = (clientX: number) => {
    isDraggingRef.current = true;
    dragStartXRef.current = clientX;
    dragStartScrollLeftRef.current = bottomScrollRef.current?.scrollLeft ?? 0;
  };

  const handleDragMove = (clientX: number) => {
    if (!isDraggingRef.current || !bottomScrollRef.current) return;
    const delta = clientX - dragStartXRef.current;
    bottomScrollRef.current.scrollLeft = dragStartScrollLeftRef.current - delta;
  };

  const handleDragEnd = () => { isDraggingRef.current = false; };

  const getColumnWidth = (key: string) => columnWidths[key] ?? DEFAULT_COLUMN_WIDTHS[key] ?? 140;

  const { data: rateios = [], isLoading } = useQuery({
    queryKey: ["centro-lancamentos", aeronaveId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rateio_despesas")
        .select("*")
        .eq("aeronave_id", aeronaveId)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!aeronaveId,
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-combo"],
    queryFn: async () => {
      const [fav, comb] = await Promise.all([
        supabase.from("fornecedores_favoritos" as any).select("id, nome_completo, categoria").eq("categoria", "share").order("nome_completo"),
        supabase.from("fornecedores_combustivel" as any).select("id, nome_fornecedor").order("nome_fornecedor"),
      ]);
      const items: { id: string; label: string }[] = [];
      (fav.data || []).forEach((f: any) => items.push({ id: f.nome_completo, label: f.nome_completo }));
      (comb.data || []).forEach((f: any) => items.push({ id: f.nome_fornecedor, label: f.nome_fornecedor }));
      const map = new Map<string, { id: string; label: string }>();
      items.forEach((i) => i.label && map.set(i.label, i));
      return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-combo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_configu" as any).select("id, expense_type").order("expense_type");
      if (error) throw error;
      return (data || []).filter((c: any) => c?.id && c?.expense_type).map((c: any) => ({ id: c.id, label: String(c.expense_type).trim() })).sort((a, b) => a.label.localeCompare(b.label));
    },
  });

  const { data: pagadores = [] } = useQuery({
    queryKey: ["pagadores-combo"],
    queryFn: async () => {
      const [clientesRes, sociosRes] = await Promise.all([
        supabase.from("clientes" as any).select("id, razao_social, proprietario").order("razao_social"),
        supabase.from("socios" as any).select("id, nome").order("nome"),
      ]);
      const items: { id: string; label: string }[] = [];
      (clientesRes.data || []).forEach((cliente: any) => {
        const nome = cliente.razao_social || cliente.proprietario || "Cliente";
        if (nome) items.push({ id: nome, label: nome });
      });
      (sociosRes.data || []).forEach((socio: any) => {
        const nome = socio.nome;
        if (nome) items.push({ id: nome, label: nome });
      });
      return Array.from(new Map(items.map((item) => [item.id, item])).values()).sort((a, b) => a.label.localeCompare(b.label));
    },
  });

  const grupos = useMemo<GrupoLancamento[]>(() => {
    const map = new Map<string, GrupoLancamento>();
    (rateios as any[]).forEach((r: any) => {
      const chave = r.despesa_id || r.id;
      if (!map.has(chave)) {
        map.set(chave, {
          chave,
          despesa_id: r.despesa_id || null,
          ids: [],
          data_pagamento: r.data_pagamento,
          data_vencimento: r.data_vencimento,
          numero_doc: r.numero_doc,
          numero_nf: r.numero_nf ?? null,
          numero_recibo: r.numero_recibo ?? null,
          numero_boleto: r.numero_boleto ?? null,
          fornecedor_nome: r.fornecedor_nome,
          descricao_despesa: r.descricao_despesa,
          categoria_custo: r.categoria_custo,
          tipo_rateio: r.tipo_rateio,
          periodicidade: r.periodicidade,
          fluxo: r.fluxo,
          pago_por: r.pago_por,
          status: r.status ?? null,
          forma_pagamento: r.forma_pagamento ?? null,
          observacoes: r.observacoes ?? null,
          comprovante_url: r.comprovante_url ?? null,
          recibo_url: r.recibo_url ?? null,
          nf_url: r.nf_url ?? null,
          boleto_url: r.boleto_url ?? null,
          valor_total_despesa: Number(r.valor_total_despesa) || 0,
          rateiosPorCotista: new Map(),
        });
      }
      const g = map.get(chave)!;
      g.ids.push(r.id);
      if (r.cliente_id) g.rateiosPorCotista.set(r.cliente_id, r);
      if (r.socio_id) g.rateiosPorCotista.set(r.socio_id, r);
    });
    return Array.from(map.values());
  }, [rateios]);

  const gruposFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return grupos
      .filter((g) => {
        const ref = g.data_pagamento || g.data_vencimento;
        if (ref) {
          const d = new Date(ref + "T00:00:00");
          if (d.getMonth() + 1 !== mes || d.getFullYear() !== ano) return false;
        } else return false;
        if (q) {
          const t = [g.descricao_despesa, g.fornecedor_nome, g.numero_doc, g.categoria_custo].filter(Boolean).join(" ").toLowerCase();
          if (!t.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date((a.data_pagamento || a.data_vencimento || "") + "T00:00:00");
        const dateB = new Date((b.data_pagamento || b.data_vencimento || "") + "T00:00:00");
        const valA = Number.isNaN(dateA.getTime()) ? 0 : dateA.getTime();
        const valB = Number.isNaN(dateB.getTime()) ? 0 : dateB.getTime();

        if (valA === valB) {
          const keyA = a.despesa_id || a.chave || a.ids[0] || "";
          const keyB = b.despesa_id || b.chave || b.ids[0] || "";
          const cmp = keyA.localeCompare(keyB);
          return sortDirection === "asc" ? cmp : -cmp;
        }
        return sortDirection === "asc" ? valA - valB : valB - valA;
      });
  }, [grupos, mes, ano, busca, sortDirection]);

  const totalPeriodo = gruposFiltrados.reduce((s, g) => s + g.valor_total_despesa, 0);
  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - i);

  async function updateGrupo(g: GrupoLancamento, patch: Record<string, any>) {
    const { error } = await (supabase as any).from("rateio_despesas").update(patch).in("id", g.ids);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Atualizado");
    qc.invalidateQueries({ queryKey: ["centro-lancamentos", aeronaveId] });
  }

  const getCellStyles = (key: string) => ({
    width: getColumnWidth(key),
    minWidth: getColumnWidth(key),
    maxWidth: getColumnWidth(key)
  });

  return (
    <div className="space-y-4">
      <style>{`
        .centro-lancamentos-scrollbar::-webkit-scrollbar { height: 8px; }
        .centro-lancamentos-scrollbar::-webkit-scrollbar-track { background: rgba(226, 232, 240, 0.7); }
        .centro-lancamentos-scrollbar::-webkit-scrollbar-thumb { background: rgba(37, 99, 235, 0.8); border-radius: 999px; }
        .centro-lancamentos-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(37, 99, 235, 1); }
      `}</style>

      {/* Header + filtros */}
      <div className="rounded-2xl bg-card/40 backdrop-blur-md border border-border/40 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight" style={{ marginTop: '1px', marginBottom: '1px', paddingTop: '2px', paddingBottom: '2px' }}>Centro de Lançamentos</h2>
              <p className="text-xs text-muted-foreground" style={{ fontSize: '14px', marginTop: '8px', marginBottom: '8px' }}>
                {MESES[mes - 1]}/{ano} {aeronaveLabel ? ` · ${aeronaveLabel}` : ""} · {gruposFiltrados.length} lançamento(s)
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Total do Período</p>
            <p className="text-2xl font-bold" style={{ fontFamily: 'AR One Sans, sans-serif' }}>{formatBRL(totalPeriodo)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-40 h-10 bg-background/60 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-28 h-10 bg-background/60 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[260px] max-w-md" style={{ paddingLeft: '3px', paddingRight: '3px', marginLeft: '25px', marginRight: '25px', marginTop: '14px', marginBottom: '14px', paddingTop: '1px', paddingBottom: '1px' }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, fornecedor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-10 bg-background/60 rounded-xl w-full"
            />
          </div>
        </div>
      </div>

      {/* Tabela Clean - Sem divs desnecessárias causando scrolls duplos */}
      <div className="rounded-2xl bg-card/40 backdrop-blur-md border border-border/40 overflow-hidden shadow-sm w-full">
        <div
          ref={topScrollRef}
          onScroll={() => { if (bottomScrollRef.current && topScrollRef.current) bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft; }}
          className="centro-lancamentos-scrollbar overflow-x-auto overflow-y-hidden border-b border-border/40 bg-muted/20 sticky top-0 z-20"
        >
          <div style={{ width: tableWidth, height: 1 }} />
        </div>
        <div
          ref={bottomScrollRef}
          onMouseDown={(event) => {
            if ((event.target as HTMLElement).closest("[data-no-drag], input, select, button, [role='combobox']")) return;
            handleDragStart(event.clientX);
            event.preventDefault();
          }}
          onMouseMove={(event) => handleDragMove(event.clientX)}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onScroll={() => { if (topScrollRef.current && bottomScrollRef.current) topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft; }}
          className="centro-lancamentos-scrollbar overflow-x-auto cursor-grab active:cursor-grabbing select-none"
        >
          <table ref={tableRef} className="w-full text-xs text-left" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr className="bg-muted/40 border-b border-border/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="relative px-3 py-2.5 font-semibold" style={getCellStyles("data")}>
                  <button type="button" onClick={() => setSortDirection((v) => (v === "desc" ? "asc" : "desc"))} className="flex items-center gap-1 font-semibold hover:text-foreground transition-colors">
                    <span>Data</span> <span className="text-[10px]">{sortDirection === "desc" ? "↓" : "↑"}</span>
                  </button>
                  <ResizeHandle columnKey="data" startWidth={getColumnWidth("data")} setResizing={setResizing} />
                </th>
                <th className="relative px-3 py-2.5 font-semibold" style={getCellStyles("doc")}>
                  Doc <ResizeHandle columnKey="doc" startWidth={getColumnWidth("doc")} setResizing={setResizing} />
                </th>
                <th className="relative px-3 py-2.5 font-semibold" style={getCellStyles("valorDespesa")}>
                  Valor <ResizeHandle columnKey="valorDespesa" startWidth={getColumnWidth("valorDespesa")} setResizing={setResizing} />
                </th>
                <th className="relative px-3 py-2.5 font-semibold" style={getCellStyles("fornecedor")}>
                  Fornecedor <ResizeHandle columnKey="fornecedor" startWidth={getColumnWidth("fornecedor")} setResizing={setResizing} />
                </th>
                <th className="relative px-3 py-2.5 font-semibold" style={getCellStyles("descricao")}>
                  Descrição <ResizeHandle columnKey="descricao" startWidth={getColumnWidth("descricao")} setResizing={setResizing} />
                </th>
                <th className="relative px-3 py-2.5 font-semibold" style={getCellStyles("categoria")}>
                  Categoria <ResizeHandle columnKey="categoria" startWidth={getColumnWidth("categoria")} setResizing={setResizing} />
                </th>
                <th className="relative px-3 py-2.5 font-semibold" style={getCellStyles("tipoRateio")}>
                  Tipo de Rateio <ResizeHandle columnKey="tipoRateio" startWidth={getColumnWidth("tipoRateio")} setResizing={setResizing} />
                </th>
                <th className="relative px-3 py-2.5 font-semibold" style={getCellStyles("periodicidade")}>
                  Periodicidade <ResizeHandle columnKey="periodicidade" startWidth={getColumnWidth("periodicidade")} setResizing={setResizing} />
                </th>
                <th className="relative px-3 py-2.5 text-center font-semibold" style={getCellStyles("fluxo")}>
                  Fluxo <ResizeHandle columnKey="fluxo" startWidth={getColumnWidth("fluxo")} setResizing={setResizing} />
                </th>
                <th className="relative px-3 py-2.5 font-semibold" style={getCellStyles("pagoPor")}>
                  Pago Por <ResizeHandle columnKey="pagoPor" startWidth={getColumnWidth("pagoPor")} setResizing={setResizing} />
                </th>

                {cotistas.map((c) => (
                  <th key={c.id} colSpan={2} className="px-3 py-2 text-center font-semibold border-l border-border/40" style={{ width: COTISTA_TOTAL_WIDTH, minWidth: COTISTA_TOTAL_WIDTH, maxWidth: COTISTA_TOTAL_WIDTH }}>
                    <div className="text-[11px] font-bold text-foreground truncate uppercase">{c.nome || c.id}</div>
                    <div className="text-[9px] font-normal tracking-wide">{c.percentual}% cota</div>
                  </th>
                ))}
              </tr>
              <tr className="bg-muted/20 border-b border-border/40 text-[10px] text-muted-foreground uppercase">
                <th colSpan={10} />
                {cotistas.map((c) => (
                  <Fragment key={c.id}>
                    <th className="px-2 py-1 text-center border-l border-border/40 font-medium bg-muted/10" style={{ width: COL_USO_WIDTH, minWidth: COL_USO_WIDTH, maxWidth: COL_USO_WIDTH }}>% Uso</th>
                    <th className="px-2 py-1 text-right font-medium bg-muted/10" style={{ width: COL_RATEIO_WIDTH, minWidth: COL_RATEIO_WIDTH, maxWidth: COL_RATEIO_WIDTH }}>Rateio</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {isLoading ? (
                <tr><td colSpan={10 + cotistas.length * 2} className="px-4 py-8 text-center text-muted-foreground">Carregando lançamentos...</td></tr>
              ) : gruposFiltrados.length === 0 ? (
                <tr><td colSpan={10 + cotistas.length * 2} className="px-4 py-8 text-center text-muted-foreground">Nenhum lançamento encontrado no período.</td></tr>
              ) : (
                gruposFiltrados.map((g) => (
                  <LinhaGrupo
                    key={g.chave}
                    g={g}
                    cotistas={cotistas}
                    fornecedores={fornecedores}
                    categorias={categorias}
                    pagadores={pagadores}
                    getCellStyles={getCellStyles}
                    onUpdate={(patch) => updateGrupo(g, patch)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ResizeHandle({ columnKey, startWidth, setResizing }: { columnKey: string; startWidth: number; setResizing: any }) {
  return (
    <div
      data-no-drag
      role="separator"
      tabIndex={0}
      className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/20 z-10 transition-colors"
      onMouseDown={(event) => {
        event.preventDefault();
        setResizing({ key: columnKey, startX: event.clientX, startWidth });
      }}
    />
  );
}

function LinhaGrupo({
  g, cotistas, fornecedores, categorias, pagadores, getCellStyles, onUpdate,
}: {
  g: GrupoLancamento;
  cotistas: Cotista[];
  fornecedores: { id: string; label: string }[];
  categorias: { id: string; label: string }[];
  pagadores: { id: string; label: string }[];
  getCellStyles: (key: string) => React.CSSProperties;
  onUpdate: (patch: Record<string, any>) => Promise<void> | void;
}) {
  const qc = useQueryClient();
  const [openDate, setOpenDate] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [doc, setDoc] = useState(g.numero_doc || "");
  const [desc, setDesc] = useState(g.descricao_despesa || "");
  const [valorDespesa, setValorDespesa] = useState(() => formatNumberPTBR(Number(g.valor_total_despesa ?? 0)));
  const valorInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setDoc(g.numero_doc || ""); }, [g.numero_doc]);
  useEffect(() => { setDesc(g.descricao_despesa || ""); }, [g.descricao_despesa]);
  useEffect(() => { setValorDespesa(formatNumberPTBR(Number(g.valor_total_despesa ?? 0))); }, [g.valor_total_despesa]);

  const dataRef = g.data_pagamento || g.data_vencimento;
  const categoriaSelecionada = useMemo(() => {
    const raw = String(g.categoria_custo ?? "").trim();
    if (!raw) return "";
    const byId = categorias.find((item) => item.id === raw);
    if (byId) return byId.id;
    const byLabel = categorias.find((item) => item.label.toLowerCase() === raw.toLowerCase());
    return byLabel?.id ?? "";
  }, [categorias, g.categoria_custo]);

  const status = (g.status || "pendente").toLowerCase();
  const isPago = status === "pago" || status === "pagamento_validado";

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement;
    // Otimizada para ignorar todos os cliques em popovers, selects e inputs do Radix
    if (target.closest("input, button, select, [role='combobox'], [role='option'], [role='dialog'], [data-radix-popper-content-wrapper], [data-no-drag], a")) return;
    setExpanded((v) => !v);
  };

  const handleExcluir = async () => {
    const { error } = await (supabase as any).from("rateio_despesas").delete().in("id", g.ids);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Lançamento excluído");
    setShowDeleteConfirm(false);
    qc.invalidateQueries();
  };

  return (
    <>
      <tr className={cn("hover:bg-primary/5 transition-colors cursor-pointer group", expanded && "bg-primary/5 border-b-transparent")} onClick={handleRowClick}>
        <td className="px-2 py-1.5 overflow-hidden" style={getCellStyles("data")}>
          <Popover open={openDate} onOpenChange={setOpenDate}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 w-full justify-start font-normal text-xs overflow-hidden">
                <CalendarIcon className="h-3.5 w-3.5 mr-1.5 shrink-0 opacity-70" />
                <span className="truncate">{fmtDate(dataRef)}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0 border-0 z-[9999] shadow-xl">
              <DatePickerCalendar
                value={dataRef ? new Date(dataRef + "T00:00:00") : undefined}
                onChange={(d) => {
                  if (!d) return;
                  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                  onUpdate({ data_pagamento: iso, data_vencimento: iso });
                  setOpenDate(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </td>

        <td className="px-2 py-1.5 overflow-hidden" style={getCellStyles("doc")}>
          <Input value={doc} onChange={(e) => setDoc(e.target.value)} onBlur={() => { if (doc !== (g.numero_doc || "")) onUpdate({ numero_doc: doc || null }); }} className="h-8 text-xs font-mono w-full" />
        </td>

        <td className="px-2 py-1.5 overflow-hidden" style={getCellStyles("valorDespesa")}>
          <div className="relative w-full">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">R$</span>
            <Input
              ref={valorInputRef}
              type="text"
              inputMode="decimal"
              value={valorDespesa}
              onChange={(e) => {
                const input = e.target as HTMLInputElement;
                const raw = input.value;
                const selStart = input.selectionStart ?? raw.length;
                const digitsLeft = raw.slice(0, selStart).replace(/\D/g, "").length;
                const formatted = maskCurrencyInput(raw.replace(/\D/g, ""));
                setValorDespesa(formatted);
                let digitCount = 0, newPos = formatted.length;
                for (let i = 0; i < formatted.length; i++) {
                  if (/\d/.test(formatted[i])) digitCount++;
                  if (digitCount >= digitsLeft) { newPos = i + 1; break; }
                }
                requestAnimationFrame(() => { try { valorInputRef.current?.setSelectionRange(newPos, newPos); } catch { } });
              }}
              onBlur={() => {
                const normalized = parsePTBRNumber(valorDespesa);
                if (normalized !== Number(g.valor_total_despesa ?? 0)) onUpdate({ valor_total_despesa: normalized });
                setValorDespesa(formatNumberPTBR(normalized));
              }}
              className="h-8 text-xs font-mono pl-7 w-full font-bold"
              placeholder="0,00"
            />
          </div>
        </td>

        <td className="px-2 py-1.5 overflow-hidden" style={getCellStyles("fornecedor")}>
          <div className="w-full overflow-hidden [&>button]:w-full [&>button]:truncate [&>button]:h-8 [&>button]:text-xs">
            <SearchableCombobox items={fornecedores} value={g.fornecedor_nome || ""} onChange={(_id, label) => onUpdate({ fornecedor_nome: label })} placeholder="Fornecedor..." searchPlaceholder="Buscar..." allowFreeText />
          </div>
        </td>

        <td className="px-2 py-1.5 overflow-hidden" style={getCellStyles("descricao")}>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => { if (desc !== (g.descricao_despesa || "")) onUpdate({ descricao_despesa: desc }); }} className="h-8 text-xs w-full" />
        </td>

        <td className="px-2 py-1.5 overflow-hidden" style={getCellStyles("categoria")}>
          <div className="w-full overflow-hidden [&>button]:w-full [&>button]:truncate [&>button]:h-8 [&>button]:text-xs">
            <SearchableCombobox items={categorias} value={categoriaSelecionada} onChange={(id) => onUpdate({ categoria_custo: id || null })} placeholder="Categoria..." searchPlaceholder="Buscar..." allowFreeText={false} />
          </div>
        </td>

        <td className="px-2 py-1.5 overflow-hidden" style={getCellStyles("tipoRateio")}>
          <Select value={g.tipo_rateio || ""} onValueChange={(v) => onUpdate({ tipo_rateio: v })}>
            <SelectTrigger className="h-8 text-xs w-full [&>span]:truncate"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{TIPOS_RATEIO.map((t) => <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
        </td>

        <td className="px-2 py-1.5 overflow-hidden" style={getCellStyles("periodicidade")}>
          <Select value={(g.periodicidade || "").toUpperCase()} onValueChange={(v) => onUpdate({ periodicidade: v })}>
            <SelectTrigger className="h-8 text-xs w-full [&>span]:truncate"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{PERIODICIDADES.map((p) => <SelectItem key={p} value={p} className="text-xs">{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
          </Select>
        </td>

        <td className="px-2 py-1.5 overflow-hidden text-center" style={getCellStyles("fluxo")}>
          <Select value={(g.fluxo || "").toUpperCase()} onValueChange={(v) => onUpdate({ fluxo: v })}>
            <SelectTrigger className="h-8 text-xs w-full [&>span]:truncate"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ENTRADA" className="text-xs">Entrada</SelectItem>
              <SelectItem value="SAIDA" className="text-xs">Saída</SelectItem>
            </SelectContent>
          </Select>
        </td>

        <td className="px-2 py-1.5 overflow-hidden" style={getCellStyles("pagoPor")}>
          <div className="w-full overflow-hidden [&>button]:w-full [&>button]:truncate [&>button]:h-8 [&>button]:text-xs">
            <SearchableCombobox items={pagadores} value={g.pago_por || ""} onChange={(_id, label) => onUpdate({ pago_por: label })} placeholder="Pagador..." searchPlaceholder="Buscar..." allowFreeText />
          </div>
        </td>

        {cotistas.map((c) => {
          const r = g.rateiosPorCotista.get(c.id);
          const pctUso = r ? (Number(r.percentual_uso) || Number(r.percentual_sociedade) || 0) : 0;
          const rateado = r ? Number(r.valor_rateado) || 0 : 0;
          return (
            <Fragment key={c.id}>
              <td className="px-2 py-1.5 text-center border-l border-border/40 text-[11px] font-medium text-muted-foreground bg-muted/5 overflow-hidden" style={{ width: COL_USO_WIDTH, minWidth: COL_USO_WIDTH, maxWidth: COL_USO_WIDTH }}>
                {r ? `${pctUso.toFixed(2)}%` : "—"}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-[11px] bg-muted/5 overflow-hidden pr-3" style={{ width: COL_RATEIO_WIDTH, minWidth: COL_RATEIO_WIDTH, maxWidth: COL_RATEIO_WIDTH }}>
                {r ? (
                  <div className="flex flex-col items-end w-full">
                    <span className="font-semibold text-foreground">{formatBRL(rateado)}</span>
                    {Number(r.valor_pago_real || 0) > 0 && (
                      <span className="text-[9px] text-emerald-500/80 leading-tight block truncate w-full text-right mt-0.5">
                        Pago: {formatBRL(Number(r.valor_pago_real || 0))}
                      </span>
                    )}
                  </div>
                ) : "—"}
              </td>
            </Fragment>
          );
        })}
      </tr>

      {/* Card Expandido focado apenas até a 9ª Coluna (Fluxo) */}
      {expanded && (
        <tr className="bg-muted/5">
          <td colSpan={9} className="p-0 border-b border-primary/20 align-top bg-gradient-to-b from-primary/5 to-transparent/5">
            <div className="px-5 py-4 animate-in slide-in-from-top-2 duration-200 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
                <div className="flex-1 min-w-[280px] w-full space-y-3">
                  <div className="flex items-center gap-2">
                    {isPago ? (
                      <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/30 gap-1.5 px-2.5 py-0.5 rounded-md shadow-sm"><CheckCircle2 className="h-3.5 w-3.5" /> Pago</Badge>
                    ) : status === "cancelado" ? (
                      <Badge className="bg-red-500/15 text-red-500 hover:bg-red-500/20 border-red-500/30 gap-1.5 px-2.5 py-0.5 rounded-md shadow-sm"><XCircle className="h-3.5 w-3.5" /> Cancelado</Badge>
                    ) : (
                      <Badge className="bg-amber-500/15 text-amber-500 hover:bg-amber-500/20 border-amber-500/30 gap-1.5 px-2.5 py-0.5 rounded-md shadow-sm"><Clock className="h-3.5 w-3.5" /> Pendente</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider ml-2">Detalhes Financeiros</span>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-background/50 border border-border/40 p-3 rounded-xl shadow-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold">Vencimento</span>
                      <span className="font-medium text-foreground">{fmtDate(g.data_vencimento)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold">Pagamento</span>
                      <span className="font-medium text-foreground">{fmtDate(g.data_pagamento)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold">Forma</span>
                      <span className="font-medium text-foreground truncate">{g.forma_pagamento || "—"}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold">Valor Total</span>
                      <span className="font-mono text-[13px] font-bold text-primary">{formatBRL(g.valor_total_despesa)}</span>
                    </div>
                  </div>

                  {g.observacoes && (
                    <div className="text-xs bg-background/30 p-2.5 rounded-lg border border-border/20 text-muted-foreground/90 italic">
                      <span className="font-semibold not-italic mr-1">Obs:</span> {g.observacoes}
                    </div>
                  )}
                </div>

                <div className="flex-[1.2] min-w-[280px] w-full">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5 mb-2.5 pl-1">
                    <Paperclip className="h-3.5 w-3.5" /> Anexos e Documentos
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <AnexoPill label="Nota Fiscal" numero={g.numero_nf} url={g.nf_url} />
                    <AnexoPill label="Recibo" numero={g.numero_recibo} url={g.recibo_url} />
                    <AnexoPill label="Boleto" numero={g.numero_boleto} url={g.boleto_url} />
                    <AnexoPill label="Documento" numero={g.numero_doc} url={null} />
                    <AnexoPill label="Comprovante" numero={null} url={g.comprovante_url} />
                  </div>
                </div>

                <div className="min-w-[140px] flex flex-col gap-2 border-l border-border/30 pl-6 shrink-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Ações</div>
                  {!isPago ? (
                    <Button size="sm" onClick={() => setShowPayDialog(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-8 text-[11px] w-full justify-start shadow-sm">
                      <DollarSign className="h-3.5 w-3.5" /> Quitar Lançamento
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setShowPayDialog(true)} className="gap-2 h-8 text-[11px] w-full justify-start shadow-sm">
                        <FileDigit className="h-3.5 w-3.5" /> Editar Pagamento
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(true)} className="gap-2 text-red-500 hover:bg-red-500/10 hover:text-red-600 h-8 text-[11px] w-full justify-start mt-1">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                </div>
              </div>
            </div>
          </td>

          {/* Células vazias para as colunas "Pago Por" e "Cotistas" para que a estrutura visual da linha acima não seja afetada */}
          <td className="p-0 border-b border-primary/20 bg-transparent align-top" style={getCellStyles("pagoPor")}></td>
          
          {cotistas.map((c) => (
            <Fragment key={`exp-${c.id}`}>
              <td className="p-0 border-b border-primary/20 align-top border-l border-border/40 bg-transparent" style={{ width: COL_USO_WIDTH, minWidth: COL_USO_WIDTH, maxWidth: COL_USO_WIDTH }}></td>
              <td className="p-0 border-b border-primary/20 align-top bg-transparent" style={{ width: COL_RATEIO_WIDTH, minWidth: COL_RATEIO_WIDTH, maxWidth: COL_RATEIO_WIDTH }}></td>
            </Fragment>
          ))}
        </tr>
      )}

      <PagamentoDialog
        open={showPayDialog}
        onOpenChange={setShowPayDialog}
        grupo={g}
        onSaved={(savedStatus) => {
          setShowPayDialog(false);
          setExpanded(savedStatus !== "pago");
          qc.invalidateQueries();
        }}
        onUpdate={onUpdate}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação removerá todas as {g.ids.length} linha(s) de rateio associadas. Essa operação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-red-600 hover:bg-red-700 text-white">Excluir Lançamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AnexoPill({ label, numero, url }: { label: string; numero: string | null; url: string | null }) {
  const isFilled = numero || url;
  return (
    <div className={cn("flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors", isFilled ? "bg-background/60 border-border/60 hover:bg-background/80" : "bg-transparent border-border/20 opacity-60")}>
      <span className="font-medium text-muted-foreground/80">{label}</span>
      <div className="flex items-center gap-2">
        {numero && <span className="font-mono text-foreground/80 max-w-[80px] truncate" title={numero}>{numero}</span>}
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 flex items-center bg-primary/10 p-1 rounded-md" onClick={(e) => e.stopPropagation()} title="Abrir arquivo">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="text-[10px] text-muted-foreground/40 italic">Vazio</span>
        )}
      </div>
    </div>
  );
}

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
];

function PagamentoDialog({
  open, onOpenChange, grupo, onSaved, onUpdate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  grupo: GrupoLancamento;
  onSaved: (status: "pago" | "pendente") => void;
  onUpdate: (patch: Record<string, any>) => Promise<void> | void;
}) {
  const [dataPag, setDataPag] = useState(grupo.data_pagamento || new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState(grupo.forma_pagamento || "pix");
  const [status, setStatus] = useState<"pago" | "pendente">(grupo.status?.toLowerCase() === "pago" ? "pago" : "pendente");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [notaFiscal, setNotaFiscal] = useState<File | null>(null);
  const [recibo, setRecibo] = useState<File | null>(null);
  const [boleto, setBoleto] = useState<File | null>(null);
  const [documento, setDocumento] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDataPag(grupo.data_pagamento || new Date().toISOString().slice(0, 10));
      setForma(grupo.forma_pagamento || "pix");
      setStatus(grupo.status?.toLowerCase() === "pago" ? "pago" : "pendente");
      setComprovante(null);
      setNotaFiscal(null);
      setRecibo(null);
      setBoleto(null);
      setDocumento(null);
    }
  }, [open, grupo.data_pagamento, grupo.forma_pagamento]);

  const handleSalvar = async () => {
    setSaving(true);
    try {
      const uploadArquivo = async (file: File | null, tipo: string, atual: string | null) => {
        if (!file) return atual;
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        const path = `rateio-anexos/${grupo.chave}/${tipo}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("client-documents").upload(path, file, { upsert: true });
        if (error) throw error;
        return supabase.storage.from("client-documents").getPublicUrl(path).data.publicUrl;
      };
      const [comprovante_url, nf_url, recibo_url, boleto_url, documentoUrl] = await Promise.all([
        uploadArquivo(comprovante, "comprovante", grupo.comprovante_url),
        uploadArquivo(notaFiscal, "nota-fiscal", grupo.nf_url),
        uploadArquivo(recibo, "recibo", grupo.recibo_url),
        uploadArquivo(boleto, "boleto", grupo.boleto_url),
        uploadArquivo(documento, "documento", null),
      ]);
      await onUpdate({
        status,
        data_pagamento: status === "pago" ? dataPag : null,
        forma_pagamento: status === "pago" ? forma : null,
        comprovante_url,
        nf_url,
        recibo_url,
        boleto_url,
        observacoes: documentoUrl ? [grupo.observacoes, `Documento: ${documentoUrl}`].filter(Boolean).join("\n") : grupo.observacoes,
        valor_pago_real: status === "pago" ? grupo.valor_total_despesa : null,
      });
      toast.success(status === "pago" ? "Pagamento salvo" : "Lançamento atualizado como pendente");
      onSaved(status);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{grupo.status === "pago" ? "Editar pagamento" : "Registrar pagamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value: "pago" | "pendente") => setStatus(value)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Data da liquidação</Label>
            <Input type="date" value={dataPag} onChange={(e) => setDataPag(e.target.value)} disabled={status !== "pago"} className="h-9" />
          </div>
          <div className="grid gap-2">
            <Label>Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma} disabled={status !== "pago"}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Anexos do lançamento</Label>
            <Input type="file" accept="image/*,.pdf" onChange={(e) => setComprovante(e.target.files?.[0] || null)} className="h-9 text-xs file:h-full file:bg-transparent file:text-xs file:font-medium" aria-label="Comprovante" />
            <Input type="file" accept="image/*,.pdf" onChange={(e) => setNotaFiscal(e.target.files?.[0] || null)} className="h-9 text-xs file:h-full file:bg-transparent file:text-xs file:font-medium" aria-label="Nota fiscal" />
            <Input type="file" accept="image/*,.pdf" onChange={(e) => setRecibo(e.target.files?.[0] || null)} className="h-9 text-xs file:h-full file:bg-transparent file:text-xs file:font-medium" aria-label="Recibo" />
            <Input type="file" accept="image/*,.pdf" onChange={(e) => setBoleto(e.target.files?.[0] || null)} className="h-9 text-xs file:h-full file:bg-transparent file:text-xs file:font-medium" aria-label="Boleto" />
            <Input type="file" accept="image/*,.pdf" onChange={(e) => setDocumento(e.target.files?.[0] || null)} className="h-9 text-xs file:h-full file:bg-transparent file:text-xs file:font-medium" aria-label="Outro documento" />
            {grupo.comprovante_url && !comprovante && (
              <a href={grupo.comprovante_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1.5 mt-1">
                <ExternalLink className="h-3.5 w-3.5" /> Visualizar comprovante atual
              </a>
            )}
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="h-9">Cancelar</Button>
          <Button onClick={handleSalvar} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 h-9">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</> : <><Upload className="mr-2 h-4 w-4" />Confirmar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
