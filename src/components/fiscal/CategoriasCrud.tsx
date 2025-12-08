import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Search, Loader2, Check } from "lucide-react";
import { useCategoriasFinanceiro, CategoriaFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { useClientesCombo } from "@/hooks/useClientesCombo";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function CategoriasCrud() {
  const { categorias, isLoading, addCategoria, updateCategoria, deleteCategoria } = useCategoriasFinanceiro();
  const { clientes, isLoading: isLoadingClientes } = useClientesCombo();
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<CategoriaFinanceiro | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [isSaving, setIsSaving] = useState(false);
  const [openClienteCombo, setOpenClienteCombo] = useState(false);
  const [clienteSearchTerm, setClienteSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "receita" as "receita" | "despesa",
    descricao: "",
    cliente_id: "",
    cliente_nome: ""
  });

  const filteredClientes = useMemo(() => {
    return clientes.filter(cliente =>
      cliente.company_name.toLowerCase().includes(clienteSearchTerm.toLowerCase())
    );
  }, [clientes, clienteSearchTerm]);

  const handleOpenDialog = (categoria?: CategoriaFinanceiro) => {
    if (categoria) {
      setEditingCategoria(categoria);
      setFormData({
        nome: categoria.nome,
        tipo: categoria.tipo,
        descricao: categoria.descricao || "",
        cliente_id: categoria.cliente_id || "",
        cliente_nome: categoria.cliente_nome || ""
      });
    } else {
      setEditingCategoria(null);
      setFormData({
        nome: "",
        tipo: "receita",
        descricao: "",
        cliente_id: "",
        cliente_nome: ""
      });
    }
    setClienteSearchTerm("");
    setOpenClienteCombo(false);
    setShowDialog(true);
  };

  const handleSaveCategoria = async () => {
    if (!formData.nome.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    setIsSaving(true);
    try {
      let success = false;
      if (editingCategoria) {
        success = await updateCategoria(editingCategoria.id, {
          nome: formData.nome,
          tipo: formData.tipo,
          descricao: formData.descricao,
          cliente_id: formData.cliente_id || null,
          cliente_nome: formData.cliente_nome || null
        });
        if (success) toast.success("Categoria atualizada com sucesso!");
      } else {
        success = await addCategoria({
          nome: formData.nome,
          tipo: formData.tipo,
          descricao: formData.descricao,
          cliente_id: formData.cliente_id || null,
          cliente_nome: formData.cliente_nome || null
        });
        if (success) toast.success("Categoria criada com sucesso!");
      }

      if (success) {
        setShowDialog(false);
        setFormData({ nome: "", tipo: "receita", descricao: "", cliente_id: "", cliente_nome: "" });
        setEditingCategoria(null);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategoria = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta categoria?")) {
      return;
    }

    const success = await deleteCategoria(id);
    if (success) {
      toast.success("Categoria excluída com sucesso!");
    }
  };

  const filteredCategorias = categorias.filter(cat => {
    const matchSearch = cat.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = filterTipo === "all" || cat.tipo === filterTipo;
    return matchSearch && matchTipo;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">Gerenciar Categorias</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Organize as categorias de receita e despesa (unificado para todo o sistema financeiro)
              </p>
            </div>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="receita">Receitas</SelectItem>
                <SelectItem value="despesa">Despesas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lista de Categorias */}
          {filteredCategorias.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma categoria encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCategorias.map((categoria) => (
                <div
                  key={categoria.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-foreground">
                        {categoria.nome}
                      </h4>
                      <Badge
                        variant={categoria.tipo === "receita" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {categoria.tipo === "receita" ? "Receita" : "Despesa"}
                      </Badge>
                      {categoria.cliente_nome && (
                        <Badge variant="outline" className="text-xs">
                          {categoria.cliente_nome}
                        </Badge>
                      )}
                    </div>
                    {categoria.descricao && (
                      <p className="text-sm text-muted-foreground">
                        {categoria.descricao}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(categoria)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-600 h-8 w-8 p-0"
                      onClick={() => handleDeleteCategoria(categoria.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para adicionar/editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategoria ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                placeholder="Ex: Receita de Serviço"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="tipo">Tipo *</Label>
              <Select value={formData.tipo} onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value as "receita" | "despesa" }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Descrição opcional"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                rows={3}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="cliente">Cliente (Opcional)</Label>
              <Popover open={openClienteCombo} onOpenChange={setOpenClienteCombo}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-between mt-1",
                      !formData.cliente_nome && "text-muted-foreground"
                    )}
                  >
                    {formData.cliente_nome || "Selecione ou digite o cliente..."}
                    <Search className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0 z-50" align="start">
                  <div className="p-3 space-y-2 bg-card">
                    <Input
                      autoFocus
                      placeholder="Buscar cliente..."
                      value={clienteSearchTerm}
                      onChange={(e) => setClienteSearchTerm(e.target.value)}
                      className="h-9 bg-background border-border/50"
                    />
                    {isLoadingClientes ? (
                      <div className="flex justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredClientes.length > 0 ? (
                      <div className="max-h-56 overflow-y-auto space-y-0">
                        {filteredClientes.map((cliente) => (
                          <Button
                            key={cliente.id}
                            variant="ghost"
                            className="w-full justify-between h-9 px-3 hover:bg-muted"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                cliente_id: cliente.id,
                                cliente_nome: cliente.company_name
                              }));
                              setOpenClienteCombo(false);
                              setClienteSearchTerm("");
                            }}
                          >
                            <span className="text-sm text-foreground">{cliente.company_name}</span>
                            {formData.cliente_id === cliente.id && (
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        Nenhum cliente encontrado
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {formData.cliente_nome && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {formData.cliente_nome}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      cliente_id: "",
                      cliente_nome: ""
                    }))}
                  >
                    Remover
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-1">
                Digite o nome do cliente se ele não estiver na lista
              </p>
              {clienteSearchTerm && !filteredClientes.some(c => c.company_name === clienteSearchTerm) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 bg-muted/50 hover:bg-muted"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      cliente_id: "",
                      cliente_nome: clienteSearchTerm
                    }));
                    setOpenClienteCombo(false);
                    setClienteSearchTerm("");
                  }}
                >
                  Usar "{clienteSearchTerm}" como novo cliente
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCategoria}
              className="bg-primary hover:bg-primary/90"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                editingCategoria ? "Atualizar" : "Criar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
