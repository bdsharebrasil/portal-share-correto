// components/FlightEntryRow.tsx
import { useState } from 'react';
import { FlightEntry } from '../types';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { FLIGHT_NATURE_LABELS } from '../constants';
import { cn } from '@/lib/utils';

interface FlightEntryRowProps {
  entry: FlightEntry;
  onEdit: (entry: FlightEntry) => void;
  onDelete: (entry: FlightEntry) => void;
  crewMembers?: { id: string; full_name: string; canac: string }[];
}

export function FlightEntryRow({ entry, onEdit, onDelete, crewMembers = [] }: FlightEntryRowProps) {
  const [expanded, setExpanded] = useState(false);

  const formatTime = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  const getNatureLabel = (nature: string): string => {
    return FLIGHT_NATURE_LABELS[nature] || nature;
  };

  const getNatureBadgeColor = (nature: string): string => {
    switch (nature) {
      case 'PV':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'EP':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'CQ':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'TR':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'TN':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  // Resolver nome do PIC/SIC a partir do UUID
  const resolveCrewName = (crewId: string | undefined): string => {
    if (!crewId) return '-';
    const member = crewMembers.find(c => c.id === crewId);
    return member ? member.full_name : crewId;
  };

  const resolveSicDisplay = (): string | null => {
    if (entry.sic_name) return entry.sic_name;
    if (entry.sic_canac) return resolveCrewName(entry.sic_canac);
    return null;
  };

  return (
    <>
      <tr 
        className={cn(
          "border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer",
          expanded && "bg-slate-700/20"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="p-3">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
            <span className="text-sm text-slate-300">
              {format(new Date(entry.entry_date), 'dd/MM/yyyy')}
            </span>
          </div>
        </td>
        <td className="p-3">
          <span className="text-sm font-mono text-slate-300">
            {entry.departure_aerodrome} → {entry.arrival_aerodrome}
          </span>
        </td>
        <td className="p-3">
          <span className="text-sm text-slate-300">{resolveCrewName(entry.pic_canac)}</span>
        </td>
        <td className="p-3">
          <span className={cn(
            "text-xs px-2 py-1 rounded-full border",
            getNatureBadgeColor(entry.flight_nature)
          )}>
            {getNatureLabel(entry.flight_nature)}
          </span>
        </td>
        <td className="p-3 text-center">
          <span className="text-sm font-mono text-slate-300">
            {entry.ac_time} / {entry.cor_time}
          </span>
        </td>
        <td className="p-3 text-center">
          <span className="text-sm font-mono text-slate-300">
            {formatTime(entry.time)}
          </span>
        </td>
        <td className="p-3 text-center">
          <span className="text-sm font-mono font-semibold text-slate-200">
            {formatTime(entry.total_time)}
          </span>
        </td>
        <td className="p-3 text-center">
          <span className="text-sm text-slate-300">{entry.pousos}</span>
        </td>
        <td className="p-3 text-center">
          <span className="text-sm text-slate-300">{entry.distance_nm}</span>
        </td>
        <td className="p-3">
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(entry)}
              className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(entry)}
              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>

      {/* Expanded details */}
      {expanded && (
        <tr className="bg-slate-700/10 border-b border-slate-700/50">
          <td colSpan={10} className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Horários:</span>
                <p className="text-slate-300 font-mono">
                  DEP: {entry.dep_time} | POU: {entry.pou_time}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Tempo Noturno:</span>
                <p className="text-slate-300">{formatTime(entry.night_hours)}</p>
              </div>
              <div>
                <span className="text-slate-500">IFR:</span>
                <p className="text-slate-300">{formatTime(entry.ifr_time)}</p>
              </div>
              <div>
                <span className="text-slate-500">Combustível:</span>
                <p className="text-slate-300">{entry.fuel_added} L</p>
              </div>
              {resolveSicDisplay() && (
                <div>
                  <span className="text-slate-500">SIC:</span>
                  <p className="text-slate-300">{resolveSicDisplay()}</p>
                </div>
              )}
              {entry.passengers > 0 && (
                <div>
                  <span className="text-slate-500">Passageiros:</span>
                  <p className="text-slate-300">{entry.passengers}</p>
                </div>
              )}
              {entry.cargo_kg > 0 && (
                <div>
                  <span className="text-slate-500">Carga:</span>
                  <p className="text-slate-300">{entry.cargo_kg} kg</p>
                </div>
              )}
              {entry.daily_rate != null && entry.daily_rate > 0 && (
                <div>
                  <span className="text-slate-500">Diárias:</span>
                  <p className="text-slate-300">
                    R$ {entry.daily_rate.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              )}
              {entry.remarks && (
                <div className="col-span-2 md:col-span-4">
                  <span className="text-slate-500">Observações:</span>
                  <p className="text-slate-300">{entry.remarks}</p>
                </div>
              )}
              {entry.occurrences && (
                <div className="col-span-2 md:col-span-4">
                  <span className="text-slate-500">Ocorrências:</span>
                  <p className="text-slate-300">{entry.occurrences}</p>
                </div>
              )}
              {entry.discrepancies && (
                <div className="col-span-2 md:col-span-4">
                  <span className="text-slate-500">Discrepâncias:</span>
                  <p className="text-slate-300">{entry.discrepancies}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
