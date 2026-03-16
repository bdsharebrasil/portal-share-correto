import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Layers, Scale, BarChart3, DollarSign, Wrench } from "lucide-react";
import { CTMComponentMap } from "./CTMComponentMap";
import { CTMRASReports } from "./CTMRASReports";
import { CTMWeightBalanceComplete } from "./CTMWeightBalanceComplete";
import { CTMBudgetManagement } from "./CTMBudgetManagement";
import { CTMCategoryTab } from "./CTMCategoryTab";
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

// Utility tabs (non-maintenance)
const UTILITY_TABS = [
  { value: "componentes", label: "Componentes", icon: Layers },
  { value: "peso", label: "Peso & Balanc.", icon: Scale },
  { value: "ras", label: "RAS", icon: BarChart3 },
  { value: "orcamentos", label: "Orçamentos", icon: DollarSign },
];

export function CTMAircraftDetail({ aircraft, onBack }: CTMAircraftDetailProps) {
  const [activeTab, setActiveTab] = useState<string>("");

  // Load maintenance categories from DB
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

  // Count OAS per category
  const { data: oasCounts = {} } = useQuery({
    queryKey: ["oas-counts", aircraft.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctm_service_orders")
        .select("tipo_manutencao")
        .eq("aircraft_id", aircraft.id);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((o) => {
        const key = o.tipo_manutencao || "";
        counts[key] = (counts[key] || 0) + 1;
      });
      return counts;
    },
  });

  // Default to first category if not set
  if (!activeTab && categories.length > 0) {
    // Don't call setState during render, use a flag
  }
  const effectiveTab = activeTab || (categories.length > 0 ? `cat_${categories[0].id}` : "componentes");

  const isUtilityTab = UTILITY_TABS.some((t) => t.value === effectiveTab);
  const activeCategoryId = effectiveTab.startsWith("cat_") ? effectiveTab.replace("cat_", "") : null;
  const activeCategory = activeCategoryId ? categories.find((c) => c.id === activeCategoryId) : null;

  return (
    <div className="space-y-5">
      {/* Header */}
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
              {aircraft.model} • Controle Técnico de Manutenção
            </p>
          </div>
        </div>
      </motion.div>

      {/* Maintenance Category Tabs */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Categorias de Manutenção</p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => {
            const tabKey = `cat_${cat.id}`;
            const isActive = effectiveTab === tabKey;
            const count = oasCounts[cat.nome] || 0;
            return (
              <motion.button
                key={cat.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(tabKey)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap border",
                  isActive
                    ? "shadow-lg text-foreground"
                    : "bg-background/50 border-border/50 text-muted-foreground hover:bg-muted/50"
                )}
                style={isActive ? {
                  backgroundColor: `${cat.cor || '#3B82F6'}15`,
                  borderColor: `${cat.cor || '#3B82F6'}40`,
                  color: cat.cor || '#3B82F6',
                } : {}}
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.cor || '#3B82F6' }} />
                {cat.nome}
                {count > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">{count}</Badge>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Utility Tabs */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Controles</p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {UTILITY_TABS.map((tab) => {
            const isActive = effectiveTab === tab.value;
            const Icon = tab.icon;
            return (
              <motion.button
                key={tab.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap border",
                  isActive
                    ? "bg-primary/10 border-primary/30 text-primary shadow-lg"
                    : "bg-background/50 border-border/50 text-muted-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={effectiveTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* Maintenance Category Content */}
          {activeCategory && (
            <CTMCategoryTab
              aircraftId={aircraft.id}
              aircraftRegistration={aircraft.registration}
              categoryName={activeCategory.nome}
              categoryColor={activeCategory.cor || "#3B82F6"}
            />
          )}

          {/* Utility tabs */}
          {effectiveTab === "componentes" && <CTMComponentMap aircraftId={aircraft.id} />}
          {effectiveTab === "peso" && <CTMWeightBalanceComplete aircraftId={aircraft.id} aircraftRegistration={aircraft.registration} />}
          {effectiveTab === "ras" && <CTMRASReports aircraftId={aircraft.id} aircraftRegistration={aircraft.registration} />}
          {effectiveTab === "orcamentos" && <CTMBudgetManagement aircraftId={aircraft.id} aircraftRegistration={aircraft.registration} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
