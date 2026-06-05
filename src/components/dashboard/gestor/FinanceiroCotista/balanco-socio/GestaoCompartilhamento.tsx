import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRateioDespesas } from "@/hooks/useRateioDespesas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, TrendingUp, TrendingDown, CheckCircle, FileDown, LayoutGrid } from "lucide-react";
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
  fromPartner: { id: string; name: string; cpf: string; percentual_sociedade: number };
  toPartner: { id: string; name: string; cpf: string; percentual_sociedade: number };
  amount: number;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getDifferencaColor(diff: number) {
  if (Math.abs(diff) < 0.01) return "text-muted-foreground";
  if (diff > 0) return "text-green-500";
  return "text-red-500";
}

function getDifferencaBg(diff: number) {
  if (Math.abs(diff) < 0.01) return "bg-muted/30";
  if (diff > 0) return "bg-green-950/30";
  return "bg-red-950/30";
}

export function GestaoCompartilhamento({ clienteId, aeronaveId, periodo }: Props) {
  // Fetch partners for the aircraft
  const { data: partnersData, isLoading: partsLoading } = useQuery({
    queryKey: ["partners", aeronaveId],
    queryFn: async () => {
      if (!aeronaveId) return [];
      const { data: aircraftClients, error } = await supabase
        .from("cotistas_aeronave")
        .select("client_id, percentual_sociedade")
        .eq("id_aeronave", aeronaveId);
      if (error) throw error;
      if (!aircraftClients || aircraftClients.length < 2) return [];
      const clientIds = aircraftClients.map((ac: any) => ac.cliente_id);
      const { data: clients, error: clErr } = await (supabase as any)
        .from("clientes")
        .select("id, razao_social, cnpj")
        .in("id", clientIds);
      if (clErr) throw clErr;
      return aircraftClients.map((ac: any) => {
        const client = clients?.find((c: any) => c.id === ac.cliente_id);
        return {
          id: ac.cliente_id,
          name: client?.razao_social || "Unknown",
          cpf: client?.cnpj || "",
          percentual_sociedade: parseFloat(ac.percentual_sociedade || "0"),
        };
      });
    },
    enabled: !!aeronaveId,
  });

  // Fetch rateio data
  const { data: rateioData, isLoading: rateioLoading } = useRateioDespesas({
    clienteId,
    aeronaveId,
    periodo,
  });

  // Fetch enrichment data from bank_reconciliations
  const despesaIds = useMemo(() => {
    const despesas = rateioData?.despesas || [];
    return Array.from(new Set(despesas.map((d: any) => d.despesa_id).filter(Boolean)));
  }, [rateioData]);

  const { data: enrichmentData } = useQuery({
    queryKey: ["centro-financeiro-enrichment", despesaIds],
    queryFn: async () => {
      if (despesaIds.length === 0) return new Map();
      const { data, error } = await supabase
        .from("conciliacoes_bancarias")
        .select(`
          id, description, fornecedor_nome, category, type, date,
          forma_pagamento, prazo_pagamento, partner_name, percentual,
          categorias_movimentacao:categoria_movimentacao_id(nome, grupo_categoria, tipo)
        `)
        .in("id", despesaIds);
      if (error) throw error;
      const map = new Map();
      (data || []).forEach((item: any) => map.set(item.id, item));
      return map;
    },
    enabled: despesaIds.length > 0,
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

  // Group by despesa_id
  const groupedDespesasMap: Map<string, any> = new Map();
  despesasRaw.forEach((d: any) => {
    if (!groupedDespesasMap.has(d.despesa_id)) {
      groupedDespesasMap.set(d.despesa_id, {
        despesa_id: d.despesa_id,
        data: d.data_vencimento,
        valor_total: d.valor || 0,
        rateios: [],
      });
    }
    const group = groupedDespesasMap.get(d.despesa_id);
    group.rateios.push(d);
  });

  const groupedDespesas = Array.from(groupedDespesasMap.values()).sort(
    (a, b) => (a.data || "").localeCompare(b.data || "")
  );

  // Extract unique partner names
  const rateioPartnerNames = Array.from(
    new Set(despesasRaw.map((d: any) => (d.nome_socio || d.client_name || "").toString().trim()).filter(Boolean))
  );

  const partners = (partnersData && partnersData.length >= 2
    ? partnersData
    : rateioPartnerNames.map((name, index) => {
        const exemplar = despesasRaw.find((d: any) => (d.nome_socio || d.client_name || "").toString().trim() === name);
        return {
          id: exemplar?.cliente_id || `rf-${index}`,
          name,
          cpf: exemplar?.cliente_id || `rf-${index}`,
          percentual_sociedade: exemplar?.percentual || 0
        };
      })
  ).reduce((uniquePartners: any[], p) => {
    if (!uniquePartners.find(up => up.name.toLowerCase() === p.name.toLowerCase())) {
      uniquePartners.push(p);
    }
    return uniquePartners;
  }, []);

  if (!partners || partners.length < 2) {
    return (
      <Card className="border border-border/50 bg-card/80 rounded-2xl">
        <CardHeader><CardTitle className="text-base">Centro Financeiro</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground text-center py-8">Apenas para aeronaves compartilhadas.</p></CardContent>
      </Card>
    );
  }

  // Calculate balances
  const partnerBalances: Record<string, { totalPago: number; totalDevido: number }> = {};
  partners.forEach(p => {
    partnerBalances[p.name] = { totalPago: 0, totalDevido: 0 };
  });

  groupedDespesas.forEach(group => {
    group.rateios.forEach((rateio: any) => {
      const partnerName = rateio.nome_socio || rateio.client_name;
      if (partnerBalances[partnerName]) {
        partnerBalances[partnerName].totalDevido += rateio.valor_por_voo || 0;
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
    const saldo = bal.totalPago - bal.totalDevido;
    return { ...p, totalPago: bal.totalPago, totalDevido: bal.totalDevido, saldo };
  });

  // Debt resolution
  const debts: PartnerDebt[] = [];
  const debtorsData = summaryArray.filter(s => s.saldo < -0.01);
  const creditorsData = summaryArray.filter(s => s.saldo > 0.01);

  debtorsData.forEach(debtor => {
    creditorsData.forEach(creditor => {
      const debtAmount = Math.abs(debtor.saldo);
      const creditAmount = creditor.saldo;
      if (debtAmount <= 0.01 || creditAmount <= 0.01) return;
      const transfer = Math.min(debtAmount, creditAmount);
      if (transfer > 0.01) {
        debts.push({ fromPartner: debtor, toPartner: creditor, amount: transfer });
      }
    });
  });

  // Helper to get enrichment info
  const getEnrichment = (despesaId: string) => {
    return enrichmentData?.get(despesaId) || {};
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(14);
    doc.text("CENTRO DE LANÇAMENTO DE CUSTOS AERONAVE", 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${periodo.inicio} a ${periodo.fim}`, 14, 22);

    const headers = [
      [
        "DATA", "DOC", "FORNECEDOR", "DESCRIÇÃO",
        "CATEGORIA", "TIPO", "PRAZO",
        "FLUXO", "PAGO POR", "VALOR PAGO",
        ...partners.flatMap(p => [`${p.name} %`, `${p.name} R$`])
      ]
    ];

    const body = groupedDespesas.map(group => {
      const enrich = getEnrichment(group.despesa_id);
      const firstRateio = group.rateios[0] || {};
      const pagoPor = firstRateio.pago_diretamente
        ? (firstRateio.nome_socio || firstRateio.client_name || "-")
        : "EMPRESA";
      const categoria = enrich.categorias_movimentacao?.nome || enrich.categoria || firstRateio.receipt_category || "-";
      const tipo = enrich.categorias_movimentacao?.tipo || enrich.tipo || "-";

      return [
        group.data || "-",
        firstRateio.documento_number || firstRateio.nota_fiscal || enrich.documento || "-",
        enrich.fornecedor_nome || "-",
        enrich.descricao || "-",
        categoria.toUpperCase(),
        tipo.toUpperCase(),
        (enrich.prazo_pagamento || "-").toUpperCase(),
        firstRateio.pago_diretamente ? "SAIDA" : "SAIDA",
        pagoPor,
        fmt(group.valor_total),
        ...partners.flatMap(p => {
          const rateio = group.rateios.find((r: any) => (r.nome_socio || r.client_name) === p.name);
          const pct = rateio ? (rateio.percentual || 0) : 0;
          const valorRateado = rateio
            ? (rateio.pago_diretamente ? group.valor_total : (rateio.valor_rateado || 0))
            : 0;
          return [`${pct.toFixed(4)}%`, fmt(valorRateado)];
        })
      ];
    });

    // Totals
    body.push([
      "TOTAL", "", "", "", "", "", "", "", "",
      fmt(groupedDespesas.reduce((sum, g) => sum + g.valor_total, 0)),
      ...partners.flatMap(p => ["", fmt(partnerBalances[p.name].totalPago)])
    ]);

    autoTable(doc, {
      startY: 28,
      head: headers,
      body: body,
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1.5 },
      headStyles: { fillColor: [200, 200, 200], textColor: 0, fontSize: 6 },
    });

    doc.save(`centro_financeiro_${periodo.inicio}_${periodo.fim}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Main Table: Centro Financeiro */}
      <Card className="border border-border/50 bg-card/80 rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutGrid className="h-5 w-5 text-primary" />
            Centro Financeiro
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
            <div className="overflow-x-auto table-scroll-visible">
              <Table>
                <TableHeader>
                  {/* Group headers */}
                  <TableRow className="border-border/50 bg-muted/30">
                    <TableHead colSpan={4} className="text-[10px] font-bold text-center border-r border-border/50 tracking-wider text-muted-foreground">
                      IDENTIFICAÇÃO
                    </TableHead>
                    <TableHead colSpan={3} className="text-[10px] font-bold text-center border-r border-border/50 tracking-wider text-muted-foreground">
                      QUALIFICAÇÃO DE CUSTO
                    </TableHead>
                    <TableHead colSpan={3} className="text-[10px] font-bold text-center border-r border-border/50 tracking-wider text-muted-foreground">
                      PAGAMENTO
                    </TableHead>
                    <TableHead colSpan={partners.length} className="text-[10px] font-bold text-center border-r border-border/50 tracking-wider text-muted-foreground">
                      %
                    </TableHead>
                    <TableHead colSpan={partners.length} className="text-[10px] font-bold text-center tracking-wider text-muted-foreground">
                      RATEIO
                    </TableHead>
                  </TableRow>
                  {/* Column headers */}
                  <TableRow className="border-border/50 bg-muted/20">
                    <TableHead className="text-[10px] font-bold min-w-[80px]">DATA</TableHead>
                    <TableHead className="text-[10px] font-bold min-w-[70px]">DOC</TableHead>
                    <TableHead className="text-[10px] font-bold min-w-[120px]">FORNECEDOR</TableHead>
                    <TableHead className="text-[10px] font-bold min-w-[140px] border-r border-border/50">DESCRIÇÃO</TableHead>
                    <TableHead className="text-[10px] font-bold min-w-[120px]">CATEGORIA</TableHead>
                    <TableHead className="text-[10px] font-bold min-w-[90px]">TIPO</TableHead>
                    <TableHead className="text-[10px] font-bold min-w-[80px] border-r border-border/50">PRAZO</TableHead>
                    <TableHead className="text-[10px] font-bold min-w-[60px]">FLUXO</TableHead>
                    <TableHead className="text-[10px] font-bold min-w-[90px]">PAGO POR</TableHead>
                    <TableHead className="text-[10px] font-bold min-w-[100px] border-r border-border/50">VALOR PAGO</TableHead>
                    {partners.map(p => (
                      <TableHead key={`pct-${p.id}`} className="text-[10px] font-bold text-center min-w-[80px]">
                        {p.name.split(" ")[0].toUpperCase()}
                      </TableHead>
                    ))}
                    {partners.length > 0 && (
                      <TableHead className="text-[10px] font-bold text-center border-l border-border/50 min-w-[80px]">
                        {/* spacer for rateio section border */}
                      </TableHead>
                    )}
                    {partners.slice(1).map(p => (
                      <TableHead key={`rat-${p.id}`} className="text-[10px] font-bold text-center min-w-[80px]">
                      </TableHead>
                    ))}
                  </TableRow>
                  {/* Sub-headers for rateio with partner names */}
                  <TableRow className="border-border/50 bg-muted/10">
                    <TableHead colSpan={10} className="border-r border-border/50"></TableHead>
                    {partners.map(p => (
                      <TableHead key={`pct-sub-${p.id}`} className="text-[9px] text-center text-muted-foreground">
                        {p.percentual_participacao.toFixed(2)}%
                      </TableHead>
                    ))}
                    {partners.map(p => (
                      <TableHead key={`rat-sub-${p.id}`} className={`text-[9px] text-center text-muted-foreground ${partners.indexOf(p) === 0 ? 'border-l border-border/50' : ''}`}>
                        R$ {p.nome.split(" ")[0].toUpperCase()}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedDespesas.map((group, i) => {
                    const enrich = getEnrichment(group.despesa_id);
                    const firstRateio = group.rateios[0] || {};
                    const pagoPor = firstRateio.pago_diretamente
                      ? (firstRateio.nome_socio || firstRateio.client_name || "-")
                      : "DGA ADM";
                    const categoria = enrich.categorias_movimentacao?.nome || enrich.categoria || firstRateio.receipt_category || "-";
                    const tipo = enrich.categorias_movimentacao?.tipo || enrich.tipo || "-";
                    const prazo = enrich.prazo_pagamento || "-";

                    return (
                      <TableRow key={i} className="border-border/50 hover:bg-muted/20">
                        <TableCell className="text-[10px] whitespace-nowrap">{group.data || "-"}</TableCell>
                        <TableCell className="text-[10px] whitespace-nowrap">
                          {firstRateio.documento_number || firstRateio.nota_fiscal || "-"}
                        </TableCell>
                        <TableCell className="text-[10px] whitespace-nowrap truncate max-w-[140px]">
                          {enrich.fornecedor_nome || "-"}
                        </TableCell>
                        <TableCell className="text-[10px] whitespace-nowrap truncate max-w-[160px] border-r border-border/50">
                          {enrich.descricao || "-"}
                        </TableCell>
                        <TableCell className="text-[10px] whitespace-nowrap uppercase">
                          {categoria.toString().toUpperCase().replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="text-[10px] whitespace-nowrap uppercase">
                          {tipo.toString().toUpperCase().replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="text-[10px] whitespace-nowrap uppercase border-r border-border/50">
                          {prazo.toString().toUpperCase().replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="text-[10px] whitespace-nowrap">SAÍDA</TableCell>
                        <TableCell className="text-[10px] whitespace-nowrap font-medium">{pagoPor}</TableCell>
                        <TableCell className="text-[10px] whitespace-nowrap font-medium border-r border-border/50">
                          R$ {group.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        {/* % columns */}
                        {partners.map(p => {
                          const rateio = group.rateios.find((r: any) => (r.nome_socio || r.client_name) === p.nome);
                          const pct = rateio ? (rateio.percentual || 0) : 0;
                          const isFullOwner = Math.abs(pct - 100) < 0.01;
                          return (
                            <TableCell
                              key={`pct-${i}-${p.id}`}
                              className={`text-[10px] text-center whitespace-nowrap ${isFullOwner ? 'font-bold text-primary' : pct === 0 ? 'text-muted-foreground' : ''}`}
                            >
                              {pct > 0 ? `${pct.toFixed(4)}%` : "0,0000%"}
                            </TableCell>
                          );
                        })}
                        {/* Rateio R$ columns */}
                        {partners.map((p, pi) => {
                          const rateio = group.rateios.find((r: any) => (r.nome_socio || r.client_name) === p.nome);
                          const valorRateado = rateio
                            ? (rateio.pago_diretamente ? group.valor_total : (rateio.valor_rateado || 0))
                            : 0;
                          return (
                            <TableCell
                              key={`rat-${i}-${p.id}`}
                              className={`text-[10px] text-center whitespace-nowrap font-medium ${pi === 0 ? 'border-l border-border/50' : ''} ${valorRateado > 0 ? '' : 'text-muted-foreground'}`}
                            >
                              {valorRateado > 0
                                ? `R$ ${valorRateado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                : "R$ -"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                  {/* Totals Row */}
                  <TableRow className="border-t-2 border-primary/30 bg-muted/40 font-bold">
                    <TableCell colSpan={9} className="text-[10px] font-bold">TOTAL</TableCell>
                    <TableCell className="text-[10px] font-bold border-r border-border/50">
                      {fmt(groupedDespesas.reduce((sum, g) => sum + g.valor_total, 0))}
                    </TableCell>
                    {partners.map(p => (
                      <TableCell key={`total-pct-${p.id}`} className="text-[10px] text-center font-bold"></TableCell>
                    ))}
                    {partners.map((p, pi) => (
                      <TableCell
                        key={`total-rat-${p.id}`}
                        className={`text-[10px] text-center font-bold ${pi === 0 ? 'border-l border-border/50' : ''}`}
                      >
                        {fmt(partnerBalances[p.nome].totalPago)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
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
                      {s.nome.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-sm">{s.nome}</span>
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
                    <span className="text-lg font-bold text-destructive">{fmt((debt as any).valor || (debt as any).amount || 0)}</span>
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
