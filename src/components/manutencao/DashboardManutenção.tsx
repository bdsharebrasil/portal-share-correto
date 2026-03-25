import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, AlertCircle, CheckCircle, Clock, Wrench, Settings, Plus, History, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAeronaves } from '@/hooks/useAeronaves';
import { useMaintenanceStatuses } from '@/hooks/useMaintenanceAlerts';
import { ManutencaoAlertCard } from './ManutencaoAlertCard';
import { ManutencaoRegistroDialog } from './ManutencaoRegistroDialog';
import { ManutencaoHistoricoDialog } from './ManutencaoHistoricoDialog';
import { ManutencaoConfigDialog } from './ManutencaoConfigDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AirplaneSpinner } from '@/components/ui/airplane-spinner';

interface AircraftMaintenanceCardProps {
  aircraft: {
    id: string;
    registration: string;
    model: string;
    manufacturer: string;
  };
}

function AircraftMaintenanceCard({ aircraft }: AircraftMaintenanceCardProps) {
  const { statuses, mostCritical, hasBlocking, isLoading, currentHours } = useMaintenanceStatuses(aircraft.id);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-slate-800/30 border border-white/5 rounded-2xl p-6 flex items-center justify-center min-h-[200px]">
        <AirplaneSpinner size="md" />
      </div>
    );
  }

  const statusCounts = {
    red: statuses.filter(s => s.alertLevel === 'red').length,
    orange: statuses.filter(s => s.alertLevel === 'orange').length,
    yellow: statuses.filter(s => s.alertLevel === 'yellow').length,
    green: statuses.filter(s => s.alertLevel === 'green').length,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-slate-800/30 backdrop-blur-xl border rounded-2xl overflow-hidden transition-all',
        hasBlocking ? 'border-red-500/50 shadow-lg shadow-red-500/10' : 'border-white/5'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-gradient-to-r from-slate-800/50 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              hasBlocking 
                ? 'bg-gradient-to-br from-red-500/20 to-red-600/20 ring-1 ring-red-500/30' 
                : 'bg-gradient-to-br from-blue-500/20 to-cyan-600/20 ring-1 ring-white/10'
            )}>
              <Plane className={cn(
                'text-xl',
                hasBlocking ? 'text-red-400' : 'text-blue-400'
              )} />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">{aircraft.registration}</h3>
              <p className="text-xs text-gray-400">{aircraft.manufacturer} {aircraft.model}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentHours !== undefined && (
              <div className="text-right mr-2">
                <p className="text-lg font-bold text-white">{currentHours.toFixed(1)}h</p>
                <p className="text-xs text-gray-400">Célula Atual</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-white"
              onClick={() => setConfigOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Status Summary */}
        <div className="flex items-center gap-3 mt-3">
          {statusCounts.red > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/20 px-2 py-1 rounded-full">
              <AlertCircle className="h-3 w-3" />
              {statusCounts.red} Crítico
            </span>
          )}
          {statusCounts.orange > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-orange-400 bg-orange-500/20 px-2 py-1 rounded-full">
              <Clock className="h-3 w-3" />
              {statusCounts.orange} Urgente
            </span>
          )}
          {statusCounts.yellow > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-yellow-400 bg-yellow-500/20 px-2 py-1 rounded-full">
              <Bell className="h-3 w-3" />
              {statusCounts.yellow} Atenção
            </span>
          )}
          {statusCounts.red === 0 && statusCounts.orange === 0 && statusCounts.yellow === 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-500/20 px-2 py-1 rounded-full">
              <CheckCircle className="h-3 w-3" />
              Tudo em dia
            </span>
          )}
        </div>
      </div>

      {/* Maintenance Cards */}
      <div className="p-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {statuses.map((status, index) => (
            <motion.div
              key={status.maintenanceType}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.1 }}
            >
              <ManutencaoAlertCard
                status={status}
                aircraftRegistration={aircraft.registration}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {statuses.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma manutenção configurada</p>
            <p className="text-xs opacity-60 mt-1">Configure os intervalos de manutenção</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-white/5 flex items-center gap-2">
        <Button
          onClick={() => setRegisterOpen(true)}
          className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
        >
          <Plus className="h-4 w-4 mr-2" />
          Registrar Manutenção
        </Button>
        <Button
          variant="ghost"
          onClick={() => setHistoryOpen(true)}
          className="text-gray-400 hover:text-white"
        >
          <History className="h-4 w-4 mr-2" />
          Histórico
        </Button>
      </div>

      {/* Dialogs */}
      <ManutencaoRegistroDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        aircraftId={aircraft.id}
        aircraftRegistration={aircraft.registration}
        currentHours={currentHours || 0}
      />
      <ManutencaoHistoricoDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        aircraftId={aircraft.id}
        aircraftRegistration={aircraft.registration}
      />
      <ManutencaoConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        aircraftId={aircraft.id}
        aircraftRegistration={aircraft.registration}
      />
    </motion.div>
  );
}

interface DashboardManutencaoProps {
  aircraftWithHours?: Set<string>;
}

export function DashboardManutenção({ aircraftWithHours }: DashboardManutencaoProps = {}) {
  const { aeronaves, isLoadingAeronaves } = useAeronaves();
  const [selectedTab, setSelectedTab] = useState<'all' | 'critical' | 'ok'>('all');

  const activeAircraft = aeronaves.filter(a => {
    const isActive = a.status?.toLowerCase() === 'ativa' || a.status?.toLowerCase() === 'ativo';
    const hasHours = aircraftWithHours ? aircraftWithHours.has(a.id) : true;
    return isActive && hasHours;
  });

  if (isLoadingAeronaves) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <AirplaneSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20 ring-1 ring-white/10">
            <Wrench className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Manutenção Preventiva
            </h1>
            <p className="text-sm text-gray-400">
              Monitoramento automático de intervalos de manutenção
            </p>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
          <TabsList className="bg-slate-800/50">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="critical">Críticas</TabsTrigger>
            <TabsTrigger value="ok">Em dia</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Aircraft Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeAircraft.map((aircraft) => (
          <AircraftMaintenanceCard
            key={aircraft.id}
            aircraft={{
              id: aircraft.id,
              registration: aircraft.registration,
              model: aircraft.model,
              manufacturer: aircraft.manufacturer,
            }}
          />
        ))}
      </div>

      {activeAircraft.length === 0 && (
        <div className="text-center py-16">
          <Plane className="h-16 w-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-xl font-semibold text-white mb-2">
            Nenhuma aeronave ativa
          </h3>
          <p className="text-gray-400">
            Cadastre aeronaves para monitorar suas manutenções
          </p>
        </div>
      )}
    </div>
  );
}
