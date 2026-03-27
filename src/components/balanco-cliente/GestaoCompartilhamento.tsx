import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRateioDespesas } from "@/hooks/useRateioDespesas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Users, TrendingUp, TrendingDown, CheckCircle, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props {
  clienteId: string;
  aeronaveId?: string;
  periodo: { inicio: string; fim: string };
}

interface PartnerDebt {
  fromPartner: { id: string; name: string; cpf: string; share_percentage: number };
  toPartner: { id: string; name: string; cpf: string; share_percentage: number };
  amount: number; // positive = fromPartner owes toPartner
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getDifferencaColor(diff: number) {
  if (Math.abs(diff) < 0.01) return "text-slate-400";
  if (diff > 0) return "text-red-500"; // deve pagar mais
  return "text-green-500"; // tem crédito
}

function getDifferencaBg(diff: number) {
  if (Math.abs(diff) < 0.01) return "bg-slate-900/30";
  if (diff > 0) return "bg-red-950/30"; // deve pagar mais
  return "bg-green-950/30"; // tem crédito
}

export function GestaoCompartilhamento({ clienteId, aeronaveId, periodo }: Props) {
  // Fetch partners (client_partners within a client OR client_aircraft sharing same aircraft)
  const { data: partnersData, isLoading: partsLoading } = useQuery({
    queryKey: ["partners", clienteId, aeronaveId],
    queryFn: async () => {
      // First, try to get client_partners within this client
      const { data: clientPartners, error: cpErr } = await supabase
        .from("client_partners")
        .select("id, name, cpf, share_percentage")
        .eq("client_id", clienteId)
        .order("created_at");
      if (cpErr) throw cpErr;

      // If we have client partners (2+), use them
      if (clientPartners && clientPartners.length >= 2) {
        return clientPartners;
      }

      // Otherwise, if we have aeronaveId, get all clients sharing this aircraft
      if (aeronaveId) {
        const { data: aircraftClients, error: acErr } = await supabase
          .from("client_aircraft")
          .select("client_id, share_percentage")
          .eq("aircraft_id", aeronaveId);
        if (acErr) throw acErr;

        if (aircraftClients && aircraftClients.length >= 2) {
          // Get client details for each
          const clientIds = aircraftClients.map((ac: any) => ac.client_id);
          const { data: clients, error: clErr } = await supabase
            .from("clients")
            .select("id, company_name, cnpj")
            .in("id", clientIds);
          if (clErr) throw clErr;

          // Merge data
          return aircraftClients
            .map((ac: any) => {
              const client = clients?.find((c: any) => c.id === ac.client_id);
              return {
                id: ac.client_id,
                name: client?.company_name || "Unknown",
                cpf: client?.cnpj || "",
                share_percentage: parseFloat(ac.share_percentage || "0"),
              };
            });
        }
      }

      return [];
    },
    enabled: !!clienteId,
  });

  // Fetch rateio_despesas data
  const { data: rateioDespesas, isLoading: rateioLoading } = useRateioDespesas({
    clienteId,
    aeronaveId,
    periodo,
  });

  const isLoading = partsLoading || rateioLoading;

  if (isLoading) {
    return (
      <Card className="border border-border/50 bg-card/80 rounded-2xl">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!partnersData || partnersData.length < 2) {
    return (
      <Card className="border border-border/50 bg-card/80 rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-primary" />
            Gestão de Compartilhamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Este cliente não possui múltiplos sócios. A gestão de compartilhamento é aplicável apenas para aeronaves compartilhadas entre 2 ou mais sócios.
          </p>
        </CardContent>
      </Card>
    );
  }

  const partners = partnersData;
  const despesas = rateioDespesas?.despesas || [];

  // Calculate partner-level summary
  const partnerSummary: Record<
    string,
    {
      name: string;
      cpf: string;
      share_percentage: number;
      totalPorPropriedade: number;
      totalPorUso: number;
      diferenca: number;
    }
  > = {};

  partners.forEach((p) => {
    partnerSummary[p.cpf] = {
      name: p.name,
      cpf: p.cpf,
      share_percentage: p.share_percentage,
      totalPorPropriedade: 0,
      totalPorUso: 0,
      diferenca: 0,
    };
  });

  // Aggregate despesas by partner (client_name or partner_name)
  despesas.forEach((d) => {
    const partnerName = d.partner_name || d.client_name;
    const partner = partners.find((p) => p.name === partnerName);

    if (partner) {
      partnerSummary[partner.cpf].totalPorPropriedade += d.valor_rateado || 0;
      partnerSummary[partner.cpf].totalPorUso += d.valor_por_voo || 0;
      partnerSummary[partner.cpf].diferenca = partnerSummary[partner.cpf].totalPorUso - partnerSummary[partner.cpf].totalPorPropriedade;
    }
  });

  const summaryArray = Object.values(partnerSummary);
  const totalPropriedade = summaryArray.reduce((sum, p) => sum + p.totalPorPropriedade, 0);
  const totalUso = summaryArray.reduce((sum, p) => sum + p.totalPorUso, 0);

  // Generate debt pairs based on usage-based allocation
  const debts: PartnerDebt[] = [];
  const balances: Record<string, number> = {};

  partners.forEach((p) => {
    const summary = partnerSummary[p.cpf];
    // Balance = (should pay by usage) - (should pay by property)
    // Positive = should pay more, negative = should pay less (has credit)
    balances[p.cpf] = summary.totalPorUso - summary.totalPorPropriedade;
  });

  // Simple debt resolution for 2+ partners
  if (partners.length === 2) {
    const [p1, p2] = partners;
    const bal1 = balances[p1.cpf] || 0;
    if (Math.abs(bal1) > 0.01) {
      if (bal1 > 0) {
        debts.push({ fromPartner: p1, toPartner: p2, amount: bal1 });
      } else {
        debts.push({ fromPartner: p2, toPartner: p1, amount: -bal1 });
      }
    }
  } else {
    // For 3+ partners
    const tempBalances = { ...balances };
    const debtors = partners.filter((p) => (tempBalances[p.cpf] || 0) > 0.01);
    const creditors = partners.filter((p) => (tempBalances[p.cpf] || 0) < -0.01);

    for (const debtor of debtors) {
      for (const creditor of creditors) {
        const debtorBal = tempBalances[debtor.cpf] || 0;
        const creditorBal = tempBalances[creditor.cpf] || 0;
        if (debtorBal <= 0.01 || creditorBal >= -0.01) continue;

        const transfer = Math.min(debtorBal, -creditorBal);
        if (transfer > 0.01) {
          debts.push({ fromPartner: debtor, toPartner: creditor, amount: transfer });
          tempBalances[debtor.cpf] -= transfer;
          tempBalances[creditor.cpf] += transfer;
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Expense-by-Expense Breakdown */}
      <Card className="border border-border/50 bg-card/80 rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-5 w-5 text-primary" />
            Detalhamento de Despesas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {despesas.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma despesa registrada neste período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="text-xs">Sócio</TableHead>
                    <TableHead className="text-xs">Devia por Propriedade</TableHead>
                    <TableHead className="text-xs">Deve por Uso</TableHead>
                    <TableHead className="text-xs">Diferença</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {despesas.map((d, i) => {
                    const dif = (d.valor_por_voo || 0) - (d.valor_rateado || 0);
                    const shouldPayMore = dif > 0.01;
                    const hasCredit = dif < -0.01;

                    return (
                      <TableRow key={i} className="border-border/50 hover:bg-muted/20">
                        <TableCell className="text-xs font-medium">{d.partner_name || d.client_name}</TableCell>
                        <TableCell className="text-xs">{fmt(d.valor_rateado || 0)}</TableCell>
                        <TableCell className="text-xs">{fmt(d.valor_por_voo || 0)}</TableCell>
                        <TableCell className={`text-xs font-semibold ${getDifferencaColor(dif)}`}>
                          {shouldPayMore && "+"}
                          {fmt(dif)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals Row */}
                  <TableRow className="border-t-2 border-border/50 bg-muted/30 font-semibold">
                    <TableCell className="text-xs font-bold">TOTAL</TableCell>
                    <TableCell className="text-xs">{fmt(totalPropriedade)}</TableCell>
                    <TableCell className="text-xs">{fmt(totalUso)}</TableCell>
                    <TableCell className={`text-xs font-bold ${getDifferencaColor(totalUso - totalPropriedade)}`}>
                      {fmt(totalUso - totalPropriedade)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryArray.map((summary) => {
          const isOwing = summary.diferenca > 0.01;
          const hasCredit = summary.diferenca < -0.01;

          return (
            <Card key={summary.cpf} className="border border-border/50 bg-card/80 rounded-2xl">
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                      {summary.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{summary.name}</p>
                      <p className="text-xs text-muted-foreground">{summary.share_percentage}% de participação</p>
                    </div>
                  </div>
                  {isOwing && (
                    <Badge variant="destructive" className="text-xs">
                      <TrendingDown className="h-3 w-3 mr-1" /> Deve Pagar
                    </Badge>
                  )}
                  {hasCredit && (
                    <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200">
                      <TrendingUp className="h-3 w-3 mr-1" /> Tem Crédito
                    </Badge>
                  )}
                  {!isOwing && !hasCredit && (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Equilibrado
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-muted/30">
                    <p className="text-muted-foreground">Por Propriedade</p>
                    <p className="font-semibold text-foreground">{fmt(summary.totalPorPropriedade)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <p className="text-muted-foreground">Por Uso</p>
                    <p className="font-semibold text-foreground">{fmt(summary.totalPorUso)}</p>
                  </div>
                </div>

                {Math.abs(summary.diferenca) > 0.01 && (
                  <div className={`p-2 rounded-lg text-xs ${getDifferencaBg(summary.diferenca)}`}>
                    <p className={`font-semibold ${getDifferencaColor(summary.diferenca)}`}>
                      {isOwing ? `Deve Pagar: ${fmt(summary.diferenca)}` : `Crédito: ${fmt(-summary.diferenca)}`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Debt Resolution */}
      <Card className="border border-border/50 bg-card/80 rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-primary" />
            Acertos entre Sócios
          </CardTitle>
        </CardHeader>
        <CardContent>
          {debts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-500 mb-3" />
              <p className="text-sm font-medium text-foreground">Tudo equilibrado!</p>
              <p className="text-xs text-muted-foreground mt-1">Nenhum acerto necessário entre os sócios no período selecionado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {debts.map((debt, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive text-sm font-bold">
                      {debt.fromPartner.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{debt.fromPartner.name}</p>
                      <p className="text-xs text-muted-foreground">{debt.fromPartner.share_percentage}%</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <ArrowRight className="h-5 w-5 text-primary" />
                    <span className="text-lg font-bold text-destructive">{fmt(debt.amount)}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">deve</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-sm text-right">{debt.toPartner.name}</p>
                      <p className="text-xs text-muted-foreground text-right">{debt.toPartner.share_percentage}%</p>
                    </div>
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
