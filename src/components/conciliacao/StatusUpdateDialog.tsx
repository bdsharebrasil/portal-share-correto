import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function StatusUpdateDialog({ reconciliation, open, onOpenChange, onUpdate }: StatusUpdateDialogProps) {
  const [status, setStatus] = useState(reconciliation.status);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStatus(reconciliation.status);
  }, [reconciliation.status]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("bank_reconciliations")
        .update({ status } as any)
        .eq("id", reconciliation.id as any);

      if (error) throw error;

      // Criar fluxo de caixa automaticamente quando status muda para "conferido" (cliente) ou "pago" (colaborador)
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const isClientReconciliation = reconciliation.type === 'cliente';
        const isColaboradorReconciliation = reconciliation.type === 'colaborador';
        
        // Cliente: status "conferido" = recebido = entrada no fluxo de caixa
        if (isClientReconciliation && status?.toLowerCase() === 'conferido') {
          const referencia = `REC-${reconciliation.id}`;
          
          // Verificar se já existe
          const { data: existingEntry } = await supabase
            .from('controle_bancario')
            .select('id')
            .eq('referencia', referencia as any)
            .maybeSingle();

          if (!existingEntry) {
            await supabase.from('controle_bancario').insert({
              data: reconciliation.date || new Date().toISOString().split('T')[0],
              tipo_movimento: 'entrada',
              categoria: reconciliation.category || 'Receita de Cliente',
              descricao: reconciliation.description || 'Pagamento recebido',
              valor: reconciliation.amount || 0,
              referencia,
              status: 'confirmado',
              criado_por: user.id,
              observacoes: `Pagamento recebido do cliente`
            } as any);
          }
        }
        
        // Colaborador: status "pago" = pagamento ao colaborador = saída no fluxo de caixa
        if (isColaboradorReconciliation && status?.toLowerCase() === 'pago') {
          const referencia = `SAL-${reconciliation.id}`;
          
          // Verificar se já existe
          const { data: existingEntry } = await supabase
            .from('controle_bancario')
            .select('id')
            .eq('referencia', referencia as any)
            .maybeSingle();

          if (!existingEntry) {
            await supabase.from('controle_bancario').insert({
              data: reconciliation.date || new Date().toISOString().split('T')[0],
              tipo_movimento: 'saída',
              categoria: reconciliation.category || 'Reembolso Colaborador',
              descricao: reconciliation.description || 'Pagamento ao colaborador',
              valor: reconciliation.amount || 0,
              referencia,
              status: 'confirmado',
              criado_por: user.id,
              observacoes: `Pagamento ao colaborador`
            } as any);
          }
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
  const statusOptions = reconciliation.type === 'colaborador' 
    ? [
        { value: 'pendente', label: 'Pendente' },
        { value: 'enviado', label: 'Enviado' },
        { value: 'pago', label: 'Pago' },
      ]
    : [
        { value: 'pendente', label: 'Pendente' },
        { value: 'enviado', label: 'Enviado' },
        { value: 'conferido', label: 'Conferido/Recebido' },
      ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
