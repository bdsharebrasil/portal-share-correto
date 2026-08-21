import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, Trash2, Edit, Phone, Mail, MapPin, AlertCircle, LayoutGrid, List,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FIELD =
  "bg-background/60 border-border rounded-lg text-foreground placeholder:text-muted-foreground " +
  "focus-visible:border-cyan-500/60 focus-visible:ring-1 focus-visible:ring-cyan-500/30";
const LABEL = "text-muted-foreground font-medium mb-1.5 block text-xs";

interface Contato {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  cargo?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  observacoes?: string;
  created_at?: string;
}

type ViewMode = "cards" | "lista";
type SortMode = "nome" | "cidade";

const EMPTY_FORM = {
  nome: "", email: "", telefone: "", empresa: "", cargo: "",
  endereco: "", cidade: "", uf: "", observacoes: "",
};

const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

export default function Contatos() {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContato, setEditingContato] = useState<Contato | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sortMode, setSortMode] = useState<SortMode>("nome");
  const { toast } = useToast();

  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    void loadContatos();
  }, []);

  const loadContatos = async () => {
    try {
      setLoading(true);
      setTableError(null);

      const { data, error } = await supabase.from("contatos").select("*").order("nome");
      if (error) throw new Error(error.message || "Erro ao carregar contatos");

      setContatos((data || []) as Contato[]);
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
      const errorMsg = error instanceof Error ? error.message : "Erro desconhecido ao carregar contatos";
      setTableError(errorMsg);
      toast({ title: "Erro ao carregar contatos", description: errorMsg, variant: "destructive" });
      setContatos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (contato?: Contato) => {
    if (contato) {
      setEditingContato(contato);
      setFormData({
        nome: contato.nome || "",
        email: contato.email || "",
        telefone: contato.telefone || "",
        empresa: contato.empresa || "",
        cargo: contato.cargo || "",
        endereco: contato.endereco || "",
        cidade: contato.cidade || "",
        uf: contato.uf || "",
        observacoes: contato.observacoes || "",
      });
    } else {
      setEditingContato(null);
      setFormData({ ...EMPTY_FORM });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingContato(null);
  };

  const handleSave = async () => {
    try {
      if (!formData.nome) {
        toast({ title: "Campo obrigatório", description: "Nome é obrigatório", variant: "destructive" });
        return;
      }

      const { uf: _uf, ...payload } = formData;

      if (editingContato) {
        const { error } = await supabase.from("contatos").update(payload).eq("id", editingContato.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Contato atualizado com sucesso" });
      } else {
        const { error } = await supabase.from("contatos").insert([payload]);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Contato cadastrado com sucesso" });
      }

      handleCloseDialog();
      void loadContatos();
    } catch (error) {
      console.error("Erro ao salvar contato:", error);
      toast({ title: "Erro", description: "Erro ao salvar contato", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("contatos").delete().eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Contato excluído com sucesso" });
      void loadContatos();
    } catch (error) {
      console.error("Erro ao excluir contato:", error);
      toast({ title: "Erro", description: "Erro ao excluir contato", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const filteredContatos = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const list = contatos.filter(
      (contato) =>
        contato.nome?.toLowerCase().includes(term) ||
        contato.email?.toLowerCase().includes(term) ||
        contato.cidade?.toLowerCase().includes(term) ||
        contato.empresa?.toLowerCase().includes(term),
    );
    return [...list].sort((a, b) => {
      if (sortMode === "cidade") {
        const cmp = (a.cidade || "zzz").localeCompare(b.cidade || "zzz", "pt-BR");
        if (cmp !== 0) return cmp;
      }
      return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
    });
  }, [contatos, searchTerm, sortMode]);

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Contatos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie seus contatos importantes</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="w-full gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 sm:w-auto">
          <Plus className="h-4 w-4" /> Novo Contato
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, empresa, cidade ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${FIELD} h-11 pl-10`}
          />
        </div>

        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className={`${FIELD} h-11 sm:w-48`}>
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nome">Ordenar por nome</SelectItem>
            <SelectItem value="cidade">Ordenar por cidade</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-background/60 p-1">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            aria-label="Visualização em cards"
            className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition sm:flex-none ${
              viewMode === "cards" ? "bg-cyan-600 text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-4 w-4" /> Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("lista")}
            aria-label="Visualização em lista"
            className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition sm:flex-none ${
              viewMode === "lista" ? "bg-cyan-600 text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-4 w-4" /> Lista
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            <p className="text-sm text-muted-foreground">Carregando contatos...</p>
          </div>
        </div>
      ) : tableError ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex gap-4 p-6">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            <div className="flex-1 space-y-2">
              <p className="font-semibold text-destructive">Erro ao acessar tabela de contatos</p>
              <p className="text-sm text-muted-foreground">{tableError}</p>
              <Button size="sm" onClick={loadContatos} variant="outline" className="mt-3">
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : filteredContatos.length === 0 ? (
        <Card className="border-dashed border-border bg-card/40">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-secondary">
              <Phone className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-foreground">Nenhum contato encontrado</h3>
            <p className="mb-4 text-sm text-muted-foreground">Comece adicionando seu primeiro contato</p>
            <Button onClick={() => handleOpenDialog()} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Cadastrar Contato
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredContatos.map((contato) => (
            <Card key={contato.id} className="group border-border/80 bg-card/50 transition-colors hover:border-cyan-500/40">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/80 to-blue-500/80 text-sm font-semibold text-white">
                    {iniciais(contato.nome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-foreground">{contato.nome}</h3>
                    {contato.cargo && <p className="truncate text-xs text-muted-foreground">{contato.cargo}</p>}
                    {contato.empresa && (
                      <span className="mt-1.5 inline-block rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
                        {contato.empresa}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenDialog(contato)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-rose-400" onClick={() => setDeleteId(contato.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 border-t border-border/80 pt-3 text-xs">
                  {contato.telefone && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {contato.telefone}
                    </p>
                  )}
                  {contato.email && (
                    <p className="flex items-center gap-2 truncate text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">{contato.email}</span>
                    </p>
                  )}
                  {contato.cidade && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {contato.cidade}
                      {contato.uf && `, ${contato.uf}`}
                    </p>
                  )}
                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card/50">
          <div className="divide-y divide-border/80">
            {filteredContatos.map((contato) => (
              <div key={contato.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-card-secondary/30 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/80 to-blue-500/80 text-xs font-semibold text-white">
                    {iniciais(contato.nome)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{contato.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[contato.cargo, contato.empresa].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </div>
                <div className="min-w-0 flex-1 text-xs text-muted-foreground sm:text-right">
                  {contato.telefone && <p className="truncate">{contato.telefone}</p>}
                  {contato.email && <p className="truncate">{contato.email}</p>}
                </div>
                <div className="min-w-0 text-xs text-muted-foreground sm:w-40 sm:text-right">
                  {[contato.cidade, contato.uf].filter(Boolean).join(", ") || "—"}
                </div>
                <div className="flex gap-1 sm:justify-end">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenDialog(contato)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-rose-400" onClick={() => setDeleteId(contato.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContato ? "Editar Contato" : "Novo Contato"}</DialogTitle>
            <DialogDescription>
              {editingContato ? "Atualize as informações do contato" : "Adicione um novo contato"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className={LABEL} htmlFor="nome">Nome *</Label>
              <Input id="nome" className={FIELD} value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Nome completo" />
            </div>
            <div>
              <Label className={LABEL} htmlFor="email">E-mail</Label>
              <Input id="email" type="email" className={FIELD} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="contato@empresa.com" />
            </div>
            <div>
              <Label className={LABEL} htmlFor="telefone">Telefone</Label>
              <Input id="telefone" className={FIELD} value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <Label className={LABEL} htmlFor="empresa">Empresa</Label>
              <Input id="empresa" className={FIELD} value={formData.empresa} onChange={(e) => setFormData({ ...formData, empresa: e.target.value })} placeholder="Nome da empresa" />
            </div>
            <div>
              <Label className={LABEL} htmlFor="cargo">Cargo</Label>
              <Input id="cargo" className={FIELD} value={formData.cargo} onChange={(e) => setFormData({ ...formData, cargo: e.target.value })} placeholder="Cargo/função" />
            </div>
            <div>
              <Label className={LABEL} htmlFor="cidade">Cidade</Label>
              <Input id="cidade" className={FIELD} value={formData.cidade} onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} placeholder="São Paulo" />
            </div>
            <div>
              <Label className={LABEL} htmlFor="uf">UF</Label>
              <Input id="uf" className={FIELD} maxLength={2} value={formData.uf} onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase().slice(0, 2) })} placeholder="SP" />
            </div>
            <div className="sm:col-span-2">
              <Label className={LABEL} htmlFor="observacoes">Observações</Label>
              <Textarea id="observacoes" rows={3} className={FIELD} value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} />
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleCloseDialog}>Cancelar</Button>
            <Button className="w-full bg-cyan-600 hover:bg-cyan-500 sm:w-auto" onClick={handleSave}>
              {editingContato ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Contato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
