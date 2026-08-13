// @ts-nocheck
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
import { X, Save, Users, Plus, Trash2, Plane } from "lucide-react";

interface Props {
  onCancel: () => void;
  onSaved: (rows: any[]) => void;
}



const STATUS = [
  { id: "pendente", label: "PENDENTE" },
  { id: "pago", label: "PAGO" },
  { id: "recebido", label: "RECEBIDO" },
  { id: "aguardando_reembolso", label: "AGUARDANDO REEMBOLSO" },
  { id: "cancelado", label: "CANCELADO" },
];

const FORMAS = [
  { id: "PIX", label: "PIX" },
  { id: "TED", label: "TED" },
  { id: "BOLETO", label: "BOLETO" },
  { id: "DINHEIRO", label: "DINHEIRO" },
  { id: "CARTAO", label: "CARTAO" },
  { id: "TRANSFERENCIA", label: "TRANSFERENCIA" },
  { id: "DEBITO_AUTOMATICO", label: "DEBITO AUTOMATICO" },
];

const TIPOS_RATEIO = [
  { id: "FIXO", label: "FIXO" },
  { id: "EXTRA", label: "EXTRA" },
  { id: "VARIAVEL_POR_VOO", label: "VARIAVEL POR VOO" },
  { id: "VARIAVEL_POR_HORA", label: "VARIAVEL POR HORA" },
];

const FLUXOS = [
  { id: "entrada", label: "ENTRADA" },
  { id: "saida", label: "SAIDA" },
   { id: "estorno", label: "ESTORNO" },
];

const PERIODICIDADES = [
  { id: "UNICO", label: "ÚNICO" },
  { id: "MENSAL", label: "MENSAL" },
  { id: "BIMESTRAL", label: "BIMESTRAL" },
  { id: "TRIMESTRAL", label: "TRIMESTRAL" },
  { id: "SEMESTRAL", label: "SEMESTRAL" },
  { id: "ANUAL", label: "ANUAL" },
];


const SHARE_BRASIL = "SHARE BRASIL";

const isEntradaTipo = (t: string) => t === "receita" || t === "entrada" || t === "estorno";

interface Linha {
  key: string;
  cliente_id: string | null;
  clientes_nome: string | null;
  socio_id: string | null;
  socios_nome: string | null;
  percentual_uso: string;
  valor_rateado: string;
}

const novaLinha = (): Linha => ({
  key: crypto.randomUUID(),
  cliente_id: null,
  clientes_nome: null,
  socio_id: null,
  socios_nome: null,
  percentual_uso: "",
  valor_rateado: "",
});

export default function NovaDespesaClienteForm({ onCancel, onSaved }: Props) {
  const hoje = new Date().toISOString().slice(0, 10);

  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);
  const [bancos, setBancos] = useState<any[]>([]);
  const [aeronaves, setAeronaves] = useState<any[]>([]);
  const [cotistas, setCotistas] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()]);

  const [form, setForm] = useState({
    descricao: "",
    tipo: "despesa",
    fluxo: "saida",
    categoria_id: "",
    subcategoria_key: "",
    aeronave_id: "",
    valor_original: "",
    data_emissao: hoje,
    data_vencimento: "",
    data_pagamento: "",
    status: "pendente",
    forma_pagamento: "",
    conta_bancaria: "",
    fornecedor_nome: "",
    tipo_rateio: "FIXO",
    periodicidade: "UNICO",
    pago_pela_share: false,
    observacoes: "",
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    (supabase as any)
      .from("expense_configu")
      .select("id,expense_type,subcategoria_1,subcategoria_2,subcategoria_3,subcategoria_4")
      .order("expense_type")
      .then(({ data }: any) => setConfigs(data ?? []));


    supabase
      .from("contas_bancarias")
      .select("id,banco,numero_conta")
      .eq("ativo", true)
      .order("banco")
      .then(({ data }) => setBancos(data ?? []));

    supabase
      .from("aeronave")
      .select("id,matricula,modelo")
      .order("matricula")
      .then(({ data }) => setAeronaves(data ?? []));
  }, []);

  /* Cotistas da aeronave selecionada */
  useEffect(() => {
    if (!form.aeronave_id) {
      setCotistas([]);
      return;
    }
    (supabase as any)
      .from("cotistas_aeronave")
      .select("id_clientes, socios_id, percentual_sociedade, clientes:clientes(id,razao_social,proprietario), socios:socios(id,nome)")
      .eq("id_aeronave", form.aeronave_id)
      .then(({ data }: any) => setCotistas(data ?? []));
  }, [form.aeronave_id]);

  const entrada = isEntradaTipo(form.tipo);

  const categoriaItems = useMemo(
    () => configs.map((c: any) => ({ id: c.id, label: c.expense_type || "—" })),
    [configs],
  );

  const configSelecionada = useMemo(
    () => configs.find((c: any) => c.id === form.categoria_id) || null,
    [configs, form.categoria_id],
  );

  const subcategoriaItems = useMemo(() => {
    if (!configSelecionada) return [];
    return (["subcategoria_1", "subcategoria_2", "subcategoria_3", "subcategoria_4"] as const)
      .filter((k) => configSelecionada[k])
      .map((k) => ({ id: k, label: String(configSelecionada[k]) }));
  }, [configSelecionada]);

  const subcategoriaNome = useMemo(
    () => (configSelecionada && form.subcategoria_key ? configSelecionada[form.subcategoria_key] : null),
    [configSelecionada, form.subcategoria_key],
  );


  const aeronaveItems = useMemo(
    () =>
      aeronaves.map((a: any) => ({
        id: a.id,
        label: `${a.matricula || "—"}${a.modelo ? ` — ${a.modelo}` : ""}`,
      })),
    [aeronaves],
  );

  const aeronaveRegistro = useMemo(
    () => aeronaves.find((a: any) => a.id === form.aeronave_id)?.matricula || null,
    [aeronaves, form.aeronave_id],
  );

  const bancoItems = useMemo(
    () =>
      bancos.map((b: any) => ({
        id: b.banco,
        label: `${b.banco}${b.numero_conta ? ` — ${b.numero_conta}` : ""}`,
      })),
    [bancos],
  );

  const cotistaItems = useMemo(
    () =>
      cotistas.map((c: any) => ({
        id: `${c.id_clientes || ""}|${c.socios_id || ""}`,
        label:
          c.socios?.nome || c.clientes?.razao_social || c.clientes?.proprietario || "Sem nome",
      })),
    [cotistas],
  );

  const categoriaNome = useMemo(
    () => (configSelecionada?.expense_type ? String(configSelecionada.expense_type).trim() : null),
    [configSelecionada],
  );


  const valorTotal = Number(form.valor_original) || 0;
  const totalRateado = linhas.reduce((a, l) => a + (Number(l.valor_rateado) || 0), 0);

  const setLinha = (idx: number, patch: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const escolherCotista = (idx: number, comboId: string) => {
    const [cliente_id, socios_id] = comboId.split("|");
    const c = cotistas.find(
      (x: any) => (x.id_clientes || "") === cliente_id && (x.socios_id || "") === socios_id,
    );
    const pct = c?.percentual_sociedade != null ? String(c.percentual_sociedade) : "";
    setLinha(idx, {
      cliente_id: cliente_id || null,
      socio_id: socios_id || null,
      clientes_nome: c?.clientes?.razao_social || c?.clientes?.proprietario || null,
      socios_nome: c?.socios?.nome || null,
      percentual_uso: pct,
      valor_rateado:
        pct && valorTotal ? ((valorTotal * Number(pct)) / 100).toFixed(2) : "",
    });
  };

  const aplicarPercentual = (idx: number, pct: string) => {
    const p = Number(pct);
    setLinha(idx, {
      percentual_uso: pct,
      valor_rateado: p && valorTotal ? ((valorTotal * p) / 100).toFixed(2) : "",
    });
  };

  const salvar = async () => {
    if (!form.descricao.trim()) return toast.error("Informe a descrição.");
    if (!valorTotal || valorTotal <= 0) return toast.error("Informe um valor válido.");
    if (!form.data_emissao) return toast.error("Informe a data de competência.");
    if (!form.aeronave_id) return toast.error("Selecione a aeronave do rateio.");

    const linhasValidas = linhas.filter((l) => l.cliente_id || l.socio_id);
    if (linhasValidas.length === 0) return toast.error("Adicione ao menos um cotista no rateio.");

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const criadoPor = userData?.user?.id ?? null;

      const statusMov = form.pago_pela_share && !entrada && form.status === "pago"
        ? "parcial"
        : form.status;

      // A movimentação é ÚNICA (do cliente/caixa cliente). O rateio por sócio
      // vive apenas em rateio_despesas — 1 linha por cotista.
      const clientesUnicos = Array.from(
        new Set(linhasValidas.map((l) => l.cliente_id).filter(Boolean)),
      ) as string[];
      const clientePrincipal = linhasValidas.find((l) => l.cliente_id && l.clientes_nome) ?? linhasValidas[0];
      const clienteMov = clientesUnicos.length === 1 ? clientesUnicos[0] : (clientePrincipal?.cliente_id ?? null);
      const nomeClientePrincipal = clientePrincipal?.clientes_nome || null;
      const socioMov = linhasValidas.length === 1 ? linhasValidas[0].socio_id : null;
      const socioNomeMov = linhasValidas.length === 1 ? linhasValidas[0].socios_nome : null;
      const pagadorMov = form.pago_pela_share ? SHARE_BRASIL : nomeClientePrincipal || socioNomeMov || null;

      // Regra "pago diretamente pelo cotista":
      // - ENTRADA nunca é pagamento direto (sempre false)
      // - SAÍDA só é pagamento direto quando NÃO saiu do banco do cliente/holding
      //   (nenhum banco selecionado) e não foi pago pelo caixa da Share.
      //   Ex.: sócio da DGA que paga o abastecimento do próprio bolso em vez de
      //   usar a conta bancária do grupo — acerta depois no fechamento do balanço.
      const pagoDiretamente =
        !entrada && !form.pago_pela_share && !String(form.conta_bancaria || "").trim();

      // `movimentacoes` NÃO possui data_vencimento — o vencimento fica no rateio.
      const payload: any = {
        descricao: form.descricao.trim(),
        tipo: form.tipo,
        tipo_caixa: "cliente",
        categoria_id: form.categoria_id || null,
        categoria_nome: [categoriaNome, subcategoriaNome].filter(Boolean).join(" / ") || null,
        periodicidade: form.periodicidade || null,
        tipo_rateio: form.tipo_rateio || null,
        aeronave_id: form.aeronave_id,
        clientes_id: clienteMov,
        socio_id: socioMov,
        socios_nome: socioMov ? socioNomeMov : null,
        valor_original: valorTotal,
        valor_rateado: totalRateado || valorTotal,
        data_emissao: form.data_emissao,
        data_pagamento: form.data_pagamento || null,
        status: statusMov,
        forma_pagamento: form.forma_pagamento || null,
        conta_bancaria: form.conta_bancaria || null,
        pago_por: pagadorMov,
        pago_diretamente: pagoDiretamente,
        fornecedor_nome: form.fornecedor_nome || null,
        observacoes: form.observacoes || null,
        reembolsavel: form.pago_pela_share && !entrada,
        reembolso_quitado: false,
        criado_por: criadoPor,
      };

      const { data: mov, error } = await supabase
        .from("movimentacoes")
        .insert(payload as any)
        .select("*")
        .single();
      if (error) throw error;

      const comuns: any = {
        despesa_id: (mov as any).id,
        movimentacao_origem_id: (mov as any).id,
        fonte_despesa: "movimentacoes",
        descricao_despesa: payload.descricao,
        tipo_rateio: form.tipo_rateio || null,
        fluxo: form.fluxo || (entrada ? "entrada" : "saida"),
        periodicidade: form.periodicidade || null,
        forma_pagamento: form.forma_pagamento || null,
        fornecedor_nome: form.fornecedor_nome || null,
        data_emissao: form.data_emissao,
        data_vencimento: form.data_vencimento || null,
        data_pagamento: form.data_pagamento || null,
        percentual_uso: linhasValidas.length === 1 && linhasValidas[0].percentual_uso !== ""
          ? Number(linhasValidas[0].percentual_uso)
          : null,
        aeronave_id: form.aeronave_id,
        aeronave_registro: aeronaveRegistro,
        valor_total: valorTotal,
        categoria_custo: form.categoria_id || null,
        categoria_nome: categoriaNome,
        conta_bancaria: form.conta_bancaria || null,
        ...(form.subcategoria_key && subcategoriaNome
          ? { [form.subcategoria_key]: subcategoriaNome }
          : {}),
      };

      for (const l of linhasValidas) {
        const { error: rErr } = await (supabase as any).from("rateio_despesas").insert({
          ...comuns,
          cliente_id: l.cliente_id,
          clientes_nome: l.clientes_nome,
          socio_id: l.socio_id,
          socios_nome: l.socios_nome,
          percentual_sociedade: l.percentual_uso === "" ? null : Number(l.percentual_uso),
          percentual_uso: l.percentual_uso === "" ? null : Number(l.percentual_uso),
          valor_rateado: l.valor_rateado === "" ? null : Number(l.valor_rateado),
          valor_pago_real: form.pago_pela_share ? null : (l.valor_rateado === "" ? null : Number(l.valor_rateado)),
          pago_por: form.pago_pela_share ? SHARE_BRASIL : l.socios_nome || l.clientes_nome,
          pago_diretamente: pagoDiretamente,
          status: form.pago_pela_share ? "aguardando_reembolso" : statusMov,
        });
        if (rErr) throw rErr;
      }



      toast.success("Lançamento criado no Caixa Cliente.");
      onSaved([mov]);
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
          <Users className="h-4 w-4 text-blue-400" /> Nova Movimentação — Caixa Cliente
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
              placeholder="Ex: Hangaragem, Seguro, Manutenção programada"
              value={form.descricao}
              onChange={(e) => set({ descricao: e.target.value })}
            />
          </div>

          
          <div>
            <Label>Fluxo *</Label>
            <SearchableCombobox
              items={FLUXOS}
              value={form.fluxo}
              onChange={(id) => set({ fluxo: id })}
              placeholder="Entrada ou saída"
            />
          </div>

          <div>
            <Label className="flex items-center gap-1.5"><Plane className="h-3.5 w-3.5" /> Aeronave *</Label>
            <SearchableCombobox
              items={aeronaveItems}
              value={form.aeronave_id}
              onChange={(id) => set({ aeronave_id: id })}
              placeholder="Selecione a aeronave"
              searchPlaceholder="Buscar matrícula..."
            />
          </div>

          <div>
            <Label>CATEGORIA</Label>
            <SearchableCombobox
              items={categoriaItems}
              value={form.categoria_id}
              onChange={(id) => set({ categoria_id: id, subcategoria_key: "" })}
              placeholder="Selecione a categoria"
              searchPlaceholder="Buscar categoria..."
            />
          </div>
          <div>
            <Label>Subcategoria</Label>
            <SearchableCombobox
              items={subcategoriaItems}
              value={form.subcategoria_key}
              onChange={(id) => set({ subcategoria_key: id })}
              placeholder={form.categoria_id ? "Selecione a subcategoria" : "Escolha a categoria primeiro"}
              disabled={!form.categoria_id}
              emptyMessage="Nenhuma subcategoria nesta categoria."
            />
          </div>


          <div>
            <Label>Valor total (R$) *</Label>
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
            <Input type="date" value={form.data_emissao} onChange={(e) => set({ data_emissao: e.target.value })} />
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
            {!entrada && !String(form.conta_bancaria || "").trim() && !form.pago_pela_share && (
              <p className="mt-1 text-[11px] leading-snug text-amber-400">
                Sem banco selecionado: será registrado como <strong>pago diretamente</strong> pelo
                cotista/sócio (acerto no fechamento do balanço).
              </p>
            )}
          </div>

          <div>
            <Label>Tipo de rateio</Label>
            <SearchableCombobox
              items={TIPOS_RATEIO}
              value={form.tipo_rateio}
              onChange={(id) => set({ tipo_rateio: id })}
              placeholder="Tipo de rateio"
            />
          </div>
          <div>
            <Label>Periodicidade</Label>
            <SearchableCombobox
              items={PERIODICIDADES}
              value={form.periodicidade}
              onChange={(id) => set({ periodicidade: id })}
              placeholder="Periodicidade"
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

        {/* Rateio por cotista */}
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Rateio por cotista
            </Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setLinhas((ls) => [...ls, novaLinha()])}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar cotista
            </Button>
          </div>

          {linhas.map((l, idx) => (
            <div key={l.key} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_110px_140px_40px]">
              <SearchableCombobox
                items={cotistaItems}
                value={`${l.cliente_id || ""}|${l.socio_id || ""}`}
                onChange={(id) => escolherCotista(idx, id)}
                placeholder={form.aeronave_id ? "Selecione o cotista" : "Escolha a aeronave primeiro"}
                searchPlaceholder="Buscar cotista..."
                emptyMessage="Nenhum cotista para esta aeronave."
                disabled={!form.aeronave_id}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="% uso"
                value={l.percentual_uso}
                onChange={(e) => aplicarPercentual(idx, e.target.value)}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Valor rateado"
                value={l.valor_rateado}
                onChange={(e) => setLinha(idx, { valor_rateado: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setLinhas((ls) => (ls.length > 1 ? ls.filter((_, i) => i !== idx) : ls))}
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          ))}

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Total rateado: <strong className="text-foreground">R$ {totalRateado.toFixed(2)}</strong> de R$ {valorTotal.toFixed(2)}
            </span>
            {valorTotal > 0 && Math.abs(totalRateado - valorTotal) > 0.01 && (
              <span className="text-amber-400">Diferença de R$ {(valorTotal - totalRateado).toFixed(2)}</span>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-3">
            <Checkbox
              id="pago_share"
              checked={form.pago_pela_share}
              onCheckedChange={(v) => set({ pago_pela_share: Boolean(v) })}
            />
            <Label htmlFor="pago_share" className="cursor-pointer text-xs">
              Pago pelo caixa da Share Brasil (gera reembolso a receber do cliente)
            </Label>
          </div>
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
