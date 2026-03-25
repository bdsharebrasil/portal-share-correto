import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMaintenanceRecords } from '@/hooks/useMaintenanceAlerts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, Wrench, Calendar, Clock, User, Building, DollarSign, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AirplaneSpinner } from '@/components/ui/airplane-spinner';

interface ManutencaoHistoricoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  aircraftRegistration: string;
}

export function ManutencaoHistoricoDialog({
  open,
  onOpenChange,
  aircraftId,
  aircraftRegistration,
}: ManutencaoHistoricoDialogProps) {
  const { data: records, isLoading } = useMaintenanceRecords(aircraftId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-900 border-white/10 max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <History className="h-5 w-5 text-blue-400" />
            Histórico de Manutenções - {aircraftRegistration}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <AirplaneSpinner size="md" />
            </div>
          ) : records && records.length > 0 ? (
            <div className="space-y-4">
              {records.map((record, index) => (
                <div
                  key={record.id}
                  className="bg-slate-800/50 border border-white/5 rounded-xl p-4 space-y-3"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Wrench className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                            {record.maintenance_type}
                          </Badge>
                          {record.service_order_number && (
                            <span className="text-xs text-gray-400">
                              OS: {record.service_order_number}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 mt-1">
                          {record.description || 'Sem descrição'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">
                        {Number(record.performed_at_hours).toFixed(1)}h
                      </p>
                      <p className="text-xs text-gray-400">célula</p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-300">
                        {format(new Date(record.performed_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-green-400">
                        Próx: {Number(record.next_due_hours).toFixed(1)}h
                      </span>
                    </div>

                    {record.mechanic_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-300 truncate">{record.mechanic_name}</span>
                      </div>
                    )}

                    {record.maintenance_center && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-300 truncate">{record.maintenance_center}</span>
                      </div>
                    )}

                    {record.cost && (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-300">
                          R$ {Number(record.cost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Observations */}
                  {record.observations && (
                    <div className="pt-2 border-t border-white/5">
                      <p className="text-xs text-gray-400">
                        <span className="font-semibold">Obs:</span> {record.observations}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma manutenção registrada</p>
              <p className="text-xs opacity-60 mt-1">
                Registre a primeira manutenção para iniciar o histórico
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
