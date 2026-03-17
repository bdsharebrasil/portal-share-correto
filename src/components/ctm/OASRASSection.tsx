import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, FileText, Loader2, Save, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OASRASSectionProps {
  orderId: string;
  aircraftId: string;
  aircraftRegistration: string;
  reports: any[];
  onRefetch: () => void;
}

export function OASRASSection({ orderId, aircraftId, aircraftRegistration, reports, onRefetch }: OASRASSectionProps) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    number: "",
    maintenance_type: "",
    maintenance_center: "",
    description: "",
    objective: "",
    responsible: "",
    entry_date: new Date().toISOString().split("T")[0],
  });

  const handleAdd = async () => {
    if (!form.number) return toast.error("Número do RAS é obrigatório");
    setSaving(true);
    try {
      const { error } = await supabase.from("ras").insert([{
        aircraft_id: aircraftId,
        service_order_id: orderId,
        number: form.number,
        maintenance_type: form.maintenance_type || null,
        maintenance_center: form.maintenance_center || null,
        description: form.description || null,
        objective: form.objective || null,
        responsible: form.responsible || null,
        entry_date: form.entry_date || null,
        status: "registered",
      }]);
      if (error) throw error;
      toast.success("RAS criado com sucesso!");
      setForm({ number: "", maintenance_type: "", maintenance_center: "", description: "", objective: "", responsible: "", entry_date: new Date().toISOString().split("T")[0] });
      setAdding(false);
      onRefetch();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ras").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("RAS removido"); onRefetch(); }
  };

  return (
    <div className="space-y-4">
      {reports.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Tipo Manutenção</TableHead>
              <TableHead>Centro</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.number || "-"}</TableCell>
                <TableCell>{r.maintenance_type || "-"}</TableCell>
                <TableCell>{r.maintenance_center || "-"}</TableCell>
                <TableCell>{r.entry_date ? format(new Date(r.entry_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "completed" ? "default" : "secondary"}>
                    {r.status === "completed" ? "Concluído" : "Registrado"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>Nenhum RAS vinculado a esta OAS</p>
        </div>
      )}

      {adding ? (
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><Label className="text-xs">Número RAS *</Label><Input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} placeholder="RAS-001" /></div>
            <div><Label className="text-xs">Tipo Manutenção</Label><Input value={form.maintenance_type} onChange={e => setForm(f => ({ ...f, maintenance_type: e.target.value }))} placeholder="Corretiva, Preventiva..." /></div>
            <div><Label className="text-xs">Centro Manutenção</Label><Input value={form.maintenance_center} onChange={e => setForm(f => ({ ...f, maintenance_center: e.target.value }))} /></div>
            <div><Label className="text-xs">Responsável</Label><Input value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} /></div>
            <div><Label className="text-xs">Data Entrada</Label><Input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} /></div>
            <div><Label className="text-xs">Objetivo</Label><Input value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))} /></div>
            <div className="col-span-2 md:col-span-3"><Label className="text-xs">Descrição</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Criar RAS</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Novo RAS
        </Button>
      )}
    </div>
  );
}
