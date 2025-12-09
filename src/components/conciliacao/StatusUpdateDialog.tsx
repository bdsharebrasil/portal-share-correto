import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText } from "lucide-react";

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
    const isStatusFinal = (reconciliation.type === 'cliente' && status?.toLowerCase() === 'conferido') ||
                          (reconciliation.type === 'colaborador' && status?.toLowerCase() === 'pago');

    const isStatusEnviado = status?.toLowerCase() === 'enviado';

    // Validar banco obrigatório quando status é final
    if (isStatusFinal && !selectedBanco) {
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

      const { error } = await supabase
        .from("bank_reconciliations")
        .update({ status } as any)
        .eq("id", reconciliation.id as any);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();

      // Criar contas a receber/pagar quando status é "enviado"
      if (user && isStatusEnviado) {
        const isClientReconciliation = reconciliation.type === 'cliente';
        const isColaboradorReconciliation = reconciliation.type === 'colaborador';

        // Cliente: Criar conta a receber
        if (isClientReconciliation && reconciliation.client_id) {
          // Buscar dados do cliente (nome e CNPJ) e da aeronave (matrícula)
          const { data: clientData } = await supabase
            .from('clients')
            .select('company_name, cnpj')
            .eq('id', reconciliation.client_id)
            .single();

          let aircraftRegistration = '';
          if (reconciliation.aircraft_id) {
            const { data: aircraftData } = await supabase
              .from('aircraft')
              .select('registration')
              .eq('id', reconciliation.aircraft_id)
              .single();
            if (aircraftData) {
              aircraftRegistration = aircraftData.registration;
            }
          }

          if (clientData && clientData.cnpj) {
            // Gerar número sequencial para conta a receber
            const year = new Date().getFullYear();
            const yearShort = year.toString().slice(-2);

            // Buscar o próximo número para contas_areceber
            const { data: lastRecord } = await supabase
              .from('contas_areceber')
              .select('numero')
              .order('criado_em', { ascending: false })
              .limit(1);

            let nextNumber = 1;
            if (lastRecord && lastRecord.length > 0) {
              const lastNumero = lastRecord[0].numero;
              const match = lastNumero.match(/CR-(\d+)\//);
              if (match && match[1]) {
                nextNumber = parseInt(match[1]) + 1;
              }
            }

            const numero = `CR-${String(nextNumber).padStart(4, '0')}/${yearShort}`;
            const dataVencimento = reconciliation.payment_term || new Date().toISOString().split('T')[0];

            // Verificar se já existe
            const { data: existing } = await supabase
              .from('contas_areceber')
              .select('id')
              .eq('numero', numero)
              .maybeSingle();

            if (!existing) {
              const { error: insertError } = await supabase
                .from('contas_areceber')
                .insert({
                  numero,
                  cliente_nome: clientData.company_name,
                  cliente_cnpj: clientData.cnpj,
                  data_criacao: new Date().toISOString().split('T')[0],
                  data_vencimento: dataVencimento,
                  valor: reconciliation.amount || 0,
                  categoria: reconciliation.category || 'Faturamento',
                  descricao: reconciliation.description || 'Conta a receber',
                  status: 'pendente',
                  aeronave: aircraftRegistration || '',
                  criado_por: user.id,
                  banco_conciliacao_id: reconciliation.id
                } as any);

              if (insertError) {
                console.error('Erro ao criar conta a receber:', insertError);
                toast.warning('Status atualizado, mas houve erro ao criar conta a receber');
              }
            }
          }
        }

        // Colaborador: Criar conta a pagar
        if (isColaboradorReconciliation && reconciliation.receiver_id) {
          // Buscar dados do colaborador (nome e CPF) e da aeronave (matrícula)
          const { data: userProfileData } = await supabase
            .from('user_profiles')
            .select('full_name, cpf')
            .eq('id', reconciliation.receiver_id)
            .single();

          let aircraftRegistration = '';
          if (reconciliation.aircraft_id) {
            const { data: aircraftData } = await supabase
              .from('aircraft')
              .select('registration')
              .eq('id', reconciliation.aircraft_id)
              .single();
            if (aircraftData) {
              aircraftRegistration = aircraftData.registration;
            }
          }

          if (userProfileData && userProfileData.cpf) {
            // Gerar número sequencial para conta a pagar
            const year = new Date().getFullYear();
            const yearShort = year.toString().slice(-2);

            // Buscar o próximo número para contas_apagar
            const { data: lastRecord } = await supabase
              .from('contas_apagar')
              .select('numero')
              .order('criado_em', { ascending: false })
              .limit(1);

            let nextNumber = 1;
            if (lastRecord && lastRecord.length > 0) {
              const lastNumero = lastRecord[0].numero;
              const match = lastNumero.match(/CP-(\d+)\//);
              if (match && match[1]) {
                nextNumber = parseInt(match[1]) + 1;
              }
            }

            const numero = `CP-${String(nextNumber).padStart(4, '0')}/${yearShort}`;
            const dataVencimento = reconciliation.payment_term || new Date().toISOString().split('T')[0];

            // Verificar se já existe
            const { data: existing } = await supabase
              .from('contas_apagar')
              .select('id')
              .eq('numero', numero)
              .maybeSingle();

            if (!existing) {
              const { error: insertError } = await supabase
                .from('contas_apagar')
                .insert({
                  numero,
                  fornecedor_nome: userProfileData.full_name,
                  fornecedor_cnpj: userProfileData.cpf,
                  data_recebimento: new Date().toISOString().split('T')[0],
                  data_vencimento: dataVencimento,
                  valor: reconciliation.amount || 0,
                  categoria: reconciliation.category || 'Despesas',
                  descricao: reconciliation.description || 'Conta a pagar',
                  status: 'recebida',
                  aeronave: aircraftRegistration || '',
                  criado_por: user.id,
                  banco_conciliacao_id: reconciliation.id
                } as any);

              if (insertError) {
                console.error('Erro ao criar conta a pagar:', insertError);
                toast.warning('Status atualizado, mas houve erro ao criar conta a pagar');
              }
            }
          }
        }
      }

      // Criar fluxo de caixa automaticamente quando status é final
      if (user && isStatusFinal) {
        const isClientReconciliation = reconciliation.type === 'cliente';
        const isColaboradorReconciliation = reconciliation.type === 'colaborador';

        // Buscar nome do banco selecionado
        const contaSelecionada = contasBancarias.find(c => c.id === selectedBanco);
        const nomeBanco = contaSelecionada ? `${contaSelecionada.nome} - ${contaSelecionada.banco || ''}` : '';

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
              conta_banco: nomeBanco,
              comprovante_url: comprovanteUrl,
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
              conta_banco: nomeBanco,
              comprovante_url: comprovanteUrl,
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

  // Verificar se precisa mostrar campos extras (banco e comprovante)
  const showExtraFields = (reconciliation.type === 'cliente' && status?.toLowerCase() === 'conferido') ||
                          (reconciliation.type === 'colaborador' && status?.toLowerCase() === 'pago');

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
