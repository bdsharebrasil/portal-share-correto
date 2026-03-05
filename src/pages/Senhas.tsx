import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Key, Plus, Edit2, Trash2, Lock, AlertCircle, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { extractSetor } from "@/utils/extractSetor";

interface Senha {
  id: string;
  site: string;
  login: string;
  senha: string;
  setor: string | null;
  observacoes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export default function Senhas() {
  const [senhas, setSenhas] = useState<Senha[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [openFolder, setOpenFolder] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    site: "",
    login: "",
    senha: "",
    observacoes: "",
    setor: "",
  });

  const [setorSuggestion, setSetorSuggestion] = useState<string | null>(null);

  const loadSenhas = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("senhas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar senhas");
        return;
      }

      setSenhas(data || []);
    } catch (error) {
      toast.error("Erro ao carregar senhas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSenhas();
  }, [loadSenhas]);

  const resetForm = () => {
    setFormData({ site: "", login: "", senha: "", observacoes: "", setor: "" });
    setSetorSuggestion(null);
    setEditingId(null);
  };

  const handleOpenDialog = (senha?: Senha) => {
    if (senha) {
      setFormData({
        site: senha.site,
        login: senha.login,
        senha: senha.senha,
        observacoes: senha.observacoes || "",
        setor: senha.setor || "",
      });
      setSetorSuggestion(null);
      setEditingId(senha.id);
    } else {
      resetForm();
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.site.trim() || !formData.login.trim() || !formData.senha.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      setLoading(true);
      const setorFinal = formData.setor.trim() || extractSetor(formData.site) || null;

      if (editingId) {
        const { error } = await supabase
          .from("senhas")
          .update({
            site: formData.site,
            login: formData.login,
            senha: formData.senha,
            setor: setorFinal,
            observacoes: formData.observacoes || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Senha atualizada com sucesso");
      } else {
        const { error } = await supabase.from("senhas").insert({
          site: formData.site,
          login: formData.login,
          senha: formData.senha,
          setor: setorFinal,
          observacoes: formData.observacoes || null,
        });

        if (error) throw error;
        toast.success("Senha criada com sucesso");
      }

      setShowDialog(false);
      resetForm();
      await loadSenhas();
    } catch (error) {
      toast.error("Erro ao salvar senha");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja deletar esta senha?")) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.from("senhas").delete().eq("id", id);

      if (error) throw error;
      toast.success("Senha deletada com sucesso");
      await loadSenhas();
    } catch (error) {
      toast.error("Erro ao deletar senha");
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPassword((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Agrupa senhas por setor
  const gruposSetor = senhas.reduce(
    (acc, senha) => {
      const setor = senha.setor || "Outros";
      if (!acc[setor]) acc[setor] = [];
      acc[setor].push(senha);
      return acc;
    },
    {} as Record<string, Senha[]>
  );

  const setoresOrdenados = Object.keys(gruposSetor).sort((a, b) => {
    if (a === "Outros") return 1;
    if (b === "Outros") return -1;
    return a.localeCompare(b);
  });

  const renderSenhaCard = (senha: Senha) => (
    <Card key={senha.id} className="border-border/60 hover:border-primary/50 transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg text-foreground truncate">
              {senha.site}
            </CardTitle>
            <p className="text-sm text-muted-foreground truncate mt-1">
              {senha.login}
            </p>
          </div>
          <div className="flex gap-1 ml-2 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(senha)} className="h-8 w-8 p-0">
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(senha.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Senha</Label>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 bg-muted p-2 rounded text-sm font-mono text-foreground truncate">
              {showPassword[senha.id] ? senha.senha : "•".repeat(Math.min(senha.senha.length, 12))}
            </div>
            <Button variant="outline" size="sm" onClick={() => togglePasswordVisibility(senha.id)} className="px-2">
              {showPassword[senha.id] ? "Ocultar" : "Ver"}
            </Button>
          </div>
        </div>
        {senha.observacoes && (
          <div>
            <Label className="text-xs text-muted-foreground">Observações</Label>
            <p className="text-sm text-foreground mt-1 bg-muted p-2 rounded">{senha.observacoes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Folder icon SVG (blue)
  const BlueFolderIcon = () => (
    <svg viewBox="0 0 120 100" className="w-full h-full drop-shadow-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Folder tab */}
      <path d="M10 25 L10 15 Q10 8 17 8 L42 8 Q46 8 48 12 L54 22 Q56 25 60 25 Z" fill="hsl(var(--primary))" opacity="0.85" />
      {/* Folder body */}
      <rect x="6" y="25" width="108" height="68" rx="8" fill="hsl(var(--primary))" />
      {/* Folder highlight */}
      <rect x="6" y="25" width="108" height="12" rx="6" fill="hsl(var(--primary))" opacity="0.6" />
      {/* Subtle shine */}
      <rect x="10" y="30" width="100" height="4" rx="2" fill="white" opacity="0.15" />
    </svg>
  );

  // Inside a folder view
  if (openFolder) {
    const senhasDoSetor = gruposSetor[openFolder] || [];
    return (
      <Layout>
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setOpenFolder(null)} className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </Button>
              <div className="bg-primary/10 p-3 rounded-lg">
                <Key className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{openFolder}</h1>
                <p className="text-sm text-muted-foreground">
                  {senhasDoSetor.length} senha{senhasDoSetor.length !== 1 ? "s" : ""} nesta pasta
                </p>
              </div>
            </div>
            <Button onClick={() => {
              resetForm();
              setFormData(prev => ({ ...prev, setor: openFolder }));
              setShowDialog(true);
            }} className="gap-2" disabled={loading}>
              <Plus className="h-4 w-4" />
              Nova Senha
            </Button>
          </div>

          {/* Password cards */}
          {senhasDoSetor.length === 0 ? (
            <div className="text-center py-12">
              <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">Nenhuma senha nesta pasta</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {senhasDoSetor.map((senha) => renderSenhaCard(senha))}
            </div>
          )}

          {/* Dialog */}
          {renderDialog()}
        </div>
      </Layout>
    );
  }

  function renderDialog() {
    return (
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Senha" : "Nova Senha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="site">Site/Sistema *</Label>
              <Input
                id="site"
                value={formData.site}
                onChange={(e) => {
                  setFormData({ ...formData, site: e.target.value });
                  setSetorSuggestion(extractSetor(e.target.value));
                }}
                placeholder="Ex: TARIFAS DECEA"
                disabled={loading}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="setor">Setor (Pasta)</Label>
                {setorSuggestion && !formData.setor && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, setor: setorSuggestion })}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Usar: {setorSuggestion}
                  </button>
                )}
              </div>
              <Input
                id="setor"
                value={formData.setor}
                onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                placeholder={setorSuggestion ? `Sugestão: ${setorSuggestion}` : "Ex: PR-MDL, TESTE"}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                O setor agrupará as senhas em pastas. Deixe vazio para usar a automática.
              </p>
            </div>
            <div>
              <Label htmlFor="login">Login/Usuário *</Label>
              <Input
                id="login"
                value={formData.login}
                onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                placeholder="Ex: 255771"
                disabled={loading}
              />
            </div>
            <div>
              <Label htmlFor="senha">Senha *</Label>
              <Input
                id="senha"
                type="password"
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                placeholder="Digite a senha"
                disabled={loading}
              />
            </div>
            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Ex: Senha para procedimentos de manutenção"
                disabled={loading}
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {editingId ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Main folders view
  return (
    <Layout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Key className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Senhas</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie as senhas dos sistemas e aeronaves
              </p>
            </div>
          </div>
          <Button onClick={() => handleOpenDialog()} className="gap-2" disabled={loading}>
            <Plus className="h-4 w-4" />
            Nova Senha
          </Button>
        </div>

        {/* Alert */}
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardContent className="flex gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">Informações sensíveis</p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                As senhas são armazenadas com segurança. Apenas usuários com acesso ao sistema podem visualizá-las.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Folders */}
        {loading && senhas.length === 0 ? (
          <div className="text-center py-12">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">Carregando senhas...</p>
          </div>
        ) : senhas.length === 0 ? (
          <div className="text-center py-12">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-6">Nenhuma senha cadastrada</p>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar primeira senha
            </Button>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-4">Pastas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {setoresOrdenados.map((setor) => {
                const count = gruposSetor[setor].length;
                return (
                  <button
                    key={setor}
                    onClick={() => setOpenFolder(setor)}
                    className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all duration-200 cursor-pointer"
                  >
                    <div className="w-24 h-20 relative group-hover:scale-105 transition-transform duration-200">
                      <BlueFolderIcon />
                    </div>
                    <div className="text-center w-full">
                      <p className="text-sm font-semibold text-foreground truncate">{setor}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {count} {count === 1 ? "senha" : "senhas"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {renderDialog()}
      </div>
    </Layout>
  );
}
