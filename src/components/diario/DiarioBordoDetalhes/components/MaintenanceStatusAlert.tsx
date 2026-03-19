import React from 'react';
import { AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface MaintenanceStatusAlertProps {
  celulaAtual: number;
  celulaProxRevisao: number;
  celulaPorcentoAlerta?: number; // Percentual para alertar (padrão: 20%)
}

export function MaintenanceStatusAlert({
  celulaAtual,
  celulaProxRevisao,
  celulaPorcentoAlerta = 20,
}: MaintenanceStatusAlertProps) {
  if (!celulaProxRevisao || celulaProxRevisao <= 0) {
    return null;
  }

  // Calcular horas disponíveis
  const horasDisponiveis = Math.max(0, celulaProxRevisao - celulaAtual);
  const horasRealizadas = celulaAtual;
  const percentualRealizado = (horasRealizadas / celulaProxRevisao) * 100;
  const percentualDisponivel = (horasDisponiveis / celulaProxRevisao) * 100;

  // Determinar status e cor
  let status = 'ok';
  let statusLabel = 'Revisão Programada';
  let statusColor = 'bg-green-500/10 border-green-500/30 text-green-400';
  let iconColor = 'text-green-400';
  let Icon = CheckCircle;

  if (horasDisponiveis <= 0) {
    status = 'vencido';
    statusLabel = 'REVISÃO VENCIDA';
    statusColor = 'bg-red-500/20 border-red-500/40 text-red-400';
    iconColor = 'text-red-500';
    Icon = AlertCircle;
  } else if (percentualDisponivel <= celulaPorcentoAlerta) {
    status = 'alerta';
    statusLabel = 'PRÓXIMO DO VENCIMENTO';
    statusColor = 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400';
    iconColor = 'text-yellow-500';
    Icon = AlertTriangle;
  } else {
    status = 'ok';
    statusLabel = 'Revisão Programada';
    statusColor = 'bg-green-500/10 border-green-500/30 text-green-400';
    iconColor = 'text-green-400';
    Icon = CheckCircle;
  }

  return (
    <div className={`border rounded-lg p-4 space-y-3 ${statusColor}`}>
      {/* Header com Status */}
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${iconColor}`} />
        <span className="font-semibold uppercase text-sm tracking-wide">
          {statusLabel}
        </span>
      </div>

      {/* Grid de informações */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <p className="text-xs opacity-75">Horas Realizadas</p>
          <p className="text-lg font-bold">
            {horasRealizadas.toFixed(1)}h
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs opacity-75">Horas Disponíveis</p>
          <p className={`text-lg font-bold ${horasDisponiveis <= 0 ? 'text-red-400' : ''}`}>
            {horasDisponiveis.toFixed(1)}h
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs opacity-75">Total Programado</p>
          <p className="text-lg font-bold">
            {celulaProxRevisao.toFixed(1)}h
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs opacity-75">Percentual</p>
          <p className="text-lg font-bold">
            {percentualRealizado.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="w-full bg-slate-800/50 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            status === 'vencido'
              ? 'bg-red-500'
              : status === 'alerta'
              ? 'bg-yellow-500'
              : 'bg-green-500'
          }`}
          style={{ width: `${Math.min(percentualRealizado, 100)}%` }}
        />
      </div>

      {/* Mensagem de alerta */}
      {status === 'vencido' && (
        <div className="pt-2 border-t border-current/20 text-xs font-semibold">
          ⚠️ A revisão já foi ultrapassada! Agende a manutenção imediatamente.
        </div>
      )}

      {status === 'alerta' && (
        <div className="pt-2 border-t border-current/20 text-xs font-semibold">
          ⚠️ Apenas {horasDisponiveis.toFixed(1)}h restantes até a próxima revisão.
        </div>
      )}
    </div>
  );
}
