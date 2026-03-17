import { useState } from "react";
import { formatDateToBR } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Layers, Scale, Plus, FileText, ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { CTMComponentMap } from "./CTMComponentMap";
import { CTMWeightBalanceComplete } from "./CTMWeightBalanceComplete";
import { CTMOASInlineForm } from "./CTMOASInlineForm";
import { CTMOASDetail } from "./CTMOASDetail";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Aircraft {
  id: string;
  registration: string;
  model: string;
  status?: string | null;
}

interface CTMAircraftDetailProps {
  aircraft: Aircraft;
  onBack: () => void;
}

type ViewMode = "dashboard" | "componentes" | "peso" | "oas-detail";

export function CTMAircraftDetail({ aircraft, onBack }: CTMAircraftDetailProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [selectedOASId, setSelectedOASId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formCategory, setFormCategory] = useState("");
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  // Load maintenance categories
  const { data: categories = [] } = useQuery({
    queryKey: ["ctm-maintenance-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctm_maintenance_categories")
        .select("id, nome, descricao, cor, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // Load ALL OAS for this aircraft
  const { data: allOrders = [], refetch } = useQuery({
    queryKey: ["all-oas", aircraft.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctm_service_orders")
        .select("*")
        .eq("aircraft_id", aircraft.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Active maintenance count
  const activeCount = allOrders.filter(o => o.status === "em_andamento").length;

  // Group orders by year
  const groupedByYear = (() => {
    const groups: Record<number, typeof allOrders> = {};
    allOrders.forEach((o) => {
      const year = o.data_entrada
        ? new Date(o.data_entrada).getFullYear()
        : o.created_at
        ? new Date(o.created_at).getFullYear()
        : new Date().getFullYear();
      if (!groups[year]) groups[year] = [];
      groups[year].push(o);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, items]) => ({ year: Number(year), items }));
  })();

  const latestYear = groupedByYear[0]?.year;
  const isYearExpanded = (year: number) => expandedYears.has(year) || (expandedYears.size === 0 && year === latestYear);

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      if (prev.size === 0 && year === latestYear) {
        groupedByYear.forEach((g) => { if (g.year !== year) next.add(g.year); });
      }
      return next;
    });
  };

  const statusColor = (status: string | null) => {
    if (status === "concluido") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (status === "em_andamento") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  };

  const statusLabel = (status: string | null) => {
    if (status === "concluido") return "Concluído";
    if (status === "em_andamento") return "Em Andamento";
    return "Pendente";
  };

  const getCategoryColor = (tipo: string) => {
    const cat = categories.find(c => c.nome === tipo);
    return cat?.cor || "#3B82F6";
  };

  // OAS Detail view
  if (viewMode === "oas-detail" && selectedOASId) {
    return (
      <div className="space-y-5">
        <CTMOASDetail
          orderId={selectedOASId}
          onClose={() => { setViewMode("dashboard"); setSelectedOASId(null); }}
          onDeleted={() => { setViewMode("dashboard"); setSelectedOASId(null); refetch(); }}
        />
      </div>
    );
  }

  // Componentes view
  if (viewMode === "componentes") {
    return (
      <div className="space-y-5">
        <HeaderBar aircraft={aircraft} onBack={() => setViewMode("dashboard")} subtitle="Mapa de Componentes" />
        <CTMComponentMap aircraftId={aircraft.id} />
      </div>
    );
  }

  // Peso view
  if (viewMode === "peso") {
    return (
      <div className="space-y-5">
        <HeaderBar aircraft={aircraft} onBack={() => setViewMode("dashboard")} subtitle="Peso e Balanceamento" />
        <CTMWeightBalanceComplete aircraftId={aircraft.id} aircraftRegistration={aircraft.registration} />
      </div>
    );
  }

  // Dashboard view
  return (
    <div className="space-y-5">
      {/* Header */}
      <HeaderBar aircraft={aircraft} onBack={onBack} subtitle="Dashboard de Manutenção" />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-foreground">{allOrders.length}</p>
            <p className="text-xs text-muted-foreground">Total OAS</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-blue-400">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Em Andamento</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-all" onClick={() => setViewMode("componentes")}>
          <CardContent className="p-4 flex items-center gap-3">
            <Layers className="h-6 w-6 text-primary" />
            <div>
              <p className="font-bold text-foreground text-sm">Componentes</p>
              <p className="text-xs text-muted-foreground">Mapa de componentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-all" onClick={() => setViewMode("peso")}>
          <CardContent className="p-4 flex items-center gap-3">
            <Scale className="h-6 w-6 text-primary" />
            <div>
              <p className="font-bold text-foreground text-sm">Peso & Balanc.</p>
              <p className="text-xs text-muted-foreground">Peso e balanceamento</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New OAS Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Ordens de Abertura de Serviço</h2>
        {!showForm && (
          <div className="flex gap-2">
            {categories.map(cat => (
              <Button
                key={cat.id}
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => { setFormCategory(cat.nome); setShowForm(true); }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.cor || '#3B82F6' }} />
                <Plus className="h-3 w-3" />
                {cat.nome}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Inline Form */}
      <AnimatePresence>
        {showForm && (
          <CTMOASInlineForm
            aircraftId={aircraft.id}
            aircraftRegistration={aircraft.registration}
            categoryName={formCategory}
            onCreated={() => { setShowForm(false); refetch(); }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      {/* Orders grouped by year */}
      {groupedByYear.length === 0 && !showForm && (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="py-12 text-center">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhuma OAS encontrada</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Selecione uma categoria acima para criar uma nova OAS</p>
          </CardContent>
        </Card>
      )}

      {groupedByYear.map(({ year, items }) => (
        <div key={year} className="space-y-2">
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

          <AnimatePresence>
            {isYearExpanded(year) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 pl-4 overflow-hidden"
              >
                {items.map((order, index) => {
                  const catColor = getCategoryColor(order.tipo_manutencao);
                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Card
                        className="cursor-pointer transition-all hover:shadow-md border-border/50 hover:border-primary/20"
                        onClick={() => { setSelectedOASId(order.id); setViewMode("oas-detail"); }}
                      >
                        <CardContent className="p-0">
                          <div className="flex items-center">
                            <div className="w-1.5 h-full min-h-[60px] shrink-0 rounded-l-lg" style={{ backgroundColor: catColor }} />
                            <div className="flex-1 p-4 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: `${catColor}20` }}>
                                  <FileText className="h-4 w-4" style={{ color: catColor }} />
                                </div>
                                <div>
                                  <h3 className="font-bold text-foreground">OAS #{order.numero}</h3>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                    <span className="font-medium" style={{ color: catColor }}>{order.tipo_manutencao}</span>
                                    {order.oficina_nome && <span>• {order.oficina_nome}</span>}
                                    {order.horas_celula && <span>• {order.horas_celula}H</span>}
                                    {order.data_entrada && <span>• {formatDateToBR(order.data_entrada)}</span>}
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
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// Reusable header
function HeaderBar({ aircraft, onBack, subtitle }: { aircraft: Aircraft; onBack: () => void; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/5 via-background to-primary/5 p-5 border border-border/50"
    >
      <div className="relative z-10 flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="p-3 rounded-xl bg-background/80 border border-border hover:border-primary/50 transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
        </motion.button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-foreground tracking-tight">{aircraft.registration}</h1>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              {aircraft.status || "OPERACIONAL"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {aircraft.model} • {subtitle}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
