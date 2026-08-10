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
import FornecedorPickerCombo from "./FornecedorPickerCombo";
import { X, Save, Wallet } from "lucide-react";
import { categoriaCorrespondeAoTipo, formatarCategoriaParaLabel } from "./categoryFilters";

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

const STATUS = [
  { id: "pendente", label: "Pendente" },
  { id: "pago", label: "Pago" },
  { id: "recebido", label: "Recebido" },
  { id: "aguardando_reembolso", label: "Aguardando reembolso" },
  { id: "parcial", label: "Parcial" },
  { id: "cancelado", label: "Cancelado" },
];

const FORMAS = [
  { id: "PIX", label: "Pix" },
  { id: "TED", label: "TED" },
  { id: "BOLETO", label: "Boleto" },
  { id: "DINHEIRO", label: "Dinheiro" },
  { id: "CARTAO", label: "Cartão" },
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

export default function NovaDespesaShareForm({ onCancel, onSaved }: Props) {
  const hoje = new Date().toISOString().slice(0, 10);

  const [saving, setSaving] = useState(false);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [bancos, setBancos] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [form, setForm] = useState({
    descricao: "",
    tipo: "despesa",
    categoria_id: "",
    valor_original: "",
    data_competencia: hoje,
    data_vencimento: "",
    data_pagamento: "",
    status: "pendente",
    forma_pagamento: "",
    conta_bancaria: "",
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
      .from("categorias_movimentacao")
      .select("id,nome,tipo,grupo_categoria")
      .eq("ativo", true)
      .order("grupo_categoria")
      .then(({ data }) => setCategorias(data ?? []));

    supabase
      .from("contas_bancarias")
      .select("id,banco,numero_conta")
      .eq("ativo", true)
      .order("banco")
      .then(({ data }) => setBancos(data ?? []));

    supabase
      .from("user_profiles")
      .select("id,full_name,email")
      .order("full_name")
      .then(({ data }) => setColaboradores(data ?? []));

  }, []);

  const entrada = isEntradaTipo(form.tipo);

  /** Categorias separadas por entrada/saída e agrupadas por grupo_categoria. */
  const categoriaItems = useMemo(() => {
    const filtradas = categorias.filter((c: any) => categoriaCorrespondeAoTipo(form.tipo, c.tipo));
    return filtradas
      .sort((a: any, b: any) =>
        `${a.grupo_categoria || "ZZZ"}${a.nome}`.localeCompare(`${b.grupo_categoria || "ZZZ"}${b.nome}`),
      )
      .map((c: any) => ({
        id: c.id,
        label: formatarCategoriaParaLabel(c),
      }));
  }, [categorias, form.tipo]);

  const bancoItems = useMemo(
    () =>
      bancos.map((b: any) => ({
        id: b.banco,
        label: `${b.banco}${b.numero_conta ? ` — ${b.numero_conta}` : ""}`,
      })),
    [bancos],
  );

  const colaboradorItems = useMemo(
    () => colaboradores.map((u: any) => ({ id: u.full_name || u.email || u.id, label: u.full_name || u.email || "—" })),
    [colaboradores],
  );

  const categoriaNome = useMemo(() => {
    const c = categorias.find((x: any) => x.id === form.categoria_id);
    return c ? String(c.nome).trim() : null;
  }, [categorias, form.categoria_id]);

  const grupoCategoria = useMemo(() => {
    const c = categorias.find((x: any) => x.id === form.categoria_id);
    return c?.grupo_categoria || null;
  }, [categorias, form.categoria_id]);

  const salvar = async () => {
    const valorTotal = Number(form.valor_original);
    if (!form.descricao.trim()) return toast.error("Informe a descrição.");
    if (!valorTotal || valorTotal <= 0) return toast.error("Informe um valor válido.");
    if (!form.data_competencia) return toast.error("Informe a data de competência.");

    const parcelas = form.parcelado ? Math.max(1, Number(form.quantidade_parcelas) || 1) : 1;
    const valorParcela = Number((valorTotal / parcelas).toFixed(2));
    const primeira = form.parcelado ? Math.max(1, Number(form.numero_parcela) || 1) : 1;

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

        const payload: any = {
          descricao: form.descricao.trim() + sufixo,
          tipo: form.tipo,
          tipo_caixa: "share",
          categoria_id: form.categoria_id || null,
          categoria_nome: categoriaNome,
          grupo_custo: grupoCategoria,
          valor_rateado: valorParcela,
          valor_original: valorParcela,
          data_competencia: competencia,
          data_vencimento: vencimento,
          data_pagamento: i === 0 ? form.data_pagamento || null : null,
          status: i === 0 ? form.status : "pendente",
          forma_pagamento: form.forma_pagamento || null,
          conta_bancaria: form.conta_bancaria || null,
          pago_por: form.colaborador || null,
          fornecedor_nome: form.fornecedor_nome || null,
          quantidade_parcelas: parcelas,
          numero_parcela: numeroParcela,
          movimentacao_pai_id: paiId,
          observacoes: form.observacoes || null,
          reembolsavel: false,
          reembolso_quitado: false,
          criado_por: criadoPor,
        };

        const { data: mov, error } = await supabase
          .from("movimentacoes")
          .insert(payload as any)
          .select("*")
          .single();
        if (error) throw error;
        if (i === 0) paiId = (mov as any).id;

        const jaLiquidado = ["pago", "recebido", "cancelado"].includes(payload.status);

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
              data_pagamento: payload.data_pagamento,
              status: jaLiquidado ? "pago" : "pendente",
              fornecedor_nome: form.fornecedor_nome || null,
              conta_bancaria: form.conta_bancaria || null,
              empresa: "SHARE BRASIL",
              observacoes: form.observacoes || null,
              movimentacao_id: (mov as any).id,
              reference_type: "movimentacao_share",
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
              cliente_nome: form.fornecedor_nome || "SHARE BRASIL",
              cliente_cnpj: "—",
              descricao: payload.descricao,
              valor: valorParcela,
              categoria: categoriaNome || "RECEITA",
              categoria_id: form.categoria_id || null,
              data_criacao: competencia,
              data_vencimento: vencimento || competencia,
              data_pagamento: payload.data_pagamento,
              status: jaLiquidado ? "recebido" : "pendente",
              conta_bancaria: form.conta_bancaria || null,
              metodo_pagamento: form.forma_pagamento || null,
              movimentacao_id: (mov as any).id,
              reference_type: "movimentacao_share",
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
        parcelas > 1 ? `${parcelas} parcelas lançadas no Caixa Share.` : "Lançamento criado no Caixa Share.",
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
          <Wallet className="h-4 w-4 text-primary" /> Nova Movimentação — Caixa Share
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
              placeholder="Ex: Internet sede, Taxa bancária, Recebimento ADM"
              value={form.descricao}
              onChange={(e) => set({ descricao: e.target.value })}
            />
          </div>

          <div>
            <Label>Tipo *</Label>
            <SearchableCombobox
              items={TIPOS}
              value={form.tipo}
              onChange={(id) => set({ tipo: id, categoria_id: "" })}
              placeholder="Selecione o tipo"
            />
          </div>

          <div className="lg:col-span-2">
            <Label>Categoria ({entrada ? "entradas" : "saídas"})</Label>
            <SearchableCombobox
              items={categoriaItems}
              value={form.categoria_id}
              onChange={(id) => set({ categoria_id: id })}
              placeholder="Selecione a categoria"
              searchPlaceholder="Buscar por grupo ou categoria..."
              emptyMessage="Nenhuma categoria para este tipo."
            />
          </div>

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
            <Label>Banco / Conta</Label>
            <SearchableCombobox
              items={bancoItems}
              value={form.conta_bancaria}
              onChange={(id) => set({ conta_bancaria: id })}
              placeholder="Selecione o banco"
              allowFreeText
            />
          </div>

          <div>
            <Label>Colaborador (opcional)</Label>
            <SearchableCombobox
              items={colaboradorItems}
              value={form.colaborador}
              onChange={(id) => set({ colaborador: id })}
              placeholder="Selecione o colaborador"
              searchPlaceholder="Buscar colaborador..."
            />
          </div>
          <div className="lg:col-span-2">
            <Label>Fornecedor</Label>
            <FornecedorPickerCombo
              value={form.fornecedor_nome}
              onChange={(nome) => set({ fornecedor_nome: nome })}
              className="w-full"
            />
          </div>
        </div>

        {/* Parcelamento */}
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="parcelado"
              checked={form.parcelado}
              onCheckedChange={(v) => set({ parcelado: Boolean(v) })}
            />
            <Label htmlFor="parcelado" className="cursor-pointer">Despesa parcelada?</Label>
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
