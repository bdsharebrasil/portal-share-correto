// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  FileText,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign,
  Upload,
  ReceiptText,
  Banknote,
  Filter,
  SlidersHorizontal,
  Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { EnviarEmailClienteButton } from "@/components/dashboard/financeiro/EnviarEmailClienteButton";
import {
  EnviarEmailClienteDialog,
  type AnexoEmail,
} from "@/components/dashboard/financeiro/EnviarEmailClienteDialog";
import { ReciboSaidaPreviewModal } from "./ReciboSaidaPreviewModal";
import { normalizeReceiptForPdf } from "@/hooks/useReceiptPdfGenerator";
import { formatDate } from "@/lib/receiptUtils";

/* ─────────────────────────── types ─────────────────────────── */

interface NFSaida {
  id: string;
  /** origem do registro: nota fiscal de saída, recibo de saída ou arquivo do storage */
  origem?: "nf_saida" | "recibo_saida" | "storage_recebido_saida";
  numero: string | null;

  cliente_nome: string | null;
  cliente_cnpj: string | null;
  data_criacao: string | null;
  data_vencimento: string | null;
  valor: number | string | null;
  categoria: string | null;
  descricao: string | null;
  status: string | null;
  arquivo_pdf_url: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  criado_por: string | null;
  aeronave: string | null;
  cliente_id: string | null;
  aircraft_id: string | null;
  socio_id: string | null;
  categoria_id: string | null;
  categoria_despesa_id: string | null;
  categoria_despesa_subcategoria: string | null;
  contas_areceber_id: string | null;
}

interface FormState {
  numero: string;
  cliente_nome: string;
  cliente_cnpj: string;
  cliente_id: string; // Corrigido de client_id para cliente_id
  socio_id: string;
  aircraft_id: string;
  categoria_id: string;
  categoria_despesa_id: string;
  categoria_despesa_subcategoria: string;
  data_criacao: string;
  data_vencimento: string;
  valor: string;
  categoria: string;
  descricao: string;
  status: string;
  aeronave: string;
  arquivo_pdf_url: string;
}

const emptyForm: FormState = {
  numero: "", cliente_nome: "", cliente_cnpj: "", cliente_id: "", socio_id: "", aircraft_id: "", categoria_id: "", categoria_despesa_id: "",
  categoria_despesa_subcategoria: "",
  data_criacao: new Date().toISOString().slice(0, 10),
  data_vencimento: "", valor: "", categoria: "", descricao: "", status: "pendente",
  aeronave: "", arquivo_pdf_url: "",
};

interface BaixaFormState {
  data_pagamento: string;
  conta_bancaria: string;
  forma_pagamento: string;
  comprovante_url: string;
}

const emptyBaixaForm: BaixaFormState = {
  data_pagamento: new Date().toISOString().slice(0, 10),
  conta_bancaria: "",
  forma_pagamento: "PIX",
  comprovante_url: "",
};

const FORMAS_PAGAMENTO = ["PIX", "Transferência (TED/DOC)", "Boleto", "Dinheiro", "Cartão"];

interface SyncSaidaParams {
  origem: "nf_saida" | "recibo_saida";
  origemId: string;
  numero: string;
  clienteNome: string;
  clienteCnpj: string;
  clienteId: string | null;
  socioId: string | null;
  aeronaveId: string | null;
  aeronaveMatricula: string | null;
  categoriaReceitaId: string | null;
  categoriaReceitaNome: string | null;
  categoriaDespesaId: string | null;
  categoriaDespesaNome: string | null;
  valor: number;
  dataEmissao: string;
  dataVencimento: string;
  descricao: string | null;
  arquivoUrl?: string | null;
}


const CATEGORIAS_PERMITIDAS = new Set([
  "N.F DIARIAS DE VOO",
  "ADM E PILOTAGEM - N.F",
  "N.F ADM SHARE",
 "ADM SHARE - RECIBO",
  "ADM E PILOTAGEM - RECIBO",
].map((nome) => nome.toUpperCase()));

const STATUS_OPCOES = [
  { value: "pendente", label: "Pendente" },
  { value: "recebido", label: "Recebido" },
  { value: "cancelado", label: "Cancelado" },
];

/* ─────────────── categorias de despesa (expense_configu) ─────────────── */

interface ExpenseConfigRow {
  id: string;
  expense_type: string;
  subcategoria_1: string | null;
  subcategoria_2: string | null;
  subcategoria_3: string | null;
  subcategoria_4: string | null;
  categoria_pai: string | null;
}

interface DespesaOption {
  optionId: string;
  expenseConfigId: string;
  expenseType: string;
  subcategoria: string | null;
  label: string;
}

function buildDespesaOptions(rows: ExpenseConfigRow[]): DespesaOption[] {
  const options: DespesaOption[] = [];
  for (const row of rows) {
    const subcategorias = [row.subcategoria_1, row.subcategoria_2, row.subcategoria_3, row.subcategoria_4]
      .map((s) => (s ? s.trim() : s))
      .filter((s): s is string => !!s);

    if (subcategorias.length === 0) {
      options.push({
        optionId: `${row.id}::0`,
        expenseConfigId: row.id,
        expenseType: row.expense_type,
        subcategoria: null,
        label: row.expense_type,
      });
    } else {
      subcategorias.forEach((sub, index) => {
        options.push({
          optionId: `${row.id}::${index + 1}`,
          expenseConfigId: row.id,
          expenseType: row.expense_type,
          subcategoria: sub,
          label: `${row.expense_type} — ${sub}`,
        });
      });
    }
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/* ─────────────────────────── helpers ─────────────────────────── */

const num = (v: string | number | null | undefined) => Number(v) || 0;

const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);

const getFileNameFromUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split("/").pop() || "arquivo";
    return decodeURIComponent(segment);
  } catch {
    return "arquivo";
  }
};

type SortBy = "data" | "nome";
type SortDir = "asc" | "desc";

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  if (s === "recebido") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
        style={{ background: "rgba(34,197,94,0.10)", color: "#4ade80", borderColor: "rgba(34,197,94,0.25)" }}>
        <CheckCircle2 className="h-3 w-3 mr-1" /> Recebido
      </span>
    );
  }
  if (s === "cancelado") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
        style={{ background: "rgba(100,116,139,0.10)", color: "#94a3b8", borderColor: "rgba(100,116,139,0.25)" }}>
        <XCircle className="h-3 w-3 mr-1" /> Cancelado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
      style={{ background: "rgba(245,158,11,0.10)", color: "#fbbf24", borderColor: "rgba(245,158,11,0.25)" }}>
      <Clock className="h-3 w-3 mr-1" /> Pendente
    </span>
  );
}

/* ─────────────────────────── main ─────────────────────────── */

export default function NFSaidaTab() {
  const [notas, setNotas] = useState<NFSaida[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [aeronaves, setAeronaves] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [despesaOptions, setDespesaOptions] = useState<DespesaOption[]>([]);
  const [contasBancarias, setContasBancarias] = useState<any[]>([]);
  const [documentType, setDocumentType] = useState<"nota" | "recibo">("nota");
  const [uploading, setUploading] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

  // filtros e ordenação
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "pendente" | "recebido" | "cancelado">("");
  const [sortBy, setSortBy] = useState<SortBy>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // dar baixa
  const [baixaTarget, setBaixaTarget] = useState<NFSaida | null>(null);
  const [baixaForm, setBaixaForm] = useState<BaixaFormState>(emptyBaixaForm);
  const [baixaSaving, setBaixaSaving] = useState(false);
  const [baixaUploading, setBaixaUploading] = useState(false);
  const [emailTarget, setEmailTarget] = useState<NFSaida | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  // prévia do recibo de saída (gerar PDF → salvar → enviar por e-mail)
  const [reciboPreview, setReciboPreview] = useState<{ pdfData: any; payload: any } | null>(null);
  const [reciboSavedUrl, setReciboSavedUrl] = useState<string | null>(null);

  const fetchNotas = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: nfData, error: nfError }, { data: recData, error: recError }] = await Promise.all([
        supabase.from("notas_fiscais_saida").select("*").order("data_criacao", { ascending: false }),
        supabase.from("recibos_saida").select("*").order("data_emissao", { ascending: false }),
      ]);
      if (nfError) throw nfError;
      if (recError) throw recError;

      const aeronaveIds = Array.from(
        new Set((recData ?? []).map((r: any) => r.aeronave_id).filter(Boolean))
      ) as string[];

      let aeronavesById = new Map<string, string>();
      if (aeronaveIds.length > 0) {
        const { data: aeronavesData, error: aeronavesError } = await supabase
          .from("aeronave")
          .select("id, matricula")
          .in("id", aeronaveIds);

        if (aeronavesError) throw aeronavesError;

        aeronavesById = new Map(
          (aeronavesData ?? []).map((a: any) => [a.id, a.matricula ?? ""])
        );
      }

      const nfs: NFSaida[] = (nfData ?? []).map((n: any) => ({ ...n, origem: "nf_saida" as const }));
      const recibos: NFSaida[] = (recData ?? []).map((r: any) => ({
        id: r.id,
        origem: "recibo_saida" as const,
        numero: r.numero_recibo,
        cliente_nome: r.nome_pagador,
        cliente_cnpj: r.documento_pagador,
        data_criacao: r.data_emissao,
        data_vencimento: r.data_vencimento,
        valor: r.valor_total ?? r.valor,
        categoria: r.nome_categoria ?? r.tipo_recibo,
        descricao: r.descricao_servico,
        status: r.status,
        arquivo_pdf_url: r.pdf_url ?? r.nf_url ?? null,
        criado_em: r.criado_em,
        atualizado_em: r.atualizado_em,
        criado_por: r.usuario_id ?? null,
        aeronave: aeronavesById.get(r.aeronave_id) ?? null,
        cliente_id: r.cliente_id,
        aircraft_id: r.aeronave_id,
        socio_id: r.socio_id,
        categoria_id: r.categoria_id,
        categoria_despesa_id: r.categoria_despesa_id,
        categoria_despesa_subcategoria: r.categoria_despesa_subcategoria,
        contas_areceber_id: r.contas_areceber_id,
      }));

      const merged = [...nfs, ...recibos].sort((a, b) =>
        (b.data_criacao ?? "").localeCompare(a.data_criacao ?? "")
      );
      setNotas(merged);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao carregar notas." });
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => { fetchNotas(); }, [fetchNotas]);

  useEffect(() => {
    const loadFormData = async () => {
      const [
        clientesResult,
        sociosResult,
        aeronavesResult,
        categoriasResult,
        expenseConfigResult,
        bancosResult,
      ] = await Promise.allSettled([
        supabase.from("clientes").select("id, razao_social, proprietario, cnpj").order("razao_social"),
        supabase.from("socios").select("id, clientes_id, nome, cpf").order("nome"),
        supabase.from("aeronave").select("id, matricula").order("matricula"),
        supabase.from("categorias_movimentacao").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("expense_configu").select("id, expense_type, subcategoria_1, subcategoria_2, subcategoria_3, subcategoria_4, categoria_pai").order("expense_type"),
        supabase.from("contas_bancarias").select("id, banco, numero_conta").eq("ativo", true).order("banco"),
      ]);

      const clientesData = clientesResult.status === "fulfilled" ? (clientesResult.value.data || []) : [];
      const sociosData = sociosResult.status === "fulfilled" ? (sociosResult.value.data || []) : [];
      const aeronavesData = aeronavesResult.status === "fulfilled" ? (aeronavesResult.value.data || []) : [];
      const categoriasData = categoriasResult.status === "fulfilled" ? (categoriasResult.value.data || []) : [];
      const expenseConfigData = expenseConfigResult.status === "fulfilled" ? (expenseConfigResult.value.data || []) : [];
      const bancosData = bancosResult.status === "fulfilled" ? (bancosResult.value.data || []) : [];

      setClientes([
        ...(clientesData || []).map((cliente: any) => ({ id: `cliente:${cliente.id}`, clienteId: cliente.id, socioId: null as string | null, nome: cliente.razao_social || cliente.proprietario || "Cliente", documento: cliente.cnpj || "", tipo: "Cliente" })),
        ...(sociosData || []).map((socio: any) => ({ id: `socio:${socio.id}`, clienteId: socio.clientes_id ?? socio.cliente_id ?? null, socioId: socio.id as string | null, nome: socio.nome, documento: socio.cpf || "", tipo: "Sócio" })),
      ]);
      setAeronaves(aeronavesData || []);
      setCategorias((categoriasData || []).filter((categoria: any) => CATEGORIAS_PERMITIDAS.has((categoria.nome || "").trim().toUpperCase())));
      setDespesaOptions(buildDespesaOptions((expenseConfigData || []) as ExpenseConfigRow[]));
      setContasBancarias(bancosData || []);
    };
    loadFormData();
  }, []);

  const summary = useMemo(() => {
    const total = notas.length;
    const totalPendente = notas
      .filter((n) => (n.status ?? "").toLowerCase() === "pendente")
      .reduce((s, n) => s + num(n.valor), 0);
    const totalRecebido = notas
      .filter((n) => (n.status ?? "").toLowerCase() === "recebido")
      .reduce((s, n) => s + num(n.valor), 0);
    return { total, totalPendente, totalRecebido };
  }, [notas]);

  const hasActiveFilters = !!dateFrom || !!dateTo || !!statusFilter;

  const filteredNotas = useMemo(() => {
    let result = notas;
    if (dateFrom) result = result.filter((n) => (n.data_criacao ?? "") >= dateFrom);
    if (dateTo) result = result.filter((n) => (n.data_criacao ?? "") <= dateTo);
    if (statusFilter) result = result.filter((n) => (n.status ?? "").toLowerCase() === statusFilter);

    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "data") {
        cmp = (a.data_criacao ?? "").localeCompare(b.data_criacao ?? "");
      } else {
        cmp = (a.cliente_nome ?? "").localeCompare(b.cliente_nome ?? "", "pt-BR");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [notas, dateFrom, dateTo, statusFilter, sortBy, sortDir]);

  const toggleClientGroup = (clientName: string) => {
    setExpandedClients((current) => ({
      ...current,
      [clientName]: !current[clientName],
    }));
  };

  const toggleYearGroup = (clientName: string, year: string) => {
    const key = `${clientName}|${year}`;
    setExpandedYears((current) => ({ ...current, [key]: !current[key] }));
  };

  // Agrupamento hierárquico: cotista/cliente → ano → notas.
  const groupedNotas = useMemo(() => {
    const groups: Record<string, Record<string, NFSaida[]>> = {};

    filteredNotas.forEach((n) => {
      const pessoa = clientes.find((item: any) => item.socioId && item.socioId === n.socio_id)
        || clientes.find((item: any) => item.clienteId && item.clienteId === n.cliente_id);
      const cotistaNome = pessoa?.nome || n.cliente_nome || "Cotista não informado";
      const ano = n.data_criacao?.slice(0, 4) || "Sem ano";
      groups[cotistaNome] ||= {};
      groups[cotistaNome][ano] ||= [];
      groups[cotistaNome][ano].push(n);
    });

    Object.values(groups).forEach((anos) => Object.values(anos).forEach((items) => items.sort((a, b) => {
      const aPendente = (a.status || "").toLowerCase() === "pendente";
      const bPendente = (b.status || "").toLowerCase() === "pendente";
      if (aPendente !== bPendente) return aPendente ? -1 : 1;
      return (b.data_criacao ?? "").localeCompare(a.data_criacao ?? "");
    })));

    return groups;
  }, [filteredNotas, clientes]);

  const clearFilters = () => { setDateFrom(""); setDateTo(""); setStatusFilter(""); };

  const selectedDespesaOptionId = useMemo(() => {
    if (!form.categoria_despesa_id) return "";
    const match = despesaOptions.find((option) =>
      option.expenseConfigId === form.categoria_despesa_id &&
      (option.subcategoria ?? "") === (form.categoria_despesa_subcategoria ?? "")
    );
    return match?.optionId ?? "";
  }, [despesaOptions, form.categoria_despesa_id, form.categoria_despesa_subcategoria]);

  const openNew = () => { setForm(emptyForm); setEditingId(null); setDocumentType("nota"); setShowForm(true); };
  const openNewReceipt = () => { setForm(emptyForm); setEditingId(null); setDocumentType("recibo"); setShowForm(true); };
  const openEdit = (n: NFSaida) => {
    if (n.origem === "recibo_saida") {
      setToast({ type: "err", text: "Recibos de saída não são editáveis por aqui — exclua e emita novamente se necessário." });
      return;
    }
    setForm({

      numero: n.numero ?? "", cliente_nome: n.cliente_nome ?? "", cliente_cnpj: n.cliente_cnpj ?? "",
      data_criacao: n.data_criacao ?? new Date().toISOString().slice(0, 10),
      data_vencimento: n.data_vencimento ?? "", valor: n.valor != null ? String(n.valor) : "",
      categoria: n.categoria ?? "", descricao: n.descricao ?? "", status: n.status ?? "pendente",
      cliente_id: n.cliente_id ?? "", socio_id: n.socio_id ?? "", aircraft_id: n.aircraft_id ?? "",
      categoria_id: n.categoria_id ?? "", categoria_despesa_id: n.categoria_despesa_id ?? "",
      categoria_despesa_subcategoria: n.categoria_despesa_subcategoria ?? "",
      aeronave: n.aeronave ?? "", arquivo_pdf_url: n.arquivo_pdf_url ?? "",
    });
    setEditingId(n.id); setDocumentType("nota"); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setDocumentType("nota"); setForm(emptyForm); };

  const uploadDocument = async (file: File) => {
    setUploading(true); setToast(null);
    try {
      const extension = file.name.split(".").pop() || "file";
      const path = `notas-saida/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("nfs-share-saida").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("nfs-share-saida").getPublicUrl(path);
      setForm((current) => ({ ...current, arquivo_pdf_url: data.publicUrl }));
      setToast({ type: "ok", text: "Arquivo enviado com sucesso." });
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao enviar arquivo." });
    } finally { setUploading(false); }
  };

  const syncSaidaFinancialLegs = useCallback(async (params: SyncSaidaParams) => {
    const isRecibo = params.origem === "recibo_saida";
    const anexoUrl = params.arquivoUrl || null;

    const { data: areceber, error: areceberError } = await supabase
      .from("contas_areceber")
      .insert({
        numero: params.numero,
        cliente_nome: params.clienteNome,
        cliente_cnpj: params.clienteCnpj,
        cliente_id: params.clienteId,
        socio_id: params.socioId,
        data_criacao: params.dataEmissao,
        data_vencimento: params.dataVencimento || params.dataEmissao,
        valor: params.valor,
        categoria: params.categoriaReceitaNome,
        categoria_id: params.categoriaReceitaId,
        descricao: params.descricao,
        status: "pendente",
        aeronave: params.aeronaveMatricula,
        arquivo_pdf_url: anexoUrl,
        nota_fiscal_url: isRecibo ? null : anexoUrl,
        nf_saida_id: params.origem === "nf_saida" ? params.origemId : null,
        reference_type: `${params.origem}:${params.origemId}`,
        reference_id: params.origemId,
      })
      .select("id")
      .single();

    if (areceberError) throw areceberError;

    const descricaoLancamento = params.descricao || `${params.numero} - ${params.clienteNome}`;

    const { error: movShareError } = await supabase.from("movimentacoes").insert({
      descricao: descricaoLancamento,
      fluxo: "receita",
      tipo_caixa: "share",
      categoria_id: params.categoriaReceitaId,
      categoria_nome: params.categoriaReceitaNome,
      valor_rateado: params.valor,
      valor_total: params.valor,
      data_emissao: params.dataEmissao,
      data_vencimento: params.dataVencimento || params.dataEmissao,
      aeronave_id: params.aeronaveId,
      clientes_id: params.clienteId,
      socio_id: params.socioId,
      status: "pendente",
      numero_nf: params.origem === "nf_saida" ? params.numero : null,
      numero_recibo: params.origem === "recibo_saida" ? params.numero : null,
      contas_areceber_id: areceber.id,
      reference_type: `${params.origem}:${params.origemId}:mov_share`,
      reference_id: params.origemId,
    });
    if (movShareError) throw movShareError;

    /* O rateio de despesas exige um vínculo com a movimentação de despesa do cliente.
       Mesmo para recibos de saída, criamos esse registro para manter o fluxo consistente. */
    let movClienteId: string | null = null;
    const { data: movCliente, error: movClienteError } = await supabase.from("movimentacoes").insert({
      descricao: descricaoLancamento,
      fluxo: "despesa",
      tipo_caixa: "cliente",
      categoria_id: params.categoriaDespesaId,
      categoria_nome: params.categoriaDespesaNome,
      valor_rateado: params.valor,
      valor_total: params.valor,
      data_emissao: params.dataEmissao,
      data_vencimento: params.dataVencimento || params.dataEmissao,
      aeronave_id: params.aeronaveId,
      clientes_id: params.clienteId,
      socio_id: params.socioId,
      status: "pendente",
      numero_nf: isRecibo ? null : params.numero,
      numero_recibo: isRecibo ? params.numero : null,
      contas_areceber_id: areceber.id,
      reference_type: `${params.origem}:${params.origemId}:mov_cliente`,
      reference_id: params.origemId,
    }).select("id").single();
    if (movClienteError) throw movClienteError;
    movClienteId = movCliente?.id ?? null;

    /* ── 4ª perna: rateio de despesas (conta pendente no caixa do cliente) ── */
    let percentualSociedade: number | null = null;
    if (params.aeronaveId && (params.socioId || params.clienteId)) {
      let cotistaQuery = supabase
        .from("cotistas_aeronave")
        .select("percentual_sociedade")
        .eq("id_aeronave", params.aeronaveId);
      cotistaQuery = params.socioId
        ? cotistaQuery.eq("socios_id", params.socioId)
        : cotistaQuery.eq("id_clientes", params.clienteId);
      const { data: cotista } = await cotistaQuery.maybeSingle();
      if (cotista?.percentual_sociedade != null) percentualSociedade = Number(cotista.percentual_sociedade);
    }

    const { error: rateioError } = await supabase.from("rateio_despesas").insert({
      fonte_despesa: params.origem,
      tipo_rateio: "FIXO",
      fluxo: "SAIDA",
      periodicidade: isRecibo ? "MENSAL" : "EVENTUAL",
      data_emissao: params.dataEmissao,
      data_vencimento: params.dataVencimento || params.dataEmissao,
      numero_doc: params.numero,
      numero_nf: isRecibo ? null : params.numero,
      numero_recibo: isRecibo ? params.numero : null,
      fornecedor_nome: "SHARE BRASIL",
      cliente_id: params.clienteId,
      clientes_nome: params.clienteNome,
      socio_id: params.socioId,
      // pago_por só é preenchido na baixa do recebimento
      pago_por: null,
      aeronave_id: params.aeronaveId,
      aeronave_registro: params.aeronaveMatricula,
      percentual_sociedade: percentualSociedade,
      percentual_uso: 100,
      descricao_despesa: descricaoLancamento,
      valor_total: params.valor,
      valor_rateado: params.valor,
      status: "PENDENTE",
      categoria_custo: params.categoriaDespesaId,
      subcategoria_1: isRecibo ? "ADM SHARE - RECIBO" : (params.categoriaDespesaNome || null),
      despesa_id: movClienteId,
      nf_url: isRecibo ? null : anexoUrl,
      recibo_url: isRecibo ? anexoUrl : null,
    });
    if (rateioError) throw rateioError;




    const tabelaOrigem = params.origem === "nf_saida" ? "notas_fiscais_saida" : "recibos_saida";
    const { error: linkError } = await supabase
      .from(tabelaOrigem)
      .update({ contas_areceber_id: areceber.id })
      .eq("id", params.origemId);
    if (linkError) throw linkError;

    return areceber.id as string;
  }, []);

  const buildNumeroRecibo = useCallback(async (numeroInformado: string) => {
    const numeroBase = numeroInformado.trim().replace(/^REC-/i, "");
    if (!numeroBase) return null;

    let codigoCliente: string | null = null;
    if (form.cliente_id) {
      let query = supabase
        .from("cotistas_aeronave")
        .select("codigo_cliente")
        .eq("id_clientes", form.cliente_id)
        .not("codigo_cliente", "is", null);
      if (form.aircraft_id) query = query.eq("id_aeronave", form.aircraft_id);
      if (form.socio_id) query = query.eq("socios_id", form.socio_id);

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) {
        console.error("Erro ao buscar codigo_cliente para recibo de saída:", error);
      }
      codigoCliente = (data?.codigo_cliente as string | undefined)?.trim()?.toUpperCase() || null;
    }

    const prefixo = codigoCliente || "CLI";
    return `REC-${prefixo}${numeroBase}`;
  }, [form.cliente_id, form.aircraft_id, form.socio_id]);

  const save = async () => {
    if (!form.numero.trim()) { setToast({ type: "err", text: `Informe o número ${documentType === "nota" ? "da nota" : "do recibo"}.` }); return; }
    if (!form.cliente_nome.trim() || !form.cliente_cnpj.trim() || !form.aeronave || !form.categoria) { setToast({ type: "err", text: "Selecione cliente, aeronave e categoria." }); return; }
    if (!form.categoria_despesa_id) { setToast({ type: "err", text: "Selecione a categoria de despesa do cliente (perna 'cliente' do lançamento)." }); return; }
    if (!(Number(form.valor) > 0)) { setToast({ type: "err", text: "Informe um valor maior que zero." }); return; }
    setSaving(true); setToast(null);
    try {
      const despesaSelecionada = despesaOptions.find((option) => option.optionId === selectedDespesaOptionId);
      const categoriaDespesaNome = despesaSelecionada?.label ?? null;
      const dataVencimentoFinal = form.data_vencimento || form.data_criacao;

      if (documentType === "recibo") {
        const descricaoServico = form.descricao.trim() || "Serviços aeronáuticos";
        const numeroRecibo = await buildNumeroRecibo(form.numero.trim());
        if (!numeroRecibo) {
          setToast({ type: "err", text: "Informe o número do recibo." });
          return;
        }

        // evita recibos duplicados com o mesmo número
        const { data: jaExiste } = await supabase
          .from("recibos_saida")
          .select("id")
          .eq("numero_recibo", numeroRecibo)
          .maybeSingle();
        if (jaExiste?.id) {
          setToast({ type: "err", text: `Já existe um recibo de saída com o número ${numeroRecibo}.` });
          return;
        }

        const pdfData = await normalizeReceiptForPdf({
          receipt_number: numeroRecibo,
          payer_name: form.cliente_nome.trim(),
          payer_document: form.cliente_cnpj.trim(),
          service_description: descricaoServico,
          receipt_type: "pagamento",
          issue_date: form.data_criacao,
          max_payment_date: dataVencimentoFinal,
          nome_categoria: form.categoria,
          valor: Number(form.valor) || 0,
        });

        setReciboPreview({
          pdfData,
          payload: {
            numeroRecibo,
            descricaoServico,
            dataVencimentoFinal,
            categoriaDespesaNome,
          },
        });
        setReciboSavedUrl(null);
        return;


      } else {
        const payload = {
          numero: form.numero.trim(), cliente_nome: form.cliente_nome.trim(), cliente_cnpj: form.cliente_cnpj.trim(),
          cliente_id: form.cliente_id || null, socio_id: form.socio_id || null, aircraft_id: form.aircraft_id || null,
          categoria_id: form.categoria_id || null, categoria_despesa_id: form.categoria_despesa_id || null,
          categoria_despesa_subcategoria: form.categoria_despesa_subcategoria || null,
          data_criacao: form.data_criacao, data_vencimento: dataVencimentoFinal,
          valor: Number(form.valor) || 0, categoria: form.categoria, descricao: form.descricao.trim() || null, status: form.status,
          aeronave: form.aeronave, arquivo_pdf_url: form.arquivo_pdf_url.trim() || null,
        };
        if (editingId) {
          const { error } = await supabase.from("notas_fiscais_saida").update({ ...payload, atualizado_em: new Date().toISOString() }).eq("id", editingId);
          if (error) throw error;
          setToast({ type: "ok", text: "Nota fiscal atualizada. (Lançamentos financeiros já existentes não são recalculados na edição — avise se precisar ajustar valor/categoria de uma nota já sincronizada.)" });
        } else {
          const { data: inserted, error } = await supabase.from("notas_fiscais_saida").insert({ ...payload, criado_em: new Date().toISOString() }).select("id").single();
          if (error) throw error;

          await syncSaidaFinancialLegs({
            origem: "nf_saida",
            origemId: inserted.id,
            numero: form.numero.trim(),
            clienteNome: form.cliente_nome.trim(),
            clienteCnpj: form.cliente_cnpj.trim(),
            clienteId: form.cliente_id || null,
            socioId: form.socio_id || null,
            aeronaveId: form.aircraft_id || null,
            aeronaveMatricula: form.aeronave || null,
            categoriaReceitaId: form.categoria_id || null,
            categoriaReceitaNome: form.categoria,
            categoriaDespesaId: form.categoria_despesa_id || null,
            categoriaDespesaNome: categoriaDespesaNome,
            valor: Number(form.valor) || 0,
            dataEmissao: form.data_criacao,
            dataVencimento: dataVencimentoFinal,
            descricao: form.descricao.trim() || null,
            arquivoUrl: form.arquivo_pdf_url.trim() || null,
          });

          setToast({ type: "ok", text: "Nota fiscal criada e lançamentos financeiros gerados (contas a receber Share + despesa do cliente)." });
        }
        fetchNotas();
      }
      closeForm();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao salvar." });
    } finally { setSaving(false); }
  };

  /** Confirma a prévia: sobe o PDF, grava 1 único recibo e gera as pernas financeiras. */
  const confirmReciboSave = async (blob: Blob) => {
    if (!reciboPreview || reciboSavedUrl) return;
    const { numeroRecibo, descricaoServico, dataVencimentoFinal, categoriaDespesaNome } = reciboPreview.payload;
    setSaving(true); setToast(null);
    try {
      const path = `recibos/${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("nfs-share-saida")
        .upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("nfs-share-saida").getPublicUrl(path);
      const reciboUrl = urlData?.publicUrl || null;

      const { data: inserted, error } = await supabase.from("recibos_saida").insert({
        numero_recibo: numeroRecibo, tipo_recibo: form.categoria, categoria_id: form.categoria_id || null,
        categoria_despesa_id: form.categoria_despesa_id || null,
        categoria_despesa_subcategoria: form.categoria_despesa_subcategoria || null,
        subcategoria_1: "ADM SHARE - RECIBO",
        nome_categoria: form.categoria, cliente_id: form.cliente_id || null, socio_id: form.socio_id || null,
        aeronave_id: form.aircraft_id || null,
        nome_pagador: form.cliente_nome.trim(), documento_pagador: form.cliente_cnpj.trim(),
        data_emissao: form.data_criacao, data_vencimento: form.data_vencimento || null,
        valor: Number(form.valor) || 0, valor_total: Number(form.valor) || 0,
        descricao_servico: descricaoServico, status: form.status,
        pdf_url: reciboUrl,
        recibo_url: reciboUrl,
      }).select("id").single();
      if (error) throw error;

      await syncSaidaFinancialLegs({
        origem: "recibo_saida",
        origemId: inserted.id,
        numero: numeroRecibo,
        clienteNome: form.cliente_nome.trim(),
        clienteCnpj: form.cliente_cnpj.trim(),
        clienteId: form.cliente_id || null,
        socioId: form.socio_id || null,
        aeronaveId: form.aircraft_id || null,
        aeronaveMatricula: form.aeronave || null,
        categoriaReceitaId: form.categoria_id || null,
        categoriaReceitaNome: form.categoria,
        categoriaDespesaId: form.categoria_despesa_id || null,
        categoriaDespesaNome: categoriaDespesaNome,
        valor: Number(form.valor) || 0,
        dataEmissao: form.data_criacao,
        dataVencimento: dataVencimentoFinal,
        descricao: descricaoServico,
        arquivoUrl: reciboUrl,
      });

      setReciboSavedUrl(reciboUrl);
      setEmailTarget({
        id: inserted.id,
        origem: "recibo_saida",
        numero: numeroRecibo,
        cliente_nome: form.cliente_nome.trim(),
        cliente_cnpj: form.cliente_cnpj.trim(),
        data_criacao: form.data_criacao,
        data_vencimento: dataVencimentoFinal,
        valor: Number(form.valor) || 0,
        categoria: form.categoria,
        descricao: descricaoServico,
        status: form.status,
        arquivo_pdf_url: reciboUrl,
        criado_em: null, atualizado_em: null, criado_por: null,
        aeronave: form.aeronave || null,
        cliente_id: form.cliente_id || null,
        aircraft_id: form.aircraft_id || null,
        socio_id: form.socio_id || null,
        categoria_id: form.categoria_id || null,
        categoria_despesa_id: form.categoria_despesa_id || null,
        categoria_despesa_subcategoria: form.categoria_despesa_subcategoria || null,
        contas_areceber_id: null,
      } as NFSaida);

      setToast({ type: "ok", text: "Recibo de saída salvo com PDF e lançamentos financeiros gerados." });
      fetchNotas();
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao salvar o recibo." });
    } finally { setSaving(false); }
  };

  const closeReciboPreview = () => {
    setReciboPreview(null);
    if (reciboSavedUrl) { setReciboSavedUrl(null); closeForm(); }
  };



  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const target = notas.find((n) => n.id === deleteId);
      const tabela = target?.origem === "recibo_saida" ? "recibos_saida" : "notas_fiscais_saida";
      const { error } = await supabase.from(tabela).delete().eq("id", deleteId);
      if (error) throw error;
      setToast({ type: "ok", text: target?.origem === "recibo_saida" ? "Recibo de saída excluído." : "Nota fiscal excluída." });
      setDeleteId(null); fetchNotas();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao excluir." });
    } finally { setDeleting(false); }

  };

  /* ─────────────── dar baixa (registrar recebimento) ─────────────── */

  const openEmail = (n: NFSaida) => {
    setEmailTarget(n);
    setEmailOpen(true);
  };

  const openBaixa = (n: NFSaida) => { setBaixaTarget(n); setBaixaForm(emptyBaixaForm); };
  const closeBaixa = () => { setBaixaTarget(null); setBaixaForm(emptyBaixaForm); };

  const uploadComprovante = async (file: File) => {
    setBaixaUploading(true); setToast(null);
    try {
      const extension = file.name.split(".").pop() || "file";
      const path = `comprovantes-saida/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("nfs-share-saida").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("nfs-share-saida").getPublicUrl(path);
      setBaixaForm((current) => ({ ...current, comprovante_url: data.publicUrl }));
      setToast({ type: "ok", text: "Comprovante enviado." });
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao enviar comprovante." });
    } finally { setBaixaUploading(false); }
  };

  const confirmBaixa = async () => {
    if (!baixaTarget?.contas_areceber_id) return;
    if (!baixaForm.data_pagamento) { setToast({ type: "err", text: "Informe a data do pagamento." }); return; }
    setBaixaSaving(true); setToast(null);
    try {
      const agora = new Date().toISOString();

      const { error: areceberErr } = await supabase.from("contas_areceber").update({
        status: "recebido",
        data_pagamento: baixaForm.data_pagamento,
        data_recebimento: baixaForm.data_pagamento,
        conta_bancaria: baixaForm.conta_bancaria || null,
        metodo_pagamento: baixaForm.forma_pagamento || null,
        comprovante_recebimento_url: baixaForm.comprovante_url || null,
        comprovante_url: baixaForm.comprovante_url || null,
        atualizado_em: agora,
      }).eq("id", baixaTarget.contas_areceber_id);
      if (areceberErr) throw areceberErr;

      const { error: movShareErr } = await supabase.from("movimentacoes").update({
        status: "recebido",
        data_pagamento: baixaForm.data_pagamento,
        conta_bancaria: baixaForm.conta_bancaria || null,
        forma_pagamento: baixaForm.forma_pagamento || null,
        comprovante_url: baixaForm.comprovante_url || null,
        atualizado_em: agora,
      }).eq("contas_areceber_id", baixaTarget.contas_areceber_id).eq("tipo_caixa", "share");
      if (movShareErr) throw movShareErr;

      const { error: movClienteErr } = await supabase.from("movimentacoes").update({
        status: "pago",
        data_pagamento: baixaForm.data_pagamento,
        conta_bancaria: baixaForm.conta_bancaria || null,
        forma_pagamento: baixaForm.forma_pagamento || null,
        comprovante_url: baixaForm.comprovante_url || null,
        atualizado_em: agora,
      }).eq("contas_areceber_id", baixaTarget.contas_areceber_id).eq("tipo_caixa", "cliente");
      if (movClienteErr) throw movClienteErr;

      const tabelaBaixa = baixaTarget.origem === "recibo_saida" ? "recibos_saida" : "notas_fiscais_saida";
      const { error: nfErr } = await supabase.from(tabelaBaixa).update({
        status: "recebido",
        atualizado_em: agora,
      }).eq("id", baixaTarget.id);
      if (nfErr) throw nfErr;

      const { error: rateioBaixaErr } = await supabase.from("rateio_despesas").update({
        status: "PAGO",
        data_pagamento: baixaForm.data_pagamento,
        valor_pago_real: Number(baixaTarget.valor) || null,
        comprovante_url: baixaForm.comprovante_url || null,
        // pago_por só é preenchido após a baixa do recebimento
        pago_por: baixaTarget.socio_id || baixaTarget.cliente_id || null,
        atualizado_em: agora,
      }).eq("fonte_despesa", baixaTarget.origem || "nf_saida").eq("numero_doc", baixaTarget.numero);
      if (rateioBaixaErr) throw rateioBaixaErr;


      setToast({ type: "ok", text: "Baixa registrada: receita da Share recebida e despesa do cliente quitada." });
      closeBaixa();
      fetchNotas();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao dar baixa." });
    } finally { setBaixaSaving(false); }
  };

  const inputCls = "border border-slate-700 bg-slate-950/70 text-slate-100 placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 w-full";
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Notas Fiscais de Saída</h2>
          <p className="text-xs text-slate-400">Notas fiscais emitidas para clientes.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchNotas} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          <button onClick={openNew} className="text-slate-950 rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center gap-2" style={{ background: "#06b6d4" }}>
            <Plus className="h-4 w-4" /> Nova Nota
          </button>
        </div>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: "Total Notas", value: String(summary.total), icon: FileText, color: "#38bdf8" },
          { label: "Total Pendente", value: formatBRL(summary.totalPendente), icon: Clock, color: "#fbbf24" },
          { label: "Total Recebido", value: formatBRL(summary.totalRecebido), icon: DollarSign, color: "#4ade80" },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl p-4" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.label}</span>
                <Icon className="h-4 w-4" style={{ color: c.color }} />
              </div>
              <div className="text-lg font-bold mt-1" style={{ color: c.color }}>{c.value}</div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="rounded-lg px-4 py-2 text-sm border"
          style={{ background: toast.type === "ok" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
            color: toast.type === "ok" ? "#4ade80" : "#f87171",
            borderColor: toast.type === "ok" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)" }}>
          {toast.text}
        </div>
      )}

      {/* inline form */}
      {showForm && (
        <div className="rounded-2xl p-5 space-y-4" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-slate-100">{editingId ? "Editar Nota Fiscal" : documentType === "recibo" ? "Novo Recibo de Saída" : "Nova Nota Fiscal"}</h3>
              {!editingId && documentType === "nota" && <button onClick={openNewReceipt} className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"><ReceiptText className="h-3.5 w-3.5" /> Novo Recibo</button>}
            </div>
            <button onClick={closeForm} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Número *</label>
              <input className={inputCls} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
            <div><label className={labelCls}>Cliente ou Sócio *</label>
              <SearchableCombobox items={clientes.map((pessoa) => ({ id: pessoa.id, label: `${pessoa.nome} · ${pessoa.tipo}` }))} value={form.cliente_id ? clientes.find((pessoa) => pessoa.clienteId === form.cliente_id && pessoa.nome === form.cliente_nome)?.id || form.cliente_nome : form.cliente_nome} onChange={(id, label) => {
                const pessoa = clientes.find((item) => item.id === id);
                setForm(pessoa ? { ...form, cliente_id: pessoa.clienteId, socio_id: pessoa.socioId || "", cliente_nome: pessoa.nome, cliente_cnpj: pessoa.documento } : { ...form, cliente_id: "", socio_id: "", cliente_nome: label });
              }} placeholder="Selecione ou informe manualmente" searchPlaceholder="Buscar cliente ou sócio..." emptyMessage="Nenhum cadastro encontrado." allowFreeText />
            </div>
            <div><label className={labelCls}>CNPJ / CPF *</label>
              <input className={inputCls} value={form.cliente_cnpj} onChange={(e) => setForm({ ...form, cliente_id: "", socio_id: "", cliente_cnpj: e.target.value })} placeholder="Preenchido ao selecionar" /></div>
            <div><label className={labelCls}>Data Emissão</label>
              <input type="date" className={inputCls} value={form.data_criacao} onChange={(e) => setForm({ ...form, data_criacao: e.target.value })} /></div>
            <div><label className={labelCls}>Data Vencimento</label>
              <input type="date" className={inputCls} value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} /></div>
            <div><label className={labelCls}>Valor (R$)</label>
              <input type="number" step="0.01" className={inputCls} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
            <div><label className={labelCls}>Categoria (Receita Share) *</label>
              <SearchableCombobox items={categorias.map((categoria) => ({ id: categoria.id, label: categoria.nome }))} value={form.categoria_id || form.categoria} onChange={(id, label) => setForm({ ...form, categoria_id: id, categoria: label })} placeholder="Selecione a categoria" searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma categoria permitida encontrada." />
            </div>
            <div><label className={labelCls}>Categoria de Despesa (Cliente) *</label>
              <SearchableCombobox
                items={despesaOptions.map((option) => ({ id: option.optionId, label: option.label }))}
                value={selectedDespesaOptionId}
                onChange={(optionId) => {
                  const option = despesaOptions.find((item) => item.optionId === optionId);
                  setForm({
                    ...form,
                    categoria_despesa_id: option?.expenseConfigId ?? "",
                    categoria_despesa_subcategoria: option?.subcategoria ?? "",
                  });
                }}
                placeholder="Como isso entra no caixa do cliente"
                searchPlaceholder="Buscar categoria de despesa..."
                emptyMessage="Nenhuma categoria de despesa encontrada."
              />
            </div>
            <div><label className={labelCls}>Aeronave *</label>
              <SearchableCombobox items={aeronaves.map((aeronave) => ({ id: aeronave.id, label: aeronave.matricula }))} value={form.aircraft_id || form.aeronave} onChange={(id, label) => setForm({ ...form, aircraft_id: id, aeronave: label })} placeholder="Selecione a aeronave" searchPlaceholder="Buscar aeronave..." emptyMessage="Nenhuma aeronave encontrada." />
            </div>
            <div><label className={labelCls}>Status</label>
              <select className={inputCls + " cursor-pointer"} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPCOES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select></div>
            <div className="md:col-span-3"><label className={labelCls}>Descrição</label>
              <textarea className={inputCls} rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="md:col-span-3">
              <label className={labelCls}>PDF ou imagem</label>
              {form.arquivo_pdf_url ? (
                <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
                  {isImageUrl(form.arquivo_pdf_url) ? (
                    <img src={form.arquivo_pdf_url} alt="Pré-visualização" className="h-16 w-16 shrink-0 rounded-lg border border-slate-700 object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900">
                      <FileText className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-200">{getFileNameFromUrl(form.arquivo_pdf_url)}</p>
                    <a href={form.arquivo_pdf_url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300">Abrir arquivo</a>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
                      <Upload className="h-3.5 w-3.5" /> {uploading ? "Enviando..." : "Trocar"}
                      <input type="file" accept="application/pdf,image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadDocument(file); e.target.value = ""; }} />
                    </label>
                    <button type="button" onClick={() => setForm({ ...form, arquivo_pdf_url: "" })} className="rounded-lg border border-red-900/50 bg-red-950/40 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-900/40">
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6 text-center text-xs text-slate-400 hover:border-cyan-400/50 hover:text-slate-200">
                  <Upload className="h-5 w-5" />
                  {uploading ? "Enviando..." : "Clique para enviar PDF ou imagem"}
                  <input type="file" accept="application/pdf,image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadDocument(file); e.target.value = ""; }} />
                </label>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeForm} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm">Cancelar</button>
            <button onClick={save} disabled={saving} className="text-slate-950 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "#06b6d4" }}>
              {saving ? "Salvando..." : editingId ? "Salvar Alterações" : documentType === "recibo" ? "Criar Recibo" : "Criar Nota"}
            </button>
          </div>
        </div>
      )}

      {/* filtros e ordenação */}
      <div className="rounded-2xl" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowFilterPanel(!showFilterPanel); setShowSortMenu(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors bg-slate-950/70 ${showFilterPanel ? "border-cyan-400/40 text-cyan-300" : "border-slate-700 text-slate-200 hover:bg-slate-800"}`}>
              <Filter className="h-3.5 w-3.5" /> Filtros{hasActiveFilters ? " •" : ""}
            </button>
            <div className="relative">
              <button onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterPanel(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors bg-slate-950/70 ${showSortMenu ? "border-cyan-400/40 text-cyan-300" : "border-slate-700 text-slate-200 hover:bg-slate-800"}`}>
                <SlidersHorizontal className="h-3.5 w-3.5" /> Ordenar
              </button>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1">
                    {([
                      { by: "data" as const, dir: "desc" as const, label: "Data — Mais recente" },
                      { by: "data" as const, dir: "asc" as const, label: "Data — Mais antiga" },
                      { by: "nome" as const, dir: "asc" as const, label: "Cliente — A a Z" },
                      { by: "nome" as const, dir: "desc" as const, label: "Cliente — Z a A" },
                    ]).map((opt) => {
                      const active = sortBy === opt.by && sortDir === opt.dir;
                      return (
                        <button
                          key={`${opt.by}-${opt.dir}`}
                          onClick={() => { setSortBy(opt.by); setSortDir(opt.dir); setShowSortMenu(false); }}
                          className={`w-full text-left px-3 py-2 text-xs ${active ? "text-cyan-300 bg-cyan-500/10" : "text-slate-200 hover:bg-slate-800"}`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
          <span className="text-[11px] text-slate-500">{filteredNotas.length} de {notas.length} nota(s)</span>
        </div>
        {showFilterPanel && (
          <div className="px-5 py-4 border-t space-y-3" style={{ borderColor: "rgba(30,41,59,0.8)", background: "rgba(2,6,23,0.4)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Data De</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Data Até</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400">
                  <option value="">Todos</option>
                  {STATUS_OPCOES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">Limpar filtros</button>
            )}
          </div>
        )}
      </div>

      {/* table agrupada */}
      {loading ? (
        <div className="text-sm text-slate-400 py-10 text-center">Carregando...</div>
      ) : filteredNotas.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm text-slate-400" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          {hasActiveFilters ? "Nenhuma nota fiscal encontrada para os filtros aplicados." : "Nenhuma nota fiscal cadastrada."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Aeronave</th>
                <th className="px-3 py-2">Emissão</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-center">PDF</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedNotas).map(([clienteNome, notasPorAno]) => {
                const isExpanded = expandedClients[clienteNome] ?? false;
                const totalCliente = Object.values(notasPorAno).reduce((total, items) => total + items.length, 0);
                return (
                  <React.Fragment key={clienteNome}>
                    <tr className="border-b border-blue-300/15 bg-blue-950/35">
                      <td colSpan={10} className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleClientGroup(clienteNome)}
                          className="flex min-h-10 w-full items-center justify-between text-left text-sm font-bold text-blue-100"
                        >
                          <span className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4 text-blue-300" />
                            {isExpanded ? "▾" : "▸"} {clienteNome}
                            <span className="text-xs font-normal text-blue-200/70">({totalCliente} {totalCliente === 1 ? 'nota' : 'notas'})</span>
                          </span>
                        </button>
                      </td>
                    </tr>

                    {isExpanded && Object.entries(notasPorAno).sort(([a], [b]) => b.localeCompare(a)).map(([ano, notasDoCliente]) => {
                      const yearKey = `${clienteNome}|${ano}`;
                      const isYearExpanded = expandedYears[yearKey] ?? false;
                      return (
                        <React.Fragment key={yearKey}>
                          <tr className="border-b border-blue-300/10 bg-blue-900/20">
                            <td colSpan={10} className="px-3 py-1.5 pl-8">
                              <button type="button" onClick={() => toggleYearGroup(clienteNome, ano)} className="flex min-h-9 w-full items-center justify-between text-left text-xs font-semibold text-blue-100">
                                <span className="flex items-center gap-2"><FolderOpen className="h-3.5 w-3.5 text-blue-300/90" /> {isYearExpanded ? "▾" : "▸"} {ano}</span>
                                <span className="text-[10px] font-normal text-blue-200/60">{notasDoCliente.length} {notasDoCliente.length === 1 ? 'nota' : 'notas'}</span>
                              </button>
                            </td>
                          </tr>

                    {isYearExpanded && notasDoCliente.map((n) => {
                      const isRecebido = (n.status ?? "").toLowerCase() === "recebido";
                      const isPendente = (n.status ?? "").toLowerCase() === "pendente";

                      return (
                        <tr
                          key={n.id}
                          className={`border-b border-slate-800/50 transition-all ${
                            isRecebido
                              ? 'opacity-40 grayscale hover:grayscale-0 hover:opacity-100'
                              : isPendente
                                ? 'bg-slate-800/30 border-l-2 border-l-amber-500 hover:bg-slate-800/60'
                                : 'hover:bg-slate-800/30'
                          }`}
                        >
                          <td className={`px-3 py-2 font-semibold ${isRecebido ? 'text-slate-400' : 'text-slate-200'}`}>{n.numero || "—"}</td>
                          <td className="px-3 py-2 text-slate-400">{n.cliente_nome || "—"}</td>
                          <td className="px-3 py-2 text-slate-400">{n.aeronave || "—"}</td>
                          <td className="px-3 py-2 text-slate-400">{n.data_criacao ? formatDate(n.data_criacao) : "—"}</td>
                          <td className="px-3 py-2 text-slate-400">{n.data_vencimento ? formatDate(n.data_vencimento) : "—"}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${isRecebido ? 'text-slate-400' : 'text-cyan-300'}`}>{formatBRL(num(n.valor))}</td>
                          <td className="px-3 py-2 text-slate-400">{n.categoria || "—"}</td>
                          <td className="px-3 py-2"><StatusBadge status={n.status} /></td>
                          <td className="px-3 py-2 text-center">
                            {n.arquivo_pdf_url ? (
                              <a href={n.arquivo_pdf_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 inline-flex items-center justify-center">
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            ) : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-1">
                              {n.origem === "storage_recebido_saida" ? (
                                <span className="text-[10px] text-slate-500">Somente visualização</span>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <EnviarEmailClienteButton
                                    stopPropagation
                                    size="icon"
                                    variant="outline"
                                    clienteId={n.cliente_id || null}
                                    tipo={n.origem === "recibo_saida" ? "recibo_saida" : "nf_saida"}
                                    referenceType={n.origem === "recibo_saida" ? "recibos_saida" : "notas_fiscais_saida"}
                                    referenceIds={n.id ? [n.id] : []}
                                    assuntoSugerido={`${n.origem === "recibo_saida" ? "Recibo" : "Nota Fiscal"} de saída ${n.numero || "sem número"}${n.cliente_nome ? ` — ${n.cliente_nome}` : ""}`}
                                    mensagemSugerida={`Olá${n.cliente_nome ? ` ${n.cliente_nome}` : ""},\n\nSegue a documentação referente ao ${n.origem === "recibo_saida" ? "recibo" : "documento fiscal"} de saída emitido pela Share.\n\nNúmero: ${n.numero || "—"}\nValor: ${formatBRL(num(n.valor))}\nData de emissão: ${n.data_criacao ? formatDate(n.data_criacao) : "—"}\n\nOs documentos estão disponíveis nos links abaixo.\n\nAtenciosamente,\nEquipe Share Brasil`}
                                    anexos={
                                      n.arquivo_pdf_url
                                        ? [{ url: n.arquivo_pdf_url, label: n.origem === "recibo_saida" ? "Recibo" : "Nota Fiscal", filename: getFileNameFromUrl(n.arquivo_pdf_url) }]
                                        : []
                                    }
                                    className="bg-cyan-900/10 text-cyan-300 border border-cyan-900/50 hover:bg-cyan-900/20 rounded"
                                  />
                                  {n.status === "pendente" && n.contas_areceber_id && (
                                    <button onClick={() => openBaixa(n)} title="Dar baixa (registrar recebimento)" className="border border-emerald-900/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40 rounded px-2 py-1 text-[10px]">
                                      <Banknote className="h-3 w-3" />
                                    </button>
                                  )}
                                  <button onClick={() => openEdit(n)} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded px-2 py-1 text-[10px]">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button onClick={() => setDeleteId(n.id)} className="border border-red-900/50 bg-red-950/40 text-red-300 hover:bg-red-900/40 rounded px-2 py-1 text-[10px]">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ReciboSaidaPreviewModal
        open={!!reciboPreview}
        data={reciboPreview?.pdfData ?? null}
        saving={saving}
        savedUrl={reciboSavedUrl}
        onClose={closeReciboPreview}
        onConfirm={confirmReciboSave}
        onSendEmail={() => {
          if (emailTarget) {
            setEmailOpen(true);
          }
        }}
      />


      {emailTarget && (
        <EnviarEmailClienteDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          clienteId={emailTarget.cliente_id || null}
          assuntoSugerido={`${emailTarget.origem === "recibo_saida" ? "Recibo" : "Nota Fiscal"} de saída ${emailTarget.numero || "sem número"}${emailTarget.cliente_nome ? ` — ${emailTarget.cliente_nome}` : ""}`}
          mensagemSugerida={`Olá${emailTarget.cliente_nome ? ` ${emailTarget.cliente_nome}` : ""},\n\nSegue a documentação referente ao ${emailTarget.origem === "recibo_saida" ? "recibo" : "documento fiscal"} de saída emitido pela Share.\n\nNúmero: ${emailTarget.numero || "—"}\nValor: ${formatBRL(num(emailTarget.valor))}\nData de emissão: ${emailTarget.data_criacao ? formatDate(emailTarget.data_criacao) : "—"}\n\nOs documentos estão disponíveis nos links abaixo.\n\nAtenciosamente,\nEquipe Share Brasil`}
          anexos={emailTarget.arquivo_pdf_url ? [{ url: emailTarget.arquivo_pdf_url, label: emailTarget.origem === "recibo_saida" ? "Recibo" : "Nota Fiscal", filename: getFileNameFromUrl(emailTarget.arquivo_pdf_url) }] : []}
          tipo={emailTarget.origem === "recibo_saida" ? "recibo_saida" : "nf_saida"}
          referenceType={emailTarget.origem === "recibo_saida" ? "recibos_saida" : "notas_fiscais_saida"}
          referenceIds={emailTarget.id ? [emailTarget.id] : []}
        />
      )}

      {/* delete modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-950/50 flex items-center justify-center"><Trash2 className="h-5 w-5 text-red-400" /></div>
              <h3 className="text-base font-bold text-slate-100">Excluir nota fiscal</h3>
            </div>
            <p className="text-sm text-slate-300">Tem certeza que deseja excluir esta nota fiscal? Esta ação não pode ser desfeita. (Os lançamentos financeiros já gerados não são excluídos automaticamente — cancele-os separadamente se necessário.)</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDeleteId(null)} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm">Cancelar</button>
              <button onClick={confirmDelete} disabled={deleting} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#dc2626" }}>
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* dar baixa modal */}
      {baixaTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-950/50 flex items-center justify-center"><Banknote className="h-5 w-5 text-emerald-400" /></div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Dar baixa</h3>
                  <p className="text-xs text-slate-400">Nota {baixaTarget.numero} · {baixaTarget.cliente_nome} · {formatBRL(num(baixaTarget.valor))}</p>
                </div>
              </div>
              <button onClick={closeBaixa} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-slate-400">Isso marca a receita da Share como recebida e a despesa correspondente do cliente como paga.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Data do Pagamento *</label>
                <input type="date" className={inputCls} value={baixaForm.data_pagamento} onChange={(e) => setBaixaForm({ ...baixaForm, data_pagamento: e.target.value })} /></div>
              <div><label className={labelCls}>Forma de Pagamento</label>
                <select className={inputCls + " cursor-pointer"} value={baixaForm.forma_pagamento} onChange={(e) => setBaixaForm({ ...baixaForm, forma_pagamento: e.target.value })}>
                  {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
                </select></div>
              <div className="sm:col-span-2"><label className={labelCls}>Banco</label>
                <input list="bancos-share-list" className={inputCls} value={baixaForm.conta_bancaria} onChange={(e) => setBaixaForm({ ...baixaForm, conta_bancaria: e.target.value })} placeholder="Ex: Banco do Brasil - Conta 12345-6" />
                <datalist id="bancos-share-list">
                  {contasBancarias.map((b) => (
                    <option key={b.id} value={`${b.banco}${b.numero_conta ? " - " + b.numero_conta : ""}`} />
                  ))}
                </datalist>
              </div>
              <div className="sm:col-span-2"><label className={labelCls}>Comprovante</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input className={inputCls} value={baixaForm.comprovante_url} onChange={(e) => setBaixaForm({ ...baixaForm, comprovante_url: e.target.value })} placeholder="URL do comprovante" />
                  <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
                    <Upload className="h-4 w-4" /> {baixaUploading ? "Enviando..." : "Anexar"}
                    <input type="file" accept="application/pdf,image/*" className="hidden" disabled={baixaUploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadComprovante(file); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={closeBaixa} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm">Cancelar</button>
              <button onClick={confirmBaixa} disabled={baixaSaving} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" style={{ background: "#4ade80" }}>
                {baixaSaving ? "Registrando..." : "Confirmar Baixa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
