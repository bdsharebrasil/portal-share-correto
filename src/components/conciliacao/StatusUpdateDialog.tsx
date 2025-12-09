import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText } from "lucide-react";
import { 
  createContaAReceber, 
  createContaAPagar, 
  createFluxoCaixaEntry,
  getNextStatus,
  isStatusFinal,
  isStatusEnviado 
} from "@/lib/reconciliation-utils";

interface StatusUpdateDialogProps {
  reconciliation: {
    id: string;
    status: string;
    type?: string;
    amount?: number;
    date?: string;
    description?: string;
    category?: string;
    client_id?: string;
    receiver_id?: string;
    aircraft_id?: string;
    payment_term?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

interface ContaBancaria {
  id: string;
  nome: string;
  banco: string | null;
}

export function StatusUpdateDialog({ reconciliation, open, onOpenChange, onUpdate }: StatusUpdateDialogProps) {
  const [status, setStatus] = useState(reconciliation.status);
  const [loading, setLoading] = useState(false);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [selectedBanco, setSelectedBanco] = useState<string>("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setStatus(reconciliation.status);
    setSelectedBanco("");
    setComprovante(null);
  }, [reconciliation.status, open]);

  useEffect(() => {
    fetchContasBancarias();
  }, []);

  const fetchContasBancarias = async () => {
    const { data, error } = await supabase
      .from("contas_bancarias")
      .select("id, nome, banco")
      .eq("ativo", true);

    if (!error && data) {
      setContasBancarias(data);
    }
  };

  const uploadComprovante = async (): Promise<string | null> => {
    if (!comprovante) return null;

    setUploading(true);
    try {
      const fileExt = comprovante.name.split('.').pop();
      const fileName = `${reconciliation.id}-${Date.now()}.${fileExt}`;
      const filePath = `conciliacoes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('comprovantes')
        .upload(filePath, comprovante);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('comprovantes')
        .getPublicUrl(filePath);

      return publicUrl.publicUrl;
    } catch (error: any) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload do comprovante");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    const statusFinal = isStatusFinal(status, reconciliation.type || '');
    const statusEnviado = isStatusEnviado(status);

    // Validar banco obrigatório quando status é final
    if (statusFinal && !selectedBanco) {
      toast.error("Selecione o banco para registrar a movimentação");
      return;
    }

    setLoading(true);
    try {
      // Upload do comprovante se houver
      let comprovanteUrl: string | null = null;
      if (comprovante) {
        comprovanteUrl = await uploadComprovante();
      }

      // 1. Atualizar status na conciliação
      const { error } = await supabase
        .from("bank_reconciliations")
        .update({ status } as any)
        .eq("id", reconciliation.id as any);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // 2. Criar contas a receber/pagar quando status é "enviado"
      if (statusEnviado) {
        if (reconciliation.type === 'cliente') {
          await createContaAReceber(reconciliation as any, user.id);
        } else if (reconciliation.type === 'colaborador') {
          await createContaAPagar(reconciliation as any, user.id);
        }
      }

      // 3. Criar fluxo de caixa quando status é final
      if (statusFinal) {
        const contaBancaria = contasBancarias.find(c => c.id === selectedBanco) || null;
        const success = await createFluxoCaixaEntry(
          reconciliation as any,
          status,
          contaBancaria,
          comprovanteUrl,
          user.id
        );

        if (!success) {
          toast.warning('Status atualizado, mas houve erro ao criar entrada no fluxo de caixa');
        }
      }

      toast.success("Status atualizado com sucesso!");
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao atualizar status:", error);
      toast.error(error.message || "Erro ao atualizar status");
    } finally {
      setLoading(false);
    }
  };

  // Opções de status baseadas no tipo de conciliação
  const statusOptions = getNextStatus(reconciliation.status, reconciliation.type || '')
    .map(s => {
      const labels: Record<string, string> = {
        'pendente': 'Pendente',
        'enviado': 'Enviado',
        'conferido': 'Conferido/Recebido',
        'pago': 'Pago'
      };
      return { value: s, label: labels[s] || s };
    });

  // Mostrar campos extras apenas quando status é final
  const showExtraFields = isStatusFinal(status, reconciliation.type || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar Status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showExtraFields && (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Conta Bancária <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedBanco} onValueChange={setSelectedBanco}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta bancária" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasBancarias.map(conta => (
                      <SelectItem key={conta.id} value={conta.id}>
                        {conta.nome} - {conta.banco || 'Sem banco'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Comprovante de Pagamento</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setComprovante(e.target.files?.[0] || null)}
                    className="hidden"
                    id="comprovante-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => document.getElementById('comprovante-upload')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {comprovante ? comprovante.name : 'Selecionar arquivo'}
                  </Button>
                </div>
                {comprovante && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{comprovante.name}</span>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={loading || uploading}>
              {loading || uploading ? "Processando..." : "Atualizar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
