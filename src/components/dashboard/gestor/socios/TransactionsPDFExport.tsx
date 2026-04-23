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
import autoTable from "jspdf-autotable"; // O segredo para planilhas perfeitas!

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
  
  // Cálculos de Resumo
  const totalDeposits = transactions
    .filter((t) => t.transaction_type === "deposit")
    .reduce((s, t) => s + Number(t.valor), 0);
  const totalExpenses = transactions
    .filter((t) => t.transaction_type !== "deposit")
    .reduce((s, t) => s + Number(t.valor), 0);
  const netResult = totalDeposits - totalExpenses;

  // Filtros em texto
  const filterLabel = [
    filterPartner !== "all" ? `Sócio: ${filterPartner}` : null,
    filterType !== "all" ? `Tipo: ${filterType}` : null,
    filterMonth !== "all" ? `Mês: ${format(new Date(filterMonth + "-01"), "MMMM yyyy", { locale: ptBR })}` : null,
  ].filter(Boolean).join(" • ") || "Todos os dados";

  // DADOS DOS GRÁFICOS (mantidos para a pré-visualização na tela)
  const byPartner = transactions.reduce((acc: Record<string, { deposits: number; expenses: number }>, tx) => {
    const name = tx.nome_socio || "Geral";
    if (!acc[name]) acc[name] = { deposits: 0, expenses: 0 };
    if (tx.transaction_type === "deposit") acc[name].deposits += Number(tx.valor);
    else acc[name].expenses += Number(tx.valor);
    return acc;
  }, {});

  const pieData = Object.entries(byPartner).map(([name, data]) => ({
    name,
    value: data.deposits + data.expenses,
  }));

  // === A MÁGICA DO PDF REAL ===
  const handleExportProperPDF = () => {
    const doc = new jsPDF("p", "pt", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. Cabeçalho do Relatório
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório Financeiro de Sócios", pageWidth / 2, 40, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(clienteName, pageWidth / 2, 60, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`${filterLabel} • Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, 75, { align: "center" });

    // 2. Resumo Financeiro (KPIs)
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`Total de Entradas: ${fmt(totalDeposits)}`, 40, 110);
    doc.text(`Total de Saídas: ${fmt(totalExpenses)}`, 40, 125);
    
    doc.setFont("helvetica", "bold");
    const resultText = `Resultado Líquido: ${fmt(netResult)}`;
    // Cor condicional para o resultado
    if (netResult >= 0) doc.setTextColor(16, 185, 129); // Verde
    else doc.setTextColor(244, 63, 94); // Vermelho
    doc.text(resultText, 40, 140);

    // Resetar cor
    doc.setTextColor(0);

    // 3. Preparar dados da Tabela
    const tableColumn = ["Data", "Sócio", "Descrição", "Tipo", "Valor"];
    const tableRows = transactions.map((tx: any) => {
      const date = tx.payment_date || tx.criado_em;
      const formattedDate = format(new Date(date.includes?.("T") ? date : date + "T12:00:00"), "dd/MM/yyyy");
      const isDeposit = tx.transaction_type === "deposit";
      
      return [
        formattedDate,
        tx.nome_socio || "-",
        tx.descricao || "-",
        isDeposit ? "Entrada" : "Saída",
        `${isDeposit ? "+" : "-"}${fmt(Number(tx.valor))}`
      ];
    });

    // 4. Gerar a Tabela Paginada
    autoTable(doc, {
      startY: 160,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9, cellPadding: 5 },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' } // Alinha valores à direita
      },
      didParseCell: function(data) {
        // Colore os valores de Entrada de verde e Saída de vermelho na coluna 4 (Valor)
        if (data.section === 'body' && data.column.index === 4) {
          const rowData = transactions[data.row.index];
          if (rowData && rowData.transaction_type === 'deposit') {
            data.cell.styles.textColor = [16, 185, 129]; // Verde
          } else {
            data.cell.styles.textColor = [244, 63, 94]; // Vermelho
          }
        }
      }
    });

    // 5. Salvar o arquivo
    doc.save(`relatorio-financeiro-${clienteName.replace(/\s+/g, '-')}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Pré-visualização e Exportação
          </DialogTitle>
        </DialogHeader>

        {/* Conteúdo Visual do Modal (Dashboards e Gráficos para a tela) */}
        <div className="p-6 space-y-6 bg-background rounded-lg">
          
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-emerald-500 text-xs font-semibold mb-1">
                <TrendingUp className="h-4 w-4" /> TOTAL ENTRADAS
              </div>
              <p className="text-xl font-bold text-foreground">{fmt(totalDeposits)}</p>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <div className="flex items-center gap-2 text-red-500 text-xs font-semibold mb-1">
                <TrendingDown className="h-4 w-4" /> TOTAL SAÍDAS
              </div>
              <p className="text-xl font-bold text-foreground">{fmt(totalExpenses)}</p>
            </div>
            <div className={`rounded-lg border p-4 ${netResult >= 0 ? "border-primary/30 bg-primary/10" : "border-red-500/30 bg-red-500/10"}`}>
              <div className="flex items-center gap-2 text-xs font-semibold mb-1 text-primary">
                <DollarSign className="h-4 w-4" /> RESULTADO LÍQUIDO
              </div>
              <p className="text-xl font-bold text-foreground">{fmt(netResult)}</p>
            </div>
          </div>

          {pieData.length > 0 && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Distribuição por Sócio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={5} dataKey="value">
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ borderRadius: "8px", border: "none" }} />
                      <Legend verticalAlign="bottom" height={30} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
          
          <p className="text-sm text-muted-foreground text-center italic mt-4">
            A tabela completa com as {transactions.length} transações será incluída no arquivo PDF exportado.
          </p>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleExportProperPDF} className="gap-2">
            <FileDown className="h-4 w-4" />
            Baixar PDF Profissional
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}