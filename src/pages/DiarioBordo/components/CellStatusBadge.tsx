import { BookOpen } from 'lucide-react';

interface CellStatusBadgeProps {
  type: 'atual' | 'revisao' | 'disponivel';
  value: number | null;
}

const typeConfig = {
  atual: {
    label: 'Célula Atual',
    bgColor: 'bg-slate-800/50',
    textColor: 'text-emerald-400',
  },
  revisao: {
    label: 'Próxima Revisão',
    bgColor: 'bg-slate-800/50',
    textColor: 'text-yellow-400',
  },
  disponivel: {
    label: 'Disponível',
    bgColor: 'bg-slate-800/50',
    textColor: 'text-blue-400',
  },
};

export function CellStatusBadge({ type, value }: CellStatusBadgeProps) {
  const config = typeConfig[type];

  // ✅ Exibe decimal igual ao dashboard (ex: 2182.70)
  const displayValue = value !== null && value !== undefined
    ? value.toFixed(2)
    : '---';

  // Cor vermelha se disponível for negativo
  const textColor =
    type === 'disponivel' && value !== null && value < 0
      ? 'text-red-400'
      : config.textColor;

  return (
    <div className={`flex items-center gap-2 p-2 ${config.bgColor} rounded`}>
      <BookOpen className="w-3 h-3 text-slate-500" />
      <div className="flex-1 min-w-0">
        <p className="text-slate-500 text-xs uppercase">{config.label}</p>
        <p className={`${textColor} font-semibold text-base`}>
          {displayValue}
        </p>
      </div>
    </div>
  );
}