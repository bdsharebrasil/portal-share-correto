import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  Loader2, 
  Check, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Sparkles, 
  X,
  ChevronDown,
  Folder,
  FolderOpen
} from "lucide-react";
import { useCategoriasFinanceiro, CategoriaFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { toast } from "sonner";
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

  const [showDialog, setShowDialog] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<CategoriaFinanceiro | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("receita");
  const [isSaving, setIsSaving] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"edit" | "delete" | null>(null);
  
  // Estado para controlar quais grupos estão abertos (Accordion)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    nome: "",
    tipo: "receita" as "receita" | "despesa",
    grupo_categoria: "",
    descricao: "",
    reembolsavel: false
  });

  // --- Lógica de Filtros ---

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

  // --- Lógica de Agrupamento (Accordion) ---

  const groupData = (data: CategoriaFinanceiro[]) => {
    const groups: Record<string, CategoriaFinanceiro[]> = {};
    
    data.forEach(item => {
      // Agrupa por grupo_categoria primeiro
      const groupName = item.grupo_categoria?.trim() || "SEM GRUPO";
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(item);
    });
  
    // Ordena os grupos alfabeticamente
    return Object.keys(groups).sort().reduce((obj, key) => {
      obj[key] = groups[key].sort((a, b) => a.nome.localeCompare(b.nome));
      return obj;
    }, {} as Record<string, CategoriaFinanceiro[]>);
  };

  const groupedReceitas = useMemo(() => groupData(categoriasReceita), [categoriasReceita]);
  const groupedDespesas = useMemo(() => groupData(categoriasDespesa), [categoriasDespesa]);

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  // Função para abrir dialog com grupo pré-selecionado
  const handleOpenDialogWithGroup = (groupName: string, type: "receita" | "despesa") => {
    // Se o grupo contém "REEMBOLSÁVEL" e é despesa, marca automaticamente como reembolsável
    const isReembolsavelGroup = groupName.toUpperCase().includes("REEMBOLSÁVEL");
    const shouldMarkReembolsavel = type === "despesa" && isReembolsavelGroup;

    setEditingCategoria(null);
    setFormData({
      nome: "",
      tipo: type,
      grupo_categoria: groupName,
      descricao: "",
      reembolsavel: shouldMarkReembolsavel
    });
    setShowDialog(true);
  };

  // --- Handlers do CRUD ---

  const handleOpenDialog = (categoria?: CategoriaFinanceiro) => {
    if (categoria) {
      setEditingCategoria(categoria);
      setFormData({
        nome: categoria.nome,
        tipo: categoria.tipo,
        grupo_categoria: categoria.grupo_categoria || "",
        descricao: categoria.descricao || "",
        reembolsavel: categoria.reembolsavel || false
      });
    } else {
      setEditingCategoria(null);
      setFormData({
        nome: "",
        tipo: activeTab as "receita" | "despesa",
        grupo_categoria: "",
        descricao: "",
        reembolsavel: false
      });
    }
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
          grupo_categoria: formData.grupo_categoria || null,
          descricao: formData.descricao,
          reembolsavel: formData.reembolsavel
        });
        if (success) toast.success("Categoria atualizada com sucesso!");
      } else {
        success = await addCategoria({
          nome: formData.nome,
          tipo: formData.tipo,
          grupo_categoria: formData.grupo_categoria || null,
          descricao: formData.descricao,
          reembolsavel: formData.reembolsavel
        });
        if (success) toast.success("Categoria criada com sucesso!");
      }
      if (success) {
        setShowDialog(false);
        setFormData({
          nome: "",
          tipo: "receita",
          grupo_categoria: "",
          descricao: "",
          reembolsavel: false
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

  // --- Renderização dos Itens ---

  const renderCategoriaItem = (categoria: CategoriaFinanceiro) => (
    <div
      key={categoria.id}
      className={cn(
        "group relative flex items-center justify-between p-5 rounded-xl border-2 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:scale-102 cursor-pointer",
        selectionMode && selectedIds.has(categoria.id)
          ? categoria.tipo === "receita"
            ? "border-slate-500/80 bg-card/20"
            : "border-amber-600/80 bg-amber-900/20"
          : categoria.tipo === "receita"
            ? "border-border/60 hover:border-slate-500/80 hover:bg-card/80"
            : "border-amber-700/60 hover:border-amber-600/80 hover:bg-card/80"
      )}
      onClick={() => selectionMode && toggleSelection(categoria.id)}
    >
      {selectionMode && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <div className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
            selectedIds.has(categoria.id)
              ? categoria.tipo === "receita"
                ? "bg-slate-500/30 border-slate-500"
                : "bg-amber-600/30 border-amber-600"
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
              ? "bg-slate-500/10"
              : "bg-amber-600/10"
          )}>
            {categoria.tipo === "receita" ? (
              <ArrowUpCircle className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ArrowDownCircle className="w-4 h-4 text-amber-600" />
            )}
          </div>
          <div>
            <h4 className="font-semibold text-foreground">
              {categoria.nome}
            </h4>
          </div>
        </div>
        {categoria.descricao && (
          <p className="text-sm text-muted-foreground ml-11">
            {categoria.descricao}
          </p>
        )}
        {categoria.reembolsavel && (
          <div className="mt-2 ml-11">
            <Badge
              variant="outline"
              className={cn(
                "text-xs border",
                categoria.tipo === "receita"
                  ? "border-border/30 bg-card/20 text-muted-foreground"
                  : "border-amber-700/30 bg-amber-900/20 text-amber-500"
              )}
            >
              Reembolsável
            </Badge>
          </div>
        )}
      </div>
    </div>
  );

  // Componente interno para renderizar lista agrupada
  const RenderGroupedList = ({ groups, type }: { groups: Record<string, CategoriaFinanceiro[]>, type: 'receita' | 'despesa' }) => {
    const groupKeys = Object.keys(groups);

    if (groupKeys.length === 0) {
      return (
        <div className={cn(
        "text-center py-12 border-2 border-dashed rounded-lg backdrop-blur-sm transition-all duration-300",
        type === 'receita'
          ? "border-border/30 bg-card/20 hover:border-border/50"
          : "border-amber-700/30 bg-amber-900/20 hover:border-amber-600/50"
      )}>
        {type === 'receita' ? (
          <TrendingUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        ) : (
          <TrendingDown className="h-10 w-10 mx-auto mb-3 text-amber-600" />
        )}
          <p className="text-muted-foreground/80">Nenhuma categoria encontrada</p>
          <Button
            variant="link"
            onClick={() => handleOpenDialog()}
            className={cn("mt-2", type === 'receita' ? "text-muted-foreground" : "text-amber-600")}
          >
            Criar primeira categoria
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {groupKeys.map((groupName) => {
          const items = groups[groupName];
          const isExpanded = expandedGroups.has(groupName);
          
          const headerColor = type === 'receita'
            ? (isExpanded ? "bg-card-secondary/40 border-slate-500/30" : "bg-card-secondary/40 border-border/40")
            : (isExpanded ? "bg-amber-900/40 border-amber-600/30" : "bg-card-secondary/40 border-border/40");

          const iconColor = type === 'receita' ? "text-muted-foreground" : "text-amber-600";

          return (
            <div key={groupName} className="rounded-xl overflow-hidden border border-border/50 shadow-sm group">
              {/* CABEÇALHO DO GRUPO (CLICÁVEL) */}
              <div
                onClick={() => toggleGroup(groupName)}
                className={cn(
                  "flex items-center justify-between p-4 cursor-pointer transition-all duration-300 border-b",
                  headerColor,
                  !isExpanded && "border-b-transparent hover:bg-card-secondary/60"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-background/30 border border-white/5", iconColor)}>
                    {isExpanded ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm md:text-base flex items-center gap-2">
                      {groupName}
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-background/50 text-muted-foreground border-border">
                        {items.length}
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground hidden md:block">
                      {items.map(i => i.nome).slice(0, 3).join(", ")}
                      {items.length > 3 && "..."}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDialogWithGroup(groupName, type);
                    }}
                    className={cn(
                      "p-1.5 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 hover:bg-white/10",
                      type === 'receita'
                        ? "text-muted-foreground hover:text-muted-foreground"
                        : "text-amber-500 hover:text-amber-400"
                    )}
                    title={`Adicionar ${type} neste grupo`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <div className={cn(
                    "p-1 rounded-full transition-transform duration-300",
                    isExpanded ? "rotate-180 bg-white/10" : ""
                  )}>
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* CONTEÚDO DO GRUPO (OS CARDS) */}
              <div className={cn(
                "grid gap-3 transition-all duration-300 ease-in-out bg-card/20",
                isExpanded ? "grid-rows-[1fr] opacity-100 p-4" : "grid-rows-[0fr] opacity-0 p-0"
              )}>
                <div className="overflow-hidden min-h-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map(item => renderCategoriaItem(item))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-2xl bg-gradient-to-br from-card/50 to-background/50 backdrop-blur-xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-slate-500/20 to-slate-600/20 border border-slate-500/30">
                  <Sparkles className="w-5 h-5 text-muted-foreground" />
                </div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-300 via-slate-400 to-slate-400 bg-clip-text text-transparent">
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
              className="pl-10 bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus:border-slate-500/60 transition-colors"
            />
          </div>

          {/* Tabs para Receitas e Despesas */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6 bg-card-secondary/40 border border-border/40 p-1 rounded-lg">
              <TabsTrigger
                value="receita"
                className="gap-2 rounded-md transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-600/80 data-[state=active]:to-slate-700/80 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-slate-500/20 data-[state=inactive]:text-muted-foreground hover:text-foreground"
              >
                <ArrowUpCircle className="h-4 w-4" />
                Receitas ({categoriasReceita.length})
              </TabsTrigger>
              <TabsTrigger
                value="despesa"
                className="gap-2 rounded-md transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600/80 data-[state=active]:to-amber-700/80 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-amber-600/20 data-[state=inactive]:text-muted-foreground hover:text-foreground"
              >
                <ArrowDownCircle className="h-4 w-4" />
                Despesas ({categoriasDespesa.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="receita" className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-gradient-to-r from-slate-400 to-slate-500 shadow-lg shadow-slate-500/50"></div>
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
                        disabled={selectedIds.size !== 1}
                        className={cn("bg-muted hover:bg-secondary text-white", selectedIds.size !== 1 && "opacity-50 cursor-not-allowed")}
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
                        className="text-muted-foreground border-border/30 hover:bg-card/20"
                      >
                        Selecionar
                      </Button>
                      <Button
                        onClick={() => handleOpenDialog()}
                        size="sm"
                        className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-card-secondary text-white shadow-lg shadow-slate-500/30 transition-all duration-300 hover:scale-105"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Receita
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* RENDERIZAÇÃO AGRUPADA RECEITA */}
              <RenderGroupedList groups={groupedReceitas} type="receita" />
            </TabsContent>

            <TabsContent value="despesa" className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 shadow-lg shadow-amber-600/50"></div>
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
                        disabled={selectedIds.size !== 1}
                        className={cn("bg-muted hover:bg-secondary text-white", selectedIds.size !== 1 && "opacity-50 cursor-not-allowed")}
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
                        className="text-amber-600 border-amber-700/30 hover:bg-amber-900/20"
                      >
                        Selecionar
                      </Button>
                      <Button
                        onClick={() => handleOpenDialog()}
                        size="sm"
                        className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-lg shadow-amber-600/30 transition-all duration-300 hover:scale-105"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Despesa
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* RENDERIZAÇÃO AGRUPADA DESPESA */}
              <RenderGroupedList groups={groupedDespesas} type="despesa" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog para confirmar ações nas selecionadas */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-md bg-gradient-to-br from-card/95 to-background/95 border-border/50 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className={cn(
              "flex items-center gap-3 text-lg font-bold",
              actionType === "delete" ? "text-red-400" : "text-muted-foreground"
            )}>
              {actionType === "delete" ? (
                <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-slate-500/20 border border-slate-500/30">
                  <Edit2 className="h-5 w-5 text-muted-foreground" />
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
              className="border-border/60 hover:bg-card-secondary/50 text-foreground/80"
            >
              Cancelar
            </Button>
            <Button
              onClick={executeSelectedAction}
              className={cn(
                "transition-all duration-300 shadow-lg",
                actionType === "delete"
                  ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-red-500/30"
                  : "bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-card-secondary text-white shadow-slate-500/30"
              )}
            >
              {actionType === "delete" ? "Deletar" : "Editar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para adicionar/editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm w-[95vw] max-h-[90vh] bg-gradient-to-br from-card/95 to-background/95 border-border/50 backdrop-blur-xl flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
            <DialogTitle className={cn(
              "flex items-center gap-3 text-lg font-bold",
              formData.tipo === "receita"
                ? "text-muted-foreground"
                : "text-amber-600"
            )}>
              {formData.tipo === "receita" ? (
                <div className="p-2 rounded-lg bg-slate-500/20 border border-slate-500/30">
                  <ArrowUpCircle className="h-5 w-5 text-muted-foreground" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-amber-600/20 border border-amber-600/30">
                  <ArrowDownCircle className="h-5 w-5 text-amber-600" />
                </div>
              )}
              <span>{editingCategoria ? "Editar Categoria" : "Nova Categoria"}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
            <div>
              <Label htmlFor="grupo_categoria" className="text-foreground/90">Grupo *</Label>
              <Input
                id="grupo_categoria"
                placeholder="Ex: DESPESAS PARTICULARES, DESPESAS REEMBOLSÁVEIS, IMPOSTOS"
                value={formData.grupo_categoria}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  grupo_categoria: e.target.value
                }))}
                className="mt-1 bg-background border-border text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500/60 transition-colors"
              />
              <p className="text-xs text-muted-foreground/60 mt-1">
                Define o grupo/agrupamento da categoria
              </p>
            </div>

            <div>
              <Label htmlFor="nome" className="text-foreground/90">Categoria *</Label>
              <Input
                id="nome"
                placeholder={formData.tipo === "receita" ? "Ex: Receita de Serviço" : "Ex: Aluguel, Combustível"}
                value={formData.nome}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  nome: e.target.value
                }))}
                className="mt-1 bg-background border-border text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500/60 transition-colors"
              />
              <p className="text-xs text-muted-foreground/60 mt-1">
                Nome da categoria dentro do grupo
              </p>
            </div>

            <div>
              <Label htmlFor="tipo" className="text-foreground/90">Fluxo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={value => setFormData(prev => ({
                  ...prev,
                  tipo: value as "receita" | "despesa"
                }))}
              >
                <SelectTrigger className="mt-1 bg-background border-border text-foreground focus:border-blue-500/60 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="receita">
                    <span className="flex items-center gap-2">
                      <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
                      Receita
                    </span>
                  </SelectItem>
                  <SelectItem value="despesa">
                    <span className="flex items-center gap-2">
                      <ArrowDownCircle className="h-4 w-4 text-amber-600" />
                      Despesa
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
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
                className="mt-1 bg-background border-border text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500/60 transition-colors"
              />
            </div>

            {formData.tipo === "despesa" && (
              <div>
                <Label htmlFor="reembolsavel" className="text-foreground/90">Despesa reembolsável</Label>
                <Select
                  value={formData.reembolsavel ? "sim" : "nao"}
                  onValueChange={value => setFormData(prev => ({
                    ...prev,
                    reembolsavel: value === "sim"
                  }))}
                >
                  <SelectTrigger className="mt-1 bg-background border-border text-foreground focus:border-amber-600/60 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground">
                    <SelectItem value="sim">
                      <span className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-amber-500" />
                        Sim
                      </span>
                    </SelectItem>
                    <SelectItem value="nao">
                      <span className="flex items-center gap-2">
                        <X className="h-4 w-4 text-muted-foreground" />
                        Não
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Indique se esta despesa será reembolsada pelos clientes
                </p>
              </div>
            )}

          </div>

          <DialogFooter className="px-6 py-4 flex-shrink-0 border-t border-border/30 gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isSaving}
              className="border-border/60 hover:bg-card-secondary/50 text-foreground/80 flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCategoria}
              className={cn(
                "transition-all duration-300 shadow-lg flex-1",
                formData.tipo === "receita"
                  ? "bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-card-secondary text-white shadow-slate-500/30"
                  : "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-amber-600/30"
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