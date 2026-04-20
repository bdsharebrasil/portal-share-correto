import React, { useState, useEffect } from "react";
import { X, Download, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";

const monthNames = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

interface MonthOption {
  mes: number;
  ano: number;
}

interface ExportDiarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (meses: MonthOption[]) => void;
  availableMeses: MonthOption[];
  currentMes: number;
  currentAno: number;
  isLoading?: boolean;
}

export function ExportDiarioModal({
  isOpen,
  onClose,
  onExport,
  availableMeses,
  currentMes,
  currentAno,
  isLoading = false,
}: ExportDiarioModalProps) {
  const [selectedMeses, setSelectedMeses] = useState<Set<string>>(new Set());

  // Inicializar com o mês atual selecionado
  useEffect(() => {
    if (isOpen) {
      setSelectedMeses(new Set([`${currentAno}-${currentMes}`]));
    }
  }, [isOpen, currentMes, currentAno]);

  const toggleMonth = (mes: number, ano: number) => {
    const key = `${ano}-${mes}`;
    const newSelected = new Set(selectedMeses);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedMeses(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedMeses.size === availableMeses.length) {
      setSelectedMeses(new Set());
    } else {
      const all = new Set(availableMeses.map((m) => `${m.ano}-${m.mes}`));
      setSelectedMeses(all);
    }
  };

  const handleExport = () => {
    const selectedArray = Array.from(selectedMeses)
      .map((key) => {
        const [ano, mes] = key.split("-").map(Number);
        return { mes, ano };
      })
      .sort((a, b) => {
        if (a.ano !== b.ano) return a.ano - b.ano;
        return a.mes - b.mes;
      });

    if (selectedArray.length > 0) {
      onExport(selectedArray);
    }
  };

  if (!isOpen) return null;

  // Agrupar meses por ano
  const mesesPorAno = new Map<number, typeof availableMeses>();
  for (const m of availableMeses) {
    if (!mesesPorAno.has(m.ano)) {
      mesesPorAno.set(m.ano, []);
    }
    mesesPorAno.get(m.ano)!.push(m);
  }

  const anosOrdenados = Array.from(mesesPorAno.keys()).sort((a, b) => b - a);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Exportar Diário de Bordo</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-white transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info text */}
        <p className="text-sm text-slate-400 mb-6">
          Selecione os meses que deseja exportar. Serão incluídas as colunas de registros de voo (exceto "CONFIRMADO POR"), resumo por cliente/sócio e totais consolidados se múltiplos meses forem selecionados.
        </p>

        {/* Months selection */}
        <div className="max-h-96 overflow-y-auto mb-6 space-y-4">
          {availableMeses.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Nenhum mês disponível para exportação</p>
          ) : (
            anosOrdenados.map((ano) => (
              <div key={ano}>
                <h3 className="text-sm font-semibold text-cyan-400 mb-2">{ano}</h3>
                <div className="space-y-2 ml-2">
                  {mesesPorAno.get(ano)!.map((m) => {
                    const key = `${m.ano}-${m.mes}`;
                    const isSelected = selectedMeses.has(key);
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleMonth(m.mes, m.ano)}
                          disabled={isLoading}
                          className="w-4 h-4 rounded border-slate-500 text-cyan-500 disabled:opacity-50"
                        />
                        <span className="text-sm text-slate-300 flex-1">
                          {monthNames[m.mes - 1].charAt(0).toUpperCase() + monthNames[m.mes - 1].slice(1)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Select all / Deselect all */}
        {availableMeses.length > 0 && (
          <div className="mb-6">
            <button
              onClick={handleSelectAll}
              disabled={isLoading}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50">
              {selectedMeses.size === availableMeses.length
                ? "Desselecionar tudo"
                : "Selecionar tudo"}
            </button>
          </div>
        )}

        {/* Selected count */}
        <div className="mb-6 text-sm text-slate-400">
          {selectedMeses.size} mês{selectedMeses.size !== 1 ? "es" : ""} selecionado{selectedMeses.size !== 1 ? "s" : ""}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={selectedMeses.size === 0 || isLoading}
            className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-semibold rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Exportar PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
