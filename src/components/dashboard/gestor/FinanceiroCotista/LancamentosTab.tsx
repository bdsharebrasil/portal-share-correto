import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  LancamentoFormFields,
  validateLancamento,
  type LancamentoState,
  type Socio,
  type GrupoCusto,
  type RateioInput,
} from "./LancamentoFormFields";

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
  reembolsavel?: boolean;
  numero_doc?: string | null;
  comprovante_url?: string | null;
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (s?: string | null) =>
  s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—";

interface LancamentosTabProps {
  clienteId: string;
  aeronaveId: string | null;
  aeronaveLabel?: string;
  clienteNome?: string;
}

export function LancamentosTab({ clienteId, aeronaveId, aeronaveLabel, clienteNome }: LancamentosTabProps) {
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
          "id, descricao, tipo, grupo_custo, valor, data_competencia, data_pagamento, fornecedor_nome, status, observacoes, aeronave_id, clientes_id, reembolsavel, numero_doc, comprovante_url"
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
                <TableHead>Doc</TableHead>
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
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1.5">
                      {m.descricao}
                      {m.comprovante_url && (
                        <a href={m.comprovante_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-3 w-3 text-primary" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {m.grupo_custo ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.fornecedor_nome ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.numero_doc ?? "—"}
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
        clienteNome={clienteNome}
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

// =====================================================
// Lógica de salvamento compartilhada
// =====================================================

async function ensureCategoria(g: GrupoCusto, tipo: string, userId?: string): Promise<string> {
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
      tipo,
      grupo_categoria: g,
      ativo: true,
      criado_por: userId ?? "00000000-0000-0000-0000-000000000000",
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

async function refreshPartnerAccount(
  clienteId: string,
  socioId: string,
  socioNome: string,
  socioCpf: string | null
) {
  if (!socioCpf) return;
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

export async function saveLancamento(params: {
  state: LancamentoState;
  clienteId: string;
  clienteNome?: string;
  aeronaveId: string | null;
  editingId?: string;
}): Promise<void> {
  const { state, clienteId, clienteNome, aeronaveId, editingId } = params;
  const valorNum = Number(state.valor.replace(",", ".")) || 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Resolver nome do pagador
  let pagadorNome = "EMPRESA";
  let socioPagador: RateioInput | null = null;
  if (state.pagador === "EMPRESA") {
    pagadorNome = "EMPRESA";
  } else if (state.pagador === "CLIENTE_ATUAL") {
    pagadorNome = clienteNome || "Cliente";
  } else {
    socioPagador = state.rateios.find((r) => r.socio_id === state.pagador) || null;
    if (socioPagador) {
      pagadorNome = socioPagador.socio_nome;
    } else {
      // Pode ser outro cotista — buscar nome
      const { data: outro } = await (supabase as any)
        .from("clientes")
        .select("razao_social, proprietario")
        .eq("id", state.pagador)
        .maybeSingle();
      if (outro) pagadorNome = outro.razao_social || outro.proprietario || "Cotista";
    }
  }

  const movPayload: any = {
    descricao: state.descricao.trim(),
    tipo: state.tipo,
    grupo_custo: state.grupo,
    valor: valorNum,
    data_competencia: state.data,
    data_pagamento: state.status === "pago" ? state.data : null,
    clientes_id: clienteId,
    aeronave_id: aeronaveId,
    fornecedor_nome: pagadorNome,
    status: state.status,
    observacoes: state.observacoes || null,
    reembolsavel: state.reembolsavel,
    reembolso_quitado: false,
    criado_por: user?.id ?? null,
    categoria_id: await ensureCategoria(state.grupo, state.tipo, user?.id),
    numero_doc: state.numeroDocumento || null,
    comprovante_url: state.anexoUrl || null,
  };

  let movId: string;
  if (editingId) {
    const { error } = await (supabase as any)
      .from("movimentacoes")
      .update(movPayload)
      .eq("id", editingId);
    if (error) throw error;
    movId = editingId;
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

  // rateio_despesas (apenas se houver sócios)
  if (state.rateios.length > 0) {
    const rateioRows = state.rateios.map((r) => ({
      despesa_id: movId,
      fonte_despesa: "movimentacoes",
      tipo_rateio: state.grupo,
      cliente_id: clienteId,
      clientes_nome: clienteNome ?? null,
      aeronave_id: aeronaveId,
      socio_id: r.socio_id,
      socios_nome: r.socio_nome,
      percentual_sociedade: r.percentual,
      valor_total_despesa: valorNum,
      valor_rateado: +((valorNum * r.percentual) / 100).toFixed(2),
      valor_pago_real: r.valor_pago_real,
      status: state.status,
      descricao_despesa: state.descricao,
      data_vencimento: state.data,
      data_pagamento: state.status === "pago" ? state.data : null,
      pago_por: pagadorNome,
      pago_diretamente: state.pagador !== "EMPRESA",
      fluxo: state.pagador === "EMPRESA" ? "empresa" : "direto",
    }));
    const { error: e2 } = await (supabase as any)
      .from("rateio_despesas")
      .insert(rateioRows);
    if (e2) throw e2;

    // espelho em partner_transactions (debit) por cotista — apenas quando pago
    if (state.status === "pago") {
      const debitRows = state.rateios
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
            descricao: `${state.descricao} (rateio ${r.percentual}%)`,
            tipo_referencia: "movimentacao_rateio",
            referencia_id: movId,
            data_pagamento: state.data,
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

    for (const r of state.rateios) {
      if (r.socio_cpf) {
        await refreshPartnerAccount(clienteId, r.socio_id, r.socio_nome, r.socio_cpf);
      }
    }
  }
}

// =====================================================
// Dialog (mantido para uso embarcado)
// =====================================================

function emptyState(socios: Socio[]): LancamentoState {
  return {
    descricao: "",
    tipo: "despesa",
    grupo: "FIXO",
    valor: "",
    data: new Date().toISOString().slice(0, 10),
    pagador: "EMPRESA",
    status: "pago",
    observacoes: "",
    rateios: socios.map((s) => ({
      socio_id: s.id,
      socio_nome: s.nome,
      socio_cpf: s.cpf,
      percentual: Number(s.percentual_participacao ?? 0),
      valor_pago_real: 0,
    })),
    reembolsavel: false,
    anexoUrl: "",
    numeroDocumento: "",
  };
}

export function LancamentoDialog({
  open,
  onOpenChange,
  clienteId,
  clienteNome,
  aeronaveId,
  socios,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId: string;
  clienteNome?: string;
  aeronaveId: string | null;
  socios: Socio[];
  editing: Movimentacao | null;
  onSaved: () => void;
}) {
  const [state, setState] = useState<LancamentoState>(() => emptyState(socios));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
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

        const pagou = (rs ?? []).find((r: any) => Number(r.valor_pago_real ?? 0) > 0);
        const pagador = pagou ? pagou.socio_id : "EMPRESA";

        setState({
          descricao: editing.descricao,
          tipo: (editing.tipo as any) ?? "despesa",
          grupo: (editing.grupo_custo as GrupoCusto) ?? "FIXO",
          valor: String(editing.valor),
          data: editing.data_competencia,
          pagador,
          status: (editing.status as any) === "pago" ? "pago" : "pendente",
          observacoes: editing.observacoes ?? "",
          rateios: carregados.length ? carregados : emptyState(socios).rateios,
          reembolsavel: !!editing.reembolsavel,
          anexoUrl: editing.comprovante_url ?? "",
          numeroDocumento: editing.numero_doc ?? "",
        });
      })();
    } else {
      setState(emptyState(socios));
    }
  }, [open, editing, socios]);

  async function handleSave() {
    const err = validateLancamento(state);
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      await saveLancamento({
        state,
        clienteId,
        clienteNome,
        aeronaveId,
        editingId: editing?.id,
      });
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>

        <LancamentoFormFields
          state={state}
          setState={setState}
          socios={socios}
          clienteId={clienteId}
          clienteNome={clienteNome}
          aeronaveId={aeronaveId}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !aeronaveId}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editing ? "Salvar alterações" : "Criar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
