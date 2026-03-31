import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRateioDespesas } from "@/hooks/useRateioDespesas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, TrendingUp, TrendingDown, CheckCircle, DollarSign, FileDown, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  clienteId: string;
  aeronaveId?: string;
  periodo: { inicio: string; fim: string };
}

interface PartnerDebt {
  fromPartner: { id: string; name: string; cpf: string; share_percentage: number };
  toPartner: { id: string; name: string; cpf: string; share_percentage: number };
  amount: number;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Helper function to get document number (prefers nota_fiscal, then boleto, then doc_number, then receipt_number)
function getDocNumber(rateio: any): string {
  return (rateio.nota_fiscal || rateio.boleto || rateio.doc_number || rateio.receipt_number || "-").toString();
}

// Helper function to get category name
function getCategoryName(rateio: any): string {
  return (rateio.receipt_category || "-").toString();
}

// Helper function to get client initials for rateio display
function getClientInitials(clientName: string): string {
  return clientName
    .split(" ")
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join("");
}

function getDifferencaColor(diff: number) {
  if (Math.abs(diff) < 0.01) return "text-slate-400";
  if (diff > 0) return "text-green-500"; // tem crédito
  return "text-red-500"; // deve pagar
}

function getDifferencaBg(diff: number) {
  if (Math.abs(diff) < 0.01) return "bg-slate-900/30";
  if (diff > 0) return "bg-green-950/30";
  return "bg-red-950/30";
}

export function GestaoCompartilhamento({ clienteId, aeronaveId, periodo }: Props) {
  const { data: partnersData, isLoading: partsLoading } = useQuery({
    queryKey: ["partners", aeronaveId],
    queryFn: async () => {
      if (!aeronaveId) return [];
      const { data: aircraftClients, error } = await supabase
        .from("client_aircraft")
        .select("client_id, share_percentage")
        .eq("aircraft_id", aeronaveId);
      if (error) throw error;
      if (!aircraftClients || aircraftClients.length < 2) return [];
      const clientIds = aircraftClients.map((ac: any) => ac.client_id);
      const { data: clients, error: clErr } = await supabase
        .from("clients")
        .select("id, company_name, cnpj")
        .in("id", clientIds);
      if (clErr) throw clErr;
      return aircraftClients.map((ac: any) => {
        const client = clients?.find((c: any) => c.id === ac.client_id);
        return {
          id: ac.client_id,
          name: client?.company_name || "Unknown",
          cpf: client?.cnpj || "",
          share_percentage: parseFloat(ac.share_percentage || "0"),
        };
      });
    },
    enabled: !!aeronaveId,
  });

  const { data: rateioData, isLoading: rateioLoading } = useRateioDespesas({
    clienteId,
    aeronaveId,
    periodo,
  });

  const isLoading = partsLoading || rateioLoading;

  if (isLoading) {
    return (
      <Card className="border border-border/50 bg-card/80 rounded-2xl">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const despesasRaw = rateioData?.despesas || [];

  // Group by despesa_id and collect all rateio records
  const groupedDespesasMap: Map<string, any> = new Map();
  despesasRaw.forEach((d: any) => {
    if (!groupedDespesasMap.has(d.despesa_id)) {
      groupedDespesasMap.set(d.despesa_id, {
        despesa_id: d.despesa_id,
        data: d.data_vencimento,
        valor_total: d.valor || 0,
        rateios: [], // Array of all rateio records for this expense
      });
    }
    const group = groupedDespesasMap.get(d.despesa_id);
    group.rateios.push(d);
  });

  const groupedDespesas = Array.from(groupedDespesasMap.values());

  // Extract unique partner names from all rateios
  const rateioPartnerNames = Array.from(
    new Set(despesasRaw.map((d: any) => (d.partner_name || d.client_name || "").toString().trim()).filter(Boolean))
  );

  const partners = (partnersData && partnersData.length >= 2
    ? partnersData
    : rateioPartnerNames.map((name, index) => {
        const exemplar = despesasRaw.find((d: any) => (d.partner_name || d.client_name || "").toString().trim() === name);
        return {
          id: exemplar?.client_id || `rf-${index}`,
          name,
          cpf: exemplar?.client_id || `rf-${index}`,
          share_percentage: exemplar?.percentual || 0
        };
      })
  ).reduce((uniquePartners: any[], p) => {
    // Remove duplicates by name (case-insensitive)
    if (!uniquePartners.find(up => up.name.toLowerCase() === p.name.toLowerCase())) {
      uniquePartners.push(p);
    }
    return uniquePartners;
  }, []);

  if (!partners || partners.length < 2) {
    return (
      <Card className="border border-border/50 bg-card/80 rounded-2xl">
        <CardHeader><CardTitle className="text-base">Gestão de Compartilhamento</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground text-center py-8">Apenas para aeronaves compartilhadas.</p></CardContent>
      </Card>
    );
  }

  // Calculate balances: Pago - Devido = Saldo
  const partnerBalances: Record<string, { totalPago: number; totalDevido: number }> = {};
  partners.forEach(p => {
    partnerBalances[p.name] = { totalPago: 0, totalDevido: 0 };
  });

  groupedDespesas.forEach(group => {
    group.rateios.forEach((rateio: any) => {
      const partnerName = rateio.partner_name || rateio.client_name;
      if (partnerBalances[partnerName]) {
        // Valor Devido: valor_por_voo (based on usage/rateio)
        partnerBalances[partnerName].totalDevido += rateio.valor_por_voo || 0;
        
        // Valor Pago: if pago_diretamente is true, they paid the full valor_total
        // Otherwise, they paid their share (valor_rateado)
        if (rateio.pago_diretamente) {
          partnerBalances[partnerName].totalPago += group.valor_total;
        } else {
          partnerBalances[partnerName].totalPago += rateio.valor_rateado || 0;
        }
      }
    });
  });

  const summaryArray = partners.map(p => {
    const bal = partnerBalances[p.name];
    const saldo = bal.totalPago - bal.totalDevido; // Positive = credit, Negative = debt
    return { 
      ...p, 
      totalPago: bal.totalPago, 
      totalDevido: bal.totalDevido, 
      saldo 
    };
  });

  // Debt resolution
  const debts: PartnerDebt[] = [];
  const tempBalances = { ...partnerBalances };
  
  summaryArray.forEach(s => {
    tempBalances[s.name] = { totalPago: s.totalPago, totalDevido: s.totalDevido };
  });

  const debtorsData = summaryArray.filter(s => s.saldo < -0.01);
  const creditorsData = summaryArray.filter(s => s.saldo > 0.01);

  debtorsData.forEach(debtor => {
    creditorsData.forEach(creditor => {
      const debtAmount = Math.abs(debtor.saldo);
      const creditAmount = creditor.saldo;
      if (debtAmount <= 0.01 || creditAmount <= 0.01) return;
      
      const transfer = Math.min(debtAmount, creditAmount);
      if (transfer > 0.01) {
        debts.push({ 
          fromPartner: debtor, 
          toPartner: creditor, 
          amount: transfer 
        });
      }
    });
  });

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text("Relatório de Rateio e Compensação Financeira", 14, 20);
    doc.setFontSize(10);
    doc.text(`Período: ${periodo.inicio} a ${periodo.fim}`, 14, 28);

    const headers = [
      ["DATA", "VALOR TOTAL", ...partners.flatMap(p => [`${p.name} (Devido)`, `${p.name} (Pago)`])]
    ];

    const body = groupedDespesas.map(group => [
      group.data,
      fmt(group.valor_total),
      ...partners.flatMap(p => {
        const rateio = group.rateios.find((r: any) => (r.partner_name || r.client_name) === p.name);
        return [
          rateio ? fmt(rateio.valor_por_voo || 0) : "-",
          rateio ? fmt(rateio.pago_diretamente ? group.valor_total : (rateio.valor_rateado || 0)) : "-"
        ];
      })
    ]);

    // Add totals row
    body.push([
      "TOTAL",
      fmt(groupedDespesas.reduce((sum, g) => sum + g.valor_total, 0)),
      ...partners.flatMap(p => [
        fmt(partnerBalances[p.name].totalDevido),
        fmt(partnerBalances[p.name].totalPago)
      ])
    ]);

    autoTable(doc, { 
      startY: 35, 
      head: headers, 
      body: body, 
      theme: 'grid', 
      styles: { fontSize: 7 },
      headStyles: { fillColor: [200, 200, 200], textColor: 0 }
    });

    doc.save(`rateio_compensacao_${periodo.inicio}_${periodo.fim}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Main Table: Despesas com Devido vs Pago */}
      <Card className="border border-border/50 bg-card/80 rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-5 w-5 text-primary" />
            Conciliação de Despesas (Devido vs Pago)
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportToPDF} className="gap-2">
            <FileDown className="h-4 w-4" />
            Exportar PDF
          </Button>
        </CardHeader>
        <CardContent>
          {groupedDespesas.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma despesa registrada neste período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 bg-muted/20">
                    <TableHead className="text-xs font-bold">DATA</TableHead>
                    <TableHead className="text-xs font-bold">CATEGORIA</TableHead>
                    <TableHead className="text-xs font-bold">Nº DOC</TableHead>
                    <TableHead className="text-xs font-bold">RATEIO</TableHead>
                    <TableHead className="text-xs font-bold">VALOR TOTAL</TableHead>
                    {partners.map(p => (
                      <TableHead key={p.id} className="text-xs font-bold text-center border-l border-border/50 col-span-2">
                        {p.name.toUpperCase()}
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="border-border/50 bg-muted/10">
                    <TableHead className="text-[10px]"></TableHead>
                    <TableHead className="text-[10px]"></TableHead>
                    <TableHead className="text-[10px]"></TableHead>
                    <TableHead className="text-[10px]"></TableHead>
                    <TableHead className="text-[10px]"></TableHead>
                    {partners.map(p => (
                      <React.Fragment key={`header-${p.id}`}>
                        <TableHead className="text-[10px] text-center border-l border-border/50">DEVIDO</TableHead>
                        <TableHead className="text-[10px] text-center">PAGO</TableHead>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedDespesas.map((group, i) => (
                    <TableRow key={i} className="border-border/50 hover:bg-muted/20">
                      <TableCell className="text-xs">{group.data}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {group.rateios.length > 0 ? getCategoryName(group.rateios[0]) : "-"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {group.rateios.length > 0 ? getDocNumber(group.rateios[0]) : "-"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <div className="space-y-1">
                          {group.rateios.map((rateio: any, idx: number) => {
                            const initials = getClientInitials(rateio.partner_name || rateio.client_name);
                            const propriedade = rateio.percentual || 0;
                            const uso = rateio.percentual_voo || 0;
                            return (
                              <div key={idx} className="text-[10px] font-mono">
                                {initials} {propriedade.toFixed(2)}%/{uso.toFixed(2)}%
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{fmt(group.valor_total)}</TableCell>
                      {partners.map(p => {
                        const rateio = group.rateios.find((r: any) => (r.partner_name || r.client_name) === p.name);
                        const devido = rateio ? (rateio.valor_por_voo || 0) : 0;
                        const pago = rateio
                          ? (rateio.pago_diretamente ? group.valor_total : (rateio.valor_rateado || 0))
                          : 0;
                        const diferenca = pago - devido;

                        return (
                          <React.Fragment key={`group-${i}-${p.id}`}>
                            <TableCell className="text-xs text-center border-l border-border/50">
                              {fmt(devido)}
                            </TableCell>
                            <TableCell
                              className={`text-xs text-center font-medium ${diferenca > 0.01 ? 'bg-green-950/20 text-green-500' : diferenca < -0.01 ? 'bg-red-950/20 text-red-500' : ''}`}
                            >
                              {fmt(pago)}
                            </TableCell>
                          </React.Fragment>
                        );
                      })}
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="border-t-2 border-border/50 bg-muted/30 font-bold">
                    <TableCell className="text-xs">TOTAL</TableCell>
                    <TableCell className="text-xs">{fmt(groupedDespesas.reduce((sum, g) => sum + g.valor_total, 0))}</TableCell>
                    {partners.map(p => (
                      <React.Fragment key={`total-${p.id}`}>
                        <TableCell className="text-xs text-center border-l border-border/50">
                          {fmt(partnerBalances[p.name].totalDevido)}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {fmt(partnerBalances[p.name].totalPago)}
                        </TableCell>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards: Saldo Final */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryArray.map((s) => {
          const hasCredit = s.saldo > 0.01;
          const hasDebt = s.saldo < -0.01;

          return (
            <Card key={s.id} className="border border-border/50 bg-card/80 rounded-2xl">
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-sm">{s.name}</span>
                  </div>
                  {hasCredit && (
                    <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200">
                      <TrendingUp className="h-3 w-3 mr-1" /> TEM CRÉDITO
                    </Badge>
                  )}
                  {hasDebt && (
                    <Badge variant="destructive" className="text-xs">
                      <TrendingDown className="h-3 w-3 mr-1" /> DEVE PAGAR
                    </Badge>
                  )}
                  {!hasCredit && !hasDebt && (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> QUITADO
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-muted/30">
                    <p className="text-muted-foreground">Total Devido</p>
                    <p className="font-semibold text-foreground">{fmt(s.totalDevido)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <p className="text-muted-foreground">Total Pago</p>
                    <p className="font-semibold text-foreground">{fmt(s.totalPago)}</p>
                  </div>
                </div>

                {Math.abs(s.saldo) > 0.01 && (
                  <div className={`p-2 rounded-lg text-xs ${getDifferencaBg(s.saldo)}`}>
                    <p className={`font-semibold ${getDifferencaColor(s.saldo)}`}>
                      {hasCredit ? `Crédito a Receber: ${fmt(s.saldo)}` : `Débito a Pagar: ${fmt(-s.saldo)}`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Settlements */}
      <Card className="border border-border/50 bg-card/80 rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-primary" />
            Acertos Financeiros
          </CardTitle>
        </CardHeader>
        <CardContent>
          {debts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-500 mb-3" />
              <p className="text-sm font-medium text-foreground">Tudo equilibrado!</p>
              <p className="text-xs text-muted-foreground mt-1">Nenhum acerto necessário entre os sócios.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {debts.map((debt, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive text-sm font-bold">
                      {debt.fromPartner.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-sm">{debt.fromPartner.name}</span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <ArrowRight className="h-5 w-5 text-primary" />
                    <span className="text-lg font-bold text-destructive">{fmt(debt.amount)}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">deve</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm text-right">{debt.toPartner.name}</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 text-sm font-bold">
                      {debt.toPartner.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
