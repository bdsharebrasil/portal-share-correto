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
import { syncSalaryPaymentToFinancial } from "@/services/financialSyncClient";

// Interfaces
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
  categoria_holerite?: string | null;
  categoria_benefit?: string | null;
  categoria_horas_voo?: string | null;
  categoria_extra?: string | null;
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
  payment = null,
  employees = [],
  onSuccess = () => { }
}: Partial<PagamentoSalarioDialogProps>) {
  const { user } = useAuth();
  const { contas } = useCategoriasConta();

  const contaNomes = contas.map(c => c.nome);
  const bancos = Array.from(new Set(contas.map(c => c.banco).filter(Boolean))) as string[];

  // Usar hook para buscar categorias
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);

  // Carregar categorias do Supabase
  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const { data } = await supabase
          .from('categorias_movimentacao')
          .select('id, nome, tipo, grupo_categoria')
          .eq('ativo', true);

        setCategorias(data || []);
      } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        setCategorias([]);
      } finally {
        setLoadingCategorias(false);
      }
    };

    fetchCategorias();
  }, []);

  // Filtrar apenas categorias de despesa relacionadas a salários
  const categoriasSalario = categorias.filter(cat =>
    cat.nome.toUpperCase().includes('SALÁRIO') ||
    cat.nome.toUpperCase().includes('HOLERITE') ||
    cat.nome.toUpperCase().includes('BENEFÍCIO') ||
    cat.nome.toUpperCase().includes('HORAS DE VOO') ||
    cat.nome.toUpperCase().includes('PAGAMENTO') ||
    cat.nome.toUpperCase().includes('BÔNUS') ||
    cat.nome.toUpperCase().includes('EXTRA') ||
    cat.grupo_categoria === 'FOLHA DE PAGAMENTO' ||
    cat.grupo_categoria === 'DESPESAS EMPRESA'
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(open ?? true);
  const [formData, setFormData] = useState<Partial<SalaryPayment>>({
    user_profile: "",
    base_salary_holerite: null,
    benefit: "",
    horas_voo: "",
    extra: "",
    obs: "",
    comprovante_url: "",
    conta_banco: "",
    banco: "",
    categoria_holerite: "",
    categoria_benefit: "",
    categoria_horas_voo: "",
    categoria_extra: ""
  });

  useEffect(() => {
    if (payment) {
      setFormData(payment);
    } else {
      // Definir categorias padrão baseado nos nomes
      const catHolerite = categoriasSalario.find(c => c.nome === 'Salários Holerite');
      const catBenefit = categoriasSalario.find(c => c.nome === 'Cartão Benefício');
      const catHorasVoo = categoriasSalario.find(c => c.nome === 'Pagamento de Horas de Voo');
      const catExtra = categoriasSalario.find(c => c.nome === 'Bônus ou Extra');

      setFormData({
        user_profile: "",
        base_salary_holerite: null,
        benefit: "",
        horas_voo: "",
        extra: "",
        obs: "",
        comprovante_url: "",
        conta_banco: "",
        banco: "",
        categoria_holerite: catHolerite?.id || "",
        categoria_benefit: catBenefit?.id || "",
        categoria_horas_voo: catHorasVoo?.id || "",
        categoria_extra: catExtra?.id || ""
      });
    }
  }, [payment, isOpen, categoriasSalario]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const sanitizedFileName = file.nome
        .replace(/[^a-zA-Z0-9.\-_]/g, "_")
        .substring(0, 100);
      const fileExt = sanitizedFileName.split('.').pop();
      const fileName = `comprovante_${timestamp}.${fileExt}`;
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
            categoria_holerite: formData.categoria_holerite || null,
            categoria_benefit: formData.categoria_benefit || null,
            categoria_horas_voo: formData.categoria_horas_voo || null,
            categoria_extra: formData.categoria_extra || null,
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
            base_salary_holerite: formData.base_salary_holerite,
            benefit: formData.benefit,
            horas_voo: formData.horas_voo,
            extra: formData.extra,
            obs: formData.obs,
            comprovante_url: formData.comprovante_url,
            conta_banco: formData.conta_banco,
            banco: formData.banco,
            categoria_holerite: formData.categoria_holerite,
            categoria_benefit: formData.categoria_benefit,
            categoria_horas_voo: formData.categoria_horas_voo,
            categoria_extra: formData.categoria_extra
          })
          .select()
          .single();

        if (error) {
          toast.error(`Erro ao criar: ${error.message}`);
          return;
        }

        // Sincronizar com controle_bancario usando serviço centralizado
        if (newPayment?.id && user?.id) {
          try {
            console.log('🔄 Iniciando sincronização com controle_bancario...', {
              paymentId: newPayment.id,
              userId: user.id,
              employeeName,
              employeeId: formData.user_profile
            });

            const syncResult = await syncSalaryPaymentToFinancial(
              newPayment.id,
              user.id,
              employeeName,
              formData.user_profile as string,
              {
                base_salary_holerite: formData.base_salary_holerite,
                horas_voo: formData.horas_voo,
                benefit: formData.benefit,
                extra: formData.extra,
                comprovante_url: formData.comprovante_url,
                obs: formData.obs,
                banco: formData.banco || formData.conta_banco,
              }
            );

            if (!syncResult.success) {
              toast.warning(`Pagamento criado, mas houve erro na sincronização: ${syncResult.error}`);
            } else {
              toast.success("Pagamento e sincronização concluídos com sucesso!");
            }
          } catch (error) {
            console.error('Erro na sincronização:', error);
            toast.error(`Erro na sincronização: ${(error as Error).message}`);
          }
        }
      }

      onSuccess();
      setIsOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar pagamento");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
              </SelectContent>
            </Select>
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
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3 text-gray-700">Componentes do Pagamento</h3>

            {/* Salário Holerite */}
            <div className="space-y-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="grid grid-cols-2 gap-3">
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
                <div className="space-y-2">
                  <Label htmlFor="categoria_holerite" className="text-sm font-medium">
                    Categoria
                  </Label>
                  <Select
                    value={formData.categoria_holerite || ""}
                    onValueChange={(value) => setFormData({ ...formData, categoria_holerite: value })}
                    disabled={loadingCategorias}
                  >
                    <SelectTrigger id="categoria_holerite">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasSalario.map((cat) => (
                        <SelectItem key={cat.id} value={cat.nome}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Benefício */}
            <div className="space-y-3 mb-4 p-3 bg-green-50 rounded-lg border border-green-100">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label htmlFor="categoria_benefit" className="text-sm font-medium">
                    Categoria
                  </Label>
                  <Select
                    value={formData.categoria_benefit || ""}
                    onValueChange={(value) => setFormData({ ...formData, categoria_benefit: value })}
                    disabled={loadingCategorias}
                  >
                    <SelectTrigger id="categoria_benefit">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasSalario.map((cat) => (
                        <SelectItem key={cat.id} value={cat.nome}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Horas de Voo */}
            <div className="space-y-3 mb-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="flight_hours" className="text-sm font-medium">
                    Horas de Voo (R$)
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
                <div className="space-y-2">
                  <Label htmlFor="categoria_horas_voo" className="text-sm font-medium">
                    Categoria
                  </Label>
                  <Select
                    value={formData.categoria_horas_voo || ""}
                    onValueChange={(value) => setFormData({ ...formData, categoria_horas_voo: value })}
                    disabled={loadingCategorias}
                  >
                    <SelectTrigger id="categoria_horas_voo">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasSalario.map((cat) => (
                        <SelectItem key={cat.id} value={cat.nome}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Extra */}
            <div className="space-y-3 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <div className="grid grid-cols-2 gap-3">
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
                <div className="space-y-2">
                  <Label htmlFor="categoria_extra" className="text-sm font-medium">
                    Categoria
                  </Label>
                  <Select
                    value={formData.categoria_extra || ""}
                    onValueChange={(value) => setFormData({ ...formData, categoria_extra: value })}
                    disabled={loadingCategorias}
                  >
                    <SelectTrigger id="categoria_extra">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasSalario.map((cat) => (
                        <SelectItem key={cat.id} value={cat.nome}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Comprovante de Pagamento */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Comprovante de Pagamento
            </Label>
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
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
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
