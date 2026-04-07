import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Folder, FolderOpen, Plus, MoreVertical, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FlightDocumentUploadDialog } from "./FlightDocumentUploadDialog";
import { FolderManagementDialog } from "./FolderManagementDialog";

interface DocumentFolder {
  id: string;
  name: string;
  nome?: string;
  description: string;
  descricao?: string;
  created_at: string;
  criado_em?: string;
}

interface FlightDocument {
  id: string;
  name: string;
  nome?: string;
  description?: string;
  descricao?: string;
  file_path: string;
  caminho_arquivo?: string;
  file_size: number;
  tamanho_arquivo?: number;
  created_at: string;
  criado_em?: string;
  folder_id?: string;
  expiry_date?: string;
}

interface DocumentsByFolder {
  [folderId: string]: {
    folder: DocumentFolder | null;
    documents: FlightDocument[];
  };
}

interface AeronaveDocumentosViewerProps {
  aircraftId: string;
  clientId: string;
  isAdmin?: boolean;
}

export function AeronaveDocumentosViewer({
  aircraftId,
  clientId,
  isAdmin = false,
}: AeronaveDocumentosViewerProps) {
  const [documentsByFolder, setDocumentsByFolder] = useState<DocumentsByFolder>({});
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [folderManagementDialogOpen, setFolderManagementDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [aircraftId, clientId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load documents filtered by aircraft
      const { data: docsData, error: docsError } = await supabase
        .from("flight_documents" as any)
        .select("*")
        .eq("id_aeronave", aircraftId)
        .order("criado_em", { ascending: false });

      if (docsError) throw docsError;

      // Group documents by document_type
      const grouped: DocumentsByFolder = {};

      // Create a single folder for all documents
      grouped["all-documents"] = {
        folder: {
          id: "all-documents",
          name: "Todos os Documentos",
          description: "Documentação da aeronave",
          created_at: new Date().toISOString(),
        },
        documents: docsData || [],
      };

      setDocumentsByFolder(grouped);

      // Auto-expand the documents folder
      setExpandedFolders(new Set(["all-documents"]));
    } catch (error) {
      console.error("Error loading documents:", error);
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("flight-documents")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filePath.split("/").pop() || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  const deleteDocument = async (docId: string, filePath: string) => {
    if (!window.confirm("Deseja realmente deletar este documento?")) {
      return;
    }

    try {
      // Delete from storage
      await supabase.storage.from("flight-documents").remove([filePath]);

      // Delete from database
      await supabase.from("flight_documents" as any).delete().eq("id", docId);

      toast.success("Documento removido com sucesso");
      await loadData();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Erro ao remover documento");
    }
  };

  const toggleFolderExpanded = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
  };

  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      return {
        status: "expired",
        label: "Vencido",
        className: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700",
      };
    }

    if (daysUntilExpiry <= 30) {
      return {
        status: "expiring-soon",
        label: `Vence em ${daysUntilExpiry}d`,
        className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700",
      };
    }

    return {
      status: "valid",
      label: `Válido até ${new Date(expiryDate).toLocaleDateString("pt-BR")}`,
      className: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700",
    };
  };

  if (loading) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Carregando documentos...</p>
        </CardContent>
      </Card>
    );
  }

  const hasDocuments = Object.values(documentsByFolder).some(
    (item) => item.documento.length > 0
  );

  return (
    <>
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <FileText className="h-5 w-5 text-primary" />
                Documentos da Aeronave
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1">
                Certificados, inspeções e registros organizados por categoria
              </CardDescription>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button
                  onClick={() => setFolderManagementDialogOpen(true)}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Folder className="h-4 w-4" />
                  Pastas
                </Button>
                <Button
                  onClick={() => setUploadDialogOpen(true)}
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Enviar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {!hasDocuments ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhum documento disponível
              </p>
              {isAdmin && (
                <Button
                  onClick={() => setUploadDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  Enviar primeiro documento
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(documentsByFolder)
                .sort((a, b) => {
                  // Sort by folder creation date, with no-folder at the end
                  if (a[0] === "no-folder") return 1;
                  if (b[0] === "no-folder") return -1;
                  return (
                    new Date(b[1].folder?.criado_em || 0).getTime() -
                    new Date(a[1].folder?.criado_em || 0).getTime()
                  );
                })
                .map(([folderId, { folder, documents }]) => {
                  if (documents.length === 0) return null;

                  const isExpanded = expandedFolders.has(folderId);

                  return (
                    <Collapsible
                      key={folderId}
                      open={isExpanded}
                      onOpenChange={() => toggleFolderExpanded(folderId)}
                    >
                      <CollapsibleTrigger asChild>
                        <button className="w-full">
                          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors hover:bg-muted/70 cursor-pointer">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {isExpanded ? (
                                <FolderOpen className="h-5 w-5 text-primary flex-shrink-0" />
                              ) : (
                                <Folder className="h-5 w-5 text-primary flex-shrink-0" />
                              )}
                              <div className="text-left flex-1 min-w-0">
                                {folder ? (
                                  <>
                                    <p className="font-semibold text-foreground text-sm">
                                      {folder.nome}
                                    </p>
                                    {folder.descricao && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {folder.descricao}
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <p className="font-semibold text-foreground text-sm">
                                    Documentos sem categoria
                                  </p>
                                )}
                              </div>
                            </div>
                            <Badge variant="secondary" className="flex-shrink-0">
                              {documents.length}
                            </Badge>
                          </div>
                        </button>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="space-y-2 pt-2 pl-4">
                        {documents.map((doc) => {
                          const expiryStatus = getExpiryStatus(doc.expiry_date);
                          return (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-foreground text-sm truncate">
                                    {doc.nome}
                                  </p>
                                  {expiryStatus && (
                                    <Badge className={`text-xs flex-shrink-0 ${expiryStatus.className}`}>
                                      {expiryStatus.label}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  <span>{formatFileSize(doc.tamanho_arquivo)}</span>
                                  <span>•</span>
                                  <span>
                                    {new Date(doc.criado_em).toLocaleDateString("pt-BR")}
                                  </span>
                                </div>
                                {doc.descricao && (
                                  <p className="text-xs text-muted-foreground truncate mt-1">
                                    {doc.descricao}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => downloadFile(doc.caminho_arquivo)}
                                className="h-8 w-8 p-0"
                                title="Baixar"
                              >
                                <Download className="h-4 w-4" />
                              </Button>

                              {isAdmin && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() =>
                                        deleteDocument(doc.id, doc.caminho_arquivo)
                                      }
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Deletar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      <FlightDocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        aircraftId={aircraftId}
        clientId={clientId}
        onSuccess={loadData}
      />

      <FolderManagementDialog
        open={folderManagementDialogOpen}
        onOpenChange={setFolderManagementDialogOpen}
        aircraftId={aircraftId}
        clientId={clientId}
        onSuccess={loadData}
      />
    </>
  );
}
