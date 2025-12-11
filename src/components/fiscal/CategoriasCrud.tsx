import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Search, Loader2, Check, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Sparkles, X } from "lucide-react";
import { useCategoriasFinanceiro, CategoriaFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { useClientesCombo } from "@/hooks/useClientesCombo";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function CategoriasCrud() {
  const {
    categorias,
    isLoading,
    addCategoria,
    updateCategoria,
    deleteCategoria
  } = useCategoriasFinanceiro();
  const {
    clientes,
    isLoading: isLoadingClientes
  } = useClientesCombo();
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<CategoriaFinanceiro | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("receita");
  const [isSaving, setIsSaving] = useState(false);
  const [openClienteCombo, setOpenClienteCombo] = useState(false);
  const [clienteSearchTerm, setClienteSearchTerm] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"edit" | "delete" | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "receita" as "receita" | "despesa",
    categoria: "",
    descricao: "",
    cliente_id: "",
    cliente_nome: ""
  });

  const filteredClientes = useMemo(() => {
    return clientes.filter(cliente => cliente.company_name.toLowerCase().includes(clienteSearchTerm.toLowerCase()));
  }, [clientes, clienteSearchTerm]);

  const categoriasReceita = useMemo(() => {
    return categorias.filter(cat => 
      cat.tipo === "receita" && 
      cat.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categorias, searchTerm]);

  const categoriasDespesa = useMemo(() => {
    return categorias.filter(cat => 
      cat.tipo === "despesa" && 
      cat.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categorias, searchTerm]);

  const handleOpenDialog = (categoria?: CategoriaFinanceiro) => {
    if (categoria) {
      setEditingCategoria(categoria);
      setFormData({
        nome: categoria.nome,
        tipo: categoria.tipo,
        categoria: categoria.categoria || "",
        descricao: categoria.descricao || "",
        cliente_id: categoria.cliente_id || "",
        cliente_nome: categoria.cliente_nome || ""
      });
    } else {
      setEditingCategoria(null);
      setFormData({
        nome: "",
        tipo: activeTab as "receita" | "despesa",
        categoria: "",
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
          categoria: formData.categoria || null,
          descricao: formData.descricao,
          cliente_id: formData.cliente_id || null,
          cliente_nome: formData.cliente_nome || null
        });
        if (success) toast.success("Categoria atualizada com sucesso!");
      } else {
        success = await addCategoria({
          nome: formData.nome,
          tipo: formData.tipo,
          categoria: formData.categoria || null,
          descricao: formData.descricao,
          cliente_id: formData.cliente_id || null,
          cliente_nome: formData.cliente_nome || null
        });
        if (success) toast.success("Categoria criada com sucesso!");
      }
      if (success) {
        setShowDialog(false);
        setFormData({
          nome: "",
          tipo: "receita",
          categoria: "",
          descricao: "",
          cliente_id: "",
          cliente_nome: ""
        });
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

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleActionOnSelected = (action: "edit" | "delete") => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos uma categoria");
      return;
    }
    if (selectedIds.size > 1 && action === "edit") {
      toast.error("Você pode editar apenas uma categoria por vez");
      return;
    }
    setActionType(action);
    setActionDialogOpen(true);
  };

  const executeSelectedAction = async () => {
    if (actionType === "delete") {
      for (const id of selectedIds) {
        await deleteCategoria(id);
      }
      toast.success("Categorias excluídas com sucesso!");
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else if (actionType === "edit" && selectedIds.size === 1) {
      const categoriaId = Array.from(selectedIds)[0];
      const categoria = categorias.find(c => c.id === categoriaId);
      if (categoria) {
        handleOpenDialog(categoria);
      }
    }
    setActionDialogOpen(false);
    setActionType(null);
  };

  const renderCategoriaItem = (categoria: CategoriaFinanceiro) => (
    <div
      key={categoria.id}
      className={cn(
        "group relative flex items-center justify-between p-5 rounded-xl border-2 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:scale-102 cursor-pointer",
        selectionMode && selectedIds.has(categoria.id)
          ? categoria.tipo === "receita"
            ? "border-blue-500/80 bg-blue-950/20"
            : "border-red-500/80 bg-red-950/20"
          : categoria.tipo === "receita"
            ? "border-blue-600/60 hover:border-blue-500/80 hover:bg-card/80"
            : "border-red-600/60 hover:border-red-500/80 hover:bg-card/80"
      )}
      onClick={() => selectionMode && toggleSelection(categoria.id)}
    >
      {selectionMode && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <div className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
            selectedIds.has(categoria.id)
              ? categoria.tipo === "receita"
                ? "bg-blue-500/30 border-blue-500"
                : "bg-red-500/30 border-red-500"
              : "border-muted-foreground/30"
          )}>
            {selectedIds.has(categoria.id) && (
              <Check className="w-3 h-3 text-white" />
            )}
          </div>
        </div>
      )}

      <div className={cn("flex-1", selectionMode && "pl-6")}>
        <div className="flex items-center gap-3 mb-2">
          <div className={cn(
            "p-2 rounded-lg transition-all duration-300",
            categoria.tipo === "receita"
              ? "bg-blue-500/10"
              : "bg-red-500/10"
          )}>
            {categoria.tipo === "receita" ? (
              <ArrowUpCircle className="w-4 h-4 text-blue-500" />
            ) : (
              <ArrowDownCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
          <h4 className="font-semibold text-foreground">
            {categoria.nome}
          </h4>
        </div>
        {categoria.descricao && (
          <p className="text-sm text-muted-foreground">
            {categoria.descricao}
          </p>
        )}
        {categoria.cliente_nome && (
          <div className="mt-2">
            <Badge
              variant="outline"
              className={cn(
                "text-xs border",
                categoria.tipo === "receita"
                  ? "border-blue-600/30 bg-blue-950/20 text-blue-400"
                  : "border-red-600/30 bg-red-950/20 text-red-400"
              )}
            >
              {categoria.cliente_nome}
            </Badge>
          </div>
        )}
      </div>

      {categoria.categoria && (
        <Badge
          variant="secondary"
          className={cn(
            "text-xs font-medium ml-4",
            categoria.tipo === "receita"
              ? "bg-blue-950/30 text-blue-400 border-blue-700/30"
              : "bg-red-950/30 text-red-400 border-red-700/30"
          )}
        >
          {categoria.categoria}
        </Badge>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-2xl bg-gradient-to-br from-slate-900/50 to-slate-950/50 backdrop-blur-xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                </div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent">
                  Gerenciar Categorias
                </CardTitle>
              </div>
              <p className="text-sm text-muted-foreground/80 ml-11">
                Organize as categorias de receita e despesa do sistema financeiro
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Busca */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Buscar categoria..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700/60 text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500/60 transition-colors"
            />
          </div>

          {/* Tabs para Receitas e Despesas */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6 bg-slate-800/40 border border-slate-700/40 p-1 rounded-lg">
              <TabsTrigger
                value="receita"
                className="gap-2 rounded-md transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600/80 data-[state=active]:to-cyan-600/80 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20 data-[state=inactive]:text-muted-foreground hover:text-foreground"
              >
                <ArrowUpCircle className="h-4 w-4" />
                Receitas ({categoriasReceita.length})
              </TabsTrigger>
              <TabsTrigger
                value="despesa"
                className="gap-2 rounded-md transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600/80 data-[state=active]:to-rose-600/80 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-red-500/20 data-[state=inactive]:text-muted-foreground hover:text-foreground"
              >
                <ArrowDownCircle className="h-4 w-4" />
                Despesas ({categoriasDespesa.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="receita" className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 shadow-lg shadow-blue-500/50"></div>
                  <span className="text-sm font-medium text-muted-foreground/90">
                    Categorias de entrada de valores
                  </span>
                </div>
                <div className="flex gap-2">
                  {selectionMode && activeTab === "receita" && (
                    <>
                      <Button
                        onClick={() => {
                          setSelectionMode(false);
                          setSelectedIds(new Set());
                        }}
                        size="sm"
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={() => handleActionOnSelected("edit")}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Editar ({selectedIds.size})
                      </Button>
                      <Button
                        onClick={() => handleActionOnSelected("delete")}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Deletar ({selectedIds.size})
                      </Button>
                    </>
                  )}
                  {!selectionMode && (
                    <>
                      <Button
                        onClick={() => setSelectionMode(true)}
                        size="sm"
                        variant="outline"
                        className="text-blue-400 border-blue-600/30 hover:bg-blue-950/20"
                      >
                        Selecionar
                      </Button>
                      <Button
                        onClick={() => handleOpenDialog()}
                        size="sm"
                        className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-105"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Receita
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {categoriasReceita.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-blue-700/30 rounded-lg bg-blue-950/20 backdrop-blur-sm transition-all duration-300 hover:border-blue-600/50 hover:bg-blue-950/30">
                  <TrendingUp className="h-10 w-10 mx-auto mb-3 text-blue-400" />
                  <p className="text-muted-foreground/80">Nenhuma categoria de receita encontrada</p>
                  <Button
                    variant="link"
                    onClick={() => handleOpenDialog()}
                    className="text-blue-400 hover:text-blue-300 mt-2"
                  >
                    Criar primeira categoria
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {categoriasReceita.map(renderCategoriaItem)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="despesa" className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-gradient-to-r from-red-400 to-rose-400 shadow-lg shadow-red-500/50"></div>
                  <span className="text-sm font-medium text-muted-foreground/90">
                    Categorias de saída de valores
                  </span>
                </div>
                <div className="flex gap-2">
                  {selectionMode && activeTab === "despesa" && (
                    <>
                      <Button
                        onClick={() => {
                          setSelectionMode(false);
                          setSelectedIds(new Set());
                        }}
                        size="sm"
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={() => handleActionOnSelected("edit")}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Editar ({selectedIds.size})
                      </Button>
                      <Button
                        onClick={() => handleActionOnSelected("delete")}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Deletar ({selectedIds.size})
                      </Button>
                    </>
                  )}
                  {!selectionMode && (
                    <>
                      <Button
                        onClick={() => setSelectionMode(true)}
                        size="sm"
                        variant="outline"
                        className="text-red-400 border-red-600/30 hover:bg-red-950/20"
                      >
                        Selecionar
                      </Button>
                      <Button
                        onClick={() => handleOpenDialog()}
                        size="sm"
                        className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg shadow-red-500/30 transition-all duration-300 hover:scale-105"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Despesa
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {categoriasDespesa.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-red-700/30 rounded-lg bg-red-950/20 backdrop-blur-sm transition-all duration-300 hover:border-red-600/50 hover:bg-red-950/30">
                  <TrendingDown className="h-10 w-10 mx-auto mb-3 text-red-400" />
                  <p className="text-muted-foreground/80">Nenhuma categoria de despesa encontrada</p>
                  <Button
                    variant="link"
                    onClick={() => handleOpenDialog()}
                    className="text-red-400 hover:text-red-300 mt-2"
                  >
                    Criar primeira categoria
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {categoriasDespesa.map(renderCategoriaItem)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog para confirmar ações nas selecionadas */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-900/95 to-slate-950/95 border-slate-700/50 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className={cn(
              "flex items-center gap-3 text-lg font-bold",
              actionType === "delete" ? "text-red-400" : "text-blue-400"
            )}>
              {actionType === "delete" ? (
                <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                  <Edit2 className="h-5 w-5 text-blue-400" />
                </div>
              )}
              <span>
                {actionType === "delete"
                  ? `Deletar ${selectedIds.size} categoria${selectedIds.size > 1 ? 's' : ''}?`
                  : "Editar categoria"}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {actionType === "delete" ? (
              <p className="text-muted-foreground/80">
                Tem certeza que deseja deletar {selectedIds.size === 1 ? "esta categoria" : "estas categorias"}? Esta ação não pode ser desfeita.
              </p>
            ) : (
              <p className="text-muted-foreground/80">
                Selecione uma categoria para editar.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialogOpen(false)}
              className="border-slate-700/60 hover:bg-slate-800/50 text-foreground/80"
            >
              Cancelar
            </Button>
            <Button
              onClick={executeSelectedAction}
              className={cn(
                "transition-all duration-300 shadow-lg",
                actionType === "delete"
                  ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-red-500/30"
                  : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-blue-500/30"
              )}
            >
              {actionType === "delete" ? "Deletar" : "Editar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para adicionar/editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-900/95 to-slate-950/95 border-slate-700/50 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className={cn(
              "flex items-center gap-3 text-lg font-bold",
              formData.tipo === "receita"
                ? "text-blue-400"
                : "text-red-400"
            )}>
              {formData.tipo === "receita" ? (
                <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                  <ArrowUpCircle className="h-5 w-5 text-blue-400" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30">
                  <ArrowDownCircle className="h-5 w-5 text-red-400" />
                </div>
              )}
              <span>{editingCategoria ? "Editar Categoria" : "Nova Categoria"}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="nome" className="text-foreground/90">Nome *</Label>
              <Input
                id="nome"
                placeholder={formData.tipo === "receita" ? "Ex: Receita de Serviço" : "Ex: Despesa Operacional"}
                value={formData.nome}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  nome: e.target.value
                }))}
                className="mt-1 bg-slate-800/50 border-slate-700/60 text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500/60 transition-colors"
              />
            </div>

            <div>
              <Label htmlFor="tipo" className="text-foreground/90">Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={value => setFormData(prev => ({
                  ...prev,
                  tipo: value as "receita" | "despesa"
                }))}
              >
                <SelectTrigger className="mt-1 bg-slate-800/50 border-slate-700/60 text-foreground focus:border-blue-500/60 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900/95 border-slate-700/50 backdrop-blur-xl">
                  <SelectItem value="receita">
                    <span className="flex items-center gap-2">
                      <ArrowUpCircle className="h-4 w-4 text-blue-400" />
                      Receita
                    </span>
                  </SelectItem>
                  <SelectItem value="despesa">
                    <span className="flex items-center gap-2">
                      <ArrowDownCircle className="h-4 w-4 text-red-400" />
                      Despesa
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="categoria" className="text-foreground/90">Subcategoria (Opcional)</Label>
              <Input
                id="categoria"
                placeholder="Ex: Serviços, Materiais, etc."
                value={formData.categoria}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  categoria: e.target.value
                }))}
                className="mt-1 bg-slate-800/50 border-slate-700/60 text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500/60 transition-colors"
              />
            </div>

            <div>
              <Label htmlFor="descricao" className="text-foreground/90">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Descrição opcional da categoria"
                value={formData.descricao}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  descricao: e.target.value
                }))}
                rows={3}
                className="mt-1 bg-slate-800/50 border-slate-700/60 text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500/60 transition-colors"
              />
            </div>

            <div>
              <Label htmlFor="cliente" className="text-foreground/90">Cliente (Opcional)</Label>
              <Popover open={openClienteCombo} onOpenChange={setOpenClienteCombo}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-between mt-1 bg-slate-800/50 border-slate-700/60 hover:border-slate-600/60 transition-colors",
                      !formData.cliente_nome ? "text-muted-foreground/60" : "text-foreground"
                    )}
                  >
                    {formData.cliente_nome || "Selecione ou digite o cliente..."}
                    <Search className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[280px] p-0 bg-slate-900/95 border-slate-700/50 backdrop-blur-xl"
                  align="start"
                  sideOffset={5}
                  style={{ zIndex: 9999 }}
                >
                  <div className="p-3 space-y-2 bg-slate-900/80">
                    <Input
                      autoFocus
                      placeholder="Buscar cliente..."
                      value={clienteSearchTerm}
                      onChange={e => setClienteSearchTerm(e.target.value)}
                      className="h-9 bg-slate-800/50 border-slate-700/60 text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500/60"
                    />
                    {isLoadingClientes ? (
                      <div className="flex justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredClientes.length > 0 ? (
                      <div className="max-h-56 overflow-y-auto space-y-0">
                        {filteredClientes.map(cliente => (
                          <Button
                            key={cliente.id}
                            variant="ghost"
                            className="w-full justify-between h-9 px-3 hover:bg-slate-700/40 text-muted-foreground hover:text-foreground transition-colors"
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
                            <span className="text-sm">{cliente.company_name}</span>
                            {formData.cliente_id === cliente.id && (
                              <Check className="h-4 w-4 text-blue-400 flex-shrink-0" />
                            )}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 text-center py-3">
                        Nenhum cliente encontrado
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {formData.cliente_nome && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs border transition-all",
                      formData.tipo === "receita"
                        ? "border-blue-600/40 bg-blue-950/40 text-blue-300"
                        : "border-red-600/40 bg-red-950/40 text-red-300"
                    )}
                  >
                    {formData.cliente_nome}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground/60 hover:text-foreground/60"
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

              <p className="text-xs text-muted-foreground/60 mt-1">
                Digite o nome do cliente se ele não estiver na lista
              </p>
              {clienteSearchTerm && !filteredClientes.some(c => c.company_name === clienteSearchTerm) && (
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full mt-2 transition-all border transition-colors",
                    formData.tipo === "receita"
                      ? "bg-blue-950/30 border-blue-700/40 hover:bg-blue-950/50 hover:border-blue-600/60 text-blue-300"
                      : "bg-red-950/30 border-red-700/40 hover:bg-red-950/50 hover:border-red-600/60 text-red-300"
                  )}
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
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isSaving}
              className="border-slate-700/60 hover:bg-slate-800/50 text-foreground/80"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCategoria}
              className={cn(
                "transition-all duration-300 shadow-lg",
                formData.tipo === "receita"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-blue-500/30"
                  : "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-red-500/30"
              )}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : editingCategoria ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
