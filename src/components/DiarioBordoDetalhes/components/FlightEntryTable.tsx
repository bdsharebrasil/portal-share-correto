// components/FlightEntryTable.tsx
import { FlightEntry } from '../types';
import { FlightEntryRow } from './FlightEntryRow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plane } from 'lucide-react';

interface FlightEntryTableProps {
  entries: FlightEntry[];
  isLoading: boolean;
  onEdit: (entry: FlightEntry) => void;
  onDelete: (entry: FlightEntry) => void;
  crewMembers?: { id: string; full_name: string; canac: string }[];
}

export function FlightEntryTable({
  entries,
  isLoading,
  onEdit,
  onDelete,
  crewMembers = [],
}: FlightEntryTableProps) {
  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-700/50 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Plane className="h-16 w-16 text-slate-600 mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">
              Nenhum voo registrado
            </h3>
            <p className="text-sm text-slate-500">
              Clique em "Novo Trecho" para adicionar seu primeiro voo
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Plane className="h-5 w-5" />
          Registros de Voo ({entries.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-3 text-xs font-semibold text-slate-400">Data</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-400">Rota</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-400">PIC</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-400">Natureza</th>
                <th className="text-center p-3 text-xs font-semibold text-slate-400">AC/COR</th>
                <th className="text-center p-3 text-xs font-semibold text-slate-400">Voo</th>
                <th className="text-center p-3 text-xs font-semibold text-slate-400">Bloco</th>
                <th className="text-center p-3 text-xs font-semibold text-slate-400">Pousos</th>
                <th className="text-center p-3 text-xs font-semibold text-slate-400">Dist (NM)</th>
                <th className="text-right p-3 text-xs font-semibold text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <FlightEntryRow
                  key={entry.id}
                  entry={entry}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  crewMembers={crewMembers}
                />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
