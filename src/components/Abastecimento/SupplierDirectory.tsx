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
  nome_cidade: string;
  codigo_icao: string;
  nome_fornecedor: string;
  pessoa_contato: string | null;
  telefone: string | null;
  preco_avgas: number | null;
  preco_jet: number | null;
}

export function SupplierDirectory() {
  const [suppliers, setSuppliers] = useState<FuelSupplier[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<FuelSupplier | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    nome_cidade: "",
    codigo_icao: "",
    nome_fornecedor: "",
    pessoa_contato: "",
    telefone: "",
    avgas_price: "",
    jet_price: "",
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    const { data, error } = await supabase
      .from("fornecedores_combustivel")
      .select("*")
      .order("nome_cidade", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar fornecedores");
      return;
    }

    setSuppliers((data || []) as FuelSupplier[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const supplierData = {
      nome_cidade: formData.nome_cidade,
      codigo_icao: formData.codigo_icao.toUpperCase(),
      nome_fornecedor: formData.nome_fornecedor,
      pessoa_contato: formData.pessoa_contato || null,
      telefone: formData.telefone || null,
      preco_avgas: parseFloat(formData.avgas_price) || 0,
      preco_jet: parseFloat(formData.jet_price) || 0,
    } as const;

    if (editingSupplier) {
      const { error } = await supabase
        .from("fornecedores_combustivel")
        .update(supplierData)
        .eq("id", editingSupplier.id);

      if (error) {
        toast.error("Erro ao atualizar fornecedor");
        return;
      }
      toast.success("Fornecedor atualizado com sucesso");
    } else {
      const { error } = await supabase.from("fornecedores_combustivel").insert(supplierData);

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
      nome_cidade: supplier.nome_cidade,
      codigo_icao: supplier.codigo_icao,
      nome_fornecedor: supplier.nome_fornecedor,
      pessoa_contato: supplier.pessoa_contato || "",
      telefone: supplier.telefone || "",
      avgas_price: supplier.preco_avgas ? supplier.preco_avgas.toString() : "",
      jet_price: supplier.preco_jet ? supplier.preco_jet.toString() : "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este fornecedor?")) return;

    const { error } = await supabase.from("fornecedores_combustivel").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir fornecedor");
      return;
    }

    toast.success("Fornecedor excluído com sucesso");
    loadSuppliers();
  };

  const resetForm = () => {
    setFormData({
      nome_cidade: "",
      codigo_icao: "",
      nome_fornecedor: "",
      pessoa_contato: "",
      telefone: "",
      avgas_price: "",
      jet_price: "",
    });
    setEditingSupplier(null);
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.nome_fornecedor.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.nome_cidade.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.codigo_icao.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            <Button className="w-full gap-2 bg-gradient-to-r from-primary to-primary-dark hover:from-primary hover:to-primary-dark sm:w-auto">
              <Plus className="h-4 w-4" />
              Novo Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl w-[calc(100%-1rem)] rounded-lg p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>{editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div>
                <Label className="text-base font-semibold mb-3 block">Localização</Label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm">Cidade</Label>
                    <Input
                      value={formData.nome_cidade}
                      onChange={(e) => setFormData({ ...formData, nome_cidade: e.target.value })}
                      placeholder="Ex: São Paulo"
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Código ICAO</Label>
                    <Input
                      value={formData.codigo_icao}
                      onChange={(e) => setFormData({ ...formData, codigo_icao: e.target.value })}
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
                  value={formData.nome_fornecedor}
                  onChange={(e) => setFormData({ ...formData, nome_fornecedor: e.target.value })}
                  placeholder="Ex: Combustíveis Brasil Ltda"
                  required
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">Informações de Contato</Label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm">Pessoa de Contato</Label>
                    <Input
                      value={formData.pessoa_contato}
                      onChange={(e) => setFormData({ ...formData, pessoa_contato: e.target.value })}
                      placeholder="Nome do contato"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Telefone</Label>
                    <Input
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      placeholder="(11) 99999-9999"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">Preços de Combustível</Label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="submit" className="w-full bg-primary hover:bg-primary-dark sm:w-auto">
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
                    <TableCell className="font-medium text-foreground">{supplier.nome_cidade}</TableCell>
                    <TableCell className="font-mono text-primary font-semibold">{supplier.codigo_icao}</TableCell>
                    <TableCell className="text-foreground">{supplier.nome_fornecedor}</TableCell>
                    <TableCell className="text-muted-foreground">{supplier.pessoa_contato || "-"}</TableCell>
                    <TableCell className="text-muted-foreground flex items-center gap-1">
                      {supplier.telefone ? (
                        <>
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {supplier.telefone}
                        </>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {supplier.preco_avgas ? (
                        <div className="flex items-center justify-end gap-1 text-success">
                          <DollarSign className="h-3.5 w-3.5" />
                          {supplier.preco_avgas.toFixed(2)}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {supplier.preco_jet ? (
                        <div className="flex items-center justify-end gap-1 text-success">
                          <DollarSign className="h-3.5 w-3.5" />
                          {supplier.preco_jet.toFixed(2)}
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
