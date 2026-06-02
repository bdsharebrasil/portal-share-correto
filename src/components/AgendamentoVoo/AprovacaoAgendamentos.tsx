import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
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
import {
  Plane,
  Calendar,
  MapPin,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  Check,
  X
} from "lucide-react";
import { InlineLottieSpinner } from "@/components/ui/inline-lottie-spinner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/components/ui/use-toast";

interface BookingRequest {
  id: string;
  client_id: string;
  aeronave_id: string;
  aircraft?: any;
  aeronave?: { modelo: string; matricula: string };
  origin: string;
  destination: string;
  scheduled_date: string;
  departure_time: string;
  duration_days: number;
  passenger_count: number;
  status: "pendente" | "confirmado" | "rejeitado" | "cancelado";
  notes?: string;
  rejection_reason?: string;
  created_at: string;
  criado_em: string;
  user?: any;
}

export default function AprovacaoAgendamentos() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<"pendente" | "all">("pendente");
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [bookingToReject, setBookingToReject] = useState<BookingRequest | null>(null);

  // Ativar atualizações em tempo real
  useRealtimeBookings();

  // Fetch booking requests
  const { data: bookings, isLoading, error, refetch } = useQuery({
    queryKey: ["flight-booking-requests", filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("flight_booking_requests")
        .select(
          `
          *,
          aircraft:aeronave_id(id, registration, model),
          user:client_id(id, full_name, email)
        `
        )
        .order("criado_em", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BookingRequest[];
    }
  });

  // Approve booking mutation
  const approveMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("flight_booking_requests")
        .update({
          status: "confirmado",
          approved_at: new Date().toISOString(),
          approved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq("id", bookingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flight-booking-requests"] });
      toast({
        title: "Agendamento aprovado!",
        description: "O cliente será notificado da aprovação.",
        variant: "default"
      });
      setSelectedBooking(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao aprovar",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Reject booking mutation
  const rejectMutation = useMutation({
    mutationFn: async ({
      bookingId,
      reason
    }: {
      bookingId: string;
      reason: string;
    }) => {
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
      toast({
        title: "Agendamento rejeitado",
        description: "O cliente foi notificado da rejeição.",
        variant: "default"
      });
      setSelectedBooking(null);
      setShowRejectDialog(false);
      setBookingToReject(null);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao rejeitar",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Group bookings by aircraft
  const groupedByAircraft = (bookings || []).reduce(
    (acc, booking) => {
      const aircraftKey = booking.aeronave?.matricula || "Desconhecido";
      if (!acc[aircraftKey]) {
        acc[aircraftKey] = [];
      }
      acc[aircraftKey].push(booking);
      return acc;
    },
    {} as Record<string, BookingRequest[]>
  );

  const stats = {
    total: bookings?.length || 0,
    pending: bookings?.filter(b => b.status === "pendente").length || 0,
    approved: bookings?.filter(b => b.status === "confirmado").length || 0,
    rejected: bookings?.filter(b => b.status === "rejeitado").length || 0
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pendente":
        return "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400";
      case "confirmado":
        return "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400";
      case "rejeitado":
        return "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400";
      default:
        return "bg-gray-500/10 border-gray-500/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pendente":
        return <AlertCircle className="h-4 w-4 mr-1" />;
      case "confirmado":
        return <CheckCircle2 className="h-4 w-4 mr-1" />;
      case "rejeitado":
        return <XCircle className="h-4 w-4 mr-1" />;
      default:
        return null;
    }
  };

  return (
    <Layout>
      <main className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Aprovação de Agendamentos</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie solicitações de agendamento de voos dos clientes
            </p>
          </div>
          <Button onClick={() => refetch()} disabled={isLoading} className="gap-2">
            {isLoading ? <InlineLottieSpinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-500">{stats.approved}</div>
              <p className="text-sm text-muted-foreground">Aprovados</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-500">{stats.rejected}</div>
              <p className="text-sm text-muted-foreground">Rejeitados</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Button
            variant={filterStatus === "pendente" ? "default" : "outline"}
            onClick={() => setFilterStatus("pendente")}
            className="gap-2"
          >
            <AlertCircle className="h-4 w-4" />
            Pendentes ({stats.pending})
          </Button>
          <Button
            variant={filterStatus === "all" ? "default" : "outline"}
            onClick={() => setFilterStatus("all")}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            Todos ({stats.total})
          </Button>
        </div>

        {/* Content */}
        {error && !bookings ? (
          <Card className="bg-card border-border">
            <CardContent className="pt-6 text-center text-destructive">
              <AlertCircle className="h-12 w-12 mx-auto mb-4" />
              <p className="mb-4">{error.message || "Erro ao carregar agendamentos"}</p>
              <Button variant="outline" onClick={() => refetch()}>
                Tentar Novamente
              </Button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card className="bg-card border-border">
            <CardContent className="pt-6 flex items-center justify-center gap-3 py-12">
              <InlineLottieSpinner size="md" />
              <p className="text-muted-foreground">Carregando agendamentos...</p>
            </CardContent>
          </Card>
        ) : bookings?.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="pt-6 text-center py-12">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">Nenhum agendamento encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByAircraft).map(([aircraftReg, aircraftBookings]) => (
              <Card key={aircraftReg} className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Plane className="h-5 w-5 text-primary" />
                      {aircraftReg}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {aircraftBookings.length} solicitação(ões)
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {aircraftBookings.map(booking => (
                      <div
                        key={booking.id}
                        className="p-4 bg-muted/50 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            {/* Client and Status */}
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-base font-semibold text-foreground">
                                {booking.user?.full_name || "Cliente"}
                              </h4>
                              <Badge variant="outline" className={getStatusColor(booking.status)}>
                                {getStatusIcon(booking.status)}
                                {booking.status}
                              </Badge>
                            </div>

                            {/* Email */}
                            <p className="text-sm text-muted-foreground">{booking.user?.email}</p>

                            {/* Flight Details */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                {booking.origin} → {booking.destination}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(booking.scheduled_date), "dd/MM/yyyy", {
                                  locale: ptBR
                                })}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                {booking.departure_time}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Users className="h-4 w-4" />
                                {booking.passenger_count} pax - {booking.duration_days} dia(s)
                              </div>
                            </div>

                            {/* Notes */}
                            {booking.notes && (
                              <div className="mt-3 p-2 bg-card rounded border border-border/50">
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-semibold">Observações:</span> {booking.notes}
                                </p>
                              </div>
                            )}

                            {/* Rejection Reason */}
                            {booking.rejection_reason && (
                              <div className="mt-3 p-2 bg-red-500/10 rounded border border-red-500/20">
                                <p className="text-xs text-red-600">
                                  <span className="font-semibold">Motivo da rejeição:</span>{" "}
                                  {booking.rejection_reason}
                                </p>
                              </div>
                            )}

                            {/* Created At */}
                            <p className="text-xs text-muted-foreground mt-2">
                              Solicitado em{" "}
                              {format(new Date(booking.criado_em), "dd/MM/yyyy HH:mm", {
                                locale: ptBR
                              })}
                            </p>
                          </div>

                          {/* Actions */}
                          {booking.status === "pendente" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                                onClick={() => setSelectedBooking(booking)}
                              >
                                <Eye className="h-4 w-4" />
                                Detalhes
                              </Button>
                              <Button
                                size="sm"
                                className="gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-600"
                                onClick={() => approveMutation.mutate(booking.id)}
                                disabled={approveMutation.isPending}
                              >
                                <Check className="h-4 w-4" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-2"
                                onClick={() => {
                                  setBookingToReject(booking);
                                  setShowRejectDialog(true);
                                }}
                              >
                                <X className="h-4 w-4" />
                                Rejeitar
                              </Button>
                            </div>
                          )}

                          {booking.status !== "pendente" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => setSelectedBooking(booking)}
                            >
                              <Eye className="h-4 w-4" />
                              Detalhes
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Details Dialog */}
      {selectedBooking && (
        <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Agendamento</DialogTitle>
              <DialogDescription>
                Solicitação de {selectedBooking.user?.full_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="text-sm font-semibold text-foreground">Status</label>
                <Badge className={`mt-2 ${getStatusColor(selectedBooking.status)}`}>
                  {getStatusIcon(selectedBooking.status)}
                  {selectedBooking.status}
                </Badge>
              </div>

              {/* Client Info */}
              <div>
                <label className="text-sm font-semibold text-foreground">Cliente</label>
                <p className="text-sm text-muted-foreground mt-1">{selectedBooking.user?.full_name}</p>
                <p className="text-sm text-muted-foreground">{selectedBooking.user?.email}</p>
              </div>

              {/* Aircraft */}
              <div>
                <label className="text-sm font-semibold text-foreground">Aeronave</label>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedBooking.aeronave?.modelo} ({selectedBooking.aeronave?.matricula})
                </p>
              </div>

              {/* Flight Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-foreground">Origem</label>
                  <p className="text-sm text-muted-foreground mt-1">{selectedBooking.origin}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Destino</label>
                  <p className="text-sm text-muted-foreground mt-1">{selectedBooking.destination}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-foreground">Data</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(selectedBooking.scheduled_date), "dd/MM/yyyy", {
                      locale: ptBR
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Horário</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedBooking.departure_time}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-foreground">Duração</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedBooking.duration_days} dia(s)
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Passageiros</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedBooking.passenger_count}
                  </p>
                </div>
              </div>

              {selectedBooking.notes && (
                <div>
                  <label className="text-sm font-semibold text-foreground">Observações</label>
                  <p className="text-sm text-muted-foreground mt-1 bg-card rounded p-2">
                    {selectedBooking.notes}
                  </p>
                </div>
              )}

              {selectedBooking.rejection_reason && (
                <div>
                  <label className="text-sm font-semibold text-foreground">Motivo da Rejeição</label>
                  <p className="text-sm text-red-600 mt-1 bg-red-500/10 rounded p-2">
                    {selectedBooking.rejection_reason}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && bookingToReject && (
        <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rejeitar Agendamento?</AlertDialogTitle>
              <AlertDialogDescription>
                Você está rejeitando a solicitação de agendamento de{" "}
                <span className="font-semibold text-foreground">{bookingToReject.user?.full_name}</span>
                . Informe o motivo da rejeição.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4">
              <Input
                placeholder="Motivo da rejeição..."
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="rounded-lg"
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!rejectionReason.trim()) {
                    toast({
                      title: "Erro",
                      description: "Informe o motivo da rejeição",
                      variant: "destructive"
                    });
                    return;
                  }
                  rejectMutation.mutate({
                    bookingId: bookingToReject.id,
                    reason: rejectionReason
                  });
                }}
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                className="bg-destructive hover:bg-destructive/90"
              >
                {rejectMutation.isPending ? "Rejeitando..." : "Confirmar Rejeição"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Layout>
  );
}
