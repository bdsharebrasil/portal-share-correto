import { SetStateAction, useEffect, useMemo, useState } from "react";
import { CalendarIcon, Plus, Trash2, Upload, FileText, Loader2, Send, Save, Link2, ArrowUp, ArrowDown, Eye, ExternalLink, Plane } from "lucide-react";
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
  normalizarTipoDespesa,
} from "@/components/dashboard/financeiro/solicitacaoPagamentoValidators";

interface SolicitacaoPagamentoModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Periodicidade = "MENSAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL" | "EVENTUAL";

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

type ClienteOption = { id: string; razao_social: string; tem_socio?: boolean | null; cnpj?: string | null };
type SocioOption = { id: string; nome: string; percentual_participacao?: number | null };
type TipoDespesaOption = { id: string; expense_type: string };
type FornecedorOption = { id: string; label: string };
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
type InsertedRow = {
  expense_type: SetStateAction<string>; id: string 
};
type SupabaseInsertBuilder = {
  insert: (payload: Record<string, unknown>) => {
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
  // catálogos
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [socios, setSocios] = useState<SocioOption[]>([]);
  const [tiposDespesa, setTiposDespesa] = useState<TipoDespesaOption[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorOption[]>([]);
  const [aeronaves, setAeronaves] = useState<AeronaveOption[]>([]);
  const [recibosExistentes, setRecibosExistentes] = useState<ReciboOption[]>([]);

  // form state
  const [clienteId, setClienteId] = useState("");
  const [socioId, setSocioId] = useState("");
  const [aeronaveId, setAeronaveId] = useState("");
  const [reembolsavel, setReembolsavel] = useState(false);
  const [tipoDespesa, setTipoDespesa] = useState("");
  const [tipoDespesaLabel, setTipoDespesaLabel] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [percentualUso, setPercentualUso] = useState("100");
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("EVENTUAL");
  const [observacoes, setObservacoes] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [dataEmissao, setDataEmissao] = useState<Date | undefined>(new Date());
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(new Date());
  const [anexos, setAnexos] = useState<AnexoDoc[]>([]);
  const [usarReciboExistente, setUsarReciboExistente] = useState(false);
  const [reciboExistenteId, setReciboExistenteId] = useState("");
  const [referenciaDuplicada, setReferenciaDuplicada] = useState<{ tipo: "abastecimento" | "travel_expense_report" | "recibo" | null; id: string | null; mensagem: string | null }>({ tipo: null, id: null, mensagem: null });
  const [travelReports, setTravelReports] = useState<TravelReportOption[]>([]);
  const [travelReportId, setTravelReportId] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [cli, tip, ff, fc, aer, rec] = await Promise.all([
        supabase.from("clientes").select("id, razao_social, tem_socio, cnpj").order("razao_social"),
        supabase.from("expense_configu").select("id, expense_type").order("expense_type"),
        supabase.from("fornecedores_favoritos").select("id, nome_completo, apelido").order("nome_completo"),
        supabase.from("fornecedores_combustivel").select("id, nome_fornecedor, nome_cidade").order("nome_fornecedor"),
        supabase.from("aeronave").select("id, matricula, modelo").order("matricula"),
        supabase.from("recibos").select("id, numero_recibo, url_pdf, valor_total, criado_em, cliente_id").order("criado_em", { ascending: false }),
      ]);
      setClientes((cli.data as ClienteOption[] | null) || []);
      setTiposDespesa((tip.data as TipoDespesaOption[] | null) || []);
      const forn = [
        ...(((ff.data as Array<{ id: string; apelido?: string | null; nome_completo?: string | null }> | null) || [])).map((f) => ({ id: f.id, label: f.apelido || f.nome_completo || "Fornecedor" })),
        ...(((fc.data as Array<{ id: string; nome_fornecedor?: string | null; nome_cidade?: string | null }> | null) || [])).map((f) => ({ id: f.id, label: `${f.nome_fornecedor || "Fornecedor"} (${f.nome_cidade || "Cidade"})` })),
      ];
      setFornecedores(forn);
      setAeronaves((aer.data as AeronaveOption[] | null) || []);
      setRecibosExistentes((rec.data as unknown as ReciboOption[] | null) || []);
    })();
  }, [open]);

  // sócios do cliente
  useEffect(() => {
    if (!clienteId) { setSocios([]); setSocioId(""); return; }
    supabase.from("socios").select("id, nome, percentual_participacao").eq("cliente_id", clienteId).then(({ data }) => setSocios((data as SocioOption[] | null) || []));
  }, [clienteId]);

  const clienteSel = useMemo(() => clientes.find((c) => c.id === clienteId), [clientes, clienteId]);
  const socioSel = useMemo(() => socios.find((s) => s.id === socioId), [socios, socioId]);
  const aeronaveSel = useMemo(() => aeronaves.find((a) => a.id === aeronaveId), [aeronaves, aeronaveId]);

  const tipoNormalizadoAtual = normalizarTipoDespesa(tipoDespesaLabel || "");
  const isViagemMode = tipoNormalizadoAtual === "DESPESAS_DE_VIAGEM";
  const travelReportSel = useMemo(() => travelReports.find((r) => r.id === travelReportId), [travelReports, travelReportId]);

  // Carrega relatórios de viagem do cliente/aeronave/sócio selecionados
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

  // Auto-preenche valor total quando um relatório é selecionado
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

  useEffect(() => {
    const verificarDuplicidade = async () => {
      const tipoNormalizado = normalizarTipoDespesa(tipoDespesaLabel || "");

      // Resetar se não houver dados suficientes para buscar
      if (!clienteId || !tipoDespesaLabel || valorNumerico <= 0) {
        setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
        return;
      }

      try {
        if (!clienteId || !tipoDespesaLabel || valorNumerico <= 0) {
          setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
          return;
        }

        // Verificação de COMBUSTÍVEIS
        if (tipoNormalizado === "COMBUSTIVEIS") {
          const { data, error: fetchError } = await supabase
            .from("abastecimentos")
            .select("id, id_clientes, valor_total, data, nf, comprovante_pagamento, comprovante_url, nota_url, boleto_url, comanda_url")
            .eq("id_clientes", clienteId)
            .order("data", { ascending: false })
            .limit(50); // Limitar para otimizar

          if (fetchError) {
            console.warn("Erro ao buscar abastecimentos:", fetchError);
            return;
          }

          const match = findExistingFuelReference(
            {
              clienteId,
              valor: valorNumerico,
              data: dataEmissao ? format(dataEmissao, "yyyy-MM-dd") : undefined,
              numeroNf: "", // Número NF seria adicionado se disponível no formulário
            },
            (data || []) as unknown as Array<{ id: string; id_clientes?: string | null; valor_total?: number | null; data?: string | null; nf?: string | null }>
          );

          if (match) {
            setReferenciaDuplicada({
              tipo: "abastecimento",
              id: match.id,
              mensagem: `✓ Abastecimento encontrado: O registro será reutilizado em vez de duplicar. Data: ${
                match.data ? format(new Date(match.data), "dd/MM/yyyy") : "—"
              } | Valor: R$ ${match.valor_total?.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || "0,00"}`,
            });
          } else {
            setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
          }
          return;
        }

        // Verificação de DESPESAS DE VIAGEM
        if (tipoNormalizado === "DESPESAS_DE_VIAGEM") {
          const { data, error: fetchError } = await supabase
            .from("travel_expense_reports")
            .select("id, clientes_id, total_valor, despesas, url_pdf, pago_em")
            .eq("clientes_id", clienteId)
            .order("created_at", { ascending: false })
            .limit(50); // Limitar para otimizar

          if (fetchError) {
            console.warn("Erro ao buscar relatórios de viagem:", fetchError);
            return;
          }

          const match = findExistingTravelExpenseReference(
            { clienteId, valor: valorNumerico, descricao },
            (data || []) as Array<{ id: string; clientes_id?: string | null; total_valor?: number | null; despesas?: unknown; pago_em?: string | null }>
          );

          if (match) {
            setReferenciaDuplicada({
              tipo: "travel_expense_report",
              id: match.id,
              mensagem: `✓ Relatório de viagem encontrado: O registro será reutilizado em vez de duplicar. Valor total: R$ ${
                match.total_valor?.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || "0,00"
              }`,
            });
          } else {
            setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
          }
          return;
        }

        const reciboNumero = usarReciboExistente ? recibosExistentes.find((r) => r.id === reciboExistenteId)?.numero_recibo || recibosExistentes.find((r) => r.id === reciboExistenteId)?.numero : null;
        if (reciboNumero) {
          const { data, error: fetchError } = await supabase
            .from("recibos")
            .select("id, cliente_id, clientes_id, valor_total, numero_recibo, numero")
            .eq("cliente_id", clienteId)
            .or(`numero_recibo.eq.${reciboNumero},numero.eq.${reciboNumero}`)
            .limit(50);
          if (!fetchError) {
            const match = findExistingReceiptReference(
              { clienteId, valor: valorNumerico, numeroRecibo: reciboNumero },
              (data || []) as unknown as Array<{ id: string; cliente_id?: string | null; clientes_id?: string | null; valor_total?: number | null; numero_recibo?: string | null; numero?: string | null }>
            );
            if (match) {
              setReferenciaDuplicada({
                tipo: "recibo",
                id: match.id,
                mensagem: `✓ Recibo já cadastrado: o registro será reutilizado para evitar duplicidade. Número: ${match.numero_recibo || match.numero || "—"}`,
              });
              return;
            }
          }
        }

        // Para outros tipos, não há busca de duplicidade
        setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
      } catch (error) {
        console.warn("Erro ao verificar duplicidade da solicitação:", error);
        setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
      }
    };

    // Debounce para não fazer requisições a cada letra digitada
    const timer = setTimeout(() => {
      void verificarDuplicidade();
    }, 500);

    return () => clearTimeout(timer);
  }, [clienteId, dataEmissao, descricao, tipoDespesaLabel, valorNumerico, reciboExistenteId, usarReciboExistente, recibosExistentes]);

  const resetForm = () => {
    setClienteId(""); setSocioId(""); setAeronaveId(""); setReembolsavel(false);
    setTipoDespesa(""); setTipoDespesaLabel(""); setDescricao(""); setValorTotal("");
    setPercentualUso("100"); setPeriodicidade("EVENTUAL"); setObservacoes("");
    setFornecedorId(""); setFornecedorNome("");
    setDataEmissao(new Date()); setDataVencimento(new Date()); setAnexos([]);
    setUsarReciboExistente(false); setReciboExistenteId(""); setReferenciaDuplicada({ tipo: null, id: null, mensagem: null });
    setTravelReportId(""); setTravelReports([]);
  };

  // --- Anexos ---
  const addAnexo = () => setAnexos((prev) => [...prev, { id: crypto.randomUUID(), tipo: "nf", numero: "", arquivo: null }]);
  const updateAnexo = (id: string, patch: Partial<AnexoDoc>) =>
    setAnexos((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
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
        const path = `solicitacoes/${clienteId || "sem-cliente"}/${Date.now()}-${a.arquivo.name}`;
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

  // --- Cadastro rápido tipo despesa ---
  const criarTipoDespesa = async (label: string) => {
    const supabaseClient = supabase as unknown as SupabaseClientLike;
    const builder = supabaseClient.from("expense_configu");
    const { data, error } = await builder.insert({ expense_type: label }).select("id, expense_type").single();
    if (error) { toast.error("Falha ao criar tipo"); return; }
    setTiposDespesa((prev) => [...prev, data as TipoDespesaOption]);
    setTipoDespesa(data.id);
    setTipoDespesaLabel(data.expense_type);
    toast.success(`Tipo "${label}" adicionado`);
  };

  // --- Save ---
  const validar = (): string | null => {
    if (!clienteId) return "Selecione o cliente";
    if (!descricao.trim()) return "Descreva a despesa";
    if (!tipoDespesaLabel) return "Selecione o tipo de despesa";
    if (valorNumerico <= 0) return "Informe um valor válido";
    if (!dataVencimento) return "Data de vencimento é obrigatória";

    // Validação de duplicação: se encontrou uma referência, deve ser confirmado
    // A confirmação é implícita ao clicar em salvar com referenciaDuplicada ativa
    // (já que a UI exibe o aviso com a mensagem)

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
      // Determinar o tipo e ID da referência automática
      const referenciaTipo = referenciaDuplicada?.tipo === "abastecimento"
        ? "abastecimento"
        : referenciaDuplicada?.tipo === "travel_expense_report"
          ? "travel_expense_report"
          : referenciaDuplicada?.tipo === "recibo"
            ? "recibo"
            : null;
      const referenciaId = referenciaDuplicada?.id ?? null;

      // A fonteDespesa indica a origem do lançamento
      // Se encontrou referência, reutiliza o registro existente
      const fonteDespesa = referenciaTipo === "abastecimento"
        ? "abastecimento"
        : referenciaTipo === "travel_expense_report"
          ? "travel_expense_report"
          : referenciaTipo === "recibo"
            ? "recibo"
            : "solicitacao_pagamento";
      const reciboSelecionado = usarReciboExistente
        ? recibosExistentes.find((r) => r.id === reciboExistenteId) || null
        : null;
      const reciboUrlSelecionado = reciboSelecionado?.pdf_url || reciboSelecionado?.arquivo_url || null;
      const reciboNumeroSelecionado = reciboSelecionado?.numero_recibo || reciboSelecionado?.numero || null;

      const anexosProc = await uploadAnexos();
      let anexosOrigem: Record<string, string | null> = {};
      if (referenciaTipo === "abastecimento" && referenciaId) {
        const { data, error } = await (supabase as any)
          .from("abastecimentos")
          .select("comprovante_pagamento, comprovante_url, nota_url, boleto_url, comanda_url, nf, comprovante_pagamento, nota_url, boleto_url, comanda_url")
          .eq("id", referenciaId)
          .single();
        if (error) throw error;
        anexosOrigem = data || {};
      }
      if (referenciaTipo === "travel_expense_report" && referenciaId) {
        const { data, error } = await (supabase as any)
          .from("travel_expense_reports")
          .select("id, url_pdf")
          .eq("id", referenciaId)
          .single();
        if (error) throw error;
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
        const { data: existente, error } = await (supabase as any)
          .from("movimentacoes")
          .select("id")
          .eq("reference_type", referenciaTipo)
          .eq("reference_id", referenciaId)
          .maybeSingle();
        if (error) throw error;
        if (existente) {
          toast.info("Esta solicitação já está vinculada ao lançamento de origem.");
          return;
        }
        toast.info("Já existe uma referência de origem correspondente; a solicitação não será duplicada.");
        return;
      }

      if (reciboNum) {
        const { data: existente, error } = await (supabase as any)
          .from("movimentacoes")
          .select("id")
          .eq("numero_recibo", reciboNum)
          .maybeSingle();
        if (error) throw error;
        if (existente) {
          toast.error("Já existe um lançamento associado a este recibo.");
          return;
        }
      }

      // 1) contas_apagar
      const capId = await insertAndGetId("contas_apagar", {
        data_vencimento: dataVenc,
        data_agendamento: dataVenc,
        valor: valorNumerico,
        categoria: tipoDespesaLabel,
        descricao,
        status: statusCP,
        observacoes: observacoes || null,
        cliente_id: clienteId,
        socios_cliente_id: socioId || null,
        fornecedor_favorito_id: fornecedorId || null,
        aeronave_registro: aeronaveSel?.matricula || null,
        possui_boleto: !!boletoUrl,
        boleto_url: boletoUrl,
        vencimento_boleto: boletoUrl ? dataVenc : null,
        possui_nf: !!nfUrl,
        nf_numero: nfNum,
        nf_url: nfUrl,
        numero_doc: docNum,
        arquivo_pdf_url: docUrl,
        criado_por: userId,
      });

      // 2) movimentacoes (tipo despesa, tipo_caixa cliente)
      const movId = await insertAndGetId("movimentacoes", {
        descricao,
        tipo: "despesa",
        tipo_caixa: "cliente",
        valor: valorNumerico,
        data_competencia: dataComp,
        data_vencimento: dataVenc,
        status: statusMov,
        aeronave_id: aeronaveId || null,
        clientes_id: clienteId,
        socio_id: socioId || null,
        reembolsavel,
        fornecedor_nome: fornecedorNome || null,
        numero_nf: nfNum,
        numero_recibo: reciboNum,
        numero_boleto: boletoNum,
        numero_doc: docNum,
        nf_url: nfUrl,
        recibo_url: reciboUrl,
        boleto_url: boletoUrl,
        comprovante_url: comprovanteUrl,
        observacoes: obsFinal || null,
        contas_apagar_id: capId,
        reference_type: referenciaTipo || "solicitacao_pagamento",
        reference_id: referenciaTipo && referenciaId ? referenciaId : null,
        criado_por: userId,
      });

      await supabase.from("contas_apagar").update({ movimentacao_id: movId }).eq("id", capId);

      // 3) rateio_despesas (uma linha para o cotista/cliente)
      const supabaseClient = supabase as unknown as SupabaseClientLike;
      await supabaseClient.from("rateio_despesas").insert({
        despesa_id: movId,
        fonte_despesa: fonteDespesa,
        tipo_rateio: periodicidade === "MENSAL" ? "FIXO" : "EXTRA",
        fluxo: "SAÍDA",
        data_vencimento: dataVenc,
        data_pagamento: null,
        numero_boleto: boletoNum,
        numero_nf: nfNum,
        numero_doc: docNum,
        numero_recibo: reciboNum,
        fornecedor_nome: fornecedorNome || null,
        cliente_id: clienteId,
        clientes_nome: clienteSel?.razao_social || null,
        socio_id: socioId || null,
        socios_nome: socioSel?.nome || null,
        pago_por: null,
        pago_diretamente: false,
        aeronave_id: aeronaveId || null,
        aeronave_registro: aeronaveSel?.matricula || null,
        percentual_sociedade: socioSel?.percentual_participacao || null,
        percentual_uso: percNumerico,
        descricao_despesa: descricao,
        categoria_custo: tipoDespesa || null,
        periodicidade,
        valor_total_despesa: valorNumerico,
        valor_rateado: valorRateado,
        valor_pago_real: null,
        status: statusMov,
        observacoes: obsFinal || null,
        boleto_url: boletoUrl,
        nf_url: nfUrl,
        recibo_url: reciboUrl,
        comprovante_url: comprovanteUrl,
      });

      // 4) Modo Despesa de Viagem: gera contas a pagar por tripulante e conta a receber para o cliente
      if (isViagemMode && travelReportSel && !rascunho) {
        const trip1Val = Number(travelReportSel.total_trip || 0);
        const trip2Val = Number(travelReportSel.total_trip2 || 0);
        const cliVal = Number(travelReportSel.total_clientes || 0);
        const anexosPdfRv = travelReportSel.url_pdf || null;

        // Conta a pagar para tripulante 1
        if (trip1Val > 0 && travelReportSel.nome_tripulante) {
          await supabaseClient.from("contas_apagar").insert({
            data_vencimento: dataVenc,
            data_agendamento: dataVenc,
            valor: trip1Val,
            categoria: "REEMBOLSO TRIPULAÇÃO",
            descricao: `RV ${travelReportSel.numero_relatorio} — ${travelReportSel.nome_tripulante}`,
            status: statusCP,
            observacoes: `Reembolso tripulante 1 do relatório ${travelReportSel.numero_relatorio}`,
            cliente_id: clienteId,
            socios_cliente_id: socioId || null,
            aeronave_registro: aeronaveSel?.matricula || travelReportSel.matricula_aeronave || null,
            arquivo_pdf_url: anexosPdfRv,
            movimentacao_id: movId,
            criado_por: userId,
          });
        }
        // Conta a pagar para tripulante 2
        if (trip2Val > 0 && travelReportSel.nome_tripulante_2) {
          await supabaseClient.from("contas_apagar").insert({
            data_vencimento: dataVenc,
            data_agendamento: dataVenc,
            valor: trip2Val,
            categoria: "REEMBOLSO TRIPULAÇÃO",
            descricao: `RV ${travelReportSel.numero_relatorio} — ${travelReportSel.nome_tripulante_2}`,
            status: statusCP,
            observacoes: `Reembolso tripulante 2 do relatório ${travelReportSel.numero_relatorio}`,
            cliente_id: clienteId,
            socios_cliente_id: socioId || null,
            aeronave_registro: aeronaveSel?.matricula || travelReportSel.matricula_aeronave || null,
            arquivo_pdf_url: anexosPdfRv,
            movimentacao_id: movId,
            criado_por: userId,
          });
        }
        // Conta a receber do cliente (apenas se não houver sócio vinculado)
        if (!socioId && cliVal > 0) {
          await supabaseClient.from("contas_areceber").insert({
            numero: `RV-${travelReportSel.numero_relatorio}`,
            cliente_id: clienteId,
            cliente_nome: clienteSel?.razao_social || "",
            cliente_cnpj: clienteSel?.cnpj || null,
            data_criacao: dataComp,
            data_vencimento: dataVenc,
            valor: cliVal,
            categoria: "RELATÓRIO DE VIAGEM",
            descricao: `Cobrança RV ${travelReportSel.numero_relatorio} — ${travelReportSel.nome_tripulante || ""}`,
            status: "pendente",
            aeronave: aeronaveSel?.matricula || travelReportSel.matricula_aeronave || null,
            reference_type: "travel_expense_report",
            reference_id: travelReportSel.id,
          });
        }
      } else if (reembolsavel && !rascunho) {
        // Reembolso padrão (não viagem) → contas_areceber
        await supabaseClient.from("contas_areceber").insert({
          numero: `SP-${capId.slice(0, 8)}`,
          cliente_id: clienteId,
          cliente_nome: clienteSel?.razao_social || "",
          cliente_cnpj: clienteSel?.cnpj || null,
          data_criacao: dataComp,
          data_vencimento: dataVenc,
          valor: valorNumerico,
          categoria: "REEMBOLSO",
          descricao: `Reembolso: ${descricao}`,
          status: "pendente",
          aeronave: aeronaveSel?.matricula || null,
          reference_type: "solicitacao_pagamento",
          reference_id: movId,
        });
      }

      toast.success(rascunho ? "Rascunho salvo" : "Solicitação enviada para pagamento");
      resetForm();
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(e);
      toast.error(`Erro ao salvar: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Send className="h-4 w-4 text-emerald-400" />
            </div>
            Programar Pagamento — Cliente
          </DialogTitle>
          <DialogDescription>
            Crie uma solicitação de pagamento vinculada a um cliente/cotista. Ela ficará pendente no financeiro Share até quitação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Cliente / Sócio */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <SearchableCombobox
                items={clientes.map((c) => ({ id: c.id, label: c.razao_social }))}
                value={clienteId}
                onChange={(id, label) => {
                  setClienteId(id);
                  setSocioId("");
                }}
                placeholder="Selecione o cliente"
                searchPlaceholder="Buscar cliente..."
                emptyMessage="Nenhum cliente encontrado"
              />
            </div>
            {clienteSel?.tem_socio && socios.length > 0 && (
              <div className="space-y-1.5">
                <Label>Sócio (opcional)</Label>
                <Select value={socioId || "__all__"} onValueChange={(v) => setSocioId(v === "__all__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Todos os sócios" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">— Todos —</SelectItem>
                    {socios.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Aeronave</Label>
              <SearchableCombobox
                items={aeronaves.map((a) => ({ id: a.id, label: `${a.matricula} — ${a.modelo}` }))}
                value={aeronaveId}
                onChange={(id) => setAeronaveId(id)}
                placeholder="Selecione a aeronave"
                searchPlaceholder="Buscar aeronave..."
                emptyMessage="Nenhuma aeronave encontrada"
              />
            </div>
          </section>

          <section className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <Switch id="reembolsavel" checked={reembolsavel} onCheckedChange={setReembolsavel} />
            <div className="flex-1">
              <Label htmlFor="reembolsavel" className="cursor-pointer">Despesa reembolsável</Label>
              <p className="text-xs text-muted-foreground">Se ativada, será gerado um lançamento em Contas a Receber para o cliente.</p>
            </div>
            {reembolsavel && <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">Reembolsável</Badge>}
          </section>

          {/* Seleção de Relatório de Viagem - ANTES da seção de dados de despesa */}
          {isViagemMode && (
            <section className="space-y-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-sky-300 uppercase tracking-wide">Relatório de Viagem</h3>
              </div>
              {!clienteId ? (
                <p className="text-xs text-muted-foreground">Selecione o cliente para carregar os relatórios.</p>
              ) : travelReports.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum relatório encontrado para este cliente/aeronave/sócio.</p>
              ) : (
                <div className="space-y-1.5">
                  <Label>Selecione o relatório</Label>
                  <Select value={travelReportId} onValueChange={setTravelReportId}>
                    <SelectTrigger><SelectValue placeholder="Escolha um relatório" /></SelectTrigger>
                    <SelectContent>
                      {travelReports.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.numero_relatorio}
                          {r.data_inicio && ` — ${format(new Date(r.data_inicio), "dd/MM/yyyy")}`}
                          {r.matricula_aeronave && ` · ${r.matricula_aeronave}`}
                          {` · R$ ${Number(r.total_valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {travelReportSel && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Number(travelReportSel.total_trip || 0) > 0 && travelReportSel.nome_tripulante && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                        <div className="flex items-center justify-between text-xs text-amber-300">
                          <span>A pagar — Tripulante 1</span>
                          <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-300">Conta a Pagar</Badge>
                        </div>
                        <p className="text-sm mt-1 font-medium">{travelReportSel.nome_tripulante}</p>
                        <p className="text-lg font-bold text-amber-200">
                          R$ {Number(travelReportSel.total_trip || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}
                    {Number(travelReportSel.total_trip2 || 0) > 0 && travelReportSel.nome_tripulante_2 && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                        <div className="flex items-center justify-between text-xs text-amber-300">
                          <span>A pagar — Tripulante 2</span>
                          <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-300">Conta a Pagar</Badge>
                        </div>
                        <p className="text-sm mt-1 font-medium">{travelReportSel.nome_tripulante_2}</p>
                        <p className="text-lg font-bold text-amber-200">
                          R$ {Number(travelReportSel.total_trip2 || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}
                    {!socioId && Number(travelReportSel.total_clientes || 0) > 0 && (
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 md:col-span-2">
                        <div className="flex items-center justify-between text-xs text-emerald-300">
                          <span>A receber do cliente</span>
                          <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300">Conta a Receber</Badge>
                        </div>
                        <p className="text-sm mt-1 font-medium">{clienteSel?.razao_social}</p>
                        <p className="text-lg font-bold text-emerald-200">
                          R$ {Number(travelReportSel.total_clientes || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}
                    {socioId && (
                      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 md:col-span-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Total do relatório (sócio vinculado — sem conta a receber)</span>
                        </div>
                        <p className="text-lg font-bold">
                          R$ {Number(travelReportSel.total_valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}
                  </div>
                  {travelReportSel.url_pdf && (
                    <a href={travelReportSel.url_pdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200">
                      <ExternalLink className="h-3 w-3" /> Abrir PDF do relatório
                    </a>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Dados da despesa */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados da Despesa</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo de despesa *</Label>
                <SearchableCombobox
                  items={tiposDespesa.map((t) => ({ id: t.id, label: t.expense_type }))}
                  value={tipoDespesa}
                  onChange={(id, label) => {
                    const existente = tiposDespesa.find((t) => t.id === id);
                    if (existente) {
                      setTipoDespesa(id);
                      setTipoDespesaLabel(existente.expense_type);
                    } else if (label) {
                      // free text — perguntar
                      if (window.confirm(`Adicionar novo tipo "${label}"?`)) criarTipoDespesa(label);
                    }
                  }}
                  placeholder="Selecione o tipo"
                  allowFreeText
                />
              </div>
              {!isViagemMode && (
                <div className="space-y-1.5">
                  <Label>Fornecedor</Label>
                  <SearchableCombobox
                    items={fornecedores}
                    value={fornecedorId}
                    onChange={(id, label) => {
                      setFornecedorId(id);
                      const found = fornecedores.find((f) => f.id === id);
                      setFornecedorNome(found?.label || label || "");
                    }}
                    placeholder="Selecione ou digite"
                    allowFreeText
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} maxLength={500} placeholder="Ex: Serviço de limpeza técnica" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Valor total (R$) *</Label>
                <Input type="text" inputMode="decimal" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1.5">
                <Label>% de uso</Label>
                <Input type="text" inputMode="decimal" value={percentualUso} onChange={(e) => setPercentualUso(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Valor rateado</Label>
                <Input value={valorRateado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} readOnly className="bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Periodicidade</Label>
                <Select value={periodicidade} onValueChange={(v) => setPeriodicidade(v as Periodicidade)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MENSAL">Mensal</SelectItem>
                    <SelectItem value="TRIMESTRAL">Trimestral</SelectItem>
                    <SelectItem value="SEMESTRAL">Semestral</SelectItem>
                    <SelectItem value="ANUAL">Anual</SelectItem>
                    <SelectItem value="EVENTUAL">Eventual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DateField label="Data de emissão / competência" value={dataEmissao} onChange={setDataEmissao} />
              <DateField label="Data de vencimento *" value={dataVencimento} onChange={setDataVencimento} />
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} maxLength={1000} />
            </div>
          </section>

          {referenciaDuplicada?.tipo && (
            <section className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
              <div className="flex items-start gap-2">
                <Link2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-emerald-300">Registro existente encontrado</p>
                  <p className="text-sm text-emerald-200/90">{referenciaDuplicada.mensagem}</p>
                </div>
              </div>
            </section>
          )}

          {/* Anexos */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Documentos & Anexos</h3>
              <Button type="button" variant="outline" size="sm" onClick={addAnexo}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-3">
              <div className="flex items-center gap-3">
                <Switch id="usar-recibo-existente" checked={usarReciboExistente} onCheckedChange={setUsarReciboExistente} />
                <div className="flex-1">
                  <Label htmlFor="usar-recibo-existente" className="cursor-pointer">Anexar recibo já criado</Label>
                  <p className="text-xs text-muted-foreground">Se houver um recibo vigente, o PDF será vinculado automaticamente.</p>
                </div>
              </div>
              {usarReciboExistente && (
                <div className="space-y-1.5">
                  <Label>Selecione o recibo</Label>
                  <Select value={reciboExistenteId} onValueChange={setReciboExistenteId}>
                    <SelectTrigger><SelectValue placeholder="Escolha um recibo existente" /></SelectTrigger>
                    <SelectContent>
                      {recibosExistentes.map((recibo) => (
                        <SelectItem key={recibo.id} value={recibo.id}>
                          {recibo.numero_recibo || recibo.numero || `Recibo ${recibo.id.slice(0, 6)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {anexos.length === 0 && (
              <p className="text-xs text-muted-foreground border border-dashed border-white/10 rounded-lg p-4 text-center">
                Nenhum anexo. Clique em Adicionar para incluir NF, recibo, boleto ou documento.
              </p>
            )}
            <div className="space-y-2">
              {anexos.map((a, idx) => {
                const preview = previewAnexo(a);
                const img = isImage(a);
                return (
                  <div key={a.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 space-y-2">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-1 flex flex-col items-center gap-0.5">
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => moveAnexo(a.id, -1)}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={idx === anexos.length - 1} onClick={() => moveAnexo(a.id, 1)}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Select value={a.tipo} onValueChange={(v) => updateAnexo(a.id, { tipo: v as AnexoDoc["tipo"] })}>
                        <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIPOS_ANEXO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input className="col-span-3" placeholder="Número" value={a.numero} onChange={(e) => updateAnexo(a.id, { numero: e.target.value })} />
                      <div className="col-span-4 flex items-center gap-2">
                        <label className="flex-1 cursor-pointer">
                          <input type="file" className="hidden" accept="application/pdf,image/*"
                            onChange={(e) => updateAnexo(a.id, { arquivo: e.target.files?.[0] || null })} />
                          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-xs hover:bg-white/[0.05] transition">
                            {a.arquivo || a.url ? <FileText className="h-3.5 w-3.5 text-emerald-400" /> : <Upload className="h-3.5 w-3.5" />}
                            <span className="truncate">{a.arquivo?.name || a.url || "Selecionar arquivo"}</span>
                          </div>
                        </label>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => removeAnexo(a.id)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                    {preview && (
                      <div className="flex items-center gap-3 pl-8">
                        {img ? (
                          <img src={preview} alt="preview" className="h-16 w-16 rounded object-cover border border-white/10" />
                        ) : (
                          <div className="h-16 w-16 rounded border border-white/10 bg-white/[0.03] flex items-center justify-center">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <a href={preview} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200">
                          <Eye className="h-3 w-3" /> Pré-visualizar
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button variant="outline" onClick={() => handleSalvar(true)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar rascunho
          </Button>
          <Button onClick={() => handleSalvar(false)} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-white">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar para pagamento
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
