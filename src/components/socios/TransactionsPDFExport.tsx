import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { FileDown, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import type { PartnerTransaction } from "@/hooks/useFinanceiroSocios";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const COLORS = ["#10b981", "#f43f5e", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899"];

interface PDFExportProps {
  transactions: PartnerTransaction[];
  clienteName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterPartner: string;
  filterType: string;
  filterMonth: string;
}

export function TransactionsPDFExport({
  transactions,
  clienteName,
  open,
  onOpenChange,
  filterPartner,
  filterType,
  filterMonth,
}: PDFExportProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  // Data calculations
  const totalDeposits = transactions
    .filter((t) => t.transaction_type === "deposit")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions
    .filter((t) => t.transaction_type !== "deposit")
    .reduce((s, t) => s + Number(t.amount), 0);
  const netResult = totalDeposits - totalExpenses;

  // Data by partner (pie chart)
  const byPartner = transactions.reduce((acc: Record<string, { deposits: number; expenses: number }>, tx) => {
    const name = tx.partner_name || "Geral";
    if (!acc[name]) acc[name] = { deposits: 0, expenses: 0 };
    if (tx.transaction_type === "deposit") acc[name].deposits += Number(tx.amount);
    else acc[name].expenses += Number(tx.amount);
    return acc;
  }, {});

  const pieData = Object.entries(byPartner).map(([name, data]) => ({
    name,
    value: data.deposits + data.expenses,
  }));

  // Monthly data (bar chart)
  const monthlyData = transactions.reduce((acc: Record<string, { name: string; entradas: number; saidas: number }>, tx) => {
    const date = (tx as any).payment_date || tx.created_at;
    const month = format(new Date(date.includes?.("T") ? date : date + "T12:00:00"), "MMM/yy", { locale: ptBR });
    if (!acc[month]) acc[month] = { name: month, entradas: 0, saidas: 0 };
    if (tx.transaction_type === "deposit") acc[month].entradas += Number(tx.amount);
    else acc[month].saidas += Number(tx.amount);
    return acc;
  }, {});

  const barData = Object.values(monthlyData);

  // Category data (horizontal bar)
  const categoryData = transactions
    .filter((t) => t.transaction_type !== "deposit")
    .reduce((acc: Record<string, number>, tx: any) => {
      const cat = tx.expense_type || tx.transaction_type || "Outros";
      acc[cat] = (acc[cat] || 0) + Number(tx.amount);
      return acc;
    }, {});

  const catBarData = Object.entries(categoryData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const filterLabel = [
    filterPartner !== "all" ? `Sócio: ${filterPartner}` : null,
    filterType !== "all" ? `Tipo: ${filterType}` : null,
    filterMonth !== "all" ? `Mês: ${format(new Date(filterMonth + "-01"), "MMMM yyyy", { locale: ptBR })}` : null,
  ]
    .filter(Boolean)
    .join(" • ") || "Todos os dados";

  const handleExportPDF = async () => {
    if (!reportRef.current) return;

    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      backgroundColor: "#1a1a2e",
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    if (pdfHeight > pdf.internal.pageSize.getHeight()) {
      // Multi-page
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();
      while (position < pdfHeight) {
        if (position > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -position, pdfWidth, pdfHeight);
        position += pageHeight;
      }
    } else {
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    }

    pdf.save(`relatorio-financeiro-${clienteName}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Pré-visualização do Relatório PDF
          </DialogTitle>
        </DialogHeader>

        {/* Report content for PDF */}
        <div ref={reportRef} className="p-6 space-y-6 bg-background rounded-lg">
          {/* Header */}
          <div className="text-center border-b border-border/50 pb-4">
            <h1 className="text-2xl font-bold text-foreground">Relatório Financeiro</h1>
            <p className="text-muted-foreground">{clienteName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {filterLabel} • Gerado em {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1">
                <TrendingUp className="h-3 w-3" />
                TOTAL ENTRADAS
              </div>
              <p className="text-xl font-bold text-foreground">{fmt(totalDeposits)}</p>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <div className="flex items-center gap-2 text-red-400 text-xs font-semibold mb-1">
                <TrendingDown className="h-3 w-3" />
                TOTAL SAÍDAS
              </div>
              <p className="text-xl font-bold text-foreground">{fmt(totalExpenses)}</p>
            </div>
            <div className={`rounded-lg border p-4 ${netResult >= 0 ? "border-primary/30 bg-primary/10" : "border-red-500/30 bg-red-500/10"}`}>
              <div className="flex items-center gap-2 text-xs font-semibold mb-1 text-primary">
                <DollarSign className="h-3 w-3" />
                RESULTADO
              </div>
              <p className="text-xl font-bold text-foreground">{fmt(netResult)}</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Monthly Bar Chart */}
            {barData.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Entradas vs Saídas por Mês</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                        <Tooltip
                          cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                          formatter={(value: number) => fmt(value)}
                          contentStyle={{ borderRadius: "8px", border: "none", backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                        />
                        <Legend />
                        <Bar name="Entradas" dataKey="entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={35} />
                        <Bar name="Saídas" dataKey="saidas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={35} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Partner Pie Chart */}
            {pieData.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Distribuição por Sócio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => fmt(value)}
                          contentStyle={{ borderRadius: "8px", border: "none", backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                        />
                        <Legend verticalAlign="bottom" height={30} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Category Breakdown */}
          {catBarData.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Saídas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={catBarData} layout="vertical" margin={{ left: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                        formatter={(value: number) => fmt(value)}
                        contentStyle={{ borderRadius: "8px", border: "none", backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                      />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transactions Table */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Detalhamento de Transações ({transactions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 font-semibold text-muted-foreground">Data</th>
                      <th className="text-left py-2 font-semibold text-muted-foreground">Sócio</th>
                      <th className="text-left py-2 font-semibold text-muted-foreground">Descrição</th>
                      <th className="text-left py-2 font-semibold text-muted-foreground">Tipo</th>
                      <th className="text-right py-2 font-semibold text-muted-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 50).map((tx: any) => {
                      const date = tx.payment_date || tx.created_at;
                      return (
                        <tr key={tx.id} className="border-b border-border/30">
                          <td className="py-1.5 text-muted-foreground">
                            {format(new Date(date.includes?.("T") ? date : date + "T12:00:00"), "dd/MM/yyyy")}
                          </td>
                          <td className="py-1.5">{tx.partner_name}</td>
                          <td className="py-1.5 max-w-[200px] truncate">{tx.description}</td>
                          <td className="py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              tx.transaction_type === "deposit"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-red-500/20 text-red-400"
                            }`}>
                              {tx.transaction_type === "deposit" ? "Entrada" : "Saída"}
                            </span>
                          </td>
                          <td className={`py-1.5 text-right font-semibold ${
                            tx.transaction_type === "deposit" ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {tx.transaction_type === "deposit" ? "+" : "-"}{fmt(Number(tx.amount))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-bold">
                      <td colSpan={4} className="py-2">Resultado Final</td>
                      <td className={`py-2 text-right ${netResult >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {fmt(netResult)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleExportPDF} className="gap-2">
            <FileDown className="h-4 w-4" />
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
