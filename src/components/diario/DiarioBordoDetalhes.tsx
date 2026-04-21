import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plane, Plus, Calendar, Gauge, Clock, Moon, BookOpenCheck, Cloud,
  Fuel, Users, X, Save, Droplets, Wrench, CloudLightning, PlaneLanding,
  Pencil, Trash2, Activity, ArrowUpDown, ArrowUp, ArrowDown, Search, CheckCircle2,
  Eye, EyeOff, ChevronRight, AlertTriangle, Lock, LayoutList, Map as MapIcon, CalendarIcon,
  FileText, ChevronDown, History
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { num } from "@/lib/formatters";
import { ExportDiarioModal } from "./ExportDiarioModal";
import { ConsumoDialog } from "./ConsumoDialog";
import { exportDiarioBordoPDF } from "@/utils/exportDiarioBordoPDF";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import {
  decimalToHHMM, diffDecimalHours, hhmmToMinutes, minutesToHHMM,
  pgTimeToHHMM, subtractMinutesHHMM, sumDecimal,
} from "@/lib/time";
import { calculateCelulaDisponivel } from "@/utils/flightTime";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { CreateMonthDialog } from "./CreateMonthDialog";

type Aeronave = {
  id: string; matricula: string; modelo: string;
  ano?: string | null;
  base?: string | null;
  consumo_combustivel: number | null;
  modo_celula?: "tvoo" | "tempo_total" | null;
};
type Lanc = {
  id: string;
  data_registro: string;
  aerodromo_partida: string | null;
  aerodromo_chegada: string | null;
  tripulacao_checkin_hora: string | null;
  tempo_ac: string | null;
  tempo_dep: string | null;
  tempo_pou: string | null;
  tempo_cor: string | null;
  tempo_voo: number | string | null;
  tempo_total: number | string | null;
  horas_diurnas: number | string | null;
  horas_noturnas: number | string | null;
  tempo_ifr: number | string | null;
  pousos_total: number | null;
  litros_combustivel_inicio_voo: number | string | null;
  combustivel_adicionado: number | string | null;
  consumo_combustivel: number | string | null;
  consumo_combustivel_voo: number | string | null;
  consumo_combustivel_total: number | string | null;
  celula: number | string | null;
  celula_tvoo: number | string | null;
  pic_canac: string | null;
  sic_canac: string | null;
  pic?: { id: string; canac: string; nome_completo: string } | null;
  sic?: { id: string; canac: string; nome_completo: string } | null;
  sic_name: string | null;
  natureza_voo: string | null;
  tarifa_diaria: string | null;
  clientes_id: string | null;
  socios_cliente_id: string | null;
  socios_nome: string | null;
  emprestimo: boolean | null;
  cliente_tomador_emprestimo_id: string | null;
  socio_tomador_emprestimo_id: string | null;
  confirmado: boolean | null;
  confirmado_por: string | null;
  confirmado_em: string | null;
  assinado_por: string | null;
  data_assinatura_piloto: string | null;
  trecho: string | null;
};
type Tripulante = { id: string; nome_completo: string | null; canac: string | null; status: string | null };
type DiarioMesRow = {
  id: string;
  celula_anterior_ttotal: number | null;
  celula_atual_ttotal: number | null;
  celula_prox_revisao_ttotal: number | null;
  celula_disponivel_ttotal: number | null;
  celula_anterior_tvoo: number | null;
  celula_atual_tvoo: number | null;
  celula_prox_revisao_tvoo: number | null;
  celula_disponivel_tvoo: number | null;
  horimetro_inicio: number | null;
  horimetro_final: number | null;
  horimetro_ativo: number | null;
  tem_tarifa_diaria: boolean | null;
  tarifa_diaria: number | null;
};
type Cliente = { id: string; razao_social: string | null; proprietario: string | null };
type Socio = { id: string; nome: string; cliente_id: string };
type Abastecimento = {
  id: string;
  data: string;
  local: string | null;
  litros: number | null;
  valor_total: number | null;
  valor_unitario: number | null;
  tipo_combustivel: string | null;
  logbook_entry_id: string;
  comanda: string | null;
  abastecedor: string | null;
  nf: string | null;
  tipo_faturamento: string | null;
};

type AeronaveEmprestimo = {
  id: string;
  horas_emprestadas: number;
  horas_devolvidas: number | null;
  data_lancamento: string;
  status?: string;
  lancamento_diario_id: string | null;
  lancamento_devolucao_id: string | null;
  observacoes: string | null;
  aerodromo_partida: string | null;
  aerodromo_chegada: string | null;
  trecho: string | null;
  combustivel_adicionado: number | null;
  nome_piloto: string | null;
};

const NATUREZAS = ["Privado", "Teste", "Translado", "Cheque"];
const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// ─── Panel type for inline layout ────────────────────────────────────────────
type ActivePanel = "none" | "novoVoo" | "editarVoo" | "consumo";

function DiarioBordoDetalhes() {
  const { aircraftId } = useParams<{ aircraftId?: string }>();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const canEditConfirmed = roles.includes("admin") || roles.includes("gestor_master");

  const today = new Date();
  const [mes, setMes] = useState<number | null>(null);
  const [ano, setAno] = useState<number | null>(null);
  const [modoCelula, setModoCelula] = useState<"tvoo" | "tempo_total">("tempo_total");

  const [aeronave, setAeronave] = useState<Aeronave | null>(null);
  const [diarioMes, setDiarioMes] = useState<DiarioMesRow | null>(null);
  const [lancamentos, setLancamentos] = useState<Lanc[]>([]);
  const [lancamentosAno, setLancamentosAno] = useState<Lanc[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [tripulantes, setTripulantes] = useState<Tripulante[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [loans, setLoans] = useState<AeronaveEmprestimo[]>([]);
  const [loading, setLoading] = useState(true);

  // ── INLINE PANEL (replaces dialogs for NovoVoo, Consumo) ──────────────────
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");
  const [editingLanc, setEditingLanc] = useState<Lanc | null>(null);

  const [showConsumo, setShowConsumo] = useState(false);
  const [showCreateMonth, setShowCreateMonth] = useState(false);
  const [previousMonthForCreation, setPreviousMonthForCreation] = useState<DiarioMesRow | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [availableMeses, setAvailableMeses] = useState<Array<{ mes: number; ano: number }>>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Filtro cotista
  const [cotistaFiltro, setCotistaFiltro] = useState<string | null>(null);

  // Célula selecionada de lançamento
  const [selectedLancId, setSelectedLancId] = useState<string | null>(null);

  // Inline edit do diario_mes
  const [editCelulaAnt, setEditCelulaAnt] = useState(false);
  const [editProxRev, setEditProxRev] = useState(false);
  const [editHorIni, setEditHorIni] = useState(false);
  const [editHorFim, setEditHorFim] = useState(false);
  const [editHorAtv, setEditHorAtv] = useState(false);

  // Dialog de confirmação para editar lançamento
  const [editConfirmDialog, setEditConfirmDialog] = useState<{ open: boolean; lanc: Lanc | null; action: "edit" | "delete" }>({ open: false, lanc: null, action: "edit" });

  // Usuário atual (para assinatura de PIC)
  const [usuarioAtual, setUsuarioAtual] = useState<{ id: string; email: string; nome?: string } | null>(null);
  const [tripulacaoUsuario, setTripulacaoUsuario] = useState<Tripulante | null>(null);

  // Table controls
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [modoTabela, setModoTabela] = useState<"completo" | "resumo">("completo");

  // Row action popover
  const [rowActionOpen, setRowActionOpen] = useState<string | null>(null);

  // Column widths (resizable)
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null);

  const reload = async () => {
    if (!aircraftId || mes === null || ano === null) return;
    setLoading(true);
    const ini = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const fimDate = new Date(ano, mes, 0);
    const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(fimDate.getDate()).padStart(2, "0")}`;

    const anoIni = `${ano}-01-01`;
    const anoFim = `${ano}-12-31`;

    const [aRes, dmRes, lRes, lAnoRes, cRes, sRes, tRes, abRes, logbookIdsRes] = await Promise.all([
      supabase.from("aeronave").select("id,matricula,modelo,ano,base,consumo_combustivel,modo_celula").eq("id", aircraftId).maybeSingle(),
      supabase.from("diario_mes").select("*").eq("aeronave_id", aircraftId).eq("ano", ano).eq("mes", mes).maybeSingle(),
      supabase.from("lancamentos_diario_bordo").select(`*`).eq("aeronave_id", aircraftId)
        .gte("data_registro", ini).lte("data_registro", fim)
        .order("data_registro", { ascending: true }),
      supabase.from("lancamentos_diario_bordo").select(`*`).eq("aeronave_id", aircraftId)
        .gte("data_registro", anoIni).lte("data_registro", anoFim)
        .order("data_registro", { ascending: true }),
      supabase.from("clientes").select("id,razao_social,proprietario").order("razao_social"),
      (supabase as any).from("socios_cliente").select("id,nome,cliente_id").order("nome"),
      supabase.from("membros_tripulacao").select("id,nome_completo,canac,status"),
      supabase.from("abastecimentos").select("id,data,local,litros,valor_total,valor_unitario,tipo_combustivel,logbook_entry_id,comanda,abastecedor,nf,tipo_faturamento")
        .eq("aeronave_id", aircraftId)
        .gte("data", ini).lte("data", fim)
        .not("logbook_entry_id", "is", null),
      supabase.from("lancamentos_diario_bordo").select("id").eq("aeronave_id", aircraftId),
    ]);
    setAeronave(aRes.data as Aeronave | null);
    if (aRes.data?.modo_celula) {
      setModoCelula(aRes.data.modo_celula as "tvoo" | "tempo_total");
    }
    setDiarioMes((dmRes.data ?? null) as DiarioMesRow | null);
    setLancamentos((lRes.data ?? []) as unknown as Lanc[]);
    setLancamentosAno((lAnoRes.data ?? []) as unknown as Lanc[]);
    setClientes((cRes.data ?? []) as Cliente[]);
    setSocios(((sRes.data ?? []) as any[]).map((s) => ({ id: s.id, nome: s.nome, cliente_id: s.cliente_id })));
    setTripulantes((tRes.data ?? []) as Tripulante[]);
    setAbastecimentos((abRes.data ?? []) as unknown as Abastecimento[]);

    // Buscar empréstimos vinculados aos lancamentos da aeronave
    if (logbookIdsRes.data && logbookIdsRes.data.length > 0) {
      const logbookIds = logbookIdsRes.data.map((e: any) => e.id);
      const loansRes = await supabase
        .from("emprestimos_aeronave")
        .select("id,horas_emprestadas,horas_devolvidas,lancamento_diario_id,lancamento_devolucao_id,data_lancamento,observacoes,aerodromo_partida,aerodromo_chegada,trecho,combustivel_adicionado,nome_piloto")
        .in("lancamento_diario_id", logbookIds)
        .order("data_lancamento", { ascending: false });

      setLoans((loansRes.data ?? []) as unknown as AeronaveEmprestimo[]);
    } else {
      setLoans([]);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUsuarioAtual({ id: user.id, email: user.email || "" });
      const tripulantesArr = (tRes.data ?? []) as Tripulante[];
      const tripulacaoAtual = tripulantesArr.find(t =>
        t.nome_completo?.toLowerCase().includes(user.email?.split("@")[0] || "") ||
        t.canac === user.id?.slice(0, 8)
      );
      setTripulacaoUsuario(tripulacaoAtual || null);
    }

    setLoading(false);
  };

  useEffect(() => { reload(); }, [aircraftId, mes, ano]);

  useEffect(() => {
    (async () => {
      if (!aircraftId || mes || ano) return;
      try {
        const { data } = await supabase
          .from("lancamentos_diario_bordo")
          .select("data_registro")
          .eq("aeronave_id", aircraftId)
          .order("data_registro", { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          const dataParsed = new Date(data[0].data_registro + "T00:00");
          setMes(dataParsed.getMonth() + 1);
          setAno(dataParsed.getFullYear());
        } else {
          setMes(today.getMonth() + 1);
          setAno(today.getFullYear());
        }
      } catch (error) {
        setMes(today.getMonth() + 1);
        setAno(today.getFullYear());
      }
    })();
  }, [aircraftId]);

  useEffect(() => {
    (async () => {
      if (!aircraftId) return;
      try {
        const { data } = await supabase
          .from("lancamentos_diario_bordo")
          .select("data_registro")
          .eq("aeronave_id", aircraftId)
          .order("data_registro", { ascending: false });

        const meses = new Map<string, { mes: number; ano: number }>();
        if (data) {
          for (const row of data) {
            const date = new Date(row.data_registro + "T00:00");
            const m = date.getMonth() + 1;
            const a = date.getFullYear();
            const key = `${a}-${m}`;
            if (!meses.has(key)) meses.set(key, { mes: m, ano: a });
          }
        }
        setAvailableMeses(Array.from(meses.values()).sort((a, b) => {
          if (a.ano !== b.ano) return b.ano - a.ano;
          return b.mes - a.mes;
        }));
      } catch {}
    })();
  }, [aircraftId]);

  // Validar se o mês selecionado existe no ano selecionado
  useEffect(() => {
    if (ano !== null && mes !== null && availableMeses.length > 0) {
      const mesExisteNoAno = availableMeses.some(am => am.ano === ano && am.mes === mes);
      if (!mesExisteNoAno) {
        // Se o mês não existe, selecionar o primeiro mês disponível do ano
        const primeiraMesAno = availableMeses
          .filter(am => am.ano === ano)
          .sort((a, b) => a.mes - b.mes)[0];
        if (primeiraMesAno) {
          setMes(primeiraMesAno.mes);
        }
      }
    }
  }, [ano, availableMeses]);

  const totals = useMemo(() => {
    const tVoo = sumDecimal(lancamentos.map((l) => l.tempo_voo));
    const tTotal = sumDecimal(lancamentos.map((l) => l.tempo_total));
    const tDia = sumDecimal(lancamentos.map((l) => l.horas_diurnas));
    const tNoit = sumDecimal(lancamentos.map((l) => l.horas_noturnas));
    const ifr = sumDecimal(lancamentos.map((l) => l.tempo_ifr));
    const pousos = lancamentos.reduce((s, l) => s + Number(l.pousos_total ?? 0), 0);
    const abast = sumDecimal(lancamentos.map((l) => l.combustivel_adicionado));
    const fuel = sumDecimal(lancamentos.map((l) => l.litros_combustivel_inicio_voo));
    const totalDiarias = lancamentos.reduce((s, l) => s + Number(l.tarifa_diaria ?? 0), 0);
    return { tVoo, tTotal, tDia, tNoit, ifr, pousos, abast, fuel, totalDiarias };
  }, [lancamentos]);

  const tripById = useMemo(() => {
    const m = new Map<string, Tripulante>();
    tripulantes.forEach((t) => m.set(t.id, t));
    return m;
  }, [tripulantes]);

  const naturezasRateio = ["Translado", "Cheque", "Voo de Teste", "Teste"];
  const labelVooPara = useCallback((l: Lanc): string => {
    const nat = (l.natureza_voo ?? "").trim();
    if (naturezasRateio.some((n) => nat.toLowerCase() === n.toLowerCase())) {
      return nat.toUpperCase();
    }
    if (l.socios_cliente_id) {
      const s = socios.find((x) => x.id === l.socios_cliente_id);
      const nomeSocio = s?.nome ?? l.socios_nome;
      if (nomeSocio) return nomeSocio;
      return "Sócio";
    }
    if (l.clientes_id) {
      const c = clientes.find((x) => x.id === l.clientes_id);
      return c?.razao_social ?? c?.proprietario ?? "Cliente";
    }
    return nat || "—";
  }, [socios, clientes]);

  const porCotista = useMemo(() => {
    const map = new Map<string, { label: string; horas: number }>();
    for (const l of lancamentos) {
      const horas = Number((modoCelula === "tvoo" ? l.tempo_voo : l.tempo_total) ?? 0);
      const label = labelVooPara(l);
      const key = label;
      const cur = map.get(key) ?? { label, horas: 0 };
      cur.horas += horas;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.horas - a.horas);
  }, [lancamentos, modoCelula, labelVooPara]);

  const emprestimosResumo = useMemo(() => {
    let totalEmprestadas = 0;
    let totalDevolvidas = 0;
    let totalPendente = 0;
    let quantidadeEmprestimos = 0;

    for (const loan of loans) {
      const emprestadas = loan.horas_emprestadas || 0;
      const devolvidas = loan.horas_devolvidas || 0;

      totalEmprestadas += emprestadas;
      totalDevolvidas += devolvidas;
      totalPendente += emprestadas - devolvidas;
      quantidadeEmprestimos++;
    }

    return {
      totalEmprestadas,
      totalDevolvidas,
      totalPendente,
      quantidadeEmprestimos,
    };
  }, [loans]);

  const abastByLanc = useMemo(() => {
    const m = new Map<string, Abastecimento[]>();
    for (const a of abastecimentos) {
      if (!a.logbook_entry_id) continue;
      const arr = m.get(a.logbook_entry_id) ?? [];
      arr.push(a);
      m.set(a.logbook_entry_id, arr);
    }
    return m;
  }, [abastecimentos]);

  const displayLancamentos = useMemo(() => {
    let list = [...lancamentos];
    if (cotistaFiltro) list = list.filter((l) => labelVooPara(l) === cotistaFiltro);
    if (sortDir === "desc") list = list.reverse();
    if (!searchQuery.trim()) return list.map(l => ({ l, match: false }));
    const q = searchQuery.toLowerCase();
    return list.map(l => {
      const blob = [
        l.data_registro, l.aerodromo_partida, l.aerodromo_chegada,
        l.natureza_voo, labelVooPara(l), l.socios_nome,
        tripById.get(l.pic_canac ?? "")?.nome_completo,
        l.sic_name, l.trecho,
      ].filter(Boolean).join(" ").toLowerCase();
      return { l, match: blob.includes(q) };
    });
  }, [lancamentos, sortDir, searchQuery, tripById, labelVooPara, cotistaFiltro]);

  const startResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[col] ?? 80;
    resizingRef.current = { col, startX, startW };
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = ev.clientX - resizingRef.current.startX;
      setColWidths(prev => ({ ...prev, [resizingRef.current!.col]: Math.max(40, resizingRef.current!.startW + diff) }));
    };
    const onUp = () => { resizingRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleConfirmar = async (l: Lanc) => {
    if (l.confirmado) return;
    const { data: { user } } = await supabase.auth.getUser();
    const usuarioNome = user?.email || user?.id?.slice(0, 8) || "Sistema";
    const { error } = await supabase.from("lancamentos_diario_bordo")
      .update({ confirmado: true, confirmado_por: usuarioNome, confirmado_em: new Date().toISOString() })
      .eq("id", l.id);
    if (error) toast.error("Erro ao confirmar lançamento");
    else { toast.success("Lançamento confirmado"); await reload(); }
  };

  const handleAssinarPic = async (l: Lanc) => {
    if (l.pic_canac !== tripulacaoUsuario?.canac) { toast.error("Apenas o PIC deste lançamento pode assinar"); return; }
    const { error } = await supabase.from("lancamentos_diario_bordo")
      .update({ assinado_por: usuarioAtual?.id, data_assinatura_piloto: new Date().toISOString() })
      .eq("id", l.id);
    if (error) toast.error("Erro ao assinar lançamento como PIC");
    else { toast.success("Lançamento assinado como PIC"); await reload(); }
  };

  // ── CHANGE 1: Row actions – edit OR delete ────────────────────────────────
  const handleClickRowAction = (l: Lanc, action: "edit" | "delete") => {
    setRowActionOpen(null);
    if (l.confirmado && !canEditConfirmed) {
      toast.error("Este lançamento está confirmado e não pode ser editado/excluído");
      return;
    }
    setEditConfirmDialog({ open: true, lanc: l, action });
  };

  const confirmAction = async () => {
    const { lanc, action } = editConfirmDialog;
    setEditConfirmDialog({ open: false, lanc: null, action: "edit" });
    if (!lanc) return;
    if (action === "edit") {
      setEditingLanc(lanc);
      setActivePanel("editarVoo");
    } else {
      // Delete
      const { error } = await supabase.from("lancamentos_diario_bordo").delete().eq("id", lanc.id);
      if (error) toast.error("Erro ao excluir lançamento: " + error.message);
      else { toast.success("Lançamento excluído"); await reload(); }
    }
  };

  const temDiaria = diarioMes?.tem_tarifa_diaria === true;
  const valorDiaria = Number(diarioMes?.tarifa_diaria ?? 0);
  const totalDiariaReais = totals.totalDiarias * valorDiaria;

  // ── CHANGE 2: Disponível é sempre derivado da fórmula (prox - atual) ─────────────────
  const celulaDisponivel = modoCelula === "tvoo"
    ? calculateCelulaDisponivel(
        diarioMes?.celula_prox_revisao_tvoo ?? 0,
        diarioMes?.celula_atual_tvoo ?? 0
      )
    : calculateCelulaDisponivel(
        diarioMes?.celula_prox_revisao_ttotal ?? 0,
        diarioMes?.celula_atual_ttotal ?? 0
      );

  const handleOpenCreateMonth = async () => {
    try {
      const mesAnterior = mes === 1 ? 12 : mes! - 1;
      const anoAnterior = mes === 1 ? ano! - 1 : ano!;
      const { data: previousMonth } = await supabase.from("diario_mes").select("*")
        .eq("aeronave_id", aircraftId).eq("ano", anoAnterior).eq("mes", mesAnterior).maybeSingle();
      setPreviousMonthForCreation(previousMonth);
      setShowCreateMonth(true);
    } catch { setShowCreateMonth(true); }
  };

  const handleCreateMonth = async (data: any) => {
    try {
      const mesAnterior = mes === 1 ? 12 : mes! - 1;
      const anoAnterior = mes === 1 ? ano! - 1 : ano!;
      const { data: previousMonth } = await supabase.from("diario_mes").select("id, fechado")
        .eq("aeronave_id", aircraftId).eq("ano", anoAnterior).eq("mes", mesAnterior).maybeSingle();
      if (previousMonth && !previousMonth.fechado) {
        toast.warning("Aviso: O mês anterior ainda não foi fechado!", {
          description: `${monthNames[mesAnterior - 1]}/${anoAnterior} - Feche o mês anterior antes de prosseguir`,
        });
      }
      await supabase.from("aeronave").update({ modo_celula: data.modo_celula }).eq("id", aircraftId);
      const { error } = await supabase.from("diario_mes").insert({
        aeronave_id: aircraftId, ano: data.year, mes: data.month,
        celula_anterior_ttotal: data.celula_anterior, celula_atual_ttotal: data.celula_atual,
        celula_prox_revisao_ttotal: data.celula_prox_revisao, celula_disponivel_ttotal: data.celula_disponivel,
        celula_anterior_tvoo: data.celula_anterior, celula_atual_tvoo: data.celula_atual,
        celula_prox_revisao_tvoo: data.celula_prox_revisao, celula_disponivel_tvoo: data.celula_disponivel,
        horimetro_inicio: data.horimetro_inicio, horimetro_final: data.horimetro_final,
        aerodromo_base: data.base_aerodrome, consumo_combustivel: data.fuel_consumption,
        tem_tarifa_diaria: data.has_daily_rate, tarifa_diaria: data.daily_rate,
      });
      if (error) toast.error("Erro ao criar novo mês: " + error.message);
      else { setModoCelula(data.modo_celula); toast.success("Novo mês criado!"); setMes(data.month); setAno(data.year); }
    } catch { toast.error("Erro ao criar novo mês"); }
  };

  const saveDiarioMesField = async (field: string, value: number | string) => {
    try {
      if (!diarioMes?.id) return;

      const updateData: any = { [field]: value };

      // Se atualizando prox_revisao, recalcular celula_disponivel automaticamente
      if (field === "celula_prox_revisao_ttotal") {
        const celulaAtual = diarioMes.celula_atual_ttotal ?? 0;
        updateData.celula_disponivel_ttotal = calculateCelulaDisponivel(Number(value), celulaAtual);
      } else if (field === "celula_prox_revisao_tvoo") {
        const celulaAtual = diarioMes.celula_atual_tvoo ?? 0;
        updateData.celula_disponivel_tvoo = calculateCelulaDisponivel(Number(value), celulaAtual);
      }

      const { error } = await supabase.from("diario_mes").update(updateData).eq("id", diarioMes.id);
      if (error) toast.error("Erro ao salvar: " + error.message);
      else { toast.success("Salvo!"); await reload(); }
    } catch { toast.error("Erro ao salvar"); }
  };

  const handleExportarPDF = async (mesesSelecionados: Array<{ mes: number; ano: number }>) => {
    setIsExporting(true);
    try {
      const mesesdados = [];
      for (const { mes: mês, ano: year } of mesesSelecionados) {
        const ini = `${year}-${String(mês).padStart(2, "0")}-01`;
        const fimDate = new Date(year, mês, 0);
        const fim = `${year}-${String(mês).padStart(2, "0")}-${String(fimDate.getDate()).padStart(2, "0")}`;
        const [lRes, cRes, sRes, tRes] = await Promise.all([
          supabase.from("lancamentos_diario_bordo").select("*").eq("aeronave_id", aircraftId)
            .gte("data_registro", ini).lte("data_registro", fim).order("data_registro", { ascending: true }),
          supabase.from("clientes").select("id,razao_social,proprietario").order("razao_social"),
          (supabase as any).from("socios_cliente").select("id,nome,cliente_id").order("nome"),
          supabase.from("membros_tripulacao").select("id,nome_completo,canac,status"),
        ]);
        const lancamentosData = (lRes.data ?? []) as unknown as Lanc[];
        const clientesData = (cRes.data ?? []) as Cliente[];
        const sociosData = (((sRes.data ?? []) as any[]).map((s) => ({ id: s.id, nome: s.nome, cliente_id: s.cliente_id }))) as Socio[];
        const tripulantesData = (tRes.data ?? []) as Tripulante[];
        const tripByCanac = new Map<string, Tripulante>();
        tripulantesData.forEach((t) => { if (t.canac) tripByCanac.set(t.canac, t); });
        const lancamentosComNomes = lancamentosData.map((l) => ({
          ...l, pic: l.pic_canac ? tripByCanac.get(l.pic_canac) : null, sic: l.sic_canac ? tripByCanac.get(l.sic_canac) : null,
        }));
        const totaisData = {
          tVoo: sumDecimal(lancamentosData.map((l) => l.tempo_voo)), tTotal: sumDecimal(lancamentosData.map((l) => l.tempo_total)),
          tDia: sumDecimal(lancamentosData.map((l) => l.horas_diurnas)), tNoit: sumDecimal(lancamentosData.map((l) => l.horas_noturnas)),
          ifr: sumDecimal(lancamentosData.map((l) => l.tempo_ifr)), pousos: lancamentosData.reduce((s, l) => s + Number(l.pousos_total ?? 0), 0),
          abast: sumDecimal(lancamentosData.map((l) => l.combustivel_adicionado)), fuel: sumDecimal(lancamentosData.map((l) => l.litros_combustivel_inicio_voo)),
          totalDiarias: lancamentosData.reduce((s, l) => s + Number(l.tarifa_diaria ?? 0), 0),
        };
        const mapCotista = new Map<string, { label: string; horas: number }>();
        for (const l of lancamentosData) {
          const horas = Number((modoCelula === "tvoo" ? l.tempo_voo : l.tempo_total) ?? 0);
          const nat = (l.natureza_voo ?? "").trim();
          const naturezasRateio = ["Translado", "Cheque", "Voo de Teste", "Teste"];
          let label: string;
          if (naturezasRateio.some((n) => nat.toLowerCase() === n.toLowerCase())) label = nat.toUpperCase();
          else if (l.socios_cliente_id) { const s = sociosData.find((x) => x.id === l.socios_cliente_id); label = s?.nome ?? l.socios_nome ?? "Sócio"; }
          else if (l.clientes_id) { const c = clientesData.find((x) => x.id === l.clientes_id); label = c?.razao_social ?? c?.proprietario ?? "Cliente"; }
          else label = nat || "—";
          const cur = mapCotista.get(label) ?? { label, horas: 0 };
          cur.horas += horas;
          mapCotista.set(label, cur);
        }
        mesesdados.push({ mes: mês, ano: year, lancamentos: lancamentosComNomes, totals: totaisData, porCotista: Array.from(mapCotista.values()).sort((a, b) => b.horas - a.horas), temDiaria: diarioMes?.tem_tarifa_diaria === true });
      }
      const pdf = await exportDiarioBordoPDF({ aeronave: { matricula: aeronave!.matricula, modelo: aeronave!.modelo, ano: aeronave!.ano }, meses: mesesdados }, "/share.png");
      pdf.save(`Diario_${aeronave!.matricula}_${new Date().getTime()}.pdf`);
      toast.success("PDF exportado!");
      setShowExportModal(false);
    } catch { toast.error("Erro ao exportar PDF"); }
    finally { setIsExporting(false); }
  };

  if (loading || !aircraftId) {
    return (
      <Layout>
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-slate-700 border-t-cyan-400 rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Carregando diário...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!aeronave) {
    return (
      <Layout>
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <p className="text-slate-400">Aeronave não encontrada</p>
        </div>
      </Layout>
    );
  }

  const ResizeHandle = ({ col }: { col: string }) => (
    <span onMouseDown={(e) => startResize(col, e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-cyan-500/50 transition-colors select-none z-10" />
  );

  // ── CHANGE 3: Determine if inline panel is shown ──────────────────────────
  const showInlinePanel = activePanel !== "none";

  return (
    <Layout>
      <div className="min-h-screen bg-slate-900">
        <div className="max-w-[1800px] mx-auto px-4 py-4 md:px-6 md:py-5 space-y-4">

          {/* ── HEADER ──────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => navigate('/diario-bordo')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-all">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar
            </button>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              
              <div className="min-w-0">
                <h1 className="text-base font-bold text-white tracking-wide truncate">
                  Diário {monthNames[(mes ?? 1) - 1]} {ano} — {aeronave.matricula}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleOpenCreateMonth}
                className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-400/50 text-emerald-400 font-medium rounded-lg px-3 py-1.5 text-xs transition-all">
                <Calendar className="w-3.5 h-3.5" /> Novo Mês
              </button>
              <button
                onClick={() => { setActivePanel(activePanel === "novoVoo" ? "none" : "novoVoo"); setEditingLanc(null); }}
                className={`inline-flex items-center gap-1.5 font-medium rounded-lg px-3 py-1.5 text-xs transition-all border ${
                  activePanel === "novoVoo"
                    ? "bg-cyan-500 border-cyan-400 text-slate-900"
                    : "bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30 hover:border-cyan-400/50 text-cyan-400"
                }`}>
                <Plus className="w-3.5 h-3.5" /> Novo Voo
              </button>
              <button onClick={() => setShowExportModal(true)}
                className="inline-flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-400/50 text-amber-400 font-medium rounded-lg px-3 py-1.5 text-xs transition-all">
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
          </div>

          {/* ── INLINE PANEL: NovoVoo ──────────────────────────────────── */}
          <AnimatePresence>
            {activePanel === "novoVoo" && aeronave && (
              <motion.div
                initial={{ opacity: 0, y: -12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -12, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-cyan-500/30 bg-slate-800/70 backdrop-blur-sm shadow-lg shadow-cyan-500/5">
                  <NovoVooInline
                    aeronave={aeronave} mes={mes!} ano={ano!} modoCelula={modoCelula}
                    clientes={clientes} socios={socios} tripulantes={tripulantes}
                    ultimaCelula={diarioMes?.celula_atual_ttotal ?? 0}
                    ultimaCelulaTvoo={diarioMes?.celula_atual_tvoo ?? 0}
                    temDiaria={temDiaria}
                    onClose={() => setActivePanel("none")}
                    onSaved={async () => { setActivePanel("none"); await new Promise(r => setTimeout(r, 300)); await reload(); }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── INLINE PANEL: EditarVoo ────────────────────────────────── */}
          <AnimatePresence>
            {activePanel === "editarVoo" && editingLanc && aeronave && (
              <motion.div
                initial={{ opacity: 0, y: -12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -12, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-amber-500/30 bg-slate-800/70 backdrop-blur-sm shadow-lg shadow-amber-500/5">
                  <EditarVooInline
                    lanc={editingLanc} aeronave={aeronave}
                    clientes={clientes} socios={socios} tripulantes={tripulantes}
                    temDiaria={temDiaria}
                    onClose={() => { setActivePanel("none"); setEditingLanc(null); }}
                    onSaved={async () => { setActivePanel("none"); setEditingLanc(null); await reload(); }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── INLINE PANEL: Consumo ──────────────────────────────────── */}
          <AnimatePresence>
            {activePanel === "consumo" && aeronave && (
              <motion.div
                initial={{ opacity: 0, y: -12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -12, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-amber-500/30 bg-slate-800/70">
                  {/* Inline consumo header */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold text-white">Consumo de Combustível</span>
                    </div>
                    <button onClick={() => setActivePanel("none")} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-5">
                    <ConsumoDialog
                      aeronave={aeronave}
                      lancamentos={lancamentos}
                      lancamentosAno={lancamentosAno}
                      clientes={clientes} socios={socios}
                      mes={mes!} ano={ano!}
                      labelVooPara={labelVooPara}
                      onClose={() => setActivePanel("none")}
                      inline={true}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── CHANGE 4: CARDS REDESIGN ──────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

            {/* Card 1 – Aeronave + Célula */}
            <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
              {/* Header row */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-cyan-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Aeronave</span>
                <span className="ml-auto text-xs text-slate-500">{aeronave.matricula} · {aeronave.modelo}</span>
              </div>

              {/* Two sub-rows */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <MiniStat label="Matrícula" value={aeronave?.matricula ?? "—"} labelColor="text-cyan-400" />
                <MiniStat label="Modelo" value={aeronave?.modelo ?? "—"} labelColor="text-cyan-400" />
                <MiniStat label="Ano" value={aeronave?.ano ?? "—"} labelColor="text-cyan-400" />
                <MiniStat label="Base" value={aeronave?.base ?? "—"} labelColor="text-cyan-400" />
              </div>

              {/* Célula row */}
              <div className="border-t border-slate-700/40 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-3 rounded-full bg-violet-400" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">Célula</span>
                  <span className="ml-auto text-[10px] text-slate-600 bg-slate-700/50 px-2 py-0.5 rounded-full">
                    {modoCelula === "tvoo" ? "T. Voo" : "T. Total"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Célula Anterior – editable */}
                  <EditableCell
                    label="Anterior"
                    value={modoCelula === "tvoo" ? (diarioMes?.celula_anterior_tvoo ?? 0) : (diarioMes?.celula_anterior_ttotal ?? 0)}
                    fieldName={modoCelula === "tvoo" ? "celula_anterior_tvoo" : "celula_anterior_ttotal"}
                    onSave={saveDiarioMesField}
                    unit="h"
                    hint="clique para editar"
                    labelColor="text-violet-400"
                  />
                  {/* Célula Atual */}
                  <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-700/40">
                    <p className="text-[10px] text-violet-400 mb-1">Atual</p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm font-bold text-white">
                            {selectedLancId
                              ? (() => { const l = lancamentos.find(x => x.id === selectedLancId); return `${num(modoCelula === "tvoo" ? (l?.celula_tvoo ?? 0) : (l?.celula ?? 0), 1)}h`; })()
                              : `${num(modoCelula === "tvoo" ? (diarioMes?.celula_atual_tvoo ?? 0) : (diarioMes?.celula_atual_ttotal ?? 0), 1)}h`}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-slate-900 border-slate-700 text-xs">
                          <p>T.Voo: {num(diarioMes?.celula_atual_tvoo ?? 0, 1)}h</p>
                          <p>T.Total: {num(diarioMes?.celula_atual_ttotal ?? 0, 1)}h</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {selectedLancId && (
                      <button onClick={() => setSelectedLancId(null)} className="text-[9px] text-cyan-400 hover:underline mt-0.5">limpar</button>
                    )}
                  </div>
                  {/* Próxima Revisão – editable */}
                  <EditableCell
                    label="Próx. Revisão"
                    value={modoCelula === "tvoo" ? (diarioMes?.celula_prox_revisao_tvoo ?? 0) : (diarioMes?.celula_prox_revisao_ttotal ?? 0)}
                    fieldName={modoCelula === "tvoo" ? "celula_prox_revisao_tvoo" : "celula_prox_revisao_ttotal"}
                    onSave={saveDiarioMesField}
                    unit="h"
                    hint="clique para editar"
                    labelColor="text-violet-400"
                  />
                  {/* Disponível – sempre mostra o valor calculado (pode ser negativo) */}
                  <div className={`rounded-lg p-2.5 border ${celulaDisponivel < 0 ? 'bg-red-900/20 border-red-500/20' : 'bg-emerald-900/20 border-emerald-500/20'}`}>
                    <p className={`text-[10px] mb-1 ${celulaDisponivel < 0 ? 'text-red-400/70' : 'text-emerald-400/70'}`}>Disponível</p>
                    <p className={`text-sm font-bold ${celulaDisponivel < 0 ? 'text-red-300' : 'text-emerald-300'}`}>{num(celulaDisponivel, 1)}h</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2 – Horímetro + Período */}
            <div className="flex flex-col gap-3">
              {/* Horímetro */}
              <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">Horímetro</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <EditableCell label="Inicial" value={diarioMes?.horimetro_inicio ?? 0} fieldName="horimetro_inicio" onSave={saveDiarioMesField} unit="h" accentColor="amber" hint="clique para editar" labelColor="text-amber-400" />
                  <EditableCell label="Final" value={diarioMes?.horimetro_final ?? 0} fieldName="horimetro_final" onSave={saveDiarioMesField} unit="h" accentColor="amber" hint="clique para editar" labelColor="text-amber-400" />
                  <EditableCell label="Ativo" value={diarioMes?.horimetro_ativo ?? 0} fieldName="horimetro_ativo" onSave={saveDiarioMesField} unit="h" accentColor="amber" hint="clique para editar" labelColor="text-amber-400" />
                </div>
              </div>

              {/* Período */}
              <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 flex-1">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full bg-blue-400" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">Período</span>
                  </div>
                  <div className="flex gap-1">
                    <select value={mes!} onChange={(e) => setMes(Number(e.target.value))}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:border-cyan-500/50 focus:outline-none">
                      {monthNames.map((m, i) => {
                        // Mostrar apenas meses que existem em availableMeses para o ano selecionado
                        const hasData = availableMeses.some(am => am.ano === ano && am.mes === i + 1);
                        if (!hasData) return null;
                        return <option key={i} value={i + 1}>{m.slice(0, 3).toUpperCase()}</option>;
                      })}
                    </select>
                    <select value={ano!} onChange={(e) => setAno(Number(e.target.value))}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:border-cyan-500/50 focus:outline-none">
                      {/* Mostrar apenas anos que existem em availableMeses */}
                      {Array.from(new Set(availableMeses.map(am => am.ano)))
                        .sort((a, b) => b - a)
                        .map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-700/40">
                    <p className="text-[10px] text-slate-500 mb-1">{modoCelula === "tvoo" ? "T. Voo" : "T. Total"}</p>
                    <p className="text-sm font-bold text-cyan-300">{modoCelula === "tvoo" ? decimalToHHMM(totals.tVoo) : decimalToHHMM(totals.tTotal)}</p>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-700/40">
                    <p className="text-[10px] text-slate-500 mb-1">Pousos</p>
                    <p className="text-sm font-bold text-emerald-300">{totals.pousos}</p>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-700/40">
                    <p className="text-[10px] text-slate-500 mb-1">Voos</p>
                    <p className="text-sm font-bold text-white">{lancamentos.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── CHANGE 3: Consumo inline trigger card ─────────────────── */}
          <button
            onClick={() => setActivePanel(activePanel === "consumo" ? "none" : "consumo")}
            className={`w-full text-left rounded-xl border p-4 transition-all ${
              activePanel === "consumo"
                ? "border-amber-400/50 bg-amber-500/10"
                : "border-amber-500/20 bg-amber-500/5 hover:border-amber-400/40 hover:bg-amber-500/10"
            }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/15 rounded-lg border border-amber-500/20">
                  <Droplets className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-0.5">Consumo de Combustível</p>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400">Histórico: <span className="text-white font-semibold">{num(aeronave?.consumo_combustivel ?? 0, 1)} L/H</span></span>
                    <span className="text-xs text-slate-400">Mês: <span className="text-white font-semibold">{totals.fuel > 0 && totals.tVoo > 0 ? num(totals.fuel / totals.tVoo, 1) : "—"} L/H</span></span>
                  </div>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-amber-400 transition-transform ${activePanel === "consumo" ? "rotate-180" : ""}`} />
            </div>
          </button>

          {/* ── TABELA TOOLBAR ────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setHighlightedId(null); }}
                placeholder="Filtrar registros..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-xs text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">
              {sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              {sortDir === "asc" ? "Crescente" : "Decrescente"}
            </button>
            <button onClick={() => setModoTabela(m => m === "completo" ? "resumo" : "completo")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">
              {modoTabela === "completo" ? <MapIcon className="w-3.5 h-3.5 text-cyan-400" /> : <LayoutList className="w-3.5 h-3.5 text-cyan-400" />}
              {modoTabela === "completo" ? "Resumo" : "Completo"}
            </button>
          </div>

          {/* ── TABELA ────────────────────────────────────────────────── */}
          <section className="bg-slate-900 border border-slate-700/40 rounded-xl overflow-hidden">
            <div className="border-b border-slate-700/40 px-4 py-2.5 flex items-center justify-between bg-slate-800/30">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Plane className="w-3.5 h-3.5 text-cyan-400" /> Registros de Voo
              </h2>
              <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">{lancamentos.length} voos</span>
            </div>

            <div className="overflow-auto max-h-[420px]">
              {modoTabela === "completo" ? (
                <table className="w-full border-collapse text-xs [&_td]:border-r [&_td]:border-slate-700/50 [&_th]:border-r [&_th]:border-slate-700/50 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0" style={{ tableLayout: "fixed" }}>
                  <thead className="border-b border-slate-700/50 bg-slate-800/50 sticky top-0 z-10">
                    <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2 text-center relative" style={{ width: colWidths["#"] ?? 44 }}>#<ResizeHandle col="#" /></th>
                      <th className="px-2 py-2 text-left relative" style={{ width: colWidths["data"] ?? 52 }}>Data<ResizeHandle col="data" /></th>
                      <th className="px-2 py-2 text-left relative" style={{ width: colWidths["de"] ?? 52 }}>De<ResizeHandle col="de" /></th>
                      <th className="px-2 py-2 text-left relative" style={{ width: colWidths["para"] ?? 52 }}>Para<ResizeHandle col="para" /></th>
                      <th className="px-2 py-2 text-left relative" style={{ width: colWidths["ac"] ?? 52 }}>AC<ResizeHandle col="ac" /></th>
                      <th className="px-2 py-2 text-left relative" style={{ width: colWidths["dep"] ?? 52 }}>DEP<ResizeHandle col="dep" /></th>
                      <th className="px-2 py-2 text-left relative" style={{ width: colWidths["pou"] ?? 52 }}>POU<ResizeHandle col="pou" /></th>
                      <th className="px-2 py-2 text-left relative" style={{ width: colWidths["cor"] ?? 52 }}>COR<ResizeHandle col="cor" /></th>
                      <th className="px-2 py-2 text-left relative" style={{ width: colWidths["tvoo"] ?? 62, color: "rgb(43, 122, 216)" }}>T VOO<ResizeHandle col="tvoo" /></th>
                      <th className="px-2 py-2 text-left relative" style={{ width: colWidths["tdia"] ?? 58, color: "rgb(106, 226, 231)" }}>T DIA<ResizeHandle col="tdia" /></th>
                      <th className="px-2 py-2 text-left relative" style={{ width: colWidths["tnoit"] ?? 58, color: "rgb(144, 19, 254)" }}>T NOIT<ResizeHandle col="tnoit" /></th>
                      <th className="px-2 py-2 text-left text-amber-400 relative" style={{ width: colWidths["ifr"] ?? 48 }}>IFR<ResizeHandle col="ifr" /></th>
                      <th className="px-2 py-2 text-center text-emerald-400 relative" style={{ width: colWidths["pousos"] ?? 52 }}>POUSOS<ResizeHandle col="pousos" /></th>
                      <th className="px-2 py-2 text-left relative" style={{ width: colWidths["abast"] ?? 56, color: "rgb(205, 132, 10)" }}>ABAST+<ResizeHandle col="abast" /></th>
                      <th className="px-2 py-2 text-left text-amber-400 relative" style={{ width: colWidths["fuel"] ?? 48 }}>FUEL<ResizeHandle col="fuel" /></th>
                      <th className="px-2 py-2 text-left text-slate-400 relative" style={{ width: colWidths["celula"] ?? 62 }}>CÉLULA<ResizeHandle col="celula" /></th>
                      <th className="px-2 py-2 text-left relative" style={{ width: colWidths["pic"] ?? 100 }}>PIC<ResizeHandle col="pic" /></th>
                      <th className="px-2 py-2 text-left relative" style={{ width: colWidths["sic"] ?? 100 }}>SIC<ResizeHandle col="sic" /></th>
                      <th className="px-2 py-2 text-left relative" style={{ width: colWidths["voopara"] ?? 110 }}>VOO PARA<ResizeHandle col="voopara" /></th>
                      {temDiaria && <th className="px-2 py-2 text-left text-violet-400 relative" style={{ width: colWidths["diarias"] ?? 60 }}>DIÁRIAS<ResizeHandle col="diarias" /></th>}
                      <th className="px-2 py-2 text-center relative" style={{ width: colWidths["confPor"] ?? 140 }}>CONF. POR<ResizeHandle col="confPor" /></th>
                      <th className="px-2 py-2 text-center relative" style={{ width: colWidths["confirmar"] ?? 80 }}>CONF.<ResizeHandle col="confirmar" /></th>
                      <th className="px-2 py-2 text-center relative" style={{ width: colWidths["assinar"] ?? 100 }}>ASSIN.<ResizeHandle col="assinar" /></th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {displayLancamentos.length === 0 ? (
                      <tr><td colSpan={24} className="p-10 text-center text-slate-500 text-xs">Nenhum voo registrado neste período.</td></tr>
                    ) : displayLancamentos.map(({ l, match }, idx) => {
                      const picT = l.pic_canac ? tripById.get(l.pic_canac) : null;
                      const sicT = l.sic_canac ? tripById.get(l.sic_canac) : null;
                      const isHighlight = searchQuery && match;
                      const isConfirmado = l.confirmado === true;
                      return (
                        <tr key={l.id} id={`row-${l.id}`}
                          className={[
                            "border-b border-slate-700/40 transition-colors",
                            isHighlight ? "bg-cyan-500/10" : idx % 2 === 0 ? "bg-slate-800/20" : "",
                            "hover:bg-slate-800/50",
                          ].join(" ")}>
                          {/* ── CHANGE 1: Row actions with edit + delete ─── */}
                          <Td className="text-center">
                            <Popover open={rowActionOpen === l.id} onOpenChange={(o) => setRowActionOpen(o ? l.id : null)}>
                              <PopoverTrigger asChild>
                                <button className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors underline">{idx + 1}</button>
                              </PopoverTrigger>
                              <PopoverContent side="right" align="start" className="w-40 p-1 bg-slate-900 border-slate-700 rounded-xl shadow-xl">
                                <button
                                  onClick={() => handleClickRowAction(l, "edit")}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-cyan-400 rounded-lg transition-colors">
                                  <Pencil className="w-3.5 h-3.5" /> Editar
                                </button>
                                <button
                                  onClick={() => handleClickRowAction(l, "delete")}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-red-900/30 hover:text-red-400 rounded-lg transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                                </button>
                              </PopoverContent>
                            </Popover>
                          </Td>
                          <Td>{new Date(l.data_registro + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</Td>
                          <Td className="font-mono">{l.aerodromo_partida ?? "—"}</Td>
                          <Td className="font-mono">{l.aerodromo_chegada ?? "—"}</Td>
                          <Td className="font-mono text-slate-400">{pgTimeToHHMM(l.tempo_ac)}</Td>
                          <Td className="font-mono text-slate-400">{pgTimeToHHMM(l.tempo_dep)}</Td>
                          <Td className="font-mono text-slate-400">{pgTimeToHHMM(l.tempo_pou)}</Td>
                          <Td className="font-mono text-slate-400">{pgTimeToHHMM(l.tempo_cor)}</Td>
                          <Td className="font-mono font-semibold" style={{ color: "rgb(43, 122, 216)" }}>{decimalToHHMM(Number(l.tempo_voo ?? 0))}</Td>
                          <Td className="font-mono" style={{ color: "rgb(106, 226, 231)" }}>{decimalToHHMM(Number(l.tempo_total ?? 0))}</Td>
                          <Td className="font-mono" style={{ color: "rgb(144, 19, 254)" }}>{decimalToHHMM(Number(l.horas_noturnas ?? 0))}</Td>
                          <Td className="font-mono text-amber-400">{decimalToHHMM(Number(l.tempo_ifr ?? 0))}</Td>
                          <Td className="text-center text-emerald-400">{l.pousos_total ?? 0}</Td>
                          <Td>
                            {(() => {
                              const abastVinculados = abastByLanc.get(l.id) ?? [];
                              const comVinculo = abastVinculados.length > 0;
                              const totalAbast = num(l.combustivel_adicionado, 0);
                              return comVinculo ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => {
                                          // Se há apenas um abastecimento, navegar direto com o ID
                                          if (abastVinculados.length === 1) {
                                            navigate('/controle-abastecimento', { state: { selectedAbastecimentoId: abastVinculados[0].id } });
                                          } else {
                                            // Se há vários, navegar para a página de abastecimentos (deixar o usuário escolher)
                                            navigate('/controle-abastecimento', { state: { selectedAbastecimentoId: abastVinculados[0].id } });
                                          }
                                        }}
                                        className="text-blue-400 font-semibold hover:text-blue-300 hover:underline"
                                      >
                                        {totalAbast}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-slate-900 border border-slate-700 text-slate-100 text-xs p-2 max-w-xs">
                                      <div className="space-y-2">
                                        <div className="font-semibold border-b border-slate-700 pb-1">
                                          {abastVinculados.length} abast. vinculado{abastVinculados.length !== 1 ? 's' : ''}
                                        </div>
                                        {abastVinculados.map((ab, idx) => (
                                          <div key={ab.id} className="space-y-0.5 text-[11px]">
                                            {idx > 0 && <div className="border-t border-slate-700 my-1"></div>}
                                            {ab.comanda && <div><span className="text-slate-400">Comanda:</span> {ab.comanda}</div>}
                                            {ab.litros !== null && ab.litros !== undefined && <div><span className="text-slate-400">Litros:</span> {ab.litros.toFixed(2)}</div>}
                                            {ab.valor_unitario !== null && ab.valor_unitario !== undefined && <div><span className="text-slate-400">V. Unitário:</span> R$ {ab.valor_unitario.toFixed(2)}</div>}
                                            {ab.valor_total !== null && ab.valor_total !== undefined && <div><span className="text-slate-400">V. Total:</span> R$ {ab.valor_total.toFixed(2)}</div>}
                                            {ab.abastecedor && <div><span className="text-slate-400">Abastecedor:</span> {ab.abastecedor}</div>}
                                            {ab.nf && <div><span className="text-slate-400">NF:</span> {ab.nf}</div>}
                                            {ab.tipo_faturamento && <div><span className="text-slate-400">Faturamento:</span> {ab.tipo_faturamento}</div>}
                                          </div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : <span className="text-amber-400">{totalAbast}</span>;
                            })()}
                          </Td>
                          <Td className="text-amber-400">{num(l.litros_combustivel_inicio_voo, 0)}</Td>
                          <Td className="font-mono text-white">{modoCelula === "tvoo" ? num(l.celula_tvoo ?? 0, 1) : num(l.celula ?? 0, 1)}h</Td>
                          <Td className="truncate">{picT?.nome_completo ?? l.pic_canac ?? "—"}</Td>
                          <Td className="truncate">{sicT?.nome_completo ?? l.sic_name ?? l.sic_canac ?? "—"}</Td>
                          <Td className="font-medium text-white truncate">{labelVooPara(l)}</Td>
                          {temDiaria && (
                            <Td className="text-center text-violet-400 font-semibold">
                              {Number(l.tarifa_diaria ?? 0) > 0 ? Number(l.tarifa_diaria) : "—"}
                            </Td>
                          )}
                          <Td className={`text-center ${isConfirmado ? "text-emerald-400 font-semibold" : "text-slate-500"}`}>
                            {l.confirmado_por && l.confirmado_em
                              ? `${l.confirmado_por}`
                              : "—"}
                          </Td>
                          <Td className="text-center">
                            {!isConfirmado && (
                              <button onClick={() => handleConfirmar(l)}
                                className="rounded border border-emerald-600/40 bg-emerald-900/20 p-1 text-emerald-400 hover:bg-emerald-800/40 transition-colors" title="Confirmar">
                                <CheckCircle2 className="w-3 h-3" />
                              </button>
                            )}
                          </Td>
                          <Td className="text-center">
                            {l.pic_canac === tripulacaoUsuario?.canac && !l.assinado_por && (
                              <button onClick={() => handleAssinarPic(l)}
                                className="rounded border border-blue-600/40 bg-blue-900/20 p-1 text-blue-400 hover:bg-blue-800/40 transition-colors" title="Assinar PIC">
                                <FileText className="w-3 h-3" />
                              </button>
                            )}
                            {l.assinado_por && <span className="text-[10px] text-blue-400">✓</span>}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {lancamentos.length > 0 && (
                    <tfoot className="border-t-2 border-cyan-500/20 bg-slate-800/80 sticky bottom-0">
                      <tr>
                        <td colSpan={8} className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-cyan-400/60">Totais</td>
                        <td className="px-2 py-2 font-mono font-bold" style={{ color: "rgb(43, 122, 216)" }}>{decimalToHHMM(totals.tVoo)}</td>
                        <td className="px-2 py-2 font-mono font-bold" style={{ color: "rgb(106, 226, 231)" }}>{decimalToHHMM(totals.tTotal)}</td>
                        <td className="px-2 py-2 font-mono font-bold" style={{ color: "rgb(144, 19, 254)" }}>{decimalToHHMM(totals.tNoit)}</td>
                        <td className="px-2 py-2 font-mono font-bold text-amber-400">{decimalToHHMM(totals.ifr)}</td>
                        <td className="px-2 py-2 text-center font-bold text-emerald-400">{totals.pousos}</td>
                        <td className="px-2 py-2 font-bold text-amber-400">{num(totals.abast, 0)}</td>
                        <td className="px-2 py-2 font-bold text-amber-400">{num(totals.fuel, 0)}</td>
                        <td className="px-2 py-2 text-slate-600">—</td>
                        <td colSpan={3} className="px-2 py-2 text-slate-600">—</td>
                        {temDiaria && (
                          <td className="px-2 py-2 font-bold text-violet-400 text-center">
                            {totals.totalDiarias}
                            <span className="block text-[10px] text-violet-300/60">R${num(totalDiariaReais, 0)}</span>
                          </td>
                        )}
                        <td colSpan={4} className="text-slate-600">—</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              ) : (
                /* MODO RESUMO */
                <table className="w-full border-collapse text-xs [&_td]:border-r [&_td]:border-slate-700/40 [&_th]:border-r [&_th]:border-slate-700/40 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
                  <thead className="border-b border-slate-700/40 bg-slate-800/50 sticky top-0">
                    <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                      <Th className="text-center">#</Th>
                      <Th>Data</Th>
                      <Th>Trecho</Th>
                      <Th>DEP</Th>
                      <Th>POU</Th>
                      <Th style={{ color: "rgb(43, 122, 216)" }}>T VOO</Th>
                      <Th>VOO PARA</Th>
                      {temDiaria && <Th className="text-violet-400">DIÁRIAS</Th>}
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {displayLancamentos.length === 0 ? (
                      <tr><td colSpan={9} className="p-10 text-center text-slate-500 text-xs">Nenhum voo registrado.</td></tr>
                    ) : displayLancamentos.map(({ l, match }, idx) => {
                      const isHighlight = searchQuery && match;
                      const trecho = l.trecho ?? `${l.aerodromo_partida ?? "—"} → ${l.aerodromo_chegada ?? "—"}`;
                      return (
                        <tr key={l.id}
                          className={[
                            "border-b border-slate-700/40 transition-colors",
                            isHighlight ? "bg-cyan-500/10" : idx % 2 === 0 ? "bg-slate-800/20" : "",
                            "hover:bg-slate-800/50",
                          ].join(" ")}>
                          <Td className="text-center font-mono text-slate-500">{idx + 1}</Td>
                          <Td>{new Date(l.data_registro + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</Td>
                          <Td className="font-mono font-medium text-white">{trecho}</Td>
                          <Td className="font-mono text-slate-400">{pgTimeToHHMM(l.tempo_dep)}</Td>
                          <Td className="font-mono text-slate-400">{pgTimeToHHMM(l.tempo_pou)}</Td>
                          <Td className="font-mono font-bold" style={{ color: "rgb(43, 122, 216)" }}>{decimalToHHMM(Number(l.tempo_voo ?? 0))}</Td>
                          <Td className="font-medium text-white">{labelVooPara(l)}</Td>
                          {temDiaria && (
                            <Td className="text-center text-violet-400 font-semibold">
                              {Number(l.tarifa_diaria ?? 0) > 0 ? Number(l.tarifa_diaria) : "—"}
                            </Td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Resumo por cotista */}
          <section className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Horas por Cotista</h2>
              <span className="text-[10px] text-slate-500">({modoCelula === "tvoo" ? "T. Voo" : "T. Total"})</span>
            </div>
            {porCotista.length === 0 ? (
              <p className="py-4 text-center text-slate-500 text-xs">Sem registros.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {porCotista.map((c, idx) => {
                  const tot = porCotista.reduce((s, x) => s + x.horas, 0);
                  const pct = tot > 0 ? (c.horas / tot) * 100 : 0;
                  const colors = ["from-cyan-500 to-blue-500", "from-violet-500 to-purple-500", "from-emerald-500 to-teal-500", "from-amber-500 to-orange-500", "from-rose-500 to-pink-500"];
                  const color = colors[idx % colors.length];
                  return (
                    <button key={`${c.label}-${idx}`}
                      onClick={() => setCotistaFiltro(cotistaFiltro === c.label ? null : c.label)}
                      className={`rounded-xl border p-3 flex flex-col gap-1.5 transition-all text-left ${cotistaFiltro === c.label ? "border-cyan-400 bg-cyan-500/10" : "border-slate-700/40 bg-slate-800/50 hover:border-slate-600"}`}>
                      <span className="truncate text-[10px] font-medium text-slate-400" title={c.label}>{c.label}</span>
                      <span className={`font-mono text-base font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>{decimalToHHMM(c.horas)}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1 overflow-hidden rounded-full bg-slate-900">
                          <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-slate-500 text-[10px]">{pct.toFixed(0)}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Horas Emprestimos */}
          <section className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">Horas Emprestimos</h2>
              </div>
              {loans.length > 0 && (
                <span className="text-xs font-medium text-slate-400">
                  {emprestimosResumo.quantidadeEmprestimos} {emprestimosResumo.quantidadeEmprestimos === 1 ? "empréstimo" : "empréstimos"}
                </span>
              )}
            </div>
            {loans.length === 0 ? (
              <p className="py-4 text-center text-slate-500 text-xs">Sem empréstimos registrados.</p>
            ) : (
              <>
                {/* Resumo Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {/* Card Horas Emprestadas */}
                  <div className="bg-slate-950/40 border border-slate-700/30 rounded-lg p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase mb-2">Emprestado</p>
                    <p className="text-xl font-bold text-sky-400 font-mono">{decimalToHHMM(emprestimosResumo.totalEmprestadas)}</p>
                  </div>

                  {/* Card Horas Devolvidas */}
                  <div className="bg-slate-950/40 border border-slate-700/30 rounded-lg p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase mb-2">Devolvido</p>
                    <p className="text-xl font-bold text-emerald-400 font-mono">{decimalToHHMM(emprestimosResumo.totalDevolvidas)}</p>
                  </div>

                  {/* Card Saldo Pendente */}
                  <div className={`border rounded-lg p-3 ${emprestimosResumo.totalPendente > 0 ? "bg-red-500/10 border-red-500/20" : "bg-emerald-500/10 border-emerald-500/20"}`}>
                    <p className={`text-[9px] font-bold uppercase mb-2 ${emprestimosResumo.totalPendente > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      Saldo Pendente
                    </p>
                    <p className={`text-xl font-bold font-mono ${emprestimosResumo.totalPendente > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {decimalToHHMM(emprestimosResumo.totalPendente)}
                    </p>
                  </div>
                </div>

                {/* Tabela de Detalhes de Empréstimos */}
                <div className="bg-slate-900/40 border border-slate-700/40 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[10px] font-bold uppercase">
                      <thead>
                        <tr className="bg-slate-800/50 text-slate-400">
                          <th className="px-3 py-2 text-left">Data</th>
                          <th className="px-3 py-2 text-left">Trecho</th>
                          <th className="px-3 py-2 text-center">Emprestado</th>
                          <th className="px-3 py-2 text-center">Devolvido</th>
                          <th className="px-3 py-2 text-center">Saldo</th>
                          <th className="px-3 py-2 text-left">PIC</th>
                          <th className="px-3 py-2 text-center">Fuel (L)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30">
                        {loans.map(loan => {
                          const emprestadas = loan.horas_emprestadas || 0;
                          const devolvidas = loan.horas_devolvidas || 0;
                          const saldo = emprestadas - devolvidas;
                          const formattedDate = new Date(loan.data_lancamento).toLocaleDateString("pt-BR");
                          const trecho = loan.trecho || (loan.aerodromo_partida && loan.aerodromo_chegada
                            ? `${loan.aerodromo_partida} → ${loan.aerodromo_chegada}`
                            : "-");
                          const fuelAdded = loan.combustivel_adicionado ? Number(loan.combustivel_adicionado).toFixed(1) : "-";
                          const pilotName = loan.nome_piloto || "-";
                          const observations = loan.observacoes || "-";
                          const isPending = saldo > 0;

                          return (
                            <tr key={loan.id} className="hover:bg-slate-800/20 transition-colors">
                              <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{formattedDate}</td>
                              <td className="px-3 py-2 text-slate-300 font-mono text-xs">{trecho}</td>
                              <td className="px-3 py-2 text-center text-sky-400 font-mono whitespace-nowrap">{decimalToHHMM(emprestadas)}</td>
                              <td className="px-3 py-2 text-center text-emerald-400 font-mono whitespace-nowrap">{decimalToHHMM(devolvidas)}</td>
                              <td className={`px-3 py-2 text-center font-mono whitespace-nowrap ${isPending ? "text-red-400" : "text-emerald-400"}`}>
                                {decimalToHHMM(saldo)}
                              </td>
                              <td className="px-3 py-2 text-slate-300 truncate text-xs">{pilotName}</td>
                              <td className="px-3 py-2 text-center text-slate-300 font-mono whitespace-nowrap">{fuelAdded}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>

        </div>
      </div>

      {/* ── CHANGE 1: Confirm dialog (edit or delete) ─────────────────── */}
      <AlertDialog open={editConfirmDialog.open} onOpenChange={(open) => {
        if (!open) setEditConfirmDialog({ open: false, lanc: null, action: "edit" });
      }}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 max-w-sm">
          <AlertDialogTitle className={`text-white flex items-center gap-2 ${editConfirmDialog.action === "delete" ? "text-red-400" : ""}`}>
            {editConfirmDialog.action === "delete" ? <Trash2 className="w-4 h-4 text-red-400" /> : <Pencil className="w-4 h-4 text-amber-400" />}
            {editConfirmDialog.action === "delete" ? "Confirmar exclusão?" : "Editar lançamento?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400 text-sm">
            {editConfirmDialog.action === "delete"
              ? "Esta ação não pode ser desfeita. O lançamento será removido permanentemente."
              : "Deseja editar este lançamento? As alterações atualizarão os dados do registro."}
          </AlertDialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <AlertDialogCancel className="bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-600 text-xs px-3 py-1.5 rounded-lg">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={`text-white text-xs px-3 py-1.5 rounded-lg ${editConfirmDialog.action === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>
              {editConfirmDialog.action === "delete" ? "Sim, excluir" : "Sim, editar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <CreateMonthDialog
        open={showCreateMonth}
        onOpenChange={(open) => { setShowCreateMonth(open); if (!open) setPreviousMonthForCreation(null); }}
        aircraftId={aircraftId!}
        aircraftRegistration={aeronave?.matricula ?? ""}
        month={mes ?? new Date().getMonth() + 1}
        year={ano ?? new Date().getFullYear()}
        currentModoCelula={aeronave?.modo_celula}
        previousMonthData={previousMonthForCreation}
        onCreate={handleCreateMonth}
      />

      <ExportDiarioModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportarPDF}
        availableMeses={availableMeses}
        currentMes={mes ?? 1}
        currentAno={ano ?? new Date().getFullYear()}
        isLoading={isExporting}
      />
    </Layout>
  );
}

/* ─── MiniStat ─────────────────────────────────────────────────────────────── */
function MiniStat({ label, value, labelColor = "text-slate-500" }: { label: string; value: any; labelColor?: string }) {
  return (
    <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-700/40">
      <p className={`text-[10px] ${labelColor} mb-0.5`}>{label}</p>
      <p className="text-sm font-semibold text-white truncate">{value ?? "—"}</p>
    </div>
  );
}

/* ─── EditableCell ──────────────────────────────────────────────────────────── */
function EditableCell({ label, value, fieldName, onSave, unit = "", accentColor = "cyan", hint, labelColor }: {
  label: string; value: number; fieldName: string;
  onSave: (field: string, val: number) => void;
  unit?: string; accentColor?: "cyan" | "amber"; hint?: string; labelColor?: string;
}) {
  const [editing, setEditing] = useState(false);
  const accent = accentColor === "amber" ? "text-amber-400" : "text-cyan-400";
  const labelCls = labelColor || "text-slate-500";
  return (
    <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-700/40 hover:border-slate-600/60 transition-colors">
      <p className={`text-[10px] ${labelCls} mb-1`}>{label}</p>
      {hint && <p className="text-[9px] text-slate-600 mb-1.5">{hint}</p>}
      {editing ? (
        <input
          type="number" step="0.1" autoFocus
          defaultValue={value}
          onBlur={(e) => { onSave(fieldName, parseFloat(e.target.value)); setEditing(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onSave(fieldName, parseFloat(e.currentTarget.value)); setEditing(false); }
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full bg-slate-800 border border-cyan-500/40 rounded px-1.5 py-0.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
        />
      ) : (
        <button onClick={() => setEditing(true)} className={`text-sm font-bold text-white hover:${accent} transition-colors`}>
          {num(value, 1)}{unit}
        </button>
      )}
    </div>
  );
}

/* ─── Th / Td helpers ──────────────────────────────────────────────────────── */
function Th({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <th style={style} className={`px-2 py-2 text-left font-semibold align-middle whitespace-nowrap ${className}`}>{children}</th>;
}
function Td({ children, className = "", colSpan, style }: { children: React.ReactNode; className?: string; colSpan?: number; style?: React.CSSProperties }) {
  return <td colSpan={colSpan} style={style} className={`px-2 py-1.5 align-middle ${className}`}>{children}</td>;
}

/* ─── inputCls ─────────────────────────────────────────────────────────────── */
const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none transition-colors placeholder:text-slate-600";

/* ─── Section / Field ──────────────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-700/50 pb-1">{title}</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

/* ─── NovoVooInline ────────────────────────────────────────────────────────── */
function NovoVooInline({
  aeronave, mes, ano, modoCelula, clientes, socios, tripulantes,
  ultimaCelula, ultimaCelulaTvoo, temDiaria, onClose, onSaved,
}: {
  aeronave: Aeronave; mes: number; ano: number;
  modoCelula: "tvoo" | "tempo_total";
  clientes: Cliente[]; socios: Socio[]; tripulantes: Tripulante[];
  ultimaCelula: number; ultimaCelulaTvoo: number;
  temDiaria: boolean; onClose: () => void; onSaved: () => void;
}) {
  const today = new Date();
  const defaultDate = today.getMonth() + 1 === mes && today.getFullYear() === ano
    ? today.toISOString().slice(0, 10)
    : `${ano}-${String(mes).padStart(2, "0")}-01`;

  const [data, setData] = useState(defaultDate);
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [acionamento, setAcionamento] = useState("");
  const [decolagem, setDecolagem] = useState("");
  const [pouso, setPouso] = useState("");
  const [corte, setCorte] = useState("");
  const [noturno, setNoturno] = useState("0:00");
  const [ifr, setIfr] = useState("0:00");
  const [pousos, setPousos] = useState(1);
  const [fuelInicio, setFuelInicio] = useState(0);
  const [abast, setAbast] = useState(0);
  const [natureza, setNatureza] = useState("Privado");
  const [picId, setPicId] = useState<string>("");
  const [sicId, setSicId] = useState<string>("");
  const [sicNome, setSicNome] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [socioId, setSocioId] = useState<string>("");
  const [clienteTomadorId, setClienteTomadorId] = useState<string>("");
  const [socioTomadorId, setSocioTomadorId] = useState<string>("");
  const [obs, setObs] = useState("");
  const [emprestimo, setEmprestimo] = useState(false);
  const [qtdDiarias, setQtdDiarias] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showAbastForm, setShowAbastForm] = useState(false);
  const [abastecimentosCliente, setAbastecimentosCliente] = useState<any[]>([]);
  const [localCombustivel, setLocalCombustivel] = useState("");
  const [tipoCombustivel, setTipoCombustivel] = useState("");
  const [precoCombustivel, setPrecoCombustivel] = useState(0);
  const [consumoCombustivelVoo, setConsumoCombustivelVoo] = useState(0);

  const apresentacao = useMemo(() => subtractMinutesHHMM(acionamento, 30), [acionamento]);
  const tVoo = useMemo(() => diffDecimalHours(decolagem, pouso), [decolagem, pouso]);
  const tTotal = useMemo(() => diffDecimalHours(acionamento, corte), [acionamento, corte]);
  const noturnoDec = useMemo(() => Number(((hhmmToMinutes(noturno) ?? 0) / 60).toFixed(2)), [noturno]);
  const ifrDec = useMemo(() => Number(((hhmmToMinutes(ifr) ?? 0) / 60).toFixed(2)), [ifr]);
  const diurno = useMemo(() => Number((Math.max(0, tVoo - noturnoDec)).toFixed(2)), [tVoo, noturnoDec]);

  const sugCelula = useMemo(() => Number(((Number(ultimaCelula) || 0) + tTotal).toFixed(2)), [ultimaCelula, tTotal]);
  const sugCelulaTvoo = useMemo(() => Number(((Number(ultimaCelulaTvoo) || 0) + tVoo).toFixed(2)), [ultimaCelulaTvoo, tVoo]);
  const [celula, setCelula] = useState<number>(sugCelula);
  const [celulaTvoo, setCelulaTvoo] = useState<number>(sugCelulaTvoo);
  const [celulaTouched, setCelulaTouched] = useState(false);
  const [celulaTvooTouched, setCelulaTvooTouched] = useState(false);
  useEffect(() => { if (!celulaTouched) setCelula(sugCelula); }, [sugCelula, celulaTouched]);
  useEffect(() => { if (!celulaTvooTouched) setCelulaTvoo(sugCelulaTvoo); }, [sugCelulaTvoo, celulaTvooTouched]);

  const sociosDoCliente = useMemo(() => socios.filter((s) => s.cliente_id === clienteId), [socios, clienteId]);
  const tripOptions = useMemo(() =>
    tripulantes.filter((t) => (t.status ?? "").toLowerCase().startsWith("ativ"))
      .slice().sort((a, b) => (a.nome_completo ?? "").localeCompare(b.nome_completo ?? "")),
    [tripulantes]);
  const sicTrip = useMemo(() => tripOptions.find(t => t.id === sicId), [tripOptions, sicId]);

  useEffect(() => {
    if (!clienteId) { setAbastecimentosCliente([]); return; }
    (async () => {
      const { data, error } = await supabase.from("abastecimentos").select("*")
        .eq("id_clientes", clienteId).eq("aeronave_id", aeronave.id).order("data", { ascending: false });
      if (!error && data) setAbastecimentosCliente(data);
    })();
  }, [clienteId, aeronave.id]);

  const submit = async () => {
    if (!origem || !destino || !decolagem || !pouso) { alert("Preencha origem, destino, decolagem e pouso."); return; }
    if (!picId) { alert("Selecione o PIC."); return; }
    setSaving(true);
    try {
      const dmRes = await supabase.from("diario_mes").select("id,celula_atual_ttotal").eq("aeronave_id", aeronave.id).eq("ano", ano).eq("mes", mes).maybeSingle();
      let dmId = dmRes.data?.id as string | undefined;
      if (!dmId) {
        const inserted = await supabase.from("diario_mes").insert({ aeronave_id: aeronave.id, ano, mes, celula_anterior_ttotal: ultimaCelula, celula_atual_ttotal: ultimaCelula }).select("id").single();
        if (inserted.error) throw inserted.error;
        dmId = inserted.data.id as string;
      }
      const socio = socioId ? socios.find((s) => s.id === socioId) : null;
      const socioNome = socio?.nome || (socioId ? socioId : null);
      const payload = {
        diario_mes: dmId, aeronave_id: aeronave.id, data_registro: data,
        aerodromo_partida: origem.toUpperCase(), aerodromo_chegada: destino.toUpperCase(),
        tripulacao_checkin_hora: apresentacao ? `${apresentacao}:00` : null,
        tempo_ac: acionamento ? `${acionamento}:00` : null, tempo_dep: decolagem ? `${decolagem}:00` : null,
        tempo_pou: pouso ? `${pouso}:00` : null, tempo_cor: corte ? `${corte}:00` : null,
        tempo_voo: tVoo, tempo_total: tTotal, horas_diurnas: diurno, horas_noturnas: noturnoDec,
        tempo_ifr: ifrDec, pousos_total: pousos, litros_combustivel_inicio_voo: fuelInicio,
        combustivel_adicionado: abast, celula, celula_tvoo: celulaTvoo,
        pic_canac: picId || null, sic_canac: sicId || null,
        sic_name: sicNome || sicTrip?.nome_completo || null,
        natureza_voo: natureza, tarifa_diaria: temDiaria ? String(qtdDiarias) : null,
        clientes_id: clienteId || null, socios_cliente_id: socioId || null, socios_nome: socioNome,
        emprestimo, cliente_tomador_emprestimo_id: emprestimo ? (clienteTomadorId || null) : null,
        socio_tomador_emprestimo_id: emprestimo ? (socioTomadorId || null) : null,
        ocorrencias: obs || null, consumo_combustivel_voo: consumoCombustivelVoo || null,
        preco_combustivel_litro: precoCombustivel || null, local_combustivel: localCombustivel || null,
        tipo_combustivel: tipoCombustivel || null,
        origem_pic: picId ? 'membros_tripulacao' : null, origem_sic: sicId ? 'membros_tripulacao' : null,
      };
      const ins = await supabase.from("lancamentos_diario_bordo").insert(payload as never);
      if (ins.error) throw ins.error;
      const updatePayload = modoCelula === "tvoo" ? { celula_atual_tvoo: celulaTvoo } : { celula_atual_ttotal: celula };
      await supabase.from("diario_mes").update(updatePayload).eq("id", dmId);
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert("Erro ao salvar: " + msg);
    } finally { setSaving(false); }
  };

  if (showAbastForm && clienteId) {
    return (
      <div className="p-5">
        <AbastecimentoModal
          clienteId={clienteId} aeronaveId={aeronave.id}
          abastecimentos={abastecimentosCliente}
          onSelectAbastecimento={(ab) => {
            setAbast(Number(ab.litros) || 0); setLocalCombustivel(ab.local || "");
            setTipoCombustivel(ab.tipo_combustivel || ""); setPrecoCombustivel(Number(ab.valor_unitario) || 0);
            setConsumoCombustivelVoo(Number(ab.litros) || 0); setShowAbastForm(false);
          }}
          onCreateNew={() => setShowAbastForm(false)}
          onClose={() => setShowAbastForm(false)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-500/20">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Plus className="w-4 h-4 text-cyan-400" /> Novo Voo · {aeronave.matricula}</h3>
          <p className="text-[10px] text-slate-500">Horários em Zulu (UTC)</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
        <Section title="Identificação">
          <Field label="Data">
            <div className="flex gap-2">
              <input type="text" value={data} onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value) || e.target.value === '') setData(e.target.value); }} placeholder="YYYY-MM-DD" className={inputCls} />
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0"><CalendarIcon className="h-3.5 w-3.5" /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 !bg-[#1a2332] !border-slate-700" align="end">
                  <CalendarComponent mode="single" selected={data ? new Date(data) : undefined}
                    onSelect={(date) => { if (date) { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); setData(`${y}-${m}-${d}`); } }}
                    defaultMonth={data ? new Date(data) : new Date()} initialFocus className="pointer-events-auto bg-[#1a2332]" />
                </PopoverContent>
              </Popover>
            </div>
          </Field>
        </Section>
        <Section title="Cliente & Cotista">
          <Field label="Cliente">
            <SearchableCombobox items={clientes.map((c) => ({ id: c.id, label: c.razao_social ?? c.proprietario ?? c.id.slice(0, 6) }))} value={clienteId} onChange={(v) => { setClienteId(v); setSocioId(""); }} placeholder="Selecionar..." searchPlaceholder="Buscar..." />
          </Field>
          <Field label="Sócio (opcional)">
            <SearchableCombobox items={sociosDoCliente.map((s) => ({ id: s.id, label: s.nome }))} value={socioId} onChange={setSocioId} placeholder="Selecionar..." searchPlaceholder="Buscar..." disabled={!clienteId || sociosDoCliente.length === 0} />
          </Field>
          <Field label="Emprestado?">
            <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs cursor-pointer">
              <input type="checkbox" checked={emprestimo} onChange={(e) => setEmprestimo(e.target.checked)} disabled={!clienteId} className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500" />
              <span className={emprestimo ? "font-semibold text-amber-400" : "text-slate-400"}>{emprestimo ? "Sim" : "Não"}</span>
            </label>
          </Field>
          {emprestimo && (
            <Field label="Cliente Tomador">
              <SearchableCombobox items={clientes.map((c) => ({ id: c.id, label: c.razao_social ?? c.proprietario ?? c.id.slice(0, 6) }))} value={clienteTomadorId} onChange={(v) => { setClienteTomadorId(v); setSocioTomadorId(""); }} placeholder="Selecionar..." searchPlaceholder="Buscar..." />
            </Field>
          )}
        </Section>
        <Section title="Natureza">
          <Field label="Natureza do voo">
            <select value={natureza} onChange={(e) => setNatureza(e.target.value)} className={inputCls}>
              {NATUREZAS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </Section>
        <Section title="Tripulação">
          <Field label="PIC">
            <SearchableCombobox items={tripOptions.map((t) => ({ id: t.id, label: `${t.nome_completo ?? t.canac ?? t.id.slice(0, 6)}${t.canac ? ` (${t.canac})` : ""}` }))} value={picId} onChange={setPicId} placeholder="Selecionar PIC..." searchPlaceholder="Buscar..." />
          </Field>
          <Field label="SIC">
            <SearchableCombobox items={tripOptions.map((t) => ({ id: t.id, label: `${t.nome_completo ?? t.canac ?? t.id.slice(0, 6)}${t.canac ? ` (${t.canac})` : ""}` }))} value={sicId} onChange={setSicId} placeholder="Selecionar SIC..." searchPlaceholder="Buscar..." />
          </Field>
        </Section>
        <Section title="Aeródromo">
          <Field label="Origem (ICAO)">
            <SearchableCombobox items={[{ id: "SBSP", label: "SBSP - São Paulo (Congonhas)" }, { id: "SBRJ", label: "SBRJ - Rio de Janeiro (Santos Dumont)" }, { id: "SBKP", label: "SBKP - Campinas (Viracopos)" }, { id: "SBGR", label: "SBGR - São Paulo (Guarulhos)" }]} value={origem} onChange={setOrigem} placeholder="Buscar..." searchPlaceholder="Código ou nome..." allowFreeText={true} />
          </Field>
          <Field label="Destino (ICAO)">
            <SearchableCombobox items={[{ id: "SBSP", label: "SBSP - São Paulo (Congonhas)" }, { id: "SBRJ", label: "SBRJ - Rio de Janeiro (Santos Dumont)" }, { id: "SBKP", label: "SBKP - Campinas (Viracopos)" }, { id: "SBGR", label: "SBGR - São Paulo (Guarulhos)" }]} value={destino} onChange={setDestino} placeholder="Buscar..." searchPlaceholder="Código ou nome..." allowFreeText={true} />
          </Field>
        </Section>
        <Section title="Horários (Zulu) — apresentação auto 30min">
          <Field label="Apresentação (auto)"><input value={apresentacao || "--:--"} disabled className={`${inputCls} font-mono opacity-50 cursor-not-allowed text-xs`} /></Field>
          <Field label="Acionamento (AC)"><input type="time" value={acionamento} onChange={(e) => setAcionamento(e.target.value)} className={`${inputCls} font-mono`} /></Field>
          <Field label="Decolagem (DEP)"><input type="time" value={decolagem} onChange={(e) => setDecolagem(e.target.value)} className={`${inputCls} font-mono`} /></Field>
          <Field label="Pouso (POU)"><input type="time" value={pouso} onChange={(e) => setPouso(e.target.value)} className={`${inputCls} font-mono`} /></Field>
          <Field label="Corte (COR)"><input type="time" value={corte} onChange={(e) => setCorte(e.target.value)} className={`${inputCls} font-mono`} /></Field>
        </Section>
        <Section title="Tempos calculados">
          <Field label="T. Voo"><input value={`${decimalToHHMM(tVoo)}  (${num(tVoo, 2)}h)`} disabled className={`${inputCls} font-mono text-cyan-400 border-cyan-500/20 bg-cyan-500/5 text-xs`} /></Field>
          <Field label="Tempo Total"><input value={`${decimalToHHMM(tTotal)}  (${num(tTotal, 2)}h)`} disabled className={`${inputCls} font-mono text-cyan-400 border-cyan-500/20 bg-cyan-500/5 text-xs`} /></Field>
          <Field label="Diurno (auto)"><input value={decimalToHHMM(diurno)} disabled className={`${inputCls} font-mono opacity-50 cursor-not-allowed text-xs`} /></Field>
          <Field label="Noturno"><input type="time" value={noturno} onChange={(e) => setNoturno(e.target.value)} className={`${inputCls} font-mono`} /></Field>
          <Field label="IFR"><input type="time" value={ifr} onChange={(e) => setIfr(e.target.value)} className={`${inputCls} font-mono`} /></Field>
          <Field label="Pousos"><input type="number" min={0} value={pousos} onChange={(e) => setPousos(Number(e.target.value))} className={inputCls} /></Field>
          <Field label="ABAST+ (L)">
            <div className="flex gap-1.5">
              <input type="number" min={0} value={abast} onChange={(e) => setAbast(Number(e.target.value))} className={`${inputCls} flex-1`} />
              <button type="button" onClick={() => setShowAbastForm(true)} className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20 transition-colors whitespace-nowrap">Buscar</button>
            </div>
          </Field>
          <Field label="FUEL (L)"><input type="number" min={0} value={fuelInicio} onChange={(e) => setFuelInicio(Number(e.target.value))} className={inputCls} /></Field>
          <Field label={`Célula T.Total (sug. ${num(sugCelula, 1)}h)`}>
            <input type="number" step="0.1" min={0} value={celula} onChange={(e) => { setCelula(Number(e.target.value)); setCelulaTouched(true); }} className={`${inputCls} font-mono text-amber-400`} />
          </Field>
          <Field label={`Célula T.Voo (sug. ${num(sugCelulaTvoo, 1)}h)`}>
            <input type="number" step="0.1" min={0} value={celulaTvoo} onChange={(e) => { setCelulaTvoo(Number(e.target.value)); setCelulaTvooTouched(true); }} className={`${inputCls} font-mono text-amber-400`} />
          </Field>
        </Section>
        {temDiaria && (
          <Section title="Diárias">
            <Field label="Qtd. Diárias">
              <input type="number" min={0} value={qtdDiarias} onChange={(e) => setQtdDiarias(Number(e.target.value))} className={`${inputCls} text-violet-400 font-mono`} />
            </Field>
          </Section>
        )}
        <Field label="Ocorrências / Observações">
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={`${inputCls} text-sm`} placeholder="Detalhes opcionais..." />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-700/40 bg-slate-800/30">
        <button onClick={onClose} className="rounded-lg border border-slate-600 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">Cancelar</button>
        <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-900 hover:bg-cyan-600 disabled:opacity-60 transition-colors">
          <Save className="w-3.5 h-3.5" /> {saving ? "Salvando..." : "Salvar voo"}
        </button>
      </div>
    </div>
  );
}

/* ─── EditarVooInline ──────────────────────────────────────────────────────── */
function EditarVooInline({
  lanc, aeronave, clientes, socios, tripulantes, temDiaria, onClose, onSaved,
}: {
  lanc: Lanc; aeronave: Aeronave;
  clientes: Cliente[]; socios: Socio[]; tripulantes: Tripulante[];
  temDiaria: boolean; onClose: () => void; onSaved: () => void;
}) {
  const fmtTime = (v: string | null) => v ? v.slice(0, 5) : "";

  const [data, setData] = useState(lanc.data_registro);
  const [origem, setOrigem] = useState(lanc.aerodromo_partida ?? "");
  const [destino, setDestino] = useState(lanc.aerodromo_chegada ?? "");
  const [acionamento, setAcionamento] = useState(fmtTime(lanc.tempo_ac));
  const [decolagem, setDecolagem] = useState(fmtTime(lanc.tempo_dep));
  const [pouso, setPouso] = useState(fmtTime(lanc.tempo_pou));
  const [corte, setCorte] = useState(fmtTime(lanc.tempo_cor));
  const [noturno, setNoturno] = useState(decimalToHHMM(Number(lanc.horas_noturnas ?? 0)));
  const [ifr, setIfr] = useState(decimalToHHMM(Number(lanc.tempo_ifr ?? 0)));
  const [pousos, setPousos] = useState(lanc.pousos_total ?? 1);
  const [fuelInicio, setFuelInicio] = useState(Number(lanc.litros_combustivel_inicio_voo ?? 0));
  const [abast, setAbast] = useState(Number(lanc.combustivel_adicionado ?? 0));
  const [natureza, setNatureza] = useState(lanc.natureza_voo ?? "Privado");
  const [picId, setPicId] = useState(lanc.pic_canac ?? "");
  const [sicId, setSicId] = useState(lanc.sic_canac ?? "");
  const [sicNome, setSicNome] = useState(lanc.sic_name ?? "");
  const [clienteId, setClienteId] = useState(lanc.clientes_id ?? "");
  const [socioId, setSocioId] = useState(lanc.socios_cliente_id ?? "");
  const [emprestimo, setEmprestimo] = useState(lanc.emprestimo ?? false);
  const [qtdDiarias, setQtdDiarias] = useState(Number(lanc.tarifa_diaria ?? 0));
  const [celula, setCelula] = useState(Number(lanc.celula ?? 0));
  const [celulaTvoo, setCelulaTvoo] = useState(Number(lanc.celula_tvoo ?? 0));
  const [saving, setSaving] = useState(false);

  const tVoo = useMemo(() => diffDecimalHours(decolagem, pouso), [decolagem, pouso]);
  const tTotal = useMemo(() => diffDecimalHours(acionamento, corte), [acionamento, corte]);
  const noturnoDec = useMemo(() => Number(((hhmmToMinutes(noturno) ?? 0) / 60).toFixed(2)), [noturno]);
  const ifrDec = useMemo(() => Number(((hhmmToMinutes(ifr) ?? 0) / 60).toFixed(2)), [ifr]);
  const diurno = useMemo(() => Number((Math.max(0, tVoo - noturnoDec)).toFixed(2)), [tVoo, noturnoDec]);

  const sociosDoCliente = useMemo(() => socios.filter((s) => s.cliente_id === clienteId), [socios, clienteId]);
  const tripOptions = useMemo(() =>
    tripulantes.filter((t) => (t.status ?? "").toLowerCase().startsWith("ativ"))
      .slice().sort((a, b) => (a.nome_completo ?? "").localeCompare(b.nome_completo ?? "")),
    [tripulantes]);

  const submit = async () => {
    setSaving(true);
    try {
      const socio = socioId ? socios.find((s) => s.id === socioId) : null;
      const socioNome = socio?.nome || (socioId ? socioId : null);
      const { error } = await supabase.from("lancamentos_diario_bordo").update({
        data_registro: data,
        aerodromo_partida: origem.toUpperCase(), aerodromo_chegada: destino.toUpperCase(),
        tempo_ac: acionamento ? `${acionamento}:00` : null, tempo_dep: decolagem ? `${decolagem}:00` : null,
        tempo_pou: pouso ? `${pouso}:00` : null, tempo_cor: corte ? `${corte}:00` : null,
        tempo_voo: tVoo, tempo_total: tTotal, horas_diurnas: diurno, horas_noturnas: noturnoDec,
        tempo_ifr: ifrDec, pousos_total: pousos, litros_combustivel_inicio_voo: fuelInicio,
        combustivel_adicionado: abast, celula, celula_tvoo: celulaTvoo,
        pic_canac: picId || null, sic_canac: sicId || null, sic_name: sicNome || null,
        natureza_voo: natureza, tarifa_diaria: temDiaria ? String(qtdDiarias) : null,
        clientes_id: clienteId || null, socios_cliente_id: socioId || null, socios_nome: socioNome,
        emprestimo, cliente_tomador_emprestimo_id: emprestimo ? (clienteId || null) : null,
        socio_tomador_emprestimo_id: emprestimo ? (socioId || null) : null,
        origem_pic: picId ? 'crew_members' : null, origem_sic: sicId ? 'crew_members' : null,
      } as never).eq("id", lanc.id);
      if (error) throw error;
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert("Erro ao salvar: " + msg);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between px-5 py-3 border-b border-amber-500/20">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Pencil className="w-4 h-4 text-amber-400" /> Editar Voo · {aeronave.matricula}</h3>
          <p className="text-[10px] text-amber-400/60">Lançamento de {new Date(lanc.data_registro + "T00:00").toLocaleDateString("pt-BR")}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
        <Section title="Tripulação & Cotista">
          <Field label="PIC">
            <SearchableCombobox items={tripOptions.map((t) => ({ id: t.id, label: `${t.nome_completo ?? t.canac ?? t.id.slice(0, 6)}` }))} value={picId} onChange={setPicId} placeholder="Selecionar PIC..." searchPlaceholder="Buscar..." />
          </Field>
          <Field label="SIC">
            <SearchableCombobox items={tripOptions.map((t) => ({ id: t.id, label: `${t.nome_completo ?? t.canac ?? t.id.slice(0, 6)}` }))} value={sicId} onChange={setSicId} placeholder="Selecionar SIC..." searchPlaceholder="Buscar..." />
          </Field>
          <Field label="Cliente">
            <SearchableCombobox items={clientes.map((c) => ({ id: c.id, label: c.razao_social ?? c.proprietario ?? c.id.slice(0, 6) }))} value={clienteId} onChange={(v) => { setClienteId(v); setSocioId(""); }} placeholder="Selecionar..." searchPlaceholder="Buscar..." />
          </Field>
          <Field label="Sócio">
            <SearchableCombobox items={sociosDoCliente.map((s) => ({ id: s.id, label: s.nome }))} value={socioId} onChange={setSocioId} placeholder="Selecionar..." searchPlaceholder="Buscar..." disabled={!clienteId || sociosDoCliente.length === 0} />
          </Field>
        </Section>
        <Section title="Identificação">
          <Field label="Data">
            <div className="flex gap-2">
              <input type="text" value={data} onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value) || e.target.value === '') setData(e.target.value); }} placeholder="YYYY-MM-DD" className={inputCls} />
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0"><CalendarIcon className="h-3.5 w-3.5" /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 !bg-[#1a2332] !border-slate-700" align="end">
                  <CalendarComponent mode="single" selected={data ? new Date(data) : undefined}
                    onSelect={(date) => { if (date) { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); setData(`${y}-${m}-${d}`); } }}
                    defaultMonth={data ? new Date(data) : new Date()} initialFocus className="pointer-events-auto bg-[#1a2332]" />
                </PopoverContent>
              </Popover>
            </div>
          </Field>
          <Field label="Natureza">
            <select value={natureza} onChange={(e) => setNatureza(e.target.value)} className={inputCls}>
              {NATUREZAS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Origem (ICAO)">
            <SearchableCombobox items={[{ id: "SBSP", label: "SBSP - Congonhas" }, { id: "SBRJ", label: "SBRJ - Santos Dumont" }, { id: "SBKP", label: "SBKP - Viracopos" }, { id: "SBGR", label: "SBGR - Guarulhos" }]} value={origem} onChange={setOrigem} placeholder="Buscar..." searchPlaceholder="Código ou nome..." allowFreeText={true} />
          </Field>
          <Field label="Destino (ICAO)">
            <SearchableCombobox items={[{ id: "SBSP", label: "SBSP - Congonhas" }, { id: "SBRJ", label: "SBRJ - Santos Dumont" }, { id: "SBKP", label: "SBKP - Viracopos" }, { id: "SBGR", label: "SBGR - Guarulhos" }]} value={destino} onChange={setDestino} placeholder="Buscar..." searchPlaceholder="Código ou nome..." allowFreeText={true} />
          </Field>
        </Section>
        <Section title="Horários (Zulu)">
          <Field label="Acionamento (AC)"><input type="time" value={acionamento} onChange={(e) => setAcionamento(e.target.value)} className={`${inputCls} font-mono`} /></Field>
          <Field label="Decolagem (DEP)"><input type="time" value={decolagem} onChange={(e) => setDecolagem(e.target.value)} className={`${inputCls} font-mono`} /></Field>
          <Field label="Pouso (POU)"><input type="time" value={pouso} onChange={(e) => setPouso(e.target.value)} className={`${inputCls} font-mono`} /></Field>
          <Field label="Corte (COR)"><input type="time" value={corte} onChange={(e) => setCorte(e.target.value)} className={`${inputCls} font-mono`} /></Field>
        </Section>
        <Section title="Tempos">
          <Field label="T. Voo"><input value={`${decimalToHHMM(tVoo)} (${num(tVoo, 2)}h)`} disabled className={`${inputCls} font-mono text-cyan-400 border-cyan-500/20 bg-cyan-500/5 text-xs`} /></Field>
          <Field label="Tempo Total"><input value={`${decimalToHHMM(tTotal)} (${num(tTotal, 2)}h)`} disabled className={`${inputCls} font-mono text-cyan-400 border-cyan-500/20 bg-cyan-500/5 text-xs`} /></Field>
          <Field label="Diurno (auto)"><input value={decimalToHHMM(diurno)} disabled className={`${inputCls} font-mono opacity-50 cursor-not-allowed text-xs`} /></Field>
          <Field label="Noturno"><input type="time" value={noturno} onChange={(e) => setNoturno(e.target.value)} className={`${inputCls} font-mono`} /></Field>
          <Field label="IFR"><input type="time" value={ifr} onChange={(e) => setIfr(e.target.value)} className={`${inputCls} font-mono`} /></Field>
          <Field label="Pousos"><input type="number" min={0} value={pousos} onChange={(e) => setPousos(Number(e.target.value))} className={inputCls} /></Field>
          <Field label="ABAST+ (L)"><input type="number" min={0} value={abast} onChange={(e) => setAbast(Number(e.target.value))} className={inputCls} /></Field>
          <Field label="FUEL (L)"><input type="number" min={0} value={fuelInicio} onChange={(e) => setFuelInicio(Number(e.target.value))} className={inputCls} /></Field>
          <Field label="Célula T.Total">
            <input type="number" step="0.1" min={0} value={celula} onChange={(e) => setCelula(Number(e.target.value))} className={`${inputCls} font-mono text-amber-400`} />
          </Field>
          <Field label="Célula T.Voo">
            <input type="number" step="0.1" min={0} value={celulaTvoo} onChange={(e) => setCelulaTvoo(Number(e.target.value))} className={`${inputCls} font-mono text-amber-400`} />
          </Field>
        </Section>
        {temDiaria && (
          <Section title="Diárias">
            <Field label="Qtd. Diárias">
              <input type="number" min={0} value={qtdDiarias} onChange={(e) => setQtdDiarias(Number(e.target.value))} className={`${inputCls} text-violet-400 font-mono`} />
            </Field>
          </Section>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-700/40 bg-slate-800/30">
        <button onClick={onClose} className="rounded-lg border border-slate-600 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">Cancelar</button>
        <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60 transition-colors">
          <Save className="w-3.5 h-3.5" /> {saving ? "Salvando..." : "Salvar edição"}
        </button>
      </div>
    </div>
  );
}

/* ─── AbastecimentoModal (unchanged, kept as dialog for sub-workflow) ──────── */
function AbastecimentoModal({
  clienteId, aeronaveId, abastecimentos, onSelectAbastecimento, onCreateNew, onClose,
}: {
  clienteId: string; aeronaveId: string; abastecimentos: any[];
  onSelectAbastecimento: (abast: any) => void; onCreateNew: () => void; onClose: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ data: new Date().toISOString().slice(0, 10), trecho: "", local: "", litros: 0, valor_unitario: 0, tipo_combustivel: "", abastecedor: "" });
  const [saving, setSaving] = useState(false);

  const handleSaveNew = async () => {
    if (!formData.local || !formData.litros || formData.litros <= 0) { alert("Preencha todos os campos obrigatórios"); return; }
    setSaving(true);
    try {
      const { data: newAbast, error } = await supabase.from("abastecimentos").insert({ id_clientes: clienteId, aeronave_id: aeronaveId, ...formData }).select().single();
      if (error) throw error;
      onSelectAbastecimento(newAbast);
      setShowForm(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert("Erro ao salvar: " + msg);
    } finally { setSaving(false); }
  };

  if (showForm) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-700/50 p-4">
            <h3 className="text-sm font-bold text-white">Novo Abastecimento</h3>
            <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 space-y-3">
            {[
              { label: "Data", key: "data", type: "date" }, { label: "Trecho", key: "trecho", type: "text" },
              { label: "Local *", key: "local", type: "text", placeholder: "Ex: Jacarepaguá" },
              { label: "Litros *", key: "litros", type: "number" }, { label: "Valor Unitário (R$/L)", key: "valor_unitario", type: "number" },
              { label: "Tipo de Combustível", key: "tipo_combustivel", type: "text", placeholder: "Ex: Avgas 100LL" },
              { label: "Abastecedor", key: "abastecedor", type: "text" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                <input type={type} value={(formData as any)[key]} onChange={(e) => setFormData({ ...formData, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
                  placeholder={placeholder} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-700/50 p-4">
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Cancelar</button>
            <button onClick={handleSaveNew} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-cyan-600 disabled:opacity-60">
              <Save className="w-3.5 h-3.5" /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700/50 p-4">
          <h3 className="text-sm font-bold text-white">Abastecimentos</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">
          {abastecimentos.length === 0 ? (
            <p className="text-center text-slate-400 text-xs mb-4">Nenhum abastecimento encontrado</p>
          ) : (
            <div className="space-y-1.5 mb-4 max-h-56 overflow-y-auto">
              {abastecimentos.map((ab) => (
                <button key={ab.id} onClick={() => onSelectAbastecimento(ab)}
                  className="w-full text-left rounded-lg border border-slate-700 bg-slate-800 p-2.5 hover:bg-slate-700 hover:border-cyan-500/50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-semibold text-white">{ab.local} · {ab.litros}L</p>
                      <p className="text-[10px] text-slate-400">{new Date(ab.data).toLocaleDateString("pt-BR")} · {ab.trecho || "—"}</p>
                    </div>
                    <p className="text-xs font-mono text-cyan-400">{num(ab.litros, 2)}L</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-between gap-2 border-t border-slate-700/50 p-4">
          <button onClick={onClose} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Cancelar</button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-cyan-600">
            <Plus className="w-3.5 h-3.5" /> Novo Abastecimento
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default DiarioBordoDetalhes;
