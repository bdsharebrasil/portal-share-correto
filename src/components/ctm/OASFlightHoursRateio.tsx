import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Users, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface OASFlightHoursRateioProps {
  orderId: string;
  aircraftId: string;
  costSharing: any[];
  totalGeral: number;
  periodoInicio?: string | null;
  periodoFim?: string | null;
  onRefetch: () => void;
}

interface PartnerHours {
  client_id: string;
  client_name: string;
  monthly: { month: string; hours: string }[];
  total_hours: number;
  percentage: number;
  valor: number;
}

export function OASFlightHoursRateio({
  orderId,
  aircraftId,
  costSharing,
  totalGeral,
  periodoInicio,
  periodoFim,
  onRefetch,
}: OASFlightHoursRateioProps) {
  const [saving, setSaving] = useState(false);

  // Fetch logbook data for this aircraft within the period
  const { data: flightData, isLoading } = useQuery({
    queryKey: ["oas-flight-hours", aircraftId, periodoInicio, periodoFim],
    queryFn: async () => {
      let query = supabase
        .from("logbook_entries")
        .select("client_id, entry_date, total_time, client:clients(id, company_name, proprietario)")
        .eq("aircraft_id", aircraftId)
        .not("client_id", "is", null);

      if (periodoInicio) query = query.gte("entry_date", periodoInicio);
      if (periodoFim) query = query.lte("entry_date", periodoFim);

      const { data, error } = await query.order("entry_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!aircraftId,
  });

  // Process flight data into partner hours table
  const partnerData: PartnerHours[] = (() => {
    if (!flightData || flightData.length === 0) return [];

    const byClient: Record<string, { name: string; monthly: Record<string, number>; total: number }> = {};
    let grandTotal = 0;

    flightData.forEach((entry: any) => {
      const cid = entry.client_id;
      const hours = entry.total_time || 0;
      const date = new Date(entry.entry_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const clientName = entry.client?.company_name || entry.client?.proprietario || "Desconhecido";

      if (!byClient[cid]) byClient[cid] = { name: clientName, monthly: {}, total: 0 };
      byClient[cid].monthly[monthKey] = (byClient[cid].monthly[monthKey] || 0) + hours;
      byClient[cid].total += hours;
      grandTotal += hours;
    });

    // Get all months
    const allMonths = new Set<string>();
    Object.values(byClient).forEach(c => Object.keys(c.monthly).forEach(m => allMonths.add(m)));
    const sortedMonths = Array.from(allMonths).sort();

    // Format hours as HH:MM
    const formatHours = (h: number) => {
      const hrs = Math.floor(h);
      const mins = Math.round((h - hrs) * 60);
      return `${hrs}:${String(mins).padStart(2, "0")}`;
    };

    return Object.entries(byClient).map(([cid, data]) => ({
      client_id: cid,
      client_name: data.name,
      monthly: sortedMonths.map(m => ({
        month: m,
        hours: formatHours(data.monthly[m] || 0),
      })),
      total_hours: data.total,
      percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
      valor: grandTotal > 0 ? (data.total / grandTotal) * totalGeral : 0,
    }));
  })();

  const allMonths = partnerData.length > 0 ? partnerData[0].monthly.map(m => m.month) : [];
  const grandTotalHours = partnerData.reduce((s, p) => s + p.total_hours, 0);

  const formatHours = (h: number) => {
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return `${hrs}:${String(mins).padStart(2, "0")}`;
  };

  const formatMonth = (m: string) => {
    const [y, mo] = m.split("-");
    const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    return `${months[parseInt(mo) - 1]} ${y}`;
  };

  const saveRateio = async () => {
    setSaving(true);
    try {
      // Delete existing cost sharing for this order
      await supabase.from("ctm_cost_sharing").delete().eq("service_order_id", orderId);

      // Insert new entries
      const inserts = partnerData.map(p => ({
        service_order_id: orderId,
        client_id: p.client_id,
        horas_voadas: p.total_hours,
        percentual: p.percentage,
        valor: p.valor,
        status_pagamento: "pendente",
      }));

      if (inserts.length > 0) {
        const { error } = await supabase.from("ctm_cost_sharing").insert(inserts);
        if (error) throw error;
      }

      toast.success("Rateio salvo com base nas horas voadas!");
      onRefetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePago = async (id: string, current: string) => {
    const newStatus = current === "pago" ? "pendente" : "pago";
    const updateData: any = { status_pagamento: newStatus };
    if (newStatus === "pago") updateData.data_pagamento = new Date().toISOString().split("T")[0];
    else updateData.data_pagamento = null;
    const { error } = await supabase.from("ctm_cost_sharing").update(updateData).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(newStatus === "pago" ? "Marcado como pago" : "Revertido"); onRefetch(); }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Flight Hours Table - Like the reference image */}
      {partnerData.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Horas Voadas por Sócio
              {periodoInicio && periodoFim && (
                <span className="text-xs text-muted-foreground font-normal">
                  ({new Date(periodoInicio).toLocaleDateString("pt-BR")} até {new Date(periodoFim).toLocaleDateString("pt-BR")})
                </span>
              )}
            </h3>
            <Button size="sm" variant="default" onClick={saveRateio} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar Rateio por Horas
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-yellow-400 text-black">
                  <th className="px-4 py-2 text-left font-bold border-r border-yellow-500">MÊS</th>
                  {partnerData.map(p => (
                    <th key={p.client_id} className="px-4 py-2 text-center font-bold border-r border-yellow-500">{p.client_name.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allMonths.map((month, idx) => (
                  <tr key={month} className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                    <td className="px-4 py-2 font-medium border-r border-border">{formatMonth(month)}</td>
                    {partnerData.map(p => (
                      <td key={p.client_id} className="px-4 py-2 text-center border-r border-border">
                        {p.monthly.find(m => m.month === month)?.hours || "0:00"}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Totals */}
                <tr className="bg-muted/50 font-bold border-t-2 border-border">
                  <td className="px-4 py-2 border-r border-border">TOTAIS</td>
                  {partnerData.map(p => (
                    <td key={p.client_id} className="px-4 py-2 text-center border-r border-border">{formatHours(p.total_hours)}</td>
                  ))}
                </tr>
                <tr className="bg-muted/50 font-bold">
                  <td className="px-4 py-2 border-r border-border">TOTAL VOADO</td>
                  <td colSpan={partnerData.length} className="px-4 py-2 text-center font-black">{formatHours(grandTotalHours)} H</td>
                </tr>
                <tr className="bg-muted/50 font-bold">
                  <td className="px-4 py-2 border-r border-border">%</td>
                  {partnerData.map(p => (
                    <td key={p.client_id} className="px-4 py-2 text-center border-r border-border">{p.percentage.toFixed(2)}</td>
                  ))}
                </tr>
                <tr className="bg-primary/10 font-bold border-t-2 border-primary/30">
                  <td className="px-4 py-2 border-r border-border">VALOR RATEIO</td>
                  {partnerData.map(p => (
                    <td key={p.client_id} className="px-4 py-2 text-center border-r border-border text-primary">
                      R$ {p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {partnerData.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>Nenhuma hora voada encontrada no período</p>
          <p className="text-xs mt-1">Configure as datas de entrada/saída na OAS para calcular o rateio</p>
        </div>
      )}

      {/* Existing Cost Sharing Status */}
      {costSharing.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-sm text-foreground">Status de Pagamento</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sócio</TableHead>
                <TableHead>Horas</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costSharing.map((cs: any) => (
                <TableRow key={cs.id}>
                  <TableCell className="font-medium">{cs.client?.company_name || cs.client?.proprietario || "-"}</TableCell>
                  <TableCell>{cs.horas_voadas ? formatHours(cs.horas_voadas) : "-"}</TableCell>
                  <TableCell>{cs.percentual?.toFixed(1)}%</TableCell>
                  <TableCell>R$ {(cs.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <Badge
                      className={cn("cursor-pointer", cs.status_pagamento === "pago" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400")}
                      onClick={() => togglePago(cs.id, cs.status_pagamento)}
                    >
                      {cs.status_pagamento === "pago" ? "✓ Pago" : "Pendente"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
