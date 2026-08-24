import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import AnexosDinamicosField, {
  type AnexoLinha,
  type AnexoTipoId,
} from "@/components/dashboard/gestor/FinanceiroCotista/AnexosDinamicosField";
import FornecedorPickerCombo from "./FornecedorPickerCombo";
import {
  X, Save, Loader2, Wallet, CalendarRange, ClipboardList,
  Info, CreditCard, Layers, Paperclip, Trash2, Plus, Fuel, ExternalLink,
} from "lucide-react";

export const SHARE_BRASIL = "SHARE BRASIL";

const PERIODICIDADES = [
  { id: "MENSAL", label: "Mensal" },
  { id: "BIMESTRAL", label: "Bimestral" },
  { id: "TRIMESTRAL", label: "Trimestral" },
  { id: "SEMESTRAL", label: "Semestral" },
  { id: "ANUAL", label: "Anual" },
  { id: "EVENTUAL", label: "Eventual" },
];

const STATUS_RATEIO = [
  { id: "pendente", label: "Pendente" },
  { id: "pago", label: "Pago" },
  { id: "recebido", label: "Recebido" },
  { id: "reembolsado", label: "Reembolsado" },
  { id: "aguardando_reembolso", label: "Aguardando reembolso" },
];

const MODOS_PAGAMENTO_CLIENTE = [
  { id: "direto", label: "Pago diretamente pelo cotista" },
  { id: "reembolso", label: "Pago pela Share — aguardando reembolso" },
];



interface Props {
  movId: string;
  mov: any;
  onClose: () => void;
  onSaved: (movPatch: any) => void;
}

const inputCls =
  "w-full rounded-lg bg-background/60 border border-border/70 px-3 py-2 text-[13px] text-foreground outline-none transition focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-500/60 placeholder:text-muted-foreground";
const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5";

const TIPOS_RATEIO = [
  { id: "FIXO", label: "Fixo" },
  { id: "EXTRA", label: "Extra" },
  { id: "VARIAVEL_POR_VOO", label: "Variável por Voo" },
  { id: "VARIAVEL_POR_HORA", label: "Variável por Hora" },
];
const FORMAS_PGTO = [
  { id: "PIX", label: "Pix" }, { id: "TED", label: "TED" },
  { id: "BOLETO", label: "Boleto" }, { id: "DINHEIRO", label: "Dinheiro" },
  { id: "CARTAO", label: "Cartão" }, { id: "TRANSFERENCIA", label: "Transferência" },
  { id: "DEBITO_AUTOMATICO", label: "Débito Automático" },
];
const FLUXOS = [
  { id: "ENTRADA", label: "Entrada" },
  { id: "SAIDA", label: "Saída" },
];
const RATEIO_FIELD_LABELS: Record<string, string> = {
  abastecimento_id: "Abastecimento", aeronave_id: "Aeronave", aeronave_registro: "Registro da aeronave",
  boleto_url: "Anexo do boleto", categoria_custo: "Categoria de custo", categoria_nome: "Nome da categoria",
  cliente_id: "Cliente", clientes_nome: "Cliente", comanda_url: "Anexo da comanda",
  comprovante_url: "Anexo do comprovante", conferido: "Conferido", conferido_em: "Conferido em",
  conferido_por: "Conferido por", conta_bancaria: "Conta bancária", criado_em: "Criado em",
  data_emissao: "Data de emissão", data_pagamento: "Data de pagamento", data_vencimento: "Data de vencimento",
  demonstrativo_url: "Anexo do demonstrativo", descricao_despesa: "Descrição", fluxo: "Fluxo",
  fonte_despesa: "Fonte da despesa", forma_pagamento: "Forma de pagamento", fornecedor_nome: "Fornecedor",
  movimentacao_origem_id: "Movimentação de origem", nf_url: "Anexo da nota fiscal", numero_boleto: "Número do boleto",
  numero_doc: "Número do comprovante", numero_nf: "Número da nota fiscal", numero_recibo: "Número do recibo",
  numero_voo: "Número do voo", observacoes: "Observações", pago_diretamente: "Pago diretamente",
  pago_por: "Pago por", percentual_sociedade: "% de sociedade", percentual_uso: "% de uso",
  periodicidade: "Periodicidade", recibo_url: "Anexo do recibo", relatorio_url: "Anexo do relatório",
  socio_id: "Sócio", socios_nome: "Sócio", status: "Status", subcategoria_1: "Subcategoria 1",
  subcategoria_2: "Subcategoria 2", subcategoria_3: "Subcategoria 3", subcategoria_4: "Subcategoria 4",
  tipo_rateio: "Tipo de rateio", atualizado_em: "Atualizado em", valor_pago_real: "Valor pago real",
  valor_rateado: "Valor rateado", valor_total: "Valor total",
};

const numOrNull = (v: any) => (v === "" || v == null ? null : Number(v));
const hasRateioValue = (value: unknown) => value !== null && value !== undefined && value !== "";
const isRateioUrl = (key: string, value: unknown): value is string => key.endsWith("_url") && typeof value === "string";
const formatRateioValue = (value: unknown) => typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value);

function Section({ icon, title, accent, children }: any) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-card/50 to-card/20 p-4 md:p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${accent}1A`, color: accent }}>{icon}</div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-foreground">{title}</h3>
        <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
      </div>
      {children}
    </section>
  );
}

function anexosFromMov(m: any): AnexoLinha[] {
  const list: AnexoLinha[] = [];
  const push = (tipo: AnexoTipoId, numero: string | null, url: string | null) => {
    if (url) list.push({ id: crypto.randomUUID(), tipo, numero: numero || "", url, file: null });
  };
  push("comprovante", m.numero_doc, m.comprovante_url);
  push("recibo", m.numero_recibo, m.recibo_url);
  push("nf", m.numero_nf, m.nf_url);
  push("boleto", m.numero_boleto, m.boleto_url);
  return list;
}

// Só grava os campos dos tipos de anexo presentes na tela — assim editar o
// lançamento nunca apaga NF/boleto/recibo que não foram tocados.
function anexosToPatch(anexos: AnexoLinha[]) {
  const patch: Record<string, string | null> = {};
  const apply = (t: AnexoTipoId, urlField: string, numeroField: string) => {
    const linhas = anexos.filter((a) => a.tipo === t);
    if (linhas.length === 0) return;
    const comUrl = linhas.find((a) => a.url) || linhas[0];
    patch[urlField] = comUrl?.url ?? null;
    patch[numeroField] = comUrl?.numero?.trim() || null;
  };
  apply("comprovante", "comprovante_url", "numero_doc");
  apply("recibo", "recibo_url", "numero_recibo");
  apply("nf", "nf_url", "numero_nf");
  apply("boleto", "boleto_url", "numero_boleto");
  return patch;
}

type ModoPagamentoCliente = "direto" | "reembolso";

interface RateioLinha {
  id?: string;
  despesa_id?: string;
  cliente_id: string | null;
  clientes_nome: string | null;
  socio_id: string | null;
  socios_nome: string | null;
  percentual_uso: number | null;
  valor_rateado: number | null;
  valor_pago_real: number | null;
  pago_por: string | null;
  pago_diretamente: boolean;
  modo_pagamento: ModoPagamentoCliente;
  status: string | null;
  _new?: boolean;
}

const novaLinha = (): RateioLinha => ({
  cliente_id: null, clientes_nome: null, socio_id: null, socios_nome: null,
  percentual_uso: null, valor_rateado: null, valor_pago_real: null,
  pago_por: null, pago_diretamente: false, modo_pagamento: "reembolso", status: "pendente", _new: true,
});

export default function EditCaixaClienteModal({ movId, mov: movInit, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mov, setMov] = useState<any>(movInit || {});
  const [rateio, setRateio] = useState<any>(null);
  const [linhas, setLinhas] = useState<RateioLinha[]>([]);
  const [despesaIdsRelacionadas, setDespesaIdsRelacionadas] = useState<string[]>([movId]);
  const [removidos, setRemovidos] = useState<string[]>([]);
  const [anexos, setAnexos] = useState<AnexoLinha[]>(anexosFromMov(movInit || {}));
  const [categoriaCustoId, setCategoriaCustoId] = useState<string>("");
  const [subcategoria, setSubcategoria] = useState<string>("");
  const [tipoRateio, setTipoRateio] = useState<string>("");
  const [periodicidade, setPeriodicidade] = useState<string>("");
  const [abastecimentoId, setAbastecimentoId] = useState<string>("");

  const { data: contasBancarias = [] } = useQuery({
    queryKey: ["contas-bancarias-edit-cliente"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("contas_bancarias")
        .select("id, banco, numero_conta")
        .eq("ativo", true)
        .order("banco");
      return (data ?? []) as { id: string; banco: string | null; numero_conta: string | null }[];
    },
  });

  const contasBancariasOptions = contasBancarias.map((conta) => ({
    id: conta.id,
    label: `${conta.banco || "Banco"}${conta.numero_conta ? ` — ${conta.numero_conta}` : ""}`,
  }));

  useEffect(() => {
    (async () => {
      const client = supabase as any;
      const { data: movimentacao } = await client
        .from("movimentacoes")
        .select("id, contas_apagar_id, reference_type, reference_id, tipo_caixa")
        .eq("id", movId)
        .maybeSingle();

      let idsRelacionados = [movId];
      if (movimentacao?.contas_apagar_id) {
        const { data: movimentacoesDaConta } = await client
          .from("movimentacoes")
          .select("id, tipo_caixa")
          .eq("contas_apagar_id", movimentacao.contas_apagar_id);
        idsRelacionados = (movimentacoesDaConta ?? [])
          .filter((item: any) => String(item.tipo_caixa || "").toLowerCase() === "cliente")
          .map((item: any) => item.id);
      } else if (movimentacao?.reference_type && movimentacao?.reference_id) {
        const { data: movimentacoesDaOrigem } = await client
          .from("movimentacoes")
          .select("id, tipo_caixa")
          .eq("reference_type", movimentacao.reference_type)
          .eq("reference_id", movimentacao.reference_id);
        idsRelacionados = (movimentacoesDaOrigem ?? [])
          .filter((item: any) => String(item.tipo_caixa || "").toLowerCase() === "cliente")
          .map((item: any) => item.id);
      }

      const despesaIds = Array.from(new Set([movId, ...idsRelacionados]));
      setDespesaIdsRelacionadas(despesaIds);

      const { data: rows } = await client
        .from("rateio_despesas")
        .select("*")
        .in("despesa_id", despesaIds)
        .order("criado_em");
      const list = (rows ?? []) as any[];
      const first = list[0] || null;
      const fallback = {
        cliente_id: movInit?.clientes_id ?? null,
        clientes_nome: movInit?.clientes_nome ?? null,
        socio_id: movInit?.socio_id ?? null,
        socios_nome: movInit?.socios_nome ?? null,
        percentual_uso: movInit?.percentual_uso ?? null,
        valor_rateado: movInit?.valor_rateado ?? movInit?.valor ?? null,
        valor_pago_real: movInit?.valor_pago_real ?? movInit?.valor_rateado ?? movInit?.valor ?? null,
        pago_por: movInit?.pago_por ?? null,
        pago_diretamente: !!movInit?.pago_diretamente,
        modo_pagamento: movInit?.pago_diretamente ? "direto" : "reembolso" as ModoPagamentoCliente,
        status: movInit?.status ?? "pendente",
      } satisfies RateioLinha;
      const hydratedRateio = first || {
        ...fallback,
        despesa_id: movId,
        descricao_despesa: movInit?.descricao ?? null,
        tipo_rateio: movInit?.tipo_rateio ?? null,
        periodicidade: movInit?.periodicidade ?? null,
        categoria_custo: movInit?.categoria_id ?? null,
        categoria_nome: movInit?.categoria_nome ?? null,
      };
      setRateio(hydratedRateio);
      setMov((current: any) => ({
        ...current,
        fluxo: current.fluxo || hydratedRateio.fluxo || "",
        data_emissao: current.data_emissao || hydratedRateio.data_emissao || "",
        data_vencimento: current.data_vencimento || hydratedRateio.data_vencimento || "",
        data_pagamento: current.data_pagamento || hydratedRateio.data_pagamento || "",
        forma_pagamento: current.forma_pagamento || hydratedRateio.forma_pagamento || "",
        fornecedor_nome: current.fornecedor_nome || hydratedRateio.fornecedor_nome || "",
        conta_bancaria: current.conta_bancaria || hydratedRateio.conta_bancaria || "",
      }));
      setAnexos(anexosFromMov({
        ...movInit,
        comprovante_url: hydratedRateio.comprovante_url || movInit?.comprovante_url,
        numero_doc: hydratedRateio.numero_doc || movInit?.numero_doc,
        recibo_url: hydratedRateio.recibo_url || movInit?.recibo_url,
        numero_recibo: hydratedRateio.numero_recibo || movInit?.numero_recibo,
        nf_url: hydratedRateio.nf_url || movInit?.nf_url,
        numero_nf: hydratedRateio.numero_nf || movInit?.numero_nf,
        boleto_url: hydratedRateio.boleto_url || movInit?.boleto_url,
        numero_boleto: hydratedRateio.numero_boleto || movInit?.numero_boleto,
      }));
      if (hydratedRateio.categoria_custo) setCategoriaCustoId(hydratedRateio.categoria_custo as string);
      if (hydratedRateio.subcategoria_1) setSubcategoria(hydratedRateio.subcategoria_1 as string);
      if (hydratedRateio.tipo_rateio) setTipoRateio(hydratedRateio.tipo_rateio as string);
      if (hydratedRateio.periodicidade) setPeriodicidade(hydratedRateio.periodicidade as string);
      if (hydratedRateio.abastecimento_id) setAbastecimentoId(hydratedRateio.abastecimento_id as string);
      setLinhas(
        list.length > 0
          ? list.map((r) => ({
              id: r.id,
              despesa_id: r.despesa_id ?? movId,
              cliente_id: r.cliente_id ?? null,
              clientes_nome: r.clientes_nome ?? null,
              socio_id: r.socio_id ?? null,
              socios_nome: r.socios_nome ?? null,
              percentual_uso: r.percentual_uso ?? null,
              valor_rateado: r.valor_rateado ?? null,
              valor_pago_real: r.valor_pago_real ?? null,
              pago_por: r.pago_por ?? null,
              pago_diretamente: !!r.pago_diretamente,
              modo_pagamento: !!r.pago_diretamente ? "direto" : "reembolso",
              status: r.status ?? null,
            }))
          : [fallback]
      );
    })();
  }, [movId]);


  // Cotistas/sócios possíveis para a aeronave do lançamento
  const { data: cotistas = [] } = useQuery({
    queryKey: ["cotistas-rateio-edit", movInit?.aeronave_id],
    queryFn: async () => {
      let q = (supabase as any)
        .from("cotistas_aeronave")
        .select("id_clientes, socios_id, percentual_sociedade, clientes:clientes(id, razao_social, proprietario), socios:socios(id, nome)");
      if (movInit?.aeronave_id) q = q.eq("id_aeronave", movInit.aeronave_id);
      const { data } = await q;
      return (data ?? []) as any[];
    },
  });

  const cotistaOptions = cotistas.map((c) => ({
    id: `${c.id_clientes || ""}|${c.socios_id || ""}`,
    label:
      c.socios?.nome ||
      c.clientes?.razao_social ||
      c.clientes?.proprietario ||
      "Sem nome",
  }));

  // Prioriza os cotistas vinculados à aeronave; Share e valores legados ficam depois.
  const pagadorOptions = useMemo(() => {
    const options = cotistas
      .map((c) => c.socios?.nome || c.clientes?.razao_social || c.clientes?.proprietario || "")
      .filter(Boolean)
      .filter((nome, index, all) => all.indexOf(nome) === index)
      .map((nome) => ({ id: String(nome), label: `${nome} (cotista da aeronave)` }));
    const nomes = new Set<string>(options.map((option) => option.id));
    nomes.add(SHARE_BRASIL);
    linhas.forEach((l) => {
      if (l.socios_nome) nomes.add(l.socios_nome);
      if (l.clientes_nome) nomes.add(l.clientes_nome);
      if (l.pago_por) nomes.add(l.pago_por);
    });
    const extras = Array.from(nomes)
      .filter((nome) => !options.some((option) => option.id === nome))
      .map((nome) => ({ id: nome, label: nome === SHARE_BRASIL ? "SHARE BRASIL (caixa da empresa)" : nome }));
    return [...options, ...extras];
  }, [cotistas, linhas]);

  // Abastecimentos da aeronave para vincular ao rateio
  const { data: abastecimentos = [] } = useQuery({
    queryKey: ["abastecimentos-rateio-edit", movInit?.aeronave_id],
    queryFn: async () => {
      let q = (supabase as any)
        .from("abastecimentos")
        .select("id, data, local, litros, valor_total, comanda")
        .order("data", { ascending: false })
        .limit(200);
      if (movInit?.aeronave_id) q = q.eq("aeronave_id", movInit.aeronave_id);
      const { data } = await q;
      return (data ?? []) as any[];
    },
  });

  const abastecimentoOptions = abastecimentos.map((a) => ({
    id: a.id,
    label: `${a.data ? new Date(`${a.data}T00:00:00`).toLocaleDateString("pt-BR") : "s/ data"} — ${a.local || "s/ local"} — ${Number(a.litros || 0).toLocaleString("pt-BR")} L — ${Number(a.valor_total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
  }));





  const { data: expenseConfigs = [] } = useQuery({
    queryKey: ["expense-configu-edit"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("expense_configu")
        .select("id, expense_type, subcategoria_1, subcategoria_2, subcategoria_3, subcategoria_4")
        .order("expense_type");
      return (data ?? []) as any[];
    },
  });

  const expenseOptions = expenseConfigs.map((c) => ({ id: c.id, label: c.expense_type }));
  useEffect(() => {
    if (categoriaCustoId || expenseConfigs.length === 0) return;
    const nome = String(movInit?.categoria_nome || "").trim().toLowerCase();
    if (!nome) return;
    const match = expenseConfigs.find((c) => String(c.expense_type || "").trim().toLowerCase() === nome);
    if (match) setCategoriaCustoId(match.id);
  }, [expenseConfigs, categoriaCustoId, movInit?.categoria_nome]);
  const selected = expenseConfigs.find((c) => c.id === categoriaCustoId);
  const subcatOptions = selected
    ? [selected.subcategoria_1, selected.subcategoria_2, selected.subcategoria_3, selected.subcategoria_4]
        .filter((s: string | null) => !!s && s.trim().length > 0)
        .map((s: string) => ({ id: s, label: s }))
    : [];

  const isAbastecimento = /abastec|combust/i.test(
    `${selected?.expense_type || ""} ${mov.categoria_nome || ""} ${mov.descricao || ""} ${tipoRateio}`
  );



  const setM = (k: string, v: any) => setMov((s: any) => ({ ...s, [k]: v }));
  const setR = (k: string, v: any) => setRateio((s: any) => (s ? { ...s, [k]: v } : s));

  const setLinha = (idx: number, patch: Partial<RateioLinha>) =>
    setLinhas((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const setLinhaModo = (idx: number, modo: ModoPagamentoCliente) => {
    const linha = linhas[idx];
    if (!linha) return;
    const direto = modo === "direto";
    setLinha(idx, {
      modo_pagamento: modo,
      pago_diretamente: direto,
      pago_por: direto ? (linha.socios_nome || linha.clientes_nome || linha.pago_por || null) : SHARE_BRASIL,
      valor_pago_real: direto ? (linha.valor_pago_real ?? linha.valor_rateado ?? null) : null,
      status: direto && String(linha.status || "").toLowerCase() === "aguardando_reembolso" ? "pago" : direto ? linha.status : "aguardando_reembolso",
    });
  };

  const setLinhaStatus = (idx: number, status: string) =>
    setLinhas((ls) => {
      const next = ls.map((l, i) => (i === idx ? { ...l, status } : l));
      const allPending = next.length > 0 && next.every((l) => String(l.status || "").trim().toLowerCase() === "pendente");
      if (allPending) {
        setMov((s: any) => ({ ...s, data_pagamento: "" }));
      }
      return next;
    });
  const addLinha = () => setLinhas((ls) => [...ls, novaLinha()]);
  const removeLinha = (idx: number) =>
    setLinhas((ls) => {
      const l = ls[idx];
      if (l?.id) setRemovidos((r) => [...r, l.id!]);
      return ls.filter((_, i) => i !== idx);
    });

  // Na Caixa Cliente, o valor editável da linha é normalmente valor_rateado;
  // valor_total é o total original da despesa e não pode substituir o rateio.
  const valorTotal = Number(mov.valor ?? mov.valor_rateado ?? mov.valor_total_despesa ?? mov.valor_total ?? 0) || 0;
  const totalRateado = linhas.reduce((a, l) => a + (Number(l.valor_rateado) || 0), 0);
  const totalPercentual = linhas.reduce((a, l) => a + (Number(l.percentual_uso) || 0), 0);

  const aplicarPercentual = (idx: number, pct: number | null) => {
    const valor = pct != null && valorTotal ? Number(((valorTotal * pct) / 100).toFixed(2)) : null;
    setLinha(idx, { percentual_uso: pct, valor_rateado: valor ?? linhas[idx]?.valor_rateado ?? null });
  };

  const handleSave = async () => {
    setSaving(true); setErr(null);
    try {
      const allRateiosPending = linhas.length > 0 && linhas.every((l) => String(l.status || "").trim().toLowerCase() === "pendente");
      const hasReembolso = linhas.some((l) => l.modo_pagamento === "reembolso");
      const statusAtual = String(mov.status || "").trim().toLowerCase();
      const statusMov = hasReembolso
        ? "aguardando_reembolso"
        : statusAtual === "aguardando_reembolso" ? "pago" : (mov.status || "pendente");
      const pagadores = Array.from(new Set(linhas.map((l) => l.pago_por).filter(Boolean)));
      const valorEditado = numOrNull(mov.valor ?? mov.valor_rateado ?? mov.valor_total_despesa);
      const patch: any = {
        descricao: mov.descricao,
        fornecedor_nome: mov.fornecedor_nome,
        data_emissao: mov.data_emissao || null,
        data_vencimento: mov.data_vencimento || null,
        data_pagamento: allRateiosPending ? null : mov.data_pagamento || null,
        forma_pagamento: mov.forma_pagamento || null,
        categoria_id: mov.categoria_id || categoriaCustoId || null,
        conta_bancaria: mov.conta_bancaria || null,
        grupo_categoria: mov.grupo_categoria || null,
        fluxo: mov.fluxo || rateio?.fluxo || "SAIDA",
        valor_rateado: valorEditado,
        valor_total: numOrNull(mov.valor_total ?? mov.valor_total_despesa) ?? valorEditado,
        valor_pago_real: hasReembolso ? null : numOrNull(mov.valor_pago_real ?? valorEditado),
        status: statusMov,
        pago_por: pagadores.length > 0 ? pagadores.join(", ") : null,
        pago_diretamente: !hasReembolso,
        reembolsavel: hasReembolso,
        reembolso_quitado: false,
        observacoes: mov.observacoes || null,
        categoria_nome: selected?.expense_type ?? mov.categoria_nome ?? null,
        tipo_rateio: tipoRateio || rateio?.tipo_rateio || null,
        periodicidade: periodicidade || rateio?.periodicidade || null,
        ...anexosToPatch(anexos),
      };
      const comuns = {
        descricao_despesa: mov.descricao,
        tipo_rateio: tipoRateio || rateio?.tipo_rateio || null,
        periodicidade: periodicidade || rateio?.periodicidade || null,
        abastecimento_id: abastecimentoId || null,
        forma_pagamento: mov.forma_pagamento,
        fornecedor_nome: mov.fornecedor_nome,
        data_emissao: mov.data_emissao || null,
        data_vencimento: mov.data_vencimento || null,
        data_pagamento: allRateiosPending ? null : mov.data_pagamento || null,
        aeronave_id: mov.aeronave_id ?? null,
        aeronave_registro: mov.aeronave_registro ?? rateio?.aeronave_registro ?? null,
        fluxo: mov.fluxo || rateio?.fluxo || "SAIDA",
        valor_total: (numOrNull(mov.valor_total ?? mov.valor_total_despesa) ?? valorTotal) || null,
        categoria_custo: categoriaCustoId || mov.categoria_id || rateio?.categoria_custo || null,
        categoria_nome: selected?.expense_type ?? mov.categoria_nome ?? rateio?.categoria_nome ?? null,
        conta_bancaria: mov.conta_bancaria || null,
        subcategoria_1: subcategoria || rateio?.subcategoria_1 || null,
        ...anexosToPatch(anexos),
      };

      const despesaIds = Array.from(new Set([movId, ...despesaIdsRelacionadas]));
      const agora = new Date().toISOString();

      const { error: e1 } = await (supabase as any)
        .from("rateio_despesas")
        .update({ ...comuns, atualizado_em: agora })
        .in("despesa_id", despesaIds);
      if (e1) throw e1;

      if (removidos.length > 0) {
        const { error: deleteRateioError } = await (supabase as any).from("rateio_despesas").delete().in("id", removidos);
        if (deleteRateioError) throw deleteRateioError;
      }

      for (const l of linhas) {
        const payload: any = {
          ...comuns,
          cliente_id: l.cliente_id,
          clientes_nome: l.clientes_nome,
          socio_id: l.socio_id,
          socios_nome: l.socios_nome,
          percentual_uso: numOrNull(l.percentual_uso),
          percentual_sociedade: numOrNull(l.percentual_uso),
          valor_total: valorTotal || null,
          valor_rateado: numOrNull(l.valor_rateado),
          valor_pago_real: l.modo_pagamento === "reembolso" ? null : numOrNull(l.valor_pago_real ?? l.valor_rateado),
          pago_por: l.modo_pagamento === "reembolso" ? SHARE_BRASIL : (l.pago_por || l.socios_nome || l.clientes_nome || null),
          pago_diretamente: l.modo_pagamento === "direto",
          status: l.modo_pagamento === "reembolso" ? "aguardando_reembolso" : (l.status || "pago"),
          atualizado_em: agora,
        };
        if (l.id) {
          const { error: rErr } = await (supabase as any).from("rateio_despesas").update(payload).eq("id", l.id);
          if (rErr) throw rErr;
        } else {
          const { error: rErr } = await (supabase as any).from("rateio_despesas").insert({ ...payload, despesa_id: movId });
          if (rErr) throw rErr;
        }
      }

      const linhasPorDespesa = new Map<string, RateioLinha[]>();
      linhas.forEach((linha) => {
        const despesaId = linha.despesa_id || movId;
        linhasPorDespesa.set(despesaId, [...(linhasPorDespesa.get(despesaId) || []), linha]);
      });

      const { valor_rateado: _valorRateado, valor_pago_real: _valorPagoReal, status: _status, pago_por: _pagoPor, pago_diretamente: _pagoDiretamente, reembolsavel: _reembolsavel, reembolso_quitado: _reembolsoQuitado, ...camposCompartilhadosMovimentacao } = patch;
      for (const despesaId of despesaIds) {
        const linhasDaMovimentacao = linhasPorDespesa.get(despesaId) || [];
        const temReembolso = linhasDaMovimentacao.some((linha) => linha.modo_pagamento === "reembolso");
        const todosPendentes = linhasDaMovimentacao.length > 0 && linhasDaMovimentacao.every(
          (linha) => String(linha.status || "").trim().toLowerCase() === "pendente"
        );
        const statusDaMovimentacao = temReembolso
          ? "aguardando_reembolso"
          : linhasDaMovimentacao.every((linha) => String(linha.status || "").trim().toLowerCase() === "pago")
            ? "pago"
            : linhasDaMovimentacao[0]?.status || patch.status;
        const pagadoresDaMovimentacao = Array.from(new Set(linhasDaMovimentacao.map((linha) => linha.pago_por).filter(Boolean)));
        const valorRateadoDaMovimentacao = linhasDaMovimentacao.reduce(
          (total, linha) => total + (Number(linha.valor_rateado) || 0),
          0
        );
        const valorPagoDaMovimentacao = linhasDaMovimentacao.reduce(
          (total, linha) => total + (Number(linha.valor_pago_real ?? linha.valor_rateado) || 0),
          0
        );

        const { error: movError } = await (supabase as any)
          .from("movimentacoes")
          .update({
            ...camposCompartilhadosMovimentacao,
            valor_rateado: linhasDaMovimentacao.length > 0 ? valorRateadoDaMovimentacao : patch.valor_rateado,
            valor_pago_real: temReembolso ? null : linhasDaMovimentacao.length > 0 ? valorPagoDaMovimentacao : patch.valor_pago_real,
            status: statusDaMovimentacao,
            pago_por: pagadoresDaMovimentacao.length > 0 ? pagadoresDaMovimentacao.join(", ") : patch.pago_por,
            pago_diretamente: !temReembolso,
            reembolsavel: temReembolso,
            reembolso_quitado: false,
            data_pagamento: todosPendentes ? null : patch.data_pagamento,
            atualizado_em: agora,
          })
          .eq("id", despesaId);
        if (movError) throw movError;
      }

      onSaved(patch); onClose();
    } catch (e: any) {
      setErr(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };


  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto p-3 sm:p-6 backdrop-blur-sm" style={{ background: "rgba(2,6,23,0.85)" }} onClick={onClose}>
      <div className="relative m-auto flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-background shadow-2xl shadow-cyan-950/40" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-card via-card to-cyan-950/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300"><ClipboardList className="h-4 w-4" /></div>
            <div>
              <div className="text-sm font-bold text-foreground">Editar Lançamento — Caixa Cliente</div>
              <div className="text-[10.5px] text-muted-foreground">Despesa do rateio (cliente/aeronave)</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/15 hover:text-red-300"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-5 md:p-6">
          {err && <div className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"><Info className="h-3.5 w-3.5" /> {err}</div>}

          <Section icon={<ClipboardList className="h-4 w-4" />} title="Identificação" accent="#22d3ee">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className={labelCls}>Descrição</label>
                <input className={inputCls} value={mov.descricao || ""} onChange={(e) => setM("descricao", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Fornecedor</label>
                <FornecedorPickerCombo value={mov.fornecedor_nome || ""} onChange={(v) => setM("fornecedor_nome", v)} />
              </div>
              <div>
                <label className={labelCls}>Categoria de custo</label>
                <SearchableCombobox items={expenseOptions} value={categoriaCustoId} onChange={(v) => { setCategoriaCustoId(v); setSubcategoria(""); }} placeholder="Selecione a categoria" searchPlaceholder="Buscar categoria..." />
              </div>
              {subcatOptions.length > 0 && (
                <div>
                  <label className={labelCls}>Subcategoria</label>
                  <SearchableCombobox items={subcatOptions} value={subcategoria} onChange={(v) => setSubcategoria(v)} placeholder="Selecione a subcategoria" allowFreeText />
                </div>
              )}
              <div>
                <label className={labelCls}>Tipo de Rateio</label>
                <SearchableCombobox items={TIPOS_RATEIO} value={tipoRateio} onChange={setTipoRateio} placeholder="Selecione" allowFreeText />
              </div>
              <div>
                <label className={labelCls}>Fluxo</label>
                <SearchableCombobox items={FLUXOS} value={mov.fluxo || rateio?.fluxo || ""} onChange={(v) => setM("fluxo", v)} placeholder="Selecione o fluxo" />
              </div>
              <div>
                <label className={labelCls}>Periodicidade</label>
                <SearchableCombobox items={PERIODICIDADES} value={periodicidade} onChange={setPeriodicidade} placeholder="Selecione" allowFreeText />
              </div>
              {(isAbastecimento || abastecimentoId) && (
                <div className="md:col-span-3">
                  <label className={labelCls}>Abastecimento vinculado</label>
                  <div className="flex items-center gap-2">
                    <Fuel className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                    <div className="flex-1">
                      <SearchableCombobox items={abastecimentoOptions} value={abastecimentoId} onChange={setAbastecimentoId} placeholder="Selecione o abastecimento" searchPlaceholder="Buscar abastecimento..." />
                    </div>
                    {abastecimentoId && (
                      <button type="button" onClick={() => setAbastecimentoId("")} className="rounded-lg border border-border px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-card-secondary">Limpar</button>
                    )}
                  </div>
                </div>
              )}

            </div>
          </Section>

          <Section icon={<CalendarRange className="h-4 w-4" />} title="Datas e Pagamento" accent="#38bdf8">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div><label className={labelCls}>Emissão</label><input type="date" className={inputCls} value={mov.data_emissao || ""} onChange={(e) => setM("data_emissao", e.target.value)} /></div>
              <div><label className={labelCls}>Vencimento</label><input type="date" className={inputCls} value={mov.data_vencimento || ""} onChange={(e) => setM("data_vencimento", e.target.value)} /></div>
              <div><label className={labelCls}>Pagamento</label><input type="date" className={inputCls} value={mov.data_pagamento || ""} onChange={(e) => setM("data_pagamento", e.target.value)} /></div>
              <div>
                <label className={labelCls}>Forma</label>
                <SearchableCombobox items={FORMAS_PGTO} value={mov.forma_pagamento || ""} onChange={(v) => setM("forma_pagamento", v)} placeholder="Forma" icon={<CreditCard className="h-3.5 w-3.5" />} />
              </div>
              <div><label className={labelCls}>Valor lançado</label><input type="number" step="0.01" className={inputCls} value={mov.valor ?? mov.valor_rateado ?? mov.valor_total ?? ""} onChange={(e) => setM("valor", e.target.value)} /></div>
            </div>
          </Section>

          <Section icon={<Layers className="h-4 w-4" />} title="Rateio da Despesa" accent="#34d399">
            <div className="space-y-3">
              {linhas.length === 0 && (
                <div className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-[11.5px] text-muted-foreground">
                  Nenhum rateio cadastrado para esta despesa.
                </div>
              )}

              {linhas.map((l, idx) => (
                <div key={l.id || `new-${idx}`} className="rounded-xl border border-white/[0.07] bg-background/50 p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                    <div className="md:col-span-2">
                      <label className={labelCls}>Cotista / Cliente</label>
                      <SearchableCombobox
                        items={cotistaOptions}
                        value={`${l.cliente_id || ""}|${l.socio_id || ""}`}
                        onChange={(v) => {
                          const [cid, sid] = String(v).split("|");
                          const opt = cotistas.find(
                            (c) => (c.id_clientes || "") === cid && (c.socios_id || "") === (sid || null || "")
                          );
                          setLinha(idx, {
                            cliente_id: cid || null,
                            socio_id: sid || null,
                            clientes_nome:
                              opt?.clientes?.razao_social || opt?.clientes?.proprietario || l.clientes_nome,
                            socios_nome: opt?.socios?.nome || (sid ? l.socios_nome : null),
                          });
                        }}
                        placeholder={l.socios_nome || l.clientes_nome || "Selecione o cotista"}
                        searchPlaceholder="Buscar cotista..."
                      />
                    </div>
                    <div>
                      <label className={labelCls}>% Uso</label>
                      <input
                        type="number" step="0.01" className={inputCls}
                        value={l.percentual_uso ?? ""}
                        onChange={(e) => aplicarPercentual(idx, e.target.value === "" ? null : Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Valor rateado</label>
                      <input
                        type="number" step="0.01" className={inputCls}
                        value={l.valor_rateado ?? ""}
                        onChange={(e) => setLinha(idx, { valor_rateado: e.target.value === "" ? null : Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Pagamento</label>
                      <SearchableCombobox
                        items={MODOS_PAGAMENTO_CLIENTE}
                        value={l.modo_pagamento}
                        onChange={(v) => setLinhaModo(idx, v as ModoPagamentoCliente)}
                        placeholder="Como foi pago?"
                        popoverClassName="min-w-[280px]"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Pago por</label>
                      <SearchableCombobox
                        items={pagadorOptions}
                        value={l.pago_por || ""}
                        onChange={(v) => {
                          const modo = v === SHARE_BRASIL ? "reembolso" : "direto";
                          setLinhaModo(idx, modo);
                          setLinha(idx, { pago_por: v });
                        }}
                        placeholder="Selecione o cotista pagador"
                        searchPlaceholder="Buscar cotista da aeronave..."
                        emptyMessage="Nenhum cotista encontrado para esta aeronave."
                        allowFreeText
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Status</label>
                      <SearchableCombobox
                        items={STATUS_RATEIO}
                        value={l.status || ""}
                        onChange={(v) => setLinhaStatus(idx, v)}
                        placeholder="Status"
                        popoverClassName="min-w-[240px]"
                      />
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[10.5px] text-muted-foreground">
                      {l.modo_pagamento === "reembolso"
                        ? "A Share pagou esta despesa e ela ficará aguardando o reembolso do cliente."
                        : "O cotista pagou diretamente; a despesa não fica pendente de reembolso da Share."}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pago real</span>
                        <input
                          type="number" step="0.01"
                          className="w-28 rounded-lg bg-background/60 border border-border/70 px-2 py-1 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-cyan-400/50"
                          value={l.valor_pago_real ?? ""}
                          onChange={(e) => setLinha(idx, { valor_pago_real: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLinha(idx)}
                        className="flex items-center gap-1.5 rounded-lg border border-red-400/25 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={addLinha}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar rateio
                </button>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-muted-foreground">
                    Total rateado:{" "}
                    <strong className={Math.abs(totalRateado - valorTotal) > 0.02 ? "text-amber-300" : "text-emerald-300"}>
                      {totalRateado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </strong>
                    {valorTotal ? <span className="text-muted-foreground"> / {valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span> : null}
                  </span>
                  <span className="text-muted-foreground">
                    Total %: <strong className={Math.abs(totalPercentual - 100) > 0.01 ? "text-amber-300" : "text-emerald-300"}>{totalPercentual.toFixed(2)}%</strong>
                  </span>
                </div>
              </div>
            </div>
          </Section>


          <Section icon={<Wallet className="h-4 w-4" />} title="Pagamento" accent="#38bdf8">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className={labelCls}>Forma de pagamento</label>
                <SearchableCombobox items={FORMAS_PGTO} value={mov.forma_pagamento || ""} onChange={(v) => setMov((current: any) => ({ ...current, forma_pagamento: v }))} placeholder="Selecione a forma" />
              </div>
              <div>
                <label className={labelCls}>Banco e número da conta</label>
                <SearchableCombobox items={contasBancariasOptions} value={mov.conta_bancaria || ""} onChange={(v) => setMov((current: any) => ({ ...current, conta_bancaria: v }))} placeholder="Selecione banco e conta" allowFreeText />
              </div>
            </div>
          </Section>
          <Section icon={<Paperclip className="h-4 w-4" />} title="Documentos e Anexos" accent="#fbbf24">
            <AnexosDinamicosField anexos={anexos} onChange={setAnexos} storagePrefix={`edit-mov/${movId}`} />
          </Section>

          {rateio && (
            <Section icon={<Info className="h-4 w-4" />} title="Dados preenchidos do rateio" accent="#a78bfa">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(rateio)
                  .filter(([key, value]) => key !== "id" && key !== "despesa_id" && hasRateioValue(value))
                  .map(([key, value]) => (
                    <div key={key} className="min-w-0 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                      <div className={labelCls}>{RATEIO_FIELD_LABELS[key] || key.replaceAll("_", " ")}</div>
                      {isRateioUrl(key, value) ? (
                        <a href={value} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 break-all text-[12px] font-medium text-cyan-300 hover:text-cyan-200 hover:underline">
                          Abrir anexo <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      ) : (
                        <div className="break-words text-[12px] text-foreground">{formatRateioValue(value)}</div>
                      )}
                    </div>
                  ))}
              </div>
            </Section>
          )}

          <Section icon={<Info className="h-4 w-4" />} title="Observações" accent="#a78bfa">
            <textarea className={inputCls} rows={3} value={mov.observacoes || ""} onChange={(e) => setM("observacoes", e.target.value)} />
          </Section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-card/60 px-6 py-3.5">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-card-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 px-5 py-2 text-xs font-bold text-white shadow-lg hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
