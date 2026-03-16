import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Wrench, Package, Users, DollarSign, Droplets } from "lucide-react";
import { useAircraftMaintenances, useMaintenanceReport } from "@/hooks/useMaintenanceExpenses";
import { cn } from "@/lib/utils";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    // Se for apenas data (YYYY-MM-DD), exibir diretamente para evitar problemas de timezone
    if (d.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = d.split("-");
      return `${day}/${month}/${year}`;
    }
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

interface MaintenanceReportDialogProps {
  aircraftId: string | null;
  clienteId: string;
}

export function MaintenanceReportDialog({ aircraftId, clienteId }: MaintenanceReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  const { data: manutencoes = [] } = useAircraftMaintenances(aircraftId);
  const { data: report, isLoading } = useMaintenanceReport(selectedId || null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 h-10 rounded-xl border-border/60 text-sm"
        >
          <Wrench className="h-4 w-4" />
          Relatório de Manutenção
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] p-0 rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5 text-primary" />
            Relatório Completo de Manutenção
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 border-b border-border/30">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="h-11 rounded-xl border-border/60 text-sm">
              <SelectValue placeholder="Selecione uma manutenção para visualizar..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {manutencoes.map((m) => (
                <SelectItem key={m.id} value={m.id} className="py-3">
                  <div className="text-sm">
                    <span className="font-medium">{m.tipo}</span>
                    {m.numero_os && <span className="text-muted-foreground ml-2">({m.numero_os})</span>}
                    <span className="text-muted-foreground ml-2">
                      {fmtDate(m.data_programada)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="p-6 space-y-6">
            {!selectedId && (
              <div className="text-center py-12 text-muted-foreground">
                <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione uma manutenção para ver o relatório completo</p>
              </div>
            )}

            {isLoading && selectedId && (
              <div className="text-center py-12 text-muted-foreground">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm">Carregando relatório...</p>
              </div>
            )}

            {report && (
              <>
                {/* Header */}
                <div className="rounded-xl bg-muted/40 border border-border/40 p-5">
                  <h3 className="text-lg font-bold text-foreground mb-3">
                    {report.manutencao.tipo}
                    {report.manutencao.numero_os && (
                      <span className="text-muted-foreground font-normal ml-2">
                        — OS {report.manutencao.numero_os}
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Aeronave</p>
                      <p className="font-medium">{report.aircraft?.registration || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Iniciada em</p>
                      <p className="font-medium">{fmtDate(report.manutencao.data_programada)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Etapa</p>
                      <p className="font-medium">{formatStatus(report.manutencao.etapa)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Oficina</p>
                      <p className="font-medium">{report.manutencao.oficina || "—"}</p>
                    </div>
                  </div>
                  {report.manutencao.observacoes && (
                    <p className="text-sm text-muted-foreground mt-3 border-t border-border/30 pt-3">
                      {report.manutencao.observacoes}
                    </p>
                  )}
                </div>

                {/* Totais */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Peças", value: report.totals.totalParts, icon: Package },
                    { label: "Serviços", value: report.totals.totalServices, icon: Wrench },
                    { label: "Despesas", value: report.totals.totalDespesas, icon: DollarSign },
                    { label: "Total Geral", value: report.totals.grandTotal, icon: FileText },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-muted/30 border border-border/30 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                      </div>
                      <p className="text-lg font-bold text-foreground">{fmt(item.value)}</p>
                    </div>
                  ))}
                </div>

                {/* Peças (ctm_parts) */}
                {report.parts.length > 0 && (
                  <ReportSection title="Peças" icon={Package}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b border-border/30">
                          <th className="text-left py-2 px-2">Descrição</th>
                          <th className="text-left py-2 px-2">P/N</th>
                          <th className="text-right py-2 px-2">Qtd</th>
                          <th className="text-right py-2 px-2">Valor Unit.</th>
                          <th className="text-right py-2 px-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.parts.map((p: any) => (
                          <tr key={p.id} className="border-b border-border/20">
                            <td className="py-2 px-2">{p.descricao}</td>
                            <td className="py-2 px-2 text-muted-foreground">{p.part_number || "—"}</td>
                            <td className="py-2 px-2 text-right">{p.quantidade || 1}</td>
                            <td className="py-2 px-2 text-right">{fmt(p.valor_unitario || 0)}</td>
                            <td className="py-2 px-2 text-right font-medium">{fmt(p.valor_total || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ReportSection>
                )}

                {/* Serviços (ctm_services) */}
                {report.services.length > 0 && (
                  <ReportSection title="Serviços" icon={Wrench}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b border-border/30">
                          <th className="text-left py-2 px-2">Descrição</th>
                          <th className="text-left py-2 px-2">Categoria</th>
                          <th className="text-left py-2 px-2">Fornecedor</th>
                          <th className="text-right py-2 px-2">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.services.map((s: any) => (
                          <tr key={s.id} className="border-b border-border/20">
                            <td className="py-2 px-2">{s.descricao}</td>
                            <td className="py-2 px-2 text-muted-foreground">{s.categoria || "—"}</td>
                            <td className="py-2 px-2 text-muted-foreground">{s.fornecedor || "—"}</td>
                            <td className="py-2 px-2 text-right font-medium">{fmt(s.valor || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ReportSection>
                )}

                {/* Despesas de Manutenção */}
                {report.despesas.length > 0 && (
                  <ReportSection title="Despesas Lançadas" icon={DollarSign}>
                    <div className="space-y-3">
                      {report.despesas.map((d) => (
                        <div key={d.id} className="rounded-lg bg-muted/20 border border-border/20 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{d.descricao}</span>
                            <span className="font-bold text-sm">{fmt(d.valor)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <span className="capitalize px-2 py-0.5 rounded-full bg-muted/60">
                              {d.tipo_rateio === "igual" ? "Rateio igual" : d.tipo_rateio === "por_uso" ? "Rateio por uso" : "Rateio manual"}
                            </span>
                            <span>{fmtDate(d.created_at)}</span>
                          </div>
                          {d.rateios.length > 0 && (
                            <div className="space-y-1 pt-2 border-t border-border/20">
                              {d.rateios.map((r) => {
                                const partner = report.partners.find((p) => p.id === r.client_partner_id);
                                return (
                                  <div key={r.id} className="flex items-center justify-between text-xs">
                                    <span>{partner?.name || "Sócio desconhecido"}</span>
                                    <span className="font-mono">
                                      {r.percentual.toFixed(1)}% = {fmt(r.valor)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ReportSection>
                )}

                {/* Rateio por Sócio (Resumo) */}
                {report.partners.length > 0 && Object.keys(report.totals.byPartner).length > 0 && (
                  <ReportSection title="Resumo por Sócio" icon={Users}>
                    <div className="space-y-2">
                      {report.partners.map((p) => {
                        const valor = report.totals.byPartner[p.id] || 0;
                        const pct = report.totals.grandTotal > 0
                          ? (valor / report.totals.grandTotal * 100)
                          : 0;
                        return (
                          <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                            <div>
                              <p className="font-medium text-sm">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.cpf}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-sm">{fmt(valor)}</p>
                              <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ReportSection>
                )}

                {/* Análise de Óleo */}
                {report.oilAnalysis.length > 0 && (
                  <ReportSection title="Análise de Óleo (Últimas)" icon={Droplets}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b border-border/30">
                          <th className="text-left py-2 px-2">Data</th>
                          <th className="text-right py-2 px-2">Fe</th>
                          <th className="text-right py-2 px-2">Cu</th>
                          <th className="text-right py-2 px-2">Al</th>
                          <th className="text-right py-2 px-2">Si</th>
                          <th className="text-right py-2 px-2">Viscosidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.oilAnalysis.map((o: any) => (
                          <tr key={o.id} className="border-b border-border/20">
                            <td className="py-2 px-2">{fmtDate(o.date)}</td>
                            <td className="py-2 px-2 text-right">{o.fe}</td>
                            <td className="py-2 px-2 text-right">{o.cu}</td>
                            <td className="py-2 px-2 text-right">{o.al}</td>
                            <td className="py-2 px-2 text-right">{o.si}</td>
                            <td className="py-2 px-2 text-right">{o.viscosity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ReportSection>
                )}

                {/* Service Orders */}
                {report.serviceOrders.length > 0 && (
                  <ReportSection title="Ordens de Serviço (CTM)" icon={FileText}>
                    <div className="space-y-2">
                      {report.serviceOrders.map((so: any) => (
                        <div key={so.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 text-sm">
                          <div>
                            <p className="font-medium">{so.numero} — {so.tipo_manutencao}</p>
                            <p className="text-xs text-muted-foreground">
                              {so.oficina_nome || "—"} • {fmtDate(so.data_entrada)} → {fmtDate(so.data_saida)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{fmt(so.total_geral || 0)}</p>
                            <p className="text-xs text-muted-foreground capitalize">{so.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ReportSection>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ReportSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</h4>
      </div>
      {children}
    </div>
  );
}
