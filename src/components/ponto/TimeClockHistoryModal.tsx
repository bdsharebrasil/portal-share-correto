// @ts-nocheck
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { normalizeTimeEntry, type NormalizedTimeEntry } from "./timeClockHistoryUtils";

interface TimeClockHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TimeEntry extends NormalizedTimeEntry {}

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

  // Day action dialogs
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

      const { data, error } = await (supabase as any)
        .from("lancamento_ponto")
        .select("*")
        .eq("user_id", user.id)
        .gte("data_entrada", format(monthStart, "yyyy-MM-dd"))
        .lte("data_entrada", format(monthEnd, "yyyy-MM-dd"))
        .order("data_entrada", { ascending: false });

      if (error) throw error;

      const normalizedEntries = (data || []).map(normalizeTimeEntry) as TimeEntry[];
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
      if (entry.horas_totais) {
        totalHours += entry.horas_totais;
      }
      if (entry.status === "concluido") {
        completedDays += 1;
      }
    });

    setStats({
      totalHours,
      workDays: data.length,
      completedDays,
    });
  };

  const getEntryForDate = (date: Date): TimeEntry | undefined => {
    return entries.find((entry) => entry.date === format(date, "yyyy-MM-dd"));
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      let documentUrl: string | null = null;
      if (documentFile) {
        const ext = documentFile.name.split(".").pop();
        const path = `${user.id}/${format(selectedDay, "yyyy-MM-dd")}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("documents_colaborador")
          .upload(path, documentFile);
        if (upErr) throw upErr;
        documentUrl = supabase.storage.from("documents_colaborador").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await (supabase as any).from("absence_justifications").insert({
        user_id: user.id,
        entry_date: format(selectedDay, "yyyy-MM-dd"),
        justification,
        document_url: documentUrl,
        status: "pending",
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const entry = getEntryForDate(selectedDay);
      const original = entry?.[correctionType as keyof TimeEntry] as string | null | undefined;
      const originalTime = original ? format(new Date(original), "HH:mm") : null;
      const { error } = await (supabase as any).from("solicitacoes_correcao_ponto").insert({
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

  const previousMonth = () => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const nextMonth = () => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

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
            <div key={day} className="text-center text-xs font-semibold text-slate-400 py-2">
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
                  !entry && "border-slate-700/50 bg-slate-800/30",
                  entry && entry.status === "concluido" && "border-emerald-500/50 bg-emerald-500/10",
                  entry && entry.status === "incompleto" && "border-amber-500/50 bg-amber-500/10",
                  entry && entry.status === "ativo" && "border-blue-500/50 bg-blue-500/10"
                )}
              >
                <span className="font-semibold text-white">{date.getDate()}</span>
                {entry && (
                  <div className="flex items-center gap-0.5 mt-1">
                    {entry.status === "concluido" && (
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    )}
                    {entry.status === "incompleto" && (
                      <AlertCircle className="h-3 w-3 text-amber-400" />
                    )}
                  </div>
                )}
                {entry && entry.horas_totais && (
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    {entry.horas_totais.toFixed(1)}h
                  </span>
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
          <Clock className="h-12 w-12 mx-auto mb-3 text-slate-500 opacity-50" />
          <p className="text-slate-400">Nenhum registro para este período</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {entries.map((entry) => (
          <Card key={entry.id} className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold text-white">
                      {format(new Date(entry.date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                    <Badge
                      className={cn(
                        "ml-auto",
                        entry.status === "concluido" &&
                          "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                        entry.status === "incompleto" &&
                          "bg-amber-500/20 text-amber-400 border-amber-500/30",
                        entry.status === "ativo" && "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      )}
                    >
                      {entry.status === "concluido" && "Concluído"}
                      {entry.status === "incompleto" && "Incompleto"}
                      {entry.status === "ativo" && "Em andamento"}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    {entry.entrada_hora && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Play className="h-3 w-3 text-emerald-400" />
                          <span className="text-slate-400">Entrada:</span>
                          <span className="font-mono font-semibold text-white">
                            {format(new Date(entry.entrada_hora), "HH:mm")}
                          </span>
                        </div>

                        {entry.inicio_almoco && (
                          <div className="flex items-center gap-1.5">
                            <Coffee className="h-3 w-3 text-amber-400" />
                            <span className="text-slate-400">Almoço:</span>
                            <span className="font-mono font-semibold text-white">
                              {format(new Date(entry.inicio_almoco), "HH:mm")}
                            </span>
                          </div>
                        )}

                        {entry.fim_almoco && (
                          <div className="flex items-center gap-1.5">
                            <Play className="h-3 w-3 text-blue-400" />
                            <span className="text-slate-400">Retorno:</span>
                            <span className="font-mono font-semibold text-white">
                              {format(new Date(entry.fim_almoco), "HH:mm")}
                            </span>
                          </div>
                        )}

                        {entry.saida_hora && (
                          <div className="flex items-center gap-1.5">
                            <LogOut className="h-3 w-3 text-red-400" />
                            <span className="text-slate-400">Saída:</span>
                            <span className="font-mono font-semibold text-white">
                              {format(new Date(entry.saida_hora), "HH:mm")}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {entry.horas_totais && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
                        <Clock className="h-4 w-4 text-cyan-400" />
                        <span className="text-slate-400">Total de horas:</span>
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Clock className="h-5 w-5 text-cyan-400" />
            Histórico de Ponto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={previousMonth}
              className="border-slate-700/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="font-semibold text-white text-lg">
              {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={nextMonth}
              className="border-slate-700/50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="text-xs text-slate-400 mb-1">Dias Trabalhados</div>
                <div className="text-2xl font-bold text-white">{stats.workDays}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="text-xs text-slate-400 mb-1">Dias Completos</div>
                <div className="text-2xl font-bold text-emerald-400">{stats.completedDays}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="text-xs text-slate-400 mb-1">Total de Horas</div>
                <div className="text-2xl font-bold text-cyan-400">
                  {stats.totalHours.toFixed(1)}h
                </div>
              </CardContent>
            </Card>
          </div>

          {/* View Mode Tabs */}
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

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin">
                <Clock className="h-8 w-8 text-slate-500" />
              </div>
              <span className="ml-3 text-slate-400">Carregando...</span>
            </div>
          ) : viewMode === "calendar" ? (
            renderCalendarView()
          ) : (
            renderListView()
          )}

          {/* Footer Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-slate-700/50">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-slate-700/50"
              disabled
            >
              <Download className="h-4 w-4" />
              Exportar PDF
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Day action dialog */}
      <Dialog open={!!selectedDay} onOpenChange={(v) => !v && setSelectedDay(null)}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-700/50">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedDay ? format(selectedDay, "EEEE, dd/MM/yyyy", { locale: ptBR }) : ""}
            </DialogTitle>
          </DialogHeader>

          {dayAction === "none" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">O que deseja fazer neste dia?</p>
              <div className="grid grid-cols-1 gap-2">
                <Button variant="outline" className="justify-start gap-2 border-slate-700/50" onClick={() => setDayAction("absence")}>
                  <FileText className="h-4 w-4" /> Justificar falta (enviar atestado)
                </Button>
                <Button variant="outline" className="justify-start gap-2 border-slate-700/50" onClick={() => setDayAction("correction")}>
                  <Clock className="h-4 w-4" /> Solicitar ajuste de ponto
                </Button>
              </div>
            </div>
          )}

          {dayAction === "absence" && (
            <div className="space-y-3">
              <div>
                <Label className="text-slate-300">Justificativa *</Label>
                <Textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Descreva o motivo da falta..."
                  rows={4}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Atestado / documento</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDayAction("none")} className="border-slate-700/50">Voltar</Button>
                <Button onClick={submitAbsence} disabled={submitting || !justification.trim()}>
                  {submitting ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          )}

          {dayAction === "correction" && (
            <div className="space-y-3">
              <div>
                <Label className="text-slate-300">Tipo de Registro *</Label>
                <select
                  value={correctionType}
                  onChange={(e) => setCorrectionType(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-700 bg-slate-800 text-white"
                >
                  <option value="entrada_hora">Entrada</option>
                  <option value="inicio_almoco">Início Almoço</option>
                  <option value="fim_almoco">Fim Almoço</option>
                  <option value="saida_hora">Saída</option>
                </select>
              </div>
              <div>
                <Label className="text-slate-300">Horário Correto *</Label>
                <Input
                  type="time"
                  value={correctedTime}
                  onChange={(e) => setCorrectedTime(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Motivo *</Label>
                <Textarea
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="Descreva o motivo da correção..."
                  rows={3}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDayAction("none")} className="border-slate-700/50">Voltar</Button>
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
