import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, FolderPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DocumentFolder {
  id: string;
  name: string;
  description: string;
}

interface FolderManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  clientId: string;
  onSuccess: () => void;
}

export function FolderManagementDialog({
  open,
  onOpenChange,
  aircraftId,
  clientId,
  onSuccess
}: FolderManagementDialogProps) {
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDescription, setNewFolderDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      loadFolders();
    }
  }, [open, aircraftId, clientId]);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("flight_document_folders")
        .select("*")
        .eq("aircraft_id", aircraftId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      console.error("Error loading folders:", error);
      toast.error("Erro ao carregar pastas");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Digite o nome da pasta");
      return;
    }

    try {
      setCreating(true);

      const { data, error } = await supabase
        .from("flight_document_folders")
        .insert({
          aircraft_id: aircraftId,
          client_id: clientId,
          name: newFolderName.trim(),
          description: newFolderDescription.trim(),
          created_at: new Date().toISOString()
        })
        .select();

      if (error) throw error;

      if (data) {
        setFolders([data[0], ...folders]);
        setNewFolderName("");
        setNewFolderDescription("");
        toast.success("Pasta criada com sucesso!");
        onSuccess();
      }
    } catch (error) {
      console.error("Error creating folder:", error);
      toast.error("Erro ao criar pasta");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!window.confirm("Deseja realmente deletar esta pasta? Os documentos não serão removidos.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("flight_document_folders")
        .delete()
        .eq("id", folderId);

      if (error) throw error;

      setFolders(folders.filter(f => f.id !== folderId));
      toast.success("Pasta removida com sucesso!");
    } catch (error) {
      console.error("Error deleting folder:", error);
      toast.error("Erro ao remover pasta");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Gerenciar Pastas de Documentos
          </DialogTitle>
          <DialogDescription>
            Crie e organize pastas para categorizar seus documentos de aeronave
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Create New Folder */}
          <Card className="border-border bg-muted/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Criar Nova Pasta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="folder-name" className="text-xs font-medium">
                  Nome da Pasta *
                </Label>
                <Input
                  id="folder-name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Ex: Certificados de Aeronavegabilidade"
                  disabled={creating}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="folder-description" className="text-xs font-medium">
                  Legenda/Descrição
                </Label>
                <Textarea
                  id="folder-description"
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                  placeholder="Descreva o conteúdo desta pasta"
                  disabled={creating}
                  className="mt-1 min-h-16 resize-none text-xs"
                />
              </div>

              <Button
                onClick={handleCreateFolder}
                disabled={creating || !newFolderName.trim()}
                className="w-full gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Criar Pasta
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Existing Folders */}
          <div>
            <h3 className="font-medium text-sm mb-3">Pastas Existentes ({folders.length})</h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : folders.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Nenhuma pasta criada ainda. Crie a primeira pasta acima.
              </p>
            ) : (
              <div className="space-y-2">
                {folders.map((folder) => (
                  <Card key={folder.id} className="border-border">
                    <CardContent className="pt-4 flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-foreground">{folder.name}</p>
                        {folder.description && (
                          <p className="text-xs text-muted-foreground mt-1">{folder.description}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
