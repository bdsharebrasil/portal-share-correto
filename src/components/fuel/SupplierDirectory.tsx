import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Fuel, MapPin, Phone } from "lucide-react";

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
        <div className="space-y-3">
          {suppliers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum fornecedor cadastrado</div>
          ) : (
            suppliers.map((supplier) => (
              <Card key={supplier.id} className="group border-white/30 bg-slate-900/30 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Header with Supplier Name and City */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Fuel className="h-5 w-5 text-slate-300 flex-shrink-0" />
                          <h3 className="font-bold text-white text-lg uppercase">
                            {supplier.supplier_name}
                          </h3>
                        </div>
                        {supplier.icao_code && (
                          <div className="ml-8">
                            <p className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">
                              {supplier.city_name} - {supplier.icao_code}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(supplier)}
                          className="h-8 w-8 p-0 hover:bg-slate-800"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(supplier.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-slate-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Contact Person */}
                    {supplier.contact_person && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-slate-400 flex-shrink-0">👤</span>
                        <span className="text-slate-300">{supplier.contact_person}</span>
                      </div>
                    )}

                    {/* Phone */}
                    {supplier.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-300">{supplier.phone}</span>
                      </div>
                    )}

                    {/* Prices Section */}
                    {(supplier.fuel_price_avgas || supplier.fuel_price_jet) && (
                      <div className="border-t border-white/20 pt-4">
                        <p className="text-xs text-slate-400 mb-3 font-semibold uppercase">Combustível</p>
                        <div className="grid grid-cols-2 gap-4">
                          {supplier.fuel_price_avgas && (
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-cyan-500/30">
                              <p className="text-xs text-slate-400 mb-1 font-medium">AVGAS</p>
                              <p className="text-lg font-bold text-cyan-400">
                                R$ {supplier.fuel_price_avgas.toFixed(4)}
                              </p>
                            </div>
                          )}
                          {supplier.fuel_price_jet && (
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-cyan-500/30">
                              <p className="text-xs text-slate-400 mb-1 font-medium">JET-A1</p>
                              <p className="text-lg font-bold text-cyan-400">
                                R$ {supplier.fuel_price_jet.toFixed(4)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
