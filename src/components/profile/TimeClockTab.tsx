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
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateValue } from "@/utils/timeClockDates";
import {
  Clock,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar as CalendarIcon,
  Loader2,
} from "lucide-react";

// ---- Tipos alinhados 1:1 com o schema do banco ----

// public.lancamento_ponto
interface TimeEntry {
  id: string;
  user_id: string;
  data_entrada: string;
  entrada_hora: string | null;
  inicio_almoco: string | null;
  fim_almoco: string | null;
  saida_hora: string | null;
  horas_totais: number | null;
  status: string;
}

// public.justificativa_ausencia
interface AbsenceJustification {
  id: string;
  id_usuario: string;
  data_registro: string;
  justificativa: string;
  url_documento: string | null;
  status: string; // 'pendente' | 'aprovado' | 'rejeitado'
  motivo_rejeicao: string | null;
  criado_em: string;
}

// public.solicitacoes_correcao_ponto
interface TimeCorrectionRequest {
  id: string;
  user_id: string;
  data_entrada: string;
  lancamento_ponto_id: string | null;
  tipo_correcao: string; // 'entrada_hora' | 'inicio_almoco' | 'fim_almoco' | 'saida_hora'
  tempo_original: string | null;
  tempo_corrigido: string;
  justificativa: string;
  status: string; // 'pending' | 'approved' | 'rejected'
  motivo_rejeicao: string | null;
  criado_em: string;
}

const CORRECTION_TYPES = [
  { value: "entrada_hora", label: "Entrada" },
  { value: "inicio_almoco", label: "Início Almoço" },
  { value: "fim_almoco", label: "Fim Almoço" },
  { value: "saida_hora", label: "Saída" },
] as const;

export function TimeClockTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [justification, setJustification] = useState("");
  const [correctionType, setCorrectionType] = useState<string>("entrada_hora");
  const [correctedTime, setCorrectedTime] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const userId = user?.id;

  // Registros de ponto do mês (lancamento_ponto)
  const { data: timeEntries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["lancamento-ponto", userId, format(selectedMonth, "yyyy-MM")],
    queryFn: async () => {
      if (!userId) return [];
      const start = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
      const end = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("lancamento_ponto")
        .select("*")
        .eq("user_id", userId)
        .gte("data_entrada", start)
        .lte("data_entrada", end)
        .order("data_entrada", { ascending: true });

      if (error) throw error;
      return data as TimeEntry[];
    },
    enabled: !!userId,
  });

  // Justificativas de ausência (justificativa_ausencia)
  const { data: absenceJustifications = [] } = useQuery({
    queryKey: ["justificativa-ausencia", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("justificativa_ausencia")
        .select("*")
        .eq("id_usuario", userId)
        .order("criado_em", { ascending: false });

      if (error) throw error;
      return (data || []) as AbsenceJustification[];
    },
    enabled: !!userId,
  });

  // Solicitações de correção de ponto (solicitacoes_correcao_ponto)
  const { data: correctionRequests = [] } = useQuery({
    queryKey: ["solicitacoes-correcao-ponto", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("solicitacoes_correcao_ponto")
        .select("*")
        .eq("user_id", userId)
        .order("criado_em", { ascending: false });

      if (error) throw error;
      return (data || []) as TimeCorrectionRequest[];
    },
    enabled: !!userId,
  });

  const monthDays = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    return eachDayOfInterval({ start, end });
  }, [selectedMonth]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, TimeEntry>();
    timeEntries.forEach((entry) => map.set(entry.data_entrada, entry));
    return map;
  }, [timeEntries]);

  // Envio de justificativa de ausência
  const submitAbsenceMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !selectedDate) throw new Error("Dados inválidos");

      const dataRegistro = format(selectedDate, "yyyy-MM-dd");
      let documentUrl: string | null = null;

      if (documentFile) {
        setUploading(true);
        const fileName = `${userId}/${dataRegistro}-${Date.now()}.${documentFile.name.split(".").pop()}`;
        const { error: uploadError } = await supabase.storage
          .from("documents_colaborador")
          .upload(fileName, documentFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("documents_colaborador").getPublicUrl(fileName);
        documentUrl = urlData.publicUrl;

        // Registra o anexo também em lancamento_ponto_anexos, vinculando ao
        // lançamento do dia (se existir) para manter o histórico de documentos.
        const entry = entriesByDate.get(dataRegistro);
        const { error: anexoError } = await supabase.from("lancamento_ponto_anexos").insert({
          lancamento_ponto_id: entry?.id ?? null,
          user_id: userId,
          data_entrada: dataRegistro,
          caminho_arquivo: fileName,
          nome_arquivo: documentFile.name,
          tipo_arquivo: documentFile.type || null,
          tipo_justificativa: "medical",
          observacoes: justification,
        });
        if (anexoError) throw anexoError;

        setUploading(false);
      }

      const { error } = await supabase.from("justificativa_ausencia").insert({
        id_usuario: userId,
        data_registro: dataRegistro,
        justificativa: justification,
        url_documento: documentUrl,
        status: "pendente",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Justificativa enviada para aprovação!");
      setAbsenceDialogOpen(false);
      setJustification("");
      setDocumentFile(null);
      setSelectedDate(undefined);
      queryClient.invalidateQueries({ queryKey: ["justificativa-ausencia"] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar justificativa: ${error.message}`);
      setUploading(false);
    },
  });

  // Envio de solicitação de correção de ponto
  const submitCorrectionMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !selectedDate) throw new Error("Dados inválidos");

      const dataEntrada = format(selectedDate, "yyyy-MM-dd");
      const entry = entriesByDate.get(dataEntrada);
      const originalValue = entry ? (entry as any)[correctionType] : null;
      const originalTime = originalValue ? format(new Date(originalValue), "HH:mm") : null;

      const { error } = await supabase.from("solicitacoes_correcao_ponto").insert({
        user_id: userId,
        data_entrada: dataEntrada,
        lancamento_ponto_id: entry?.id ?? null,
        tipo_correcao: correctionType,
        tempo_original: originalTime,
        tempo_corrigido: correctedTime,
        justificativa: correctionReason,
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
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-correcao-ponto"] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar solicitação: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    const normalized = status.toLowerCase();
    if (["pending", "pendente"].includes(normalized)) {
      return (
        <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-600">
          Pendente
        </Badge>
      );
    }
    if (["approved", "aprovado"].includes(normalized)) {
      return (
        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-600">
          Aprovado
        </Badge>
      );
    }
    if (["rejected", "rejeitado"].includes(normalized)) {
      return (
        <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-600">
          Rejeitado
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const formatTime = (isoDate: string | null) => {
    if (!isoDate) return "-";
    const parsed = parseDateValue(isoDate);
    return parsed ? format(parsed, "HH:mm") : "-";
  };

  const getCorrectionTypeLabel = (type: string) =>
    CORRECTION_TYPES.find((t) => t.value === type)?.label ?? type;

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
                  hasEntry: (date) => entriesByDate.has(format(date, "yyyy-MM-dd")),
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
                            <span className="font-medium">{formatTime(entry.entrada_hora)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Início Almoço:</span>
                            <span className="font-medium">{formatTime(entry.inicio_almoco)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Fim Almoço:</span>
                            <span className="font-medium">{formatTime(entry.fim_almoco)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Saída:</span>
                            <span className="font-medium">{formatTime(entry.saida_hora)}</span>
                          </div>
                          <div className="col-span-2 flex justify-between border-t pt-2 mt-2">
                            <span className="text-muted-foreground">Total:</span>
                            <span className="font-semibold text-primary">{entry.horas_totais || 0}h</span>
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
                    }
                    return <p className="text-muted-foreground text-sm">Fim de semana</p>;
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
                  {monthDays
                    .filter((day) => !isWeekend(day))
                    .map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const entry = entriesByDate.get(dateStr);
                      const hasEntry = !!entry;

                      return (
                        <div
                          key={dateStr}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            hasEntry ? "bg-green-500/10 border-green-600/30" : "bg-red-500/10 border-red-600/30"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-center min-w-[50px]">
                              <p className="text-lg font-bold">{format(day, "dd")}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(day, "EEE", { locale: ptBR })}
                              </p>
                            </div>
                            {hasEntry ? (
                              <div className="flex items-center gap-4 text-sm">
                                <span>
                                  {formatTime(entry.entrada_hora)} - {formatTime(entry.saida_hora)}
                                </span>
                                <Badge variant="outline" className="bg-green-500/20 text-green-400">
                                  {entry.horas_totais || 0}h
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
                          <span className="font-medium">
                            {format(parseDateValue(item.data_registro) ?? new Date(), "dd/MM/yyyy")}
                          </span>
                          {getStatusBadge(item.status)}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.justificativa}</p>
                        {item.url_documento && (
                          <a
                            href={item.url_documento}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline mt-1 inline-block"
                          >
                            Ver documento anexo
                          </a>
                        )}
                        {item.motivo_rejeicao && (
                          <p className="text-xs text-red-400 mt-1">Motivo: {item.motivo_rejeicao}</p>
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
                          <span className="font-medium">
                            {format(parseDateValue(item.data_entrada) ?? new Date(), "dd/MM/yyyy")}
                          </span>
                          {getStatusBadge(item.status)}
                        </div>
                        <div className="text-sm space-y-1">
                          <p>
                            <span className="text-muted-foreground">Tipo:</span>{" "}
                            {getCorrectionTypeLabel(item.tipo_correcao)}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Horário correto:</span> {item.tempo_corrigido}
                          </p>
                          <p className="text-muted-foreground line-clamp-1">{item.justificativa}</p>
                          {item.motivo_rejeicao && (
                            <p className="text-xs text-red-400">Motivo: {item.motivo_rejeicao}</p>
                          )}
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

      {/* Dialog: Justificar Falta */}
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
              <Input value={selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""} disabled className="bg-muted" />
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

      {/* Dialog: Corrigir Ponto */}
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
              <Input value={selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Tipo de Registro *</Label>
              <select
                value={correctionType}
                onChange={(e) => setCorrectionType(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
              >
                {CORRECTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Horário Correto *</Label>
              <Input type="time" value={correctedTime} onChange={(e) => setCorrectedTime(e.target.value)} />
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
              {submitCorrectionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}