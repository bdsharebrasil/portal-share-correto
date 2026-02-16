// components/CellStatusBadge.tsx
import { Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { decimalToHM } from '../utils/timeFormatting';

interface CellStatusBadgeProps {
  type: 'atual' | 'revisao' | 'disponivel';
  value: number | null | undefined;
}

export function CellStatusBadge({ type, value }: CellStatusBadgeProps) {
  if (type === 'atual') {
    return (
      <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded">
        <Zap className="w-3 h-3 text-emerald-400" />
        <div className="flex-1 min-w-0">
          <p className="text-emerald-600 text-xs uppercase">Célula Atual</p>
          <p className="text-emerald-400 font-semibold text-base">
            {decimalToHM(value)}
          </p>
        </div>
      </div>
    );
  }

  if (type === 'revisao') {
    return (
      <div className="flex items-center gap-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded">
        <AlertCircle className="w-3 h-3 text-orange-400" />
        <div className="flex-1 min-w-0">
          <p className="text-orange-600 text-xs uppercase">Próx. Revisão</p>
          <p className="text-orange-400 font-semibold text-sm">
            {decimalToHM(value)}
          </p>
        </div>
      </div>
    );
  }

  // type === 'disponivel'
  const isNegative = (value || 0) < 0;

  return (
    <div className={`flex items-center gap-2 p-2 rounded border ${
      isNegative
        ? 'bg-red-500/15 border-2 border-red-500 shadow-md shadow-red-500/30'
        : 'bg-blue-500/10 border border-blue-500/20'
    }`}>
      <CheckCircle className={`w-3 h-3 ${isNegative ? 'text-red-400' : 'text-blue-400'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs uppercase ${isNegative ? 'text-red-600' : 'text-blue-600'}`}>
          Disponível
        </p>
        <p className={`font-semibold text-sm ${isNegative ? 'text-red-400' : 'text-blue-400'}`}>
          {decimalToHM(value)}
        </p>
      </div>
    </div>
  );
}