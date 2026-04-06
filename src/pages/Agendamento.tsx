import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Plus, Calendar as CalendarIcon, List, Plane, Clock, Users, CheckCircle, XCircle, Trash2, Pencil, Loader2 } from "lucide-react";
import { FlightScheduleDialog } from "@/components/agendamento/AgendamentoDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

function StatusUpdateButtons({ scheduleId, currentStatus, onUpdate }: { scheduleId: string; currentStatus: string; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("flight_schedules")
        .update({ status: newStatus })
        .eq("id", scheduleId);

      if (error) throw error;

      toast.success(`Status alterado para ${newStatus}`);
      onUpdate();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {currentStatus !== "confirmado" && (
        <Button
          variant="default"
          size="sm"
          onClick={(e) => { e.stopPropagation(); updateStatus("confirmado"); }}
          disabled={loading}
          className="gap-2 bg-success hover:bg-success/90 text-white w-full text-xs"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          Confirmar
        </Button>
      )}
      {currentStatus !== "cancelado" && (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => { e.stopPropagation(); updateStatus("cancelado"); }}
          disabled={loading}
          className="gap-2 border-destructive text-destructive hover:bg-destructive/10 w-full text-xs"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          Cancelar
        </Button>
      )}
      {currentStatus !== "pendente" && (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => { e.stopPropagation(); updateStatus("pendente"); }}
          disabled={loading}
          className="gap-2 w-full text-xs"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
          Pendente
        </Button>
      )}
    </div>
  );
}

export default function Agendamentos() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedAeronave, setSelectedAircraft] = useState("all");
  const [statusTab, setStatusTab] = useState<"pendentes" | "todos">("todos");

  const { data: schedules, isLoading, error: schedulesError, refetch } = useQuery({
    queryKey: ["flight-schedules", selectedAeronave],
    queryFn: async () => {
      try {
        let query = supabase
          .from("flight_schedules")
          .select("*")
          .order("flight_date", { ascending: false })
          .order("flight_time", { ascending: false });

        if (selectedAeronave !== "all") {
          query = query.eq("id_aeronave", selectedAeronave);
        }

        const { data: baseSchedules, error: baseError } = await query;
        if (baseError) throw baseError;

        const schedules = baseSchedules || [];
        
        // Buscar dados relacionados
        const aircraftIds = [...new Set(schedules.map(s => s.aeronave_id).filter(Boolean))];
        const crewIds = [...new Set(schedules.map(s => s.crew_member_id).filter(Boolean))];
        const clientIds = [...new Set(schedules.map(s => s.cliente_id).filter(Boolean))];

        const [aircraftData, crewData, clientData] = await Promise.all([
          aircraftIds.length ? supabase.from('aeronave').select('id, matricula, modelo').in("id", aircraftIds as string[]) : Promise.resolve({ data: [] }),
          crewIds.length ? supabase.from("membros_tripulacao").select("id, nome_completo").in("id", crewIds as string[]) : Promise.resolve({ data: [] }),
          clientIds.length ? supabase.from("clientes").select("id, razao_social").in("id", clientIds as string[]) : Promise.resolve({ data: [] })
        ]);

        return schedules.map(s => ({
          ...s,
          aircraft: aircraftData.data?.find(a => a.id === s.aeronave_id) || null,
          crew: crewData.data?.find(c => c.id === s.crew_member_id) || null,
          client: clientData.data?.find(c => c.id === s.cliente_id) || null,
          client_name: clientData.data?.find(c => c.id === s.cliente_id)?.razao_social || null
        }));
      } catch (err) {
        console.error("Erro ao carregar agendamentos:", err);
        throw err;
      }
    },
    retry: false,
  });

  const { data: aircraft } = useQuery({
    queryKey: ["aeronave"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aeronave')
        .select('id, matricula, modelo')
        .eq("situacao", "ativa");
      if (error) throw error;
      return data;
    },
  });

  const stats = {
    total: schedules?.length || 0,
    confirmed: schedules?.filter(s => s.situacao === "confirmado").length || 0,
    pending: schedules?.filter(s => s.situacao === "pendente").length || 0,
    today: schedules?.filter(s => s.flight_date === new Date().toISOString().split('T')[0]).length || 0,
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pendente: { label: "pendente", className: "bg-warning/20 text-warning border-warning" },
      confirmado: { label: "confirmado", className: "bg-success/20 text-success border-success" },
      cancelado: { label: "cancelado", className: "bg-destructive/20 text-destructive border-destructive" },
    };
    return variants[status] || variants.pendente;
  };

  const getFlightTypeBadge = (type: string) => {
    const types: Record<string, string> = {
      treinamento: "treinamento",
      manutencao: "manuten��ão",
      particular: "particular",
      executivo: "executivo",
    };
    return types[type] || type;
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Agendamento de Aeronaves</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os voos e reservas das aeronaves
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="icon">
              <CalendarIcon className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <List className="h-4 w-4" />
            </Button>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Agendamento
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Voos</p>
                  <p className="text-3xl font-bold text-foreground">{stats.total}</p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Plane className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Confirmados</p>
                  <p className="text-3xl font-bold text-foreground">{stats.confirmed}</p>
                </div>
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <CalendarIcon className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                  <p className="text-3xl font-bold text-foreground">{stats.pending}</p>
                </div>
                <div className="p-3 bg-orange-500/20 rounded-lg">
                  <Clock className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Hoje</p>
                  <p className="text-3xl font-bold text-foreground">{stats.today}</p>
                </div>
                <div className="p-3 bg-cyan-500/20 rounded-lg">
                  <Users className="h-6 w-6 text-cyan-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Filtrar por aeronave:</span>
              <Select value={selectedAeronave} onValueChange={setSelectedAircraft}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Todas as aeronaves" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as aeronaves</SelectItem>
                  {aircraft?.map((ac) => (
                    <SelectItem key={ac.id} value={ac.id}>
                      {ac.registration}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Tabs value={statusTab} onValueChange={(v)=>setStatusTab(v as any)}>
              <TabsList>
                <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
                <TabsTrigger value="todos">Todos</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Schedules List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              Lista de Agendamentos ({(schedules || []).filter((s: any) => statusTab === 'pendentes' ? s.situacao === 'pendente' : true).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {schedulesError && (
              <div className="text-center py-12 text-destructive">
                <p className="mb-4">Erro ao carregar agendamentos</p>
                <p className="text-sm text-muted-foreground mb-4">{String(schedulesError)}</p>
                <Button onClick={() => refetch()} variant="outline" className="gap-2">
                  Tentar Novamente
                </Button>
              </div>
            )}
            {isLoading ? (
              <div className="text-center text-muted-foreground py-12">
                Carregando agendamentos...
              </div>
            ) : schedules && schedules.length > 0 ? (
              <div className="space-y-4">
                {(schedules || [])
                  .filter((s: any) => statusTab === 'pendentes' ? s.situacao === 'pendente' : true)
                  .map((schedule: any) => (
                  <Card key={schedule.id} className="group overflow-hidden border-border/50 hover:border-primary/50 hover:shadow-lg transition-all">
                    <CardContent className="p-0">
                      <div className="flex flex-col lg:flex-row">
                        {/* Info Principal */}
                        <div className="flex-1 p-5">
                          <div className="flex items-start gap-4 mb-4">
                            <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl shrink-0">
                              <Plane className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <h3 className="font-bold text-xl text-foreground">{schedule.aeronave?.matricula || "N/A"}</h3>
                                <Badge variant="outline" className={`${getStatusBadge(schedule.situacao).className} text-xs`}>
                                  {getStatusBadge(schedule.situacao).label}
                                </Badge>
                                {schedule.flight_type && (
                                  <Badge variant="outline" className="text-xs bg-muted/50">
                                    {getFlightTypeBadge(schedule.flight_type)}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{schedule.aeronave?.modelo || ""}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">Data</span>
                              </div>
                              <p className="text-sm font-semibold text-foreground">
                                {new Date(schedule.flight_date).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">Horário</span>
                              </div>
                              <p className="text-sm font-semibold text-foreground">
                                {schedule.flight_time || "-"}
                                {schedule.estimated_duration && (
                                  <span className="text-xs text-muted-foreground ml-1">({schedule.estimated_duration})</span>
                                )}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Plane className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">Rota</span>
                              </div>
                              <p className="text-sm font-semibold text-foreground truncate">
                                {schedule.origin} → {schedule.destination || "N/A"}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Users className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">Passageiros</span>
                              </div>
                              <p className="text-sm font-semibold text-foreground">{schedule.passengers || "0"}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Cliente</p>
                              <p className="text-sm font-semibold text-foreground truncate">
                                {schedule.client?.razao_social || "Não informado"}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Tripulação</p>
                              <p className="text-sm font-semibold text-foreground truncate">
                                {schedule.crew?.full_name || "Não atribuído"}
                              </p>
                            </div>
                          </div>

                          {schedule.contact && (
                            <div className="mt-4 space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Contato</p>
                              <p className="text-sm text-foreground">{schedule.contact}</p>
                            </div>
                          )}

                          {schedule.observacoes && (
                            <div className="mt-4 space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Observações</p>
                              <p className="text-sm text-foreground bg-muted/30 p-3 rounded-lg">{schedule.observacoes}</p>
                            </div>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="lg:w-48 bg-muted/20 p-4 flex flex-col gap-2 border-t lg:border-t-0 lg:border-l border-border/50">
                          <StatusUpdateButtons scheduleId={schedule.id} currentStatus={schedule.situacao} onUpdate={refetch} />
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 w-full text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSchedule(schedule);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="gap-2 w-full text-xs"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const confirmed = window.confirm("Tem certeza que deseja excluir este agendamento? Isso também removerá planos de voo relacionados.");
                              if (!confirmed) return;
                              setDeletingId(schedule.id);
                              try {
                                const { data: plans } = await supabase
                                  .from("flight_plans")
                                  .select("id")
                                  .eq("flight_schedule_id", schedule.id);
                                const planIds = (plans || []).map((p: any) => p.id);
                                if (planIds.length) {
                                  await supabase.from("flight_checklists").delete().in("flight_plan_id", planIds);
                                  await supabase.from("flight_plans").delete().in("id", planIds);
                                }
                                const { error } = await supabase.from("flight_schedules").delete().eq("id", schedule.id);
                                if (error) throw error;
                                toast.success("Agendamento excluído com sucesso");
                                refetch();
                              } catch (err) {
                                console.error("Erro ao excluir agendamento:", err);
                                toast.error("Erro ao excluir agendamento");
                              } finally {
                                setDeletingId(null);
                              }
                            }}
                            disabled={deletingId === schedule.id}
                          >
                            {deletingId === schedule.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  Nenhum agendamento encontrado
                </p>
                <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Primeiro Agendamento
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <FlightScheduleDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSuccess={refetch}
        />
        <FlightScheduleDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setEditingSchedule(null);
          }}
          onSuccess={() => {
            refetch();
            setIsEditDialogOpen(false);
            setEditingSchedule(null);
          }}
          scheduleId={editingSchedule?.id}
        />
      </div>
    </Layout>
  );
}
