import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ArrowLeft, Download, Eye, FileText, Folder, Lock, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { DocumentViewer } from "@/components/DocumentViewer";
import { useUserRole } from "@/hooks/useUserRole";
import { AnimatedFolder } from "@/components/AnimatedFolder";

interface DocumentFolder {
  id: string;
  nome: string;
  pasta_pai_id: string | null;
  criado_por: string;
  criado_em: string;
  restrita?: boolean;
}

// Interface alinhada ao schema: documentos_internos
interface Document {
  id: string;
  nome: string;
  caminho_arquivo: string;
  pasta_id: string | null;
  enviado_por: string;
  criado_em: string;
  tipo_arquivo: string;
  tamanho_arquivo: number;
}

interface UserProfile {
  id: string;
  full_name: string | null;
}

type DocumentItem =
  | (DocumentFolder & { type: "folder" })
  | (Document & { type: "file" });

const formatFileSize = (size: number) => {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / 1024).toFixed(1)} KB`;
};

const buildUniqueFileName = (originalName: string) => {
  const extension = originalName.split(".").pop();
  const uniqueId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return extension ? `${uniqueId}.${extension}` : uniqueId;
};

interface Project {
  id: string;
  image: string;
  title: string;
}

export default function Documentos() {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<DocumentFolder[]>([]);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [folderContents, setFolderContents] = useState<Record<string, Project[]>>({});

  // Restricted folder states
  const [isRestricted, setIsRestricted] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const { isAdmin, isGestorMaster } = useUserRole();
  const canCreateRestrictedFolder = isAdmin || isGestorMaster;

  // Load users for selection
  useEffect(() => {
    const loadUsers = async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .eq("employment_status", "ativo")
        .order("full_name");
      if (!error && data) {
        setUsers(data);
      }
    };
    if (canCreateRestrictedFolder) {
      loadUsers();
    }
  }, [canCreateRestrictedFolder]);

  const getPlaceholderImageForFile = (fileType: string): string => {
    if (fileType.includes("image")) {
      return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%234A90E2' width='100' height='100'/%3E%3Ctext x='50' y='55' font-size='14' fill='white' text-anchor='middle' dominant-baseline='middle'%3EIMG%3C/text%3E%3C/svg%3E";
    } else if (fileType.includes("pdf")) {
      return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23E24A4A' width='100' height='100'/%3E%3Ctext x='50' y='55' font-size='14' fill='white' text-anchor='middle' dominant-baseline='middle'%3EPDF%3C/text%3E%3C/svg%3E";
    } else if (fileType.includes("word") || fileType.includes("document")) {
      return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%234A90E2' width='100' height='100'/%3E%3Ctext x='50' y='55' font-size='14' fill='white' text-anchor='middle' dominant-baseline='middle'%3EDOC%3C/text%3E%3C/svg%3E";
    } else if (fileType.includes("sheet") || fileType.includes("excel")) {
      return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%2321A121' width='100' height='100'/%3E%3Ctext x='50' y='55' font-size='14' fill='white' text-anchor='middle' dominant-baseline='middle'%3EXLS%3C/text%3E%3C/svg%3E";
    }
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23888' width='100' height='100'/%3E%3Ctext x='50' y='55' font-size='12' fill='white' text-anchor='middle' dominant-baseline='middle'%3EFILE%3C/text%3E%3C/svg%3E";
  };

  const loadFolderContents = useCallback(async (folderId: string) => {
    try {
      const { data: subfolders, error: subfoldersError } = await supabase
        .from("pastas_documentos")
        .select("id, nome")
        .eq("pasta_pai_id", folderId)
        .order("nome");

      if (subfoldersError) return;

      const { data: docs, error: docsError } = await supabase
        .from("documentos_internos")
        .select("id, nome, tipo_arquivo, caminho_arquivo, tamanho_arquivo, enviado_por, criado_em")
        .eq("pasta_id", folderId)
        .order("nome")
        .limit(10);

      if (docsError) return;

      const projects: Project[] = [];

      (subfolders || []).forEach((subfolder) => {
        projects.push({
          id: subfolder.id,
          title: subfolder.nome,
          image:
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23FFA500' width='100' height='100' rx='10'/%3E%3Cpath d='M15 40 L35 20 L85 20 L85 85 Q85 90 80 90 L20 90 Q15 90 15 85 Z' fill='%23FFB833'/%3E%3C/svg%3E",
        });
      });

      (docs || []).forEach((doc) => {
        projects.push({
          id: doc.id,
          title: doc.nome,
          image: getPlaceholderImageForFile(doc.tipo_arquivo),
        });
      });

      setFolderContents((prev) => ({ ...prev, [folderId]: projects }));
    } catch (error) {
      console.error("Erro ao carregar conteúdo da pasta:", error);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      // Buscar pastas
      let foldersQuery = supabase.from("pastas_documentos").select("*");
      if (currentFolder === null) {
        foldersQuery = foldersQuery.is("pasta_pai_id", null);
      } else {
        foldersQuery = foldersQuery.eq("pasta_pai_id", currentFolder);
      }
      const { data: folders, error: foldersError } = await foldersQuery.order("nome");
      if (foldersError) {
        toast.error("Erro ao carregar pastas");
        return;
      }

      // Buscar documentos
      let docsQuery = supabase.from("documentos_internos").select("*");
      if (currentFolder === null) {
        docsQuery = docsQuery.is("pasta_id", null);
      } else {
        docsQuery = docsQuery.eq("pasta_id", currentFolder);
      }
      const { data: docs, error: docsError } = await docsQuery.order("nome");
      if (docsError) {
        toast.error("Erro ao carregar documentos");
        return;
      }

      const folderItems: DocumentItem[] = (folders || []).map((f) => ({
        ...f,
        type: "folder" as const,
      }));
      const docItems: DocumentItem[] = (docs || []).map((d) => ({
        ...d,
        type: "file" as const,
      }));

      setItems([...folderItems, ...docItems]);

      (folders || []).forEach((folder) => {
        loadFolderContents(folder.id);
      });
    } catch (error) {
      console.error("Erro ao carregar:", error);
      toast.error("Erro ao carregar documentos");
    }
  }, [currentFolder, loadFolderContents]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Digite um nome para a pasta");
      return;
    }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Usuário não autenticado");
      setLoading(false);
      return;
    }

    const { data: folderData, error } = await supabase
      .from("pastas_documentos")
      .insert({
        nome: newFolderName.trim(),
        pasta_pai_id: currentFolder,
        criado_por: user.id,
        restrita: canCreateRestrictedFolder ? isRestricted : false,
      })
      .select()
      .single();

    if (error) {
      setLoading(false);
      toast.error("Erro ao criar pasta");
      return;
    }

    if (isRestricted && selectedUsers.length > 0 && folderData) {
      const permissions = selectedUsers.map((userId) => ({
        pasta_id: folderData.id,
        usuario_id: userId,
        criado_por: user.id,
      }));
      const { error: permError } = await supabase
        .from("permissoes_pasta_documentos")
        .insert(permissions);
      if (permError) {
        console.error("Erro ao definir permissões:", permError);
        toast.warning("Pasta criada, mas houve erro ao definir permissões");
      }
    }

    setLoading(false);
    toast.success("Pasta criada com sucesso");
    setNewFolderName("");
    setIsRestricted(false);
    setSelectedUsers([]);
    setShowNewFolder(false);
    loadDocuments();
  };

  const handleUploadFile = async () => {
    if (!uploadFile) {
      toast.error("Selecione um arquivo");
      return;
    }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Usuário não autenticado");
      setLoading(false);
      return;
    }

    const uniqueFileName = buildUniqueFileName(uploadFile.name);
    const filePath = currentFolder
      ? `${currentFolder}/${uniqueFileName}`
      : uniqueFileName;

    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(filePath, uploadFile);

    if (uploadError) {
      setLoading(false);
      toast.error("Erro ao fazer upload do arquivo");
      return;
    }

    const { error: dbError } = await supabase.from("documentos_internos").insert({
      nome: uploadFile.name,
      caminho_arquivo: filePath,
      pasta_id: currentFolder,
      tipo_arquivo: uploadFile.type,
      tamanho_arquivo: uploadFile.size,
      enviado_por: user.id,
      // criado_em é preenchido automaticamente pelo default now()
    });

    setLoading(false);
    if (dbError) {
      toast.error("Erro ao salvar informações do arquivo");
      return;
    }

    toast.success("Arquivo enviado com sucesso");
    setUploadFile(null);
    setUploadCaption("");
    setShowUpload(false);
    loadDocuments();
  };

  const handleOpenFolder = (folder: DocumentFolder) => {
    setCurrentFolder(folder.id);
    setFolderPath((prev) => [...prev, folder]);
  };

  const handleGoBack = () => {
    setFolderPath((prev) => {
      const updated = prev.slice(0, -1);
      setCurrentFolder(updated.length > 0 ? updated[updated.length - 1].id : null);
      return updated;
    });
  };

  const handleDeleteDocument = async (item: DocumentItem) => {
    const isFolder = item.type === "folder";
    const message = `Deseja excluir ${isFolder ? "a pasta" : "o arquivo"} "${item.nome}"?`;
    if (!window.confirm(message)) return;

    if (item.type === "file") {
      await supabase.storage.from("documentos").remove([item.caminho_arquivo]);
      const { error } = await supabase
        .from("documentos_internos")
        .delete()
        .eq("id", item.id);
      if (error) {
        toast.error("Erro ao excluir");
        return;
      }
    } else {
      const { error } = await supabase
        .from("pastas_documentos")
        .delete()
        .eq("id", item.id);
      if (error) {
        toast.error("Erro ao excluir");
        return;
      }
    }

    toast.success("Excluído com sucesso");
    loadDocuments();
  };

  const handleDownloadFile = async (doc: Document) => {
    const { data, error } = await supabase.storage
      .from("documentos")
      .download(doc.caminho_arquivo);
    if (error || !data) {
      toast.error("Erro ao baixar arquivo");
      return;
    }
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = doc.nome;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleViewFile = async (doc: Document) => {
    const { data: publicUrlData } = supabase.storage
      .from("documentos")
      .getPublicUrl(doc.caminho_arquivo);
    if (!publicUrlData?.publicUrl) {
      toast.error("Erro ao visualizar arquivo");
      return;
    }
    setPreviewUrl(publicUrlData.publicUrl);
    setPreviewDoc(doc);
  };

  const handleClosePreview = (open: boolean) => {
    if (!open) {
      setPreviewDoc(null);
      setPreviewUrl("");
    }
  };

  const handleResetToRoot = () => {
    setCurrentFolder(null);
    setFolderPath([]);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Documentos</h1>
          <p className="text-muted-foreground mt-2">Gerencie documentos e arquivos importantes</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {currentFolder && (
            <Button variant="outline" size="sm" onClick={handleGoBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowNewFolder((prev) => !prev)}>
            <Folder className="mr-2 h-4 w-4" />
            Nova Pasta
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowUpload((prev) => !prev)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>

        {showNewFolder && (
          <Card className="rounded-xl border-border/50">
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-folder-name">Nome da Pasta</Label>
                  <Input
                    id="new-folder-name"
                    value={newFolderName}
                    onChange={(event) => setNewFolderName(event.target.value)}
                    placeholder="Digite o nome da pasta"
                  />
                </div>

                {canCreateRestrictedFolder && (
                  <>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <Switch
                        id="is-restricted"
                        checked={isRestricted}
                        onCheckedChange={setIsRestricted}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="is-restricted"
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Lock className="h-4 w-4 text-primary" />
                          Pasta com acesso restrito
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Apenas os colaboradores selecionados poderão visualizar esta pasta
                        </p>
                      </div>
                    </div>

                    {isRestricted && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          Selecione os colaboradores com acesso
                        </Label>
                        <ScrollArea className="h-48 border rounded-lg p-3">
                          <div className="space-y-2">
                            {users.map((user) => (
                              <div
                                key={user.id}
                                className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md cursor-pointer"
                                onClick={() => toggleUserSelection(user.id)}
                              >
                                <Checkbox
                                  checked={selectedUsers.includes(user.id)}
                                  onCheckedChange={() => toggleUserSelection(user.id)}
                                />
                                <span className="text-sm">{user.full_name || "Sem nome"}</span>
                              </div>
                            ))}
                            {users.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                Nenhum colaborador encontrado
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                        {selectedUsers.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {selectedUsers.length} colaborador(es) selecionado(s)
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleCreateFolder} disabled={loading}>
                    Criar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewFolder(false);
                      setIsRestricted(false);
                      setSelectedUsers([]);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {showUpload && (
          <Card className="rounded-xl border-border/50">
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="upload-file">Arquivo</Label>
                  <Input
                    id="upload-file"
                    type="file"
                    onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tipos aceitos: PDF, Word, Excel, PowerPoint, Imagens e outros
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload-caption">Legenda (opcional)</Label>
                  <Textarea
                    id="upload-caption"
                    value={uploadCaption}
                    onChange={(event) => setUploadCaption(event.target.value)}
                    placeholder="Adicione uma descrição para o arquivo"
                    rows={2}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleUploadFile} disabled={loading || !uploadFile}>
                    Enviar
                  </Button>
                  <Button variant="outline" onClick={() => setShowUpload(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {items.some((item) => item.type === "folder") && (
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">Pastas</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items
                  .filter((item) => item.type === "folder")
                  .map((item) => (
                    <div key={item.id} className="relative group">
                      <AnimatedFolder
                        title={item.nome}
                        projects={folderContents[item.id] || []}
                        onClick={() => handleOpenFolder(item as DocumentFolder)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-0 h-8 w-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        onClick={() => handleDeleteDocument(item)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      {(item as DocumentFolder).restrita && (
                        <Lock className="h-4 w-4 absolute top-2 right-10 text-amber-500" />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {items.some((item) => item.type === "file") && (
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">Documentos</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {items
                  .filter((item) => item.type === "file")
                  .map((item) => (
                    <Card key={item.id} className="transition-colors hover:bg-accent/50 rounded-xl">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex w-full items-start gap-3 text-left">
                          <FileText className="h-8 w-8 flex-shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.nome}</p>
                            {item.type === "file" && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatFileSize((item as Document).tamanho_arquivo)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleViewFile(item as Document)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDownloadFile(item as Document)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDeleteDocument(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </div>

        {items.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p>Nenhum documento ou pasta nesta localização</p>
          </div>
        )}

        <Dialog open={Boolean(previewDoc)} onOpenChange={handleClosePreview}>
          <DialogContent className="max-h-[95vh] max-w-6xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {previewDoc?.nome}
              </DialogTitle>
            </DialogHeader>
            {previewDoc && (
              <DocumentViewer
                url={previewUrl}
                fileName={previewDoc.nome}
                fileType={previewDoc.tipo_arquivo}
                onDownload={() => handleDownloadFile(previewDoc)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}