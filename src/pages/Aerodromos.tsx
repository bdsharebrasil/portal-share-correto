import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AddAerodromeDialog } from "@/components/diario/AddAerodromeDialog";
import { useState } from "react";
import { ArrowLeft, Edit, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Aerodromos() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

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

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate("/diario-bordo")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Diário de Bordo
            </Button>
          </div>
          <Button className="gap-2" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Adicionar Aeródromo
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Aeródromos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">Carregando...</div>
            ) : !data || data.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">Nenhum aeródromo cadastrado.</div>
            ) : (
              <Table>
                <TableCaption>Lista de aeródromos</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indicativo OACI</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Coordenadas</TableHead>
                    <TableHead className="w-[1%]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((a: any) => (
                    <TableRow key={a.id} className="group">
                      <TableCell className="font-medium">{a.designativo}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell>{(a as any).coordenadas ?? ""}</TableCell>
                      <TableCell className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setDialogOpen(true); }} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(a.id)} title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AddAerodromeDialog open={dialogOpen} onOpenChange={setDialogOpen} aerodrome={editing} />
      </div>
    </Layout>
  );
}
