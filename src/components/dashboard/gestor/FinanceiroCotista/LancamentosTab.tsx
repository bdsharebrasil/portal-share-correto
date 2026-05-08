import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCotistaReembolsoMirror } from "@/lib/cotistaFinanceSync";

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
  const navigate = useNavigate();

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
        .eq("reference_type", "rateio_despesa")
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
      // remove espelhos
      await deleteCotistaReembolsoMirror(id);
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

  const goNovo = () => {
    if (!aeronaveId) return;
    navigate(`/financeiro/lancamento/${clienteId}/${aeronaveId}`);
  };
  const goEdit = (m: Movimentacao) => {
    if (!m.aeronave_id) return;
    navigate(`/financeiro/lancamento/${clienteId}/${m.aeronave_id}?editing=${m.id}`);
  };

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
        <Button onClick={goNovo} className="gap-2" disabled={!aeronaveId}>
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
                        onClick={() => goEdit(m)}
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
    </div>
  );
}

// Backward-compat: alguns lugares importavam LancamentoDialog daqui.
// O formulário agora vive em LancamentoFormInline. Re-export evita quebra.
export { LancamentoFormInline as LancamentoDialog } from "./LancamentoFormInline";
