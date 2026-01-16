import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, History, Users, ArrowUpRight, ArrowDownLeft,
  Calculator, ShieldCheck, PieChart, UserPlus, Search, Filter
} from 'lucide-react';
import { LottieAirplaneSpinner } from '@/components/ui/lottie-airplane-spinner';
import { Layout } from '../components/layout/Layout';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

interface AircraftPartner {
  id: string;
  aircraft_id: string;
  partner_id: string;
  quota_hours: number;
  balance_hours: number;
  client?: {
    id: string;
    company_name: string;
  };
}

interface LogbookEntry {
  id: string;
  entry_date: string;
  client_id: string;
  total_time: number;
  aircraft_id: string;
}

interface Aircraft {
  id: string;
  registration: string;
  model: string;
}

interface BancodeHorasProps {
  aircraftId: string | null;
  onBack: () => void;
}

const decimalToHM = (decimal: number | null | undefined): string => {
  if (!decimal || isNaN(decimal)) return '0:00';
  const totalMinutes = Math.round(Math.abs(decimal) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const sign = decimal < 0 ? '-' : '';
  return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const BancodeHoras: React.FC<BancodeHorasProps> = ({ aircraftId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [partners, setPartners] = useState<AircraftPartner[]>([]);
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const fetchData = async () => {
    if (!aircraftId) return;
    setLoading(true);
    try {
      const [acRes, partRes, entriesRes] = await Promise.all([
        supabase.from('aircraft').select('*').eq('id', aircraftId).single(),
        supabase
          .from('aircraft_partners')
          .select('*, clients(id, company_name)')
          .eq('aircraft_id', aircraftId),
        supabase
          .from('logbook_entries')
          .select('*')
          .eq('aircraft_id', aircraftId)
          .order('entry_date', { ascending: false }),
      ]);

      if (acRes.data) setAircraft(acRes.data);
      if (partRes.data) setPartners(partRes.data as AircraftPartner[]);
      if (entriesRes.data) setEntries(entriesRes.data);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do banco de horas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [aircraftId]);

  // Calcular consumo mensal por cotista
  const monthlyUsage = useMemo(() => {
    const usage: Record<string, number> = {};
    entries.forEach(e => {
      if (e.client_id) {
        const dateObj = new Date(e.entry_date);
        const month = dateObj.getUTCMonth() + 1;
        const year = dateObj.getUTCFullYear();
        
        if (month === selectedMonth && year === selectedYear) {
          usage[e.client_id] = (usage[e.client_id] || 0) + (e.total_time || 0);
        }
      }
    });
    return usage;
  }, [entries, selectedMonth, selectedYear]);

  // Calcular totais
  const totals = useMemo(() => {
    let totalQuota = 0;
    let totalUsed = 0;
    let totalBalance = 0;

    partners.forEach(p => {
      const used = monthlyUsage[p.partner_id] || 0;
      const balance = (p.quota_hours || 0) - used;
      
      totalQuota += p.quota_hours || 0;
      totalUsed += used;
      totalBalance += balance;
    });

    return { totalQuota, totalUsed, totalBalance };
  }, [partners, monthlyUsage]);

  if (loading) return (
    <Layout>
      <div className="h-screen flex flex-col items-center justify-center">
        <LottieAirplaneSpinner size="lg" text="Auditoria em Progresso..." />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="space-y-8 max-w-[1800px] mx-auto pb-20">
        
        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-slate-900/80 to-slate-950/80 border border-slate-800/50 p-8 rounded-3xl shadow-xl">
          <div className="flex items-center gap-6 mb-6">
            <button onClick={onBack} className="p-3 bg-slate-950 hover:bg-slate-800 rounded-xl transition-all border border-slate-800">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">Banco de Horas</h1>
              <p className="text-slate-500 text-xs uppercase mt-1">Gestão de Cotistas • {aircraft?.registration}</p>
            </div>
          </div>

          {/* PERÍODO */}
          <div className="flex items-center gap-4 mt-6 p-4 bg-slate-950/40 rounded-2xl border border-slate-800/30 w-fit">
            <p className="text-[9px] font-black text-slate-600 uppercase">Período:</p>
            <span className="text-lg font-black text-white uppercase">{MONTHS[selectedMonth - 1]} {selectedYear}</span>
          </div>
        </div>

        {/* CARDS DE RESUMO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-sky-500/10 to-cyan-500/10 border border-sky-500/20 p-6 rounded-3xl">
            <p className="text-[9px] font-black text-sky-600 uppercase tracking-wider mb-3">Cota Total</p>
            <p className="text-3xl font-black text-sky-500 font-mono">{decimalToHM(totals.totalQuota)}</p>
            <p className="text-[9px] text-sky-600 font-bold mt-2">Soma de todas as cotas</p>
          </div>

          <div className="bg-gradient-to-br from-rose-500/10 to-orange-500/10 border border-rose-500/20 p-6 rounded-3xl">
            <p className="text-[9px] font-black text-rose-600 uppercase tracking-wider mb-3">Consumido</p>
            <p className="text-3xl font-black text-rose-500 font-mono">{decimalToHM(totals.totalUsed)}</p>
            <p className="text-[9px] text-rose-600 font-bold mt-2">Horas utilizadas</p>
          </div>

          <div className={`bg-gradient-to-br ${totals.totalBalance >= 0 ? 'from-emerald-500/10 to-green-500/10 border-emerald-500/20' : 'from-rose-500/10 to-orange-500/10 border-rose-500/20'} border p-6 rounded-3xl`}>
            <p className={`text-[9px] font-black uppercase tracking-wider mb-3 ${totals.totalBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              Saldo Total
            </p>
            <p className={`text-3xl font-black font-mono ${totals.totalBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {decimalToHM(totals.totalBalance)}
            </p>
            <p className={`text-[9px] font-bold mt-2 ${totals.totalBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {totals.totalBalance >= 0 ? 'Disponível' : 'Em débito'}
            </p>
          </div>
        </div>

        {/* GRID DE COTISTAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.length === 0 ? (
            <div className="lg:col-span-3 flex items-center justify-center h-64 bg-slate-900/40 border border-slate-800/50 rounded-3xl">
              <p className="text-slate-500 text-center">Nenhum cotista associado a esta aeronave</p>
            </div>
          ) : (
            partners.map(partner => {
              const clientName = (partner.client as any)?.company_name || 'Cotista';
              const hoursUsed = monthlyUsage[partner.partner_id] || 0;
              const finalBalance = (partner.quota_hours || 0) - hoursUsed;
              const isDeficit = finalBalance < 0;
              const percentUsed = ((hoursUsed / (partner.quota_hours || 1)) * 100);

              return (
                <div
                  key={partner.id}
                  className="bg-gradient-to-br from-slate-900/60 to-slate-950/60 border border-slate-800/50 p-8 rounded-3xl shadow-xl hover:border-slate-700/50 transition-all"
                >
                  <div className="space-y-6">
                    {/* NOME DO COTISTA */}
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight truncate">{clientName}</h3>
                      <p className="text-[9px] text-slate-600 font-bold uppercase mt-1">Cotista</p>
                    </div>

                    {/* GRID 2x2 DE MÉTRICAS */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/30">
                        <p className="text-[8px] font-black text-slate-600 uppercase mb-2">Cota</p>
                        <p className="text-xl font-black text-sky-500 font-mono">{decimalToHM(partner.quota_hours)}</p>
                      </div>
                      <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/30">
                        <p className="text-[8px] font-black text-slate-600 uppercase mb-2">Consumido</p>
                        <p className="text-xl font-black text-rose-500 font-mono">{decimalToHM(hoursUsed)}</p>
                      </div>
                    </div>

                    {/* BARRA DE PROGRESSO */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[9px] font-black text-slate-600 uppercase">Utilização</p>
                        <p className="text-[9px] font-black text-slate-500">{percentUsed.toFixed(0)}%</p>
                      </div>
                      <div className="w-full bg-slate-800/50 rounded-full h-2.5 overflow-hidden border border-slate-700/30">
                        <div
                          className={`h-full transition-all ${percentUsed > 100 ? 'bg-gradient-to-r from-rose-500 to-red-500' : percentUsed > 80 ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-gradient-to-r from-emerald-500 to-green-500'}`}
                          style={{ width: `${Math.min(percentUsed, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* SALDO */}
                    <div className={`p-5 rounded-2xl border ${isDeficit ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                      <p className={`text-[8px] font-black uppercase mb-2 ${isDeficit ? 'text-rose-600' : 'text-emerald-600'}`}>
                        Saldo Atual
                      </p>
                      <p className={`text-2xl font-black font-mono ${isDeficit ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {decimalToHM(finalBalance)}
                      </p>
                    </div>

                    {/* INDICADOR DE STATUS */}
                    <div className={`p-3 rounded-lg text-center text-[10px] font-black uppercase border ${isDeficit ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : percentUsed > 80 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                      {isDeficit ? '⚠️ Em Débito' : percentUsed > 80 ? '⏰ Limite próximo' : '✓ Normal'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* TABELA DE HISTÓRICO */}
        {partners.length > 0 && (
          <div className="bg-slate-900/40 border border-slate-800/50 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-800/50">
              <h3 className="text-lg font-black text-white uppercase">Resumo por Cotista</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px] font-bold uppercase">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400">
                    <th className="px-6 py-4 text-left">Cotista</th>
                    <th className="px-6 py-4 text-center">Cota</th>
                    <th className="px-6 py-4 text-center">Consumido</th>
                    <th className="px-6 py-4 text-center">Saldo</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {partners.map(partner => {
                    const clientName = (partner.client as any)?.company_name || 'Cotista';
                    const hoursUsed = monthlyUsage[partner.partner_id] || 0;
                    const balance = (partner.quota_hours || 0) - hoursUsed;
                    const isDeficit = balance < 0;

                    return (
                      <tr key={partner.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4 text-slate-300">{clientName}</td>
                        <td className="px-6 py-4 text-center text-sky-500 font-mono">{decimalToHM(partner.quota_hours)}</td>
                        <td className="px-6 py-4 text-center text-rose-500 font-mono">{decimalToHM(hoursUsed)}</td>
                        <td className={`px-6 py-4 text-center font-black font-mono ${isDeficit ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {decimalToHM(balance)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${isDeficit ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                            {isDeficit ? '⚠️ Débito' : '✓ OK'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BancodeHoras;
