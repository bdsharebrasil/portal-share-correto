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
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Search, Paperclip, CheckCircle2, Clock, XCircle, Trash2, DollarSign, ExternalLink, Upload, Loader2, FileDigit, ArrowDownCircle, ArrowUpCircle, FileText, StickyNote, History, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Cotista {
  id: string;
  nome: string;
  percentual: number;
  cliente_id?: string | null;
  socio_id?: string | null;
}

interface CentroLancamentosProps {
  aeronaveId: string;
  cotistas: Cotista[];
  aeronaveLabel?: string;
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const TIPOS_RATEIO = ["FIXO", "VARIAVEL_POR_HORA", "VARIAVEL_POR_VOO", "EXTRA"] as const;
const PERIODICIDADES = ["MENSAL", "SEMESTRAL", "ANUAL", "EVENTUAL"] as const;
const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
];
const TIPOS_ANEXO = [
  { value: "comprovante", label: "Comprovante" },
  { value: "nf", label: "Nota Fiscal" },
  { value: "recibo", label: "Recibo" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro Documento" }
];

const COL_USO_WIDTH = 60;
const COL_RATEIO_WIDTH = 96;
const COTISTA_TOTAL_WIDTH = COL_USO_WIDTH + COL_RATEIO_WIDTH;

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  data: 96,
  doc: 100,
  valorDespesa: 120,
  fornecedor: 160,
  descricao: 170,
  categoria: 140,
  tipoRateio: 128,
  periodicidade: 110,
  pagoPor: 110,
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

const normalizeFluxo = (value?: string | null): "ENTRADA" | "SAIDA" => {
  const raw = String(value || "").trim().toUpperCase();
  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (normalized === "ENTRADA" || normalized === "CREDITO" || normalized === "CREDITO_COTISTA") return "ENTRADA";
  return "SAIDA";
};

const getDocumentUrls = (observacoes?: string | null) => {
  if (!observacoes) return [];
  return Array.from(new Set(observacoes.match(/https?:\/\/[^\s]+/g) || []));
};

type AnexoDoc = {
  id: string;
  tipo: string;
  numero: string;
  file: File | null;
  currentUrl: string | null;
};

interface GrupoLancamento {
  chave: string;
  despesa_id: string | null;
  fonte_despesa: string | null;
  ids: string[];
  data_emissao: string | null;
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
  abastecimentoAnexos?: {
    id: string;
    comanda_url: string | null;
    nota_url: string | null;
    boleto_url: string | null;
    comanda: string | null;
    nf: string | null;
  } | null;
}

export function CentroLancamentos({ aeronaveId, cotistas, aeronaveLabel }: CentroLancamentosProps) {
  const qc = useQueryClient();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [busca, setBusca] = useState("");
  const [fluxoFiltro, setFluxoFiltro] = useState<"TODOS" | "ENTRADA" | "SAIDA">("TODOS");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedChaves, setSelectedChaves] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
  const [resizing, setResizing] = useState<{ key: string; startX: number; startWidth: number } | null>(null);
  const [showNovoDialog, setShowNovoDialog] = useState(false);

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

    const onMove = (event: PointerEvent | MouseEvent) => {
      const clientX = "clientX" in event ? event.clientX : 0;
      const nextWidth = Math.max(80, Math.min(800, resizing.startWidth + (clientX - resizing.startX)));
      setColumnWidths((prev) => ({ ...prev, [resizing.key]: nextWidth }));
    };

    const onUp = () => setResizing(null);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove as EventListener);
    window.addEventListener("pointerup", onUp as EventListener);
    window.addEventListener("mouseup", onUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove as EventListener);
      window.removeEventListener("pointerup", onUp as EventListener);
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

  const startResize = (key: string, clientX: number, startWidth: number) => {
    setResizing({ key, startX: clientX, startWidth });
  };

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

  const travelReportIds = useMemo(() => {
    const set = new Set<string>();
    (rateios as any[]).forEach((r: any) => {
      if (r.fonte_despesa === "travel_expense_reports" && r.despesa_id) set.add(r.despesa_id);
    });
    return Array.from(set);
  }, [rateios]);

  const { data: travelReports = [] } = useQuery({
    queryKey: ["centro-lancamentos-travel-reports", travelReportIds],
    enabled: travelReportIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("travel_expense_reports")
        .select("id, pdf_url")
        .in("id", travelReportIds);
      if (error) throw error;
      return data || [];
    },
  });

  const travelReportMap = useMemo(() => {
    const m = new Map<string, string>();
    (travelReports as any[]).forEach((t: any) => { if (t.pdf_url) m.set(t.id, t.pdf_url); });
    return m;
  }, [travelReports]);

  const reciboNumeros = useMemo(() => {
    const set = new Set<string>();
    (rateios as any[]).forEach((r: any) => {
      if (r.numero_recibo) set.add(String(r.numero_recibo));
    });
    return Array.from(set);
  }, [rateios]);

  const { data: recibosData = [] } = useQuery({
    queryKey: ["centro-lancamentos-recibos", reciboNumeros],
    enabled: reciboNumeros.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("recibos")
        .select("id, numero_recibo, pdf_url")
        .in("numero_recibo", reciboNumeros);
      if (error) throw error;
      return data || [];
    },
  });

  const reciboMap = useMemo(() => {
    const m = new Map<string, { pdf_url: string | null; numero_recibo: string | null }>();
    (recibosData as any[]).forEach((r: any) => {
      if (r.numero_recibo) m.set(String(r.numero_recibo), { pdf_url: r.pdf_url || null, numero_recibo: r.numero_recibo });
    });
    return m;
  }, [recibosData]);

  const abastecimentoIds = useMemo(() => {
    const set = new Set<string>();
    (rateios as any[]).forEach((r: any) => {
      const fonte = String(r?.fonte_despesa || "").trim().toLowerCase();
      const categoria = String(r?.categoria_custo || "").trim().toLowerCase();
      const descricao = String(r?.descricao_despesa || "").trim().toLowerCase();
      const looksLikeFuel =
        fonte.includes("abaste") ||
        categoria.includes("abaste") ||
        categoria.includes("combust") ||
        descricao.includes("abaste") ||
        descricao.includes("combust");

      if (looksLikeFuel && r?.despesa_id) set.add(r.despesa_id);
    });
    return Array.from(set);
  }, [rateios]);

  const { data: abastecimentosAnexosData = [] } = useQuery({
    queryKey: ["centro-lancamentos-abastecimentos", abastecimentoIds],
    enabled: abastecimentoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("abastecimentos")
        .select("id, comanda_url, nota_url, boleto_url, comanda, nf")
        .in("id", abastecimentoIds);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const abastecimentoAnexosMap = useMemo(() => {
    const map = new Map<string, { id: string; comanda_url: string | null; nota_url: string | null; boleto_url: string | null; comanda: string | null; nf: string | null }>();
    (abastecimentosAnexosData as any[]).forEach((item: any) => {
      if (item?.id) {
        map.set(item.id, {
          id: item.id,
          comanda_url: item.comanda_url ?? null,
          nota_url: item.nota_url ?? null,
          boleto_url: item.boleto_url ?? null,
          comanda: item.comanda ?? null,
          nf: item.nf ?? null,
        });
      }
    });
    return map;
  }, [abastecimentosAnexosData]);

  const grupos = useMemo<GrupoLancamento[]>(() => {
    const map = new Map<string, GrupoLancamento>();
    (rateios as any[]).forEach((r: any) => {
      const chave = r.despesa_id || r.id;
      const fonte = String(r?.fonte_despesa || "").trim().toLowerCase();
      const categoria = String(r?.categoria_custo || "").trim().toLowerCase();
      const descricao = String(r?.descricao_despesa || "").trim().toLowerCase();
      const looksLikeFuel =
        fonte.includes("abaste") ||
        categoria.includes("abaste") ||
        categoria.includes("combust") ||
        descricao.includes("abaste") ||
        descricao.includes("combust");
      const abastecimentoAnexos = looksLikeFuel && r?.despesa_id ? abastecimentoAnexosMap.get(r.despesa_id) ?? null : null;

      if (!map.has(chave)) {
        map.set(chave, {
          chave,
          despesa_id: r.despesa_id || null,
          fonte_despesa: r.fonte_despesa || null,
          ids: [],
          data_emissao: r.data_emissao ?? r.data_pagamento ?? r.data_vencimento ?? null,
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
          fluxo: normalizeFluxo(r.fluxo),
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
          abastecimentoAnexos,
        });
      }
      const g = map.get(chave)!;
      g.ids.push(r.id);
      if (r.cliente_id) g.rateiosPorCotista.set(r.cliente_id, r);
      if (r.socio_id) g.rateiosPorCotista.set(r.socio_id, r);
    });
    return Array.from(map.values());
  }, [rateios, abastecimentoAnexosMap]);

  const gruposFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return grupos
      .filter((g) => {
        const ref = g.data_emissao || g.data_pagamento || g.data_vencimento;
        if (ref) {
          const d = new Date(ref + "T00:00:00");
          if (d.getMonth() + 1 !== mes || d.getFullYear() !== ano) return false;
        } else return false;
        if (q) {
          const categoriaLabel = categorias.find((item) => item.id === g.categoria_custo)?.label || g.categoria_custo || "";
          const t = [g.descricao_despesa, g.fornecedor_nome, g.numero_doc, categoriaLabel].filter(Boolean).join(" ").toLowerCase();
          if (!t.includes(q)) return false;
        }
        if (fluxoFiltro !== "TODOS" && normalizeFluxo(g.fluxo) !== fluxoFiltro) return false;
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(((a.data_emissao || a.data_pagamento || a.data_vencimento) || "") + "T00:00:00");
        const dateB = new Date(((b.data_emissao || b.data_pagamento || b.data_vencimento) || "") + "T00:00:00");
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
  }, [grupos, mes, ano, busca, fluxoFiltro, sortDirection, categorias]);

  const gruposParaSoma = useMemo(() => {
    if (selectedChaves.length === 0) return gruposFiltrados;
    return gruposFiltrados.filter((g) => selectedChaves.includes(g.chave));
  }, [gruposFiltrados, selectedChaves]);

  const totalPeriodo = gruposParaSoma.reduce((s, g) => s + (Number(g.valor_total_despesa) || 0), 0);

  const resumoPorFluxo = useMemo(() => {
    const normalizeFluxo = (value?: string | null) => (value || "").toUpperCase();
    const gruposPorFluxo = new Map<string, { total: number; porCotista: Map<string, number> }>([
      ["ENTRADA", { total: 0, porCotista: new Map() }],
      ["SAIDA", { total: 0, porCotista: new Map() }],
    ]);

    gruposParaSoma.forEach((g) => {
      const fluxo = normalizeFluxo(g.fluxo);
      const bucket = fluxo === "ENTRADA" ? gruposPorFluxo.get("ENTRADA") : gruposPorFluxo.get("SAIDA");
      if (!bucket) return;

      bucket.total += Number(g.valor_total_despesa) || 0;

      g.rateiosPorCotista.forEach((rateio, cotistaId) => {
        const valorRateio = Number(rateio?.valor_rateado) || 0;
        if (!valorRateio) return;
        bucket.porCotista.set(cotistaId, (bucket.porCotista.get(cotistaId) || 0) + valorRateio);
      });
    });

    return Array.from(gruposPorFluxo.entries()).map(([fluxo, dados]) => ({
      fluxo,
      total: dados.total,
      porCotista: cotistas.map((cotista) => ({
        id: cotista.id,
        nome: cotista.nome || cotista.id,
        valor: dados.porCotista.get(cotista.id) || 0,
      })).filter((item) => item.valor > 0),
    }));
  }, [gruposParaSoma, cotistas]);

  const saldoPeriodo = (resumoPorFluxo.find((r) => r.fluxo === "ENTRADA")?.total || 0) - (resumoPorFluxo.find((r) => r.fluxo === "SAIDA")?.total || 0);

  const todosVisiveisSelecionados = gruposFiltrados.length > 0 && gruposFiltrados.every((g) => selectedChaves.includes(g.chave));
  const isFiltrandoSelecao = selectedChaves.length > 0;

  const toggleSelecao = (chave: string) => {
    setSelectedChaves((prev) => (prev.includes(chave) ? prev.filter((item) => item !== chave) : [...prev, chave]));
  };

  const toggleSelecionarVisiveis = () => {
    setSelectedChaves((prev) => {
      const next = new Set(prev);
      if (todosVisiveisSelecionados) {
        gruposFiltrados.forEach((g) => next.delete(g.chave));
      } else {
        gruposFiltrados.forEach((g) => next.add(g.chave));
      }
      return Array.from(next);
    });
  };

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - i);

  async function updateGrupo(g: GrupoLancamento, patch: Record<string, any>) {
    const { error } = await (supabase as any).from("rateio_despesas").update(patch).in("id", g.ids);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }

    if (g.despesa_id) {
      const movPatch: Record<string, any> = {};
      
      // Update the original value requested based on rateio or total fallback
      if (patch.valor_rateado !== undefined && patch.valor_rateado !== null) {
        movPatch.valor_original = patch.valor_rateado;
      } else if (patch.valor_total_despesa !== undefined && patch.valor_total_despesa !== null) {
        movPatch.valor_original = patch.valor_total_despesa;
      }
      
      if (Object.prototype.hasOwnProperty.call(patch, "valor_pago_real")) {
        movPatch.valor = patch.valor_pago_real ?? patch.valor_total_despesa ?? g.valor_total_despesa;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "data_pagamento")) {
        movPatch.data_pagamento = patch.data_pagamento;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "forma_pagamento")) {
        movPatch.forma_pagamento = patch.forma_pagamento;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "status")) {
        movPatch.status = patch.status;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "numero_doc")) {
        movPatch.numero_doc = patch.numero_doc;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "numero_nf")) {
        movPatch.numero_nf = patch.numero_nf;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "numero_recibo")) {
        movPatch.numero_recibo = patch.numero_recibo;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "observacoes")) {
        movPatch.observacoes = patch.observacoes;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "data_vencimento")) {
        movPatch.data_vencimento = patch.data_vencimento;
      }
      
      if (Object.keys(movPatch).length > 0) {
        const { error: movError } = await (supabase as any).from("movimentacoes").update(movPatch).eq("id", g.despesa_id);
        if (movError) console.warn("Erro ao sincronizar movimentacao do rateio:", movError.message);
      }
    }

    qc.invalidateQueries({ queryKey: ["centro-lancamentos", aeronaveId] });
    toast.success("Atualizado");
  }

  const getCellStyles = (key: string) => ({
    width: getColumnWidth(key),
    minWidth: getColumnWidth(key),
    maxWidth: getColumnWidth(key)
  });

  return (
    <div className="space-y-5">
      <style>{`
        .centro-lancamentos-scrollbar::-webkit-scrollbar { height: 8px; }
        .centro-lancamentos-scrollbar::-webkit-scrollbar-track { background: hsl(var(--muted) / 0.5); }
        .centro-lancamentos-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 999px; }
        .centro-lancamentos-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.5); }
        .centro-lancamentos-table th,
        .centro-lancamentos-table td {
          border-right: 1px solid hsl(var(--border) / 0.5);
        }
        .centro-lancamentos-table th:last-child,
        .centro-lancamentos-table td:last-child {
          border-right: none;
        }
        .centro-lancamentos-table thead th {
          background: hsl(var(--muted) / 0.55);
          color: hsl(var(--muted-foreground));
          font-weight: 600;
          letter-spacing: 0.07em;
        }
        .centro-lancamentos-table tbody tr:nth-child(even) {
          background-color: hsl(var(--muted) / 0.25);
        }
      `}</style>

      <div className="flex items-start justify-between gap-6 flex-wrap border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-9 w-1 rounded-full bg-primary" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">Gestão Financeira</p>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Centro de Lançamentos</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {MESES[mes - 1]}/{ano}{aeronaveLabel ? ` · ${aeronaveLabel}` : ""} · 
              {isFiltrandoSelecao ? (
                <span className="font-semibold text-primary ml-1">{selectedChaves.length} de {gruposFiltrados.length} selecionado(s)</span>
              ) : (
                <span className="ml-1">{gruposFiltrados.length} lançamento(s)</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-stretch gap-3">
          <div className={cn(
            "rounded-lg border px-4 py-2.5 text-right min-w-[150px] transition-colors",
            isFiltrandoSelecao ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-border"
          )}>
            <p className={cn(
              "text-[10px] uppercase tracking-wider font-semibold transition-colors",
              isFiltrandoSelecao ? "text-primary/80" : "text-muted-foreground"
            )}>
              {isFiltrandoSelecao ? "Total Selecionado" : "Total do Período"}
            </p>
            <p className="text-xl font-bold font-mono tabular-nums text-foreground">{formatBRL(totalPeriodo)}</p>
          </div>
          <div className={cn(
            "rounded-lg border px-4 py-2.5 text-right min-w-[150px] transition-colors",
            isFiltrandoSelecao
              ? (saldoPeriodo >= 0 ? "border-emerald-500/50 bg-emerald-500/10" : "border-rose-500/50 bg-rose-500/10")
              : (saldoPeriodo >= 0 ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-rose-500/25 bg-rose-500/[0.06]")
          )}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {isFiltrandoSelecao ? "Saldo Selecionado" : "Saldo do Período"}
            </p>
            <p className={cn("text-xl font-bold font-mono tabular-nums", saldoPeriodo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {formatBRL(saldoPeriodo)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
          <SelectTrigger className="w-40 h-9 bg-background border-border rounded-lg text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="w-24 h-9 bg-background border-border rounded-lg text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fluxoFiltro} onValueChange={(value) => setFluxoFiltro(value as "TODOS" | "ENTRADA" | "SAIDA") }>
          <SelectTrigger className="w-32 h-9 bg-background border-border rounded-lg text-xs"><SelectValue placeholder="Fluxo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="ENTRADA">Entradas</SelectItem>
            <SelectItem value="SAIDA">Saídas</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, fornecedor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-9 bg-background border-border rounded-lg text-xs"
          />
        </div>
        {selectedChaves.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 pl-3 pr-1 py-1">
            <span className="text-xs font-medium text-foreground">{selectedChaves.length} selecionado(s)</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedChaves([])}>Limpar</Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {resumoPorFluxo.map((item) => {
          const isEntrada = item.fluxo === "ENTRADA";
          return (
            <div key={item.fluxo} className={cn(
              "rounded-lg border bg-background p-4 transition-colors",
              isEntrada 
                ? (isFiltrandoSelecao ? "border-emerald-500/50 bg-emerald-500/5" : "border-emerald-500/20")
                : (isFiltrandoSelecao ? "border-rose-500/50 bg-rose-500/5" : "border-rose-500/20")
            )}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {isEntrada
                    ? <ArrowDownCircle className="h-4 w-4 text-emerald-500" />
                    : <ArrowUpCircle className="h-4 w-4 text-rose-500" />}
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                      {isEntrada ? "Entradas" : "Saídas"} {isFiltrandoSelecao ? "(Selecionado)" : ""}
                    </p>
                    <p className={cn("text-lg font-bold font-mono tabular-nums", isEntrada ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{formatBRL(item.total)}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[10px]">
                  {item.porCotista.length} sócio(s)
                </Badge>
              </div>
              {item.porCotista.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-border/60 pt-2.5">
                  {item.porCotista.map((cotista) => (
                    <div key={cotista.id} className="flex items-center justify-between text-xs">
                      <span className="truncate pr-2 text-muted-foreground">{cotista.nome}</span>
                      <span className="font-mono font-semibold text-foreground tabular-nums">{formatBRL(cotista.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border overflow-hidden w-full">
        <div
          ref={topScrollRef}
          onScroll={() => { if (bottomScrollRef.current && topScrollRef.current) bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft; }}
          className="centro-lancamentos-scrollbar overflow-x-auto overflow-y-hidden border-b border-border bg-muted/30 sticky top-0 z-20"
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
          className="centro-lancamentos-scrollbar overflow-x-auto cursor-grab active:cursor-grabbing select-none bg-background"
        >
          <table ref={tableRef} className="centro-lancamentos-table w-full text-xs text-left" style={{ tableLayout: "auto" }}>
            <thead data-no-drag>
              {(["ENTRADA", "SAIDA"] as const).map((fluxo) => {
                const gruposDoFluxo = gruposFiltrados.filter((g) => normalizeFluxo(g.fluxo) === fluxo);
                if (!gruposDoFluxo.length) return null;
                const isEntrada = fluxo === "ENTRADA";
                return (
                  <tr key={fluxo} className={cn("border-b border-border", isEntrada ? "bg-emerald-500/[0.05]" : "bg-rose-500/[0.05]")}>
                    <td colSpan={10 + cotistas.length * 2} className="px-4 py-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className={cn(
                          "text-[10.5px] font-bold uppercase tracking-[0.2em] flex items-center gap-1.5",
                          isEntrada ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        )}>
                          {isEntrada ? <ArrowDownCircle className="h-3 w-3" /> : <ArrowUpCircle className="h-3 w-3" />}
                          {isEntrada ? "Entradas" : "Saídas"}
                        </span>
                        <span className="text-[10.5px] text-muted-foreground">{gruposDoFluxo.length} lançamento(s)</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-b border-border text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-2 py-2 text-center font-semibold">
                  <Checkbox checked={todosVisiveisSelecionados} onCheckedChange={toggleSelecionarVisiveis} aria-label="Selecionar todos os lançamentos visíveis" />
                </th>
                <th className="relative px-3 py-2 font-semibold" style={getCellStyles("data")}>
                  <button type="button" onClick={() => setSortDirection((v) => (v === "desc" ? "asc" : "desc"))} className="flex items-center gap-1 font-semibold hover:text-foreground transition-colors">
                    <span>Data</span> <span className="text-[10px]">{sortDirection === "desc" ? "↓" : "↑"}</span>
                  </button>
                  <ResizeHandle columnKey="data" startWidth={getColumnWidth("data")} onStartResize={startResize} />
                </th>
                <th className="relative px-3 py-2 font-semibold" style={getCellStyles("doc")}>
                  Doc <ResizeHandle columnKey="doc" startWidth={getColumnWidth("doc")} onStartResize={startResize} />
                </th>
                <th className="relative px-3 py-2 font-semibold text-right" style={getCellStyles("valorDespesa")}>
                  Valor <ResizeHandle columnKey="valorDespesa" startWidth={getColumnWidth("valorDespesa")} onStartResize={startResize} />
                </th>
                <th className="relative px-3 py-2 font-semibold" style={getCellStyles("fornecedor")}>
                  Fornecedor <ResizeHandle columnKey="fornecedor" startWidth={getColumnWidth("fornecedor")} onStartResize={startResize} />
                </th>
                <th className="relative px-3 py-2 font-semibold" style={getCellStyles("descricao")}>
                  Descrição <ResizeHandle columnKey="descricao" startWidth={getColumnWidth("descricao")} onStartResize={startResize} />
                </th>
                <th className="relative px-3 py-2 font-semibold" style={getCellStyles("categoria")}>
                  Categoria <ResizeHandle columnKey="categoria" startWidth={getColumnWidth("categoria")} onStartResize={startResize} />
                </th>
                <th className="relative px-3 py-2 font-semibold" style={getCellStyles("tipoRateio")}>
                  Tipo de Rateio <ResizeHandle columnKey="tipoRateio" startWidth={getColumnWidth("tipoRateio")} onStartResize={startResize} />
                </th>
                <th className="relative px-3 py-2 font-semibold" style={getCellStyles("periodicidade")}>
                  Periodicidade <ResizeHandle columnKey="periodicidade" startWidth={getColumnWidth("periodicidade")} onStartResize={startResize} />
                </th>
                <th className="relative px-3 py-2 font-semibold" style={getCellStyles("pagoPor")}>
                  Pago Por <ResizeHandle columnKey="pagoPor" startWidth={getColumnWidth("pagoPor")} onStartResize={startResize} />
                </th>

                {cotistas.map((c) => (
                  <th key={c.id} colSpan={2} className="px-3 py-2 text-center font-semibold border-l border-border" style={{ width: COTISTA_TOTAL_WIDTH, minWidth: COTISTA_TOTAL_WIDTH, maxWidth: COTISTA_TOTAL_WIDTH }}>
                    <div className="text-[11px] font-bold text-foreground truncate uppercase tracking-normal">{c.nome || c.id}</div>
                    <div className="text-[9px] font-normal tracking-wide normal-case">{c.percentual}% cota</div>
                  </th>
                ))}
              </tr>
              <tr className="bg-muted/20 border-b border-border text-[10px] text-muted-foreground uppercase">
                <th colSpan={10} />
                {cotistas.map((c) => (
                  <Fragment key={c.id}>
                    <th className="px-2 py-1 text-center border-l border-border font-medium" style={{ width: COL_USO_WIDTH, minWidth: COL_USO_WIDTH, maxWidth: COL_USO_WIDTH }}>% Uso</th>
                    <th className="px-2 py-1 text-right font-medium" style={{ width: COL_RATEIO_WIDTH, minWidth: COL_RATEIO_WIDTH, maxWidth: COL_RATEIO_WIDTH }}>Rateio</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr><td colSpan={10 + cotistas.length * 2} className="px-4 py-8 text-center text-muted-foreground">Carregando lançamentos...</td></tr>
              ) : gruposFiltrados.length === 0 ? (
                <tr><td colSpan={10 + cotistas.length * 2} className="px-4 py-8 text-center text-muted-foreground">Nenhum lançamento encontrado no período.</td></tr>
              ) : (
                ["ENTRADA", "SAIDA"].map((fluxo) => {
                  const gruposDoFluxo = gruposFiltrados.filter((g) => normalizeFluxo(g.fluxo) === fluxo);
                  if (!gruposDoFluxo.length) return null;

                  return (
                    <Fragment key={fluxo}>
                      {gruposDoFluxo.map((g) => (
                        <LinhaGrupo
                          key={g.chave}
                          g={g}
                          cotistas={cotistas}
                          fornecedores={fornecedores}
                          categorias={categorias}
                          pagadores={pagadores}
                          getCellStyles={getCellStyles}
                          selectedChaves={selectedChaves}
                          onToggleSelect={toggleSelecao}
                          onUpdate={(patch) => updateGrupo(g, patch)}
                          travelReportPdf={g.despesa_id ? travelReportMap.get(g.despesa_id) || null : null}
                          reciboInfo={g.numero_recibo ? reciboMap.get(String(g.numero_recibo)) || null : null}
                          abastecimentoAnexos={g.abastecimentoAnexos ?? null}
                        />
                      ))}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NovoLancamentoDialog
        open={showNovoDialog}
        onOpenChange={setShowNovoDialog}
        aeronaveId={aeronaveId}
        cotistas={cotistas}
        fornecedores={fornecedores}
        categorias={categorias}
        pagadores={pagadores}
        onSaved={() => {
          setShowNovoDialog(false);
          qc.invalidateQueries({ queryKey: ["centro-lancamentos", aeronaveId] });
        }}
      />
    </div>
  );
}

function ResizeHandle({ columnKey, startWidth, onStartResize, isResizing }: { columnKey: string; startWidth: number; onStartResize: (key: string, clientX: number, startWidth: number) => void; isResizing?: boolean }) {
  return (
    <div
      data-no-drag
      role="separator"
      aria-orientation="vertical"
      title="Arraste para redimensionar coluna"
      className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize z-10 flex items-stretch justify-end group/rh"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onStartResize(columnKey, event.clientX, startWidth);
      }}
    >
      <div className={`w-[3px] h-full transition-colors ${isResizing ? "bg-primary" : "bg-border/50 group-hover/rh:bg-primary/70"}`} />
    </div>
  );
}

function LinhaGrupo({
  g, cotistas, fornecedores, categorias, pagadores, getCellStyles, selectedChaves, onToggleSelect, onUpdate,
  travelReportPdf, reciboInfo, abastecimentoAnexos,
}: {
  g: GrupoLancamento;
  cotistas: Cotista[];
  fornecedores: { id: string; label: string }[];
  categorias: { id: string; label: string }[];
  pagadores: { id: string; label: string }[];
  getCellStyles: (key: string) => React.CSSProperties;
  selectedChaves: string[];
  onToggleSelect: (chave: string) => void;
  onUpdate: (patch: Record<string, any>) => Promise<void> | void;
  travelReportPdf: string | null;
  reciboInfo: { pdf_url: string | null; numero_recibo: string | null } | null;
  abastecimentoAnexos: GrupoLancamento["abastecimentoAnexos"];
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

  const dataRef = g.data_emissao || g.data_pagamento || g.data_vencimento;
  const isEntrada = normalizeFluxo(g.fluxo) === "ENTRADA";
  const categoriaSelecionada = useMemo(() => {
    const raw = String(g.categoria_custo ?? "").trim();
    if (!raw) return "";
    const byId = categorias.find((item) => item.id === raw);
    if (byId) return byId.id;
    const byLabel = categorias.find((item) => item.label.toLowerCase() === raw.toLowerCase());
    return byLabel?.id ?? "";
  }, [categorias, g.categoria_custo]);

  const categoriaLabel = useMemo(() => {
    const raw = String(g.categoria_custo ?? "").trim();
    if (!raw) return "—";
    const byId = categorias.find((item) => item.id === raw);
    if (byId) return byId.label;
    return raw;
  }, [categorias, g.categoria_custo]);

  const status = (g.status || "pendente").toLowerCase();
  const isFinalized = (isEntrada && (status === "recebido" || status === "confirmado")) || (!isEntrada && (status === "pago" || status === "pagamento_validado"));
  const isPago = isFinalized;
  const documentUrls = getDocumentUrls(g.observacoes);

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement;
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
      <tr className={cn("hover:bg-muted/50 transition-colors cursor-pointer group", expanded && "bg-muted/40 border-b-transparent", selectedChaves.includes(g.chave) && "bg-primary/5") } onClick={handleRowClick}>
        <td className="px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selectedChaves.includes(g.chave)} onCheckedChange={() => onToggleSelect(g.chave)} aria-label={`Selecionar lançamento ${g.descricao_despesa || g.numero_doc || g.chave}`} />
        </td>
        <td className="px-2 py-1 overflow-hidden" style={getCellStyles("data")}>
          {isPago ? (
            <div className="h-7 flex items-center text-xs font-medium text-foreground truncate">{fmtDate(dataRef)}</div>
          ) : (
            <Popover open={openDate} onOpenChange={setOpenDate}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 w-full justify-start font-normal text-xs overflow-hidden">
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
          )}
        </td>

        <td className="px-2 py-1 overflow-hidden" style={getCellStyles("doc")}>
          {isPago ? (
            <div className="h-7 flex items-center text-xs font-medium text-foreground truncate">{g.numero_doc || "—"}</div>
          ) : (
            <Input value={doc} onChange={(e) => setDoc(e.target.value)} onBlur={() => { if (doc !== (g.numero_doc || "")) onUpdate({ numero_doc: doc || null }); }} className="h-7 text-xs font-mono w-full" />
          )}
        </td>

        <td className="px-2 py-1 overflow-hidden text-right" style={getCellStyles("valorDespesa")}>
          {isPago ? (
            <div className={cn("h-7 flex items-center justify-end text-xs font-mono font-bold truncate tabular-nums", isEntrada ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{formatBRL(g.valor_total_despesa)}</div>
          ) : (
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
                className="h-7 text-xs font-mono pl-7 w-full font-bold text-right"
                placeholder="0,00"
              />
            </div>
          )}
        </td>

        <td className="px-2 py-1 overflow-hidden" style={getCellStyles("fornecedor")}>
          {isPago ? (
            <div className="h-7 flex items-center text-xs font-medium text-foreground truncate">{g.fornecedor_nome || "—"}</div>
          ) : (
            <div className="w-full overflow-hidden [&>button]:w-full [&>button]:truncate [&>button]:h-7 [&>button]:text-xs">
              <SearchableCombobox items={fornecedores} value={g.fornecedor_nome || ""} onChange={(_id, label) => onUpdate({ fornecedor_nome: label })} placeholder="Fornecedor..." searchPlaceholder="Buscar..." allowFreeText />
            </div>
          )}
        </td>

        <td className="px-2 py-1 overflow-hidden" style={getCellStyles("descricao")}>
          {isPago ? (
            <div className="h-7 flex items-center text-xs font-medium text-foreground truncate">{g.descricao_despesa || "—"}</div>
          ) : (
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => { if (desc !== (g.descricao_despesa || "")) onUpdate({ descricao_despesa: desc }); }} className="h-7 text-xs w-full" />
          )}
        </td>

        <td className="px-2 py-1 overflow-hidden" style={getCellStyles("categoria")}>
          {isPago ? (
            <div className="h-7 flex items-center text-xs font-medium text-foreground truncate">{categoriaLabel}</div>
          ) : (
            <div className="w-full overflow-hidden [&>button]:w-full [&>button]:truncate [&>button]:h-7 [&>button]:text-xs">
              <SearchableCombobox items={categorias} value={categoriaSelecionada} onChange={(id) => onUpdate({ categoria_custo: id || null })} placeholder="Categoria..." searchPlaceholder="Buscar..." allowFreeText={false} />
            </div>
          )}
        </td>

        <td className="px-2 py-1 overflow-hidden" style={getCellStyles("tipoRateio")}>
          {isPago ? (
            <div className="h-7 flex items-center text-xs font-medium text-foreground truncate">{(g.tipo_rateio || "—").replace(/_/g, " ")}</div>
          ) : (
            <Select value={g.tipo_rateio || ""} onValueChange={(v) => onUpdate({ tipo_rateio: v })}>
              <SelectTrigger className="h-7 text-xs w-full [&>span]:truncate"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{TIPOS_RATEIO.map((t) => <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </td>

        <td className="px-2 py-1 overflow-hidden" style={getCellStyles("periodicidade")}>
          {isPago ? (
            <div className="h-7 flex items-center text-xs font-medium text-foreground truncate">{(g.periodicidade || "—").toUpperCase()}</div>
          ) : (
            <Select value={(g.periodicidade || "").toUpperCase()} onValueChange={(v) => onUpdate({ periodicidade: v })}>
              <SelectTrigger className="h-7 text-xs w-full [&>span]:truncate"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{PERIODICIDADES.map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </td>

        <td className="px-2 py-1 overflow-hidden" style={getCellStyles("pagoPor")}>
          {isPago ? (
            <div className="h-7 flex items-center">
              <div className="min-w-0 flex-1 text-xs font-medium text-foreground truncate">{g.pago_por || "—"}</div>
            </div>
          ) : (
            <div className="w-full overflow-hidden [&>button]:w-full [&>button]:truncate [&>button]:h-7 [&>button]:text-xs">
              <SearchableCombobox items={pagadores} value={g.pago_por || ""} onChange={(_id, label) => onUpdate({ pago_por: label })} placeholder="Pagador..." searchPlaceholder="Buscar..." allowFreeText />
            </div>
          )}
        </td>

        {cotistas.map((c) => {
          const r = g.rateiosPorCotista.get(c.id);
          const pctUso = r ? (Number(r.percentual_uso) || Number(r.percentual_sociedade) || 0) : 0;
          const rateado = r ? Number(r.valor_rateado) || 0 : 0;
          return (
            <Fragment key={c.id}>
              <td className="px-2 py-1 text-center border-l border-border text-[11px] font-medium text-muted-foreground overflow-hidden" style={{ width: COL_USO_WIDTH, minWidth: COL_USO_WIDTH, maxWidth: COL_USO_WIDTH }}>
                {r ? `${pctUso.toFixed(2)}%` : "—"}
              </td>
              <td className="px-2 py-1 text-right font-mono text-[11px] overflow-hidden pr-3 tabular-nums" style={{ width: COL_RATEIO_WIDTH, minWidth: COL_RATEIO_WIDTH, maxWidth: COL_RATEIO_WIDTH }}>
                {r ? (
                  <div className="flex flex-col items-end w-full">
                    <span className="font-semibold text-foreground">{formatBRL(rateado)}</span>
                    {Number(r.valor_pago_real || 0) > 0 && (
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400/80 leading-tight block truncate w-full text-right mt-0.5">
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

      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={10} className="p-0 border-b border-border border-r align-top">
            <div className="px-5 py-5 animate-in slide-in-from-top-2 duration-200">
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-2">
                <FichaModule icon={<StickyNote className="h-4 w-4" />} title="Informações gerais">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-0.5">
                      <Field label="Fornecedor" value={g.fornecedor_nome} />
                      <Field label="Descrição" value={g.descricao_despesa} />
                      <Field label="Documento" value={g.numero_doc} />
                      <Field label="Categoria" value={categoriaLabel} />
                      <Field label="Tipo de rateio" value={(g.tipo_rateio || "—").replace(/_/g, " ")} />
                      <Field label="Periodicidade" value={(g.periodicidade || "—").toUpperCase()} />
                      <Field label="Pago por" value={g.pago_por} />
                    </div>
                    <div className="space-y-0.5">
                      <Field label="Valor total" value={formatBRL(g.valor_total_despesa)} strong />
                      <Field label="Data de emissão" value={fmtDate(g.data_emissao)} />
                      <Field label="Data de vencimento" value={fmtDate(g.data_vencimento)} />
                      <Field label="Data de pagamento" value={fmtDate(g.data_pagamento)} />
                      <Field label="Forma de pagamento" value={g.forma_pagamento ? (FORMAS_PAGAMENTO.find((f) => f.value === g.forma_pagamento)?.label || g.forma_pagamento) : null} />
                      <div className="flex items-center justify-between gap-3 border-b border-border/20 py-1.5 text-xs last:border-b-0">
                        <span className="text-muted-foreground">Status</span>
                        {isPago ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 px-2 py-0.5 rounded-md text-[10px]"><CheckCircle2 className="h-3 w-3" /> {isEntrada ? "Recebido" : "Pago"}</Badge>
                        ) : status === "cancelado" ? (
                          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1 px-2 py-0.5 rounded-md text-[10px]"><XCircle className="h-3 w-3" /> Cancelado</Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 px-2 py-0.5 rounded-md text-[10px]"><Clock className="h-3 w-3" /> Pendente</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </FichaModule>

                <FichaModule icon={<Paperclip className="h-4 w-4" />} title="Documentos">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {travelReportPdf && <AnexoPill label="Relatório de Viagem (PDF)" numero={null} url={travelReportPdf} />}
                    {reciboInfo?.pdf_url && <AnexoPill label="Recibo (PDF)" numero={reciboInfo.numero_recibo} url={reciboInfo.pdf_url} />}
                    {abastecimentoAnexos && (abastecimentoAnexos.comanda_url || abastecimentoAnexos.nota_url || abastecimentoAnexos.boleto_url) && (
                      <>
                        <AnexoPill label="Comanda" numero={abastecimentoAnexos.comanda || null} url={abastecimentoAnexos.comanda_url} />
                        <AnexoPill label="Nota" numero={abastecimentoAnexos.nf || null} url={abastecimentoAnexos.nota_url} />
                        <AnexoPill label="Boleto" numero={null} url={abastecimentoAnexos.boleto_url} />
                      </>
                    )}
                    <AnexoPill label="Nota Fiscal" numero={g.numero_nf} url={g.nf_url} />
                    <AnexoPill label="Recibo" numero={g.numero_recibo} url={g.recibo_url} />
                    <AnexoPill label="Boleto" numero={g.numero_boleto} url={g.boleto_url} />
                    {documentUrls.map((url, index) => (
                      <AnexoPill key={url} label={`Documento ${index + 1} (PDF)`} numero={null} url={url} />
                    ))}
                    <AnexoPill label="Comprovante" numero={null} url={g.comprovante_url} />
                  </div>
                </FichaModule>

                <FichaModule icon={<StickyNote className="h-4 w-4" />} title="Observações">
                  <p className="whitespace-pre-line rounded-lg bg-muted/20 p-3 text-xs leading-relaxed">
                    {g.observacoes || "Nenhuma observação registrada para este lançamento."}
                  </p>
                </FichaModule>

                <FichaModule icon={<History className="h-4 w-4" />} title="Histórico">
                  <ul className="space-y-2 text-xs">
                    {g.data_emissao && <HistItem when={g.data_emissao} who="Sistema" what="Lançamento criado" />}
                    {g.data_vencimento && <HistItem when={g.data_vencimento} who="Financeiro" what="Vencimento definido" />}
                    {g.data_pagamento && (
                      <HistItem
                        when={g.data_pagamento}
                        who="Financeiro"
                        what={`${isEntrada ? "Recebimento" : "Pagamento"} registrado — ${formatBRL(g.valor_total_despesa)}`}
                      />
                    )}
                    {!g.data_emissao && !g.data_vencimento && !g.data_pagamento && (
                      <li className="text-muted-foreground">Sem registro de alterações.</li>
                    )}
                  </ul>
                </FichaModule>

                <FichaModule icon={<DollarSign className="h-4 w-4" />} title="Ações">
                  <div className="flex flex-col gap-2">
                    {!isPago ? (
                      <Button size="sm" onClick={() => setShowPayDialog(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-7 text-[11px] w-full justify-start">
                        <DollarSign className="h-3.5 w-3.5" /> {isEntrada ? "Registrar recebimento" : "Quitar lançamento"}
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setShowPayDialog(true)} className="gap-2 h-7 text-[11px] w-full justify-start">
                        <FileDigit className="h-3.5 w-3.5" /> Editar {isEntrada ? "recebimento" : "pagamento"}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(true)} className="gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-600 h-7 text-[11px] w-full justify-start">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir lançamento
                    </Button>
                  </div>
                </FichaModule>
              </div>
            </div>
          </td>
          {cotistas.map((c) => (
            <Fragment key={c.id}>
              <td className="px-2 py-1 bg-muted/20 border-b border-border" style={{ width: COL_USO_WIDTH, minWidth: COL_USO_WIDTH, maxWidth: COL_USO_WIDTH }} />
              <td className="px-2 py-1 bg-muted/20 border-b border-border" style={{ width: COL_RATEIO_WIDTH, minWidth: COL_RATEIO_WIDTH, maxWidth: COL_RATEIO_WIDTH }} />
            </Fragment>
          ))}
        </tr>
      )}

      <PagamentoDialog
        open={showPayDialog}
        onOpenChange={setShowPayDialog}
        grupo={g}
        fornecedores={fornecedores}
        categorias={categorias}
        pagadores={pagadores}
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
            <AlertDialogAction onClick={handleExcluir} className="bg-rose-600 hover:bg-rose-700 text-white">Excluir Lançamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FichaModule({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        <span className="text-primary">{icon}</span> {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Field({ label, value, strong }: { label: string; value?: string | null; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/20 py-1.5 text-xs last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("truncate text-right", strong && "font-semibold text-primary")}>
        {value || "—"}
      </span>
    </div>
  );
}

function HistItem({ when, who, what }: { when: string; who: string; what: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{what}</div>
        <div className="text-[10px] text-muted-foreground">
          {fmtDate(when)} · {who}
        </div>
      </div>
    </li>
  );
}

function AnexoPill({ label, numero, url }: { label: string; numero: string | null; url: string | null }) {
  const isFilled = numero || url;
  return (
    <div className={cn("flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-colors", isFilled ? "bg-background border-border hover:bg-muted/40" : "bg-transparent border-border/40 opacity-60")}>
      <div className="flex min-w-0 items-center gap-2">
        {url && <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <span className="truncate font-medium text-muted-foreground/80">{label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {numero && <span className="max-w-[80px] truncate font-mono text-foreground/80" title={numero}>{numero}</span>}
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-1 font-medium text-primary hover:bg-primary/15" onClick={(e) => e.stopPropagation()} title="Abrir arquivo">
            <span className="hidden sm:inline">Abrir</span><ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="text-[10px] italic text-muted-foreground/40">Vazio</span>
        )}
      </div>
    </div>
  );
}

function PagamentoDialog({
  open, onOpenChange, grupo, fornecedores, categorias, pagadores, onSaved, onUpdate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  grupo: GrupoLancamento;
  fornecedores: { id: string; label: string }[];
  categorias: { id: string; label: string }[];
  pagadores: { id: string; label: string }[];
  onSaved: (status: "pago" | "recebido" | "pendente") => void;
  onUpdate: (patch: Record<string, any>) => Promise<void> | void;
}) {
  const isGrupoEntrada = normalizeFluxo(grupo.fluxo) === "ENTRADA";
  const [dataEmissao, setDataEmissao] = useState(grupo.data_emissao || grupo.data_pagamento || new Date().toISOString().slice(0, 10));
  const [dataPagamento, setDataPagamento] = useState(grupo.data_pagamento || "");
  const [dataVencimento, setDataVencimento] = useState(grupo.data_vencimento || new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState(grupo.forma_pagamento || "pix");
  const [status, setStatus] = useState<"pago" | "recebido" | "pendente">(grupo.status?.toLowerCase() === "pago" || grupo.status?.toLowerCase() === "recebido" ? (grupo.status?.toLowerCase() as any) : "pendente");
  const [docNumero, setDocNumero] = useState(grupo.numero_doc || "");
  const [descricao, setDescricao] = useState(grupo.descricao_despesa || "");
  const [fornecedor, setFornecedor] = useState(grupo.fornecedor_nome || "");
  const [categoria, setCategoria] = useState(grupo.categoria_custo || "");
  const [tipoRateio, setTipoRateio] = useState(grupo.tipo_rateio || "FIXO");
  const [periodicidade, setPeriodicidade] = useState(grupo.periodicidade || "EVENTUAL");
  const [fluxo, setFluxo] = useState(grupo.fluxo || "SAIDA");
  const [pagador, setPagador] = useState(grupo.pago_por || "");
  const [observacoes, setObservacoes] = useState(grupo.observacoes || "");
  
  const [valorTotal, setValorTotal] = useState(formatNumberPTBR(grupo.valor_total_despesa));
  
  const initialRateado = Array.from(grupo.rateiosPorCotista.values()).reduce((sum, r) => sum + (Number(r.valor_rateado) || 0), 0);
  const [valorRateado, setValorRateado] = useState(formatNumberPTBR(initialRateado));
  
  const initialPago = Array.from(grupo.rateiosPorCotista.values()).reduce((sum, r) => sum + (Number(r.valor_pago_real) || 0), 0);
  const [valorPagoReal, setValorPagoReal] = useState(formatNumberPTBR(initialPago || initialRateado || grupo.valor_total_despesa));
  
  const [anexos, setAnexos] = useState<AnexoDoc[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDataEmissao(grupo.data_emissao || grupo.data_pagamento || new Date().toISOString().slice(0, 10));
      setDataPagamento(grupo.data_pagamento || "");
      setDataVencimento(grupo.data_vencimento || new Date().toISOString().slice(0, 10));
      setForma(grupo.forma_pagamento || "pix");
      setStatus(grupo.status?.toLowerCase() === "pago" || grupo.status?.toLowerCase() === "recebido" ? (grupo.status?.toLowerCase() as any) : "pendente");
      setDocNumero(grupo.numero_doc || "");
      setDescricao(grupo.descricao_despesa || "");
      setFornecedor(grupo.fornecedor_nome || "");
      setCategoria(grupo.categoria_custo || "");
      setTipoRateio(grupo.tipo_rateio || "FIXO");
      setPeriodicidade(grupo.periodicidade || "EVENTUAL");
      setFluxo(grupo.fluxo || "SAIDA");
      setPagador(grupo.pago_por || "");
      setObservacoes(grupo.observacoes || "");
      
      setValorTotal(formatNumberPTBR(grupo.valor_total_despesa));
      const iRateado = Array.from(grupo.rateiosPorCotista.values()).reduce((sum, r) => sum + (Number(r.valor_rateado) || 0), 0);
      setValorRateado(formatNumberPTBR(iRateado));
      const iPago = Array.from(grupo.rateiosPorCotista.values()).reduce((sum, r) => sum + (Number(r.valor_pago_real) || 0), 0);
      setValorPagoReal(formatNumberPTBR(iPago || iRateado || grupo.valor_total_despesa));

      const initAnexos: AnexoDoc[] = [];
      if (grupo.comprovante_url) initAnexos.push({ id: crypto.randomUUID(), tipo: "comprovante", numero: "", file: null, currentUrl: grupo.comprovante_url });
      if (grupo.nf_url) initAnexos.push({ id: crypto.randomUUID(), tipo: "nf", numero: grupo.numero_nf || "", file: null, currentUrl: grupo.nf_url });
      if (grupo.recibo_url) initAnexos.push({ id: crypto.randomUUID(), tipo: "recibo", numero: grupo.numero_recibo || "", file: null, currentUrl: grupo.recibo_url });
      if (grupo.boleto_url) initAnexos.push({ id: crypto.randomUUID(), tipo: "boleto", numero: grupo.numero_boleto || "", file: null, currentUrl: grupo.boleto_url });
      
      setAnexos(initAnexos);
    }
  }, [open, grupo]);

  const addAnexo = () => setAnexos(prev => [...prev, { id: crypto.randomUUID(), tipo: "comprovante", numero: "", file: null, currentUrl: null }]);
  const updateAnexo = (id: string, field: keyof AnexoDoc, value: any) => setAnexos(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  const removeAnexo = (id: string) => setAnexos(prev => prev.filter(a => a.id !== id));

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

      let patchComprovante = grupo.comprovante_url;
      let patchNfUrl = grupo.nf_url;
      let patchReciboUrl = grupo.recibo_url;
      let patchBoletoUrl = grupo.boleto_url;
      let patchNumeroNf = grupo.numero_nf;
      let patchNumeroRecibo = grupo.numero_recibo;
      let patchNumeroBoleto = grupo.numero_boleto;
      const observacoesExtra: string[] = [];

      for (const anexo of anexos) {
        let url = anexo.currentUrl;
        if (anexo.file) {
          url = await uploadArquivo(anexo.file, anexo.tipo, null);
        }
        if (anexo.tipo === "comprovante") patchComprovante = url;
        if (anexo.tipo === "nf") { patchNfUrl = url; if (anexo.numero) patchNumeroNf = anexo.numero; }
        if (anexo.tipo === "recibo") { patchReciboUrl = url; if (anexo.numero) patchNumeroRecibo = anexo.numero; }
        if (anexo.tipo === "boleto") { patchBoletoUrl = url; if (anexo.numero) patchNumeroBoleto = anexo.numero; }
        if (anexo.tipo === "outro" && url) observacoesExtra.push(`Anexo (${anexo.numero || 'Outro'}): ${url}`);
      }

      const valorTotalNormalizado = parsePTBRNumber(valorTotal);
      const valorRateadoNormalizado = parsePTBRNumber(valorRateado);
      const valorPagoNormalizado = parsePTBRNumber(valorPagoReal);

      const patch: Record<string, any> = {
        status,
        data_emissao: dataEmissao || null,
        data_pagamento: status !== "pendente" ? (dataPagamento || dataEmissao || null) : null,
        data_vencimento: dataVencimento || null,
        forma_pagamento: status !== "pendente" ? forma : null,
        numero_doc: docNumero || null,
        descricao_despesa: descricao || null,
        fornecedor_nome: fornecedor || null,
        categoria_custo: categoria || null,
        tipo_rateio: tipoRateio || null,
        periodicidade: periodicidade || null,
        fluxo: fluxo || null,
        pago_por: pagador || null,
        numero_nf: patchNumeroNf || null,
        numero_recibo: patchNumeroRecibo || null,
        numero_boleto: patchNumeroBoleto || null,
        valor_total_despesa: valorTotalNormalizado || null,
        valor_rateado: valorRateadoNormalizado || null,
        comprovante_url: patchComprovante,
        nf_url: patchNfUrl,
        recibo_url: patchReciboUrl,
        boleto_url: patchBoletoUrl,
        observacoes: [observacoes, ...observacoesExtra].filter(Boolean).join("\n") || null,
        valor_pago_real: status !== "pendente" ? valorPagoNormalizado : null,
      };
      if (status === "pendente") {
        patch.data_pagamento = null;
        patch.forma_pagamento = null;
        patch.valor_pago_real = null;
      }
      await onUpdate(patch);
      const statusLabel = status === "pago" ? "Pagamento salvo" : status === "recebido" ? "Entrada marcada como recebida" : "Lançamento atualizado como pendente";
      toast.success(statusLabel);
      onSaved(status);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0 gap-0 border-0 bg-background/95 backdrop-blur-md shadow-2xl rounded-2xl">
        <DialogHeader className="px-6 py-5 border-b border-border/50 bg-muted/20">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            {grupo.status === "pago" || grupo.status === "recebido" 
              ? (isGrupoEntrada ? "Editar recebimento" : "Editar pagamento") 
              : (isGrupoEntrada ? "Registrar recebimento" : "Registrar pagamento")}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6 space-y-7">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as any)}>
                <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isGrupoEntrada ? (
                    <>
                      <SelectItem value="recebido">Recebido</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Emissão</Label>
              <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} className="h-10 bg-background" />
            </div>
            <div className="grid gap-2 px-[19px] -mx-[5px]">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Vencimento</Label>
              <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="h-10 bg-background" />
            </div>
            <div className="grid gap-2 px-4 mx-5">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Pagamento</Label>
              <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} disabled={status === "pendente"} className="h-10 bg-background" />
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Descrição</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="h-10 bg-background text-base" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-muted/20 p-5 rounded-2xl border border-border/50 shadow-inner">
            <div className="grid gap-2">
              <Label className="text-[11px] uppercase text-muted-foreground font-bold tracking-wider">Valor Total da Despesa</Label>
              <Input 
                type="text" 
                value={valorTotal} 
                onChange={(e) => setValorTotal(maskCurrencyInput(e.target.value))} 
                onBlur={() => setValorTotal(formatNumberPTBR(parsePTBRNumber(valorTotal)))} 
                className="h-11 font-mono text-lg font-bold bg-background shadow-sm" 
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-[11px] uppercase text-primary/80 font-bold tracking-wider">Valor Rateado</Label>
              <Input 
                type="text" 
                value={valorRateado} 
                onChange={(e) => setValorRateado(maskCurrencyInput(e.target.value))} 
                onBlur={() => setValorRateado(formatNumberPTBR(parsePTBRNumber(valorRateado)))} 
                className="h-11 font-mono text-lg font-bold bg-primary/5 text-primary border-primary/20 shadow-sm" 
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-[11px] uppercase text-emerald-600 dark:text-emerald-400 font-bold tracking-wider">Valor Pago Real</Label>
              <Input 
                type="text" 
                value={valorPagoReal} 
                onChange={(e) => setValorPagoReal(maskCurrencyInput(e.target.value))} 
                onBlur={() => setValorPagoReal(formatNumberPTBR(parsePTBRNumber(valorPagoReal)))} 
                className="h-11 font-mono text-lg font-bold bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-sm" 
                disabled={status === "pendente"} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid gap-2 -mx-[17px]">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Fornecedor</Label>
              <div className="h-10 bg-background rounded-md [&>button]:h-10">
                <SearchableCombobox items={fornecedores} value={fornecedor} onChange={(_id, label) => setFornecedor(label || "")} placeholder="Fornecedor..." searchPlaceholder="Buscar..." allowFreeText />
              </div>
            </div>
            <div className="grid gap-2 px-[34px] mx-[29px]">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Categoria</Label>
              <div className="h-10 bg-background rounded-md [&>button]:h-10">
                <SearchableCombobox items={categorias} value={categoria} onChange={(id) => setCategoria(id || "")} placeholder="Categoria..." searchPlaceholder="Buscar..." allowFreeText={false} />
              </div>
            </div>
            <div className="grid gap-2 mx-3">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Pago por</Label>
              <div className="h-10 bg-background rounded-md [&>button]:h-10">
                <SearchableCombobox items={pagadores} value={pagador} onChange={(_id, label) => setPagador(label || "")} placeholder="Pagador..." searchPlaceholder="Buscar..." allowFreeText />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Forma Pag.</Label>
              <Select value={forma} onValueChange={setForma} disabled={status === "pendente"}>
                <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Tipo de Rateio</Label>
              <Select value={tipoRateio} onValueChange={setTipoRateio}>
                <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_RATEIO.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Periodicidade</Label>
              <Select value={periodicidade} onValueChange={setPeriodicidade}>
                <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODICIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className="bg-background" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
               <Label className="text-sm font-semibold flex items-center gap-2">
                 <Paperclip className="h-4 w-4 text-primary" /> Anexos do Lançamento
               </Label>
               <Button type="button" variant="outline" size="sm" onClick={addAnexo} className="h-8 text-xs gap-1.5 bg-background">
                 <Plus className="h-3 w-3" /> Adicionar
               </Button>
            </div>
            
            <div className="space-y-3">
               {anexos.length === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border/70 rounded-xl bg-muted/10">Nenhum anexo adicionado.</div>
               )}
               {anexos.map((anexo) => (
                  <div key={anexo.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-muted/10 p-3 rounded-xl border border-border/60 hover:border-border transition-colors group">
                     <Select value={anexo.tipo} onValueChange={(v) => updateAnexo(anexo.id, "tipo", v)}>
                        <SelectTrigger className="w-full sm:w-[150px] h-9 bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                           {TIPOS_ANEXO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                     </Select>
                     <Input placeholder="Nº do doc..." value={anexo.numero} onChange={e => updateAnexo(anexo.id, "numero", e.target.value)} className="w-full sm:w-[130px] h-9 bg-background" />
                     <div className="flex-1 min-w-[200px] flex items-center gap-3 w-full">
                       <Input type="file" accept="image/*,.pdf" onChange={e => updateAnexo(anexo.id, "file", e.target.files?.[0] || null)} className="h-9 file:h-full file:bg-transparent file:text-xs file:font-medium text-xs bg-background" />
                       {anexo.currentUrl && !anexo.file && (
                         <a href={anexo.currentUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-primary whitespace-nowrap hover:underline"><ExternalLink className="w-3.5 h-3.5 inline mr-1"/>Atual</a>
                       )}
                     </div>
                     <Button variant="ghost" size="icon" className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 w-9 h-9 shrink-0" onClick={() => removeAnexo(anexo.id)}>
                        <Trash2 className="w-4 h-4" />
                     </Button>
                  </div>
               ))}
            </div>
          </div>
        </div>
        
        <DialogFooter className="px-6 py-5 border-t border-border/50 bg-muted/20 rounded-b-2xl">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="h-10 px-5">Cancelar</Button>
          <Button onClick={handleSalvar} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 h-10 px-5">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</> : <><Upload className="mr-2 h-4 w-4" />Confirmar Pagamento</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovoLancamentoDialog({
  open, onOpenChange, aeronaveId, cotistas, fornecedores, categorias, pagadores, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  aeronaveId: string;
  cotistas: Cotista[];
  fornecedores: { id: string; label: string }[];
  categorias: { id: string; label: string }[];
  pagadores: { id: string; label: string }[];
  onSaved: () => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [fluxo, setFluxo] = useState<"ENTRADA" | "SAIDA">("SAIDA");
  const [status, setStatus] = useState<"pago" | "recebido" | "pendente">("pendente");
  const [dataEmissao, setDataEmissao] = useState(hoje);
  const [dataVencimento, setDataVencimento] = useState(hoje);
  const [dataPagamento, setDataPagamento] = useState("");
  const [forma, setForma] = useState("pix");
  const [docNumero, setDocNumero] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tipoRateio, setTipoRateio] = useState<string>("FIXO");
  const [periodicidade, setPeriodicidade] = useState<string>("EVENTUAL");
  const [pagador, setPagador] = useState("");
  const [observacoes, setObservacoes] = useState("");
  
  const [valorTotal, setValorTotal] = useState("0,00");
  const [anexos, setAnexos] = useState<AnexoDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [rateio, setRateio] = useState<Record<string, { pctUso: string; valor: string }>>({});

  useEffect(() => {
    if (!open) return;
    setFluxo("SAIDA");
    setStatus("pendente");
    setDataEmissao(hoje);
    setDataVencimento(hoje);
    setDataPagamento("");
    setForma("pix");
    setDocNumero("");
    setDescricao("");
    setFornecedor("");
    setCategoria("");
    setTipoRateio("FIXO");
    setPeriodicidade("EVENTUAL");
    setPagador("");
    setObservacoes("");
    setValorTotal("0,00");
    setAnexos([{ id: crypto.randomUUID(), tipo: "comprovante", numero: "", file: null, currentUrl: null }]);
    
    const inicial: Record<string, { pctUso: string; valor: string }> = {};
    cotistas.forEach((c) => { inicial[c.id] = { pctUso: formatNumberPTBR(c.percentual), valor: "0,00" }; });
    setRateio(inicial);
  }, [open, cotistas, hoje]);

  const addAnexo = () => setAnexos(prev => [...prev, { id: crypto.randomUUID(), tipo: "comprovante", numero: "", file: null, currentUrl: null }]);
  const updateAnexo = (id: string, field: keyof AnexoDoc, value: any) => setAnexos(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  const removeAnexo = (id: string) => setAnexos(prev => prev.filter(a => a.id !== id));

  const distribuirAutomaticamente = (valorTotalStr: string) => {
    const total = parsePTBRNumber(valorTotalStr);
    setRateio((prev) => {
      const next = { ...prev };
      cotistas.forEach((c) => {
        const pct = parsePTBRNumber(next[c.id]?.pctUso ?? formatNumberPTBR(c.percentual));
        next[c.id] = { pctUso: formatNumberPTBR(pct), valor: formatNumberPTBR(total * (pct / 100)) };
      });
      return next;
    });
  };

  const totalRateado = useMemo(
    () => Object.values(rateio).reduce((s, r) => s + parsePTBRNumber(r.valor), 0),
    [rateio],
  );
  const valorTotalNum = parsePTBRNumber(valorTotal);
  const diferenca = valorTotalNum - totalRateado;

  const handleSalvar = async () => {
    if (!aeronaveId) { toast.error("Aeronave não identificada."); return; }
    if (valorTotalNum <= 0) { toast.error("Informe o valor total do lançamento."); return; }
    const linhasValidas = cotistas
      .map((c) => ({ c, valor: parsePTBRNumber(rateio[c.id]?.valor ?? "0"), pct: parsePTBRNumber(rateio[c.id]?.pctUso ?? "0") }))
      .filter((l) => l.valor > 0);
    if (linhasValidas.length === 0) { toast.error("Distribua o valor entre ao menos um cotista."); return; }

    setSaving(true);
    try {
      const despesaId = crypto.randomUUID();
      const uploadArquivo = async (file: File | null, tipo: string) => {
        if (!file) return null;
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        const path = `rateio-anexos/${despesaId}/${tipo}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("client-documents").upload(path, file, { upsert: true });
        if (error) throw error;
        return supabase.storage.from("client-documents").getPublicUrl(path).data.publicUrl;
      };

      let patchComprovante = null, patchNfUrl = null, patchReciboUrl = null, patchBoletoUrl = null;
      let patchNumeroNf = "", patchNumeroRecibo = "", patchNumeroBoleto = "";
      const observacoesExtra: string[] = [];

      for (const anexo of anexos) {
        if (anexo.file) {
          const url = await uploadArquivo(anexo.file, anexo.tipo);
          if (anexo.tipo === "comprovante") patchComprovante = url;
          if (anexo.tipo === "nf") { patchNfUrl = url; patchNumeroNf = anexo.numero; }
          if (anexo.tipo === "recibo") { patchReciboUrl = url; patchNumeroRecibo = anexo.numero; }
          if (anexo.tipo === "boleto") { patchBoletoUrl = url; patchNumeroBoleto = anexo.numero; }
          if (anexo.tipo === "outro") observacoesExtra.push(`Anexo (${anexo.numero || 'Outro'}): ${url}`);
        }
      }

      const finalObservacoes = [observacoes, ...observacoesExtra].filter(Boolean).join("\n");

      const linhas = linhasValidas.map(({ c, valor, pct }) => {
        const socioId = c.socio_id ?? (c.cliente_id ? null : c.id);
        const clienteId = c.cliente_id ?? null;
        return {
          aeronave_id: aeronaveId,
          despesa_id: despesaId,
          fonte_despesa: "manual",
          fluxo,
          tipo_rateio: tipoRateio,
          periodicidade,
          descricao_despesa: descricao || null,
          fornecedor_nome: fornecedor || null,
          categoria_custo: categoria || null,
          cliente_id: clienteId,
          socio_id: socioId,
          data_emissao: dataEmissao || null,
          data_pagamento: status !== "pendente" ? (dataPagamento || dataEmissao || null) : null,
          data_vencimento: dataVencimento || null,
          valor_total_despesa: valorTotalNum,
          valor_rateado: valor,
          valor_pago_real: status !== "pendente" ? valor : null,
          percentual_uso: pct || null,
          numero_nf: patchNumeroNf || null,
          numero_doc: docNumero || null,
          numero_recibo: patchNumeroRecibo || null,
          numero_boleto: patchNumeroBoleto || null,
          forma_pagamento: status !== "pendente" ? forma : null,
          status,
          pago_por: pagador || null,
          observacoes: finalObservacoes || null,
          comprovante_url: patchComprovante,
          nf_url: patchNfUrl,
          recibo_url: patchReciboUrl,
          boleto_url: patchBoletoUrl,
        };
      });

      const { error } = await (supabase as any).from("rateio_despesas").insert(linhas);
      if (error) throw error;
      toast.success("Lançamento criado com sucesso");
      onSaved();
    } catch (e: any) {
      toast.error("Erro ao criar lançamento: " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0 gap-0 border-0 bg-background/95 backdrop-blur-md shadow-2xl rounded-2xl">
        <DialogHeader className="px-6 py-5 border-b border-border/50 bg-muted/20">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">Novo Lançamento</DialogTitle>
        </DialogHeader>
        
        <div className="p-6 space-y-7">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Fluxo</Label>
              <Select value={fluxo} onValueChange={(v) => setFluxo(v as "ENTRADA" | "SAIDA")}>
                <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAIDA">Saída (despesa)</SelectItem>
                  <SelectItem value="ENTRADA">Entrada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {fluxo === "ENTRADA" ? (
                    <>
                      <SelectItem value="recebido">Recebido</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Emissão</Label>
              <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} className="h-10 bg-background" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Vencimento</Label>
              <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="h-10 bg-background" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Pagamento</Label>
              <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} disabled={status === "pendente"} className="h-10 bg-background" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="h-10 bg-background text-base" placeholder="Ex.: Manutenção preventiva, hangaragem..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label className="text-[11px] uppercase text-muted-foreground font-bold tracking-wider">Nº Documento</Label>
              <Input value={docNumero} onChange={(e) => setDocNumero(e.target.value)} className="h-11 bg-background" />
            </div>
            <div className="grid gap-2">
              <Label className="text-[11px] uppercase text-primary font-bold tracking-wider">Valor Total</Label>
              <Input
                type="text"
                value={valorTotal}
                onChange={(e) => setValorTotal(maskCurrencyInput(e.target.value))}
                onBlur={() => {
                  const normalized = formatNumberPTBR(parsePTBRNumber(valorTotal));
                  setValorTotal(normalized);
                  distribuirAutomaticamente(normalized);
                }}
                className="h-11 font-mono text-lg font-bold bg-primary/5 text-primary border-primary/20 shadow-sm"
                placeholder="0,00"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-[11px] uppercase text-muted-foreground font-bold tracking-wider">Forma de pagamento</Label>
              <Select value={forma} onValueChange={setForma} disabled={status === "pendente"}>
                <SelectTrigger className="h-11 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Fornecedor</Label>
              <div className="h-10 bg-background rounded-md [&>button]:h-10">
                <SearchableCombobox items={fornecedores} value={fornecedor} onChange={(_id, label) => setFornecedor(label || "")} placeholder="Fornecedor..." searchPlaceholder="Buscar..." allowFreeText />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Categoria</Label>
              <div className="h-10 bg-background rounded-md [&>button]:h-10">
                <SearchableCombobox items={categorias} value={categoria} onChange={(id) => setCategoria(id || "")} placeholder="Categoria..." searchPlaceholder="Buscar..." allowFreeText={false} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Pago por</Label>
              <div className="h-10 bg-background rounded-md [&>button]:h-10">
                <SearchableCombobox items={pagadores} value={pagador} onChange={(_id, label) => setPagador(label || "")} placeholder="Pagador..." searchPlaceholder="Buscar..." allowFreeText />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Tipo de rateio</Label>
              <Select value={tipoRateio} onValueChange={setTipoRateio}>
                <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_RATEIO.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Periodicidade</Label>
              <Select value={periodicidade} onValueChange={setPeriodicidade}>
                <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODICIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className="bg-background" />
          </div>

          <div className="grid gap-3 rounded-2xl border border-border/50 p-5 bg-muted/10 shadow-inner">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <User className="h-4 w-4 text-primary" /> Rateio por cotista
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs bg-background" onClick={() => distribuirAutomaticamente(valorTotal)}>
                Distribuir pela cota
              </Button>
            </div>
            {cotistas.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum cotista cadastrado para esta aeronave.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,1fr)] gap-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2">
                  <span>Cotista</span>
                  <span className="text-right">% Uso</span>
                  <span className="text-right">Valor</span>
                </div>
                {cotistas.map((c) => (
                  <div key={c.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,1fr)] items-center gap-3">
                    <span className="truncate text-xs font-medium">{c.nome} <span className="text-[10px] text-muted-foreground font-normal">({c.percentual}%)</span></span>
                    <Input
                      value={rateio[c.id]?.pctUso ?? ""}
                      onChange={(e) => setRateio((prev) => ({ ...prev, [c.id]: { ...prev[c.id], pctUso: e.target.value } }))}
                      onBlur={() => setRateio((prev) => ({ ...prev, [c.id]: { ...prev[c.id], pctUso: formatNumberPTBR(parsePTBRNumber(prev[c.id]?.pctUso ?? "0")) } }))}
                      className="h-9 text-xs text-right font-mono bg-background"
                    />
                    <Input
                      value={rateio[c.id]?.valor ?? ""}
                      onChange={(e) => setRateio((prev) => ({ ...prev, [c.id]: { ...prev[c.id], valor: maskCurrencyInput(e.target.value) } }))}
                      onBlur={() => setRateio((prev) => ({ ...prev, [c.id]: { ...prev[c.id], valor: formatNumberPTBR(parsePTBRNumber(prev[c.id]?.valor ?? "0")) } }))}
                      className="h-9 text-xs text-right font-mono bg-background"
                    />
                  </div>
                ))}
                <div className={cn("flex items-center justify-between rounded-lg px-3 py-2 text-[11px] font-medium mt-2 shadow-sm", Math.abs(diferenca) < 0.01 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20")}>
                  <span>Rateado: {formatBRL(totalRateado)} de {formatBRL(valorTotalNum)}</span>
                  <span>{Math.abs(diferenca) < 0.01 ? "Confere" : `Diferença: ${formatBRL(diferenca)}`}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
               <Label className="text-sm font-semibold flex items-center gap-2">
                 <Paperclip className="h-4 w-4 text-primary" /> Anexos do Lançamento
               </Label>
               <Button type="button" variant="outline" size="sm" onClick={addAnexo} className="h-8 text-xs gap-1.5 bg-background">
                 <Plus className="h-3 w-3" /> Adicionar
               </Button>
            </div>
            
            <div className="space-y-3">
               {anexos.length === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border/70 rounded-xl bg-muted/10">Nenhum anexo adicionado.</div>
               )}
               {anexos.map((anexo) => (
                  <div key={anexo.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-muted/10 p-3 rounded-xl border border-border/60 hover:border-border transition-colors group">
                     <Select value={anexo.tipo} onValueChange={(v) => updateAnexo(anexo.id, "tipo", v)}>
                        <SelectTrigger className="w-full sm:w-[150px] h-9 bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                           {TIPOS_ANEXO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                     </Select>
                     <Input placeholder="Nº do doc..." value={anexo.numero} onChange={e => updateAnexo(anexo.id, "numero", e.target.value)} className="w-full sm:w-[130px] h-9 bg-background" />
                     <div className="flex-1 min-w-[200px] flex items-center gap-3 w-full">
                       <Input type="file" accept="image/*,.pdf" onChange={e => updateAnexo(anexo.id, "file", e.target.files?.[0] || null)} className="h-9 file:h-full file:bg-transparent file:text-xs file:font-medium text-xs bg-background" />
                     </div>
                     <Button variant="ghost" size="icon" className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 w-9 h-9 shrink-0" onClick={() => removeAnexo(anexo.id)}>
                        <Trash2 className="w-4 h-4" />
                     </Button>
                  </div>
               ))}
            </div>
          </div>
        </div>
        
        <DialogFooter className="px-6 py-5 border-t border-border/50 bg-muted/20 rounded-b-2xl">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="h-10 px-5">Cancelar</Button>
          <Button onClick={handleSalvar} disabled={saving} className="bg-primary hover:bg-primary/90 h-10 px-5">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Plus className="mr-2 h-4 w-4" />Criar lançamento</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
