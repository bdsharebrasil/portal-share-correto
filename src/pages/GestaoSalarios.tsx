// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Pencil, Plus, X, Save, DollarSign, FileText, Plane, Zap } from "lucide-react";
import { LottieAirplaneSpinner } from "@/components/ui/lottie-airplane-spinner";
import { PayslipsManagement } from "@/components/payslips/PayslipsManagement";
import { AircraftSalariesMonthly } from "@/components/vencimentos/AircraftSalariesMonthly";
import { EmployeeSalariesMonthly } from "@/components/vencimentos/EmployeeSalariesMonthly";
import { ThirteenthSalaryManager } from "@/components/vencimentos/ThirteenthSalaryManager";
import { VacationConfigManager } from "@/components/vencimentos/VacationConfigManager";
import { EmployeeSalaryCalculator } from "@/components/vencimentos/EmployeeSalaryCalculator";

export const GestaoSalariosContent = () => {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedCrewMember, setSelectedCrewMember] = useState<string>("");

  const { isAdmin, isFinanceiroMaster, isGestorMaster, isLoading: isRolesLoading } = useUserRole();
  const isAllowed = isAdmin || isFinanceiroMaster || isGestorMaster;

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  // Tripulantes reais (a tabela de horas usa membros_tripulacao.id)
  const { data: crewMembers = [] } = useQuery({
    queryKey: ["membros_tripulacao_ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membros_tripulacao")
        .select("id, nome_completo, canac, status")
        .eq("status", "ativo")
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return (data || []).map((m: any) => ({ id: m.id, full_name: m.nome_completo, canac: m.canac }));
    },
  });

  // Horas voadas do mês por aeronave para o tripulante selecionado
  const { data: crewFlightHours = [] } = useQuery({
    queryKey: ["horas_voo_tripulante", selectedCrewMember, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!selectedCrewMember) return [];
      const { data, error } = await supabase
        .from("horas_voo_tripulante")
        .select(`id, aeronave_id, horas_totais, mes, ano, aeronave:aeronave_id ( matricula, modelo )`)
        .eq("membro_tripulacao_id", selectedCrewMember)
        .eq("mes", selectedMonth)
        .eq("ano", selectedYear);
      if (error) throw error;
      return (data || []).map((h: any) => ({ ...h, total_hours: Number(h.horas_totais) || 0 }));
    },
    enabled: !!selectedCrewMember,
  });

  // Custo-hora vigente de cada aeronave para o mês/ano selecionado
  const { data: aircraftWithRates = [] } = useQuery({
    queryKey: ["aircraft_rates", selectedMonth, selectedYear],
    queryFn: async () => {
      const { data: rates, error: ratesError } = await supabase
        .from("taxas_hora_aeronave")
        .select("aeronave_id, taxa_hora, data_vigencia")
        .order("data_vigencia", { ascending: false });
      if (ratesError) throw ratesError;

      const { data: aircraft, error: aircraftError } = await supabase
        .from("aeronave")
        .select("id, matricula, modelo");
      if (aircraftError) throw aircraftError;

      const limite = new Date(selectedYear, selectedMonth, 0).getTime();

      return (aircraft || []).map((plane: any) => {
        // taxa vigente = a mais recente com data_vigencia até o fim do mês selecionado
        const vigente = (rates || []).find(
          (r: any) => r.aeronave_id === plane.id && new Date(r.data_vigencia).getTime() <= limite
        );
        return {
          id: plane.id,
          registration: plane.matricula,
          model: plane.modelo,
          hourly_rate: Number(vigente?.taxa_hora) || 0,
        };
      });
    },
    enabled: !!selectedMonth && !!selectedYear,
  });

  // Cálculo automático: horas voadas do mês × custo-hora da aeronave
  const resumoCalculo = (() => {
    let totalHoras = 0;
    let totalValor = 0;
    let horasSemTaxa = 0;
    for (const h of crewFlightHours as any[]) {
      const rate = aircraftWithRates.find((a: any) => a.id === h.aeronave_id)?.hourly_rate || 0;
      const horas = Number(h.total_hours) || 0;
      if (horas <= 0) continue;
      totalHoras += horas;
      totalValor += horas * rate;
      if (rate <= 0) horasSemTaxa += horas;
    }
    return {
      totalHoras,
      totalValor: Math.round(totalValor * 100) / 100,
      horasSemTaxa,
    };
  })();




  if (isRolesLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <LottieAirplaneSpinner size="md" />
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Você não tem permissão para acessar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (


      <Tabs defaultValue="salaries" className="w-full">
    <TabsList className="flex gap-3 rounded-3xl border border-white/10 bg-slate-950/80 p-2 shadow-card w-full overflow-x-auto">
      <TabsTrigger
        value="salaries"
        className="rounded-3xl overflow-hidden transition-all p-0 flex-1 min-w-[180px] data-[state=inactive]:bg-white/5 data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-white/10 data-[state=active]:bg-transparent"
      >
        <div className="border border-white/10 rounded-3xl bg-slate-950/90 px-4 py-3 flex flex-col items-center gap-2 w-full h-full transition">
          <div className="rounded-2xl bg-slate-900/80 p-2">
            <DollarSign className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm text-foreground">Salários</p>
          </div>
        </div>
      </TabsTrigger>

      <TabsTrigger
        value="payslips"
        className="rounded-3xl overflow-hidden transition-all p-0 flex-1 min-w-[180px] data-[state=inactive]:bg-white/5 data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-white/10 data-[state=active]:bg-transparent"
      >
        <div className="border border-white/10 rounded-3xl bg-slate-950/90 px-4 py-3 flex flex-col items-center gap-2 w-full h-full transition">
          <div className="rounded-2xl bg-slate-900/80 p-2">
            <FileText className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm text-foreground">Holerites</p>
          </div>
        </div>
      </TabsTrigger>

      <TabsTrigger
        value="flights"
        className="rounded-3xl overflow-hidden transition-all p-0 flex-1 min-w-[180px] data-[state=inactive]:bg-white/5 data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-white/10 data-[state=active]:bg-transparent"
      >
        <div className="border border-white/10 rounded-3xl bg-slate-950/90 px-4 py-3 flex flex-col items-center gap-2 w-full h-full transition">
          <div className="rounded-2xl bg-slate-900/80 p-2">
            <Plane className="h-4 w-4 text-orange-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm text-foreground">Pagamentos por Voo</p>
          </div>
        </div>
      </TabsTrigger>

      <TabsTrigger
        value="aeronave"
        className="rounded-3xl overflow-hidden transition-all p-0 flex-1 min-w-[180px] data-[state=inactive]:bg-white/5 data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-white/10 data-[state=active]:bg-transparent"
      >
        <div className="border border-white/10 rounded-3xl bg-slate-950/90 px-4 py-3 flex flex-col items-center gap-2 w-full h-full transition">
          <div className="rounded-2xl bg-slate-900/80 p-2">
            <Zap className="h-4 w-4 text-violet-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm text-foreground">Aeronaves</p>
          </div>
        </div>
      </TabsTrigger>
    </TabsList>

        <TabsContent value="salaries" className="space-y-4">
          <EmployeeSalariesMonthly />
        </TabsContent>

        <TabsContent value="salary-calculator" className="space-y-4">
          <EmployeeSalaryCalculator />
        </TabsContent>

        <TabsContent value="payslips" className="space-y-4">
          <PayslipsManagement />
        </TabsContent>

        <TabsContent value="flights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Calculadora de Pagamento por Horas de Voo</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Os valores de hora são obtidos da tabela de valores mensais por aeronave. Certifique-se de que os preços estão configurados na aba "Aeronaves".
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Tripulante</Label>
                  <Select value={selectedCrewMember} onValueChange={setSelectedCrewMember}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o funcionário" />
                    </SelectTrigger>
                    <SelectContent>
                      {(crewMembers as any[]).map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mês</Label>
                  <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month, index) => (
                        <SelectItem key={index} value={(index + 1).toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ano</Label>
                  <Input type="number" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} />
                </div>
              </div>

              {selectedCrewMember && (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">Horas de Voo por Aeronave</h3>
                    </div>
                    {crewFlightHours.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma hora de voo registrada para este período.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Aeronave</TableHead>
                            <TableHead>Horas Totais</TableHead>
                            <TableHead>Valor/Hora</TableHead>
                            <TableHead>Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(crewFlightHours as any[]).map((hours) => {
                            const aircraftRate = aircraftWithRates.find((a: any) => a.id === hours.aeronave_id);
                            const subtotal = Number(hours.total_hours) * (aircraftRate?.hourly_rate || 0);
                            const hasRate = aircraftRate && aircraftRate.hourly_rate > 0;
                            return (
                              <TableRow key={hours.id} className={!hasRate ? "bg-destructive/5" : ""}>
                                <TableCell className="font-semibold">{hours.aeronave?.matricula} - {hours.aeronave?.modelo}</TableCell>
                                <TableCell>{Number(hours.total_hours).toFixed(2)}h</TableCell>
                                <TableCell>
                                  {hasRate ? (
                                    <span className="text-emerald-500 font-semibold">R$ {(aircraftRate?.hourly_rate || 0).toFixed(2)}</span>
                                  ) : (
                                    <span className="text-destructive font-semibold bg-destructive/10 px-2 py-1 rounded text-xs">Sem preço</span>
                                  )}
                                </TableCell>
                                <TableCell className="font-bold">R$ {subtotal.toFixed(2)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                    {crewFlightHours.length > 0 && (crewFlightHours as any[]).some((h: any) => {
                      const rate = aircraftWithRates.find((a: any) => a.id === h.aeronave_id);
                      return !rate || rate.hourly_rate === 0;
                    }) && (
                      <div className="bg-destructive/5 border border-destructive/30 rounded-xl p-3 mt-3">
                        <p className="text-sm text-destructive">
                          <strong>⚠️ Atenção:</strong> Algumas aeronaves não possuem preço/hora configurado. Configure os valores na aba "Aeronaves" antes de calcular o pagamento.
                        </p>
                      </div>
                    )}
                  </div>

                  {crewFlightHours.length > 0 && (
                    <Card className="border-emerald-500/30 bg-emerald-500/5">
                      <CardHeader>
                        <CardTitle className="text-emerald-500">Resumo do Pagamento (cálculo automático)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-card p-4 rounded-xl border border-border/60">
                            <Label className="text-xs text-muted-foreground">Total de Horas</Label>
                            <p className="text-3xl font-bold text-foreground mt-1">{resumoCalculo.totalHoras.toFixed(2)}h</p>
                          </div>
                          <div className="bg-card p-4 rounded-xl border border-border/60">
                            <Label className="text-xs text-muted-foreground">Horas sem preço</Label>
                            <p className="text-3xl font-bold text-destructive mt-1">{resumoCalculo.horasSemTaxa.toFixed(2)}h</p>
                          </div>
                          <div className="bg-card p-4 rounded-xl border border-border/60">
                            <Label className="text-xs text-muted-foreground">Valor a Pagar</Label>
                            <p className="text-3xl font-bold text-primary mt-1">R$ {resumoCalculo.totalValor.toFixed(2)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aeronave" className="space-y-4">
          <AircraftSalariesMonthly />
        </TabsContent>
      </Tabs>
  );
};

const GestaoSalarios = () => {
  return (
    <Layout>
      <GestaoSalariosContent />
    </Layout>
  );
};

export default GestaoSalarios;
