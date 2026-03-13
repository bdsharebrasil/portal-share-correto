import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, Palmtree, Calendar, CheckCircle2, AlertCircle } from "lucide-react";

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

export function VacationConfigManager() {
  const { isAdmin, isGestorMaster, isLoading: isRolesLoading } = useUserRole();
  const isAllowed = isAdmin || isGestorMaster;

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

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

          const { data: salaryData } = await (supabase as any)
            .from("salaries")
            .select("base_salary_bruto")
            .eq("user_profile", profile.id)
            .order("effective_date", { ascending: false })
            .limit(1)
            .single();

          const roles = rolesData?.map((r: any) => r.role).filter(Boolean) || [];

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email || "",
            roles,
            salary: salaryData ? { base_salary_bruto: salaryData.base_salary_bruto } : null,
          };
        })
      );

      return employeesWithRoles.filter((emp) => emp.roles.length > 0);
     },
  });

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
  });

  // Buscar pagamentos de férias do controle bancário
  const { data: vacationPayments = [] } = useQuery({
    queryKey: ["vacation_payments", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_bancario")
        .select("*")
        .ilike("descricao", "%férias%")
        .gte("data", `${selectedYear}-01-01`)
        .lte("data", `${selectedYear}-12-31`);

      if (error) {
        console.error("Erro ao buscar pagamentos de férias:", error);
        return [];
      }

      return data || [];
    },
  });

  const employeesWithVacation = useMemo(() => {
    return employees.map((emp) => {
      const vacationForYear = allVacationConfigs.find(
        (v) => v.user_profile === emp.id && v.year === selectedYear
      );

      // Verificar se há pagamento de férias para este funcionário
      const vacationPayment = vacationPayments.find(p => 
        p.descricao?.toLowerCase().includes(emp.full_name.toLowerCase())
      );

      const isPaid = vacationForYear?.payment_status === 'paid' || !!vacationPayment;

      return {
        ...emp,
        vacation: vacationForYear,
        paymentDate: vacationPayment?.data || null,
        isPaid,
      };
    });
  }, [employees, allVacationConfigs, selectedYear, vacationPayments]);

  const filteredEmployees = useMemo(() => {
    return employeesWithVacation.filter((emp) => {
      const matchesSearch =
        emp.full_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchFilter.toLowerCase());
      return matchesSearch && emp.salary !== null;
    });
  }, [employeesWithVacation, searchFilter]);

  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return employeesWithVacation.find((e) => e.id === selectedEmployeeId) || null;
  }, [employeesWithVacation, selectedEmployeeId]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString("pt-BR");
    } catch {
      return null;
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "—";
    return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
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

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border/50 rounded-2xl">
        <CardHeader className="border-b border-border bg-muted/30 rounded-t-2xl">
          <CardTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="bg-blue-500/10 p-2.5 rounded-xl">
              <Palmtree className="h-5 w-5 text-blue-600" />
            </div>
            Configuração de Férias - {selectedYear}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Acompanhe o status das férias dos colaboradores.
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div className="col-span-2 space-y-2">
              <Label htmlFor="employee-select" className="text-sm font-medium">Colaborador</Label>
              <Select value={selectedEmployeeId} onValueChange={(v) => setSelectedEmployeeId(v)}>
                <SelectTrigger id="employee-select" className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecione um colaborador..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {employeesWithVacation.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conteúdo: tabela ou painel de detalhe do colaborador selecionado */}
          {selectedEmployee ? (
            <div className="border border-border rounded-2xl p-6">
              <div className="flex items-start gap-6">
                <Avatar className="h-24 w-24 border-4 border-primary/20 shadow-lg flex-shrink-0">
                  <AvatarImage src={(selectedEmployee as any).avatar_url || undefined} alt={selectedEmployee.full_name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                    {selectedEmployee.full_name.split(" ").map((n) => n[0]).join("").slice(0,2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground">{selectedEmployee.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedEmployee.email}</p>
                </div>
                <div>
                  <Button variant="outline" onClick={() => setSelectedEmployeeId("")}>Limpar</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
                <div className="bg-muted/50 rounded-xl p-4 border border-border">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dias</Label>
                  <div className="mt-3">
                    {selectedEmployee.vacation?.total_vacation_days ? (
                      <p className="text-2xl font-bold text-foreground">{selectedEmployee.vacation.total_vacation_days}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Pendente</p>
                    )}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-xl p-4 border border-border">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor Bruto</Label>
                  <div className="mt-3">
                    {selectedEmployee.vacation?.vacation_gross_value ? (
                      <p className="text-2xl font-bold text-foreground">{formatCurrency(selectedEmployee.vacation.vacation_gross_value)}</p>
                    ) : selectedEmployee.salary?.base_salary_bruto ? (
                      <p className="text-2xl font-bold text-foreground">{formatCurrency(selectedEmployee.salary.base_salary_bruto)}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Pendente</p>
                    )}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-xl p-4 border border-border">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data Agendada</Label>
                  <div className="mt-3">
                    <p className="text-sm text-muted-foreground">{selectedEmployee.vacation?.scheduled_date ? formatDate(selectedEmployee.vacation.scheduled_date) : 'Pendente'}</p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-xl p-4 border border-border">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</Label>
                  <div className="mt-3">
                    {selectedEmployee.isPaid ? (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 rounded-full px-3 py-1">Pago</Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground border-border rounded-full px-3 py-1">Pendente</Badge>
                    )}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-xl p-4 border border-border">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data Pagamento</Label>
                  <div className="mt-3">
                    <p className="text-sm text-muted-foreground">{selectedEmployee.paymentDate ? formatDate(selectedEmployee.paymentDate) : 'Pendente'}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Colaborador</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Dias</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Valor Bruto</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Data Agendada</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Data Pagamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-semibold text-foreground">{employee.full_name}</p>
                          <p className="text-xs text-muted-foreground">{employee.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-foreground">
                          {employee.vacation?.total_vacation_days || 30}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-foreground">
                          {formatCurrency(employee.vacation?.vacation_gross_value)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {employee.vacation?.scheduled_date ? (
                          <span className="text-sm text-foreground flex items-center justify-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            {formatDate(employee.vacation.scheduled_date)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {employee.isPaid ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 rounded-full px-3 py-1">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            Pago
                          </Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground border-border rounded-full px-3 py-1">
                            <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {employee.paymentDate ? (
                          <span className="text-sm text-green-600 font-medium flex items-center justify-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(employee.paymentDate)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
