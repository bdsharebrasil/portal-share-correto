import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, MapPin, Phone, DollarSign, Search, X } from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");
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
      fuel_price_avgas: parseFloat(formData.avgas_price) || 0,
      fuel_price_jet: parseFloat(formData.jet_price) || 0,
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

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.city_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.icao_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Fornecedores de Combustível
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredSuppliers.length} de {suppliers.length} fornecedor(es)
          </p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-primary to-primary-dark hover:from-primary hover:to-primary-dark">
              <Plus className="h-4 w-4" />
              Novo Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="text-base font-semibold mb-3 block">Localização</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Cidade</Label>
                    <Input
                      value={formData.city_name}
                      onChange={(e) => setFormData({ ...formData, city_name: e.target.value })}
                      placeholder="Ex: São Paulo"
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Código ICAO</Label>
                    <Input
                      value={formData.icao_code}
                      onChange={(e) => setFormData({ ...formData, icao_code: e.target.value })}
                      placeholder="Ex: SBSP"
                      required
                      maxLength={4}
                      className="mt-1.5 font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm">Nome do Fornecedor</Label>
                <Input
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  placeholder="Ex: Combustíveis Brasil Ltda"
                  required
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">Informações de Contato</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Pessoa de Contato</Label>
                    <Input
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      placeholder="Nome do contato"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Telefone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">Preços de Combustível</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Valor AVGAS (R$)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={formData.avgas_price}
                      onChange={(e) => setFormData({ ...formData, avgas_price: e.target.value })}
                      placeholder="0,0000"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Valor JET (R$)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={formData.jet_price}
                      onChange={(e) => setFormData({ ...formData, jet_price: e.target.value })}
                      placeholder="0,0000"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary-dark">
                  {editingSupplier ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, cidade ou ICAO..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Card className="border border-border/50 shadow-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-b border-border/50 hover:bg-transparent">
                  <TableHead className="font-semibold text-foreground">Cidade</TableHead>
                  <TableHead className="font-semibold text-foreground">ICAO</TableHead>
                  <TableHead className="font-semibold text-foreground">Fornecedor</TableHead>
                  <TableHead className="font-semibold text-foreground">Contato</TableHead>
                  <TableHead className="font-semibold text-foreground">Telefone</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">AVGAS (R$)</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">JET (R$)</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow
                    key={supplier.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="font-medium text-foreground">{supplier.city_name}</TableCell>
                    <TableCell className="font-mono text-primary font-semibold">{supplier.icao_code}</TableCell>
                    <TableCell className="text-foreground">{supplier.supplier_name}</TableCell>
                    <TableCell className="text-muted-foreground">{supplier.contact_person || "-"}</TableCell>
                    <TableCell className="text-muted-foreground flex items-center gap-1">
                      {supplier.phone ? (
                        <>
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {supplier.phone}
                        </>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {supplier.fuel_price_avgas ? (
                        <div className="flex items-center justify-end gap-1 text-success">
                          <DollarSign className="h-3.5 w-3.5" />
                          {supplier.fuel_price_avgas.toFixed(4)}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {supplier.fuel_price_jet ? (
                        <div className="flex items-center justify-end gap-1 text-success">
                          <DollarSign className="h-3.5 w-3.5" />
                          {supplier.fuel_price_jet.toFixed(4)}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(supplier)}
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(supplier.id)}
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredSuppliers.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="font-medium">
                  {searchQuery ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
                </p>
                <p className="text-sm mt-1">
                  {searchQuery ? "Tente ajustar sua busca" : "Comece criando seu primeiro fornecedor"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
