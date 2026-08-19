import { useEffect, useMemo, useState } from "react";
import { Building2, Edit2, Plus, Search, Tag, Trash2, User, Users, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type Categoria = "share" | "particular" | "ambos" | "nenhum";

type Fornecedor = {
  id: string;
  nome_completo: string;
  apelido: string | null;
  cidade: string | null;
  telefone: string | null;
  documento: string | null;
  categoria: Categoria | null;
  criado_em: string;
};

const CATEGORIAS = [
  { value: "share", label: "Share", icon: Users, className: "bg-sky-500/10 text-sky-500 border-sky-500/30" },
  { value: "particular", label: "Particular", icon: User, className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  { value: "ambos", label: "Ambos", icon: Users, className: "bg-violet-500/10 text-violet-500 border-violet-500/30" },
  { value: "nenhum", label: "Nenhum", icon: Ban, className: "bg-muted text-muted-foreground border-border" },
] as const;

const emptyForm = {
  nome_completo: "",
  apelido: "",
  cidade: "",
  telefone: "",
  documento: "",
  categoria: "nenhum" as Categoria,
};

export function FornecedoresFavoritos() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<"todos" | Categoria>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const loadFornecedores = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("fornecedores_favoritos")
      .select("id, nome_completo, apelido, cidade, telefone, documento, categoria, criado_em")
      .order("nome_completo");

    if (error) {
      toast.error("Erro ao carregar fornecedores");
    } else {
      setFornecedores((data ?? []) as Fornecedor[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadFornecedores();
  }, []);

  const filteredFornecedores = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return fornecedores.filter((fornecedor) => {
      const categoria = fornecedor.categoria ?? "nenhum";
      const matchesCategory =
        categoriaFilter === "todos" ||
        categoria === categoriaFilter ||
        (categoria === "ambos" && (categoriaFilter === "share" || categoriaFilter === "particular"));
      const matchesSearch =
        !search ||
        fornecedor.nome_completo.toLowerCase().includes(search) ||
        fornecedor.apelido?.toLowerCase().includes(search) ||
        fornecedor.cidade?.toLowerCase().includes(search) ||
        fornecedor.documento?.includes(searchTerm.trim());

      return matchesCategory && matchesSearch;
    });
  }, [categoriaFilter, fornecedores, searchTerm]);

  const fornecedoresPorCategoria = useMemo(() => {
    const matches = (categoria: Categoria) =>
      filteredFornecedores.filter((fornecedor) =>
        categoria === "share" || categoria === "particular"
          ? fornecedor.categoria === categoria || fornecedor.categoria === "ambos"
          : fornecedor.categoria === categoria,
      );

    return {
      todos: filteredFornecedores,
      share: matches("share"),
      particular: matches("particular"),
      ambos: matches("ambos"),
      nenhum: matches("nenhum"),
    };
  }, [filteredFornecedores]);

  const handleOpenDialog = (fornecedor?: Fornecedor) => {
    setEditingFornecedor(fornecedor ?? null);
    setFormData(
      fornecedor
        ? {
            nome_completo: fornecedor.nome_completo,
            apelido: fornecedor.apelido ?? "",
            cidade: fornecedor.cidade ?? "",
            telefone: fornecedor.telefone ?? "",
            documento: fornecedor.documento ?? "",
            categoria: fornecedor.categoria ?? "nenhum",
          }
        : emptyForm,
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome_completo.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const payload = {
      nome_completo: formData.nome_completo.trim(),
      apelido: formData.apelido.trim() || null,
      cidade: formData.cidade.trim() || null,
      telefone: formData.telefone.trim() || null,
      documento: formData.documento.trim() || null,
      categoria: formData.categoria,
    };

    const { error } = editingFornecedor
      ? await supabase.from("fornecedores_favoritos").update(payload).eq("id", editingFornecedor.id)
      : await supabase.from("fornecedores_favoritos").insert(payload);

    if (error) {
      toast.error(error.message || "Erro ao salvar fornecedor");
      return;
    }

    toast.success(editingFornecedor ? "Fornecedor atualizado." : "Fornecedor adicionado.");
    setDialogOpen(false);
    void loadFornecedores();
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    const { error } = await supabase.from("fornecedores_favoritos").delete().eq("id", deleteConfirmId);
    if (error) {
      toast.error(error.message || "Erro ao excluir fornecedor");
      return;
    }

    toast.success("Fornecedor removido.");
    setDeleteConfirmId(null);
    void loadFornecedores();
  };

  const getCategoriaInfo = (categoria: Categoria | null) =>
    CATEGORIAS.find((item) => item.value === categoria) ?? CATEGORIAS[3];

  const renderList = (list: Fornecedor[]) => {
    if (list.length === 0) {
      return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum fornecedor nesta categoria.</p>;
    }

    return (
      <div className="space-y-3">
        {list.map((fornecedor) => {
          const categoria = getCategoriaInfo(fornecedor.categoria);
          const Icon = categoria.icon;
          return (
            <div key={fornecedor.id} className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-muted/20 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="truncate font-medium">{fornecedor.nome_completo}</h4>
                  {fornecedor.apelido && <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary"><Tag className="mr-1 h-3 w-3" />{fornecedor.apelido}</Badge>}
                  <Badge variant="outline" className={categoria.className}><Icon className="mr-1 h-3 w-3" />{categoria.label}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {fornecedor.documento && <span>CPF/CNPJ: {fornecedor.documento}</span>}
                  {fornecedor.cidade && <span>Cidade: {fornecedor.cidade}</span>}
                  {fornecedor.telefone && <span>Tel.: {fornecedor.telefone}</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" aria-label={`Editar ${fornecedor.nome_completo}`} onClick={() => handleOpenDialog(fornecedor)}><Edit2 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Excluir ${fornecedor.nome_completo}`} className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteConfirmId(fornecedor.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <CardTitle className="flex items-center gap-2 text-lg"><Building2 className="h-5 w-5 text-primary" />Fornecedores favoritos</CardTitle>
          <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Novo fornecedor</Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" placeholder="Buscar por nome, apelido, documento ou cidade" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
          <Select value={categoriaFilter} onValueChange={(value) => setCategoriaFilter(value as "todos" | Categoria)}><SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todas as categorias</SelectItem>{CATEGORIAS.map((categoria) => <SelectItem key={categoria.value} value={categoria.value}>{categoria.label}</SelectItem>)}</SelectContent></Select>
        </div>
        {isLoading ? <p className="py-12 text-center text-muted-foreground">Carregando...</p> : filteredFornecedores.length === 0 ? <div className="py-12 text-center text-muted-foreground"><Building2 className="mx-auto mb-4 h-12 w-12 opacity-30" /><p>Nenhum fornecedor encontrado.</p></div> : <Tabs defaultValue="todos"><TabsList className="mb-5 grid h-auto w-full grid-cols-2 gap-2 sm:grid-cols-5"><TabsTrigger value="todos">Todos ({fornecedoresPorCategoria.todos.length})</TabsTrigger><TabsTrigger value="share">Share ({fornecedoresPorCategoria.share.length})</TabsTrigger><TabsTrigger value="particular">Particular ({fornecedoresPorCategoria.particular.length})</TabsTrigger><TabsTrigger value="ambos">Ambos ({fornecedoresPorCategoria.ambos.length})</TabsTrigger><TabsTrigger value="nenhum">Outros ({fornecedoresPorCategoria.nenhum.length})</TabsTrigger></TabsList><TabsContent value="todos">{renderList(fornecedoresPorCategoria.todos)}</TabsContent><TabsContent value="share">{renderList(fornecedoresPorCategoria.share)}</TabsContent><TabsContent value="particular">{renderList(fornecedoresPorCategoria.particular)}</TabsContent><TabsContent value="ambos">{renderList(fornecedoresPorCategoria.ambos)}</TabsContent><TabsContent value="nenhum">{renderList(fornecedoresPorCategoria.nenhum)}</TabsContent></Tabs>}
      </CardContent>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogHeader><DialogTitle>{editingFornecedor ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader><div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label htmlFor="nome">Nome completo *</Label><Input id="nome" className="mt-1.5" value={formData.nome_completo} onChange={(event) => setFormData((current) => ({ ...current, nome_completo: event.target.value }))} /></div><div><Label htmlFor="apelido">Apelido</Label><Input id="apelido" className="mt-1.5" value={formData.apelido} onChange={(event) => setFormData((current) => ({ ...current, apelido: event.target.value }))} /></div><div><Label>Categoria</Label><Select value={formData.categoria} onValueChange={(value) => setFormData((current) => ({ ...current, categoria: value as Categoria }))}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIAS.map((categoria) => <SelectItem key={categoria.value} value={categoria.value}>{categoria.label}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="documento">CPF ou CNPJ</Label><Input id="documento" className="mt-1.5" value={formData.documento} onChange={(event) => setFormData((current) => ({ ...current, documento: event.target.value }))} /></div><div><Label htmlFor="cidade">Cidade</Label><Input id="cidade" className="mt-1.5" value={formData.cidade} onChange={(event) => setFormData((current) => ({ ...current, cidade: event.target.value }))} /></div><div><Label htmlFor="telefone">Telefone</Label><Input id="telefone" className="mt-1.5" value={formData.telefone} onChange={(event) => setFormData((current) => ({ ...current, telefone: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave}>{editingFornecedor ? "Salvar" : "Adicionar"}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(deleteConfirmId)} onOpenChange={(open) => !open && setDeleteConfirmId(null)}><DialogContent><DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader><p className="text-muted-foreground">Tem certeza que deseja remover este fornecedor? Esta ação não pode ser desfeita.</p><DialogFooter><Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button><Button variant="destructive" onClick={handleDelete}>Excluir</Button></DialogFooter></DialogContent></Dialog>
    </Card>
  );
}
