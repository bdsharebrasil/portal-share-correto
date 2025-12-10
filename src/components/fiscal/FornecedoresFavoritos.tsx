import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Trash2, Edit2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Fornecedor {
  id: string;
  nome_completo: string;
  cidade: string | null;
  telefone: string | null;
  documento: string | null;
  criado_por: string;
  criado_em: string;
}

export function FornecedoresFavoritos() {
  const { user } = useAuth();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);

  const [formData, setFormData] = useState({
    nome_completo: "",
    cidade: "",
    telefone: "",
    documento: ""
  });

  useEffect(() => {
    loadFornecedores();
  }, []);

  const loadFornecedores = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("fornecedores_favoritos")
        .select("*")
        .order("nome_completo");

      if (error) throw error;
      setFornecedores(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar fornecedores");
    }
    setIsLoading(false);
  };

  const handleOpenDialog = (fornecedor?: Fornecedor) => {
    if (fornecedor) {
      setEditingFornecedor(fornecedor);
      setFormData({
        nome_completo: fornecedor.nome_completo,
        cidade: fornecedor.cidade || "",
        telefone: fornecedor.telefone || "",
        documento: fornecedor.documento || ""
      });
    } else {
      setEditingFornecedor(null);
      setFormData({
        nome_completo: "",
        cidade: "",
        telefone: "",
        documento: ""
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }

    if (!formData.nome_completo.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      if (editingFornecedor) {
        const { error } = await supabase
          .from("fornecedores_favoritos")
          .update({
            nome_completo: formData.nome_completo,
            cidade: formData.cidade || null,
            telefone: formData.telefone || null,
            documento: formData.documento || null,
            atualizado_em: new Date().toISOString()
          })
          .eq("id", editingFornecedor.id);

        if (error) throw error;
        toast.success("Fornecedor atualizado!");
      } else {
        const { error } = await supabase
          .from("fornecedores_favoritos")
          .insert([{
            nome_completo: formData.nome_completo,
            cidade: formData.cidade || null,
            telefone: formData.telefone || null,
            documento: formData.documento || null,
            criado_por: user.id
          }]);

        if (error) throw error;
        toast.success("Fornecedor adicionado!");
      }

      setDialogOpen(false);
      loadFornecedores();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar fornecedor");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      const { error } = await supabase
        .from("fornecedores_favoritos")
        .delete()
        .eq("id", deleteConfirmId);

      if (error) throw error;
      toast.success("Fornecedor removido!");
      setDeleteConfirmId(null);
      loadFornecedores();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar");
    }
  };

  const filteredFornecedores = fornecedores.filter(f =>
    f.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.documento && f.documento.includes(searchTerm)) ||
    (f.cidade && f.cidade.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Fornecedores Favoritos
          </CardTitle>
          <Button onClick={() => handleOpenDialog()} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Novo Fornecedor
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, documento ou cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : filteredFornecedores.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum fornecedor cadastrado</p>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Fornecedor" para adicionar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFornecedores.map((fornecedor) => (
              <Card key={fornecedor.id} className="group border-white/30 bg-slate-900/30 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Header with Supplier Name and Document */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Building2 className="h-5 w-5 text-slate-300 flex-shrink-0" />
                          <h3 className="font-bold text-white text-lg uppercase">
                            {fornecedor.nome_completo}
                          </h3>
                        </div>
                        {fornecedor.documento && (
                          <div className="ml-8">
                            <p className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">
                              {fornecedor.documento}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(fornecedor)}
                          className="h-8 w-8 p-0 hover:bg-slate-800"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(fornecedor.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-slate-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Phone */}
                    {fornecedor.telefone && (
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-300">{fornecedor.telefone}</span>
                      </div>
                    )}

                    {/* City */}
                    {fornecedor.cidade && (
                      <div className="border-t border-white/20 pt-3">
                        <p className="text-xs text-slate-400 flex items-center gap-2">
                          <MapPin className="h-4 w-4 flex-shrink-0 text-red-500" />
                          <span>{fornecedor.cidade}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      {/* Dialog for Add/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {editingFornecedor ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="nome_completo">Nome Completo *</Label>
              <Input
                id="nome_completo"
                value={formData.nome_completo}
                onChange={(e) => setFormData(prev => ({ ...prev, nome_completo: e.target.value }))}
                placeholder="Nome ou Razão Social"
                className="mt-1.5 bg-background"
              />
            </div>
            <div>
              <Label htmlFor="documento">CPF ou CNPJ</Label>
              <Input
                id="documento"
                value={formData.documento}
                onChange={(e) => setFormData(prev => ({ ...prev, documento: e.target.value }))}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                className="mt-1.5 bg-background"
              />
            </div>
            <div>
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={formData.cidade}
                onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                placeholder="Cidade"
                className="mt-1.5 bg-background"
              />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                placeholder="(00) 00000-0000"
                className="mt-1.5 bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
              {editingFornecedor ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja remover este fornecedor? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
