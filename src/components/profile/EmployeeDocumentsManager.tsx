import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Download, Trash2, FileText, Loader2, User, Folder, Heart, Award, File, Eye } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmployeeDocument {
  id: string;
  user_id: string;
  nome_arquivo: string;
  caminho_arquivo: string;
  tipo_arquivo: string;
  tamanho_arquivo: number;
  criado_em: string;
  uploaded_by: string;
  uploaded_by_name?: string;
  categoria: string;
}

type DocumentCategory = "Documentos Pessoais" | "Atestados Médicos" | "Documentos Financeiros" | "Académicos/Certificados" | "Outros";

const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string; icon: React.ReactNode }[] = [
  { value: "Documentos Pessoais", label: "Documentos Pessoais", icon: <FileText className="h-5 w-5" /> },
  { value: "Atestados Médicos", label: "Atestados Médicos", icon: <Heart className="h-5 w-5" /> },
  { value: "Documentos Financeiros", label: "Documentos Financeiros", icon: <File className="h-5 w-5" /> },
  { value: "Académicos/Certificados", label: "Académicos/Certificados", icon: <Award className="h-5 w-5" /> },
  { value: "Outros", label: "Outros", icon: <Folder className="h-5 w-5" /> },
];

interface EmployeeDocumentsManagerProps {
  userId: string;
  userName: string;
  isAdmin?: boolean;
  isFinanceiroMaster?: boolean;
  isGestorMaster?: boolean;
  currentUserId?: string;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function EmployeeDocumentsManager({
  userId,
  userName,
  isAdmin = false,
  isFinanceiroMaster = false,
  isGestorMaster = false,
  currentUserId,
}: EmployeeDocumentsManagerProps) {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>("Outros");
  const [expandedCategory, setExpandedCategory] = useState<DocumentCategory | null>(null);
  const [viewingDocument, setViewingDocument] = useState<EmployeeDocument | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);

  const canEdit = isAdmin || isFinanceiroMaster || isGestorMaster || currentUserId === userId;

  useEffect(() => {
    loadDocuments();
  }, [userId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);

      // Campos em português conforme o schema do banco
      const { data, error } = await supabase
        .from("user_documents")
        .select("id, user_id, nome_arquivo, caminho_arquivo, tipo_arquivo, tamanho_arquivo, criado_em, uploaded_by, categoria")
        .eq("user_id", userId)
        .order("criado_em", { ascending: false });

      if (error) throw error;

      // Enriquecer com nome de quem enviou, se disponível
      const enrichedData = await Promise.all(
        (data || []).map(async (doc: EmployeeDocument) => {
          if (doc.uploaded_by) {
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("full_name")
              .eq("id", doc.uploaded_by)
              .single();
            return { ...doc, uploaded_by_name: profile?.full_name || "Desconhecido" };
          }
          return { ...doc, uploaded_by_name: undefined };
        })
      );

      setDocuments(enrichedData);
    } catch (error) {
      console.error("Erro ao carregar documentos:", error);
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error("Formato não permitido. Use: PDF, Imagem, Word");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error("Arquivo muito grande. Máximo 10MB");
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo");
      return;
    }

    try {
      setUploading(true);

      const fileExt = selectedFile.name.split(".").pop() || "";
      const timestamp = Date.now();

      // Sanitizar categoria: remover acentos e caracteres especiais
      const sanitizedCategory = selectedCategory
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_");

      const filePath = `${userId}/${sanitizedCategory}/${timestamp}.${fileExt}`;

      // Upload para o storage
      const { error: uploadError } = await supabase.storage
        .from("documents_colaborador")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser();

      // Inserir metadados com os campos em português do banco
      const { error: dbError } = await supabase
        .from("user_documents")
        .insert({
          user_id: userId,
          nome_arquivo: selectedFile.name,
          caminho_arquivo: filePath,
          tamanho_arquivo: selectedFile.size,
          tipo_arquivo: selectedFile.type,
          uploaded_by: user?.id,
          categoria: selectedCategory,
          // criado_em tem default now() no banco, não precisa enviar
        });

      if (dbError) {
        console.error("Erro ao salvar metadados:", dbError);
        throw dbError;
      }

      toast.success("Documento enviado com sucesso!");
      setSelectedFile(null);
      setUploadDialogOpen(false);
      setSelectedCategory("Outros");
      await loadDocuments();
    } catch (error: any) {
      console.error("Erro ao enviar documento:", error);

      let errorMessage = "Erro ao enviar documento";
      if (error.code === "PGRST116") {
        errorMessage = "Erro de permissão ao salvar o documento. Verifique suas permissões.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (caminhoArquivo: string, nomeArquivo: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents_colaborador")
        .download(caminhoArquivo);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao baixar documento:", error);
      toast.error("Erro ao baixar documento");
    }
  };

  const handleViewDocument = async (doc: EmployeeDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents_colaborador")
        .createSignedUrl(doc.caminho_arquivo, 60 * 60); // expira em 1 hora

      if (error) throw error;

      setViewingDocument(doc);
      setDocumentUrl(data.signedUrl);
    } catch (error) {
      console.error("Erro ao visualizar documento:", error);
      toast.error("Erro ao visualizar documento");
    }
  };

  const handleDelete = async (docId: string, caminhoArquivo: string) => {
    if (!window.confirm("Deseja remover este documento?")) return;

    try {
      setDeleting(docId);

      // Remover do storage
      const { error: storageError } = await supabase.storage
        .from("documents_colaborador")
        .remove([caminhoArquivo]);

      if (storageError) throw storageError;

      // Remover do banco
      const { error: dbError } = await supabase
        .from("user_documents")
        .delete()
        .eq("id", docId);

      if (dbError) throw dbError;

      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Documento removido com sucesso!");
    } catch (error) {
      console.error("Erro ao remover documento:", error);
      toast.error("Erro ao remover documento");
    } finally {
      setDeleting(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Documentos</h2>
        <p className="text-muted-foreground">Gerenciar documentos do colaborador</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {userName}
            </CardTitle>
            <CardDescription>Documentos pessoais e profissionais</CardDescription>
          </div>
          {canEdit && (
            <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Enviar Documento
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pastas de Documentos */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  Pastas de Documentos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {DOCUMENT_CATEGORIES.map((cat) => {
                    const count = documents.filter((d) => d.categoria === cat.value).length;
                    const isSelected = expandedCategory === cat.value;
                    return (
                      <Button
                        key={cat.value}
                        variant={isSelected ? "default" : "outline"}
                        className={`h-auto p-4 justify-start flex-col items-start gap-2 transition-all min-h-[80px] ${isSelected
                            ? "bg-primary/20 border-primary border-2 hover:border-primary"
                            : "hover:border-primary"
                          }`}
                        onClick={() =>
                          setExpandedCategory(expandedCategory === cat.value ? null : cat.value)
                        }
                      >
                        <div className="flex items-center gap-3 w-full min-w-0">
                          <div
                            className={`p-2 rounded flex-shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-primary/10"
                              }`}
                          >
                            {cat.icon}
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{cat.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {count} documento{count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Documentos da categoria expandida */}
              {expandedCategory && (
                <div className="space-y-2 pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold text-foreground">{expandedCategory}</h3>
                  <div className="space-y-2">
                    {documents
                      .filter((d) => d.categoria === expandedCategory)
                      .map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="p-2 bg-primary/10 rounded flex-shrink-0">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">
                                {doc.nome_arquivo}
                              </p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(doc.tamanho_arquivo)}
                                </p>
                                <span className="text-xs text-muted-foreground">•</span>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(doc.criado_em).toLocaleDateString("pt-BR")}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDocument(doc)}
                              className="gap-2"
                              title="Visualizar documento"
                            >
                              <Eye className="h-4 w-4" />
                              Visualizar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(doc.caminho_arquivo, doc.nome_arquivo)}
                              className="gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Baixar
                            </Button>
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(doc.id, doc.caminho_arquivo)}
                                disabled={deleting === doc.id}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                {deleting === doc.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    {documents.filter((d) => d.categoria === expandedCategory).length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Nenhum documento nesta pasta
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Mensagem quando não há documentos */}
              {documents.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum documento enviado ainda</p>
                  {canEdit && (
                    <Button
                      variant="outline"
                      onClick={() => setUploadDialogOpen(true)}
                      className="mt-4 gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Enviar Primeiro Documento
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog — Upload */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Enviar Documento</DialogTitle>
            <DialogDescription>
              Envie documentos pessoais, profissionais ou outros arquivos relacionados
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="categoria" className="text-sm font-medium">
                Categoria *
              </Label>
              <Select
                value={selectedCategory}
                onValueChange={(value) => setSelectedCategory(value as DocumentCategory)}
                disabled={uploading}
              >
                <SelectTrigger id="categoria" className="mt-2">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="document-file" className="text-sm font-medium">
                Arquivo *
              </Label>
              <Input
                id="document-file"
                type="file"
                onChange={handleFileSelect}
                disabled={uploading}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="mt-2"
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground mt-2">
                  Arquivo: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Formatos aceitos: PDF, JPG, PNG, Word (Máx. 10MB)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialogOpen(false);
                setSelectedFile(null);
              }}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !selectedFile} className="gap-2">
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Visualizar */}
      <Dialog
        open={!!viewingDocument}
        onOpenChange={(open) => {
          if (!open) {
            setViewingDocument(null);
            setDocumentUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewingDocument?.nome_arquivo}</DialogTitle>
            <DialogDescription>
              {viewingDocument && (
                <p className="text-xs mt-2">
                  Tamanho: {formatFileSize(viewingDocument.tamanho_arquivo)} • Data:{" "}
                  {new Date(viewingDocument.criado_em).toLocaleDateString("pt-BR")}
                </p>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto bg-muted/50 rounded-lg min-h-[500px] flex items-center justify-center">
            {documentUrl && viewingDocument ? (
              viewingDocument.tipo_arquivo === "application/pdf" ? (
                <iframe
                  src={documentUrl}
                  className="w-full h-full rounded"
                  title={viewingDocument.nome_arquivo}
                />
              ) : (
                <img
                  src={documentUrl}
                  alt={viewingDocument.nome_arquivo}
                  className="max-h-full max-w-full object-contain"
                />
              )
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (viewingDocument) {
                  handleDownload(viewingDocument.caminho_arquivo, viewingDocument.nome_arquivo);
                }
              }}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Baixar
            </Button>
            <Button variant="outline" onClick={() => setViewingDocument(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}