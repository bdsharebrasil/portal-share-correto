import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { PayslipsManagement } from "@/components/payslips/PayslipsManagement";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  HeartPulse,
  Landmark,
  Loader2,
  Palmtree,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  salario: number | null;
  departamento: string | null;
  cargo: string | null;
  employment_status: string | null;
  admission_date: string | null;
  cpf: string | null;
  banco_nome: string | null;
  banco_agencia: string | null;
  banco_pix: string | null;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const money = (value: unknown) => formatBRL(Number(value) || 0);
const dateBR = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const years = (current: number) => Array.from({ length: 5 }, (_, index) => current - 2 + index);

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    approved: { label: "Aprovado", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    scheduled: { label: "Agendado", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
    rejected: { label: "Recusado", className: "bg-red-500/10 text-red-500 border-red-500/20" },
  };
  const item = map[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={item.className}>{item.label}</Badge>;
}

function KpiCard({ label, value, caption, icon: Icon, tone = "primary" }: {
  label: string;
  value: string | number;
  caption?: string;
  icon: any;
  tone?: "primary" | "success" | "warning" | "info";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-500",
    warning: "bg-amber-500/10 text-amber-500",
    info: "bg-sky-500/10 text-sky-500",
  };
  return (
    <Card className="overflow-hidden rounded-2xl border-border/70">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
            {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
          </div>
          <div className={`rounded-xl p-2.5 ${toneMap[tone]}`}><Icon className="h-5 w-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ContabilidadeDashboard() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState("resumo");
  const [pointMonth, setPointMonth] = useState(String(new Date().getMonth() + 1));
  const [pointYear, setPointYear] = useState(String(currentYear));
  const [thirteenthMonths, setThirteenthMonths] = useState(12);
  const [thirteenthBase, setThirteenthBase] = useState(0);
  const [thirteenthInss, setThirteenthInss] = useState(0);
  const [thirteenthIrrf, setThirteenthIrrf] = useState(0);
  const [savingThirteenth, setSavingThirteenth] = useState(false);

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["accounting-employees-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, avatar_url, salario, departamento, cargo, employment_status, admission_date, cpf, bank_name, bank_agency, bank_pix")
        .eq("tipo", "colaborador")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data || []).map((employee: any) => ({
        ...employee,
        banco_nome: employee.bank_name || null,
        banco_agencia: employee.bank_agency || null,
        banco_pix: employee.bank_pix || null,
      })) as Employee[];
    },
    staleTime: 60_000,
  });

  const { data: pendingVacations = [] } = useQuery({
    queryKey: ["accounting-vacation-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("id, user_id, start_date, end_date, days, status, remarks, criado_em")
        .in("status", ["pending", "approved", "scheduled"])
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["accounting-notifications"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, message, type, read, created_at")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
  });

  const selectedEmployee = employees.find((employee) => employee.id === selectedId) || null;

  const filteredEmployees = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return employees;
    return employees.filter((employee) => [employee.full_name, employee.email, employee.departamento, employee.cargo]
      .filter(Boolean).join(" ").toLowerCase().includes(normalized));
  }, [employees, search]);

  const selectedMonth = Number(pointMonth);
  const selectedYear = Number(pointYear);

  const { data: employeePayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["accounting-employee-payments", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_pagamentos_funcionarios")
        .select("*")
        .eq("id_usuario", selectedId!)
        .order("ano_referencia", { ascending: false })
        .order("mes_referencia", { ascending: false })
        .limit(72);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: vacations = [] } = useQuery({
    queryKey: ["accounting-employee-vacations", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("id, start_date, end_date, days, status, remarks, approver_id, criado_em")
        .eq("user_id", selectedId!)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: vacationBalance } = useQuery({
    queryKey: ["accounting-vacation-balance", selectedId, currentYear],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_balances")
        .select("year, days_earned, days_used, days_available")
        .eq("user_id", selectedId!)
        .eq("year", currentYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: vacationConfig } = useQuery({
    queryKey: ["accounting-vacation-config", selectedId, currentYear],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_vacation_config")
        .select("year, working_months, total_vacation_days, vacation_third_value, vacation_gross_value, vacation_net_value, scheduled_date, payment_status")
        .eq("user_profile", selectedId!)
        .eq("year", currentYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: pointEntries = [], isLoading: pointLoading } = useQuery({
    queryKey: ["accounting-point", selectedId, selectedMonth, selectedYear],
    enabled: !!selectedId,
    queryFn: async () => {
      const start = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0).getDate();
      const end = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(endDate).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("lancamento_ponto")
        .select("id, data_entrada, entrada_hora, inicio_almoco, fim_almoco, saida_hora, horas_totais, status, ausencia_aprovada, motivo_da_ausencia")
        .eq("user_id", selectedId!)
        .gte("data_entrada", start)
        .lte("data_entrada", end)
        .order("data_entrada", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: absences = [] } = useQuery({
    queryKey: ["accounting-absences", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("justificativa_ausencia")
        .select("id, data_registro, justificativa, url_documento, status, motivo_rejeicao, criado_em")
        .eq("id_usuario", selectedId!)
        .order("data_registro", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: thirteenth = null } = useQuery({
    queryKey: ["accounting-thirteenth", selectedId, currentYear],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decimo_terceiro_funcionarios")
        .select("*")
        .eq("id_usuario", selectedId!)
        .eq("ano", currentYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const usedVacationDays = vacations
    .filter((item: any) => ["approved", "scheduled"].includes(item.status) && new Date(`${item.end_date}T23:59:59`).getTime() < Date.now())
    .reduce((sum: number, item: any) => sum + Number(item.days || 0), 0);
  const futureVacationDays = vacations
    .filter((item: any) => ["approved", "scheduled"].includes(item.status) && new Date(`${item.start_date}T12:00:00`).getTime() >= Date.now())
    .reduce((sum: number, item: any) => sum + Number(item.days || 0), 0);
  const pendingCount = vacations.filter((item: any) => item.status === "pending").length;

  const grossThirteenth = (Number(thirteenthBase) / 12) * Math.min(12, Math.max(0, Number(thirteenthMonths) || 0));
  const netThirteenth = Math.max(0, grossThirteenth - Number(thirteenthInss || 0) - Number(thirteenthIrrf || 0));
  const firstInstallment = grossThirteenth / 2;
  const secondInstallment = Math.max(0, netThirteenth - firstInstallment);

  const openProfile = (employee: Employee) => {
    setSelectedId(employee.id);
    setProfileTab("resumo");
    setThirteenthBase(Number(employee.salario || 0));
  };

  const saveThirteenth = async () => {
    if (!selectedEmployee) return;
    setSavingThirteenth(true);
    try {
      const { error } = await supabase
        .from("decimo_terceiro_funcionarios")
        .upsert({
          id_usuario: selectedEmployee.id,
          ano: currentYear,
          valor_bruto: grossThirteenth,
          valor_liquido: netThirteenth,
          valor_primeira_parcela: firstInstallment,
          valor_segunda_parcela: secondInstallment,
          data_primeira_parcela: `${currentYear}-11-30`,
          data_segunda_parcela: `${currentYear}-12-20`,
          status_pagamento: "calculated",
          atualizado_em: new Date().toISOString(),
        }, { onConflict: "id_usuario,ano" });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["accounting-thirteenth", selectedEmployee.id, currentYear] });
      queryClient.invalidateQueries({ queryKey: ["all_thirteenth_salaries"] });
      toast.success("Cálculo de 13º salvo com sucesso.");
    } catch (error: any) {
      toast.error(error.message || "Não foi possível salvar o 13º.");
    } finally {
      setSavingThirteenth(false);
    }
  };

  const markNotificationRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["accounting-notifications"] });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-border/70 bg-gradient-to-br from-background via-card to-card-secondary p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.5)] md:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                <Landmark className="h-3.5 w-3.5" /> Contabilidade
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Central de colaboradores</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Perfil financeiro, férias, ponto, ausências, holerites e 13º em uma única ficha operacional.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {notifications.slice(0, 4).map((item: any) => (
                <button key={item.id} type="button" onClick={() => markNotificationRead(item.id)} className="flex max-w-sm items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-left text-xs hover:bg-amber-500/15">
                  <Bell className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="line-clamp-2">{item.title}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="relative z-10 mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Colaboradores" value={employees.length} caption="Cadastros ativos na contabilidade" icon={Users} tone="primary" />
            <KpiCard label="Férias aguardando gestor" value={pendingVacations.filter((item: any) => item.status === "pending").length} caption="Solicitações pendentes de aprovação" icon={Clock3} tone="warning" />
            <KpiCard label="Férias agendadas" value={pendingVacations.filter((item: any) => ["approved", "scheduled"].includes(item.status)).length} caption="Já autorizadas pelo gestor" icon={CalendarDays} tone="success" />
            <KpiCard label="Alertas contábeis" value={notifications.length} caption="Notificações ainda não lidas" icon={Bell} tone="info" />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Carteira</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Colaboradores</h2>
              <p className="mt-1 text-sm text-muted-foreground">Clique no avatar para abrir o prontuário contábil completo.</p>
            </div>
            <div className="relative w-full md:w-96">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, e-mail, departamento ou cargo" className="h-11 rounded-xl pl-9" />
            </div>
          </div>

          {employeesLoading ? (
            <div className="flex min-h-40 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando colaboradores...</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredEmployees.map((employee) => (
                <button key={employee.id} type="button" onClick={() => openProfile(employee)} className={`group rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg ${selectedId === employee.id ? "border-primary bg-primary/5" : "border-border/70 bg-card"}`}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14 border-2 border-primary/15">
                      <AvatarImage src={employee.avatar_url || undefined} alt={employee.full_name} />
                      <AvatarFallback className="bg-primary/10 font-bold text-primary">{initials(employee.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{employee.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{employee.cargo || employee.departamento || "Colaborador"}</p>
                    </div>
                    <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-muted/50 p-2"><span className="block text-muted-foreground">Salário</span><strong className="mt-1 block">{money(employee.salario)}</strong></div>
                    <div className="rounded-xl bg-muted/50 p-2"><span className="block text-muted-foreground">Status</span><strong className="mt-1 block capitalize">{employee.employment_status || "ativo"}</strong></div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-2xl border-border/70">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" /> Agenda de férias</CardTitle></CardHeader>
            <CardContent>
              {pendingVacations.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma solicitação de férias no momento.</p> : <div className="space-y-2">
                {pendingVacations.slice(0, 8).map((item: any) => {
                  const employee = employees.find((person) => person.id === item.user_id);
                  return <button key={item.id} type="button" onClick={() => employee && openProfile(employee)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 p-3 text-left hover:bg-muted/30">
                    <div className="flex min-w-0 items-center gap-3"><Avatar className="h-9 w-9"><AvatarImage src={employee?.avatar_url || undefined} /><AvatarFallback>{initials(employee?.full_name || "Colaborador")}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate text-sm font-semibold">{employee?.full_name || "Colaborador"}</p><p className="text-xs text-muted-foreground">{dateBR(item.start_date)} → {dateBR(item.end_date)} · {item.days} dias</p></div></div>
                    <StatusBadge status={item.status} />
                  </button>;
                })}
              </div>}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Fluxo contábil</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3"><span className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary"><UserRound className="h-3.5 w-3.5" /></span><span>Colaborador solicita férias → gestor master analisa histórico → aprovação cria a agenda oficial.</span></div>
              <div className="flex items-start gap-3"><span className="mt-0.5 rounded-full bg-emerald-500/10 p-1.5 text-emerald-500"><Bell className="h-3.5 w-3.5" /></span><span>A contabilidade recebe notificação automática para provisionar férias e acompanhar pagamento.</span></div>
              <div className="flex items-start gap-3"><span className="mt-0.5 rounded-full bg-sky-500/10 p-1.5 text-sky-500"><FileCheck2 className="h-3.5 w-3.5" /></span><span>Holerite processado alimenta o histórico salarial usado pelo Financeiro.</span></div>
              <div className="flex items-start gap-3"><span className="mt-0.5 rounded-full bg-amber-500/10 p-1.5 text-amber-500"><WalletCards className="h-3.5 w-3.5" /></span><span>13º, ponto, faltas e atestados ficam vinculados ao mesmo prontuário.</span></div>
            </CardContent>
          </Card>
        </section>

        <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedId(null)}>
          <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] max-w-[1280px] overflow-y-auto rounded-[28px] p-0">
            {selectedEmployee && (
              <div>
                <DialogHeader className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-5 py-4 backdrop-blur-xl md:px-7">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-14 w-14 border-2 border-primary/20"><AvatarImage src={selectedEmployee.avatar_url || undefined} /><AvatarFallback className="bg-primary/10 font-bold text-primary">{initials(selectedEmployee.full_name)}</AvatarFallback></Avatar>
                      <div className="min-w-0"><DialogTitle className="truncate text-xl md:text-2xl">{selectedEmployee.full_name}</DialogTitle><p className="mt-1 truncate text-xs text-muted-foreground">{selectedEmployee.email} · {selectedEmployee.departamento || "Sem departamento"} · {selectedEmployee.cargo || "Sem cargo"}</p></div>
                    </div>
                    <div className="flex flex-wrap gap-2"><Badge variant="outline">{selectedEmployee.employment_status || "ativo"}</Badge>{vacationConfig?.scheduled_date && <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500">Férias {dateBR(vacationConfig.scheduled_date)}</Badge>}</div>
                  </div>
                </DialogHeader>

                <div className="p-5 md:p-7">
                  <Tabs value={profileTab} onValueChange={setProfileTab} className="space-y-5">
                    <TabsList className="w-full justify-start overflow-x-auto rounded-2xl bg-muted/60 p-1">
                      <TabsTrigger value="resumo" className="rounded-xl">Resumo</TabsTrigger>
                      <TabsTrigger value="ferias" className="rounded-xl">Férias</TabsTrigger>
                      <TabsTrigger value="salarios" className="rounded-xl">Salários</TabsTrigger>
                      <TabsTrigger value="holerites" className="rounded-xl">Holerites</TabsTrigger>
                      <TabsTrigger value="ponto" className="rounded-xl">Ponto & atestados</TabsTrigger>
                      <TabsTrigger value="decimo" className="rounded-xl">13º salário</TabsTrigger>
                    </TabsList>

                    <TabsContent value="resumo" className="space-y-5">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <KpiCard label="Salário base" value={money(selectedEmployee.salario)} icon={Banknote} tone="primary" />
                        <KpiCard label="Férias retiradas" value={`${usedVacationDays} dias`} caption="Histórico até hoje" icon={Palmtree} tone="success" />
                        <KpiCard label="Férias futuras" value={`${futureVacationDays} dias`} caption="Períodos aprovados" icon={CalendarDays} tone="info" />
                        <KpiCard label="Pedidos em aberto" value={pendingCount} caption="Aguardando decisão" icon={Clock3} tone="warning" />
                      </div>

                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
                        <Card><CardHeader><CardTitle className="text-base">Dados cadastrais</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                          <div><span className="text-muted-foreground">CPF</span><p className="mt-1 font-medium">{selectedEmployee.cpf || "—"}</p></div>
                          <div><span className="text-muted-foreground">Admissão</span><p className="mt-1 font-medium">{dateBR(selectedEmployee.admission_date)}</p></div>
                          <div><span className="text-muted-foreground">Departamento</span><p className="mt-1 font-medium">{selectedEmployee.departamento || "—"}</p></div>
                          <div><span className="text-muted-foreground">Cargo</span><p className="mt-1 font-medium">{selectedEmployee.cargo || "—"}</p></div>
                        </CardContent></Card>
                        <Card><CardHeader><CardTitle className="text-base">Dados para pagamento</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                          <div><span className="text-muted-foreground">Banco</span><p className="mt-1 font-medium">{selectedEmployee.banco_nome || "—"}</p></div>
                          <div><span className="text-muted-foreground">Agência</span><p className="mt-1 font-medium">{selectedEmployee.banco_agencia || "—"}</p></div>
                          <div className="sm:col-span-2"><span className="text-muted-foreground">PIX</span><p className="mt-1 break-all font-medium">{selectedEmployee.banco_pix || "—"}</p></div>
                        </CardContent></Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="ferias" className="space-y-5">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Saldo cadastrado</p><p className="mt-1 text-2xl font-bold">{Number(vacationBalance?.days_available ?? 0)} dias</p></CardContent></Card>
                        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Já retiradas</p><p className="mt-1 text-2xl font-bold text-emerald-500">{usedVacationDays} dias</p></CardContent></Card>
                        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Agendadas</p><p className="mt-1 text-2xl font-bold text-sky-500">{futureVacationDays} dias</p></CardContent></Card>
                      </div>
                      {vacationConfig && <Card><CardHeader><CardTitle className="text-base">Provisão da competência</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm"><div><span className="text-muted-foreground">Dias</span><p className="mt-1 font-semibold">{vacationConfig.total_vacation_days}</p></div><div><span className="text-muted-foreground">1/3 constitucional</span><p className="mt-1 font-semibold">{money(vacationConfig.vacation_third_value)}</p></div><div><span className="text-muted-foreground">Bruto</span><p className="mt-1 font-semibold">{money(vacationConfig.vacation_gross_value)}</p></div><div><span className="text-muted-foreground">Líquido</span><p className="mt-1 font-semibold">{money(vacationConfig.vacation_net_value)}</p></div></CardContent></Card>}
                      <Card><CardHeader><CardTitle className="text-base">Histórico de solicitações</CardTitle></CardHeader><CardContent className="space-y-2">{vacations.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma solicitação registrada.</p> : vacations.map((item: any) => <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{dateBR(item.start_date)} → {dateBR(item.end_date)}</p><p className="text-xs text-muted-foreground">{item.days} dias · solicitado em {dateBR(item.criado_em)}</p>{item.remarks && <p className="mt-1 text-xs text-muted-foreground">{item.remarks}</p>}</div><StatusBadge status={item.status} /></div>)}</CardContent></Card>
                    </TabsContent>

                    <TabsContent value="salarios" className="space-y-5">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Salário no cadastro</p><p className="mt-1 text-2xl font-bold">{money(selectedEmployee.salario)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Competências carregadas</p><p className="mt-1 text-2xl font-bold">{employeePayments.length}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Último líquido informado</p><p className="mt-1 text-2xl font-bold">{money(employeePayments[0]?.salario_liquido)}</p></CardContent></Card></div>
                      <Card><CardHeader><CardTitle className="text-base">Histórico salarial usado pelo Financeiro</CardTitle></CardHeader><CardContent>{paymentsLoading ? <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : employeePayments.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="px-3 py-3">Competência</th><th className="px-3 py-3">Bruto</th><th className="px-3 py-3">Descontos</th><th className="px-3 py-3">Líquido</th><th className="px-3 py-3">Férias</th><th className="px-3 py-3">Holerite</th></tr></thead><tbody>{employeePayments.map((payment: any) => <tr key={payment.id} className="border-b border-border/40"><td className="px-3 py-3 font-medium">{String(payment.mes_referencia || "—").padStart(2, "0")}/{payment.ano_referencia || "—"}</td><td className="px-3 py-3">{money(payment.salario_bruto)}</td><td className="px-3 py-3">{money((payment.descontos_detalhes || []).reduce?.((sum: number, item: any) => sum + Number(item.valor || 0), 0))}</td><td className="px-3 py-3 font-semibold">{money(payment.salario_liquido)}</td><td className="px-3 py-3">{money(payment.ferias_valor_holerite)}</td><td className="px-3 py-3">{payment.url_holerite ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={payment.url_holerite.startsWith("http") ? payment.url_holerite : supabase.storage.from("holerites").getPublicUrl(payment.url_holerite).data.publicUrl} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /> PDF</a> : "—"}</td></tr>)}</tbody></table></div>}</CardContent></Card>
                    </TabsContent>

                    <TabsContent value="holerites"><PayslipsManagement employeeId={selectedEmployee.id} employeeName={selectedEmployee.full_name} /></TabsContent>

                    <TabsContent value="ponto" className="space-y-5">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr]">
                        <Card><CardHeader><CardTitle className="text-base">Registro de ponto</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3"><div><Label>Mês</Label><Select value={pointMonth} onValueChange={setPointMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent></Select></div><div><Label>Ano</Label><Select value={pointYear} onValueChange={setPointYear}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{years(currentYear).map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select></div></div>{pointLoading ? <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Carregando ponto...</div> : pointEntries.length === 0 ? <p className="text-sm text-muted-foreground">Sem marcações no período selecionado.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="px-2 py-2">Data</th><th className="px-2 py-2">Entrada</th><th className="px-2 py-2">Almoço</th><th className="px-2 py-2">Saída</th><th className="px-2 py-2">Horas</th><th className="px-2 py-2">Status</th></tr></thead><tbody>{pointEntries.map((entry: any) => <tr key={entry.id} className="border-b border-border/40"><td className="px-2 py-2">{dateBR(entry.data_entrada)}</td><td className="px-2 py-2">{entry.entrada_hora ? new Date(entry.entrada_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</td><td className="px-2 py-2">{entry.inicio_almoco && entry.fim_almoco ? `${new Date(entry.inicio_almoco).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} - ${new Date(entry.fim_almoco).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "—"}</td><td className="px-2 py-2">{entry.saida_hora ? new Date(entry.saida_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</td><td className="px-2 py-2 font-semibold">{entry.horas_totais != null ? `${Number(entry.horas_totais).toFixed(2)}h` : "—"}</td><td className="px-2 py-2">{entry.status}</td></tr>)}</tbody></table></div>}</CardContent></Card>
                        <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><HeartPulse className="h-4 w-4 text-primary" /> Faltas, justificativas e atestados</CardTitle></CardHeader><CardContent className="space-y-2">{absences.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma justificativa/atestado registrado.</p> : absences.map((absence: any) => <div key={absence.id} className="rounded-xl border border-border/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{dateBR(absence.data_registro)}</p><p className="text-xs text-muted-foreground">{absence.justificativa}</p></div><Badge variant="outline">{absence.status}</Badge></div>{absence.url_documento && <a href={absence.url_documento} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"><FileText className="h-3.5 w-3.5" /> Abrir documento</a>}{absence.motivo_rejeicao && <p className="mt-2 text-xs text-red-500">{absence.motivo_rejeicao}</p>}</div>)}</CardContent></Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="decimo" className="space-y-5">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
                        <Card><CardHeader><CardTitle className="text-base">Calculadora de 13º · {currentYear}</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label>Base salarial</Label><Input type="number" min={0} step="0.01" value={thirteenthBase} onChange={(event) => setThirteenthBase(Number(event.target.value))} /></div><div><Label>Avos (meses trabalhados)</Label><Select value={String(thirteenthMonths)} onValueChange={(value) => setThirteenthMonths(Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <SelectItem key={month} value={String(month)}>{month}/12 avos</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div><Label>INSS estimado</Label><Input type="number" min={0} step="0.01" value={thirteenthInss} onChange={(event) => setThirteenthInss(Number(event.target.value))} /></div><div><Label>IRRF estimado</Label><Input type="number" min={0} step="0.01" value={thirteenthIrrf} onChange={(event) => setThirteenthIrrf(Number(event.target.value))} /></div></div><Separator /><p className="text-xs text-muted-foreground">A calculadora usa os valores informados e deixa os descontos explícitos para conferência contábil.</p><Button onClick={saveThirteenth} disabled={savingThirteenth || !thirteenthBase} className="w-full">{savingThirteenth ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar cálculo"}</Button></CardContent></Card>
                        <Card><CardHeader><CardTitle className="text-base">Resultado</CardTitle></CardHeader><CardContent className="space-y-3"><div className="rounded-2xl border border-primary/15 bg-primary/5 p-4"><p className="text-xs text-muted-foreground">13º bruto proporcional</p><p className="mt-1 text-3xl font-bold">{money(grossThirteenth)}</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">1ª parcela</p><p className="mt-1 font-semibold">{money(firstInstallment)}</p></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">2ª parcela</p><p className="mt-1 font-semibold">{money(secondInstallment)}</p></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Líquido estimado</p><p className="mt-1 font-semibold text-emerald-500">{money(netThirteenth)}</p></div></div>{thirteenth && <div className="rounded-xl bg-muted/50 p-3 text-sm"><div className="flex items-center justify-between"><span>Status salvo</span><Badge variant="outline">{thirteenth.status_pagamento || "pending"}</Badge></div><p className="mt-2 text-xs text-muted-foreground">Última atualização: {thirteenth.atualizado_em ? new Date(thirteenth.atualizado_em).toLocaleString("pt-BR") : "—"}</p></div>}</CardContent></Card>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
