import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Search, Loader2, Check, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
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

  const renderCategoriaItem = (categoria: CategoriaFinanceiro) => (
    <div 
      key={categoria.id} 
      className={cn(
        "flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-sm",
        categoria.tipo === "receita" 
          ? "bg-emerald-50/50 border-emerald-200/60 dark:bg-emerald-950/20 dark:border-emerald-800/40" 
          : "bg-red-50/50 border-red-200/60 dark:bg-red-950/20 dark:border-red-800/40"
      )}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-semibold text-foreground">
            {categoria.nome}
          </h4>
          {categoria.categoria && (
            <Badge variant="secondary" className="text-xs">
              {categoria.categoria}
            </Badge>
          )}
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
          className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0" 
          onClick={() => handleDeleteCategoria(categoria.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
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
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">Gerenciar Categorias</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Organize as categorias de receita e despesa do sistema financeiro
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Busca */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar categoria..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="pl-10" 
            />
          </div>

          {/* Tabs para Receitas e Despesas */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
              <TabsTrigger 
                value="receita" 
                className="gap-2 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/40 dark:data-[state=active]:text-emerald-300"
              >
                <ArrowUpCircle className="h-4 w-4" />
                Receitas ({categoriasReceita.length})
              </TabsTrigger>
              <TabsTrigger 
                value="despesa" 
                className="gap-2 data-[state=active]:bg-red-100 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-900/40 dark:data-[state=active]:text-red-300"
              >
                <ArrowDownCircle className="h-4 w-4" />
                Despesas ({categoriasDespesa.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="receita" className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Categorias de entrada de valores
                  </span>
                </div>
                <Button 
                  onClick={() => handleOpenDialog()} 
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Receita
                </Button>
              </div>

              {categoriasReceita.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-emerald-200 rounded-lg bg-emerald-50/30 dark:bg-emerald-950/10 dark:border-emerald-800/30">
                  <TrendingUp className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
                  <p className="text-muted-foreground">Nenhuma categoria de receita encontrada</p>
                  <Button 
                    variant="link" 
                    onClick={() => handleOpenDialog()}
                    className="text-emerald-600 mt-2"
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
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Categorias de saída de valores
                  </span>
                </div>
                <Button 
                  onClick={() => handleOpenDialog()} 
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Despesa
                </Button>
              </div>

              {categoriasDespesa.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-red-200 rounded-lg bg-red-50/30 dark:bg-red-950/10 dark:border-red-800/30">
                  <TrendingDown className="h-10 w-10 mx-auto mb-3 text-red-400" />
                  <p className="text-muted-foreground">Nenhuma categoria de despesa encontrada</p>
                  <Button 
                    variant="link" 
                    onClick={() => handleOpenDialog()}
                    className="text-red-600 mt-2"
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

      {/* Dialog para adicionar/editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {formData.tipo === "receita" ? (
                <ArrowUpCircle className="h-5 w-5 text-emerald-500" />
              ) : (
                <ArrowDownCircle className="h-5 w-5 text-red-500" />
              )}
              {editingCategoria ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input 
                id="nome" 
                placeholder={formData.tipo === "receita" ? "Ex: Receita de Serviço" : "Ex: Despesa Operacional"} 
                value={formData.nome} 
                onChange={e => setFormData(prev => ({
                  ...prev,
                  nome: e.target.value
                }))} 
                className="mt-1" 
              />
            </div>

            <div>
              <Label htmlFor="tipo">Tipo *</Label>
              <Select 
                value={formData.tipo} 
                onValueChange={value => setFormData(prev => ({
                  ...prev,
                  tipo: value as "receita" | "despesa"
                }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">
                    <span className="flex items-center gap-2">
                      <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                      Receita
                    </span>
                  </SelectItem>
                  <SelectItem value="despesa">
                    <span className="flex items-center gap-2">
                      <ArrowDownCircle className="h-4 w-4 text-red-500" />
                      Despesa
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="categoria">Subcategoria (Opcional)</Label>
              <Input 
                id="categoria" 
                placeholder="Ex: Serviços, Materiais, etc." 
                value={formData.categoria} 
                onChange={e => setFormData(prev => ({
                  ...prev,
                  categoria: e.target.value
                }))} 
                className="mt-1" 
              />
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea 
                id="descricao" 
                placeholder="Descrição opcional da categoria" 
                value={formData.descricao} 
                onChange={e => setFormData(prev => ({
                  ...prev,
                  descricao: e.target.value
                }))} 
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
                <PopoverContent 
                  className="w-[280px] p-0" 
                  align="start" 
                  sideOffset={5} 
                  style={{ zIndex: 9999 }}
                >
                  <div className="p-3 space-y-2 bg-card">
                    <Input 
                      autoFocus 
                      placeholder="Buscar cliente..." 
                      value={clienteSearchTerm} 
                      onChange={e => setClienteSearchTerm(e.target.value)} 
                      className="h-9 bg-background border-border/50" 
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
              className={cn(
                formData.tipo === "receita" 
                  ? "bg-emerald-600 hover:bg-emerald-700" 
                  : "bg-red-600 hover:bg-red-700"
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
