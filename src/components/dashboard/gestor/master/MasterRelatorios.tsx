// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight, ArrowLeft, ArrowUpRight, Download, FileBarChart, Loader2,
  Wallet, TrendingUp, TrendingDown, Undo2, Search, AlertTriangle,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";

interface Movimentacao {
  id: string;
  descricao: string;
  tipo: string;
  valor_rateado: number | string;
  data_competencia: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  clientes_id: string | null;
  status: string;
  tipo_caixa: string | null;
  fornecedor_nome: string | null;
  categoria_id?: string | null;
  categoria_nome?: string | null;
}

const isEntrada = (tipo: string) => ["entrada", "receita"].includes(String(tipo).toLowerCase());
const isPago = (mov: Movimentacao) => mov.status === "pago" || Boolean(mov.data_pagamento);
const isReembolso = (mov: Movimentacao) =>
  `${mov.descricao ?? ""} ${mov.categoria_nome ?? ""}`.toLowerCase().includes("reembols");
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
const formatDate = (value: string | null) =>
  value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "-";

export default function MasterRelatorios() {
  const navigate = useNavigate();
  const hoje = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [busca, setBusca] = useState("");
  const invalidDateRange = startDate > endDate;

  const { data, isLoading, error } = useQuery({
    queryKey: ["master-relatorios-movimentacoes", startDate, endDate],
    enabled: !invalidDateRange,
    queryFn: async () => {
      const [movRes, clientsRes] = await Promise.all([
        supabase
          .from("movimentacoes")
          .select("id, descricao, tipo, valor_rateado, data_competencia, data_vencimento, data_pagamento, clientes_id, status, tipo_caixa, fornecedor_nome, categoria_id, categoria_nome")
          .eq("tipo_caixa", "share")
          .gte("data_competencia", startDate)
          .lte("data_competencia", endDate)
          .neq("status", "cancelado")
          .order("data_competencia", { ascending: false }),
        supabase.from("clientes").select("id, razao_social, proprietario"),
      ]);
      if (movRes.error) throw movRes.error;
      if (clientsRes.error) throw clientsRes.error;
      return { movimentacoes: (movRes.data || []) as Movimentacao[], clientes: clientsRes.data || [] };
    },
  });

  const clientNames = useMemo(() => {
    const map = new Map<string, string>();
    (data?.clientes || []).forEach((c: any) =>
      map.set(c.id, c.razao_social || c.proprietario || "Cliente sem nome")
    );
    return map;
  }, [data?.clientes]);

  const analise = useMemo(() => {
    const movimentacoes = data?.movimentacoes || [];
    const entradas = movimentacoes.filter((m) => isEntrada(m.tipo));
    const saidas = movimentacoes.filter((m) => !isEntrada(m.tipo));
    const entradasPagas = entradas.filter(isPago).reduce((t, m) => t + Number(m.valor_rateado), 0);
    const saidasPagas = saidas.filter(isPago).reduce((t, m) => t + Number(m.valor_rateado), 0);

    type Row = { id: string; nome: string; receita: number; custo: number; reembolso: number; pendente: number; vencido: number; lancamentos: number };
    const porCliente = new Map<string, Row>();
    const get = (id: string) => {
      const row = porCliente.get(id) || {
        id, nome: clientNames.get(id) || "Cliente sem nome",
        receita: 0, custo: 0, reembolso: 0, pendente: 0, vencido: 0, lancamentos: 0,
      };
      porCliente.set(id, row);
      return row;
    };

    const hojeStr = format(new Date(), "yyyy-MM-dd");
    movimentacoes.forEach((m) => {
      if (!m.clientes_id) return;
      const row = get(m.clientes_id);
      const valor = Number(m.valor_rateado);
      row.lancamentos += 1;
      if (isEntrada(m.tipo)) {
        if (isPago(m)) row.receita += valor;
        else {
          row.pendente += valor;
          if (m.data_vencimento && m.data_vencimento < hojeStr) row.vencido += valor;
        }
      } else {
        if (isPago(m)) row.custo += valor;
        if (isReembolso(m)) row.reembolso += valor;
      }
    });

    const clientes = Array.from(porCliente.values()).map((r) => ({ ...r, lucro: r.receita - r.custo }));

    return {
      entradas: entradasPagas,
      saidas: saidasPagas,
      saldo: entradasPagas - saidasPagas,
      totalReembolso: clientes.reduce((t, c) => t + c.reembolso, 0),
      totalPendente: clientes.reduce((t, c) => t + c.pendente, 0),
      devedores: clientes.filter((c) => c.pendente > 0).sort((a, b) => b.pendente - a.pendente),
      maisLucrativos: [...clientes].sort((a, b) => b.lucro - a.lucro),
      menosLucrativos: [...clientes].sort((a, b) => a.lucro - b.lucro),
      reembolsos: clientes.filter((c) => c.reembolso > 0).sort((a, b) => b.reembolso - a.reembolso),
    };
  }, [data?.movimentacoes, clientNames]);

  const movimentacoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const rows = data?.movimentacoes || [];
    if (!termo) return rows;
    return rows.filter((m) =>
      [m.descricao, m.fornecedor_nome, m.status, clientNames.get(m.clientes_id || "")]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(termo))
    );
  }, [data?.movimentacoes, busca, clientNames]);

  const exportCsv = () => {
    const header = ["Data", "Descrição", "Tipo", "Cliente", "Vencimento", "Pagamento", "Status", "Valor"];
    const lines = movimentacoesFiltradas.map((m) =>
      [m.data_competencia, m.descricao, m.tipo, clientNames.get(m.clientes_id || "") || m.fornecedor_nome || "-",
        m.data_vencimento || "", m.data_pagamento || "", m.status, Number(m.valor_rateado).toFixed(2)]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_share_${startDate}_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado com sucesso.");
  };

  const grafico = analise.maisLucrativos.slice(0, 8).map((c) => ({ nome: c.nome.slice(0, 14), lucro: c.lucro }));

  return (
    <Layout>
      <div className="w-full max-w-full min-w-0 space-y-6 pb-8 overflow-x-hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="rounded-lg bg-primary/10 p-2 shrink-0"><FileBarChart className="h-6 w-6 text-primary" /></div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Relatórios Financeiros</h1>
              <p className="text-sm text-muted-foreground truncate">Caixa Share — lucratividade, inadimplência e reembolsos</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="rel-de" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">De</label>
              <Input id="rel-de" type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="rel-ate" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Até</label>
              <Input id="rel-ate" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label htmlFor="rel-busca" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="rel-busca" placeholder="Cliente, descrição, status..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
              </div>
            </div>
            <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Exportar</Button>
          </div>
        </div>

        {invalidDateRange && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            A data inicial deve ser anterior ou igual à data final.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Não foi possível carregar as movimentações da Share.
          </div>
        )}

        {isLoading && !invalidDateRange ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard title="Entrou no caixa" value={analise.entradas} icon={<ArrowUpRight className="h-5 w-5" />} />
              <SummaryCard title="Saiu do caixa" value={analise.saidas} icon={<ArrowDownRight className="h-5 w-5" />} />
              <SummaryCard title="Saldo do período" value={analise.saldo} icon={<Wallet className="h-5 w-5" />} />
              <SummaryCard title="A receber" value={analise.totalPendente} icon={<AlertTriangle className="h-5 w-5" />} />
              <SummaryCard title="Reembolsos pagos" value={analise.totalReembolso} icon={<Undo2 className="h-5 w-5" />} />
            </div>

            <Card className="min-w-0">
              <CardHeader><CardTitle className="text-base">Lucro por cliente (top 8)</CardTitle></CardHeader>
              <CardContent className="min-w-0">
                {grafico.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Sem dados no período selecionado.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={grafico}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="lucro" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="devedores" className="w-full min-w-0">
              <TabsList className="flex w-full flex-wrap justify-start gap-1 h-auto">
                <TabsTrigger value="devedores">Devedores</TabsTrigger>
                <TabsTrigger value="lucrativos">Mais lucrativos</TabsTrigger>
                <TabsTrigger value="menos">Menos lucrativos</TabsTrigger>
                <TabsTrigger value="reembolsos">Reembolsos</TabsTrigger>
                <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
              </TabsList>

              <TabsContent value="devedores">
                <RankingTable
                  title="Clientes com valores pendentes"
                  rows={analise.devedores}
                  columns={[
                    { label: "Lançamentos", render: (r) => r.lancamentos },
                    { label: "Vencido", render: (r) => <span className="text-destructive">{formatCurrency(r.vencido)}</span> },
                    { label: "Total devido", align: "right", render: (r) => <span className="font-semibold text-amber-400">{formatCurrency(r.pendente)}</span> },
                  ]}
                />
              </TabsContent>

              <TabsContent value="lucrativos">
                <RankingTable
                  title="Clientes que mais dão lucro"
                  icon={<TrendingUp className="h-4 w-4 text-primary" />}
                  rows={analise.maisLucrativos.slice(0, 15)}
                  columns={[
                    { label: "Receita", render: (r) => <span className="text-primary">{formatCurrency(r.receita)}</span> },
                    { label: "Custo", render: (r) => <span className="text-primary">{formatCurrency(r.custo)}</span> },
                    { label: "Lucro", align: "right", render: (r) => <span className={`font-semibold ${r.lucro >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(r.lucro)}</span> },
                  ]}
                />
              </TabsContent>

              <TabsContent value="menos">
                <RankingTable
                  title="Clientes que menos dão lucro"
                  icon={<TrendingDown className="h-4 w-4 text-primary" />}
                  rows={analise.menosLucrativos.slice(0, 15)}
                  columns={[
                    { label: "Receita", render: (r) => <span className="text-primary">{formatCurrency(r.receita)}</span> },
                    { label: "Custo", render: (r) => <span className="text-primary">{formatCurrency(r.custo)}</span> },
                    { label: "Lucro", align: "right", render: (r) => <span className={`font-semibold ${r.lucro >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(r.lucro)}</span> },
                  ]}
                />
              </TabsContent>

              <TabsContent value="reembolsos">
                <RankingTable
                  title="Clientes com mais reembolsos pagos pela Share"
                  icon={<Undo2 className="h-4 w-4 text-primary" />}
                  rows={analise.reembolsos}
                  columns={[
                    { label: "Lançamentos", render: (r) => r.lancamentos },
                    { label: "Total reembolsado", align: "right", render: (r) => <span className="font-semibold text-primary">{formatCurrency(r.reembolso)}</span> },
                  ]}
                />
              </TabsContent>

              <TabsContent value="movimentacoes">
                <Card className="min-w-0">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Movimentações de {formatDate(startDate)} até {formatDate(endDate)} ({movimentacoesFiltradas.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                            <th className="px-3 py-3">Data</th>
                            <th className="px-3 py-3">Descrição</th>
                            <th className="px-3 py-3">Cliente</th>
                            <th className="px-3 py-3">Status</th>
                            <th className="px-3 py-3 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movimentacoesFiltradas.map((m) => (
                            <tr key={m.id} className="border-b border-border/50">
                              <td className="px-3 py-3">{formatDate(m.data_competencia)}</td>
                              <td className="px-3 py-3">{m.descricao}</td>
                              <td className="px-3 py-3">{clientNames.get(m.clientes_id || "") || m.fornecedor_nome || "-"}</td>
                              <td className="px-3 py-3">{m.status}</td>
                              <td className="px-3 py-3 text-right font-semibold text-primary">
                                {isEntrada(m.tipo) ? "+" : "-"}{formatCurrency(Number(m.valor_rateado))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Layout>
  );
}

function RankingTable({ title, rows, columns, icon }: any) {
  return (
    <Card className="min-w-0">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhum dado no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-3">Cliente</th>
                  {columns.map((c: any) => (
                    <th key={c.label} className={`px-3 py-3 ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="px-3 py-3 font-medium">{r.nome}</td>
                    {columns.map((c: any) => (
                      <td key={c.label} className={`px-3 py-3 ${c.align === "right" ? "text-right" : "text-muted-foreground"}`}>{c.render(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="min-w-0 border-primary/30 text-primary">
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground truncate">{title}</p>
          <p className="mt-2 text-xl font-bold truncate">{formatCurrency(value)}</p>
        </div>
        <div className="rounded-lg bg-current/10 p-3 shrink-0">{icon}</div>
      </CardContent>
    </Card>
  );
}