// @ts-nocheck
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Loader2, Users } from "lucide-react";

interface EmployeeSalary {
  id: string;
  id_usuario: string;
  salario_bruto: number | null;
  salario_liquido: number | null;
  beneficios: string | null;
  data_vigencia: string;
  updated_at: string;
}

interface Employee {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
}

export function EmployeeSalariesMonthly() {
  const { isAdmin, isFinanceiroMaster, isGestorMaster, isLoading: isRolesLoading } = useUserRole();
  const queryClient = useQueryClient();
  const isAllowed = isAdmin || isFinanceiroMaster || isGestorMaster;

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [searchFilter, setSearchFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
     salario_bruto: "",
    salario_liquido: "",
    beneficios: "",
  });
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const months = [
    { value: 1, label: "Janeiro" },
    { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Maio" },
    { value: 6, label: "Junho" },
    { value: 7, label: "Julho" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" },
    { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" },
    { value: 12, label: "Dezembro" },
  ];

  const years = useMemo(() => {
    const years = [];
    const startYear = Math.min(currentDate.getFullYear() - 2, 2024);
    const endYear = Math.max(currentDate.getFullYear() + 1, 2024);
    for (let i = startYear; i <= endYear; i++) {
      years.push(i);
    }
    return years.sort((a, b) => b - a);
  }, []);

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await (supabase as any)
        .from("user_profiles")
        .select("*")
        .eq("employment_status", "ativo")
        .order("full_name", { ascending: true });

      if (profilesError) throw profilesError;

      const employeesWithRoles = await Promise.all(
        (profiles || []).map(async (profile: any) => {
          const { data: rolesData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);

          const roles = rolesData?.map((r: any) => r.role).filter(Boolean) || [];

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email || "",
            roles,
          };
        })
      );

      return employeesWithRoles.filter((emp: any) =>
        emp.roles.some((role: string) =>
          ["financeiro", "financeiro_master", "tripulante", "piloto_chefe", "operacoes", "colaborador"].includes(role)
        )
      );
    },
  });

  const { data: allSalaries = [] } = useQuery({
    queryKey: ["all_salaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salarios")
        .select(
          "id, id_usuario, salario_bruto, salario_liquido, beneficios , data_vigencia "
        )
        .order("data_vigencia", { ascending: false });
      if (error) throw error;
      return data as EmployeeSalary[];
    },
  });

  const getMonthYearFromDate = (dateString: string): { month: number; year: number } => {
    const date = new Date(dateString);
    return {
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  };

  const employeesWithSalaries = useMemo(() => {
    const mapped = employees.map((emp) => {
      const currentMonthSalary = allSalaries.find((s) => {
        if (s.id_usuario !== emp.id) return false;
        const { month, year } = getMonthYearFromDate(s.data_vigencia);
        return month === selectedMonth && year === selectedYear;
      });

      let displaySalary = currentMonthSalary || null;

      if (!currentMonthSalary) {
        const mostRecentSalary = allSalaries.find((s) => {
          if (s.id_usuario !== emp.id) return false;
          const { month, year } = getMonthYearFromDate(s.data_vigencia);
          const salaryDate = new Date(year, month - 1);
          const selectedDate = new Date(selectedYear, selectedMonth - 1);
          return salaryDate <= selectedDate;
        });
        if (mostRecentSalary) {
          displaySalary = mostRecentSalary;
        }
      }

      return {
        ...emp,
        salary: displaySalary,
        is_new_month: !currentMonthSalary && displaySalary !== null,
        has_salary_this_month: !!currentMonthSalary,
      };
    });

    // Ordenar: primeiro quem tem salário registrado neste mês
    return mapped.sort((a, b) => {
      if (a.has_salary_this_month && !b.has_salary_this_month) return -1;
      if (!a.has_salary_this_month && b.has_salary_this_month) return 1;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [employees, allSalaries, selectedMonth, selectedYear]);

  const filteredEmployees = useMemo(() => {
    return employeesWithSalaries.filter((emp) => {
      const matchesSearch = emp.full_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchFilter.toLowerCase());
      const matchesRole = !roleFilter || emp.roles.includes(roleFilter as any);
      return matchesSearch && matchesRole;
    });
  }, [employeesWithSalaries, searchFilter, roleFilter]);

  const statistics = useMemo(() => {
    const salariesInMonth = filteredEmployees.filter(emp => emp.salary?. salario_bruto);
    const totalBruto = salariesInMonth.reduce((sum, emp) => sum + (emp.salary?.salario_bruto || 0), 0);
    const totalLiquido = salariesInMonth.reduce((sum, emp) => sum + (emp.salary?.salario_liquido || 0), 0);
    const averageBruto = salariesInMonth.length > 0 ? totalBruto / salariesInMonth.length : 0;

    return {
      totalCollaborators: filteredEmployees.length,
      collaboratorsWithSalary: salariesInMonth.length,
      totalBruto,
      totalLiquido,
      averageBruto,
    };
  }, [filteredEmployees]);

  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>();
    employees.forEach((emp) => {
      emp.roles.forEach((role) => {
        if (["financeiro", "financeiro_master", "tripulante", "piloto_chefe", "operacoes", "colaborador"].includes(role)) {
          roles.add(role);
        }
      });
    });
    return Array.from(roles).sort();
  }, [employees]);

  const formatRole = (role: string): string => {
    const roleNames: Record<string, string> = {
      financeiro_master: "Financeiro Master",
      financeiro: "Financeiro",
      piloto_chefe: "Piloto Chefe",
      tripulante: "Tripulante",
      coordenador_de_voo: "Coordenador de Voo",
      operacoes: "Operações",
      colaborador: "Colaborador",
      rh: "RH",
      adm: "ADM",
    };
    return roleNames[role] || role;
  };

  const saveSalaryMutation = useMutation({
    mutationFn: async (data: any) => {
      const effectiveDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;

      const salaryData = {
        id_usuario: data.employee_id,
        salario_bruto: editFormData. salario_bruto ? parseFloat(editFormData. salario_bruto) : null,
        salario_liquido: editFormData. salario_liquido ? parseFloat(editFormData. salario_liquido) : null,
        beneficios: editFormData.beneficios || null,
        data_vigencia: effectiveDate,
        atualizado_em: new Date().toISOString(),
      };

      if (data.salary_id) {
        const { error } = await supabase
          .from("salarios")
          .update(salaryData)
          .eq("id", data.salary_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("salarios").insert(salaryData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all_salaries"] });
      toast.success("Salário salvo com sucesso!");
      setEditingId(null);
      setIsDialogOpen(false);
      setSelectedEmployee(null);
      setEditFormData({ salario_bruto: "", salario_liquido: "", beneficios: "" });
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar salário: ${error.message}`);
    },
  });

  const handleEditClick = (employee: any) => {
    if (!isAllowed) return;
    setSelectedEmployee(employee);
    setEditFormData({
       salario_bruto: employee.salary?.salario_bruto?.toString() || "",
      salario_liquido: employee.salary?.salario_liquido?.toString() || "",
      beneficios: employee.salary?.beneficios || "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    saveSalaryMutation.mutate({
      employee_id: selectedEmployee.id,
      salary_id: selectedEmployee.salary?.id || null,
    });
  };

  if (isRolesLoading || employeesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <Card className="border-border/50 rounded-2xl shadow-lg">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </CardContent>
      </Card>
    );
  }

  const monthLabel = months.find((m) => m.value === selectedMonth)?.label || "";

  return (
    <div className="min-h-screen space-y-6 bg-background/50 p-6">
      <div className="rounded-[32px] border border-white/10 bg-background/95 p-6 shadow-card">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Salários</h1>
        <p className="mt-2 text-sm text-muted-foreground">Gestão mensal de colaboradores</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(Number(value))}>
          <SelectTrigger className="h-11 w-[140px] rounded-2xl border border-white/10 bg-card/90 text-white shadow-sm shadow-black/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(Number(value))}>
          <SelectTrigger className="h-11 w-[120px] rounded-2xl border border-white/10 bg-card/90 text-white shadow-sm shadow-black/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Buscar colaborador..."
          value={searchFilter}
          onChange={(event) => setSearchFilter(event.target.value)}
          className="h-11 w-[260px] rounded-2xl border border-white/10 bg-card/90 text-white shadow-sm shadow-black/20"
        />

        <Select value={roleFilter || "all"} onValueChange={(value) => setRoleFilter(value === "all" ? "" : value)}>
          <SelectTrigger className="h-11 w-[200px] rounded-2xl border border-white/10 bg-card/90 text-white shadow-sm shadow-black/20">
            <SelectValue placeholder="Função" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {uniqueRoles.map((role) => (
              <SelectItem key={role} value={role}>{formatRole(role)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Colaboradores", value: statistics.totalCollaborators },
          { label: "Com salário", value: statistics.collaboratorsWithSalary },
          { label: "Total bruto", value: `R$ ${statistics.totalBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
          { label: "Média", value: `R$ ${statistics.averageBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
        ].map((item) => (
          <div key={item.label} className="rounded-[28px] border border-white/10 bg-card/85 p-5 shadow-card">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-background/95 shadow-card">
        {filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <Users className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-white">Nenhum colaborador encontrado</p>
            <p className="text-sm text-muted-foreground">Tente ajustar seus filtros de busca.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 bg-card/80">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Função</th>
                  <th className="px-4 py-3 font-medium">Bruto</th>
                  <th className="px-4 py-3 font-medium">Líquido</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="border-b border-white/10 transition-colors hover:bg-card/70 last:border-0">
                    <td className="px-4 py-3 font-medium text-white">
                      {employee.full_name}
                      <div className="text-xs font-normal text-muted-foreground">{employee.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{employee.roles.map(formatRole).join(", ")}</td>
                    <td className="px-4 py-3 text-white">
                      {employee.salary?.salario_bruto
                        ? `R$ ${Number(employee.salary.salario_bruto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {employee.salary?.salario_liquido
                        ? `R$ ${Number(employee.salary.salario_liquido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" className="text-muted-foreground hover:text-white" onClick={() => handleEditClick(employee)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Editar Salário</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">{selectedEmployee?.full_name}</p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-xl p-3 text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{monthLabel}</span> de {selectedYear}
              </p>
            </div>
            <div>
              <Label htmlFor="dialog-bruto" className="text-muted-foreground font-medium">Salário Bruto (R$)</Label>
              <Input
                id="dialog-bruto"
                type="number"
                step="0.01"
                value={editFormData.salario_bruto}
                onChange={(e) => setEditFormData({ ...editFormData, salario_bruto: e.target.value })}
                placeholder="0.00"
                className="mt-2 h-11 rounded-xl"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="dialog-liquid" className="text-muted-foreground font-medium">Salário Líquido (R$)</Label>
              <Input
                id="dialog-liquid"
                type="number"
                step="0.01"
                value={editFormData.salario_liquido}
                onChange={(e) => setEditFormData({ ...editFormData, salario_liquido: e.target.value })}
                placeholder="0.00"
                className="mt-2 h-11 rounded-2xl border border-white/10 bg-card/90 text-white"
              />
            </div>
            <div>
              <Label htmlFor="dialog-benefit" className="text-muted-foreground font-medium">Benefícios</Label>
              <Textarea
                id="dialog-benefit"
                value={editFormData.beneficios}
                onChange={(e) => setEditFormData({ ...editFormData, beneficios: e.target.value })}
                placeholder="Ex: Vale alimentação, Plano de saúde..."
                className="mt-2 rounded-2xl border border-white/10 bg-card/90 text-white min-h-24"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setSelectedEmployee(null);
              }}
              className="h-10 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveSalaryMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 rounded-xl"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveSalaryMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
