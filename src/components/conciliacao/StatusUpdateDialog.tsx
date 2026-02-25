import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, Calendar, AlertCircle } from "lucide-react";
import { 
  createContaAReceber, 
  createContaAPagar, 
  createFluxoCaixaEntry,
  getNextStatus,
  isStatusFinal,
  isStatusEnviado,
  requiresBankSelection,
  getStatusLabel
} from "@/lib/reconciliation-utils";
import { format } from "date-fns";

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
    prazo_pagamento?: string;
    forma_pagamento?: string;
    saldo_pendente?: number | null;
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
  const [paymentTerm, setPaymentTerm] = useState<string>(reconciliation.prazo_pagamento || "");

  useEffect(() => {
    setStatus(reconciliation.status);
    setSelectedBanco("");
    setComprovante(null);
    setPaymentTerm(reconciliation.prazo_pagamento || "");
  }, [reconciliation.status, reconciliation.prazo_pagamento, open]);

  useEffect(() => {
    fetchContasBancarias();
  }, []);

  const fetchContasBancarias = async () => {
    const { data, error } = await supabase
      .from("contas_bancarias")
      .select("id, banco")
      .eq("ativo", true)
      .order("banco");

    if (!error && data) {
      setContasBancarias(data.map((cb: any) => ({ id: cb.id, nome: cb.banco || '', banco: cb.banco })));
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
    const statusEnviado = isStatusEnviado(status);
    const statusFinal = isStatusFinal(status, reconciliation.type || '', reconciliation.forma_pagamento);
    const needsBank = requiresBankSelection(status, reconciliation.type || '');

    // Validar prazo de vencimento quando status é "enviado"
    if (statusEnviado && !paymentTerm && !reconciliation.prazo_pagamento) {
      toast.error("Defina o prazo de vencimento antes de enviar");
      return;
    }

    // Validar banco obrigatório quando status requer
    if (needsBank && !selectedBanco) {
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

      // Preparar dados para atualização
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };

      // Adicionar prazo de vencimento se definido
      if (paymentTerm) {
        updateData.prazo_pagamento = paymentTerm;
      }

      // Adicionar comprovante se houver
      if (comprovanteUrl) {
        updateData.comprovante_url = comprovanteUrl;
      }

      // Atualizar data de reembolso se status final
      if (status === 'reembolsado' || status === 'pago') {
        updateData.data_reembolso = new Date().toISOString().split('T')[0];
      }

      // 1. Atualizar status na conciliação
      const { error } = await supabase
        .from("bank_reconciliations")
        .update(updateData as any)
        .eq("id", reconciliation.id as any);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // 2. Criar contas a receber/pagar quando status é "enviado" ou "aprovado"
      if (statusEnviado) {
        const reconciliationWithPaymentTerm = {
          id: reconciliation.id,
          type: reconciliation.type || 'cliente',
          prazo_pagamento: paymentTerm || reconciliation.prazo_pagamento || null,
          amount: reconciliation.amount || 0,
          date: reconciliation.date || new Date().toISOString().split('T')[0],
          description: reconciliation.description || '',
          category: reconciliation.category || null,
          client_id: reconciliation.client_id,
          receiver_id: reconciliation.receiver_id,
          aircraft_id: reconciliation.aircraft_id,
          saldo_pendente: reconciliation.saldo_pendente,
        };

        if (reconciliation.type === 'cliente') {
          const contaId = await createContaAReceber(reconciliationWithPaymentTerm, user.id);
          if (contaId) {
            toast.success("Conta a Receber criada automaticamente");
          }
        } else if (reconciliation.type === 'colaborador') {
          const contaId = await createContaAPagar(reconciliationWithPaymentTerm, user.id);
          if (contaId) {
            toast.success("Conta a Pagar criada automaticamente");
          }
        }
      }

      // 3. Criar entrada no fluxo de caixa quando:
      // - Status = aguardando_reembolso (empresa pagou fornecedor)
      // - Status = reembolsado (cliente pagou empresa)
      // - Status = pago (empresa pagou colaborador)
      if (status === 'aguardando_reembolso' || status === 'reembolsado' || status === 'pago') {
        const contaBancaria = contasBancarias.find(c => c.id === selectedBanco) || null;
        const reconciliationData = {
          id: reconciliation.id,
          type: reconciliation.type || 'cliente',
          prazo_pagamento: paymentTerm || reconciliation.prazo_pagamento || null,
          amount: reconciliation.amount || 0,
          date: reconciliation.date || new Date().toISOString().split('T')[0],
          description: reconciliation.description || '',
          category: reconciliation.category || null,
          client_id: reconciliation.client_id,
          receiver_id: reconciliation.receiver_id,
          aircraft_id: reconciliation.aircraft_id,
          saldo_pendente: reconciliation.saldo_pendente,
        };

        const success = await createFluxoCaixaEntry(
          reconciliationData,
          status,
          contaBancaria,
          comprovanteUrl,
          user.id
        );

        if (success) {
          toast.success(`Movimentação registrada no fluxo de caixa`);
        } else {
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

  // Opções de status baseadas no tipo de conciliação e forma de pagamento
  const statusOptions = getNextStatus(
    reconciliation.status, 
    reconciliation.type || '',
    reconciliation.forma_pagamento
  ).map(s => ({
    value: s,
    label: getStatusLabel(s)
  }));

  // Mostrar campo de vencimento quando for enviar
  const showPaymentTermField = isStatusEnviado(status) && !reconciliation.prazo_pagamento;
  
  // Mostrar campos de banco quando status requer
  const showBankFields = requiresBankSelection(status, reconciliation.type || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar Status da Conciliação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Informações da conciliação */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-sm">
            <p><span className="text-muted-foreground">Tipo:</span> {reconciliation.type === 'cliente' ? 'Cliente' : 'Colaborador'}</p>
            <p><span className="text-muted-foreground">Valor:</span> R$ {Math.abs(reconciliation.saldo_pendente ?? reconciliation.amount ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            {reconciliation.description && (
              <p className="truncate"><span className="text-muted-foreground">Descrição:</span> {reconciliation.description}</p>
            )}
          </div>

          {/* Seleção de Status */}
          <div className="space-y-2">
            <Label>Novo Status</Label>
            {statusOptions.length > 0 ? (
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
            ) : (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
                <AlertCircle className="h-4 w-4" />
                <span>Esta conciliação já está finalizada</span>
              </div>
            )}
          </div>

          {/* Prazo de Vencimento */}
          {showPaymentTermField && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Prazo de Vencimento <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={paymentTerm}
                onChange={(e) => setPaymentTerm(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
              <p className="text-xs text-muted-foreground">
                Data limite para o cliente efetuar o pagamento
              </p>
            </div>
          )}

          {/* Campos de Banco e Comprovante */}
          {showBankFields && (
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
                        {conta.banco || (conta as any).numero_conta || 'Conta sem nome'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {status === 'aguardando_reembolso' 
                    ? 'Conta de onde saiu o pagamento ao fornecedor'
                    : status === 'reembolsado'
                    ? 'Conta onde o reembolso foi recebido'
                    : 'Conta de onde saiu o pagamento'
                  }
                </p>
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

          {/* Botões de Ação */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={loading || uploading || statusOptions.length === 0}
            >
              {loading || uploading ? "Processando..." : "Atualizar Status"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
