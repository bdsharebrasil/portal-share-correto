import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Plus, FileText, ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDateToBR } from "@/lib/date-utils";
import { CTMOASInlineForm } from "./CTMOASInlineForm";
import { CTMOASDetail } from "./CTMOASDetail";
import type { MaintenanceCategory } from "@/types/ctm";

// Normalize maintenance type from various formats to standard category
const normalizeMaintenanceType = (tipo: string | null): MaintenanceCategory => {
  if (!tipo) return "TUDO";

  const normalized = tipo.toUpperCase();

  if (normalized.includes("CORRET")) return "CORRETIVO";
  if (normalized.includes("50") && normalized.includes("H")) return "50HORAS";
  if (normalized.includes("100") && normalized.includes("H")) return "100HORAS";
  if (normalized.includes("CVA")) return "CVA";
  if (normalized.includes("HELICE") || normalized.includes("GOVERNADOR")) return "HELICE_GOVERNADOR";
  if (normalized.includes("OLEO")) return "OLEO";
  if (normalized.includes("DIREITO")) return "PNEU_DIREITO";
  if (normalized.includes("ESQUERDO")) return "PNEU_ESQUERDO";
  if (normalized.includes("NARIZ")) return "PNEU_TREM_NARIZ";

  return "TUDO";
};

interface CTMCategoryTabProps {
  aircraftId: string;
  aircraftRegistration: string;
  categoryName: string;
  categoryColor: string;
}

export function CTMCategoryTab({ aircraftId, aircraftRegistration, categoryName, categoryColor }: CTMCategoryTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  // Load all OAS for this aircraft and filter by normalized category
  const { data: allOrders = [], refetch } = useQuery({
    queryKey: ["oas-by-category", aircraftId, categoryName],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("service_orders")
        .select("*")
        .eq("aeronave_id", aircraftId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Filter orders by normalized category
  const orders = allOrders.filter(o => normalizeMaintenanceType(o.tipo_manutencao) === categoryName);

  // Group by year
  const groupedByYear = useMemo(() => {
    const groups: Record<number, typeof orders> = {};
    orders.forEach((o) => {
      const year = o.data_entrada
        ? parseISODateString(o.data_entrada).getFullYear()
        : o.criado_em
        ? new Date(o.criado_em).getFullYear()
        : new Date().getFullYear();
      if (!groups[year]) groups[year] = [];
      groups[year].push(o);
    });
    // Sort years descending
    return Object.entries(groups)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, items]) => ({ year: Number(year), items }));
  }, [orders]);

  // Auto-expand latest year
  const latestYear = groupedByYear[0]?.year;
  const isYearExpanded = (year: number) => expandedYears.has(year) || (expandedYears.size === 0 && year === latestYear);

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      // If toggling the latest year off for the first time, we need to track it
      if (prev.size === 0 && year === latestYear) {
        // First interaction: expand all except this
        groupedByYear.forEach((g) => { if (g.year !== year) next.add(g.year); });
      }
      return next;
    });
  };

  const handleCreated = () => {
    setShowForm(false);
    refetch();
  };

  const statusColor = (status: string | null) => {
    if (status === "concluido") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (status === "em andamento") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  };

  const statusLabel = (status: string | null) => {
    if (status === "concluido") return "Concluído";
    if (status === "em_andamento") return "Em Andamento";
    return "Pendente";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full" style={{ backgroundColor: categoryColor }} />
          <h2 className="text-xl font-bold text-foreground">{categoryName}</h2>
          <Badge variant="secondary">{orders.length} OAS</Badge>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova OAS
          </Button>
        )}
      </div>

      {/* Inline Form */}
      <AnimatePresence>
        {showForm && (
          <CTMOASInlineForm
            aircraftId={aircraftId}
            aircraftRegistration={aircraftRegistration}
            categoryName={categoryName}
            onCreated={handleCreated}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      {/* Orders grouped by year */}
      {groupedByYear.length === 0 && !showForm && (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="py-12 text-center">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhuma OAS encontrada para {categoryName}</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Clique em "Nova OAS" para criar</p>
          </CardContent>
        </Card>
      )}

      {groupedByYear.map(({ year, items }) => (
        <div key={year} className="space-y-2">
          {/* Year Header */}
          <motion.button
            className="flex items-center gap-3 w-full text-left group"
            onClick={() => toggleYear(year)}
            whileTap={{ scale: 0.99 }}
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors w-full">
              {isYearExpanded(year) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="font-bold text-foreground text-lg">{year}</span>
              <Badge variant="outline" className="ml-auto">{items.length} OAS</Badge>
            </div>
          </motion.button>

          {/* Year Content */}
          <AnimatePresence>
            {isYearExpanded(year) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 pl-4 overflow-hidden"
              >
                {items.map((order, index) => (
                  <div key={order.id} className="space-y-0">
                    {/* Order Row */}
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Card
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          expandedOrderId === order.id ? "border-primary/30 shadow-md" : "border-border/50 hover:border-primary/20"
                        )}
                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                      >
                        <CardContent className="p-0">
                          <div className="flex items-center">
                            <div className="w-1.5 h-full min-h-[60px] shrink-0 rounded-l-lg" style={{ backgroundColor: categoryColor }} />
                            <div className="flex-1 p-4 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: `${categoryColor}20` }}>
                                  <FileText className="h-4 w-4" style={{ color: categoryColor }} />
                                </div>
                                <div>
                                  <h3 className="font-bold text-foreground">OAS #{order.numero}</h3>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                    {order.oficina_nome && <span>Oficina: {order.oficina_nome}</span>}
                                    {order.horas_celula && <span>{order.horas_celula}H célula</span>}
                                    {order.data_entrada && (
                                      <span>{formatDateToBR(order.data_entrada)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-lg font-black text-foreground">
                                    R$ {(order.total_geral || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <Badge className={cn("text-xs shrink-0", statusColor(order.status))}>
                                  {statusLabel(order.status)}
                                </Badge>
                                {expandedOrderId === order.id ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>

                    {/* Expanded Detail */}
                    <AnimatePresence>
                      {expandedOrderId === order.id && (
                        <CTMOASDetail orderId={order.id} onClose={() => setExpandedOrderId(null)} />
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
function parseISODateString(data_entrada: string): Date {
  return new Date(data_entrada);
}

