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
import { fetchCrewMembers } from "@/services/crew";
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

  const { data: crewMembers = [] } = useQuery({
    queryKey: ["crew_members"],
    queryFn: fetchCrewMembers,
  });


  // Query to get existing flight payments for the selected crew member and period
  const flightPaymentsQuery: any = useQuery({
    queryKey: ["flight_payments", selectedCrewMember, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!selectedCrewMember) return null;
      try {
        const { data, error } = await (supabase as any)
          .from("flight_payments")
          .select("*")
          .eq("crew_member_id", selectedCrewMember)
          .eq("month", selectedMonth)
          .eq("year", selectedYear)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
      } catch {
        return null;
      }
    },
    enabled: !!selectedCrewMember,
  });
  const flightPayment = flightPaymentsQuery.data as any;

  const { data: crewFlightHours = [] } = useQuery({
    queryKey: ["crew_flight_hours", selectedCrewMember, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!selectedCrewMember) return [];
      const { data, error } = await supabase
        .from("crew_flight_hours")
        .select(`*, aircraft:aeronave_id ( registration, model )`)
        .eq("crew_member_id", selectedCrewMember)
        .eq("month", selectedMonth)
        .eq("year", selectedYear);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedCrewMember,
  });

  // Query para pegar as taxas de aeronaves por mês/ano
  const { data: aircraftWithRates = [] } = useQuery({
    queryKey: ["aircraft_rates", selectedMonth, selectedYear],
    queryFn: async () => {
      // Primeiro busca os dados de aircraft_hourly_rates
      const { data: rates, error: ratesError } = await supabase
        .from('taxas_hora_aeronave')
        .select("aeronave_id, hourly_rate, effective_date");

      if (ratesError) throw ratesError;

      // Busca dados básicos de aeronaves
      const { data: aircraft, error: aircraftError } = await supabase
        .from('aeronave')
        .select('id, matricula')
        .eq("status", "ativa");

      if (aircraftError) throw aircraftError;

      // Monta mapa de rates por aeronave para o mês/ano selecionado
      const ratesMap = new Map<string, { registration: string; hourly_rate: number }>();

      for (const plane of aircraft || []) {
        // Encontra a taxa mais recente para este mês/ano
        const applicableRate = (rates || []).find((r: any) => {
          if (r.aeronave_id !== plane.id) return false;
          const rateDate = new Date(r.effective_date);
          const rateMonth = rateDate.getMonth() + 1;
          const rateYear = rateDate.getFullYear();
          return rateMonth === selectedMonth && rateYear === selectedYear;
        });

        // Se não encontrar exato para o mês, pega a mais recente anterior
        let rate = applicableRate?.hourly_rate || 0;
        if (!rate) {
          const prevRate = (rates || [])
            .filter((r: any) => r.aeronave_id === plane.id)
            .sort((a: any, b: any) =>
              new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime()
            )[0];
          rate = prevRate?.hourly_rate || 0;
        }

        if (rate > 0) {
          ratesMap.set(plane.id, {
            registration: plane.registration,
            hourly_rate: rate,
          });
        }
      }

      // Converte para array
      return Array.from(ratesMap.entries()).map(([id, data]) => ({
        id,
        ...data,
      }));
    },
    enabled: !!selectedMonth && !!selectedYear,
  });


  const calculatePaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCrewMember) {
        throw new Error("Selecione um funcionário");
      }

      if (crewFlightHours.length === 0) {
        throw new Error("Nenhuma hora registrada para este período");
      }

      let totalHours = 0;
      let calculatedAmount = 0;
      let hoursWithoutRate = 0;

      // Calculate payment based on crew flight hours and aircraft rates
      for (const hours of crewFlightHours as any[]) {
        const aircraftRate = aircraftWithRates.find((a: any) => a.id === hours.aeronave_id);

        const flightHours = Number(hours.total_hours) || 0;
        const hourlyRate = aircraftRate?.hourly_rate || 0;

        if (flightHours > 0) {
          totalHours += flightHours;
          calculatedAmount += flightHours * hourlyRate;

          // Rastreia se há horas sem taxa configurada
          if (hourlyRate === 0) {
            hoursWithoutRate += flightHours;
          }
        }
      }

      if (totalHours === 0) {
        throw new Error("Nenhuma hora registrada para este período");
      }

      if (hoursWithoutRate > 0) {
        throw new Error(`${hoursWithoutRate.toFixed(2)} hora(s) não possuem preço/hora configurado na tabela de valores por aeronave.`);
      }

      // Prepare payment data
      const paymentData = {
        crew_member_id: selectedCrewMember,
        month: selectedMonth,
        year: selectedYear,
        total_hours: totalHours,
        calculated_amount: Math.round(calculatedAmount * 100) / 100,
        final_amount: Math.round(calculatedAmount * 100) / 100,
        status: "calculated",
      };

      // Upsert into flight_payments table
      const { error } = await (supabase as any)
        .from("flight_payments")
        .upsert([paymentData], {
          onConflict: "crew_member_id,month,year",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flight_payments", selectedCrewMember, selectedMonth, selectedYear] });
      toast.success("Pagamento calculado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao calcular pagamento: ${error.message}`);
    },
  });

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
    <TabsList className="flex gap-2 bg-transparent p-0 border-0 w-full overflow-x-auto">
      <TabsTrigger
        value="salaries"
        className="rounded-lg overflow-hidden transition-all p-0 flex-1 min-w-max data-[state=inactive]:hover:shadow-md data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500/20 data-[state=active]:to-cyan-500/10"
      >
        <div className="border border-blue-500/40 rounded-lg overflow-hidden px-3 py-2 flex flex-col items-center gap-1 w-full h-full">
          <div className="rounded p-1.5">
            <DollarSign className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-center">
            <p className="font-medium text-xs text-foreground">Salários</p>
          </div>
        </div>
      </TabsTrigger>

      <TabsTrigger
        value="payslips"
        className="rounded-lg overflow-hidden transition-all p-0 flex-1 min-w-max data-[state=inactive]:hover:shadow-md data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500/20 data-[state=active]:to-teal-500/10"
      >
        <div className="border border-emerald-500/40 rounded-lg overflow-hidden px-3 py-2 flex flex-col items-center gap-1 w-full h-full">
          <div className="rounded p-1.5">
            <FileText className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-center">
            <p className="font-medium text-xs text-foreground">Holerites</p>
          </div>
        </div>
      </TabsTrigger>

      <TabsTrigger
        value="flights"
        className="rounded-lg overflow-hidden transition-all p-0 flex-1 min-w-max data-[state=inactive]:hover:shadow-md data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-500/20 data-[state=active]:to-amber-500/10"
      >
        <div className="border border-orange-500/40 rounded-lg overflow-hidden px-3 py-2 flex flex-col items-center gap-1 w-full h-full">
          <div className="rounded p-1.5">
            <Plane className="h-4 w-4 text-orange-600" />
          </div>
          <div className="text-center">
            <p className="font-medium text-xs text-foreground">Pagamentos por Voo</p>
          </div>
        </div>
      </TabsTrigger>

      <TabsTrigger
        value="aeronave"
        className="rounded-lg overflow-hidden transition-all p-0 flex-1 min-w-max data-[state=inactive]:hover:shadow-md data-[state=active]:bg-gradient-to-br data-[state=active]:from-violet-500/20 data-[state=active]:to-purple-500/10"
      >
        <div className="border border-violet-500/40 rounded-lg overflow-hidden px-3 py-2 flex flex-col items-center gap-1 w-full h-full">
          <div className="rounded p-1.5">
            <Zap className="h-4 w-4 text-violet-600" />
          </div>
          <div className="text-center">
            <p className="font-medium text-xs text-foreground">Aeronaves</p>
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Funcionário</Label>
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
                      <Button onClick={() => calculatePaymentMutation.mutate()} disabled={calculatePaymentMutation.isPending}>
                        <Plus className="h-4 w-4 mr-2" />
                        Calcular e Salvar Pagamento
                      </Button>
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
                              <TableRow key={hours.id} className={!hasRate ? "bg-red-50" : ""}>
                                <TableCell className="font-semibold">{hours.aeronave?.matricula} - {hours.aeronave?.modelo}</TableCell>
                                <TableCell>{Number(hours.total_hours).toFixed(2)}h</TableCell>
                                <TableCell>
                                  {hasRate ? (
                                    <span className="text-green-600 font-semibold">R$ {(aircraftRate?.hourly_rate || 0).toFixed(2)}</span>
                                  ) : (
                                    <span className="text-red-600 font-semibold bg-red-100 px-2 py-1 rounded text-xs">Sem preço</span>
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
                      <div className="bg-red-50 border border-red-200 rounded p-3 mt-3">
                        <p className="text-sm text-red-800">
                          <strong>⚠️ Atenção:</strong> Algumas aeronaves não possuem preço/hora configurado. Configure os valores na aba "Aeronaves" antes de calcular o pagamento.
                        </p>
                      </div>
                    )}
                  </div>

                  {flightPayment ? (
                    <Card className="bg-green-50 border-green-200">
                      <CardHeader>
                        <CardTitle className="text-green-900">Resumo do Pagamento Calculado</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-lg border">
                              <Label className="text-xs text-muted-foreground">Total de Horas</Label>
                              <p className="text-3xl font-bold text-blue-600 mt-1">{Number(flightPayment.total_hours).toFixed(2)}h</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border">
                              <Label className="text-xs text-muted-foreground">Pagamento por Voo</Label>
                              <p className="text-3xl font-bold text-green-600 mt-1">R$ {Number(flightPayment.calculated_amount).toFixed(2)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border">
                              <Label className="text-xs text-muted-foreground">Total Geral</Label>
                              <p className="text-3xl font-bold text-primary mt-1">R$ {Number(flightPayment.final_amount).toFixed(2)}</p>
                            </div>
                          </div>
                          {flightPayment.notes && (
                            <div>
                              <Label className="text-sm font-semibold">Observações</Label>
                              <p className="text-sm text-muted-foreground mt-1">{flightPayment.notes}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ) : crewFlightHours.length > 0 ? (
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-6">
                        <p className="text-blue-900 text-sm">
                          Clique em "Calcular e Salvar Pagamento" para registrar o pagamento deste funcionário.
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}
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
