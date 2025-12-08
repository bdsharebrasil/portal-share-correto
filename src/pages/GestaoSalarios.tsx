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
import { Pencil, Plus, Loader2, X, Save, DollarSign, FileText, Plane, Zap } from "lucide-react";
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


  // @ts-ignore - Evitar erro de type instantiation profundo
  const flightPaymentsQuery: any = useQuery({
    queryKey: ["flight_payments", selectedCrewMember, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!selectedCrewMember) return [];
      // @ts-ignore
      const { data, error } = await supabase
        .from("flight_payments")
        .select("*")
        .eq("crew_member_id", selectedCrewMember)
        .eq("month", selectedMonth)
        .eq("year", selectedYear);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCrewMember,
  });
  const flightPayments = (flightPaymentsQuery.data || []) as any[];

  const { data: crewFlightHours = [] } = useQuery({
    queryKey: ["crew_flight_hours", selectedCrewMember, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!selectedCrewMember) return [];
      const { data, error } = await supabase
        .from("crew_flight_hours")
        .select(`*, aircraft:aircraft_id ( registration, model )`)
        .eq("crew_member_id", selectedCrewMember)
        .eq("month", selectedMonth)
        .eq("year", selectedYear);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedCrewMember,
  });

  // Query para pegar as taxas de aeronaves
  const { data: aircraftWithRates = [] } = useQuery({
    queryKey: ["aircraft_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft")
        .select("id, registration, hourly_price");
      if (error) throw error;
      return (data || []).map((a: any) => ({
        id: a.id,
        registration: a.registration,
        hourly_rate: parseFloat(a.hourly_price) || 0,
      }));
    },
  });


  const calculatePaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCrewMember || crewFlightHours.length === 0) {
        throw new Error("Selecione um funcionário com horas registradas");
      }

      let totalHours = 0;
      let calculatedAmount = 0;

      for (const hours of crewFlightHours as any[]) {
        const aircraftRate = aircraftWithRates.find((a: any) => a.id === hours.aircraft_id);
        if (aircraftRate && aircraftRate.hourly_rate > 0) {
          const hourAmount = Number(hours.total_hours) * Number(aircraftRate.hourly_rate);
          totalHours += Number(hours.total_hours);
          calculatedAmount += hourAmount;
        }
      }

      if (totalHours === 0) {
        throw new Error("Nenhuma hora registrada para este período");
      }

      const paymentData = {
        crew_member_id: selectedCrewMember,
        month: selectedMonth,
        year: selectedYear,
        total_hours: totalHours,
        calculated_amount: calculatedAmount,
        final_amount: calculatedAmount,
        status: "calculated",
      } as any;

      const { error } = await supabase.from("flight_payments").upsert(paymentData, {
        onConflict: "crew_member_id,month,year",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flight_payments"] });
      toast.success("Pagamento calculado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao calcular pagamento: ${error.message}`);
    },
  });

  if (isRolesLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        value="aircraft"
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
                            const aircraftRate = aircraftWithRates.find((a: any) => a.id === hours.aircraft_id);
                            const subtotal = Number(hours.total_hours) * (aircraftRate?.hourly_rate || 0);
                            return (
                              <TableRow key={hours.id}>
                                <TableCell className="font-semibold">{hours.aircraft?.registration} - {hours.aircraft?.model}</TableCell>
                                <TableCell>{Number(hours.total_hours).toFixed(2)}h</TableCell>
                                <TableCell className="text-green-600 font-semibold">R$ {(aircraftRate?.hourly_rate || 0).toFixed(2)}</TableCell>
                                <TableCell className="font-bold">R$ {subtotal.toFixed(2)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  {(flightPayments as any[]).length > 0 ? (
                    <Card className="bg-green-50 border-green-200">
                      <CardHeader>
                        <CardTitle className="text-green-900">Resumo do Pagamento</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {(flightPayments as any[]).map((payment) => (
                          <div key={payment.id} className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div className="bg-white p-4 rounded-lg border">
                                <Label className="text-xs text-muted-foreground">Total de Horas</Label>
                                <p className="text-3xl font-bold text-blue-600 mt-1">{Number(payment.total_hours).toFixed(2)}h</p>
                              </div>
                              <div className="bg-white p-4 rounded-lg border">
                                <Label className="text-xs text-muted-foreground">Pagamento por Voo</Label>
                                <p className="text-3xl font-bold text-green-600 mt-1">R$ {Number(payment.calculated_amount).toFixed(2)}</p>
                              </div>
                              <div className="bg-white p-4 rounded-lg border">
                                <Label className="text-xs text-muted-foreground">Total Geral</Label>
                                <p className="text-3xl font-bold text-primary mt-1">R$ {Number(payment.final_amount).toFixed(2)}</p>
                              </div>
                            </div>
                            {payment.observations && (
                              <div>
                                <Label className="text-sm font-semibold">Observações</Label>
                                <p className="text-sm text-muted-foreground mt-1">{payment.observations}</p>
                              </div>
                            )}
                          </div>
                        ))}
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

        <TabsContent value="aircraft" className="space-y-4">
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
