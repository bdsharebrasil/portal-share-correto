import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plane, ChevronDown, Wrench, Clock, CheckCircle2, Settings, ArrowLeft } from "lucide-react";
import { CTMAircraftDetail } from "@/components/ctm/CTMAircraftDetail";
import { OficinasManager } from "@/components/ctm/OficinasManager";
import { motion, AnimatePresence } from "framer-motion";
interface Aircraft {
  id: string;
  registration: string;
  model: string;
  status?: string | null;
  image_url?: string | null;
  cell_hours_current?: number | null;
}
export default function GestaoCTM() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedAeronave, setSelectedAircraft] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [viewMode, setViewMode] = useState<"dashboard" | "settings">("dashboard");

  useEffect(() => {
    loadAircraft();
  }, []);

  const loadAircraft = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('aeronave').select('id, matricula, modelo, status, url_imagem').order("matricula");
      if (error) throw error;
      setAircraft(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar aeronaves: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAircraft = (aircraftId: string) => {
    setSelectedAircraft(aircraftId);
  };

  const handleBack = () => {
    setSelectedAircraft("");
  };

  if (loading) {
    return <Layout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <motion.div animate={{
          rotate: 360
        }} transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear"
        }}>
            <Plane className="h-12 w-12 text-primary" />
          </motion.div>
        </div>
      </Layout>;
  }

  if (viewMode === "settings") {
    return (
      <Layout>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setViewMode("dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Configurações CTM</h1>
              <p className="text-muted-foreground">Cadastro de oficinas</p>
            </div>
          </div>
          <OficinasManager />
        </div>
      </Layout>
    );
  }

  // If aircraft is selected, show the detail view
  if (selectedAeronave) {
    const selectedAircraftData = aircraft.find(ac => ac.id === selectedAeronave);
    if (!selectedAircraftData) return null;
    return <Layout>
        <div className="p-6">
          <CTMAircraftDetail aircraft={selectedAircraftData} onBack={handleBack} />
        </div>
      </Layout>;
  }

  // Otherwise, show the aircraft selection view
  const normalizeStatus = (s: string | null | undefined) => (s ?? "").toString().trim().toLowerCase();
  const isActiveStatus = (s: string | null | undefined) => ["ativo", "ativa", "active"].includes(normalizeStatus(s));
  const isInactiveStatus = (s: string | null | undefined) => ["inativo", "inativa", "inactive"].includes(normalizeStatus(s));
  const activeAircraft = aircraft.filter(a => isActiveStatus(a.situacao));
  const inactiveAircraft = aircraft.filter(a => isInactiveStatus(a.situacao));
  return <Layout>
      <div className="p-6 space-y-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-background p-8 border border-primary/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10 flex items-start justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-primary/20 rounded-2xl backdrop-blur-sm border border-primary/30">
                <Wrench className="h-10 w-10 text-primary" />
              </div>
              <div>
              <h1 className="text-4xl font-black text-foreground tracking-tight">
                  Gestão CTM
                </h1>
                <p className="text-lg text-muted-foreground mt-1">
                  Controle Técnico de Manutenção
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="gap-2 bg-background/40 backdrop-blur-sm"
              onClick={() => setViewMode("settings")}
            >
              <Settings className="h-4 w-4" />
              Configurações
            </Button>
          </div>

          <div className="relative z-10 mt-6 flex gap-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span><strong className="text-foreground">{activeAircraft.length}</strong> aeronaves ativas</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-orange-500" />
              <span><strong className="text-foreground">{inactiveAircraft.length}</strong> inativas</span>
            </div>
          </div>
        </div>

        {/* Active Aircraft Grid */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-gradient-to-b from-green-500 to-green-600 rounded-full" />
            <h2 className="text-xl font-bold text-foreground">Aeronaves Ativas</h2>
          </div>

          {activeAircraft.length === 0 ? <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Plane className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma aeronave ativa encontrada</p>
              </CardContent>
            </Card> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence>
                {activeAircraft.map((ac, index) => <motion.div key={ac.id} initial={{
              opacity: 0,
              scale: 0.9
            }} animate={{
              opacity: 1,
              scale: 1
            }} transition={{
              delay: index * 0.05
            }} whileHover={{
              scale: 1.02,
              y: -4
            }} whileTap={{
              scale: 0.98
            }}>
                    <Card className="group cursor-pointer overflow-hidden border-border/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 bg-gradient-to-br from-background to-muted/30" onClick={() => handleSelectAircraft(ac.id)}>
                      <CardContent className="p-0">
                        {/* Aircraft Image or Placeholder */}
                        <div className="relative h-32 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden">
                          {ac.image_url ? <img src={ac.image_url} alt={ac.registration} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <div className="absolute inset-0 flex items-center justify-center">
                              <motion.div className="relative" whileHover={{
                        rotate: -10
                      }} transition={{
                        type: "spring",
                        stiffness: 300
                      }}>
                                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl scale-150" />
                                <Plane className="h-16 w-16 text-primary/60 relative z-10 -rotate-12" />
                              </motion.div>
                            </div>}
                          
                          {/* Status Badge */}
                          <div className="absolute top-3 right-3">
                            <Badge className="bg-green-500/90 text-white border-0 shadow-lg backdrop-blur-sm">
                              <span className="relative flex h-2 w-2 mr-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                              </span>
                              ATIVO
                            </Badge>
                          </div>
                        </div>

                        {/* Aircraft Info */}
                        <div className="p-4 space-y-3">
                          <div>
                            <h3 className="text-xl font-black text-foreground group-hover:text-primary transition-colors">
                              {ac.registration}
                            </h3>
                            <p className="text-sm text-muted-foreground">{ac.model}</p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-border/50">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              
                              
                            </div>
                            <div className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                              Ver detalhes →
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>)}
              </AnimatePresence>
            </div>}
        </div>

        {/* Inactive Aircraft Section */}
        <div className="space-y-4">
          <motion.button className="flex items-center gap-3 w-full text-left group" onClick={() => setShowInactive(s => !s)} whileTap={{
          scale: 0.99
        }}>
            <div className="h-8 w-1 bg-gradient-to-b from-orange-500 to-orange-600 rounded-full" />
            <h2 className="text-xl font-bold text-foreground flex-1">Aeronaves Inativas</h2>
            <Badge variant="secondary" className="mr-2">
              {inactiveAircraft.length}
            </Badge>
            <motion.div animate={{
            rotate: showInactive ? 180 : 0
          }} transition={{
            duration: 0.2
          }} className="p-2 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
              <ChevronDown className="h-4 w-4" />
            </motion.div>
          </motion.button>

          <AnimatePresence>
            {showInactive && <motion.div initial={{
            opacity: 0,
            height: 0
          }} animate={{
            opacity: 1,
            height: "auto"
          }} exit={{
            opacity: 0,
            height: 0
          }} transition={{
            duration: 0.3
          }} className="overflow-hidden">
                {inactiveAircraft.length === 0 ? <Card className="border-dashed bg-muted/30">
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground">Nenhuma aeronave inativa</p>
                    </CardContent>
                  </Card> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {inactiveAircraft.map((ac, index) => <motion.div key={ac.id} initial={{
                opacity: 0,
                y: 20
              }} animate={{
                opacity: 1,
                y: 0
              }} transition={{
                delay: index * 0.05
              }} whileHover={{
                scale: 1.02
              }} whileTap={{
                scale: 0.98
              }}>
                        <Card className="cursor-pointer border-border/30 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300 opacity-70 hover:opacity-100 bg-muted/20" onClick={() => handleSelectAircraft(ac.id)}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-orange-500/10 rounded-xl">
                                <Plane className="h-8 w-8 text-orange-500/70 -rotate-12" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold text-foreground truncate">
                                  {ac.registration}
                                </h3>
                                <p className="text-sm text-muted-foreground truncate">{ac.model}</p>
                              </div>
                              <Badge variant="outline" className="border-orange-500/30 text-orange-500 shrink-0">
                                INATIVO
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>)}
                  </div>}
              </motion.div>}
          </AnimatePresence>
        </div>
      </div>
    </Layout>;
}
