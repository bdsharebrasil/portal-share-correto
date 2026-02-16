// components/AircraftCard.tsx
import { BookOpen, Banknote } from 'lucide-react';
import type { Aircraft } from '@/types';
import type { LogbookMonthData } from '../types';
import { CellStatusBadge } from './CellStatusBadge';
import { decimalToHM } from '../utils/timeFormatting';

interface AircraftCardProps {
  aircraft: Aircraft;
  logbookData: LogbookMonthData | null;
  onViewDiario: () => void;
  onViewBanco: () => void;
}

export function AircraftCard({
  aircraft,
  logbookData,
  onViewDiario,
  onViewBanco,
}: AircraftCardProps) {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-slate-700 hover:shadow-lg transition-all duration-300 hover:scale-102">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 bg-sky-500/20 rounded-lg">
          <BookOpen className="w-5 h-5 text-sky-500" />
        </div>
        {aircraft.status && (aircraft.status === 'ativa' || aircraft.status === 'ativo' || aircraft.status === 'Ativa' || aircraft.status === 'Ativo') && (
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg uppercase">
            Ativa
          </span>
        )}
      </div>

      {/* Aircraft Info */}
      <div className="mb-4">
        <h3 className="text-xl font-black text-white mb-0.5">
          {aircraft.registration}
        </h3>
        <p className="text-slate-500 text-xs uppercase">{aircraft.model}</p>
      </div>

      {/* Status Badges */}
      <div className="space-y-2 mb-4">
        {logbookData ? (
          <>
            <CellStatusBadge type="atual" value={logbookData.celula_atual} />
            <CellStatusBadge type="revisao" value={logbookData.celula_prox_revisao} />
            <CellStatusBadge type="disponivel" value={logbookData.celula_disponivel} />
          </>
        ) : (
          <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded">
            <BookOpen className="w-3 h-3 text-slate-500" />
            <div className="flex-1 min-w-0">
              <p className="text-slate-500 text-xs uppercase">Célula Atual</p>
              <p className="text-emerald-400 font-semibold text-base">
                {aircraft.cell_hours_current ? decimalToHM(aircraft.cell_hours_current) : '---'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onViewDiario}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-sky-500 text-white font-semibold rounded-lg hover:bg-sky-600 transition-colors"
        >
          <BookOpen className="w-3 h-3" />
          Diário
        </button>
        <button
          onClick={onViewBanco}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-slate-800 text-slate-400 font-semibold rounded-lg hover:bg-slate-700 transition-colors border border-slate-700"
        >
          <Banknote className="w-3 h-3" />
          Banco
        </button>
      </div>
    </div>
  );
}
