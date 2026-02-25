import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AddAircraftDialog } from "@/components/diario/AddAircraftDialog";
import { useAircraftImages } from "@/hooks/useAircraftImages";
import { useMemo, useState, useRef } from "react";
import { Plus, Plane, Calendar, MapPin, Users, Search, Upload, Image as ImageIcon, X, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const ITEMS_PER_PAGE = 9;

export default function Aeronaves() {
  const navigate = useNavigate();
  const { uploadAircraftImage } = useAircraftImages();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"todas" | "ativas" | "inativas">("todas");
  const [currentPage, setCurrentPage] = useState(1);
  const [imageUploadOpen, setImageUploadOpen] = useState(false);
  const [selectedAircraftForImage, setSelectedAircraftForImage] = useState<any | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: aircraft, isLoading, refetch } = useQuery({
    queryKey: ["aircraft"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft")
        .select("*")
        .order("registration", { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-for-aircraft"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(`id, company_name, client_aircraft(aircraft_id)`);
      if (error) throw error;
      return data as Array<{
        id: string;
        company_name: string | null;
        client_aircraft: Array<{ aircraft_id: string }>;
      }>;
    }
  });

  const clientCountByAircraft = useMemo(() => {
    const map = new Map<string, number>();
    (clients || []).forEach(c => {
      if (c.client_aircraft && Array.isArray(c.client_aircraft)) {
        c.client_aircraft.forEach((ca: any) => {
          if (ca.aircraft_id) {
            map.set(ca.aircraft_id, (map.get(ca.aircraft_id) || 0) + 1);
          }
        });
      }
    });
    return map;
  }, [clients]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadImage = async () => {
    if (!imageFile || !selectedAircraftForImage) return;
    setIsUploadingImage(true);
    try {
      const result = await uploadAircraftImage(selectedAircraftForImage.id, imageFile);
      if (result.success) {
        toast.success("Imagem da aeronave salva com sucesso");
        setImageUploadOpen(false);
        setImageFile(null);
        setImagePreview(null);
        setSelectedAircraftForImage(null);
        refetch();
      }
    } catch (error) {
      console.error("Erro ao fazer upload da imagem:", error);
      toast.error("Erro ao salvar imagem da aeronave");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const filteredAircraft = useMemo(() => {
    if (!aircraft) return [];
    let filtered = aircraft;
    
    // Apply status filter
    if (activeFilter === "ativas") {
      filtered = filtered.filter(a => a.status !== "inativa");
    } else if (activeFilter === "inativas") {
      filtered = filtered.filter(a => a.status === "inativa");
    }
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a =>
        a.registration?.toLowerCase().includes(term) ||
        a.model?.toLowerCase().includes(term) ||
        a.manufacturer?.toLowerCase().includes(term) ||
        a.base?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }, [aircraft, searchTerm, activeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredAircraft.length / ITEMS_PER_PAGE);
  const paginatedAircraft = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAircraft.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAircraft, currentPage]);

  // Reset to page 1 when filter changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilter]);

  const AircraftCard = ({ aircraft: a }: { aircraft: any }) => {
    const sociosCount = clientCountByAircraft.get(a.id) || 0;
    
    return (
      <Card 
        className="overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all duration-300 cursor-pointer group rounded-xl border-border/50 bg-card"
        onClick={() => navigate(`/aeronaves/${a.id}`)}
      >
        <CardContent className="p-0">
          <div className="flex">
            {/* Imagem da Aeronave */}
            <div className="relative w-24 h-24 flex-shrink-0 bg-muted overflow-hidden">
              {a.image_url ? (
                <img
                  src={a.image_url}
                  alt={a.registration}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Plane className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}
              {/* Botão de upload de imagem */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAircraftForImage(a);
                  setImageUploadOpen(true);
                }}
                className="absolute inset-0 bg-black/0 hover:bg-black/50 opacity-0 hover:opacity-100 transition-all duration-200 flex items-center justify-center"
              >
                <div className="bg-primary p-2 rounded-full">
                  <Upload className="h-4 w-4 text-primary-foreground" />
                </div>
              </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 p-3 min-w-0">
              <h3 className="text-base font-bold text-foreground uppercase tracking-wide truncate">
                {a.registration}
              </h3>
              
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
                  <span>Base:</span>
                  <span className="font-medium text-foreground uppercase">{a.base || "-"}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span>Ano:</span>
                    <span className="font-medium text-foreground">{a.year || "-"}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span>Sócios:</span>
                    <span className="font-medium text-foreground">{sociosCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const FilterButton = ({ value, label }: { value: "todas" | "ativas" | "inativas"; label: string }) => (
    <button
      onClick={() => setActiveFilter(value)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        activeFilter === value
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-foreground hover:text-primary transition-colors group w-fit"
        >
          <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Voltar</span>
        </button>

        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Gerenciar Aeronaves</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie sua frota e visualize detalhes das aeronaves.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Nova
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-card/50 p-4 rounded-xl border border-border/50">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por matrícula ou base..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-border"
            />
          </div>
          
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
            <FilterButton value="todas" label="Todas" />
            <FilterButton value="ativas" label="Ativas" />
            <FilterButton value="inativas" label="Inativas" />
          </div>
        </div>

        {/* Aircraft Grid */}
        {isLoading ? (
          <div className="py-16 text-center">
            <Plane className="h-12 w-12 mx-auto text-muted-foreground/40 animate-pulse mb-4" />
            <p className="text-muted-foreground">Carregando aeronaves...</p>
          </div>
        ) : paginatedAircraft.length === 0 ? (
          <div className="py-16 text-center">
            <Plane className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-lg">Nenhuma aeronave encontrada</p>
            {(searchTerm || activeFilter !== "todas") && (
              <p className="text-muted-foreground text-sm mt-2">
                Tente ajustar os filtros de busca
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedAircraft.map((a: any) => (
                <AircraftCard key={a.id} aircraft={a} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-9 w-9"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="icon"
                    onClick={() => setCurrentPage(page)}
                    className="h-9 w-9"
                  >
                    {page}
                  </Button>
                ))}
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-9 w-9"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* Dialog de Upload de Imagem */}
        <Dialog open={imageUploadOpen} onOpenChange={setImageUploadOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Salvar Imagem da Aeronave</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {imagePreview ? (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted border border-border">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-video rounded-xl border-2 border-dashed border-border hover:border-primary transition-colors bg-muted/50 flex flex-col items-center justify-center cursor-pointer group"
                >
                  <ImageIcon className="h-12 w-12 text-muted-foreground group-hover:text-primary mb-2 transition-colors" />
                  <p className="text-sm text-muted-foreground group-hover:text-primary transition-colors">
                    Clique para selecionar uma imagem
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG ou WebP</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />

              {selectedAircraftForImage && (
                <div className="p-3 bg-muted rounded-lg border border-border">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">Aeronave:</span> {selectedAircraftForImage.registration}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{selectedAircraftForImage.model}</p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setImageUploadOpen(false);
                  setImageFile(null);
                  setImagePreview(null);
                  setSelectedAircraftForImage(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUploadImage}
                disabled={!imageFile || isUploadingImage}
              >
                {isUploadingImage ? "Salvando..." : "Salvar Imagem"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AddAircraftDialog open={dialogOpen} onOpenChange={setDialogOpen} aircraft={editing} />
      </div>
    </Layout>
  );
}
