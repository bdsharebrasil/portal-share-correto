import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Loader2, 
  FileText, 
  Plane,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Download,
  User
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRateios } from "@/hooks/useRateio";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ExtratoClienteTab() {
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [selectedAeronave, setSelectedAeronave] = useState<string>("all");

  // Get list of clients
  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, proprietario")
        .order("company_name");
      if (error) throw error;
      return data;
    },
  });

  // Get client's aircraft
  const { data: clientAircraft } = useQuery({
    queryKey: ["client-aircraft-list", selectedClient],
    queryFn: async () => {
      if (!selectedClient) return [];
      const { data, error } = await supabase
        .from("client_aircraft")
        .select(`
          aircraft_id,
          share_percentage,
          aircraft (
            id,
            registration,
            model
          )
        `)
        .eq("client_id", selectedClient);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient,
  });

  // Parse selected month
  const dateRange = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    };
  }, [selectedMonth]);

  // Get rateios for selected client and month
  const { data: rateios, isLoading } = useRateios({
    clientId: selectedClient || undefined,
    aeronaveId: selectedAeronave !== "all" ? selectedAeronave : undefined,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      months.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy", { locale: ptBR }),
      });
    }
    return months;
  }, []);

  // Calculate totals
  const totals = useMemo(() => {
    if (!rateios) return { devido: 0, pago: 0, pendente: 0 };
    
    const resultado = rateios.reduce((acc, r) => ({
      devido: acc.devido + Number(r.valor_rateado),
      pago: acc.pago + Number(r.valor_pago || 0),
    }), { devido: 0, pago: 0 });

    return {
      ...resultado,
      pendente: resultado.devido - resultado.pago,
    };
  }, [rateios]);

  // Group by category
  const byCategory = useMemo(() => {
    if (!rateios) return [];
    
    const groups = new Map<string, { nome: string; grupo: string; total: number; pago: number }>();
    
    rateios.forEach(r => {
      const key = r.despesa.categoria_nome || "Sem categoria";
      const grupo = r.despesa.grupo_categoria || "Outros";
      
      if (!groups.has(key)) {
        groups.set(key, { nome: key, grupo, total: 0, pago: 0 });
      }
      const entry = groups.get(key)!;
      entry.total += Number(r.valor_rateado);
      entry.pago += Number(r.valor_pago || 0);
    });

    return Array.from(groups.values()).sort((a, b) => b.total - a.total);
  }, [rateios]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "pago":
        return <Badge className="bg-green-500/20 text-green-400 border-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Pago</Badge>;
      case "parcial":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-600">Parcial</Badge>;
      default:
        return <Badge className="bg-red-500/20 text-red-400 border-red-600"><AlertCircle className="w-3 h-3 mr-1" /> Pendente</Badge>;
    }
  };

  const selectedClientData = clients?.find(c => c.id === selectedClient);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Extrato Mensal do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Cliente</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name || c.proprietario}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Mês</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Aeronave</label>
              <Select value={selectedAeronave} onValueChange={setSelectedAeronave}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Aeronaves</SelectItem>
                  {clientAircraft?.map((ca: any) => (
                    <SelectItem key={ca.aircraft_id} value={ca.aircraft_id}>
                      {ca.aircraft?.registration} - {ca.aircraft?.model} ({ca.share_percentage}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedClient ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Selecione um cliente para ver o extrato</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Client Header */}
          <Card className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-gray-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedClientData?.company_name || selectedClientData?.proprietario}
                  </h2>
                  <p className="text-gray-400 mt-1">
                    Extrato de {format(parseISO(dateRange.start), "MMMM yyyy", { locale: ptBR })}
                  </p>
                  {clientAircraft && clientAircraft.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {clientAircraft.map((ca: any) => (
                        <Badge key={ca.aircraft_id} variant="outline" className="border-blue-600 text-blue-400">
                          <Plane className="w-3 h-3 mr-1" />
                          {ca.aircraft?.registration} ({ca.share_percentage}%)
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  Exportar PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <DollarSign className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total do Período</p>
                    <p className="text-xl font-bold text-white">{formatCurrency(totals.devido)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total Pago</p>
                    <p className="text-xl font-bold text-green-400">{formatCurrency(totals.pago)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Saldo Pendente</p>
                    <p className="text-xl font-bold text-red-400">{formatCurrency(totals.pendente)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* By Category Summary */}
          {byCategory.length > 0 && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Resumo por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {byCategory.map((cat) => (
                    <div key={cat.nome} className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-xs text-gray-500">{cat.grupo}</p>
                          <p className="font-medium text-white">{cat.nome}</p>
                        </div>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Total:</span>
                          <span className="text-white">{formatCurrency(cat.total)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Pago:</span>
                          <span className="text-green-400">{formatCurrency(cat.pago)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Table */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Detalhamento das Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Data</TableHead>
                    <TableHead className="text-gray-300">Descrição</TableHead>
                    <TableHead className="text-gray-300">Categoria</TableHead>
                    <TableHead className="text-gray-300">Aeronave</TableHead>
                    <TableHead className="text-gray-300">%</TableHead>
                    <TableHead className="text-gray-300">Valor</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rateios?.map((r) => (
                    <TableRow key={r.id} className="border-gray-700">
                      <TableCell className="text-gray-300">
                        {format(parseISO(r.despesa.data), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-white">{r.despesa.descricao}</TableCell>
                      <TableCell className="text-gray-300">
                        <div className="text-xs">
                          {r.despesa.grupo_categoria && (
                            <span className="text-gray-500">{r.despesa.grupo_categoria} / </span>
                          )}
                          {r.despesa.categoria_nome}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-blue-600 text-blue-400">
                          {r.aeronave_registro || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-300">{r.percentual}%</TableCell>
                      <TableCell className="text-white font-medium">
                        {formatCurrency(r.valor_rateado)}
                      </TableCell>
                      <TableCell>{getStatusBadge(r.status)}</TableCell>
                    </TableRow>
                  ))}
                  {(!rateios || rateios.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                        Nenhuma despesa encontrada para este período
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
