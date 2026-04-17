// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, Plus, CheckCircle, Loader2, Lock, Unlock,
  History, Info, AlertCircle, TrendingUp, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Interfaces alinhadas ao schema do banco ─────────────────────────────────

interface LogbookEntry {
  // PK / relações
  id?: string;
  diario_mes: string;
  aeronave_id: string;

  // Dados do voo
  data_registro: string;            // era entry_date
  aerodromo_partida: string;        // era departure_aerodrome
  aerodromo_chegada: string;        // era arrival_aerodrome

  // Tempos (time without time zone → string HH:MM)
  tripulacao_checkin_hora?: string; // era crew_checkin_time
  tempo_ac?: string;                // era ac_time
  tempo_dep?: string;               // era dep_time
  tempo_pou?: string;               // era pou_time
  tempo_cor?: string;               // era cor_time

  // Horas (numeric)
  tempo_voo: number;                // era time
  horas_diurnas: number;            // era day_time
  horas_noturnas: number;           // era night_time
  tempo_total: number;              // era total_time
  tempo_ifr: number;                // era ifr_time

  // Operacional
  distancia_nm: number;             // era distance_nm
  pousos_total: number;             // era pousos
  celula: number;

  // Combustível
  combustivel_adicionado?: number;  // era fuel_added
  litros_combustivel: number;       // era fuel_liters

  // Tripulação (agora UUIDs)
  pic_canac: string;                // continua pic_canac mas referencia UUID de crew_members
  sic_canac?: string;               // UUID ou null
  sic_name?: string;                // nome livre quando não é crew_member cadastrado

  // Rateio / custeio
  clientes_id?: string;             // era voo_para (FK para clientes)
  empreendimento?: boolean;         // flag de rateio GA (era checado via extras/voo_para)

  // Extras / observações
  natureza_voo: string;
  ocorrencias?: string;
  discrepancias?: string;
  acoes_corretivas?: string;
  trecho?: string;                  // gerado automaticamente pelo trigger

  // Parceiros / empréstimo
  parceiro_tomador_emprestimo_id?: string;
  cliente_tomador_emprestimo_id?: string;
  socios_cliente_id?: string;
  socios_nome?: string;

  // Status
  confirmado: boolean;
  fechado?: boolean;

  // Sequencial
  numero_sequencial?: number;
}

interface DiarioMes {
  id: string;
  aeronave_id: string;
  ano: number;
  mes: number;
  celula_anterior_ttotal?: number;
  celula_atual_ttotal?: number;
  celula_prox_revisao_ttotal?: number;
  celula_disponivel_ttotal?: number;
  horimetro_inicio?: number;
  horimetro_final?: number;
  horimetro_ativo?: number;
  fechado?: boolean;
  confirmado?: boolean;
  confirmado_em?: string;
}

interface Aircraft {
  id: string;
  matricula: string;
  model: string;
  fuel_consumption: number;
  cell_hours_before?: number;
}

interface CrewMember {
  id: string;
  canac: string;
  nome_completo: string;            // corrigido: era full_name no componente mas nome_completo na busca
}

interface Client {
  id: string;
  razao_social: string;
}

interface Aerodrome {
  id: string;
  designativo: string;
  name: string;
  coordenadas?: string;
}

interface LogbookDetailsProps {
  aircraft: Aircraft;
  diarioMes?: DiarioMes;
  entries: LogbookEntry[];
  crewMembers: CrewMember[];
  clients: Client[];
  aerodromes: Aerodrome[];
  onBack: () => void;
  onSaveEntry: (entry: LogbookEntry) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  canEdit?: boolean;
  canConfirm?: boolean;
  isMonthClosed?: boolean;
  onCloseMonth?: () => Promise<void>;
  hasPartners?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const decimalToHM = (decimal: number | undefined | null): string => {
  if (decimal === undefined || decimal === null || isNaN(decimal) || decimal <= 0) return "00:00";
  const totalMinutes = Math.round(decimal * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

/** Formata data_registro (date ISO) para exibição */
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '---';
  try {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

// ─── Componente Principal ─────────────────────────────────────────────────────

const LogbookDetails: React.FC<LogbookDetailsProps> = ({
  aircraft,
  diarioMes,
  entries,
  crewMembers,
  clients,
  aerodromes,
  onBack,
  onSaveEntry,
  onDeleteEntry,
  canEdit = true,
  canConfirm = true,
  isMonthClosed = false,
  onCloseMonth,
  hasPartners = false
}) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [entries]);

  // Rateio GA: usa o campo `empreendimento` (boolean) do schema
  const rateioGA = useMemo(() => {
    return entries
      .filter(e => e.empreendimento === true)
      .reduce((total, e) => total + (e.tempo_total || 0), 0);
  }, [entries]);

  const totals = useMemo(() => {
    return entries.reduce((acc, e) => ({
      dist: acc.dist + (e.distancia_nm || 0),
      block: acc.block + (e.tempo_total || 0),
      fuel: acc.fuel + (e.litros_combustivel || 0)
    }), { dist: 0, block: 0, fuel: 0 });
  }, [entries]);

  // Célula atual: usa o último registro ou o valor do diario_mes
  const celulaAtual = diarioMes?.celula_atual_ttotal
    ?? entries[entries.length - 1]?.celula
    ?? 0;

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-sky-500 animate-spin" />
        <p className="text-slate-400 font-medium italic">Sincronizando registros do banco...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Stats */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 bg-slate-900 border border-slate-800 p-6 rounded-3xl">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">{aircraft.matricula}</h2>
              <p className="text-slate-400 text-sm">
                Controle de Horas
                {diarioMes ? ` — ${String(diarioMes.mes).padStart(2, '0')}/${diarioMes.ano}` : ' do mês Corrente'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Célula Atual</p>
              <p className="text-xl font-black text-emerald-400">{celulaAtual.toFixed(1)} h</p>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Consumo Médio</p>
              <p className="text-xl font-black text-amber-500">{aircraft.fuel_consumption} L/H</p>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Combustível</p>
              <p className="text-xl font-black text-white">{totals.fuel.toFixed(0)} L</p>
            </div>
            <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Dist. Percorrida</p>
              <p className="text-xl font-black text-emerald-500">{totals.dist.toFixed(0)} NM</p>
            </div>
          </div>
        </div>

        {/* Card Banco de Horas GA — só se houver partners */}
        {hasPartners && (
          <div className="w-full md:w-80 bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl relative overflow-hidden flex flex-col justify-center">
            <TrendingUp className="absolute -bottom-4 -right-4 w-32 h-32 text-amber-500/5" />
            <div className="flex items-center gap-2 mb-2">
              <History className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-amber-500 text-sm">Banco de Horas GA</h3>
            </div>
            <p className="text-[10px] text-amber-500/70 mb-2 font-bold uppercase">Saldo de Empréstimo WATT</p>
            <p className="text-4xl font-black text-amber-500">{decimalToHM(rateioGA)}</p>
            <div className="mt-4 p-2 bg-amber-500/10 rounded-xl border border-amber-500/10 flex items-start gap-2">
              <Info className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-[9px] text-amber-700 font-bold leading-tight">
                Crédito gerado pelo rateio GA Service. Descontar do faturamento WATT.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabela de Lançamentos */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-medium border-collapse min-w-[1400px]">
            <thead>
              <tr className="bg-slate-800 text-slate-400 font-black uppercase text-[9px] tracking-wider border-b border-slate-700">
                <th className="px-4 py-4 text-center">Seq.</th>
                <th className="px-4 py-4 text-center">Data</th>
                <th className="px-4 py-4 text-left">Trecho (OACI)</th>
                <th className="px-4 py-4 text-center">Distância</th>
                <th className="px-4 py-4 text-center">T. VOO</th>
                <th className="px-4 py-4 text-center">TOTAL</th>
                <th className="px-4 py-4 text-center">Célula</th>
                <th className="px-4 py-4 text-left">Comandante</th>
                <th className="px-4 py-4 text-left">Custeio (Cliente)</th>
                <th className="px-4 py-4 text-center bg-indigo-500/10 text-indigo-400">Controle / Rateio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {entries.map((entry, idx) => {
                const isGA = entry.empreendimento === true;
                // Busca crew por UUID (pic_canac agora é UUID)
                const pic = crewMembers.find(c => c.id === entry.pic_canac);
                // Busca cliente pelo clientes_id
                const client = clients.find(c => c.id === entry.clientes_id);

                return (
                  <tr
                    key={entry.id || idx}
                    className={`hover:bg-slate-800/30 transition-colors group ${isGA ? 'bg-amber-500/[0.03]' : ''}`}
                  >
                    <td className="px-4 py-3 text-center text-slate-600 font-mono text-[10px]">
                      {entry.numero_sequencial ?? idx + 1}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-300">
                      {formatDate(entry.data_registro)}
                    </td>
                    <td className="px-4 py-3 text-left font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-sky-400 font-bold">{entry.aerodromo_partida}</span>
                        <span className="text-slate-600">→</span>
                        <span className="text-sky-400 font-bold">{entry.aerodromo_chegada}</span>
                      </div>
                      {entry.natureza_voo && (
                        <span className="text-[8px] text-slate-600 font-semibold">{entry.natureza_voo}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-emerald-500 font-bold bg-emerald-500/[0.02]">
                      {entry.distancia_nm ? `${entry.distancia_nm.toFixed(1)} NM` : '---'}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">{decimalToHM(entry.tempo_voo)}</td>
                    <td className="px-4 py-3 text-center font-black text-white">{decimalToHM(entry.tempo_total)}</td>
                    <td className="px-4 py-3 text-center text-emerald-400 font-black">
                      {entry.celula?.toFixed(1) ?? '---'}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[9px] text-slate-400">
                          {pic?.nome_completo?.charAt(0) ?? '?'}
                        </div>
                        <span className="text-slate-300 font-semibold">
                          {pic?.nome_completo ?? '---'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <span className="text-indigo-400 font-bold">
                        {client?.razao_social?.split(' - ')[0] ?? '---'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isGA ? (
                        <div className="flex flex-col items-center">
                          <div className="px-2 py-1 bg-amber-500 text-slate-950 rounded text-[9px] font-black uppercase flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> LANC GA
                          </div>
                          <span className="text-[8px] text-amber-600 mt-1 font-black">RATEIO DE HORAS</span>
                        </div>
                      ) : (
                        <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border inline-flex items-center gap-1.5 ${
                          entry.confirmado
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-600 border-slate-700'
                        }`}>
                          {entry.confirmado ? (
                            <><CheckCircle className="w-3 h-3" /> CONFERIDO</>
                          ) : (
                            'PENDENTE'
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totais */}
      <div className={`grid gap-6 ${hasPartners ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Resumo do Mês</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <span className="text-slate-400">Total Distância</span>
              <span className="text-white font-black">{totals.dist.toFixed(1)} NM</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <span className="text-slate-400">Total Horas</span>
              <span className="text-white font-black">{decimalToHM(totals.block)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Combustível</span>
              <span className="text-amber-500 font-black">{totals.fuel.toFixed(0)} L</span>
            </div>
          </div>
        </div>

        {hasPartners && (
          <div className="bg-amber-500/5 border border-amber-500/20 p-6 rounded-3xl">
            <h3 className="text-sm font-black text-amber-500 uppercase tracking-widest mb-4">Rateio GA</h3>
            <p className="text-4xl font-black text-amber-500 mb-3">{decimalToHM(rateioGA)}</p>
            <p className="text-[10px] text-amber-600 font-bold">Horas de empréstimo para WATT</p>
          </div>
        )}

        <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-3xl">
          <h3 className="text-sm font-black text-emerald-500 uppercase tracking-widest mb-4">Célula Atual</h3>
          <p className="text-4xl font-black text-emerald-400 mb-3">{celulaAtual.toFixed(1)} h</p>
          {diarioMes?.celula_prox_revisao_ttotal && (
            <p className="text-[10px] text-emerald-600 font-bold">
              Próx. revisão: {diarioMes.celula_prox_revisao_ttotal.toFixed(1)} h
            </p>
          )}
          <p className="text-[10px] text-emerald-600 font-bold mt-1">Horas totais acumuladas</p>
        </div>
      </div>
    </div>
  );
};

export { LogbookDetails };
export default LogbookDetails;