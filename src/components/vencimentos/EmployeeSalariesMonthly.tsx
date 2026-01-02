import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil, Save, X, Loader2, DollarSign, Users, Calendar } from "lucide-react";

interface EmployeeSalary {
  id: string;
  user_profile: string;
  base_salary_bruto: number | null;
  base_salary_liquid: number | null;
  benefit: string | null;
  effective_date: string;
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
    base_salary_bruto: "",
    base_salary_liquid: "",
    benefit: "",
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
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("*")
        .order("full_name", { ascending: true });

      if (profilesError) throw profilesError;

      const employeesWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: rolesData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);

          const roles = rolesData?.map((r) => r.role).filter(Boolean) || [];

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email || "",
            roles,
          };
        })
      );

      return employeesWithRoles.filter((emp) =>
        emp.roles.some((role) =>
          ["financeiro", "financeiro_master", "tripulante", "piloto_chefe", "operacoes", "colaborador"].includes(role)
        )
      );
    },
  });

  const { data: allSalaries = [] } = useQuery({
    queryKey: ["all_salaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salaries")
        .select("*")
        .order("effective_date", { ascending: false });
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
    return employees.map((emp) => {
      const currentMonthSalary = allSalaries.find((s) => {
        if (s.user_profile !== emp.id) return false;
        const { month, year } = getMonthYearFromDate(s.effective_date);
        return month === selectedMonth && year === selectedYear;
      });

      let displaySalary = currentMonthSalary || null;

      if (!currentMonthSalary) {
        const mostRecentSalary = allSalaries.find((s) => {
          if (s.user_profile !== emp.id) return false;
          const { month, year } = getMonthYearFromDate(s.effective_date);
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
      };
    });
  }, [employees, allSalaries, selectedMonth, selectedYear]);

  const filteredEmployees = useMemo(() => {
    return employeesWithSalaries.filter((emp) => {
      const matchesSearch = emp.full_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchFilter.toLowerCase());
      const matchesRole = !roleFilter || emp.roles.includes(roleFilter);
      return matchesSearch && matchesRole;
    });
  }, [employeesWithSalaries, searchFilter, roleFilter]);

  const statistics = useMemo(() => {
    const salariesInMonth = filteredEmployees.filter(emp => emp.salary?.base_salary_bruto);
    const totalBruto = salariesInMonth.reduce((sum, emp) => sum + (emp.salary?.base_salary_bruto || 0), 0);
    const totalLiquido = salariesInMonth.reduce((sum, emp) => sum + (emp.salary?.base_salary_liquid || 0), 0);
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

  const getRoleColor = (role: string): string => {
    const roleColors: Record<string, string> = {
      financeiro_master: "bg-gradient-to-r from-blue-500 to-indigo-600 text-white",
      financeiro: "bg-gradient-to-r from-blue-500 to-cyan-600 text-white",
      rh: "bg-gradient-to-r from-blue-500 to-cyan-600 text-white",
      adm: "bg-gradient-to-r from-blue-500 to-cyan-600 text-white",
      piloto_chefe: "bg-gradient-to-r from-blue-500 to-red-600 text-white",
      tripulante: "bg-gradient-to-r from-blue-500 to-emerald-600 text-white",
      operacoes: "bg-gradient-to-r from-blue-500 to-orange-600 text-white",
      coordenador_de_voor: "bg-gradient-to-r from-blue-500 to-gray-600 text-white",
    };
    return roleColors[role] || "bg-gradient-to-r from-gray-400 to-gray-600 text-white";
  };

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
        user_profile: data.employee_id,
        base_salary_bruto: editFormData.base_salary_bruto ? parseFloat(editFormData.base_salary_bruto) : null,
        base_salary_liquid: editFormData.base_salary_liquid ? parseFloat(editFormData.base_salary_liquid) : null,
        benefit: editFormData.benefit || null,
        effective_date: effectiveDate,
        updated_at: new Date().toISOString(),
      };

      if (data.salary_id) {
        const { error } = await supabase
          .from("salaries")
          .update(salaryData)
          .eq("id", data.salary_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("salaries").insert(salaryData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all_salaries"] });
      toast.success("Salário salvo com sucesso!");
      setEditingId(null);
      setIsDialogOpen(false);
      setSelectedEmployee(null);
      setEditFormData({ base_salary_bruto: "", base_salary_liquid: "", benefit: "" });
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar salário: ${error.message}`);
    },
  });

  const handleEditClick = (employee: any) => {
    if (!isAllowed) return;
    setSelectedEmployee(employee);
    setEditFormData({
      base_salary_bruto: employee.salary?.base_salary_bruto?.toString() || "",
      base_salary_liquid: employee.salary?.base_salary_liquid?.toString() || "",
      benefit: employee.salary?.benefit || "",
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
    <div className="space-y-6">
      <Card className="border-border/50 rounded-2xl shadow-lg bg-gradient-to-br from-card to-card/50 overflow-hidden">
        <CardHeader className="pb-6 border-b border-border/50 bg-muted/30">
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" />
              Salários Vigentes por Mês
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Somente Admin, Gestor Master e Financeiro Master podem editar. Selecione um mês para visualizar e editar salários.
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="month-select" className="text-muted-foreground font-medium">Mês</Label>
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger id="month-select" className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year-select" className="text-muted-foreground font-medium">Ano</Label>
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
              <Label htmlFor="search-input" className="text-muted-foreground font-medium">Buscar</Label>
              <Input
                id="search-input"
                placeholder="Nome ou email..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-filter" className="text-muted-foreground font-medium">Função</Label>
              <Select value={roleFilter || "all"} onValueChange={(v) => setRoleFilter(v === "all" ? "" : v)}>
                <SelectTrigger id="role-filter" className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Todas as funções</SelectItem>
                  {uniqueRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {formatRole(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total de Colaboradores</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{statistics.totalCollaborators}</p>
                </div>
                <Users className="h-8 w-8 text-primary/50" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-xl p-4 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Com Salário Registrado</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{statistics.collaboratorsWithSalary}</p>
                </div>
                <Calendar className="h-8 w-8 text-emerald-500/50" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl p-4 border border-blue-500/20">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Bruto</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">R$ {statistics.totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl p-4 border border-amber-500/20">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Média de Salário</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">R$ {statistics.averageBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-muted/30 rounded-full p-4 mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">Nenhum colaborador encontrado</p>
              <p className="text-sm text-muted-foreground">Tente ajustar seus filtros de busca</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Colaborador</TableHead>
                    <TableHead className="font-semibold text-foreground">Função</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">Salário Bruto</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">Salário Líquido</TableHead>
                    <TableHead className="font-semibold text-foreground">Benefícios</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee, index) => (
                    <TableRow 
                      key={employee.id} 
                      className={`transition-colors hover:bg-muted/50 ${
                        index % 2 === 0 ? "bg-transparent" : "bg-muted/20"
                      } ${employee.is_new_month ? "border-l-4 border-l-blue-500" : ""}`}
                    >
                      <TableCell className="font-semibold text-foreground py-4">{employee.full_name}</TableCell>
                      <TableCell className="py-4">
                        <div className="flex gap-2 flex-wrap">
                          {employee.roles.map((role) => (
                            <span
                              key={role}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getRoleColor(role)}`}
                            >
                              {formatRole(role)}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        {employee.salary?.base_salary_bruto ? (
                          <span className="text-emerald-600 font-semibold">
                            R$ {Number(employee.salary.base_salary_bruto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-4">
                        {employee.salary?.base_salary_liquid ? (
                          <span className="font-semibold">
                            R$ {Number(employee.salary.base_salary_liquid).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {employee.salary?.benefit || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(employee)}
                          className="h-9 w-9 p-0 hover:bg-primary/10 text-primary"
                          title="Editar salário"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
                value={editFormData.base_salary_bruto}
                onChange={(e) => setEditFormData({ ...editFormData, base_salary_bruto: e.target.value })}
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
                value={editFormData.base_salary_liquid}
                onChange={(e) => setEditFormData({ ...editFormData, base_salary_liquid: e.target.value })}
                placeholder="0.00"
                className="mt-2 h-11 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="dialog-benefit" className="text-muted-foreground font-medium">Benefícios</Label>
              <Textarea
                id="dialog-benefit"
                value={editFormData.benefit}
                onChange={(e) => setEditFormData({ ...editFormData, benefit: e.target.value })}
                placeholder="Ex: Vale alimentação, Plano de saúde..."
                className="mt-2 rounded-xl min-h-24"
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
