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
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Download,
  Eye,
  FileText,
  Folder,
  LayoutGrid,
  List,
  Lock,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { DocumentViewer } from "@/components/DocumentViewer";
import { useUserRole } from "@/hooks/useUserRole";
import { AnimatedFolder } from "@/components/AnimatedFolder";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  type: "file";
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
  const [documentViewMode, setDocumentViewMode] = useState<"grid" | "list">("list");
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentSort, setDocumentSort] = useState<"name" | "date" | "size">("name");
  const [documentSortDirection, setDocumentSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [documentAuthors, setDocumentAuthors] = useState<Record<string, string>>({});

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Verificar se a pasta é restrita e se o usuário tem permissão
      const { data: folderData, error: folderError } = await supabase
        .from("pastas_documentos")
        .select("restrita, criado_por")
        .eq("id", folderId)
        .maybeSingle();

      if (folderError || !folderData) return;

      if (folderData.restrita) {
        const { data: permission, error: permError } = await supabase
          .from("permissoes_pasta_documentos")
          .select("id")
          .eq("pasta_id", folderId)
          .eq("usuario_id", user.id)
          .maybeSingle();

        const isFolderOwner = user.id === folderData.criado_por;

        if (permError || (!permission && !isFolderOwner)) {
          // Usuário não tem permissão e não é o criador da pasta
          return;
        }
      }

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

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

      // Filtrar pastas restritas: o criador e os usuários com permissão conseguem ver
      let filteredFolders = folders || [];
      if (filteredFolders.length > 0) {
        const restrictedFolderIds = filteredFolders
          .filter((f) => f.restrita)
          .map((f) => f.id);

        if (restrictedFolderIds.length > 0) {
          const { data: permissions, error: permError } = await supabase
            .from("permissoes_pasta_documentos")
            .select("pasta_id")
            .eq("usuario_id", user.id)
            .in("pasta_id", restrictedFolderIds);

          if (permError) {
            console.error("Erro ao verificar permissões:", permError);
          }

          const userPermittedFolderIds = new Set(
            (permissions || []).map((p) => p.pasta_id)
          );

          filteredFolders = filteredFolders.filter((folder) => {
            if (!folder.restrita) return true; // Pastas públicas sempre aparecem
            if (folder.criado_por === user.id) return true;
            return userPermittedFolderIds.has(folder.id);
          });
        }
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

      const authorIds = Array.from(new Set((docs || []).map((doc) => doc.enviado_por).filter(Boolean)));
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", authorIds);
        const authorMap: Record<string, string> = {};
        (profiles || []).forEach((profile) => {
          authorMap[profile.id] = profile.full_name || "Usuário";
        });
        setDocumentAuthors(authorMap);
      } else {
        setDocumentAuthors({});
      }

      const folderItems: DocumentItem[] = filteredFolders.map((f) => ({
        ...f,
        type: "folder" as const,
      }));
      const docItems: DocumentItem[] = (docs || []).map((d) => ({
        ...d,
        type: "file" as const,
      })) as DocumentItem[];

      setItems([...folderItems, ...docItems]);

      filteredFolders.forEach((folder) => {
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

    if (isRestricted && folderData) {
      const allowedUserIds = Array.from(new Set([user.id, ...selectedUsers]));
      const permissions = allowedUserIds.map((userId) => ({
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

  const handleOpenFolder = async (folder: DocumentFolder) => {
    // Validar permissão para pastas restritas
    if (folder.restrita) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const { data: permission, error } = await supabase
        .from("permissoes_pasta_documentos")
        .select("id")
        .eq("pasta_id", folder.id)
        .eq("usuario_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao verificar permissão:", error);
        toast.error("Erro ao verificar permissão");
        return;
      }

      const isFolderOwner = folder.criado_por === user.id;
      if (!permission && !isFolderOwner) {
        toast.error("Você não tem permissão para acessar esta pasta");
        return;
      }
    }

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

  const handleRenameFile = async (doc: Document) => {
    const nextName = window.prompt("Editar legenda do documento", doc.nome || "");
    if (nextName === null) return;

    const normalizedName = nextName.trim();
    const { error } = await supabase
      .from("documentos_internos")
      .update({ nome: normalizedName })
      .eq("id", doc.id);

    if (error) {
      toast.error("Erro ao renomear documento");
      return;
    }

    toast.success("Legenda atualizada");
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
    anchor.download = doc.nome || "documento";
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

  const fileItems = items.filter((item) => item.type === "file") as Document[];
  const filteredDocuments = fileItems.filter((item) => {
    const query = documentSearch.trim().toLowerCase();
    if (!query) return true;

    const formattedDate = new Date(item.criado_em).toLocaleDateString("pt-BR");
    return (
      item.nome.toLowerCase().includes(query) ||
      formattedDate.toLowerCase().includes(query)
    );
  });

  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    let comparison = 0;
    if (documentSort === "date") {
      comparison = new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
    } else if (documentSort === "size") {
      comparison = Number(a.tamanho_arquivo || 0) - Number(b.tamanho_arquivo || 0);
    } else {
      comparison = (a.nome || "").localeCompare(b.nome || "", "pt-BR");
    }
    return documentSortDirection === "asc" ? comparison : -comparison;
  });

  const toggleDocumentSelection = (documentId: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
    setSelectedDocumentIds((previous) =>
      previous.includes(documentId)
        ? previous.filter((id) => id !== documentId)
        : [...previous, documentId]
    );
  };

  const toggleAllDocuments = () => {
    const shouldEnableSelection = !isSelectionMode;
    setIsSelectionMode(shouldEnableSelection);
    setSelectedDocumentIds((previous) =>
      shouldEnableSelection ? sortedDocuments.map((document) => document.id) : []
    );
  };

  const handleBulkDelete = async () => {
    const selectedDocuments = fileItems.filter((document) => selectedDocumentIds.includes(document.id));
    if (selectedDocuments.length === 0) return;
    if (!window.confirm(`Deseja excluir ${selectedDocuments.length} arquivo(s) selecionado(s)?`)) return;

    setLoading(true);
    const storageResult = await supabase.storage
      .from("documentos")
      .remove(selectedDocuments.map((document) => document.caminho_arquivo));
    const { error } = await supabase
      .from("documentos_internos")
      .delete()
      .in("id", selectedDocuments.map((document) => document.id));
    setLoading(false);

    if (storageResult.error || error) {
      toast.error("Não foi possível excluir todos os arquivos");
      return;
    }

    setSelectedDocumentIds([]);
    toast.success("Arquivos excluídos com sucesso");
    loadDocuments();
  };

  const changeDocumentSort = (sort: "name" | "date" | "size") => {
    if (documentSort === sort) {
      setDocumentSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setDocumentSort(sort);
    setDocumentSortDirection("asc");
  };

  const formatDocumentDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).replace(" de ", " ");

  const getAuthorName = (document: Document) => documentAuthors[document.enviado_por] || "Usuário";
  const getAuthorInitials = (document: Document) =>
    getAuthorName(document).split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Documentos</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {currentFolder && (
            <Button variant="outline" size="sm" onClick={handleGoBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowNewFolder((prev) => !prev)}>
            <Folder className="mr-2 h-4 w-4 text-primary" />
            Nova Pasta
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowUpload((prev) => !prev)}>
            <Upload className="mr-2 h-4 w-4 text-primary" />
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
                          Apenas os usuarios selecionados poderão visualizar esta pasta
                        </p>
                      </div>
                    </div>

                    {isRestricted && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-white-foreground" />
                          Selecione quem pode ter acesso
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
                              <p className="text-sm text-white-foreground text-center py-4">
                                Nenhum usuario encontrado
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                        {selectedUsers.length > 0 && (
                          <p className="text-xs text-white-foreground">
                            {selectedUsers.length} usuario(s) selecionado(s)
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
                  <p className="text-xs text-white-foreground">
                    Tipos aceitos: PDF, Word, Excel, PowerPoint, Imagens e outros
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload-caption">Titulo</Label>
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
              <h2 className="text-xl font-semibold text-white-foreground mb-4">Pastas</h2>
              <div className="flex flex-row items-stretch gap-[66px] overflow-auto mx-[23px] px-[42px]">
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

          {fileItems.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white-foreground" />
                  <Input
                    value={documentSearch}
                    onChange={(event) => setDocumentSearch(event.target.value)}
                    placeholder="Buscar arquivo..."
                    className="h-10 w-full pl-9"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                    <Checkbox
                      checked={isSelectionMode}
                      onCheckedChange={toggleAllDocuments}
                    />
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Selecionar
                    </span>
                  </div>

                  {selectedDocumentIds.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={loading}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir ({selectedDocumentIds.length})
                    </Button>
                  )}

                  <div className="flex rounded-md border border-border bg-background p-1">
                    <Button
                      type="button"
                      variant={documentViewMode === "list" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDocumentViewMode("list")}
                      aria-label="Visualização em lista"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant={documentViewMode === "grid" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDocumentViewMode("grid")}
                      aria-label="Visualização em grade"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {sortedDocuments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-white-foreground">
                  Nenhum documento encontrado para essa busca.
                </div>
              ) : documentViewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {sortedDocuments.map((item) => (
                    <Card key={item.id} className="transition-colors hover:bg-accent/50 rounded-xl">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex w-full items-start gap-3 text-left">
                          <FileText className="h-8 w-8 flex-shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-white font-medium">{item.nome?.trim() || "Sem legenda"}</p>
                            <p className="mt-1 text-xs text-white-foreground">{formatFileSize(item.tamanho_arquivo)}</p>
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-white-foreground">
                              <CalendarDays className="h-3 w-3" />
                              {new Date(item.criado_em).toLocaleDateString("pt-BR")}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewFile(item)}>
                                <Eye className="h-4 w-4 mr-2" /> Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadFile(item)}>
                                <Download className="h-4 w-4 mr-2" /> Baixar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRenameFile(item)}>
                                <Pencil className="h-4 w-4 mr-2" /> Renomear
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteDocument(item)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => changeDocumentSort("name")}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              Nome
                              {documentSort === "name" && (
                                documentSortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                              )}
                            </button>
                          </th>
                          <th className="hidden md:table-cell px-4 py-3">
                            <button
                              type="button"
                              onClick={() => changeDocumentSort("date")}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              Data de Adição
                              {documentSort === "date" && (
                                documentSortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                              )}
                            </button>
                          </th>
                          <th className="hidden lg:table-cell px-4 py-3">
                            <button
                              type="button"
                              onClick={() => changeDocumentSort("size")}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              Tamanho
                              {documentSort === "size" && (
                                documentSortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                              )}
                            </button>
                          </th>
                          <th className="hidden xl:table-cell px-4 py-3">Criado por</th>
                          <th className="hidden xl:table-cell px-4 py-3">Última Atualização</th>
                          <th className="w-10 px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDocuments.map((item) => {
                          const isSelected = selectedDocumentIds.includes(item.id);
                          return (
                            <tr
                              key={item.id}
                              className={cn(
                                "border-b border-border/40 last:border-0 transition-colors cursor-pointer hover:bg-accent/30",
                                isSelected && "bg-primary/5"
                              )}
                              onClick={() => handleViewFile(item)}
                            >
                              {isSelectionMode && (
                                <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleDocumentSelection(item.id)}
                                  />
                                </td>
                              )}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <FileText className="h-5 w-5 flex-shrink-0 text-primary" />
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-foreground">{item.nome?.trim() || "Sem legenda"}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="hidden md:table-cell px-4 py-3 text-muted-foreground whitespace-nowrap">
                                {formatDocumentDate(item.criado_em)}
                              </td>
                              <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground whitespace-nowrap">
                                {formatFileSize(item.tamanho_arquivo)}
                              </td>
                              <td className="hidden xl:table-cell px-4 py-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                                    {getAuthorInitials(item)}
                                  </div>
                                  <span className="truncate text-foreground text-xs">{getAuthorName(item)}</span>
                                </div>
                              </td>
                              <td className="hidden xl:table-cell px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                                {formatDocumentDate(item.criado_em)}
                              </td>
                              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleViewFile(item)}>
                                      <Eye className="h-4 w-4 mr-2" /> Visualizar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDownloadFile(item)}>
                                      <Download className="h-4 w-4 mr-2" /> Baixar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleRenameFile(item)}>
                                      <Pencil className="h-4 w-4 mr-2" /> Renomear
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteDocument(item)} className="text-destructive">
                                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
