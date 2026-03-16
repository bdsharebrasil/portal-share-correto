import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useMaintenanceConfigs, useUpdateMaintenanceConfig } from '@/hooks/useMaintenanceAlerts';
import { MaintenanceType, DEFAULT_CONFIGS } from '@/lib/maintenance-alerts';
import { Settings, Clock, AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface ManutencaoConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  aircraftRegistration: string;
}

interface ConfigFormData {
  intervalHours: string;
  alertGreenThreshold: string;
  alertYellowThreshold: string;
  alertOrangeThreshold: string;
  alertRedThreshold: string;
  isActive: boolean;
}

const MAINTENANCE_TYPES: MaintenanceType[] = ['50h', '100h', '150h', '200h'];

export function ManutencaoConfigDialog({
  open,
  onOpenChange,
  aircraftId,
  aircraftRegistration,
}: ManutencaoConfigDialogProps) {
  const { toast } = useToast();
  const { data: currentConfigs } = useMaintenanceConfigs(aircraftId);
  const updateConfig = useUpdateMaintenanceConfig();
  
  const [selectedType, setSelectedType] = useState<MaintenanceType>('50h');
  const [formData, setFormData] = useState<ConfigFormData>({
    intervalHours: '50',
    alertGreenThreshold: '20',
    alertYellowThreshold: '15',
    alertOrangeThreshold: '10',
    alertRedThreshold: '5',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);

  // Load current config when type changes
  useEffect(() => {
    const currentConfig = currentConfigs?.find(c => c.maintenanceType === selectedType);
    const defaultConfig = DEFAULT_CONFIGS[selectedType];
    
    if (currentConfig) {
      setFormData({
        intervalHours: currentConfig.intervalHours.toString(),
        alertGreenThreshold: currentConfig.alertGreenThreshold.toString(),
        alertYellowThreshold: currentConfig.alertYellowThreshold.toString(),
        alertOrangeThreshold: currentConfig.alertOrangeThreshold.toString(),
        alertRedThreshold: currentConfig.alertRedThreshold.toString(),
        isActive: true,
      });
    } else {
      setFormData({
        intervalHours: defaultConfig.intervalHours.toString(),
        alertGreenThreshold: defaultConfig.alertGreenThreshold.toString(),
        alertYellowThreshold: defaultConfig.alertYellowThreshold.toString(),
        alertOrangeThreshold: defaultConfig.alertOrangeThreshold.toString(),
        alertRedThreshold: defaultConfig.alertRedThreshold.toString(),
        isActive: true,
      });
    }
  }, [selectedType, currentConfigs]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateConfig.mutateAsync({
        aircraftId,
        config: {
          maintenance_type: selectedType,
          interval_hours: parseFloat(formData.intervalHours),
          alert_green_threshold: parseFloat(formData.alertGreenThreshold),
          alert_yellow_threshold: parseFloat(formData.alertYellowThreshold),
          alert_orange_threshold: parseFloat(formData.alertOrangeThreshold),
          alert_red_threshold: parseFloat(formData.alertRedThreshold),
          is_active: formData.isActive,
        },
      });

      toast({
        title: 'Configuração salva',
        description: `Configurações de manutenção ${selectedType} atualizadas.`,
      });
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
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
            <Settings className="h-5 w-5 text-blue-400" />
            Configurar Manutenção - {aircraftRegistration}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as MaintenanceType)}>
          <TabsList className="bg-slate-800/50 w-full">
            {MAINTENANCE_TYPES.map(type => (
              <TabsTrigger key={type} value={type} className="flex-1">
                {type}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4 space-y-4">
            {/* Active Switch */}
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-white/5">
              <div>
                <Label className="text-white">Ativar monitoramento</Label>
                <p className="text-xs text-gray-400 mt-1">
                  Habilitar alertas para esta manutenção
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            {/* Interval Hours */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Intervalo de Manutenção (horas)
              </Label>
              <Input
                type="number"
                step="1"
                value={formData.intervalHours}
                onChange={(e) => setFormData({ ...formData, intervalHours: e.target.value })}
                className="bg-slate-800 border-white/10"
              />
              <p className="text-xs text-gray-400">
                Intervalo entre manutenções deste tipo
              </p>
            </div>

            {/* Alert Thresholds */}
            <div className="space-y-3">
              <Label className="text-gray-300">Thresholds de Alerta (horas restantes)</Label>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Green */}
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1 text-green-400">
                    <CheckCircle className="h-3 w-3" />
                    Verde (Informativo)
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    value={formData.alertGreenThreshold}
                    onChange={(e) => setFormData({ ...formData, alertGreenThreshold: e.target.value })}
                    className="bg-slate-800 border-green-500/30 text-sm h-9"
                  />
                </div>

                {/* Yellow */}
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1 text-yellow-400">
                    <Info className="h-3 w-3" />
                    Amarelo (Atenção)
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    value={formData.alertYellowThreshold}
                    onChange={(e) => setFormData({ ...formData, alertYellowThreshold: e.target.value })}
                    className="bg-slate-800 border-yellow-500/30 text-sm h-9"
                  />
                </div>

                {/* Orange */}
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1 text-orange-400">
                    <AlertTriangle className="h-3 w-3" />
                    Laranja (Urgente)
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    value={formData.alertOrangeThreshold}
                    onChange={(e) => setFormData({ ...formData, alertOrangeThreshold: e.target.value })}
                    className="bg-slate-800 border-orange-500/30 text-sm h-9"
                  />
                </div>

                {/* Red */}
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1 text-red-400">
                    <AlertCircle className="h-3 w-3" />
                    Vermelho (Crítico)
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    value={formData.alertRedThreshold}
                    onChange={(e) => setFormData({ ...formData, alertRedThreshold: e.target.value })}
                    className="bg-slate-800 border-red-500/30 text-sm h-9"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-400">
                Quando as horas restantes atingirem esses valores, o alerta correspondente será ativado.
              </p>
            </div>
          </div>
        </Tabs>

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
            onClick={handleSave}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600"
          >
            {loading ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
