import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plane, Plus, Calendar, Gauge, Clock, Moon, BookOpenCheck, Cloud,
  Fuel, Users, X, Save, Droplets, Wrench, CloudLightning, PlaneLanding,
  Pencil, Trash2, Activity, ArrowUpDown, ArrowUp, ArrowDown, Search, CheckCircle2,
  Eye, EyeOff, ChevronRight, AlertTriangle, Lock, LayoutList, Map as MapIcon, CalendarIcon,
  FileText
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
  celula_atual_tvoo: number | null;
  celula_disponivel_tvoo: number | null;
  horimetro_inicio: number | null;
  horimetro_final: number | null;
  horimetro_ativo: number | null;
  tem_tarifa_diaria: boolean | null;
  tarifa_diaria: number | null;
};
type Cliente = { id: string; razao_social: string | null; proprietario: string | null };
type Socio = { id: string; nome: string; cliente_id: string };
type Abastecimento = { id: string; data: string; local: string | null; litros: number | null; valor_total: number | null; tipo_combustivel: string | null; logbook_entry_id: string };

const NATUREZAS = ["Privado", "Teste", "Translado", "Cheque"];
const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showConsumo, setShowConsumo] = useState(false);
  const [showCreateMonth, setShowCreateMonth] = useState(false);
  const [previousMonthForCreation, setPreviousMonthForCreation] = useState<DiarioMesRow | null>(null);
  const [editingLanc, setEditingLanc] = useState<Lanc | null>(null);
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
  const [editConfirmDialog, setEditConfirmDialog] = useState<{ open: boolean; lanc: Lanc | null }>({ open: false, lanc: null });

  // Usuário atual (para assinatura de PIC)
  const [usuarioAtual, setUsuarioAtual] = useState<{ id: string; email: string; nome?: string } | null>(null);
  const [tripulacaoUsuario, setTripulacaoUsuario] = useState<Tripulante | null>(null);

  // Table controls
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [modoTabela, setModoTabela] = useState<"completo" | "resumo">("completo");

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

    const [aRes, dmRes, lRes, lAnoRes, cRes, sRes, tRes, abRes] = await Promise.all([
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
      supabase.from("abastecimentos").select("id,data,local,litros,valor_total,tipo_combustivel,logbook_entry_id")
        .eq("aeronave_id", aircraftId)
        .gte("data", ini).lte("data", fim)
        .not("logbook_entry_id", "is", null),
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

    // Carregar dados do usuário atual
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUsuarioAtual({ id: user.id, email: user.email || "" });

      // Buscar o tripulante associado ao usuário (usando email como match)
      const tripulantes = (tRes.data ?? []) as Tripulante[];
      const tripulacaoAtual = tripulantes.find(t =>
        t.nome_completo?.toLowerCase().includes(user.email?.split("@")[0] || "") ||
        t.canac === user.id?.slice(0, 8)
      );
      setTripulacaoUsuario(tripulacaoAtual || null);
    }

    setLoading(false);
  };

  useEffect(() => { reload(); }, [aircraftId, mes, ano]);

  // Carregar mês e ano do último lançamento ao abrir a página
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
          // Se não houver lançamentos, usa mês atual
          setMes(today.getMonth() + 1);
          setAno(today.getFullYear());
        }
      } catch (error) {
        console.error("Erro ao carregar mês do último lançamento:", error);
        setMes(today.getMonth() + 1);
        setAno(today.getFullYear());
      }
    })();
  }, [aircraftId]);

  // Carregar meses disponíveis para exportação
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
            const mes = date.getMonth() + 1;
            const ano = date.getFullYear();
            const key = `${ano}-${mes}`;
            if (!meses.has(key)) {
              meses.set(key, { mes, ano });
            }
          }
        }
        setAvailableMeses(Array.from(meses.values()).sort((a, b) => {
          if (a.ano !== b.ano) return b.ano - a.ano;
          return b.mes - a.mes;
        }));
      } catch (error) {
        console.error("Erro ao carregar meses disponíveis:", error);
      }
    })();
  }, [aircraftId]);

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

  // Mapa de abastecimentos por logbook_entry_id
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

  // Filtered + sorted lancamentos (com filtro de cotista)
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

  // Column resize handlers
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
    if (error) {
      toast.error("Erro ao confirmar lançamento");
    } else {
      toast.success("Lançamento confirmado");
      await reload();
    }
  };

  const handleAssinarPic = async (l: Lanc) => {
    // Verifica se o usuário é o PIC do lançamento
    if (l.pic_canac !== tripulacaoUsuario?.canac) {
      toast.error("Apenas o PIC deste lançamento pode assinar");
      return;
    }

    const { error } = await supabase.from("lancamentos_diario_bordo")
      .update({
        assinado_por: usuarioAtual?.id,
        data_assinatura_piloto: new Date().toISOString()
      })
      .eq("id", l.id);

    if (error) {
      toast.error("Erro ao assinar lançamento como PIC");
    } else {
      toast.success("Lançamento assinado como PIC");
      await reload();
    }
  };

  const handleClickEditNumber = (l: Lanc) => {
    // Abre dialog de confirmação para editar
    if (l.confirmado && !canEditConfirmed) {
      toast.error("Este lançamento está confirmado e não pode ser editado");
      return;
    }
    setEditConfirmDialog({ open: true, lanc: l });
  };

  const confirmEdit = () => {
    if (editConfirmDialog.lanc) {
      setEditingLanc(editConfirmDialog.lanc);
    }
    setEditConfirmDialog({ open: false, lanc: null });
  };

  const temDiaria = diarioMes?.tem_tarifa_diaria === true;
  const valorDiaria = Number(diarioMes?.tarifa_diaria ?? 0);
  const totalDiariaReais = totals.totalDiarias * valorDiaria;

  // Função para carregar dados do mês anterior ao abrir dialog de criação
  const handleOpenCreateMonth = async () => {
    try {
      const mesAnterior = mes === 1 ? 12 : mes - 1;
      const anoAnterior = mes === 1 ? ano! - 1 : ano;

      const { data: previousMonth } = await supabase
        .from("diario_mes")
        .select("*")
        .eq("aeronave_id", aircraftId)
        .eq("ano", anoAnterior)
        .eq("mes", mesAnterior)
        .maybeSingle();

      setPreviousMonthForCreation(previousMonth);
      setShowCreateMonth(true);
    } catch (error) {
      console.error("Erro ao carregar dados do mês anterior:", error);
      toast.error("Erro ao carregar dados do mês anterior");
      setShowCreateMonth(true); // Abre mesmo assim
    }
  };

  // Função para criar novo mês
  const handleCreateMonth = async (data: any) => {
    try {
      // Buscar mês anterior para verificar se está fechado
      const mesAnterior = mes === 1 ? 12 : mes - 1;
      const anoAnterior = mes === 1 ? ano - 1 : ano;

      const { data: previousMonth } = await supabase
        .from("diario_mes")
        .select("id, fechado")
        .eq("aeronave_id", aircraftId)
        .eq("ano", anoAnterior)
        .eq("mes", mesAnterior)
        .maybeSingle();

      // Se houver mês anterior e não estiver fechado, mostrar toast
      if (previousMonth && !previousMonth.fechado) {
        toast.warning("Aviso: O mês anterior ainda não foi fechado e precisa de atenção!", {
          description: `${monthNames[mesAnterior - 1]}/${anoAnterior} - Feche o mês anterior antes de prosseguir`,
        });
      }

      // Atualizar modo de cálculo na aeronave
      await supabase.from("aeronave")
        .update({ modo_celula: data.modo_celula })
        .eq("id", aircraftId);

      // Criar novo mês com ambos os conjuntos de colunas preenchidos
      const { error } = await supabase
        .from("diario_mes")
        .insert({
          aeronave_id: aircraftId,
          ano: data.year,
          mes: data.month,
          // Preencher ambos os conjuntos com os mesmos valores iniciais
          celula_anterior_ttotal: data.celula_anterior,
          celula_atual_ttotal: data.celula_atual,
          celula_prox_revisao_ttotal: data.celula_prox_revisao,
          celula_disponivel_ttotal: data.celula_disponivel,
          celula_anterior_tvoo: data.celula_anterior,
          celula_atual_tvoo: data.celula_atual,
          celula_prox_revisao_tvoo: data.celula_prox_revisao,
          celula_disponivel_tvoo: data.celula_disponivel,
          horimetro_inicio: data.horimetro_inicio,
          horimetro_final: data.horimetro_final,
          aerodromo_base: data.base_aerodrome,
          consumo_combustivel: data.fuel_consumption,
          tem_tarifa_diaria: data.has_daily_rate,
          tarifa_diaria: data.daily_rate,
        });

      if (error) {
        toast.error("Erro ao criar novo mês: " + error.message);
      } else {
        // Atualizar estado local
        setModoCelula(data.modo_celula);
        toast.success("Novo mês criado com sucesso!");
        setMes(data.month);
        setAno(data.year);
      }
    } catch (error) {
      console.error("Erro ao criar novo mês:", error);
      toast.error("Erro ao criar novo mês");
    }
  };

  // Funções para salvar edições do diario_mes
  const saveDiarioMesField = async (field: string, value: number | string) => {
    try {
      if (!diarioMes?.id) return;
      const { error } = await supabase
        .from("diario_mes")
        .update({ [field]: value })
        .eq("id", diarioMes.id);

      if (error) {
        toast.error("Erro ao salvar: " + error.message);
      } else {
        toast.success("Salvo com sucesso!");
        // Recarregar dados
        await reload();
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar");
    }
  };

  // Função para exportar PDF com meses selecionados
  const handleExportarPDF = async (mesesSelecionados: Array<{ mes: number; ano: number }>) => {
    setIsExporting(true);
    try {
      const mesesdados = [];

      // Carregar dados para cada mês selecionado
      for (const { mes: mês, ano: year } of mesesSelecionados) {
        const ini = `${year}-${String(mês).padStart(2, "0")}-01`;
        const fimDate = new Date(year, mês, 0);
        const fim = `${year}-${String(mês).padStart(2, "0")}-${String(fimDate.getDate()).padStart(2, "0")}`;

        const [lRes, cRes, sRes, tRes] = await Promise.all([
          supabase
            .from("lancamentos_diario_bordo")
            .select("*")
            .eq("aeronave_id", aircraftId)
            .gte("data_registro", ini)
            .lte("data_registro", fim)
            .order("data_registro", { ascending: true }),
          supabase.from("clientes").select("id,razao_social,proprietario").order("razao_social"),
          (supabase as any).from("socios_cliente").select("id,nome,cliente_id").order("nome"),
          supabase.from("membros_tripulacao").select("id,nome_completo,canac,status"),
        ]);

        const lancamentosData = (lRes.data ?? []) as unknown as Lanc[];
        const clientesData = (cRes.data ?? []) as Cliente[];
        const sociosData = (((sRes.data ?? []) as any[]).map((s) => ({
          id: s.id,
          nome: s.nome,
          cliente_id: s.cliente_id,
        }))) as Socio[];
        const tripulantesData = (tRes.data ?? []) as Tripulante[];

        // Resolver PIC e SIC com nomes
        const tripByCanac = new Map<string, Tripulante>();
        tripulantesData.forEach((t) => {
          if (t.canac) tripByCanac.set(t.canac, t);
        });

        const lancamentosComNomes = lancamentosData.map((l) => ({
          ...l,
          pic: l.pic_canac ? tripByCanac.get(l.pic_canac) : null,
          sic: l.sic_canac ? tripByCanac.get(l.sic_canac) : null,
        }));

        // Calcular totais
        const totaisData = {
          tVoo: sumDecimal(lancamentosData.map((l) => l.tempo_voo)),
          tTotal: sumDecimal(lancamentosData.map((l) => l.tempo_total)),
          tDia: sumDecimal(lancamentosData.map((l) => l.horas_diurnas)),
          tNoit: sumDecimal(lancamentosData.map((l) => l.horas_noturnas)),
          ifr: sumDecimal(lancamentosData.map((l) => l.tempo_ifr)),
          pousos: lancamentosData.reduce((s, l) => s + Number(l.pousos_total ?? 0), 0),
          abast: sumDecimal(lancamentosData.map((l) => l.combustivel_adicionado)),
          fuel: sumDecimal(lancamentosData.map((l) => l.litros_combustivel_inicio_voo)),
          totalDiarias: lancamentosData.reduce((s, l) => s + Number(l.tarifa_diaria ?? 0), 0),
        };

        // Calcular resumo por cotista
        const mapCotista = new Map<string, { label: string; horas: number }>();
        for (const l of lancamentosData) {
          const horas = Number((modoCelula === "tvoo" ? l.tempo_voo : l.tempo_total) ?? 0);
          const nat = (l.natureza_voo ?? "").trim();
          const naturezasRateio = ["Translado", "Cheque", "Voo de Teste", "Teste"];
          let label: string;

          if (naturezasRateio.some((n) => nat.toLowerCase() === n.toLowerCase())) {
            label = nat.toUpperCase();
          } else if (l.socios_cliente_id) {
            const s = sociosData.find((x) => x.id === l.socios_cliente_id);
            label = s?.nome ?? l.socios_nome ?? "Sócio";
          } else if (l.clientes_id) {
            const c = clientesData.find((x) => x.id === l.clientes_id);
            label = c?.razao_social ?? c?.proprietario ?? "Cliente";
          } else {
            label = nat || "—";
          }

          const cur = mapCotista.get(label) ?? { label, horas: 0 };
          cur.horas += horas;
          mapCotista.set(label, cur);
        }

        const porCotistaData = Array.from(mapCotista.values()).sort((a, b) => b.horas - a.horas);

        mesesdados.push({
          mes: mês,
          ano: year,
          lancamentos: lancamentosComNomes,
          totals: totaisData,
          porCotista: porCotistaData,
          temDiaria: diarioMes?.tem_tarifa_diaria === true,
        });
      }

      // Gerar PDF
      const pdf = await exportDiarioBordoPDF(
        {
          aeronave: {
            matricula: aeronave!.matricula,
            modelo: aeronave!.modelo,
            ano: aeronave!.ano,
          },
          meses: mesesdados,
        },
        "/share.png" // Logo da pasta public
      );

      // Baixar PDF
      const fileName = `Diario_${aeronave!.matricula}_${new Date().getTime()}.pdf`;
      pdf.save(fileName);

      toast.success("PDF exportado com sucesso!");
      setShowExportModal(false);
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar PDF");
    } finally {
      setIsExporting(false);
    }
  };

  if (loading || !aircraftId) {
    return (
      <Layout>
        <div className="min-h-screen bg-slate-800 p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-slate-600 border-t-cyan-400 rounded-full animate-spin" />
            <p className="text-slate-400">Carregando diário...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!aeronave) {
    return (
      <Layout>
        <div className="min-h-screen bg-slate-800 p-8 flex items-center justify-center">
          <p className="text-slate-400">Aeronave não encontrada</p>
        </div>
      </Layout>
    );
  }

  // --- RENDER ---
  const ResizeHandle = ({ col }: { col: string }) => (
    <span
      onMouseDown={(e) => startResize(col, e)}
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-cyan-500/50 transition-colors select-none z-10"
    />
  );

  return (
    <Layout>
      <div className="min-h-screen bg-slate-800 p-4 md:p-6">
        <div className="max-w-[1800px] mx-auto space-y-5">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <button
              onClick={() => navigate('/diario-bordo')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2.5 bg-cyan-500/15 border border-cyan-500/25 rounded-xl">
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide uppercase">
                  Diário {monthNames[mes - 1]} {ano} — {aeronave.matricula}
                </h1>
                <p className="text-slate-400 text-sm">{aeronave.modelo}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenCreateMonth}
                className="bg-green-500 hover:bg-green-600 text-slate-900 font-semibold gap-2 inline-flex items-center rounded-xl px-5 py-2.5 text-sm transition-transform hover:scale-105 shrink-0 shadow-lg shadow-green-500/10">
                <Calendar className="w-4 h-4" /> Novo Mês
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-semibold gap-2 inline-flex items-center rounded-xl px-5 py-2.5 text-sm transition-transform hover:scale-105 shrink-0 shadow-lg shadow-cyan-500/10">
                <Plus className="w-4 h-4" /> Novo Voo
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold gap-2 inline-flex items-center rounded-xl px-5 py-2.5 text-sm transition-transform hover:scale-105 shrink-0 shadow-lg shadow-amber-500/10">
                <FileText className="w-4 h-4" /> Exportar PDF
              </button>
            </div>
          </div>

          {/* Info row - Seção redesenhada */}
          <div className="space-y-5">
            {/* Linha 1: Dados da Aeronave - Full Width */}
            <div className="grid grid-cols-1 gap-5">
              {/* Card Dados da Aeronave */}
              <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/80 border border-slate-700/30 rounded-2xl pt-[1px] pb-[1px] pl-[44px] pr-[44px] hover:border-slate-600/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/5">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="relative flex items-center gap-2 mb-5">
                  <div className="p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
                    <Plane className="w-4 h-4 text-cyan-400" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Dados da Aeronave</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-[10px] mb-[1px] pt-[9px] pb-[9px] pl-[17px] pr-[17px]">
                  <Stat icon={<Plane className="w-4 h-4" />} label="Matrícula" value={aeronave?.matricula ?? "—"} />
                  <Stat icon={<Gauge className="w-4 h-4" />} label="Modelo" value={aeronave?.modelo ?? "—"} />
                  <Stat label="Ano" value={aeronave?.ano ?? "—"} />
                  <Stat label="Base" value={aeronave?.base ?? "—"} />
                  <div className="hidden" />
                  <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg p-3.5 border border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/50 transition-all duration-200 group/cell">
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="text-cyan-400 text-xs font-medium group-hover/cell:text-slate-300 transition-colors">Célula Anterior</span>
                      {editCelulaAnt && <span className="text-xs text-cyan-400">✎</span>}
                    </div>
                    {editCelulaAnt ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          step="0.1"
                          defaultValue={modoCelula === "tvoo" ? (diarioMes?.celula_anterior_tvoo ?? 0) : (diarioMes?.celula_anterior_ttotal ?? 0)}
                          onBlur={(e) => {
                            const fieldName = modoCelula === "tvoo" ? "celula_anterior_tvoo" : "celula_anterior_ttotal";
                            saveDiarioMesField(fieldName, parseFloat(e.target.value));
                            setEditCelulaAnt(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const fieldName = modoCelula === "tvoo" ? "celula_anterior_tvoo" : "celula_anterior_ttotal";
                              saveDiarioMesField(fieldName, parseFloat(e.currentTarget.value));
                              setEditCelulaAnt(false);
                            }
                            if (e.key === "Escape") setEditCelulaAnt(false);
                          }}
                          className="w-full bg-slate-900 border border-cyan-500/50 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div>
                        <button
                          onClick={() => setEditCelulaAnt(true)}
                          className="text-white font-semibold text-sm hover:text-cyan-400 transition-colors text-left">
                          {num(modoCelula === "tvoo" ? (diarioMes?.celula_anterior_tvoo ?? 0) : (diarioMes?.celula_anterior_ttotal ?? 0), 1)}h
                        </button>
                        <p className="text-xs text-amber-900 mt-1">clique para editar</p>
                      </div>
                    )}
                  </div>
                  <div className={`rounded-lg p-3.5 border transition-all duration-200 group/cell backdrop-blur-sm ${
                    selectedLancId
                      ? "bg-cyan-900/30 border-cyan-500/50 hover:border-cyan-500/70 hover:bg-cyan-900/40"
                      : "bg-slate-800/40 border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/50"
                  }`}>
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className={`text-xs ${selectedLancId ? "text-cyan-400" : "text-cyan-400"}`}>
                        Célula Atual {selectedLancId && "· Do Voo"}
                      </span>
                      {selectedLancId && (
                        <button
                          onClick={() => setSelectedLancId(null)}
                          className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                          title="Limpar seleção">
                          Limpar
                        </button>
                      )}
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className={`font-semibold text-sm ${
                            selectedLancId
                              ? "text-cyan-400"
                              : "text-white"
                          }`}>
                            {selectedLancId
                              ? (() => {
                                  const lancSel = lancamentos.find((x) => x.id === selectedLancId);
                                  if (!lancSel) return "—";
                                  const val =
                                    modoCelula === "tvoo"
                                      ? lancSel.celula_tvoo
                                      : lancSel.celula;
                                  return `${num(val ?? 0, 1)}h`;
                                })()
                              : num(modoCelula === "tvoo" ? (diarioMes?.celula_atual_tvoo ?? 0) : (diarioMes?.celula_atual_ttotal ?? 0), 1) + "h"}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-slate-900/80 border-slate-700/50 text-slate-100">
                          <div className="space-y-1 text-xs">
                            {selectedLancId ? (
                              (() => {
                                const lancSel = lancamentos.find((x) => x.id === selectedLancId);
                                return (
                                  <>
                                    <p><span className="text-cyan-400">Célula (T.Voo):</span> {num(lancSel?.celula_tvoo ?? 0, 1)}h</p>
                                    <p><span className="text-cyan-400">Célula (Total):</span> {num(lancSel?.celula ?? 0, 1)}h</p>
                                  </>
                                );
                              })()
                            ) : (
                              <>
                                <p><span className="text-cyan-400">T. Voo:</span> {num(diarioMes?.celula_atual_tvoo ?? 0, 1)}h</p>
                                <p><span className="text-cyan-400">Tempo Total:</span> {num(diarioMes?.celula_atual_ttotal ?? 0, 1)}h</p>
                              </>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg p-3.5 border border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/50 transition-all duration-200 group/cell">
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="text-slate-400 text-xs font-medium group-hover/cell:text-slate-300 transition-colors">Próxima Revisão</span>
                      {editProxRev && <span className="text-xs text-cyan-400">✎</span>}
                    </div>
                    {editProxRev ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          step="0.1"
                          defaultValue={modoCelula === "tvoo" ? (diarioMes?.celula_prox_revisao_tvoo ?? 0) : (diarioMes?.celula_prox_revisao_ttotal ?? 0)}
                          onBlur={(e) => {
                            const fieldName = modoCelula === "tvoo" ? "celula_prox_revisao_tvoo" : "celula_prox_revisao_ttotal";
                            saveDiarioMesField(fieldName, parseFloat(e.target.value));
                            setEditProxRev(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const fieldName = modoCelula === "tvoo" ? "celula_prox_revisao_tvoo" : "celula_prox_revisao_ttotal";
                              saveDiarioMesField(fieldName, parseFloat(e.currentTarget.value));
                              setEditProxRev(false);
                            }
                            if (e.key === "Escape") setEditProxRev(false);
                          }}
                          className="w-full bg-slate-900 border border-cyan-500/50 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div>
                        <button
                          onClick={() => setEditProxRev(true)}
                          className="text-white font-semibold text-sm hover:text-cyan-400 transition-colors text-left">
                          {num(modoCelula === "tvoo" ? (diarioMes?.celula_prox_revisao_tvoo ?? 0) : (diarioMes?.celula_prox_revisao_ttotal ?? 0), 1)}h
                        </button>
                        <p className="text-xs text-slate-500 mt-1">clique para editar</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-emerald-900/20 backdrop-blur-sm border border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-900/30 rounded-lg p-3.5 transition-all duration-200 group/cell">
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="text-xs font-medium text-emerald-400 group-hover/cell:text-emerald-300 transition-colors">
                        Disponível
                      </span>
                    </div>
                    <p className="font-bold text-sm text-emerald-300">
                      {num(Math.max(0, modoCelula === "tvoo"
                        ? ((diarioMes?.celula_atual_tvoo ?? 0) - (diarioMes?.celula_prox_revisao_tvoo ?? 0))
                        : ((diarioMes?.celula_atual_ttotal ?? 0) - (diarioMes?.celula_prox_revisao_ttotal ?? 0))), 1) + "h"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Linha 2: Horímetro - Full Width */}
            <div className="grid grid-cols-1 gap-5">
              {/* Card Horímetro */}
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5">
                <p className="mb-4 text-xs font-medium uppercase tracking-wider text-slate-400">Horímetro</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/40 hover:border-slate-600 transition-colors">
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="text-slate-500 text-xs">Inicial</span>
                      {editHorIni && <span className="text-xs text-cyan-400">✎</span>}
                    </div>
                    {editHorIni ? (
                      <input
                        type="number"
                        step="0.1"
                        defaultValue={diarioMes?.horimetro_inicio ?? 0}
                        onBlur={(e) => {
                          saveDiarioMesField("horimetro_inicio", parseFloat(e.target.value));
                          setEditHorIni(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            saveDiarioMesField("horimetro_inicio", parseFloat(e.currentTarget.value));
                            setEditHorIni(false);
                          }
                          if (e.key === "Escape") setEditHorIni(false);
                        }}
                        className="w-full bg-slate-900 border border-cyan-500/50 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        autoFocus
                      />
                    ) : (
                      <div>
                        <button
                          onClick={() => setEditHorIni(true)}
                          className="text-white font-semibold text-sm hover:text-cyan-400 transition-colors text-left w-full">
                          {num(diarioMes?.horimetro_inicio ?? 0, 1)}h
                        </button>
                        <p className="text-xs text-slate-500 mt-1">clique para editar</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/40 hover:border-slate-600 transition-colors">
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="text-slate-500 text-xs">Final</span>
                      {editHorFim && <span className="text-xs text-cyan-400">✎</span>}
                    </div>
                    {editHorFim ? (
                      <input
                        type="number"
                        step="0.1"
                        defaultValue={diarioMes?.horimetro_final ?? 0}
                        onBlur={(e) => {
                          saveDiarioMesField("horimetro_final", parseFloat(e.target.value));
                          setEditHorFim(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            saveDiarioMesField("horimetro_final", parseFloat(e.currentTarget.value));
                            setEditHorFim(false);
                          }
                          if (e.key === "Escape") setEditHorFim(false);
                        }}
                        className="w-full bg-slate-900 border border-cyan-500/50 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        autoFocus
                      />
                    ) : (
                      <div>
                        <button
                          onClick={() => setEditHorFim(true)}
                          className="text-white font-semibold text-sm hover:text-cyan-400 transition-colors text-left w-full">
                          {num(diarioMes?.horimetro_final ?? 0, 1)}h
                        </button>
                        <p className="text-xs text-slate-500 mt-1">clique para editar</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/40 hover:border-slate-600 transition-colors">
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="text-slate-500 text-xs">Ativo</span>
                      {editHorAtv && <span className="text-xs text-cyan-400">✎</span>}
                    </div>
                    {editHorAtv ? (
                      <input
                        type="number"
                        step="0.1"
                        defaultValue={diarioMes?.horimetro_ativo ?? 0}
                        onBlur={(e) => {
                          saveDiarioMesField("horimetro_ativo", parseFloat(e.target.value));
                          setEditHorAtv(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            saveDiarioMesField("horimetro_ativo", parseFloat(e.currentTarget.value));
                            setEditHorAtv(false);
                          }
                          if (e.key === "Escape") setEditHorAtv(false);
                        }}
                        className="w-full bg-slate-900 border border-cyan-500/50 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        autoFocus
                      />
                    ) : (
                      <div>
                        <button
                          onClick={() => setEditHorAtv(true)}
                          className="text-white font-semibold text-sm hover:text-cyan-400 transition-colors text-left w-full">
                          {num(diarioMes?.horimetro_ativo ?? 0, 1)}h
                        </button>
                        <p className="text-xs text-slate-500 mt-1">clique para editar</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Linha 3: Período e Consumo */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Card Período */}
              <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/80 border border-slate-700/30 rounded-2xl pt-[62px] pb-[62px] pl-[17px] pr-[17px] mt-[38px] mb-[38px] ml-[-13px] mr-[-13px] hover:border-slate-600/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/5">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="relative flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Período</p>
                  </div>
                  <div className="flex gap-2 flex-col items-end">
                    <div className="flex gap-2">
                      <select value={mes} onChange={(e) => setMes(Number(e.target.value))}
                        className="rounded-lg border border-slate-700/60 bg-slate-800/60 backdrop-blur-sm px-3 py-2 text-xs text-white font-medium hover:border-slate-600 focus:border-cyan-500/70 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all duration-200">
                        {monthNames.map((m, i) => (<option key={i} value={i + 1}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>))}
                      </select>
                      <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
                        className="rounded-lg border border-slate-700/60 bg-slate-800/60 backdrop-blur-sm px-3 py-2 text-xs text-white font-medium hover:border-slate-600 focus:border-cyan-500/70 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all duration-200">
                        {Array.from({ length: 6 }).map((_, i) => {
                          const y = today.getFullYear() - i;
                          return <option key={y} value={y}>{y}</option>;
                        })}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg p-3.5 border border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/50 transition-all duration-200 group/cell">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      <span className="text-slate-400 text-xs font-medium group-hover/cell:text-slate-300 transition-colors">{modoCelula === "tvoo" ? "T. Voo" : "Tempo Total"}</span>
                    </div>
                    <p className="text-cyan-300 font-bold text-sm">{modoCelula === "tvoo" ? decimalToHHMM(totals.tVoo) : decimalToHHMM(totals.tTotal)}</p>
                  </div>
                  <Stat icon={<PlaneLanding className="w-4 h-4" />} label="Pousos" value={String(totals.pousos)} accent="success" />
                  <Stat label="Total Lançamentos" value={String(lancamentos.length)} accent="primary" />
                </div>
              </div>

              {/* Card Consumo */}
              <button
                onClick={() => setShowConsumo(true)}
                className="relative group bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/40 hover:border-amber-400/70 rounded-2xl pt-[2px] pb-[2px] pl-[44px] pr-[44px] mt-[17px] mb-[17px] ml-[29px] mr-[29px] text-left transition-all hover:shadow-lg hover:shadow-amber-500/20">
                <p className="mb-4 text-xs font-medium uppercase tracking-wider text-amber-400 group-hover:text-amber-300">Consumo · clique para detalhes</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Droplets className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-300" />
                      <span className="text-amber-400/80 text-xs font-medium">Histórico</span>
                    </div>
                    <p className="text-white font-bold text-lg group-hover:text-amber-300 transition-colors">
                      {num(aeronave?.consumo_combustivel ?? 0, 1)} L/H
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-amber-400/80 text-xs font-medium">Consumo Mês</span>
                    </div>
                    <p className="text-white font-bold text-lg">
                      {totals.fuel > 0 && totals.tVoo > 0 ? num(totals.fuel / totals.tVoo, 1) : "—"} L/H
                    </p>
                  </div>
                </div>
                <p className="text-amber-400/60 text-xs mt-3">↗ Clique para ver consumo por cliente</p>
              </button>
            </div>
          </div>

          {/* Tabela toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setHighlightedId(null); }}
                placeholder="Filtrar por qualquer campo..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-700 bg-slate-900 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort */}
            <button
              onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
              {sortDir === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              Data {sortDir === "asc" ? "↑ Crescente" : "↓ Decrescente"}
            </button>

            {/* Modo tabela */}
            <button
              onClick={() => setModoTabela(m => m === "completo" ? "resumo" : "completo")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              title={modoTabela === "completo" ? "Modo resumo (trecho + tempos)" : "Modo completo"}>
              {modoTabela === "completo" ? <MapIcon className="w-4 h-4 text-cyan-400" /> : <LayoutList className="w-4 h-4 text-cyan-400" />}
              {modoTabela === "completo" ? "Ver Resumo" : "Ver Completo"}
            </button>
          </div>

          {/* Tabela registros */}
          <section className="bg-slate-900 border border-slate-700/50 rounded-[7px] overflow-hidden">
            <div className="border-b border-slate-700/50 px-5 py-3.5 flex items-center justify-between bg-slate-800/30">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Plane className="w-4 h-4 text-cyan-400" />
                Registros de Voo
              </h2>
              <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-400">
                {lancamentos.length} voos
              </span>
            </div>

            {/* Scroll horizontal no topo */}
            <div className="border-b border-slate-700/50 bg-slate-800/20 overflow-x-auto h-2"></div>

            <div className="overflow-auto max-h-96">
              {modoTabela === "completo" ? (
                /* ===== MODO COMPLETO ===== */
                <table className="w-full border-collapse text-sm [&_td]:border-r [&_td]:border-slate-700/50 [&_th]:border-r [&_th]:border-slate-700/50 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0" style={{ tableLayout: "fixed" }}>
                  <thead className="border-b border-slate-700/50 bg-slate-800/50">
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2 text-center relative" style={{ width: colWidths["#"] ?? 36 }}>#<ResizeHandle col="#" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["data"] ?? 60 }}>Data<ResizeHandle col="data" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["de"] ?? 60 }}>De<ResizeHandle col="de" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["para"] ?? 60 }}>Para<ResizeHandle col="para" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["ac"] ?? 60 }}>AC<ResizeHandle col="ac" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["dep"] ?? 60 }}>DEP<ResizeHandle col="dep" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["pou"] ?? 60 }}>POU<ResizeHandle col="pou" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["cor"] ?? 60 }}>COR<ResizeHandle col="cor" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["tvoo"] ?? 70, color: "rgb(43, 122, 216)" }}>T VOO<ResizeHandle col="tvoo" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["tdia"] ?? 65, color: "rgb(106, 226, 231)" }}>T DIA<ResizeHandle col="tdia" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["tnoit"] ?? 65, color: "rgb(144, 19, 254)" }}>T NOIT<ResizeHandle col="tnoit" /></th>
                      <th className="px-3 py-2 text-left text-amber-400 relative" style={{ width: colWidths["ifr"] ?? 55 }}>IFR<ResizeHandle col="ifr" /></th>
                      <th className="px-3 py-2 text-center text-emerald-400 relative" style={{ width: colWidths["pousos"] ?? 60 }}>POUSOS<ResizeHandle col="pousos" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["abast"] ?? 65, color: "rgb(205, 132, 10)" }}>ABAST+<ResizeHandle col="abast" /></th>
                      <th className="px-3 py-2 text-left text-amber-400 relative" style={{ width: colWidths["fuel"] ?? 55 }}>FUEL<ResizeHandle col="fuel" /></th>
                      <th className="px-3 py-2 text-left text-slate-400 font-semibold relative" style={{ width: colWidths["celula"] ?? 70 }}>
                        CÉLULA
                        <ResizeHandle col="celula" />
                      </th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["pic"] ?? 110 }}>PIC<ResizeHandle col="pic" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["sic"] ?? 110 }}>SIC<ResizeHandle col="sic" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["voopara"] ?? 120 }}>VOO PARA<ResizeHandle col="voopara" /></th>
                      {temDiaria && <th className="px-3 py-2 text-left text-violet-400 relative" style={{ width: colWidths["diarias"] ?? 70 }}>DIÁRIAS<ResizeHandle col="diarias" /></th>}
                      <th className="px-3 py-2 text-center relative" style={{ width: colWidths["confPor"] ?? 160 }}>CONFIRMADO POR<ResizeHandle col="confPor" /></th>
                      <th className="px-3 py-2 text-center relative" style={{ width: colWidths["confirmar"] ?? 100 }}>CONFIRMAR<ResizeHandle col="confirmar" /></th>
                      <th className="px-3 py-2 text-center relative" style={{ width: colWidths["assinar"] ?? 120 }}>ASSINATURA PIC<ResizeHandle col="assinar" /></th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {displayLancamentos.length === 0 ? (
                      <tr><td colSpan={24} className="p-12 text-center text-slate-500">Nenhum voo registrado neste período.</td></tr>
                    ) : displayLancamentos.map(({ l, match }, idx) => {
                      const picT = l.pic_canac ? tripById.get(l.pic_canac) : null;
                      const sicT = l.sic_canac ? tripById.get(l.sic_canac) : null;
                      const isHighlight = searchQuery && match;
                      const isConfirmado = l.confirmado === true;
                      return (
                        <tr key={l.id}
                          id={`row-${l.id}`}
                          className={[
                            "border-b border-slate-700/50 transition-colors",
                            isHighlight ? "bg-cyan-500/10 outline outline-1 outline-cyan-500/40" : idx % 2 === 0 ? "bg-slate-800/20" : "",
                            "hover:bg-slate-800/60",
                            isConfirmado ? "opacity-80" : "",
                          ].join(" ")}>
                          <Td className="text-center">
                            <button
                              onClick={() => handleClickEditNumber(l)}
                              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 hover:font-semibold transition-colors underline"
                              title="Clique para editar este lançamento">
                              {idx + 1}
                            </button>
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
                              const resumoAbast = abastVinculados.length > 0
                                ? `${abastVinculados.length} abast. vinculado${abastVinculados.length > 1 ? 's' : ''}`
                                : null;

                              return comVinculo ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => navigate('/abastecimento')}
                                        className="text-blue-400 font-semibold hover:text-blue-300 hover:underline transition-colors"
                                        title={resumoAbast}>
                                        {totalAbast}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-blue-900/80 border-blue-500/50 text-blue-100">
                                      <div className="space-y-1">
                                        <p className="font-semibold">{resumoAbast}</p>
                                        {abastVinculados.map((ab) => (
                                          <div key={ab.id} className="text-xs">
                                            {new Date(ab.data).toLocaleDateString('pt-BR')} - {num(ab.litros ?? 0, 1)}L {ab.tipo_combustivel && `(${ab.tipo_combustivel})`}
                                          </div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="text-amber-400">{totalAbast}</span>
                              );
                            })()}
                          </Td>
                          <Td className="text-amber-400">{num(l.litros_combustivel_inicio_voo, 0)}</Td>
                          <Td className="font-mono text-white">
                            {modoCelula === "tvoo" ? num(l.celula_tvoo ?? 0, 1) : num(l.celula ?? 0, 1)}h
                          </Td>
                          <Td className="text-xs truncate">{picT?.nome_completo ?? l.pic_canac ?? "—"}</Td>
                          <Td className="text-xs truncate">{sicT?.nome_completo ?? l.sic_name ?? l.sic_canac ?? "—"}</Td>
                          <Td className="text-xs font-medium text-white truncate">{labelVooPara(l)}</Td>
                          {temDiaria && (
                            <Td className="text-center text-violet-400 font-semibold">
                              {Number(l.tarifa_diaria ?? 0) > 0 ? Number(l.tarifa_diaria) : "—"}
                            </Td>
                          )}
                          <Td className={`text-center text-xs ${isConfirmado ? "text-emerald-400 font-semibold" : "text-slate-400"}`}>
                            {l.confirmado_por && l.confirmado_em
                              ? `${l.confirmado_por} - ${new Date(l.confirmado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                              : "—"}
                          </Td>
                          <Td className="text-center">
                            {!isConfirmado && (
                              <button
                                onClick={() => handleConfirmar(l)}
                                className="rounded-lg border border-emerald-600/40 bg-emerald-900/20 p-1.5 text-emerald-400 hover:bg-emerald-800/40 hover:text-emerald-300 transition-colors"
                                title="Confirmar lançamento">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </Td>
                          <Td className="text-center">
                            {l.pic_canac === tripulacaoUsuario?.canac && !l.assinado_por && (
                              <button
                                onClick={() => handleAssinarPic(l)}
                                className="rounded-lg border border-blue-600/40 bg-blue-900/20 p-1.5 text-blue-400 hover:bg-blue-800/40 hover:text-blue-300 transition-colors"
                                title="Assinar como PIC">
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {l.assinado_por && (
                              <span className="text-xs text-blue-400 font-semibold">✓ Assinado</span>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {lancamentos.length > 0 && (
                    <tfoot className="border-t-2 border-cyan-500/30 bg-slate-800/90">
                      <tr>
                        <td colSpan={8} className="px-3 py-3 text-right text-xs font-bold uppercase tracking-widest text-cyan-400">
                          TOTAIS DO PERÍODO
                        </td>
                        <td className="px-3 py-3 font-mono font-bold text-sm" style={{ color: "rgb(43, 122, 216)" }}>{decimalToHHMM(totals.tVoo)}</td>
                        <td className="px-3 py-3 font-mono font-bold text-sm" style={{ color: "rgb(106, 226, 231)" }}>{decimalToHHMM(totals.tDia)}</td>
                        <td className="px-3 py-3 font-mono font-bold text-sm" style={{ color: "rgb(144, 19, 254)" }}>{decimalToHHMM(totals.tNoit)}</td>
                        <td className="px-3 py-3 font-mono font-bold text-amber-400 text-sm">{decimalToHHMM(totals.ifr)}</td>
                        <td className="px-3 py-3 text-center font-bold text-emerald-400 text-sm">{totals.pousos}</td>
                        <td className="px-3 py-3 font-bold text-amber-400 text-sm">{num(totals.abast, 0)}</td>
                        <td className="px-3 py-3 font-bold text-amber-400 text-sm">{num(totals.fuel, 0)}</td>
                        <td className="px-3 py-3 text-slate-500">—</td>
                        <td colSpan={3} className="px-3 py-3 text-slate-500">—</td>
                        {temDiaria && (
                          <td className="px-3 py-3 font-bold text-violet-400 text-sm text-center">
                            {totals.totalDiarias}
                            <span className="block text-xs text-violet-300/70">R${num(totalDiariaReais, 0)}</span>
                          </td>
                        )}
                        <td colSpan={4} className="px-3 py-3 text-slate-500">—</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              ) : (
                /* ===== MODO RESUMO ===== */
                <table className="w-full border-collapse text-sm [&_td]:border-r [&_td]:border-slate-700/50 [&_th]:border-r [&_th]:border-slate-700/50 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
                  <thead className="border-b border-slate-700/50 bg-slate-800/50">
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
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
                      <tr><td colSpan={9} className="p-12 text-center text-slate-500">Nenhum voo registrado.</td></tr>
                    ) : displayLancamentos.map(({ l, match }, idx) => {
                      const isHighlight = searchQuery && match;
                      const isConfirmado = l.confirmado === true;
                      const trecho = l.trecho ?? `${l.aerodromo_partida ?? "—"} → ${l.aerodromo_chegada ?? "—"}`;
                      return (
                        <tr key={l.id}
                          className={[
                            "border-b border-slate-700/50 transition-colors",
                            isHighlight ? "bg-cyan-500/10 outline outline-1 outline-cyan-500/40" : idx % 2 === 0 ? "bg-slate-800/20" : "",
                            "hover:bg-slate-800/60",
                          ].join(" ")}>
                          <Td className="text-center font-mono text-xs text-slate-500">{idx + 1}</Td>
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
          <section className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5">
            <div className="mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">Horas por Cotista</h2>
              <span className="ml-2 text-xs text-slate-500">
                ({modoCelula === "tvoo" ? "T. Voo" : "T. Total"})
              </span>
            </div>
            {porCotista.length === 0 ? (
              <p className="py-6 text-center text-slate-500">Sem registros.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {porCotista.map((c, idx) => {
                  const tot = porCotista.reduce((s, x) => s + x.horas, 0);
                  const pct = tot > 0 ? (c.horas / tot) * 100 : 0;
                  const colors = ["from-cyan-500 to-blue-500", "from-violet-500 to-purple-500", "from-emerald-500 to-teal-500", "from-amber-500 to-orange-500", "from-rose-500 to-pink-500"];
                  const color = colors[idx % colors.length];
                  return (
                    <button key={`${c.label}-${idx}`}
                      onClick={() => setCotistaFiltro(cotistaFiltro === c.label ? null : c.label)}
                      className={`rounded-xl border p-3 flex flex-col gap-2 transition-all cursor-pointer ${cotistaFiltro === c.label ? "border-cyan-400 bg-cyan-500/15" : "border-slate-700/40 bg-slate-800/50 hover:border-slate-600"}`}>
                      <span className="truncate text-xs font-medium text-slate-300 leading-tight" title={c.label}>{c.label}</span>
                      <span className={`font-mono text-lg font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
                        {decimalToHHMM(c.horas)}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-900">
                          <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-slate-500 text-xs shrink-0">{pct.toFixed(1)}%</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">clique para ver mais</p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </div>

      <AlertDialog open={editConfirmDialog.open} onOpenChange={(open) => {
        if (!open) setEditConfirmDialog({ open: false, lanc: null });
      }}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogTitle className="text-white">Editar Lançamento?</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            Deseja editar esse lançamento? As alterações atualizarão os dados do registro.
          </AlertDialogDescription>
          <div className="flex justify-end gap-3 mt-6">
            <AlertDialogCancel className="bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-600">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmEdit}
              className="bg-blue-600 text-white hover:bg-blue-700">
              Sim, editar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AnimatePresence>
        {showForm && aeronave && (
          <NovoVooDialog
            aeronave={aeronave}
            mes={mes} ano={ano}
            modoCelula={modoCelula}
            clientes={clientes} socios={socios} tripulantes={tripulantes}
            ultimaCelula={diarioMes?.celula_atual_ttotal ?? 0}
            ultimaCelulaTvoo={diarioMes?.celula_atual_tvoo ?? 0}
            temDiaria={temDiaria}
            onClose={() => setShowForm(false)}
            onSaved={async () => { setShowForm(false); await new Promise(r => setTimeout(r, 500)); await reload(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingLanc && aeronave && (
          <EditarVooDialog
            lanc={editingLanc}
            aeronave={aeronave}
            clientes={clientes} socios={socios} tripulantes={tripulantes}
            temDiaria={temDiaria}
            onClose={() => setEditingLanc(null)}
            onSaved={async () => { setEditingLanc(null); await reload(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConsumo && aeronave && (
          <ConsumoDialog
            aeronave={aeronave}
            lancamentos={lancamentos}
            lancamentosAno={lancamentosAno}
            clientes={clientes} socios={socios}
            mes={mes} ano={ano}
            labelVooPara={labelVooPara}
            onClose={() => setShowConsumo(false)}
          />
        )}
      </AnimatePresence>

      <CreateMonthDialog
        open={showCreateMonth}
        onOpenChange={(open) => {
          setShowCreateMonth(open);
          if (!open) setPreviousMonthForCreation(null);
        }}
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

/* ---------- Componentes Auxiliares ---------- */

function Th({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <th style={style} className={`px-3 py-2 text-left font-semibold align-middle whitespace-nowrap ${className}`}>{children}</th>;
}
function Td({ children, className = "", colSpan, style }: { children: React.ReactNode; className?: string; colSpan?: number; style?: React.CSSProperties }) {
  return <td colSpan={colSpan} style={style} className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}
function Stat({ icon, label, value, accent }: { icon?: React.ReactNode; label: string; value: string; accent?: "primary" | "success" | "warning" }) {
  const color = accent === "primary" ? "text-cyan-400" : accent === "success" ? "text-emerald-400" : accent === "warning" ? "text-amber-400" : "text-white";
  return (
    <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/40">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-cyan-400 flex items-center">{icon}</span>}
        <span className="text-cyan-400 text-xs">{label}</span>
      </div>
      <p className={`font-semibold text-sm ${color}`}>{value}</p>
    </div>
  );
}

/* ---------- Novo Voo Dialog ---------- */

const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none transition-colors placeholder:text-slate-600";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function NovoVooDialog({
  aeronave, mes, ano, modoCelula, clientes, socios, tripulantes, ultimaCelula, ultimaCelulaTvoo, temDiaria, onClose, onSaved,
}: {
  aeronave: Aeronave; mes: number; ano: number;
  modoCelula: "tvoo" | "tempo_total";
  clientes: Cliente[]; socios: Socio[]; tripulantes: Tripulante[];
  ultimaCelula: number; ultimaCelulaTvoo: number;
  temDiaria: boolean;
  onClose: () => void; onSaved: () => void;
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

  const [showAbastForm, setShowAbastForm] = useState(false);
  const [abastecimentos, setAbastecimentos] = useState<any[]>([]);
  const [localCombustivel, setLocalCombustivel] = useState("");
  const [tipoCombustivel, setTipoCombustivel] = useState("");
  const [precoCombustivel, setPrecoCombustivel] = useState(0);
  const [consumoCombustivelVoo, setConsumoCombustivelVoo] = useState(0);
  const [abastecimentoSelecionado, setAbastecimentoSelecionado] = useState<string | null>(null);

  const sociosDoCliente = useMemo(() => socios.filter((s) => s.cliente_id === clienteId), [socios, clienteId]);
  const tripOptions = useMemo(() =>
    tripulantes.filter((t) => (t.status ?? "").toLowerCase().startsWith("ativ"))
      .slice().sort((a, b) => (a.nome_completo ?? "").localeCompare(b.nome_completo ?? "")),
    [tripulantes]);

  useEffect(() => {
    const carregarAbastecimentos = async () => {
      if (!clienteId) {
        setAbastecimentos([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("abastecimentos")
          .select("*")
          .eq("id_clientes", clienteId)
          .eq("aeronave_id", aeronave.id)
          .order("data", { ascending: false });

        if (!error && data) {
          setAbastecimentos(data);
        }
      } catch (e) {
        console.error("Erro ao carregar abastecimentos:", e);
      }
    };
    carregarAbastecimentos();
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
        tempo_ac: acionamento ? `${acionamento}:00` : null,
        tempo_dep: decolagem ? `${decolagem}:00` : null,
        tempo_pou: pouso ? `${pouso}:00` : null,
        tempo_cor: corte ? `${corte}:00` : null,
        tempo_voo: tVoo, tempo_total: tTotal, horas_diurnas: diurno,
        horas_noturnas: noturnoDec, tempo_ifr: ifrDec, pousos_total: pousos,
        litros_combustivel_inicio_voo: fuelInicio, combustivel_adicionado: abast,
        celula, celula_tvoo: celulaTvoo,
        pic_canac: picId || null, sic_canac: sicId || null,
        sic_name: sicNome || sicTrip?.nome_completo || null,
        natureza_voo: natureza, tarifa_diaria: temDiaria ? String(qtdDiarias) : null,
        clientes_id: clienteId || null, socios_cliente_id: socioId || null,
        socios_nome: socioNome,
        emprestimo, cliente_tomador_emprestimo_id: emprestimo ? (clienteTomadorId || null) : null,
        socio_tomador_emprestimo_id: emprestimo ? (socioTomadorId || null) : null,
        ocorrencias: obs || null,
        consumo_combustivel_voo: consumoCombustivelVoo || null,
        preco_combustivel_litro: precoCombustivel || null,
        local_combustivel: localCombustivel || null,
        tipo_combustivel: tipoCombustivel || null,
        origem_pic: picId ? 'membros_tripulacao' : null,
        origem_sic: sicId ? 'membros_tripulacao' : null,
      };
      const ins = await supabase.from("lancamentos_diario_bordo").insert(payload as never);
      if (ins.error) throw ins.error;

      // Atualizar apenas a coluna relevante baseado em modoCelula
      const updatePayload = modoCelula === "tvoo"
        ? { celula_atual_tvoo: celulaTvoo }
        : { celula_atual_ttotal: celula };

      await supabase.from("diario_mes").update(updatePayload).eq("id", dmId);
      onSaved();
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      alert("Erro ao salvar: " + msg);
    } finally { setSaving(false); }
  };

  if (showAbastForm && clienteId) {
    return (
      <AbastecimentoModal
        clienteId={clienteId}
        aeronaveId={aeronave.id}
        abastecimentos={abastecimentos}
        onSelectAbastecimento={(abast) => {
          setAbast(Number(abast.litros) || 0);
          setLocalCombustivel(abast.local || "");
          setTipoCombustivel(abast.tipo_combustivel || "");
          setPrecoCombustivel(Number(abast.valor_unitario) || 0);
          setConsumoCombustivelVoo(Number(abast.litros) || 0);
          setAbastecimentoSelecionado(abast.id);
          setShowAbastForm(false);
        }}
        onCreateNew={() => {
          setShowAbastForm(false);
        }}
        onClose={() => setShowAbastForm(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-cyan-500/10">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700/50 bg-slate-900/95 p-5 backdrop-blur">
          <div>
            <h3 className="text-xl font-bold text-white">Novo Voo · {aeronave.matricula}</h3>
            <p className="text-xs text-slate-400">Horários em Zulu (UTC)</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-6 p-5">
          <Section title="Identificação">
            <Field label="Data">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={data}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d{4}-\d{2}-\d{2}$/.test(val) || val === '') {
                      setData(val);
                    }
                  }}
                  placeholder="YYYY-MM-DD"
                  className={inputCls}
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="icon" className="h-11 w-11">
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 !bg-[#1a2332] !border-slate-700 !rounded-lg" align="end">
                    <div className="p-4 border-b border-slate-700 bg-[#1a2332]">
                      <div className="flex items-center gap-2 text-slate-100">
                        <CalendarIcon className="h-5 w-5 text-cyan-400" />
                        <span className="text-lg font-semibold">
                          {data ? format(new Date(data), 'dd/MM/yyyy') : 'Selecione uma data'}
                        </span>
                      </div>
                    </div>
                    <div className="p-6 bg-[#1a2332]">
                      <CalendarComponent
                        mode="single"
                        selected={data ? new Date(data) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            setData(`${year}-${month}-${day}`);
                          }
                        }}
                        defaultMonth={data ? new Date(data) : new Date()}
                        initialFocus
                        className="pointer-events-auto bg-[#1a2332]"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </Field>
          </Section>
          <Section title="Cliente & Cotista">
            <Field label="Cliente">
              <SearchableCombobox
                items={clientes.map((c) => ({
                  id: c.id,
                  label: c.razao_social ?? c.proprietario ?? c.id.slice(0, 6)
                }))}
                value={clienteId}
                onChange={(value) => { setClienteId(value); setSocioId(""); }}
                placeholder="Selecionar cliente..."
                searchPlaceholder="Buscar cliente..."
              />
            </Field>
            <Field label="Sócio-Cliente (opcional)">
              <SearchableCombobox
                items={sociosDoCliente.map((s) => ({
                  id: s.id,
                  label: s.nome
                }))}
                value={socioId}
                onChange={(value) => setSocioId(value)}
                placeholder="Selecionar sócio..."
                searchPlaceholder="Buscar sócio..."
                disabled={!clienteId || sociosDoCliente.length === 0}
              />
            </Field>
            <Field label="Voo emprestado?">
              <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm cursor-pointer">
                <input type="checkbox" checked={emprestimo} onChange={(e) => setEmprestimo(e.target.checked)} disabled={!clienteId}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/50" />
                <span className={emprestimo ? "font-semibold text-amber-400" : "text-slate-400"}>{emprestimo ? "SIM — marcará tomador" : "Não"}</span>
              </label>
            </Field>
            {emprestimo && (
              <>
                <Field label="Cliente Tomador do Empréstimo">
                  <SearchableCombobox
                    items={clientes.map((c) => ({
                      id: c.id,
                      label: c.razao_social ?? c.proprietario ?? c.id.slice(0, 6)
                    }))}
                    value={clienteTomadorId}
                    onChange={(value) => { setClienteTomadorId(value); setSocioTomadorId(""); }}
                    placeholder="Selecionar cliente tomador..."
                    searchPlaceholder="Buscar cliente..."
                  />
                </Field>
                {clienteTomadorId && sociosDoCliente.length > 0 && (
                  <Field label="Sócio Tomador do Empréstimo (opcional)">
                    <SearchableCombobox
                      items={socios.filter(s => s.cliente_id === clienteTomadorId).map((s) => ({
                        id: s.id,
                        label: s.nome
                      }))}
                      value={socioTomadorId}
                      onChange={(value) => setSocioTomadorId(value)}
                      placeholder="Selecionar sócio tomador..."
                      searchPlaceholder="Buscar sócio..."
                    />
                  </Field>
                )}
              </>
            )}
          </Section>
          <Section title="Natureza do voo">
            <Field label="Natureza">
              <select value={natureza} onChange={(e) => setNatureza(e.target.value)} className={inputCls}>
                {NATUREZAS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          </Section>
          <Section title="Tripulação">
            <Field label="PIC (Tripulante)">
              <SearchableCombobox
                items={tripOptions.map((t) => ({
                  id: t.id,
                  label: `${t.nome_completo ?? t.canac ?? t.id.slice(0, 6)}${t.canac ? ` (${t.canac})` : ""}`
                }))}
                value={picId}
                onChange={(value) => setPicId(value)}
                placeholder="Selecionar PIC..."
                searchPlaceholder="Buscar tripulante..."
              />
            </Field>
            <Field label="SIC (Tripulante)">
              <SearchableCombobox
                items={tripOptions.map((t) => ({
                  id: t.id,
                  label: `${t.nome_completo ?? t.canac ?? t.id.slice(0, 6)}${t.canac ? ` (${t.canac})` : ""}`
                }))}
                value={sicId}
                onChange={(value) => setSicId(value)}
                placeholder="Selecionar SIC..."
                searchPlaceholder="Buscar tripulante..."
              />
            </Field>
          </Section>
          <Section title="Aerodromo">
            <Field label="Origem (ICAO)">
              <SearchableCombobox
                items={[
                  { id: "SBSP", label: "SBSP - São Paulo (Congonhas)" },
                  { id: "SBRJ", label: "SBRJ - Rio de Janeiro (Santos Dumont)" },
                  { id: "SBKP", label: "SBKP - Campinas (Viracopos)" },
                  { id: "SBGR", label: "SBGR - São Paulo (Guarulhos)" },
                ]}
                value={origem}
                onChange={(value) => setOrigem(value)}
                placeholder="Buscar aerodromo..."
                searchPlaceholder="Digite o código ou nome..."
                allowFreeText={true}
              />
            </Field>
            <Field label="Destino (ICAO)">
              <SearchableCombobox
                items={[
                  { id: "SBSP", label: "SBSP - São Paulo (Congonhas)" },
                  { id: "SBRJ", label: "SBRJ - Rio de Janeiro (Santos Dumont)" },
                  { id: "SBKP", label: "SBKP - Campinas (Viracopos)" },
                  { id: "SBGR", label: "SBGR - São Paulo (Guarulhos)" },
                ]}
                value={destino}
                onChange={(value) => setDestino(value)}
                placeholder="Buscar aerodromo..."
                searchPlaceholder="Digite o código ou nome..."
                allowFreeText={true}
              />
            </Field>
          </Section>
          <Section title="Horários (Zulu) — apresentação auto 30min">
            <Field label="Apresentação (auto)"><input value={apresentacao || "--:--"} disabled className={`${inputCls} font-mono opacity-70 cursor-not-allowed`} /></Field>
            <Field label="Acionamento (AC)"><input type="time" value={acionamento} onChange={(e) => setAcionamento(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Decolagem (DEP)"><input type="time" value={decolagem} onChange={(e) => setDecolagem(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Pouso (POU)"><input type="time" value={pouso} onChange={(e) => setPouso(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Corte (COR)"><input type="time" value={corte} onChange={(e) => setCorte(e.target.value)} className={`${inputCls} font-mono`} /></Field>
          </Section>
          <Section title="Tempos calculados">
            <Field label="T. Voo (POU - DEP)"><input value={`${decimalToHHMM(tVoo)}  (${num(tVoo, 2)}h)`} disabled className={`${inputCls} font-mono text-cyan-400 border-cyan-500/30 bg-cyan-500/5`} /></Field>
            <Field label="Tempo Total (COR - AC)"><input value={`${decimalToHHMM(tTotal)}  (${num(tTotal, 2)}h)`} disabled className={`${inputCls} font-mono text-cyan-400 border-cyan-500/30 bg-cyan-500/5`} /></Field>
            <Field label="Diurno (auto)"><input value={decimalToHHMM(diurno)} disabled className={`${inputCls} font-mono opacity-70 cursor-not-allowed`} /></Field>
            <Field label="Noturno"><input type="time" value={noturno} onChange={(e) => setNoturno(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="IFR"><input type="time" value={ifr} onChange={(e) => setIfr(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Pousos"><input type="number" min={0} value={pousos} onChange={(e) => setPousos(Number(e.target.value))} className={inputCls} /></Field>
            <Field label="ABAST+ (L)">
              <div className="flex gap-2">
                <input type="number" min={0} value={abast} onChange={(e) => setAbast(Number(e.target.value))} className={`${inputCls} flex-1`} />
                <button
                  type="button"
                  onClick={() => setShowAbastForm(true)}
                  className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                >
                  Buscar
                </button>
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
              <Field label="Qtd. de Diárias neste voo">
                <input type="number" min={0} value={qtdDiarias} onChange={(e) => setQtdDiarias(Number(e.target.value))} className={`${inputCls} text-violet-400 font-mono`} />
              </Field>
            </Section>
          )}
          <Field label="Ocorrências / Observações">
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={inputCls} placeholder="Detalhes opcionais do voo..." />
          </Field>
        </div>
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-700/50 bg-slate-900/95 p-5 backdrop-blur">
          <button onClick={onClose} className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-600 disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar voo"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- Editar Voo Dialog ---------- */

function EditarVooDialog({
  lanc, aeronave, clientes, socios, tripulantes, temDiaria, onClose, onSaved,
}: {
  lanc: Lanc; aeronave: Aeronave;
  clientes: Cliente[]; socios: Socio[]; tripulantes: Tripulante[];
  temDiaria: boolean;
  onClose: () => void; onSaved: () => void;
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
        tempo_ac: acionamento ? `${acionamento}:00` : null,
        tempo_dep: decolagem ? `${decolagem}:00` : null,
        tempo_pou: pouso ? `${pouso}:00` : null,
        tempo_cor: corte ? `${corte}:00` : null,
        tempo_voo: tVoo, tempo_total: tTotal, horas_diurnas: diurno,
        horas_noturnas: noturnoDec, tempo_ifr: ifrDec, pousos_total: pousos,
        litros_combustivel_inicio_voo: fuelInicio, combustivel_adicionado: abast,
        celula, celula_tvoo: celulaTvoo,
        pic_canac: picId || null, sic_canac: sicId || null, sic_name: sicNome || null,
        natureza_voo: natureza, tarifa_diaria: temDiaria ? String(qtdDiarias) : null,
        clientes_id: clienteId || null, socios_cliente_id: socioId || null,
        socios_nome: socioNome,
        emprestimo, cliente_tomador_emprestimo_id: emprestimo ? (clienteId || null) : null,
        socio_tomador_emprestimo_id: emprestimo ? (socioId || null) : null,
        consumo_combustivel_voo: lanc.consumo_combustivel_voo || null,
        preco_combustivel_litro: lanc.preco_combustivel_litro || null,
        local_combustivel: lanc.local_combustivel || null,
        tipo_combustivel: lanc.tipo_combustivel || null,
        origem_pic: picId ? 'crew_members' : null,
        origem_sic: sicId ? 'crew_members' : null,
      } as never).eq("id", lanc.id);
      if (error) throw error;
      onSaved();
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      alert("Erro ao salvar: " + msg);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-amber-500/30 bg-slate-900 shadow-2xl shadow-amber-500/10">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700/50 bg-slate-900/95 p-5 backdrop-blur">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Pencil className="w-5 h-5 text-amber-400" /> Editar Voo · {aeronave.matricula}</h3>
            <p className="text-xs text-amber-400/60">Editando lançamento de {new Date(lanc.data_registro + "T00:00").toLocaleDateString("pt-BR")}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-6 p-5">
          <Section title="Tripulação & Cotista">
            <Field label="PIC">
              <SearchableCombobox
                items={tripOptions.map((t) => ({
                  id: t.id,
                  label: `${t.nome_completo ?? t.canac ?? t.id.slice(0, 6)}`
                }))}
                value={picId}
                onChange={(value) => setPicId(value)}
                placeholder="Selecionar PIC..."
                searchPlaceholder="Buscar tripulante..."
              />
            </Field>
            <Field label="SIC">
              <SearchableCombobox
                items={tripOptions.map((t) => ({
                  id: t.id,
                  label: `${t.nome_completo ?? t.canac ?? t.id.slice(0, 6)}`
                }))}
                value={sicId}
                onChange={(value) => setSicId(value)}
                placeholder="Selecionar SIC..."
                searchPlaceholder="Buscar tripulante..."
              />
            </Field>
            <Field label="Cliente">
              <SearchableCombobox
                items={clientes.map((c) => ({
                  id: c.id,
                  label: c.razao_social ?? c.proprietario ?? c.id.slice(0, 6)
                }))}
                value={clienteId}
                onChange={(value) => { setClienteId(value); setSocioId(""); }}
                placeholder="Selecionar cliente..."
                searchPlaceholder="Buscar cliente..."
              />
            </Field>
            <Field label="Sócio">
              <SearchableCombobox
                items={sociosDoCliente.map((s) => ({
                  id: s.id,
                  label: s.nome
                }))}
                value={socioId}
                onChange={(value) => setSocioId(value)}
                placeholder="Selecionar sócio..."
                searchPlaceholder="Buscar sócio..."
                disabled={!clienteId || sociosDoCliente.length === 0}
              />
            </Field>
            <Field label="Voo emprestado?">
              <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm cursor-pointer">
                <input type="checkbox" checked={emprestimo} onChange={(e) => setEmprestimo(e.target.checked)} disabled={!clienteId}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500" />
                <span className={emprestimo ? "font-semibold text-amber-400" : "text-slate-400"}>{emprestimo ? "SIM" : "Não"}</span>
              </label>
            </Field>
          </Section>
          <Section title="Identificação">
            <Field label="Data">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={data}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d{4}-\d{2}-\d{2}$/.test(val) || val === '') {
                      setData(val);
                    }
                  }}
                  placeholder="YYYY-MM-DD"
                  className={inputCls}
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="icon" className="h-11 w-11">
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 !bg-[#1a2332] !border-slate-700 !rounded-lg" align="end">
                    <div className="p-4 border-b border-slate-700 bg-[#1a2332]">
                      <div className="flex items-center gap-2 text-slate-100">
                        <CalendarIcon className="h-5 w-5 text-cyan-400" />
                        <span className="text-lg font-semibold">
                          {data ? format(new Date(data), 'dd/MM/yyyy') : 'Selecione uma data'}
                        </span>
                      </div>
                    </div>
                    <div className="p-6 bg-[#1a2332]">
                      <CalendarComponent
                        mode="single"
                        selected={data ? new Date(data) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            setData(`${year}-${month}-${day}`);
                          }
                        }}
                        defaultMonth={data ? new Date(data) : new Date()}
                        initialFocus
                        className="pointer-events-auto bg-[#1a2332]"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </Field>
            <Field label="Natureza do voo">
              <select value={natureza} onChange={(e) => setNatureza(e.target.value)} className={inputCls}>
                {NATUREZAS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Origem (ICAO)">
              <SearchableCombobox
                items={[
                  { id: "SBSP", label: "SBSP - São Paulo (Congonhas)" },
                  { id: "SBRJ", label: "SBRJ - Rio de Janeiro (Santos Dumont)" },
                  { id: "SBKP", label: "SBKP - Campinas (Viracopos)" },
                  { id: "SBGR", label: "SBGR - São Paulo (Guarulhos)" },
                ]}
                value={origem}
                onChange={(value) => setOrigem(value)}
                placeholder="Buscar aerodromo..."
                searchPlaceholder="Digite o código ou nome..."
                allowFreeText={true}
              />
            </Field>
            <Field label="Destino (ICAO)">
              <SearchableCombobox
                items={[
                  { id: "SBSP", label: "SBSP - São Paulo (Congonhas)" },
                  { id: "SBRJ", label: "SBRJ - Rio de Janeiro (Santos Dumont)" },
                  { id: "SBKP", label: "SBKP - Campinas (Viracopos)" },
                  { id: "SBGR", label: "SBGR - São Paulo (Guarulhos)" },
                ]}
                value={destino}
                onChange={(value) => setDestino(value)}
                placeholder="Buscar aerodromo..."
                searchPlaceholder="Digite o código ou nome..."
                allowFreeText={true}
              />
            </Field>
          </Section>
          <Section title="Horários (Zulu)">
            <Field label="Acionamento (AC)"><input type="time" value={acionamento} onChange={(e) => setAcionamento(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Decolagem (DEP)"><input type="time" value={decolagem} onChange={(e) => setDecolagem(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Pouso (POU)"><input type="time" value={pouso} onChange={(e) => setPouso(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Corte (COR)"><input type="time" value={corte} onChange={(e) => setCorte(e.target.value)} className={`${inputCls} font-mono`} /></Field>
          </Section>
          <Section title="Tempos">
            <Field label="T. Voo"><input value={`${decimalToHHMM(tVoo)} (${num(tVoo, 2)}h)`} disabled className={`${inputCls} font-mono text-cyan-400 border-cyan-500/30 bg-cyan-500/5`} /></Field>
            <Field label="Tempo Total"><input value={`${decimalToHHMM(tTotal)} (${num(tTotal, 2)}h)`} disabled className={`${inputCls} font-mono text-cyan-400 border-cyan-500/30 bg-cyan-500/5`} /></Field>
            <Field label="Diurno (auto)"><input value={decimalToHHMM(diurno)} disabled className={`${inputCls} font-mono opacity-70 cursor-not-allowed`} /></Field>
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
              <Field label="Qtd. de Diárias neste voo">
                <input type="number" min={0} value={qtdDiarias} onChange={(e) => setQtdDiarias(Number(e.target.value))} className={`${inputCls} text-violet-400 font-mono`} />
              </Field>
            </Section>
          )}
        </div>
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-700/50 bg-slate-900/95 p-5 backdrop-blur">
          <button onClick={onClose} className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400 disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar edição"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- Abastecimento Modal ---------- */

function AbastecimentoModal({
  clienteId,
  aeronaveId,
  abastecimentos,
  onSelectAbastecimento,
  onCreateNew,
  onClose,
}: {
  clienteId: string;
  aeronaveId: string;
  abastecimentos: any[];
  onSelectAbastecimento: (abast: any) => void;
  onCreateNew: () => void;
  onClose: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    data: new Date().toISOString().slice(0, 10),
    trecho: "",
    local: "",
    litros: 0,
    valor_unitario: 0,
    tipo_combustivel: "",
    abastecedor: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSaveNew = async () => {
    if (!formData.local || !formData.litros || formData.litros <= 0) {
      alert("Preencha todos os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const { data: newAbast, error } = await supabase
        .from("abastecimentos")
        .insert({
          id_clientes: clienteId,
          aeronave_id: aeronaveId,
          data: formData.data,
          trecho: formData.trecho,
          local: formData.local,
          litros: formData.litros,
          valor_unitario: formData.valor_unitario,
          tipo_combustivel: formData.tipo_combustivel,
          abastecedor: formData.abastecedor,
        })
        .select()
        .single();

      if (error) throw error;

      onSelectAbastecimento(newAbast);
      setShowForm(false);
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      alert("Erro ao salvar abastecimento: " + msg);
    } finally {
      setSaving(false);
    }
  };

  if (showForm) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
          className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-cyan-500/10">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700/50 bg-slate-900/95 p-5 backdrop-blur">
            <h3 className="text-xl font-bold text-white">Novo Abastecimento</h3>
            <button onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Data</label>
              <input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Trecho</label>
              <input
                type="text"
                value={formData.trecho}
                onChange={(e) => setFormData({ ...formData, trecho: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Local *</label>
              <input
                type="text"
                value={formData.local}
                onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                placeholder="Ex: Jacarepaguá"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Litros *</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={formData.litros}
                onChange={(e) => setFormData({ ...formData, litros: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Valor Unitário (R$/L)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={formData.valor_unitario}
                onChange={(e) => setFormData({ ...formData, valor_unitario: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Combustível</label>
              <input
                type="text"
                value={formData.tipo_combustivel}
                onChange={(e) => setFormData({ ...formData, tipo_combustivel: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                placeholder="Ex: Avgas 100LL"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Abastecedor</label>
              <input
                type="text"
                value={formData.abastecedor}
                onChange={(e) => setFormData({ ...formData, abastecedor: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
              />
            </div>
          </div>
          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-700/50 bg-slate-900/95 p-5 backdrop-blur">
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSaveNew}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-600 disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-cyan-500/10">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700/50 bg-slate-900/95 p-5 backdrop-blur">
          <h3 className="text-xl font-bold text-white">Abastecimento já lançando</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          {abastecimentos.length === 0 ? (
            <p className="text-center text-slate-400 mb-4">Nenhum abastecimento encontrado para esta aeronave</p>
          ) : (
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {abastecimentos.map((abast) => (
                <button
                  key={abast.id}
                  onClick={() => onSelectAbastecimento(abast)}
                  className="w-full text-left rounded-lg border border-slate-700 bg-slate-800 p-3 hover:bg-slate-700 hover:border-cyan-500/50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-white">{abast.local} · {abast.litros}L</p>
                      <p className="text-xs text-slate-400">{new Date(abast.data).toLocaleDateString("pt-BR")} · {abast.trecho || "—"}</p>
                      {abast.tipo_combustivel && (
                        <p className="text-xs text-slate-500">{abast.tipo_combustivel}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-cyan-400">{num(abast.litros, 2)}L</p>
                      {abast.valor_unitario && (
                        <p className="text-xs text-slate-400">R$ {num(abast.valor_unitario, 2)}/L</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-700/50 bg-slate-900/95 p-5 backdrop-blur">
          <button onClick={onClose} className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-600"
          >
            <Plus className="w-4 h-4" /> Novo Abastecimento
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default DiarioBordoDetalhes;
