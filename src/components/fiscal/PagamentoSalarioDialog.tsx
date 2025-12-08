import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoriasConta } from "@/hooks/useCategoriasFinanceiro";
import { toast } from "sonner";
import { Upload, FileText, X } from "lucide-react";
import { format } from "date-fns";

interface SalaryPayment {
  id: string;
  user_profile: string;
  base_salary_holerite: number | null;
  benefit: string | null;
  horas_voo: string | null;
  extra: string | null;
  obs: string | null;
  comprovante_url?: string | null;
  created_at?: string | null;
  conta_banco?: string | null;
  banco?: string | null;
}

interface PagamentoSalarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: SalaryPayment | null;
  employees: any[];
  onSuccess: () => void;
}

export function PagamentoSalarioDialog({
  open,
  onOpenChange,
  payment,
  employees,
  onSuccess
}: PagamentoSalarioDialogProps) {
  const { user } = useAuth();
  const { contas } = useCategoriasConta();
  const contaNomes = contas.map(c => c.nome);
  const bancos = Array.from(new Set(contas.map(c => c.banco).filter(Boolean))) as string[];

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<Partial<SalaryPayment>>({
    user_profile: "",
    base_salary_holerite: null,
    benefit: "",
    horas_voo: "",
    extra: "",
    obs: "",
    comprovante_url: "",
    conta_banco: "",
    banco: ""
  });

  useEffect(() => {
    if (payment) {
      setFormData(payment);
    } else {
      setFormData({
        user_profile: "",
        base_salary_holerite: null,
        benefit: "",
        horas_voo: "",
        extra: "",
        obs: "",
        comprovante_url: "",
        conta_banco: "",
        banco: ""
      });
    }
  }, [payment, open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `comprovante_${Date.now()}.${fileExt}`;
      const filePath = `salarios/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('comprovantes')
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Erro ao fazer upload: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('comprovantes')
        .getPublicUrl(filePath);

      setFormData({ ...formData, comprovante_url: publicUrlData.publicUrl });
      toast.success("Comprovante enviado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar arquivo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.user_profile) {
      toast.error("Por favor, selecione um funcionário");
      return;
    }

    setIsSaving(true);
    try {
      const selectedEmployee = employees.find(e => e.id === formData.user_profile);
      const employeeName = selectedEmployee?.full_name || "Funcionário";
      const totalValue = (formData.base_salary_holerite || 0) +
        (parseFloat(formData.horas_voo || "0") || 0) +
        (parseFloat(formData.extra || "0") || 0);

      if (payment?.id) {
        // Update existing payment
        const { error } = await supabase
          .from("pagamento_salario_funcionario")
          .update({
            user_profile: formData.user_profile,
            base_salary_holerite: formData.base_salary_holerite ? parseFloat(formData.base_salary_holerite.toString()) : null,
            benefit: formData.benefit || null,
            horas_voo: formData.horas_voo || null,
            extra: formData.extra || null,
            obs: formData.obs || null,
            comprovante_url: formData.comprovante_url || null,
            conta_banco: formData.conta_banco || null,
            banco: formData.banco || null,
            updated_at: new Date().toISOString()
          })
          .eq("id", payment.id);

        if (error) {
          toast.error(`Erro ao atualizar: ${error.message}`);
          return;
        }
        toast.success("Pagamento atualizado com sucesso!");
      } else {
        // Create new payment
        const { data: newPayment, error } = await supabase
          .from("pagamento_salario_funcionario")
          .insert({
            user_profile: formData.user_profile,
            base_salary_holerite: formData.base_salary_holerite ? parseFloat(formData.base_salary_holerite.toString()) : null,
            benefit: formData.benefit || null,
            horas_voo: formData.horas_voo || null,
            extra: formData.extra || null,
            obs: formData.obs || null,
            comprovante_url: formData.comprovante_url || null,
            conta_banco: formData.conta_banco || null,
            banco: formData.banco || null
          })
          .select()
          .single();

        if (error) {
          toast.error(`Erro ao criar: ${error.message}`);
          return;
        }

        // Insert into controle_bancario as expense
        if (totalValue > 0 && user?.id) {
          const now = new Date();
          const { error: fluxoError } = await supabase
            .from("controle_bancario")
            .insert({
              data: format(now, "yyyy-MM-dd"),
              tipo_movimento: "saída",
              categoria: "Salário",
              descricao: `Pagamento de salário - ${employeeName}`,
              valor: totalValue,
              status: "confirmado",
              comprovante_url: formData.comprovante_url || null,
              criado_por: user.id,
              referencia: newPayment?.id || null,
              observacoes: formData.obs || null,
              conta_banco: formData.conta_banco || null
            });

          if (fluxoError) {
            console.error("Erro ao registrar no fluxo de caixa:", fluxoError);
            toast.error(`Pagamento criado, mas erro no fluxo de caixa: ${fluxoError.message}`);
          }
        }

        toast.success("Pagamento registrado com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar pagamento");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {payment?.id ? "Editar Pagamento de Salário" : "Novo Pagamento de Salário"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Funcionário - Required */}
          <div className="space-y-2">
            <Label htmlFor="employee" className="text-sm font-medium">
              Funcionário <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.user_profile || ""}
              onValueChange={(value) => setFormData({ ...formData, user_profile: value })}
            >
              <SelectTrigger id="employee">
                <SelectValue placeholder="Selecione o funcionário" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conta Bancária */}
          <div className="space-y-2">
            <Label htmlFor="conta_banco" className="text-sm font-medium">
              Conta Bancária
            </Label>
            <Select
              value={formData.conta_banco || ""}
              onValueChange={(value) => setFormData({ ...formData, conta_banco: value })}
            >
              <SelectTrigger id="conta_banco">
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {contaNomes.map((conta) => (
                  <SelectItem key={conta} value={conta}>
                    {conta}
                  </SelectItem>
                ))}
                {contaNomes.length === 0 && (
                  <div className="text-center py-3 text-muted-foreground text-sm">
                    Nenhuma conta disponível
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Salário Holerite */}
          <div className="space-y-2">
            <Label htmlFor="salary" className="text-sm font-medium">
              Salário Holerite (R$)
            </Label>
            <Input
              id="salary"
              type="number"
              placeholder="0.00"
              step="0.01"
              min="0"
              value={formData.base_salary_holerite || ""}
              onChange={(e) => setFormData({
                ...formData,
                base_salary_holerite: e.target.value ? parseFloat(e.target.value) : null
              })}
            />
          </div>

          {/* Benefício */}
          <div className="space-y-2">
            <Label htmlFor="benefit" className="text-sm font-medium">
              Cartão Benefício
            </Label>
            <Input
              id="benefit"
              type="text"
              placeholder="Descrição do benefício"
              value={formData.benefit || ""}
              onChange={(e) => setFormData({ ...formData, benefit: e.target.value })}
            />
          </div>

          {/* Horas de Voo */}
          <div className="space-y-2">
            <Label htmlFor="flight_hours" className="text-sm font-medium">
              Pagamento Horas de Voo (R$)
            </Label>
            <Input
              id="flight_hours"
              type="number"
              placeholder="0.00"
              step="0.01"
              value={formData.horas_voo || ""}
              onChange={(e) => setFormData({ ...formData, horas_voo: e.target.value })}
            />
          </div>

          {/* Extra */}
          <div className="space-y-2">
            <Label htmlFor="extra" className="text-sm font-medium">
              Extra (R$)
            </Label>
            <Input
              id="extra"
              type="number"
              placeholder="0.00"
              step="0.01"
              value={formData.extra || ""}
              onChange={(e) => setFormData({ ...formData, extra: e.target.value })}
            />
          </div>

          {/* Comprovante de Pagamento */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Comprovante de Pagamento
            </Label>
            {formData.comprovante_url ? (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
                <a
                  href={formData.comprovante_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex-1 truncate"
                >
                  Ver comprovante
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormData({ ...formData, comprovante_url: "" })}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                  id="comprovante-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('comprovante-upload')?.click()}
                  disabled={isUploading}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? "Enviando..." : "Anexar Comprovante"}
                </Button>
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="obs" className="text-sm font-medium">
              Observações
            </Label>
            <Textarea
              id="obs"
              placeholder="Observações adicionais"
              value={formData.obs || ""}
              onChange={(e) => setFormData({ ...formData, obs: e.target.value })}
              className="min-h-20"
            />
          </div>

          {/* Banco */}
          <div className="space-y-2">
            <Label htmlFor="banco" className="text-sm font-medium">
              Banco
            </Label>
            <Select
              value={formData.banco || ""}
              onValueChange={(value) => setFormData({ ...formData, banco: value })}
            >
              <SelectTrigger id="banco">
                <SelectValue placeholder="Selecione o banco" />
              </SelectTrigger>
              <SelectContent>
                {bancos.map((banco) => (
                  <SelectItem key={banco} value={banco}>
                    {banco}
                  </SelectItem>
                ))}
                {bancos.length === 0 && (
                  <div className="text-center py-3 text-muted-foreground text-sm">
                    Nenhum banco disponível
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isUploading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
