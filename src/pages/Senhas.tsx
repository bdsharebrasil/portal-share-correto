import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Key, Plus, Edit2, Trash2, Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Senha {
  id: string;
  site: string;
  login: string;
  senha: string;
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

  const [formData, setFormData] = useState({
    site: "",
    login: "",
    senha: "",
    observacoes: "",
  });

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
    setFormData({ site: "", login: "", senha: "", observacoes: "" });
    setEditingId(null);
  };

  const handleOpenDialog = (senha?: Senha) => {
    if (senha) {
      setFormData({
        site: senha.site,
        login: senha.login,
        senha: senha.senha,
        observacoes: senha.observacoes || "",
      });
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

      if (editingId) {
        const { error } = await supabase
          .from("senhas")
          .update({
            site: formData.site,
            login: formData.login,
            senha: formData.senha,
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
    setShowPassword((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

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
          <Button
            onClick={() => handleOpenDialog()}
            className="gap-2"
            disabled={loading}
          >
            <Plus className="h-4 w-4" />
            Nova Senha
          </Button>
        </div>

        {/* Alert */}
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardContent className="flex gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Informações sensíveis
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                As senhas são armazenadas com segurança. Apenas usuários com acesso ao sistema podem visualizá-las.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Grid de Senhas */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {senhas.map((senha) => (
              <Card
                key={senha.id}
                className="border-border hover:border-primary/50 transition-colors"
              >
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
                    <div className="flex gap-2 ml-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(senha)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(senha.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Senha */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Senha</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-muted p-2 rounded text-sm font-mono text-foreground truncate">
                        {showPassword[senha.id]
                          ? senha.senha
                          : "•".repeat(Math.min(senha.senha.length, 12))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => togglePasswordVisibility(senha.id)}
                        className="px-2"
                      >
                        {showPassword[senha.id] ? "Ocultar" : "Ver"}
                      </Button>
                    </div>
                  </div>

                  {/* Observações */}
                  {senha.observacoes && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Observações</Label>
                      <p className="text-sm text-foreground mt-1 bg-muted p-2 rounded">
                        {senha.observacoes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dialog de Criar/Editar */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Senha" : "Nova Senha"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="site">Site/Sistema *</Label>
                <Input
                  id="site"
                  value={formData.site}
                  onChange={(e) =>
                    setFormData({ ...formData, site: e.target.value })
                  }
                  placeholder="Ex: TARIFAS DECEA"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="login">Login/Usuário *</Label>
                <Input
                  id="login"
                  value={formData.login}
                  onChange={(e) =>
                    setFormData({ ...formData, login: e.target.value })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, senha: e.target.value })
                  }
                  placeholder="Digite a senha"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData({ ...formData, observacoes: e.target.value })
                  }
                  placeholder="Ex: Senha para procedimentos de manutenção"
                  disabled={loading}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false);
                    resetForm();
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  {editingId ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
