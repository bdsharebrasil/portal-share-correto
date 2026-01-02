import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Plane,
  ArrowLeft,
  FileText,
  DollarSign,
  Zap,
  AlertCircle,
  Plus,
  BarChart3,
  Download,
  Printer,
} from 'lucide-react';
import { CTMDashboard } from '@/components/ctm/CTMDashboard';
import { RASList } from '@/components/ctm/RASList';
import { RASForm } from '@/components/ctm/RASForm';
import { RASDetailModal } from '@/components/ctm/RASDetailModal';
import { MotorExpenseForm } from '@/components/ctm/MotorExpenseForm';
import { MotorExpensesCard } from '@/components/ctm/MotorExpensesCard';
import { ADSBForm } from '@/components/ctm/ADSBForm';
import { ADSBControlCard } from '@/components/ctm/ADSBControlCard';
import { FinancialSummaryCard } from '@/components/ctm/FinancialSummaryCard';
import { CTMSearchFilter } from '@/components/ctm/CTMSearchFilter';
import { useExpirationNotifications } from '@/hooks/useExpirationNotifications';
import { useReports } from '@/hooks/useReports';
import { exportRAStoPDF } from '@/utils/rasPdfExport';
import type {
  RAS,
  MotorExpense,
  AirworthinessDirective,
  ServiceBulletin,
  FinancialSummary,
} from '@/types/maintenance';

interface AircraftSelection {
  id: string;
  registration: string;
  model: string;
}

type FormView = 'none' | 'ras' | 'motor' | 'ad' | 'sb';

export default function CTMManagementPage() {
  const [aircraft, setAircraft] = useState<AircraftSelection | null>(null);
  const [rasList, setRASList] = useState<RAS[]>([]);
  const [motorExpenses, setMotorExpenses] = useState<MotorExpense[]>([]);
  const [ads, setADs] = useState<AirworthinessDirective[]>([]);
  const [sbs, setSBs] = useState<ServiceBulletin[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [selectedRAS, setSelectedRAS] = useState<RAS | null>(null);
  const [showRASModal, setShowRASModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formView, setFormView] = useState<FormView>('none');

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Hooks
  const { checkExpirations } = useExpirationNotifications(aircraft?.id || '');
  const { financialReport, fetchFinancialReport } = useReports(aircraft?.id || '');

  // Load aircraft from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const aircraftId = params.get('aircraftId');
    const registration = params.get('registration');
    const model = params.get('model');

    if (aircraftId && registration) {
      setAircraft({
        id: aircraftId,
        registration,
        model: model || '',
      });
      loadAllData(aircraftId);
    }
  }, []);

  const loadAllData = async (aircraftId: string) => {
    try {
      setLoading(true);

      // Load RAS
      const { data: rasData } = await supabase
        .from('ras')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('created_at', { ascending: false });

      if (rasData) {
        setRASList(
          rasData.map((item: any) => ({
            id: item.id,
            aircraftId: item.aircraft_id,
            serviceOrderNumber: item.service_order_number,
            maintenanceCenter: item.maintenance_center,
            maintenanceType: item.maintenance_type,
            responsibleMechanic: item.responsible_mechanic,
            date: item.date,
            completionDate: item.completion_date,
            description: item.description,
            inspectionDetails: item.inspection_details,
            status: item.status || 'pendente',
            totalCost: item.total_cost || 0,
            photos: item.photos || [],
            costItems: item.cost_items || [],
            motorHours: item.motor_hours,
            observations: item.observations,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
          }))
        );
      }

      // Load Motor Expenses
      const { data: motorData } = await supabase
        .from('motor_expenses')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('date', { ascending: false });

      if (motorData) {
        setMotorExpenses(
          motorData.map((item: any) => ({
            id: item.id,
            aircraftId: item.aircraft_id,
            motorSide: item.motor_side,
            type: item.type,
            description: item.description,
            motorHours: item.motor_hours,
            cost: item.cost,
            supplier: item.supplier,
            date: item.date,
            observations: item.observations,
            createdAt: item.created_at,
          }))
        );
      }

      // Load ADs
      const { data: adData } = await supabase
        .from('airworthiness_directives')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('issue_date', { ascending: false });

      if (adData) {
        setADs(
          adData.map((item: any) => ({
            id: item.id,
            aircraftId: item.aircraft_id,
            adNumber: item.ad_number,
            title: item.title,
            issueDate: item.issue_date,
            effectiveDate: item.issue_date,
            dueDate: item.due_date,
            description: item.description,
            status: item.status || 'pendente',
            completionDate: item.completion_date,
            observations: item.observations,
            createdAt: item.created_at,
          }))
        );
      }

      // Load SBs
      const { data: sbData } = await supabase
        .from('service_bulletins')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('issue_date', { ascending: false });

      if (sbData) {
        setSBs(
          sbData.map((item: any) => ({
            id: item.id,
            aircraftId: item.aircraft_id,
            sbNumber: item.sb_number,
            title: item.title,
            issueDate: item.issue_date,
            dueDate: item.due_date,
            description: item.description,
            status: item.status || 'pendente',
            completionDate: item.completion_date,
            observations: item.observations,
            createdAt: item.created_at,
          }))
        );
      }

      // Calculate Financial Summary
      const totalMotorCost = motorData?.reduce((sum: number, item: any) => sum + (item.cost || 0), 0) || 0;
      const totalCost = rasData?.reduce((sum: number, item: any) => sum + (item.total_cost || 0), 0) || 0;

      setFinancialSummary({
        aircraftId,
        totalMaintenanceCost: totalCost,
        totalMotorCost,
        totalPartsCost: 0,
        totalLaborCost: 0,
        costByCategory: {
          'Motores': totalMotorCost,
          'Manutenção Geral': totalCost - totalMotorCost,
        },
        monthlyExpenses: [],
        yearlyTotal: totalCost + totalMotorCost,
      });

      // Fetch financial report
      await fetchFinancialReport();
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewRAS = (ras: RAS) => {
    setSelectedRAS(ras);
    setShowRASModal(true);
  };

  const handleExportRAS = async (ras: RAS) => {
    try {
      await exportRAStoPDF(ras);
      toast.success('RAS exportado com sucesso');
    } catch (error: any) {
      toast.error('Erro ao exportar RAS: ' + error.message);
    }
  };

  const handleDeleteRAS = async (id: string) => {
    try {
      const { error } = await supabase.from('ras').delete().eq('id', id);
      if (error) throw error;
      setRASList(rasList.filter((r) => r.id !== id));
      toast.success('RAS deletado com sucesso');
    } catch (error: any) {
      toast.error('Erro ao deletar RAS: ' + error.message);
    }
  };

  const handleRASCreated = (ras: RAS) => {
    setRASList([ras, ...rasList]);
    setFormView('none');
    toast.success('RAS criado com sucesso');
  };

  const handleMotorExpenseCreated = (expense: MotorExpense) => {
    setMotorExpenses([expense, ...motorExpenses]);
    setFormView('none');
    toast.success('Gasto de motor registrado com sucesso');
  };

  const handleDeleteMotorExpense = async (id: string) => {
    try {
      const { error } = await supabase.from('motor_expenses').delete().eq('id', id);
      if (error) throw error;
      setMotorExpenses(motorExpenses.filter((m) => m.id !== id));
      toast.success('Gasto deletado com sucesso');
    } catch (error: any) {
      toast.error('Erro ao deletar gasto: ' + error.message);
    }
  };

  const handleADCreated = (ad: AirworthinessDirective) => {
    setADs([ad, ...ads]);
    setFormView('none');
    toast.success('AD registrada com sucesso');
  };

  const handleSBCreated = (sb: ServiceBulletin) => {
    setSBs([sb, ...sbs]);
    setFormView('none');
    toast.success('SB registrada com sucesso');
  };

  const handleDeleteAD = async (id: string) => {
    try {
      const { error } = await supabase.from('airworthiness_directives').delete().eq('id', id);
      if (error) throw error;
      setADs(ads.filter((a) => a.id !== id));
      toast.success('AD deletada com sucesso');
    } catch (error: any) {
      toast.error('Erro ao deletar AD: ' + error.message);
    }
  };

  const handleDeleteSB = async (id: string) => {
    try {
      const { error } = await supabase.from('service_bulletins').delete().eq('id', id);
      if (error) throw error;
      setSBs(sbs.filter((s) => s.id !== id));
      toast.success('SB deletada com sucesso');
    } catch (error: any) {
      toast.error('Erro ao deletar SB: ' + error.message);
    }
  };

  const filteredRAS = rasList.filter((ras) => {
    const matchesSearch =
      !searchQuery ||
      ras.serviceOrderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ras.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ras.responsibleMechanic.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = !statusFilter || ras.status === statusFilter;
    const matchesType = !typeFilter || ras.maintenanceType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  if (!aircraft) {
    return (
      <Layout>
        <div className="p-6">
          <Card className="bg-background/50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Plane className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Selecione uma aeronave para continuar</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => (window.location.href = '/manutencao/ctm')}
              >
                Selecionar Aeronave
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (window.location.href = '/manutencao/ctm')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{aircraft.registration}</h1>
            <p className="text-sm text-muted-foreground">{aircraft.model}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-7 lg:grid-cols-7">
            <TabsTrigger value="dashboard" className="gap-1 text-xs sm:text-sm">
              <Plane className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="ras" className="gap-1 text-xs sm:text-sm">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">RAS</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-1 text-xs sm:text-sm">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Financeiro</span>
            </TabsTrigger>
            <TabsTrigger value="motor" className="gap-1 text-xs sm:text-sm">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Motor</span>
            </TabsTrigger>
            <TabsTrigger value="directives" className="gap-1 text-xs sm:text-sm">
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Diretrizes</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <CTMDashboard aircraftId={aircraft.id} />
          </TabsContent>

          {/* RAS Tab */}
          <TabsContent value="ras" className="space-y-6">
            {formView === 'ras' ? (
              <RASForm
                aircraftId={aircraft.id}
                onSuccess={handleRASCreated}
                onCancel={() => setFormView('none')}
              />
            ) : (
              <>
                <CTMSearchFilter
                  onSearch={setSearchQuery}
                  onStatusFilter={setStatusFilter}
                  onTypeFilter={setTypeFilter}
                  onReset={() => {
                    setSearchQuery('');
                    setStatusFilter('');
                    setTypeFilter('');
                  }}
                />
                <RASList
                  items={filteredRAS}
                  onView={handleViewRAS}
                  onNew={() => setFormView('ras')}
                  onDelete={handleDeleteRAS}
                />
              </>
            )}
            <RASDetailModal
              ras={selectedRAS}
              open={showRASModal}
              onOpenChange={setShowRASModal}
            />
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-6">
            {financialSummary && (
              <FinancialSummaryCard data={financialSummary} />
            )}
          </TabsContent>

          {/* Motor Tab */}
          <TabsContent value="motor" className="space-y-6">
            {formView === 'motor' ? (
              <MotorExpenseForm
                aircraftId={aircraft.id}
                onSuccess={handleMotorExpenseCreated}
                onCancel={() => setFormView('none')}
              />
            ) : (
              <MotorExpensesCard
                items={motorExpenses}
                onNew={() => setFormView('motor')}
                onDelete={handleDeleteMotorExpense}
              />
            )}
          </TabsContent>

          {/* Directives Tab */}
          <TabsContent value="directives" className="space-y-6">
            {formView === 'ad' ? (
              <ADSBForm
                aircraftId={aircraft.id}
                type="ad"
                onSuccess={handleADCreated}
                onCancel={() => setFormView('none')}
              />
            ) : formView === 'sb' ? (
              <ADSBForm
                aircraftId={aircraft.id}
                type="sb"
                onSuccess={handleSBCreated}
                onCancel={() => setFormView('none')}
              />
            ) : (
              <ADSBControlCard
                ads={ads}
                sbs={sbs}
                onNewAD={() => setFormView('ad')}
                onNewSB={() => setFormView('sb')}
                onDeleteAD={handleDeleteAD}
                onDeleteSB={handleDeleteSB}
              />
            )}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <h3 className="font-semibold text-lg">Relatórios Disponíveis</h3>
                  <div className="space-y-2">
                    <Button className="w-full gap-2" variant="outline">
                      <BarChart3 className="h-4 w-4" />
                      Relatório Financeiro Completo
                    </Button>
                    <Button className="w-full gap-2" variant="outline">
                      <FileText className="h-4 w-4" />
                      Relatório de Manutenção
                    </Button>
                    <Button className="w-full gap-2" variant="outline">
                      <AlertCircle className="h-4 w-4" />
                      Relatório de Conformidade
                    </Button>
                    <Button className="w-full gap-2" variant="outline">
                      <Download className="h-4 w-4" />
                      Exportar Dados
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <h3 className="font-semibold text-lg">Resumo Executivo</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total RAS:</span>
                      <span className="font-bold">{rasList.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Gastos de Motor:</span>
                      <span className="font-bold">
                        R$ {motorExpenses.reduce((sum, m) => sum + m.cost, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AD Pendentes:</span>
                      <span className="font-bold text-orange-600">{ads.filter(a => a.status === 'pendente').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SB Pendentes:</span>
                      <span className="font-bold text-orange-600">{sbs.filter(s => s.status === 'pendente').length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
