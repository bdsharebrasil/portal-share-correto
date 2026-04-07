import React, { useState, useEffect } from 'react';
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

interface Oficina {
  id: string;
  razao_social: string;
  mecanico_responsavel: string | null;
}

interface ManutencaoRegistroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  aircraftRegistration: string;
  currentHours: number;
}

export function ManutencaoRegistroDialog({
  open,
  onOpenChange,
  aircraftId,
  aircraftRegistration,
  currentHours,
}: ManutencaoRegistroDialogProps) {
  const { toast } = useToast();
  const addRecord = useAddMaintenanceRecord();
  
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [formData, setFormData] = useState({
    maintenanceType: '50h' as MaintenanceType,
    performedAtHours: currentHours.toString(),
    performedDate: format(new Date(), 'yyyy-MM-dd'),
    mechanicName: '',
    maintenanceCenter: '',
    oficina_id: '',
    serviceOrderNumber: '',
    description: '',
    cost: '',
    observations: '',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      (supabase as any)
        .from('oficinas')
        .select('id, razao_social, mecanico_responsavel')
        .eq('ativo', true)
        .order('razao_social')
        .then(({ data }) => {
          setOficinas((data as any[]) || []);
        });
    }
  }, [open]);

  const handleOficinaChange = (oficinaId: string) => {
    const oficina = oficinas.find(o => o.id === oficinaId);
    setFormData({
      ...formData,
      oficina_id: oficinaId,
      maintenanceCenter: oficina?.razao_social || '',
      mechanicName: oficina?.mecanico_responsavel || formData.mechanicName,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const performedHours = parseFloat(formData.performedAtHours);
      const intervalHours = DEFAULT_CONFIGS[formData.maintenanceType].intervalHours;
      const nextDueHours = performedHours + intervalHours;

      await addRecord.mutateAsync({
        aeronave_id: aircraftId,
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

      // Also create a CTM service order for this maintenance
      const tipoMap: Record<string, string> = {
        '50h': 'PREVENTIVA',
        '100h': 'PREVENTIVA',
        '150h': 'REVISÃO',
        '200h': 'REVISÃO',
      };

      await supabase.from('service_orders').insert({
        aeronave_id: aircraftId,
        numero: formData.serviceOrderNumber || `MNT-${formData.maintenanceType}-${Date.now().toString().slice(-6)}`,
        tipo_manutencao: tipoMap[formData.maintenanceType] || 'PREVENTIVA',
        objetivo: 'CÉLULA',
        oficina_nome: formData.maintenanceCenter || null,
        horas_celula: performedHours,
        data_entrada: formData.performedDate,
        status: 'concluída',
        observacoes: formData.observations || null,
        description: formData.description || `Manutenção preventiva de ${formData.maintenanceType} realizada`,
        periodo: formData.maintenanceType,
        total_geral: formData.cost ? parseFloat(formData.cost) : null,
      } as any);

      toast({
        title: 'Manutenção registrada',
        description: `Manutenção de ${formData.maintenanceType} registrada com sucesso. Próxima em ${nextDueHours.toFixed(1)}h.`,
      });

      onOpenChange(false);
      
      setFormData({
        maintenanceType: '50h',
        performedAtHours: currentHours.toString(),
        performedDate: format(new Date(), 'yyyy-MM-dd'),
        mechanicName: '',
        maintenanceCenter: '',
        oficina_id: '',
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

            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Data Realizada
              </Label>
              <Input
                type="data"
                value={formData.performedDate}
                onChange={(e) => setFormData({ ...formData, performedDate: e.target.value })}
                className="bg-slate-800 border-white/10"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <Label className="text-gray-300">Próxima Manutenção (h)</Label>
              <div className="h-10 px-3 flex items-center bg-slate-800/50 border border-white/10 rounded-md text-green-400 font-semibold">
                {(parseFloat(formData.performedAtHours || '0') + DEFAULT_CONFIGS[formData.maintenanceType].intervalHours).toFixed(1)}
              </div>
            </div>
          </div>

          {/* Oficina select */}
          <div className="space-y-2">
            <Label className="text-gray-300 flex items-center gap-1">
              <Building className="h-3 w-3" />
              Oficina / Centro de Manutenção
            </Label>
            <Select
              value={formData.oficina_id}
              onValueChange={handleOficinaChange}
            >
              <SelectTrigger className="bg-slate-800 border-white/10">
                <SelectValue placeholder="Selecione a oficina" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-white/10">
                {oficinas.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

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

          <div className="space-y-2">
            <Label className="text-gray-300">Descrição dos Serviços</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva os serviços realizados..."
              className="bg-slate-800 border-white/10 min-h-[80px]"
            />
          </div>

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
