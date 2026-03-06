import React, { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MonthlyReportData, PartnerInfo, FlightEntry, FuelEntry, ExpenseEntry } from "@/hooks/useMonthlyPartnerReport";
import { HoursDonutChart, CostsBarChart, DailyFlightsChart, FlightNatureChart } from "./ReportCharts";
import { PartnerReportSection } from "./PartnerReportSection";

const PARTNER_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f97316", "#ec4899", "#14b8a6", "#6366f1", "#f59e0b"];

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCPF(cpf: string) {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11) return cpf;
  return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

interface Props {
  data: MonthlyReportData;
  month: string;
  includeCharts: boolean;
  includeFlights: boolean;
  includeFuels: boolean;
  includeExpenses: boolean;
  selectedPartnerIds: string[];
}

function assignFlightsToPartner(
  flights: FlightEntry[],
  partnerId: string,
  allPartners: PartnerInfo[]
): FlightEntry[] {
  return flights.filter((f) => {
    if (f.is_equal_split) return true; // shared among all
    if (f.client_partner_id === partnerId) return true;
    if (f.is_loan && f.loan_recipient_partner_id === partnerId) return true;
    return false;
  });
}

function assignFuelsToPartner(fuels: FuelEntry[], partnerName: string): FuelEntry[] {
  return fuels.filter((f) => f.partner_name === partnerName);
}

function assignExpensesToPartner(expenses: ExpenseEntry[], partnerName: string, partnerCpf: string): ExpenseEntry[] {
  return expenses.filter(
    (e) => e.assigned_partner_name === partnerName || e.assigned_partner_cpf === partnerCpf
  );
}

export function MonthlyPartnerReportPDF({ data, month, includeCharts, includeFlights, includeFuels, includeExpenses, selectedPartnerIds }: Props) {
  const monthLabel = format(new Date(month + "-01"), "MMMM yyyy", { locale: ptBR });
  const monthLabelUpper = monthLabel.toUpperCase();

  const activePartners = useMemo(() => {
    if (selectedPartnerIds.length === 0) return data.partners;
    return data.partners.filter((p) => selectedPartnerIds.includes(p.id));
  }, [data.partners, selectedPartnerIds]);

  // Compute per-partner data
  const partnerData = useMemo(() => {
    return activePartners.map((p) => {
      const pFlights = assignFlightsToPartner(data.flights, p.id, data.partners);
      const pFuels = assignFuelsToPartner(data.fuels, p.name);
      const pExpenses = assignExpensesToPartner(data.expenses, p.name, p.cpf);

      const hours = pFlights.reduce((s, f) => {
        if (f.is_equal_split) return s + (f.total_time || 0) / data.partners.length;
        return s + (f.total_time || 0);
      }, 0);

      const fuelTotal = pFuels.reduce((s, f) => s + (f.valor_total || 0), 0);
      const expTotal = pExpenses.reduce((s, e) => s + e.total_amount, 0);

      return { partner: p, flights: pFlights, fuels: pFuels, expenses: pExpenses, hours, fuelTotal, expTotal };
    });
  }, [activePartners, data]);

  const totalFlightHours = data.flights.reduce((s, f) => s + (f.total_time || 0), 0);
  const totalFuelLiters = data.fuels.reduce((s, f) => s + f.litros, 0);
  const totalFuelValue = data.fuels.reduce((s, f) => s + (f.valor_total || 0), 0);
  const totalExpenses = data.expenses.reduce((s, e) => s + e.total_amount, 0);
  const totalPousos = data.flights.reduce((s, f) => s + (f.pousos || 0), 0);
  const totalDayHours = data.flights.reduce((s, f) => s + (f.day_time || 0), 0);
  const totalNightHours = data.flights.reduce((s, f) => s + (f.night_hours || 0), 0);

  // Chart data
  const hoursChartData = partnerData.map((pd) => ({
    name: pd.partner.name.split(" ")[0],
    hours: pd.hours,
    percentage: totalFlightHours > 0 ? (pd.hours / totalFlightHours) * 100 : 0,
  }));

  const costsChartData = partnerData.map((pd) => ({
    name: pd.partner.name.split(" ")[0],
    abastecimento: pd.fuelTotal,
    despesas: pd.expTotal,
    total: pd.fuelTotal + pd.expTotal,
  }));

  const dailyFlightData = useMemo(() => {
    const days: Record<string, number> = {};
    const [year, mon] = month.split("-");
    const daysInMonth = new Date(parseInt(year), parseInt(mon), 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      days[String(d).padStart(2, "0")] = 0;
    }
    data.flights.forEach((f) => {
      const day = f.entry_date.slice(8, 10);
      days[day] = (days[day] || 0) + (f.total_time || 0);
    });
    return Object.entries(days).map(([day, hours]) => ({ day, hours }));
  }, [data.flights, month]);

  const flightNatureData = useMemo(() => {
    const natures: Record<string, number> = {};
    data.flights.forEach((f) => {
      natures[f.flight_nature] = (natures[f.flight_nature] || 0) + 1;
    });
    return Object.entries(natures).map(([name, value]) => ({ name, value }));
  }, [data.flights]);

  return (
    <div className="bg-white text-gray-900" style={{ fontFamily: "Helvetica, Arial, sans-serif", fontSize: "11px", lineHeight: 1.5 }}>
      {/* CAPA */}
      <div className="p-8 min-h-[600px]">
        {/* Header com faixa navy */}
        <div className="bg-[#1a1a2e] text-white rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/logo.share.png" alt="Logo" className="h-12 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">SHARE BRASIL</h1>
                <p className="text-sm text-gray-300">Gestão de Aeronaves Compartilhadas</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black tracking-tight">{monthLabelUpper}</p>
              <p className="text-xs text-gray-300 mt-1">Relatório Mensal por Sócio</p>
            </div>
          </div>
        </div>

        {/* Info cliente */}
        <div className="mb-8 border-b-2 border-[#e2e8f0] pb-4">
          <h2 className="text-lg font-bold text-[#1a1a2e]">{data.clientName}</h2>
          <p className="text-sm text-gray-500">
            CNPJ/CPF: {data.clientCnpj || "—"}
            {data.aircraft && ` • Aeronave: ${data.aircraft.manufacturer} ${data.aircraft.model} - ${data.aircraft.registration}`}
          </p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: "Total de Voos", value: String(data.flights.length), sub: "voos no mês" },
            { label: "Horas Voadas", value: `${totalFlightHours.toFixed(1)}h`, sub: "total acumulado" },
            { label: "Combustível", value: `${totalFuelLiters.toFixed(0)}L`, sub: fmt(totalFuelValue) },
            { label: "Despesas", value: fmt(totalExpenses), sub: "total geral" },
            { label: "Diurno / Noturno", value: `${totalDayHours.toFixed(1)}h / ${totalNightHours.toFixed(1)}h`, sub: "horas" },
            { label: "Total Pousos", value: String(totalPousos), sub: "pousos registrados" },
          ].map((card) => (
            <div key={card.label} className="bg-[#f8fafc] rounded-lg p-4 border border-[#e2e8f0]">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{card.label}</p>
              <p className="text-lg font-black text-[#1a1a2e] mt-1">{card.value}</p>
              <p className="text-[10px] text-gray-400">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabela resumo por sócio */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-[#1a1a2e] uppercase tracking-wider mb-3">Resumo por Sócio</h3>
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-[#1a1a2e] text-white">
                {["Sócio", "% Part.", "Horas", "Abast. R$", "Despesas R$", "Total R$"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partnerData.map((pd, i) => (
                <tr key={pd.partner.id} className={i % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}>
                  <td className="px-3 py-2 border-b border-[#e2e8f0] font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PARTNER_COLORS[i % PARTNER_COLORS.length] }} />
                    {pd.partner.name}
                  </td>
                  <td className="px-3 py-2 border-b border-[#e2e8f0]">{pd.partner.share_percentage?.toFixed(2) || "0"}%</td>
                  <td className="px-3 py-2 border-b border-[#e2e8f0]">{pd.hours.toFixed(1)}h</td>
                  <td className="px-3 py-2 border-b border-[#e2e8f0]">{fmt(pd.fuelTotal)}</td>
                  <td className="px-3 py-2 border-b border-[#e2e8f0]">{fmt(pd.expTotal)}</td>
                  <td className="px-3 py-2 border-b border-[#e2e8f0] font-bold">{fmt(pd.fuelTotal + pd.expTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GRÁFICOS */}
      {includeCharts && data.flights.length > 0 && (
        <div className="p-8" style={{ pageBreakBefore: "always", breakBefore: "page" }}>
          <div className="bg-[#1a1a2e] text-white rounded-t-lg px-6 py-3 mb-6 flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wider">Análise Gráfica</span>
            <span className="text-xs text-gray-300">{data.clientName} • {monthLabelUpper}</span>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <HoursDonutChart data={hoursChartData} />
            <CostsBarChart data={costsChartData} />
            <DailyFlightsChart data={dailyFlightData} />
            <FlightNatureChart data={flightNatureData} />
          </div>
        </div>
      )}

      {/* SEÇÕES POR SÓCIO */}
      {partnerData.map((pd, i) => (
        <div key={pd.partner.id} className="p-8">
          <div className="bg-[#1a1a2e] text-white rounded-t-lg px-6 py-3 mb-6 flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wider">Detalhamento — {pd.partner.name}</span>
            <span className="text-xs text-gray-300">{data.clientName} • {monthLabelUpper}</span>
          </div>
          <PartnerReportSection
            partner={pd.partner}
            index={i}
            flights={includeFlights ? pd.flights : []}
            fuels={includeFuels ? pd.fuels : []}
            expenses={includeExpenses ? pd.expenses : []}
            allPartners={data.partners}
            month={month}
            totalFlightHours={totalFlightHours}
          />
        </div>
      ))}
    </div>
  );
}
