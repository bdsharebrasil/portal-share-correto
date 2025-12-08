import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2 } from "lucide-react";

interface FuelSupplier {
  id: string;
  city_name: string;
  icao_code: string;
  supplier_name: string;
  contact_person: string | null;
  phone: string | null;
  fuel_price_avgas: number | null;
  fuel_price_jet: number | null;
}

export function SupplierDirectory() {
  const [suppliers, setSuppliers] = useState<FuelSupplier[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<FuelSupplier | null>(null);
  const [formData, setFormData] = useState({
    city_name: "",
    icao_code: "",
    supplier_name: "",
    contact_person: "",
    phone: "",
    avgas_price: "",
    jet_price: "",
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    const { data, error } = await supabase
      .from("fuel_suppliers")
      .select("*")
      .order("city_name", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar fornecedores");
      return;
    }

    setSuppliers(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const supplierData = {
      city_name: formData.city_name,
      icao_code: formData.icao_code.toUpperCase(),
      supplier_name: formData.supplier_name,
      contact_person: formData.contact_person || null,
      phone: formData.phone || null,
      avgas_price: parseFloat(formData.avgas_price) || 0,
      jet_price: parseFloat(formData.jet_price) || 0,
    } as const;

    if (editingSupplier) {
      const { error } = await supabase
        .from("fuel_suppliers")
        .update(supplierData)
        .eq("id", editingSupplier.id);

      if (error) {
        toast.error("Erro ao atualizar fornecedor");
        return;
      }
      toast.success("Fornecedor atualizado com sucesso");
    } else {
      const { error } = await supabase.from("fuel_suppliers").insert(supplierData);

      if (error) {
        toast.error("Erro ao criar fornecedor");
        return;
      }
      toast.success("Fornecedor criado com sucesso");
    }

    resetForm();
    setIsDialogOpen(false);
    loadSuppliers();
  };

  const handleEdit = (supplier: FuelSupplier) => {
    setEditingSupplier(supplier);
    setFormData({
      city_name: supplier.city_name,
      icao_code: supplier.icao_code,
      supplier_name: supplier.supplier_name,
      contact_person: supplier.contact_person || "",
      phone: supplier.phone || "",
      avgas_price: supplier.fuel_price_avgas ? supplier.fuel_price_avgas.toString() : "",
      jet_price: supplier.fuel_price_jet ? supplier.fuel_price_jet.toString() : "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este fornecedor?")) return;

    const { error } = await supabase.from("fuel_suppliers").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir fornecedor");
      return;
    }

    toast.success("Fornecedor excluído com sucesso");
    loadSuppliers();
  };

  const resetForm = () => {
    setFormData({
      city_name: "",
      icao_code: "",
      supplier_name: "",
      contact_person: "",
      phone: "",
      avgas_price: "",
      jet_price: "",
    });
    setEditingSupplier(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Agenda de Fornecedores</CardTitle>
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Fornecedor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Cidade</Label>
                    <Input value={formData.city_name} onChange={(e) => setFormData({ ...formData, city_name: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Código ICAO</Label>
                    <Input value={formData.icao_code} onChange={(e) => setFormData({ ...formData, icao_code: e.target.value })} required maxLength={4} />
                  </div>
                </div>
                <div>
                  <Label>Nome do Fornecedor</Label>
                  <Input value={formData.supplier_name} onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Pessoa de Contato</Label>
                    <Input value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor AVGAS (R$)</Label>
                    <Input type="number" step="0.0001" value={formData.avgas_price} onChange={(e) => setFormData({ ...formData, avgas_price: e.target.value })} />
                  </div>
                  <div>
                    <Label>Valor JET (R$)</Label>
                    <Input type="number" step="0.0001" value={formData.jet_price} onChange={(e) => setFormData({ ...formData, jet_price: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">{editingSupplier ? "Atualizar" : "Criar"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cidade</TableHead>
                <TableHead>ICAO</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">AVGAS (R$)</TableHead>
                <TableHead className="text-right">JET (R$)</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>{supplier.city_name}</TableCell>
                  <TableCell className="font-mono">{supplier.icao_code}</TableCell>
                  <TableCell>{supplier.supplier_name}</TableCell>
                  <TableCell>{supplier.contact_person || "-"}</TableCell>
                  <TableCell>{supplier.phone || "-"}</TableCell>
                  <TableCell className="text-right">{supplier.fuel_price_avgas ? supplier.fuel_price_avgas.toFixed(4) : "-"}</TableCell>
                  <TableCell className="text-right">{supplier.fuel_price_jet ? supplier.fuel_price_jet.toFixed(4) : "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(supplier)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(supplier.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {suppliers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">Nenhum fornecedor cadastrado</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
