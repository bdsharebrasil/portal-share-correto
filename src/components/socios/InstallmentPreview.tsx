import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InstallmentPreviewProps {
  description: string;
  totalAmount: number;
  installmentCount: number;
  startDate: string;
}

export function InstallmentPreview({
  description,
  totalAmount,
  installmentCount,
  startDate,
}: InstallmentPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  if (installmentCount <= 1) return null;

  const installmentAmount = totalAmount / installmentCount;
  const installments = Array.from({ length: installmentCount }, (_, i) => {
    const date = addMonths(new Date(startDate), i);
    return {
      number: i + 1,
      amount: installmentAmount,
      date: format(date, "dd/MMM/yyyy", { locale: ptBR }),
      isoDate: format(date, "yyyy-MM-dd"),
    };
  });

  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 dark:from-blue-950/40 dark:to-indigo-950/40 dark:border-blue-800/50 p-5 space-y-4">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between hover:opacity-75 transition-opacity"
      >
        <div className="flex-1 text-left space-y-2">
          <p className="font-semibold text-sm text-blue-900 dark:text-blue-300">
            📋 Resumo do Parcelamento
          </p>
          <div className="space-y-1">
            <p className="text-sm text-blue-800 dark:text-blue-400 font-medium truncate">
              {description}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-500">
              <strong>{installmentCount}x</strong> de{" "}
              <strong>R$ {installmentAmount.toFixed(2)}</strong> = Total:{" "}
              <strong>R$ {totalAmount.toFixed(2)}</strong>
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expandido */}
      {expanded && (
        <div className="pt-4 border-t border-blue-200 dark:border-blue-800/50 space-y-2">
          {installments.map((inst) => (
            <div
              key={inst.number}
              className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-zinc-900/50 border border-blue-100 dark:border-blue-900/50"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50 text-xs font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                  {inst.number}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-300">
                    Parcela {inst.number}/{installmentCount}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-500">
                    {inst.date}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-blue-900 dark:text-blue-300">
                  R$ {inst.amount.toFixed(2)}
                </p>
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="mt-3 p-3 rounded-lg bg-blue-100/50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                Total
              </p>
              <p className="text-sm font-bold text-blue-900 dark:text-blue-300">
                R$ {totalAmount.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
