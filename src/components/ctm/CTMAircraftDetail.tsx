import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Wrench, FileText, Table as TableIcon, Scale, Users, Layers, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCTMServiceOrders, usePartnerFlightHours, useAircraftCellHours } from "@/hooks/useCTMData";
import { CTMComponentMap } from "./CTMComponentMap";
import { CTMRASReports } from "./CTMRASReports";
import { CTMWeightBalanceComplete } from "./CTMWeightBalanceComplete";
import { NewServiceOrderDialog } from "./NewServiceOrderDialog";
import { MAINTENANCE_CATEGORIES, MaintenanceCategory, CTMTab } from "@/types/ctm";
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

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  TUDO: { bg: "bg-slate-500/10", border: "border-slate-500/30", text: "text-slate-400", glow: "shadow-slate-500/20" },
  CORRETIVO: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", glow: "shadow-red-500/20" },
  "50HORAS": { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", glow: "shadow-blue-500/20" },
  "100HORAS": { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", glow: "shadow-green-500/20" },
  CVA: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", glow: "shadow-purple-500/20" },
  HELICE_GOVERNADOR: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", glow: "shadow-orange-500/20" },
  OLEO: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", glow: "shadow-yellow-500/20" },
  PNEU_DIREITO: { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400", glow: "shadow-cyan-500/20" },
  PNEU_ESQUERDO: { bg: "bg-teal-500/10", border: "border-teal-500/30", text: "text-teal-400", glow: "shadow-teal-500/20" },
  PNEU_TREM_NARIZ: { bg: "bg-indigo-500/10", border: "border-indigo-500/30", text: "text-indigo-400", glow: "shadow-indigo-500/20" },
};

const MAIN_TABS = [
  { value: "os", label: "Ordem de Acompanhamento", shortLabel: "O.S.", icon: FileText, color: "primary" },
  { value: "componentes", label: "Mapa de Componentes", shortLabel: "Comp.", icon: Layers, color: "blue" },
  { value: "peso", label: "Peso e Balanceamento", shortLabel: "Peso", icon: Scale, color: "green" },
  { value: "ras", label: "Relatórios (RAS)", shortLabel: "RAS", icon: BarChart3, color: "purple" },
] as const;

export function CTMAircraftDetail({ aircraft, onBack }: CTMAircraftDetailProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<CTMTab>("os");
  const [categoryFilter, setCategoryFilter] = useState<MaintenanceCategory>("TUDO");
  const [showNewOAS, setShowNewOAS] = useState(false);

  const { data: serviceOrders = [], isLoading: loadingOS, refetch: refetchOrders } = useCTMServiceOrders(aircraft.id);
  const { data: partnerHours = [] } = usePartnerFlightHours(aircraft.id);
  const { data: cellData } = useAircraftCellHours(aircraft.id);

  const filteredOrders = categoryFilter === "TUDO"
    ? serviceOrders
    : serviceOrders.filter(o => o.tipo_manutencao === categoryFilter);

  const handleServiceOrderCreated = () => {
    refetchOrders();
  };

  return (
    <div className="space-y-6">
      {/* Header with Glass Effect */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/5 via-background to-primary/5 p-6 border border-border/50 backdrop-blur-sm"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative z-10 flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="p-3 rounded-xl bg-background/80 border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black text-foreground tracking-tight">
                {aircraft.registration}
              </h1>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 px-3 py-1">
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                </span>
                {aircraft.status || "OPERACIONAL"}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                MODELO: <strong className="text-foreground">{aircraft.model}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                CÉLULA: <strong className="text-foreground">{cellData?.cell_hours_current?.toFixed(1) || "0"}H</strong>
              </span>
            </div>
          </div>
          
          {activeTab === "os" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Button onClick={() => setShowNewOAS(true)} className="gap-2 shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4" />
                NOVA O.S.
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Main Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {MAIN_TABS.map((tab, index) => {
          const isActive = activeTab === tab.value;
          const Icon = tab.icon;
          
          return (
            <motion.button
              key={tab.value}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.value as CTMTab)}
              className={cn(
                "relative flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all whitespace-nowrap",
                "border backdrop-blur-sm",
                isActive 
                  ? "bg-primary/10 border-primary/30 text-primary shadow-lg shadow-primary/10" 
                  : "bg-background/50 border-border/50 text-muted-foreground hover:bg-muted/50 hover:border-border"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 rounded-xl bg-primary/5 -z-10"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* OS Tab */}
          {activeTab === "os" && (
            <div className="space-y-6">
              {/* Category Filters with Colors */}
              <Card className="border-border/50 bg-background/50 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex gap-2 flex-wrap">
                    {MAINTENANCE_CATEGORIES.map((cat) => {
                      const colors = CATEGORY_COLORS[cat.value] || CATEGORY_COLORS.TUDO;
                      const isActive = categoryFilter === cat.value;
                      
                      return (
                        <motion.button
                          key={cat.value}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setCategoryFilter(cat.value)}
                          className={cn(
                            "px-4 py-2 rounded-lg font-medium text-sm transition-all border",
                            isActive 
                              ? `${colors.bg} ${colors.border} ${colors.text} shadow-lg ${colors.glow}` 
                              : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          {cat.label}
                        </motion.button>
                      );
                    })}
                    
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="px-4 py-2 rounded-lg font-medium text-sm border border-dashed border-border/50 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all flex items-center gap-2"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar Aba
                    </motion.button>
                  </div>
                </CardContent>
              </Card>

              {/* Partner Hours Summary */}
              {partnerHours.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="border-border/50 bg-gradient-to-br from-background to-muted/20 overflow-hidden">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        Horas Voadas por Sócio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {partnerHours.map((p, index) => (
                          <motion.div 
                            key={p.client_id} 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            className="p-4 bg-background/80 rounded-xl border border-border/50 hover:border-primary/30 transition-colors"
                          >
                            <p className="text-xs text-muted-foreground truncate">{p.client_name}</p>
                            <p className="text-2xl font-black text-foreground">{p.total_hours.toFixed(1)}<span className="text-sm font-normal text-muted-foreground">h</span></p>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                                  style={{ width: `${p.share_percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{p.share_percentage}%</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Service Orders List */}
              {loadingOS ? (
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Wrench className="h-8 w-8 text-primary" />
                  </motion.div>
                </div>
              ) : filteredOrders.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Card className="border-border/50 border-dashed bg-muted/20">
                    <CardContent className="py-16 text-center">
                      <div className="inline-flex p-4 bg-muted/50 rounded-2xl mb-4">
                        <Wrench className="h-12 w-12 text-muted-foreground/50" />
                      </div>
                      <p className="text-lg font-medium text-muted-foreground">Nenhuma O.S. encontrada</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">Crie uma nova ordem de serviço para começar</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {filteredOrders.map((order, index) => {
                    const colors = CATEGORY_COLORS[order.tipo_manutencao] || CATEGORY_COLORS.TUDO;
                    
                    return (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.01 }}
                      >
                        <Card className="border-border/50 hover:border-primary/30 transition-all cursor-pointer overflow-hidden group">
                          <CardContent className="p-0">
                            <div className="flex">
                              {/* Color indicator */}
                              <div className={cn("w-1.5 shrink-0", colors.bg.replace("/10", "/50"))} />
                              
                              <div className="flex-1 p-4 flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                  <div className={cn("p-3 rounded-xl", colors.bg)}>
                                    <FileText className={cn("h-5 w-5", colors.text)} />
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                                      O.S. #{order.numero}
                                    </h3>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                      <span>OFICINA: {order.os_oficina || "-"}</span>
                                      <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                                      <span>{order.horas_celula?.toFixed(1) || 0}H CÉLULA</span>
                                      <Badge className={cn("text-xs", colors.bg, colors.text, colors.border)}>
                                        {MAINTENANCE_CATEGORIES.find(c => c.value === order.tipo_manutencao)?.label || order.tipo_manutencao}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total da OS</p>
                                  <p className="text-2xl font-black text-foreground">
                                    R$ {(order.total_geral || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Components Tab */}
          {activeTab === "componentes" && (
            <CTMComponentMap aircraftId={aircraft.id} />
          )}

          {/* Weight Balance Tab */}
          {activeTab === "peso" && (
            <CTMWeightBalanceComplete aircraftId={aircraft.id} aircraftRegistration={aircraft.registration} />
          )}

          {/* RAS Tab */}
          {activeTab === "ras" && (
            <CTMRASReports aircraftId={aircraft.id} aircraftRegistration={aircraft.registration} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* New Service Order Dialog */}
      <NewServiceOrderDialog
        open={showNewOAS}
        onOpenChange={setShowNewOAS}
        aircraftId={aircraft.id}
        aircraftRegistration={aircraft.registration}
        onServiceOrderCreated={handleServiceOrderCreated}
      />
    </div>
  );
}
