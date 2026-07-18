import { SetStateAction, useEffect, useMemo, useState } from "react";
import { CalendarIcon, Plus, Trash2, Upload, FileText, Loader2, Send, Save, Link2, ArrowUp, ArrowDown, Eye, ExternalLink, Plane, Users, Wallet } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  findExistingFuelReference,
  findExistingReceiptReference,
  findExistingTravelExpenseReference,
  montarLinhasRateio,
  montarLinhasRateioMultiCliente,
  normalizarTipoDespesa,
  normalizarTipoRateio,
  validarSomaPercentualClientes,
  ClienteLinhaRateioInput,
} from "@/components/dashboard/financeiro/solicitacaoPagamentoValidators";

interface SolicitacaoPagamentoModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Periodicidade = "MENSAL" | "SEMESTRAL" | "ANUAL" | "EVENTUAL";

interface AnexoDoc {
  id: string;
  tipo: "nf" | "recibo" | "boleto" | "doc";
  numero: string;
  arquivo?: File | null;
  url?: string | null;
}

const TIPOS_ANEXO: { value: AnexoDoc["tipo"]; label: string }[] = [
  { value: "nf", label: "Nota Fiscal" },
  { value: "recibo", label: "Recibo" },
  { value: "boleto", label: "Boleto" },
  { value: "doc", label: "Documento" },
];

const BUCKET = "n.f-boletos-clients";

type SocioOption = { id: string; nome: string; percentual_participacao?: number | null };
type TipoDespesaOption = { id: string; expense_type: string };
type FornecedorOption = { id: string; label: string; source: "favorito" | "combustivel" };
type AeronaveOption = { id: string; matricula: string; modelo: string };
type ReciboOption = { id: string; numero_recibo?: string | null; numero?: string | null; pdf_url?: string | null; arquivo_url?: string | null; valor_total?: number | null; created_at?: string | null };
type TravelReportOption = {
  id: string; numero_relatorio: string;
  data_inicio?: string | null; data_fim?: string | null;
  total_valor?: number | null; total_trip?: number | null; total_trip2?: number | null; total_clientes?: number | null;
  nome_tripulante?: string | null; nome_tripulante_2?: string | null;
  tripulacao_id?: string | null; tripulante_id2?: string | null;
  matricula_aeronave?: string | null; url_pdf?: string | null;
  aeronave_id?: string | null; socios_id?: string | null; clientes_id?: string | null;
  pago_em?: string | null;
};

type ClienteAeronaveOption = {
  clienteId: string;
  razaoSocial: string;
  cnpj: string | null;
  socios: SocioOption[];
};

interface ClienteLinhaState {
  uid: string;
  clienteId: string;
  percentualUsoCliente: string;
  overridesSocio: Record<string, string>;
}

type InsertedRow = {
  expense_type: SetStateAction<string>; id: string
};
type SupabaseInsertBuilder = {
  insert: (payload: Record<string, unknown> | Array<Record<string, unknown>>) => {
    select: (columns: string) => {
      single: () => Promise<{ data: InsertedRow | null; error: unknown }>;
    };
  };
};
type SupabaseClientLike = {
  from: (relation: string) => SupabaseInsertBuilder;
};

async function insertAndGetId(table: string, payload: Record<string, unknown>) {
  const supabaseClient = supabase as unknown as SupabaseClientLike;
  const builder = supabaseClient.from(table);
  const { data, error } = await builder.insert(payload).select("id").single();
  if (error) throw error;

  const row = data as InsertedRow | null;
  if (!row?.id) throw new Error(`Falha ao criar registro em ${table}`);

  return row.id;
}

export function SolicitacaoPagamentoModal({ open, onOpenChange }: SolicitacaoPagamentoModalProps) {
  const [tiposDespesa, setTiposDespesa] = useState<TipoDespesaOption[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorOption[]>([]);
  const [aeronaves, setAeronaves] = useState<AeronaveOption[]>([]);
  const [recibosExistentes, setRecibosExistentes] = useState<ReciboOption[]>([]);
  const [clientesDaAeronave, setClientesDaAeronave] = useState<ClienteAeronaveOption[]>([]);

  const [aeronaveId, setAeronaveId] = useState("");
  const [reembolsavel, setReembolsavel] = useState(false);
  const [tipoDespesa, setTipoDespesa] = useState("");
  const [tipoDespesaLabel, setTipoDespesaLabel] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("EVENTUAL");
  const [tipoRateio, setTipoRateio] = useState("FIXO");
  const [observacoes, setObservacoes] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [dataEmissao, setDataEmissao] = useState<Date | undefined>(new Date());
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(new Date());
  const [anexos, setAnexos] = useState<AnexoDoc[]>([]);
  const [usarReciboExistente, setUsarReciboExistente] = useState(false);
  const [reciboExistenteId, setReciboExistenteId] = useState("");
  const [referenciaDuplicada, setReferenciaDuplicada] = useState<{ tipo: "abastecimento" | "travel_expense_report" | "recibo" | null; id: string | null; mensagem: string | null }>({ tipo: null, id: null, mensagem: null });

  const [clienteLinhas, setClienteLinhas] = useState<ClienteLinhaState[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [socioId, setSocioId] = useState("");
  const [socios, setSocios] = useState<SocioOption[]>([]);
  const [percentualUso, setPercentualUso] = useState("100");
  const [travelReports, setTravelReports] = useState<TravelReportOption[]>([]);
  const [travelReportId, setTravelReportId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [tip, ff, fc, aer, rec] = await Promise.all([
        supabase.from("expense_configu").select("id, expense_type").order("expense_type"),
        supabase.from("fornecedores_favoritos").select("id, nome_completo, apelido").order("nome_completo"),
        supabase.from("fornecedores_combustivel").select("id, nome_fornecedor, nome_cidade").order("nome_fornecedor"),
        supabase.from("aeronave").select("id, matricula, modelo").order("matricula"),
        supabase.from("recibos").select("id, numero_recibo, url_pdf, valor_total, criado_em, cliente_id").order("criado_em", { ascending: false }),
      ]);
      setTiposDespesa((tip.data as TipoDespesaOption[] | null) || []);
      const forn: FornecedorOption[] = [
        ...(((ff.data as Array<{ id: string; apelido?: string | null; nome_completo?: string | null }> | null) || [])).map((f) => ({ id: f.id, label: f.apelido || f.nome_completo || "Fornecedor", source: "favorito" as const })),
        ...(((fc.data as Array<{ id: string; nome_fornecedor?: string | null; nome_cidade?: string | null }> | null) || [])).map((f) => ({ id: f.id, label: `${f.nome_fornecedor || "Fornecedor"} (${f.nome_cidade || "Cidade"})`, source: "combustivel" as const })),
      ];
      setFornecedores(forn);
      setAeronaves((aer.data as AeronaveOption[] | null) || []);
      setRecibosExistentes((rec.data as unknown as ReciboOption[] | null) || []);
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !aeronaveId) {
      setClientesDaAeronave([]);
      return;
    }
    (async () => {
      const { data, error } = await (supabase as any)
        .from("cotistas_aeronave")
        .select("id_clientes, socios_id, percentual_sociedade, clientes(razao_social, cnpj), socios(nome)")
        .eq("id_aeronave", aeronaveId);

      if (error) {
        console.warn("Erro ao buscar cotistas_aeronave:", error);
        setClientesDaAeronave([]);
        return;
      }

      const map = new Map<string, ClienteAeronaveOption>();
      for (const row of (data || []) as any[]) {
        const cid = row.id_clientes as string | null;
        if (!cid) continue;
        if (!map.has(cid)) {
          map.set(cid, {
            clienteId: cid,
            razaoSocial: row.clientes?.razao_social || "Cliente",
            cnpj: row.clientes?.cnpj ?? null,
            socios: [],
          });
        }
        if (row.socios_id) {
          map.get(cid)!.socios.push({
            id: row.socios_id,
            nome: row.socios?.nome || "Sócio",
            percentual_participacao: Number(row.percentual_sociedade) || 0,
          });
        }
      }
      setClientesDaAeronave(Array.from(map.values()));
    })();
  }, [open, aeronaveId]);

  useEffect(() => {
    setClienteLinhas([]);
    setClienteId("");
    setSocioId("");
  }, [aeronaveId]);

  const getClienteAeronaveInfo = (cid: string) => clientesDaAeronave.find((c) => c.clienteId === cid);
  const tipoNormalizadoAtual = normalizarTipoDespesa(tipoDespesaLabel || "");
  const isViagemMode = tipoNormalizadoAtual === "DESPESAS_DE_VIAGEM";

  useEffect(() => {
    if (!isViagemMode && aeronaveId && clienteLinhas.length === 0) {
      setClienteLinhas([{ uid: crypto.randomUUID(), clienteId: "", percentualUsoCliente: "100", overridesSocio: {} }]);
    }
  }, [isViagemMode, aeronaveId]);

  useEffect(() => {
    if (!clienteId) { setSocios([]); setSocioId(""); return; }
    const info = getClienteAeronaveInfo(clienteId);
    setSocios(info?.socios || []);
  }, [clienteId, clientesDaAeronave]);

  const clienteSel = useMemo(() => getClienteAeronaveInfo(clienteId), [clienteId, clientesDaAeronave]);
  const socioSel = useMemo(() => socios.find((s) => s.id === socioId), [socios, socioId]);
  const aeronaveSel = useMemo(() => aeronaves.find((a) => a.id === aeronaveId), [aeronaves, aeronaveId]);
  const fornecedorSel = useMemo(() => fornecedores.find((f) => f.id === fornecedorId), [fornecedores, fornecedorId]);
  const travelReportSel = useMemo(() => travelReports.find((r) => r.id === travelReportId), [travelReports, travelReportId]);

  useEffect(() => {
    if (!open || !isViagemMode || !clienteId) { setTravelReports([]); setTravelReportId(""); return; }
    let q: any = (supabase as any)
      .from("travel_expense_reports")
      .select("id, numero_relatorio, data_inicio, data_fim, total_valor, total_trip, total_trip2, total_clientes, nome_tripulante, nome_tripulante_2, tripulacao_id, tripulante_id2, matricula_aeronave, url_pdf, aeronave_id, socios_id, clientes_id, pago_em")
      .eq("clientes_id", clienteId)
      .order("data_inicio", { ascending: false })
      .limit(50);
    if (aeronaveId) q = q.eq("aeronave_id", aeronaveId);
    if (socioId) q = q.eq("socios_id", socioId);
    q.then(({ data }: any) => setTravelReports((data as TravelReportOption[] | null) || []));
  }, [open, isViagemMode, clienteId, aeronaveId, socioId]);

  useEffect(() => {
    if (!travelReportSel) return;
    const total = socioId
      ? Number(travelReportSel.total_valor || 0)
      : Number(travelReportSel.total_valor || (Number(travelReportSel.total_trip || 0) + Number(travelReportSel.total_trip2 || 0) + Number(travelReportSel.total_clientes || 0)));
    setValorTotal(String(total.toFixed(2)));
    setDescricao((prev) => prev || `Relatório de viagem ${travelReportSel.numero_relatorio}`);
  }, [travelReportSel, socioId]);

  const valorNumerico = Number(String(valorTotal).replace(",", ".")) || 0;
  const percNumerico = Number(String(percentualUso).replace(",", ".")) || 0;
  const valorRateado = +(valorNumerico * (percNumerico / 100)).toFixed(2);
  
  const linhasRateioPreview = useMemo(() => montarLinhasRateio({
    valorTotal: valorNumerico,
    percentualUso: percNumerico,
    socios,
    socioSelecionadoId: socioId || null,
  }), [valorNumerico, percNumerico, socios, socioId]);

  const linhasRateioMultiCliente = useMemo(() => {
    if (isViagemMode) return [];
    const linhasInput: ClienteLinhaRateioInput[] = clienteLinhas
      .filter((l) => l.clienteId)
      .map((l) => {
        const info = getClienteAeronaveInfo(l.clienteId);
        const overrides: Record<string, number> = {};
        Object.entries(l.overridesSocio).forEach(([sId, val]) => {
          if (val === "" || val === undefined) return;
          const num = Number(String(val).replace(",", "."));
          if (!Number.isNaN(num)) overrides[sId] = num;
        });
        return {
          clienteId: l.clienteId,
          clienteNome: info?.razaoSocial || "Cliente",
          percentualUsoCliente: Number(String(l.percentualUsoCliente).replace(",", ".")) || 0,
          socios: info?.socios || [],
          overridesSocio: overrides,
        };
      });
    return montarLinhasRateioMultiCliente({ valorTotal: valorNumerico, linhas: linhasInput });
  }, [clienteLinhas, clientesDaAeronave, valorNumerico, isViagemMode]);

  const somaPercentualClientes = clienteLinhas.reduce((sum, l) => sum + (Number(String(l.percentualUsoCliente).replace(",", ".")) || 0), 0);
  const erroSomaClientes = !isViagemMode && clienteLinhas.length > 0
    ? validarSomaPercentualClientes(clienteLinhas.map((l) => ({ percentualUsoCliente: Number(String(l.percentualUsoCliente).replace(",", ".")) || 0 })))
    : null;

  const clienteIdParaDedup = isViagemMode ? clienteId : (clienteLinhas.length === 1 ? clienteLinhas[0].clienteId : "");

  useEffect(() => {
    const verificarDuplicidade = async () => {
      const tipoNormalizado = normalizarTipoDespesa(tipoDespesaLabel || "");
      if (!clienteIdParaDedup || !tipoDespesaLabel || valorNumerico <= 0) {
        setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
        return;
      }
      try {
        if (tipoNormalizado === "COMBUSTIVEIS") {
          const { data, error: fetchError } = await supabase
            .from("abastecimentos")
            .select("id, id_clientes, valor_total, data, nf, comprovante_pagamento, comprovante_url, nota_url, boleto_url, comanda_url")
            .eq("id_clientes", clienteIdParaDedup)
            .order("data", { ascending: false })
            .limit(50);

          if (fetchError) return;
          const match = findExistingFuelReference({ clienteId: clienteIdParaDedup, valor: valorNumerico, data: dataEmissao ? format(dataEmissao, "yyyy-MM-dd") : undefined, numeroNf: "" }, (data || []) as any);
          if (match) {
            setReferenciaDuplicada({ tipo: "abastecimento", id: match.id, mensagem: `✓ Abastecimento encontrado. Data: ${match.data ? format(new Date(match.data), "dd/MM/yyyy") : "—"} | Valor: R$ ${match.valor_total?.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || "0,00"}` });
          } else {
            setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
          }
          return;
        }

        if (tipoNormalizado === "DESPESAS_DE_VIAGEM") {
          const { data, error: fetchError } = await supabase
            .from("travel_expense_reports")
            .select("id, clientes_id, total_valor, despesas, url_pdf, pago_em")
            .eq("clientes_id", clienteIdParaDedup)
            .order("created_at", { ascending: false })
            .limit(50);

          if (fetchError) return;
          const match = findExistingTravelExpenseReference({ clienteId: clienteIdParaDedup, valor: valorNumerico, descricao }, (data || []) as any);
          if (match) {
            setReferenciaDuplicada({ tipo: "travel_expense_report", id: match.id, mensagem: `✓ Relatório de viagem encontrado. Valor: R$ ${match.total_valor?.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || "0,00"}` });
          } else {
            setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
          }
          return;
        }

        const reciboNumero = usarReciboExistente ? recibosExistentes.find((r) => r.id === reciboExistenteId)?.numero_recibo || recibosExistentes.find((r) => r.id === reciboExistenteId)?.numero : null;
        if (reciboNumero) {
          const { data, error: fetchError } = await supabase.from("recibos").select("id, cliente_id, clientes_id, valor_total, numero_recibo, numero").eq("cliente_id", clienteIdParaDedup).or(`numero_recibo.eq.${reciboNumero},numero.eq.${reciboNumero}`).limit(50);
          if (!fetchError) {
            const match = findExistingReceiptReference({ clienteId: clienteIdParaDedup, valor: valorNumerico, numeroRecibo: reciboNumero }, (data || []) as any);
            if (match) {
              setReferenciaDuplicada({ tipo: "recibo", id: match.id, mensagem: `✓ Recibo já cadastrado. Número: ${match.numero_recibo || match.numero || "—"}` });
              return;
            }
          }
        }
        setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
      } catch (error) {
        setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
      }
    };
    const timer = setTimeout(() => { void verificarDuplicidade(); }, 500);
    return () => clearTimeout(timer);
  }, [clienteIdParaDedup, dataEmissao, descricao, tipoDespesaLabel, valorNumerico, reciboExistenteId, usarReciboExistente, recibosExistentes]);

  const resetForm = () => {
    setAeronaveId(""); setReembolsavel(false);
    setTipoDespesa(""); setTipoDespesaLabel(""); setDescricao(""); setValorTotal("");
    setPercentualUso("100"); setPeriodicidade("EVENTUAL"); setTipoRateio("FIXO"); setObservacoes("");
    setFornecedorId(""); setFornecedorNome("");
    setDataEmissao(new Date()); setDataVencimento(new Date()); setAnexos([]);
    setUsarReciboExistente(false); setReciboExistenteId(""); setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
    setTravelReportId(""); setTravelReports([]);
    setClienteLinhas([]); setClienteId(""); setSocioId("");
  };

  const clientesJaUsados = new Set(clienteLinhas.map((l) => l.clienteId).filter(Boolean));
  const addClienteLinha = () => setClienteLinhas((prev) => [...prev, { uid: crypto.randomUUID(), clienteId: "", percentualUsoCliente: "", overridesSocio: {} }]);
  const updateClienteLinha = (uid: string, patch: Partial<ClienteLinhaState>) => setClienteLinhas((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  const removeClienteLinha = (uid: string) => setClienteLinhas((prev) => prev.filter((l) => l.uid !== uid));
  const updateOverrideSocio = (linhaUid: string, socioId: string, valor: string) => setClienteLinhas((prev) => prev.map((l) => (l.uid === linhaUid ? { ...l, overridesSocio: { ...l.overridesSocio, [socioId]: valor } } : l)));

  const addAnexo = () => setAnexos((prev) => [...prev, { id: crypto.randomUUID(), tipo: "nf", numero: "", arquivo: null }]);
  const updateAnexo = (id: string, patch: Partial<AnexoDoc>) => setAnexos((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const removeAnexo = (id: string) => setAnexos((prev) => prev.filter((a) => a.id !== id));
  const moveAnexo = (id: string, dir: -1 | 1) =>
    setAnexos((prev) => {
      const idx = prev.findIndex((a) => a.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = prev.slice();
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
  const previewAnexo = (a: AnexoDoc) => {
    if (a.arquivo) return URL.createObjectURL(a.arquivo);
    return a.url || null;
  };
  const isImage = (a: AnexoDoc) => {
    if (a.arquivo) return a.arquivo.type.startsWith("image/");
    if (a.url) return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(a.url);
    return false;
  };

  const uploadAnexos = async (): Promise<AnexoDoc[]> => {
    const out: AnexoDoc[] = [];
    for (const a of anexos) {
      if (a.arquivo) {
        const path = `solicitacoes/${aeronaveId || "sem-aeronave"}/${Date.now()}-${a.arquivo.name}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, a.arquivo, { upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        out.push({ ...a, url: data.publicUrl, arquivo: null });
      } else {
        out.push(a);
      }
    }
    return out;
  };

  const pickUrl = (list: AnexoDoc[], tipo: AnexoDoc["tipo"]) => list.find((a) => a.tipo === tipo)?.url || null;
  const pickNumero = (list: AnexoDoc[], tipo: AnexoDoc["tipo"]) => list.find((a) => a.tipo === tipo)?.numero || null;

  const notifyAdminsAboutPaymentRequest = async (requestDescription: string, clientLabel: string | null, value: number, userName: string | null) => {
    try {
      const { data: adminRoles } = await supabase.from('user_roles').select('user_id').in('role', ['admin', 'financeiro_master', 'gestor_master']);
      const targetUserIds = [...new Set((adminRoles || []).map((row: any) => row.user_id).filter(Boolean))];
      if (targetUserIds.length === 0) return;
      const notifications = targetUserIds.map((userId: string) => ({
        user_id: userId,
        title: 'Nova solicitação de pagamento',
        message: `${userName || 'Um usuário'} criou uma solicitação de pagamento para ${clientLabel || 'um cliente'} no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}.`,
        type: 'info',
        read: false,
        created_at: new Date().toISOString(),
      }));
      await supabase.from('notifications').insert(notifications);
    } catch (error) { console.warn('Falha na notificação:', error); }
  };

  const resolveCategoriaConta = async (nomeCategoria: string, userId: string | null) => {
    const categoriaLimpa = (nomeCategoria || '').trim();
    if (!categoriaLimpa) return null;
    const { data: expenseConfig } = await supabase.from('expense_configu').select('id, expense_type').ilike('expense_type', categoriaLimpa).limit(1).maybeSingle();
    const nomeParaCategoria = expenseConfig?.expense_type || categoriaLimpa;
    const { data: categoriaExistente } = await supabase.from('categorias_movimentacao').select('id, nome').ilike('nome', nomeParaCategoria).limit(1).maybeSingle();
    if (categoriaExistente?.id) return categoriaExistente.id;
    const fallbackName = nomeParaCategoria.length > 80 ? nomeParaCategoria.slice(0, 80) : nomeParaCategoria;
    try {
      const { data: categoriaCriada } = await supabase.from('categorias_movimentacao').insert({ nome: fallbackName, tipo: 'despesa', grupo_categoria: 'DESPESAS', ativo: true, criado_por: userId } as any).select('id').single();
      return categoriaCriada?.id || null;
    } catch { return null; }
  };

  const criarTipoDespesa = async (label: string) => {
    const supabaseClient = supabase as unknown as SupabaseClientLike;
    const { data, error } = await supabaseClient.from("expense_configu").insert({ expense_type: label }).select("id, expense_type").single();
    if (error) { toast.error("Falha ao criar tipo"); return; }
    setTiposDespesa((prev) => [...prev, data as TipoDespesaOption]);
    setTipoDespesa(data.id);
    setTipoDespesaLabel(data.expense_type);
    toast.success(`Tipo "${label}" adicionado`);
  };

  const validar = (): string | null => {
    if (!aeronaveId) return "Selecione a aeronave";
    if (!descricao.trim()) return "Descreva a despesa";
    if (!tipoDespesaLabel) return "Selecione o tipo de despesa";
    if (valorNumerico <= 0) return "Informe um valor válido";
    if (!dataVencimento) return "Data de vencimento é obrigatória";

    if (isViagemMode) {
      if (!clienteId) return "Selecione o cliente";
    } else {
      if (clienteLinhas.length === 0 || clienteLinhas.some((l) => !l.clienteId)) return "Selecione o(s) cliente(s) desta despesa";
      const idsUnicos = new Set(clienteLinhas.map((l) => l.clienteId));
      if (idsUnicos.size !== clienteLinhas.length) return "Não é possível repetir o mesmo cliente em duas linhas";
      const erroSoma = validarSomaPercentualClientes(clienteLinhas.map((l) => ({ percentualUsoCliente: Number(String(l.percentualUsoCliente).replace(",", ".")) || 0 })));
      if (erroSoma) return erroSoma;
    }
    return null;
  };

  const handleSalvar = async (rascunho: boolean) => {
    const erro = validar();
    if (erro) { toast.error(erro); return; }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const dataVenc = format(dataVencimento!, "yyyy-MM-dd");
      const dataComp = format(dataEmissao || new Date(), "yyyy-MM-dd");
      const statusMov = rascunho ? "rascunho" : "pendente";
      const statusCP = rascunho ? "rascunho" : "pendente";
      const obsFinal = [observacoes, referenciaDuplicada?.mensagem].filter(Boolean).join("\n");

      const referenciaTipo = referenciaDuplicada?.tipo || null;
      const referenciaId = referenciaDuplicada?.id ?? null;
      const fonteDespesa = referenciaTipo || "solicitacao_pagamento";
      
      const reciboSelecionado = usarReciboExistente ? recibosExistentes.find((r) => r.id === reciboExistenteId) || null : null;
      const reciboUrlSelecionado = reciboSelecionado?.pdf_url || reciboSelecionado?.arquivo_url || null;
      const reciboNumeroSelecionado = reciboSelecionado?.numero_recibo || reciboSelecionado?.numero || null;

      const anexosProc = await uploadAnexos();
      let anexosOrigem: Record<string, string | null> = {};
      if (referenciaTipo === "abastecimento" && referenciaId) {
        const { data } = await (supabase as any).from("abastecimentos").select("comprovante_pagamento, comprovante_url, nota_url, boleto_url, comanda_url, nf").eq("id", referenciaId).single();
        anexosOrigem = data || {};
      }
      if (referenciaTipo === "travel_expense_report" && referenciaId) {
        const { data } = await (supabase as any).from("travel_expense_reports").select("id, url_pdf").eq("id", referenciaId).single();
        anexosOrigem = data || {};
      }

      const nfUrl = pickUrl(anexosProc, "nf") || anexosOrigem.nota_url || null;
      const reciboUrl = pickUrl(anexosProc, "recibo") || reciboUrlSelecionado;
      const boletoUrl = pickUrl(anexosProc, "boleto") || anexosOrigem.boleto_url || null;
      const docUrl = pickUrl(anexosProc, "doc") || anexosOrigem.comanda_url || anexosOrigem.url_pdf || null;
      const comprovanteUrl = docUrl || anexosOrigem.comprovante_pagamento || anexosOrigem.comprovante_url || null;
      const nfNum = pickNumero(anexosProc, "nf");
      const reciboNum = pickNumero(anexosProc, "recibo") || reciboNumeroSelecionado;
      const boletoNum = pickNumero(anexosProc, "boleto");
      const docNum = pickNumero(anexosProc, "doc");

      if (!rascunho && referenciaTipo && referenciaId) {
        const { data: existente } = await (supabase as any).from("movimentacoes").select("id").eq("reference_type", referenciaTipo).eq("reference_id", referenciaId).maybeSingle();
        if (existente) { toast.info("Esta solicitação já está vinculada ao lançamento de origem."); return; }
      }

      if (reciboNum) {
        const { data: existente } = await (supabase as any).from("movimentacoes").select("id").eq("numero_recibo", reciboNum).maybeSingle();
        if (existente) { toast.error("Já existe um lançamento associado a este recibo."); return; }
      }

      const categoriaContaId = await resolveCategoriaConta(tipoDespesaLabel || 'Despesa', userId);
      const tipoRateioFinal = normalizarTipoRateio(tipoRateio);
      const supabaseClient = supabase as unknown as SupabaseClientLike;

      if (!categoriaContaId) throw new Error("Não foi possível resolver/criar a categoria da despesa.");

      if (isViagemMode && travelReportSel && !rascunho) {
        // --- Fluxo RV ---
        const travelReportNumeroDoc = travelReportSel.numero_relatorio || docNum;
        const tripValues = [
          { label: "Tripulante 1", valor: Number(travelReportSel.total_trip || 0), nome: travelReportSel.nome_tripulante || null },
          { label: "Tripulante 2", valor: Number(travelReportSel.total_trip2 || 0), nome: travelReportSel.nome_tripulante_2 || null },
        ].filter((entry) => entry.valor > 0);

        if (tripValues.length === 0) throw new Error("Nenhum valor de tripulante foi encontrado.");

        for (const entry of tripValues) {
          const linhasRateioViagem = montarLinhasRateio({ valorTotal: entry.valor, percentualUso: percNumerico, socios, socioSelecionadoId: socioId || null });
          const capId = await insertAndGetId("contas_apagar", {
            data_vencimento: dataVenc, data_agendamento: dataVenc, valor: entry.valor, categoria: "REEMBOLSO TRIPULAÇÃO",
            categoria_id: categoriaContaId || null, descricao: `RV ${travelReportSel.numero_relatorio} — ${entry.nome || entry.label}`,
            status: statusCP, observacoes: `Reembolso ${entry.label.toLowerCase()} do relatório ${travelReportSel.numero_relatorio}`,
            cliente_id: clienteId, socios_cliente_id: socioId || null, fornecedor_favorito_id: fornecedorSel?.source === "favorito" ? fornecedorId : null,
            fornecedor_combustivel_id: fornecedorSel?.source === "combustivel" ? fornecedorId : null, fornecedor_nome: fornecedorNome || null,
            aeronave_registro: aeronaveSel?.matricula || travelReportSel.matricula_aeronave || null, possui_boleto: !!boletoUrl,
            boleto_url: boletoUrl, vencimento_boleto: boletoUrl ? dataVenc : null, possui_nf: !!nfUrl, nf_numero: nfNum,
            nf_url: nfUrl, possui_recibo: !!reciboUrl, numero_recibo: reciboNum, recibo_url: reciboUrl, data_recibo: reciboUrl ? dataComp : null,
            numero_doc: travelReportNumeroDoc, arquivo_pdf_url: travelReportSel.url_pdf || docUrl || null, criado_por: userId,
          });

          let movId: string;
          try {
            movId = await insertAndGetId("movimentacoes", {
              descricao: `RV ${travelReportSel.numero_relatorio} — ${entry.nome || entry.label}`, tipo: "despesa", tipo_caixa: "cliente",
              categoria_id: categoriaContaId, valor: entry.valor, valor_original: Number(travelReportSel.total_valor || valorNumerico),
              data_competencia: dataComp, data_vencimento: dataVenc, status: statusMov, aeronave_id: aeronaveId || null,
              clientes_id: clienteId, socio_id: socioId || null, reembolsavel, fornecedor_nome: fornecedorNome || null,
              numero_nf: nfNum, numero_recibo: reciboNum, numero_boleto: boletoNum, numero_doc: travelReportNumeroDoc,
              nf_url: nfUrl, recibo_url: reciboUrl, boleto_url: boletoUrl, comprovante_url: comprovanteUrl,
              observacoes: obsFinal || null, contas_apagar_id: capId, reference_type: "travel_expense_report", reference_id: travelReportSel.id, criado_por: userId,
            });
          } catch (movErr) {
            await supabase.from("contas_apagar").delete().eq("id", capId);
            throw movErr;
          }

          await supabase.from("contas_apagar").update({ movimentacao_id: movId }).eq("id", capId);

          const rateioPayloadsViagem = linhasRateioViagem.length > 0
            ? linhasRateioViagem.map((linha) => ({
                despesa_id: movId, fonte_despesa: "travel_expense_report", tipo_rateio: tipoRateioFinal, fluxo: "SAÍDA",
                data_vencimento: dataVenc, numero_boleto: boletoNum, numero_nf: nfNum, numero_doc: travelReportNumeroDoc, numero_recibo: reciboNum,
                fornecedor_nome: fornecedorNome || null, cliente_id: clienteId, clientes_nome: clienteSel?.razaoSocial || null, socio_id: linha.socio_id,
                socios_nome: linha.socio_nome, pago_diretamente: false, aeronave_id: aeronaveId || null, aeronave_registro: aeronaveSel?.matricula || travelReportSel.matricula_aeronave || null,
                percentual_sociedade: socios.find((socio) => socio.id === linha.socio_id)?.percentual_participacao ?? 0, percentual_uso: linha.percentual_uso,
                descricao_despesa: `RV ${travelReportSel.numero_relatorio} — ${entry.nome || entry.label}`, categoria_custo: tipoDespesa || null, periodicidade,
                valor_total_despesa: entry.valor, valor_rateado: linha.valor_rateado, status: statusMov, observacoes: obsFinal || null,
                boleto_url: boletoUrl, nf_url: nfUrl, recibo_url: reciboUrl, comprovante_url: comprovanteUrl,
              }))
            : [{
                despesa_id: movId, fonte_despesa: "travel_expense_report", tipo_rateio: tipoRateioFinal, fluxo: "SAÍDA",
                data_vencimento: dataVenc, numero_boleto: boletoNum, numero_nf: nfNum, numero_doc: travelReportNumeroDoc, numero_recibo: reciboNum,
                fornecedor_nome: fornecedorNome || null, cliente_id: clienteId, clientes_nome: clienteSel?.razaoSocial || null, socio_id: socioId || null,
                socios_nome: socioSel?.nome || null, pago_diretamente: false, aeronave_id: aeronaveId || null, aeronave_registro: aeronaveSel?.matricula || travelReportSel.matricula_aeronave || null,
                percentual_sociedade: socioSel?.percentual_participacao ?? 0, percentual_uso: percNumerico,
                descricao_despesa: `RV ${travelReportSel.numero_relatorio} — ${entry.nome || entry.label}`, categoria_custo: tipoDespesa || null, periodicidade,
                valor_total_despesa: entry.valor, valor_rateado: +(entry.valor * (percNumerico / 100)).toFixed(2), status: statusMov, observacoes: obsFinal || null,
                boleto_url: boletoUrl, nf_url: nfUrl, recibo_url: reciboUrl, comprovante_url: comprovanteUrl,
              }];

          await supabaseClient.from("rateio_despesas").insert(rateioPayloadsViagem as any);
        }

        const cliVal = Number(travelReportSel.total_clientes || 0);
        if (!socioId && cliVal > 0) {
          await supabaseClient.from("contas_areceber").insert({
            numero: `RV-${travelReportSel.numero_relatorio}`, cliente_id: clienteId, cliente_nome: clienteSel?.razaoSocial || "",
            cliente_cnpj: clienteSel?.cnpj || null, data_criacao: dataComp, data_vencimento: dataVenc, valor: cliVal,
            categoria: "RELATÓRIO DE VIAGEM", descricao: `Cobrança RV ${travelReportSel.numero_relatorio} — ${travelReportSel.nome_tripulante || ""}`,
            status: "pendente", aeronave: aeronaveSel?.matricula || travelReportSel.matricula_aeronave || null, reference_type: "travel_expense_report", reference_id: travelReportSel.id,
          });
        }
      } else if (!isViagemMode) {
        // --- Fluxo Geral ---
        const capId = await insertAndGetId("contas_apagar", {
          data_vencimento: dataVenc, data_agendamento: dataVenc, valor: valorNumerico, categoria: tipoDespesaLabel || null,
          categoria_id: categoriaContaId || null, descricao, status: statusCP, observacoes: observacoes || null,
          cliente_id: clienteLinhas.length === 1 ? clienteLinhas[0].clienteId : null, fornecedor_favorito_id: fornecedorSel?.source === "favorito" ? fornecedorId : null,
          fornecedor_combustivel_id: fornecedorSel?.source === "combustivel" ? fornecedorId : null, fornecedor_nome: fornecedorNome || null,
          aeronave_registro: aeronaveSel?.matricula || null, possui_boleto: !!boletoUrl, boleto_url: boletoUrl, vencimento_boleto: boletoUrl ? dataVenc : null,
          possui_nf: !!nfUrl, nf_numero: nfNum, nf_url: nfUrl, possui_recibo: !!reciboUrl, numero_recibo: reciboNum, recibo_url: reciboUrl, data_recibo: reciboUrl ? dataComp : null,
          numero_doc: docNum, arquivo_pdf_url: docUrl, criado_por: userId,
        });

        const movimentacaoIdsPorCliente: Record<string, string> = {};
        try {
          for (const linha of clienteLinhas) {
            const info = getClienteAeronaveInfo(linha.clienteId);
            const pctCliente = Number(String(linha.percentualUsoCliente).replace(",", ".")) || 0;
            const valorCliente = +(valorNumerico * (pctCliente / 100)).toFixed(2);

            const movId = await insertAndGetId("movimentacoes", {
              descricao: clienteLinhas.length > 1 ? `${descricao} — ${info?.razaoSocial || "Cliente"}` : descricao, tipo: "despesa", tipo_caixa: "cliente",
              categoria_id: categoriaContaId, valor: valorCliente, valor_original: valorNumerico, data_competencia: dataComp, data_vencimento: dataVenc, status: statusMov,
              aeronave_id: aeronaveId || null, clientes_id: linha.clienteId, reembolsavel, fornecedor_nome: fornecedorNome || null,
              numero_nf: nfNum, numero_recibo: reciboNum, numero_boleto: boletoNum, numero_doc: docNum, nf_url: nfUrl, recibo_url: reciboUrl, boleto_url: boletoUrl, comprovante_url: comprovanteUrl,
              observacoes: obsFinal || null, contas_apagar_id: capId, reference_type: referenciaTipo || "solicitacao_pagamento", reference_id: referenciaTipo && referenciaId ? referenciaId : null, criado_por: userId,
            });
            movimentacaoIdsPorCliente[linha.clienteId] = movId;
          }
        } catch (movErr) {
          await supabase.from("contas_apagar").delete().eq("id", capId);
          for (const movId of Object.values(movimentacaoIdsPorCliente)) await supabase.from("movimentacoes").delete().eq("id", movId);
          throw movErr;
        }

        await supabase.from("contas_apagar").update({ movimentacao_id: Object.values(movimentacaoIdsPorCliente)[0] || null }).eq("id", capId);

        const rateioPayloads = linhasRateioMultiCliente.map((linha) => ({
          despesa_id: movimentacaoIdsPorCliente[linha.cliente_id], fonte_despesa: fonteDespesa, tipo_rateio: tipoRateioFinal, fluxo: "SAÍDA",
          data_vencimento: dataVenc, numero_boleto: boletoNum, numero_nf: nfNum, numero_doc: docNum, numero_recibo: reciboNum, fornecedor_nome: fornecedorNome || null,
          cliente_id: linha.cliente_id, clientes_nome: linha.cliente_nome, socio_id: linha.socio_id, socios_nome: linha.socio_nome, pago_diretamente: false,
          aeronave_id: aeronaveId || null, aeronave_registro: aeronaveSel?.matricula || null, percentual_sociedade: linha.percentual_sociedade_original, percentual_uso: linha.percentual_uso,
          descricao_despesa: descricao, categoria_custo: tipoDespesa || null, periodicidade, valor_total_despesa: valorNumerico, valor_rateado: linha.valor_rateado,
          status: statusMov, observacoes: obsFinal || null, boleto_url: boletoUrl, nf_url: nfUrl, recibo_url: reciboUrl, comprovante_url: comprovanteUrl,
        }));

        await supabaseClient.from("rateio_despesas").insert(rateioPayloads as any);

        if (reembolsavel && !rascunho) {
          for (const linha of clienteLinhas) {
            const info = getClienteAeronaveInfo(linha.clienteId);
            const pctCliente = Number(String(linha.percentualUsoCliente).replace(",", ".")) || 0;
            const valorCliente = +(valorNumerico * (pctCliente / 100)).toFixed(2);
            const movIdCliente = movimentacaoIdsPorCliente[linha.clienteId];

            await supabaseClient.from("contas_areceber").insert({
              numero: `SP-${capId.slice(0, 8)}-${linha.clienteId.slice(0, 4)}`, cliente_id: linha.clienteId, cliente_nome: info?.razaoSocial || "", cliente_cnpj: info?.cnpj || null,
              data_criacao: dataComp, data_vencimento: dataVenc, valor: valorCliente, categoria: "REEMBOLSO", descricao: `Reembolso: ${descricao}`, status: "pendente",
              aeronave: aeronaveSel?.matricula || null, reference_type: "solicitacao_pagamento", reference_id: movIdCliente,
            });
          }
        }
      }

      if (!rascunho) {
        const userName = (await supabase.from('user_profiles').select('full_name').eq('id', userId).maybeSingle()).data?.full_name || null;
        const clientLabel = isViagemMode ? clienteSel?.razaoSocial || null : clienteLinhas.length === 1 ? getClienteAeronaveInfo(clienteLinhas[0].clienteId)?.razaoSocial || null : `${clienteLinhas.length} clientes`;
        await notifyAdminsAboutPaymentRequest(descricao, clientLabel, valorNumerico, userName);
      }

      toast.success(rascunho ? "Rascunho salvo" : "Solicitação de pagamento enviada com sucesso");
      resetForm();
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Send className="h-4 w-4 text-emerald-400" />
            </div>
            Programar Pagamento — Cliente
          </DialogTitle>
          <DialogDescription>
            Crie uma solicitação de pagamento vinculada a uma aeronave e a um ou mais clientes/cotistas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          
          {/* SEÇÃO 1: Classificação Básica da Despesa */}
          <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.01] p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Classificação
              </h3>
              {/* Badge discreto de Reembolsável */}
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full transition-colors hover:bg-emerald-500/20">
                <Switch id="reembolsavel" checked={reembolsavel} onCheckedChange={setReembolsavel} className="scale-75 origin-right" />
                <Label htmlFor="reembolsavel" className="cursor-pointer text-xs font-medium text-emerald-300">Reembolsável</Label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Aeronave *</Label>
                <SearchableCombobox
                  items={aeronaves.map((a) => ({ id: a.id, label: `${a.matricula} — ${a.modelo}` }))}
                  value={aeronaveId} onChange={(id) => setAeronaveId(id)}
                  placeholder="Selecione a aeronave" searchPlaceholder="Buscar aeronave..." emptyMessage="Nenhuma aeronave"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de despesa *</Label>
                <SearchableCombobox
                  items={tiposDespesa.map((t) => ({ id: t.id, label: t.expense_type }))}
                  value={tipoDespesa} onChange={(id, label) => {
                    const existente = tiposDespesa.find((t) => t.id === id);
                    if (existente) { setTipoDespesa(id); setTipoDespesaLabel(existente.expense_type); }
                    else if (label) { if (window.confirm(`Adicionar novo tipo "${label}"?`)) criarTipoDespesa(label); }
                  }}
                  placeholder="Selecione o tipo" allowFreeText
                />
              </div>
            </div>

            {/* Periodicidade e Rateio na mesma linha logo abaixo do Tipo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Periodicidade</Label>
                <Select value={periodicidade} onValueChange={(v) => setPeriodicidade(v as Periodicidade)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MENSAL">MENSAL</SelectItem>
                    <SelectItem value="SEMESTRAL">SEMESTRAL</SelectItem>
                    <SelectItem value="ANUAL">ANUAL</SelectItem>
                    <SelectItem value="EVENTUAL">EVENTUAL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de rateio</Label>
                <Select value={tipoRateio} onValueChange={setTipoRateio}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo de rateio" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXO">FIXO</SelectItem>
                    <SelectItem value="VARIAVEL_POR_VOO">VARIAVEL POR VOO</SelectItem>
                    <SelectItem value="VARIAVEL_POR_HORA">VARIAVEL POR HORA</SelectItem>
                    <SelectItem value="EXTRA">EXTRA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* SEÇÃO 2 (Single-client): Relatórios de Viagem */}
          {isViagemMode && aeronaveId && (
            <section className="space-y-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
              <div className="flex items-center gap-2 border-b border-sky-500/10 pb-3">
                <Plane className="h-4 w-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-sky-300 uppercase tracking-wide">Relatório de Viagem</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Cliente *</Label>
                  <SearchableCombobox items={clientesDaAeronave.map((c) => ({ id: c.clienteId, label: c.razaoSocial }))} value={clienteId} onChange={(id) => { setClienteId(id); setSocioId(""); }} placeholder="Selecione o cliente" emptyMessage="Nenhum cliente" />
                </div>
                {socios.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Sócio (opcional)</Label>
                    <Select value={socioId || "__all__"} onValueChange={(v) => setSocioId(v === "__all__" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Todos os sócios" /></SelectTrigger>
                      <SelectContent><SelectItem value="__all__">— Todos —</SelectItem>{socios.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {clienteId && travelReports.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Selecione o relatório</Label>
                  <Select value={travelReportId} onValueChange={setTravelReportId}>
                    <SelectTrigger><SelectValue placeholder="Escolha um relatório" /></SelectTrigger>
                    <SelectContent>
                      {travelReports.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.numero_relatorio} {r.data_inicio && ` — ${format(new Date(r.data_inicio), "dd/MM/yyyy")}`} {` · R$ ${Number(r.total_valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {travelReportSel && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Valor total da Viagem (R$)</Label>
                    <Input type="text" inputMode="decimal" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>% de uso do Cliente</Label>
                    <Input type="text" inputMode="decimal" value={percentualUso} onChange={(e) => setPercentualUso(e.target.value)} />
                  </div>
                </div>
              )}

              {isViagemMode && socios.length > 0 && linhasRateioPreview.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-wide">Rateio por sócio</Label>
                    <Badge variant="outline" className="border-sky-500/20 bg-sky-500/10 text-sky-300">{linhasRateioPreview.length} linha(s)</Badge>
                  </div>
                  <div className="space-y-2">
                    {linhasRateioPreview.map((linha, index) => (
                      <div key={`rv-${index}`} className="grid grid-cols-1 md:grid-cols-3 gap-2 rounded-md border border-white/5 bg-background/50 p-3 text-sm">
                        <div className="font-medium text-foreground">{linha.socio_nome || "Sócio"}</div>
                        <div className="text-muted-foreground">% de uso: {linha.percentual_uso.toFixed(2)}%</div>
                        <div className="text-sky-300">Valor: {linha.valor_rateado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SEÇÃO 3 (Multi-client): Clientes desta despesa (e Valor Principal) */}
          {!isViagemMode && aeronaveId && (
            <section className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-emerald-500/10 pb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-emerald-300 uppercase tracking-wide">Rateio & Clientes</h3>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Valor Total Movido para dentro da seção de clientes */}
                  <div className="flex items-center gap-3 bg-background/40 px-3 py-2 rounded-lg border border-white/5 shadow-inner">
                    <Label className="whitespace-nowrap font-medium text-emerald-200">Valor Total (R$) *</Label>
                    <Input 
                      type="text" 
                      inputMode="decimal" 
                      className="w-32 h-8 text-sm font-semibold bg-transparent border-emerald-500/30 focus-visible:ring-emerald-500/50 text-right" 
                      value={valorTotal} 
                      onChange={(e) => setValorTotal(e.target.value)} 
                      placeholder="0,00" 
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addClienteLinha} disabled={clientesJaUsados.size >= clientesDaAeronave.length} className="shrink-0">
                    <Plus className="h-4 w-4 mr-1.5" /> Adicionar cliente
                  </Button>
                </div>
              </div>

              {clientesDaAeronave.length === 0 && (
                <p className="text-xs text-amber-400">Nenhum cotista vinculado a esta aeronave.</p>
              )}

              <div className="space-y-3">
                {clienteLinhas.map((linha) => {
                  const info = getClienteAeronaveInfo(linha.clienteId);
                  const itensDisponiveis = clientesDaAeronave.filter((c) => c.clienteId === linha.clienteId || !clientesJaUsados.has(c.clienteId));
                  const pctCliente = Number(String(linha.percentualUsoCliente).replace(",", ".")) || 0;
                  const valorCliente = +(valorNumerico * (pctCliente / 100)).toFixed(2);

                  return (
                    <div key={linha.uid} className="rounded-lg border border-white/10 bg-background/60 p-4 space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                        <div className="lg:col-span-5 space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Cliente / Entidade</Label>
                          <SearchableCombobox items={itensDisponiveis.map((c) => ({ id: c.clienteId, label: c.razaoSocial }))} value={linha.clienteId} onChange={(id) => updateClienteLinha(linha.uid, { clienteId: id, overridesSocio: {} })} placeholder="Selecione..." emptyMessage="Nenhum cliente disponível" />
                        </div>
                        <div className="lg:col-span-3 space-y-1.5">
                          <Label className="text-xs text-muted-foreground">% da Nota</Label>
                          <Input type="text" inputMode="decimal" value={linha.percentualUsoCliente} onChange={(e) => updateClienteLinha(linha.uid, { percentualUsoCliente: e.target.value })} placeholder="100" />
                        </div>
                        <div className="lg:col-span-3 space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Subtotal do Cliente</Label>
                          <Input value={valorCliente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} readOnly className="bg-muted/30 font-medium text-emerald-300" />
                        </div>
                        <div className="lg:col-span-1 flex justify-end">
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeClienteLinha(linha.uid)} disabled={clienteLinhas.length === 1} className="hover:bg-red-500/10">
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </div>

                      {info && info.socios.length > 0 && (
                        <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                          <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Rateio Interno (Por Sócio)</Label>
                            <Badge variant="outline" className="bg-white/5 text-[10px] border-white/10">{info.socios.length} linha(s)</Badge>
                          </div>
                          
                          <div className="grid gap-2">
                            {(() => {
                              const totalPctSocios = info.socios.reduce((s, so) => s + (Number(so.percentual_participacao ?? 0) || 0), 0);
                              return info.socios.map((s) => {
                                const overrideVal = linha.overridesSocio[s.id];
                                const autoPct = totalPctSocios > 0 ? (Number(s.percentual_participacao ?? 0) / totalPctSocios) * 100 : 100 / info.socios.length;
                                const pctEfetivo = overrideVal !== undefined && overrideVal !== "" && !Number.isNaN(Number(overrideVal.replace(",", "."))) ? Number(overrideVal.replace(",", ".")) : autoPct;
                                const valorSocio = +(valorCliente * (pctEfetivo / 100)).toFixed(2);
                                
                                return (
                                  <div key={s.id} className="flex items-center justify-between rounded-md border border-white/5 bg-black/20 p-2 text-sm">
                                    <div className="font-medium text-foreground w-1/3">{s.nome}</div>
                                    <div className="flex items-center gap-2 w-1/3 text-muted-foreground">
                                      <span className="text-xs whitespace-nowrap">% de uso:</span>
                                      <Input type="text" inputMode="decimal" className="h-7 w-20 text-xs text-center" placeholder={`${autoPct.toFixed(2)}`} value={overrideVal ?? ""} onChange={(e) => updateOverrideSocio(linha.uid, s.id, e.target.value)} />
                                      <span className="text-xs opacity-50">({autoPct.toFixed(2)}%)</span>
                                    </div>
                                    <div className="text-emerald-300 font-medium text-right w-1/3">
                                      Valor rateado: {valorSocio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {clienteLinhas.length > 0 && (
                <div className={cn("text-xs rounded-md p-2 border font-medium", erroSomaClientes ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300")}>
                  Soma de clientes: {somaPercentualClientes.toFixed(2)}% {erroSomaClientes ? `— ${erroSomaClientes}` : "— OK"}
                </div>
              )}
            </section>
          )}

          {/* SEÇÃO 4: Dados Adicionais da Fatura */}
          <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.01] p-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b border-white/5 pb-3">Informações da Fatura</h3>

            {!isViagemMode && (
              <div className="space-y-1.5">
                <Label>Fornecedor</Label>
                <SearchableCombobox items={fornecedores} value={fornecedorId} onChange={(id, label) => { setFornecedorId(id); setFornecedorNome(fornecedores.find((f) => f.id === id)?.label || label || ""); }} placeholder="Selecione ou digite" allowFreeText />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Descrição da Despesa *</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} maxLength={500} placeholder="Ex: Manutenção de rotina" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DateField label="Data de emissão (Competência)" value={dataEmissao} onChange={setDataEmissao} />
              <DateField label="Data de vencimento *" value={dataVencimento} onChange={setDataVencimento} />
            </div>

            <div className="space-y-1.5">
              <Label>Observações Adicionais</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} maxLength={1000} />
            </div>
          </section>

          {/* SEÇÃO 5: Alertas de Duplicidade */}
          {referenciaDuplicada?.tipo && (
            <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-start gap-3">
                <Link2 className="mt-0.5 h-5 w-5 text-emerald-400" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-emerald-300">Integração Detectada</p>
                  <p className="text-sm text-emerald-100/80">{referenciaDuplicada.mensagem}</p>
                </div>
              </div>
            </section>
          )}

          {/* SEÇÃO 6: Anexos */}
          <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.01] p-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <FileText className="h-4 w-4" /> Documentos e Anexos
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addAnexo}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar arquivo
              </Button>
            </div>

            <div className="rounded-lg border border-white/5 bg-background/50 p-3 space-y-3">
              <div className="flex items-center gap-3">
                <Switch id="usar-recibo-existente" checked={usarReciboExistente} onCheckedChange={setUsarReciboExistente} />
                <div>
                  <Label htmlFor="usar-recibo-existente" className="cursor-pointer text-sm font-medium">Vincular a um recibo emitido</Label>
                  <p className="text-xs text-muted-foreground">Puxa automaticamente o PDF de um recibo criado pelo sistema.</p>
                </div>
              </div>
              {usarReciboExistente && (
                <Select value={reciboExistenteId} onValueChange={setReciboExistenteId}>
                  <SelectTrigger className="w-full md:w-1/2 mt-2"><SelectValue placeholder="Escolha um recibo existente" /></SelectTrigger>
                  <SelectContent>
                    {recibosExistentes.map((r) => <SelectItem key={r.id} value={r.id}>{r.numero_recibo || r.numero || `Recibo ${r.id.slice(0, 6)}`}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {anexos.length === 0 && (
              <p className="text-xs text-muted-foreground border border-dashed border-white/10 rounded-lg p-6 text-center bg-white/[0.01]">
                Nenhum arquivo anexado.
              </p>
            )}

            <div className="space-y-2">
              {anexos.map((a, idx) => {
                const preview = previewAnexo(a);
                const img = isImage(a);
                return (
                  <div key={a.id} className="rounded-lg border border-white/10 bg-background/40 p-3 space-y-3 transition hover:bg-background/60">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      <div className="md:col-span-1 flex flex-row md:flex-col items-center gap-1 justify-center">
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => moveAnexo(a.id, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={idx === anexos.length - 1} onClick={() => moveAnexo(a.id, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      </div>
                      <Select value={a.tipo} onValueChange={(v) => updateAnexo(a.id, { tipo: v as AnexoDoc["tipo"] })}>
                        <SelectTrigger className="md:col-span-3"><SelectValue /></SelectTrigger>
                        <SelectContent>{TIPOS_ANEXO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input className="md:col-span-3" placeholder="Nº Documento (Opcional)" value={a.numero} onChange={(e) => updateAnexo(a.id, { numero: e.target.value })} />
                      <div className="md:col-span-4">
                        <label className="flex-1 cursor-pointer block">
                          <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => updateAnexo(a.id, { arquivo: e.target.files?.[0] || null })} />
                          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.08] transition">
                            {a.arquivo || a.url ? <FileText className="h-4 w-4 text-emerald-400" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                            <span className="truncate flex-1">{a.arquivo?.name || a.url || "Procurar arquivo..."}</span>
                          </div>
                        </label>
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeAnexo(a.id)} className="hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                    {preview && (
                      <div className="flex items-center gap-3 md:pl-10">
                        {img ? <img src={preview} alt="preview" className="h-12 w-12 rounded object-cover border border-white/10" /> : <div className="h-12 w-12 rounded border border-white/10 bg-white/[0.03] flex items-center justify-center"><FileText className="h-5 w-5 text-muted-foreground" /></div>}
                        <a href={preview} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors">
                          <Eye className="h-3.5 w-3.5" /> Visualizar anexo
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <DialogFooter className="gap-3 pt-4 border-t border-white/10 mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button variant="outline" onClick={() => handleSalvar(true)} disabled={saving} className="border-white/20">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Salvar Rascunho
          </Button>
          <Button onClick={() => handleSalvar(false)} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Solicitar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DateField({ label, value, onChange }: { label: string; value?: Date; onChange: (d?: Date) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[9999]" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className={cn("p-3 pointer-events-auto")} />
        </PopoverContent>
      </Popover>
    </div>
  );
}