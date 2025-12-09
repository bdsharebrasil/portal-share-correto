import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Save, Upload, Eye, FileText, Receipt, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoriasConta } from "@/hooks/useCategoriasFinanceiro";
import { toast } from "sonner";
import { format } from "date-fns";

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
  holerite_url: string | null;
  comprovante_url: string | null;
  isDirty?: boolean;
  isLoading?: boolean;
}

const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export function PagamentoSalarioTab() {
  const { isAdmin, isGestorMaster, isFinanceiroMaster } = useUserRole();
  const { user } = useAuth();
  const { contas } = useCategoriasConta();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [paymentRows, setPaymentRows] = useState<SalaryPaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [showPeriodSelector, setShowPeriodSelector] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"holerite" | "comprovante">("holerite");

  // Get bancos from contas_bancarias and from existing payments
  const bancosFromContas = Array.from(new Set(contas.map(c => c.banco).filter(Boolean))) as string[];
  const bancosFromPayments = paymentRows
    .map(row => row.banco)
    .filter(Boolean) as string[];
  const bancos = Array.from(new Set([...bancosFromContas, ...bancosFromPayments])) as string[];

  const years = ["2025", "2026", "2027"];

  const isAuthorized = isAdmin || isGestorMaster || isFinanceiroMaster;

  // Load employees
  useEffect(() => {
    if (isAuthorized) {
      loadEmployees();
    }
  }, [isAuthorized]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .eq("employment_status", "ativo")
        .eq("tipo", "colaborador")
        .order("full_name", { ascending: true });

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

      const { data: existingPayments, error } = await supabase
        .from("pagamento_salario_funcionario")
        .select("*")
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`);

      if (error) {
        toast.error(`Erro ao carregar pagamentos: ${error.message}`);
        return;
      }

      // Create rows for all employees, filling in existing data
      const rows: SalaryPaymentRow[] = employees.map((employee) => {
        const existingPayment = existingPayments?.find(
          (p) => p.user_profile === employee.id
        );

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
          holerite_url: existingPayment?.holerite_url || null,
          comprovante_url: existingPayment?.comprovante_url || null,
          isDirty: false,
          isLoading: false,
        };
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
    setPaymentRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value, isDirty: true };
      return updated;
    });
  };

  const createCashFlowEntry = async (
    employeeId: string,
    employeeName: string,
    salaryAmount: number | null,
    paymentId: string,
    comprovanteUrl: string | null
  ) => {
    if (!user || !salaryAmount || salaryAmount <= 0) {
      return;
    }

    try {
      const paymentDate = format(new Date(), "yyyy-MM-dd");

      const { error } = await supabase
        .from("controle_bancario")
        .insert({
          data: paymentDate,
          tipo_movimento: "saída",
          categoria: "Salário",
          descricao: `Pagamento de salário - ${employeeName}`,
          valor: salaryAmount,
          referencia: `SAL-${paymentId.slice(0, 8)}`,
          status: "pago",
          criado_por: user.id,
          comprovante_url: comprovanteUrl,
          observacoes: `Pagamento de salário registrado para ${employeeName}`
        } as any);

      if (error) {
        console.error("Erro ao criar movimentação no fluxo de caixa:", error);
        toast.error("Erro ao criar entrada no fluxo de caixa");
      } else {
        toast.success("Movimentação criada no fluxo de caixa!");
      }
    } catch (error: any) {
      console.error("Erro ao criar entrada no fluxo de caixa:", error);
    }
  };

  const updateThirteenthSalary = async (
    employeeId: string,
    employeeName: string,
    parcela1: number | null,
    parcela2: number | null,
    year: string
  ) => {
    if (!user) return;

    const yearNum = parseInt(year);

    try {
      // Check if record exists for this employee and year
      const { data: existing, error: fetchError } = await supabase
        .from("employee_thirteenth_salary")
        .select("*")
        .eq("user_profile", employeeId)
        .eq("year", yearNum)
        .maybeSingle();

      if (fetchError) {
        console.error("Erro ao buscar 13º salário:", fetchError);
        return;
      }

      let newStatus = "pending";
      const hasParcela1 = (parcela1 && parcela1 > 0) || (existing?.first_installment_amount && existing.first_installment_amount > 0);
      const hasParcela2 = (parcela2 && parcela2 > 0) || (existing?.second_installment_amount && existing.second_installment_amount > 0);

      if (hasParcela1 && hasParcela2) {
        newStatus = "paid";
      } else if (hasParcela1) {
        newStatus = "first_paid";
      } else if (hasParcela2) {
        newStatus = "second_paid";
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
        payment_status: newStatus,
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
        const { error: updateError } = await supabase
          .from("employee_thirteenth_salary")
          .update(updateData)
          .eq("id", existing.id);

        if (updateError) {
          console.error("Erro ao atualizar 13º salário:", updateError);
          toast.error("Erro ao atualizar registro de 13º salário");
        } else {
          toast.success(`13º salário de ${employeeName} atualizado!`);
        }
      } else {
        // Create new record
        const { error: insertError } = await supabase
          .from("employee_thirteenth_salary")
          .insert({
            user_profile: employeeId,
            year: yearNum,
            first_installment_amount: parcela1 || 0,
            first_installment_date: parcela1 && parcela1 > 0 ? format(new Date(), "yyyy-MM-dd") : null,
            second_installment_amount: parcela2 || 0,
            second_installment_date: parcela2 && parcela2 > 0 ? format(new Date(), "yyyy-MM-dd") : null,
            payment_status: newStatus,
            gross_value: (parcela1 || 0) + (parcela2 || 0),
            net_value: (parcela1 || 0) + (parcela2 || 0),
          });

        if (insertError) {
          console.error("Erro ao criar registro de 13º salário:", insertError);
          toast.error("Erro ao criar registro de 13º salário");
        } else {
          toast.success(`13º salário de ${employeeName} registrado!`);
        }
      }

      // Create cash flow entry for 13th salary
      if (parcela1 && parcela1 > 0) {
        await createCashFlowEntryFor13th(employeeName, parcela1, "1ª Parcela");
      }
      if (parcela2 && parcela2 > 0) {
        await createCashFlowEntryFor13th(employeeName, parcela2, "2ª Parcela");
      }
    } catch (error: any) {
      console.error("Erro ao processar 13º salário:", error);
    }
  };

  const createCashFlowEntryFor13th = async (
    employeeName: string,
    amount: number,
    parcela: string
  ) => {
    if (!user || !amount || amount <= 0) return;

    try {
      const paymentDate = format(new Date(), "yyyy-MM-dd");

      const { error } = await supabase
        .from("controle_bancario")
        .insert({
          data: paymentDate,
          tipo_movimento: "saída",
          categoria: "13º Salário",
          descricao: `13º Salário ${parcela} - ${employeeName}`,
          valor: amount,
          referencia: `13S-${Date.now().toString(36)}`,
          status: "confirmado",
          criado_por: user.id,
          observacoes: `Pagamento de 13º salário (${parcela}) para ${employeeName}`
        } as any);

      if (error) {
        console.error("Erro ao criar fluxo de caixa para 13º:", error);
      }
    } catch (error: any) {
      console.error("Erro ao criar entrada de 13º no fluxo de caixa:", error);
    }
  };

  const createCashFlowEntryForVacation = async (
    employeeName: string,
    amount: number
  ) => {
    if (!user || !amount || amount <= 0) return;

    try {
      const paymentDate = format(new Date(), "yyyy-MM-dd");

      const { error } = await supabase
        .from("controle_bancario")
        .insert({
          data: paymentDate,
          tipo_movimento: "saída",
          categoria: "Férias",
          descricao: `Pagamento de Férias - ${employeeName}`,
          valor: amount,
          referencia: `FER-${Date.now().toString(36)}`,
          status: "confirmado",
          criado_por: user.id,
          observacoes: `Pagamento de férias para ${employeeName}`
        } as any);

      if (error) {
        console.error("Erro ao criar fluxo de caixa para férias:", error);
      }
    } catch (error: any) {
      console.error("Erro ao criar entrada de férias no fluxo de caixa:", error);
    }
  };

  const handleFileUpload = async (
    index: number,
    file: File,
    type: "holerite" | "comprovante"
  ) => {
    const row = paymentRows[index];
    const bucket = type === "holerite" ? "holerites" : "comprovantes";
    const filePath = `${row.user_profile}/${selectedYear}/${selectedMonth}_${Date.now()}_${file.name}`;

    setPaymentRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isLoading: true };
      return updated;
    });

    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        toast.error(`Erro ao fazer upload: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      const urlField = type === "holerite" ? "holerite_url" : "comprovante_url";

      setPaymentRows((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          [urlField]: publicUrlData.publicUrl,
          isDirty: true,
          isLoading: false,
        };
        return updated;
      });

      toast.success(`${type === "holerite" ? "Holerite" : "Comprovante"} enviado com sucesso!`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer upload");
      setPaymentRows((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], isLoading: false };
        return updated;
      });
    }
  };

  const saveRow = async (index: number) => {
    const row = paymentRows[index];
    const previousRow = paymentRows[index];

    setPaymentRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isLoading: true };
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
        holerite_url: row.holerite_url,
        comprovante_url: row.comprovante_url,
        updated_at: new Date().toISOString(),
      };

      let isNewPayment = !row.id;

      if (row.id) {
        const { error } = await supabase
          .from("pagamento_salario_funcionario")
          .update(paymentData)
          .eq("id", row.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("pagamento_salario_funcionario")
          .insert({
            ...paymentData,
            created_at: `${selectedYear}-${selectedMonth}-15T12:00:00Z`,
          })
          .select()
          .single();

        if (error) throw error;

        setPaymentRows((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], id: data.id };
          return updated;
        });

        // Create cash flow entry for new salary payment
        if (data && row.base_salary_holerite && row.base_salary_holerite > 0) {
          await createCashFlowEntry(
            row.user_profile,
            row.employee_name,
            row.base_salary_holerite,
            data.id,
            row.comprovante_url
          );
        }
      }

      // Handle 13th salary updates
      if (row.decimo_terceiro_parcela1 || row.decimo_terceiro_parcela2) {
        await updateThirteenthSalary(
          row.user_profile,
          row.employee_name,
          row.decimo_terceiro_parcela1,
          row.decimo_terceiro_parcela2,
          selectedYear
        );
      }

      // Handle vacation payment
      if (row.ferias && row.ferias > 0 && isNewPayment) {
        await createCashFlowEntryForVacation(row.employee_name, row.ferias);
      }

      setPaymentRows((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], isDirty: false, isLoading: false };
        return updated;
      });

      toast.success(`Pagamento de ${row.employee_name} salvo com sucesso!`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar");
      setPaymentRows((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], isLoading: false };
        return updated;
      });
    }
  };

  const saveAllDirty = async () => {
    const dirtyIndexes = paymentRows
      .map((row, index) => (row.isDirty ? index : -1))
      .filter((i) => i !== -1);

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
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive font-semibold">Acesso negado</p>
          <p className="text-sm text-muted-foreground mt-2">
            Você não tem permissão para acessar este módulo.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pagamento de Salários</h2>
          <p className="text-muted-foreground mt-1">
            Gerenciar pagamentos de salários dos funcionários
          </p>
        </div>
        {!showPeriodSelector && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPeriodSelector(true)}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Alterar Período
            </Button>
            <Button onClick={saveAllDirty} className="bg-green-600 hover:bg-green-700">
              <Save className="h-4 w-4 mr-2" />
              Salvar Todos
            </Button>
          </div>
        )}
      </div>

      {/* Period Selector */}
      {showPeriodSelector ? (
        <Card className="border-primary/20 flex-shrink-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Selecione o Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label>Mês</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-2">
                <Label>Ano</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {years.map((year) => (
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
                className="bg-primary hover:bg-primary/90"
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
          <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="font-medium">
                Período: {MONTHS.find((m) => m.value === selectedMonth)?.label} / {selectedYear}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {paymentRows.length} funcionários
            </span>
          </div>

          {/* Spreadsheet-like Table */}
          <Card className="border-0 shadow-lg flex-1 flex flex-col overflow-hidden">
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <div className="min-w-[1800px]">
                  {/* Table Header */}
                  <div className="grid grid-cols-[160px_100px_90px_90px_90px_90px_90px_90px_120px_100px_90px_90px_60px] gap-2 p-4 bg-muted/50 border-b font-medium text-xs sticky top-0 z-10">
                    <div>Funcionário</div>
                    <div>Salário (R$)</div>
                    <div>Benefício</div>
                    <div>Horas Voo</div>
                    <div>13º P1</div>
                    <div>13º P2</div>
                    <div>Férias</div>
                    <div>Extra</div>
                    <div>Observações</div>
                    <div>Banco</div>
                    <div className="text-center">Holerite</div>
                    <div className="text-center">Comprov.</div>
                    <div className="text-center">Salvar</div>
                  </div>

                  {/* Table Body */}
                  {paymentRows.map((row, index) => (
                    <div
                      key={row.user_profile}
                      className={`grid grid-cols-[160px_100px_90px_90px_90px_90px_90px_90px_120px_100px_90px_90px_60px] gap-2 p-3 border-b items-center hover:bg-muted/30 transition-colors ${row.isDirty ? "bg-yellow-500/10" : ""
                        }`}
                    >
                      {/* Employee Name */}
                      <div className="font-medium text-xs truncate" title={row.employee_name}>
                        {row.employee_name}
                      </div>

                      {/* Salary */}
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={row.base_salary_holerite || ""}
                        onChange={(e) =>
                          updateRow(
                            index,
                            "base_salary_holerite",
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="h-8 text-xs"
                      />

                      {/* Benefit */}
                      <Input
                        type="text"
                        placeholder="Benef."
                        value={row.benefit}
                        onChange={(e) => updateRow(index, "benefit", e.target.value)}
                        className="h-8 text-xs"
                      />

                      {/* Flight Hours */}
                      <Input
                        type="text"
                        placeholder="Horas"
                        value={row.horas_voo}
                        onChange={(e) => updateRow(index, "horas_voo", e.target.value)}
                        className="h-8 text-xs"
                      />

                      {/* 13th Salary - Installment 1 */}
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="1ª Parc."
                        value={row.decimo_terceiro_parcela1 || ""}
                        onChange={(e) =>
                          updateRow(
                            index,
                            "decimo_terceiro_parcela1",
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="h-8 text-xs"
                        title="1ª Parcela do 13º Salário"
                      />

                      {/* 13th Salary - Installment 2 */}
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="2ª Parc."
                        value={row.decimo_terceiro_parcela2 || ""}
                        onChange={(e) =>
                          updateRow(
                            index,
                            "decimo_terceiro_parcela2",
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="h-8 text-xs"
                        title="2ª Parcela do 13º Salário"
                      />

                      {/* Vacation */}
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Férias"
                        value={row.ferias || ""}
                        onChange={(e) =>
                          updateRow(
                            index,
                            "ferias",
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="h-8 text-xs"
                        title="Pagamento de Férias"
                      />

                      {/* Extra */}
                      <Input
                        type="text"
                        placeholder="Extra"
                        value={row.extra}
                        onChange={(e) => updateRow(index, "extra", e.target.value)}
                        className="h-8 text-xs"
                      />

                      {/* Observations */}
                      <Input
                        type="text"
                        placeholder="Obs"
                        value={row.obs}
                        onChange={(e) => updateRow(index, "obs", e.target.value)}
                        className="h-8 text-xs"
                      />

                      {/* Banco */}
                      <Select value={row.banco} onValueChange={(value) => updateRow(index, "banco", value)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Banco" />
                        </SelectTrigger>
                        <SelectContent align="start" className="text-xs">
                          {bancos.map((banco) => (
                            <SelectItem key={banco} value={banco}>
                              {banco}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Holerite Upload */}
                      <div className="flex items-center justify-center gap-1">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(index, file, "holerite");
                            }}
                          />
                          <div className="p-1.5 rounded hover:bg-muted transition-colors" title="Upload Holerite">
                            <Upload className="h-4 w-4 text-blue-500" />
                          </div>
                        </label>
                        {row.holerite_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openPreview(row.holerite_url!, "holerite")}
                            title="Visualizar Holerite"
                          >
                            <Eye className="h-4 w-4 text-green-500" />
                          </Button>
                        )}
                      </div>

                      {/* Comprovante Upload */}
                      <div className="flex items-center justify-center gap-1">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(index, file, "comprovante");
                            }}
                          />
                          <div className="p-1.5 rounded hover:bg-muted transition-colors" title="Upload Comprovante">
                            <Upload className="h-4 w-4 text-orange-500" />
                          </div>
                        </label>
                        {row.comprovante_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openPreview(row.comprovante_url!, "comprovante")}
                            title="Visualizar Comprovante"
                          >
                            <Eye className="h-4 w-4 text-green-500" />
                          </Button>
                        )}
                      </div>

                      {/* Save Button */}
                      <div className="flex justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => saveRow(index)}
                          disabled={row.isLoading || !row.isDirty}
                          title="Salvar"
                        >
                          {row.isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save
                              className={`h-4 w-4 ${row.isDirty ? "text-green-500" : "text-muted-foreground"
                                }`}
                            />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}

                  {paymentRows.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      Nenhum funcionário encontrado. Verifique se há funcionários ativos cadastrados.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewType === "holerite" ? (
                <FileText className="h-5 w-5" />
              ) : (
                <Receipt className="h-5 w-5" />
              )}
              {previewType === "holerite" ? "Holerite" : "Comprovante de Pagamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewUrl && (
              previewUrl.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[70vh] border rounded-lg"
                  title="Preview"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full h-auto mx-auto rounded-lg"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
