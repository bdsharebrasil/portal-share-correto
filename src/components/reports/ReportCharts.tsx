// @ts-nocheck
import React from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, Legend, ResponsiveContainer,
} from "recharts";

const PARTNER_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f97316", "#ec4899", "#14b8a6", "#6366f1", "#f59e0b"];

interface PartnerHours {
  name: string;
  hours: number;
  percentage: number;
}

export interface PartnerCosts {
  name: string;
  combustivel: number;
  despesas: number;
  total: number;
}

interface DailyFlight {
  day: string;
  hours: number;
}

interface FlightNature {
  name: string;
  value: number;
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function HoursDonutChart({ data }: { data: PartnerHours[] }) {
  return (
    <div>
      <h4 className="text-sm font-bold text-[#1a1a2e] mb-3 uppercase tracking-wider">Distribuição de Horas por Sócio</h4>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={data} dataKey="hours" nameKey="nome" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} label={({ name, percentage }) => `${name} (${percentage.toFixed(1)}%)`}>
            {data.map((_, i) => <Cell key={i} fill={PARTNER_COLORS[i % PARTNER_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => `${v.toFixed(1)}h`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CostsBarChart({ data }: { data: PartnerCosts[] }) {
  return (
    <div>
      <h4 className="text-sm font-bold text-[#1a1a2e] mb-3 uppercase tracking-wider">Comparativo de Custos por Sócio</h4>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="combustivel" name="Combustível" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="despesas" name="Despesas" fill="#f97316" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyFlightsChart({ data }: { data: DailyFlight[] }) {
  return (
    <div>
      <h4 className="text-sm font-bold text-[#1a1a2e] mb-3 uppercase tracking-wider">Voos ao Longo do Mês</h4>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="day" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip formatter={(v: number) => `${v.toFixed(1)}h`} />
          <Area type="monotone" dataKey="hours" stroke="#3b82f6" fillOpacity={1} fill="url(#colorHours)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FlightNatureChart({ data }: { data: FlightNature[] }) {
  const NATURE_COLORS = ["#3b82f6", "#10b981", "#f97316", "#8b5cf6", "#ec4899", "#14b8a6"];
  const NATURE_LABELS: Record<string, string> = {
    EX: "Executivo", TN: "Treinamento", AE: "Aeromedico", FY: "Ferry",
    IN: "Instrução", PR: "Privado", TX: "Táxi Aéreo", CH: "Charter",
  };

  return (
    <div>
      <h4 className="text-sm font-bold text-[#1a1a2e] mb-3 uppercase tracking-wider">Natureza dos Voos</h4>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={data.map(d => ({ ...d, label: NATURE_LABELS[d.nome] || d.nome }))} dataKey="value" nameKey="rotulo" cx="50%" cy="50%" outerRadius={85} label={({ label, value }) => `${label}: ${value}`}>
            {data.map((_, i) => <Cell key={i} fill={NATURE_COLORS[i % NATURE_COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
