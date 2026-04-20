import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAddMaintenanceRecord } from '@/hooks/useMaintenanceAlerts';
import { MaintenanceType, DEFAULT_CONFIGS } from '@/lib/maintenance-alerts';
import { Wrench, Calendar, Clock, User, Building, FileText, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface RegisterMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  aircraftRegistration: string;
  currentHours: number;
}

export function RegisterMaintenanceDialog({
  open,
  onOpenChange,
  aircraftId,
  aircraftRegistration,
  currentHours,
}: RegisterMaintenanceDialogProps) {
  const { toast } = useToast();
  const addRecord = useAddMaintenanceRecord();
  
  const [formData, setFormData] = useState({
    maintenanceType: '50h' as MaintenanceType,
    performedAtHours: currentHours.toString(),
    performedDate: format(new Date(), 'yyyy-MM-dd'),
    mechanicName: '',
    maintenanceCenter: '',
    serviceOrderNumber: '',
    description: '',
    cost: '',
    observations: '',
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const performedHours = parseFloat(formData.performedAtHours);
      const intervalHours = DEFAULT_CONFIGS[formData.maintenanceType].intervalHours;
      const nextDueHours = performedHours + intervalHours;

      await addRecord.mutateAsync({
        aircraft_id: aircraftId,
        maintenance_type: formData.maintenanceType,
        performed_at_hours: performedHours,
        performed_date: formData.performedDate,
        next_due_hours: nextDueHours,
        mechanic_name: formData.mechanicName || undefined,
        maintenance_center: formData.maintenanceCenter || undefined,
        service_order_number: formData.serviceOrderNumber || undefined,
        description: formData.description || undefined,
        cost: formData.cost ? parseFloat(formData.cost) : undefined,
        observations: formData.observations || undefined,
        created_by: userData.user?.id,
      });

      toast({
        title: 'Manutenção registrada',
        description: `Manutenção de ${formData.maintenanceType} registrada com sucesso. Próxima em ${nextDueHours.toFixed(1)}h.`,
      });

      onOpenChange(false);
      
      // Reset form
      setFormData({
        maintenanceType: '50h',
        performedAtHours: currentHours.toString(),
        performedDate: format(new Date(), 'yyyy-MM-dd'),
        mechanicName: '',
        maintenanceCenter: '',
        serviceOrderNumber: '',
        description: '',
        cost: '',
        observations: '',
      });
    } catch (error) {
      console.error('Error registering maintenance:', error);
      toast({
        title: 'Erro ao registrar',
        description: 'Não foi possível registrar a manutenção.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-slate-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Wrench className="h-5 w-5 text-blue-400" />
            Registrar Manutenção - {aircraftRegistration}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Maintenance Type */}
            <div className="space-y-2">
              <Label className="text-gray-300">Tipo de Manutenção</Label>
              <Select
                value={formData.maintenanceType}
                onValueChange={(v) => setFormData({ ...formData, maintenanceType: v as MaintenanceType })}
              >
                <SelectTrigger className="bg-slate-800 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-white/10">
                  <SelectItem value="50h">Inspeção 50 Horas</SelectItem>
                  <SelectItem value="100h">Inspeção 100 Horas</SelectItem>
                  <SelectItem value="150h">Inspeção 150 Horas</SelectItem>
                  <SelectItem value="200h">Inspeção 200 Horas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Performed Date */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Data Realizada
              </Label>
              <Input
                type="date"
                value={formData.performedDate}
                onChange={(e) => setFormData({ ...formData, performedDate: e.target.value })}
                className="bg-slate-800 border-white/10"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Performed At Hours */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Célula na Manutenção (h)
              </Label>
              <Input
                type="number"
                step="0.1"
                value={formData.performedAtHours}
                onChange={(e) => setFormData({ ...formData, performedAtHours: e.target.value })}
                className="bg-slate-800 border-white/10"
                required
              />
            </div>

            {/* Next Due (calculated) */}
            <div className="space-y-2">
              <Label className="text-gray-300">Próxima Manutenção (h)</Label>
              <div className="h-10 px-3 flex items-center bg-slate-800/50 border border-white/10 rounded-md text-green-400 font-semibold">
                {(parseFloat(formData.performedAtHours || '0') + DEFAULT_CONFIGS[formData.maintenanceType].intervalHours).toFixed(1)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Mechanic */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-1">
                <User className="h-3 w-3" />
                Mecânico Responsável
              </Label>
              <Input
                value={formData.mechanicName}
                onChange={(e) => setFormData({ ...formData, mechanicName: e.target.value })}
                placeholder="Nome do mecânico"
                className="bg-slate-800 border-white/10"
              />
            </div>

            {/* Maintenance Center */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-1">
                <Building className="h-3 w-3" />
                Centro de Manutenção
              </Label>
              <Input
                value={formData.maintenanceCenter}
                onChange={(e) => setFormData({ ...formData, maintenanceCenter: e.target.value })}
                placeholder="Nome da oficina"
                className="bg-slate-800 border-white/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Service Order */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Nº Ordem de Serviço
              </Label>
              <Input
                value={formData.serviceOrderNumber}
                onChange={(e) => setFormData({ ...formData, serviceOrderNumber: e.target.value })}
                placeholder="OS-12345"
                className="bg-slate-800 border-white/10"
              />
            </div>

            {/* Cost */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Custo (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                placeholder="0.00"
                className="bg-slate-800 border-white/10"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-gray-300">Descrição dos Serviços</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva os serviços realizados..."
              className="bg-slate-800 border-white/10 min-h-[80px]"
            />
          </div>

          {/* Observations */}
          <div className="space-y-2">
            <Label className="text-gray-300">Observações</Label>
            <Textarea
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              placeholder="Observações adicionais..."
              className="bg-slate-800 border-white/10 min-h-[60px]"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {loading ? 'Salvando...' : 'Registrar Manutenção'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
