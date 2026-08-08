// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, DollarSign, Plus, Check, Clock, AlertTriangle, User, History } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Colaborador {
  id: string;
  full_name: string;
  avatar_url: string | null;
  admission_date: string | null;
  salario: number | null;
  email: string | null;
}

interface VacationConfig {
  id: string;
  user_profile: string;
  year: number;
  total_vacation_days: number;
  working_months: number;
  scheduled_date: string | null;
  payment_status: string | null;
  vacation_gross_value: number;
  vacation_net_value: number;
  vacation_third_value: number;
}

interface ThirteenthSalary {
  id: string;
  user_profile: string;
  year: number;
  gross_value: number;
  net_value: number;
  first_installment_amount: number;
  first_installment_date: string | null;
  second_installment_amount: number;
  second_installment_date: string | null;
  payment_status: string | null;
}

export function FeriasDecimosTab() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string | null>(null);
  const [isAddVacationOpen, setIsAddVacationOpen] = useState(false);
  const [isAddThirteenthOpen, setIsAddThirteenthOpen] = useState(false);
  const [newVacation, setNewVacation] = useState({
    scheduled_date: "",
    total_vacation_days: "30",
    year: currentYear.toString(),
  });
  const [newThirteenth, setNewThirteenth] = useState({
    gross_value: "",
    year: currentYear.toString(),
  });

  const { data: colaboradores } = useQuery({
    queryKey: ["colaboradores-ferias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, avatar_url, admission_date, salario, email")
        .eq("tipo", "colaborador")
        .order("full_name");
      if (error) throw error;
      return data as Colaborador[];
    },
  });

  const selectedColaborador = colaboradores?.find((c) => c.id === selectedColaboradorId);

  // Buscar todas as férias do colaborador selecionado (histórico completo)
  const { data: vacationHistory } = useQuery({
    queryKey: ["vacation-history", selectedColaboradorId],
    queryFn: async () => {
      if (!selectedColaboradorId) return [];
      const { data, error } = await supabase
        .from("employee_vacation_config")
        .select("*")
        .eq("user_profile", selectedColaboradorId)
        .order("year", { ascending: false });
      if (error) throw error;
      return data as VacationConfig[];
    },
    enabled: !!selectedColaboradorId,
  });

  // Buscar todos os 13º do colaborador selecionado (histórico completo)
  const { data: thirteenthHistory } = useQuery({
    queryKey: ["thirteenth-history", selectedColaboradorId],
    queryFn: async () => {
      if (!selectedColaboradorId) return [];
      const { data, error } = await supabase
        .from("employee_thirteenth_salary")
        .select("*")
        .eq("user_profile", selectedColaboradorId)
        .order("year", { ascending: false });
      if (error) throw error;
      return data as ThirteenthSalary[];
    },
    enabled: !!selectedColaboradorId,
  });

  const addVacationMutation = useMutation({
    mutationFn: async (data: typeof newVacation) => {
      if (!selectedColaboradorId) throw new Error("Selecione um colaborador");
      const { error } = await supabase.from("employee_vacation_config").insert({
        user_profile: selectedColaboradorId,
        year: parseInt(data.year),
        scheduled_date: data.scheduled_date || null,
        total_vacation_days: parseInt(data.total_vacation_days),
        payment_status: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacation-history", selectedColaboradorId] });
      setIsAddVacationOpen(false);
      setNewVacation({ scheduled_date: "", total_vacation_days: "30", year: currentYear.toString() });
      toast.success("Férias registradas!");
    },
    onError: () => toast.error("Erro ao registrar férias"),
  });

  const addThirteenthMutation = useMutation({
    mutationFn: async (data: typeof newThirteenth) => {
      if (!selectedColaboradorId) throw new Error("Selecione um colaborador");
      const grossValue = parseFloat(data.gross_value);
      const { error } = await supabase.from("employee_thirteenth_salary").insert({
        user_profile: selectedColaboradorId,
        year: parseInt(data.year),
        gross_value: grossValue,
        net_value: grossValue * 0.88,
        first_installment_amount: grossValue * 0.5,
        second_installment_amount: grossValue * 0.38,
        payment_status: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thirteenth-history", selectedColaboradorId] });
      setIsAddThirteenthOpen(false);
      setNewThirteenth({ gross_value: "", year: currentYear.toString() });
      toast.success("13º salário registrado!");
    },
    onError: () => toast.error("Erro ao registrar 13º"),
  });

  const updateVacationStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("employee_vacation_config")
        .update({ payment_status: status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacation-history", selectedColaboradorId] });
      toast.success("Status atualizado!");
    },
  });

  const updateThirteenthStatus = useMutation({
    mutationFn: async ({ id, status, field }: { id: string; status: string; field?: string }) => {
      const updateData: Record<string, string> = { payment_status: status };
      if (field === "first" && status === "pago") {
        updateData.first_installment_date = new Date().toISOString().split("T")[0];
      } else if (field === "second" && status === "pago") {
        updateData.second_installment_date = new Date().toISOString().split("T")[0];
      }
      const { error } = await supabase
        .from("employee_thirteenth_salary")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thirteenth-history", selectedColaboradorId] });
      toast.success("Status atualizado!");
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "pago":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><Check className="h-3 w-3 mr-1" />Pago</Badge>;
      case "parcial":
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20"><Clock className="h-3 w-3 mr-1" />Parcial</Badge>;
      case "em_ferias":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Calendar className="h-3 w-3 mr-1" />Em Férias</Badge>;
      case "agendado":
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20"><Clock className="h-3 w-3 mr-1" />Agendado</Badge>;
      default:
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  const getInstallmentBadge = (date: string | null) => {
    if (date) {
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          <Check className="h-3 w-3 mr-1" />
          Pago em {format(new Date(date), "dd/MM/yyyy")}
        </Badge>
      );
    }
    return (
      <Badge className="bg-muted text-muted-foreground border-muted">
        <Clock className="h-3 w-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const currentYearVacation = vacationHistory?.find((v) => v.year === currentYear);
  const currentYearThirteenth = thirteenthHistory?.find((t) => t.year === currentYear);

  return (
    <div className="w-full min-w-0 space-y-6 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Férias e 13º Salário</h2>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-6">
        {/* Lista de colaboradores */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Selecionar Colaborador
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="space-y-1 p-2">
                {colaboradores?.map((colab) => (
                  <button
                    key={colab.id}
                    onClick={() => setSelectedColaboradorId(colab.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                      selectedColaboradorId === colab.id
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={colab.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(colab.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{colab.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{colab.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detalhes do colaborador selecionado */}
        <div className="min-w-0 space-y-6 lg:col-span-3">
          {selectedColaborador ? (
            <>
              {/* Card do colaborador */}
              <Card className="bg-gradient-to-r from-card to-muted/30">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={selectedColaborador.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xl">
                        {getInitials(selectedColaborador.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-bold uppercase">{selectedColaborador.full_name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedColaborador.email}</p>
                    </div>
                  </div>

                  {/* Status do 13º atual */}
                  <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase">Salário Base</p>
                      <p className="text-xl font-bold">
                        {selectedColaborador.salario
                          ? formatCurrency(selectedColaborador.salario)
                          : "Não informado"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase">1ª Parcela</p>
                      {currentYearThirteenth ? (
                        getInstallmentBadge(currentYearThirteenth.first_installment_date)
                      ) : (
                        <Badge variant="outline">Não registrado</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase">2ª Parcela</p>
                      {currentYearThirteenth ? (
                        getInstallmentBadge(currentYearThirteenth.second_installment_date)
                      ) : (
                        <Badge variant="outline">Não registrado</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase">Status {currentYear}</p>
                      {currentYearThirteenth ? (
                        getStatusBadge(currentYearThirteenth.payment_status)
                      ) : (
                        <Badge variant="outline">Não registrado</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs de Férias e 13º */}
              <Tabs defaultValue="ferias">
                <TabsList>
                  <TabsTrigger value="ferias" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Histórico de Férias
                  </TabsTrigger>
                  <TabsTrigger value="decimo" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Histórico 13º Salário
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="ferias" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <History className="h-4 w-4" />
                      Histórico completo de férias
                    </div>
                    <Dialog open={isAddVacationOpen} onOpenChange={setIsAddVacationOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Registrar Férias
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Registrar Férias - {selectedColaborador.full_name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Ano</Label>
                            <Select
                              value={newVacation.year}
                              onValueChange={(v) => setNewVacation({ ...newVacation, year: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((year) => (
                                  <SelectItem key={year} value={year.toString()}>
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Data de Início</Label>
                            <Input
                              type="data"
                              value={newVacation.scheduled_date}
                              onChange={(e) => setNewVacation({ ...newVacation, scheduled_date: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Dias de Férias</Label>
                            <Input
                              type="number"
                              value={newVacation.total_vacation_days}
                              onChange={(e) => setNewVacation({ ...newVacation, total_vacation_days: e.target.value })}
                            />
                          </div>
                          <Button
                            onClick={() => addVacationMutation.mutate(newVacation)}
                            disabled={addVacationMutation.isPending}
                            className="w-full"
                          >
                            Registrar
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <Card>
                    <CardContent className="overflow-x-auto p-0">
                      <Table className="min-w-[720px]">

                        <TableHeader>
                          <TableRow>
                            <TableHead>Ano</TableHead>
                            <TableHead>Data Início</TableHead>
                            <TableHead>Dias</TableHead>
                            <TableHead>Valor Bruto</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vacationHistory?.map((vacation) => (
                            <TableRow key={vacation.id}>
                              <TableCell className="font-medium">{vacation.year}</TableCell>
                              <TableCell>
                                {vacation.scheduled_date
                                  ? format(new Date(vacation.scheduled_date), "dd/MM/yyyy", { locale: ptBR })
                                  : "-"}
                              </TableCell>
                              <TableCell>{vacation.total_vacation_days} dias</TableCell>
                              <TableCell>
                                {vacation.vacation_gross_value > 0
                                  ? formatCurrency(vacation.vacation_gross_value)
                                  : "-"}
                              </TableCell>
                              <TableCell>{getStatusBadge(vacation.payment_status)}</TableCell>
                              <TableCell>
                                <Select
                                  value={vacation.payment_status || "pendente"}
                                  onValueChange={(status) =>
                                    updateVacationStatus.mutate({ id: vacation.id, status })
                                  }
                                >
                                  <SelectTrigger className="w-32 h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pendente">Pendente</SelectItem>
                                    <SelectItem value="agendado">Agendado</SelectItem>
                                    <SelectItem value="em_ferias">Em Férias</SelectItem>
                                    <SelectItem value="pago">Pago</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!vacationHistory || vacationHistory.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Nenhum registro de férias encontrado
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="decimo" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <History className="h-4 w-4" />
                      Histórico completo de 13º salário
                    </div>
                    <Dialog open={isAddThirteenthOpen} onOpenChange={setIsAddThirteenthOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Registrar 13º
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Registrar 13º - {selectedColaborador.full_name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Ano</Label>
                            <Select
                              value={newThirteenth.year}
                              onValueChange={(v) => setNewThirteenth({ ...newThirteenth, year: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((year) => (
                                  <SelectItem key={year} value={year.toString()}>
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Valor Bruto (R$)</Label>
                            <Input
                              type="number"
                              value={newThirteenth.gross_value}
                              onChange={(e) => setNewThirteenth({ ...newThirteenth, gross_value: e.target.value })}
                              placeholder={selectedColaborador.salario?.toString() || "Ex: 5000.00"}
                            />
                          </div>
                          <Button
                            onClick={() => addThirteenthMutation.mutate(newThirteenth)}
                            disabled={!newThirteenth.gross_value || addThirteenthMutation.isPending}
                            className="w-full"
                          >
                            Registrar
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <Card>
                    <CardContent className="overflow-x-auto p-0">
                      <Table className="min-w-[720px]">

                        <TableHeader>
                          <TableRow>
                            <TableHead>Ano</TableHead>
                            <TableHead>Valor Bruto</TableHead>
                            <TableHead>1ª Parcela</TableHead>
                            <TableHead>2ª Parcela</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {thirteenthHistory?.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.year}</TableCell>
                              <TableCell>{formatCurrency(item.gross_value)}</TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="text-sm">{formatCurrency(item.first_installment_amount)}</p>
                                  {getInstallmentBadge(item.first_installment_date)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="text-sm">{formatCurrency(item.second_installment_amount)}</p>
                                  {getInstallmentBadge(item.second_installment_date)}
                                </div>
                              </TableCell>
                              <TableCell>{getStatusBadge(item.payment_status)}</TableCell>
                              <TableCell>
                                <Select
                                  value={item.payment_status || "pendente"}
                                  onValueChange={(status) =>
                                    updateThirteenthStatus.mutate({ id: item.id, status })
                                  }
                                >
                                  <SelectTrigger className="w-32 h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pendente">Pendente</SelectItem>
                                    <SelectItem value="parcial">Parcial</SelectItem>
                                    <SelectItem value="pago">Pago</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!thirteenthHistory || thirteenthHistory.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Nenhum registro de 13º salário encontrado
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card className="flex items-center justify-center h-[400px]">
              <CardContent className="text-center">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Selecione um colaborador</p>
                <p className="text-sm text-muted-foreground">
                  Escolha um colaborador na lista para ver a situação de férias e 13º salário
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
