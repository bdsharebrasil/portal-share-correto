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
import { syncSalaryPaymentToFinancial } from "@/services/financialSyncClient";

// Interface alinhada 1:1 com o schema da tabela pagamento_salario_funcionario
interface SalaryPayment {
  id: string;
  user_profile: string | null;
  base_salary_holerite: number | null;
  benefit: string | null;
  horas_voo: string | null;
  extra: string | null;
  obs: string | null;
  obs2: string | null;
  holerite_url: string | null;
  comprovante_url: string | null;
  decimo_terceiro_parcela1: number | null;
  decimo_terceiro_parcela2: number | null;
  ferias: number | null;
  banco: string | null;
  data_pagamento: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
}

interface PagamentoSalarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: SalaryPayment | null;
  employees: any[];
  onSuccess: () => void;
}

const emptyForm: Partial<SalaryPayment> = {
  user_profile: "",
  base_salary_holerite: null,
  benefit: "",
  horas_voo: "",
  extra: "",
  obs: "",
  obs2: "",
  holerite_url: "",
  comprovante_url: "",
  decimo_terceiro_parcela1: null,
  decimo_terceiro_parcela2: null,
  ferias: null,
  banco: "",
  data_pagamento: "",
};

export function PagamentoSalarioDialog({
  open,
  onOpenChange,
  payment = null,
  employees = [],
  onSuccess = () => {},
}: Partial<PagamentoSalarioDialogProps>) {
  const { user } = useAuth();
  const { contas } = useCategoriasConta();

  // "banco" na tabela é texto livre, mas aproveitamos a lista de bancos já cadastrados
  const bancos = Array.from(new Set(contas.map((c) => c.banco).filter(Boolean))) as string[];

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingComprovante, setIsUploadingComprovante] = useState(false);
  const [isUploadingHolerite, setIsUploadingHolerite] = useState(false);
  const [isOpen, setIsOpen] = useState(open ?? true);
  const [formData, setFormData] = useState<Partial<SalaryPayment>>(emptyForm);

  useEffect(() => {
    setIsOpen(open ?? true);
  }, [open]);

  useEffect(() => {
    if (payment) {
      setFormData(payment);
    } else {
      setFormData(emptyForm);
    }
  }, [payment, isOpen]);

  const handleOpenChange = (value: boolean) => {
    setIsOpen(value);
    onOpenChange?.(value);
  };

  const uploadFile = async (
    file: File,
    folder: "salarios" | "holerites",
    prefix: string
  ): Promise<string> => {
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").substring(0, 100);
    const fileExt = sanitizedFileName.split(".").pop();
    const fileName = `${prefix}_${timestamp}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from("comprovantes").upload(filePath, file);
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from("comprovantes").getPublicUrl(filePath);
    return publicUrlData.publicUrl;
  };

  const handleComprovanteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingComprovante(true);
    try {
      const url = await uploadFile(file, "salarios", "comprovante");
      setFormData((prev) => ({ ...prev, comprovante_url: url }));
      toast.success("Comprovante enviado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar comprovante");
    } finally {
      setIsUploadingComprovante(false);
      e.target.value = "";
    }
  };

  const handleHoleriteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingHolerite(true);
    try {
      const url = await uploadFile(file, "holerites", "holerite");
      setFormData((prev) => ({ ...prev, holerite_url: url }));
      toast.success("Holerite enviado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar holerite");
    } finally {
      setIsUploadingHolerite(false);
      e.target.value = "";
    }
  };

  const toNumberOrNull = (value: string | number | null | undefined) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = typeof value === "number" ? value : parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const handleSave = async () => {
    if (!formData.user_profile) {
      toast.error("Por favor, selecione um funcionário");
      return;
    }

    setIsSaving(true);
    try {
      const selectedEmployee = employees.find((e) => e.id === formData.user_profile);
      const employeeName = selectedEmployee?.full_name || "Funcionário";

      const payload = {
        user_profile: formData.user_profile,
        base_salary_holerite: toNumberOrNull(formData.base_salary_holerite),
        benefit: formData.benefit || null,
        horas_voo: formData.horas_voo || null,
        extra: formData.extra || null,
        obs: formData.obs || null,
        obs2: formData.obs2 || null,
        holerite_url: formData.holerite_url || null,
        comprovante_url: formData.comprovante_url || null,
        decimo_terceiro_parcela1: toNumberOrNull(formData.decimo_terceiro_parcela1),
        decimo_terceiro_parcela2: toNumberOrNull(formData.decimo_terceiro_parcela2),
        ferias: toNumberOrNull(formData.ferias),
        banco: formData.banco || null,
        data_pagamento: formData.data_pagamento || null,
      };

      if (payment?.id) {
        // Atualizar pagamento existente
        const { error } = await supabase
          .from("pagamento_salario_funcionario")
          .update({
            ...payload,
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", payment.id);

        if (error) {
          toast.error(`Erro ao atualizar: ${error.message}`);
          return;
        }
        toast.success("Pagamento atualizado com sucesso!");
      } else {
        // Criar novo pagamento
        const { data: newPayment, error } = await supabase
          .from("pagamento_salario_funcionario")
          .insert(payload)
          .select()
          .single();

        if (error) {
          toast.error(`Erro ao criar: ${error.message}`);
          return;
        }

        // Sincronizar com controle_bancario (o trigger no banco também sincroniza,
        // isso mantém a sincronização client-side para feedback imediato)
        if (newPayment?.id && user?.id) {
          try {
            const syncResult = await syncSalaryPaymentToFinancial(
              newPayment.id,
              user.id,
              employeeName,
              formData.user_profile as string,
              {
                base_salary_holerite: payload.base_salary_holerite,
                horas_voo: payload.horas_voo,
                benefit: payload.benefit,
                extra: payload.extra,
                comprovante_url: payload.comprovante_url,
                obs: payload.obs,
                banco: payload.banco,
              }
            );

            if (!syncResult.success) {
              toast.warning(`Pagamento criado, mas houve erro na sincronização: ${syncResult.error}`);
            } else {
              toast.success("Pagamento e sincronização concluídos com sucesso!");
            }
          } catch (error) {
            console.error("Erro na sincronização:", error);
            toast.error(`Erro na sincronização: ${(error as Error).message}`);
          }
        }
      }

      onSuccess();
      handleOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar pagamento");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {payment?.id ? "Editar Pagamento de Salário" : "Novo Pagamento de Salário"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Funcionário - obrigatório */}
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

          <div className="grid grid-cols-2 gap-3">
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
                </SelectContent>
              </Select>
            </div>

            {/* Data de Pagamento */}
            <div className="space-y-2">
              <Label htmlFor="data_pagamento" className="text-sm font-medium">
                Data de Pagamento
              </Label>
              <Input
                id="data_pagamento"
                type="date"
                value={formData.data_pagamento || ""}
                onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3 text-gray-700">Componentes do Pagamento</h3>

            {/* Salário Holerite */}
            <div className="space-y-2 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <Label htmlFor="salary" className="text-sm font-medium">
                Salário Holerite (R$)
              </Label>
              <Input
                id="salary"
                type="number"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={formData.base_salary_holerite ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    base_salary_holerite: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
              />
            </div>

            {/* Benefício */}
            <div className="space-y-2 mb-4 p-3 bg-green-50 rounded-lg border border-green-100">
              <Label htmlFor="benefit" className="text-sm font-medium">
                Cartão Benefício (R$)
              </Label>
              <Input
                id="benefit"
                type="text"
                placeholder="0.00"
                value={formData.benefit || ""}
                onChange={(e) => setFormData({ ...formData, benefit: e.target.value })}
              />
            </div>

            {/* Horas de Voo */}
            <div className="space-y-2 mb-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
              <Label htmlFor="flight_hours" className="text-sm font-medium">
                Horas de Voo (R$)
              </Label>
              <Input
                id="flight_hours"
                type="text"
                placeholder="0.00"
                value={formData.horas_voo || ""}
                onChange={(e) => setFormData({ ...formData, horas_voo: e.target.value })}
              />
            </div>

            {/* Extra */}
            <div className="space-y-2 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <Label htmlFor="extra" className="text-sm font-medium">
                Extra (R$)
              </Label>
              <Input
                id="extra"
                type="text"
                placeholder="0.00"
                value={formData.extra || ""}
                onChange={(e) => setFormData({ ...formData, extra: e.target.value })}
              />
            </div>

            {/* Décimo Terceiro */}
            <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-rose-50 rounded-lg border border-rose-100">
              <div className="space-y-2">
                <Label htmlFor="decimo1" className="text-sm font-medium">
                  13º Salário - Parcela 1 (R$)
                </Label>
                <Input
                  id="decimo1"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.decimo_terceiro_parcela1 ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      decimo_terceiro_parcela1: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="decimo2" className="text-sm font-medium">
                  13º Salário - Parcela 2 (R$)
                </Label>
                <Input
                  id="decimo2"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.decimo_terceiro_parcela2 ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      decimo_terceiro_parcela2: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>

            {/* Férias */}
            <div className="space-y-2 mb-4 p-3 bg-teal-50 rounded-lg border border-teal-100">
              <Label htmlFor="ferias" className="text-sm font-medium">
                Férias (R$)
              </Label>
              <Input
                id="ferias"
                type="number"
                placeholder="0.00"
                step="0.01"
                value={formData.ferias ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ferias: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>

          {/* Holerite (arquivo) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Holerite (arquivo)</Label>
            {formData.holerite_url ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
                <a
                  href={formData.holerite_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex-1 truncate"
                >
                  Ver holerite
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormData({ ...formData, holerite_url: "" })}
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
                  onChange={handleHoleriteUpload}
                  disabled={isUploadingHolerite}
                  className="hidden"
                  id="holerite-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("holerite-upload")?.click()}
                  disabled={isUploadingHolerite}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploadingHolerite ? "Enviando..." : "Anexar Holerite"}
                </Button>
              </div>
            )}
          </div>

          {/* Comprovante de Pagamento */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Comprovante de Pagamento</Label>
            {formData.comprovante_url ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
                <a
                  href={formData.comprovante_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex-1 truncate"
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
                  onChange={handleComprovanteUpload}
                  disabled={isUploadingComprovante}
                  className="hidden"
                  id="comprovante-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("comprovante-upload")?.click()}
                  disabled={isUploadingComprovante}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploadingComprovante ? "Enviando..." : "Anexar Comprovante"}
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

          {/* Observações 2 */}
          <div className="space-y-2">
            <Label htmlFor="obs2" className="text-sm font-medium">
              Observações Adicionais 2
            </Label>
            <Textarea
              id="obs2"
              placeholder="Observações complementares"
              value={formData.obs2 || ""}
              onChange={(e) => setFormData({ ...formData, obs2: e.target.value })}
              className="min-h-20"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isUploadingComprovante || isUploadingHolerite}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}