import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface FlightDocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  clientId: string;
  onSuccess: () => void;
  onManageFolders?: () => void;
}

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function FlightDocumentUploadDialog({
  open,
  onOpenChange,
  aircraftId,
  clientId,
  onSuccess,
  onManageFolders
}: FlightDocumentUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      if (!ALLOWED_TYPES.includes(selectedFile.type)) {
        toast.error("Apenas arquivos PDF e imagens (JPG, PNG) são permitidos");
        return;
      }

      if (selectedFile.size > MAX_FILE_SIZE) {
        toast.error("Arquivo muito grande. Máximo 10MB");
        return;
      }

      setFile(selectedFile);
      if (!documentName) {
        setDocumentName(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecione um arquivo");
      return;
    }

    if (!documentName.trim()) {
      toast.error("Digite o nome do documento");
      return;
    }

    try {
      setUploading(true);

      const fileExt = file.name.split(".").pop();
      const timestamp = Date.now();
      const fileName = `${aircraftId}/${timestamp}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("flight-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get user
      const {
        data: { user }
      } = await supabase.auth.getUser();

      // Insert into flight_documents table
      const { error: dbError } = await (supabase as any)
        .from("flight_documents")
        .insert({
          name: documentName.trim(),
          description: documentDescription.trim() || null,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user?.id,
          aeronave_id: aircraftId,
          document_type: documentType.trim() || null,
          expiry_date: expiryDate || null
        });

      if (dbError) throw dbError;

      toast.success("Documento enviado com sucesso!");
      onSuccess();
      onOpenChange(false);

      setFile(null);
      setDocumentName("");
      setDocumentDescription("");
      setDocumentType("");
      setExpiryDate("");
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Erro ao enviar documento");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enviar Documento da Aeronave</DialogTitle>
          <DialogDescription>
            Envie certificados, inspeções, registros e documentação da aeronave em PDF ou imagem
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Document Type */}
          <div>
            <Label htmlFor="doc-type" className="text-sm font-medium">
              Tipo de Documento (Opcional)
            </Label>
            <Input
              id="doc-type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              placeholder="Ex: Certificado, Inspeção, Registro"
              disabled={uploading}
              className="mt-2"
            />
          </div>

          {/* Document Name */}
          <div>
            <Label htmlFor="doc-name" className="text-sm font-medium">
              Nome do Documento *
            </Label>
            <Input
              id="doc-name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Ex: Certificado de Aeronavegabilidade 2024"
              disabled={uploading}
              className="mt-2"
            />
          </div>

          {/* File Selection */}
          <div>
            <Label htmlFor="flight-document-file" className="text-sm font-medium">
              Arquivo (PDF ou Imagem) *
            </Label>
            <Input
              id="flight-document-file"
              type="file"
              onChange={handleFileChange}
              disabled={uploading}
              accept="application/pdf,image/jpeg,image/png,image/jpg"
              className="mt-2"
            />
            {file && (
              <p className="text-xs text-muted-foreground mt-2">
                Arquivo: {file.nome} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Formatos aceitos: PDF, JPG, PNG (Máx. 10MB)
            </p>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="flight-document-description" className="text-sm font-medium">
              Observações (Opcional)
            </Label>
            <Textarea
              id="flight-document-description"
              value={documentDescription}
              onChange={(e) => setDocumentDescription(e.target.value)}
              placeholder="Ex: Informações adicionais sobre o documento"
              disabled={uploading}
              className="mt-2 min-h-12 resize-none"
            />
          </div>

          {/* Expiry Date */}
          <div>
            <Label htmlFor="flight-document-expiry" className="text-sm font-medium">
              Data de Vencimento (Opcional)
            </Label>
            <Input
              id="flight-document-expiry"
              type="data"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              disabled={uploading}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Deixe em branco se o documento não tem data de vencimento
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploading || !file || !documentName.trim()}
            className="gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Enviar Documento
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
