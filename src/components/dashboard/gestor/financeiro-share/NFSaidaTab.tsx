import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";

/* ─────────────────────────── types ─────────────────────────── */

interface NFSaida {
  id: string;
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
  client_id: string | null;
  aircraft_id: string | null;
  socio_id: string | null;
  categoria_id: string | null;
  categoria_despesa_id: string | null;
  contas_areceber_id: string | null;
}

interface FormState {
  numero: string;
  cliente_nome: string;
  cliente_cnpj: string;
  client_id: string;
  socio_id: string;
  aircraft_id: string;
  categoria_id: string;
  categoria_despesa_id: string;
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
  numero: "", cliente_nome: "", cliente_cnpj: "", client_id: "", socio_id: "", aircraft_id: "", categoria_id: "", categoria_despesa_id: "",
  data_criacao: new Date().toISOString().slice(0, 10),
  data_vencimento: "", valor: "", categoria: "", descricao: "", status: "pendente",
  aeronave: "", arquivo_pdf_url: "",
};

interface BaixaFormState {
  data_pagamento: string;
  banco_nome: string;
  forma_pagamento: string;
  comprovante_url: string;
}

const emptyBaixaForm: BaixaFormState = {
  data_pagamento: new Date().toISOString().slice(0, 10),
  banco_nome: "",
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
}

const CATEGORIAS_PERMITIDAS = new Set([
  "N.F DIARIAS DE VOO - ADM SHARE - RECIBO",
  "ADM E PILOTAGEM - N.F",
  "N.F ADM - Somente adm de aeronaves",
  "ADM E PILOTAGEM - RECIBO",
].map((nome) => nome.toUpperCase()));

const STATUS_OPCOES = [
  { value: "pendente", label: "Pendente" },
  { value: "recebido", label: "Recebido" },
  { value: "cancelado", label: "Cancelado" },
];

/* ─────────────────────────── helpers ─────────────────────────── */

const num = (v: string | number | null | undefined) => Number(v) || 0;

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
  const [despesaCategorias, setDespesaCategorias] = useState<any[]>([]);
  const [contasBancarias, setContasBancarias] = useState<any[]>([]);
  const [documentType, setDocumentType] = useState<"nota" | "recibo">("nota");
  const [uploading, setUploading] = useState(false);

  // dar baixa
  const [baixaTarget, setBaixaTarget] = useState<NFSaida | null>(null);
  const [baixaForm, setBaixaForm] = useState<BaixaFormState>(emptyBaixaForm);
  const [baixaSaving, setBaixaSaving] = useState(false);
  const [baixaUploading, setBaixaUploading] = useState(false);

  const fetchNotas = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notas_fiscais_saida")
        .select("*")
        .order("data_criacao", { ascending: false });
      if (error) throw error;
      setNotas((data ?? []) as NFSaida[]);
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
        { data: clientesData },
        { data: sociosData },
        { data: aeronavesData },
        { data: categoriasData },
        { data: despesaCategoriasData },
        { data: bancosData },
      ] = await Promise.all([
        supabase.from("clientes").select("id, razao_social, proprietario, cnpj").order("razao_social"),
        supabase.from("socios").select("id, cliente_id, nome, cpf"),
        supabase.from("aeronave").select("id, matricula").order("matricula"),
        supabase.from("categorias_movimentacao").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("categorias_movimentacao").select("id, nome").eq("ativo", true).eq("tipo", "despesa").order("nome"),
        supabase.from("contas_bancarias").select("id, banco, numero_conta").eq("ativo", true).order("banco"),
      ]);
      setClientes([
        ...(clientesData || []).map((cliente) => ({ id: `cliente:${cliente.id}`, clientId: cliente.id, socioId: null as string | null, nome: cliente.razao_social || cliente.proprietario || "Cliente", documento: cliente.cnpj || "", tipo: "Cliente" })),
        ...(sociosData || []).map((socio) => ({ id: `socio:${socio.id}`, clientId: socio.cliente_id, socioId: socio.id as string | null, nome: socio.nome, documento: socio.cpf || "", tipo: "Sócio" })),
      ]);
      setAeronaves(aeronavesData || []);
      setCategorias((categoriasData || []).filter((categoria) => CATEGORIAS_PERMITIDAS.has(categoria.nome.trim().toUpperCase())));
      setDespesaCategorias(despesaCategoriasData || []);
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

  const openNew = () => { setForm(emptyForm); setEditingId(null); setDocumentType("nota"); setShowForm(true); };
  const openNewReceipt = () => { setForm(emptyForm); setEditingId(null); setDocumentType("recibo"); setShowForm(true); };
  const openEdit = (n: NFSaida) => {
    setForm({
      numero: n.numero ?? "", cliente_nome: n.cliente_nome ?? "", cliente_cnpj: n.cliente_cnpj ?? "",
      data_criacao: n.data_criacao ?? new Date().toISOString().slice(0, 10),
      data_vencimento: n.data_vencimento ?? "", valor: n.valor != null ? String(n.valor) : "",
      categoria: n.categoria ?? "", descricao: n.descricao ?? "", status: n.status ?? "pendente",
      client_id: n.client_id ?? "", socio_id: n.socio_id ?? "", aircraft_id: n.aircraft_id ?? "",
      categoria_id: n.categoria_id ?? "", categoria_despesa_id: n.categoria_despesa_id ?? "",
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

  /**
   * Gera os dois lançamentos financeiros (perna Share = contas a receber/receita,
   * perna Cliente = despesa) a partir de uma NF de saída ou recibo recém-criado,
   * seguindo o mesmo padrão de dados já usado em outros fluxos de "contas a
   * receber" da plataforma (mesmo contas_areceber_id nas duas movimentações).
   *
   * OBS: não é atômico (são 4 chamadas sequenciais ao Supabase). Se uma falhar
   * no meio do caminho, o registro de origem (nota/recibo) já foi criado mas
   * pode ficar sem lançamento correspondente — nesse caso o toast de erro
   * aparece e vale a pena conferir manualmente antes de tentar de novo.
   */
  const syncSaidaFinancialLegs = useCallback(async (params: SyncSaidaParams) => {
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
      tipo: "receita",
      tipo_caixa: "share",
      categoria_id: params.categoriaReceitaId,
      categoria_nome: params.categoriaReceitaNome,
      valor_rateado: params.valor,
      valor_original: params.valor,
      data_competencia: params.dataEmissao,
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

    const { error: movClienteError } = await supabase.from("movimentacoes").insert({
      descricao: descricaoLancamento,
      tipo: "despesa",
      tipo_caixa: "cliente",
      categoria_id: params.categoriaDespesaId,
      categoria_nome: params.categoriaDespesaNome,
      valor_rateado: params.valor,
      valor_original: params.valor,
      data_competencia: params.dataEmissao,
      data_vencimento: params.dataVencimento || params.dataEmissao,
      aeronave_id: params.aeronaveId,
      clientes_id: params.clienteId,
      socio_id: params.socioId,
      status: "pendente",
      numero_nf: params.origem === "nf_saida" ? params.numero : null,
      numero_recibo: params.origem === "recibo_saida" ? params.numero : null,
      contas_areceber_id: areceber.id,
      reference_type: `${params.origem}:${params.origemId}:mov_cliente`,
      reference_id: params.origemId,
    });
    if (movClienteError) throw movClienteError;

    const tabelaOrigem = params.origem === "nf_saida" ? "notas_fiscais_saida" : "recibos_saida";
    const { error: linkError } = await supabase
      .from(tabelaOrigem)
      .update({ contas_areceber_id: areceber.id })
      .eq("id", params.origemId);
    if (linkError) throw linkError;

    return areceber.id as string;
  }, []);

  const save = async () => {
    if (!form.numero.trim()) { setToast({ type: "err", text: `Informe o número ${documentType === "nota" ? "da nota" : "do recibo"}.` }); return; }
    if (!form.cliente_nome.trim() || !form.cliente_cnpj.trim() || !form.aeronave || !form.categoria) { setToast({ type: "err", text: "Selecione cliente, aeronave e categoria." }); return; }
    if (!form.categoria_despesa_id) { setToast({ type: "err", text: "Selecione a categoria de despesa do cliente (perna 'cliente' do lançamento)." }); return; }
    if (!(Number(form.valor) > 0)) { setToast({ type: "err", text: "Informe um valor maior que zero." }); return; }
    setSaving(true); setToast(null);
    try {
      const categoriaDespesaNome = despesaCategorias.find((c) => c.id === form.categoria_despesa_id)?.nome ?? null;
      const dataVencimentoFinal = form.data_vencimento || form.data_criacao;

      if (documentType === "recibo") {
        const descricaoServico = form.descricao.trim() || "Serviços aeronáuticos";
        const { data: inserted, error } = await supabase.from("recibos_saida").insert({
          numero_recibo: form.numero.trim(), tipo_recibo: form.categoria, categoria_id: form.categoria_id || null,
          categoria_despesa_id: form.categoria_despesa_id || null,
          nome_categoria: form.categoria, cliente_id: form.client_id || null, socio_id: form.socio_id || null, aeronave_id: form.aircraft_id || null,
          nome_pagador: form.cliente_nome.trim(), documento_pagador: form.cliente_cnpj.trim(),
          data_emissao: form.data_criacao, data_vencimento: form.data_vencimento || null,
          valor: Number(form.valor) || 0, valor_total: Number(form.valor) || 0,
          descricao_servico: descricaoServico, status: form.status,
          pdf_url: form.arquivo_pdf_url.trim() || null,
        }).select("id").single();
        if (error) throw error;

        await syncSaidaFinancialLegs({
          origem: "recibo_saida",
          origemId: inserted.id,
          numero: form.numero.trim(),
          clienteNome: form.cliente_nome.trim(),
          clienteCnpj: form.cliente_cnpj.trim(),
          clienteId: form.client_id || null,
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
        });
        setToast({ type: "ok", text: "Recibo de saída criado e lançamentos financeiros gerados." });
      } else {
        const payload = {
          numero: form.numero.trim(), cliente_nome: form.cliente_nome.trim(), cliente_cnpj: form.cliente_cnpj.trim(),
          client_id: form.client_id || null, socio_id: form.socio_id || null, aircraft_id: form.aircraft_id || null,
          categoria_id: form.categoria_id || null, categoria_despesa_id: form.categoria_despesa_id || null,
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
            clienteId: form.client_id || null,
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
          });
          setToast({ type: "ok", text: "Nota fiscal criada e lançamentos financeiros gerados (contas a receber Share + despesa do cliente)." });
        }
        fetchNotas();
      }
      closeForm();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao salvar." });
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("notas_fiscais_saida").delete().eq("id", deleteId);
      if (error) throw error;
      setToast({ type: "ok", text: "Nota fiscal excluída." });
      setDeleteId(null); fetchNotas();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao excluir." });
    } finally { setDeleting(false); }
  };

  /* ─────────────── dar baixa (registrar recebimento) ─────────────── */

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
        banco_recebimento: baixaForm.banco_nome || null,
        metodo_pagamento: baixaForm.forma_pagamento || null,
        comprovante_recebimento_url: baixaForm.comprovante_url || null,
        comprovante_url: baixaForm.comprovante_url || null,
        atualizado_em: agora,
      }).eq("id", baixaTarget.contas_areceber_id);
      if (areceberErr) throw areceberErr;

      const { error: movShareErr } = await supabase.from("movimentacoes").update({
        status: "recebido",
        data_pagamento: baixaForm.data_pagamento,
        banco_nome: baixaForm.banco_nome || null,
        forma_pagamento: baixaForm.forma_pagamento || null,
        comprovante_url: baixaForm.comprovante_url || null,
        atualizado_em: agora,
      }).eq("contas_areceber_id", baixaTarget.contas_areceber_id).eq("tipo_caixa", "share");
      if (movShareErr) throw movShareErr;

      const { error: movClienteErr } = await supabase.from("movimentacoes").update({
        status: "pago",
        data_pagamento: baixaForm.data_pagamento,
        banco_nome: baixaForm.banco_nome || null,
        forma_pagamento: baixaForm.forma_pagamento || null,
        comprovante_url: baixaForm.comprovante_url || null,
        atualizado_em: agora,
      }).eq("contas_areceber_id", baixaTarget.contas_areceber_id).eq("tipo_caixa", "cliente");
      if (movClienteErr) throw movClienteErr;

      const { error: nfErr } = await supabase.from("notas_fiscais_saida").update({
        status: "recebido",
        atualizado_em: agora,
      }).eq("id", baixaTarget.id);
      if (nfErr) throw nfErr;

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
              <SearchableCombobox items={clientes.map((pessoa) => ({ id: pessoa.id, label: `${pessoa.nome} · ${pessoa.tipo}` }))} value={form.client_id ? clientes.find((pessoa) => pessoa.clientId === form.client_id && pessoa.nome === form.cliente_nome)?.id || form.cliente_nome : form.cliente_nome} onChange={(id, label) => {
                const pessoa = clientes.find((item) => item.id === id);
                setForm(pessoa ? { ...form, client_id: pessoa.clientId, socio_id: pessoa.socioId || "", cliente_nome: pessoa.nome, cliente_cnpj: pessoa.documento } : { ...form, client_id: "", socio_id: "", cliente_nome: label });
              }} placeholder="Selecione ou informe manualmente" searchPlaceholder="Buscar cliente ou sócio..." emptyMessage="Nenhum cadastro encontrado." allowFreeText />
            </div>
            <div><label className={labelCls}>CNPJ / CPF *</label>
              <input className={inputCls} value={form.cliente_cnpj} onChange={(e) => setForm({ ...form, client_id: "", socio_id: "", cliente_cnpj: e.target.value })} placeholder="Preenchido ao selecionar" /></div>
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
              <SearchableCombobox items={despesaCategorias.map((categoria) => ({ id: categoria.id, label: categoria.nome }))} value={form.categoria_despesa_id} onChange={(id) => setForm({ ...form, categoria_despesa_id: id })} placeholder="Como isso entra no caixa do cliente" searchPlaceholder="Buscar categoria de despesa..." emptyMessage="Nenhuma categoria de despesa encontrada." />
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
            <div className="md:col-span-3"><label className={labelCls}>PDF ou imagem</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input className={inputCls} value={form.arquivo_pdf_url} onChange={(e) => setForm({ ...form, arquivo_pdf_url: e.target.value })} placeholder="URL do arquivo" />
                <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
                  <Upload className="h-4 w-4" /> {uploading ? "Enviando..." : "Enviar arquivo"}
                  <input type="file" accept="application/pdf,image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadDocument(file); e.target.value = ""; }} />
                </label>
              </div>
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

      {/* table */}
      {loading ? (
        <div className="text-sm text-slate-400 py-10 text-center">Carregando...</div>
      ) : notas.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm text-slate-400" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          Nenhuma nota fiscal cadastrada.
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
              {notas.map((n) => (
                <tr key={n.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="px-3 py-2 text-slate-200 font-semibold">{n.numero || "—"}</td>
                  <td className="px-3 py-2 text-slate-200">{n.cliente_nome || "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{n.aeronave || "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{n.data_criacao || "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{n.data_vencimento || "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold text-cyan-300">{formatBRL(num(n.valor))}</td>
                  <td className="px-3 py-2 text-slate-300">{n.categoria || "—"}</td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                <input list="bancos-share-list" className={inputCls} value={baixaForm.banco_nome} onChange={(e) => setBaixaForm({ ...baixaForm, banco_nome: e.target.value })} placeholder="Ex: Banco do Brasil - Conta 12345-6" />
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