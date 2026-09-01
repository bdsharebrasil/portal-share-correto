// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import { SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarIcon, CheckCircle2, Plus, Trash2, Upload, FileText, Loader2, Send, Save, Link2, ArrowUp, ArrowDown, Eye, ExternalLink, Plane, Users, Wallet, Mail, History } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  resolverCategoriaMovimentacaoShare,
  resolverClienteParaRateio,
  resolverFornecedorSolicitacao,
  resolverModoSolicitacaoPadrao,
  resolverPagoPorSolicitacao,
  resolverTipoRateioPadraoParaDespesa,
  validarSomaPercentualClientes,
  ClienteLinhaRateioInput,
} from "@/components/dashboard/financeiro/solicitacaoPagamentoValidators";
import { syncSaidaFinancialLegs } from "@/lib/saidaFinancialSync";
import { EnviarEmailClienteDialog, type AnexoEmail } from "@/components/dashboard/financeiro/EnviarEmailClienteDialog";

interface SolicitacaoPagamentoModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialData?: any;
  onOpenTravelReports?: () => void;
}

type Periodicidade = "MENSAL" | "SEMESTRAL" | "ANUAL" | "EVENTUAL";

/** Modos exclusivos da solicitação de pagamento. */
type ModoSolicitacao = "SHARE" | "REEMBOLSO" | "DIRETO";
type CategoriaShareOption = { id: string; nome: string };

const MODOS: { key: ModoSolicitacao; titulo: string; descricao: string; impacto: string; resultado: string; accent: string; dot: string; text: string }[] = [
  {
    key: "SHARE",
    titulo: "Envio de pagamento para o caixa Share",
    descricao: "Despesa da própria Share (luz, compras, administrativo). Gera apenas contas a pagar no caixa Share.",
    impacto: "A Share é a pagadora e a despesa fica no caixa interno.",
    resultado: "Uma conta a pagar no caixa Share",
    accent: "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/25",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "REEMBOLSO",
    titulo: "Envio despesa cliente com reembolso",
    descricao: "A Share paga adiantado e cobra o reembolso do cliente após a baixa.",
    impacto: "A Share paga agora; o cliente reembolsa depois.",
    resultado: "Despesa Share + reembolso do cliente",
    accent: "border-amber-500/40 bg-amber-50 dark:bg-amber-950/25",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
  },
  {
    key: "DIRETO",
    titulo: "Envio cliente direto",
    descricao: "Despesa paga diretamente pelo cliente. Não passa pelo caixa Share, apenas rateio de despesas.",
    impacto: "O cliente assume o pagamento direto, sem saída no caixa Share.",
    resultado: "Lançamento no caixa do cliente",
    accent: "border-violet-500/40 bg-violet-50 dark:bg-violet-950/25",
    dot: "bg-violet-500",
    text: "text-violet-700 dark:text-violet-300",
  },
];


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
  numero_voo?: string | null;
  comanda: string | null;
  nf: string | null;
  data: string | null;
  valor_total: number | null;
  litros: number | null;
  local: string | null;
  status: string | null;
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
  clienteId?: string | null;
}

const MODO_RESUMOS: Record<ModoSolicitacao, Array<{ label: string; value: string }>> = {
  SHARE: [
    { label: "Quem paga", value: "Caixa Share" },
    { label: "Para onde vai", value: "Contas a pagar" },
    { label: "Rateio", value: "Não se aplica" },
  ],
  REEMBOLSO: [
    { label: "Quem paga", value: "Share primeiro" },
    { label: "Recuperação", value: "Cliente depois" },
    { label: "Gera", value: "Despesa + reembolso" },
  ],
  DIRETO: [
    { label: "Quem paga", value: "Cliente" },
    { label: "Caixa Share", value: "Não movimenta" },
    { label: "Gera", value: "Rateio do cliente" },
  ],
};

const TIPOS_ANEXO: { value: AnexoDoc["tipo"]; label: string }[] = [
  { value: "nf", label: "Nota Fiscal" },
  { value: "recibo", label: "Recibo" },
  { value: "boleto", label: "Boleto" },
  { value: "demonstrativo", label: "Demonstrativo" },
  { value: "doc", label: "Documento" },
];

const BUCKET = "n.f-boletos-clients";

function sanitizeFileName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.slice(dotIndex + 1) : "";

  const cleanBase = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .trim()
    .replace(/\s+/g, "_") 
    .replace(/[^a-zA-Z0-9_-]/g, "") 
    .slice(0, 100); 

  const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const finalBase = cleanBase || "arquivo";
  return cleanExt ? `${finalBase}.${cleanExt}` : finalBase;
}

const TIPOS_COMBUSTIVEL = ["AVGAS", "JET A-1"] as const;

const up = (value: string) => (value || "").toUpperCase();

type SocioOption = { id: string; nome: string; percentual_participacao?: number | null };
type TipoDespesaOption = { 
  id: string; 
  expense_type: string; 
  subcategoria_1?: string | null; 
  subcategoria_2?: string | null; 
  subcategoria_3?: string | null; 
  subcategoria_4?: string | null; 
};
type FornecedorOption = { id: string; label: string; source: "favorito" | "combustivel" };
type AeronaveOption = { id: string; matricula: string; modelo: string };
type ReciboOption = { id: string; numero_recibo?: string | null; numero?: string | null; numero_documento?: string | null; pdf_url?: string | null; arquivo_url?: string | null; valor_total?: number | null; created_at?: string | null; criado_em?: string | null; clientes_id?: string | null; clientes_id?: string | null; aeronave_id?: string | null; data_emissao?: string | null };
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

export function SolicitacaoPagamentoModal({ open, onOpenChange, initialData, onOpenTravelReports }: SolicitacaoPagamentoModalProps) {
  const [etapaAtual, setEtapaAtual] = useState(initialData ? 1 : 0);
  const [concluido, setConcluido] = useState(false);

  const initialReferenceId = initialData?.reference_id ?? null;
  const initialModo = initialData?.modo ?? null;
  const initialDataHydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (open) {
      setEtapaAtual(initialData ? 1 : 0);
      setConcluido(false);
      setEmailPayload(null);
    }
  }, [open, initialReferenceId, initialModo]);

  const [tiposDespesa, setTiposDespesa] = useState<TipoDespesaOption[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorOption[]>([]);
  const [aeronaves, setAeronaves] = useState<AeronaveOption[]>([]);
  const [recibosExistentes, setRecibosExistentes] = useState<ReciboOption[]>([]);
  const [clientesDaAeronave, setClientesDaAeronave] = useState<ClienteAeronaveOption[]>([]);

  const [aeronaveId, setAeronaveId] = useState("");
  const [tipoDespesa, setTipoDespesa] = useState("");
  const [tipoDespesaLabel, setTipoDespesaLabel] = useState("");
  const [tipoDespesaBase, setTipoDespesaBase] = useState("");
  const [subcategoriaSel, setSubcategoriaSel] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("EVENTUAL");
  const [tipoRateio, setTipoRateio] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [dataEmissao, setDataEmissao] = useState<Date | undefined>(new Date());
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(new Date());
  const [anexos, setAnexos] = useState<AnexoDoc[]>([]);
  const [gerarContasAPagar, setGerarContasAPagar] = useState(true);
  const [gerarContasAReceber, setGerarContasAReceber] = useState(false);
  const [gerarCaixaCliente, setGerarCaixaCliente] = useState(false);

  /** Modo da solicitação — determina os passos e lançamentos financeiros do fluxo. */
  const [modo, setModo] = useState<ModoSolicitacao | null>(null);
  const [categoriasShare, setCategoriasShare] = useState<CategoriaShareOption[]>([]);
  const [categoriaShareId, setCategoriaShareId] = useState("");
  const [categoriaShareLabel, setCategoriaShareLabel] = useState("");


  const [usarReciboExistente, setUsarReciboExistente] = useState(false);
  const [reciboExistenteId, setReciboExistenteId] = useState("");
  const [reciboExistentePorCliente, setReciboExistentePorCliente] = useState<Record<string, string>>({});
  const [referenciaDuplicada, setReferenciaDuplicada] = useState<{ tipo: "abastecimento" | "travel_expense_report" | "recibo" | null; id: string | null; mensagem: string | null }>({ fluxo: null, id: null, mensagem: null });

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
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailPayload, setEmailPayload] = useState<{
    clienteId: string | null;
    assunto: string;
    mensagem: string;
    anexos: AnexoEmail[];
    referenceIds: string[];
  } | null>(null);

  const [fuelComanda, setFuelComanda] = useState("");
  const [fuelNf, setFuelNf] = useState("");
  const [fuelLookupLoading, setFuelLookupLoading] = useState(false);
  const [fuelLookupResult, setFuelLookupResult] = useState<AbastecimentoLookup | null>(null);
  const [fuelLookupSearched, setFuelLookupSearched] = useState(false);

  const navigate = useNavigate();

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

  const novoAbastLitrosNum = Number(String(novoAbast.litros).replace(",", ".")) || 0;
  const novoAbastValorUnitarioNum = Number(String(novoAbast.valor_unitario).replace(",", ".")) || 0;
  const novoAbastValorTotalCalculado = +(novoAbastLitrosNum * novoAbastValorUnitarioNum).toFixed(2);

  const [taxaOrigem, setTaxaOrigem] = useState<TaxaOrigem>(null);
  const [taxaRecibos, setTaxaRecibos] = useState<TaxaReciboOption[]>([]);
  const [taxaReciboId, setTaxaReciboId] = useState("");
  const [taxaReciboPorCliente, setTaxaReciboPorCliente] = useState<Record<string, string>>({});
  const [taxaRecibosMultiplos, setTaxaRecibosMultiplos] = useState<string[]>([]);

  /** Categorias do caixa Share (tabela categorias_movimentacao). */
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("categorias_movimentacao")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      setCategoriasShare(((data as CategoriaShareOption[] | null) || []).filter((c) => !!c?.id && !!c?.nome));
    })();
  }, [open]);

  /** O modo selecionado define, de forma exclusiva, os fluxos financeiros gerados. */
  useEffect(() => {
    if (modo === "SHARE") {
      setGerarContasAPagar(true); setGerarContasAReceber(false); setGerarCaixaCliente(false);
    } else if (modo === "REEMBOLSO") {
      setGerarContasAPagar(true); setGerarContasAReceber(true); setGerarCaixaCliente(false);
    } else if (modo === "DIRETO") {
      setGerarContasAPagar(false); setGerarContasAReceber(false); setGerarCaixaCliente(true);
    } else {
      setGerarContasAPagar(false); setGerarContasAReceber(false); setGerarCaixaCliente(false);
    }
  }, [modo]);

  /** Trocar de fluxo deve ser uma ação direta: a escolha atual é substituída sem exigir um segundo clique. */
  const handleModoClick = (key: ModoSolicitacao) => {
    setModo(key);
  };

  const isModoShare = modo === "SHARE";
  const modoCfg = MODOS.find((m) => m.key === modo) || null;


  useEffect(() => {
    if (!open) return;
    (async () => {
      const [tip, ff, fc, aer, rec] = await Promise.all([
        supabase.from("expense_configu").select("id, expense_type, subcategoria_1, subcategoria_2, subcategoria_3, subcategoria_4").order("expense_type"),
        supabase.from("fornecedores_favoritos").select("id, nome_completo, apelido").order("nome_completo"),
        supabase.from("fornecedores_combustivel").select("id, nome_fornecedor, nome_cidade").order("nome_fornecedor"),
        supabase.from("aeronave").select("id, matricula, modelo").order("matricula"),
        supabase.from("recibos").select("id, numero_recibo, numero_documento, pdf_url, valor_total, criado_em, clientes_id, aeronave_id, data_emissao").order("criado_em", { ascending: false }),
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
    if (!open) {
      initialDataHydratedRef.current = null;
      return;
    }
    if (!initialData) return;
    const hydrateKey = `${initialData.reference_type || ""}:${initialData.reference_id || ""}:${initialData.modo || initialData.flow_mode || ""}`;
    if (initialDataHydratedRef.current === hydrateKey) return;
    initialDataHydratedRef.current = hydrateKey;
    try {
      const modoPredefinido = resolverModoSolicitacaoPadrao({
        modo: initialData.modo || initialData.flow_mode || null,
        origemReciboReembolso: Boolean(initialData.origem_recibo_reembolso),
      });
      if (modoPredefinido) setModo(modoPredefinido as ModoSolicitacao);

      if (initialData.data_emissao) setDataEmissao(new Date(initialData.data_emissao));
      if (initialData.data_vencimento) setDataVencimento(new Date(initialData.data_vencimento));
      if (initialData.descricao_despesa) setDescricao(initialData.descricao_despesa);
      if (initialData.descricao) setDescricao(initialData.descricao);
      if (initialData.valor_total_despesa != null) setValorTotal(String(initialData.valor_total_despesa));
      if (initialData.cliente_id) setClienteId(initialData.cliente_id);
      if (initialData.clientes_nome || initialData.fornecedor_nome) {
        setFornecedorNome(initialData.fornecedor_nome || initialData.clientes_nome);
      }
      if (initialData.socio_id) setSocioId(initialData.socio_id);
      if (initialData.aeronave_id) setAeronaveId(initialData.aeronave_id);
      if (initialData.reference_type && initialData.reference_id) {
        setReferenciaDuplicada({
          tipo: initialData.reference_type,
          id: initialData.reference_id,
          mensagem: initialData.reference_type === "abastecimento" ? "Abastecimento vinculado à programação." : null,
        });
      }
      if (initialData.numero_recibo) setReferenciaNumero(initialData.numero_recibo);
      if (initialData.numero_doc) setReferenciaNumero(initialData.numero_doc);
      if (initialData.periodicidade) setPeriodicidade(initialData.periodicidade as Periodicidade);
      if (initialData.tipo_rateio) setTipoRateio(initialData.tipo_rateio);
      if (initialData.percentual_uso != null) setPercentualUso(String(initialData.percentual_uso));

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

      if (Array.isArray(initialData.anexos) && initialData.anexos.length) {
        const mapped = initialData.anexos.map((a: any, idx: number) => ({
          id: `prefill-${idx}`,
          tipo: a.tipo || (a.url && a.url.includes("boleto") ? "boleto" : "doc"),
              numero: a.numero || initialData.numero_nf || initialData.numero_recibo || initialData.numero_doc || "",
          arquivo: null,
          url: a.url || a.url_boleto || a.url_nf || a.url_pdf || null,
          socioId: a.socioId || null,
        }));
        setAnexos(mapped as AnexoDoc[]);
      } else {
        const possible = [] as AnexoDoc[];
        if (initialData.boleto_url) possible.push({ id: "prefill-boleto", tipo: "boleto", numero: "", arquivo: null, url: initialData.boleto_url, socioId: null });
        if (initialData.nf_url) possible.push({ id: "prefill-nf", tipo: "nf", numero: initialData.numero_nf || "", arquivo: null, url: initialData.nf_url, socioId: null });
        if (initialData.demonstrativo_url) possible.push({ id: "prefill-dem", tipo: "demonstrativo", numero: initialData.numero_doc || "", arquivo: null, url: initialData.demonstrativo_url, socioId: null });
        if (initialData.pdf_url || initialData.recibo_url) possible.push({ id: "prefill-recibo", tipo: "recibo", numero: initialData.numero_recibo || "", arquivo: null, url: initialData.pdf_url || initialData.recibo_url, socioId: null });
        if (possible.length) setAnexos(possible);
      }

      if (initialData.origem_recibo_reembolso) {
        setGerarContasAPagar(true);
        setGerarContasAReceber(true);
        setGerarCaixaCliente(false);
        setReferenciaDuplicada({
          tipo: "recibo",
          id: initialData.reference_id || null,
          mensagem: initialData.numero_recibo ? `Origem: recibo de reembolso ${initialData.numero_recibo}` : null,
        });
      }
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
  }, [open, initialData, tiposDespesa]);

  useEffect(() => {
    if (initialData?.reference_type === "abastecimento" && initialData?.reference_id) return;
    setClienteLinhas([]);
    setClienteId("");
    setSocioId("");
    setSociosExcluidos([]);
  }, [aeronaveId, initialData]);

  useEffect(() => {
    if (initialData?.reference_type !== "abastecimento" || !initialData?.reference_id || !clienteId || clienteLinhas.length > 0) return;
    setClienteLinhas([{
      uid: crypto.randomUUID(),
      clienteId,
      percentualUsoCliente: "100",
      overridesSocio: {},
      valorOverridesSocio: {},
    }]);
  }, [initialData, clienteId, clienteLinhas.length]);

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
  const etapaLabels = isModoShare
    ? ["Classificação", "Documentos e vencimento"]
    : isViagemMode
      ? ["Contexto da viagem", "Origem e rateio", "Fechamento"]
      : ["Base da despesa", "Clientes e rateio", "Fechamento"];
  const etapaVisual = isModoShare && etapaAtual === 3 ? 2 : etapaAtual;
  const etapaLabel = etapaVisual > 0 ? etapaLabels[etapaVisual - 1] : "Escolha o fluxo";

  const tipoDespesaSel = useMemo(() => tiposDespesa.find((t) => t.id === tipoDespesa), [tiposDespesa, tipoDespesa]);
  const subcategoriasDisponiveis = useMemo(() => {
    const arr: string[] = [];
    if (tipoDespesaSel?.subcategoria_1) arr.push(tipoDespesaSel.subcategoria_1);
    if (tipoDespesaSel?.subcategoria_2) arr.push(tipoDespesaSel.subcategoria_2);
    if (tipoDespesaSel?.subcategoria_3) arr.push(tipoDespesaSel.subcategoria_3);
    if (tipoDespesaSel?.subcategoria_4) arr.push(tipoDespesaSel.subcategoria_4);
    return arr;
  }, [tipoDespesaSel]);
  
  const isSubcat1Sel = !!(tipoDespesaSel?.subcategoria_1 && subcategoriaSel && subcategoriaSel === tipoDespesaSel.subcategoria_1);
  const isSubcat2Sel = !!(tipoDespesaSel?.subcategoria_2 && subcategoriaSel && subcategoriaSel === tipoDespesaSel.subcategoria_2);
  const isSubcat3Sel = !!(tipoDespesaSel?.subcategoria_3 && subcategoriaSel && subcategoriaSel === tipoDespesaSel.subcategoria_3);
  const isSubcat4Sel = !!(tipoDespesaSel?.subcategoria_4 && subcategoriaSel && subcategoriaSel === tipoDespesaSel.subcategoria_4);

  useEffect(() => {
    const labelDespesa = (tipoDespesaBase || tipoDespesaLabel || "").trim();
    const tipoRateioAutomatico = resolverTipoRateioPadraoParaDespesa(labelDespesa);
    if (tipoRateioAutomatico) {
      setTipoRateio(tipoRateioAutomatico);
    } else {
      setTipoRateio("");
    }
  }, [tipoDespesaBase, tipoDespesaLabel]);

  useEffect(() => {
    if (!open || !isReciboFirstMode || !aeronaveId) {
      setTaxaRecibos([]);
      setTaxaReciboId("");
      return;
    }
    const filtroCategoria = tipoDespesaBase || tipoDespesaLabel || "";
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
          percentualUsoCliente: pctRecibo > 0 ? pctRecibo.toFixed(2) : linha.percentualUsoCliente,
        };
      })
    );
  }, [isReciboFirstMode, taxaReciboId, taxaReciboPorCliente, taxaRecibos, clienteLinhas.length, clienteId]);

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
        .select("id, numero_voo, comanda, nf, data, valor_total, litros, local, status, comprovante_pagamento, boleto_url, nota_url, comprovante_url, comanda_url, data_vencimento_boleto, abastecedor, abastecedor_id, data_pagamento")
        .order("data", { ascending: false })
        .limit(1);
      if (aeronaveId) q = q.eq("aeronave_id", aeronaveId);
      if (fuelComanda) q = q.eq("comanda", fuelComanda);
      if (fuelNf) q = q.eq("nf", fuelNf);
      const { data } = await q;
      const found = (data && data[0]) as AbastecimentoLookup | undefined;
      if (found) {
        let abastecimentoComVoo = found;
        if (!found.numero_voo && found.data && clienteId && clienteId !== "__all__" && aeronaveId) {
          const { data: voosCompatíveis } = await (supabase as any)
            .from("solicitacoes_reserva_voo")
            .select("id, numero_voo")
            .eq("cliente_id", clienteId)
            .eq("aeronave_id", aeronaveId)
            .eq("data_agendada", found.data)
            .not("numero_voo", "is", null)
            .limit(2);
          if (voosCompatíveis?.length === 1 && voosCompatíveis[0]?.numero_voo) {
            const numeroVoo = String(voosCompatíveis[0].numero_voo).trim().toUpperCase();
            const { error: atualizacaoError } = await (supabase as any)
              .from("abastecimentos")
              .update({ numero_voo: numeroVoo })
              .eq("id", found.id);
            if (!atualizacaoError) abastecimentoComVoo = { ...found, numero_voo: numeroVoo };
          }
        }
        setFuelLookupResult(abastecimentoComVoo);
        if (abastecimentoComVoo.valor_total) setValorTotal(String(Number(abastecimentoComVoo.valor_total).toFixed(2)));
        setReferenciaDuplicada({
          tipo: "abastecimento",
          id: abastecimentoComVoo.id,
          mensagem: `✓ Abastecimento encontrado (Comanda ${abastecimentoComVoo.comanda || "—"} / NF ${abastecimentoComVoo.nf || "—"})${abastecimentoComVoo.numero_voo ? ` · Voo ${abastecimentoComVoo.numero_voo}` : ""}`,
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
    const path = `abastecimentos/${aeronaveId || "sem-aeronave"}/${folder}/${Date.now()}-${sanitizeFileName(file.name)}`;
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
        numero_voo: String(initialData?.numero_voo ?? initialData?.numero_agendamento ?? "").trim().toUpperCase() || null,
        id_clientes: clienteId && clienteId !== "__all__" ? clienteId : null,
        data: novoAbast.data,
        data_vencimento_boleto: novoAbast.data_vencimento_boleto || null,
        local: novoAbast.local || null,
        trecho: novoAbast.trecho || "",
        litros: litrosNum || null,
        valor_unitario: vuNum || null,
        comanda: fuelComanda || null,
        nf: fuelNf || null,
        abastecedor_id: novoAbast.abastecedor_id || null,
        abastecedor: supplier?.label || null,
        tipo_combustivel: novoAbast.tipo_combustivel || null,
        observacao: novoAbast.observacao || null,
        comanda_url: comandaUrl,
        nota_url: notaUrl,
        boleto_url: boletoUrl,
        status: "em aberto",
      };
      const { data, error } = await (supabase as any)
        .from("abastecimentos")
        .insert(payload)
        .select("id, numero_voo, comanda, nf, data, valor_total, litros, local, status, comprovante_pagamento, boleto_url, nota_url, comprovante_url, comanda_url, data_vencimento_boleto, abastecedor, abastecedor_id, data_pagamento")
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

  const anexosClienteOptions = useMemo(() => {
    return clienteLinhas
      .map((linha) => {
        const info = getClienteAeronaveInfo(linha.clienteId);
        return { id: linha.clienteId, nome: info?.razaoSocial || "Cliente" };
      })
      .filter((c) => c.id);
  }, [clienteLinhas, clientesDaAeronave]);


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
  const valorParaRevisao = useMemo(() => {
    if (taxaRecibosMultiplos.length === 0) return valorNumerico;
    return +(taxaRecibosMultiplos.reduce((sum, reciboId) => {
      const recibo = taxaRecibos.find((item) => item.id === reciboId);
      return sum + (Number(recibo?.valor_total) || 0) / 100;
    }, 0)).toFixed(2);
  }, [taxaRecibos, taxaRecibosMultiplos, valorNumerico]);
  const percNumerico = Number(String(percentualUso).replace(",", ".")) || 0;

  const isRateioIgualContext = useMemo(() => {
    const indicador = `${tipoDespesaLabel || ""} ${descricao || ""}`.toUpperCase();
    const match =
      indicador.includes("VOO TESTE") ||
      indicador.includes("VOO DE CHECK") ||
      indicador.includes("VOO TRANSLADO") ||
      Boolean(initialData?.divisao_igual) ||
      Boolean(initialData?.equal_split);
    return match;
  }, [tipoDespesaLabel, descricao, initialData]);

  const linhasRateioPreview = useMemo(() => montarLinhasRateio({
    valorTotal: valorNumerico,
    percentualUso: percNumerico,
    socios: sociosParaRateio,
    socioSelecionadoId: socioId || null,
    equalSplit: isRateioIgualContext,
  }), [valorNumerico, percNumerico, sociosParaRateio, socioId, isRateioIgualContext]);

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
    return montarLinhasRateioMultiCliente({ valorTotal: valorNumerico, linhas: linhasInput, equalSplit: isRateioIgualContext });
  }, [clienteLinhas, clientesDaAeronave, valorNumerico, isViagemMode, socioId, isRateioIgualContext]);

  const socioIdDaMovimentacaoCliente = (idCliente: string) => {
    if (socioId) return socioId;
    const sociosDoCliente = [...new Set(
      linhasRateioMultiCliente
        .filter((linha) => linha.cliente_id === idCliente && linha.socio_id)
        .map((linha) => linha.socio_id),
    )];
    return sociosDoCliente.length === 1 ? sociosDoCliente[0] : null;
  };

  const somaPercentualClientes = clienteLinhas.reduce((sum, l) => sum + (Number(String(l.percentualUsoCliente).replace(",", ".")) || 0), 0);
  const erroSomaClientes = !isViagemMode && clienteLinhas.length > 0
    ? validarSomaPercentualClientes(clienteLinhas.map((l) => ({ percentualUsoCliente: Number(String(l.percentualUsoCliente).replace(",", ".")) || 0 })))
    : null;

  const clienteIdParaDedup = isViagemMode ? clienteId : (clienteLinhas.length === 1 ? clienteLinhas[0].clienteId : "");

  useEffect(() => {
    const verificarDuplicidade = async () => {
      if (initialData?.reference_type && initialData?.reference_id) return;
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
  }, [clienteIdParaDedup, dataEmissao, descricao, tipoDespesaLabel, valorNumerico, reciboExistenteId, usarReciboExistente, recibosExistentes, initialData]);

  const isAdmShareType = useMemo(() => {
    const label = (tipoDespesaLabel || "").trim().toUpperCase();
    return label === "ADM SHARE BRASIL" || label === "ADM E TRIP SHARE BRASIL";
  }, [tipoDespesaLabel]);

  useEffect(() => {
    if (isAdmShareType && !gerarCaixaCliente) setGerarContasAReceber(true);
  }, [isAdmShareType, gerarCaixaCliente]);

  const toggleCaixaCliente = (checked: boolean) => {
    setGerarCaixaCliente(checked);
    if (checked) {
      setGerarContasAPagar(false);
      setGerarContasAReceber(false);
    } else {
      setGerarContasAPagar(true);
    }
  };

  const resetForm = (options: { keepSuccess?: boolean } = {}) => {
    setEtapaAtual(0);
    if (!options.keepSuccess) {
      setConcluido(false);
      setEmailPayload(null);
    }
    setModo(null); setCategoriaShareId(""); setCategoriaShareLabel("");
    setAeronaveId(""); 
    setTipoDespesa(""); setTipoDespesaLabel(""); setDescricao(""); setValorTotal("");
    setPercentualUso("100"); setPeriodicidade("EVENTUAL"); setTipoRateio(""); setObservacoes("");
    setFornecedorId(""); setFornecedorNome("");
    setDataEmissao(new Date()); setDataVencimento(new Date()); setAnexos([]);
    setGerarContasAPagar(true); setGerarContasAReceber(false); setGerarCaixaCliente(false);
    setUsarReciboExistente(false); setReciboExistenteId(""); setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
    setTravelReportId(""); setTravelReports([]); setReferenciaNumero("");
    setClienteLinhas([]); setClienteId(""); setSocioId(""); setSociosExcluidos([]);
    setFuelComanda(""); setFuelNf(""); setFuelLookupResult(null); setFuelLookupSearched(false);
    setTaxaOrigem(null); setTaxaRecibos([]); setTaxaReciboId(""); setTaxaReciboPorCliente({}); setTaxaRecibosMultiplos([]);
  };

  const podeAvancar = () => {
    if (etapaAtual === 1) {
      if (isModoShare) return !!(categoriaShareId && periodicidade && descricao.trim() && valorNumerico > 0);
      const baseOk = !!(modo && aeronaveId && tipoRateio && periodicidade && tipoDespesaLabel);
      if (isViagemMode) return baseOk && (!!clienteId || !!socioId);
      return baseOk && !!descricao.trim() && valorNumerico > 0;
    }
    if (etapaAtual === 2) {
      if (isModoShare) return true;
      if (isViagemMode) {
        if (!clienteId) return false;
        if (isRelatorioViagemMode) return !!travelReportId;
        if (isReciboViagemMode) return !!reciboExistenteId;
        return true;
      }
      return clienteLinhas.length > 0 && clienteLinhas.every((l) => !!l.clienteId) && !erroSomaClientes;
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
        const path = `solicitacoes/${aeronaveId || "sem-aeronave"}/${Date.now()}-${sanitizeFileName(a.arquivo.name)}`;
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

  // Funções exclusivas para pegar arquivos GLOBAIS (sem cliente/sócio) para fallback:
  const pickUrl = (list: AnexoDoc[], tipo: AnexoDoc["tipo"]) =>
    list.find((a) => a.tipo === tipo && !a.socioId && !a.clienteId)?.url || null;
  // Número: se não houver anexo global, usa o número de qualquer anexo do mesmo tipo
  const pickNumero = (list: AnexoDoc[], tipo: AnexoDoc["tipo"]) =>
    list.find((a) => a.tipo === tipo && !a.socioId && !a.clienteId && a.numero?.trim())?.numero?.trim() ||
    list.find((a) => a.tipo === tipo && a.numero?.trim())?.numero?.trim() ||
    null;
  
  const pickAnexoParaRateio = (list: AnexoDoc[], tipo: AnexoDoc["tipo"], clienteId: string | null, socioId: string | null) =>
    list.find((a) => a.tipo === tipo && !!socioId && a.socioId === socioId) ||
    list.find((a) => a.tipo === tipo && !!clienteId && !a.socioId && a.clienteId === clienteId) ||
    list.find((a) => a.tipo === tipo && !a.socioId && !a.clienteId) ||
    null;

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

  const resolveCategoriaConta = async (
    nomeCategoria: string,
    userId: string | null,
    reembolsavel = false,
    subcategoria: string | null = null,
  ) => {
    const categoriaLimpa = (nomeCategoria || '').trim();
    if (!categoriaLimpa) return null;

    const categoriaInfo = resolverCategoriaMovimentacaoShare({
      nomeCategoria: categoriaLimpa,
      subcategoria,
      reembolsavel,
    });

    const { data: expenseConfig } = await (supabase as any)
      .from('expense_configu')
      .select('id, expense_type')
      .ilike('expense_type', categoriaLimpa)
      .limit(1)
      .maybeSingle();

    const nomeParaCategoria = (expenseConfig?.expense_type as string | null) || categoriaLimpa;
    const nomeCategoriaFinal = categoriaInfo.nome || nomeParaCategoria;

    const { data: categoriaExistente } = await (supabase as any)
      .from('categorias_movimentacao')
      .select('id, nome, grupo_categoria, reembolsavel')
      .eq('tipo', 'despesa')
      .ilike('nome', nomeCategoriaFinal)
      .eq('grupo_categoria', categoriaInfo.grupo_categoria)
      .limit(1)
      .maybeSingle();

    if ((categoriaExistente as { id?: string | null } | null)?.id) {
      return (categoriaExistente as { id?: string | null }).id as string;
    }

    const fallbackName = nomeCategoriaFinal.length > 80 ? nomeCategoriaFinal.slice(0, 80) : nomeCategoriaFinal;
    try {
      const { data: categoriaCriada } = await supabase
        .from('categorias_movimentacao')
        .insert({
          nome: fallbackName,
          tipo: 'despesa',
          grupo_categoria: categoriaInfo.grupo_categoria,
          reembolsavel: categoriaInfo.reembolsavel,
          ativo: true,
          criado_por: userId,
        } as any)
        .select('id')
        .single();
      return categoriaCriada?.id || null;
    } catch { return null; }
  };

  const criarTipoDespesa = async (label: string) => {
    const supabaseClient = supabase as unknown as SupabaseClientLike;
    const { data, error } = await supabaseClient.from("expense_configu").insert({ expense_type: up(label) }).select("id, expense_type").single();
    if (error) { toast.error("Falha ao criar tipo"); return; }
    setTiposDespesa((prev) => [...prev, data as TipoDespesaOption]);
    setTipoDespesa(data.id);
    setTipoDespesaLabel(data.expense_type);
    toast.success(`Tipo "${data.expense_type}" adicionado`);
  };

  const normalizeClienteId = (value: string | null | undefined): string | null => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (lower === "__all__" || lower === "all" || lower === "todos") return null;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(trimmed)) return null;
    return trimmed;
  };

  const validar = (): string | null => {
    if (!modo) return "Selecione o modo da solicitação";

    if (isModoShare) {
      if (!descricao.trim()) return "Descreva a despesa";
      if (!categoriaShareId) return "Selecione a categoria do caixa Share";
      if (valorNumerico <= 0) return "Informe um valor válido";
      if (!dataVencimento) return "Data de vencimento é obrigatória";
      return null;
    }

    if (!aeronaveId) return "Selecione a aeronave";
    if (!descricao.trim()) return "Descreva a despesa";
    if (!tipoDespesaLabel) return "Selecione o tipo de despesa";
    if (valorNumerico <= 0) return "Informe um valor válido";
    if (!dataVencimento) return "Data de vencimento é obrigatória";
    if (!gerarContasAPagar && !gerarContasAReceber && !gerarCaixaCliente) return "Selecione ao menos uma opção: Despesa Share, Conta a Receber do cliente ou Envio despesa caixa cliente";


    if (isViagemMode) {
      if (!clienteId && !socioId) return "Selecione o cliente ou o sócio";
      if (isRelatorioViagemMode && !travelReportId) return "Selecione o relatório de viagem";
      if (isReciboViagemMode && !reciboExistenteId) return "Selecione o recibo de viagem";
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
      const movimentacaoIdsCriadas: string[] = [];

      const dataVenc = format(dataVencimento!, "yyyy-MM-dd");
      const dataComp = format(dataEmissao || new Date(), "yyyy-MM-dd");
      const numeroVooVinculado = String(initialData?.numero_voo ?? initialData?.numero_agendamento ?? fuelLookupResult?.numero_voo ?? "").trim().toUpperCase() || null;
      const statusMov = rascunho ? "rascunho" : "pendente";
      const statusCP = rascunho ? "rascunho" : "pendente";
      const tipoRateioFinal = normalizarTipoRateio(tipoRateio);
      const isReembolsoRecibo = Boolean(initialData?.origem_recibo_reembolso);
      const categoriaMovimentacaoShare = resolverCategoriaMovimentacaoShare({
        nomeCategoria: isModoShare ? categoriaShareLabel : tipoDespesaLabel || "Despesa",
        subcategoria: subcategoriaSel || null,
        reembolsavel: modo === "REEMBOLSO" || gerarContasAReceber || isReembolsoRecibo,
      });

      /* ---- Modo 1: despesa da própria Share (não envolve cliente nem rateio) ---- */
      if (isModoShare) {
        const anexosShare = await uploadAnexos();
        const nfUrlShare = pickUrl(anexosShare, "nf");
        const reciboUrlShare = pickUrl(anexosShare, "recibo");
        const boletoUrlShare = pickUrl(anexosShare, "boleto");
        const docUrlShare = pickUrl(anexosShare, "doc");
        const demonstrativoUrlShare = pickUrl(anexosShare, "demonstrativo");

        const dadosBancariosShare = [
          initialData?.bank_name ? `Banco: ${initialData.bank_name}` : null,
          initialData?.bank_agency ? `Agência: ${initialData.bank_agency}` : null,
          initialData?.bank_account ? `Conta: ${initialData.bank_account}` : null,
          initialData?.bank_pix ? `PIX: ${initialData.bank_pix}` : null,
        ].filter(Boolean).join(" | ");
        const observacoesShare = [observacoes, dadosBancariosShare].filter(Boolean).join("\n") || null;
        const capIdShare = await insertAndGetId("contas_apagar", {
          data_vencimento: dataVenc, data_agendamento: dataVenc, valor: valorNumerico,
          categoria: categoriaMovimentacaoShare.nome || categoriaShareLabel || "Despesa Share", categoria_id: categoriaShareId,
          descricao: descricao.trim(), status: statusCP, observacoes: observacoesShare,
          banco_pagamento: initialData?.bank_name || null,
          conta_pagamento_fornecedor: [initialData?.bank_agency, initialData?.bank_account, initialData?.bank_pix].filter(Boolean).join(" | ") || null,
          fornecedor_favorito_id: fornecedorSel?.source === "favorito" ? fornecedorId : null,
          fornecedor_combustivel_id: fornecedorSel?.source === "combustivel" ? fornecedorId : null,
          fornecedor_nome: (fornecedorNome || "").trim() || null,
          possui_boleto: !!boletoUrlShare, boleto_url: boletoUrlShare, vencimento_boleto: boletoUrlShare ? dataVenc : null,
          possui_nf: !!nfUrlShare, nf_numero: pickNumero(anexosShare, "nf"), nf_url: nfUrlShare,
          possui_recibo: !!reciboUrlShare, numero_recibo: pickNumero(anexosShare, "recibo"), recibo_url: reciboUrlShare,
          numero_doc: pickNumero(anexosShare, "doc"), arquivo_pdf_url: docUrlShare, criado_por: userId,
        });

        let movIdShare: string;
        try {
          movIdShare = await insertAndGetId("movimentacoes", {
            descricao: descricao.trim(), fluxo: "saida", tipo_caixa: "share",
            categoria_id: categoriaShareId, categoria_nome: categoriaMovimentacaoShare.nome || categoriaShareLabel || null,
            grupo_categoria: categoriaMovimentacaoShare.grupo_categoria,
            reembolsavel: categoriaMovimentacaoShare.reembolsavel,
            valor_rateado: valorNumerico, valor_total: valorNumerico,
            data_emissao: dataComp, data_vencimento: dataVenc, status: statusMov,
            periodicidade, tipo_rateio: tipoRateioFinal,
            fornecedor_nome: (fornecedorNome || "").trim() || null,
            numero_nf: pickNumero(anexosShare, "nf"), numero_recibo: pickNumero(anexosShare, "recibo"),
            numero_boleto: pickNumero(anexosShare, "boleto"), numero_doc: pickNumero(anexosShare, "doc"),
            nf_url: nfUrlShare, recibo_url: reciboUrlShare, boleto_url: boletoUrlShare, comprovante_url: docUrlShare, demonstrativo_url: demonstrativoUrlShare,
            observacoes: observacoesShare, contas_apagar_id: capIdShare,
            reference_type: "solicitacao_pagamento", criado_por: userId,
          });
          movimentacaoIdsCriadas.push(movIdShare);
        } catch (movErr) {
          await supabase.from("contas_apagar").delete().eq("id", capIdShare);
          throw movErr;
        }
        await supabase.from("contas_apagar").update({ movimentacao_id: movIdShare }).eq("id", capIdShare);

        toast.success(rascunho ? "Rascunho salvo" : "Solicitação de pagamento enviada com sucesso");
        if (rascunho) {
          resetForm();
          onOpenChange(false);
        } else {
          resetForm({ keepSuccess: true });
          setConcluido(true);
          setEtapaAtual(0);
        }
        return;
      }

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
        const { data } = await (supabase as any).from("abastecimentos").select("comprovante_pagamento, comprovante_url, nota_url, boleto_url, comanda, comanda_url, nf").eq("id", referenciaId).single();
        anexosOrigem = data || {};
      }
      if (referenciaTipo === "travel_expense_report" && referenciaId) {
        const { data } = await (supabase as any).from("travel_expense_reports").select("id, pdf_url").eq("id", referenciaId).single();
        anexosOrigem = data || {};
      }

      const isAbastecimentoVinculado = referenciaTipo === "abastecimento";
      const nfUrl = isAbastecimentoVinculado
        ? pickUrl(anexosProc, "nf") || anexosOrigem.nota_url || null
        : pickUrl(anexosProc, "nf") || null;
      const taxaReciboSelecionado = isTaxasMode && !isAllClients ? taxaRecibos.find((r) => r.id === taxaReciboId) || null : null;
      const reciboUrl = pickUrl(anexosProc, "recibo") || (isTaxasMode && taxaRecibosMultiplosData.length > 0 ? taxaRecibosMultiplosData[0]?.url : null) || (isTaxasMode ? taxaReciboSelecionado?.pdf_url : null) || reciboUrlSelecionado;
      const boletoUrl = pickUrl(anexosProc, "boleto") || anexosOrigem.boleto_url || null;
      const docUrl = isAbastecimentoVinculado
        ? anexosOrigem.comanda_url || pickUrl(anexosProc, "doc") || null
        : pickUrl(anexosProc, "doc") || anexosOrigem.pdf_url || null;
      const comandaUrl = isAbastecimentoVinculado ? anexosOrigem.comanda_url || null : docUrl;
      const arquivoPdfUrl = isRelatorioViagemMode
        ? travelReportSel?.pdf_url || docUrl || null
        : isReciboViagemMode
          ? reciboSelecionado?.pdf_url || reciboSelecionado?.arquivo_url || docUrl || null
          : docUrl || null;
      const demonstrativoUrl = pickUrl(anexosProc, "demonstrativo") || null;
      const comprovanteUrl = docUrl || anexosOrigem.comprovante_pagamento || anexosOrigem.comprovante_url || null;
      
      const nfNum = isAbastecimentoVinculado
        ? pickNumero(anexosProc, "nf") || anexosOrigem.nf || null
        : pickNumero(anexosProc, "nf");
      const reciboNum = pickNumero(anexosProc, "recibo") || (isTaxasMode && taxaRecibosMultiplosData.length > 0 ? taxaRecibosMultiplosData[0]?.numero : null) || (isTaxasMode ? taxaReciboSelecionado?.numero_recibo || taxaReciboSelecionado?.numero_documento || null : null) || reciboNumeroSelecionado;
      const boletoNum = pickNumero(anexosProc, "boleto");
      const docNum = isAbastecimentoVinculado
        ? anexosOrigem.comanda || pickNumero(anexosProc, "doc") || null
        : pickNumero(anexosProc, "doc") || (isRelatorioViagemMode && travelReportSel ? travelReportSel.numero_relatorio : null) || (isReciboViagemMode ? referenciaNumero : null);
      
      const subcategoria1Val = isSubcat1Sel ? subcategoriaSel : null;
      const subcategoria2Val = isSubcat2Sel ? subcategoriaSel : null;
      const subcategoria3Val = isSubcat3Sel ? subcategoriaSel : null;
      const subcategoria4Val = isSubcat4Sel ? subcategoriaSel : null;
      const fornecedorNomeFinal = resolverFornecedorSolicitacao({ isViagemMode, fornecedorNome });
      const categoriaContaId = modo === "DIRETO"
        ? null
        : await resolveCategoriaConta(
            tipoDespesaLabel || "Despesa",
            userId,
            categoriaMovimentacaoShare.reembolsavel,
            subcategoriaSel || null,
          );

      const { data: movimentacaoExistente } = referenciaTipo && referenciaId
        ? await (supabase as any).from("movimentacoes").select("id, contas_apagar_id, contas_areceber_id, status").eq("reference_type", referenciaTipo).eq("reference_id", referenciaId).maybeSingle()
        : { data: null };
      const isEdicaoProgramacaoExistente = Boolean(movimentacaoExistente?.id);

      if (isEdicaoProgramacaoExistente && referenciaTipo === "abastecimento" && referenciaId) {
        const categoriaAtualizada = modo === "DIRETO" ? tipoDespesa : categoriaContaId;
        const movimentoUpdate = {
          descricao: descricao.trim(),
          categoria_id: categoriaAtualizada || null,
          categoria_nome: tipoDespesaLabel || null,
          valor_rateado: valorNumericoFinal,
          valor_total: valorNumericoFinal,
          data_emissao: dataComp,
          data_vencimento: dataVenc,
          status: statusMov,
          periodicidade,
          tipo_rateio: tipoRateioFinal,
          fornecedor_nome: fornecedorNomeFinal,
          numero_nf: nfNum,
          numero_boleto: boletoNum,
          numero_doc: docNum,
          nf_url: nfUrl,
          boleto_url: boletoUrl,
          comprovante_url: comprovanteUrl,
          demonstrativo_url: demonstrativoUrl,
          comanda_url: comandaUrl,
          observacoes: obsFinal || null,
          numero_voo: numeroVooVinculado,
          atualizado_em: new Date().toISOString(),
        };
        const { error: movimentoUpdateError } = await (supabase as any)
          .from("movimentacoes")
          .update(movimentoUpdate)
          .eq("id", movimentacaoExistente.id);
        if (movimentoUpdateError) throw movimentoUpdateError;

        const { error: rateioUpdateError } = await (supabase as any)
          .from("rateio_despesas")
          .update({
            data_emissao: dataComp,
            data_vencimento: dataVenc,
            numero_nf: nfNum,
            numero_boleto: boletoNum,
            numero_doc: docNum,
            nf_url: nfUrl,
            boleto_url: boletoUrl,
            comprovante_url: comprovanteUrl,
            demonstrativo_url: demonstrativoUrl,
            observacoes: obsFinal || null,
            numero_voo: numeroVooVinculado,
            atualizado_em: new Date().toISOString(),
          })
          .eq("despesa_id", movimentacaoExistente.id);
        if (rateioUpdateError) throw rateioUpdateError;

        if (movimentacaoExistente.contas_apagar_id) {
          const { error: contaPagarUpdateError } = await (supabase as any)
            .from("contas_apagar")
            .update({
              data_vencimento: dataVenc,
              data_agendamento: dataVenc,
              valor: valorNumericoFinal,
              descricao: descricao.trim(),
              nf_numero: nfNum,
              nf_url: nfUrl,
              boleto_url: boletoUrl,
              numero_doc: docNum,
              observacoes: obsFinal || null,
            })
            .eq("id", movimentacaoExistente.contas_apagar_id);
          if (contaPagarUpdateError) throw contaPagarUpdateError;
        }

        const { error: abastecimentoUpdateError } = await (supabase as any)
          .from("abastecimentos")
          .update({
            nf: nfNum,
            nota_url: nfUrl,
            updated_at: new Date().toISOString(),
            ...(numeroVooVinculado ? { numero_voo: numeroVooVinculado } : {}),
            ...(!rascunho ? { status: "pago", data_pagamento: dataComp } : {}),
          })
          .eq("id", referenciaId);
        if (abastecimentoUpdateError) throw abastecimentoUpdateError;

        toast.success(rascunho ? "Rascunho salvo" : "Solicitação de pagamento enviada com sucesso");
        if (rascunho) {
          resetForm();
          onOpenChange(false);
        } else {
          resetForm({ keepSuccess: true });
          setConcluido(true);
          setEtapaAtual(0);
        }
        return;
      }

      if (reciboNum && !isEdicaoProgramacaoExistente) {
        const { data: existente } = await (supabase as any).from("movimentacoes").select("id").eq("numero_recibo", reciboNum).maybeSingle();
        if (existente) { toast.error("Já existe um lançamento associado a este recibo."); return; }
      }

      const categoriaCaixaClienteId = modo === "DIRETO" ? tipoDespesa : null;
      const supabaseClient = supabase as unknown as SupabaseClientLike;

      if (modo === "DIRETO" && !categoriaCaixaClienteId) throw new Error("Selecione uma categoria do Caixa Cliente.");
      if (modo !== "DIRETO" && !categoriaContaId) throw new Error("Não foi possível resolver/criar a categoria da despesa.");

      if (isViagemMode && travelReportSel && !rascunho) {
        const travelReportNumeroDoc = travelReportSel.numero_relatorio || docNum || referenciaNumero;
        const tripValues = [
          { label: "Tripulante 1", valor: Number(travelReportSel.total_trip || 0), nome: travelReportSel.nome_tripulante || null },
          { label: "Tripulante 2", valor: Number(travelReportSel.total_trip2 || 0), nome: travelReportSel.nome_tripulante_2 || null },
        ].filter((entry) => entry.valor > 0);

        if (tripValues.length === 0) throw new Error("Nenhum valor de tripulante foi encontrado.");

        for (const [index, entry] of tripValues.entries()) {
          const linhasRateioViagem = montarLinhasRateio({ valorTotal: entry.valor, percentualUso: percNumerico, socios, socioSelecionadoId: socioId || null });
          const descricaoViagemModo = descricao ? `${descricao} — RV ${travelReportSel.numero_relatorio} — ${entry.nome || entry.label}` : `RV ${travelReportSel.numero_relatorio} — ${entry.nome || entry.label}`;

          const capId = await insertAndGetId("contas_apagar", {
            data_vencimento: dataVenc, data_agendamento: dataVenc, valor: entry.valor, categoria: "REEMBOLSO TRIPULAÇÃO",
            categoria_id: categoriaContaId || null, 
            descricao: descricaoViagemModo,
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
              descricao: descricaoViagemModo,
              fluxo: "saida", tipo_caixa: "cliente",
              categoria_id: tipoDespesa, categoria_nome: subcategoriaSel || tipoDespesaLabel || null, valor_rateado: entry.valor, valor_total: Number(travelReportSel.total_valor ?? valorNumerico),
              data_emissao: dataComp, data_vencimento: dataVenc, status: statusMov, aeronave_id: aeronaveId || null,
              percentual_uso: percNumerico, periodicidade, tipo_rateio: tipoRateioFinal,
              clientes_id: clienteParaPersistencia, socio_id: socioId || null, fornecedor_nome: fornecedorNomeFinal,
              numero_nf: nfNum, numero_recibo: reciboNum, numero_boleto: boletoNum, numero_doc: travelReportNumeroDoc,
              nf_url: nfUrl, recibo_url: reciboUrl, boleto_url: boletoUrl, comprovante_url: comprovanteUrl, demonstrativo_url: demonstrativoUrl,
              observacoes: obsFinal || null, contas_apagar_id: capId,
              ...(index === 0 ? { reference_type: "travel_expense_report", reference_id: travelReportSel.id } : {}),
              criado_por: userId,
            });
            movimentacaoIdsCriadas.push(movId);
          } catch (movErr) {
            await supabase.from("contas_apagar").delete().eq("id", capId);
            throw movErr;
          }

          await supabase.from("contas_apagar").update({ movimentacao_id: movId }).eq("id", capId);

          const rateioPayloadsViagem = linhasRateioViagem.length > 0
            ? linhasRateioViagem.map((linha) => {
                const anexoNf = pickAnexoParaRateio(anexosProc, "nf", normalizeClienteId(clienteId), linha.socio_id);
                const anexoDoc = pickAnexoParaRateio(anexosProc, "doc", normalizeClienteId(clienteId), linha.socio_id);
                const anexoRecibo = pickAnexoParaRateio(anexosProc, "recibo", normalizeClienteId(clienteId), linha.socio_id);
                const numeroNfLinha = anexoNf?.numero || nfNum;
                const numeroDocLinha = anexoDoc?.numero || travelReportNumeroDoc;
                const nfUrlLinha = anexoNf?.url || nfUrl;
                const comprovanteUrlLinha = anexoDoc?.url || comprovanteUrl;
                const reciboNumLinha = anexoRecibo?.numero || reciboNum;
                const reciboUrlLinha = anexoRecibo?.url || reciboUrl;

                return {
                  despesa_id: movId, fonte_despesa: "travel_expense_report", tipo_rateio: tipoRateioFinal, fluxo: "SAÍDA",
                  data_emissao: dataComp, data_vencimento: dataVenc, numero_boleto: boletoNum, numero_nf: numeroNfLinha, numero_doc: numeroDocLinha, numero_recibo: reciboNumLinha,
                  fornecedor_nome: fornecedorNomeFinal, cliente_id: normalizeClienteId(clienteId), clientes_nome: clienteSel?.razaoSocial || null, socio_id: linha.socio_id,
                  socios_nome: linha.socio_nome, pago_diretamente: false, aeronave_id: aeronaveId || null, aeronave_registro: aeronaveSel?.matricula || travelReportSel.matricula_aeronave || null,
                  percentual_sociedade: socios.find((socio) => socio.id === linha.socio_id)?.percentual_participacao ?? 0, percentual_uso: linha.percentual_uso,
                  descricao_despesa: descricaoViagemModo, categoria_custo: tipoDespesa || null, periodicidade,
                  valor_total: entry.valor, valor_rateado: linha.valor_rateado, status: statusMov, observacoes: obsFinal || null,
                  boleto_url: boletoUrl, nf_url: nfUrlLinha, recibo_url: reciboUrlLinha, comprovante_url: comprovanteUrlLinha, demonstrativo_url: demonstrativoUrl, subcategoria_1: subcategoria1Val, subcategoria_2: subcategoria2Val, subcategoria_3: subcategoria3Val, subcategoria_4: subcategoria4Val,
                  relatorio_url: travelReportSel.pdf_url || docUrl || null,
                  pago_por: resolverPagoPorSolicitacao({ socioNome: linha.socio_nome || socioSel?.nome || null, clienteNome: clienteSel?.razaoSocial || null, socioCount: linhasRateioViagem.length }),
                };
              })
            : [{
                despesa_id: movId, fonte_despesa: "travel_expense_report", tipo_rateio: tipoRateioFinal, fluxo: "SAÍDA",
                data_emissao: dataComp, data_vencimento: dataVenc, numero_boleto: boletoNum, numero_nf: nfNum, numero_doc: travelReportNumeroDoc, numero_recibo: reciboNum,
                fornecedor_nome: fornecedorNomeFinal, cliente_id: normalizeClienteId(clienteId), clientes_nome: clienteSel?.razaoSocial || null, socio_id: socioId || null,
                socios_nome: socioSel?.nome || null, pago_diretamente: false, aeronave_id: aeronaveId || null, aeronave_registro: aeronaveSel?.matricula || travelReportSel.matricula_aeronave || null,
                percentual_sociedade: socioSel?.percentual_participacao ?? 0, percentual_uso: percNumerico,
                descricao_despesa: descricaoViagemModo, categoria_custo: tipoDespesa || null, periodicidade,
                valor_total: entry.valor, valor_rateado: +(entry.valor * (percNumerico / 100)).toFixed(2), status: statusMov, observacoes: obsFinal || null,
                boleto_url: boletoUrl, nf_url: nfUrl, recibo_url: reciboUrl, comprovante_url: comprovanteUrl, demonstrativo_url: demonstrativoUrl, subcategoria_1: subcategoria1Val, subcategoria_2: subcategoria2Val, subcategoria_3: subcategoria3Val, subcategoria_4: subcategoria4Val,
                relatorio_url: travelReportSel.pdf_url || docUrl || null,
                pago_por: resolverPagoPorSolicitacao({ socioNome: socioSel?.nome || null, clienteNome: clienteSel?.razaoSocial || null, socioCount: linhasRateioViagem.length || (socioId ? 1 : 0) }),
              }];

          const { error: rateioViagemError } = await supabaseClient.from("rateio_despesas").insert(rateioPayloadsViagem as any);
          if (rateioViagemError) throw rateioViagemError;
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

        let capId: string | null = null;
        let shareMovId: string | null = null;
        const movimentacaoIdsPorCliente: Record<string, string> = {};

        if (gerarCaixaCliente) {
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
              
              const anexoRecibo = pickAnexoParaRateio(anexosProc, "recibo", linha.clienteId, null);
              const reciboNumLinha = anexoRecibo?.numero || (isTaxasMode ? getTaxaReciboNumeroForCliente(linha.clienteId) : null) || getReciboNumeroForCliente(linha.clienteId) || reciboNum;
              const reciboUrlLinha = anexoRecibo?.url || (isTaxasMode ? getTaxaReciboUrlForCliente(linha.clienteId) : null) || getReciboUrlForCliente(linha.clienteId) || reciboUrl;
              const anexoNfLinha = pickAnexoParaRateio(anexosProc, "nf", linha.clienteId, null);
              const anexoBoletoLinha = pickAnexoParaRateio(anexosProc, "boleto", linha.clienteId, null);
              const anexoDocLinha = pickAnexoParaRateio(anexosProc, "doc", linha.clienteId, null);
              const nfNumLinha = isAbastecimentoVinculado ? nfNum : anexoNfLinha?.numero || nfNum;
              const nfUrlLinhaMov = isAbastecimentoVinculado ? nfUrl : anexoNfLinha?.url || nfUrl;
              const boletoNumLinha = anexoBoletoLinha?.numero || boletoNum;
              const boletoUrlLinha = anexoBoletoLinha?.url || boletoUrl;
              const docNumLinha = isAbastecimentoVinculado ? docNum : anexoDocLinha?.numero || docNum;
              const comprovanteUrlLinhaMov = isAbastecimentoVinculado ? comprovanteUrl : anexoDocLinha?.url || comprovanteUrl;

              const movId = await insertAndGetId("movimentacoes", {
                descricao: clienteLinhas.length > 1 ? `${descricao} — ${info?.razaoSocial || "Cliente"}` : descricao,
                fluxo: "saida", tipo_caixa: "cliente",
                categoria_id: categoriaCaixaClienteId, valor_rateado: valorCliente, valor_total: valorNumericoFinal,
                data_emissao: dataComp, data_vencimento: dataVenc, status: statusMov,
                percentual_uso: pctCliente, periodicidade, tipo_rateio: tipoRateioFinal,
                aeronave_id: aeronaveId || null, clientes_id: linha.clienteId, socio_id: socioIdDaMovimentacaoCliente(linha.clienteId), fornecedor_nome: fornecedorNomeFinal,
                categoria_nome: tipoDespesaLabel || null,
                numero_nf: nfNumLinha, numero_recibo: reciboNumLinha, numero_boleto: boletoNumLinha, numero_doc: docNumLinha,
                nf_url: nfUrlLinhaMov, recibo_url: reciboUrlLinha, boleto_url: boletoUrlLinha, comprovante_url: comprovanteUrlLinhaMov, demonstrativo_url: demonstrativoUrl, comanda_url: comandaUrl,
                observacoes: obsFinal || null,
                reembolsavel: false, pago_diretamente: false,
                reference_type: referenciaTipo || "solicitacao_pagamento",
                reference_id: referenciaTipo && referenciaId ? referenciaId : null,
                criado_por: userId,
                numero_voo: numeroVooVinculado,
              });
              movimentacaoIdsCriadas.push(movId);
              movimentacaoIdsPorCliente[linha.clienteId] = movId;
            }
          } catch (movErr) {
            for (const movId of Object.values(movimentacaoIdsPorCliente)) await supabase.from("movimentacoes").delete().eq("id", movId);
            throw movErr;
          }

          const rateioPayloadsCaixaCliente = linhasRateioMultiCliente.map((linha) => {
            const anexoNf = pickAnexoParaRateio(anexosProc, "nf", linha.cliente_id, linha.socio_id);
            const anexoDoc = pickAnexoParaRateio(anexosProc, "doc", linha.cliente_id, linha.socio_id);
            const anexoRecibo = pickAnexoParaRateio(anexosProc, "recibo", linha.cliente_id, linha.socio_id);
            const numeroNfLinha = isAbastecimentoVinculado ? nfNum : anexoNf?.numero || nfNum;
            const numeroDocLinha = isAbastecimentoVinculado ? docNum : anexoDoc?.numero || docNum;
            const nfUrlLinha = isAbastecimentoVinculado ? nfUrl : anexoNf?.url || nfUrl;
            const comprovanteUrlLinha = isAbastecimentoVinculado ? comprovanteUrl : anexoDoc?.url || comprovanteUrl;
            const reciboNumLinha = anexoRecibo?.numero || (isTaxasMode ? getTaxaReciboNumeroForCliente(linha.cliente_id) : null) || getReciboNumeroForCliente(linha.cliente_id) || reciboNum;
            const reciboUrlLinha = anexoRecibo?.url || (isTaxasMode ? getTaxaReciboUrlForCliente(linha.cliente_id) : null) || getReciboUrlForCliente(linha.cliente_id) || reciboUrl;
            
            return {
              despesa_id: movimentacaoIdsPorCliente[linha.cliente_id], fonte_despesa: fonteDespesa, tipo_rateio: tipoRateioFinal, fluxo: "SAÍDA",
              data_emissao: dataComp, data_vencimento: dataVenc, numero_boleto: boletoNum, numero_nf: numeroNfLinha, numero_doc: numeroDocLinha, numero_recibo: reciboNumLinha, fornecedor_nome: fornecedorNomeFinal,
              cliente_id: linha.cliente_id, clientes_nome: linha.cliente_nome, socio_id: linha.socio_id, socios_nome: linha.socios_nome, pago_diretamente: false,
              aeronave_id: aeronaveId || null, aeronave_registro: aeronaveSel?.matricula || null, percentual_sociedade: linha.percentual_sociedade_original, percentual_uso: linha.percentual_uso,
              descricao_despesa: descricao, categoria_custo: tipoDespesa || null, periodicidade, valor_total: valorNumericoFinal, valor_rateado: linha.valor_rateado,
              status: statusMov, observacoes: obsFinal || null, boleto_url: boletoUrl, nf_url: nfUrlLinha, recibo_url: reciboUrlLinha, comprovante_url: comprovanteUrlLinha, comanda_url: comandaUrl, demonstrativo_url: demonstrativoUrl,
              subcategoria_1: subcategoria1Val, subcategoria_2: subcategoria2Val, subcategoria_3: subcategoria3Val, subcategoria_4: subcategoria4Val,
              pago_por: resolverPagoPorSolicitacao({ socioNome: linha.socio_nome || null, clienteNome: linha.cliente_nome || null, socioCount: linhasRateioMultiCliente.length }),
              abastecimento_id: referenciaTipo === "abastecimento" ? referenciaId : null,
              numero_voo: numeroVooVinculado,
            };
          });

          if (rateioPayloadsCaixaCliente.length) {
            await supabaseClient.from("rateio_despesas").insert(rateioPayloadsCaixaCliente as any);
          }
        } else if (gerarContasAPagar) {

          capId = await insertAndGetId("contas_apagar", {
            data_vencimento: dataVenc, data_agendamento: dataVenc, valor: valorNumericoFinal, categoria: tipoDespesaLabel || null,
            categoria_id: categoriaContaId || null, descricao, status: statusCP, observacoes: obsFinal || null,
            cliente_id: clienteLinhas.length === 1 ? clienteLinhas[0].clienteId : clienteParaPersistencia, fornecedor_favorito_id: fornecedorSel?.source === "favorito" ? fornecedorId : null,
            fornecedor_combustivel_id: fornecedorSel?.source === "combustivel" ? fornecedorId : null, fornecedor_nome: fornecedorNomeFinal,
            aeronave_registro: aeronaveSel?.matricula || null, possui_boleto: !!boletoUrl, boleto_url: boletoUrl, vencimento_boleto: boletoUrl ? dataVenc : null,
            possui_nf: !!nfUrl, nf_numero: nfNum, nf_url: nfUrl, possui_recibo: !!reciboUrl && !isAllClients, numero_recibo: isAllClients ? null : reciboNum, recibo_url: isAllClients ? null : reciboUrl, data_recibo: !isAllClients && reciboUrl ? dataComp : null,
            numero_doc: numeroDocFinal, arquivo_pdf_url: docUrl, criado_por: userId,
            ...taxasSubcatFields,
          });

          try {
            shareMovId = await insertAndGetId("movimentacoes", {
              descricao, fluxo: "despesa", tipo_caixa: "share",
              categoria_id: categoriaContaId, categoria_nome: categoriaMovimentacaoShare.nome || tipoDespesaLabel || null,
              grupo_categoria: categoriaMovimentacaoShare.grupo_categoria,
              reembolsavel: categoriaMovimentacaoShare.reembolsavel,
              valor_rateado: valorNumericoFinal, valor_total: valorNumericoFinal,
              data_emissao: dataComp, data_vencimento: dataVenc, status: statusMov,
              periodicidade, tipo_rateio: tipoRateioFinal,
              aeronave_id: aeronaveId || null, fornecedor_nome: fornecedorNomeFinal,
              numero_nf: nfNum, numero_recibo: reciboNum, numero_boleto: boletoNum, numero_doc: docNum,
              nf_url: nfUrl, recibo_url: reciboUrl, boleto_url: boletoUrl, comprovante_url: comprovanteUrl, demonstrativo_url: demonstrativoUrl, comanda_url: comandaUrl,
              observacoes: obsFinal || null, pago_diretamente: false, contas_apagar_id: capId,
              reference_type: referenciaTipo || "solicitacao_pagamento",
              reference_id: referenciaTipo && referenciaId ? referenciaId : null,
              criado_por: userId,
              numero_voo: numeroVooVinculado,
            });
          } catch (shareErr) {
            await supabase.from("contas_apagar").delete().eq("id", capId);
            throw shareErr;
          }


          try {
            for (const linha of clienteLinhas) {
              // Recibo de reembolso: a visao do cliente vive apenas em rateio_despesas.
              if (isReembolsoRecibo) continue;
              const info = getClienteAeronaveInfo(linha.clienteId);
              const pctCliente = Number(String(linha.percentualUsoCliente).replace(",", ".")) || 0;
              const overrideStr = linha.valorClienteOverride;
              const overrideNum = overrideStr !== undefined && overrideStr !== ""
                ? Number(String(overrideStr).replace(/\./g, "").replace(",", "."))
                : NaN;
              const valorCliente = Number.isFinite(overrideNum)
                ? +overrideNum.toFixed(2)
                : +(valorNumericoFinal * (pctCliente / 100)).toFixed(2);
              
              const anexoRecibo = pickAnexoParaRateio(anexosProc, "recibo", linha.clienteId, null);
              const reciboNumLinha = anexoRecibo?.numero || (isTaxasMode ? getTaxaReciboNumeroForCliente(linha.clienteId) : null) || getReciboNumeroForCliente(linha.clienteId) || reciboNum;
              const reciboUrlLinha = anexoRecibo?.url || (isTaxasMode ? getTaxaReciboUrlForCliente(linha.clienteId) : null) || getReciboUrlForCliente(linha.clienteId) || reciboUrl;
              const anexoNfLinha = pickAnexoParaRateio(anexosProc, "nf", linha.clienteId, null);
              const anexoBoletoLinha = pickAnexoParaRateio(anexosProc, "boleto", linha.clienteId, null);
              const anexoDocLinha = pickAnexoParaRateio(anexosProc, "doc", linha.clienteId, null);
              const nfNumLinha = isAbastecimentoVinculado ? nfNum : anexoNfLinha?.numero || nfNum;
              const nfUrlLinhaMov = isAbastecimentoVinculado ? nfUrl : anexoNfLinha?.url || nfUrl;
              const boletoNumLinha = anexoBoletoLinha?.numero || boletoNum;
              const boletoUrlLinha = anexoBoletoLinha?.url || boletoUrl;
              const docNumLinha = isAbastecimentoVinculado ? docNum : anexoDocLinha?.numero || docNum;
              const comprovanteUrlLinhaMov = isAbastecimentoVinculado ? comprovanteUrl : anexoDocLinha?.url || comprovanteUrl;

              const movId = await insertAndGetId("movimentacoes", {
                descricao: clienteLinhas.length > 1 ? `${descricao} — ${info?.razaoSocial || "Cliente"}` : descricao, fluxo: "saida", tipo_caixa: "cliente",
                categoria_id: tipoDespesa, valor_rateado: valorCliente, valor_total: valorNumericoFinal, data_emissao: dataComp, data_vencimento: dataVenc, status: statusMov,
                percentual_uso: pctCliente, periodicidade, tipo_rateio: tipoRateioFinal,
                aeronave_id: aeronaveId || null, clientes_id: linha.clienteId, socio_id: socioIdDaMovimentacaoCliente(linha.clienteId), fornecedor_nome: fornecedorNomeFinal,
                categoria_nome: subcategoriaSel || tipoDespesaLabel || null,
                numero_nf: nfNumLinha, numero_recibo: reciboNumLinha, numero_boleto: boletoNumLinha, numero_doc: docNumLinha, nf_url: nfUrlLinhaMov, recibo_url: reciboUrlLinha, boleto_url: boletoUrlLinha, comprovante_url: comprovanteUrlLinhaMov, demonstrativo_url: demonstrativoUrl, comanda_url: comandaUrl,
                observacoes: obsFinal || null, pago_diretamente: false, contas_apagar_id: capId, reference_type: referenciaTipo || "solicitacao_pagamento", reference_id: referenciaTipo && referenciaId ? referenciaId : null, criado_por: userId,
              });
              movimentacaoIdsCriadas.push(movId);
              movimentacaoIdsPorCliente[linha.clienteId] = movId;
            }
          } catch (movErr) {
            await supabase.from("contas_apagar").delete().eq("id", capId);
            for (const movId of Object.values(movimentacaoIdsPorCliente)) await supabase.from("movimentacoes").delete().eq("id", movId);
            throw movErr;
          }

          await supabase.from("contas_apagar").update({ movimentacao_id: shareMovId || Object.values(movimentacaoIdsPorCliente)[0] || null }).eq("id", capId);

          const rateioPayloads = linhasRateioMultiCliente.map((linha) => {
            const anexoNf = pickAnexoParaRateio(anexosProc, "nf", linha.cliente_id, linha.socio_id);
            const anexoDoc = pickAnexoParaRateio(anexosProc, "doc", linha.cliente_id, linha.socio_id);
            const anexoRecibo = pickAnexoParaRateio(anexosProc, "recibo", linha.cliente_id, linha.socio_id);
            const numeroNfLinha = isAbastecimentoVinculado ? nfNum : anexoNf?.numero || nfNum;
            const numeroDocLinha = isAbastecimentoVinculado ? docNum : anexoDoc?.numero || docNum;
            const nfUrlLinha = isAbastecimentoVinculado ? nfUrl : anexoNf?.url || nfUrl;
            const comprovanteUrlLinha = isAbastecimentoVinculado ? comprovanteUrl : anexoDoc?.url || comprovanteUrl;
            const reciboNumLinha = anexoRecibo?.numero || (isTaxasMode ? getTaxaReciboNumeroForCliente(linha.cliente_id) : null) || getReciboNumeroForCliente(linha.cliente_id) || reciboNum;
            const reciboUrlLinha = anexoRecibo?.url || (isTaxasMode ? getTaxaReciboUrlForCliente(linha.cliente_id) : null) || getReciboUrlForCliente(linha.cliente_id) || reciboUrl;
            
            return {
              despesa_id: movimentacaoIdsPorCliente[linha.cliente_id] || shareMovId, fonte_despesa: fonteDespesa, tipo_rateio: tipoRateioFinal, fluxo: "saida",
              data_emissao: dataComp, data_vencimento: dataVenc, numero_boleto: boletoNum, numero_nf: numeroNfLinha, numero_doc: numeroDocLinha, numero_recibo: reciboNumLinha, fornecedor_nome: fornecedorNomeFinal,
              cliente_id: linha.cliente_id, clientes_nome: linha.cliente_nome, socio_id: linha.socio_id, socios_nome: linha.socios_nome, pago_diretamente: false,
              aeronave_id: aeronaveId || null, aeronave_registro: aeronaveSel?.matricula || null, percentual_sociedade: linha.percentual_sociedade_original, percentual_uso: linha.percentual_uso,
              descricao_despesa: descricao, categoria_custo: tipoDespesa || null, periodicidade, valor_total: valorNumericoFinal, valor_rateado: linha.valor_rateado,
              status: isReembolsoRecibo ? "PENDENTE" : statusMov, observacoes: obsFinal || null, boleto_url: boletoUrl, nf_url: nfUrlLinha, recibo_url: reciboUrlLinha, comprovante_url: comprovanteUrlLinha, comanda_url: comandaUrl, demonstrativo_url: demonstrativoUrl, subcategoria_1: subcategoria1Val, subcategoria_2: subcategoria2Val, subcategoria_3: subcategoria3Val, subcategoria_4: subcategoria4Val,
              pago_por: resolverPagoPorSolicitacao({ socioNome: linha.socio_nome || null, clienteNome: linha.cliente_nome || null, socioCount: linhasRateioMultiCliente.length }),
              abastecimento_id: referenciaTipo === "abastecimento" ? referenciaId : null,
              numero_voo: numeroVooVinculado,
            };
          });

          const { error: rateioError } = await supabaseClient.from("rateio_despesas").insert(rateioPayloads as any);
          if (rateioError) throw rateioError;
        }

        if (gerarContasAReceber && !gerarCaixaCliente && !gerarContasAPagar) {
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
            if (valorCliente <= 0) continue;

            try {
              await syncSaidaFinancialLegs({
                origem: "solicitacao_areceber",
                origem_id:
                  typeof crypto !== "undefined" && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`,
                cliente_id: linha.clienteId,
                cliente_nome: info?.razaoSocial || "",
                cliente_cnpj: info?.cnpj || null,
                aeronave_id: aeronaveId || null,
                aeronave_registro: aeronaveSel?.matricula || null,
                valor: valorCliente,
                valor_total_despesa: valorNumericoFinal,
                data_emissao: dataComp,
                data_vencimento: dataVenc,
                status: "pendente",
                categoria_origem_label: tipoDespesaLabel || null,
                subcategoria: subcategoria1Val || null,
                numero_doc: docNum || reciboNum || null,
                numero_nf: nfNum || null,
                numero_recibo: reciboNum || null,
                numero_boleto: boletoNum || null,
                nf_url: nfUrl || null,
                recibo_url: reciboUrl || null,
                boleto_url: boletoUrl || null,
                comprovante_url: comprovanteUrl || null,
                demonstrativo_url: demonstrativoUrl || null,
                descricao: clienteLinhas.length > 1 ? `${descricao} — ${info?.razaoSocial || "Cliente"}` : descricao,
                observacoes: obsFinal || null,
                criado_por: userId,
              });
            } catch (arSyncErr: unknown) {
              console.error("Falha ao sincronizar pernas SAIDA do cliente:", arSyncErr);
              throw arSyncErr;
            }
          }
        }

        if (gerarContasAReceber && gerarContasAPagar) {
          // Regras de negócio: na solicitação de pagamento com reembolso, a despesa da Share
          // e o rateio dos cotistas são gerados uma única vez. A criação de contas a receber
          // e de movimentações de entrada do cliente acontece somente no momento em que a Share
          // confirma o recebimento do cliente, não no momento da solicitação.
        }

      }

      if (!rascunho && referenciaTipo === "abastecimento" && referenciaId) {
        const socioNomeParaAbastecimento = (socioSel?.nome || (clienteLinhas.length === 1 ? null : null)).trim() || null;
        await (supabase.from("abastecimentos") as any).update({
          status: "pago",
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

      const successMessage = rascunho ? "Rascunho salvo" : "Solicitação de pagamento enviada com sucesso";
      toast.success(successMessage);

      if (!rascunho) {
        const anexosEmail: AnexoEmail[] = [
          { url: nfUrl, label: `Nota Fiscal${nfNum ? ` ${nfNum}` : ""}`, filename: "nota-fiscal.pdf" },
          { url: boletoUrl, label: `Boleto${boletoNum ? ` ${boletoNum}` : ""}`, filename: "boleto.pdf" },
          { url: reciboUrl, label: `Recibo${reciboNum ? ` ${reciboNum}` : ""}`, filename: "recibo.pdf" },
          { url: comprovanteUrl, label: "Documento / Comprovante", filename: "documento.pdf" },
          { url: demonstrativoUrl, label: "Demonstrativo de rateio", filename: "demonstrativo.pdf" },
        ].filter((a): a is AnexoEmail => !!a.url);

        const clienteEmailId = clienteLinhas.length === 1 ? clienteLinhas[0].clienteId : clienteSel?.clienteId || null;
        const clienteNome = clienteLinhas.length === 1
          ? getClienteAeronaveInfo(clienteLinhas[0].clienteId)?.razaoSocial || ""
          : clienteSel?.razaoSocial || "";

        setEmailPayload({
          clienteId: clienteEmailId,
          assunto: `Solicitação de pagamento — ${descricao || "Despesa"}${aeronaveSel?.matricula ? ` (${aeronaveSel.matricula})` : ""}`,
          referenceIds: movimentacaoIdsCriadas,
          mensagem:
            `Olá${clienteNome ? ` ${clienteNome}` : ""},\n\n` +
            `Segue a solicitação de pagamento referente a: ${descricao || "despesa"}.\n` +
            `Valor: ${Number(valorNumericoFinal || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}\n` +
            `Vencimento: ${dataVenc ? format(new Date(`${dataVenc}T12:00:00`), "dd/MM/yyyy") : "-"}\n\n` +
            `Os documentos estão disponíveis nos links abaixo.\n\nAtenciosamente,\nEquipe Share Brasil`,
          anexos: anexosEmail,
        });
      }

      resetForm({ keepSuccess: !rascunho });
      if (rascunho) {
        onOpenChange(false);
      } else {
        setConcluido(true);
        setEtapaAtual(0);
      }
    } catch (e: unknown) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-6xl max-h-[min(92vh,900px)] overflow-hidden bg-background text-foreground border-border/80 shadow-elevated rounded-3xl p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-5 md:px-8">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              {concluido ? <CheckCircle2 className="h-5 w-5" /> : <Send className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-semibold tracking-tight md:text-2xl">
                {concluido ? "Solicitação enviada" : "Enviar pagamento"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {concluido
                  ? "O lançamento foi registrado e está pronto para acompanhamento."
                  : etapaAtual === 0
                    ? "Escolha quem paga. O sistema ajustará automaticamente os lançamentos e próximos passos."
                    : `Etapa ${etapaVisual} de ${etapaLabels.length} · ${etapaLabel}`}
              </DialogDescription>
            </div>
            {modoCfg && !concluido && (
              <Badge variant="outline" className={cn("hidden shrink-0 rounded-full px-3 py-1 text-xs font-medium sm:inline-flex", modoCfg.accent, modoCfg.text)}>
                {modoCfg.resultado}
              </Badge>
            )}
          </div>
          {!concluido && (
            <div className="mt-6 flex items-center gap-2" aria-label="Progresso do envio">
              {etapaLabels.map((label, index) => {
                const step = index + 1;
                const active = etapaVisual >= step;
                return (
                  <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
                    <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{step}</div>
                    <span className={cn("hidden truncate text-xs font-medium sm:block", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
                    {index < etapaLabels.length - 1 && <div className={cn("h-px min-w-4 flex-1", etapaVisual > step ? "bg-primary/60" : "bg-border")} />}
                  </div>
                );
              })}
            </div>
          )}
        </DialogHeader>

        <div className="max-h-[calc(min(92vh,900px)-190px)] overflow-y-auto px-6 py-6 md:px-8">
          {etapaAtual === 0 && (
            concluido ? (
              <section className="mx-auto flex max-w-2xl flex-col items-center justify-center py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold tracking-tight">Solicitação enviada com sucesso</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  O lançamento foi registrado como pendente e já pode ser acompanhado no histórico de programação.
                </p>
                <div className={cn("mt-8 grid w-full gap-3", emailPayload ? "sm:grid-cols-2" : "sm:grid-cols-1")}>
                  {emailPayload && (
                    <Button variant="outline" className="h-11" onClick={() => setEmailOpen(true)}>
                      <Mail className="mr-2 h-4 w-4" /> Notificar cliente por e-mail
                    </Button>
                  )}
                  <Button className="h-11" onClick={() => onOpenChange(false)}>
                    Concluir
                  </Button>
                </div>
              </section>
            ) : (
              <section className="space-y-6 py-1">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">1. Defina a intenção</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight">Quem assume este pagamento?</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      A escolha abaixo configura o destino financeiro. Você não precisa decidir manualmente quais contas serão criadas.
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs text-muted-foreground">3 fluxos financeiros</Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {MODOS.map((m) => {
                    const ativo = modo === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => handleModoClick(m.key)}
                        className={cn(
                          "group flex min-h-[250px] flex-col rounded-2xl border-2 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:scale-[0.99]",
                          ativo ? `${m.accent} border-primary/30 shadow-card ring-2 ring-primary/15` : "border-border bg-card hover:border-primary/35",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-muted", ativo && m.text)}>
                            <span className={cn("h-3 w-3 rounded-full", m.dot)} />
                          </span>
                          <ArrowRight className={cn("h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1", ativo && m.text)} />
                        </div>
                        <p className={cn("mt-5 text-base font-semibold leading-snug", ativo ? m.text : "text-foreground")}>{m.titulo}</p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.descricao}</p>
                        <div className="mt-auto border-t border-border/70 pt-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Resultado</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{m.resultado}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{m.impacto}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col justify-between gap-4 rounded-2xl bg-muted/50 p-4 sm:flex-row sm:items-center">
                  <p className="text-sm text-muted-foreground">
                    {modo ? <><span className="font-medium text-foreground">Fluxo selecionado:</span> {modoCfg?.resultado}</> : "Selecione uma opção para começar."}
                  </p>
                  <Button disabled={!modo} className="h-11 shrink-0 px-5" onClick={() => setEtapaAtual(1)}>
                    Começar preenchimento <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/70 pt-4 text-sm">
                  <button type="button" className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground" onClick={() => { onOpenChange(false); onOpenTravelReports?.(); }}>
                    <FileText className="h-4 w-4 text-blue-600" /> Abrir fluxo de relatório de viagem
                  </button>
                  <button type="button" className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground" onClick={() => { onOpenChange(false); navigate("/financeiro/historico-programacao-pagamentos"); }}>
                    <History className="h-4 w-4 text-emerald-600" /> Ver histórico de programação
                  </button>
                </div>
              </section>
            )
          )}

          
          {etapaAtual === 1 && (
            <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> {isModoShare ? "Classificação" : "Base da despesa"}
                </h3>
              </div>

              {modoCfg && (
                <div className={cn("space-y-1 rounded-lg border p-4", modoCfg.accent)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", modoCfg.dot)} />
                      <Label className={cn("text-xs font-semibold uppercase tracking-wide", modoCfg.text)}>{modoCfg.titulo}</Label>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEtapaAtual(0)}>Trocar modo</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{modoCfg.descricao}</p>
                  <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-3">
                    {MODO_RESUMOS[modoCfg.key].map((item) => (
                      <div key={item.label}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
                        <p className="mt-0.5 text-xs font-medium text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isModoShare && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>1. Categoria do caixa Share *</Label>
                    <SearchableCombobox
                      items={categoriasShare.map((c) => ({ id: c.id, label: c.nome }))}
                      value={categoriaShareId}
                      onChange={(id, label) => {
                        setCategoriaShareId(id);
                        setCategoriaShareLabel(categoriasShare.find((c) => c.id === id)?.nome || label || "");
                      }}
                      placeholder="Selecione a categoria"
                      searchPlaceholder="Buscar categoria..."
                      emptyMessage="Nenhuma categoria"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>2. O que será pago? *</Label>
                    <Textarea value={descricao} onChange={(e) => setDescricao(up(e.target.value))} rows={2} maxLength={500} placeholder="Ex.: Mensalidade do sistema, material de escritório..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>3. Valor do pagamento (R$) *</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={valorTotal}
                      onChange={(e) => setValorTotal(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-1.5">
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
                </div>
              )}

              {!isModoShare && (<>



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
                  <Label>2. Tipo de despesa *</Label>
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
                      else if (label) { const labelUpper = up(label); if (window.confirm(`Adicionar novo tipo "${labelUpper}"?`)) criarTipoDespesa(labelUpper); }
                    }}
                    placeholder="Selecione o tipo" allowFreeText
                  />
                </div>
              )}

              {aeronaveId && tipoDespesa && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                  <Label>3. Tipo de rateio *</Label>
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
                  <Label>4. Clientes e Sócios *</Label>
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

              {aeronaveId && tipoDespesa && tipoRateio && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                  <Label>5. Periodicidade *</Label>
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

              {tipoDespesa && subcategoriasDisponiveis.length > 0 && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                  <Label>4.1 Subcategoria *</Label>
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Descrição da despesa *</Label>
                  <Textarea value={descricao} onChange={(e) => setDescricao(up(e.target.value))} rows={2} maxLength={500} placeholder="Ex.: Manutenção, combustível, taxa aeroportuária..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor total (R$) *</Label>
                  <Input type="text" inputMode="decimal" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="0,00" className="h-11 text-base font-semibold" />
                  <p className="text-xs text-muted-foreground">Para relatório ou recibo, o valor será preenchido automaticamente na etapa seguinte.</p>
                </div>
              </div>
              </>) }
            </section>

          )}

          {etapaAtual === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">2. {isViagemMode ? "Confirme o contexto" : "Defina o rateio"}</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">{isViagemMode ? "Qual é a origem desta viagem?" : "Como essa despesa será distribuída?"}</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {isViagemMode ? "Selecione o relatório ou recibo para carregar valores e documentos automaticamente." : "O sistema recalcula os valores por cliente e sócio. Ajuste apenas o que for diferente do padrão."}
                  </p>
                </div>
                {modoCfg && <Badge variant="outline" className={cn("w-fit rounded-full px-3 py-1 text-xs", modoCfg.accent, modoCfg.text)}>{modoCfg.resultado}</Badge>}
              </div>
              
              {isViagemMode && aeronaveId && (
                <section className="space-y-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
                  <div className="flex items-center gap-2 border-b border-sky-500/10 pb-3">
                    <Plane className="h-4 w-4 text-sky-700 dark:text-sky-400" />
                    <h3 className="text-sm font-semibold text-sky-700 dark:text-sky-300 uppercase tracking-wide">
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
                        <p className="text-xs text-amber-700 dark:text-amber-300">Nenhum relatório encontrado para este cliente{socioId ? "/sócio" : ""} nesta aeronave.</p>
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
                          <p className="text-xs text-amber-700 dark:text-amber-300">Nenhum recibo encontrado para este cliente nesta aeronave.</p>
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
                      <div className="flex items-center justify-between border-b border-border/70 pb-2">
                        <Label className="text-xs uppercase tracking-wide text-sky-700 dark:text-sky-300">Pagamento à Tripulação</Label>
                        <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200">
                          Total: {Number(travelReportSel.total_tripulacao ?? ((Number(travelReportSel.total_trip || 0)) + (Number(travelReportSel.total_trip2 || 0)))).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between rounded-md bg-muted/60 px-3 py-2">
                          <span className="text-muted-foreground">{travelReportSel.nome_tripulante || "Tripulante 1"}</span>
                          <span className="font-medium text-sky-800 dark:text-sky-200">{Number(travelReportSel.total_trip || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                        <div className="flex justify-between rounded-md bg-muted/60 px-3 py-2">
                          <span className="text-muted-foreground">{travelReportSel.nome_tripulante_2 || "Tripulante 2"}</span>
                          <span className="font-medium text-sky-800 dark:text-sky-200">{Number(travelReportSel.total_trip2 || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                        {!socioId && Number(travelReportSel.total_clientes || 0) > 0 && valorReceberClienteViagem > 0 && (
                          <div className="flex justify-between rounded-md bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 md:col-span-2">
                            <span className="text-emerald-700 dark:text-emerald-300">A receber do cliente</span>
                            <span className="font-medium text-emerald-800 dark:text-emerald-200">{valorReceberClienteViagem.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isViagemMode && socios.length > 0 && linhasRateioPreview.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wide">Rateio por sócio</Label>
                        <Badge variant="outline" className="border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300">{linhasRateioPreview.length} linha(s)</Badge>
                      </div>
                      <div className="space-y-2">
                        {linhasRateioPreview.map((linha, index) => (
                          <div key={`rv-${index}`} className="grid grid-cols-1 md:grid-cols-3 gap-2 rounded-md border border-border/70 bg-background/50 p-3 text-sm">
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
                    <FileText className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
                    <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 uppercase tracking-wide">
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
                      <p className="text-xs text-indigo-800 dark:text-indigo-200 font-medium">Selecione um recibo para cada cliente:</p>
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
                        <p className="text-xs font-medium text-indigo-800 dark:text-indigo-200">Recibos adicionados:</p>
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
                        <p className="text-xs text-indigo-700 dark:text-indigo-300/60">Nenhum recibo adicionado. Selecione um recibo e clique em "Adicionar".</p>
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
                        <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">Resumo do Recibo Selecionado</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div><div className="text-muted-foreground">Nº Documento</div><div className="font-medium text-indigo-100">{r.numero_documento || "—"}</div></div>
                          <div><div className="text-muted-foreground">Nº Recibo</div><div className="font-medium">{r.numero_recibo || "—"}</div></div>
                          <div><div className="text-muted-foreground">Percentual</div><div className="font-medium">{r.percentual ?? "—"}%</div></div>
                          <div><div className="text-muted-foreground">Valor Total</div><div className="font-medium text-indigo-800 dark:text-indigo-200">R$ {(Number(r.valor_total || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></div>
                        </div>
                        <div className="flex flex-wrap gap-4 pt-2 border-t border-border/70 text-xs">
                          {r.pdf_url && (
                            <a href={r.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-300 hover:text-sky-600 dark:hover:text-sky-200"><ExternalLink className="h-3.5 w-3.5" /> PDF do recibo</a>
                          )}
                          {r.boleto_url && (
                            <a href={r.boleto_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 hover:text-emerald-600 dark:hover:text-emerald-200"><ExternalLink className="h-3.5 w-3.5" /> Boleto</a>
                          )}
                          {r.nf_url && (
                            <a href={r.nf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 hover:text-amber-600 dark:hover:text-amber-200"><ExternalLink className="h-3.5 w-3.5" /> Demonstrativo</a>
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
                      <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Rateio & Clientes</h3>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3 bg-background/40 px-3 py-2 rounded-lg border border-border/70 shadow-inner">
                        <Label className="whitespace-nowrap font-medium text-emerald-800 dark:text-emerald-200">Valor Total (R$) *</Label>
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

                  <p className="text-[11px] text-emerald-900 dark:text-emerald-100/70">
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
                      const pctCliente = Number(String(linha.percentualUsoCliente).replace(",", ".")) || 0;
                      const overrideNum = linha.valorClienteOverride !== undefined && linha.valorClienteOverride !== ""
                        ? Number(String(linha.valorClienteOverride).replace(/\./g, "").replace(",", "."))
                        : NaN;
                      const valorCliente = Number.isFinite(overrideNum)
                        ? +overrideNum.toFixed(2)
                        : +(valorNumerico * (pctCliente / 100)).toFixed(2);

                      return (
                        <div key={linha.uid} className="rounded-lg border border-border bg-background/60 p-4 space-y-4">
                          {!temSocios && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                              <div className="lg:col-span-6 space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Cliente</Label>
                                <div className="flex items-center gap-2">
                                  <Input value={info?.razaoSocial || "—"} readOnly className="bg-muted/30 font-medium" />
                                  {clienteLinhas.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9 text-red-700 dark:text-red-300 hover:text-red-200 hover:bg-red-500/10"
                                      onClick={() => removeClienteLinha(linha.uid)}
                                      title="Excluir este cliente do rateio"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="lg:col-span-3 space-y-1.5">
                                <Label className="text-xs text-muted-foreground">% da Nota</Label>
                                <Input type="text" inputMode="decimal" value={linha.percentualUsoCliente} onChange={(e) => updateClienteLinha(linha.uid, { percentualUsoCliente: e.target.value, valorClienteOverride: undefined })} placeholder="100" />
                              </div>
                              <div className="lg:col-span-3 space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Valor a Pagar (R$)</Label>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={linha.valorClienteOverride ?? valorCliente.toFixed(2).replace(".", ",")}
                                  onChange={(e) => updateClienteLinha(linha.uid, { valorClienteOverride: e.target.value })}
                                  placeholder="0,00"
                                  className="font-medium text-emerald-700 dark:text-emerald-300"
                                  title="Sugestão calculada pelo % do rateio. Pode ser editado livremente — o ajuste é feito no Fechamento de Balanço."
                                />
                              </div>
                            </div>
                          )}

                          {isTaxasMode && (linha.numeroDocumentoRecibo || linha.urlBoleto || linha.urlDemonstrativo) && (
                            <div className="rounded-md bg-indigo-500/10 border border-indigo-500/30 p-3 space-y-2">
                              <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">Dados do Recibo (Preenchidos Automaticamente)</div>
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
                                    <a href={linha.urlBoleto} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-600 dark:hover:text-sky-200 inline-flex items-center gap-1">
                                      <ExternalLink className="h-3 w-3" /> Abrir
                                    </a>
                                  </div>
                                )}
                                {linha.urlDemonstrativo && (
                                  <div>
                                    <span className="text-muted-foreground block mb-1">Demonstrativo</span>
                                    <a href={linha.urlDemonstrativo} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-600 dark:hover:text-sky-200 inline-flex items-center gap-1">
                                      <ExternalLink className="h-3 w-3" /> Abrir
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {info && sociosVisiveis.length > 0 && (
                            <div className="space-y-3 mt-4 pt-4 border-t border-border/70">
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Rateio Interno (Por Sócio)</Label>
                                <Badge variant="outline" className="bg-muted/60 text-[10px] border-border">{sociosVisiveis.length} de {info.socios.length} sócio(s)</Badge>
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
                                          ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 line-through opacity-70"
                                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/20"
                                      )}
                                      title={isExcluded ? "Sócio excluído do rateio — clique para incluir novamente" : "Clique para excluir este sócio do rateio"}
                                    >
                                      {isExcluded ? <span className="flex items-center gap-1"><Trash2 className="h-3 w-3" /> {socio.nome}</span> : socio.nome}
                                    </button>
                                  );
                                })}
                              </div>

                              <p className="text-[11px] leading-relaxed text-muted-foreground bg-muted/60 border border-border rounded-md px-2.5 py-1.5">
                                Clique no nome de um sócio acima para <span className="text-red-700 dark:text-red-300 font-medium">excluí-lo do rateio</span>.
                                Ao alterar o % ou o valor R$ de um sócio, os demais são <span className="text-emerald-700 dark:text-emerald-300 font-medium">recalculados automaticamente</span> proporcionalmente à participação — mas você pode editar cada um individualmente.
                              </p>

                              <div className="grid gap-2">
                                {(() => {
                                  const totalPctSocios = sociosVisiveis.reduce((s, so) => s + (Number(so.percentual_participacao ?? 0) || 0), 0);
                                  const isManualOverride = (sId: string) => {
                                    const ov = linha.overridesSocio[sId];
                                    const vOv = linha.valorOverridesSocio?.[sId];
                                    const okPct = ov !== undefined && ov !== "" && !Number.isNaN(Number(String(ov).replace(",", ".")));
                                    const okVal = vOv !== undefined && vOv !== "" && !Number.isNaN(Number(String(vOv).replace(",", ".")));
                                    return okPct || okVal;
                                  };
                                  const somaOverridePct = sociosVisiveis.reduce((sum, s) => {
                                    if (!isManualOverride(s.id)) return sum;
                                    const vOv = linha.valorOverridesSocio?.[s.id];
                                    if (vOv !== undefined && vOv !== "" && !Number.isNaN(Number(String(vOv).replace(",", ".")))) {
                                      return sum + (valorCliente > 0 ? (Number(String(vOv).replace(",", ".")) / valorCliente) * 100 : 0);
                                    }
                                    const ov = linha.overridesSocio[s.id];
                                    return sum + (Number(String(ov).replace(",", ".")) || 0);
                                  }, 0);
                                  const naoOverridden = sociosVisiveis.filter((s) => !isManualOverride(s.id));
                                  const baseSomaNaoOverridden = naoOverridden.reduce((sum, s) => sum + (Number(s.percentual_participacao ?? 0) || 0), 0);
                                  const restantePct = Math.max(0, 100 - somaOverridePct);
                                  const linhasSocios = sociosVisiveis.map((s) => {
                                    const overrideVal = linha.overridesSocio[s.id];
                                    const valorOverrideVal = linha.valorOverridesSocio?.[s.id];
                                    let autoPct: number;
                                    if (isManualOverride(s.id)) {
                                      autoPct = totalPctSocios > 0 ? (Number(s.percentual_participacao ?? 0) / totalPctSocios) * 100 : 100 / sociosVisiveis.length;
                                    } else if (baseSomaNaoOverridden > 0) {
                                      autoPct = ((Number(s.percentual_participacao ?? 0) || 0) / baseSomaNaoOverridden) * restantePct;
                                    } else {
                                      autoPct = naoOverridden.length > 0 ? restantePct / naoOverridden.length : 0;
                                    }
                                    const hasValorOverride = valorOverrideVal !== undefined && valorOverrideVal !== "" && !Number.isNaN(Number(String(valorOverrideVal).replace(",", ".")));
                                    
                                    const pctEfetivo = hasValorOverride
                                      ? (valorCliente > 0 ? (Number(String(valorOverrideVal).replace(",", ".")) / valorCliente) * 100 : 0)
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
                                        <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-muted/60 p-2 text-sm transition-colors hover:bg-muted">
                                          <div className="font-medium text-foreground min-w-[140px] flex-1">{s.nome}</div>
                                          <div className="flex items-center gap-1 text-muted-foreground">
                                            <span className="text-xs whitespace-nowrap">%:</span>
                                            <Input type="text" inputMode="decimal" className="h-7 w-20 text-xs text-center" placeholder={autoPct.toFixed(2)} value={hasValorOverride ? pctEfetivo.toFixed(2) : (overrideVal ?? "")} onChange={(e) => { updateOverrideSocio(linha.uid, s.id, e.target.value); updateValorOverrideSocio(linha.uid, s.id, ""); }} />
                                          </div>
                                          <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
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
                                        somaSociosForaDoEsperado ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
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

                  {clienteLinhas.length > 1 && (
                    <div className={cn("text-xs rounded-md p-2 border font-medium", erroSomaClientes ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
                      Soma de clientes: {somaPercentualClientes.toFixed(2)}% {erroSomaClientes ? `— ${erroSomaClientes}` : "— OK"}
                    </div>
                  )}
                </section>
              )}

              {isCombustivelMode && aeronaveId && (
                <section className="space-y-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl p-5">
                  <div className="flex items-center gap-2 border-b border-amber-500/10 pb-3">
                    <Plane className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                    <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wide">Combustível — Comanda / NF</h3>
                  </div>
                  <p className="text-xs text-amber-900 dark:text-amber-100/70">
                    Informe a comanda e/ou o número da NF. Se já existir um abastecimento cadastrado, ele será vinculado; caso contrário, um novo será criado ao salvar.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Comanda</Label>
                      <Input value={fuelComanda} onChange={(e) => setFuelComanda(up(e.target.value))} placeholder="Nº da comanda" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nº da NF</Label>
                      <Input value={fuelNf} onChange={(e) => setFuelNf(up(e.target.value))} placeholder="Nº da nota fiscal" />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="outline" className="w-full border-amber-500/30 hover:bg-amber-500/10" onClick={buscarAbastecimento} disabled={fuelLookupLoading}>
                        {fuelLookupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />} Buscar / Vincular
                      </Button>
                    </div>
                  </div>
                  {fuelLookupSearched && !fuelLookupResult && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-xs text-amber-800 dark:text-amber-200/80">
                        Nenhum abastecimento encontrado. Crie um novo para vincular a esta solicitação.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100"
                        onClick={() => setNovoAbastOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Criar novo abastecimento
                      </Button>
                    </div>
                  )}
                  {fuelLookupResult && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-900 dark:text-emerald-100">
                      ✓ Vinculado ao abastecimento existente · Comanda {fuelLookupResult.comanda || "—"} · NF {fuelLookupResult.nf || "—"} · R$ {Number(fuelLookupResult.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </section>
              )}

            </div>
          )}

          {etapaAtual === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Revisão antes do envio</p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight">Confira o que será registrado</h3>
                  </div>
                  <Badge className="w-fit bg-primary text-primary-foreground">
                    {valorParaRevisao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-4 border-t border-primary/15 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Fluxo</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{modoCfg?.resultado || "Solicitação de pagamento"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Pagador</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{MODO_RESUMOS[modo || "SHARE"]?.[0]?.value || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Vencimento</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{dataVencimento ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR }) : "Não informado"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Descrição</p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground" title={descricao}>{descricao || "Não informado"}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b border-border/70 pb-3">Informações da Fatura</h3>

                {!isViagemMode && !(isCombustivelMode && fuelLookupResult) && (
                  <div className="space-y-1.5">
                    <Label>Fornecedor</Label>
                    <SearchableCombobox items={fornecedores} value={fornecedorId} onChange={(id, label) => { setFornecedorId(id); setFornecedorNome(fornecedores.find((f) => f.id === id)?.label || up(label || "")); }} placeholder="Selecione ou digite" allowFreeText />
                  </div>
                )}

                {isCombustivelMode && fuelLookupResult && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-900 dark:text-emerald-100 space-y-1">
                    <div><span className="text-emerald-700 dark:text-emerald-300 font-semibold">Fornecedor (abastecedor):</span> {fuelLookupResult.abastecedor || fornecedorNome || "—"}</div>
                    <div>
                      <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Data:</span> {fuelLookupResult.data ? format(new Date(fuelLookupResult.data + "T00:00:00"), "dd/MM/yyyy") : "—"}
                      {" · "}
                      <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Vencimento:</span> {fuelLookupResult.data_vencimento_boleto ? format(new Date(fuelLookupResult.data_vencimento_boleto + "T00:00:00"), "dd/MM/yyyy") : "—"}
                    </div>
                    <p className="text-emerald-800 dark:text-emerald-200/70 pt-1">Fornecedor, data de emissão e vencimento vêm do abastecimento vinculado.</p>
                  </div>
                )}

                <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Descrição da despesa</p>
                  {descricao ? (
                    <p className="mt-2 text-sm leading-relaxed text-foreground">{descricao}</p>
                  ) : (
                    <Textarea className="mt-2 bg-background" value={descricao} onChange={(e) => setDescricao(up(e.target.value))} rows={2} maxLength={500} placeholder="Descreva a despesa antes de enviar" />
                  )}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Data de emissão (Competência)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataEmissao && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dataEmissao ? format(dataEmissao, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                          <Calendar mode="single" selected={dataEmissao} onSelect={setDataEmissao} initialFocus className={cn("p-3 pointer-events-auto")} />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data de vencimento *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataVencimento && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dataVencimento ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                          <Calendar mode="single" selected={dataVencimento} onSelect={setDataVencimento} initialFocus className={cn("p-3 pointer-events-auto")} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                <div className="space-y-1.5">
                  <Label>Observações Adicionais</Label>
                  <Textarea value={observacoes} onChange={(e) => setObservacoes(up(e.target.value))} rows={2} maxLength={1000} />
                </div>
              </section>

              {referenciaDuplicada?.tipo && (
                <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <Link2 className="mt-0.5 h-5 w-5 text-emerald-400" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Integração Detectada</p>
                      <p className="text-sm text-emerald-900 dark:text-emerald-100/80">{referenciaDuplicada.mensagem}</p>
                    </div>
                  </div>
                </section>
              )}

              <section className="space-y-4 rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Documentos e Anexos
                  </h3>
                  <Button type="button" variant="outline" size="sm" onClick={addAnexo}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar arquivo
                  </Button>
                </div>

                {isCombustivelMode && fuelLookupResult && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Anexos do abastecimento vinculado</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {[
                        { label: `Comanda${fuelLookupResult.comanda ? ` · ${fuelLookupResult.comanda}` : ""}`, url: fuelLookupResult.comanda_url },
                        { label: `Nota Fiscal${fuelLookupResult.nf ? ` · ${fuelLookupResult.nf}` : ""}`, url: fuelLookupResult.nota_url },
                        { label: "Boleto", url: fuelLookupResult.boleto_url },
                        { label: "Comprovante de Pagamento", url: fuelLookupResult.comprovante_pagamento || fuelLookupResult.comprovante_url },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-md border border-emerald-500/15 bg-background/40 px-3 py-2">
                          <FileText className={cn("h-4 w-4", item.url ? "text-emerald-400" : "text-muted-foreground")} />
                          <span className="flex-1 truncate text-emerald-900 dark:text-emerald-100/80">{item.label}</span>
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400 hover:text-sky-600 dark:hover:text-sky-300">
                              <Eye className="h-3.5 w-3.5" /> Ver
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">sem arquivo</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-200/70">Estes anexos foram carregados diretamente do registro em <span className="font-mono">abastecimentos</span>.</p>
                  </div>
                )}

                <div className="rounded-lg border border-border/70 bg-background/50 p-3 space-y-3">
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
                                <p className="text-xs text-amber-700 dark:text-amber-300">Nenhum recibo encontrado para este cliente.</p>
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
                  <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center bg-card">
                    Nenhum arquivo anexado.
                  </p>
                )}

                <div className="space-y-2">
                  {anexos.map((a, idx) => {
                    const preview = previewAnexo(a);
                    const img = isImage(a);
                    return (
                      <div key={a.id} className="rounded-lg border border-border bg-background/40 p-3 space-y-3 transition hover:bg-background/60">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          <div className="md:col-span-1 flex flex-row md:flex-col items-center gap-1 justify-center">
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => moveAnexo(a.id, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={idx === anexos.length - 1} onClick={() => moveAnexo(a.id, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                          </div>
                          <Select value={a.tipo} onValueChange={(v) => updateAnexo(a.id, { tipo: v as AnexoDoc["tipo"] })}>
                            <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
                            <SelectContent>{TIPOS_ANEXO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                          </Select>
                          {anexosClienteOptions.length > 1 && (
                            <div className="md:col-span-3">
                              <Select value={a.clienteId || "__none__"} onValueChange={(v) => updateAnexo(a.id, { clienteId: v === "__none__" ? null : v } as any)}>
                                <SelectTrigger><SelectValue placeholder="Cliente do anexo" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— Sem cliente específico —</SelectItem>
                                  {anexosClienteOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
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

                          <Input className="md:col-span-3" placeholder="Nº Documento (Opcional)" value={a.numero} onChange={(e) => updateAnexo(a.id, { numero: up(e.target.value) })} />
                          <div className="md:col-span-3">
                            <label className="flex-1 cursor-pointer block">
                              <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => updateAnexo(a.id, { arquivo: e.target.files?.[0] || null })} />
                              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm hover:bg-muted transition">
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
                            {img ? <img src={preview} alt="preview" className="h-12 w-12 rounded object-cover border border-border" /> : <div className="h-12 w-12 rounded border border-border bg-muted flex items-center justify-center"><FileText className="h-5 w-5 text-muted-foreground" /></div>}
                            <a href={preview} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-sky-700 dark:text-sky-400 hover:text-sky-600 dark:hover:text-sky-300 transition-colors">
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

        {!concluido && (
          <DialogFooter className="gap-3 border-t border-border/70 px-6 py-4 md:px-8 flex sm:justify-between w-full">
            <div className="flex-shrink-0">
              {etapaAtual > 1 && (
                <Button variant="ghost" onClick={() => setEtapaAtual((prev) => (isModoShare && prev === 3 ? 1 : prev - 1))} disabled={saving}>
                  Voltar
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>

              {etapaAtual > 0 && (etapaAtual < 3 ? (
                <Button
                  onClick={() => setEtapaAtual((prev) => (isModoShare && prev === 1 ? 3 : prev + 1))}
                  disabled={!podeAvancar() || saving}
                  className="h-11 px-5"
                >
                  {isModoShare && etapaAtual === 1 ? "Revisar documentos" : `Continuar para ${etapaLabels[etapaAtual] || "o próximo passo"}`} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => handleSalvar(true)} disabled={saving} className="h-11 border-border">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Salvar rascunho
                  </Button>
                  <Button onClick={() => handleSalvar(false)} disabled={saving} className="h-11 bg-primary font-semibold text-primary-foreground shadow-primary">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Enviar solicitação
                  </Button>
                </>
              ))}
            </div>
          </DialogFooter>
        )}
      </DialogContent>

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
                <Input value={fuelComanda} onChange={(e) => setFuelComanda(up(e.target.value))} placeholder="Nº da comanda" />
              </div>
              <div className="space-y-1.5">
                <Label>Nº da NF</Label>
                <Input value={fuelNf} onChange={(e) => setFuelNf(up(e.target.value))} placeholder="Nº da nota fiscal" />
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
                <Input value={novoAbast.local} onChange={(e) => setNovoAbast((p) => ({ ...p, local: up(e.target.value) }))} placeholder="Ex: SBSP" />
              </div>
              <div className="space-y-1.5">
                <Label>Trecho</Label>
                <Input value={novoAbast.trecho} onChange={(e) => setNovoAbast((p) => ({ ...p, trecho: up(e.target.value) }))} placeholder="Ex: SBSP-SBRJ" />
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
                <Textarea rows={2} value={novoAbast.observacao} onChange={(e) => setNovoAbast((p) => ({ ...p, observacao: up(e.target.value) }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border">
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

      <EnviarEmailClienteDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        clienteId={emailPayload?.clienteId || null}
        assuntoSugerido={emailPayload?.assunto || ""}
        mensagemSugerida={emailPayload?.mensagem || ""}
        anexos={emailPayload?.anexos || []}
        tipo="solicitacao_pagamento"
        referenceType="movimentacoes"
        referenceIds={emailPayload?.referenceIds || []}
      />
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
