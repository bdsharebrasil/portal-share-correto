import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, History, Users, ArrowUpRight, ArrowDownLeft,
  Calculator, ShieldCheck, PieChart, UserPlus, Search, Filter
} from 'lucide-react';
import { LottieAirplaneSpinner } from '@/components/ui/lottie-airplane-spinner';
import { Layout } from '../components/layout/Layout';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

interface AircraftLoan {
  id: string;
  lender_client_id: string;
  borrower_client_id: string;
  lender_aircraft_id: string;
  hours_borrowed: number;
  hours_paid_back: number | null;
  entry_date: string;
  status: string;
  logbook_entry_id: string | null;
  departure_aerodrome?: string | null;
  arrival_aerodrome?: string | null;
  trecho?: string | null;
  fuel_added?: number | null;
  pic_name?: string | null;
  lender_client?: {
    id: string;
    company_name: string;
  };
  borrower_client?: {
    id: string;
    company_name: string;
  };
}

interface ClientBalance {
  client_id: string;
  client_name: string;
  total_borrowed: number;
  total_paid_back: number;
  balance: number;
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
  const [loans, setLoans] = useState<AircraftLoan[]>([]);

  const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const fetchData = async () => {
    if (!aircraftId) return;
    setLoading(true);
    try {
      // Buscar aeronave
      const acRes = await supabase
        .from('aircraft')
        .select('*')
        .eq('id', aircraftId)
        .single();

      if (acRes.data) setAircraft(acRes.data);

      // Buscar empréstimos de aeronaves (aircraft_loans) para esta aeronave
      const loansRes = await supabase
        .from('aircraft_loans')
        .select(`
          *,
          lender_client:clients!aircraft_loans_lender_client_id_fkey (
            id,
            company_name
          ),
          borrower_client:clients!aircraft_loans_borrower_client_id_fkey (
            id,
            company_name
          )
        `)
        .eq('lender_aircraft_id', aircraftId)
        .order('entry_date', { ascending: false });

      if (loansRes.data) {
        setLoans(loansRes.data as unknown as AircraftLoan[]);
      }
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

  // Calcular saldos por cliente que pegou emprestado (borrower)
  const clientBalances = useMemo(() => {
    const balances: Record<string, ClientBalance> = {};

    loans.forEach(loan => {
      const borrowerId = loan.borrower_client_id;
      const borrowerName = loan.borrower_client?.company_name || 'Cliente desconhecido';
      const hoursBorrowed = loan.hours_borrowed || 0;
      const hoursPaidBack = loan.hours_paid_back || 0;

      if (!balances[borrowerId]) {
        balances[borrowerId] = {
          client_id: borrowerId,
          client_name: borrowerName,
          total_borrowed: 0,
          total_paid_back: 0,
          balance: 0
        };
      }

      balances[borrowerId].total_borrowed += hoursBorrowed;
      balances[borrowerId].total_paid_back += hoursPaidBack;
      balances[borrowerId].balance = balances[borrowerId].total_borrowed - balances[borrowerId].total_paid_back;
    });

    return Object.values(balances);
  }, [loans]);

  // Calcular totais gerais
  const totals = useMemo(() => {
    let totalBorrowed = 0;
    let totalPaidBack = 0;
    let totalBalance = 0;

    clientBalances.forEach(cb => {
      totalBorrowed += cb.total_borrowed;
      totalPaidBack += cb.total_paid_back;
      totalBalance += cb.balance;
    });

    return { totalBorrowed, totalPaidBack, totalBalance };
  }, [clientBalances]);

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

          {/* INFORMAÇÕES */}
          <div className="flex items-center gap-4 mt-6 p-4 bg-slate-950/40 rounded-2xl border border-slate-800/30 w-fit">
            <p className="text-[9px] font-black text-slate-600 uppercase">Empréstimos:</p>
            <span className="text-lg font-black text-white uppercase">{loans.length} registro(s)</span>
          </div>
        </div>

        {/* CARDS DE RESUMO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-sky-500/10 to-cyan-500/10 border border-sky-500/20 p-6 rounded-3xl">
            <p className="text-[9px] font-black text-sky-600 uppercase tracking-wider mb-3">Total Emprestado</p>
            <p className="text-3xl font-black text-sky-500 font-mono">{decimalToHM(totals.totalBorrowed)}</p>
            <p className="text-[9px] text-sky-600 font-bold mt-2">Horas totais emprestadas</p>
          </div>

          <div className="bg-gradient-to-br from-rose-500/10 to-orange-500/10 border border-rose-500/20 p-6 rounded-3xl">
            <p className="text-[9px] font-black text-rose-600 uppercase tracking-wider mb-3">Devolvido</p>
            <p className="text-3xl font-black text-rose-500 font-mono">{decimalToHM(totals.totalPaidBack)}</p>
            <p className="text-[9px] text-rose-600 font-bold mt-2">Horas devolvidas</p>
          </div>

          <div className={`bg-gradient-to-br ${totals.totalBalance >= 0 ? 'from-emerald-500/10 to-green-500/10 border-emerald-500/20' : 'from-rose-500/10 to-orange-500/10 border-rose-500/20'} border p-6 rounded-3xl`}>
            <p className={`text-[9px] font-black uppercase tracking-wider mb-3 ${totals.totalBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              Saldo Pendente
            </p>
            <p className={`text-3xl font-black font-mono ${totals.totalBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {decimalToHM(totals.totalBalance)}
            </p>
            <p className={`text-[9px] font-bold mt-2 ${totals.totalBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {totals.totalBalance > 0 ? 'Pendente de devolução' : 'Quitado'}
            </p>
          </div>
        </div>

        {/* GRID DE CLIENTES COM EMPRÉSTIMOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clientBalances.length === 0 ? (
            <div className="lg:col-span-3 flex items-center justify-center h-64 bg-slate-900/40 border border-slate-800/50 rounded-3xl">
              <p className="text-slate-500 text-center">Nenhum empréstimo registrado para esta aeronave</p>
            </div>
          ) : (
            clientBalances.map(client => {
              const isPending = client.balance > 0;
              const percentPaidBack = (client.total_paid_back / (client.total_borrowed || 1)) * 100;

              return (
                <div
                  key={client.client_id}
                  className="bg-gradient-to-br from-slate-900/60 to-slate-950/60 border border-slate-800/50 p-8 rounded-3xl shadow-xl hover:border-slate-700/50 transition-all"
                >
                  <div className="space-y-6">
                    {/* NOME DO CLIENTE */}
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight truncate">{client.client_name}</h3>
                      <p className="text-[9px] text-slate-600 font-bold uppercase mt-1">Cliente Mutuário</p>
                    </div>

                    {/* GRID 2x2 DE MÉTRICAS */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/30">
                        <p className="text-[8px] font-black text-slate-600 uppercase mb-2">Emprestado</p>
                        <p className="text-xl font-black text-sky-500 font-mono">{decimalToHM(client.total_borrowed)}</p>
                      </div>
                      <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/30">
                        <p className="text-[8px] font-black text-slate-600 uppercase mb-2">Devolvido</p>
                        <p className="text-xl font-black text-rose-500 font-mono">{decimalToHM(client.total_paid_back)}</p>
                      </div>
                    </div>

                    {/* BARRA DE PROGRESSO - DEVOLUÇÃO */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[9px] font-black text-slate-600 uppercase">Devolvido</p>
                        <p className="text-[9px] font-black text-slate-500">{percentPaidBack.toFixed(0)}%</p>
                      </div>
                      <div className="w-full bg-slate-800/50 rounded-full h-2.5 overflow-hidden border border-slate-700/30">
                        <div
                          className={`h-full transition-all ${percentPaidBack >= 100 ? 'bg-gradient-to-r from-emerald-500 to-green-500' : percentPaidBack >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-rose-500 to-red-500'}`}
                          style={{ width: `${Math.min(percentPaidBack, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* SALDO PENDENTE */}
                    <div className={`p-5 rounded-2xl border ${isPending ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                      <p className={`text-[8px] font-black uppercase mb-2 ${isPending ? 'text-rose-600' : 'text-emerald-600'}`}>
                        Saldo Pendente
                      </p>
                      <p className={`text-2xl font-black font-mono ${isPending ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {decimalToHM(client.balance)}
                      </p>
                    </div>

                    {/* INDICADOR DE STATUS */}
                    <div className={`p-3 rounded-lg text-center text-[10px] font-black uppercase border ${isPending ? (percentPaidBack > 0 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30') : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                      {!isPending ? '✓ Quitado' : percentPaidBack > 0 ? '⏳ Parcialmente Devolvido' : '⏸️ Pendente'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* TABELA DE HISTÓRICO DE EMPRÉSTIMOS */}
        {loans.length > 0 && (
          <div className="bg-slate-900/40 border border-slate-800/50 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-800/50">
              <h3 className="text-lg font-black text-white uppercase">Histórico de Empréstimos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[10px] font-bold uppercase">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400">
                    <th className="px-4 py-4 text-left">Data</th>
                    <th className="px-4 py-4 text-left">Trecho</th>
                    <th className="px-4 py-4 text-left">Emprestador</th>
                    <th className="px-4 py-4 text-left">Tomador</th>
                    <th className="px-4 py-4 text-center">Horas</th>
                    <th className="px-4 py-4 text-center">Devolvido</th>
                    <th className="px-4 py-4 text-center">Fuel (L)</th>
                    <th className="px-4 py-4 text-left">PIC</th>
                    <th className="px-4 py-4 text-center">Saldo</th>
                    <th className="px-4 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {loans.map(loan => {
                    const borrowerName = loan.borrower_client?.company_name || 'Cliente desconhecido';
                    const lenderName = loan.lender_client?.company_name || 'Cliente desconhecido';
                    const hoursBorrowed = loan.hours_borrowed || 0;
                    const hoursPaidBack = loan.hours_paid_back || 0;
                    const balance = hoursBorrowed - hoursPaidBack;
                    const isPending = balance > 0;
                    const formattedDate = new Date(loan.entry_date).toLocaleDateString('pt-BR');
                    const trecho = loan.logbook_entry
                      ? `${loan.logbook_entry.departure_aerodrome || '-'} → ${loan.logbook_entry.arrival_aerodrome || '-'}`
                      : '-';
                    const fuelAdded = loan.logbook_entry?.fuel_added ? loan.logbook_entry.fuel_added.toFixed(1) : '-';
                    const picName = loan.logbook_entry?.pic_name || '-';

                    return (
                      <tr key={loan.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-4 text-slate-300 whitespace-nowrap">{formattedDate}</td>
                        <td className="px-4 py-4 text-slate-300 font-mono">{trecho}</td>
                        <td className="px-4 py-4 text-slate-300 truncate text-xs">{lenderName}</td>
                        <td className="px-4 py-4 text-slate-300 truncate text-xs">{borrowerName}</td>
                        <td className="px-4 py-4 text-center text-sky-500 font-mono whitespace-nowrap">{decimalToHM(hoursBorrowed)}</td>
                        <td className="px-4 py-4 text-center text-rose-500 font-mono whitespace-nowrap">{decimalToHM(hoursPaidBack)}</td>
                        <td className="px-4 py-4 text-center text-slate-300 font-mono whitespace-nowrap">{fuelAdded}</td>
                        <td className="px-4 py-4 text-slate-300 truncate text-xs">{picName}</td>
                        <td className={`px-4 py-4 text-center font-black font-mono whitespace-nowrap ${isPending ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {decimalToHM(balance)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase border whitespace-nowrap ${isPending ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                            {isPending ? '⏳ Pendente' : '✓ Quitado'}
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
