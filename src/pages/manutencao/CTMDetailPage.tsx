import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plane, ArrowLeft, Settings, History, FileText, PieChart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CTMServiceOrderList } from '@/components/ctm';
import { CTMServiceOrderForm } from '@/components/ctm/CTMServiceOrderForm';
import { CTMServiceOrderDetails } from '@/components/ctm';
import { useCTMServiceOrders, CTMServiceOrder, CTMMaintenanceCategory } from '@/hooks/useCTMServiceOrders';
import AircraftSelection from '@/components/manutencao/AircraftSelection';

type ViewMode = 'select' | 'list' | 'create' | 'edit' | 'detail';

interface SelectedAircraft {
  id: string;
  registration: string;
  model: string;
}

export default function CTMPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const aircraftIdParam = searchParams.get('aircraftId');
  const registrationParam = searchParams.get('registration');

  const [view, setView] = useState<ViewMode>(aircraftIdParam ? 'list' : 'select');
  const [selectedAircraft, setSelectedAircraft] = useState<SelectedAircraft | null>(
    aircraftIdParam && registrationParam
      ? { id: aircraftIdParam, registration: registrationParam, model: '' }
      : null
  );
  const [orders, setOrders] = useState<CTMServiceOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<CTMServiceOrder | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [categories, setCategories] = useState<CTMMaintenanceCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    loadServiceOrders,
    loadServiceOrderDetails,
    createServiceOrder,
    updateServiceOrder,
    deleteServiceOrder,
    loadCategories
  } = useCTMServiceOrders();

  // Load categories on mount
  useEffect(() => {
    loadCategories().then(setCategories);
  }, [loadCategories]);

  // Load orders when aircraft is selected
  useEffect(() => {
    if (selectedAircraft) {
      loadOrders();
    }
  }, [selectedAircraft]);

  const loadOrders = useCallback(async () => {
    if (!selectedAircraft) return;
    setLoading(true);
    const data = await loadServiceOrders(selectedAircraft.id);
    setOrders(data);
    setLoading(false);
  }, [selectedAircraft, loadServiceOrders]);

  const handleSelectAircraft = (aircraft: any) => {
    setSelectedAircraft({
      id: aircraft.id,
      registration: aircraft.registration,
      model: aircraft.model
    });
    setView('list');
    navigate(`/manutencao/ctm?aircraftId=${aircraft.id}&registration=${aircraft.registration}`, { replace: true });
  };

  const handleBackToAircraftSelection = () => {
    setSelectedAircraft(null);
    setView('select');
    navigate('/manutencao/ctm', { replace: true });
  };

  const handleSelectOrder = async (order: CTMServiceOrder) => {
    setSelectedOrder(order);
    setLoading(true);
    const details = await loadServiceOrderDetails(order.id);
    setOrderDetails(details);
    setView('detail');
    setLoading(false);
  };

  const handleNewOrder = () => {
    setSelectedOrder(null);
    setView('create');
  };

  const handleEditOrder = () => {
    setView('edit');
  };

  const handleSaveOrder = async (data: Partial<CTMServiceOrder>) => {
    if (selectedOrder) {
      await updateServiceOrder(selectedOrder.id, data);
    } else {
      await createServiceOrder({ ...data, aircraft_id: selectedAircraft!.id });
    }
    loadOrders();
    setView('list');
  };

  const handleDeleteOrder = async (id: string) => {
    const success = await deleteServiceOrder(id);
    if (success) {
      setView('list');
      setSelectedOrder(null);
      setOrderDetails(null);
      await loadOrders();
    }
  };

  const handleRefreshDetails = async () => {
    if (selectedOrder) {
      const details = await loadServiceOrderDetails(selectedOrder.id);
      setOrderDetails(details);
    }
  };

  // Render aircraft selection
  if (view === 'select') {
    return (
      <Layout>
        <AircraftSelection onSelect={handleSelectAircraft} />
      </Layout>
    );
  }

  // Render loading
  if (loading && !orders.length && view === 'list') {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin">
            <Plane className="w-8 h-8 text-primary" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBackToAircraftSelection}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plane className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{selectedAircraft?.registration}</h1>
                <p className="text-muted-foreground">Centro Técnico de Manutenção</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content based on view */}
        {view === 'list' && (
          <Tabs defaultValue="orders" className="w-full">
            <TabsList>
              <TabsTrigger value="orders" className="gap-2">
                <FileText className="w-4 h-4" />
                Ordens de Serviço
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="w-4 h-4" />
                Histórico
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-2">
                <PieChart className="w-4 h-4" />
                Relatórios
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-6">
              <CTMServiceOrderList
                orders={orders}
                onSelect={handleSelectOrder}
                onDelete={handleDeleteOrder}
                onNew={handleNewOrder}
              />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Histórico completo de manutenções</p>
                <p className="text-sm">Em desenvolvimento...</p>
              </div>
            </TabsContent>

            <TabsContent value="reports" className="mt-6">
              <div className="text-center py-12 text-muted-foreground">
                <PieChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Relatórios e análises de custos</p>
                <p className="text-sm">Em desenvolvimento...</p>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {(view === 'create' || view === 'edit') && (
          <CTMServiceOrderForm
            order={view === 'edit' ? selectedOrder : null}
            categories={categories}
            aircraftId={selectedAircraft!.id}
            onSave={handleSaveOrder}
            onCancel={() => setView('list')}
          />
        )}

        {view === 'detail' && orderDetails && selectedOrder && (
          <CTMServiceOrderDetails
            orderId={selectedOrder.id}
            onEdit={() => setView('edit')}
            onDelete={handleDeleteOrder}
            onBack={() => {
              setView('list');
              loadOrders();
            }}
          />
        )}
      </div>
    </Layout>
  );
}
