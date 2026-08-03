import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { calculateThirteenthSalary, calculateInstallments } from "@/lib/thirteenth-salary-calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import {
  Loader2,
  DollarSign,
  Palmtree,
  Save,
  Mail,
} from "lucide-react";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  salary: {
    base_salary_bruto: number;
  } | null;
  photo_url?: string | null;
  roles: string[];
}

interface ThirteenthSalary {
  id: string;
  user_profile: string;
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

interface VacationConfig {
  id: string;
  user_profile: string;
  year: number;
  working_months: number;
  total_vacation_days: number;
  vacation_third_value: number;
  vacation_gross_value: number;
  vacation_net_value: number;
  scheduled_date: string | null;
  payment_status: string;
  updated_at: string;
}

export function EmployeeSalaryCalculator() {
  const { isAdmin, isGestorMaster, isLoading: isRolesLoading } = useUserRole();
  const queryClient = useQueryClient();
  const isAllowed = isAdmin || isGestorMaster;

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("thirteenth");

  // Décimo terceiro form
  const [thirteenthForm, setThirteenthForm] = useState({
    worked_months: "12",
    gross_value: "",
    net_value: "",
    first_installment_date: "",
    second_installment_date: "",
    payment_status: "pending",
  });

  // Férias form
  const [vacationForm, setVacationForm] = useState({
    working_months: "12",
    total_vacation_days: "30",
    scheduled_date: "",
    payment_status: "pending",
  });

  const years = useMemo(() => {
    const yearList = [];
    const startYear = Math.min(currentYear - 2, 2024);
    const endYear = Math.max(currentYear + 1, 2024);
    for (let i = startYear; i <= endYear; i++) {
      yearList.push(i);
    }
    return yearList.sort((a, b) => b - a);
  }, [currentYear]);

  // Função para calcular 13º salário conforme legislação brasileira
  const calculateThirteenth = (baseSalary: number, workedMonths: number): { gross: number; net: number; inss: number; ir: number } => {
    try {
      const calculation = calculateThirteenthSalary(baseSalary, workedMonths);
      return {
        gross: calculation.grossValue,
        net: calculation.netValue,
        inss: calculation.inssDiscount,
        ir: calculation.irDiscount,
      };
    } catch (error) {
      console.error("Erro ao calcular 13º salário:", error);
      return { gross: 0, net: 0, inss: 0, ir: 0 };
    }
  };

  // Fetch funcionários (apenas colaboradores)
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["employees_for_salary_calculator"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("*")
        .order("full_name", { ascending: true });

      if (profilesError) throw profilesError;

      // Filtrar apenas colaboradores no lado do cliente
      const colaboradores = (profiles || []).filter((p) => (p as any).tipo === "colaborador");

      const employeesWithSalaries = await Promise.all(
        colaboradores.map(async (profile) => {
          const { data: salaryData } = await supabase
            .from("salarios")
            .select("*")
            .eq("id_usuario", profile.id)
            .order("data_vigencia", { ascending: false })
            .limit(1);

          const baseSalary = salaryData && salaryData.length > 0
            ? salaryData[0].salario_bruto ?? salaryData[0].salario_liquido
            : null;

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email || "",
            salary: baseSalary ? { base_salary_bruto: baseSalary } : null,
            photo_url: (profile as any).avatar_url,
            roles: [],
          };
        })
      );

      return employeesWithSalaries;
    },
    enabled: isAllowed,
  });

  // Fetch dados de décimo terceiro
  const { data: allThirteenthSalaries = [] } = useQuery({
    queryKey: ["all_thirteenth_salaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decimo_terceiro_funcionarios")
        .select("*")
        .order("ano", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ThirteenthSalary[];
    },
    enabled: isAllowed,
  });

  // Fetch dados de férias
  const { data: allVacationConfigs = [] } = useQuery({
    queryKey: ["all_vacation_configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_vacation_config")
        .select("*")
        .order("year", { ascending: false });
      if (error) throw error;
      return (data || []) as VacationConfig[];
    },
    enabled: isAllowed,
  });

  // Gerar opções para o combobox
  const comboboxOptions: ComboboxOption[] = useMemo(() => {
    return employees.map((emp) => ({
      value: emp.id,
      label: `${emp.full_name} ${emp.email ? `(${emp.email})` : ""}`,
    }));
  }, [employees]);

  const selectedEmployee = useMemo(() => {
    return employees.find((emp) => emp.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  const selectedEmployeeThirteenth = useMemo(() => {
    if (!selectedEmployee) return null;
    return allThirteenthSalaries.find(
      (s) => s.user_profile === selectedEmployee.id && s.year === selectedYear
    );
  }, [selectedEmployee, allThirteenthSalaries, selectedYear]);

  const selectedEmployeeVacation = useMemo(() => {
    if (!selectedEmployee) return null;
    return allVacationConfigs.find(
      (v) => v.user_profile === selectedEmployee.id && v.year === selectedYear
    );
  }, [selectedEmployee, allVacationConfigs, selectedYear]);

  // Quando seleciona um funcionário, preencher os formulários
  const handleSelectEmployee = () => {
    if (!selectedEmployee) return;

    // Preencher formulário de décimo terceiro
    let workedMonths = 12;
    if (selectedEmployeeThirteenth?.gross_value && selectedEmployee.salary?.base_salary_bruto) {
      // Calcular meses trabalhados a partir do valor bruto: gross_value = (base_salary / 12) * months
      const monthlyAvo = selectedEmployee.salary.base_salary_bruto / 12;
      workedMonths = Math.round(selectedEmployeeThirteenth.gross_value / monthlyAvo);
      workedMonths = Math.max(1, Math.min(12, workedMonths)); // Garantir que está entre 1-12
    }

    setThirteenthForm({
      worked_months: workedMonths.toString(),
      gross_value: selectedEmployeeThirteenth?.gross_value?.toString() || "",
      net_value: selectedEmployeeThirteenth?.net_value?.toString() || "",
      first_installment_date: selectedEmployeeThirteenth?.first_installment_date || "",
      second_installment_date: selectedEmployeeThirteenth?.second_installment_date || "",
      payment_status: selectedEmployeeThirteenth?.payment_status || "pending",
    });

    // Preencher formulário de férias
    setVacationForm({
      working_months: selectedEmployeeVacation?.working_months?.toString() || "12",
      total_vacation_days: selectedEmployeeVacation?.total_vacation_days?.toString() || "30",
      scheduled_date: selectedEmployeeVacation?.scheduled_date || "",
      payment_status: selectedEmployeeVacation?.payment_status || "pending",
    });
  };

  // Mutação para salvar décimo terceiro
  const saveThirteenthMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee) throw new Error("Nenhum funcionário selecionado");

      const thirteenthData = {
        id_usuario: selectedEmployee.id,
        ano: selectedYear,
        valor_bruto: thirteenthForm.gross_value ? parseFloat(thirteenthForm.gross_value) : 0,
        valor_liquido: thirteenthForm.net_value ? parseFloat(thirteenthForm.net_value) : 0,
        data_primeira_parcela: thirteenthForm.first_installment_date || null,
        data_segunda_parcela: thirteenthForm.second_installment_date || null,
        valor_primeira_parcela: thirteenthForm.gross_value ? parseFloat(thirteenthForm.gross_value) * 0.5 : 0,
        valor_segunda_parcela: thirteenthForm.gross_value ? parseFloat(thirteenthForm.gross_value) * 0.5 : 0,
        status: thirteenthForm.payment_status,
        atualizado_em: new Date().toISOString(),
      };

      if (selectedEmployeeThirteenth?.id) {
        const { error } = await supabase
          .from("decimo_terceiro_funcionarios")
          .update(thirteenthData)
          .eq("id", selectedEmployeeThirteenth.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("decimo_terceiro_funcionarios").insert(thirteenthData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all_thirteenth_salaries"] });
      toast.success("Décimo terceiro salvo com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar décimo terceiro: ${error.message}`);
    },
  });

  // Mutação para salvar férias
  const saveVacationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee) throw new Error("Nenhum funcionário selecionado");

      const workingMonths = parseInt(vacationForm.working_months);
      const baseSalary = selectedEmployee.salary?.base_salary_bruto || 0;

      const thirdValue = workingMonths === 12
        ? baseSalary / 3
        : (baseSalary / 12) * workingMonths / 3;

      const grossValue = workingMonths === 12
        ? baseSalary + baseSalary / 3
        : (baseSalary / 12) * workingMonths + ((baseSalary / 12) * workingMonths / 3);

      const vacationData = {
        user_profile: selectedEmployee.id,
        year: selectedYear,
        working_months: workingMonths,
        total_vacation_days: parseInt(vacationForm.total_vacation_days),
        vacation_third_value: thirdValue,
        vacation_gross_value: grossValue,
        vacation_net_value: grossValue,
        scheduled_date: vacationForm.scheduled_date || null,
        payment_status: vacationForm.payment_status,
        updated_at: new Date().toISOString(),
      };

      if (selectedEmployeeVacation?.id) {
        const { error } = await supabase
          .from("employee_vacation_config")
          .update(vacationData)
          .eq("id", selectedEmployeeVacation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employee_vacation_config").insert(vacationData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all_vacation_configs"] });
      toast.success("Férias salvas com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar férias: ${error.message}`);
    },
  });

  const handleCalculateThirteenth = () => {
    if (!selectedEmployee?.salary) return;
    const baseSalary = selectedEmployee.salary.base_salary_bruto;
    const workedMonths = parseInt(thirteenthForm.worked_months) || 12;

    const { gross, net } = calculateThirteenth(baseSalary, workedMonths);

    setThirteenthForm({
      ...thirteenthForm,
      gross_value: gross.toFixed(2),
      net_value: net.toFixed(2),
    });

    toast.success("13º salário calculado com sucesso!");
  };

  if (isRolesLoading || employeesLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="pt-6">
          <p className="text-center text-gray-400">
            Você não tem permissão para acessar esta página.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seleção de funcionário com Combobox */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-4 border-b border-gray-700">
          <CardTitle className="text-2xl font-bold text-white">Selecionar Funcionário</CardTitle>
          <p className="text-sm text-gray-400 mt-2">
            Escolha um colaborador para calcular décimo terceiro e férias.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="max-w-md">
            <Label htmlFor="employee-combobox" className="text-gray-300 block mb-2">
              Funcionário
            </Label>
            <Combobox
              options={comboboxOptions}
              value={selectedEmployeeId}
              onValueChange={(value) => {
                setSelectedEmployeeId(value);
                handleSelectEmployee();
              }}
              placeholder="Selecione um colaborador..."
              searchPlaceholder="Buscar por nome ou email..."
              emptyText="Nenhum colaborador encontrado."
              className="bg-gray-800 border-gray-700 text-gray-300"
            />
          </div>
        </CardContent>
      </Card>

      {/* Dados do funcionário selecionado */}
      {selectedEmployee && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-4 border-b border-gray-700">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-2 border-cyan-500/50">
                <AvatarImage src={selectedEmployee.photo_url || undefined} alt={selectedEmployee.full_name} />
                <AvatarFallback className="bg-gray-800 text-cyan-400 text-2xl font-bold">
                  {selectedEmployee.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl font-bold text-white">{selectedEmployee.full_name}</CardTitle>
                <div className="flex items-center gap-2 mt-2 text-gray-400">
                  <Mail className="h-4 w-4" />
                  <p className="text-sm">{selectedEmployee.email}</p>
                </div>
                {selectedEmployee.salary && (
                  <div className="flex items-center gap-2 mt-1 text-cyan-400">
                    <DollarSign className="h-4 w-4" />
                    <p className="text-sm font-semibold">
                      Salário Base: R$ {selectedEmployee.salary.base_salary_bruto.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          {/* Abas para Décimo Terceiro e Férias */}
          <CardContent className="pt-6">
            <div className="mb-4">
              <Label htmlFor="year-select" className="text-gray-300">
                Ano
              </Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger id="year-select" className="mt-2 bg-gray-800 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-800 border border-gray-700 rounded-lg p-1.5">
                <TabsTrigger
                  value="thirteenth"
                  className="data-[state=active]:bg-cyan-500 data-[state=active]:text-gray-900 text-gray-300"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Décimo Terceiro
                </TabsTrigger>
                <TabsTrigger
                  value="vacation"
                  className="data-[state=active]:bg-cyan-500 data-[state=active]:text-gray-900 text-gray-300"
                >
                  <Palmtree className="h-4 w-4 mr-2" />
                  Férias
                </TabsTrigger>
              </TabsList>

              {/* Tab Décimo Terceiro */}
              <TabsContent value="thirteenth" className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="worked-months-thirteenth" className="text-gray-300">
                      Meses Trabalhados (1-12)
                    </Label>
                    <Input
                      id="worked-months-thirteenth"
                      type="number"
                      min="1"
                      max="12"
                      value={thirteenthForm.worked_months}
                      onChange={(e) => {
                        const value = Math.max(1, Math.min(12, parseInt(e.target.value) || 1));
                        setThirteenthForm({ ...thirteenthForm, worked_months: value.toString() });
                      }}
                      className="mt-2 bg-gray-800 border-gray-700 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">Cada mês com 15+ dias = 1 avo</p>
                  </div>
                  <div className="flex flex-col justify-end">
                    <Button
                      onClick={handleCalculateThirteenth}
                      variant="outline"
                      className="bg-cyan-600 hover:bg-cyan-700 text-white border-0"
                    >
                      Calcular Automaticamente
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gross-thirteenth" className="text-gray-300">
                      Valor Bruto (R$)
                    </Label>
                    <Input
                      id="gross-thirteenth"
                      type="number"
                      step="0.01"
                      value={thirteenthForm.gross_value}
                      onChange={(e) =>
                        setThirteenthForm({ ...thirteenthForm, gross_value: e.target.value })
                      }
                      placeholder="0.00"
                      className="mt-2 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="net-thirteenth" className="text-gray-300">
                      Valor Líquido (R$)
                    </Label>
                    <Input
                      id="net-thirteenth"
                      type="number"
                      step="0.01"
                      value={thirteenthForm.net_value}
                      onChange={(e) =>
                        setThirteenthForm({ ...thirteenthForm, net_value: e.target.value })
                      }
                      placeholder="0.00"
                      className="mt-2 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first-install-date" className="text-gray-300">
                      1ª Parcela - Data
                    </Label>
                    <Input
                      id="first-install-date"
                      type="date"
                      value={thirteenthForm.first_installment_date}
                      onChange={(e) =>
                        setThirteenthForm({ ...thirteenthForm, first_installment_date: e.target.value })
                      }
                      className="mt-2 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="second-install-date" className="text-gray-300">
                      2ª Parcela - Data (até 20 dez)
                    </Label>
                    <Input
                      id="second-install-date"
                      type="date"
                      value={thirteenthForm.second_installment_date}
                      onChange={(e) =>
                        setThirteenthForm({ ...thirteenthForm, second_installment_date: e.target.value })
                      }
                      className="mt-2 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 bg-cyan-900/20 p-4 rounded-lg border border-cyan-700">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">1ª Parcela (50%)</p>
                    <p className="text-lg font-bold text-cyan-400">
                      R$ {(parseFloat(thirteenthForm.gross_value || "0") * 0.5).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">2ª Parcela (50%)</p>
                    <p className="text-lg font-bold text-cyan-400">
                      R$ {(parseFloat(thirteenthForm.gross_value || "0") * 0.5).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Total</p>
                    <p className="text-lg font-bold text-green-400">
                      R$ {parseFloat(thirteenthForm.gross_value || "0").toFixed(2)}
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="status-thirteenth" className="text-gray-300">
                    Status de Pagamento
                  </Label>
                  <Select
                    value={thirteenthForm.payment_status}
                    onValueChange={(value) =>
                      setThirteenthForm({ ...thirteenthForm, payment_status: value })
                    }
                  >
                    <SelectTrigger id="status-thirteenth" className="mt-2 bg-gray-800 border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="partial_paid">Parcialmente Pago</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-700 space-y-3">
                  <p className="text-sm font-semibold text-blue-300">O que Não Pode ser Descontado do 13º</p>
                  <ul className="text-sm text-blue-200 space-y-1 list-disc list-inside">
                    <li>Faltas legais e justificadas</li>
                    <li>Repouso semanal remunerado</li>
                    <li>Empréstimo consignado (não pode ser descontado diretamente do 13º)</li>
                  </ul>

                  <div className="pt-3 border-t border-blue-700">
                    <p className="text-sm font-semibold text-blue-300 mb-2">Em Caso de Demissão ou Troca de Emprego</p>
                    <ul className="text-sm text-blue-200 space-y-1 list-disc list-inside">
                      <li>O valor é calculado proporcionalmente ao período trabalhado</li>
                      <li>O pagamento é feito junto com a rescisão</li>
                      <li>A base de cálculo é o salário do mês da rescisão, ou a média de salários e adicionais recebidos no ano</li>
                    </ul>
                  </div>

                  {selectedEmployee?.salary && (
                    <div className="pt-3 border-t border-blue-700">
                      <p className="text-xs text-blue-300 font-semibold mb-1">Informações do Cálculo</p>
                      <p className="text-xs text-blue-200">
                        Salário Base: R$ {selectedEmployee.salary.base_salary_bruto.toFixed(2)}
                      </p>
                      <p className="text-xs text-blue-200">
                        Meses Trabalhados: {thirteenthForm.worked_months}/12
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => saveThirteenthMutation.mutate()}
                  disabled={saveThirteenthMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveThirteenthMutation.isPending ? "Salvando..." : "Salvar Décimo Terceiro"}
                </Button>
              </TabsContent>

              {/* Tab Férias */}
              <TabsContent value="vacation" className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="working-months" className="text-gray-300">
                      Meses Trabalhados (1-12)
                    </Label>
                    <Input
                      id="working-months"
                      type="number"
                      min="1"
                      max="12"
                      value={vacationForm.working_months}
                      onChange={(e) =>
                        setVacationForm({
                          ...vacationForm,
                          working_months: Math.min(12, Math.max(1, parseInt(e.target.value) || 1)).toString(),
                        })
                      }
                      className="mt-2 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vacation-days" className="text-gray-300">
                      Dias de Férias
                    </Label>
                    <Input
                      id="vacation-days"
                      type="number"
                      min="0"
                      max="30"
                      value={vacationForm.total_vacation_days}
                      onChange={(e) =>
                        setVacationForm({ ...vacationForm, total_vacation_days: e.target.value })
                      }
                      className="mt-2 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="scheduled-vacation-date" className="text-gray-300">
                    Data Agendada para Férias
                  </Label>
                  <Input
                    id="scheduled-vacation-date"
                    type="date"
                    value={vacationForm.scheduled_date}
                    onChange={(e) =>
                      setVacationForm({ ...vacationForm, scheduled_date: e.target.value })
                    }
                    className="mt-2 bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                {selectedEmployee?.salary && (
                  <>
                    <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-700">
                      <p className="text-sm font-semibold text-blue-400 mb-3">Cálculo de Férias</p>
                      {parseInt(vacationForm.working_months) === 12 ? (
                        <>
                          <p className="text-sm text-gray-300 mb-2">
                            <strong>Salário:</strong> R$ {selectedEmployee.salary.base_salary_bruto.toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-300 mb-2">
                            <strong>Terço:</strong> Salário ÷ 3 = R$ {(selectedEmployee.salary.base_salary_bruto / 3).toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-300">
                            <strong>Total Bruto:</strong> Salário + Terço = R$ {(selectedEmployee.salary.base_salary_bruto + selectedEmployee.salary.base_salary_bruto / 3).toFixed(2)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-gray-300 mb-2">
                            <strong>Salário Proporcional:</strong> (Salário ÷ 12) × {vacationForm.working_months} meses
                          </p>
                          <p className="text-sm text-gray-300 mb-2">
                            Valor: R$ {((selectedEmployee.salary.base_salary_bruto / 12) * parseInt(vacationForm.working_months)).toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-300 mb-2">
                            <strong>Terço Proporcional:</strong> Valor ÷ 3 = R$ {(((selectedEmployee.salary.base_salary_bruto / 12) * parseInt(vacationForm.working_months)) / 3).toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-300">
                            <strong>Total Bruto:</strong> R$ {(((selectedEmployee.salary.base_salary_bruto / 12) * parseInt(vacationForm.working_months)) + (((selectedEmployee.salary.base_salary_bruto / 12) * parseInt(vacationForm.working_months)) / 3)).toFixed(2)}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 bg-green-900/20 p-4 rounded-lg border border-green-700">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Terço</p>
                        <p className="text-lg font-bold text-green-400">
                          R$ {(parseInt(vacationForm.working_months) === 12
                            ? selectedEmployee.salary.base_salary_bruto / 3
                            : ((selectedEmployee.salary.base_salary_bruto / 12) * parseInt(vacationForm.working_months)) / 3
                          ).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Valor Bruto</p>
                        <p className="text-lg font-bold text-green-400">
                          R$ {(parseInt(vacationForm.working_months) === 12
                            ? selectedEmployee.salary.base_salary_bruto + selectedEmployee.salary.base_salary_bruto / 3
                            : ((selectedEmployee.salary.base_salary_bruto / 12) * parseInt(vacationForm.working_months)) + (((selectedEmployee.salary.base_salary_bruto / 12) * parseInt(vacationForm.working_months)) / 3)
                          ).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Valor Líquido</p>
                        <p className="text-lg font-bold text-green-400">
                          R$ {(parseInt(vacationForm.working_months) === 12
                            ? selectedEmployee.salary.base_salary_bruto + selectedEmployee.salary.base_salary_bruto / 3
                            : ((selectedEmployee.salary.base_salary_bruto / 12) * parseInt(vacationForm.working_months)) + (((selectedEmployee.salary.base_salary_bruto / 12) * parseInt(vacationForm.working_months)) / 3)
                          ).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="status-vacation" className="text-gray-300">
                    Status de Pagamento
                  </Label>
                  <Select
                    value={vacationForm.payment_status}
                    onValueChange={(value) =>
                      setVacationForm({ ...vacationForm, payment_status: value })
                    }
                  >
                    <SelectTrigger id="status-vacation" className="mt-2 bg-gray-800 border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => saveVacationMutation.mutate()}
                  disabled={saveVacationMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveVacationMutation.isPending ? "Salvando..." : "Salvar Férias"}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

    </div>
  );
}