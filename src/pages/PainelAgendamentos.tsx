import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import {
  Plane,
  Calendar as CalendarIcon,
  MapPin,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Lock,
  Unlock,
  PlayCircle,
  PauseCircle,
  Wrench,
  UserCheck,
  Settings
} from "lucide-react";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths } from "date-fns";
import { CrewScheduleGrid } from "@/components/scheduling/CrewScheduleGrid";
import { BlockDateRangeSelector } from "@/components/scheduling/BlockDateRangeSelector";
import { ptBR } from "date-fns/locale";
import { toast } from "@/components/ui/use-toast";

interface BookingRequest {
  id: string;
  client_id: string;
  aeronave_id: string;
  origin: string;
  destination: string;
  scheduled_date: string;
  departure_time: string;
  return_date: string | null;
  duration_days: number;
  passenger_count: number;
  status: string;
  notes?: string;
  rejection_reason?: string;
  assigned_pilot_id?: string;
  assigned_copilot_id?: string;
  created_at: string;
  aircraft?: { id: string; registration: string; model: string };
  client?: { id: string; company_name: string };
}

interface AeronaveStatusAtivo {
  id: string;
  aeronave_id: string;
  status_atual: string;
  localizacao_atual?: string;
  voo_atual_id?: string;
  atualizado_em: string;
  aircraft?: { id: string; registration: string; model: string };
}

interface BlockedDate {
  id: string;
  aeronave_id?: string;
  block_date: string;
  reason?: string;
  is_fleet_wide: boolean;
}

export default function PainelAgendamentos() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("solicitacoes");
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockDate, setBlockDate] = useState<Date | null>(null);
  const [selectedDatesRange, setSelectedDatesRange] = useState<Date[]>([]);
  const [blockReason, setBlockReason] = useState("");
  const [isFleetWide, setIsFleetWide] = useState(false);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedPilotId, setSelectedPilotId] = useState("");
  const [selectedCopilotId, setSelectedCopilotId] = useState("");

  // Ativar atualizações em tempo real
  useRealtimeBookings();

  // Fetch aircraft
  const { data: aircraft } = useQuery({
    queryKey: ["aeronave"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aeronave')
        .select("*")
        .eq("status", "ativa")
        .order("matricula");
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch booking requests
  const { data: bookings, isLoading: loadingBookings } = useQuery({
    queryKey: ["flight-booking-requests", selectedAircraftId],
    queryFn: async () => {
      let query = supabase
        .from("flight_booking_requests")
        .select(`
          *,
          aircraft:aeronave_id(id, registration, model),
          client:client_id(id, company_name)
        `)
        .order("scheduled_date", { ascending: true });

      if (selectedAircraftId) {
        query = query.eq("id_aeronave", selectedAircraftId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as BookingRequest[];
    }
  });

  // Fetch blocked dates
  const { data: blockedDates } = useQuery({
    queryKey: ["blocked-flight-dates", selectedAircraftId],
    queryFn: async () => {
      let query = supabase
        .from("datas_bloqueadas_voo")
        .select("*")
        .order("data_bloqueio");

      if (selectedAircraftId) {
        query = query.or(`aeronave_id.eq.${selectedAircraftId},is_fleet_wide.eq.true`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BlockedDate[];
    }
  });

  // Fetch aircraft live status
  const { data: liveStatuses, refetch: refetchStatuses } = useQuery({
    queryKey: ["aircraft-live-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('status_tempo_real_aeronave')
        .select(`
          *,
          aircraft:aeronave_id(id, registration, model)
        `);
      if (error) throw error;
      return (data || []) as AeronaveStatusAtivo[];
    }
  });

  // Fetch crew members for assignment
  const { data: crewMembers } = useQuery({
    queryKey: ["crew-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membros_tripulacao")
        .select("*")
        .eq("situacao", "ativo")
        .order("nome_completo");
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch aircraft scheduling config
  const { data: aircraftConfig, refetch: refetchAircraftConfig } = useQuery({
    queryKey: ["scheduling-aircraft-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('config_agendamento_aeronave')
        .select("*");
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch crew scheduling config
  const { data: crewConfig, refetch: refetchCrewConfig } = useQuery({
    queryKey: ["scheduling-crew-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduling_crew_config")
        .select("*");
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch maintenances
  const { data: maintenances } = useQuery({
    queryKey: ["manutencoes-programadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manutencoes")
        .select(`*, aircraft:aeronave_id(id, registration, model)`)
        .gte("data_programada", format(startOfMonth(selectedMonth), "yyyy-MM-dd"))
        .lte("data_programada", format(endOfMonth(selectedMonth), "yyyy-MM-dd"));
      if (error) throw error;
      return data || [];
    }
  });

  // Approve booking mutation
  const approveMutation = useMutation({
    mutationFn: async ({ bookingId, pilotId, copilotId }: { bookingId: string; pilotId?: string; copilotId?: string }) => {
      const { error } = await supabase
        .from("flight_booking_requests")
        .update({
          status: "confirmado",
          approved_at: new Date().toISOString(),
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          assigned_pilot_id: pilotId || null,
          assigned_copilot_id: copilotId || null
        })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flight-booking-requests"] });
      toast({ title: "Agendamento aprovado!", description: "Tripulação escalada com sucesso." });
      setShowAssignDialog(false);
      setSelectedBooking(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  // Reject booking mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      const { error } = await supabase
        .from("flight_booking_requests")
        .update({
          status: "rejeitado",
          rejection_reason: reason,
          approved_at: new Date().toISOString(),
          approved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flight-booking-requests"] });
      toast({ title: "Agendamento rejeitado" });
      setShowRejectDialog(false);
      setRejectionReason("");
    }
  });

  // Start flight mutation - muda status para "em_voo"
  const startFlightMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("flight_booking_requests")
        .update({ status: "em_voo" })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flight-booking-requests"] });
      queryClient.invalidateQueries({ queryKey: ["flight-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["active-flight-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["aircraft-live-status"] });
      toast({ 
        title: "🛫 Voo Iniciado", 
        description: "Ciclo de voo criado automaticamente" 
      });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao iniciar voo", description: error.message, variant: "destructive" });
    }
  });

  // Block date mutation
  const blockDateMutation = useMutation({
    mutationFn: async () => {
      if (selectedDatesRange.length === 0) return;

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const datesToBlock = selectedDatesRange.map(date => ({
        aeronave_id: isFleetWide ? null : selectedAircraftId,
        block_date: format(date, "yyyy-MM-dd"),
        reason: blockReason,
        is_fleet_wide: isFleetWide,
        blocked_by: userId
      }));

      // Check for duplicates
      const blockedDateStrings = datesToBlock.map(d => d.data_bloqueio);
      const { data: existingBlocks } = await supabase
        .from("datas_bloqueadas_voo")
        .select("data_bloqueio")
        .in("data_bloqueio", blockedDateStrings);

      if (existingBlocks && existingBlocks.length > 0) {
        const duplicateDates = existingBlocks.map(b => b.data_bloqueio).join(", ");
        throw new Error(`As datas já bloqueadas: ${duplicateDates}`);
      }

      // Insert all dates at once
      const { error } = await supabase.from("datas_bloqueadas_voo").insert(datesToBlock);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-flight-dates"] });
      const count = selectedDatesRange.length;
      toast({
        title: `${count} data(s) bloqueada(s) com sucesso`,
        description: count > 1 ? `Intervalo de ${format(selectedDatesRange[0], "dd/MM")} a ${format(selectedDatesRange[selectedDatesRange.length - 1], "dd/MM")}` : undefined
      });
      setShowBlockDialog(false);
      setBlockReason("");
      setIsFleetWide(false);
      clearSelectedDates();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao bloquear data(s)",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Unblock date mutation
  const unblockDateMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const { error } = await supabase.from("datas_bloqueadas_voo").delete().eq("id", blockId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-flight-dates"] });
      toast({ title: "Data desbloqueada" });
    }
  });

  // Update aircraft status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ aircraftId, status, flightId }: { aircraftId: string; status: string; flightId?: string }) => {
      const { data: existing } = await supabase
        .from('status_tempo_real_aeronave')
        .select("id")
        .eq("id_aeronave", aircraftId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('status_tempo_real_aeronave')
          .update({
            status_atual: status,
            voo_atual_id: flightId || null,
            ultima_partida: status === "em_voo" ? new Date().toISOString() : undefined,
            atualizado_por: (await supabase.auth.getUser()).data.user?.id,
            atualizado_em: new Date().toISOString()
          })
          .eq("id_aeronave", aircraftId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('status_tempo_real_aeronave').insert({
          aeronave_id: aircraftId,
          status_atual: status,
          voo_atual_id: flightId || null,
          atualizado_por: (await supabase.auth.getUser()).data.user?.id
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchStatuses();
      toast({ title: "Status atualizado" });
    }
  });

  // Toggle aircraft scheduling config
  const toggleAircraftConfigMutation = useMutation({
    mutationFn: async ({ aircraftId, enabled }: { aircraftId: string; enabled: boolean }) => {
      const { data: existing } = await supabase
        .from('config_agendamento_aeronave')
        .select("id")
        .eq("id_aeronave", aircraftId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('config_agendamento_aeronave')
          .update({ enabled_for_scheduling: enabled, updated_at: new Date().toISOString() })
          .eq("id_aeronave", aircraftId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('config_agendamento_aeronave')
          .insert({ aeronave_id: aircraftId, enabled_for_scheduling: enabled });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchAircraftConfig();
      toast({ title: "Configuração atualizada" });
    }
  });

  // Toggle crew scheduling config
  const toggleCrewConfigMutation = useMutation({
    mutationFn: async ({ crewId, enabled }: { crewId: string; enabled: boolean }) => {
      const { data: existing } = await supabase
        .from("scheduling_crew_config")
        .select("id")
        .eq("crew_member_id", crewId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("scheduling_crew_config")
          .update({ enabled_for_scheduling: enabled, updated_at: new Date().toISOString() })
          .eq("crew_member_id", crewId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("scheduling_crew_config")
          .insert({ crew_member_id: crewId, enabled_for_scheduling: enabled });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchCrewConfig();
      toast({ title: "Configuração atualizada" });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pendente": return "bg-yellow-500/20 text-yellow-600 border-yellow-500/30";
      case "confirmado": return "bg-green-500/20 text-green-600 border-green-500/30";
      case "rejeitado": return "bg-red-500/20 text-red-600 border-red-500/30";
      case "em_voo": return "bg-blue-500/20 text-blue-600 border-blue-500/30";
      case "concluido": return "bg-gray-500/20 text-gray-600 border-gray-500/30";
      default: return "bg-gray-500/20 text-gray-600 border-gray-500/30";
    }
  };

  const getAircraftStatusIcon = (status: string) => {
    switch (status) {
      case "disponivel": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "indisponivel": return <XCircle className="h-5 w-5 text-red-500" />;
      case "em_voo": return <Plane className="h-5 w-5 text-blue-500 animate-pulse" />;
      case "manutencao": return <Wrench className="h-5 w-5 text-orange-500" />;
      case "reservado": return <Clock className="h-5 w-5 text-yellow-500" />;
      default: return <XCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const pendingCount = bookings?.filter(b => b.situacao === "pendente").length || 0;
  const confirmedCount = bookings?.filter(b => b.situacao === "confirmado").length || 0;

  // Calendar days
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getBookingsForDay = (date: Date) => {
    return bookings?.filter(b =>
      isSameDay(new Date(b.scheduled_date), date) &&
      b.situacao !== "rejeitado" &&
      b.situacao !== "cancelado"
    ) || [];
  };

  const isDateBlocked = (date: Date) => {
    return blockedDates?.some(b => isSameDay(new Date(b.data_bloqueio), date)) || false;
  };

  const getMaintenancesForDay = (date: Date) => {
    return maintenances?.filter(m => isSameDay(new Date(m.data_programada), date)) || [];
  };

  // Generate date range between two dates
  const getDateRangeBetween = (start: Date, end: Date): Date[] => {
    const dates: Date[] = [];
    const current = new Date(start);
    const endDate = new Date(end);

    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  // Check if a date is in the selected range
  const isDateInRange = (date: Date) => {
    return selectedDatesRange.some(d => isSameDay(d, date));
  };

  // Handle calendar date click
  const handleDateClick = (date: Date, event: React.MouseEvent) => {
    if (event.shiftKey && rangeStart) {
      // Shift+click to select range
      const [start, end] = rangeStart < date ? [rangeStart, date] : [date, rangeStart];
      const dateRange = getDateRangeBetween(start, end);
      setSelectedDatesRange(dateRange);
      setRangeStart(null);
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd+click to add/remove individual date
      setSelectedDatesRange(prev => {
        const isSelected = isDateInRange(date);
        if (isSelected) {
          return prev.filter(d => !isSameDay(d, date));
        } else {
          return [...prev, date];
        }
      });
    } else {
      // Normal click starts range selection
      setRangeStart(date);
      setSelectedDatesRange([date]);
    }
  };

  // Clear selected dates
  const clearSelectedDates = () => {
    setSelectedDatesRange([]);
    setRangeStart(null);
  };

  // Open block dialog with selected dates
  const openBlockDialog = () => {
    if (selectedDatesRange.length > 0) {
      setShowBlockDialog(true);
    } else {
      toast({ title: "Selecione pelo menos uma data", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <main className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Painel de Agendamentos</h1>
            <p className="text-muted-foreground">Gerencie solicitações, calendário e status da frota</p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedAircraftId || "all"} onValueChange={(v) => setSelectedAircraftId(v === "all" ? null : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar aeronave" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas aeronaves</SelectItem>
                {aircraft?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.registration} - {a.model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{confirmedCount}</p>
                  <p className="text-xs text-muted-foreground">Confirmados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Plane className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{liveStatuses?.filter(s => s.status_atual === "em_voo").length || 0}</p>
                  <p className="text-xs text-muted-foreground">Em Voo</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Lock className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{blockedDates?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Datas Bloqueadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Wrench className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{maintenances?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Manutenções</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-6 w-full max-w-4xl">
            <TabsTrigger value="solicitacoes" className="gap-2">
              <AlertCircle className="h-4 w-4" /> Solicitações
            </TabsTrigger>
            <TabsTrigger value="calendario" className="gap-2">
              <CalendarIcon className="h-4 w-4" /> Calendário
            </TabsTrigger>
            <TabsTrigger value="frota" className="gap-2">
              <Plane className="h-4 w-4" /> Status Frota
            </TabsTrigger>
            <TabsTrigger value="escala" className="gap-2">
              <UserCheck className="h-4 w-4" /> Escala
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" /> Configurações
            </TabsTrigger>
          </TabsList>

          {/* Solicitações Tab */}
          <TabsContent value="solicitacoes" className="space-y-4">
            {loadingBookings ? (
              <Card>
                <CardContent className="py-12 flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Carregando...
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Pendentes */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    Pendentes ({bookings?.filter(b => b.situacao === "pendente").length || 0})
                  </h3>
                  {bookings?.filter(b => b.situacao === "pendente").length === 0 ? (
                    <Card>
                      <CardContent className="py-6 text-center">
                        <p className="text-muted-foreground">Nenhuma solicitação pendente</p>
                      </CardContent>
                    </Card>
                  ) : (
                    bookings?.filter(b => b.situacao === "pendente").map((booking) => (
                      <Card key={booking.id} className="border-yellow-500/30">
                        <CardContent className="pt-4">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-3">
                                <Badge className="bg-primary/20 text-primary">
                                  {booking.aeronave?.matricula}
                                </Badge>
                                <span className="font-semibold">{booking.client?.razao_social}</span>
                                <Badge variant="outline" className={getStatusColor(booking.situacao)}>
                                  {booking.situacao}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <MapPin className="h-4 w-4" />
                                  {booking.origin} → {booking.destination}
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <CalendarIcon className="h-4 w-4" />
                                  {format(new Date(booking.scheduled_date), "dd/MM/yyyy")}
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  {booking.departure_time || "Horário não definido"}
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Users className="h-4 w-4" />
                                  {booking.passenger_count} pax - {booking.duration_days} dia(s)
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="border-green-500/50 text-green-600 hover:bg-green-500/10"
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setShowAssignDialog(true);
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                              </Button>
                              <Button
                                variant="outline"
                                className="border-red-500/50 text-red-600 hover:bg-red-500/10"
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setShowRejectDialog(true);
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {/* Confirmados - prontos para iniciar */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Confirmados - Prontos para Iniciar ({bookings?.filter(b => b.situacao === "confirmado").length || 0})
                  </h3>
                  {bookings?.filter(b => b.situacao === "confirmado").length === 0 ? (
                    <Card>
                      <CardContent className="py-6 text-center">
                        <p className="text-muted-foreground">Nenhum voo confirmado aguardando início</p>
                      </CardContent>
                    </Card>
                  ) : (
                    bookings?.filter(b => b.situacao === "confirmado").map((booking) => (
                      <Card key={booking.id} className="border-green-500/30">
                        <CardContent className="pt-4">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-3">
                                <Badge className="bg-primary/20 text-primary">
                                  {booking.aeronave?.matricula}
                                </Badge>
                                <span className="font-semibold">{booking.client?.razao_social}</span>
                                <Badge variant="outline" className={getStatusColor(booking.situacao)}>
                                  ✅ {booking.situacao}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <MapPin className="h-4 w-4" />
                                  {booking.origin} → {booking.destination}
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <CalendarIcon className="h-4 w-4" />
                                  {format(new Date(booking.scheduled_date), "dd/MM/yyyy")}
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  {booking.departure_time || "Horário não definido"}
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Users className="h-4 w-4" />
                                  {booking.passenger_count} pax - {booking.duration_days} dia(s)
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="border-blue-500/50 text-blue-600 hover:bg-blue-500/10"
                                onClick={() => startFlightMutation.mutate(booking.id)}
                                disabled={startFlightMutation.isPending}
                              >
                                <PlayCircle className="h-4 w-4 mr-1" /> 
                                {startFlightMutation.isPending ? "Iniciando..." : "Iniciar Voo"}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Calendário Tab */}
          <TabsContent value="calendario" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))}>
                  Mês Anterior
                </Button>
                <Button variant="outline" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
                  Próximo Mês
                </Button>
              </div>
              <div className="flex gap-2">
                {selectedDatesRange.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/30">
                      <span className="text-sm font-medium text-primary">
                        {selectedDatesRange.length} data(s) selecionada(s)
                      </span>
                      {selectedDatesRange.length > 1 && (
                        <span className="text-xs text-muted-foreground">
                          ({format(selectedDatesRange[0], "dd/MM")} a {format(selectedDatesRange[selectedDatesRange.length - 1], "dd/MM")})
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelectedDates}
                    >
                      Limpar
                    </Button>
                  </>
                )}
                <Button
                  onClick={openBlockDialog}
                  className="gap-2"
                  disabled={selectedDatesRange.length === 0}
                >
                  <Lock className="h-4 w-4" />
                  {selectedDatesRange.length > 0
                    ? `Bloquear ${selectedDatesRange.length}`
                    : "Bloquear Data"}
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{format(selectedMonth, "MMMM yyyy", { locale: ptBR })}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                    <div key={day} className="text-center text-sm font-medium py-2 text-muted-foreground">
                      {day}
                    </div>
                  ))}
                  {/* Empty cells for days before month starts */}
                  {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} className="p-2" />
                  ))}
                  {calendarDays.map((day) => {
                    const dayBookings = getBookingsForDay(day);
                    const blocked = isDateBlocked(day);
                    const dayMaintenances = getMaintenancesForDay(day);
                    const isToday = isSameDay(day, new Date());
                    const isSelected = isDateInRange(day);

                    return (
                      <div
                        key={day.toISOString()}
                        onClick={(e) => handleDateClick(day, e)}
                        onMouseDown={() => setIsSelectingRange(true)}
                        onMouseUp={() => setIsSelectingRange(false)}
                        onMouseEnter={() => {
                          if (isSelectingRange && rangeStart) {
                            const [start, end] = rangeStart < day ? [rangeStart, day] : [day, rangeStart];
                            const dateRange = getDateRangeBetween(start, end);
                            setSelectedDatesRange(dateRange);
                          }
                        }}
                        className={`min-h-24 p-2 border rounded-lg cursor-pointer transition-all ${isSelected ? "bg-blue-500/20 border-blue-500/50" :
                            blocked ? "bg-red-500/10 border-red-500/30" :
                              isToday ? "bg-primary/10 border-primary" : "border-border hover:bg-muted/50"
                          }`}
                        title={`${isSelected ? "Clique para desselecionar" : "Clique para selecionar (Shift+Click para intervalo, Ctrl/Cmd+Click para múltiplos)"}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-medium ${isToday ? "text-primary" : isSelected ? "text-blue-600" : ""}`}>
                            {format(day, "d")}
                          </span>
                          {blocked && <Lock className="h-3 w-3 text-red-500" />}
                          {isSelected && <CheckCircle2 className="h-3 w-3 text-blue-600" />}
                        </div>
                        <div className="space-y-1">
                          {dayBookings.slice(0, 2).map((b) => (
                            <div
                              key={b.id}
                              className={`text-xs p-1 rounded truncate ${getStatusColor(b.situacao)}`}
                            >
                              {b.aeronave?.matricula} - {b.origin}→{b.destination}
                            </div>
                          ))}
                          {dayBookings.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{dayBookings.length - 2} mais
                            </div>
                          )}
                          {dayMaintenances.slice(0, 1).map((m: any) => (
                            <div key={m.id} className="text-xs p-1 rounded bg-orange-500/20 text-orange-600 truncate">
                              🔧 {m.aeronave?.matricula}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Blocked Dates List */}
            {blockedDates && blockedDates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-red-500" /> Datas Bloqueadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {blockedDates.map((block) => (
                      <div key={block.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div>
                          <span className="font-medium">
                            {format(new Date(block.data_bloqueio), "dd/MM/yyyy")}
                          </span>
                          {block.frota_inteira && (
                            <Badge variant="outline" className="ml-2">Toda Frota</Badge>
                          )}
                          {block.motivo && (
                            <span className="text-sm text-muted-foreground ml-2">- {block.motivo}</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unblockDateMutation.mutate(block.id)}
                        >
                          <Unlock className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Status Frota Tab */}
          <TabsContent value="frota" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {aircraft?.filter((ac) => {
                const config = aircraftConfig?.find(c => c.aeronave_id === ac.id);
                return config?.enabled_for_scheduling !== false;
              }).map((ac) => {
                const status = liveStatuses?.find(s => s.aeronave_id === ac.id);
                const currentStatus = status?.status_atual || "disponivel";
                const isAvailable = currentStatus === "disponivel";

                return (
                  <Card key={ac.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{ac.registration}</CardTitle>
                        <Button
                          size="sm"
                          className={`gap-2 ${isAvailable ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}
                          onClick={() => updateStatusMutation.mutate({
                            aircraftId: ac.id,
                            status: isAvailable ? "indisponivel" : "disponivel"
                          })}
                        >
                          {isAvailable ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Disponível
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4" />
                              Indisponível
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">{ac.model}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Status Adicional</label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={currentStatus === "em_voo" ? "default" : "outline"}
                            className={currentStatus === "em_voo" ? "bg-blue-500 hover:bg-blue-600" : ""}
                            onClick={() => updateStatusMutation.mutate({ aircraftId: ac.id, status: "em_voo" })}
                          >
                            <Plane className="h-4 w-4 mr-1" /> Em Voo
                          </Button>
                          <Button
                            size="sm"
                            variant={currentStatus === "manutencao" ? "default" : "outline"}
                            className={currentStatus === "manutencao" ? "bg-orange-500 hover:bg-orange-600" : ""}
                            onClick={() => updateStatusMutation.mutate({ aircraftId: ac.id, status: "manutencao" })}
                          >
                            <Wrench className="h-4 w-4 mr-1" /> Manutenção
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Escala Tab */}
          <TabsContent value="escala" className="space-y-4">
            {/* Grade de Escala em Tempo Real */}
            <CrewScheduleGrid daysToShow={14} />

            {/* Voos Confirmados */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Voos Confirmados - {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bookings?.filter(b => b.situacao === "confirmado").length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>Nenhum voo confirmado neste período</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookings?.filter(b => b.situacao === "confirmado").map((booking) => {
                      const pilot = crewMembers?.find(c => c.id === booking.assigned_pilot_id);
                      const copilot = crewMembers?.find(c => c.id === booking.assigned_copilot_id);

                      return (
                        <div key={booking.id} className="p-4 border rounded-lg bg-success/5 border-success/20">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <Badge className="bg-primary/20 text-primary">{booking.aeronave?.matricula}</Badge>
                                <span className="font-medium">{booking.client?.razao_social}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CalendarIcon className="h-4 w-4" />
                                  {format(new Date(booking.scheduled_date), "dd/MM/yyyy")}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {booking.departure_time || "---"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  {booking.origin} → {booking.destination}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-sm">
                                <p className="text-muted-foreground">Piloto:</p>
                                <p className="font-medium">{pilot?.full_name || "Não escalado"}</p>
                              </div>
                              <div className="text-sm">
                                <p className="text-muted-foreground">Copiloto:</p>
                                <p className="font-medium">{copilot?.full_name || "Não escalado"}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Manutenções Programadas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-orange-500" />
                  Manutenções Programadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {maintenances?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">Nenhuma manutenção programada</p>
                ) : (
                  <div className="space-y-2">
                    {maintenances?.map((m: any) => (
                      <div key={m.id} className="p-3 border rounded-lg bg-orange-500/5 border-orange-500/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <Badge variant="outline">{m.aeronave?.matricula}</Badge>
                            <span className="ml-2 font-medium">{m.tipo || m.descricao}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(m.data_programada), "dd/MM/yyyy")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configurações Tab */}
          <TabsContent value="config" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Aeronaves no Calendário */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plane className="h-5 w-5 text-primary" />
                    Aeronaves no Calendário
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Ative ou desative aeronaves disponíveis para agendamento
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {aircraft?.map((ac) => {
                    const config = aircraftConfig?.find(c => c.aeronave_id === ac.id);
                    const isEnabled = config?.enabled_for_scheduling ?? true;

                    return (
                      <div
                        key={ac.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <Plane className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{ac.registration}</p>
                            <p className="text-sm text-muted-foreground">{ac.model}</p>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) =>
                            toggleAircraftConfigMutation.mutate({
                              aircraftId: ac.id,
                              enabled: checked
                            })
                          }
                        />
                      </div>
                    );
                  })}
                  {(!aircraft || aircraft.length === 0) && (
                    <p className="text-center text-muted-foreground py-6">
                      Nenhuma aeronave cadastrada
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Tripulação na Escala */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Tripulação na Escala
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Ative ou desative tripulantes disponíveis para escalação
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {crewMembers?.map((crew) => {
                    const config = crewConfig?.find(c => c.crew_member_id === crew.id);
                    const isEnabled = config?.enabled_for_scheduling ?? true;

                    return (
                      <div
                        key={crew.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <UserCheck className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{crew.full_name}</p>
                            <p className="text-sm text-muted-foreground">{(crew as any).license_type || "Tripulante"}</p>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) =>
                            toggleCrewConfigMutation.mutate({
                              crewId: crew.id,
                              enabled: checked
                            })
                          }
                        />
                      </div>
                    );
                  })}
                  {(!crewMembers || crewMembers.length === 0) && (
                    <p className="text-center text-muted-foreground py-6">
                      Nenhum tripulante cadastrado
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Block Date Dialog */}
        <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Bloquear Datas para {selectedAircraftId ? "Aeronave Selecionada" : "Toda a Frota"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Date Range Selector with Drag */}
              <BlockDateRangeSelector
                selectedDates={selectedDatesRange}
                onDatesChange={setSelectedDatesRange}
              />

              {/* Bloqueio Details - Only show if dates are selected */}
              {selectedDatesRange.length > 0 && (
                <>
                  {/* Reason Input */}
                  <div>
                    <label className="text-sm font-medium">Motivo do bloqueio (opcional)</label>
                    <Input
                      placeholder="Ex: Manutenção programada, Evento, etc..."
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  {/* Fleet Wide Checkbox - Only show if aircraft is selected */}
                  {selectedAircraftId && (
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                      <input
                        type="checkbox"
                        id="fleetWide"
                        checked={isFleetWide}
                        onChange={(e) => setIsFleetWide(e.target.checked)}
                        className="cursor-pointer"
                      />
                      <label htmlFor="fleetWide" className="text-sm cursor-pointer flex-1">
                        Aplicar bloqueio para <strong>toda a frota</strong> nessas datas
                      </label>
                    </div>
                  )}

                  {!selectedAircraftId && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-sm text-amber-700">
                        ⚠️ Nenhuma aeronave selecionada. As datas serão bloqueadas para <strong>toda a frota</strong>.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Dialog Footer */}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBlockDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => blockDateMutation.mutate()}
                disabled={selectedDatesRange.length === 0 || blockDateMutation.isPending}
              >
                {blockDateMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Bloqueando...
                  </>
                ) : (
                  `Bloquear ${selectedDatesRange.length} Data(s)`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rejeitar Agendamento</AlertDialogTitle>
              <AlertDialogDescription>
                Informe o motivo da rejeição para o cliente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              placeholder="Motivo da rejeição..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedBooking && rejectionReason) {
                    rejectMutation.mutate({ bookingId: selectedBooking.id, reason: rejectionReason });
                  }
                }}
                disabled={!rejectionReason}
                className="bg-destructive"
              >
                Rejeitar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Assign Crew Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aprovar e Escalar Tripulação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Piloto</label>
                <Select value={selectedPilotId} onValueChange={setSelectedPilotId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar piloto" />
                  </SelectTrigger>
                  <SelectContent>
                    {crewMembers?.map((crew) => (
                      <SelectItem key={crew.id} value={crew.id}>{crew.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Copiloto (opcional)</label>
                <Select value={selectedCopilotId} onValueChange={setSelectedCopilotId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar copiloto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {crewMembers?.filter(c => c.id !== selectedPilotId).map((crew) => (
                      <SelectItem key={crew.id} value={crew.id}>{crew.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancelar</Button>
              <Button
                onClick={() => {
                  if (selectedBooking) {
                    approveMutation.mutate({
                      bookingId: selectedBooking.id,
                      pilotId: selectedPilotId || undefined,
                      copilotId: selectedCopilotId || undefined
                    });
                  }
                }}
              >
                Aprovar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </Layout>
  );
}
