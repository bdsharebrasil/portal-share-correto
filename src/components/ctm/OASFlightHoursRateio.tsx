import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users, Save, CalendarIcon, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  partner_id: string | null;
  partner_name: string;
  totalMinutes: number;
  percentage: number;
  valor: number;
  isNonPartner: boolean; // testes, translado, etc.
}

const formatHHMM = (totalMinutes: number) => {
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const decimalToMinutes = (decimal: number) => {
  const hrs = Math.floor(decimal);
  const mins = Math.round((decimal - hrs) * 60);
  return hrs * 60 + mins;
};

export function OASFlightHoursRateio({
  orderId,
  aircraftId,
  costSharing,
  totalGeral,
  periodoInicio: externalInicio,
  periodoFim: externalFim,
  onRefetch,
}: OASFlightHoursRateioProps) {
  const [saving, setSaving] = useState(false);
  const [dateInicio, setDateInicio] = useState<Date | undefined>(
    externalInicio ? new Date(externalInicio + "T12:00:00") : undefined
  );
  const [dateFim, setDateFim] = useState<Date | undefined>(
    externalFim ? new Date(externalFim + "T12:00:00") : undefined
  );

  const periodoInicio = dateInicio ? format(dateInicio, "yyyy-MM-dd") : null;
  const periodoFim = dateFim ? format(dateFim, "yyyy-MM-dd") : null;

  // Fetch partners for this aircraft's client
  const { data: aircraftData } = useQuery({
    queryKey: ["oas-aircraft-partners", aircraftId],
    queryFn: async () => {
      // Get clients linked to this aircraft
      const { data: clientAircraft } = await supabase
        .from("client_aircraft")
        .select("client_id")
        .eq("aircraft_id", aircraftId);

      if (!clientAircraft || clientAircraft.length === 0) return { partners: [] };

      const clientIds = clientAircraft.map(ca => ca.client_id);

      // Get partners for these clients
      const { data: partners } = await (supabase as any)
        .from("client_partners")
        .select("id, name, client_id")
        .in("client_id", clientIds);

      return { partners: partners || [] };
    },
    enabled: !!aircraftId,
  });

  // Fetch logbook data grouped by client_partner_id
  const { data: flightData, isLoading } = useQuery({
    queryKey: ["oas-flight-hours-v2", aircraftId, periodoInicio, periodoFim],
    queryFn: async () => {
      let query = supabase
        .from("logbook_entries")
        .select("client_partner_id, entry_date, total_time")
        .eq("aircraft_id", aircraftId);

      if (periodoInicio) query = query.gte("entry_date", periodoInicio);
      if (periodoFim) query = query.lte("entry_date", periodoFim);

      const { data, error } = await query.order("entry_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!aircraftId && !!periodoInicio && !!periodoFim,
  });

  // Process flight data into partner hours
  const { partnerData, grandTotalMinutes, flightCount } = useMemo(() => {
    if (!flightData || flightData.length === 0) {
      return { partnerData: [] as PartnerHours[], grandTotalMinutes: 0, flightCount: 0 };
    }

    const partners = aircraftData?.partners || [];
    const partnerMap = new Map(partners.map((p: any) => [p.id, p.name]));

    // Group by client_partner_id
    const byPartner: Record<string, { name: string; minutes: number; isNonPartner: boolean }> = {};
    let total = 0;

    flightData.forEach((entry: any) => {
      const partnerId = entry.client_partner_id || "__shared__";
      const minutes = decimalToMinutes(entry.total_time || 0);

      if (!byPartner[partnerId]) {
        const name = partnerId === "__shared__"
          ? "OFICINA/TESTES"
          : (partnerMap.get(partnerId) as string) || "Desconhecido";
        byPartner[partnerId] = {
          name: name.toUpperCase(),
          minutes: 0,
          isNonPartner: partnerId === "__shared__",
        };
      }
      byPartner[partnerId].minutes += minutes;
      total += minutes;
    });

    const result: PartnerHours[] = Object.entries(byPartner).map(([pid, data]) => ({
      partner_id: pid === "__shared__" ? null : pid,
      partner_name: data.name,
      totalMinutes: data.minutes,
      percentage: total > 0 ? (data.minutes / total) * 100 : 0,
      valor: total > 0 ? (data.minutes / total) * totalGeral : 0,
      isNonPartner: data.isNonPartner,
    }));

    // Sort: partners first, then non-partners
    result.sort((a, b) => {
      if (a.isNonPartner && !b.isNonPartner) return 1;
      if (!a.isNonPartner && b.isNonPartner) return -1;
      return b.totalMinutes - a.totalMinutes;
    });

    return { partnerData: result, grandTotalMinutes: total, flightCount: flightData.length };
  }, [flightData, aircraftData, totalGeral]);

  // Calculate non-partner redistribution info
  const nonPartnerData = partnerData.filter(p => p.isNonPartner);
  const partnerOnlyData = partnerData.filter(p => !p.isNonPartner);
  const nonPartnerPct = nonPartnerData.reduce((s, p) => s + p.percentage, 0);
  const extraPerPartner = partnerOnlyData.length > 0 ? nonPartnerPct / partnerOnlyData.length : 0;

  const saveRateio = async () => {
    setSaving(true);
    try {
      await supabase.from("ctm_cost_sharing").delete().eq("service_order_id", orderId);

      const inserts = partnerData.map(p => ({
        service_order_id: orderId,
        client_id: p.partner_id,
        horas_voadas: p.totalMinutes / 60,
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

  // Color palette for percentage bar
  const barColors = [
    "bg-cyan-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500",
    "bg-rose-500", "bg-blue-500", "bg-orange-500",
  ];

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="bg-card/60 border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Selecionar período para análise</h3>
        <div className="flex flex-wrap items-end gap-4">
          {/* Data Inicial */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Data inicial</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !dateInicio && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateInicio ? format(dateInicio, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateInicio}
                  onSelect={setDateInicio}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Data Final */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Data final</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !dateFim && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFim ? format(dateFim, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFim}
                  onSelect={setDateFim}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {partnerData.length > 0 && (
            <Button size="default" onClick={saveRateio} disabled={saving} className="gap-1.5 bg-primary hover:bg-primary/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar para rateio
            </Button>
          )}
        </div>
      </div>

      {/* Flight Hours Table */}
      {partnerData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Horas por sócio — {flightCount} voos no período
            </h3>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-amber-500/90 text-black">
                  <th className="px-4 py-3 text-left font-bold border-r border-amber-600"></th>
                  {partnerData.map((p, i) => (
                    <th key={i} className="px-4 py-3 text-center font-bold border-r border-amber-600 uppercase">
                      {p.partner_name}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-bold uppercase">TOTAL VOADO</th>
                </tr>
              </thead>
              <tbody>
                {/* Horas row */}
                <tr className="bg-background border-b border-border">
                  <td className="px-4 py-3 font-semibold border-r border-border">Horas</td>
                  {partnerData.map((p, i) => (
                    <td key={i} className="px-4 py-3 text-center font-mono font-bold text-lg border-r border-border">
                      {formatHHMM(p.totalMinutes)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center font-mono font-bold text-lg">
                    {formatHHMM(grandTotalMinutes)}
                  </td>
                </tr>

                {/* Em minutos row */}
                <tr className="bg-muted/20 border-b border-border">
                  <td className="px-4 py-3 text-muted-foreground border-r border-border">Em minutos</td>
                  {partnerData.map((p, i) => (
                    <td key={i} className="px-4 py-3 text-center text-muted-foreground border-r border-border">
                      {p.totalMinutes.toLocaleString("pt-BR")} min
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center text-muted-foreground font-semibold">
                    {grandTotalMinutes.toLocaleString("pt-BR")} min
                  </td>
                </tr>

                {/* Percentual row */}
                <tr className="bg-background border-b border-border">
                  <td className="px-4 py-3 font-semibold border-r border-border">Percentual</td>
                  {partnerData.map((p, i) => (
                    <td key={i} className="px-4 py-3 text-center border-r border-border">
                      <Badge className={cn(
                        "font-bold text-sm",
                        p.isNonPartner
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                          : "bg-primary/20 text-primary border-primary/30"
                      )}>
                        {p.percentage.toFixed(2)}%
                      </Badge>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <Badge className="bg-foreground/10 text-foreground border-foreground/20 font-bold text-sm">100%</Badge>
                  </td>
                </tr>

                {/* Valor rateio row */}
                {totalGeral > 0 && (
                  <tr className="bg-primary/5 border-t-2 border-primary/20">
                    <td className="px-4 py-3 font-bold border-r border-border text-primary">Valor Rateio</td>
                    {partnerData.map((p, i) => (
                      <td key={i} className="px-4 py-3 text-center font-bold text-primary border-r border-border">
                        R$ {p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center font-bold text-primary">
                      R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Percentage Bar */}
          <div className="space-y-2">
            <div className="flex h-8 rounded-lg overflow-hidden">
              {partnerData.map((p, i) => (
                <div
                  key={i}
                  className={cn("flex items-center justify-center text-xs font-bold text-white", barColors[i % barColors.length])}
                  style={{ width: `${p.percentage}%` }}
                >
                  {p.percentage >= 8 && `${Math.round(p.percentage)}%`}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              {partnerData.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className={cn("w-3 h-3 rounded-sm", barColors[i % barColors.length])} />
                  <span className="text-muted-foreground">{p.partner_name} {p.percentage.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Non-partner redistribution note */}
          {nonPartnerData.length > 0 && partnerOnlyData.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-sm">
              <p>
                <strong className="text-amber-400">
                  {nonPartnerData.map(p => p.partner_name).join(", ")} ({nonPartnerPct.toFixed(2)}%)
                </strong>{" "}
                <span className="text-muted-foreground">
                  não entra como cota individual — esse percentual é dividido{" "}
                  <strong className="text-foreground">igualmente entre os {partnerOnlyData.length} sócios</strong>{" "}
                  no momento do rateio por horas. Cada sócio absorve +{extraPerPartner.toFixed(2)}% além da sua proporção de voo.
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {(!periodoInicio || !periodoFim) && (
        <div className="text-center py-12 text-muted-foreground">
          <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Selecione o período para calcular</p>
          <p className="text-xs mt-1">Escolha as datas de início e fim para buscar as horas voadas no logbook</p>
        </div>
      )}

      {periodoInicio && periodoFim && partnerData.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhuma hora voada encontrada no período</p>
          <p className="text-xs mt-1">
            {format(new Date(periodoInicio + "T12:00:00"), "dd/MM/yyyy")} até{" "}
            {format(new Date(periodoFim + "T12:00:00"), "dd/MM/yyyy")}
          </p>
        </div>
      )}

      {/* Existing Cost Sharing Status */}
      {costSharing.length > 0 && (
        <div className="space-y-3">
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
                  <TableCell>{cs.horas_voadas ? formatHHMM(decimalToMinutes(cs.horas_voadas)) : "-"}</TableCell>
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
