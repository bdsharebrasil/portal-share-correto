// @ts-nocheck
"use client";

import React, { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MonthlyReportData, PartnerInfo, FlightEntry, FuelEntry, ExpenseEntry, TravelReportEntry, BankControlEntry } from "@/hooks/useMonthlyPartnerReport";
import { HoursDonutChart, CostsBarChart } from "./ReportCharts";
import { PartnerReportSection } from "./PartnerReportSection";

const PARTNER_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f97316", "#ec4899", "#14b8a6", "#6366f1", "#f59e0b"];

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string) {
  try { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}

export type ReportFilter = "todos" | "voos" | "abastecimentos" | "despesas" | "viagens";

interface Props {
  data: MonthlyReportData;
  month: string;
  includeCharts: boolean;
  includeFlights: boolean;
  includeFuels: boolean;
  includeExpenses: boolean;
  selectedPartnerIds: string[];
  isInlinePreview?: boolean;
  activeFilter?: ReportFilter;
}

function assignFlightsToPartner(flights: FlightEntry[], partnerId: string, allPartners: PartnerInfo[]): FlightEntry[] {
  return flights.filter((f) => {
    if (f.is_equal_split) return true;
    if (f.client_partner_id === partnerId) return true;
    if (f.is_loan && f.loan_recipient_partner_id === partnerId) return true;
    return false;
  });
}

function assignFuelsToPartner(fuels: FuelEntry[], partnerName: string): FuelEntry[] {
  return fuels.filter((f) => f.partner_name === partnerName);
}

function assignExpensesToPartner(expenses: ExpenseEntry[], partnerName: string, partnerCpf: string): ExpenseEntry[] {
  return expenses.filter((e) => e.assigned_partner_name === partnerName || e.assigned_partner_cpf === partnerCpf);
}

function assignTravelReportsToPartner(travelReports: TravelReportEntry[], partnerId: string): TravelReportEntry[] {
  return travelReports.filter((r) => r.socio_cliente_id === partnerId);
}

function assignBankControlExpensesToPartner(expenses: BankControlEntry[], partnerId: string): BankControlEntry[] {
  return expenses.filter((e) => e.socios_cliente_id === partnerId);
}

export function MonthlyPartnerReportPDF({ 
  data, 
  month, 
  includeCharts, 
  includeFlights, 
  includeFuels, 
  includeExpenses, 
  selectedPartnerIds, 
  isInlinePreview = false,
  activeFilter = "todos",
}: Props) {
  
  const [yearStr, mmStr] = month.split("-");
  const monthDate = new Date(parseInt(yearStr), parseInt(mmStr) - 1, 15, 12, 0, 0);
  const monthLabel = format(monthDate, "MMMM", { locale: ptBR });
  const monthLabelUpper = monthLabel.toUpperCase();
  const yearShort = yearStr.slice(2);

  // Date range from actual data
  const dateRangeLabel = useMemo(() => {
    const first = data.dateRange?.firstEntryDate;
    const last = data.dateRange?.lastEntryDate;
    if (first && last) {
      const d1 = new Date(first + "T12:00:00").getDate();
      const d2 = new Date(last + "T12:00:00").getDate();
      return `dos dias ${String(d1).padStart(2, '0')} a ${String(d2).padStart(2, '0')}`;
    }
    return "";
  }, [data.dataRange]);

  // Filter logic
  const shouldShowFlights = activeFilter === "todos" || activeFilter === "voos";
  const shouldShowFuels = activeFilter === "todos" || activeFilter === "abastecimentos";
  const shouldShowExpenses = activeFilter === "todos" || activeFilter === "despesas";
  const shouldShowTravel = activeFilter === "todos" || activeFilter === "viagens";

  const activePartners = useMemo(() => {
    if (selectedPartnerIds.length === 0) return data.partners;
    return data.partners.filter((p) => selectedPartnerIds.includes(p.id));
  }, [data.partners, selectedPartnerIds]);

  const partnerData = useMemo(() => {
    return activePartners.map((p) => {
      const pFlights = assignFlightsToPartner(data.flights, p.id, data.partners);
      const pFuels = assignFuelsToPartner(data.fuels, p.nome);
      const pExpenses = assignExpensesToPartner(data.expenses, p.nome, p.cpf);
      const pBankControl = assignBankControlExpensesToPartner(data.bankControlExpenses, p.id);
      const pTravelReports = assignTravelReportsToPartner(data.travelReports || [], p.id);

      const hours = pFlights.reduce((s, f) => {
        if (f.is_equal_split) return s + (f.total_time || 0) / data.partners.length;
        return s + (f.total_time || 0);
      }, 0);

      const fuelTotal = pFuels.reduce((s, f) => s + (f.valor_total || 0), 0);
      const fuelLiters = pFuels.reduce((s, f) => s + f.litros, 0);
      const expTotal = pExpenses.reduce((s, e) => s + e.total_amount, 0);
      const bankControlTotal = pBankControl.reduce((s, e) => s + e.valor, 0);
      const travelTotal = pTravelReports.reduce((s, r) => s + (r.total_amount || 0), 0);

      return { partner: p, flights: pFlights, fuels: pFuels, expenses: pExpenses, bankControlExpenses: pBankControl, travelReports: pTravelReports, hours, fuelTotal, fuelLiters, expTotal, bankControlTotal, travelTotal };
    });
  }, [activePartners, data]);

  // Totals
  const totalFlightHours = data.flights.reduce((s, f) => s + (f.total_time || 0), 0);
  const totalFuelLiters = data.fuels.reduce((s, f) => s + f.litros, 0);
  const totalFuelValue = data.fuels.reduce((s, f) => s + (f.valor_total || 0), 0);
  const totalExpenses = data.expenses.reduce((s, e) => s + e.total_amount, 0);
  const totalBankControl = data.bankControlExpenses.reduce((s, e) => s + e.valor, 0);
  const totalTravelReports = (data.travelReports || []).reduce((s, r) => s + (r.total_amount || 0), 0);
  const totalSharedExpenses = (data.sharedExpenses || []).reduce((s, e) => s + e.total_amount, 0);

  // Averages
  const avgFuelPerLiter = totalFuelLiters > 0 ? totalFuelValue / totalFuelLiters : 0;
  const avgFuelPerHour = totalFlightHours > 0 ? totalFuelValue / totalFlightHours : 0;
  const avgExpPerHour = totalFlightHours > 0 ? (totalExpenses + totalBankControl) / totalFlightHours : 0;
  const costPerHour = totalFlightHours > 0 ? (totalFuelValue + totalExpenses + totalBankControl + totalTravelReports) / totalFlightHours : 0;
  const hourlyRate = data.hourlyRate || 0;

  // Chart data
  const hoursChartData = partnerData.map((pd) => ({
    name: pd.partner.nome.split(" ")[0],
    hours: pd.hours,
    percentage: totalFlightHours > 0 ? (pd.hours / totalFlightHours) * 100 : 0,
  }));

  const costsChartData = partnerData.map((pd) => ({
    name: pd.partner.nome.split(" ")[0],
    combustivel: pd.fuelTotal,
    despesas: pd.expTotal + pd.bankControlTotal + pd.travelTotal,
    total: pd.fuelTotal + pd.expTotal + pd.bankControlTotal + pd.travelTotal,
  }));

  // Shared expenses by category
  const formatCategoryLabel = (cat: string) => {
    return cat.replace(/_/g, ' ').toUpperCase();
  };

  const sharedByCategory: Record<string, { items: typeof data.sharedExpenses; total: number }> = {};
  (data.sharedExpenses || []).forEach(e => {
    const rawCat = e.categoria || e.expense_type || "Outros";
    const cat = formatCategoryLabel(rawCat);
    if (!sharedByCategory[cat]) sharedByCategory[cat] = { items: [], total: 0 };
    sharedByCategory[cat].items.push(e);
    sharedByCategory[cat].total += e.total_amount;
  });

  return (
    <div className="bg-white text-gray-900 print:p-0" style={{ fontFamily: "Inter, Helvetica, sans-serif", fontSize: "11px" }}>
      
      {/* ===== CAPA E RESUMO GERAL ===== */}
      <div className="p-8" style={{ pageBreakAfter: "always", pageBreakInside: "avoid" }}>
        
        {/* HEADER */}
        <div className="bg-[#1a1a2e] text-white rounded-xl p-8 mb-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="bg-white/10 p-2 rounded-lg">
                <img 
                  src="/logoshare.branco.png" 
                  alt="Logo Share Brasil" 
                  className="h-14 w-auto object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                />
              </div>
              <div className="border-l border-white/20 pl-6">
                <h1 className="text-3xl font-black tracking-tighter">SHARE BRASIL</h1>
                <p className="text-xs font-medium text-blue-300 uppercase tracking-widest">Compartilhamento de Aeronaves</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-white">{monthLabelUpper}/{yearShort}</p>
              <div className="bg-blue-500 h-1 w-24 ml-auto my-2"></div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                Relatório Financeiro {dateRangeLabel && `• ${dateRangeLabel}`}
              </p>
            </div>
          </div>
        </div>

        {/* CLIENT / AIRCRAFT INFO */}
        <div className="mb-8 grid grid-cols-2 gap-4 border-b pb-6 border-gray-200">
          <div>
            <h2 className="text-xl font-black text-[#1a1a2e] uppercase">{data.clientName}</h2>
            <p className="text-sm text-gray-500 font-medium">Doc: {data.clientCnpj || "—"}</p>
          </div>
          <div className="text-right">
            {data.aeronave && (
              <p className="text-lg font-bold text-gray-700">
                {data.aeronave.matricula} <span className="text-gray-400 font-normal">| {data.aeronave.modelo}</span>
              </p>
            )}
            {hourlyRate > 0 && (
              <p className="text-sm text-gray-500">Preço Hora: <span className="font-bold text-[#1a1a2e]">{fmt(hourlyRate)}/h</span></p>
            )}
          </div>
        </div>

        {/* CARD DE RESUMO - apenas horas voadas */}
        <div className="grid grid-cols-2 gap-4 mb-8" style={{ breakInside: "avoid" }}>
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Horas Voadas</p>
            <p className="text-xl font-black text-[#1a1a2e]">{totalFlightHours.toFixed(1)}h</p>
            <p className="text-[10px] font-semibold text-blue-600">{data.flights.length} voos</p>
          </div>
          {hourlyRate > 0 && (
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Preço Hora Voo</p>
              <p className="text-xl font-black text-[#1a1a2e]">{fmt(hourlyRate)}</p>
              <p className="text-[10px] font-semibold text-blue-600">valor/hora</p>
            </div>
          )}
        </div>

        {/* TABELA RESUMO POR SÓCIO */}
        <div className="mb-8" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
            <h3 className="text-sm font-black text-[#1a1a2e] uppercase">Divisão de Custos por Sócio</h3>
          </div>
          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 border-b border-gray-200">
                  {["Sócio", "Quota", "Horas", "Combustível R$", "Despesas R$", "Custo/Hora", "Total Devido"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left font-bold uppercase tracking-tighter">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partnerData.map((pd, i) => {
                  const partnerDespesas = pd.expTotal + pd.travelTotal;
                  const partnerTotal = pd.fuelTotal + partnerDespesas;
                  const partnerCostPerHour = pd.hours > 0 ? partnerTotal / pd.hours : 0;
                  return (
                    <tr key={pd.partner.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-3 font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PARTNER_COLORS[i % PARTNER_COLORS.length] }} />
                        {pd.partner.nome}
                      </td>
                      <td className="px-3 py-3 text-gray-500">{pd.partner.percentual_participacao?.toFixed(1) || "0"}%</td>
                      <td className="px-3 py-3 font-medium">{pd.hours.toFixed(1)}h</td>
                      <td className="px-3 py-3">{fmt(pd.fuelTotal)}</td>
                      <td className="px-3 py-3">{fmt(partnerDespesas)}</td>
                      <td className="px-3 py-3 text-gray-500">{fmt(partnerCostPerHour)}/h</td>
                      <td className="px-3 py-3 font-black text-blue-700">{fmt(partnerTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#1a1a2e] text-white font-bold">
                  <td className="px-3 py-2" colSpan={2}>TOTAL</td>
                  <td className="px-3 py-2">{totalFlightHours.toFixed(1)}h</td>
                  <td className="px-3 py-2">{fmt(totalFuelValue)}</td>
                  <td className="px-3 py-2">{fmt(totalExpenses + totalTravelReports)}</td>
                  <td className="px-3 py-2">{fmt(costPerHour)}/h</td>
                  <td className="px-3 py-2">{fmt(totalFuelValue + totalExpenses + totalTravelReports)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* COMPARATIVO DE MÉDIAS POR SÓCIO */}
        {partnerData.length > 1 && (
          <div style={{ breakInside: "avoid", pageBreakInside: "avoid", marginBottom: "2rem" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-purple-600 rounded-full"></div>
              <h3 className="text-sm font-black text-[#1a1a2e] uppercase">Comparativo de Médias</h3>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 border-b border-gray-200">
                    {["Sócio", "Média Combust./h", "Média Desp./h", "Média L/hora", "% Horas", "% Custo"].map(h => (
                      <th key={h} className="px-3 py-3 text-left font-bold uppercase tracking-tighter">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {partnerData.map((pd, i) => {
                    const partnerTotal = pd.fuelTotal + pd.expTotal + pd.travelTotal;
                    const totalCost = totalFuelValue + totalExpenses + totalTravelReports;
                    return (
                      <tr key={pd.partner.id} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-bold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PARTNER_COLORS[i % PARTNER_COLORS.length] }} />
                          {pd.partner.nome.split(" ")[0]}
                        </td>
                        <td className="px-3 py-2">{pd.hours > 0 ? fmt(pd.fuelTotal / pd.hours) : "—"}</td>
                        <td className="px-3 py-2">{pd.hours > 0 ? fmt((pd.expTotal + pd.travelTotal) / pd.hours) : "—"}</td>
                        <td className="px-3 py-2">{pd.hours > 0 ? `${(pd.fuelLiters / pd.hours).toFixed(1)}L` : "—"}</td>
                        <td className="px-3 py-2">{totalFlightHours > 0 ? `${((pd.hours / totalFlightHours) * 100).toFixed(1)}%` : "—"}</td>
                        <td className="px-3 py-2">{totalCost > 0 ? `${((partnerTotal / totalCost) * 100).toFixed(1)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ===== GRÁFICOS ===== */}
      {includeCharts && data.flights.length > 0 && (
        <div className="p-8" style={{ pageBreakBefore: "always", pageBreakAfter: "always", pageBreakInside: "avoid" }}>
          <div className="bg-[#1a1a2e] text-white rounded-t-xl px-6 py-4 mb-6 flex items-center justify-between">
            <span className="text-sm font-black uppercase tracking-widest italic">Análise de Performance Operacional</span>
            <span className="text-[10px] text-blue-300 font-bold">{data.clientName} • {monthLabelUpper}/{yearShort}</span>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div style={{ breakInside: "avoid", pageBreakInside: "avoid" }}><HoursDonutChart data={hoursChartData} /></div>
            <div style={{ breakInside: "avoid", pageBreakInside: "avoid" }}><CostsBarChart data={costsChartData} /></div>
          </div>
        </div>
      )}

      {/* ===== DETALHAMENTO POR SÓCIO ===== */}
      {partnerData.map((pd, i) => (
        <div key={pd.partner.id} className="p-8" style={{ pageBreakBefore: "always", pageBreakInside: "avoid" }}>
          <div className="flex items-center justify-between border-b-2 border-[#1a1a2e] pb-2 mb-6">
            <div>
              <h2 className="text-2xl font-black text-[#1a1a2e] uppercase">{pd.partner.nome}</h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Extrato de Utilização Detalhado</p>
            </div>
            <div className="text-right">
              <span className="bg-[#1a1a2e] text-white px-3 py-1 rounded text-[10px] font-bold tracking-tighter">
                {monthLabelUpper}/{yearShort} {dateRangeLabel && `• ${dateRangeLabel}`}
              </span>
            </div>
          </div>

          {/* KPIs rápidos do sócio */}
          <div className="grid grid-cols-4 gap-3 mb-4" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
            {[
              { label: "Horas Voadas", value: `${pd.hours.toFixed(1)}h` },
              { label: "Combustível", value: `${pd.fuelLiters.toFixed(0)}L`, sub: fmt(pd.fuelTotal) },
              { label: "Despesas", value: fmt(pd.expTotal + pd.bankControlTotal + pd.travelTotal) },
              { label: "Custo Total", value: fmt(pd.fuelTotal + pd.expTotal + pd.bankControlTotal + pd.travelTotal) },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{k.label}</p>
                <p className="text-base font-black text-[#1a1a2e]">{k.value}</p>
                {'sub' in k && k.sub && <p className="text-[10px] font-semibold text-blue-600">{k.sub}</p>}
              </div>
            ))}
          </div>

          {/* Médias individuais do sócio */}
          <div className="grid grid-cols-4 gap-3 mb-6" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
            {[
              { label: "Média Combustível/L", value: pd.fuelLiters > 0 ? fmt(pd.fuelTotal / pd.fuelLiters) : "—" },
              { label: "Combustível/Hora", value: pd.hours > 0 ? fmt(pd.fuelTotal / pd.hours) : "—" },
              { label: "Despesa/Hora", value: pd.hours > 0 ? fmt((pd.expTotal + pd.bankControlTotal + pd.travelTotal) / pd.hours) : "—" },
              { label: "Custo Total/Hora", value: pd.hours > 0 ? fmt((pd.fuelTotal + pd.expTotal + pd.bankControlTotal + pd.travelTotal) / pd.hours) : "—" },
            ].map(item => (
              <div key={item.label} className="bg-blue-50 rounded-lg p-2 border border-blue-100 text-center">
                <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">{item.label}</p>
                <p className="text-sm font-black text-[#1a1a2e]">{item.value}</p>
              </div>
            ))}
          </div>
          
          <PartnerReportSection
            partner={pd.partner}
            index={i}
            flights={shouldShowFlights && includeFlights ? pd.flights : []}
            fuels={shouldShowFuels && includeFuels ? pd.fuels : []}
            expenses={shouldShowExpenses && includeExpenses ? pd.expenses : []}
            bankControlExpenses={shouldShowExpenses && includeExpenses ? pd.bankControlExpenses : []}
            travelReports={shouldShowTravel ? pd.travelReports : []}
            allPartners={data.partners}
            month={month}
            totalFlightHours={totalFlightHours}
          />
          
          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-100 flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase">
            <span>Share Brasil - Gestão Compartilhada</span>
            <span>Página {i + (includeCharts && data.flights.length > 0 ? 3 : 2)}</span>
          </div>
        </div>
      ))}

      {/* ===== DESPESAS COMPARTILHADAS / CONTA COMPARTILHADA ===== */}
      {(data.sharedExpenses || []).length > 0 && (
        <div className="p-8" style={{ pageBreakBefore: "always", pageBreakInside: "avoid" }}>
          <div className="flex items-center justify-between border-b-2 border-[#1a1a2e] pb-2 mb-6">
            <div>
              <h2 className="text-2xl font-black text-[#1a1a2e] uppercase">Conta Compartilhada</h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Tarifas Bancárias, Impostos e Despesas Gerais</p>
            </div>
            <div className="text-right">
              <span className="bg-[#1a1a2e] text-white px-3 py-1 rounded text-[10px] font-bold tracking-tighter">
                {monthLabelUpper}/{yearShort}
              </span>
            </div>
          </div>

          {/* Resumo por categoria */}
          <div className="grid grid-cols-3 gap-4 mb-6" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
            {Object.entries(sharedByCategory).map(([cat, info]) => (
              <div key={cat} className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">{cat}</p>
                <p className="text-lg font-black text-[#1a1a2e]">{fmt(info.total)}</p>
                <p className="text-[10px] text-gray-500">{info.items.length} lançamento(s)</p>
              </div>
            ))}
          </div>

          {/* Tabela detalhada */}
          <div style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="bg-[#f8fafc]">
                  {["Data", "Descrição", "Categoria", "Pagamento", "Banco", "Valor", "Status"].map(h => (
                    <th key={h} className="px-2 py-2 text-left font-semibold text-[#1a1a2e] uppercase border-b-2 border-[#e2e8f0]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.sharedExpenses || []).map((e, i) => (
                  <tr key={e.id} className={i % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}>
                    <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{e.data_vencimento ? fmtDate(e.data_vencimento) : "—"}</td>
                    <td className="px-2 py-1.5 border-b border-[#e2e8f0] max-w-[200px] truncate">{e.descricao}</td>
                    <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{formatCategoryLabel(e.categoria || e.expense_type || '')}</td>
                    <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{e.payment_method || "—"}</td>
                    <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{e.bank_name || "—"}</td>
                    <td className="px-2 py-1.5 border-b border-[#e2e8f0] font-medium text-[#ef4444]">{fmt(e.total_amount)}</td>
                    <td className="px-2 py-1.5 border-b border-[#e2e8f0]">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        (e.status === "pago" || e.status === "paid") ? "bg-[#10b981]/20 text-[#10b981]" : "bg-[#f59e0b]/20 text-[#f59e0b]"
                      }`}>
                        {e.status || "pendente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#1a1a2e] text-white font-bold">
                  <td className="px-2 py-2" colSpan={5}>TOTAL CONTA COMPARTILHADA</td>
                  <td className="px-2 py-2">{fmt(totalSharedExpenses)}</td>
                  <td className="px-2 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-100 flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase">
            <span>Share Brasil - Gestão Compartilhada</span>
            <span>Conta Compartilhada</span>
          </div>
        </div>
      )}

      {/* ===== RESUMO MENSAL CONSOLIDADO ===== */}
      <div className="p-8" style={{ pageBreakBefore: "always", pageBreakInside: "avoid" }}>
        <div className="flex items-center justify-between border-b-2 border-[#1a1a2e] pb-2 mb-6">
          <div>
            <h2 className="text-2xl font-black text-[#1a1a2e] uppercase">Resumo Mensal Consolidado</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Total Geral — {monthLabelUpper}/{yearShort}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
          <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200 text-center">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Total de Entradas</p>
            <p className="text-2xl font-black text-emerald-700">
              {fmt(partnerData.reduce((s, pd) => {
                const partnerDeposits = data.flights
                  .filter(f => f.is_equal_split || f.socio_cliente_id_id === pd.partner.id)
                  .reduce((sum, f) => sum + (f.total_time || 0) * hourlyRate / (f.is_equal_split ? data.partners.length : 1), 0);
                return s + partnerDeposits;
              }, 0) || 0)}
            </p>
          </div>
          <div className="bg-red-50 rounded-xl p-6 border border-red-200 text-center">
            <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-2">Total de Saídas</p>
            <p className="text-2xl font-black text-red-700">
              {fmt(totalFuelValue + totalExpenses + totalBankControl + totalTravelReports + totalSharedExpenses)}
            </p>
          </div>
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-200 text-center">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">Saldo do Mês</p>
            <p className={`text-2xl font-black ${
              (() => {
                const totalOut = totalFuelValue + totalExpenses + totalBankControl + totalTravelReports + totalSharedExpenses;
                const totalIn = partnerData.reduce((s, pd) => s + pd.fuelTotal + pd.expTotal + pd.bankControlTotal + pd.travelTotal, 0);
                return totalIn >= totalOut ? "text-emerald-700" : "text-red-700";
              })()
            }`}>
              {(() => {
                const totalOut = totalFuelValue + totalExpenses + totalBankControl + totalTravelReports + totalSharedExpenses;
                return fmt(-totalOut);
              })()}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-100 flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase">
          <span>Share Brasil - Gestão Compartilhada</span>
          <span>Resumo Consolidado</span>
        </div>
      </div>
    </div>
  );
}
