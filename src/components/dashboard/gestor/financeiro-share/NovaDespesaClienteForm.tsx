import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import AnexosDinamicosField, {
  type AnexoLinha,
  type AnexoTipoId,
} from "@/components/dashboard/gestor/FinanceiroCotista/AnexosDinamicosField";
import { X, Save, Users, Paperclip } from "lucide-react";

interface Props {
  onCancel: () => void;
  onSaved: (rows: any[]) => void;
}

const TIPOS = [
  { id: "despesa", label: "Despesa" },
  { id: "saida", label: "Saída" },
  { id: "receita", label: "Receita" },
  { id: "entrada", label: "Entrada" },
  { id: "estorno", label: "Estorno" },
];

const TIPOS_RATEIO = [
  { id: "FIXO", label: "Fixo" },
  { id: "EXTRA", label: "Extra" },
  { id: "VARIAVEL_POR_VOO", label: "Variável por voo" },
  { id: "VARIAVEL_POR_HORA", label: "Variável por hora" },
];

const STATUS = [
  { id: "pendente", label: "Pendente" },
  { id: "pago", label: "Pago" },
  { id: "recebido", label: "Recebido" },
  { id: "cancelado", label: "Cancelado" },
];

const FORMAS = [
  { id: "PIX", label: "Pix" },
  { id: "TED", label: "TED" },
  { id: "BOLETO", label: "Boleto" },
  { id: "DINHEIRO", label: "Dinheiro" },
  { id: "TRANSFERENCIA", label: "Transferência" },
  { id: "DEBITO_AUTOMATICO", label: "Débito automático" },
];

const isEntradaTipo = (t: string) => t === "receita" || t === "entrada" || t === "estorno";

const addMonths = (iso: string, n: number) => {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

/** Extrai o primeiro anexo de cada tipo em campos url/numero, no mesmo formato salvo em `movimentacoes`. */
function anexosToPatch(anexos: AnexoLinha[]) {
  const first = (t: AnexoTipoId) => anexos.find((a) => a.tipo === t && a.url);
  const c = first("comprovante"), r = first("recibo"), n = first("nf"), b = first("boleto");
  return {
    comprovante_url: c?.url ?? null,
    recibo_url: r?.url ?? null,
    nf_url: n?.url ?? null,
    boleto_url: b?.url ?? null,
    numero_doc: c?.numero || null,
    numero_recibo: r?.numero || null,
    numero_nf: n?.numero || null,
    numero_boleto: b?.numero || null,
  };
}

export default function NovaDespesaClienteForm({ onCancel, onSaved }: Props) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [tempId] = useState(() => crypto.randomUUID());

  const [saving, setSaving] = useState(false);
  const [expenseConfig, setExpenseConfig] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [socios, setSocios] = useState<any[]>([]);
  const [aeronaves, setAeronaves] = useState<any[]>([]);
  const [cotistas, setCotistas] = useState<any[]>([]);
  const [fornecedoresRaw, setFornecedoresRaw] = useState<
    { id: string; nome: string; label: string; source: "favorito" | "combustivel" }[]
  >([]);
  const [anexos, setAnexos] = useState<AnexoLinha[]>([]);

  const [form, setForm] = useState({
    descricao: "",
    tipo: "despesa",
    tipo_rateio: "EXTRA",
    clientes_id: "",
    socio_id: "",
    aeronave_id: "",
    categoria_id: "", // expense_configu.id
    subcategorias: [] as string[],
    valor_original: "",
    percentual_uso: "",
    data_competencia: hoje,
    data_vencimento: "",
    data_pagamento: "",
    status: "pendente",
    forma_pagamento: "",
    colaborador: "",
    fornecedor_nome: "",
    parcelado: false,
    quantidade_parcelas: "2",
    numero_parcela: "1",
    observacoes: "",
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    supabase
      .from("expense_configu")
      .select("id,expense_type,subcategoria_1,subcategoria_2,subcategoria_3,subcategoria_4")
      .order("expense_type")
      .then(({ data }) => setExpenseConfig(data ?? []));

    supabase
      .from("user_profiles")
      .select("id,full_name,email")
      .order("full_name")
      .then(({ data }) => setColaboradores(data ?? []));

    supabase
      .from("clientes")
      .select("id,razao_social,proprietario")
      .then(({ data }) => setClientes(data ?? []));

    supabase
      .from("socios")
      .select("id,nome,cliente_id")
      .then(({ data }) => setSocios(data ?? []));

    supabase
      .from("aeronave")
      .select("id,matricula,modelo")
      .order("matricula")
      .then(({ data }) => setAeronaves(data ?? []));

    supabase
      .from("cotistas_aeronave")
      .select("id_aeronave,id_clientes,socios_id,percentual_sociedade")
      .then(({ data }) => setCotistas(data ?? []));

    Promise.all([
      supabase.from("fornecedores_favoritos").select("id,nome_completo,apelido").order("nome_completo"),
      supabase.from("fornecedores_combustivel").select("id,nome_fornecedor,nome_cidade").order("nome_fornecedor"),
    ]).then(([fav, comb]) => {
      const list = [
        ...(fav.data ?? []).map((f: any) => ({
          id: f.nome_completo,
          nome: f.nome_completo,
          source: "favorito" as const,
          label: f.apelido ? `${f.nome_completo} (${f.apelido})` : f.nome_completo,
          rowId: f.id,
        })),
        ...(comb.data ?? []).map((f: any) => ({
          id: f.nome_fornecedor,
          nome: f.nome_fornecedor,
          source: "combustivel" as const,
          label: `${f.nome_fornecedor}${f.nome_cidade ? ` — ${f.nome_cidade}` : ""} · combustível`,
          rowId: f.id,
        })),
      ];
      setFornecedoresRaw(list as any);
    });
  }, []);

  const entrada = isEntradaTipo(form.tipo);

  /** expense_configu não tem coluna `tipo`, então a categoria fica em lista única (sem split entrada/saída). */
  const categoriaItems = useMemo(
    () =>
      [...expenseConfig]
        .sort((a: any, b: any) => String(a.expense_type).localeCompare(String(b.expense_type)))
        .map((c: any) => ({ id: c.id, label: String(c.expense_type).trim() })),
    [expenseConfig],
  );

  const fornecedores = useMemo(
    () => fornecedoresRaw.map((f) => ({ id: f.id, label: f.label })),
    [fornecedoresRaw],
  );

  const fornecedorSel = useMemo(
    () => fornecedoresRaw.find((f) => f.nome === form.fornecedor_nome) || null,
    [fornecedoresRaw, form.fornecedor_nome],
  );

  const clienteItems = useMemo(
    () => clientes.map((c: any) => ({ id: c.id, label: c.razao_social || c.proprietario || "—" })),
    [clientes],
  );

  const socioItems = useMemo(
    () =>
      socios
        .filter((s: any) => !form.clientes_id || s.cliente_id === form.clientes_id)
        .map((s: any) => ({ id: s.id, label: s.nome || "—" })),
    [socios, form.clientes_id],
  );

  /** Pago por: colaboradores + clientes + cotistas/sócios */
  const pagoPorItems = useMemo(() => {
    const colabs = colaboradores.map((u: any) => ({
      id: u.full_name || u.email || u.id,
      label: `${u.full_name || u.email || "—"} · colaborador`,
    }));
    const cls = clientes.map((c: any) => ({
      id: c.razao_social || c.proprietario || c.id,
      label: `${c.razao_social || c.proprietario || "—"} · cliente`,
    }));
    const socs = socios.map((s: any) => ({
      id: s.nome || s.id,
      label: `${s.nome || "—"} · cotista`,
    }));
    return [
      { id: "EMPRESA", label: "Share Brasil (empresa)" },
      ...cls,
      ...socs,
      ...colabs,
    ];
  }, [colaboradores, clientes, socios]);

  /** Aeronaves do cliente selecionado (cotistas_aeronave), com fallback para todas. */
  const aeronaveItems = useMemo(() => {
    const doCliente = form.clientes_id
      ? cotistas.filter((c: any) => c.id_clientes === form.clientes_id).map((c: any) => c.id_aeronave)
      : [];
    const lista = doCliente.length
      ? aeronaves.filter((a: any) => doCliente.includes(a.id))
      : aeronaves;
    return lista.map((a: any) => ({ id: a.id, label: `${a.matricula}${a.modelo ? ` — ${a.modelo}` : ""}` }));
  }, [aeronaves, cotistas, form.clientes_id]);


  const selectedCategoria = useMemo(
    () => expenseConfig.find((c: any) => c.id === form.categoria_id),
    [expenseConfig, form.categoria_id],
  );

  const categoriaNome = useMemo(
    () => (selectedCategoria ? String(selectedCategoria.expense_type).trim() : null),
    [selectedCategoria],
  );

  const subcategoriaOptions = useMemo(() => {
    if (!selectedCategoria) return [];
    return [
      selectedCategoria.subcategoria_1,
      selectedCategoria.subcategoria_2,
      selectedCategoria.subcategoria_3,
      selectedCategoria.subcategoria_4,
    ].filter((s: any) => !!s && String(s).trim());
  }, [selectedCategoria]);

  // Reseta subcategorias selecionadas se a categoria mudar
  useEffect(() => {
    set({ subcategorias: form.subcategorias.filter((s) => subcategoriaOptions.includes(s)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.categoria_id]);

  const toggleSubcategoria = (s: string) => {
    set({
      subcategorias: form.subcategorias.includes(s)
        ? form.subcategorias.filter((x) => x !== s)
        : [...form.subcategorias, s],
    });
  };

  const salvar = async () => {
    const valorTotal = Number(form.valor_original);
    if (!form.descricao.trim()) return toast.error("Informe a descrição.");
    if (!valorTotal || valorTotal <= 0) return toast.error("Informe um valor válido.");
    if (!form.data_competencia) return toast.error("Informe a data de competência.");
    if (!form.clientes_id) return toast.error("Selecione o cliente.");
    if (!form.aeronave_id) return toast.error("Selecione a aeronave (necessária para o rateio e o balanço).");


    const parcelas = form.parcelado ? Math.max(1, Number(form.quantidade_parcelas) || 1) : 1;
    const valorParcela = Number((valorTotal / parcelas).toFixed(2));
    const primeira = form.parcelado ? Math.max(1, Number(form.numero_parcela) || 1) : 1;

    // Sem coluna dedicada para subcategoria em `movimentacoes`, registramos como texto nas observações.
    const obsBase = form.observacoes.trim();
    const subcatLine = form.subcategorias.length ? `Subcategorias: ${form.subcategorias.join(", ")}` : "";
    const observacoesFinal = [obsBase, subcatLine].filter(Boolean).join("\n") || null;

    const anexosPatch = anexosToPatch(anexos);

    const clienteNome = clientes.find((c: any) => c.id === form.clientes_id)?.razao_social
      || clientes.find((c: any) => c.id === form.clientes_id)?.proprietario
      || "—";

    const aeronaveSel = aeronaves.find((a: any) => a.id === form.aeronave_id) || null;
    const aeronaveRegistro = aeronaveSel?.matricula || null;

    /**
     * Cotistas da aeronave para este lançamento. Clientes com 100% da cota
     * (ou sem registro em `cotistas_aeronave`) também precisam gerar rateio,
     * senão o balanço da aeronave fica sem os dados da despesa.
     */
    const cotistasDaAeronave = form.aeronave_id
      ? cotistas.filter((c: any) => c.id_aeronave === form.aeronave_id && c.id_clientes === form.clientes_id)
      : [];
    const linhasRateioBase = cotistasDaAeronave.length
      ? cotistasDaAeronave.map((c: any) => ({
          socio_id: c.socios_id || form.socio_id || null,
          socios_nome: socios.find((s: any) => s.id === (c.socios_id || form.socio_id))?.nome || null,
          percentual: Number(c.percentual_sociedade ?? 100) || 100,
        }))
      : [{
          socio_id: form.socio_id || null,
          socios_nome: socios.find((s: any) => s.id === form.socio_id)?.nome || null,
          percentual: 100,
        }];

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const criadoPor = userData?.user?.id ?? null;
      const criados: any[] = [];
      let paiId: string | null = null;

      for (let i = 0; i < parcelas; i++) {
        const numeroParcela = primeira + i;
        const sufixo = parcelas > 1 ? ` (${numeroParcela}/${parcelas})` : "";
        const vencimento = form.data_vencimento ? addMonths(form.data_vencimento, i) : null;
        const competencia = addMonths(form.data_competencia, i) || form.data_competencia;
        const dataPagamento = i === 0 ? form.data_pagamento || null : null;
        const statusParcela = i === 0 ? form.status : "pendente";
        const pago = ["pago", "recebido"].includes(statusParcela);

        const payload: any = {
          descricao: form.descricao.trim() + sufixo,
          tipo: form.tipo,
          tipo_caixa: "cliente",
          pago_diretamente: true, // despesa paga direto pelo cliente, sem passar por conta bancária da Share
          clientes_id: form.clientes_id || null,
          socio_id: form.socio_id || null,
          aeronave_id: form.aeronave_id || null,
          categoria_id: form.categoria_id || null,
          categoria_nome: categoriaNome,
          valor_rateado: valorParcela,
          valor_original: valorParcela,
          valor_pago_real: pago ? valorParcela : null,
          percentual_uso: form.percentual_uso ? Number(form.percentual_uso) : null,
          data_competencia: competencia,
          data_vencimento: vencimento,
          data_pagamento: dataPagamento,
          status: statusParcela,
          forma_pagamento: form.forma_pagamento || null,
          pago_por: form.colaborador || null,
          fornecedor_nome: form.fornecedor_nome || null,
          quantidade_parcelas: parcelas,
          numero_parcela: numeroParcela,
          movimentacao_pai_id: paiId,
          observacoes: observacoesFinal,
          reembolsavel: false,
          reembolso_quitado: false,
          criado_por: criadoPor,
          ...anexosPatch,
        };

        const { data: mov, error } = await supabase
          .from("movimentacoes")
          .insert(payload as any)
          .select("*")
          .single();
        if (error) throw error;
        if (i === 0) paiId = (mov as any).id;

        const jaLiquidado = ["pago", "recebido", "cancelado"].includes(payload.status);

        // Rateio de despesas — garante os dados de aeronave no balanço,
        // inclusive para cliente com 100% da cota.
        const rateioRows = linhasRateioBase.map((linha) => ({
            despesa_id: (mov as any).id,
            fonte_despesa: "movimentacoes",
            tipo_rateio: form.tipo_rateio,
            fluxo: entrada ? "ENTRADA" : "SAIDA",
            data_emissao: competencia,
            data_vencimento: vencimento || competencia,
            data_pagamento: payload.data_pagamento,
            cliente_id: form.clientes_id || null,
            clientes_nome: clienteNome,
            socio_id: linha.socio_id,
            socios_nome: linha.socios_nome,
            aeronave_id: form.aeronave_id || null,
            aeronave_registro: aeronaveRegistro,
            percentual_sociedade: linha.percentual,
            percentual_uso: form.percentual_uso ? Number(form.percentual_uso) : null,
            descricao_despesa: payload.descricao,
            categoria_custo: form.categoria_id || null,
            periodicidade: "MENSAL",
            valor_total_despesa: valorParcela,
            valor_rateado: Number(((valorParcela * linha.percentual) / 100).toFixed(2)),
            valor_pago_real: pago ? Number(((valorParcela * linha.percentual) / 100).toFixed(2)) : 0,
            status: statusParcela,
            pago_por: form.colaborador || clienteNome,
            pago_diretamente: true,
            forma_pagamento: form.forma_pagamento || null,
            fornecedor_nome: form.fornecedor_nome || null,
            observacoes: observacoesFinal,
            subcategoria_1: form.subcategorias[0] || null,
            subcategoria_2: form.subcategorias[1] || null,
            subcategoria_3: form.subcategorias[2] || null,
            subcategoria_4: form.subcategorias[3] || null,
            numero_doc: anexosPatch.numero_doc,
            numero_nf: anexosPatch.numero_nf,
            numero_boleto: anexosPatch.numero_boleto,
            numero_recibo: anexosPatch.numero_recibo,
            comprovante_url: anexosPatch.comprovante_url,
            nf_url: anexosPatch.nf_url,
            boleto_url: anexosPatch.boleto_url,
            recibo_url: anexosPatch.recibo_url,
          }));
        const { error: rateioErr } = await supabase.from("rateio_despesas").insert(rateioRows as any);
        if (rateioErr) throw rateioErr;

        // Gera o título financeiro correspondente (a pagar ou a receber)
        if (!entrada) {
          const { data: cap } = await supabase
            .from("contas_apagar")
            .insert({
              descricao: payload.descricao,
              valor: valorParcela,
              categoria: categoriaNome,
              categoria_id: form.categoria_id || null,
              data_vencimento: vencimento || competencia,
              data_agendamento: vencimento || competencia,
              data_pagamento: payload.data_pagamento,
              valor_pago: jaLiquidado ? String(valorParcela) : null,
              status: jaLiquidado ? "pago" : "pendente",
              cliente_id: form.clientes_id || null,
              socios_cliente_id: form.socio_id || null,
              aeronave_registro: aeronaveRegistro,
              fornecedor_nome: form.fornecedor_nome || null,
              fornecedor_favorito_id: fornecedorSel?.source === "favorito" ? (fornecedorSel as any).rowId : null,
              fornecedor_combustivel_id: fornecedorSel?.source === "combustivel" ? (fornecedorSel as any).rowId : null,
              empresa: clienteNome,
              observacoes: observacoesFinal,
              numero_doc: anexosPatch.numero_doc,
              arquivo_pdf_url: anexosPatch.comprovante_url,
              possui_nf: !!anexosPatch.nf_url,
              nf_numero: anexosPatch.numero_nf,
              nf_url: anexosPatch.nf_url,
              possui_boleto: !!anexosPatch.boleto_url,
              boleto_url: anexosPatch.boleto_url,
              vencimento_boleto: anexosPatch.boleto_url ? (vencimento || competencia) : null,
              possui_recibo: !!anexosPatch.recibo_url,
              numero_recibo: anexosPatch.numero_recibo,
              recibo_url: anexosPatch.recibo_url,
              data_recibo: anexosPatch.recibo_url ? competencia : null,
              comprovante_pagamento_url: jaLiquidado ? anexosPatch.comprovante_url : null,
              movimentacao_id: (mov as any).id,
              reference_type: "movimentacao_cliente",
              reference_id: (mov as any).id,
              criado_por: criadoPor,
            } as any)
            .select("id")
            .single();
          if (cap?.id) {
            await supabase.from("movimentacoes").update({ contas_apagar_id: cap.id } as any).eq("id", (mov as any).id);
            (mov as any).contas_apagar_id = cap.id;
          }
        } else {
          const { data: car } = await supabase
            .from("contas_areceber")
            .insert({
              cliente_nome: clienteNome,
              cliente_cnpj: "—",
              descricao: payload.descricao,
              valor: valorParcela,
              categoria: categoriaNome || "RECEITA",
              categoria_id: form.categoria_id || null,
              data_criacao: competencia,
              data_vencimento: vencimento || competencia,
              data_pagamento: payload.data_pagamento,
              status: jaLiquidado ? "recebido" : "pendente",
              metodo_pagamento: form.forma_pagamento || null,
              movimentacao_id: (mov as any).id,
              reference_type: "movimentacao_cliente",
              reference_id: (mov as any).id,
              criado_por: criadoPor,
            } as any)
            .select("id")
            .single();
          if (car?.id) {
            await supabase.from("movimentacoes").update({ contas_areceber_id: car.id } as any).eq("id", (mov as any).id);
            (mov as any).contas_areceber_id = car.id;
          }
        }

        criados.push(mov);
      }


      toast.success(
        parcelas > 1 ? `${parcelas} parcelas lançadas no Caixa Cliente.` : "Lançamento criado no Caixa Cliente.",
      );
      onSaved(criados);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar lançamento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Users className="h-4 w-4 text-primary" /> Nova Movimentação — Caixa Cliente
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Label>Descrição *</Label>
            <Input
              placeholder="Ex: Hangaragem mensal, Manutenção aeronave"
              value={form.descricao}
              onChange={(e) => set({ descricao: e.target.value })}
            />
          </div>

          <div>
            <Label>Tipo *</Label>
            <SearchableCombobox
              items={TIPOS}
              value={form.tipo}
              onChange={(id) => set({ tipo: id })}
              placeholder="Selecione o tipo"
            />
          </div>

          <div>
            <Label>Tipo de rateio</Label>
            <SearchableCombobox
              items={TIPOS_RATEIO}
              value={form.tipo_rateio}
              onChange={(id) => set({ tipo_rateio: id })}
              placeholder="Selecione o tipo de rateio"
            />
          </div>

          <div>
            <Label>Cliente *</Label>
            <SearchableCombobox
              items={clienteItems}
              value={form.clientes_id}
              onChange={(id) => set({ clientes_id: id, socio_id: "" })}
              placeholder="Selecione o cliente"
              searchPlaceholder="Buscar cliente..."
            />
          </div>
          <div>
            <Label>Sócio (opcional)</Label>
            <SearchableCombobox
              items={socioItems}
              value={form.socio_id}
              onChange={(id) => set({ socio_id: id })}
              placeholder="Selecione o sócio"
              searchPlaceholder="Buscar sócio..."
              emptyMessage="Nenhum sócio para este cliente."
            />
          </div>

          <div>
            <Label>Aeronave *</Label>
            <SearchableCombobox
              items={aeronaveItems}
              value={form.aeronave_id}
              onChange={(id) => set({ aeronave_id: id })}
              placeholder="Selecione a aeronave"
              searchPlaceholder="Buscar aeronave..."
              emptyMessage="Nenhuma aeronave encontrada."
            />
          </div>



          <div className="lg:col-span-2">
            <Label>Categoria</Label>
            <SearchableCombobox
              items={categoriaItems}
              value={form.categoria_id}
              onChange={(id) => set({ categoria_id: id })}
              placeholder="Selecione a categoria"
              searchPlaceholder="Buscar categoria..."
            />
          </div>
          <div>
            <Label>% Uso</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.percentual_uso}
              onChange={(e) => set({ percentual_uso: e.target.value })}
            />
          </div>

          {subcategoriaOptions.length > 0 && (
            <div className="lg:col-span-3">
              <Label>Subcategorias</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {subcategoriaOptions.map((s) => {
                  const active = form.subcategorias.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSubcategoria(s)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                        active
                          ? "bg-primary/15 text-primary border-primary/40"
                          : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
             
            </div>
          )}

          <div>
            <Label>Valor (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.valor_original}
              onChange={(e) => set({ valor_original: e.target.value })}
            />
          </div>

          <div>
            <Label>Competência *</Label>
            <Input type="date" value={form.data_competencia} onChange={(e) => set({ data_competencia: e.target.value })} />
          </div>
          <div>
            <Label>Vencimento</Label>
            <Input type="date" value={form.data_vencimento} onChange={(e) => set({ data_vencimento: e.target.value })} />
          </div>
          <div>
            <Label>Pagamento</Label>
            <Input type="date" value={form.data_pagamento} onChange={(e) => set({ data_pagamento: e.target.value })} />
          </div>

          <div>
            <Label>Status</Label>
            <SearchableCombobox items={STATUS} value={form.status} onChange={(id) => set({ status: id })} placeholder="Status" />
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <SearchableCombobox
              items={FORMAS}
              value={form.forma_pagamento}
              onChange={(id) => set({ forma_pagamento: id })}
              placeholder="Forma"
            />
          </div>
          <div>
            <Label>Pago por</Label>
            <SearchableCombobox
              items={pagoPorItems}
              value={form.colaborador}
              onChange={(id) => set({ colaborador: id })}
              placeholder="Cliente, cotista ou colaborador"
              searchPlaceholder="Buscar pagador..."
              allowFreeText
            />
          </div>


          <div className="lg:col-span-3">
            <Label>Fornecedor</Label>
            <SearchableCombobox
              items={fornecedores}
              value={form.fornecedor_nome}
              onChange={(id) => set({ fornecedor_nome: id })}
              placeholder="Selecione o fornecedor"
              searchPlaceholder="Buscar fornecedor..."
              allowFreeText
            />
          </div>
        </div>

        {/* Documentos e anexos */}
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="mb-0">Documentos e Anexos</Label>
          </div>
          <AnexosDinamicosField
            anexos={anexos}
            onChange={setAnexos}
            storagePrefix={`nova-mov-cliente/${tempId}`}
          />
        </div>

        {/* Parcelamento */}
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="parcelado-cliente"
              checked={form.parcelado}
              onCheckedChange={(v) => set({ parcelado: Boolean(v) })}
            />
            <Label htmlFor="parcelado-cliente" className="cursor-pointer">Despesa parcelada?</Label>
          </div>
          {form.parcelado && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label>Quantidade de parcelas</Label>
                <Input
                  type="number"
                  min="2"
                  value={form.quantidade_parcelas}
                  onChange={(e) => set({ quantidade_parcelas: e.target.value })}
                />
              </div>
              <div>
                <Label>Parcela inicial</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.numero_parcela}
                  onChange={(e) => set({ numero_parcela: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground md:col-span-3">
                O valor informado será dividido entre as parcelas, com vencimentos mensais a partir da data escolhida.
                Os documentos anexados acima são vinculados a todas as parcelas geradas.
              </p>
            </div>
          )}
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea rows={2} value={form.observacoes} onChange={(e) => set({ observacoes: e.target.value })} />
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="button" onClick={salvar} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : "Salvar lançamento"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
