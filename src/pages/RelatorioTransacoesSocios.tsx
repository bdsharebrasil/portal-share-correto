import React, { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Download, ArrowLeft, Calendar, FileText, Trash2, Edit2 } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useClientesComSocios } from "@/hooks/useSocioBalanco";
import { useSocioTransactions } from "@/hooks/useFinanceiroSocios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface GroupedTransactions {
  [monthYear: string]: Array<{
    id: string;
    date: string;
    partner_name: string;
    amount: number;
    balance_after: number;
    description?: string;
    bank_name?: string;
    prazo?: string;
    transaction_type: "deposit" | "withdrawal" | "transfer";
  }>;
}

export default function RelatorioTransacoesSocios() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Load client data
  const { data: clientesComSocios = [], isLoading: loadingClientes } = useClientesComSocios();
  const { data: transactions = [], isLoading: loadingTx } = useSocioTransactions(clienteId || null);

  const selectedClientData = clientesComSocios.find((c) => c.id === clienteId);

  // Group transactions by month/year
  const groupedTransactions = useMemo(() => {
    const grouped: GroupedTransactions = {};

    transactions.forEach((tx: any) => {
      const date = new Date(tx.created_at);
      const monthYear = date.toLocaleDateString("pt-BR", {
        month: "2-digit",
        year: "numeric",
      });

      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }

      grouped[monthYear].push({
        id: tx.id,
        date: new Date(tx.created_at).toLocaleDateString("pt-BR"),
        partner_name: tx.partner_name || "N/A",
        amount: parseFloat(tx.amount) || 0,
        balance_after: parseFloat(tx.balance_after) || 0,
        description: tx.description || "N/A",
        bank_name: tx.bank_name || "N/A",
        prazo: tx.prazo || "N/A",
        transaction_type: tx.transaction_type,
      });
    });

    // Sort each month's transactions by date
    Object.keys(grouped).forEach((monthYear) => {
      grouped[monthYear].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    });

    return grouped;
  }, [transactions]);

  const sortedMonths = Object.keys(groupedTransactions).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  // Set default selected month to the most recent
  React.useEffect(() => {
    if (sortedMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(sortedMonths[0]);
    }
  }, [sortedMonths, selectedMonth]);

  const selectedTransactions = useMemo(() => {
    const transactions = selectedMonth ? [...(groupedTransactions[selectedMonth] || [])] : [];
    return transactions.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });
  }, [selectedMonth, sortOrder, groupedTransactions]);

  const downloadCSV = () => {
    if (!selectedTransactions.length) return;

    const headers = ["Data", "Sócio", "Descrição", "Banco", "Prazo", "Tipo", "Valor", "Saldo"];
    const rows = selectedTransactions.map((tx) => [
      tx.date,
      tx.partner_name,
      tx.description,
      tx.bank_name,
      tx.prazo,
      tx.transaction_type === "deposit" ? "Depósito" : "Retirada",
      `R$ ${tx.amount.toFixed(2)}`,
      `R$ ${tx.balance_after.toFixed(2)}`,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const element = document.createElement("a");
    element.setAttribute("href", `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`);
    element.setAttribute("download", `relatorio_${selectedMonth}.csv`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadPDF = () => {
    if (!selectedTransactions.length) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;

    // Title
    doc.setFontSize(16);
    doc.text("Relatório de Transações - Sócios", margin, margin);

    // Client info
    doc.setFontSize(10);
    doc.text(
      `Cliente: ${selectedClientData?.company_name || selectedClientData?.proprietario}`,
      margin,
      margin + 10
    );
    doc.text(`CNPJ: ${selectedClientData?.cnpj}`, margin, margin + 15);
    doc.text(`Período: ${selectedMonth}`, margin, margin + 20);

    // Table
    const tableColumn = ["Data", "Sócio", "Descrição", "Banco", "Prazo", "Tipo", "Valor", "Saldo"];
    const tableRows = selectedTransactions.map((tx) => [
      tx.date,
      tx.partner_name,
      tx.description,
      tx.bank_name,
      tx.prazo,
      tx.transaction_type === "deposit" ? "Depósito" : "Retirada",
      `R$ ${tx.amount.toFixed(2)}`,
      `R$ ${tx.balance_after.toFixed(2)}`,
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: margin + 28,
      margin: margin,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [240, 240, 240],
      },
    });

    // Summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(
      `Total de Depósitos: R$ ${selectedTransactions
        .filter((t) => t.transaction_type === "deposit")
        .reduce((sum, t) => sum + t.amount, 0)
        .toFixed(2)}`,
      margin,
      finalY
    );
    doc.text(
      `Total de Retiradas: R$ ${selectedTransactions
        .filter((t) => t.transaction_type !== "deposit")
        .reduce((sum, t) => sum + t.amount, 0)
        .toFixed(2)}`,
      margin,
      finalY + 6
    );
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text(
      `Saldo Final: R$ ${selectedTransactions[selectedTransactions.length - 1]?.balance_after.toFixed(2) || "0.00"}`,
      margin,
      finalY + 14
    );

    doc.save(`relatorio_${selectedMonth}.pdf`);
  };

  if (loadingClientes) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin">
            <DollarSign className="h-8 w-8 text-primary" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!selectedClientData) {
    return (
      <Layout>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="pt-12 pb-12 text-center">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Cliente não encontrado
            </h3>
            <Button onClick={() => navigate("/financeiro/financeiro-socios")} className="mt-4">
              ← Voltar
            </Button>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Relatório de Transações</h1>
              <p className="text-sm text-muted-foreground">
                {selectedClientData?.company_name || selectedClientData?.proprietario} •{" "}
                {selectedClientData?.cnpj}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate("/financeiro/financeiro-socios")}
            size="sm"
          >
            ← Voltar
          </Button>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="w-full sm:w-64">
            <label className="text-sm font-medium text-foreground mb-2 block">
              <Calendar className="h-4 w-4 inline mr-2" />
              Selecione o Mês
            </label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um mês" />
              </SelectTrigger>
              <SelectContent>
                {sortedMonths.map((monthYear) => (
                  <SelectItem key={monthYear} value={monthYear}>
                    {monthYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={downloadPDF}
              disabled={!selectedTransactions.length}
              variant="outline"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Exportar PDF
            </Button>
            <Button
              onClick={downloadCSV}
              disabled={!selectedTransactions.length}
              variant="outline"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Transactions Table */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Transações - {selectedMonth}
              </CardTitle>
              <Badge variant="secondary">
                {selectedTransactions.length} transação
                {selectedTransactions.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {selectedTransactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Nenhuma transação encontrada para este período
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th
                        className="px-4 py-3 text-left text-sm font-semibold text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                      >
                        Data {sortOrder === "asc" ? "↑" : "↓"}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Sócio
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Descrição
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Banco
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Prazo
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Tipo
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                        Valor
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                        Saldo
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransactions.map((tx, index) => (
                      <tr
                        key={tx.id}
                        className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${
                          index % 2 === 0 ? "bg-muted/5" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-foreground">{tx.date}</td>
                        <td className="px-4 py-3 text-sm text-foreground font-medium">
                          {tx.partner_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {tx.description}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {tx.bank_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {tx.prazo}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge
                            variant={
                              tx.transaction_type === "deposit"
                                ? "default"
                                : "secondary"
                            }
                            className={
                              tx.transaction_type === "deposit"
                                ? "bg-green-500/20 text-green-600 border-green-500/30"
                                : "bg-blue-500/20 text-blue-600 border-blue-500/30"
                            }
                          >
                            {tx.transaction_type === "deposit" ? "Depósito" : "Retirada"}
                          </Badge>
                        </td>
                        <td
                          className={`px-4 py-3 text-sm font-semibold text-right ${
                            tx.transaction_type === "deposit"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {tx.transaction_type === "deposit" ? "+" : "-"} R${" "}
                          {tx.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-right text-foreground">
                          R$ {tx.balance_after.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="p-1.5 rounded hover:bg-blue-500/20 transition-colors text-blue-600 hover:text-blue-700"
                              title="Editar transação"
                              onClick={() => {
                                // TODO: Implement edit functionality
                                console.log("Edit transaction:", tx.id);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              className="p-1.5 rounded hover:bg-red-500/20 transition-colors text-red-600 hover:text-red-700"
                              title="Deletar transação"
                              onClick={() => {
                                // TODO: Implement delete functionality
                                if (confirm(`Tem certeza que deseja deletar esta transação?`)) {
                                  console.log("Delete transaction:", tx.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            {selectedTransactions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border/50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">Total de Depósitos:</span>
                  <span className="text-sm font-semibold text-green-600">
                    R${" "}
                    {selectedTransactions
                      .filter((t) => t.transaction_type === "deposit")
                      .reduce((sum, t) => sum + t.amount, 0)
                      .toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">Total de Retiradas:</span>
                  <span className="text-sm font-semibold text-red-600">
                    R${" "}
                    {selectedTransactions
                      .filter((t) => t.transaction_type !== "deposit")
                      .reduce((sum, t) => sum + t.amount, 0)
                      .toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-primary/10 p-3 rounded-lg">
                  <span className="text-sm font-bold text-foreground">Saldo Final:</span>
                  <span className="text-lg font-bold text-primary">
                    R${" "}
                    {selectedTransactions[selectedTransactions.length - 1]?.balance_after.toFixed(2) || "0.00"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
