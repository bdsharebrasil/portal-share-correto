import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { PayslipsManagement } from "@/components/payslips/PayslipsManagement";
import { formatBRL } from "@/lib/utils";
import { CalendarDays, FileText, Search, UserRound, WalletCards } from "lucide-react";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  salario: number | null;
  departamento: string | null;
  employment_status: string | null;
}

const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const money = (value: unknown) => formatBRL(Number(value) || 0);

export default function ContabilidadeDashboard() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["accounting-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, avatar_url, salario, departamento, employment_status")
        .eq("tipo", "colaborador")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data || []) as Employee[];
    },
  });

  const selectedEmployee = employees.find((employee) => employee.id === selectedId) || null;
  const filteredEmployees = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return employees;
    return employees.filter((employee) => `${employee.full_name} ${employee.email}`.toLowerCase().includes(normalized));
  }, [employees, search]);

  const { data: payments = [] } = useQuery({
    queryKey: ["accounting-payments", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("historico_pagamentos_funcionarios")
        .select("*")
        .eq("id_usuario", selectedId)
        .order("ano_referencia", { ascending: false })
        .order("mes_referencia", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: vacationRequests = [] } = useQuery({
    queryKey: ["accounting-vacations", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vacation_requests")
        .select("id, start_date, end_date, days, status, remarks, criado_em")
        .eq("user_id", selectedId)
        .order("start_date", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Acesso contábil</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">Painel de colaboradores</h1>
            <p className="mt-1 text-sm text-muted-foreground">Consulte histórico, férias e holerites por competência.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar colaborador" className="pl-9" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando colaboradores...</p> : filteredEmployees.map((employee) => (
            <button key={employee.id} type="button" onClick={() => setSelectedId(employee.id)} className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 ${selectedId === employee.id ? "border-primary bg-primary/5 shadow-lg" : "border-border bg-card"}`}>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border border-border">
                  <AvatarImage src={employee.avatar_url || undefined} alt={employee.full_name} />
                  <AvatarFallback>{initials(employee.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{employee.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{employee.departamento || "Colaborador"}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Salário base</span>
                <span className="font-medium text-foreground">{money(employee.salario)}</span>
              </div>
            </button>
          ))}
        </div>

        {!selectedEmployee ? (
          <Card className="border-dashed">
            <CardContent className="flex min-h-56 flex-col items-center justify-center text-center">
              <UserRound className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-semibold text-foreground">Selecione um colaborador</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">O perfil exibirá pagamentos, férias e a gestão mensal de holerites.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>{selectedEmployee.full_name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedEmployee.email}</p>
                </div>
                <Badge variant="outline">{selectedEmployee.employment_status || "ativo"}</Badge>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-border p-4"><WalletCards className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Salário base</p><p className="mt-1 font-semibold">{money(selectedEmployee.salario)}</p></div>
                <div className="rounded-xl border border-border p-4"><CalendarDays className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Pedidos de férias</p><p className="mt-1 font-semibold">{vacationRequests.length}</p></div>
                <div className="rounded-xl border border-border p-4"><FileText className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Pagamentos registrados</p><p className="mt-1 font-semibold">{payments.length}</p></div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <Card>
                <CardHeader><CardTitle className="text-base">Histórico financeiro e de férias</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagamentos</p>
                    {payments.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p> : <div className="space-y-2">{payments.slice(0, 12).map((payment: any) => <div key={payment.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"><span>{payment.mes_referencia || "—"}/{payment.ano_referencia || "—"}</span><span className="font-medium">{money(payment.valor_total ?? payment.salario_liquido ?? payment.valor_pago)}</span></div>)}</div>}
                  </div>
                  <Separator />
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Férias</p>
                    {vacationRequests.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma solicitação registrada.</p> : <div className="space-y-2">{vacationRequests.map((request: any) => <div key={request.id} className="rounded-lg border border-border px-3 py-2 text-sm"><div className="flex justify-between gap-3"><span>{request.start_date} a {request.end_date}</span><Badge variant="outline">{request.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{request.days} dias</p></div>)}</div>}
                  </div>
                </CardContent>
              </Card>
              <PayslipsManagement employeeId={selectedEmployee.id} employeeName={selectedEmployee.full_name} />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
