import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AddAircraftDialog } from "@/components/diario/AddAircraftDialog";
import { useMemo, useState } from "react";
import { ArrowLeft, Edit, Plus, Trash2, Plane, Calendar, MapPin, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [viewing, setViewing] = useState<any | null>(null);

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

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta aeronave?")) return;
    const { error } = await supabase.from("aircraft").delete().eq("id", id);
    if (!error) refetch();
  };

  const activeAircraft = useMemo(() => {
    return (aircraft || []).filter((a) => a.status !== "inativa");
  }, [aircraft]);

  const inactiveAircraft = useMemo(() => {
    return (aircraft || []).filter((a) => a.status === "inativa");
  }, [aircraft]);

  const AircraftCard = ({ aircraft: a }: { aircraft: any }) => {
    const clientList = clientsByAircraft.get(a.id) || [];
    return (
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 space-y-3">
            {/* Header com ícone e badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
                  <Plane className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-foreground uppercase tracking-wider break-words">{a.registration}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.model}</p>
                </div>
              </div>
              {a.status && (
                <Badge
                  className={`text-xs flex-shrink-0 ${a.status === "inativa" ? "bg-destructive/20 text-destructive border-destructive" : "bg-success/20 text-success border-success"}`}
                  variant="outline"
                >
                  {a.status === "inativa" ? "Inativa" : "Ativa"}
                </Badge>
              )}
            </div>

            {/* Informações principais - Grid compacto */}
            <div className="grid grid-cols-2 gap-2 text-xs pb-3 border-b border-border">
              {a.year && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground">Ano</p>
                    <p className="font-semibold text-foreground">{a.year}</p>
                  </div>
                </div>
              )}
              {a.base && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground">Base</p>
                    <p className="font-semibold text-foreground uppercase truncate">{a.base}</p>
                  </div>
                </div>
              )}
              {a.fuel_consumption && (
                <div className="col-span-2 flex items-center gap-2">
                  <span className="text-muted-foreground">Consumo:</span>
                  <span className="font-semibold text-foreground">{a.fuel_consumption} L/H</span>
                </div>
              )}
              {clientList.length > 0 && (
                <div className="col-span-2">
                  <p className="text-muted-foreground mb-1">Clientes ({clientList.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {clientList.slice(0, 2).map((cn, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {cn.length > 15 ? cn.substring(0, 12) + "..." : cn}
                      </Badge>
                    ))}
                    {clientList.length > 2 && (
                      <Badge variant="secondary" className="text-xs">+{clientList.length - 2}</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setViewing(a)}
              >
                Detalhes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setEditing(a); setDialogOpen(true); }}
                aria-label="Editar"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(a.id)}
                aria-label="Excluir"
              >
                <Trash2 className="h-4 w-4" />
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
          <Plane className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground text-lg">Nenhuma aeronave nesta categoria</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {aircraftList.map((a: any) => (
            <AircraftCard key={a.id} aircraft={a} />
          ))}
        </div>
      )}
    </>
  );

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={() => navigate("/diario-bordo")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <Button className="gap-2" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Adicionar Aeronave
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Gestão de Aeronaves</h1>
          <p className="text-muted-foreground">Gerenciamento centralizado da frota</p>
        </div>

        {isLoading ? (
          <Card className="p-12">
            <div className="text-center text-muted-foreground">Carregando aeronaves...</div>
          </Card>
        ) : !aircraft || aircraft.length === 0 ? (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <Plane className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground">Nenhuma aeronave cadastrada</p>
              <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Cadastrar primeira aeronave
              </Button>
            </div>
          </Card>
        ) : (
          <Tabs defaultValue="ativas" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2 border-2 border-border rounded-lg p-1">
              <TabsTrigger value="ativas" className="border-2 border-transparent rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary/10">
                Ativas ({activeAircraft.length})
              </TabsTrigger>
              <TabsTrigger value="inativas" className="border-2 border-transparent rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary/10">
                Inativas ({inactiveAircraft.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ativas" className="space-y-4">
              <AircraftGrid aircraftList={activeAircraft} />
            </TabsContent>

            <TabsContent value="inativas" className="space-y-4">
              <AircraftGrid aircraftList={inactiveAircraft} />
            </TabsContent>
          </Tabs>
        )}

        <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
          <DialogContent className="sm:max-w-lg">
            {viewing && (
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span className="uppercase">{viewing.registration}</span>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(viewing); setDialogOpen(true); }} aria-label="Editar">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(viewing.id)} aria-label="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Modelo:</span> {viewing.model}</div>
                  <div><span className="text-muted-foreground">Ano:</span> {viewing.year || "-"}</div>
                  <div><span className="text-muted-foreground">Fabricante:</span> {viewing.manufacturer || "-"}</div>
                  <div><span className="text-muted-foreground">Nº Série:</span> {viewing.serial_number || "-"}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Proprietário:</span> {viewing.owner_name || "-"}</div>
                  <div><span className="text-muted-foreground">Base:</span> {viewing.base || "-"}</div>
                  <div><span className="text-muted-foreground">Consumo (L/H):</span> {viewing.fuel_consumption || "-"}</div>
                </div>
                <div className="pt-2">
                  <div className="text-sm font-medium mb-1">Clientes vinculados</div>
                  <div className="space-y-1 text-sm">
                    {(clientsByAircraft.get(viewing.id) || ["-"]).map((cn, i) => (
                      <div key={i}>• {cn}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AddAircraftDialog open={dialogOpen} onOpenChange={setDialogOpen} aircraft={editing} />
      </div>
    </Layout>
  );
}
