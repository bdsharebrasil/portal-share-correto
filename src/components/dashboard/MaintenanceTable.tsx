import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Settings, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export function MaintenanceTable() {
  const navigate = useNavigate();

  const { data: vencimentos = [] } = useQuery({
    queryKey: ["dashboard-vencimentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vencimentos")
        .select(`
          *,
          aircraft:aircraft_id(registration, model)
        `)
        .order("data_vencimento", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const getUrgencyBadge = (dueDate: string) => {
    const days = differenceInDays(new Date(dueDate), new Date());
    if (days < 0) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    if (days <= 7) {
      return <Badge className="bg-destructive/20 text-destructive border-destructive">Urgente</Badge>;
    }
    if (days <= 30) {
      return <Badge className="bg-warning/20 text-warning border-warning">Em breve</Badge>;
    }
    return <Badge className="bg-success/20 text-success border-success">OK</Badge>;
  };

  return (
    <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-warning" />
          <h3 className="text-lg font-semibold text-foreground">Vencimentos CTM & Manutenção</h3>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-primary hover:text-primary/80"
          onClick={() => navigate("/vencimentos")}
        >
          Ver tudo
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {vencimentos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Settings className="mx-auto h-12 w-12 mb-2 opacity-50" />
          <p>Nenhum vencimento próximo</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Aeronave</TableHead>
              <TableHead className="text-muted-foreground">Item de Controle</TableHead>
              <TableHead className="text-muted-foreground">Vencimento</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vencimentos.map((v: any) => (
              <TableRow key={v.id} className="border-border hover:bg-accent/50">
                <TableCell className="font-medium text-foreground">
                  {v.aircraft?.registration || "N/A"}
                </TableCell>
                <TableCell className="text-foreground">{v.tipo || v.descricao}</TableCell>
                <TableCell className="text-foreground">
                  {v.data_vencimento 
                    ? format(new Date(v.data_vencimento), "dd MMM, yyyy", { locale: ptBR })
                    : "N/A"}
                </TableCell>
                <TableCell>{getUrgencyBadge(v.data_vencimento)}</TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-primary"
                    onClick={() => navigate("/vencimentos")}
                  >
                    Detalhes
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
