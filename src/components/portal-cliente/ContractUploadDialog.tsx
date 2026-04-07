import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, File } from "lucide-react";

interface ContractUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onSuccess: () => void;
}

export function ContractUploadDialog({ open, onOpenChange, clientId, onSuccess }: ContractUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/pdf") {
        toast.error("Por favor, envie apenas arquivos PDF");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecione um arquivo PDF");
      return;
    }

    if (!description.trim()) {
      toast.error("Adicione uma descrição para o contrato");
      return;
    }

    try {
      setUploading(true);

      const fileExt = "pdf";
      const fileName = `${clientId}/contratos/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-documents')
        .getPublicUrl(fileName);

      const { data: { user } } = await supabase.auth.getUser();

      const { error: dbError } = await supabase
        .from('contratos_cliente')
        .insert({
          cliente_id: clientId,
          nome_arquivo: file.name,
          caminho_arquivo: fileName,
          tamanho_arquivo: file.size,
          descricao: description.trim(),
          url_publica: publicUrl,
          enviado_por: user?.id,
          enviado_em: new Date().toISOString()
        });

      if (dbError) throw dbError;

      toast.success("Contrato enviado com sucesso!");
      onSuccess();
      onOpenChange(false);
      
      setFile(null);
      setDescription("");
    } catch (error) {
      console.error('Error uploading contract:', error);
      toast.error('Erro ao enviar contrato');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enviar Contrato Share</DialogTitle>
          <DialogDescription>
            Envie um arquivo PDF do contrato Share para o cliente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 flex items-center gap-2">
              <File className="h-4 w-4" />
              Apenas arquivos PDF são aceitos
            </p>
          </div>

          <div>
            <Label htmlFor="contract-file" className="text-sm font-medium">Arquivo PDF *</Label>
            <Input
              id="contract-file"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={uploading}
              className="mt-2"
            />
            {file && (
              <p className="text-sm text-muted-foreground mt-2">
                Arquivo selecionado: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="contract-description" className="text-sm font-medium">Descrição *</Label>
            <Textarea
              id="contract-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Contrato de compartilhamento de aeronave - 2024"
              disabled={uploading}
              className="mt-2"
              rows={3}
            />
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
            disabled={uploading || !file}
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
                Enviar Contrato
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
