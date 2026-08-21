import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AddAerodromeDialog } from "@/components/diario/AddAerodromeDialog";
import { useState } from "react";
import { ArrowLeft, Edit2, Plus, Trash2, Search, MapPin, Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Aerodromos() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["aerodromes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aerodromes")
        .select("*")
        .order("designativo", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este aeródromo?")) return;
    const { error } = await supabase.from("aerodromes").delete().eq("id", id);
    if (!error) refetch();
  };

  const filteredData = data?.filter((aerodrome: any) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      aerodrome.designativo?.toLowerCase().includes(searchLower) ||
      aerodrome.nome?.toLowerCase().includes(searchLower) ||
      (aerodrome.coordenadas && aerodrome.coordenadas.toLowerCase().includes(searchLower))
    );
  }) || [];

  return (
    <Layout>
      <div className="p-6 space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="secondary" onClick={() => navigate("/diario-bordo")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>

        <header className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold">Aeródromos</h2>
              <p className="text-muted-foreground mt-2">Base de dados geográfica para cálculos de navegação.</p>
            </div>

            <Button
              onClick={() => { setEditing(null); setDialogOpen(true); }}
              className="gap-2 w-fit"
            >
              <Plus className="h-4 w-4" /> Novo Aeródromo
            </Button>
          </div>

          <div className="relative group max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-sky-400 transition-colors" />
            <input
              type="text"
              placeholder="Buscar por ICAO ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-card border border-border rounded-2xl py-3 pl-12 pr-4 text-foreground focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all shadow-xl"
            />
          </div>
        </header>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Carregando...</div>
        ) : !data || data.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">Nenhum aeródromo cadastrado.</div>
        ) : filteredData.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">Nenhum resultado encontrado para "{searchTerm}"</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredData.map((a: any) => (
              <div key={a.id} className="bg-card border border-border rounded-2xl p-4 hover:border-border transition-all shadow-lg group">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => { setEditing(a); setDialogOpen(true); }}
                      className="p-1.5 bg-card-secondary rounded-lg hover:text-sky-400 transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-1.5 bg-card-secondary rounded-lg hover:text-red-400 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white leading-tight">{a.designativo}</h3>
                <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-tight truncate mb-3">{a.nome}</p>

                <div className="bg-background/50 rounded-xl p-3 flex items-center gap-3">
                  <Compass className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider">Coordenadas DMS</p>
                    <p className="text-sm font-mono text-emerald-400 font-medium truncate">{a.coordenadas || "—"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <AddAerodromeDialog open={dialogOpen} onOpenChange={setDialogOpen} aerodrome={editing} onSuccess={refetch} />
      </div>
    </Layout>
  );
}
