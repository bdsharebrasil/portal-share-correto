import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Plus, Wrench, FileText, Table as TableIcon, Scale, Clock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCTMServiceOrders, usePartnerFlightHours, useAircraftCellHours } from "@/hooks/useCTMData";
import { CTMComponentMap } from "./CTMComponentMap";
import { CTMRASReports } from "./CTMRASReports";
import { CTMWeightBalanceComplete } from "./CTMWeightBalanceComplete";
import { NewServiceOrderDialog } from "./NewServiceOrderDialog";
import { MAINTENANCE_CATEGORIES, MaintenanceCategory, CTMTab } from "@/types/ctm";

interface Aircraft {
  id: string;
  registration: string;
  model: string;
  status?: string | null;
}

interface CTMAircraftDetailProps {
  aircraft: Aircraft;
  onBack: () => void;
}

export function CTMAircraftDetail({ aircraft, onBack }: CTMAircraftDetailProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<CTMTab>("os");
  const [categoryFilter, setCategoryFilter] = useState<MaintenanceCategory>("TUDO");
  const [showNewOAS, setShowNewOAS] = useState(false);

  const { data: serviceOrders = [], isLoading: loadingOS, refetch: refetchOrders } = useCTMServiceOrders(aircraft.id);
  const { data: partnerHours = [] } = usePartnerFlightHours(aircraft.id);
  const { data: cellData } = useAircraftCellHours(aircraft.id);

  const filteredOrders = categoryFilter === "TUDO"
    ? serviceOrders
    : serviceOrders.filter(o => o.tipo_manutencao === categoryFilter);

  const handleServiceOrderCreated = () => {
    refetchOrders();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-foreground">{aircraft.registration}</h1>
            <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
              {aircraft.status || "OPERACIONAL"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            MODELO: {aircraft.model} • CÉLULA: {cellData?.cell_hours_current?.toFixed(1) || "0"}H
          </p>
        </div>
        {activeTab === "os" && (
          <Button onClick={() => setShowNewOAS(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            NOVA O.S.
          </Button>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CTMTab)}>
        <TabsList className="grid w-full grid-cols-4 h-14">
          <TabsTrigger value="os" className="gap-2 data-[state=active]:bg-primary/10">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">ORDEM DE ACOMPANHAMENTO DE SERVIÇO</span>
            <span className="sm:hidden">O.S.</span>
          </TabsTrigger>
          <TabsTrigger value="componentes" className="gap-2 data-[state=active]:bg-primary/10">
            <TableIcon className="h-4 w-4" />
            <span className="hidden sm:inline">MAPA DE COMPONENTES</span>
            <span className="sm:hidden">COMP.</span>
          </TabsTrigger>
          <TabsTrigger value="peso" className="gap-2 data-[state=active]:bg-primary/10">
            <Scale className="h-4 w-4" />
            <span className="hidden sm:inline">PESO E BALANCEAMENTO</span>
            <span className="sm:hidden">PESO</span>
          </TabsTrigger>
          <TabsTrigger value="ras" className="gap-2 data-[state=active]:bg-primary/10">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">RELATÓRIOS (RAS)</span>
            <span className="sm:hidden">RAS</span>
          </TabsTrigger>
        </TabsList>

        {/* OS Tab */}
        <TabsContent value="os" className="space-y-4 mt-4">
          {/* Category Filters */}
          <div className="flex gap-2 flex-wrap">
            {MAINTENANCE_CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant={categoryFilter === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(cat.value)}
                className="gap-1"
              >
                {cat.label}
              </Button>
            ))}
            <Button variant="outline" size="sm" className="border-dashed gap-1">
              <Plus className="h-3 w-3" />
              Adicionar Aba
            </Button>
          </div>

          {/* Partner Hours Summary */}
          {partnerHours.length > 0 && (
            <Card className="bg-gradient-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Horas Voadas por Sócio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {partnerHours.map((p) => (
                    <div key={p.client_id} className="p-3 bg-background/50 rounded-lg border">
                      <p className="text-xs text-muted-foreground truncate">{p.client_name}</p>
                      <p className="text-lg font-bold">{p.total_hours.toFixed(1)}h</p>
                      <p className="text-xs text-muted-foreground">{p.share_percentage}% cota</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Service Orders List */}
          {loadingOS ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredOrders.length === 0 ? (
            <Card className="bg-gradient-card border-border">
              <CardContent className="py-12 text-center">
                <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma O.S. encontrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <Card key={order.id} className="bg-gradient-card border-border hover:border-primary/30 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">O.S. #{order.numero}</h3>
                          <p className="text-sm text-muted-foreground">
                            OFICINA: {order.os_oficina || "-"} • {order.horas_celula?.toFixed(1) || 0}H CÉLULA • {order.tipo_manutencao}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">TOTAL DA OS</p>
                        <p className="text-xl font-bold">
                          R$ {(order.total_geral || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Components Tab */}
        <TabsContent value="componentes" className="mt-4">
          <CTMComponentMap aircraftId={aircraft.id} />
        </TabsContent>

        {/* Weight Balance Tab */}
        <TabsContent value="peso" className="mt-4">
          <CTMWeightBalanceComplete aircraftId={aircraft.id} aircraftRegistration={aircraft.registration} />
        </TabsContent>

        {/* RAS Tab */}
        <TabsContent value="ras" className="mt-4">
          <CTMRASReports aircraftId={aircraft.id} aircraftRegistration={aircraft.registration} />
        </TabsContent>
      </Tabs>

      {/* New Service Order Dialog */}
      <NewServiceOrderDialog
        open={showNewOAS}
        onOpenChange={setShowNewOAS}
        aircraftId={aircraft.id}
        aircraftRegistration={aircraft.registration}
        onServiceOrderCreated={handleServiceOrderCreated}
      />
    </div>
  );
}
