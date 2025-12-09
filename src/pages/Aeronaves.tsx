import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AddAircraftDialog } from "@/components/diario/AddAircraftDialog";
import { useMemo, useState } from "react";
import { ArrowLeft, Edit, Plus, Trash2, Plane, Calendar, MapPin, Users, Fuel, Search, Eye, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function Aeronaves() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: aircraft, isLoading, refetch } = useQuery({
    queryKey: ["aircraft"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft")
        .select("*")
        .order("registration", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-for-aircraft"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(`
          id, 
          company_name,
          client_aircraft(aircraft_id)
        `);
      if (error) throw error;
      return data as Array<{ id: string; company_name: string | null; client_aircraft: Array<{ aircraft_id: string }> }>;
    },
  });

  const { data: documentCounts } = useQuery({
    queryKey: ["aircraft-document-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft_documents")
        .select("aircraft_id");
      if (error) throw error;

      const counts = new Map<string, number>();
      data?.forEach(d => {
        counts.set(d.aircraft_id, (counts.get(d.aircraft_id) || 0) + 1);
      });
      return counts;
    },
  });

  const clientsByAircraft = useMemo(() => {
    const map = new Map<string, string[]>();
    (clients || []).forEach((c) => {
      if (c.client_aircraft && Array.isArray(c.client_aircraft)) {
        c.client_aircraft.forEach((ca: any) => {
          if (ca.aircraft_id) {
            const arr = map.get(ca.aircraft_id) || [];
            arr.push(c.company_name || "-");
            map.set(ca.aircraft_id, arr);
          }
        });
      }
    });
    return map;
  }, [clients]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Excluir esta aeronave?")) return;
    const { error } = await supabase.from("aircraft").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir aeronave");
    } else {
      toast.success("Aeronave excluída com sucesso");
      refetch();
    }
  };

  const filteredAircraft = useMemo(() => {
    if (!aircraft) return [];
    if (!searchTerm) return aircraft;

    const term = searchTerm.toLowerCase();
    return aircraft.filter(a =>
      a.registration?.toLowerCase().includes(term) ||
      a.model?.toLowerCase().includes(term) ||
      a.manufacturer?.toLowerCase().includes(term) ||
      a.base?.toLowerCase().includes(term)
    );
  }, [aircraft, searchTerm]);

  const activeAircraft = useMemo(() => {
    return filteredAircraft.filter((a) => a.status !== "inativa");
  }, [filteredAircraft]);

  const inactiveAircraft = useMemo(() => {
    return filteredAircraft.filter((a) => a.status === "inativa");
  }, [filteredAircraft]);

  const AircraftCard = ({ aircraft: a }: { aircraft: any }) => {
    const clientList = clientsByAircraft.get(a.id) || [];
    const docCount = documentCounts?.get(a.id) || 0;

    return (
      <Card
        className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group rounded-2xl border-0 shadow-lg"
        onClick={() => navigate(`/aeronaves/${a.id}`)}
      >
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Plane className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-xl font-bold text-white uppercase tracking-wider">
                    {a.registration}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{a.model}</p>
                </div>
              </div>
              <Badge
                className={`rounded-lg px-2.5 py-1 text-xs font-medium flex-shrink-0 ${a.status === "inativa"
                    ? "bg-red-500/20 text-red-300 border border-red-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
              >
                {a.status === "inativa" ? "Inativa" : "Ativa"}
              </Badge>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-2">
              {a.year && (
                <div className="flex items-center gap-2 p-2.5 bg-slate-700/40 rounded-lg">
                  <Calendar className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wide">Ano</p>
                    <p className="text-xs font-semibold text-white truncate">{a.year}</p>
                  </div>
                </div>
              )}
              {a.base && (
                <div className="flex items-center gap-2 p-2.5 bg-slate-700/40 rounded-lg">
                  <MapPin className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wide">Base</p>
                    <p className="text-xs font-semibold text-white uppercase truncate">{a.base}</p>
                  </div>
                </div>
              )}
              {a.fuel_consumption && (
                <div className="flex items-center gap-2 p-2.5 bg-slate-700/40 rounded-lg">
                  <Fuel className="h-4 w-4 text-orange-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wide">Consumo</p>
                    <p className="text-xs font-semibold text-white">{a.fuel_consumption} L/H</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 p-2.5 bg-slate-700/40 rounded-lg">
                <FileText className="h-4 w-4 text-purple-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">Docs</p>
                  <p className="text-xs font-semibold text-white">{docCount}/8</p>
                </div>
              </div>
            </div>

            {/* Clients */}
            {clientList.length > 0 && (
              <div className="flex items-start gap-2 p-2.5 bg-slate-700/30 rounded-lg">
                <Users className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide mb-1">Clientes</p>
                  <div className="flex flex-wrap gap-1">
                    {clientList.slice(0, 2).map((cn, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs rounded-md bg-slate-600 text-white truncate max-w-[120px]">
                        {cn}
                      </Badge>
                    ))}
                    {clientList.length > 2 && (
                      <Badge variant="outline" className="text-xs rounded-md border-slate-500 text-slate-300">
                        +{clientList.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="default"
                className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/aeronaves/${a.id}`);
                }}
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Ver Detalhes
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="rounded-lg border-slate-600 hover:bg-slate-700 h-9 w-9"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(a);
                  setDialogOpen(true);
                }}
              >
                <Edit className="h-3.5 w-3.5 text-white" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="rounded-lg border-slate-600 hover:bg-slate-700 h-9 w-9 text-red-400 hover:text-red-300"
                onClick={(e) => handleDelete(a.id, e)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const AircraftGrid = ({ aircraftList }: { aircraftList: any[] }) => (
    <>
      {aircraftList.length === 0 ? (
        <div className="py-16 text-center">
          <Plane className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-lg">Nenhuma aeronave encontrada</p>
          {searchTerm && (
            <p className="text-muted-foreground text-sm mt-2">
              Tente buscar por outro termo
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {aircraftList.map((a: any) => (
            <AircraftCard key={a.id} aircraft={a} />
          ))}
        </div>
      )}
    </>
  );

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6 lg:p-8 rounded-3xl shadow-xl">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 rounded-xl"
                onClick={() => navigate("/diario-bordo")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold">Gestão de Aeronaves</h1>
                <p className="text-white/70 mt-1">Gerenciamento centralizado da frota</p>
              </div>
            </div>
            <Button
              onClick={() => { setEditing(null); setDialogOpen(true); }}
              className="bg-white text-slate-800 hover:bg-white/90 rounded-xl shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Aeronave
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por prefixo, modelo, fabricante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-12 rounded-xl border-0 shadow-lg"
          />
        </div>

        {isLoading ? (
          <Card className="p-12 rounded-2xl border-0 shadow-lg">
            <div className="text-center">
              <Plane className="h-12 w-12 mx-auto text-muted-foreground/40 animate-pulse mb-4" />
              <p className="text-muted-foreground">Carregando aeronaves...</p>
            </div>
          </Card>
        ) : !aircraft || aircraft.length === 0 ? (
          <Card className="p-12 rounded-2xl border-0 shadow-lg">
            <div className="text-center space-y-4">
              <Plane className="h-16 w-16 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground text-lg">Nenhuma aeronave cadastrada</p>
              <Button
                onClick={() => { setEditing(null); setDialogOpen(true); }}
                className="rounded-xl"
              >
                <Plus className="h-4 w-4 mr-2" /> Cadastrar primeira aeronave
              </Button>
            </div>
          </Card>
        ) : (
          <Tabs defaultValue="ativas" className="space-y-6">
            <TabsList className="bg-card/50 backdrop-blur p-1.5 rounded-2xl border border-border/40 w-full max-w-md">
              <TabsTrigger
                value="ativas"
                className="flex-1 rounded-xl py-2.5 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 data-[state=inactive]:bg-muted-foreground" />
                  Ativas ({activeAircraft.length})
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="inativas"
                className="flex-1 rounded-xl py-2.5 data-[state=active]:bg-red-500 data-[state=active]:text-white data-[state=active]:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-400 data-[state=inactive]:bg-muted-foreground" />
                  Inativas ({inactiveAircraft.length})
                </div>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ativas" className="mt-6">
              <AircraftGrid aircraftList={activeAircraft} />
            </TabsContent>

            <TabsContent value="inativas" className="mt-6">
              <AircraftGrid aircraftList={inactiveAircraft} />
            </TabsContent>
          </Tabs>
        )}

        <AddAircraftDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          aircraft={editing}
        />
      </div>
    </Layout>
  );
}
