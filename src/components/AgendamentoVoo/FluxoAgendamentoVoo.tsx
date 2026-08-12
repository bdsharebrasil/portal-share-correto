import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Hash,
  UserCheck,
} from "lucide-react";
import { InlineLottieSpinner } from "@/components/ui/inline-lottie-spinner";
import { format, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/components/ui/use-toast";

type StatusFilter = "pendente" | "confirmado" | "all";

interface Solicitacao {
  id: string;
  cliente_id: string | null;
  aeronave_id: string | null;
  origem: string | null;
  destino: string | null;
  data_agendada: string;
  horario_previsto_agendamento: string | null;
  dias_duracao: number | null;
  qtd_passageiros: number | null;
  status: string;
  observacoes: string | null;
  motivo_rejeicao: string | null;
  numero_voo: string | null;
  ciclo_voo_id: string | null;
  piloto_id: string | null;
  copiloto_id: string | null;
  criado_em: string;
  cliente?: { id: string; razao_social: string | null; codigo_cliente: string | null } | null;
  aeronave?: { id: string; matricula: string | null; modelo: string | null } | null;
}

const statusStyles: Record<string, string> = {
  pendente: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  confirmado: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  em_voo: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  rejeitado: "bg-red-500/15 text-red-400 border-red-500/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return d;
  }
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value ?? "—"}</p>
    </div>
  );
}

export function FluxoAgendamentoVoo() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("pendente");
  const [selected, setSelected] = useState<Solicitacao | null>(null);
  const [pilotoId, setPilotoId] = useState("");
  const [copilotoId, setCopilotoId] = useState("");
  const [obsEscala, setObsEscala] = useState("");
  const [rejectMode, setRejectMode] = useState(false);
  const [motivo, setMotivo] = useState("");

  const { data: solicitacoes, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["solicitacoes-reserva-voo", filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("solicitacoes_reserva_voo")
        .select(
          `*, cliente:cliente_id(id, razao_social, codigo_cliente), aeronave:aeronave_id(id, matricula, modelo)`
        )
        .order("data_agendada", { ascending: true });

      if (filterStatus !== "all") query = query.eq("status", filterStatus);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Solicitacao[];
    },
  });

  const { data: tripulantes } = useQuery({
    queryKey: ["membros-tripulacao-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membros_tripulacao")
        .select("id, nome_completo, canac")
        .eq("status", "ativo")
        .order("nome_completo");
      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const list = solicitacoes || [];
    return {
      total: list.length,
      pendentes: list.filter((s) => s.status === "pendente").length,
      confirmados: list.filter((s) => s.status === "confirmado").length,
    };
  }, [solicitacoes]);

  const openRequest = (s: Solicitacao) => {
    setSelected(s);
    setPilotoId(s.piloto_id || "");
    setCopilotoId(s.copiloto_id || "");
    setObsEscala("");
    setMotivo("");
    setRejectMode(false);
  };

  const nomeTripulante = (id: string) =>
    (tripulantes || []).find((t: any) => t.id === id)?.nome_completo || null;

  // Fluxo único: escalar tripulação -> confirmar -> gerar número -> criar ciclo de voo
  const confirmMutation = useMutation({
    mutationFn: async (s: Solicitacao) => {
      if (!pilotoId) throw new Error("Escale ao menos o piloto em comando (PIC) antes de confirmar.");

      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;

      // 1) Número do voo = código do cliente + sequência + ano
      const { data: numeroVoo, error: numeroError } = await supabase.rpc("gerar_numero_voo", {
        p_cliente_id: s.cliente_id,
      });
      if (numeroError) throw numeroError;

      const dias = s.dias_duracao || 1;
      const tipoVoo = dias <= 1 ? "ida" : dias === 2 ? "ida_volta" : "pernoite";
      const dataRetorno =
        dias <= 1 ? null : format(addDays(parseISO(s.data_agendada), dias - 1), "yyyy-MM-dd");

      // 2) Criar ciclo de voo com o mesmo número
      const { data: ciclo, error: cicloError } = await supabase
        .from("ciclos_voo")
        .insert({
          numero_voo: numeroVoo as string,
          cliente_id: s.cliente_id,
          aeronave_id: s.aeronave_id,
          icao_origem: s.origem || "N/A",
          icao_destino: s.destino || "N/A",
          data_voo: s.data_agendada,
          data_retorno: dataRetorno,
          tipo_voo: tipoVoo,
          pernoite: dias > 1,
          status: "confirmado",
          responsavel_id: userId,
          observacoes: s.observacoes,
          nome_pic: nomeTripulante(pilotoId),
          nome_sic: copilotoId ? nomeTripulante(copilotoId) : null,
        })
        .select("id, numero_voo")
        .single();
      if (cicloError) throw cicloError;

      // 3) Confirmar a solicitação com o número e o ciclo
      const { error: updError } = await supabase
        .from("solicitacoes_reserva_voo")
        .update({
          status: "confirmado",
          numero_voo: numeroVoo as string,
          ciclo_voo_id: ciclo.id,
          piloto_id: pilotoId,
          copiloto_id: copilotoId || null,
          aprovado_por: userId,
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", s.id);
      if (updError) throw updError;

      // 4) Escala da tripulação com os dados do agendamento
      const dataFim = format(addDays(parseISO(s.data_agendada), Math.max(dias - 1, 0)), "yyyy-MM-dd");
      const escalas = [
        { membro_id: pilotoId, funcao: "PIC" },
        ...(copilotoId ? [{ membro_id: copilotoId, funcao: "SIC" }] : []),
      ].map((e) => ({
        ...e,
        aeronave_id: s.aeronave_id,
        solicitacao_id: s.id,
        data_inicio: s.data_agendada,
        data_fim: dataFim,
        status: "escalado",
        observacoes: obsEscala || `Voo ${numeroVoo} • ${s.origem} → ${s.destino}`,
        criado_por: userId,
      }));

      const { error: escalaError } = await supabase.from("escala_tripulacao").insert(escalas);
      if (escalaError) throw escalaError;

      return numeroVoo as string;
    },
    onSuccess: (numeroVoo) => {
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-reserva-voo"] });
      queryClient.invalidateQueries({ queryKey: ["flight-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["escala-tripulacao"] });
      toast({
        title: `Voo ${numeroVoo} confirmado`,
        description: "Tripulação escalada e ciclo de voo criado com o mesmo número.",
      });
      setSelected(null);
    },
    onError: (e: any) =>
      toast({ title: "Erro ao confirmar", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (s: Solicitacao) => {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
      const { error } = await supabase
        .from("solicitacoes_reserva_voo")
        .update({
          status: "rejeitado",
          motivo_rejeicao: motivo,
          aprovado_por: userId,
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-reserva-voo"] });
      toast({ title: "Solicitação rejeitada" });
      setSelected(null);
    },
    onError: (e: any) =>
      toast({ title: "Erro ao rejeitar", description: e.message, variant: "destructive" }),
  });

  const busy = confirmMutation.isPending || rejectMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Solicitações de Voo</h2>
          <p className="text-sm text-muted-foreground">
            Abra a solicitação, escale a tripulação e confirme — o número do voo e o ciclo são gerados
            automaticamente.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isRefetching} className="gap-2">
          {isRefetching ? <InlineLottieSpinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pendente", `Pendentes (${stats.pendentes})`],
            ["confirmado", `Confirmados (${stats.confirmados})`],
            ["all", "Todas"],
          ] as [StatusFilter, string][]
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={filterStatus === value ? "default" : "outline"}
            onClick={() => setFilterStatus(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Card className="bg-card border-border">
          <CardContent className="flex items-center justify-center gap-3 py-12">
            <InlineLottieSpinner size="md" />
            <p className="text-muted-foreground">Carregando solicitações...</p>
          </CardContent>
        </Card>
      ) : (solicitacoes || []).length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Plane className="mx-auto mb-3 h-10 w-10 opacity-40" />
            Nenhuma solicitação encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(solicitacoes || []).map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer border-border bg-card transition hover:border-primary/40"
              onClick={() => openRequest(s)}
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {s.cliente?.razao_social || "Cliente"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.aeronave?.matricula || "—"} • {s.aeronave?.modelo || ""}
                    </p>
                  </div>
                  <Badge variant="outline" className={statusStyles[s.status] || ""}>
                    {s.status}
                  </Badge>
                </div>

                {s.numero_voo && (
                  <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5">
                    <Hash className="h-3.5 w-3.5 text-primary" />
                    <span className="font-mono text-sm font-semibold text-primary">{s.numero_voo}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {s.origem} → {s.destino}
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {fmtDate(s.data_agendada)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {s.horario_previsto_agendamento?.slice(0, 5) || "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {s.qtd_passageiros ?? 0} pax
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plane className="h-5 w-5 text-primary" />
                  Solicitação de voo
                  {selected.numero_voo && (
                    <span className="ml-2 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-sm text-primary">
                      {selected.numero_voo}
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription>
                  Confira todos os dados, escale a tripulação e confirme o voo.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Info icon={Users} label="Cliente" value={selected.cliente?.razao_social} />
                <Info icon={Hash} label="Código cliente" value={selected.cliente?.codigo_cliente} />
                <Info
                  icon={Plane}
                  label="Aeronave"
                  value={`${selected.aeronave?.matricula || "—"}${
                    selected.aeronave?.modelo ? ` • ${selected.aeronave.modelo}` : ""
                  }`}
                />
                <Info icon={MapPin} label="Origem" value={selected.origem} />
                <Info icon={MapPin} label="Destino" value={selected.destino} />
                <Info icon={CalendarIcon} label="Data" value={fmtDate(selected.data_agendada)} />
                <Info
                  icon={Clock}
                  label="Horário previsto"
                  value={selected.horario_previsto_agendamento?.slice(0, 5)}
                />
                <Info icon={CalendarIcon} label="Duração" value={`${selected.dias_duracao || 1} dia(s)`} />
                <Info icon={Users} label="Passageiros" value={selected.qtd_passageiros ?? 0} />
              </div>

              {selected.observacoes && (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Observações</p>
                  <p className="mt-1 text-sm text-foreground">{selected.observacoes}</p>
                </div>
              )}

              {selected.status === "pendente" && !rejectMode && (
                <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <UserCheck className="h-4 w-4 text-primary" />
                    Escala da tripulação (obrigatória para confirmar)
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Piloto em comando (PIC) *</Label>
                      <Select value={pilotoId} onValueChange={setPilotoId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o PIC" />
                        </SelectTrigger>
                        <SelectContent>
                          {(tripulantes || []).map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.nome_completo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Copiloto (SIC)</Label>
                      <Select value={copilotoId} onValueChange={setCopilotoId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o SIC" />
                        </SelectTrigger>
                        <SelectContent>
                          {(tripulantes || [])
                            .filter((t: any) => t.id !== pilotoId)
                            .map((t: any) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.nome_completo}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Observações da escala</Label>
                    <Textarea
                      value={obsEscala}
                      onChange={(e) => setObsEscala(e.target.value)}
                      placeholder="Instruções para a tripulação (opcional)"
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {selected.status !== "pendente" && (
                <div className="grid grid-cols-2 gap-3">
                  <Info
                    icon={UserCheck}
                    label="PIC"
                    value={selected.piloto_id ? nomeTripulante(selected.piloto_id) : "—"}
                  />
                  <Info
                    icon={UserCheck}
                    label="SIC"
                    value={selected.copiloto_id ? nomeTripulante(selected.copiloto_id) : "—"}
                  />
                </div>
              )}

              {rejectMode && (
                <div className="space-y-1.5">
                  <Label>Motivo da rejeição *</Label>
                  <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
                </div>
              )}

              <DialogFooter className="gap-2">
                {selected.status === "pendente" ? (
                  rejectMode ? (
                    <>
                      <Button variant="outline" onClick={() => setRejectMode(false)} disabled={busy}>
                        Voltar
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={busy || !motivo.trim()}
                        onClick={() => rejectMutation.mutate(selected)}
                        className="gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        Confirmar rejeição
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setRejectMode(true)} disabled={busy}>
                        Rejeitar
                      </Button>
                      <Button
                        disabled={busy || !pilotoId}
                        onClick={() => confirmMutation.mutate(selected)}
                        className="gap-2"
                      >
                        {confirmMutation.isPending ? (
                          <InlineLottieSpinner size="sm" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Confirmar voo e gerar número
                      </Button>
                    </>
                  )
                ) : (
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    Fechar
                  </Button>
                )}
              </DialogFooter>

              {selected.status === "pendente" && !pilotoId && !rejectMode && (
                <p className="flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Escale a tripulação antes de confirmar o voo.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FluxoAgendamentoVoo;
