import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Search, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  DollarSign,
  Users,
  Plane,
  FileText,
  Upload
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useRateios, useReembolsosPendentes, useUpdateRateioPagamento } from "@/hooks/useRateio";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function RateioTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [selectedRateio, setSelectedRateio] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: rateios, isLoading } = useRateios();
  const { data: pendentes } = useReembolsosPendentes();
  const updatePagamento = useUpdateRateioPagamento();

  // Get unique clients from rateios
  const clients = useMemo(() => {
    const unique = new Map<string, string>();
    rateios?.forEach(r => {
      if (r.client_name) {
        unique.set(r.client_name, r.client_id || '');
      }
    });
    return Array.from(unique.entries()).map(([name, id]) => ({ name, id }));
  }, [rateios]);

  // Filter rateios
  const filteredRateios = useMemo(() => {
    return rateios?.filter(r => {
      const matchesSearch = 
        r.despesa.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.client_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "all" || r.status === filterStatus;
      const matchesClient = filterClient === "all" || r.client_name === filterClient;
      return matchesSearch && matchesStatus && matchesClient;
    }) || [];
  }, [rateios, searchTerm, filterStatus, filterClient]);

  // Calculate totals
  const totals = useMemo(() => {
    const total = filteredRateios.reduce((acc, r) => ({
      devido: acc.devido + Number(r.valor_rateado),
      pago: acc.pago + Number(r.valor_pago || 0),
    }), { devido: 0, pago: 0 });
    return { ...total, pendente: total.devido - total.pago };
  }, [filteredRateios]);

  const handleConfirmPayment = async () => {
    if (!selectedRateio || !paymentAmount) return;

    await updatePagamento.mutateAsync({
      id: selectedRateio.id,
      valorPago: parseFloat(paymentAmount.replace(",", ".")),
      dataPagamento: paymentDate,
    });

    setPaymentDialogOpen(false);
    setSelectedRateio(null);
    setPaymentAmount("");
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "pago":
        return <Badge className="bg-green-500/20 text-green-400 border-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Pago</Badge>;
      case "parcial":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-600"><Clock className="w-3 h-3 mr-1" /> Parcial</Badge>;
      default:
        return <Badge className="bg-red-500/20 text-red-400 border-red-600"><AlertCircle className="w-3 h-3 mr-1" /> Pendente</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Devido</p>
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
                <p className="text-sm text-gray-400">Pendente</p>
                <p className="text-xl font-bold text-red-400">{formatCurrency(totals.pendente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Users className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Clientes Pendentes</p>
                <p className="text-xl font-bold text-white">{pendentes?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending by Client */}
      {pendentes && pendentes.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              Reembolsos Pendentes por Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendentes.slice(0, 6).map((p) => (
                <div key={p.clientName} className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-white truncate">{p.clientName}</h4>
                    <Badge variant="outline" className="text-red-400 border-red-600">
                      {p.count} itens
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total:</span>
                      <span className="text-white">{formatCurrency(p.totalDevido)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Pago:</span>
                      <span className="text-green-400">{formatCurrency(p.totalPago)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-gray-400">Pendente:</span>
                      <span className="text-red-400">{formatCurrency(p.pendente)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por descrição ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-700 border-gray-600 text-white"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Clientes</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rateio Table */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Lista de Rateios</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-300">Data</TableHead>
                <TableHead className="text-gray-300">Descrição</TableHead>
                <TableHead className="text-gray-300">Categoria</TableHead>
                <TableHead className="text-gray-300">Aeronave</TableHead>
                <TableHead className="text-gray-300">Cliente</TableHead>
                <TableHead className="text-gray-300">%</TableHead>
                <TableHead className="text-gray-300">Valor Devido</TableHead>
                <TableHead className="text-gray-300">Valor Pago</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRateios.map((rateio) => (
                <TableRow key={rateio.id} className="border-gray-700">
                  <TableCell className="text-gray-300">
                    {format(parseISO(rateio.despesa.data), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-white font-medium max-w-[200px] truncate">
                    {rateio.despesa.descricao}
                  </TableCell>
                  <TableCell className="text-gray-300">
                    <div className="text-xs">
                      {rateio.despesa.grupo_categoria && (
                        <span className="text-muted-foreground">{rateio.despesa.grupo_categoria} / </span>
                      )}
                      {rateio.despesa.categoria_nome}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    <Badge variant="outline" className="border-blue-600 text-blue-400">
                      <Plane className="w-3 h-3 mr-1" />
                      {rateio.aeronave_registro || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white">{rateio.client_name}</TableCell>
                  <TableCell className="text-gray-300">{rateio.percentual}%</TableCell>
                  <TableCell className="text-white font-medium">
                    {formatCurrency(rateio.valor_rateado)}
                  </TableCell>
                  <TableCell className="text-green-400">
                    {formatCurrency(Number(rateio.valor_pago) || 0)}
                  </TableCell>
                  <TableCell>{getStatusBadge(rateio.status)}</TableCell>
                  <TableCell>
                    {rateio.status !== "pago" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-green-900/20 border-green-700 text-green-400 hover:bg-green-900/40"
                        onClick={() => {
                          setSelectedRateio(rateio);
                          setPaymentAmount("");
                          setPaymentDialogOpen(true);
                        }}
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        Pagar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredRateios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-gray-400 py-8">
                    Nenhum rateio encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          {selectedRateio && (
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg space-y-2">
                <p><strong>Cliente:</strong> {selectedRateio.client_name}</p>
                <p><strong>Descrição:</strong> {selectedRateio.despesa.descricao}</p>
                <p><strong>Valor Total:</strong> {formatCurrency(selectedRateio.valor_rateado)}</p>
                <p><strong>Já Pago:</strong> {formatCurrency(Number(selectedRateio.valor_pago) || 0)}</p>
                <p className="text-red-400">
                  <strong>Pendente:</strong> {formatCurrency(selectedRateio.valor_rateado - (Number(selectedRateio.valor_pago) || 0))}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">Valor do Pagamento</label>
                <Input
                  placeholder="0,00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="bg-gray-800 border-gray-600"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">Data do Pagamento</label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="bg-gray-800 border-gray-600"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPaymentDialogOpen(false)}
                  className="border-gray-600"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmPayment}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={updatePagamento.isPending}
                >
                  {updatePagamento.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Confirmar Pagamento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
