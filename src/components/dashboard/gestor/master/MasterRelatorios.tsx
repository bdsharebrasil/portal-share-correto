import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Download, FileBarChart, Loader2, Wallet } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";

interface Movimentacao {
  id: string;
  descricao: string;
  tipo: string;
  valor: number | string;
  data_competencia: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  clientes_id: string | null;
  status: string;
  tipo_caixa: string | null;
  fornecedor_nome: string | null;
}

interface Cliente {
  id: string;
  razao_social: string | null;
  proprietario: string | null;
}

const isEntrada = (tipo: string) => ["entrada", "receita"].includes(tipo.toLowerCase());
const isPago = (mov: Movimentacao) => mov.status === "pago" || Boolean(mov.data_pagamento);
const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const formatDate = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "-";

export default function MasterRelatorios() {
  const navigate = useNavigate();
  const currentMonth = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(currentMonth), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(currentMonth), "yyyy-MM-dd"));
  const [isExporting, setIsExporting] = useState(false);
  const invalidDateRange = startDate > endDate;

  const { data, isLoading, error } = useQuery({
    queryKey: ["master-relatorios-movimentacoes", startDate, endDate],
    enabled: !invalidDateRange,
    queryFn: async () => {
      const [movRes, clientsRes] = await Promise.all([
        supabase
          .from("movimentacoes")
          .select("id, descricao, tipo, valor, data_competencia, data_vencimento, data_pagamento, clientes_id, status, tipo_caixa, fornecedor_nome")
          .eq("tipo_caixa", "share")
          .gte("data_competencia", startDate)
          .lte("data_competencia", endDate)
          .neq("status", "cancelado")
          .order("data_competencia", { ascending: false }),
        supabase.from("clientes").select("id, razao_social, proprietario"),
      ]);

      if (movRes.error) throw movRes.error;
      if (clientsRes.error) throw clientsRes.error;
      return { movimentacoes: (movRes.data || []) as Movimentacao[], clientes: (clientsRes.data || []) as Cliente[] };
    },
  });

  const clientNames = useMemo(() => {
    const map = new Map<string, string>();
    (data?.clientes || []).forEach((cliente) => map.set(cliente.id, cliente.razao_social || cliente.proprietario || "Cliente sem nome"));
    return map;
  }, [data?.clientes]);

  const resumo = useMemo(() => {
    const movimentacoes = data?.movimentacoes || [];
    const entradas = movimentacoes.filter((mov) => isEntrada(mov.tipo));
    const saidas = movimentacoes.filter((mov) => !isEntrada(mov.tipo));
    const entradasPagas = entradas.filter(isPago).reduce((total, mov) => total + Number(mov.valor), 0);
    const saidasPagas = saidas.filter(isPago).reduce((total, mov) => total + Number(mov.valor), 0);

    const devedoresMap = new Map<string, { nome: string; total: number; quantidade: number; vencido: number }>();
    entradas
      .filter((mov) => !isPago(mov) && mov.clientes_id)
      .forEach((mov) => {
        const id = mov.clientes_id as string;
        const atual = devedoresMap.get(id) || { nome: clientNames.get(id) || "Cliente sem nome", total: 0, quantidade: 0, vencido: 0 };
        atual.total += Number(mov.valor);
        atual.quantidade += 1;
        if (mov.data_vencimento && mov.data_vencimento < format(new Date(), "yyyy-MM-dd")) atual.vencido += Number(mov.valor);
        devedoresMap.set(id, atual);
      });

    return {
      entradas: entradasPagas,
      saidas: saidasPagas,
      saldo: entradasPagas - saidasPagas,
      pendente: Array.from(devedoresMap.values()).reduce((total, cliente) => total + cliente.total, 0),
      devedores: Array.from(devedoresMap.values()).sort((a, b) => b.total - a.total),
    };
  }, [data?.movimentacoes, clientNames]);

  const exportCsv = () => {
    const rows = data?.movimentacoes || [];
    const header = ["Data", "Descrição", "Tipo", "Cliente", "Vencimento", "Pagamento", "Status", "Valor"];
    const lines = rows.map((mov) => [
      mov.data_competencia,
      mov.descricao,
      mov.tipo,
      clientNames.get(mov.clientes_id || "") || mov.fornecedor_nome || "-",
      mov.data_vencimento || "",
      mov.data_pagamento || "",
      mov.status,
      Number(mov.valor).toFixed(2),
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_movimentacoes_share_${startDate}_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado com sucesso.");
  };

  return (
    <Layout>
      <div className="space-y-6 pb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar para a página anterior" title="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="rounded-lg bg-primary/10 p-2"><FileBarChart className="h-6 w-6 text-primary" /></div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Relatórios Financeiros</h1>
              <p className="text-sm text-muted-foreground">Caixa Share baseado em movimentações</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="master-relatorio-data-inicial" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">De</label>
              <Input id="master-relatorio-data-inicial" type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="master-relatorio-data-final" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Até</label>
              <Input id="master-relatorio-data-final" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="w-40" />
            </div>
            
          </div>
        </div>

        {invalidDateRange && <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">A data inicial deve ser anterior ou igual à data final.</div>}
        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Não foi possível carregar as movimentações da Share.</div>}
        {isLoading && !invalidDateRange ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SummaryCard title="Entrou no caixa Share" value={resumo.entradas} icon={<ArrowUpRight className="h-5 w-5" />} tone="success" />
              <SummaryCard title="Saiu do caixa Share" value={resumo.saidas} icon={<ArrowDownRight className="h-5 w-5" />} tone="danger" />
              <SummaryCard title="Saldo do período" value={resumo.saldo} icon={<Wallet className="h-5 w-5" />} tone={resumo.saldo >= 0 ? "primary" : "danger"} />
            </div>

            <Card>
              <CardHeader><CardTitle>Clientes com valores pendentes</CardTitle></CardHeader>
              <CardContent>
                {resumo.devedores.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum cliente com valor pendente no período.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-3">Cliente</th><th className="px-3 py-3">Lançamentos</th><th className="px-3 py-3">Vencido</th><th className="px-3 py-3 text-right">Total devido</th></tr></thead>
                      <tbody>{resumo.devedores.map((cliente) => <tr key={cliente.nome} className="border-b border-border/50"><td className="px-3 py-3 font-medium">{cliente.nome}</td><td className="px-3 py-3 text-muted-foreground">{cliente.quantidade}</td><td className="px-3 py-3 text-destructive">{formatCurrency(cliente.vencido)}</td><td className="px-3 py-3 text-right font-semibold text-amber-400">{formatCurrency(cliente.total)}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Movimentações da Share de {formatDate(startDate)} até {formatDate(endDate)}</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-3">Data</th><th className="px-3 py-3">Descrição</th><th className="px-3 py-3">Cliente</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Valor</th></tr></thead><tbody>{(data?.movimentacoes || []).map((mov) => <tr key={mov.id} className="border-b border-border/50"><td className="px-3 py-3">{formatDate(mov.data_competencia)}</td><td className="px-3 py-3">{mov.descricao}</td><td className="px-3 py-3">{clientNames.get(mov.clientes_id || "") || mov.fornecedor_nome || "-"}</td><td className="px-3 py-3">{mov.status}</td><td className={`px-3 py-3 text-right font-semibold ${isEntrada(mov.tipo) ? "text-emerald-400" : "text-destructive"}`}>{isEntrada(mov.tipo) ? "+" : "-"}{formatCurrency(Number(mov.valor))}</td></tr>)}</tbody></table></div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}

function SummaryCard({ title, value, icon, tone }: { title: string; value: number; icon: React.ReactNode; tone: "success" | "danger" | "primary" }) {
  const styles = { success: "border-emerald-500/30 text-emerald-400", danger: "border-destructive/30 text-destructive", primary: "border-primary/30 text-primary" };
  return <Card className={styles[tone]}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-bold">{formatCurrency(value)}</p></div><div className="rounded-lg bg-current/10 p-3">{icon}</div></CardContent></Card>;
}
