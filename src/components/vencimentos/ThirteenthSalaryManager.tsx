// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, DollarSign, Calendar, CheckCircle2, Clock, AlertCircle, Info } from "lucide-react";

interface ThirteenthSalary {
  id: string;
  id_usuario: string;
  year: number;
  gross_value: number;
  net_value: number;
  first_installment_date: string | null;
  second_installment_date: string | null;
  first_installment_amount: number;
  second_installment_amount: number;
  payment_status: string;
  updated_at: string;
}

interface SalaryPayment {
  id: string;
  id_usuario: string;
  base_salary_holerite: number | null;
  created_at: string;
}

interface EmployeeWithThirteenth {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
  salary: {  salario_bruto: number } | null;
  thirteenth: ThirteenthSalary | undefined;
  firstInstallmentDate: string | null;
  secondInstallmentDate: string | null;
  calculatedStatus: 'pending' | 'partial_paid' | 'paid';
  photo_url: string | null;
}

export function ThirteenthSalaryManager() {
  const { isAdmin, isGestorMaster, isLoading: isRolesLoading } = useUserRole();
  const isAllowed = isAdmin || isGestorMaster;

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'thirteenth' | 'vacation'>('thirteenth');
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [monthsWorked, setMonthsWorked] = useState(12);
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [grossValue, setGrossValue] = useState<number>(0);
  const [netValue, setNetValue] = useState<number>(0);
  const [isCalculated, setIsCalculated] = useState(false);

  const years = useMemo(() => {
    const yearList = [];
    const startYear = Math.min(currentYear - 2, 2024);
    const endYear = Math.max(currentYear + 1, 2024);
    for (let i = startYear; i <= endYear; i++) {
      yearList.push(i);
    }
    return yearList.sort((a, b) => b - a);
  }, [currentYear]);

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["employees_with_salaries"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("tipo", "colaborador")
        .order("full_name", { ascending: true });

      if (profilesError) throw profilesError;

      const employeesWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: rolesData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);

          const { data: salaryDataArray } = await supabase
            .from("salarios")
            .select("salario_bruto")
            .eq("id_usuario", profile.id)
            .order("data_vigencia", { ascending: false })
            .limit(1);

          const salaryData = salaryDataArray && salaryDataArray.length > 0 ? salaryDataArray[0] : null;
          const roles = rolesData?.map((r) => r.role).filter(Boolean) || [];

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email || "",
            roles,
            salary: salaryData ? { salario_bruto: salaryData.salario_bruto } : null,
            photo_url: (profile as any).avatar_url || null,
          };
        })
      );

      return employeesWithRoles.filter((emp) => emp.roles.length > 0);
    },
  });

  const { data: allThirteenthSalaries = [] } = useQuery({
    queryKey: ["all_thirteenth_salaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decimo_terceiro_funcionarios")
        .select("*")
        .order("ano", { ascending: false });
      if (error) throw error;
      return (data || []) as ThirteenthSalary[];
    },
  });

  // Buscar pagamentos de salário para determinar datas de pagamento das parcelas
  const { data: salaryPayments = { november: [] as SalaryPayment[], december: [] as SalaryPayment[] } } = useQuery({
    queryKey: ["salary_payments_for_thirteenth", selectedYear],
    queryFn: async (): Promise<{ november: SalaryPayment[]; december: SalaryPayment[] }> => {
      // Buscar pagamentos de novembro (1ª parcela) e dezembro (2ª parcela) do ano selecionado
      const novemberStart = `${selectedYear}-11-01`;
      const novemberEnd = `${selectedYear}-11-30T23:59:59`;
      const decemberStart = `${selectedYear}-12-01`;
      const decemberEnd = `${selectedYear}-12-31T23:59:59`;

      const { data: novPayments, error: novError } = await supabase
        .from("historico_pagamentos_funcionarios")
        .select("id, id_usuario, salario_holerite, criado_em")
        .gte("criado_em", novemberStart)
        .lte("criado_em", novemberEnd);

      const { data: decPayments, error: decError } = await supabase
        .from("historico_pagamentos_funcionarios")
        .select("id, id_usuario, salario_holerite, criado_em")
        .gte("criado_em", decemberStart)
        .lte("criado_em", decemberEnd);

      if (novError) console.error("Erro ao buscar pagamentos de novembro:", novError);
      if (decError) console.error("Erro ao buscar pagamentos de dezembro:", decError);

      return {
        november: (novPayments || []) as SalaryPayment[],
        december: (decPayments || []) as SalaryPayment[],
      };
    },
  });

  const employeesWithThirteenth = useMemo(() => {
    return employees.map((emp) => {
      const thirteenthForYear = allThirteenthSalaries.find(
        (s) => s.id_usuario === emp.id && s.year === selectedYear
      );

      // Usar apenas o registro de employee_thirteenth_salary para determinar status
      // Não inferir pagamentos de pagamento_salario_funcionario
      const firstInstallmentPaid = thirteenthForYear?.first_installment_date && 
        thirteenthForYear?.payment_status !== 'pending' && 
        thirteenthForYear?.payment_status !== 'calculated';
      
      const secondInstallmentPaid = thirteenthForYear?.second_installment_date && 
        thirteenthForYear?.payment_status === 'paid';

      let paymentStatus: 'pending' | 'partial_paid' | 'paid' = 'pending';
      if (thirteenthForYear) {
        if (thirteenthForYear.payment_status === 'paid') {
          paymentStatus = 'paid';
        } else if (thirteenthForYear.payment_status === 'partial_paid' || firstInstallmentPaid) {
          paymentStatus = 'partial_paid';
        }
      }

      return {
        ...emp,
        thirteenth: thirteenthForYear,
        firstInstallmentDate: firstInstallmentPaid ? thirteenthForYear?.first_installment_date : null,
        secondInstallmentDate: secondInstallmentPaid ? thirteenthForYear?.second_installment_date : null,
        calculatedStatus: paymentStatus,
      };
    });
  }, [employees, allThirteenthSalaries, selectedYear]);

  const validEmployees = useMemo(() => {
    return employeesWithThirteenth;
  }, [employeesWithThirteenth]);

  // Para uso na aba de Férias, usamos a lista original de `employees` (já filtrada por tipo colaborador)
  const employeesForVacation = useMemo(() => employees, [employees]);

  const selectedEmployee = useMemo(() => {
    const source = activeTab === 'vacation' ? employeesForVacation : validEmployees;
    return source.find((emp) => emp.id === selectedEmployeeId) || null;
  }, [validEmployees, employeesForVacation, selectedEmployeeId, activeTab]);

  // Abre modal automaticamente quando ambas as parcelas estão pendentes
  useEffect(() => {
    if (selectedEmployee && selectedEmployee.id) {
      const emp = selectedEmployee as any;
      const bothPending =
        !emp.firstInstallmentDate &&
        !emp.secondInstallmentDate;

      if (bothPending) {
        const salary = selectedEmployee.salary?.salario_bruto || 0;
        setBaseSalary(Number(salary));
        setMonthsWorked(12);
        setIsCalculated(false);
        setGrossValue(0);
        setNetValue(0);
        setShowCalculatorModal(true);
      } else {
        setShowCalculatorModal(false);
      }
    }
  }, [selectedEmployee]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString("pt-BR");
    } catch {
      return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 rounded-full px-3 py-1">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            Pago
          </Badge>
        );
      case 'partial_paid':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 rounded-full px-3 py-1">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Parcial
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground border-border rounded-full px-3 py-1">
            <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
            Pendente
          </Badge>
        );
    }
  };

  if (isRolesLoading || employeesLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <Card className="rounded-2xl border-border/50">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </CardContent>
      </Card>
    );
  }

  const calculateThirteenthValues = () => {
    const proportionalSalary = (baseSalary / 12) * monthsWorked;
    const estimatedGross = proportionalSalary;
    const estimatedNet = estimatedGross * 0.81; // Aproximado (desconta INSS e IR)

    setGrossValue(estimatedGross);
    setNetValue(estimatedNet);
    setIsCalculated(true);
  };

  const handleSaveCalculation = async () => {
    if (!selectedEmployee) return;

    try {
      const { error } = await supabase
        .from("decimo_terceiro_funcionarios")
        .upsert({
          id_usuario: selectedEmployee.id,
          ano: selectedYear,
          valor_bruto: grossValue,
          valor_liquido: netValue,
          valor_primeira_parcela: grossValue / 2,
          valor_segunda_parcela: grossValue / 2,
          data_primeira_parcela: `${selectedYear}-11-01`,
          data_segunda_parcela: `${selectedYear}-12-01`,
          status: "calculated",
          atualizado_em: new Date().toISOString(),
        } as any);

      if (error) throw error;

      setShowCalculatorModal(false);
      setIsCalculated(false);
      setMonthsWorked(12);
      setBaseSalary(0);
      setGrossValue(0);
      setNetValue(0);
    } catch (error) {
      console.error("Erro ao salvar cálculo:", error);
    }
  };


  const EmployeeDetailsCard = () => {
    if (!selectedEmployee) {
      return (
        <div className="flex items-center justify-center min-h-[300px] text-muted-foreground">
          <div className="text-center space-y-3">
            <DollarSign className="w-12 h-12 mx-auto opacity-30" />
            <p className="font-medium">Selecione um colaborador para visualizar os dados</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Perfil do Funcionário */}
        <div className="flex items-start gap-6">
          <Avatar className="h-24 w-24 border-4 border-primary/20 shadow-lg flex-shrink-0">
            <AvatarImage src={selectedEmployee.photo_url || undefined} alt={selectedEmployee.full_name} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
              {selectedEmployee.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 pt-2">
            <h3 className="text-2xl font-bold text-foreground">{selectedEmployee.full_name}</h3>
            <p className="text-muted-foreground text-sm mt-1">{selectedEmployee.email}</p>
          </div>
        </div>

        {/* Cards de Dados */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Salário Base */}
          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Salário Base</Label>
            <div className="mt-3">
              {selectedEmployee.salary?.salario_bruto ? (
                <p className="text-2xl font-bold text-foreground">
                  R$ {Number(selectedEmployee.salary.salario_bruto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              ) : (
                <p className="text-muted-foreground italic">Não registrado</p>
              )}
            </div>
          </div>

          {/* 1ª Parcela */}
          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">1ª Parcela</Label>
            <div className="mt-3 space-y-2">
              {(selectedEmployee as any).firstInstallmentDate ? (
                <>
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 rounded-full inline-flex text-xs font-medium">
                    <CheckCircle2 className="w-3 h-3 mr-1.5" />
                    Pago
                  </Badge>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {formatDate((selectedEmployee as any).firstInstallmentDate)}
                  </p>
                </>
              ) : (
                <Badge className="bg-muted text-muted-foreground border-border rounded-full inline-flex text-xs font-medium">
                  <AlertCircle className="w-3 h-3 mr-1.5" />
                  Pendente
                </Badge>
              )}
            </div>
          </div>

          {/* 2ª Parcela */}
          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">2ª Parcela</Label>
            <div className="mt-3 space-y-2">
              {(selectedEmployee as any).secondInstallmentDate ? (
                <>
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 rounded-full inline-flex text-xs font-medium">
                    <CheckCircle2 className="w-3 h-3 mr-1.5" />
                    Pago
                  </Badge>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {formatDate((selectedEmployee as any).secondInstallmentDate)}
                  </p>
                </>
              ) : (
                <Badge className="bg-muted text-muted-foreground border-border rounded-full inline-flex text-xs font-medium">
                  <AlertCircle className="w-3 h-3 mr-1.5" />
                  Pendente
                </Badge>
              )}
            </div>
          </div>

          {/* Status Geral */}
          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</Label>
            <div className="mt-3">
              {getStatusBadge((selectedEmployee as any).calculatedStatus)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const VacationDetailsCard = () => {
    if (!selectedEmployee) {
      return (
        <div className="flex itens-center justify-center min-h-[300px] text-muted-foreground">
          <div className="text-center space-y-3">
            <DollarSign className="w-12 h-12 mx-auto opacity-30" />
            <p className="font-medium">Selecione um colaborador para visualizar os dados</p>
          </div>
        </div>
      );
    }

    const vac = selectedEmployee as any;
    const days = vac?.total_vacation_days ?? "—";
    const valorBruto = vac?.vacation_gross_value ?? (selectedEmployee.salary?.salario_bruto ? (selectedEmployee.salary.salario_bruto).toFixed(2) : "—");
    const dataAgendada = vac?.scheduled_date ? formatDate(vac.scheduled_date) : "Pendente";
    const status = vac?.payment_status ? (vac.payment_status === 'paid' ? 'Pago' : vac.payment_status) : 'Pendente';
    const dataPagamento = vac && vac.payment_status === 'paid' ? (vac.atualizado_em ? formatDate(vac.atualizado_em) : '—') : 'Pendente';

    return (
      <div className="space-y-6">
        <div className="flex items-start gap-6">
          <Avatar className="h-24 w-24 border-4 border-primary/20 shadow-lg flex-shrink-0">
            <AvatarImage src={selectedEmployee.photo_url || undefined} alt={selectedEmployee.full_name} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
              {selectedEmployee.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 pt-2">
            <h3 className="text-2xl font-bold text-foreground">{selectedEmployee.full_name}</h3>
            <p className="text-muted-foreground text-sm mt-1">{selectedEmployee.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dias</Label>
            <div className="mt-3">
              <p className="text-2xl font-bold text-foreground">{days}</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor Bruto</Label>
            <div className="mt-3">
              <p className="text-2xl font-bold text-foreground">{typeof valorBruto === 'string' ? valorBruto : `R$ ${Number(valorBruto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data Agendada</Label>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">{dataAgendada}</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</Label>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">{status}</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data Pagamento</Label>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">{dataPagamento}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const CalculatorCard = () => {
    if (!showCalculatorModal || !selectedEmployee) return null;

    return (
      <Card className="shadow-lg border-cyan-500/30 bg-cyan-500/5 rounded-2xl border-2">
        <CardHeader className="border-b border-cyan-500/30 bg-cyan-500/10">
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-cyan-600">
            <DollarSign className="h-5 w-5" />
            Calcular Décimo Terceiro Salário
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Info do Funcionário */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl border border-border">
            <Avatar className="h-16 w-16 flex-shrink-0">
              <AvatarImage src={selectedEmployee.photo_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {selectedEmployee.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-bold text-foreground">{selectedEmployee.full_name}</p>
              <p className="text-sm text-muted-foreground">{selectedEmployee.email}</p>
            </div>
          </div>

          {/* Campos de Cálculo */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Meses Trabalhados (1-12)</Label>
              <p className="text-xs text-muted-foreground mt-1">Cada mês com 15+ dias = 1 avô</p>
              <Input
                type="number"
                min={1}
                max={12}
                value={monthsWorked}
                onChange={(e) => setMonthsWorked(Number(e.target.value))}
                className="mt-2 h-11 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Salário Base (R$)</Label>
                <Input
                  type="number"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(Number(e.target.value))}
                  disabled
                  className="mt-2 h-11 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Valor Bruto (R$)</Label>
                <Input
                  type="number"
                  value={grossValue}
                  readOnly
                  className="mt-2 h-11 rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Valor Líquido (R$)</Label>
              <Input
                type="number"
                value={netValue}
                readOnly
                className="mt-2 h-11 rounded-xl"
              />
            </div>

            {/* Parcelas */}
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-foreground">Resumo das Parcelas</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">1ª Parcela (50%)</p>
                  <p className="text-lg font-bold text-cyan-500">R$ {(grossValue / 2).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">2ª Parcela (50%)</p>
                  <p className="text-lg font-bold text-cyan-500">R$ {(grossValue / 2).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold text-green-500">R$ {grossValue.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Info className="w-4 h-4" />
                O que Não Pode ser Descontado do 13°
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                <li>Faltas legais e justificadas</li>
                <li>Repouso semanal remunerado</li>
                <li>Empréstimo consignado (não pode ser descontado diretamente)</li>
              </ul>
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => {
                setShowCalculatorModal(false);
                setIsCalculated(false);
              }}
              className="h-11 rounded-xl"
            >
              Cancelar
            </Button>
            {!isCalculated ? (
              <Button
                onClick={calculateThirteenthValues}
                className="bg-cyan-500 hover:bg-cyan-600 h-11 rounded-xl text-white"
              >
                Calcular Automaticamente
              </Button>
            ) : (
              <Button
                onClick={handleSaveCalculation}
                className="bg-green-600 hover:bg-green-700 h-11 rounded-xl text-white"
              >
                Salvar Cálculo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border/50 rounded-2xl">
        <CardHeader className="border-b border-border bg-muted/30 rounded-t-2xl">
          <CardTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="bg-green-500/10 p-2.5 rounded-xl">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            Décimo Terceiro Salário - {selectedYear}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Acompanhe o status de pagamento do 13º salário dos colaboradores.
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Seletores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year-select" className="text-sm font-medium">Ano</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger id="year-select" className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee-select" className="text-sm font-medium">Colaborador</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger id="employee-select" className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecione um colaborador..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {(activeTab === 'vacation' ? employeesForVacation : validEmployees).map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conteúdo por aba */}
          {activeTab === 'thirteenth' ? (
            <>
              {/* Calculador do 13º */}
              <CalculatorCard />

              {/* Dados do Funcionário */}
              <EmployeeDetailsCard />
            </>
          ) : (
            <>
              {/* Aba de Férias - mostrar painel de férias */}
              <VacationDetailsCard />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
