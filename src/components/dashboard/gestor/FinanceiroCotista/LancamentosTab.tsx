import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

type GrupoCusto = "FIXO" | "VARIAVEL" | "EXTRA";

const GRUPOS: { value: GrupoCusto; label: string; hint: string }[] = [
  { value: "FIXO", label: "Custo Fixo", hint: "Hangaragem, ADM, seguros" },
  { value: "VARIAVEL", label: "Custo Variável", hint: "Combustível, manutenção/hora, taxas" },
  { value: "EXTRA", label: "Custo Extra", hint: "Pontuais, corretivas, eventos" },
];

type Movimentacao = {
  id: string;
  descricao: string;
  tipo: string;
  grupo_custo: string | null;
  valor: number;
  data_competencia: string;
  data_pagamento: string | null;
  fornecedor_nome: string | null;
  status: string;
  observacoes: string | null;
  aeronave_id: string | null;
  clientes_id: string | null;
};

type Socio = {
  id: string;
  nome: string;
  cpf: string | null;
  percentual_participacao: number | null;
};

type RateioInput = {
  socio_id: string;
  socio_nome: string;
  socio_cpf: string | null;
  percentual: number;
  valor_pago_real: number;
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (s?: string | null) =>
  s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—";

interface LancamentosTabProps {
  clienteId: string;
  aeronaveId: string | null;
  aeronaveLabel?: string;
}

export function LancamentosTab({ clienteId, aeronaveId, aeronaveLabel }: LancamentosTabProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Movimentacao | null>(null);

  const { data: socios } = useQuery({
    queryKey: ["socios-cliente-lanc", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("socios_cliente")
        .select("id, nome, cpf, percentual_participacao")
        .eq("cliente_id", clienteId)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Socio[];
    },
  });

  const { data: lancamentos, isLoading } = useQuery({
    queryKey: ["movimentacoes-cotista", clienteId, aeronaveId],
    enabled: !!clienteId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("movimentacoes")
        .select(
          "id, descricao, tipo, grupo_custo, valor, data_competencia, data_pagamento, fornecedor_nome, status, observacoes, aeronave_id, clientes_id"
        )
        .eq("clientes_id", clienteId)
        .order("data_competencia", { ascending: false })
        .limit(200);
      if (aeronaveId) q = q.eq("aeronave_id", aeronaveId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Movimentacao[];
    },
  });

  const delMutation = useMutation({
    mutationFn: async (id: string) => {
      // remove espelhos de partner_transactions
      await (supabase as any)
        .from("partner_transactions")
        .delete()
        .eq("referencia_id", id)
        .eq("tipo_referencia", "movimentacao_rateio");
      await (supabase as any).from("rateio_despesas").delete().eq("despesa_id", id);
      const { error } = await (supabase as any).from("movimentacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento excluído");
      qc.invalidateQueries({ queryKey: ["movimentacoes-cotista"] });
      qc.invalidateQueries({ queryKey: ["financeiro-cotista-detalhe"] });
    },
    onError: (e: any) => toast.error("Erro ao excluir: " + e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Lançamentos de Custo</h2>
          <p className="text-xs text-muted-foreground">
            Custos fixos, variáveis e extras com rateio por cotista
            {aeronaveLabel ? ` — ${aeronaveLabel}` : ""}.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="gap-2"
          disabled={!aeronaveId}
        >
          <Plus className="h-4 w-4" /> Novo lançamento
        </Button>
      </div>

      <div className="border border-border rounded-xl bg-card/60 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !lancamentos?.length ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhum lançamento cadastrado.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Pagador</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancamentos.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {fmtDate(m.data_competencia)}
                  </TableCell>
                  <TableCell className="text-sm">{m.descricao}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {m.grupo_custo ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.fornecedor_nome ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmtBRL(m.valor)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        m.status === "pago"
                          ? "border-success/40 text-success text-[10px]"
                          : "border-amber-500/40 text-amber-400 text-[10px]"
                      }
                    >
                      {m.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => {
                          setEditing(m);
                          setOpen(true);
                        }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Excluir lançamento?")) delMutation.mutate(m.id);
                        }}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <LancamentoDialog
        open={open}
        onOpenChange={setOpen}
        clienteId={clienteId}
        aeronaveId={aeronaveId}
        socios={socios ?? []}
        editing={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["movimentacoes-cotista"] });
          qc.invalidateQueries({ queryKey: ["financeiro-cotista-detalhe"] });
        }}
      />
    </div>
  );
}

export function LancamentoDialog({
  open,
  onOpenChange,
  clienteId,
  aeronaveId,
  socios,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId: string;
  aeronaveId: string | null;
  socios: Socio[];
  editing: Movimentacao | null;
  onSaved: () => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [grupo, setGrupo] = useState<GrupoCusto>("FIXO");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [pagador, setPagador] = useState<string>("EMPRESA");
  const [status, setStatus] = useState<"pago" | "pendente">("pago");
  const [observacoes, setObservacoes] = useState("");
  const [rateios, setRateios] = useState<RateioInput[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDescricao(editing.descricao);
      setGrupo((editing.grupo_custo as GrupoCusto) ?? "FIXO");
      setValor(String(editing.valor));
      setData(editing.data_competencia);
      setStatus((editing.status as any) === "pago" ? "pago" : "pendente");
      setObservacoes(editing.observacoes ?? "");

      (async () => {
        const { data: rs } = await (supabase as any)
          .from("rateio_despesas")
          .select("socio_id, socios_nome, percentual_sociedade, valor_pago_real, pago_por")
          .eq("despesa_id", editing.id);

        const carregados: RateioInput[] = (rs ?? []).map((r: any) => {
          const s = socios.find((x) => x.id === r.socio_id);
          return {
            socio_id: r.socio_id,
            socio_nome: r.socios_nome ?? s?.nome ?? "",
            socio_cpf: s?.cpf ?? null,
            percentual: Number(r.percentual_sociedade ?? 0),
            valor_pago_real: Number(r.valor_pago_real ?? 0),
          };
        });

        if (carregados.length) {
          setRateios(carregados);
          // detectar pagador: primeiro com valor_pago_real > 0
          const pagou = (rs ?? []).find((r: any) => Number(r.valor_pago_real ?? 0) > 0);
          if (pagou) setPagador(pagou.socio_id);
          else setPagador("EMPRESA");
        } else {
          seedFromSocios();
          setPagador("EMPRESA");
        }
      })();
    } else {
      setDescricao("");
      setGrupo("FIXO");
      setValor("");
      setData(new Date().toISOString().slice(0, 10));
      setPagador("EMPRESA");
      setStatus("pago");
      setObservacoes("");
      seedFromSocios();
    }

    function seedFromSocios() {
      setRateios(
        socios.map((s) => ({
          socio_id: s.id,
          socio_nome: s.nome,
          socio_cpf: s.cpf,
          percentual: Number(s.percentual_participacao ?? 0),
          valor_pago_real: 0,
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, socios]);

  const valorNum = Number(valor.replace(",", ".")) || 0;
  const somaPct = useMemo(
    () => rateios.reduce((s, r) => s + (Number(r.percentual) || 0), 0),
    [rateios]
  );
  const somaPago = useMemo(
    () => rateios.reduce((s, r) => s + (Number(r.valor_pago_real) || 0), 0),
    [rateios]
  );
  const pctOk = Math.abs(somaPct - 100) < 0.01;
  const algumNeg = rateios.some((r) => Number(r.percentual) < 0);
  const pagoExcede = somaPago > valorNum + 0.01;

  // ajusta valor_pago_real conforme pagador
  useEffect(() => {
    setRateios((rs) =>
      rs.map((r) => ({
        ...r,
        valor_pago_real:
          pagador === r.socio_id ? valorNum : pagador === "EMPRESA" ? 0 : r.valor_pago_real,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagador, valor]);

  function setPct(idx: number, v: string) {
    const n = Number(v.replace(",", ".")) || 0;
    setRateios((rs) => rs.map((r, i) => (i === idx ? { ...r, percentual: n } : r)));
  }
  function setPago(idx: number, v: string) {
    const n = Number(v.replace(",", ".")) || 0;
    setRateios((rs) => rs.map((r, i) => (i === idx ? { ...r, valor_pago_real: n } : r)));
  }
  function distribuirIgualmente() {
    if (!rateios.length) return;
    const p = +(100 / rateios.length).toFixed(2);
    setRateios((rs) => rs.map((r) => ({ ...r, percentual: p })));
  }

  async function ensureCategoria(g: GrupoCusto, userId?: string): Promise<string> {
    const nome = `Rateio - ${g}`;
    const { data: existing } = await (supabase as any)
      .from("categorias_movimentacao")
      .select("id")
      .eq("nome", nome)
      .maybeSingle();
    if (existing?.id) return existing.id;
    const { data: created, error } = await (supabase as any)
      .from("categorias_movimentacao")
      .insert({
        nome,
        tipo: "despesa",
        grupo_categoria: g,
        ativo: true,
        criado_por: userId ?? "00000000-0000-0000-0000-000000000000",
      })
      .select("id")
      .single();
    if (error) throw error;
    return created.id;
  }

  async function refreshPartnerAccount(socioId: string, socioNome: string, socioCpf: string | null) {
    if (!socioCpf) return;
    // soma de transactions
    const { data: txs } = await (supabase as any)
      .from("partner_transactions")
      .select("tipo, valor")
      .eq("clientes_id", clienteId)
      .eq("socio_cpf", socioCpf);

    let totalDep = 0;
    let totalGasto = 0;
    (txs ?? []).forEach((t: any) => {
      const v = Number(t.valor) || 0;
      if (t.tipo === "deposit" || t.tipo === "credit") totalDep += v;
      else if (t.tipo === "debit" || t.tipo === "withdrawal") totalGasto += v;
    });
    const saldo = totalDep - totalGasto;

    const { data: existing } = await (supabase as any)
      .from("partner_accounts")
      .select("id")
      .eq("clientes_id", clienteId)
      .eq("socio_cpf", socioCpf)
      .maybeSingle();

    if (existing?.id) {
      await (supabase as any)
        .from("partner_accounts")
        .update({
          total_depositado: totalDep,
          total_gasto: totalGasto,
          saldo_atual: saldo,
        })
        .eq("id", existing.id);
    } else {
      await (supabase as any).from("partner_accounts").insert({
        clientes_id: clienteId,
        socio_cpf: socioCpf,
        socio_nome: socioNome,
        socios_cliente_id: socioId,
        total_depositado: totalDep,
        total_gasto: totalGasto,
        saldo_atual: saldo,
      });
    }
  }

  async function handleSave() {
    if (!descricao.trim()) return toast.error("Informe a descrição");
    if (valorNum <= 0) return toast.error("Valor deve ser maior que zero");
    if (!rateios.length) return toast.error("Cliente não tem cotistas cadastrados");
    if (algumNeg) return toast.error("Percentuais negativos não são permitidos");
    if (!pctOk)
      return toast.error(
        `Soma dos percentuais é ${somaPct.toFixed(2)}% (deve ser 100%)`
      );
    if (pagoExcede) return toast.error("Soma dos valores pagos excede o valor total");

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const pagadorSocio =
        pagador !== "EMPRESA" ? rateios.find((r) => r.socio_id === pagador) : null;

      const movPayload: any = {
        descricao: descricao.trim(),
        tipo: "despesa",
        grupo_custo: grupo,
        valor: valorNum,
        data_competencia: data,
        data_pagamento: status === "pago" ? data : null,
        clientes_id: clienteId,
        aeronave_id: aeronaveId,
        fornecedor_nome:
          pagador === "EMPRESA" ? "EMPRESA" : pagadorSocio?.socio_nome ?? null,
        status,
        observacoes: observacoes || null,
        reembolsavel: pagador !== "EMPRESA",
        reembolso_quitado: false,
        criado_por: user?.id ?? null,
        categoria_id: await ensureCategoria(grupo, user?.id),
      };

      let movId: string;
      if (editing) {
        const { error } = await (supabase as any)
          .from("movimentacoes")
          .update(movPayload)
          .eq("id", editing.id);
        if (error) throw error;
        movId = editing.id;
        await (supabase as any)
          .from("partner_transactions")
          .delete()
          .eq("referencia_id", movId)
          .eq("tipo_referencia", "movimentacao_rateio");
        await (supabase as any).from("rateio_despesas").delete().eq("despesa_id", movId);
      } else {
        const { data: ins, error } = await (supabase as any)
          .from("movimentacoes")
          .insert(movPayload)
          .select("id")
          .single();
        if (error) throw error;
        movId = ins.id;
      }

      // rateio_despesas
      const rateioRows = rateios.map((r) => ({
        despesa_id: movId,
        fonte_despesa: "movimentacoes",
        tipo_rateio: grupo,
        cliente_id: clienteId,
        clientes_nome: null,
        aeronave_id: aeronaveId,
        socio_id: r.socio_id,
        socios_nome: r.socio_nome,
        percentual_sociedade: r.percentual,
        valor_total_despesa: valorNum,
        valor_rateado: +((valorNum * r.percentual) / 100).toFixed(2),
        valor_pago_real: r.valor_pago_real,
        status,
        descricao_despesa: descricao,
        data_vencimento: data,
        data_pagamento: status === "pago" ? data : null,
        pago_por: pagador === "EMPRESA" ? "EMPRESA" : r.socio_nome,
        pago_diretamente: pagador !== "EMPRESA",
        fluxo: pagador === "EMPRESA" ? "empresa" : "direto",
      }));
      const { error: e2 } = await (supabase as any)
        .from("rateio_despesas")
        .insert(rateioRows);
      if (e2) throw e2;

      // espelho em partner_transactions (debit) por cotista — apenas quando pago
      if (status === "pago") {
        const debitRows = rateios
          .filter((r) => r.socio_cpf && r.percentual > 0)
          .map((r) => {
            const valorDebito = +((valorNum * r.percentual) / 100).toFixed(2);
            return {
              clientes_id: clienteId,
              socio_cpf: r.socio_cpf!,
              socio_nome: r.socio_nome,
              tipo: "debit",
              valor: valorDebito,
              saldo_antes: 0,
              saldo_depois: 0,
              descricao: `${descricao} (rateio ${r.percentual}%)`,
              tipo_referencia: "movimentacao_rateio",
              referencia_id: movId,
              data_pagamento: data,
              status: "confirmado",
              criado_por: user?.id ?? null,
            };
          });
        if (debitRows.length) {
          const { error: e3 } = await (supabase as any)
            .from("partner_transactions")
            .insert(debitRows);
          if (e3) throw e3;
        }
      }

      // SEMPRE recalcular partner_accounts dos cotistas afetados
      // (tanto quando status é "pago" quanto "pendente", para manter consistência)
      for (const r of rateios) {
        if (r.socio_cpf) {
          await refreshPartnerAccount(r.socio_id, r.socio_nome, r.socio_cpf);
        }
      }

      toast.success(editing ? "Lançamento atualizado" : "Lançamento criado");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro: " + (e.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Descrição</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Hangaragem outubro"
              />
            </div>
            <div>
              <Label>Grupo de custo</Label>
              <Select value={grupo} onValueChange={(v) => setGrupo(v as GrupoCusto)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRUPOS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      <div>
                        <div className="font-medium">{g.label}</div>
                        <div className="text-xs text-muted-foreground">{g.hint}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data competência</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label>Valor total (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Pagador</Label>
              <Select value={pagador} onValueChange={setPagador}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPRESA">Empresa (Share Brasil)</SelectItem>
                  {socios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-sm">Rateio por cotista</h3>
                <p className="text-xs text-muted-foreground">
                  Defina o % de cada cotista. A soma deve ser 100%.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={distribuirIgualmente}
              >
                Dividir igualmente
              </Button>
            </div>

            {!rateios.length ? (
              <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded">
                Cliente não tem cotistas cadastrados.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-2">
                  <div className="col-span-5">Cotista</div>
                  <div className="col-span-2 text-right">% Rateio</div>
                  <div className="col-span-2 text-right">Devido</div>
                  <div className="col-span-3 text-right">Pago real (R$)</div>
                </div>
                {rateios.map((r, idx) => {
                  const devido = +((valorNum * r.percentual) / 100).toFixed(2);
                  return (
                    <div
                      key={r.socio_id}
                      className="grid grid-cols-12 gap-2 items-center bg-muted/30 rounded p-2"
                    >
                      <div className="col-span-5 text-sm font-medium truncate">
                        {r.socio_nome}
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={r.percentual}
                          onChange={(e) => setPct(idx, e.target.value)}
                          className="h-8 text-right"
                        />
                      </div>
                      <div className="col-span-2 text-right text-sm tabular-nums">
                        {fmtBRL(devido)}
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="number"
                          step="0.01"
                          value={r.valor_pago_real}
                          onChange={(e) => setPago(idx, e.target.value)}
                          className="h-8 text-right"
                        />
                      </div>
                    </div>
                  );
                })}

                <div
                  className={`flex items-center justify-between mt-3 p-3 rounded-lg border text-sm ${
                    pctOk
                      ? "bg-success/10 border-success/30 text-success"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-500"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {pctOk ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <span>
                      Soma dos percentuais: <strong>{somaPct.toFixed(2)}%</strong>
                      {!pctOk && ` — falta ${(100 - somaPct).toFixed(2)}%`}
                    </span>
                  </div>
                  <div className="text-xs">
                    Total pago: <strong>{fmtBRL(somaPago)}</strong> / {fmtBRL(valorNum)}
                    {pagoExcede && (
                      <span className="ml-2 text-destructive">excede!</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !pctOk || pagoExcede || algumNeg || !aeronaveId}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editing ? "Salvar alterações" : "Criar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
