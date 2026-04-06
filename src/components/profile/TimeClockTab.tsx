import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, FileText, AlertCircle, CheckCircle, XCircle, Upload, Calendar as CalendarIcon, Loader2 } from "lucide-react";

interface TimeEntry {
  id: string;
  entry_date: string;
  clock_in: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  clock_out: string | null;
  total_hours: number | null;
  status: string;
}

interface AbsenceJustification {
  id: string;
  entry_date: string;
  justification: string;
  document_url: string | null;
  status: string;
  created_at: string;
}

interface TimeCorrectionRequest {
  id: string;
  entry_date: string;
  correction_type: string;
  original_time: string | null;
  corrected_time: string;
  reason: string;
  status: string;
  created_at: string;
}

export function TimeClockTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [justification, setJustification] = useState("");
  const [correctionType, setCorrectionType] = useState("clock_in");
  const [correctedTime, setCorrectedTime] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const userId = user?.id;

  // Fetch time entries for selected month
  const { data: timeEntries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["time-entries", userId, format(selectedMonth, "yyyy-MM")],
    queryFn: async () => {
      if (!userId) return [];
      const start = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
      const end = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", userId)
        .gte("entry_date", start)
        .lte("entry_date", end)
        .order("entry_date", { ascending: true });
      
      if (error) throw error;
      return data as TimeEntry[];
    },
    enabled: !!userId,
  });

  // Fetch absence justifications
  const { data: absenceJustifications = [] } = useQuery({
    queryKey: ["absence-justifications", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from("absence_justifications")
        .select("*")
        .eq("user_id", userId)
        .order("criado_em", { ascending: false });
      
      if (error) throw error;
      return (data || []) as AbsenceJustification[];
    },
    enabled: !!userId,
  });

  // Fetch time correction requests
  const { data: correctionRequests = [] } = useQuery({
    queryKey: ["time-correction-requests", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from("time_correction_requests")
        .select("*")
        .eq("user_id", userId)
        .order("criado_em", { ascending: false });
      
      if (error) throw error;
      return (data || []) as TimeCorrectionRequest[];
    },
    enabled: !!userId,
  });

  // Generate all days in the selected month
  const monthDays = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    return eachDayOfInterval({ start, end });
  }, [selectedMonth]);

  // Create a map of entries by date
  const entriesByDate = useMemo(() => {
    const map = new Map<string, TimeEntry>();
    timeEntries.forEach((entry) => {
      map.set(entry.entry_date, entry);
    });
    return map;
  }, [timeEntries]);

  // Submit absence justification
  const submitAbsenceMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !selectedDate) throw new Error("Dados inválidos");
      
      let documentUrl = null;
      
      if (documentFile) {
        setUploading(true);
        const fileName = `${userId}/${format(selectedDate, "yyyy-MM-dd")}-${Date.now()}.${documentFile.nome.split(".").pop()}`;
        const { error: uploadError } = await supabase.storage
          .from("documents_colaborador")
          .upload(fileName, documentFile);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from("documents_colaborador")
          .getPublicUrl(fileName);
        
        documentUrl = urlData.publicUrl;
        setUploading(false);
      }

      const { error } = await supabase
        .from("absence_justifications" as any)
        .insert({
          user_id: userId,
          entry_date: format(selectedDate, "yyyy-MM-dd"),
          justification,
          document_url: documentUrl,
          status: "pending",
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Justificativa enviada para aprovação!");
      setAbsenceDialogOpen(false);
      setJustification("");
      setDocumentFile(null);
      setSelectedDate(undefined);
      queryClient.invalidateQueries({ queryKey: ["absence-justifications"] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar justificativa: ${error.message}`);
      setUploading(false);
    },
  });

  // Submit time correction request
  const submitCorrectionMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !selectedDate) throw new Error("Dados inválidos");
      
      const entry = entriesByDate.get(format(selectedDate, "yyyy-MM-dd"));
      let originalTime = null;
      
      if (entry) {
        switch (correctionType) {
          case "clock_in":
            originalTime = entry.clock_in ? format(new Date(entry.clock_in), "HH:mm") : null;
            break;
          case "lunch_start":
            originalTime = entry.lunch_start ? format(new Date(entry.lunch_start), "HH:mm") : null;
            break;
          case "lunch_end":
            originalTime = entry.lunch_end ? format(new Date(entry.lunch_end), "HH:mm") : null;
            break;
          case "clock_out":
            originalTime = entry.clock_out ? format(new Date(entry.clock_out), "HH:mm") : null;
            break;
        }
      }

      const { error } = await supabase
        .from("time_correction_requests" as any)
        .insert({
          user_id: userId,
          entry_date: format(selectedDate, "yyyy-MM-dd"),
          time_entry_id: entry?.id || null,
          correction_type: correctionType,
          original_time: originalTime,
          corrected_time: correctedTime,
          reason: correctionReason,
          status: "pending",
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação de correção enviada para aprovação!");
      setCorrectionDialogOpen(false);
      setCorrectedTime("");
      setCorrectionReason("");
      setSelectedDate(undefined);
      queryClient.invalidateQueries({ queryKey: ["time-correction-requests"] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar solicitação: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-600">Pendente</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-600">Aprovado</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-600">Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTime = (isoDate: string | null) => {
    if (!isoDate) return "-";
    return format(new Date(isoDate), "HH:mm");
  };

  const getCorrectionTypeLabel = (type: string) => {
    switch (type) {
      case "clock_in": return "Entrada";
      case "lunch_start": return "Início Almoço";
      case "lunch_end": return "Fim Almoço";
      case "clock_out": return "Saída";
      default: return type;
    }
  };

  const handleOpenAbsenceDialog = () => {
    if (!selectedDate) {
      toast.error("Selecione uma data no calendário primeiro");
      return;
    }
    setAbsenceDialogOpen(true);
  };

  const handleOpenCorrectionDialog = () => {
    if (!selectedDate) {
      toast.error("Selecione uma data no calendário primeiro");
      return;
    }
    setCorrectionDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Registro de Ponto</h2>
          <p className="text-sm text-muted-foreground">Acompanhe seus registros de ponto e solicite correções</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenAbsenceDialog}
            className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/20"
          >
            <FileText className="h-4 w-4 mr-2" />
            Justificar Falta
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenCorrectionDialog}
            className="border-blue-600 text-blue-400 hover:bg-blue-600/20"
          >
            <Clock className="h-4 w-4 mr-2" />
            Corrigir Ponto
          </Button>
        </div>
      </div>

      <Tabs defaultValue="calendario" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-background/50 border border-border">
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="lista">Lista Mensal</TabsTrigger>
          <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
        </TabsList>

        <TabsContent value="calendario" className="mt-4">
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={selectedMonth}
                onMonthChange={setSelectedMonth}
                locale={ptBR}
                className="rounded-md border-0"
                modifiers={{
                  hasEntry: (date) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    return entriesByDate.has(dateStr);
                  },
                  weekend: (date) => isWeekend(date),
                }}
                modifiersClassNames={{
                  hasEntry: "bg-green-500/20 text-green-400 font-semibold",
                  weekend: "text-muted-foreground/50",
                }}
              />
              
              {selectedDate && (
                <div className="mt-4 p-4 rounded-lg bg-background/50 border border-border">
                  <h4 className="font-semibold mb-2">
                    {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </h4>
                  {(() => {
                    const entry = entriesByDate.get(format(selectedDate, "yyyy-MM-dd"));
                    if (entry) {
                      return (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Entrada:</span>
                            <span className="font-medium">{formatTime(entry.clock_in)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Início Almoço:</span>
                            <span className="font-medium">{formatTime(entry.lunch_start)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Fim Almoço:</span>
                            <span className="font-medium">{formatTime(entry.lunch_end)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Saída:</span>
                            <span className="font-medium">{formatTime(entry.clock_out)}</span>
                          </div>
                          <div className="col-span-2 flex justify-between border-t pt-2 mt-2">
                            <span className="text-muted-foreground">Total:</span>
                            <span className="font-semibold text-primary">{entry.total_hours || 0}h</span>
                          </div>
                        </div>
                      );
                    } else if (!isWeekend(selectedDate)) {
                      return (
                        <p className="text-muted-foreground text-sm flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                          Sem registro de ponto para este dia
                        </p>
                      );
                    } else {
                      return (
                        <p className="text-muted-foreground text-sm">Fim de semana</p>
                      );
                    }
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lista" className="mt-4">
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                Registros de {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEntries ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {monthDays.filter(day => !isWeekend(day)).map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const entry = entriesByDate.get(dateStr);
                    const hasEntry = !!entry;

                    return (
                      <div
                        key={dateStr}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          hasEntry
                            ? "bg-green-500/10 border-green-600/30"
                            : "bg-red-500/10 border-red-600/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-center min-w-[50px]">
                            <p className="text-lg font-bold">{format(day, "dd")}</p>
                            <p className="text-xs text-muted-foreground">{format(day, "EEE", { locale: ptBR })}</p>
                          </div>
                          {hasEntry ? (
                            <div className="flex items-center gap-4 text-sm">
                              <span>{formatTime(entry.clock_in)} - {formatTime(entry.clock_out)}</span>
                              <Badge variant="outline" className="bg-green-500/20 text-green-400">
                                {entry.total_hours || 0}h
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-sm text-red-400">Sem registro</span>
                          )}
                        </div>
                        {hasEntry ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="solicitacoes" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-card/50 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Justificativas de Falta
                </CardTitle>
              </CardHeader>
              <CardContent>
                {absenceJustifications.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">Nenhuma justificativa enviada</p>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {absenceJustifications.map((item) => (
                      <div key={item.id} className="p-3 rounded-lg bg-background/50 border border-border">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">{format(new Date(item.entry_date), "dd/MM/yyyy")}</span>
                          {getStatusBadge(item.situacao)}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.justification}</p>
                        {item.documento && (
                          <a
                            href={item.documento}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline mt-1 inline-block"
                          >
                            Ver documento anexo
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Correções de Ponto
                </CardTitle>
              </CardHeader>
              <CardContent>
                {correctionRequests.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">Nenhuma correção solicitada</p>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {correctionRequests.map((item) => (
                      <div key={item.id} className="p-3 rounded-lg bg-background/50 border border-border">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">{format(new Date(item.entry_date), "dd/MM/yyyy")}</span>
                          {getStatusBadge(item.situacao)}
                        </div>
                        <div className="text-sm space-y-1">
                          <p><span className="text-muted-foreground">Tipo:</span> {getCorrectionTypeLabel(item.correction_type)}</p>
                          <p><span className="text-muted-foreground">Horário correto:</span> {item.corrected_time}</p>
                          <p className="text-muted-foreground line-clamp-1">{item.motivo}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Absence Justification Dialog */}
      <Dialog open={absenceDialogOpen} onOpenChange={setAbsenceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Justificar Falta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data</Label>
              <Input
                value={selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label>Justificativa *</Label>
              <Textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Descreva o motivo da falta..."
                rows={4}
              />
            </div>
            <div>
              <Label>Documento (atestado, declaração, etc.)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbsenceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => submitAbsenceMutation.mutate()}
              disabled={!justification || submitAbsenceMutation.isPending || uploading}
            >
              {(submitAbsenceMutation.isPending || uploading) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Time Correction Dialog */}
      <Dialog open={correctionDialogOpen} onOpenChange={setCorrectionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Solicitar Correção de Ponto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data</Label>
              <Input
                value={selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label>Tipo de Registro *</Label>
              <select
                value={correctionType}
                onChange={(e) => setCorrectionType(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
              >
                <option value="clock_in">Entrada</option>
                <option value="lunch_start">Início Almoço</option>
                <option value="lunch_end">Fim Almoço</option>
                <option value="clock_out">Saída</option>
              </select>
            </div>
            <div>
              <Label>Horário Correto *</Label>
              <Input
                type="time"
                value={correctedTime}
                onChange={(e) => setCorrectedTime(e.target.value)}
              />
            </div>
            <div>
              <Label>Motivo da Correção *</Label>
              <Textarea
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Descreva o motivo da correção..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => submitCorrectionMutation.mutate()}
              disabled={!correctedTime || !correctionReason || submitCorrectionMutation.isPending}
            >
              {submitCorrectionMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}