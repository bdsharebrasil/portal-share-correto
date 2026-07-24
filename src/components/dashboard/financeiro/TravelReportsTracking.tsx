// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Send,
  Copy,
  RefreshCw,
  FileText,
  Search,
} from "lucide-react";

type Report = any;

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: any; group: string }
> = {
  aguardando_aprovacao_tripulante: {
    label: "Aguardando tripulante",
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    icon: Clock,
    group: "aguardando",
  },
  em_revisao: {
    label: "Em revisão",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: AlertTriangle,
    group: "revisao",
  },
  aprovado_tripulante: {
    label: "Pronto para cliente",
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
    group: "pronto",
  },
  enviado_cliente: {
    label: "Enviado ao cliente",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: Send,
    group: "enviado",
  },
};

const TRACKED_STATUSES = Object.keys(STATUS_META);
const SOURCE_STATUSES = [...TRACKED_STATUSES, "Finalizado", "Enviado"];

const isAwaitingCrewApproval = (report: Report) =>
  (report.status === "Finalizado" || report.status === "Enviado") &&
  report.crew_approval_status === "pending" &&
  Boolean(report.approval_token);

export default function TravelReportsTracking() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("todos");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("travel_expense_reports")
        .select(
          "id, numero_relatorio, nome_tripulante, nome_tripulante_2, matricula_aeronave, total_valor, total_trip, total_trip2, status, crew_approval_status, crew_approval_notes, crew_approved_at, enviado_tripulante_em, enviado_cliente_em, approval_token, clientes_id, clientes_id_rel:clientes_id(razao_social), created_at"
        )
        .in("status", SOURCE_STATUSES)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setReports(
        (data || [])
          .filter(
            (report) =>
              TRACKED_STATUSES.includes(report.status) ||
              isAwaitingCrewApproval(report)
          )
          .map((report) =>
            isAwaitingCrewApproval(report)
              ? { ...report, status: "aguardando_aprovacao_tripulante" }
              : report
          )
      );
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (filter !== "todos" && r.status !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.numero_relatorio?.toLowerCase().includes(q) ||
        r.nome_tripulante?.toLowerCase().includes(q) ||
        r.nome_tripulante_2?.toLowerCase().includes(q) ||
        r.matricula_aeronave?.toLowerCase().includes(q) ||
        r.clientes_id_rel?.razao_social?.toLowerCase().includes(q)
      );
    });
  }, [reports, search, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of TRACKED_STATUSES) c[s] = 0;
    reports.forEach((r) => {
      if (c[r.status] !== undefined) c[r.status]++;
    });
    return c;
  }, [reports]);

  const buildLink = (token: string) =>
    `${window.location.origin}/#/aprovar-relatorio/${token}`;

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(buildLink(token));
    toast.success("Link copiado!");
  };

  const resendToCrew = async (report: Report) => {
    try {
      const { error } = await supabase
        .from("travel_expense_reports")
        .update({
          status: "aguardando_aprovacao_tripulante",
          crew_approval_status: "pending",
          enviado_tripulante_em: new Date().toISOString(),
        })
        .eq("id", report.id);
      if (error) throw error;
      toast.success("Relatório reenviado ao tripulante");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao reenviar");
    }
  };

  const sendToClient = async (report: Report) => {
    try {
      const { error } = await supabase
        .from("travel_expense_reports")
        .update({
          status: "enviado_cliente",
          enviado_cliente_em: new Date().toISOString(),
        })
        .eq("id", report.id);
      if (error) throw error;
      toast.success("Relatório marcado como enviado ao cliente");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao marcar envio");
    }
  };

  return (
    <div className="space-y-4">
      {/* Cards de contagem por status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TRACKED_STATUSES.map((s) => {
          const meta = STATUS_META[s];
          const Icon = meta.icon;
          return (
            <Card
              key={s}
              className={`bg-card border-border cursor-pointer transition ${
                filter === s ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setFilter(filter === s ? "todos" : s)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {counts[s]}
                  </p>
                </div>
                <Icon className="w-7 h-7 text-muted-foreground/40" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Busca + reload */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, tripulante, aeronave ou cliente..."
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* Lista */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <FileText className="w-5 h-5" />
            Relatórios de Viagem em fluxo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              Nenhum relatório neste status.
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => {
                const meta = STATUS_META[r.status] || {
                  label: r.status,
                  color: "bg-muted text-muted-foreground",
                  icon: FileText,
                };
                const borderColor =
                  r.status === "em_revisao"
                    ? "border-l-red-500"
                    : r.status === "aprovado_tripulante"
                    ? "border-l-emerald-500"
                    : r.status === "enviado_cliente"
                    ? "border-l-blue-500"
                    : "border-l-amber-500";
                return (
                  <div
                    key={r.id}
                    className={`p-4 rounded-lg bg-muted/30 border-l-4 ${borderColor}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground truncate">
                            {r.numero_relatorio}
                          </h3>
                          <Badge className={meta.color}>{meta.label}</Badge>
                          {r.crew_approval_status === "approved" && (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Trip confirmou
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {r.clientes_id_rel?.razao_social || "—"} ·{" "}
                          {r.matricula_aeronave || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Tripulantes: {r.nome_tripulante}
                          {r.nome_tripulante_2 ? ` + ${r.nome_tripulante_2}` : ""}
                          {" · "}
                          Enviado ao trip:{" "}
                          {r.enviado_tripulante_em
                            ? format(new Date(r.enviado_tripulante_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "—"}
                        </p>
                        {r.status === "aguardando_aprovacao_tripulante" && (
                          <p className="mt-1 text-xs font-medium text-amber-400">
                            Link enviado para o tripulante {r.nome_tripulante}; aguardando aprovação.
                          </p>
                        )}
                        {r.status === "em_revisao" && r.crew_approval_notes && (
                          <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                            <strong>Justificativa do tripulante:</strong>{" "}
                            {r.crew_approval_notes}
                          </div>
                        )}
                        {r.approval_token && (
                          <div className="mt-2 flex items-center gap-2 p-2 rounded bg-background/50 border border-border">
                            <span className="text-xs text-muted-foreground shrink-0">Link do tripulante:</span>
                            <a
                              href={buildLink(r.approval_token)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary underline truncate flex-1"
                            >
                              {buildLink(r.approval_token)}
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="font-bold text-lg text-foreground">
                          R${" "}
                          {Number(r.total_valor || 0).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                        <div className="flex flex-wrap gap-2 justify-end">
                          {r.approval_token && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyLink(r.approval_token)}
                            >
                              <Copy className="w-4 h-4 mr-1" /> Copiar link
                            </Button>
                          )}
                          {(r.status === "em_revisao" ||
                            r.status === "aguardando_aprovacao_tripulante") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resendToCrew(r)}
                            >
                              <RefreshCw className="w-4 h-4 mr-1" /> Reenviar ao trip
                            </Button>
                          )}
                          {r.status === "aprovado_tripulante" && (
                            <Button
                              size="sm"
                              onClick={() => sendToClient(r)}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <Send className="w-4 h-4 mr-1" /> Enviar ao cliente
                            </Button>
                          )}
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
    </div>
  );
}
