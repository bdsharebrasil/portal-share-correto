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
  consolidarSociosParaAnexo,
  findExistingFuelReference,
  findExistingReceiptReference,
  findExistingTravelExpenseReference,
  filtrarSociosParaRateio,
  montarLinhasRateio,
  montarLinhasRateioMultiCliente,
  normalizarTipoDespesa,
  normalizarTipoRateio,
  resolverClienteParaRateio,
  resolverFornecedorSolicitacao,
  resolverPagoPorSolicitacao,
  resolverSubcategoriaSelecionadaParaPayload,
  validarSomaPercentualClientes,
  ClienteLinhaRateioInput,
} from "@/components/dashboard/financeiro/solicitacaoPagamentoValidators";

interface SolicitacaoPagamentoModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialData?: any;
}

type Periodicidade = "MENSAL" | "SEMESTRAL" | "ANUAL" | "EVENTUAL";

type TaxaOrigem = "INFRAERO" | "DECEA" | null;

interface TaxaReciboOption {
  boleto_url: string | null;
  nf_url: string | null;
  id: string;
  numero_recibo: string | null;
  numero_documento: string | null;
  valor_total: number | null;
  percentual: number | null;
  nome_categoria: string | null;
  aeronave_id: string | null;
  pdf_url: string | null;
  url_boleto: string | null;
  url_nf: string | null;
  data_emissao: string | null;
  status: string | null;
}

interface AbastecimentoLookup {
  id: string;
  comanda: string | null;
  nf: string | null;
  data: string | null;
  valor_total: number | null;
  litros: number | null;
  local: string | null;
  status_pagamento: string | null;
  comprovante_pagamento: string | null;
  boleto_url: string | null;
  nota_url: string | null;
  comprovante_url: string | null;
  comanda_url?: string | null;
  data_vencimento_boleto?: string | null;
  abastecedor?: string | null;
  abastecedor_id?: string | null;
  data_pagamento?: string | null;
}

interface AnexoDoc {
  id: string;
  tipo: "nf" | "recibo" | "boleto" | "doc" | "demonstrativo";
  numero: string;
  arquivo?: File | null;
  url?: string | null;
  socioId?: string | null;
}

const TIPOS_ANEXO: { value: AnexoDoc["tipo"]; label: string }[] = [
  { value: "nf", label: "Nota Fiscal" },
  { value: "recibo", label: "Recibo" },
  { value: "boleto", label: "Boleto" },
  { value: "demonstrativo", label: "Demonstrativo" },
  { value: "doc", label: "Documento" },
];

const BUCKET = "n.f-boletos-clients";

// Tipos de combustível suportados pelo abastecimento — mantidos como lista fechada
// para evitar variações de digitação ("JET-A1", "Jet A1", "jet a-1"...) chegando ao banco.
const TIPOS_COMBUSTIVEL = ["AVGAS", "JET A-1"] as const;

type SocioOption = { id: string; nome: string; percentual_participacao?: number | null };
type TipoDespesaOption = { id: string; expense_type: string; subcategoria_1?: string | null; subcategoria_2?: string | null };
type FornecedorOption = { id: string; label: string; source: "favorito" | "combustivel" };
type AeronaveOption = { id: string; matricula: string; modelo: string };
type ReciboOption = { id: string; numero_recibo?: string | null; numero?: string | null; numero_documento?: string | null; pdf_url?: string | null; arquivo_url?: string | null; valor_total?: number | null; created_at?: string | null; criado_em?: string | null; cliente_id?: string | null; clientes_id?: string | null; aeronave_id?: string | null; data_emissao?: string | null };
type TravelReportOption = {
  id: string; numero_relatorio: string;
  data_inicio?: string | null; data_fim?: string | null;
  total_valor?: number | null; total_trip?: number | null; total_trip2?: number | null; total_clientes?: number | null; total_tripulacao?: number | null; total_sharebrasil?: number | null;
  nome_tripulante?: string | null; nome_tripulante_2?: string | null;
  tripulacao_id?: string | null; tripulante_id2?: string | null;
  matricula_aeronave?: string | null; pdf_url?: string | null;
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
  valorClienteOverride?: string;
  overridesSocio: Record<string, string>;
  valorOverridesSocio: Record<string, string>;
  // Dados de recibo de taxa (preenchidos automaticamente)
  numeroDocumentoRecibo?: string | null;
  urlBoleto?: string | null;
  urlDemonstrativo?: string | null;
  urlPdfRecibo?: string | null;
  numeroReciboRecibo?: string | null;
  valorReciboCliente?: number | null;
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

export function SolicitacaoPagamentoModal({ open, onOpenChange, initialData }: SolicitacaoPagamentoModalProps) {
  // === ESTADO DO WIZARD ===
  const [etapaAtual, setEtapaAtual] = useState(1);

  const [tiposDespesa, setTiposDespesa] = useState<TipoDespesaOption[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorOption[]>([]);
  const [aeronaves, setAeronaves] = useState<AeronaveOption[]>([]);
  const [recibosExistentes, setRecibosExistentes] = useState<ReciboOption[]>([]);
  const [clientesDaAeronave, setClientesDaAeronave] = useState<ClienteAeronaveOption[]>([]);

  const [aeronaveId, setAeronaveId] = useState("");
  const [reembolsavel, setReembolsavel] = useState(false);
  const [tipoDespesa, setTipoDespesa] = useState("");
  const [tipoDespesaLabel, setTipoDespesaLabel] = useState("");
  const [tipoDespesaBase, setTipoDespesaBase] = useState("");
  const [subcategoriaSel, setSubcategoriaSel] = useState<string>("");
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
  const [reciboExistentePorCliente, setReciboExistentePorCliente] = useState<Record<string, string>>({});
  const [referenciaDuplicada, setReferenciaDuplicada] = useState<{ tipo: "abastecimento" | "travel_expense_report" | "recibo" | null; id: string | null; mensagem: string | null }>({ tipo: null, id: null, mensagem: null });

  const [clienteLinhas, setClienteLinhas] = useState<ClienteLinhaState[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [socioId, setSocioId] = useState("");
  const [sociosExcluidos, setSociosExcluidos] = useState<string[]>([]);
  const [socios, setSocios] = useState<SocioOption[]>([]);
  const [percentualUso, setPercentualUso] = useState("100");
  const [travelReports, setTravelReports] = useState<TravelReportOption[]>([]);
  const [travelReportId, setTravelReportId] = useState("");
  const [referenciaNumero, setReferenciaNumero] = useState("");
  const [saving, setSaving] = useState(false);

  // Combustível
  const [fuelComanda, setFuelComanda] = useState("");
  const [fuelNf, setFuelNf] = useState("");
  const [fuelLookupLoading, setFuelLookupLoading] = useState(false);
  const [fuelLookupResult, setFuelLookupResult] = useState<AbastecimentoLookup | null>(null);
  const [fuelLookupSearched, setFuelLookupSearched] = useState(false);

  // Novo Abastecimento (criação inline quando não encontrado)
  const [novoAbastOpen, setNovoAbastOpen] = useState(false);
  const [novoAbastSaving, setNovoAbastSaving] = useState(false);
  const [novoAbast, setNovoAbast] = useState({
    data: format(new Date(), "yyyy-MM-dd"),
    data_vencimento_boleto: "",
    local: "",
    trecho: "",
    litros: "",
    valor_unitario: "",
    abastecedor_id: "",
    tipo_combustivel: "",
    observacao: "",
  });
  const [novoAbastComandaFile, setNovoAbastComandaFile] = useState<File | null>(null);
  const [novoAbastNotaFile, setNovoAbastNotaFile] = useState<File | null>(null);
  const [novoAbastBoletoFile, setNovoAbastBoletoFile] = useState<File | null>(null);

  // Valor total do novo abastecimento é sempre derivado de litros × valor unitário.
  // Nunca é enviado ao banco — "valor_total" é coluna GENERATED ALWAYS AS (litros * valor_unitario) STORED.
  const novoAbastLitrosNum = Number(String(novoAbast.litros).replace(",", ".")) || 0;
  const novoAbastValorUnitarioNum = Number(String(novoAbast.valor_unitario).replace(",", ".")) || 0;
  const novoAbastValorTotalCalculado = +(novoAbastLitrosNum * novoAbastValorUnitarioNum).toFixed(2);

  // Taxas Aeroportuárias
  const [taxaOrigem, setTaxaOrigem] = useState<TaxaOrigem>(null);
  const [taxaRecibos, setTaxaRecibos] = useState<TaxaReciboOption[]>([]);
  const [taxaReciboId, setTaxaReciboId] = useState("");
  const [taxaReciboPorCliente, setTaxaReciboPorCliente] = useState<Record<string, string>>({});
  const [taxaRecibosMultiplos, setTaxaRecibosMultiplos] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [tip, ff, fc, aer, rec] = await Promise.all([
        supabase.from("expense_configu").select("id, expense_type, subcategoria_1, subcategoria_2").order("expense_type"),
        supabase.from("fornecedores_favoritos").select("id, nome_completo, apelido").order("nome_completo"),
        supabase.from("fornecedores_combustivel").select("id, nome_fornecedor, nome_cidade").order("nome_fornecedor"),
        supabase.from("aeronave").select("id, matricula, modelo").order("matricula"),
        supabase.from("recibos").select("id, numero_recibo, numero_documento, pdf_url, valor_total, criado_em, cliente_id, aeronave_id, data_emissao").order("criado_em", { ascending: false }),
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

  // Prefill fields when opened with initialData
  useEffect(() => {
    if (!open || !initialData) return;
    try {
      if (initialData.data_emissao) setDataEmissao(new Date(initialData.data_emissao));
      if (initialData.data_vencimento) setDataVencimento(new Date(initialData.data_vencimento));
      if (initialData.descricao_despesa) setDescricao(initialData.descricao_despesa);
      if (initialData.descricao) setDescricao(initialData.descricao);
      if (initialData.valor_total) setValorTotal(String(initialData.valor_total));
      if (initialData.valor) setValorTotal(String(initialData.valor));
      if (initialData.cliente_id) setClienteId(initialData.cliente_id);
      if (initialData.clientes_nome) setFornecedorNome(initialData.clientes_nome);
      if (initialData.socio_id) setSocioId(initialData.socio_id);
      if (initialData.aeronave_id) setAeronaveId(initialData.aeronave_id);
      if (initialData.numero_recibo) setReferenciaNumero(initialData.numero_recibo);
      if (initialData.numero_doc) setReferenciaNumero(initialData.numero_doc);
      if (initialData.periodicidade) setPeriodicidade(initialData.periodicidade as Periodicidade);
      if (initialData.tipo_rateio) setTipoRateio(initialData.tipo_rateio);
      if (initialData.percentual_uso != null) setPercentualUso(String(initialData.percentual_uso));

      // rateio_cliente prefill (linhas editáveis)
      if (Array.isArray(initialData.rateio_cliente) && initialData.rateio_cliente.length) {
        const linhas: ClienteLinhaState[] = initialData.rateio_cliente.map((rc: any) => ({
          uid: crypto.randomUUID(),
          clienteId: rc.cliente_id || "",
          percentualUsoCliente: rc.percentual_uso != null ? String(rc.percentual_uso) : "",
          valorClienteOverride: rc.valor_total_cliente != null ? String(rc.valor_total_cliente) : undefined,
          overridesSocio: rc.overridesSocio || {},
          valorOverridesSocio:
            rc.valorOverridesSocio ||
            (rc.socio_id && rc.valor_rateado != null
              ? { [rc.socio_id]: String(rc.valor_rateado) }
              : {}),
          numeroDocumentoRecibo: initialData.numero_recibo || initialData.numero_doc || undefined,
          urlBoleto: initialData.boleto_url || undefined,
          urlDemonstrativo: initialData.demonstrativo_url || undefined,
        }));
        setClienteLinhas(linhas);
      }

      // anexos
      if (Array.isArray(initialData.anexos) && initialData.anexos.length) {
        const mapped = initialData.anexos.map((a: any, idx: number) => ({
          id: `prefill-${idx}`,
          tipo: a.tipo || (a.url && a.url.includes("boleto") ? "boleto" : "doc"),
          numero: a.numero || initialData.numero_recibo || initialData.numero_doc || "",
          arquivo: null,
          url: a.url || a.url_boleto || a.url_nf || a.url_pdf || null,
          socioId: a.socioId || null,
        }));
        setAnexos(mapped as AnexoDoc[]);
      } else {
        const possible = [] as AnexoDoc[];
        if (initialData.boleto_url) possible.push({ id: "prefill-boleto", tipo: "boleto", numero: "", arquivo: null, url: initialData.boleto_url, socioId: null });
        if (initialData.nf_url) possible.push({ id: "prefill-nf", tipo: "nf", numero: "", arquivo: null, url: initialData.nf_url, socioId: null });
        if (initialData.demonstrativo_url) possible.push({ id: "prefill-dem", tipo: "demonstrativo", numero: initialData.numero_doc || "", arquivo: null, url: initialData.demonstrativo_url, socioId: null });
        if (initialData.pdf_url || initialData.recibo_url) possible.push({ id: "prefill-recibo", tipo: "recibo", numero: initialData.numero_recibo || "", arquivo: null, url: initialData.pdf_url || initialData.recibo_url, socioId: null });
        if (possible.length) setAnexos(possible);
      }

      // taxa origem + competencia
      if (initialData.taxa_origem === "INFRAERO" || initialData.taxa_origem === "DECEA") {
        setTaxaOrigem(initialData.taxa_origem);
      }
      if (initialData.competencia_infraero) {
        setTaxaOrigem((prev) => prev || "INFRAERO");
        setDescricao((prev) => prev || `Competência ${initialData.competencia_infraero}`);
      }
      if (initialData.competencia_decea) {
        setTaxaOrigem((prev) => prev || "DECEA");
        setDescricao((prev) => prev || `Competência ${initialData.competencia_decea}`);
      }
    } catch (e) {
      console.warn("Erro ao pré-preencher SolicitacaoPagamentoModal:", e);
    }
  }, [open, initialData]);

  // Prefill do tipo de despesa/subcategoria — depende de tiposDespesa já carregado
  useEffect(() => {
    if (!open || !initialData || tiposDespesa.length === 0) return;
    const label: string | undefined =
      initialData.tipo_despesa_label || initialData.nome_categoria || undefined;
    if (label && !tipoDespesa) {
      const norm = String(label).toUpperCase();
      const match =
        tiposDespesa.find((t) => (t.expense_type || "").toUpperCase() === norm) ||
        tiposDespesa.find((t) => (t.expense_type || "").toUpperCase().includes(norm)) ||
        tiposDespesa.find((t) => norm.includes((t.expense_type || "").toUpperCase()));
      if (match) {
        setTipoDespesa(match.id);
        setTipoDespesaBase(match.expense_type);
        setTipoDespesaLabel(match.expense_type);
      }
    }
    if (initialData.subcategoria && !subcategoriaSel) {
      setSubcategoriaSel(String(initialData.subcategoria));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData, tiposDespesa]);

  useEffect(() => {
    setClienteLinhas([]);
    setClienteId("");
    setSocioId("");
    setSociosExcluidos([]);
  }, [aeronaveId]);

  useEffect(() => {
    if (!socioId || clienteId || !clientesDaAeronave.length) return;

    const clienteInferido = resolverClienteParaRateio({ clienteId, socioId, clientesDaAeronave });
    if (clienteInferido) {
      setClienteId(clienteInferido);
    }
  }, [clienteId, socioId, clientesDaAeronave]);

  const getClienteAeronaveInfo = (cid: string) => clientesDaAeronave.find((c) => c.clienteId === cid);
  const getSociosVisiveisParaCliente = (info?: ClienteAeronaveOption | null) => {
    const base = socioId ? (info?.socios || []).filter((s) => s.id === socioId) : (info?.socios || []);
    return base.filter((s) => !sociosExcluidos.includes(s.id));
  };
  const tipoNormalizadoAtual = normalizarTipoDespesa(tipoDespesaBase || tipoDespesaLabel || "");
  const subcategoriaNormalizadaAtual = normalizarSubcategoriaDespesa(subcategoriaSel || "");
  const isViagemMode = tipoNormalizadoAtual === "DESPESAS_DE_VIAGEM";
  const isCombustivelMode = tipoNormalizadoAtual === "COMBUSTIVEIS";
  const isTaxasMode = /TAXAS?\s*AEROPORT/i.test(tipoDespesaBase || tipoDespesaLabel || "");
  const isSeguroMode = /SEGURO/i.test(tipoDespesaBase || tipoDespesaLabel || "");
  const isFistelMode = /FISTEL/i.test(tipoDespesaBase || tipoDespesaLabel || "");
  const isReciboFirstMode = isTaxasMode || isSeguroMode || isFistelMode;
  const isRelatorioViagemMode = isViagemMode && subcategoriaNormalizadaAtual === "RELATORIO_DE_VIAGEM";
  const isReciboViagemMode = isViagemMode && subcategoriaNormalizadaAtual === "RECIBO_DE_VIAGEM";

  const tipoDespesaSel = useMemo(() => tiposDespesa.find((t) => t.id === tipoDespesa), [tiposDespesa, tipoDespesa]);
  const subcategoriasDisponiveis = useMemo(() => {
    const arr: string[] = [];
    if (tipoDespesaSel?.subcategoria_1) arr.push(tipoDespesaSel.subcategoria_1);
    if (tipoDespesaSel?.subcategoria_2) arr.push(tipoDespesaSel.subcategoria_2);
    return arr;
  }, [tipoDespesaSel]);
  const isSubcat1Sel = !!(tipoDespesaSel?.subcategoria_1 && subcategoriaSel && subcategoriaSel === tipoDespesaSel.subcategoria_1);
  const isSubcat2Sel = !!(tipoDespesaSel?.subcategoria_2 && subcategoriaSel && subcategoriaSel === tipoDespesaSel.subcategoria_2);
  const subcategoriaSelecionadaParaPayload = useMemo(() => resolverSubcategoriaSelecionadaParaPayload({
    subcategoriaSelecionada: subcategoriaSel || null,
    subcategoria1: tipoDespesaSel?.subcategoria_1 || null,
    subcategoria2: tipoDespesaSel?.subcategoria_2 || null,
  }), [subcategoriaSel, tipoDespesaSel?.subcategoria_1, tipoDespesaSel?.subcategoria_2]);

  useEffect(() => {
    if (!open || !isReciboFirstMode || !aeronaveId) {
      setTaxaRecibos([]);
      setTaxaReciboId("");
      return;
    }
    // Para TAXAS AEROPORT precisa da origem (INFRAERO/DECEA); para SEGUROS/FISTEL filtra pelo próprio tipo de despesa
    const filtroCategoria = isTaxasMode
      ? (taxaOrigem || "")
      : (tipoDespesaBase || tipoDespesaLabel || "");
    if (isTaxasMode && !taxaOrigem) {
      setTaxaRecibos([]);
      setTaxaReciboId("");
      return;
    }
    (async () => {
      const { data, error } = await (supabase as any)
        .from("recibos")
        .select("id, numero_recibo, numero_documento, valor_total, percentual, nome_categoria, aeronave_id, pdf_url, boleto_url, demonstrativo_url, data_emissao, status")
        .eq("aeronave_id", aeronaveId)
        .ilike("nome_categoria", `%${filtroCategoria}%`)
        .order("data_emissao", { ascending: false })
        .limit(50);
      if (error) {
        setTaxaRecibos([]);
        return;
      }
      // normaliza para o shape esperado (url_boleto/url_nf legado)
      const rows = ((data || []) as any[]).map((r) => ({
        ...r,
        url_boleto: r.boleto_url ?? r.url_boleto ?? null,
        url_nf: r.demonstrativo_url ?? r.url_nf ?? null,
      }));
      setTaxaRecibos(rows as TaxaReciboOption[]);
    })();
  }, [open, isReciboFirstMode, isTaxasMode, taxaOrigem, aeronaveId, tipoDespesaBase, tipoDespesaLabel]);

  useEffect(() => {
    if (!taxaReciboId) return;
    const r = taxaRecibos.find((t) => t.id === taxaReciboId);
    if (!r) return;
    if (r.valor_total) setValorTotal(String(Number(r.valor_total / 100).toFixed(2)));
    setDescricao((prev) => prev || `${r.nome_categoria || "Taxa"} - Recibo ${r.numero_recibo || r.numero_documento || ""}`);
  }, [taxaReciboId, taxaRecibos]);

  // Preencher automaticamente dados de taxa nas linhas de rateio quando for modo de taxas
  useEffect(() => {
    if (!isReciboFirstMode || clienteLinhas.length === 0) return;

    setClienteLinhas((prevLinhas) =>
      prevLinhas.map((linha) => {
        const reciboId =
          clienteId === "__all__"
            ? taxaReciboPorCliente[linha.clienteId]
            : taxaReciboId;

        if (!reciboId) return linha;

        const recibo = taxaRecibos.find((r) => r.id === reciboId);
        if (!recibo) return linha;

        // Preencher automaticamente os dados do recibo
        const valorReciboEmReais = Number(recibo.valor_total || 0) / 100;
        const pctRecibo = Number(recibo.percentual ?? 0);
        return {
          ...linha,
          numeroDocumentoRecibo: recibo.numero_documento || undefined,
          numeroReciboRecibo: recibo.numero_recibo || undefined,
          urlBoleto: recibo.url_boleto || undefined,
          urlDemonstrativo: recibo.url_nf || undefined,
          urlPdfRecibo: recibo.pdf_url || undefined,
          valorReciboCliente: valorReciboEmReais || undefined,
          // Se o recibo trouxer percentual, usa como % do cliente; caso contrário mantém o valor atual
          percentualUsoCliente: pctRecibo > 0 ? pctRecibo.toFixed(2) : linha.percentualUsoCliente,
        };
      })
    );
  }, [isReciboFirstMode, taxaReciboId, taxaReciboPorCliente, taxaRecibos, clienteLinhas.length, clienteId]);

  // Quando um recibo único é escolhido (cliente específico) atualiza automaticamente o Valor Total da despesa
  useEffect(() => {
    if (!isReciboFirstMode || !taxaReciboId) return;
    const r = taxaRecibos.find((x) => x.id === taxaReciboId);
    if (r && r.valor_total) {
      setValorTotal(String((Number(r.valor_total) / 100).toFixed(2)));
    }
  }, [isReciboFirstMode, taxaReciboId, taxaRecibos]);

  const buscarAbastecimento = async () => {
    if (!fuelComanda && !fuelNf) {
      toast.error("Informe a comanda ou o número da NF para buscar");
      return;
    }
    setFuelLookupLoading(true);
    setFuelLookupSearched(true);
    try {
      let q: any = (supabase as any)
        .from("abastecimentos")
        .select("id, comanda, nf, data, valor_total, litros, local, status_pagamento, comprovante_pagamento, boleto_url, nota_url, comprovante_url, comanda_url, data_vencimento_boleto, abastecedor, abastecedor_id, data_pagamento")
        .order("data", { ascending: false })
        .limit(1);
      if (aeronaveId) q = q.eq("aeronave_id", aeronaveId);
      if (fuelComanda) q = q.eq("comanda", fuelComanda);
      if (fuelNf) q = q.eq("nf", fuelNf);
      const { data } = await q;
      const found = (data && data[0]) as AbastecimentoLookup | undefined;
      if (found) {
        setFuelLookupResult(found);
        if (found.valor_total) setValorTotal(String(Number(found.valor_total / 100).toFixed(2)));
        setReferenciaDuplicada({
          tipo: "abastecimento",
          id: found.id,
          mensagem: `✓ Abastecimento encontrado (Comanda ${found.comanda || "—"} / NF ${found.nf || "—"})`,
        });
        toast.success("Abastecimento localizado");
      } else {
        setFuelLookupResult(null);
        setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
        toast.info("Nenhum abastecimento encontrado — preencha os demais campos para criar um novo.");
      }
    } finally {
      setFuelLookupLoading(false);
    }
  };

  // Autofill dos campos "Informações da Fatura" a partir do abastecimento vinculado
  useEffect(() => {
    if (!isCombustivelMode || !fuelLookupResult) return;
    if (fuelLookupResult.data) {
      const d = new Date(fuelLookupResult.data + "T00:00:00");
      if (!isNaN(d.getTime())) setDataEmissao(d);
    }
    if (fuelLookupResult.data_vencimento_boleto) {
      const dv = new Date(fuelLookupResult.data_vencimento_boleto + "T00:00:00");
      if (!isNaN(dv.getTime())) setDataVencimento(dv);
    } else if (fuelLookupResult.data) {
      const d = new Date(fuelLookupResult.data + "T00:00:00");
      if (!isNaN(d.getTime())) setDataVencimento(d);
    }
    if (fuelLookupResult.abastecedor_id) {
      const forn = fornecedores.find((f) => f.id === fuelLookupResult.abastecedor_id && f.source === "combustivel");
      if (forn) {
        setFornecedorId(forn.id);
        setFornecedorNome(forn.label);
        return;
      }
    }
    if (fuelLookupResult.abastecedor) {
      setFornecedorNome(fuelLookupResult.abastecedor);
    }
  }, [fuelLookupResult, isCombustivelMode, fornecedores]);

  const resetNovoAbast = () => {
    setNovoAbast({
      data: format(new Date(), "yyyy-MM-dd"),
      data_vencimento_boleto: "",
      local: "",
      trecho: "",
      litros: "",
      valor_unitario: "",
      abastecedor_id: "",
      tipo_combustivel: "",
      observacao: "",
    });
    setNovoAbastComandaFile(null);
    setNovoAbastNotaFile(null);
    setNovoAbastBoletoFile(null);
  };

  const uploadAbastFile = async (file: File | null, folder: string): Promise<string | null> => {
    if (!file) return null;
    const path = `abastecimentos/${aeronaveId || "sem-aeronave"}/${folder}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const criarNovoAbastecimento = async () => {
    if (!aeronaveId) {
      toast.error("Selecione a aeronave antes de criar o abastecimento.");
      return;
    }
    const litrosNum = Number(String(novoAbast.litros).replace(",", ".")) || 0;
    const vuNum = Number(String(novoAbast.valor_unitario).replace(",", ".")) || 0;
    const valorTotalNum = +(litrosNum * vuNum).toFixed(2);
    if (!valorTotalNum) {
      toast.error("Informe litros e valor unitário para calcular o valor total.");
      return;
    }
    setNovoAbastSaving(true);
    try {
      const [comandaUrl, notaUrl, boletoUrl] = await Promise.all([
        uploadAbastFile(novoAbastComandaFile, "comanda"),
        uploadAbastFile(novoAbastNotaFile, "nota"),
        uploadAbastFile(novoAbastBoletoFile, "boleto"),
      ]);
      const supplier = fornecedores.find((f) => f.id === novoAbast.abastecedor_id && f.source === "combustivel");
      const payload: Record<string, unknown> = {
        aeronave_id: aeronaveId,
        id_clientes: clienteId && clienteId !== "__all__" ? clienteId : null,
        data: novoAbast.data,
        data_vencimento_boleto: novoAbast.data_vencimento_boleto || null,
        local: novoAbast.local || null,
        trecho: novoAbast.trecho || "",
        litros: litrosNum || null,
        valor_unitario: vuNum || null,
        // valor_total NÃO entra aqui: é coluna GENERATED ALWAYS AS (litros * valor_unitario) STORED no banco.
        // Enviar qualquer valor para ela dispara o erro 428C9 (cannot insert a non-DEFAULT value).
        comanda: fuelComanda || null,
        nf: fuelNf || null,
        abastecedor_id: novoAbast.abastecedor_id || null,
        abastecedor: supplier?.label || null,
        tipo_combustivel: novoAbast.tipo_combustivel || null,
        observacao: novoAbast.observacao || null,
        comanda_url: comandaUrl,
        nota_url: notaUrl,
        boleto_url: boletoUrl,
        status_pagamento: "em aberto",
      };
      const { data, error } = await (supabase as any)
        .from("abastecimentos")
        .insert(payload)
        .select("id, comanda, nf, data, valor_total, litros, local, status_pagamento, comprovante_pagamento, boleto_url, nota_url, comprovante_url, comanda_url, data_vencimento_boleto, abastecedor, abastecedor_id, data_pagamento")
        .single();
      if (error) throw error;
      const inserted = data as AbastecimentoLookup;
      setFuelLookupResult(inserted);
      setFuelLookupSearched(true);
      setReferenciaDuplicada({
        tipo: "abastecimento",
        id: inserted.id,
        mensagem: `✓ Novo abastecimento criado (Comanda ${inserted.comanda || "—"} / NF ${inserted.nf || "—"})`,
      });
      // O valor exibido no restante do wizard usa o total calculado localmente (idêntico ao
      // gerado pelo banco, já que ambos partem de litros × valor_unitario).
      setValorTotal(valorTotalNum.toFixed(2));
      toast.success("Abastecimento criado e vinculado.");
      setNovoAbastOpen(false);
      resetNovoAbast();
    } catch (err: any) {
      toast.error("Erro ao criar abastecimento: " + (err?.message || "desconhecido"));
    } finally {
      setNovoAbastSaving(false);
    }
  };

  const buildAllClientesLines = (clientes: ClienteAeronaveOption[]): ClienteLinhaState[] => {
    if (!clientes.length) return [];

    const basePercent = Number((100 / clientes.length).toFixed(2));
    const linhas = clientes.map((cliente) => ({
      uid: crypto.randomUUID(),
      clienteId: cliente.clienteId,
      percentualUsoCliente: basePercent.toFixed(2),
      overridesSocio: {},
      valorOverridesSocio: {},
      numeroDocumentoRecibo: undefined,
      urlBoleto: undefined,
      urlDemonstrativo: undefined,
    }));

    const total = linhas.reduce((sum, linha) => sum + Number(String(linha.percentualUsoCliente).replace(",", ".")), 0);
    const remainder = +(100 - total).toFixed(2);
    if (remainder !== 0) {
      linhas[0].percentualUsoCliente = (Number(String(linhas[0].percentualUsoCliente).replace(",", ".")) + remainder).toFixed(2);
    }

    return linhas;
  };

  useEffect(() => {
    if (isViagemMode || !aeronaveId || !clienteId) return;

    if (clienteId === "__all__") {
      setClienteLinhas(buildAllClientesLines(clientesDaAeronave));
      return;
    }

    // Overrides de sócio começam VAZIOS de propósito: a UI calcula o % proporcional
    // à participação societária (percentual_participacao) de cada sócio visível
    // automaticamente (ver bloco "Rateio Interno (Por Sócio)" abaixo), garantindo que
    // a soma sempre feche em 100% — inclusive depois de excluir algum sócio do rateio.
    setClienteLinhas([{
      uid: crypto.randomUUID(),
      clienteId,
      percentualUsoCliente: "100",
      overridesSocio: {},
      valorOverridesSocio: {},
    }]);
  }, [isViagemMode, aeronaveId, clienteId, socioId, clientesDaAeronave]);

  useEffect(() => {
    if (!clienteId) { setSocios([]); setSocioId(""); setReciboExistentePorCliente({}); return; }
    const info = getClienteAeronaveInfo(clienteId);
    setSocios(info?.socios || []);
    setReciboExistentePorCliente({});
  }, [clienteId, clientesDaAeronave]);

  const clienteSelecionadoInferido = useMemo(
    () => resolverClienteParaRateio({ clienteId, socioId, clientesDaAeronave }),
    [clienteId, socioId, clientesDaAeronave],
  );
  const clienteSel = useMemo(() => getClienteAeronaveInfo(clienteId) || getClienteAeronaveInfo(clienteSelecionadoInferido || ""), [clienteId, clienteSelecionadoInferido, clientesDaAeronave]);
  const socioSel = useMemo(() => socios.find((s) => s.id === socioId), [socios, socioId]);
  const aeronaveSel = useMemo(() => aeronaves.find((a) => a.id === aeronaveId), [aeronaves, aeronaveId]);
  const fornecedorSel = useMemo(() => fornecedores.find((f) => f.id === fornecedorId), [fornecedores, fornecedorId]);
  const travelReportSel = useMemo(() => travelReports.find((r) => r.id === travelReportId), [travelReports, travelReportId]);
  const valorReceberClienteViagem = useMemo(() => {
    if (!travelReportSel) return 0;
    const totalViagem = Number(travelReportSel.total_valor || 0);
    return +(totalViagem - Number(travelReportSel.total_clientes || 0)).toFixed(2);
  }, [travelReportSel]);
  const sociosParaRateio = useMemo(
    () => filtrarSociosParaRateio({ socios, socioSelecionadoId: socioId || null, sociosExcluidos }),
    [socios, socioId, sociosExcluidos],
  );

  const anexosSocioOptions = useMemo(() => {
    const opcoesBase = isViagemMode
      ? sociosParaRateio.map((s) => ({ id: s.id, nome: s.nome }))
      : clienteLinhas.flatMap((linha) => {
          const info = getClienteAeronaveInfo(linha.clienteId);
          return (info?.socios || []).map((s) => ({ id: s.id, nome: s.nome }));
        });
    return consolidarSociosParaAnexo(opcoesBase);
  }, [clienteLinhas, clientesDaAeronave, isViagemMode, sociosParaRateio]);

  const recibosFiltrados = useMemo(() => {
    if (!clienteId || clienteId === "__all__") return recibosExistentes;
    return recibosExistentes.filter((r) => r.cliente_id === clienteId || r.clientes_id === clienteId);
  }, [clienteId, recibosExistentes]);

  const recibosPorCliente = (targetClienteId: string) => recibosExistentes.filter((r) => r.cliente_id === targetClienteId || r.clientes_id === targetClienteId);

  const getSelectedReciboIdForCliente = (targetClienteId: string) =>
    clienteId === "__all__" ? reciboExistentePorCliente[targetClienteId] : reciboExistenteId;

  const getSelectedReciboForCliente = (targetClienteId: string) => {
    if (!usarReciboExistente) return null;
    const selectedId = getSelectedReciboIdForCliente(targetClienteId);
    return selectedId ? recibosExistentes.find((r) => r.id === selectedId) || null : null;
  };

  const getReciboNumeroForCliente = (targetClienteId: string) => {
    const recibo = getSelectedReciboForCliente(targetClienteId);
    return recibo?.numero_recibo || recibo?.numero || null;
  };

  const getReciboUrlForCliente = (targetClienteId: string) => {
    const recibo = getSelectedReciboForCliente(targetClienteId);
    return recibo?.pdf_url || recibo?.arquivo_url || null;
  };

  const getSelectedTaxaReciboIdForCliente = (targetClienteId: string) =>
    clienteId === "__all__" ? taxaReciboPorCliente[targetClienteId] : taxaReciboId;

  const getSelectedTaxaReciboForCliente = (targetClienteId: string) => {
    if (!isTaxasMode) return null;
    const selectedId = getSelectedTaxaReciboIdForCliente(targetClienteId);
    return selectedId ? taxaRecibos.find((r) => r.id === selectedId) || null : null;
  };

  const getTaxaReciboNumeroForCliente = (targetClienteId: string) => {
    const recibo = getSelectedTaxaReciboForCliente(targetClienteId);
    return recibo?.numero_recibo || recibo?.numero_documento || null;
  };

  const getTaxaReciboUrlForCliente = (targetClienteId: string) => {
    const recibo = getSelectedTaxaReciboForCliente(targetClienteId);
    return recibo?.pdf_url || null;
  };

  const getTaxaRecibosMultiplosData = () => {
    return taxaRecibosMultiplos.map((reciboId) => {
      const recibo = taxaRecibos.find((r) => r.id === reciboId);
      return {
        id: reciboId,
        numero: recibo?.numero_recibo || recibo?.numero_documento || null,
        url: recibo?.pdf_url || null,
        valor: recibo?.valor_total || null,
        numeroDocumento: recibo?.numero_documento || null,
        urlBoleto: recibo?.url_boleto || null,
        urlDemonstrativo: recibo?.url_nf || null,
      };
    });
  };

  useEffect(() => {
    if (!open || !isViagemMode || !clienteId) { setTravelReports([]); setTravelReportId(""); return; }
    let q: any = (supabase as any)
      .from("travel_expense_reports")
      .select("id, numero_relatorio, data_inicio, data_fim, total_valor, total_trip, total_trip2, total_clientes, total_tripulacao, total_sharebrasil, nome_tripulante, nome_tripulante_2, tripulacao_id, tripulante_id2, matricula_aeronave, pdf_url, aeronave_id, socios_id, clientes_id, pago_em")
      .eq("clientes_id", clienteId)
      .order("data_inicio", { ascending: false })
      .limit(50);
    if (aeronaveId) q = q.eq("aeronave_id", aeronaveId);
    if (socioId) q = q.eq("socios_id", socioId);
    q.then(({ data }: any) => {
      const items = (data as TravelReportOption[] | null) || [];
      setTravelReports(items);
      if (items.length === 1) {
        setTravelReportId(items[0].id);
      } else if (items.length > 0 && (!travelReportId || !items.some((item) => item.id === travelReportId))) {
        setTravelReportId("");
      }
    });
  }, [open, isViagemMode, clienteId, aeronaveId, socioId, subcategoriaNormalizadaAtual]);

  useEffect(() => {
    if (!travelReportSel) return;
    const total = socioId
      ? Number(travelReportSel.total_valor || 0)
      : Number(travelReportSel.total_valor || (Number(travelReportSel.total_trip || 0) + Number(travelReportSel.total_trip2 || 0) + Number(travelReportSel.total_clientes || 0)));
    setValorTotal(String(total.toFixed(2)));
    setDescricao((prev) => prev || `Relatório de viagem ${travelReportSel.numero_relatorio}`);
    if (isRelatorioViagemMode) {
      setReferenciaNumero(travelReportSel.numero_relatorio || "");
    }
  }, [travelReportSel, socioId, isRelatorioViagemMode]);

  useEffect(() => {
    if (!isViagemMode) {
      setReferenciaNumero("");
      return;
    }
    if (isRelatorioViagemMode && travelReportSel) {
      setReferenciaNumero(travelReportSel.numero_relatorio || "");
      return;
    }
    if (isReciboViagemMode) {
      const recibo = recibosFiltrados.find((item) => item.id === reciboExistenteId) || recibosFiltrados[0];
      setReferenciaNumero(recibo?.numero_recibo || recibo?.numero || "");
      return;
    }
    setReferenciaNumero("");
  }, [isViagemMode, isRelatorioViagemMode, isReciboViagemMode, travelReportSel, recibosFiltrados, reciboExistenteId]);

  useEffect(() => {
    if (!referenciaNumero || (!isRelatorioViagemMode && !isReciboViagemMode)) return;
    setAnexos((prev) => prev.map((anexo) => (anexo.numero ? anexo : { ...anexo, numero: referenciaNumero })));
  }, [referenciaNumero, isRelatorioViagemMode, isReciboViagemMode]);

  const valorNumerico = Number(String(valorTotal).replace(",", ".")) || 0;
  const percNumerico = Number(String(percentualUso).replace(",", ".")) || 0;

  const linhasRateioPreview = useMemo(() => montarLinhasRateio({
    valorTotal: valorNumerico,
    percentualUso: percNumerico,
    socios: sociosParaRateio,
    socioSelecionadoId: socioId || null,
  }), [valorNumerico, percNumerico, sociosParaRateio, socioId]);

  const linhasRateioMultiCliente = useMemo(() => {
    if (isViagemMode) return [];
    const linhasInput: ClienteLinhaRateioInput[] = clienteLinhas
      .filter((l) => l.clienteId)
      .map((l) => {
        const info = getClienteAeronaveInfo(l.clienteId);
        const sociosVisiveis = getSociosVisiveisParaCliente(info);
        const overrides: Record<string, number> = {};
        Object.entries(l.overridesSocio).forEach(([sId, val]) => {
          if (val === "" || val === undefined) return;
          const num = Number(String(val).replace(",", "."));
          if (!Number.isNaN(num)) overrides[sId] = num;
        });
        const valorOverrides: Record<string, number> = {};
        Object.entries(l.valorOverridesSocio || {}).forEach(([sId, val]) => {
          if (val === "" || val === undefined) return;
          const num = Number(String(val).replace(",", "."));
          if (!Number.isNaN(num)) valorOverrides[sId] = num;
        });
        return {
          clienteId: l.clienteId,
          clienteNome: info?.razaoSocial || "Cliente",
          percentualUsoCliente: Number(String(l.percentualUsoCliente).replace(",", ".")) || 0,
          socios: sociosVisiveis,
          overridesSocio: overrides,
          valorOverridesSocio: valorOverrides,
        };
      });
    return montarLinhasRateioMultiCliente({ valorTotal: valorNumerico, linhas: linhasInput });
  }, [clienteLinhas, clientesDaAeronave, valorNumerico, isViagemMode, socioId]);

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
            setReferenciaDuplicada({ tipo: "abastecimento", id: match.id, mensagem: `✓ Abastecimento encontrado. Data: ${match.data ? format(new Date(match.data), "dd/MM/yyyy") : "—"} | Valor: R$ ${(match.valor_total ? match.valor_total / 100 : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || "0,00"}` });
          } else {
            setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
          }
          return;
        }

        if (tipoNormalizado === "DESPESAS_DE_VIAGEM") {
          const { data, error: fetchError } = await supabase
            .from("travel_expense_reports")
            .select("id, clientes_id, total_valor, despesas, pdf_url, pago_em")
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
    setEtapaAtual(1); // Wizard volta para a etapa inicial
    setAeronaveId(""); setReembolsavel(false);
    setTipoDespesa(""); setTipoDespesaLabel(""); setDescricao(""); setValorTotal("");
    setPercentualUso("100"); setPeriodicidade("EVENTUAL"); setTipoRateio("FIXO"); setObservacoes("");
    setFornecedorId(""); setFornecedorNome("");
    setDataEmissao(new Date()); setDataVencimento(new Date()); setAnexos([]);
    setUsarReciboExistente(false); setReciboExistenteId(""); setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
    setTravelReportId(""); setTravelReports([]); setReferenciaNumero("");
    setClienteLinhas([]); setClienteId(""); setSocioId(""); setSociosExcluidos([]);
    setFuelComanda(""); setFuelNf(""); setFuelLookupResult(null); setFuelLookupSearched(false);
    setTaxaOrigem(null); setTaxaRecibos([]); setTaxaReciboId(""); setTaxaReciboPorCliente({}); setTaxaRecibosMultiplos([]);
  };

  // --- LÓGICA DO WIZARD: Validação por etapa ---
  const podeAvancar = () => {
    if (etapaAtual === 1) {
      const baseOk = !!(aeronaveId && tipoRateio && periodicidade && tipoDespesaLabel);
      if (isViagemMode) return baseOk && (!!clienteId || !!socioId);
      return baseOk;
    }
    if (etapaAtual === 2) {
      if (isViagemMode) return !!clienteId;
      if (!isViagemMode) return clienteLinhas.length > 0 && clienteLinhas.every((l) => !!l.clienteId) && !erroSomaClientes;
    }
    return true;
  };

  const clientesJaUsados = new Set(clienteLinhas.map((l) => l.clienteId).filter(Boolean));
  const addClienteLinha = () => setClienteLinhas((prev) => [...prev, { uid: crypto.randomUUID(), clienteId: "", percentualUsoCliente: "", overridesSocio: {}, valorOverridesSocio: {}, numeroDocumentoRecibo: undefined, urlBoleto: undefined, urlDemonstrativo: undefined }]);
  const updateClienteLinha = (uid: string, patch: Partial<ClienteLinhaState>) => setClienteLinhas((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  const removeClienteLinha = (uid: string) => setClienteLinhas((prev) => prev.filter((l) => l.uid !== uid));
  const toggleSocioExcluido = (socioIdToToggle: string) => {
    setSociosExcluidos((prev) => prev.includes(socioIdToToggle) ? prev.filter((id) => id !== socioIdToToggle) : [...prev, socioIdToToggle]);
  };
  const updateOverrideSocio = (linhaUid: string, socioId: string, valor: string) => setClienteLinhas((prev) => prev.map((l) => (l.uid === linhaUid ? { ...l, overridesSocio: { ...l.overridesSocio, [socioId]: valor } } : l)));
  const updateValorOverrideSocio = (linhaUid: string, socioId: string, valor: string) => setClienteLinhas((prev) => prev.map((l) => (l.uid === linhaUid ? { ...l, valorOverridesSocio: { ...l.valorOverridesSocio, [socioId]: valor } } : l)));

  const addAnexo = () => setAnexos((prev) => [...prev, { id: crypto.randomUUID(), tipo: "nf", numero: "", arquivo: null, socioId: null }]);
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
      } as Record<string, unknown>));
      await (supabase as any).from('notifications').insert(notifications);
    } catch (error) { console.warn('Falha na notificação:', error); }
  };

  const resolveCategoriaConta = async (nomeCategoria: string, userId: string | null) => {
    const categoriaLimpa = (nomeCategoria || '').trim();
    if (!categoriaLimpa) return null;
    const { data: expenseConfig } = await (supabase as any).from('expense_configu').select('id, expense_type').ilike('expense_type', categoriaLimpa).limit(1).maybeSingle();
    const nomeParaCategoria = (expenseConfig?.expense_type as string | null) || categoriaLimpa;
    const { data: categoriaExistente } = await (supabase as any).from('categorias_movimentacao').select('id, nome').ilike('nome', nomeParaCategoria).limit(1).maybeSingle();
    if ((categoriaExistente as { id?: string | null } | null)?.id) return (categoriaExistente as { id?: string | null }).id as string;
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

  const normalizeClienteId = (value: string | null | undefined): string | null => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (lower === "__all__" || lower === "all" || lower === "todos") return null;
    // Only accept UUID-shaped identifiers to avoid inserting sentinels like "all"
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(trimmed)) return null;
    return trimmed;
  };

  const validar = (): string | null => {
    if (!aeronaveId) return "Selecione a aeronave";
    if (!descricao.trim()) return "Descreva a despesa";
    if (!tipoDespesaLabel) return "Selecione o tipo de despesa";
    if (valorNumerico <= 0) return "Informe um valor válido";
    if (!dataVencimento) return "Data de vencimento é obrigatória";

    if (isViagemMode) {
      if (!clienteId && !socioId) return "Selecione o cliente ou o sócio";
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
    const clienteParaPersistencia = normalizeClienteId(clienteId) || clienteSelecionadoInferido || null;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const dataVenc = format(dataVencimento!, "yyyy-MM-dd");
      const dataComp = format(dataEmissao || new Date(), "yyyy-MM-dd");
      const statusMov = rascunho ? "rascunho" : "pendente";
      const statusCP = rascunho ? "rascunho" : "pendente";
      const taxaRecibosMultiplosData = getTaxaRecibosMultiplosData();
      const recibosMultiplosObs = taxaRecibosMultiplosData.length > 0 ? `Recibos de taxa: ${taxaRecibosMultiplosData.map((r) => r.numero).filter(Boolean).join(", ")}` : null;
      const obsFinal = [observacoes, referenciaDuplicada?.mensagem, recibosMultiplosObs].filter(Boolean).join("\n");
      const valorNumericoFinal = taxaRecibosMultiplosData.length > 0 ? +(taxaRecibosMultiplosData.reduce((sum, r) => sum + (Number(r.valor) || 0) / 100, 0)).toFixed(2) : valorNumerico;

      const referenciaTipo = referenciaDuplicada?.tipo || null;
      const referenciaId = referenciaDuplicada?.id ?? null;
      const fonteDespesa = referenciaTipo || "solicitacao_pagamento";
      const isAllClients = clienteId === "__all__";
      
      const reciboSelecionado = usarReciboExistente && !isAllClients
        ? recibosExistentes.find((r) => r.id === reciboExistenteId) || null
        : null;
      const reciboUrlSelecionado = reciboSelecionado?.pdf_url || reciboSelecionado?.arquivo_url || null;
      const reciboNumeroSelecionado = reciboSelecionado?.numero_recibo || reciboSelecionado?.numero || null;

      const anexosProc = await uploadAnexos();
      let anexosOrigem: Record<string, string | null> = {};
      if (referenciaTipo === "abastecimento" && referenciaId) {
        const { data } = await (supabase as any).from("abastecimentos").select("comprovante_pagamento, comprovante_url, nota_url, boleto_url, comanda_url, nf").eq("id", referenciaId).single();
        anexosOrigem = data || {};
      }
      if (referenciaTipo === "travel_expense_report" && referenciaId) {
        const { data } = await (supabase as any).from("travel_expense_reports").select("id, pdf_url").eq("id", referenciaId).single();
        anexosOrigem = data || {};
      }

      const nfUrl = pickUrl(anexosProc, "nf") || anexosOrigem.nota_url || null;
      const taxaReciboSelecionado = isTaxasMode && !isAllClients ? taxaRecibos.find((r) => r.id === taxaReciboId) || null : null;
      const reciboUrl = pickUrl(anexosProc, "recibo") || (isTaxasMode && taxaRecibosMultiplosData.length > 0 ? taxaRecibosMultiplosData[0]?.url : null) || (isTaxasMode ? taxaReciboSelecionado?.pdf_url : null) || reciboUrlSelecionado;
      const boletoUrl = pickUrl(anexosProc, "boleto") || anexosOrigem.boleto_url || null;
      const docUrl = pickUrl(anexosProc, "doc") || anexosOrigem.comanda_url || anexosOrigem.pdf_url || null;
      const arquivoPdfUrl = isRelatorioViagemMode
        ? travelReportSel?.pdf_url || docUrl || null
        : isReciboViagemMode
          ? reciboSelecionado?.pdf_url || reciboSelecionado?.arquivo_url || docUrl || null
          : docUrl || null;
      const demonstrativoUrl = pickUrl(anexosProc, "demonstrativo") || null;
      const comprovanteUrl = docUrl || anexosOrigem.comprovante_pagamento || anexosOrigem.comprovante_url || null;
      const nfNum = pickNumero(anexosProc, "nf");
      const reciboNum = pickNumero(anexosProc, "recibo") || (isTaxasMode && taxaRecibosMultiplosData.length > 0 ? taxaRecibosMultiplosData[0]?.numero : null) || (isTaxasMode ? taxaReciboSelecionado?.numero_recibo || taxaReciboSelecionado?.numero_documento || null : null) || reciboNumeroSelecionado;
      const boletoNum = pickNumero(anexosProc, "boleto");
      const docNum = pickNumero(anexosProc, "doc") || (isRelatorioViagemMode && travelReportSel ? travelReportSel.numero_relatorio : null) || (isReciboViagemMode ? referenciaNumero : null);
      const subcategoria1Val = subcategoriaSelecionadaParaPayload;
      const subcategoria2Val = null;
      const subcategoria3Val = null;
      const subcategoria4Val = null;
      const fornecedorNomeFinal = resolverFornecedorSolicitacao({ isViagemMode, fornecedorNome });

      if (!rascunho && referenciaTipo && referenciaId) {
        const { data: existente } = await (supabase as any).from("movimentacoes").select("id").eq("reference_type", referenciaTipo).eq("reference_id", referenciaId).maybeSingle();
        if (existente) { toast.info("Já existe uma solicitação de pagamento para essa despesa."); return; }
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
        const travelReportNumeroDoc = travelReportSel.numero_relatorio || docNum || referenciaNumero;
        const tripValues = [
          { label: "Tripulante 1", valor: Number(travelReportSel.total_trip || 0), nome: travelReportSel.nome_tripulante || null },
          { label: "Tripulante 2", valor: Number(travelReportSel.total_trip2 || 0), nome: travelReportSel.nome_tripulante_2 || null },
        ].filter((entry) => entry.valor > 0);

        if (tripValues.length === 0) throw new Error("Nenhum valor de tripulante foi encontrado.");

        for (const [index, entry] of tripValues.entries()) {
          const linhasRateioViagem = montarLinhasRateio({ valorTotal: entry.valor, percentualUso: percNumerico, socios, socioSelecionadoId: socioId || null });
          const capId = await insertAndGetId("contas_apagar", {
            data_vencimento: dataVenc, data_agendamento: dataVenc, valor: entry.valor, categoria: "REEMBOLSO TRIPULAÇÃO",
            categoria_id: categoriaContaId || null, descricao: `RV ${travelReportSel.numero_relatorio} — ${entry.nome || entry.label}`,
            status: statusCP, observacoes: `Reembolso ${entry.label.toLowerCase()} do relatório ${travelReportSel.numero_relatorio}`,
            cliente_id: clienteParaPersistencia, socios_cliente_id: socioId || null, fornecedor_favorito_id: fornecedorSel?.source === "favorito" ? fornecedorId : null,
            fornecedor_combustivel_id: fornecedorSel?.source === "combustivel" ? fornecedorId : null, fornecedor_nome: fornecedorNomeFinal,
            aeronave_registro: aeronaveSel?.matricula || travelReportSel.matricula_aeronave || null, possui_boleto: !!boletoUrl,
            boleto_url: boletoUrl, vencimento_boleto: boletoUrl ? dataVenc : null, possui_nf: !!nfUrl, nf_numero: nfNum,
            nf_url: nfUrl, possui_recibo: !!reciboUrl, numero_recibo: reciboNum, recibo_url: reciboUrl, data_recibo: reciboUrl ? dataComp : null,
            numero_doc: travelReportNumeroDoc, arquivo_pdf_url: arquivoPdfUrl, reference_type: "travel_expense_report", reference_id: travelReportSel.id, criado_por: userId,
          });

          let movId: string;
          try {
            movId = await insertAndGetId("movimentacoes", {
              descricao: `RV ${travelReportSel.numero_relatorio} — ${entry.nome || entry.label}`, tipo: "despesa", tipo_caixa: "cliente",
              categoria_id: categoriaContaId, valor: entry.valor, valor_original: Number(travelReportSel.total_valor ?? valorNumerico),
              data_competencia: dataComp, data_vencimento: dataVenc, status: statusMov, aeronave_id: aeronaveId || null,
              clientes_id: clienteParaPersistencia, socio_id: socioId || null, reembolsavel, fornecedor_nome: fornecedorNomeFinal,
              numero_nf: nfNum, numero_recibo: reciboNum, numero_boleto: boletoNum, numero_doc: travelReportNumeroDoc,
              nf_url: nfUrl, recibo_url: reciboUrl, boleto_url: boletoUrl, comprovante_url: comprovanteUrl,
              observacoes: obsFinal || null, contas_apagar_id: capId,
              ...(index === 0 ? { reference_type: "travel_expense_report", reference_id: travelReportSel.id } : {}),
              criado_por: userId,
            });
          } catch (movErr) {
            await supabase.from("contas_apagar").delete().eq("id", capId);
            throw movErr;
          }

          await supabase.from("contas_apagar").update({ movimentacao_id: movId }).eq("id", capId);

          const rateioPayloadsViagem = linhasRateioViagem.length > 0
            ? linhasRateioViagem.map((linha) => ({
                despesa_id: movId, fonte_despesa: "travel_expense_report", tipo_rateio: tipoRateioFinal, fluxo: "SAÍDA",
                data_emissao: dataComp, data_vencimento: dataVenc, numero_boleto: boletoNum, numero_nf: nfNum, numero_doc: travelReportNumeroDoc, numero_recibo: reciboNum,
                fornecedor_nome: fornecedorNomeFinal, cliente_id: normalizeClienteId(clienteId), clientes_nome: clienteSel?.razaoSocial || null, socio_id: linha.socio_id,
                socios_nome: linha.socio_nome, pago_diretamente: false, aeronave_id: aeronaveId || null, aeronave_registro: aeronaveSel?.matricula || travelReportSel.matricula_aeronave || null,
                percentual_sociedade: socios.find((socio) => socio.id === linha.socio_id)?.percentual_participacao ?? 0, percentual_uso: linha.percentual_uso,
                descricao_despesa: `RV ${travelReportSel.numero_relatorio} — ${entry.nome || entry.label}`, categoria_custo: tipoDespesa || null, periodicidade,
                valor_total_despesa: entry.valor, valor_rateado: linha.valor_rateado, status: statusMov, observacoes: obsFinal || null,
                boleto_url: boletoUrl, nf_url: nfUrl, recibo_url: reciboUrl, comprovante_url: comprovanteUrl, demonstrativo_url: demonstrativoUrl, subcategoria_1: subcategoria1Val, subcategoria_2: subcategoria2Val,
                relatorio_url: travelReportSel.pdf_url || docUrl || null,
                pago_por: resolverPagoPorSolicitacao({ socioNome: linha.socio_nome || socioSel?.nome || null, clienteNome: clienteSel?.razaoSocial || null, socioCount: linhasRateioViagem.length }),
              }))
            : [{
                despesa_id: movId, fonte_despesa: "travel_expense_report", tipo_rateio: tipoRateioFinal, fluxo: "SAÍDA",
                data_emissao: dataComp, data_vencimento: dataVenc, numero_boleto: boletoNum, numero_nf: nfNum, numero_doc: travelReportNumeroDoc, numero_recibo: reciboNum,
                fornecedor_nome: fornecedorNomeFinal, cliente_id: normalizeClienteId(clienteId), clientes_nome: clienteSel?.razaoSocial || null, socio_id: socioId || null,
                socios_nome: socioSel?.nome || null, pago_diretamente: false, aeronave_id: aeronaveId || null, aeronave_registro: aeronaveSel?.matricula || travelReportSel.matricula_aeronave || null,
                percentual_sociedade: socioSel?.percentual_participacao ?? 0, percentual_uso: percNumerico,
                descricao_despesa: `RV ${travelReportSel.numero_relatorio} — ${entry.nome || entry.label}`, categoria_custo: tipoDespesa || null, periodicidade,
                valor_total_despesa: entry.valor, valor_rateado: +(entry.valor * (percNumerico / 100)).toFixed(2), status: statusMov, observacoes: obsFinal || null,
                boleto_url: boletoUrl, nf_url: nfUrl, recibo_url: reciboUrl, comprovante_url: comprovanteUrl, demonstrativo_url: demonstrativoUrl, subcategoria_1: subcategoria1Val, subcategoria_2: subcategoria2Val,
                relatorio_url: travelReportSel.pdf_url || docUrl || null,
                pago_por: resolverPagoPorSolicitacao({ socioNome: socioSel?.nome || null, clienteNome: clienteSel?.razaoSocial || null, socioCount: linhasRateioViagem.length || (socioId ? 1 : 0) }),
              }];

          await supabaseClient.from("rateio_despesas").insert(rateioPayloadsViagem as any);
        }

        const valorAReceberCliente = valorReceberClienteViagem;
        if (!socioId && valorAReceberCliente > 0) {
          await supabaseClient.from("contas_areceber").insert({
            numero: `RV-${travelReportSel.numero_relatorio}`, cliente_id: normalizeClienteId(clienteId), cliente_nome: clienteSel?.razaoSocial || "",
            cliente_cnpj: clienteSel?.cnpj || null, data_criacao: dataComp, data_vencimento: dataVenc, valor: valorAReceberCliente,
            categoria: "RELATÓRIO DE VIAGEM", descricao: `Cobrança RV ${travelReportSel.numero_relatorio} — ${travelReportSel.nome_tripulante || ""}`,
            status: "pendente", aeronave: aeronaveSel?.matricula || travelReportSel.matricula_aeronave || null, reference_type: "travel_expense_report", reference_id: travelReportSel.id,
          });
        }
      } else if (!isViagemMode) {
        const primaryTaxaRecibo = isTaxasMode
          ? (taxaReciboSelecionado
              || (taxaRecibosMultiplos.length > 0 ? taxaRecibos.find((r) => r.id === taxaRecibosMultiplos[0]) : null)
              || (Object.values(taxaReciboPorCliente).length > 0
                    ? taxaRecibos.find((r) => r.id === Object.values(taxaReciboPorCliente)[0])
                    : null)
              || null)
          : null;
        const taxaNumeroDocumento = primaryTaxaRecibo?.numero_documento || null;
        const taxaNumeroRecibo = primaryTaxaRecibo?.numero_recibo || primaryTaxaRecibo?.numero_documento || null;
        const taxaDemonstrativoUrl = primaryTaxaRecibo?.url_nf || null;
        const numeroDocFinal = (isTaxasMode && taxaNumeroRecibo) ? taxaNumeroRecibo : docNum;
        const taxasSubcatFields: Record<string, unknown> = {};
        if (isTaxasMode && isSubcat1Sel) {
          taxasSubcatFields.numero_documento_infraero = taxaNumeroDocumento;
          taxasSubcatFields.infraero_url = taxaDemonstrativoUrl;
        }
        if (isTaxasMode && isSubcat2Sel) {
          taxasSubcatFields.numero_documento_decea = taxaNumeroDocumento;
          taxasSubcatFields.decea_url = taxaDemonstrativoUrl;
        }
        const capId = await insertAndGetId("contas_apagar", {
          data_vencimento: dataVenc, data_agendamento: dataVenc, valor: valorNumericoFinal, categoria: tipoDespesaLabel || null,
          categoria_id: categoriaContaId || null, descricao, status: statusCP, observacoes: obsFinal || null,
          cliente_id: clienteLinhas.length === 1 ? clienteLinhas[0].clienteId : clienteParaPersistencia, fornecedor_favorito_id: fornecedorSel?.source === "favorito" ? fornecedorId : null,
          fornecedor_combustivel_id: fornecedorSel?.source === "combustivel" ? fornecedorId : null, fornecedor_nome: fornecedorNomeFinal,
          aeronave_registro: aeronaveSel?.matricula || null, possui_boleto: !!boletoUrl, boleto_url: boletoUrl, vencimento_boleto: boletoUrl ? dataVenc : null,
          possui_nf: !!nfUrl, nf_numero: nfNum, nf_url: nfUrl, possui_recibo: !!reciboUrl && !isAllClients, numero_recibo: isAllClients ? null : reciboNum, recibo_url: isAllClients ? null : reciboUrl, data_recibo: !isAllClients && reciboUrl ? dataComp : null,
          numero_doc: numeroDocFinal, arquivo_pdf_url: docUrl, criado_por: userId,
          ...taxasSubcatFields,
        });

        // Movimentação SHARE: despesa total que a Share Brasil vai pagar ao fornecedor
        let movShareId: string | null = null;
        try {
          movShareId = await insertAndGetId("movimentacoes", {
            descricao, tipo: "despesa", tipo_caixa: "share",
            categoria_id: categoriaContaId, valor: valorNumericoFinal, valor_original: valorNumericoFinal,
            data_competencia: dataComp, data_vencimento: dataVenc, status: statusMov,
            aeronave_id: aeronaveId || null, fornecedor_nome: fornecedorNomeFinal,
            numero_nf: nfNum, numero_recibo: reciboNum, numero_boleto: boletoNum, numero_doc: docNum,
            nf_url: nfUrl, recibo_url: reciboUrl, boleto_url: boletoUrl, comprovante_url: comprovanteUrl,
            observacoes: obsFinal || null, contas_apagar_id: capId,
            reference_type: referenciaTipo || "solicitacao_pagamento",
            reference_id: referenciaTipo && referenciaId ? referenciaId : null,
            criado_por: userId,
          });
        } catch (shareErr) {
          await supabase.from("contas_apagar").delete().eq("id", capId);
          throw shareErr;
        }

        const movimentacaoIdsPorCliente: Record<string, string> = {};
        try {
          for (const linha of clienteLinhas) {
            const info = getClienteAeronaveInfo(linha.clienteId);
            const pctCliente = Number(String(linha.percentualUsoCliente).replace(",", ".")) || 0;
            const overrideStr = linha.valorClienteOverride;
            const overrideNum = overrideStr !== undefined && overrideStr !== ""
              ? Number(String(overrideStr).replace(/\./g, "").replace(",", "."))
              : NaN;
            const valorCliente = Number.isFinite(overrideNum)
              ? +overrideNum.toFixed(2)
              : +(valorNumericoFinal * (pctCliente / 100)).toFixed(2);
            const reciboNumLinha = pickNumero(anexosProc, "recibo") || (isTaxasMode ? getTaxaReciboNumeroForCliente(linha.clienteId) : null) || getReciboNumeroForCliente(linha.clienteId);
            const reciboUrlLinha = pickUrl(anexosProc, "recibo") || (isTaxasMode ? getTaxaReciboUrlForCliente(linha.clienteId) : null) || getReciboUrlForCliente(linha.clienteId);

            const movId = await insertAndGetId("movimentacoes", {
              descricao: clienteLinhas.length > 1 ? `${descricao} — ${info?.razaoSocial || "Cliente"}` : descricao, tipo: "despesa", tipo_caixa: "cliente",
              categoria_id: categoriaContaId, valor: valorCliente, valor_original: valorNumericoFinal, data_competencia: dataComp, data_vencimento: dataVenc, status: statusMov,
              aeronave_id: aeronaveId || null, clientes_id: linha.clienteId, reembolsavel, fornecedor_nome: fornecedorNomeFinal,
              numero_nf: nfNum, numero_recibo: reciboNumLinha, numero_boleto: boletoNum, numero_doc: docNum, nf_url: nfUrl, recibo_url: reciboUrlLinha, boleto_url: boletoUrl, comprovante_url: comprovanteUrl,
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

        const rateioPayloads = linhasRateioMultiCliente.map((linha) => {
          const reciboNumLinha = pickNumero(anexosProc, "recibo") || (isTaxasMode ? getTaxaReciboNumeroForCliente(linha.cliente_id) : null) || getReciboNumeroForCliente(linha.cliente_id);
          const reciboUrlLinha = pickUrl(anexosProc, "recibo") || (isTaxasMode ? getTaxaReciboUrlForCliente(linha.cliente_id) : null) || getReciboUrlForCliente(linha.cliente_id);
          return {
            despesa_id: movimentacaoIdsPorCliente[linha.cliente_id], fonte_despesa: fonteDespesa, tipo_rateio: tipoRateioFinal, fluxo: "SAÍDA",
            data_emissao: dataComp, data_vencimento: dataVenc, numero_boleto: boletoNum, numero_nf: nfNum, numero_doc: docNum, numero_recibo: reciboNumLinha, fornecedor_nome: fornecedorNomeFinal,
            cliente_id: linha.cliente_id, clientes_nome: linha.cliente_nome, socio_id: linha.socio_id, socios_nome: linha.socios_nome, pago_diretamente: false,
            aeronave_id: aeronaveId || null, aeronave_registro: aeronaveSel?.matricula || null, percentual_sociedade: linha.percentual_sociedade_original, percentual_uso: linha.percentual_uso,
            descricao_despesa: descricao, categoria_custo: tipoDespesa || null, periodicidade, valor_total_despesa: valorNumericoFinal, valor_rateado: linha.valor_rateado,
            status: statusMov, observacoes: obsFinal || null, boleto_url: boletoUrl, nf_url: nfUrl, recibo_url: reciboUrlLinha, comprovante_url: comprovanteUrl, demonstrativo_url: demonstrativoUrl, subcategoria_1: subcategoria1Val, subcategoria_2: subcategoria2Val, subcategoria_3: subcategoria3Val, subcategoria_4: subcategoria4Val,
            pago_por: resolverPagoPorSolicitacao({ socioNome: linha.socio_nome || null, clienteNome: linha.cliente_nome || null, socioCount: linhasRateioMultiCliente.length }),
            abastecimento_id: referenciaTipo === "abastecimento" ? referenciaId : null,
          };
        });

        await supabaseClient.from("rateio_despesas").insert(rateioPayloads as any);

        if (reembolsavel && !rascunho) {
          for (const linha of clienteLinhas) {
            const info = getClienteAeronaveInfo(linha.clienteId);
            const pctCliente = Number(String(linha.percentualUsoCliente).replace(",", ".")) || 0;
            const overrideStr = linha.valorClienteOverride;
            const overrideNum = overrideStr !== undefined && overrideStr !== ""
              ? Number(String(overrideStr).replace(/\./g, "").replace(",", "."))
              : NaN;
            const valorCliente = Number.isFinite(overrideNum)
              ? +overrideNum.toFixed(2)
              : +(valorNumericoFinal * (pctCliente / 100)).toFixed(2);
            const movIdCliente = movimentacaoIdsPorCliente[linha.clienteId];

            await supabaseClient.from("contas_areceber").insert({
              numero: `SP-${capId.slice(0, 8)}-${linha.clienteId.slice(0, 4)}`, cliente_id: linha.clienteId, cliente_nome: info?.razaoSocial || "", cliente_cnpj: info?.cnpj || null,
              data_criacao: dataComp, data_vencimento: dataVenc, valor: valorCliente, categoria: "REEMBOLSO", descricao: `Reembolso: ${descricao}`, status: "pendente",
              aeronave: aeronaveSel?.matricula || null, reference_type: "solicitacao_pagamento", reference_id: movIdCliente,
            });
          }
        }
      }

      if (!rascunho && referenciaTipo === "abastecimento" && referenciaId) {
        const socioNomeParaAbastecimento = (socioSel?.nome || (clienteLinhas.length === 1 ? null : null)).trim() || null;
        await supabase.from("abastecimentos").update({
          status_pagamento: "pago",
          data_pagamento: dataComp,
          socio_nome: socioNomeParaAbastecimento,
          updated_at: new Date().toISOString(),
        }).eq("id", referenciaId);
      }

      if (!rascunho) {
        const userName = (await supabase.from('user_profiles').select('full_name').eq('id', userId).maybeSingle()).data?.full_name || null;
        const clientLabel = isViagemMode ? clienteSel?.razaoSocial || null : clienteLinhas.length === 1 ? getClienteAeronaveInfo(clienteLinhas[0].clienteId)?.razaoSocial || null : `${clienteLinhas.length} clientes`;
        await notifyAdminsAboutPaymentRequest(descricao, clientLabel, valorNumericoFinal, userName);
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background/70 backdrop-blur-2xl border-white/10 shadow-2xl font-poppins rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Send className="h-4 w-4 text-emerald-400" />
            </div>
            Programar Pagamento — Cliente
          </DialogTitle>
          <DialogDescription>
            Etapa {etapaAtual} de 3 — {etapaAtual === 1 ? "Classificação Básica" : etapaAtual === 2 ? "Rateio e Contexto" : "Dados Finais da Fatura"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          
          {/* =========================================
              ETAPA 1: Classificação Básica (Progressiva)
              ========================================= */}
          {etapaAtual === 1 && (
            <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.01] p-5 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Classificação
                </h3>
              </div>

              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                <Label>1. Aeronave *</Label>
                <SearchableCombobox
                  items={aeronaves.map((a) => ({ id: a.id, label: `${a.matricula} — ${a.modelo}` }))}
                  value={aeronaveId} onChange={(id) => setAeronaveId(id)}
                  placeholder="Selecione a aeronave" searchPlaceholder="Buscar aeronave..." emptyMessage="Nenhuma aeronave"
                />
              </div>

              {aeronaveId && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                  <Label>2. Tipo de rateio *</Label>
                  <Select value={tipoRateio} onValueChange={setTipoRateio}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo de rateio" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXO">FIXO</SelectItem>
                      <SelectItem value="VARIAVEL_POR_VOO">VARIÁVEL POR VOO</SelectItem>
                      <SelectItem value="VARIAVEL_POR_HORA">VARIÁVEL POR HORA</SelectItem>
                      <SelectItem value="EXTRA">EXTRA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {aeronaveId && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                  <Label>2. Clientes e Sócios *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cliente</Label>
                      <SearchableCombobox
                        items={
                          !isViagemMode
                            ? [{ id: "__all__", label: "— Todos os clientes —" }, ...clientesDaAeronave.map((c) => ({ id: c.clienteId, label: c.razaoSocial }))]
                            : clientesDaAeronave.map((c) => ({ id: c.clienteId, label: c.razaoSocial }))
                        }
                        value={clienteId}
                        onChange={(id) => { setClienteId(id); setSocioId(""); setReciboExistenteId(""); }}
                        placeholder="Selecione o cliente"
                        emptyMessage="Nenhum cliente"
                      />
                    </div>
                    {socios.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Sócio (opcional)</Label>
                        <Select value={socioId || "__all__"} onValueChange={(v) => setSocioId(v === "__all__" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="Todos os sócios" /></SelectTrigger>
                          <SelectContent><SelectItem value="__all__">— Todos —</SelectItem>{socios.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {aeronaveId && tipoRateio && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                  <Label>3. Periodicidade *</Label>
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
              )}

              {aeronaveId && tipoRateio && periodicidade && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                  <Label>4. Esta despesa é reembolsável? *</Label>
                  <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 px-4 py-3 rounded-xl">
                    <Switch id="reembolsavel" checked={reembolsavel} onCheckedChange={setReembolsavel} />
                    <Label htmlFor="reembolsavel" className="cursor-pointer text-sm font-medium text-emerald-200">
                      {reembolsavel ? "Sim — gerar cobrança ao cliente" : "Não — despesa da empresa"}
                    </Label>
                  </div>
                </div>
              )}

              {aeronaveId && tipoRateio && periodicidade && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                  <Label>5. Tipo de despesa *</Label>
                  <SearchableCombobox
                    items={tiposDespesa.map((t) => ({ id: t.id, label: t.expense_type }))}
                    value={tipoDespesa} onChange={(id, label) => {
                      const existente = tiposDespesa.find((t) => t.id === id);
                      if (existente) {
                        setTipoDespesa(id);
                        setTipoDespesaBase(existente.expense_type);
                        setTipoDespesaLabel(existente.expense_type);
                        setSubcategoriaSel("");
                      }
                      else if (label) { if (window.confirm(`Adicionar novo tipo "${label}"?`)) criarTipoDespesa(label); }
                    }}
                    placeholder="Selecione o tipo" allowFreeText
                  />
                </div>
              )}

              {tipoDespesa && subcategoriasDisponiveis.length > 0 && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                  <Label>5.1 Subcategoria *</Label>
                  <Select
                    value={subcategoriaSel || "__none__"}
                    onValueChange={(v) => {
                      const val = v === "__none__" ? "" : v;
                      setSubcategoriaSel(val);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione a subcategoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Nenhuma (usar {tipoDespesaBase}) —</SelectItem>
                      {subcategoriasDisponiveis.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </section>
          )}

          {/* =========================================
              ETAPA 2: Contexto Específico
              ========================================= */}
          {etapaAtual === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              
              {isViagemMode && aeronaveId && (
                <section className="space-y-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
                  <div className="flex items-center gap-2 border-b border-sky-500/10 pb-3">
                    <Plane className="h-4 w-4 text-sky-400" />
                    <h3 className="text-sm font-semibold text-sky-300 uppercase tracking-wide">
                      {isReciboViagemMode ? "Recibo de Viagem" : "Relatório de Viagem"}
                    </h3>
                  </div>

                  {isRelatorioViagemMode && clienteId && (
                    <div className="space-y-1.5">
                      <Label>Nº do relatório de viagem</Label>
                      {travelReports.length > 0 ? (
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
                      ) : (
                        <p className="text-xs text-amber-300">Nenhum relatório encontrado para este cliente{socioId ? "/sócio" : ""} nesta aeronave.</p>
                      )}
                    </div>
                  )}

                  {isReciboViagemMode && clienteId && (() => {
                    const recibosViagem = recibosFiltrados.filter((r) => !aeronaveId || !r.aeronave_id || r.aeronave_id === aeronaveId);
                    return (
                      <div className="space-y-1.5">
                        <Label>Nº do recibo de viagem</Label>
                        {recibosViagem.length > 0 ? (
                          <Select value={reciboExistenteId} onValueChange={(v) => { setReciboExistenteId(v); setUsarReciboExistente(true); }}>
                            <SelectTrigger><SelectValue placeholder="Escolha um recibo" /></SelectTrigger>
                            <SelectContent>
                              {recibosViagem.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.numero_recibo || r.numero_documento || r.numero || `Recibo ${r.id.slice(0, 6)}`}
                                  {r.data_emissao ? ` — ${format(new Date(r.data_emissao), "dd/MM/yyyy")}` : ""}
                                  {` · R$ ${(Number(r.valor_total || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-xs text-amber-300">Nenhum recibo encontrado para este cliente nesta aeronave.</p>
                        )}
                      </div>
                    );
                  })()}


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

                  {travelReportSel && (
                    <div className="rounded-xl border border-sky-500/20 bg-background/40 p-4 space-y-2">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <Label className="text-xs uppercase tracking-wide text-sky-300">Pagamento à Tripulação</Label>
                        <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-200">
                          Total: {Number(travelReportSel.total_tripulacao ?? ((Number(travelReportSel.total_trip || 0)) + (Number(travelReportSel.total_trip2 || 0)))).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between rounded-md bg-white/5 px-3 py-2">
                          <span className="text-muted-foreground">{travelReportSel.nome_tripulante || "Tripulante 1"}</span>
                          <span className="font-medium text-sky-200">{Number(travelReportSel.total_trip || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                        <div className="flex justify-between rounded-md bg-white/5 px-3 py-2">
                          <span className="text-muted-foreground">{travelReportSel.nome_tripulante_2 || "Tripulante 2"}</span>
                          <span className="font-medium text-sky-200">{Number(travelReportSel.total_trip2 || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                        {!socioId && Number(travelReportSel.total_clientes || 0) > 0 && valorReceberClienteViagem > 0 && (
                          <div className="flex justify-between rounded-md bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 md:col-span-2">
                            <span className="text-emerald-300">A receber do cliente</span>
                            <span className="font-medium text-emerald-200">{valorReceberClienteViagem.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                          </div>
                        )}
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

              {isReciboFirstMode && aeronaveId && (
                <section className="space-y-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-xl p-5">
                  <div className="flex items-center gap-2 border-b border-indigo-500/10 pb-3">
                    <FileText className="h-4 w-4 text-indigo-300" />
                    <h3 className="text-sm font-semibold text-indigo-200 uppercase tracking-wide">
                      {isTaxasMode ? "Taxas Aeroportuárias — Recibos" : isSeguroMode ? "Seguros — Recibos Emitidos" : "Taxa FISTEL — Recibos Emitidos"}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {isTaxasMode && (
                      <div className="space-y-1.5">
                        <Label>Origem da Taxa *</Label>
                        <Select value={taxaOrigem ?? ""} onValueChange={(v) => { setTaxaOrigem(v as TaxaOrigem); setTaxaReciboId(""); setTaxaReciboPorCliente({}); setTaxaRecibosMultiplos([]); }}>
                          <SelectTrigger><SelectValue placeholder="Selecione a origem" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INFRAERO">Tarifa INFRAERO</SelectItem>
                            <SelectItem value="DECEA">Tarifa de Navegação Aérea — DECEA</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {(!isTaxasMode || taxaOrigem) && !clienteLinhas.some((l) => l.clienteId === "__all__") && (
                      <div className="space-y-1.5">
                        <Label>Recibo emitido</Label>
                        <Select value={taxaReciboId} onValueChange={setTaxaReciboId}>
                          <SelectTrigger>
                            <SelectValue placeholder={taxaRecibos.length === 0 ? "Nenhum recibo encontrado" : "Escolha um recibo"} />
                          </SelectTrigger>
                          <SelectContent>
                            {taxaRecibos.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.numero_recibo || r.numero_documento || `Recibo ${r.id.slice(0, 6)}`}
                                {r.data_emissao ? ` · ${format(new Date(r.data_emissao), "dd/MM/yyyy")}` : ""}
                                {` · R$ ${(Number(r.valor_total || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {(!isTaxasMode || taxaOrigem) && clienteLinhas.some((l) => l.clienteId === "__all__") && (
                    <div className="space-y-3 mt-3">
                      <p className="text-xs text-indigo-200 font-medium">Selecione um recibo para cada cliente:</p>
                      {clientesDaAeronave.map((cliente) => (
                        <div key={cliente.clienteId} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Recibo para {cliente.razaoSocial}</Label>
                          <Select
                            value={taxaReciboPorCliente[cliente.clienteId] || ""}
                            onValueChange={(v) => setTaxaReciboPorCliente((prev) => ({ ...prev, [cliente.clienteId]: v }))}
                          >
                            <SelectTrigger className="w-full md:w-1/2"><SelectValue placeholder="Escolha um recibo" /></SelectTrigger>
                            <SelectContent>
                              {taxaRecibos.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.numero_recibo || r.numero_documento || `Recibo ${r.id.slice(0, 6)}`}
                                  {r.data_emissao ? ` · ${format(new Date(r.data_emissao), "dd/MM/yyyy")}` : ""}
                                  {` · R$ ${(Number(r.valor_total || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  )}

                  {(!isTaxasMode || taxaOrigem) && !clienteLinhas.some((l) => l.clienteId === "__all__") && (
                    <div className="space-y-3 mt-4 p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/10">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-indigo-200">Recibos adicionados:</p>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 px-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                          onClick={() => {
                            if (taxaReciboId && !taxaRecibosMultiplos.includes(taxaReciboId)) {
                              setTaxaRecibosMultiplos([...taxaRecibosMultiplos, taxaReciboId]);
                              setTaxaReciboId("");
                            }
                          }}
                          disabled={!taxaReciboId}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Recibo
                        </Button>
                      </div>

                      {taxaRecibosMultiplos.length === 0 ? (
                        <p className="text-xs text-indigo-300/60">Nenhum recibo adicionado. Selecione um recibo e clique em "Adicionar".</p>
                      ) : (
                        <div className="space-y-2">
                          {taxaRecibosMultiplos.map((reciboId, idx) => {
                            const r = taxaRecibos.find((x) => x.id === reciboId);
                            if (!r) return null;
                            return (
                              <div key={reciboId} className="flex items-start justify-between gap-2 p-2 rounded-md bg-indigo-500/20 border border-indigo-500/30">
                                <div className="flex-1 text-xs">
                                  <div className="font-medium text-indigo-100">{idx + 1}. {r.numero_recibo || r.numero_documento || `Recibo ${r.id.slice(0, 6)}`}</div>
                                  <div className="text-indigo-300/70">{r.data_emissao ? format(new Date(r.data_emissao), "dd/MM/yyyy") : "—"} · R$ {(Number(r.valor_total || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 hover:bg-red-500/30 hover:text-red-300"
                                  onClick={() => setTaxaRecibosMultiplos(taxaRecibosMultiplos.filter((id) => id !== reciboId))}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {taxaReciboId && (() => {
                    const r = taxaRecibos.find((x) => x.id === taxaReciboId);
                    if (!r) return null;
                    return (
                      <div className="rounded-lg border border-indigo-500/30 bg-background/40 p-4 space-y-3">
                        <div className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wide">Resumo do Recibo Selecionado</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div><div className="text-muted-foreground">Nº Documento</div><div className="font-medium text-indigo-100">{r.numero_documento || "—"}</div></div>
                          <div><div className="text-muted-foreground">Nº Recibo</div><div className="font-medium">{r.numero_recibo || "—"}</div></div>
                          <div><div className="text-muted-foreground">Percentual</div><div className="font-medium">{r.percentual ?? "—"}%</div></div>
                          <div><div className="text-muted-foreground">Valor Total</div><div className="font-medium text-indigo-200">R$ {(Number(r.valor_total || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></div>
                        </div>
                        <div className="flex flex-wrap gap-4 pt-2 border-t border-white/5 text-xs">
                          {r.pdf_url && (
                            <a href={r.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200"><ExternalLink className="h-3.5 w-3.5" /> PDF do recibo</a>
                          )}
                          {r.boleto_url && (
                            <a href={r.boleto_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"><ExternalLink className="h-3.5 w-3.5" /> Boleto</a>
                          )}
                          {r.nf_url && (
                            <a href={r.nf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200"><ExternalLink className="h-3.5 w-3.5" /> Demonstrativo</a>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <p className="text-[11px] text-indigo-100/60">
                    Ao selecionar o recibo, o card de <b>Rateio & Clientes</b> abaixo é preenchido automaticamente (percentual, valor e anexo).
                  </p>
                </section>
              )}
              {!isViagemMode && aeronaveId && (
                <section className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-emerald-500/10 pb-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-400" />
                      <h3 className="text-sm font-semibold text-emerald-300 uppercase tracking-wide">Rateio & Clientes</h3>
                    </div>
                    
                    <div className="flex items-center gap-4">
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
                    </div>
                  </div>

                  <p className="text-[11px] text-emerald-100/70">
                    {isTaxasMode 
                      ? "Dados de número de documento, boleto e demonstrativo são preenchidos automaticamente do recibo selecionado."
                      : "Cliente e sócio já selecionados na etapa anterior — confirme o valor e a porcentagem da despesa."}
                  </p>


                  {clientesDaAeronave.length === 0 && (
                    <p className="text-xs text-amber-400">Nenhum cotista vinculado a esta aeronave.</p>
                  )}

                  <div className="space-y-3">
                    {clienteLinhas.map((linha) => {
                      const info = getClienteAeronaveInfo(linha.clienteId);
                      const sociosVisiveis = getSociosVisiveisParaCliente(info);
                      const temSocios = !!(info && info.socios.length > 0);
                      const itensDisponiveis = clientesDaAeronave.filter((c) => c.clienteId === linha.clienteId || !clientesJaUsados.has(c.clienteId));
                      const pctCliente = Number(String(linha.percentualUsoCliente).replace(",", ".")) || 0;
                      const overrideNum = linha.valorClienteOverride !== undefined && linha.valorClienteOverride !== ""
                        ? Number(String(linha.valorClienteOverride).replace(/\./g, "").replace(",", "."))
                        : NaN;
                      const valorCliente = Number.isFinite(overrideNum)
                        ? +overrideNum.toFixed(2)
                        : +(valorNumerico * (pctCliente / 100)).toFixed(2);

                      return (
                        <div key={linha.uid} className="rounded-lg border border-white/10 bg-background/60 p-4 space-y-4">
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                            {/* Cliente só aparece quando ele NÃO tem sócios cadastrados.
                                Quando há sócios, o rateio interno abaixo já identifica a despesa
                                por nome de sócio — mostrar o cliente aqui seria redundante e
                                confuso, já que o valor por sócio é o que de fato importa. */}
                            {!temSocios && (
                              <div className="lg:col-span-6 space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Cliente</Label>
                                <Input value={info?.razaoSocial || "—"} readOnly className="bg-muted/30 font-medium" />
                              </div>
                            )}
                            <div className={cn("space-y-1.5", temSocios ? "lg:col-span-6" : "lg:col-span-3")}>
                              <Label className="text-xs text-muted-foreground">% da Nota</Label>
                              <Input type="text" inputMode="decimal" value={linha.percentualUsoCliente} onChange={(e) => updateClienteLinha(linha.uid, { percentualUsoCliente: e.target.value, valorClienteOverride: undefined })} placeholder="100" />
                            </div>
                            <div className={cn("space-y-1.5", temSocios ? "lg:col-span-6" : "lg:col-span-3")}>
                              <Label className="text-xs text-muted-foreground">Valor a Pagar (R$)</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={linha.valorClienteOverride ?? valorCliente.toFixed(2).replace(".", ",")}
                                onChange={(e) => updateClienteLinha(linha.uid, { valorClienteOverride: e.target.value })}
                                placeholder="0,00"
                                className="font-medium text-emerald-300"
                                title="Sugestão calculada pelo % do rateio. Pode ser editado livremente — o ajuste é feito no Fechamento de Balanço."
                              />
                            </div>
                          </div>

                          {/* Dados de recibo de taxa preenchidos automaticamente */}
                          {isTaxasMode && (linha.numeroDocumentoRecibo || linha.urlBoleto || linha.urlDemonstrativo) && (
                            <div className="rounded-md bg-indigo-500/10 border border-indigo-500/30 p-3 space-y-2">
                              <div className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wide">Dados do Recibo (Preenchidos Automaticamente)</div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                {linha.numeroDocumentoRecibo && (
                                  <div>
                                    <span className="text-muted-foreground block mb-1">Nº Documento</span>
                                    <span className="text-indigo-200 font-medium">{linha.numeroDocumentoRecibo}</span>
                                  </div>
                                )}
                                {linha.urlBoleto && (
                                  <div>
                                    <span className="text-muted-foreground block mb-1">Boleto</span>
                                    <a href={linha.urlBoleto} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200 inline-flex items-center gap-1">
                                      <ExternalLink className="h-3 w-3" /> Abrir
                                    </a>
                                  </div>
                                )}
                                {linha.urlDemonstrativo && (
                                  <div>
                                    <span className="text-muted-foreground block mb-1">Demonstrativo</span>
                                    <a href={linha.urlDemonstrativo} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200 inline-flex items-center gap-1">
                                      <ExternalLink className="h-3 w-3" /> Abrir
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {info && sociosVisiveis.length > 0 && (
                            <div className="space-y-3 mt-4 pt-4 border-t border-white/5">
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Rateio Interno (Por Sócio)</Label>
                                <Badge variant="outline" className="bg-white/5 text-[10px] border-white/10">{sociosVisiveis.length} de {info.socios.length} sócio(s)</Badge>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {info.socios.map((socio) => {
                                  const isExcluded = sociosExcluidos.includes(socio.id);
                                  return (
                                    <button
                                      key={socio.id}
                                      type="button"
                                      onClick={() => toggleSocioExcluido(socio.id)}
                                      className={cn(
                                        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                                        isExcluded
                                          ? "border-red-500/30 bg-red-500/10 text-red-300 line-through opacity-70"
                                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                                      )}
                                      title={isExcluded ? "Sócio excluído do rateio — clique para incluir novamente" : "Clique para excluir este sócio do rateio"}
                                    >
                                      {isExcluded ? <span className="flex items-center gap-1"><Trash2 className="h-3 w-3" /> {socio.nome}</span> : socio.nome}
                                    </button>
                                  );
                                })}
                              </div>
                              
                              <div className="grid gap-2">
                                {(() => {
                                  const totalPctSocios = sociosVisiveis.reduce((s, so) => s + (Number(so.percentual_participacao ?? 0) || 0), 0);
                                  const linhasSocios = sociosVisiveis.map((s) => {
                                    const overrideVal = linha.overridesSocio[s.id];
                                    const valorOverrideVal = linha.valorOverridesSocio?.[s.id];
                                    // Fallback divide pelos sócios VISÍVEIS (não excluídos), nunca pelo total
                                    // original do cliente — assim, excluir um sócio redistribui de verdade.
                                    const autoPct = totalPctSocios > 0 ? (Number(s.percentual_participacao ?? 0) / totalPctSocios) * 100 : 100 / sociosVisiveis.length;
                                    const hasValorOverride = valorOverrideVal !== undefined && valorOverrideVal !== "" && !Number.isNaN(Number(String(valorOverrideVal).replace(",", ".")));
                                    const pctEfetivo = hasValorOverride
                                      ? (valorNumerico > 0 ? (Number(String(valorOverrideVal).replace(",", ".")) / valorNumerico) * 100 : 0)
                                      : (overrideVal !== undefined && overrideVal !== "" && !Number.isNaN(Number(overrideVal.replace(",", "."))) ? Number(overrideVal.replace(",", ".")) : autoPct);
                                    const valorSocio = hasValorOverride
                                      ? Number(String(valorOverrideVal).replace(",", "."))
                                      : +(valorCliente * (pctEfetivo / 100)).toFixed(2);
                                    return { socio: s, overrideVal, valorOverrideVal, autoPct, hasValorOverride, pctEfetivo, valorSocio };
                                  });
                                  const somaPctSocios = linhasSocios.reduce((sum, l) => sum + l.pctEfetivo, 0);
                                  const somaSociosForaDoEsperado = Math.abs(somaPctSocios - 100) > 0.5;

                                  return (
                                    <>
                                      {linhasSocios.map(({ socio: s, overrideVal, valorOverrideVal, autoPct, hasValorOverride, pctEfetivo, valorSocio }) => (
                                        <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-white/5 bg-black/20 p-2 text-sm transition-colors hover:bg-black/30">
                                          <div className="font-medium text-foreground min-w-[140px] flex-1">{s.nome}</div>
                                          <div className="flex items-center gap-1 text-muted-foreground">
                                            <span className="text-xs whitespace-nowrap">%:</span>
                                            <Input type="text" inputMode="decimal" className="h-7 w-20 text-xs text-center" placeholder={autoPct.toFixed(2)} value={hasValorOverride ? pctEfetivo.toFixed(2) : (overrideVal ?? "")} onChange={(e) => { updateOverrideSocio(linha.uid, s.id, e.target.value); updateValorOverrideSocio(linha.uid, s.id, ""); }} />
                                          </div>
                                          <div className="flex items-center gap-1 text-emerald-300">
                                            <span className="text-xs whitespace-nowrap">R$:</span>
                                            <Input type="text" inputMode="decimal" className="h-7 w-28 text-xs text-right" placeholder={valorSocio.toFixed(2)} value={valorOverrideVal ?? ""} onChange={(e) => updateValorOverrideSocio(linha.uid, s.id, e.target.value)} />
                                            <span className="text-[10px] opacity-60 whitespace-nowrap">
                                              = {valorSocio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                      <div className={cn(
                                        "text-xs rounded-md p-2 border font-medium",
                                        somaSociosForaDoEsperado ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                      )}>
                                        Soma dos sócios: {somaPctSocios.toFixed(2)}% {somaSociosForaDoEsperado ? "— ajuste os percentuais para fechar 100%" : "— OK"}
                                      </div>
                                    </>
                                  );
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

              {isCombustivelMode && aeronaveId && (
                <section className="space-y-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl p-5">
                  <div className="flex items-center gap-2 border-b border-amber-500/10 pb-3">
                    <Plane className="h-4 w-4 text-amber-300" />
                    <h3 className="text-sm font-semibold text-amber-200 uppercase tracking-wide">Combustível — Comanda / NF</h3>
                  </div>
                  <p className="text-xs text-amber-100/70">
                    Informe a comanda e/ou o número da NF. Se já existir um abastecimento cadastrado, ele será vinculado; caso contrário, um novo será criado ao salvar.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Comanda</Label>
                      <Input value={fuelComanda} onChange={(e) => setFuelComanda(e.target.value)} placeholder="Nº da comanda" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nº da NF</Label>
                      <Input value={fuelNf} onChange={(e) => setFuelNf(e.target.value)} placeholder="Nº da nota fiscal" />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="outline" className="w-full border-amber-500/30 hover:bg-amber-500/10" onClick={buscarAbastecimento} disabled={fuelLookupLoading}>
                        {fuelLookupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />} Buscar / Vincular
                      </Button>
                    </div>
                  </div>
                  {fuelLookupSearched && !fuelLookupResult && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-xs text-amber-200/80">
                        Nenhum abastecimento encontrado. Crie um novo para vincular a esta solicitação.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-100"
                        onClick={() => setNovoAbastOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Criar novo abastecimento
                      </Button>
                    </div>
                  )}
                  {fuelLookupResult && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-100">
                      ✓ Vinculado ao abastecimento existente · Comanda {fuelLookupResult.comanda || "—"} · NF {fuelLookupResult.nf || "—"} · R$ {(Number(fuelLookupResult.valor_total || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </section>
              )}

            </div>
          )}

          {/* =========================================
              ETAPA 3: Dados Finais e Anexos
              ========================================= */}
          {etapaAtual === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.01] p-5">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b border-white/5 pb-3">Informações da Fatura</h3>

                {!isViagemMode && !(isCombustivelMode && fuelLookupResult) && (
                  <div className="space-y-1.5">
                    <Label>Fornecedor</Label>
                    <SearchableCombobox items={fornecedores} value={fornecedorId} onChange={(id, label) => { setFornecedorId(id); setFornecedorNome(fornecedores.find((f) => f.id === id)?.label || label || ""); }} placeholder="Selecione ou digite" allowFreeText />
                  </div>
                )}

                {isCombustivelMode && fuelLookupResult && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-100 space-y-1">
                    <div><span className="text-emerald-300 font-semibold">Fornecedor (abastecedor):</span> {fuelLookupResult.abastecedor || fornecedorNome || "—"}</div>
                    <div>
                      <span className="text-emerald-300 font-semibold">Data:</span> {fuelLookupResult.data ? format(new Date(fuelLookupResult.data + "T00:00:00"), "dd/MM/yyyy") : "—"}
                      {" · "}
                      <span className="text-emerald-300 font-semibold">Vencimento:</span> {fuelLookupResult.data_vencimento_boleto ? format(new Date(fuelLookupResult.data_vencimento_boleto + "T00:00:00"), "dd/MM/yyyy") : "—"}
                    </div>
                    <p className="text-emerald-200/70 pt-1">Fornecedor, data de emissão e vencimento vêm do abastecimento vinculado.</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Descrição da Despesa *</Label>
                  <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} maxLength={500} placeholder="Ex: Manutenção de rotina" />
                </div>

                {(isRelatorioViagemMode || isReciboViagemMode) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Número de referência</Label>
                      <Input value={referenciaNumero} readOnly className="bg-muted/30" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cliente / Sócio selecionado</Label>
                      <Input value={clienteSel?.razaoSocial ? `${clienteSel.razaoSocial}${socioSel ? ` · ${socioSel.nome}` : ""}` : "—"} readOnly className="bg-muted/30" />
                    </div>
                  </div>
                )}

                {!(isCombustivelMode && fuelLookupResult) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DateField label="Data de emissão (Competência)" value={dataEmissao} onChange={setDataEmissao} />
                    <DateField label="Data de vencimento *" value={dataVencimento} onChange={setDataVencimento} />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Observações Adicionais</Label>
                  <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} maxLength={1000} />
                </div>
              </section>

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

              <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.01] p-5">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Documentos e Anexos
                  </h3>
                  <Button type="button" variant="outline" size="sm" onClick={addAnexo}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar arquivo
                  </Button>
                </div>

                {isCombustivelMode && fuelLookupResult && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                    <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wide">Anexos do abastecimento vinculado</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {[
                        { label: `Comanda${fuelLookupResult.comanda ? ` · ${fuelLookupResult.comanda}` : ""}`, url: fuelLookupResult.comanda_url },
                        { label: `Nota Fiscal${fuelLookupResult.nf ? ` · ${fuelLookupResult.nf}` : ""}`, url: fuelLookupResult.nota_url },
                        { label: "Boleto", url: fuelLookupResult.boleto_url },
                        { label: "Comprovante de Pagamento", url: fuelLookupResult.comprovante_pagamento || fuelLookupResult.comprovante_url },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-md border border-emerald-500/15 bg-background/40 px-3 py-2">
                          <FileText className={cn("h-4 w-4", item.url ? "text-emerald-400" : "text-muted-foreground")} />
                          <span className="flex-1 truncate text-emerald-100/80">{item.label}</span>
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300">
                              <Eye className="h-3.5 w-3.5" /> Ver
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">sem arquivo</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-emerald-200/70">Estes anexos foram carregados diretamente do registro em <span className="font-mono">abastecimentos</span>.</p>
                  </div>
                )}

                <div className="rounded-lg border border-white/5 bg-background/50 p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch id="usar-recibo-existente" checked={usarReciboExistente} onCheckedChange={setUsarReciboExistente} />
                    <div>
                      <Label htmlFor="usar-recibo-existente" className="cursor-pointer text-sm font-medium">Vincular a um recibo emitido</Label>
                      <p className="text-xs text-muted-foreground">Puxa automaticamente o PDF de um recibo criado pelo sistema.</p>
                    </div>
                  </div>
                  {usarReciboExistente && (
                    clienteId === "__all__" ? (
                      <div className="space-y-3 mt-3">
                        {clientesDaAeronave.map((cliente) => {
                          const recibosCliente = recibosPorCliente(cliente.clienteId);
                          return (
                            <div key={cliente.clienteId} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Recibo para {cliente.razaoSocial}</Label>
                              {recibosCliente.length > 0 ? (
                                <Select
                                  value={reciboExistentePorCliente[cliente.clienteId] || ""}
                                  onValueChange={(v) => setReciboExistentePorCliente((prev) => ({ ...prev, [cliente.clienteId]: v }))}
                                >
                                  <SelectTrigger className="w-full md:w-1/2"><SelectValue placeholder="Escolha um recibo" /></SelectTrigger>
                                  <SelectContent>
                                    {recibosCliente.map((r) => (
                                      <SelectItem key={r.id} value={r.id}>{r.numero_recibo || r.numero || `Recibo ${r.id.slice(0, 6)}`}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <p className="text-xs text-amber-300">Nenhum recibo encontrado para este cliente.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Select value={reciboExistenteId} onValueChange={setReciboExistenteId}>
                        <SelectTrigger className="w-full md:w-1/2 mt-2"><SelectValue placeholder="Escolha um recibo existente" /></SelectTrigger>
                        <SelectContent>
                          {recibosFiltrados.map((r) => <SelectItem key={r.id} value={r.id}>{r.numero_recibo || r.numero || `Recibo ${r.id.slice(0, 6)}`}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )
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
                            <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
                            <SelectContent>{TIPOS_ANEXO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                          </Select>
                          {anexosSocioOptions.length > 0 && (
                            <div className="md:col-span-3">
                              <Select value={a.socioId || "__none__"} onValueChange={(v) => updateAnexo(a.id, { socioId: v === "__none__" ? null : v })}>
                                <SelectTrigger><SelectValue placeholder="Sócio do anexo" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— Sem sócio específico —</SelectItem>
                                  {anexosSocioOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <Input className="md:col-span-3" placeholder="Nº Documento (Opcional)" value={a.numero} onChange={(e) => updateAnexo(a.id, { numero: e.target.value })} />
                          <div className="md:col-span-3">
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
          )}
        </div>

        {/* =========================================
            RODAPÉ DE NAVEGAÇÃO REFEITO
            ========================================= */}
        <DialogFooter className="gap-3 pt-4 border-t border-white/10 mt-2 flex sm:justify-between w-full">
          {/* Botão de Voltar (escondido na etapa 1) */}
          <div className="flex-shrink-0">
            {etapaAtual > 1 && (
              <Button variant="ghost" onClick={() => setEtapaAtual((prev) => prev - 1)} disabled={saving}>
                Voltar
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>

            {etapaAtual < 3 ? (
              <Button 
                onClick={() => setEtapaAtual((prev) => prev + 1)} 
                disabled={!podeAvancar() || saving}
                className="bg-sky-600 hover:bg-sky-500 text-white"
              >
                Próxima Etapa
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => handleSalvar(true)} disabled={saving} className="border-white/20">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Salvar Rascunho
                </Button>
                <Button onClick={() => handleSalvar(false)} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Solicitar Pagamento
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {/* ============================================
          Modal inline: Novo Abastecimento
          ============================================ */}
      <Dialog open={novoAbastOpen} onOpenChange={(v) => { setNovoAbastOpen(v); if (!v) resetNovoAbast(); }}>
        <DialogContent className="max-w-2xl" style={{ zIndex: 1100 }}>
          <DialogHeader>
            <DialogTitle>Novo Abastecimento</DialogTitle>
            <DialogDescription>
              Cadastre o abastecimento na tabela <span className="font-mono">abastecimentos</span>. Ele será vinculado automaticamente a esta solicitação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Comanda</Label>
                <Input value={fuelComanda} onChange={(e) => setFuelComanda(e.target.value)} placeholder="Nº da comanda" />
              </div>
              <div className="space-y-1.5">
                <Label>Nº da NF</Label>
                <Input value={fuelNf} onChange={(e) => setFuelNf(e.target.value)} placeholder="Nº da nota fiscal" />
              </div>
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <Input type="date" value={novoAbast.data} onChange={(e) => setNovoAbast((p) => ({ ...p, data: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento do Boleto</Label>
                <Input type="date" value={novoAbast.data_vencimento_boleto} onChange={(e) => setNovoAbast((p) => ({ ...p, data_vencimento_boleto: e.target.value }))} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Abastecedor (Fornecedor)</Label>
                <SearchableCombobox
                  items={fornecedores.filter((f) => f.source === "combustivel").map((f) => ({ id: f.id, label: f.label }))}
                  value={novoAbast.abastecedor_id}
                  onChange={(id) => setNovoAbast((p) => ({ ...p, abastecedor_id: id }))}
                  placeholder="Selecione o abastecedor"
                  searchPlaceholder="Buscar abastecedor..."
                  emptyMessage="Nenhum abastecedor encontrado"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Local</Label>
                <Input value={novoAbast.local} onChange={(e) => setNovoAbast((p) => ({ ...p, local: e.target.value }))} placeholder="Ex: SBSP" />
              </div>
              <div className="space-y-1.5">
                <Label>Trecho</Label>
                <Input value={novoAbast.trecho} onChange={(e) => setNovoAbast((p) => ({ ...p, trecho: e.target.value }))} placeholder="Ex: SBSP-SBRJ" />
              </div>
              <div className="space-y-1.5">
                <Label>Litros</Label>
                <Input type="number" step="0.01" value={novoAbast.litros} onChange={(e) => setNovoAbast((p) => ({ ...p, litros: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Valor Unitário (R$)</Label>
                <Input type="number" step="0.01" value={novoAbast.valor_unitario} onChange={(e) => setNovoAbast((p) => ({ ...p, valor_unitario: e.target.value }))} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Valor Total (R$)</Label>
                <Input
                  value={novoAbastValorTotalCalculado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  readOnly
                  className="bg-muted/30 font-medium"
                />
                <p className="text-[11px] text-muted-foreground">
                  Calculado automaticamente (Litros × Valor Unitário). O banco também gera esse valor sozinho — por isso não é enviado no insert.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de Combustível</Label>
                <Select
                  value={novoAbast.tipo_combustivel || "__none__"}
                  onValueChange={(v) => setNovoAbast((p) => ({ ...p, tipo_combustivel: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Selecione —</SelectItem>
                    {TIPOS_COMBUSTIVEL.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Observação</Label>
                <Textarea rows={2} value={novoAbast.observacao} onChange={(e) => setNovoAbast((p) => ({ ...p, observacao: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-white/10">
              <div className="space-y-1.5">
                <Label>Comanda (arquivo)</Label>
                <Input type="file" accept="application/pdf,image/*" onChange={(e) => setNovoAbastComandaFile(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-1.5">
                <Label>Nota Fiscal (arquivo)</Label>
                <Input type="file" accept="application/pdf,image/*" onChange={(e) => setNovoAbastNotaFile(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-1.5">
                <Label>Boleto (arquivo)</Label>
                <Input type="file" accept="application/pdf,image/*" onChange={(e) => setNovoAbastBoletoFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNovoAbastOpen(false)} disabled={novoAbastSaving}>Cancelar</Button>
            <Button onClick={criarNovoAbastecimento} disabled={novoAbastSaving} className="bg-amber-600 hover:bg-amber-500 text-white">
              {novoAbastSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Criar Abastecimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function normalizarSubcategoriaDespesa(subcategoria: string): string {
  if (!subcategoria || typeof subcategoria !== "string") return "";
  const normalized = subcategoria.normalize("NFD").replace(/[^\w\s]/g, "").toUpperCase().trim();
  if (normalized.includes("RELATORIO") && normalized.includes("VIAGEM")) return "RELATORIO_DE_VIAGEM";
  if (normalized.includes("RECIBO") && normalized.includes("VIAGEM")) return "RECIBO_DE_VIAGEM";
  return normalized;
}
