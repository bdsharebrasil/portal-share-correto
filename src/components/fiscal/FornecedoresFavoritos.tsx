import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2, Edit2, Building2, Tag, Users, User, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Fornecedor {
  id: string;
  nome_completo: string;
  apelido: string | null;
  cidade: string | null;
  telefone: string | null;
  documento: string | null;
  categoria: string | null;
  criado_por: string;
  criado_em: string;
}

const CATEGORIAS = [
  { value: "share", label: "Share", icon: Users, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "particular", label: "Particular", icon: User, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { value: "nenhum", label: "Nenhum", icon: Ban, color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
];

export function FornecedoresFavoritos() {
  const { user } = useAuth();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [categoriaFilter, setCategoriaFilter] = useState<string>("todos");

  const [formData, setFormData] = useState({
    nome_completo: "",
    apelido: "",
    cidade: "",
    telefone: "",
    documento: "",
    categoria: "nenhum"
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
        apelido: fornecedor.apelido || "",
        cidade: fornecedor.cidade || "",
        telefone: fornecedor.telefone || "",
        documento: fornecedor.documento || "",
        categoria: fornecedor.categoria || "nenhum"
      });
    } else {
      setEditingFornecedor(null);
      setFormData({
        nome_completo: "",
        apelido: "",
        cidade: "",
        telefone: "",
        documento: "",
        categoria: "nenhum"
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
            apelido: formData.apelido || null,
            cidade: formData.cidade || null,
            telefone: formData.telefone || null,
            documento: formData.documento || null,
            categoria: formData.categoria || "nenhum",
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
            apelido: formData.apelido || null,
            cidade: formData.cidade || null,
            telefone: formData.telefone || null,
            documento: formData.documento || null,
            categoria: formData.categoria || "nenhum",
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

  const getCategoriaInfo = (categoria: string | null) => {
    return CATEGORIAS.find(c => c.value === categoria) || CATEGORIAS[2]; // default "nenhum"
  };

  const filteredFornecedores = fornecedores.filter(f => {
    // Filtro de categoria
    if (categoriaFilter !== "todos" && f.categoria !== categoriaFilter) {
      return false;
    }
    
    // Filtro de busca
    const searchLower = searchTerm.toLowerCase();
    return (
      f.nome_completo.toLowerCase().includes(searchLower) ||
      (f.apelido && f.apelido.toLowerCase().includes(searchLower)) ||
      (f.documento && f.documento.includes(searchTerm)) ||
      (f.cidade && f.cidade.toLowerCase().includes(searchLower))
    );
  });

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
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, apelido, documento ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background">
              <SelectValue placeholder="Filtrar categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Categorias</SelectItem>
              {CATEGORIAS.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  <span className="flex items-center gap-2">
                    <cat.icon className="w-4 h-4" />
                    {cat.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : filteredFornecedores.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum fornecedor encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Fornecedor" para adicionar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFornecedores.map((fornecedor) => {
              const catInfo = getCategoriaInfo(fornecedor.categoria);
              const CatIcon = catInfo.icon;
              
              return (
                <div
                  key={fornecedor.id}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50 hover:border-border transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="font-medium text-foreground truncate">
                        {fornecedor.nome_completo}
                      </h4>
                      {fornecedor.apelido && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                          <Tag className="w-3 h-3 mr-1" />
                          {fornecedor.apelido}
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-xs ${catInfo.color}`}>
                        <CatIcon className="w-3 h-3 mr-1" />
                        {catInfo.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                      {fornecedor.documento && (
                        <span>CPF/CNPJ: {fornecedor.documento}</span>
                      )}
                      {fornecedor.cidade && (
                        <span>Cidade: {fornecedor.cidade}</span>
                      )}
                      {fornecedor.telefone && (
                        <span>Tel: {fornecedor.telefone}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(fornecedor)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirmId(fornecedor.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
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
                <Label htmlFor="apelido">Apelido</Label>
                <Input
                  id="apelido"
                  value={formData.apelido}
                  onChange={(e) => setFormData(prev => ({ ...prev, apelido: e.target.value }))}
                  placeholder="Ex: Posto Shell, Hangar XYZ"
                  className="mt-1.5 bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">Nome curto para facilitar busca</p>
              </div>
              
              <div>
                <Label htmlFor="categoria">Categoria</Label>
                <Select 
                  value={formData.categoria} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
                >
                  <SelectTrigger className="mt-1.5 bg-background">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="flex items-center gap-2">
                          <cat.icon className="w-4 h-4" />
                          {cat.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="documento">CPF ou CNPJ</Label>
                <Input
                  id="documento"
                  value={formData.documento}
                  onChange={(e) => setFormData(prev => ({ ...prev, documento: e.target.value }))}
                  placeholder="000.000.000-00"
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
