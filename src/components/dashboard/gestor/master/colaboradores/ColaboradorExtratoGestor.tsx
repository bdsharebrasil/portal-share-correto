import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Search, UserRound, Wallet, CalendarDays, Clock3, FileText, ExternalLink, Banknote, Palmtree, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const money = (value: unknown) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateBR = (value?: string | null) => value ? format(new Date(`${value}T12:00:00`), "dd/MM/yyyy", { locale: ptBR }) : "—";
const initials = (name: string) => name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export function ColaboradorExtratoGestor() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["master-colaboradores-extrato"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id,full_name,email,avatar_url,departamento,cargo,employment_status,admission_date,cpf,telefone,salario,beneficios")
        .eq("tipo", "colaborador")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = employees.filter((employee: any) => {
    const q = search.toLowerCase().trim();
    return !q || [employee.full_name, employee.email, employee.departamento, employee.cargo].some((v) => String(v || "").toLowerCase().includes(q));
  });

  const selected = employees.find((employee: any) => employee.id === selectedId) as any;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Extrato dos colaboradores</h2>
          <p className="text-sm text-muted-foreground">Perfil completo, pagamentos, férias e frequência em um único prontuário.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar colaborador..." className="pl-9 rounded-xl" />
        </div>
      </div>

      {isLoading ? <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando colaboradores...</CardContent></Card> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((employee: any) => (
            <button key={employee.id} type="button" onClick={() => setSelectedId(employee.id)} className="text-left">
              <Card className="h-full rounded-2xl border-border/70 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14 border-2 border-primary/15">
                      <AvatarImage src={employee.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials(employee.full_name || "C")}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{employee.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{employee.cargo || employee.departamento || "Colaborador"}</p>
                      <Badge variant="outline" className="mt-2 text-[10px]">{employee.employment_status || "ativo"}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-muted/40 p-2"><p className="text-muted-foreground">Salário base</p><p className="mt-0.5 font-semibold">{money(employee.salario)}</p></div>
                    <div className="rounded-xl bg-muted/40 p-2"><p className="text-muted-foreground">Admissão</p><p className="mt-0.5 font-semibold">{dateBR(employee.admission_date)}</p></div>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs font-medium text-primary"><UserRound className="h-3.5 w-3.5" /> Abrir prontuário completo</div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        {selected && <EmployeeStatementDialog employee={selected} />}
      </Dialog>
    </div>
  );
}

function EmployeeStatementDialog({ employee }: { employee: any }) {
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["master-employee-payments", employee.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("historico_pagamentos_funcionarios").select("*").eq("id_usuario", employee.id).order("ano_referencia", { ascending: false }).order("mes_referencia", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: vacations = [], isLoading: loadingVacations } = useQuery({
    queryKey: ["master-employee-vacations", employee.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vacation_requests").select("*").eq("user_id", employee.id).order("start_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: balances = [] } = useQuery({
    queryKey: ["master-employee-vacation-balances", employee.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vacation_balances").select("*").eq("user_id", employee.id).order("year", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["master-employee-time-entries", employee.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("time_entries").select("*").eq("user_id", employee.id).order("entry_date", { ascending: false }).limit(100);
      if (error) return [];
      return data || [];
    },
  });

  const totals = useMemo(() => ({
    paid: payments.reduce((sum: number, p: any) => sum + Number(p.valor_total || p.salario_liquido || 0), 0),
    vacationPaid: payments.reduce((sum: number, p: any) => sum + Number(p.ferias || p.ferias_valor_holerite || 0), 0),
    vacationDays: payments.reduce((sum: number, p: any) => sum + Number(p.ferias_dias || 0), 0),
  }), [payments]);

  return (
    <DialogContent className="max-h-[92vh] w-[96vw] max-w-6xl overflow-y-auto rounded-3xl p-0">
      <DialogHeader className="sticky top-0 z-10 border-b bg-background/95 px-6 py-5 backdrop-blur">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 border-2 border-primary/20"><AvatarImage src={employee.avatar_url || undefined} /><AvatarFallback>{initials(employee.full_name || "C")}</AvatarFallback></Avatar>
          <div className="min-w-0"><DialogTitle className="truncate text-xl">{employee.full_name}</DialogTitle><p className="text-sm text-muted-foreground">{employee.cargo || employee.departamento || "Colaborador"} · Admissão {dateBR(employee.admission_date)}</p></div>
        </div>
      </DialogHeader>

      <div className="space-y-5 px-6 pb-7 pt-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Summary icon={Wallet} label="Total registrado" value={money(totals.paid)} />
          <Summary icon={Banknote} label="Férias pagas" value={money(totals.vacationPaid)} />
          <Summary icon={Palmtree} label="Dias de férias pagos" value={`${totals.vacationDays} dias`} />
          <Summary icon={CalendarDays} label="Solicitações" value={`${vacations.length}`} />
        </div>

        <Tabs defaultValue="resumo" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto rounded-2xl bg-muted/60 p-1">
            <TabsTrigger value="resumo" className="rounded-xl">Resumo</TabsTrigger>
            <TabsTrigger value="pagamentos" className="rounded-xl">Pagamentos</TabsTrigger>
            <TabsTrigger value="ferias" className="rounded-xl">Férias</TabsTrigger>
            <TabsTrigger value="ponto" className="rounded-xl">Ponto</TabsTrigger>
            <TabsTrigger value="documentos" className="rounded-xl">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Dados do colaborador</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 text-sm"><Info label="E-mail" value={employee.email} /><Info label="CPF" value={employee.cpf} /><Info label="Telefone" value={employee.telefone} /><Info label="Departamento" value={employee.departamento} /><Info label="Cargo" value={employee.cargo} /><Info label="Salário base" value={money(employee.salario)} /></CardContent></Card>
              <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Saldo de férias</CardTitle></CardHeader><CardContent className="space-y-3">{balances.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum saldo cadastrado.</p> : balances.map((b: any) => <div key={b.id} className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-sm"><span className="font-medium">{b.year}</span><span>{Number(b.days_used || 0)} usados</span><span className="font-semibold text-emerald-600">{Number(b.days_available || 0)} disponíveis</span></div>)}</CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="pagamentos" className="space-y-3">
            {loadingPayments ? <Loading /> : payments.length === 0 ? <Empty text="Nenhum pagamento registrado." /> : payments.map((p: any) => (
              <Card key={p.id} className="rounded-2xl"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{String(p.mes_referencia || "").padStart(2, "0")}/{p.ano_referencia || "—"}</p><p className="text-xs text-muted-foreground">Pagamento {p.data_pagamento || "não informado"}</p></div><div className="grid grid-cols-2 gap-4 text-right text-sm"><div><p className="text-xs text-muted-foreground">Bruto</p><p className="font-semibold">{money(p.salario_bruto || p.salario_holerite)}</p></div><div><p className="text-xs text-muted-foreground">Líquido</p><p className="font-semibold text-emerald-600">{money(p.salario_liquido || p.valor_total)}</p></div></div><div className="flex gap-2">{p.url_holerite && <Button variant="outline" size="sm" asChild><a href={p.url_holerite} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />Holerite</a></Button>}{p.url_comprovante && <Button variant="outline" size="sm" asChild><a href={p.url_comprovante} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Comprovante</a></Button>}</div></div></CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="ferias" className="space-y-3">
            {loadingVacations ? <Loading /> : vacations.length === 0 ? <Empty text="Nenhuma solicitação de férias." /> : vacations.map((v: any) => <Card key={v.id} className="rounded-2xl"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{dateBR(v.start_date)} → {dateBR(v.end_date)}</p><p className="text-xs text-muted-foreground">{v.days} dias · solicitado em {v.criado_em ? format(new Date(v.criado_em), "dd/MM/yyyy") : "—"}</p></div><Badge variant="outline">{v.status === "pending" ? "Pendente" : v.status === "approved" ? "Aprovado" : v.status === "scheduled" ? "Agendado" : "Recusado"}</Badge></div>{v.remarks && <p className="mt-3 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">{v.remarks}</p>}</CardContent></Card>)}
          </TabsContent>

          <TabsContent value="ponto" className="space-y-3">
            {timeEntries.length === 0 ? <Empty text="Nenhum registro de ponto encontrado ou a tabela não está disponível." /> : timeEntries.slice(0, 30).map((entry: any) => <Card key={entry.id} className="rounded-2xl"><CardContent className="flex items-center justify-between p-4 text-sm"><div><p className="font-medium">{dateBR(entry.entry_date || entry.data)}</p><p className="text-xs text-muted-foreground">Entrada {entry.clock_in || entry.hora_entrada || "—"} · Saída {entry.clock_out || entry.hora_saida || "—"}</p></div><Badge variant="outline">{entry.status || "registrado"}</Badge></CardContent></Card>)}
          </TabsContent>

          <TabsContent value="documentos" className="space-y-3">
            <Card className="rounded-2xl"><CardContent className="p-5"><div className="flex items-start gap-3"><FileText className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-medium">Holerites e comprovantes</p><p className="text-sm text-muted-foreground">Os documentos ficam vinculados ao histórico de pagamento e podem ser abertos pelo Financeiro.</p></div></div><Separator className="my-4" />{payments.filter((p: any) => p.url_holerite).slice(0, 12).map((p: any) => <div key={p.id} className="flex items-center justify-between border-b py-3 last:border-0"><span className="text-sm">{String(p.mes_referencia || "").padStart(2, "0")}/{p.ano_referencia}</span><Button size="sm" variant="outline" asChild><a href={p.url_holerite} target="_blank" rel="noreferrer">Abrir PDF</a></Button></div>)}</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DialogContent>
  );
}

function Summary({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <Card className="rounded-2xl"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div></div></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: unknown }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate font-medium">{String(value || "—")}</p></div>;
}

function Loading() { return <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>; }
function Empty({ text }: { text: string }) { return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{text}</CardContent></Card>; }
