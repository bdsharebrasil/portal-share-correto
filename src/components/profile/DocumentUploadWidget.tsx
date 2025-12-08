import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Trash2, Download, Loader2, Eye, Edit2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DocumentViewer } from "../DocumentViewer";

interface UserDocument {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  description?: string;
  created_at: string;
  uploaded_by: string;
}

interface DocumentUploadWidgetProps {
  employeeId: string;
  employeeName: string;
}

const DOCUMENTS_BUCKET = "documents_colaborador";
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
];

export function DocumentUploadWidget({ employeeId, employeeName }: DocumentUploadWidgetProps) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Estados para o dialog de legenda
  const [showCaptionDialog, setShowCaptionDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; path: string; size: number; type: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState("");

  // Estados para visualizar documento
  const [viewingDoc, setViewingDoc] = useState<UserDocument | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  // Carregar documentos ao montar o componente
  useEffect(() => {
    loadDocuments();
  }, [employeeId]);

  const loadDocuments = async () => {
    try {
      setIsLoadingDocuments(true);
      console.log("Carregando documentos para employeeId:", employeeId);

      const { data, error } = await supabase
        .from("user_documents")
        .select("*")
        .eq("user_id", employeeId)
        .order("created_at", { ascending: false });

      console.log("Resposta da listagem de documentos:", { data, error });

      if (error) {
        console.error("Erro da API:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log("Nenhum documento encontrado para este funcionário");
        setDocuments([]);
        return;
      }

      console.log("Documentos carregados:", data);
      setDocuments(data as UserDocument[]);
    } catch (error: any) {
      console.error("Erro ao carregar documentos:", {
        error: error,
        message: error?.message,
        status: error?.status,
      });

      toast({
        title: "Erro ao carregar documentos",
        description: error?.message || "Erro ao listar documentos do servidor",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validar tipo de arquivo
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: "Tipo de arquivo não permitido",
        description: "Apenas PDF, Imagens, DOC, DOCX, XLS, XLSX são aceitos",
        variant: "destructive",
      });

      // Limpar input
      const inputElement = event.currentTarget;
      if (inputElement) {
        inputElement.value = "";
      }
      return;
    }

    // Validar tamanho (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 10MB",
        variant: "destructive",
      });

      // Limpar input
      const inputElement = event.currentTarget;
      if (inputElement) {
        inputElement.value = "";
      }
      return;
    }

    // Guardar arquivo pendente e abrir dialog para legenda
    const timestamp = Date.now();
    // Sanitizar nome do arquivo: remover espaços, acentos e caracteres especiais
    const fileExt = file.name.split('.').pop() || '';
    const sanitizedName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Substitui caracteres especiais por _
      .replace(/_+/g, '_'); // Remove underscores duplicados
    const fileName = `${timestamp}_${sanitizedName}`;
    const filePath = `${employeeId}/${fileName}`;

    setPendingFile({
      name: file.name,
      path: filePath,
      size: file.size,
      type: file.type,
    });
    // Guardar o objeto File na state para upload posterior
    (event.currentTarget as any).pendingFileObject = file;

    setCaption("");
    setShowCaptionDialog(true);

    // Limpar input
    const inputElement = event.currentTarget;
    if (inputElement) {
      inputElement.value = "";
    }
  };

  const handleUploadWithCaption = async () => {
    if (!pendingFile) return;

    try {
      setIsLoading(true);
      setUploadProgress(0);

      // Pegar o arquivo do input (guardado na state anterior)
      const inputElement = document.getElementById("document-upload") as HTMLInputElement;
      let fileToUpload = (inputElement as any)?.pendingFileObject;

      // Se não temos o arquivo guardado, criar um blob vazio (fallback - isso não deveria acontecer)
      if (!fileToUpload) {
        toast({
          title: "Erro",
          description: "Arquivo não encontrado",
          variant: "destructive",
        });
        return;
      }

      // 1. Fazer upload do arquivo para o storage
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(pendingFile.path, fileToUpload);

      if (uploadError) {
        console.error("Erro ao fazer upload do arquivo:", uploadError);
        throw uploadError;
      }

      setUploadProgress(50);

      // 2. Obter ID do usuário autenticado (admin)
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("Erro ao obter usuário autenticado:", userError);
        throw new Error("Não foi possível identificar o usuário autenticado");
      }

      // 3. Inserir metadados no banco de dados com a legenda
      const { error: dbError } = await supabase
        .from("user_documents")
        .insert({
          user_id: employeeId,
          file_name: pendingFile.name,
          file_path: pendingFile.path,
          file_size: pendingFile.size,
          file_type: pendingFile.type,
          description: caption,
          uploaded_by: user.id,
          created_at: new Date().toISOString(),
        });

      if (dbError) {
        console.error("Erro ao salvar metadados no banco de dados:", {
          error: dbError,
          code: dbError.code,
          message: dbError.message,
          details: dbError.details,
        });
        throw dbError;
      }

      setUploadProgress(100);

      toast({
        title: "Sucesso",
        description: "Documento carregado com legenda!",
      });

      setShowCaptionDialog(false);
      setPendingFile(null);
      setCaption("");
      (inputElement as any).pendingFileObject = null;

      console.log("Documento salvo com sucesso. Recarregando documentos...");
      await loadDocuments();
    } catch (error: any) {
      console.error("Erro ao fazer upload:", {
        error: error,
        message: error.message,
        code: error.code,
        details: error.details,
        status: error.status,
      });

      let errorMessage = error.message || "Erro desconhecido ao fazer upload";
      if (error.code === "PGRST116") {
        errorMessage = "Erro de permissão ao salvar o documento. Verifique suas permissões.";
      } else if (error.code === "23505") {
        errorMessage = "Documento já existe com esse caminho.";
      }

      toast({
        title: "Erro ao fazer upload",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    try {
      setIsLoading(true);

      // Deletar do storage
      const { error: storageError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Deletar do banco de dados
      const { error: dbError } = await supabase
        .from("user_documents")
        .delete()
        .eq("id", docId);

      if (dbError) throw dbError;

      toast({
        title: "Sucesso",
        description: "Documento removido com sucesso",
      });

      await loadDocuments();
    } catch (error: any) {
      console.error("Erro ao deletar documento:", error);
      toast({
        title: "Erro ao deletar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadDocument = async (doc: UserDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .download(doc.file_path);

      if (error) throw error;

      // Criar um link para download
      const url = window.URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error("Erro ao baixar documento:", error);
      toast({
        title: "Erro ao baixar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewDocument = async (doc: UserDocument) => {
    try {
      // Gerar URL pública para visualizar
      const { data } = supabase.storage
        .from(DOCUMENTS_BUCKET)
        .getPublicUrl(doc.file_path);

      if (data?.publicUrl) {
        setViewingDoc(doc);
        setViewerUrl(data.publicUrl);
      }
    } catch (error: any) {
      console.error("Erro ao abrir documento:", error);
      toast({
        title: "Erro ao abrir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateCaption = async () => {
    if (!editingDocId) return;

    try {
      setIsLoading(true);

      const { error } = await supabase
        .from("user_documents")
        .update({ description: editingCaption })
        .eq("id", editingDocId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Legenda atualizada",
      });

      setEditingDocId(null);
      setEditingCaption("");
      await loadDocuments();
    } catch (error: any) {
      console.error("Erro ao atualizar legenda:", error);
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <Card className="shadow-md bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5 text-cyan-500" />
              Upload de Documentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={isLoading}
                  className="hidden"
                  id="document-upload"
                />
                <Button
                  onClick={() => {
                    const input = document.getElementById("document-upload") as HTMLInputElement;
                    if (input) input.click();
                  }}
                  disabled={isLoading}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Selecionar Documento
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                Formatos aceitos: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX (máximo 10MB)
              </p>
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md bg-gray-800 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-500" />
              Documentos ({documents.length})
            </CardTitle>
            {documents.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadDocuments}
                disabled={isLoadingDocuments}
                className="text-gray-300 border-gray-600 hover:bg-gray-700"
              >
                {isLoadingDocuments ? "Carregando..." : "Recarregar"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoadingDocuments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
              </div>
            ) : documents.length === 0 ? (
              <p className="text-center text-gray-400 py-6">Nenhum documento enviado ainda</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5 text-cyan-500 flex-shrink-0" />
                          <p className="text-sm font-medium text-gray-200 truncate">{doc.file_name}</p>
                        </div>

                        {doc.description && (
                          <p className="text-xs text-gray-300 mb-2 italic">
                            <span className="font-semibold">Legenda:</span> {doc.description}
                          </p>
                        )}

                        <p className="text-xs text-gray-400">
                          {new Date(doc.created_at).toLocaleDateString("pt-BR")} • {(doc.file_size / 1024).toFixed(2)} KB
                        </p>
                      </div>

                      <div className="flex gap-1 flex-shrink-0">
                        {doc.file_type.includes("pdf") || doc.file_type.includes("image") ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDocument(doc)}
                            disabled={isLoading}
                            title="Visualizar"
                            className="text-blue-500 hover:text-blue-400 hover:bg-gray-600 h-8 w-8"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : null}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingDocId(doc.id);
                            setEditingCaption(doc.description || "");
                          }}
                          disabled={isLoading}
                          title="Editar legenda"
                          className="text-yellow-500 hover:text-yellow-400 hover:bg-gray-600 h-8 w-8"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadDocument(doc)}
                          disabled={isLoading}
                          title="Baixar"
                          className="text-cyan-500 hover:text-cyan-400 hover:bg-gray-600 h-8 w-8"
                        >
                          <Download className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDocument(doc.id)}
                          disabled={isLoading}
                          title="Deletar"
                          className="text-red-500 hover:text-red-400 hover:bg-gray-600 h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog para adicionar legenda ao fazer upload */}
      <Dialog open={showCaptionDialog} onOpenChange={setShowCaptionDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle>Adicionar Legenda ao Documento</DialogTitle>
            <DialogDescription>
              {pendingFile && (
                <>
                  Arquivo: <strong>{pendingFile.name}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-caption">Legenda (opcional)</Label>
              <Textarea
                id="new-caption"
                placeholder="Digite uma descrição ou legenda para o documento... (opcional)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
                rows={4}
              />
              <p className="text-xs text-gray-400">
                A legenda ajuda a identificar o documento mais facilmente
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCaptionDialog(false);
                setPendingFile(null);
                setCaption("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUploadWithCaption}
              disabled={isLoading}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Upload com Legenda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar legenda de documento existente */}
      <Dialog open={editingDocId !== null} onOpenChange={(open) => !open && setEditingDocId(null)}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle>Editar Legenda do Documento</DialogTitle>
            <DialogDescription>
              Atualize a legenda para este documento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-caption">Legenda do Documento</Label>
              <Textarea
                id="edit-caption"
                placeholder="Digite uma descrição ou legenda para o documento..."
                value={editingCaption}
                onChange={(e) => setEditingCaption(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingDocId(null)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateCaption}
              disabled={isLoading}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar Legenda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualizador de documento */}
      {viewingDoc && viewerUrl && (
        <Dialog open={!!viewingDoc} onOpenChange={(open) => !open && setViewingDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] bg-gray-900 border-gray-700 p-0">
            <DialogHeader className="p-4 border-b border-gray-700">
              <DialogTitle className="text-white">
                {viewingDoc.description || viewingDoc.file_name}
              </DialogTitle>
              {viewingDoc.description && (
                <DialogDescription className="text-gray-400 text-sm">
                  {viewingDoc.file_name}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="w-full overflow-auto flex-1">
              {viewingDoc.file_type.includes("pdf") ? (
                <DocumentViewer
                  url={viewerUrl}
                  fileName={viewingDoc.file_name}
                  fileType={viewingDoc.file_type}
                />
              ) : viewingDoc.file_type.includes("image") ? (
                <div className="flex items-center justify-center p-4">
                  <img
                    src={viewerUrl}
                    alt={viewingDoc.file_name}
                    className="max-w-full max-h-[75vh] object-contain"
                  />
                </div>
              ) : (
                <div className="p-4 text-gray-400 text-center">
                  <p>Tipo de arquivo não suportado para visualização</p>
                  <p className="text-sm mt-2">Use o botão de download para abrir</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
