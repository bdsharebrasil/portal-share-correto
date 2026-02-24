import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Save, Upload, Eye, FileText, Receipt, Loader2, Trash2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoriasConta } from "@/hooks/useCategoriasFinanceiro";
import { toast } from "sonner";
import { format } from "date-fns";
import { syncSalaryPaymentToFinancial, deleteSalaryPaymentFromFinancial } from "@/services/financialSyncClient";
interface Employee {
  id: string;
  full_name: string;
  email: string;
}
interface SalaryPaymentRow {
  id?: string;
  user_profile: string;
  employee_name: string;
  base_salary_holerite: number | null;
  benefit: string;
  horas_voo: string;
  decimo_terceiro_parcela1: number | null;
  decimo_terceiro_parcela2: number | null;
  ferias: number | null;
  extra: string;
  obs: string;
  banco: string;
  data_pagamento: string | null;
  holerite_url: string | null;
  comprovante_url: string | null;
  isDirty?: boolean;
  isLoading?: boolean;
}
const MONTHS = [{
  value: "01",
  label: "Janeiro"
}, {
  value: "02",
  label: "Fevereiro"
}, {
  value: "03",
  label: "Março"
}, {
  value: "04",
  label: "Abril"
}, {
  value: "05",
  label: "Maio"
}, {
  value: "06",
  label: "Junho"
}, {
  value: "07",
  label: "Julho"
}, {
  value: "08",
  label: "Agosto"
}, {
  value: "09",
  label: "Setembro"
}, {
  value: "10",
  label: "Outubro"
}, {
  value: "11",
  label: "Novembro"
}, {
  value: "12",
  label: "Dezembro"
}];
export function PagamentoSalarioTab() {
  const {
    isAdmin,
    isGestorMaster,
    isFinanceiroMaster
  } = useUserRole();
  const {
    user
  } = useAuth();
  const {
    contas
  } = useCategoriasConta();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [paymentRows, setPaymentRows] = useState<SalaryPaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [showPeriodSelector, setShowPeriodSelector] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"holerite" | "comprovante">("holerite");
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);

  // Get bancos from contas_bancarias and from existing payments
  const bancosFromContas = Array.from(new Set(contas.map(c => c.banco).filter(Boolean))) as string[];
  const bancosFromPayments = paymentRows.map(row => row.banco).filter(Boolean) as string[];
  const bancos = Array.from(new Set([...bancosFromContas, ...bancosFromPayments])) as string[];
  const years = ["2024", "2025", "2026", "2027"];
  const isAuthorized = isAdmin || isGestorMaster || isFinanceiroMaster;

  // Load employees
  useEffect(() => {
    if (isAuthorized) {
      loadEmployees();
    }
  }, [isAuthorized]);
  const loadEmployees = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("user_profiles").select("id, full_name, email").eq("employment_status", "ativo").eq("tipo", "colaborador").order("full_name", {
        ascending: true
      });
      if (error) {
        console.error("Erro ao carregar funcionários:", error);
        return;
      }
      setEmployees(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar funcionários:", error);
    }
  };
  const loadPaymentsForPeriod = async () => {
    if (!selectedMonth || !selectedYear) {
      toast.error("Selecione mês e ano");
      return;
    }
    setIsLoading(true);
    try {
      const startDate = `${selectedYear}-${selectedMonth}-01`;
      const endDate = `${selectedYear}-${selectedMonth}-31`;
      const {
        data: existingPayments,
        error
      } = await supabase.from("pagamento_salario_funcionario").select("*").gte("created_at", startDate).lte("created_at", `${endDate}T23:59:59`);
      if (error) {
        toast.error(`Erro ao carregar pagamentos: ${error.message}`);
        return;
      }

      // Create rows for all employees, filling in existing data
      const rows: SalaryPaymentRow[] = employees.map(employee => {
        const existingPayment = existingPayments?.find(p => p.user_profile === employee.id);
        return {
          id: existingPayment?.id || undefined,
          user_profile: employee.id,
          employee_name: employee.full_name,
          base_salary_holerite: existingPayment?.base_salary_holerite || null,
          benefit: existingPayment?.benefit || "",
          horas_voo: existingPayment?.horas_voo || "",
          decimo_terceiro_parcela1: existingPayment?.decimo_terceiro_parcela1 || null,
          decimo_terceiro_parcela2: existingPayment?.decimo_terceiro_parcela2 || null,
          ferias: existingPayment?.ferias || null,
          extra: existingPayment?.extra || "",
          obs: existingPayment?.obs || "",
          banco: existingPayment?.banco || "",
          data_pagamento: existingPayment?.data_pagamento || null,
          holerite_url: existingPayment?.holerite_url || null,
          comprovante_url: existingPayment?.comprovante_url || null,
          isDirty: false,
          isLoading: false
        };
      });
      
      // Sort: employees with existing payments first, then alphabetically
      rows.sort((a, b) => {
        const aHasPayment = !!a.id;
        const bHasPayment = !!b.id;
        if (aHasPayment && !bHasPayment) return -1;
        if (!aHasPayment && bHasPayment) return 1;
        return a.employee_name.localeCompare(b.employee_name);
      });
      
      setPaymentRows(rows);
      setShowPeriodSelector(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  };
  const updateRow = (index: number, field: keyof SalaryPaymentRow, value: any) => {
    setPaymentRows(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
        isDirty: true
      };
      return updated;
    });
  };
  const createCashFlowEntry = async (
    employeeId: string,
    employeeName: string,
    row: SalaryPaymentRow,
    paymentId: string
  ) => {
    if (!user) return;

    const result = await syncSalaryPaymentToFinancial(
      paymentId,
      user.id,
      employeeName,
      employeeId,
      {
        base_salary_holerite: row.base_salary_holerite,
        horas_voo: row.horas_voo,
        benefit: row.benefit,
        extra: row.extra,
        ferias: row.ferias,
        decimo_terceiro_parcela1: row.decimo_terceiro_parcela1,
        decimo_terceiro_parcela2: row.decimo_terceiro_parcela2,
        comprovante_url: row.comprovante_url,
        obs: row.obs,
        banco: row.banco,
        data_pagamento: row.data_pagamento,
      }
    );

    if (result.success) {
      toast.success(`Lançamentos criados no fluxo de caixa para ${employeeName}!`);
      console.log(`✅ Pagamento de ${employeeName} sincronizado com sucesso`);
    } else {
      toast.error(`⚠️ Erro ao criar lançamentos no fluxo de caixa: ${result.error}`);
      console.error(`❌ Erro ao sincronizar pagamento de ${employeeName}:`, result.error);
    }
  };


  const deleteCashFlowEntry = async (paymentId: string) => {
    await deleteSalaryPaymentFromFinancial(paymentId);
  };

  const deletePaymentRow = async (index: number) => {
    const row = paymentRows[index];
    if (!row.id) {
      // Se não tem ID, apenas remove da lista local
      setPaymentRows(prev => prev.filter((_, i) => i !== index));
      return;
    }

    try {
      // Deletar do fluxo de caixa primeiro
      await deleteCashFlowEntry(row.id);

      // Deletar o pagamento de salário
      const { error } = await supabase
        .from("pagamento_salario_funcionario")
        .delete()
        .eq("id", row.id);

      if (error) throw error;

      // Atualizar lista local
      setPaymentRows(prev => prev.map((r, i) => 
        i === index ? { ...r, id: undefined, base_salary_holerite: null, isDirty: false } : r
      ));

      toast.success(`Pagamento de ${row.employee_name} removido!`);
      setExpandedEmployeeId(null);
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar pagamento");
    }
  };
  const updateThirteenthSalary = async (employeeId: string, employeeName: string, parcela1: number | null, parcela2: number | null, year: string) => {
    if (!user) return;
    const yearNum = parseInt(year);
    try {
      // Check if record exists for this employee and year
      const {
        data: existing,
        error: fetchError
      } = await supabase.from("employee_thirteenth_salary").select("*").eq("user_profile", employeeId).eq("year", yearNum).maybeSingle();
      if (fetchError) {
        console.error("Erro ao buscar 13º salário:", fetchError);
        return;
      }
      let newStatus = "pending";
      const hasParcela1 = parcela1 && parcela1 > 0 || existing?.first_installment_amount && existing.first_installment_amount > 0;
      const hasParcela2 = parcela2 && parcela2 > 0 || existing?.second_installment_amount && existing.second_installment_amount > 0;
      if (hasParcela1 && hasParcela2) {
        newStatus = "paid";
      } else if (hasParcela1) {
        newStatus = "first_paid";
      } else if (hasParcela2) {
        newStatus = "second_paid";
      }
      const updateData: any = {
        updated_at: new Date().toISOString(),
        payment_status: newStatus
      };
      if (parcela1 && parcela1 > 0) {
        updateData.first_installment_amount = parcela1;
        updateData.first_installment_date = format(new Date(), "yyyy-MM-dd");
      }
      if (parcela2 && parcela2 > 0) {
        updateData.second_installment_amount = parcela2;
        updateData.second_installment_date = format(new Date(), "yyyy-MM-dd");
      }
      if (existing) {
        // Update existing record
        const {
          error: updateError
        } = await supabase.from("employee_thirteenth_salary").update(updateData).eq("id", existing.id);
        if (updateError) {
          console.error("Erro ao atualizar 13º salário:", updateError);
          toast.error("Erro ao atualizar registro de 13º salário");
        } else {
          toast.success(`13º salário de ${employeeName} atualizado!`);
        }
      } else {
        // Create new record
        const {
          error: insertError
        } = await supabase.from("employee_thirteenth_salary").insert({
          user_profile: employeeId,
          year: yearNum,
          first_installment_amount: parcela1 || 0,
          first_installment_date: parcela1 && parcela1 > 0 ? format(new Date(), "yyyy-MM-dd") : null,
          second_installment_amount: parcela2 || 0,
          second_installment_date: parcela2 && parcela2 > 0 ? format(new Date(), "yyyy-MM-dd") : null,
          payment_status: newStatus,
          gross_value: (parcela1 || 0) + (parcela2 || 0),
          net_value: (parcela1 || 0) + (parcela2 || 0)
        });
        if (insertError) {
          console.error("Erro ao criar registro de 13º salário:", insertError);
          toast.error("Erro ao criar registro de 13º salário");
        } else {
          toast.success(`13º salário de ${employeeName} registrado!`);
        }
      }

      // Cash flow entries are now created in the main createCashFlowEntry function
    } catch (error: any) {
      console.error("Erro ao processar 13º salário:", error);
    }
  };
  const handleFileUpload = async (index: number, file: File, type: "holerite" | "comprovante") => {
    const row = paymentRows[index];
    const bucket = type === "holerite" ? "holerites" : "comprovantes";
    const filePath = `${row.user_profile}/${selectedYear}/${selectedMonth}_${Date.now()}_${file.name}`;
    setPaymentRows(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        isLoading: true
      };
      return updated;
    });
    try {
      const {
        error: uploadError
      } = await supabase.storage.from(bucket).upload(filePath, file, {
        upsert: true
      });
      if (uploadError) {
        toast.error(`Erro ao fazer upload: ${uploadError.message}`);
        return;
      }
      const {
        data: publicUrlData
      } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const urlField = type === "holerite" ? "holerite_url" : "comprovante_url";
      setPaymentRows(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          [urlField]: publicUrlData.publicUrl,
          isDirty: true,
          isLoading: false
        };
        return updated;
      });
      toast.success(`${type === "holerite" ? "Holerite" : "Comprovante"} enviado com sucesso!`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer upload");
      setPaymentRows(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          isLoading: false
        };
        return updated;
      });
    }
  };
  const saveRow = async (index: number) => {
    const row = paymentRows[index];
    const previousRow = paymentRows[index];
    setPaymentRows(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        isLoading: true
      };
      return updated;
    });
    try {
      const paymentData = {
        user_profile: row.user_profile,
        base_salary_holerite: row.base_salary_holerite,
        benefit: row.benefit || null,
        horas_voo: row.horas_voo || null,
        decimo_terceiro_parcela1: row.decimo_terceiro_parcela1,
        decimo_terceiro_parcela2: row.decimo_terceiro_parcela2,
        ferias: row.ferias,
        extra: row.extra || null,
        obs: row.obs || null,
        banco: row.banco || null,
        data_pagamento: row.data_pagamento,
        holerite_url: row.holerite_url,
        comprovante_url: row.comprovante_url
      };
      let isNewPayment = !row.id;
      if (row.id) {
        const {
          error
        } = await supabase.from("pagamento_salario_funcionario").update({
          ...paymentData,
          updated_at: new Date().toISOString()
        }).eq("id", row.id);
        if (error) throw error;

        // Para update, não recriamos entradas do fluxo de caixa por ora
      } else {
        const {
          data,
          error
        } = await supabase.from("pagamento_salario_funcionario").insert({
          ...paymentData,
          created_at: `${selectedYear}-${selectedMonth}-15T12:00:00Z`
        }).select().single();
        if (error) throw error;
        setPaymentRows(prev => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            id: data.id
          };
          return updated;
        });

        // Create cash flow entries for all payment types
        if (data) {
          await createCashFlowEntry(row.user_profile, row.employee_name, row, data.id);
        }
      }

      // Handle 13th salary table updates (for tracking purposes)
      if (row.decimo_terceiro_parcela1 || row.decimo_terceiro_parcela2) {
        await updateThirteenthSalary(row.user_profile, row.employee_name, row.decimo_terceiro_parcela1, row.decimo_terceiro_parcela2, selectedYear);
      }
      setPaymentRows(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          isDirty: false,
          isLoading: false
        };
        return updated;
      });
      toast.success(`Pagamento de ${row.employee_name} salvo com sucesso!`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar");
      setPaymentRows(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          isLoading: false
        };
        return updated;
      });
    }
  };
  const saveAllDirty = async () => {
    const dirtyIndexes = paymentRows.map((row, index) => row.isDirty ? index : -1).filter(i => i !== -1);
    for (const index of dirtyIndexes) {
      await saveRow(index);
    }
    if (dirtyIndexes.length > 0) {
      toast.success("Todos os pagamentos foram salvos!");
    } else {
      toast.info("Nenhuma alteração para salvar");
    }
  };
  const openPreview = (url: string, type: "holerite" | "comprovante") => {
    setPreviewUrl(url);
    setPreviewType(type);
  };
  if (!isAuthorized) {
    return <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive font-semibold">Acesso negado</p>
          <p className="text-sm text-muted-foreground mt-2">
            Você não tem permissão para acessar este módulo.
          </p>
        </CardContent>
      </Card>;
  }
  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pagamento de Salários</h2>
          <p className="text-muted-foreground mt-1">
            Gerenciar pagamentos de salários dos funcionários
          </p>
        </div>
        {!showPeriodSelector && (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setShowPeriodSelector(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              Alterar Período
            </Button>
            <Button onClick={saveAllDirty} className="bg-emerald-600 hover:bg-emerald-700">
              <Save className="h-4 w-4 mr-2" />
              Salvar Todos
            </Button>
          </div>
        )}
      </div>

      {/* Period Selector */}
      {showPeriodSelector ? (
        <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              Selecione o Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label className="text-sm font-medium">Mês</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full h-11">
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {MONTHS.map(month => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-2">
                <Label className="text-sm font-medium">Ano</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-full h-11">
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {years.map(year => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={loadPaymentsForPeriod} 
                disabled={isLoading || !selectedMonth || !selectedYear} 
                className="h-11 px-6 bg-primary hover:bg-primary/90"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4 mr-2" />
                )}
                Carregar Funcionários
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Period Info */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 flex items-center justify-between border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="font-semibold text-lg">
                  {MONTHS.find(m => m.value === selectedMonth)?.label} / {selectedYear}
                </span>
                <p className="text-sm text-muted-foreground">
                  {paymentRows.filter(r => !!r.id).length} de {paymentRows.length} funcionários pagos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span>Pago</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground ml-3">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30"></div>
                <span>Pendente</span>
              </div>
            </div>
          </div>

          {/* Employee List */}
          <div className="flex-1 overflow-auto">
            <div className="space-y-2">
              {paymentRows.map((row, index) => {
                const hasExistingPayment = !!row.id;
                const totalPaid = (row.base_salary_holerite || 0) + 
                  parseFloat(row.horas_voo || "0") + 
                  parseFloat(row.benefit || "0") + 
                  parseFloat(row.extra || "0") + 
                  (row.ferias || 0) + 
                  (row.decimo_terceiro_parcela1 || 0) + 
                  (row.decimo_terceiro_parcela2 || 0);
                
                const isExpanded = expandedEmployeeId === row.user_profile;

                return (
                  <div key={row.user_profile}>
                    {/* List Item Header */}
                    <button
                      onClick={() => setExpandedEmployeeId(isExpanded ? null : row.user_profile)}
                      className={`w-full transition-all duration-200 ${
                        isExpanded
                          ? "bg-primary/10 border-primary/50 border-2"
                          : hasExistingPayment
                            ? "border-emerald-500/30 border bg-gradient-to-r from-emerald-500/5 to-transparent hover:from-emerald-500/10"
                            : "border border-muted-foreground/20 hover:border-primary/30 hover:bg-primary/5"
                      } rounded-lg p-4 flex items-center justify-between`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-1 text-left">
                          <h3 className="font-semibold text-foreground">{row.employee_name}</h3>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {hasExistingPayment ? (
                              <span className="text-emerald-600 font-medium">
                                R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span>Pendente</span>
                            )}
                          </p>
                        </div>
                        {hasExistingPayment && (
                          <div className="px-3 py-1 bg-emerald-500/20 text-emerald-600 text-xs font-bold rounded-full flex-shrink-0">
                            PAGO
                          </div>
                        )}
                      </div>
                      <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-300 flex-shrink-0 ml-4 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="mt-2 p-6 bg-card border border-primary/20 rounded-lg space-y-4">
                        {hasExistingPayment ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {row.base_salary_holerite && row.base_salary_holerite > 0 && (
                                <div className="flex justify-between p-2 bg-muted/50 rounded">
                                  <span className="text-muted-foreground">Salário</span>
                                  <span className="font-medium">R$ {row.base_salary_holerite.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {row.benefit && parseFloat(row.benefit) > 0 && (
                                <div className="flex justify-between p-2 bg-muted/50 rounded">
                                  <span className="text-muted-foreground">Benefício</span>
                                  <span className="font-medium">R$ {parseFloat(row.benefit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {row.horas_voo && parseFloat(row.horas_voo) > 0 && (
                                <div className="flex justify-between p-2 bg-muted/50 rounded">
                                  <span className="text-muted-foreground">Horas Voo</span>
                                  <span className="font-medium">R$ {parseFloat(row.horas_voo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {row.ferias && row.ferias > 0 && (
                                <div className="flex justify-between p-2 bg-muted/50 rounded">
                                  <span className="text-muted-foreground">Férias</span>
                                  <span className="font-medium">R$ {row.ferias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {row.decimo_terceiro_parcela1 && row.decimo_terceiro_parcela1 > 0 && (
                                <div className="flex justify-between p-2 bg-muted/50 rounded">
                                  <span className="text-muted-foreground">13º P1</span>
                                  <span className="font-medium">R$ {row.decimo_terceiro_parcela1.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {row.decimo_terceiro_parcela2 && row.decimo_terceiro_parcela2 > 0 && (
                                <div className="flex justify-between p-2 bg-muted/50 rounded">
                                  <span className="text-muted-foreground">13º P2</span>
                                  <span className="font-medium">R$ {row.decimo_terceiro_parcela2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {row.extra && parseFloat(row.extra) > 0 && (
                                <div className="flex justify-between p-2 bg-muted/50 rounded">
                                  <span className="text-muted-foreground">Extra</span>
                                  <span className="font-medium">R$ {parseFloat(row.extra).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                            </div>
                            {row.banco && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Banco:</span>
                                <span className="font-medium text-foreground">{row.banco}</span>
                              </div>
                            )}
                            {row.data_pagamento && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Pago em:</span>
                                <span className="font-medium text-foreground">
                                  {new Date(row.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 pt-2 border-t">
                              {row.holerite_url && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => openPreview(row.holerite_url!, "holerite")}
                                  className="flex-1"
                                >
                                  <FileText className="h-4 w-4 mr-2 text-blue-500" />
                                  Holerite
                                </Button>
                              )}
                              {row.comprovante_url && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => openPreview(row.comprovante_url!, "comprovante")}
                                  className="flex-1"
                                >
                                  <Receipt className="h-4 w-4 mr-2 text-orange-500" />
                                  Comprovante
                                </Button>
                              )}
                            </div>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              className="w-full mt-2" 
                              onClick={() => deletePaymentRow(index)} 
                              disabled={row.isLoading}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir Pagamento para Editar
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Salário Holerite</Label>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  min="0" 
                                  placeholder="0.00" 
                                  value={row.base_salary_holerite || ""} 
                                  onChange={e => updateRow(index, "base_salary_holerite", e.target.value ? parseFloat(e.target.value) : null)} 
                                  className="h-10"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Benefício (R$)</Label>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  placeholder="0.00" 
                                  value={row.benefit} 
                                  onChange={e => updateRow(index, "benefit", e.target.value)} 
                                  className="h-10"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Horas de Voo (R$)</Label>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  placeholder="0.00" 
                                  value={row.horas_voo} 
                                  onChange={e => updateRow(index, "horas_voo", e.target.value)} 
                                  className="h-10"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Extra (R$)</Label>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  placeholder="0.00" 
                                  value={row.extra} 
                                  onChange={e => updateRow(index, "extra", e.target.value)} 
                                  className="h-10"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] font-medium">13º P1</Label>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  min="0" 
                                  placeholder="0.00" 
                                  value={row.decimo_terceiro_parcela1 || ""} 
                                  onChange={e => updateRow(index, "decimo_terceiro_parcela1", e.target.value ? parseFloat(e.target.value) : null)} 
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-medium">13º P2</Label>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  min="0" 
                                  placeholder="0.00" 
                                  value={row.decimo_terceiro_parcela2 || ""} 
                                  onChange={e => updateRow(index, "decimo_terceiro_parcela2", e.target.value ? parseFloat(e.target.value) : null)} 
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-medium">Férias</Label>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  min="0" 
                                  placeholder="0.00" 
                                  value={row.ferias || ""} 
                                  onChange={e => updateRow(index, "ferias", e.target.value ? parseFloat(e.target.value) : null)} 
                                  className="h-9 text-sm"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Banco</Label>
                                <Select value={row.banco} onValueChange={value => updateRow(index, "banco", value)}>
                                  <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent align="start">
                                    {bancos.map(banco => (
                                      <SelectItem key={banco} value={banco}>
                                        {banco}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Dia Pagamento</Label>
                                <div className="flex gap-1">
                                  <Input
                                    type="number"
                                    min="1"
                                    max="31"
                                    placeholder="Dia"
                                    value={row.data_pagamento ? parseInt(row.data_pagamento.split('-')[2]) : ""}
                                    onChange={e => {
                                      if (e.target.value) {
                                        const day = parseInt(e.target.value);
                                        if (day >= 1 && day <= 31) {
                                          const dataPagamento = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, "0")}`;
                                          updateRow(index, "data_pagamento", dataPagamento);
                                        }
                                      } else {
                                        updateRow(index, "data_pagamento", null);
                                      }
                                    }}
                                    className="h-10 flex-1"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 px-3"
                                    onClick={() => {
                                      const hoje = new Date();
                                      const dataPagamento = `${selectedYear}-${selectedMonth}-${String(hoje.getDate()).padStart(2, "0")}`;
                                      updateRow(index, "data_pagamento", dataPagamento);
                                    }}
                                  >
                                    Hoje
                                  </Button>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">Observações</Label>
                              <Input 
                                type="text" 
                                placeholder="Observações" 
                                value={row.obs} 
                                onChange={e => updateRow(index, "obs", e.target.value)} 
                                className="h-10"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                              <div>
                                <label className="cursor-pointer">
                                  <input 
                                    type="file" 
                                    accept="image/*,.pdf" 
                                    className="hidden" 
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileUpload(index, file, "holerite");
                                    }} 
                                  />
                                  <div className={`flex items-center justify-center gap-2 p-2.5 rounded border-2 border-dashed transition-colors ${
                                    row.holerite_url 
                                      ? "border-blue-500/50 bg-blue-500/10 text-blue-600" 
                                      : "border-muted-foreground/30 hover:border-blue-500/50"
                                  }`}>
                                    {row.holerite_url ? (
                                      <>
                                        <FileText className="h-4 w-4" />
                                        <span className="text-xs font-medium">Holerite ✓</span>
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Holerite</span>
                                      </>
                                    )}
                                  </div>
                                </label>
                                {row.holerite_url && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="w-full mt-1 h-7 text-xs" 
                                    onClick={() => openPreview(row.holerite_url!, "holerite")}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    Visualizar
                                  </Button>
                                )}
                              </div>
                              <div>
                                <label className="cursor-pointer">
                                  <input 
                                    type="file" 
                                    accept="image/*,.pdf" 
                                    className="hidden" 
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileUpload(index, file, "comprovante");
                                    }} 
                                  />
                                  <div className={`flex items-center justify-center gap-2 p-2.5 rounded border-2 border-dashed transition-colors ${
                                    row.comprovante_url 
                                      ? "border-orange-500/50 bg-orange-500/10 text-orange-600" 
                                      : "border-muted-foreground/30 hover:border-orange-500/50"
                                  }`}>
                                    {row.comprovante_url ? (
                                      <>
                                        <Receipt className="h-4 w-4" />
                                        <span className="text-xs font-medium">Comprovante ✓</span>
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Comprovante</span>
                                      </>
                                    )}
                                  </div>
                                </label>
                                {row.comprovante_url && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="w-full mt-1 h-7 text-xs" 
                                    onClick={() => openPreview(row.comprovante_url!, "comprovante")}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    Visualizar
                                  </Button>
                                )}
                              </div>
                            </div>

                            <Button 
                              onClick={() => saveRow(index)} 
                              disabled={row.isLoading || !row.isDirty}
                              className={`w-full h-11 mt-2 ${
                                row.isDirty 
                                  ? "bg-emerald-600 hover:bg-emerald-700" 
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {row.isLoading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4 mr-2" />
                              )}
                              {row.isDirty ? "Salvar e Registrar no Controle Bancário" : "Sem alterações"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {paymentRows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Calendar className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum funcionário encontrado</p>
                <p className="text-sm">Verifique se há funcionários ativos cadastrados.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={open => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewType === "holerite" ? (
                <FileText className="h-5 w-5 text-blue-500" />
              ) : (
                <Receipt className="h-5 w-5 text-orange-500" />
              )}
              {previewType === "holerite" ? "Holerite" : "Comprovante de Pagamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewUrl && (
              previewUrl.toLowerCase().endsWith(".pdf") ? (
                <iframe src={previewUrl} className="w-full h-[70vh] border rounded-lg" title="Preview" />
              ) : (
                <img src={previewUrl} alt="Preview" className="max-w-full h-auto mx-auto rounded-lg" />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
