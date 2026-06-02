import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Droplets, Loader2, Save, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OASOilAnalysisSectionProps {
  orderId: string;
  aircraftId: string;
  analyses: any[];
  onRefetch: () => void;
}

export function OASOilAnalysisSection({ orderId, aircraftId, analyses, onRefetch }: OASOilAnalysisSectionProps) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    fe: "", cu: "", al: "", si: "", viscosity: "",
  });

  const handleAdd = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("oil_analysis").insert([{
        aeronave_id: aircraftId,
        service_order_id: orderId,
        date: form.date,
        fe: form.fe ? parseFloat(form.fe) : null,
        cu: form.cu ? parseFloat(form.cu) : null,
        al: form.al ? parseFloat(form.al) : null,
        si: form.si ? parseFloat(form.si) : null,
        viscosity: form.viscosity ? parseFloat(form.viscosity) : null,
      }]);
      if (error) throw error;
      toast.success("Análise de óleo registrada!");
      setForm({ date: new Date().toISOString().split("T")[0], fe: "", cu: "", al: "", si: "", viscosity: "" });
      setAdding(false);
      onRefetch();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("oil_analysis").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Análise removida"); onRefetch(); }
  };

  return (
    <div className="space-y-4">
      {analyses.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Fe (ppm)</TableHead>
              <TableHead>Cu (ppm)</TableHead>
              <TableHead>Al (ppm)</TableHead>
              <TableHead>Si (ppm)</TableHead>
              <TableHead>Viscosidade</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {analyses.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell>{a.data ? format(new Date(a.data), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                <TableCell>{a.fe ?? "-"}</TableCell>
                <TableCell>{a.cu ?? "-"}</TableCell>
                <TableCell>{a.al ?? "-"}</TableCell>
                <TableCell>{a.si ?? "-"}</TableCell>
                <TableCell>{a.viscosity ?? "-"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Droplets className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>Nenhuma análise de óleo vinculada a esta OAS</p>
        </div>
      )}

      {adding ? (
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div><Label className="text-xs">Data</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><Label className="text-xs">Fe (ppm)</Label><Input type="number" step="0.1" value={form.fe} onChange={e => setForm(f => ({ ...f, fe: e.target.value }))} /></div>
            <div><Label className="text-xs">Cu (ppm)</Label><Input type="number" step="0.1" value={form.cu} onChange={e => setForm(f => ({ ...f, cu: e.target.value }))} /></div>
            <div><Label className="text-xs">Al (ppm)</Label><Input type="number" step="0.1" value={form.al} onChange={e => setForm(f => ({ ...f, al: e.target.value }))} /></div>
            <div><Label className="text-xs">Si (ppm)</Label><Input type="number" step="0.1" value={form.si} onChange={e => setForm(f => ({ ...f, si: e.target.value }))} /></div>
            <div><Label className="text-xs">Viscosidade</Label><Input type="number" step="0.1" value={form.viscosity} onChange={e => setForm(f => ({ ...f, viscosity: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nova Análise de Óleo
        </Button>
      )}
    </div>
  );
}
