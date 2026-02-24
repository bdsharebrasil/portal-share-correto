import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CheckCircle, Wrench } from 'lucide-react';
import { AircraftCard } from '@/components/dashboard/AircraftCard';
import { StatusCard } from '@/components/dashboard/StatusCard';
import { MaintenanceList } from '@/components/dashboard/MaintenanceList';
import { ComponentLifeCard } from '@/components/dashboard/ComponentLifeCard';
import type { Aircraft, MaintenanceItem, Component } from '@/types/maintenance';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CTMDashboardProps {
  aircraftId: string;
}

export function CTMDashboard({ aircraftId }: CTMDashboardProps) {
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [aircraftId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load aircraft data
      const { data: aircraftData, error: aircraftError } = await supabase
        .from('aircraft')
        .select('*')
        .eq('id', aircraftId)
        .single();

      if (aircraftError) throw aircraftError;

      if (aircraftData) {
        setAircraft({
          id: aircraftData.id,
          registration: aircraftData.registration,
          model: aircraftData.model,
          manufacturer: (aircraftData as any).fabricante || aircraftData.manufacturer,
          serialNumber: aircraftData.serial_number,
          totalHours: aircraftData.cell_hours_current || 0,
          totalCycles: (aircraftData as any).pousos_atuais || 0,
          lastRevisionDate: (aircraftData as any).ultima_revisao,
          nextRevisionHours: aircraftData.celula_prox_revisao,
          status: aircraftData.status,
        });
      }

      // Load maintenance items
      const { data: maintenanceData, error: maintenanceError } = await supabase
        .from('maintenance_items')
        .select('*')
        .eq('aircraft_id', aircraftId);

      if (maintenanceError) throw maintenanceError;

      if (maintenanceData) {
        setMaintenanceItems(
          maintenanceData.map((item: any) => ({
            id: item.id,
            aircraftId: item.aircraft_id,
            type: item.type,
            description: item.description,
            dueHours: item.next_due_hours,
            dueCycles: item.next_due_cycles,
            dueDate: item.next_due_date,
            currentHours: aircraftData?.cell_hours_current || 0,
            currentCycles: (aircraftData as any)?.pousos_atuais || 0,
            status: item.status || 'ok',
            interval: `${item.interval_value} ${item.interval_type}`,
            lastDone: item.last_done_date,
            nextDue: item.next_due_date || 'N/A',
            responsibleMechanic: item.responsible_mechanic,
            observations: item.observations,
            intervalType: item.interval_type,
            intervalValue: item.interval_value,
          }))
        );
      }

      // Load components (aircraft parts/components)
      const { data: componentsData, error: componentsError } = await (supabase as any)
        .from('aircraft_components')
        .select('*')
        .eq('aircraft_id', aircraftId);

      if (componentsError) {
        // Table might not exist yet, so we'll handle this gracefully
        console.log('Componentes table not found');
      } else if (componentsData) {
        setComponents(
          componentsData.map((comp: any) => ({
            id: comp.id,
            aircraftId: comp.aircraft_id,
            name: comp.name,
            partNumber: comp.part_number,
            serialNumber: comp.serial_number,
            totalLife: comp.total_life,
            currentLife: comp.current_life,
            location: comp.location,
            installedDate: comp.installed_date,
            status: calculateComponentStatus(comp.current_life / comp.total_life),
            lastInspection: comp.last_inspection,
            nextInspection: comp.next_inspection,
          }))
        );
      }
    } catch (error: any) {
      console.error('Error loading CTM data:', error);
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateComponentStatus = (lifePercentage: number) => {
    if (lifePercentage >= 0.8) return 'expired';
    if (lifePercentage >= 0.6) return 'urgent';
    if (lifePercentage >= 0.4) return 'attention';
    return 'ok';
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <span className="text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (!aircraft) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <span className="text-muted-foreground">Aeronave não encontrada</span>
      </div>
    );
  }

  const expiredCount = maintenanceItems.filter(i => i.status === 'expired').length;
  const urgentCount = maintenanceItems.filter(i => i.status === 'urgent').length;
  const attentionCount = maintenanceItems.filter(i => i.status === 'attention').length;
  const okCount = maintenanceItems.filter(i => i.status === 'ok').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard CTM</h1>
        <p className="text-muted-foreground mt-1">
          Visão geral da manutenção da aeronave
        </p>
      </div>

      {/* Aircraft Info and Status Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <AircraftCard aircraft={aircraft} />

        {/* Status Overview */}
        <div className="md:col-span-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard
            title="Vencidas"
            value={expiredCount}
            icon={AlertTriangle}
            status="expired"
          />
          <StatusCard
            title="Urgente"
            value={urgentCount}
            icon={Clock}
            status="urgent"
          />
          <StatusCard
            title="Atenção"
            value={attentionCount}
            icon={Wrench}
            status="attention"
          />
          <StatusCard
            title="Em Dia"
            value={okCount}
            icon={CheckCircle}
            status="ok"
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Maintenance List */}
        <MaintenanceList items={maintenanceItems} />

        {/* Components */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Componentes Críticos</h2>
          <div className="space-y-4">
            {components.length > 0 ? (
              components.map((component) => (
                <ComponentLifeCard key={component.id} component={component} />
              ))
            ) : (
              <p className="text-sm text-muted-foreground p-4 text-center">
                Nenhum componente cadastrado
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
