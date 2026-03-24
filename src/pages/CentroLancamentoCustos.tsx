import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  Plane,
  Fuel,
  DollarSign,
  ArrowLeft,
  CalendarDays,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMonthlyPartnerReport } from "@/hooks/useMonthlyPartnerReport";
import { useClientesComSocios } from "@/hooks/useSocioBalanco";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const COST_CENTER_EXCLUDED_CATEGORIES = [
  "TARIFAS BANCARIAS",
  "TARIFA DE MANUTENÇÃO DE CONTA",
  "TARIFA PIX TED/DOC",
  "IOF",
  "JUROS BANCÁRIOS",
  "SEGUROS BANCÁRIOS",
  "OUTRAS TAXAS BANCÁRIAS",
];

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function shouldIncludeInCostCenter(category: string) {
  const normalized = (category || "").toUpperCase();
  return !COST_CENTER_EXCLUDED_CATEGORIES.some((item) => item === normalized);
}

function fmtTime(decimal: number): string {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

const PARTNER_COLORS = ["#3b82f6", "#f59e0b", "#8b5cf6", "#10b981", "#ef4444", "#06b6d4"];

export default function CentroLancamentoCustos() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [filterPartner, setFilterPartner] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const { data: clientesComSocios = [] } = useClientesComSocios();
  const { data: reportData, isLoading } = useMonthlyPartnerReport(clienteId || null, month);

  const selectedClient = useMemo(
    () => clientesComSocios.find((c) => c.id === clienteId),
    [clientesComSocios, clienteId]
  );

  const selectedMonthIndex = parseInt(month.split("-")[1]) - 1;
  const monthDate = new Date(parseInt(month.split("-")[0]), selectedMonthIndex, 15);
  const monthLabel = format(monthDate, "MMMM yyyy", { locale: ptBR });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const handleSelectMonth = (idx: number) => {
    setMonth(`${pickerYear}-${String(idx + 1).padStart(2, "0")}`);
    setMonthPickerOpen(false);
  };

  // Aircraft info
  const aircraft = reportData?.aircraft;
  const partners = reportData?.partners || [];

  // Build the "Diário Espelho" - flight log mirror with cost assignments
  const flightMirror = useMemo(() => {
    if (!reportData) return [];
    return reportData.flights.map((f) => {
      const assignedPartner = partners.find((p) => p.id === f.client_partner_id);
      const loanPartner = f.is_loan ? partners.find((p) => p.id === f.loan_recipient_partner_id) : null;
      return {
        ...f,
        partner_name: assignedPartner?.name || "Não atribuído",
        loan_partner_name: loanPartner?.name || null,
      };
    });
  }, [reportData, partners]);

  // Build the expense pivot by category x partner (like the spreadsheet)
  const expensePivot = useMemo(() => {
    if (!reportData) return { rows: [], partnerNames: [] as string[], totals: {} as Record<string, number> };

    const partnerNames = ["DGA ADM", ...partners.map((p) => p.name)];
    const categoryMap: Record<string, Record<string, number>> = {};

    // Partner expenses
    reportData.expenses.forEach((e) => {
      const cat = (e.expense_type || e.category || "Outros").toUpperCase();
      if (!shouldIncludeInCostCenter(cat)) return;
      if (!categoryMap[cat]) categoryMap[cat] = {};
      const pName = e.assigned_partner_name || "DGA ADM";
      categoryMap[cat][pName] = (categoryMap[cat][pName] || 0) + e.total_amount;
    });

    // Shared expenses (no partner)
    reportData.sharedExpenses.forEach((e) => {
      const cat = (e.expense_type || e.category || "Outros").toUpperCase();
      if (!shouldIncludeInCostCenter(cat)) return;
      if (!categoryMap[cat]) categoryMap[cat] = {};
      categoryMap[cat]["DGA ADM"] = (categoryMap[cat]["DGA ADM"] || 0) + e.total_amount;
    });

    // Fuels
    if (reportData.fuels.length > 0) {
      const cat = "COMBUSTÍVEIS";
      if (!categoryMap[cat]) categoryMap[cat] = {};
      reportData.fuels.forEach((fuel) => {
        const pName = fuel.partner_name || fuel.observacao?.match(/\[Partner:([^\]]+)\]/i)?.[1] || "DGA ADM";
        const total = fuel.valor_total || fuel.litros * fuel.valor_unitario;
        categoryMap[cat][pName] = (categoryMap[cat][pName] || 0) + total;
      });
    }

    const totals: Record<string, number> = {};
    partnerNames.forEach((n) => (totals[n] = 0));
    let grandTotal = 0;

    const rows = Object.entries(categoryMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, byPartner]) => {
        let rowTotal = 0;
        const values: Record<string, number> = {};
        partnerNames.forEach((n) => {
          const v = byPartner[n] || 0;
          values[n] = v;
          totals[n] += v;
          rowTotal += v;
        });
        grandTotal += rowTotal;
        return { category, values, total: rowTotal };
      });

    return { rows, partnerNames, totals, grandTotal };
  }, [reportData, partners]);

  // Chart data by category per partner
  const chartData = useMemo(() => {
    return expensePivot.rows.map((row) => ({
      category: row.category,
      ...row.values,
    }));
  }, [expensePivot]);

  // Filtered flights
  const filteredFlights = useMemo(() => {
    let result = flightMirror;
    if (filterPartner !== "all") {
      result = result.filter((f) => f.partner_name === filterPartner);
    }
    return result;
  }, [flightMirror, filterPartner]);

  // Totals
  const flightTotals = useMemo(() => {
    const totalTime = filteredFlights.reduce((s, f) => s + (f.total_time || 0), 0);
    const totalDist = filteredFlights.reduce((s, f) => s + (f.distance_nm || 0), 0);
    const totalFuel = filteredFlights.reduce((s, f) => s + (f.fuel_consu || 0), 0);
    return { totalTime, totalDist, totalFuel, count: filteredFlights.length };
  }, [filteredFlights]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Centro de Lançamento de Custos
              </h1>
              <p className="text-sm text-muted-foreground">
                {selectedClient?.company_name || selectedClient?.proprietario || ""}
                {aircraft && ` • ${aircraft.registration} — ${aircraft.manufacturer} ${aircraft.model}`}
              </p>
            </div>
          </div>
          {/* Month Picker */}
          <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 font-medium">
                <CalendarDays className="h-4 w-4 text-primary" />
                {monthLabelCap}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-3 pointer-events-auto" align="end">
              <div className="flex items-center justify-between mb-3">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPickerYear((y) => y - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold text-sm">{pickerYear}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPickerYear((y) => y + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS_FULL.map((name, idx) => {
                  const isSel = pickerYear === parseInt(month.split("-")[0]) && idx === selectedMonthIndex;
                  return (
                    <Button key={idx} variant={isSel ? "default" : "ghost"} size="sm" className="text-xs h-9" onClick={() => handleSelectMonth(idx)}>
                      {name.slice(0, 3)}
                    </Button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={filterPartner} onValueChange={setFilterPartner}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os sócios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Sócios</SelectItem>
              {partners.map((p) => (
                <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
              ))}
              <SelectItem value="Não atribuído">Não atribuído</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              {expensePivot.rows.map((r) => (
                <SelectItem key={r.category} value={r.category}>{r.category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Plane className="h-3.5 w-3.5" /> VOOS
              </div>
              <p className="text-2xl font-bold">{flightTotals.count}</p>
              <p className="text-xs text-muted-foreground">{fmtTime(flightTotals.totalTime)} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Fuel className="h-3.5 w-3.5" /> COMBUSTÍVEL
              </div>
              <p className="text-2xl font-bold">{flightTotals.totalFuel.toLocaleString("pt-BR")} L</p>
              <p className="text-xs text-muted-foreground">{flightTotals.totalDist.toLocaleString("pt-BR")} NM</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <DollarSign className="h-3.5 w-3.5" /> CUSTO TOTAL
              </div>
              <p className="text-2xl font-bold">{fmt(expensePivot.grandTotal || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <DollarSign className="h-3.5 w-3.5" /> CUSTO/HORA
              </div>
              <p className="text-2xl font-bold">
                {flightTotals.totalTime > 0 ? fmt((expensePivot.grandTotal || 0) / flightTotals.totalTime) : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Diário Espelho */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plane className="h-4 w-4 text-primary" />
              Diário Espelho — {aircraft?.registration || ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-bold">Data</TableHead>
                    <TableHead className="text-xs font-bold">De</TableHead>
                    <TableHead className="text-xs font-bold">Para</TableHead>
                    <TableHead className="text-xs font-bold text-center">Total</TableHead>
                    <TableHead className="text-xs font-bold text-center">Dist.</TableHead>
                    <TableHead className="text-xs font-bold text-center">Abast.</TableHead>
                    <TableHead className="text-xs font-bold">CMT</TableHead>
                    <TableHead className="text-xs font-bold">COP</TableHead>
                    <TableHead className="text-xs font-bold">Sócio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                    </TableRow>
                  ) : filteredFlights.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum voo no período</TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {filteredFlights.map((f) => (
                        <TableRow key={f.id} className="text-xs">
                          <TableCell className="font-medium">{format(new Date(f.entry_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{f.departure_aerodrome}</TableCell>
                          <TableCell>{f.arrival_aerodrome}</TableCell>
                          <TableCell className="text-center font-mono">{f.total_time ? fmtTime(f.total_time) : "—"}</TableCell>
                          <TableCell className="text-center">{f.distance_nm?.toLocaleString("pt-BR") || "—"}</TableCell>
                          <TableCell className="text-center">{f.fuel_consu?.toLocaleString("pt-BR") || "—"}</TableCell>
                          <TableCell>{f.pic_name || "—"}</TableCell>
                          <TableCell>{f.passengers ? `${f.passengers} PAX` : "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                              {f.partner_name}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals row */}
                      <TableRow className="bg-muted/50 font-bold text-xs">
                        <TableCell colSpan={3}>Total</TableCell>
                        <TableCell className="text-center font-mono">{fmtTime(flightTotals.totalTime)}</TableCell>
                        <TableCell className="text-center">{flightTotals.totalDist.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-center">{flightTotals.totalFuel.toLocaleString("pt-BR")}</TableCell>
                        <TableCell colSpan={3}></TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Análise de Custo - Pivot Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Análise de Custo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-bold">Categoria</TableHead>
                    {expensePivot.partnerNames.map((name) => (
                      <TableHead key={name} className="text-xs font-bold text-right">{name}</TableHead>
                    ))}
                    <TableHead className="text-xs font-bold text-right">Total Geral</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filterCategory === "all" ? expensePivot.rows : expensePivot.rows.filter((r) => r.category === filterCategory)).map((row) => (
                    <TableRow key={row.category} className="text-xs">
                      <TableCell className="font-semibold">{row.category}</TableCell>
                      {expensePivot.partnerNames.map((name) => (
                        <TableCell key={name} className="text-right font-mono">
                          {row.values[name] ? fmt(row.values[name]) : "—"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-mono font-bold">{fmt(row.total)}</TableCell>
                    </TableRow>
                  ))}
                  {filterCategory === "all" && (
                    <TableRow className="bg-primary/10 font-bold text-xs">
                      <TableCell>Total Geral</TableCell>
                      {expensePivot.partnerNames.map((name) => (
                        <TableCell key={name} className="text-right font-mono">{fmt(expensePivot.totals[name] || 0)}</TableCell>
                      ))}
                      <TableCell className="text-right font-mono">{fmt(expensePivot.grandTotal || 0)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Custos por Categoria e Sócio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => fmt(value)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {expensePivot.partnerNames.map((name, i) => (
                      <Bar key={name} dataKey={name} fill={PARTNER_COLORS[i % PARTNER_COLORS.length]} stackId="a" />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
