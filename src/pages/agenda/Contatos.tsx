import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Edit, Phone, Mail, MapPin, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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

export default function Contatos() {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContato, setEditingContato] = useState<Contato | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    empresa: "",
    cargo: "",
    endereco: "",
    cidade: "",
    uf: "",
    observacoes: "",
  });

  useEffect(() => {
    loadContatos();
  }, []);

  const loadContatos = async () => {
    try {
      setLoading(true);
      setTableError(null);

      const { data, error } = await supabase
        .from("contatos")
        .select("*")
        .order("nome");

      if (error) {
        console.error("Erro ao carregar contatos:", error);
        const errorMsg = error.message || "Erro ao carregar contatos";
        setTableError(errorMsg);
        throw new Error(errorMsg);
      }

      setContatos(data || []);
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
      const errorMsg = error instanceof Error ? error.message : "Erro desconhecido ao carregar contatos";
      setTableError(errorMsg);
      toast({
        title: "Erro ao carregar contatos",
        description: errorMsg,
        variant: "destructive",
      });
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
      setFormData({
        nome: "",
        email: "",
        telefone: "",
        empresa: "",
        cargo: "",
        endereco: "",
        cidade: "",
        uf: "",
        observacoes: "",
      });
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
        toast({
          title: "Campo obrigatório",
          description: "Nome é obrigatório",
          variant: "destructive",
        });
        return;
      }

      if (editingContato) {
        const { error } = await supabase
          .from("contatos")
          .update(formData)
          .eq("id", editingContato.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Contato atualizado com sucesso" });
      } else {
        const { error } = await supabase
          .from("contatos")
          .insert([formData]);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Contato cadastrado com sucesso" });
      }

      handleCloseDialog();
      loadContatos();
    } catch (error) {
      console.error("Erro ao salvar contato:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar contato",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("contatos").delete().eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Contato excluído com sucesso" });
      loadContatos();
    } catch (error) {
      console.error("Erro ao excluir contato:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir contato",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const filteredContatos = contatos.filter(
    (contato) =>
      contato.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contato.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contato.empresa?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Contatos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus contatos importantes
          </p>
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          size="lg"
          className="gap-2 shadow-md rounded-lg bg-teal-700 hover:bg-teal-600"
        >
          <Plus className="h-4 w-4" />
          Novo Contato
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email ou empresa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-11"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm">Carregando contatos...</p>
          </div>
        </div>
      ) : tableError ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6 flex gap-4">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="font-semibold text-destructive">Erro ao acessar tabela de contatos</p>
              <p className="text-sm text-muted-foreground">{tableError}</p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={loadContatos} variant="outline">
                  Tentar novamente
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const error = new Error(tableError);
                    console.error("Erro detalhado:", error);
                  }}
                  variant="outline"
                >
                  Ver detalhes no console
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : filteredContatos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Phone className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Nenhum contato cadastrado
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              Comece adicionando seu primeiro contato
            </p>
            <Button onClick={() => handleOpenDialog()} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Cadastrar Contato
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContatos.map((contato) => (
            <Card
              key={contato.id}
              className="hover:shadow-md transition-shadow group"
            >
              <CardContent className="p-5">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">
                      {contato.nome}
                    </h3>
                    {contato.cargo && (
                      <p className="text-sm text-muted-foreground">
                        {contato.cargo}
                      </p>
                    )}
                    {contato.empresa && (
                      <Badge variant="secondary" className="mt-2">
                        {contato.empresa}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 border-t border-border pt-3">
                    {contato.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`mailto:${contato.email}`}
                          className="text-primary hover:underline"
                        >
                          {contato.email}
                        </a>
                      </div>
                    )}
                    {contato.telefone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`tel:${contato.telefone}`}
                          className="text-primary hover:underline"
                        >
                          {contato.telefone}
                        </a>
                      </div>
                    )}
                    {contato.cidade && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {contato.cidade}
                          {contato.uf && `, ${contato.uf}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDialog(contato)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(contato.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingContato ? "Editar Contato" : "Novo Contato"}
            </DialogTitle>
            <DialogDescription>
              {editingContato
                ? "Atualize as informações do contato"
                : "Adicione um novo contato"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                placeholder="Nome completo"
              />
            </div>

            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="contato@empresa.com"
              />
            </div>

            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) =>
                  setFormData({ ...formData, telefone: e.target.value })
                }
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <Label htmlFor="empresa">Empresa</Label>
              <Input
                id="empresa"
                value={formData.empresa}
                onChange={(e) =>
                  setFormData({ ...formData, empresa: e.target.value })
                }
                placeholder="Nome da empresa"
              />
            </div>

            <div>
              <Label htmlFor="cargo">Cargo</Label>
              <Input
                id="cargo"
                value={formData.cargo}
                onChange={(e) =>
                  setFormData({ ...formData, cargo: e.target.value })
                }
                placeholder="Cargo/função"
              />
            </div>

            <div>
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={formData.cidade}
                onChange={(e) =>
                  setFormData({ ...formData, cidade: e.target.value })
                }
                placeholder="São Paulo"
              />
            </div>

            <div>
              <Label htmlFor="uf">UF</Label>
              <Input
                id="uf"
                value={formData.uf}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    uf: e.target.value.toUpperCase().slice(0, 2),
                  })
                }
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              className="sm:mr-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-teal-700 hover:bg-teal-600"
            >
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
              Tem certeza que deseja excluir este contato? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
