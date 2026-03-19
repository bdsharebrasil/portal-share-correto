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
  hours_borrowed: number;
  hours_paid_back: number | null;
  entry_date: string;
  status: string;
  logbook_entry_id: string | null;
  payback_entry_id: string | null;
  departure_aerodrome?: string | null;
  arrival_aerodrome?: string | null;
  trecho?: string | null;
  fuel_added?: number | null;
  pic_name?: string | null;
  notes?: string | null;
}

interface ClientInfo {
  client_id: string;
  client_name: string;
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
  const [view, setView] = useState<'lenders' | 'borrowers' | 'details'>('lenders');
  const [selectedLenderId, setSelectedLenderId] = useState<string | null>(null);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!aircraftId) return;
    setLoading(true);
    try {
      const acRes = await supabase
        .from('aircraft')
        .select('*')
        .eq('id', aircraftId)
        .single();

      if (acRes.data) setAircraft(acRes.data);

      // Query logbook entries for loans of this aircraft
      const logbookRes = await supabase
        .from('logbook_entries')
        .select(`
          id,
          aircraft_id,
          client_id,
          loan_recipient_client_id,
          loan_recipient_partner_id,
          entry_date,
          departure_aerodrome,
          arrival_aerodrome,
          total_time
        `)
        .eq('aircraft_id', aircraftId)
        .eq('is_loan', true)
        .order('entry_date', { ascending: false });

      if (logbookRes.data && logbookRes.data.length > 0) {
        // Get associated aircraft_loans records
        const logbookIds = logbookRes.data.map((e: any) => e.id);
        const loansRes = await supabase
          .from('aircraft_loans')
          .select('*')
          .in('logbook_entry_id', logbookIds);

        // Create a map of logbook_entry_id -> aircraft_loan
        const loansMap: Record<string, any> = {};
        if (loansRes.data) {
          loansRes.data.forEach((loan: any) => {
            loansMap[loan.logbook_entry_id] = loan;
          });
        }

        // Fetch client and partner info
        const clientIds = [
          ...new Set([
            ...logbookRes.data.map((e: any) => e.client_id),
            ...logbookRes.data.map((e: any) => e.loan_recipient_client_id)
          ].filter(Boolean))
        ];
        const partnerIds = logbookRes.data
          .map((e: any) => e.loan_recipient_partner_id)
          .filter(Boolean);

        const [clientsRes, partnersRes] = await Promise.all([
          clientIds.length > 0
            ? supabase.from('clients').select('id, company_name').in('id', clientIds)
            : Promise.resolve({ data: [] }),
          partnerIds.length > 0
            ? supabase.from('client_partners').select('id, name').in('id', partnerIds)
            : Promise.resolve({ data: [] })
        ]);

        const clientsMap: Record<string, any> = {};
        const partnersMap: Record<string, any> = {};

        (clientsRes.data || []).forEach((c: any) => {
          clientsMap[c.id] = c;
        });

        (partnersRes.data || []).forEach((p: any) => {
          partnersMap[p.id] = p;
        });

        // Combine logbook and aircraft_loans data
        const transformedLoans = logbookRes.data.map((entry: any) => {
          const loan = loansMap[entry.id];
          return {
            id: loan?.id || entry.id,
            hours_borrowed: loan?.hours_borrowed || entry.total_time || 0,
            hours_paid_back: loan?.hours_paid_back || 0,
            entry_date: loan?.entry_date || entry.entry_date,
            departure_aerodrome: loan?.departure_aerodrome || entry.departure_aerodrome,
            arrival_aerodrome: loan?.arrival_aerodrome || entry.arrival_aerodrome,
            logbook_entry_id: entry.id,
            payback_entry_id: loan?.payback_entry_id || null,
            status: loan?.status || 'pending'
          };
        });

        setLoans(transformedLoans as unknown as AircraftLoan[]);
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

  // Dados dos emprestadores (sócios)
  // TODO: Reescrever após adicionar colunas de client/borrower à tabela aircraft_loans
  // const lendersData = useMemo(() => {
  //   const lenders: Record<string, ClientInfo> = {};
  //   loans.forEach(loan => {
  //     if (!lenders[loan.lender_client_id]) {
  //       lenders[loan.lender_client_id] = {
  //         client_id: loan.lender_client_id,
  //         client_name: loan.lender_client?.company_name || 'Cliente desconhecido'
  //       };
  //     }
  //   });
  //   return Object.values(lenders);
  // }, [loans]);
  const lendersData: ClientInfo[] = [];

  // Dados dos tomadores para um sócio selecionado
  // TODO: Reescrever após adicionar colunas de client/borrower à tabela aircraft_loans
  // const borrowersForLender = useMemo(() => {
  //   if (!selectedLenderId) return [];

  //   const borrowers: Record<string, ClientBalance> = {};

  //   loans
  //     .filter(loan => loan.lender_client_id === selectedLenderId)
  //     .forEach(loan => {
  //       const borrowerId = loan.borrower_client_id;
  //       // Se há um parceiro, usar o nome do parceiro, senão usar o nome da empresa
  //       const borrowerName = loan.borrower_partner?.name || loan.borrower_client?.company_name || 'Cliente desconhecido';
  //       const hoursBorrowed = loan.hours_borrowed || 0;
  //       const hoursPaidBack = loan.hours_paid_back || 0;

  //       if (!borrowers[borrowerId]) {
  //         borrowers[borrowerId] = {
  //           client_id: borrowerId,
  //           client_name: borrowerName,
  //           total_borrowed: 0,
  //           total_paid_back: 0,
  //           balance: 0
  //         };
  //       }

  //       borrowers[borrowerId].total_borrowed += hoursBorrowed;
  //       borrowers[borrowerId].total_paid_back += hoursPaidBack;
  //       borrowers[borrowerId].balance = borrowers[borrowerId].total_borrowed - borrowers[borrowerId].total_paid_back;
  //     });

  //   return Object.values(borrowers);
  // }, [loans, selectedLenderId]);
  const borrowersForLender: ClientBalance[] = [];

  // Empréstimos filtrados para um tomador específico
  // TODO: Reescrever após adicionar colunas de client/borrower à tabela aircraft_loans
  // const loansForBorrower = useMemo(() => {
  //   if (!selectedLenderId || !selectedBorrowerId) return [];
  //   return loans.filter(
  //     loan => loan.lender_client_id === selectedLenderId && loan.borrower_client_id === selectedBorrowerId
  //   );
  // }, [loans, selectedLenderId, selectedBorrowerId]);
  const loansForBorrower = loans;

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
          <div className="flex items-center gap-6">
            <button 
              onClick={() => {
                if (view === 'borrowers') {
                  setView('lenders');
                  setSelectedLenderId(null);
                } else if (view === 'details') {
                  setView('borrowers');
                  setSelectedBorrowerId(null);
                } else {
                  onBack();
                }
              }} 
              className="p-3 bg-slate-950 hover:bg-slate-800 rounded-xl transition-all border border-slate-800"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">Banco de Horas</h1>
              <p className="text-slate-500 text-xs uppercase mt-1">
                {view === 'lenders' && `Gestão de Cotistas • ${aircraft?.registration}`}
                {view === 'borrowers' && `Clientes que pegaram emprestado • ${aircraft?.registration}`}
                {view === 'details' && `Histórico de voos • ${aircraft?.registration}`}
              </p>
            </div>
          </div>
        </div>

        {/* TELA 1: SÓCIOS (EMPRESTADORES) */}
        {view === 'lenders' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lendersData.length === 0 ? (
                <div className="lg:col-span-3 flex items-center justify-center h-64 bg-slate-900/40 border border-slate-800/50 rounded-3xl">
                  <p className="text-slate-500 text-center">Nenhum empréstimo registrado para esta aeronave</p>
                </div>
              ) : (
                lendersData.map(lender => (
                  <button
                    key={lender.client_id}
                    onClick={() => {
                      setSelectedLenderId(lender.client_id);
                      setView('borrowers');
                    }}
                    className="bg-gradient-to-br from-slate-900/60 to-slate-950/60 border border-slate-800/50 p-8 rounded-3xl shadow-xl hover:border-slate-700/50 hover:shadow-2xl transition-all text-left"
                  >
                    <div className="space-y-4">
                      <Users className="w-8 h-8 text-sky-500" />
                      <h3 className="text-2xl font-black text-white uppercase tracking-tight">{lender.client_name}</h3>
                      <p className="text-slate-400 text-sm">Clique para ver detalhes dos empréstimos</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {/* TELA 2: TOMADORES (CLIENTES QUE PEGARAM EMPRESTADO) */}
        {view === 'borrowers' && selectedLenderId && (
          <>
            <div className="bg-gradient-to-br from-slate-900/40 to-slate-950/40 border border-slate-800/50 p-6 rounded-2xl">
              <p className="text-slate-400 text-sm">
                Emprestador: <span className="text-white font-black">{lendersData.find(l => l.client_id === selectedLenderId)?.client_name}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {borrowersForLender.length === 0 ? (
                <div className="lg:col-span-3 flex items-center justify-center h-64 bg-slate-900/40 border border-slate-800/50 rounded-3xl">
                  <p className="text-slate-500 text-center">Nenhum empréstimo registrado para este sócio</p>
                </div>
              ) : (
                borrowersForLender.map(borrower => {
                  const isPending = borrower.balance > 0;
                  const percentPaidBack = (borrower.total_paid_back / (borrower.total_borrowed || 1)) * 100;

                  return (
                    <button
                      key={borrower.client_id}
                      onClick={() => {
                        setSelectedBorrowerId(borrower.client_id);
                        setView('details');
                      }}
                      className="bg-gradient-to-br from-slate-900/60 to-slate-950/60 border border-slate-800/50 p-8 rounded-3xl shadow-xl hover:border-slate-700/50 hover:shadow-2xl transition-all text-left"
                    >
                      <div className="space-y-6">
                        {/* NOME DO CLIENTE */}
                        <div>
                          <h3 className="text-xl font-black text-white uppercase tracking-tight truncate">{borrower.client_name}</h3>
                          <p className="text-[9px] text-slate-600 font-bold uppercase mt-1">Cliente Mutuário</p>
                        </div>

                        {/* GRID 2x2 DE MÉTRICAS */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/30">
                            <p className="text-[8px] font-black text-slate-600 uppercase mb-2">Emprestado</p>
                            <p className="text-xl font-black text-sky-500 font-mono">{decimalToHM(borrower.total_borrowed)}</p>
                          </div>
                          <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/30">
                            <p className="text-[8px] font-black text-slate-600 uppercase mb-2">Devolvido</p>
                            <p className="text-xl font-black text-rose-500 font-mono">{decimalToHM(borrower.total_paid_back)}</p>
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
                            {decimalToHM(borrower.balance)}
                          </p>
                        </div>

                        {/* INDICADOR DE STATUS */}
                        <div className={`p-3 rounded-lg text-center text-[10px] font-black uppercase border ${isPending ? (percentPaidBack > 0 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30') : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                          {!isPending ? '✓ Quitado' : percentPaidBack > 0 ? '⏳ Parcialmente Devolvido' : '⏸️ Pendente'}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* TELA 3: TABELA DE HISTÓRICO COM DETALHES */}
        {view === 'details' && selectedLenderId && selectedBorrowerId && (
          <>
            <div className="bg-gradient-to-br from-slate-900/40 to-slate-950/40 border border-slate-800/50 p-6 rounded-2xl">
              <p className="text-slate-400 text-sm">
                Emprestador: <span className="text-white font-black">{lendersData.find(l => l.client_id === selectedLenderId)?.client_name}</span>
              </p>
              <p className="text-slate-400 text-sm mt-2">
                Cliente Mutuário: <span className="text-white font-black">{borrowersForLender.find(b => b.client_id === selectedBorrowerId)?.client_name}</span>
              </p>
            </div>

            {loansForBorrower.length > 0 && (
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
                        <th className="px-4 py-4 text-center">Horas</th>
                        <th className="px-4 py-4 text-center">Devolvido</th>
                        <th className="px-4 py-4 text-center">Fuel (L)</th>
                        <th className="px-4 py-4 text-left">PIC</th>
                        <th className="px-4 py-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                      {loansForBorrower.map(loan => {
                        const hoursBorrowed = loan.hours_borrowed || 0;
                        const hoursPaidBack = loan.hours_paid_back || 0;
                        const balance = hoursBorrowed - hoursPaidBack;
                        const isPending = balance > 0;
                        const formattedDate = new Date(loan.entry_date).toLocaleDateString('pt-BR');
                        const trecho = loan.departure_aerodrome && loan.arrival_aerodrome
                          ? `${loan.departure_aerodrome.trim()} → ${loan.arrival_aerodrome.trim()}`
                          : loan.trecho || '-';
                        const fuelAdded = loan.fuel_added ? loan.fuel_added.toFixed(1) : '-';
                        const picName = loan.pic_name || '-';

                        return (
                          <tr key={loan.id} className="hover:bg-slate-800/20 transition-colors">
                            <td className="px-4 py-4 text-slate-300 whitespace-nowrap">{formattedDate}</td>
                            <td className="px-4 py-4 text-slate-300 font-mono">{trecho}</td>
                            <td className="px-4 py-4 text-center text-sky-500 font-mono whitespace-nowrap">{decimalToHM(hoursBorrowed)}</td>
                            <td className="px-4 py-4 text-center text-rose-500 font-mono whitespace-nowrap">{decimalToHM(hoursPaidBack)}</td>
                            <td className="px-4 py-4 text-center text-slate-300 font-mono whitespace-nowrap">{fuelAdded}</td>
                            <td className="px-4 py-4 text-slate-300 truncate text-xs">{picName}</td>
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
          </>
        )}
      </div>
    </Layout>
  );
};

export default BancodeHoras;
