import React from "react";
import type { PartnerInfo, FlightEntry, FuelEntry, ExpenseEntry } from "@/hooks/useMonthlyPartnerReport";

const PARTNER_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f97316", "#ec4899", "#14b8a6", "#6366f1", "#f59e0b"];

function formatCPF(cpf: string) {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11) return cpf;
  return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

interface Props {
  partner: PartnerInfo;
  index: number;
  flights: FlightEntry[];
  fuels: FuelEntry[];
  expenses: ExpenseEntry[];
  allPartners: PartnerInfo[];
  month: string;
  totalFlightHours: number;
}

export function PartnerReportSection({ partner, index, flights, fuels, expenses, month, totalFlightHours }: Props) {
  const color = PARTNER_COLORS[index % PARTNER_COLORS.length];

  const totalHours = flights.reduce((s, f) => s + (f.total_time || 0), 0);
  const totalPousos = flights.reduce((s, f) => s + (f.pousos || 0), 0);
  const totalFuelL = fuels.reduce((s, f) => s + f.litros, 0);
  const totalFuelR = fuels.reduce((s, f) => s + (f.valor_total || 0), 0);
  const totalExpR = expenses.reduce((s, e) => s + e.total_amount, 0);
  const paidExp = expenses.filter(e => e.status === "pago" || e.status === "paid").length;
  const pctPaid = expenses.length > 0 ? (paidExp / expenses.length) * 100 : 0;
  const pctHours = totalFlightHours > 0 ? (totalHours / totalFlightHours) * 100 : 0;

  // Group expenses by category
  const expByCategory: Record<string, number> = {};
  expenses.forEach(e => {
    const cat = e.category || e.expense_type || "Outros";
    expByCategory[cat] = (expByCategory[cat] || 0) + e.total_amount;
  });

  return (
    <div style={{ pageBreakBefore: "always", breakBefore: "page" }} className="mb-8">
      {/* Header do Sócio */}
      <div className="flex items-center gap-4 mb-6 pb-4" style={{ borderBottom: `3px solid ${color}` }}>
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
          style={{ backgroundColor: color }}
        >
          {getInitials(partner.name)}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-[#1a1a2e]">{partner.name}</h3>
          <p className="text-sm text-gray-500">
            CPF: {formatCPF(partner.cpf)} • Participação: {partner.share_percentage?.toFixed(2) || "0"}%
          </p>
        </div>
      </div>

      {/* VOOS */}
      <div className="mb-6">
        <h4 className="text-sm font-bold text-[#1a1a2e] uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-sm" style={{ backgroundColor: color }} />
          Voos do Mês
        </h4>
        {flights.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nenhum voo registrado neste período.</p>
        ) : (
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-[#f8fafc]">
                {["Data", "Trecho", "Natureza", "PIC", "Horas", "Pousos", "Comb.(L)", "Pax", "Carga(kg)"].map(h => (
                  <th key={h} className="px-2 py-2 text-left font-semibold text-[#1a1a2e] uppercase border-b-2 border-[#e2e8f0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flights.map((f, i) => (
                <tr key={f.id} className={i % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{fmtDate(f.entry_date)}</td>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0] font-medium">{f.departure_aerodrome}→{f.arrival_aerodrome}</td>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{f.flight_nature}</td>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{f.pic_name || f.pic_canac}</td>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0] font-medium">{(f.total_time || 0).toFixed(1)}</td>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{f.pousos || 0}</td>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{f.fuel_liters || "—"}</td>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{f.passengers || 0}</td>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{f.cargo_kg || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#1a1a2e] text-white font-bold">
                <td className="px-2 py-2" colSpan={4}>TOTAL</td>
                <td className="px-2 py-2">{totalHours.toFixed(1)}</td>
                <td className="px-2 py-2">{totalPousos}</td>
                <td className="px-2 py-2">{flights.reduce((s, f) => s + (f.fuel_liters || 0), 0).toFixed(0)}</td>
                <td className="px-2 py-2">{flights.reduce((s, f) => s + (f.passengers || 0), 0)}</td>
                <td className="px-2 py-2">{flights.reduce((s, f) => s + (f.cargo_kg || 0), 0).toFixed(0)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ABASTECIMENTOS */}
      <div className="mb-6">
        <h4 className="text-sm font-bold text-[#1a1a2e] uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-sm" style={{ backgroundColor: color }} />
          Abastecimentos
        </h4>
        {fuels.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nenhum abastecimento registrado.</p>
        ) : (
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-[#f8fafc]">
                {["Data", "Trecho", "Local", "Litros", "Valor Unit.", "Valor Total", "Status"].map(h => (
                  <th key={h} className="px-2 py-2 text-left font-semibold text-[#1a1a2e] uppercase border-b-2 border-[#e2e8f0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fuels.map((f, i) => (
                <tr key={f.id} className={i % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{fmtDate(f.data)}</td>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{f.trecho}</td>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{f.local}</td>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{f.litros.toFixed(0)}</td>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{fmt(f.valor_unitario)}</td>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0] font-medium">{fmt(f.valor_total || 0)}</td>
                  <td className="px-2 py-1.5 border-b border-[#e2e8f0]">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      f.status_pagamento === "pago" ? "bg-[#10b981]/20 text-[#10b981]" : "bg-[#f59e0b]/20 text-[#f59e0b]"
                    }`}>
                      {f.status_pagamento || "pendente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#1a1a2e] text-white font-bold">
                <td className="px-2 py-2" colSpan={3}>TOTAL</td>
                <td className="px-2 py-2">{totalFuelL.toFixed(0)}L</td>
                <td className="px-2 py-2">—</td>
                <td className="px-2 py-2">{fmt(totalFuelR)}</td>
                <td className="px-2 py-2" />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* DESPESAS */}
      <div className="mb-6">
        <h4 className="text-sm font-bold text-[#1a1a2e] uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-sm" style={{ backgroundColor: color }} />
          Despesas
        </h4>
        {expenses.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nenhuma despesa registrada.</p>
        ) : (
          <>
            <table className="w-full text-[10px] border-collapse mb-3">
              <thead>
                <tr className="bg-[#f8fafc]">
                  {["Vencimento", "Descrição", "Categoria", "Prazo", "Pagamento", "Banco", "Valor", "Status"].map(h => (
                    <th key={h} className="px-2 py-2 text-left font-semibold text-[#1a1a2e] uppercase border-b-2 border-[#e2e8f0]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((e, i) => (
                  <tr key={e.id} className={i % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}>
                    <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{e.due_date ? fmtDate(e.due_date) : "—"}</td>
                    <td className="px-2 py-1.5 border-b border-[#e2e8f0] max-w-[150px] truncate">{e.description}</td>
                    <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{e.category || e.expense_type}</td>
                    <td className="px-2 py-1.5 border-b border-[#e2e8f0]">{e.prazo || "—"}</td>
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
                  <td className="px-2 py-2" colSpan={6}>TOTAL DESPESAS</td>
                  <td className="px-2 py-2">{fmt(totalExpR)}</td>
                  <td className="px-2 py-2" />
                </tr>
              </tfoot>
            </table>

            {/* Progress bar */}
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-gray-500">Pagas: {pctPaid.toFixed(0)}%</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#10b981] rounded-full" style={{ width: `${pctPaid}%` }} />
              </div>
              <span className="text-gray-500">Pendentes: {(100 - pctPaid).toFixed(0)}%</span>
            </div>

            {/* Subtotais por categoria */}
            {Object.keys(expByCategory).length > 1 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.entries(expByCategory).map(([cat, val]) => (
                  <div key={cat} className="flex justify-between text-[10px] px-2 py-1 bg-[#f8fafc] rounded">
                    <span className="text-gray-600">{cat}</span>
                    <span className="font-bold text-[#1a1a2e]">{fmt(val)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* RESUMO FINANCEIRO */}
      <div className="rounded-lg p-4" style={{ backgroundColor: `${color}10`, border: `1px solid ${color}30` }}>
        <h4 className="text-sm font-bold text-[#1a1a2e] uppercase tracking-wider mb-3">Resumo Financeiro</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase">Abastecimentos</p>
            <p className="text-sm font-bold text-[#1a1a2e]">{fmt(totalFuelR)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase">Despesas</p>
            <p className="text-sm font-bold text-[#1a1a2e]">{fmt(totalExpR)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase">Total Geral</p>
            <p className="text-lg font-black" style={{ color }}>{fmt(totalFuelR + totalExpR)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase">Horas Voadas</p>
            <p className="text-sm font-bold text-[#1a1a2e]">{totalHours.toFixed(1)}h</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase">% do Total</p>
            <p className="text-sm font-bold text-[#1a1a2e]">{pctHours.toFixed(1)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
