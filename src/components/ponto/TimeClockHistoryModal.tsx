import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Calendar,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Coffee,
  LogOut,
  Play,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { parseDateValue } from "@/utils/timeClockDates";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface TimeClockHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

const CORRECTION_TYPES = [
  { value: "entrada_hora", label: "Entrada" },
  { value: "inicio_almoco", label: "Início Almoço" },
  { value: "fim_almoco", label: "Fim Almoço" },
  { value: "saida_hora", label: "Saída" },
] as const;

export function TimeClockHistoryModal({ open, onOpenChange }: TimeClockHistoryModalProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [stats, setStats] = useState({
    totalHours: 0,
    workDays: 0,
    completedDays: 0,
  });

  // Ações do dia
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayAction, setDayAction] = useState<"none" | "absence" | "correction">("none");
  const [justification, setJustification] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [correctionType, setCorrectionType] = useState("entrada_hora");
  const [correctedTime, setCorrectedTime] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTimeEntries();
    }
  }, [open, selectedMonth]);

  const fetchTimeEntries = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);

      const { data, error } = await supabase
        .from("lancamento_ponto")
        .select("*")
        .eq("user_id", user.id)
        .gte("data_entrada", format(monthStart, "yyyy-MM-dd"))
        .lte("data_entrada", format(monthEnd, "yyyy-MM-dd"))
        .order("data_entrada", { ascending: false });

      if (error) throw error;

      const normalizedEntries = (data || []) as TimeEntry[];
      setEntries(normalizedEntries);
      calculateStats(normalizedEntries);
    } catch (error) {
      console.error("Error fetching time entries:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: TimeEntry[]) => {
    let totalHours = 0;
    let completedDays = 0;

    data.forEach((entry) => {
      if (entry.horas_totais) totalHours += entry.horas_totais;
      if (entry.status === "concluido") completedDays += 1;
    });

    setStats({ totalHours, workDays: data.length, completedDays });
  };

  const getEntryForDate = (date: Date): TimeEntry | undefined => {
    return entries.find((entry) => entry.data_entrada === format(date, "yyyy-MM-dd"));
  };

  const formatEntryDate = (value: string | Date | null | undefined) => {
    const parsed = parseDateValue(value);
    if (!parsed) return "";
    return format(parsed, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const formatEntryTime = (value: string | Date | null | undefined) => {
    const parsed = parseDateValue(value);
    if (!parsed) return "-";
    return format(parsed, "HH:mm");
  };

  const openDay = (date: Date) => {
    setSelectedDay(date);
    setDayAction("none");
    setJustification("");
    setDocumentFile(null);
    setCorrectionType("entrada_hora");
    setCorrectedTime("");
    setCorrectionReason("");
  };

  const submitAbsence = async () => {
    if (!selectedDay || !justification.trim()) {
      toast.error("Preencha a justificativa");
      return;
    }
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const dataRegistro = format(selectedDay, "yyyy-MM-dd");
      let documentUrl: string | null = null;

      if (documentFile) {
        const ext = documentFile.name.split(".").pop();
        const path = `${user.id}/${dataRegistro}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("documents_colaborador").upload(path, documentFile);
        if (upErr) throw upErr;
        documentUrl = supabase.storage.from("documents_colaborador").getPublicUrl(path).data.publicUrl;

        // guarda o anexo em lancamento_ponto_anexos, vinculado ao lançamento do dia (se existir)
        const entry = getEntryForDate(selectedDay);
        const { error: anexoError } = await supabase.from("lancamento_ponto_anexos").insert({
          lancamento_ponto_id: entry?.id ?? null,
          user_id: user.id,
          data_entrada: dataRegistro,
          caminho_arquivo: path,
          nome_arquivo: documentFile.name,
          tipo_arquivo: documentFile.type || null,
          tipo_justificativa: "medical",
          observacoes: justification,
        });
        if (anexoError) throw anexoError;
      }

      const { error } = await supabase.from("justificativa_ausencia").insert({
        id_usuario: user.id,
        data_registro: dataRegistro,
        justificativa: justification,
        url_documento: documentUrl,
        status: "pendente",
      });
      if (error) throw error;

      toast.success("Justificativa enviada para aprovação!");
      setSelectedDay(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar justificativa");
    } finally {
      setSubmitting(false);
    }
  };

  const submitCorrection = async () => {
    if (!selectedDay || !correctedTime || !correctionReason.trim()) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const entry = getEntryForDate(selectedDay);
      const original = entry?.[correctionType as keyof TimeEntry] as string | null | undefined;
      const originalTime = original ? format(new Date(original), "HH:mm") : null;

      const { error } = await supabase.from("solicitacoes_correcao_ponto").insert({
        user_id: user.id,
        data_entrada: format(selectedDay, "yyyy-MM-dd"),
        lancamento_ponto_id: entry?.id || null,
        tipo_correcao: correctionType,
        tempo_original: originalTime,
        tempo_corrigido: correctedTime,
        justificativa: correctionReason,
        status: "pending",
      });
      if (error) throw error;

      toast.success("Solicitação de correção enviada!");
      setSelectedDay(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar solicitação");
    } finally {
      setSubmitting(false);
    }
  };

  const previousMonth = () => setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1));
  const nextMonth = () => setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1));

  const renderCalendarView = () => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
    const firstDayOfWeek = monthStart.getDay();
    const emptyDays = Array(firstDayOfWeek).fill(null);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {dayNames.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
              {day}
            </div>
          ))}

          {emptyDays.map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {daysInMonth.map((date) => {
            const entry = getEntryForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={date.toISOString()}
                onClick={() => openDay(date)}
                className={cn(
                  "aspect-square p-2 rounded-lg border text-center flex flex-col items-center justify-center text-xs cursor-pointer transition-all hover:ring-2 hover:ring-primary/40",
                  isToday && "border-primary/50 bg-primary/10",
                  !entry && "border-border/50 bg-card-secondary/30",
                  entry && entry.status === "concluido" && "border-emerald-500/50 bg-emerald-500/10",
                  entry && entry.status === "not_started" && "border-amber-500/50 bg-amber-500/10",
                  entry && entry.status === "em_andamento" && "border-blue-500/50 bg-blue-500/10",
                  entry && entry.status === "falta" && "border-red-500/50 bg-red-500/10"
                )}
              >
                <span className="font-semibold text-white">{date.getDate()}</span>
                {entry && (
                  <div className="flex items-center gap-0.5 mt-1">
                    {entry.status === "concluido" && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                    {(entry.status === "not_started" || entry.status === "falta") && (
                      <AlertCircle className="h-3 w-3 text-amber-400" />
                    )}
                  </div>
                )}
                {entry && entry.horas_totais && (
                  <span className="text-[10px] text-muted-foreground mt-0.5">{entry.horas_totais.toFixed(1)}h</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderListView = () => {
    if (entries.length === 0) {
      return (
        <div className="text-center py-8">
          <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Nenhum registro para este período</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {entries.map((entry) => (
          <Card key={entry.id} className="bg-card-secondary/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-white">
                      {formatEntryDate(entry.data_entrada)}
                    </span>
                    <Badge
                      className={cn(
                        "ml-auto",
                        entry.status === "concluido" && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                        entry.status === "not_started" && "bg-amber-500/20 text-amber-400 border-amber-500/30",
                        entry.status === "em_andamento" && "bg-blue-500/20 text-blue-400 border-blue-500/30",
                        entry.status === "falta" && "bg-red-500/20 text-red-400 border-red-500/30"
                      )}
                    >
                      {entry.status === "concluido" && "Concluído"}
                      {entry.status === "not_started" && "Não iniciado"}
                      {entry.status === "em_andamento" && "Em andamento"}
                      {entry.status === "falta" && "Falta"}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    {entry.entrada_hora && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Play className="h-3 w-3 text-emerald-400" />
                          <span className="text-muted-foreground">Entrada:</span>
                          <span className="font-mono font-semibold text-white">
                            {formatEntryTime(entry.entrada_hora)}
                          </span>
                        </div>

                        {entry.inicio_almoco && (
                          <div className="flex items-center gap-1.5">
                            <Coffee className="h-3 w-3 text-amber-400" />
                            <span className="text-muted-foreground">Almoço:</span>
                            <span className="font-mono font-semibold text-white">
                              {formatEntryTime(entry.inicio_almoco)}
                            </span>
                          </div>
                        )}

                        {entry.fim_almoco && (
                          <div className="flex items-center gap-1.5">
                            <Play className="h-3 w-3 text-blue-400" />
                            <span className="text-muted-foreground">Retorno:</span>
                            <span className="font-mono font-semibold text-white">
                              {formatEntryTime(entry.fim_almoco)}
                            </span>
                          </div>
                        )}

                        {entry.saida_hora && (
                          <div className="flex items-center gap-1.5">
                            <LogOut className="h-3 w-3 text-red-400" />
                            <span className="text-muted-foreground">Saída:</span>
                            <span className="font-mono font-semibold text-white">
                              {formatEntryTime(entry.saida_hora)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {entry.horas_totais && (
                      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                        <Clock className="h-4 w-4 text-cyan-400" />
                        <span className="text-muted-foreground">Total de horas:</span>
                        <span className="font-mono font-semibold text-cyan-400">
                          {entry.horas_totais.toFixed(2)}h
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Clock className="h-5 w-5 text-cyan-400" />
            Histórico de Ponto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={previousMonth} className="border-border/50">
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="font-semibold text-white text-lg">
              {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>

            <Button variant="outline" size="sm" onClick={nextMonth} className="border-border/50">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-card-secondary/50 border-border/50">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Dias Trabalhados</div>
                <div className="text-2xl font-bold text-white">{stats.workDays}</div>
              </CardContent>
            </Card>

            <Card className="bg-card-secondary/50 border-border/50">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Dias Completos</div>
                <div className="text-2xl font-bold text-emerald-400">{stats.completedDays}</div>
              </CardContent>
            </Card>

            <Card className="bg-card-secondary/50 border-border/50">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Total de Horas</div>
                <div className="text-2xl font-bold text-cyan-400">{stats.totalHours.toFixed(1)}h</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <Button
              variant={viewMode === "calendar" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Calendário
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Lista
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <span className="ml-3 text-muted-foreground">Carregando...</span>
            </div>
          ) : viewMode === "calendar" ? (
            renderCalendarView()
          ) : (
            renderListView()
          )}

          <div className="flex gap-2 justify-end pt-4 border-t border-border/50">
            <Button variant="outline" size="sm" className="gap-2 border-border/50" disabled>
              <Download className="h-4 w-4" />
              Exportar PDF
            </Button>
            <Button variant="default" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Dialog de ação do dia */}
      <Dialog open={!!selectedDay} onOpenChange={(v) => !v && setSelectedDay(null)}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedDay ? format(selectedDay, "EEEE, dd/MM/yyyy", { locale: ptBR }) : ""}
            </DialogTitle>
          </DialogHeader>

          {dayAction === "none" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">O que deseja fazer neste dia?</p>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  className="justify-start gap-2 border-border/50"
                  onClick={() => setDayAction("absence")}
                >
                  <FileText className="h-4 w-4" /> Justificar falta (enviar atestado)
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-2 border-border/50"
                  onClick={() => setDayAction("correction")}
                >
                  <Clock className="h-4 w-4" /> Solicitar ajuste de ponto
                </Button>
              </div>
            </div>
          )}

          {dayAction === "absence" && (
            <div className="space-y-3">
              <div>
                <Label className="text-muted-foreground">Justificativa *</Label>
                <Textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Descreva o motivo da falta..."
                  rows={4}
                  className="bg-card-secondary border-border text-white"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Atestado / documento</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                  className="bg-card-secondary border-border text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDayAction("none")} className="border-border/50">
                  Voltar
                </Button>
                <Button onClick={submitAbsence} disabled={submitting || !justification.trim()}>
                  {submitting ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          )}

          {dayAction === "correction" && (
            <div className="space-y-3">
              <div>
                <Label className="text-muted-foreground">Tipo de Registro *</Label>
                <select
                  value={correctionType}
                  onChange={(e) => setCorrectionType(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-border bg-card-secondary text-white"
                >
                  {CORRECTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-muted-foreground">Horário Correto *</Label>
                <Input
                  type="time"
                  value={correctedTime}
                  onChange={(e) => setCorrectedTime(e.target.value)}
                  className="bg-card-secondary border-border text-white"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Motivo *</Label>
                <Textarea
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="Descreva o motivo da correção..."
                  rows={3}
                  className="bg-card-secondary border-border text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDayAction("none")} className="border-border/50">
                  Voltar
                </Button>
                <Button onClick={submitCorrection} disabled={submitting || !correctedTime || !correctionReason.trim()}>
                  {submitting ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}