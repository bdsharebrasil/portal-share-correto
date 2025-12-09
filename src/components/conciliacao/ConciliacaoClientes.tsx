import { useState, useEffect } from "react";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, Clock, Send, Users, Mail, Check, ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getShortUserId, getIdBadgeColor } from "@/lib/user-id";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { StatusUpdateDialog } from "./StatusUpdateDialog";

interface Client {
  id: string;
  company_name: string;
}

interface Aircraft {
  id: string;
  registration: string;
}

interface BankReconciliation {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  category: string | null;
  client_id: string | null;
  aircraft_id: string | null;
  payment_term: string | null;
  created_by?: string;
  clients: { company_name: string } | null;
  aircraft: { registration: string } | null;
}

const addDespesaSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  status: z.enum(["pendente", "recebido"]),
  payment_term: z.string().optional().nullable(),
});

type AddDespesaFormValues = z.infer<typeof addDespesaSchema>;

export function ConciliacaoClientes() {
  const [conciliacaoClientes, setConciliacaoClientes] = useState<BankReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const { toast } = useToast();
  const { roles, user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showNewReconciliationForm, setShowNewReconciliationForm] = useState(false);
  const [openStatusDialog, setOpenStatusDialog] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<BankReconciliation | null>(null);

  const canApproveStatus = roles.some(role => ['admin', 'gestor_master', 'financeiro_master'].includes(role));

  useEffect(() => {
    fetchReconciliations();
    loadClientsAndAircraft();
  }, [currentDate]);

  const loadClientsAndAircraft = async () => {
    try {
      const [clientsResponse, aircraftResponse] = await Promise.all([
        supabase.from("clients").select("id, company_name").order("company_name"),
        supabase.from("aircraft").select("id, registration").order("registration"),
      ]);

      if (clientsResponse.error) throw clientsResponse.error;
      if (aircraftResponse.error) throw aircraftResponse.error;

      setClients((clientsResponse.data || []) as Client[]);
      setAircraft((aircraftResponse.data || []) as Aircraft[]);
    } catch (error) {
      console.error("Erro ao carregar clientes e aeronaves:", error);
    }
  };

  const fetchReconciliations = async () => {
    try {
      setLoading(true);
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('bank_reconciliations')
        .select(`
          *,
          clients:client_id (company_name),
          aircraft:aircraft_id (registration)
        `)
        .eq('type', 'cliente' as any)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;
      setConciliacaoClientes((data || []) as any);
    } catch (error) {
      console.error('Erro ao buscar conciliações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados de conciliação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case "recebido":
        return <Badge className="bg-green-100 text-green-800">Recebido</Badge>;
      case "pendente":
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case "recebido":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "pendente":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const formatCategoryName = (category: string | null) => {
    if (!category) return '-';
    return category
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const reconciliation = conciliacaoClientes.find(item => item.id === id);
      if (!reconciliation) return;

      // Atualizar status na conciliação
      const { error } = await supabase
        .from('bank_reconciliations')
        .update({ status: newStatus } as any)
        .eq('id', id as any);

      if (error) throw error;

      // Se relacionado com relatório de viagem, sincronizar status
      if (reconciliation.description?.includes('RELATORIO DE VIAGEM')) {
        const reportNumberMatch = reconciliation.description.match(/RELATORIO DE VIAGEM - (.+?) - /);
        if (reportNumberMatch && reportNumberMatch[1]) {
          const reportNumber = reportNumberMatch[1];

          const { data: relatedReport } = await supabase
            .from('travel_expense_reports')
            .select('id')
            .eq('report_number', reportNumber as any)
            .eq('client_id', reconciliation.client_id as any)
            .maybeSingle();

          if (relatedReport) {
            let reportStatus = 'pendente';
            if (newStatus?.toLowerCase() === 'conferido') {
              reportStatus = 'pago';
            } else if (newStatus?.toLowerCase() === 'enviado') {
              reportStatus = 'enviado';
            }

            await supabase
              .from('travel_expense_reports')
              .update({ status: reportStatus } as any)
              .eq('id', (relatedReport as any).id as any);
          }
        }
      }

      setConciliacaoClientes(prev =>
        prev.map(item =>
          item.id === id ? { ...item, status: newStatus } : item
        )
      );

      toast({
        title: "Sucesso",
        description: `Status atualizado para ${newStatus}.`,
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    }
  };

  const handleAddDespesa = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const today = new Date();
  const isCurrentMonth = currentDate.getFullYear() === today.getFullYear() && currentDate.getMonth() === today.getMonth();

  const monthYear = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).charAt(0).toUpperCase() +
    currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).slice(1);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const resumoClientes = {
    totalRecebido: conciliacaoClientes
      .filter(item => item.status?.toLowerCase() === 'recebido')
      .reduce((sum, item) => sum + Number(item.amount), 0),
    totalPendente: conciliacaoClientes
      .filter(item => item.status?.toLowerCase() === 'pendente')
      .reduce((sum, item) => sum + Number(item.amount), 0),
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Mês */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={previousMonth}
            className="rounded-lg border-border/50 hover:bg-accent/50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-32 text-center">
            {monthYear}
            {isCurrentMonth && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-1 rounded-md font-medium">Atual</span>}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={nextMonth}
            className="rounded-lg border-border/50 hover:bg-accent/50"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Resumo Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Recebido</p>
                <p className="text-2xl font-bold text-green-500 mt-1">
                  {formatCurrency(resumoClientes.totalRecebido)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Pendente</p>
                <p className="text-2xl font-bold text-yellow-500 mt-1">
                  {formatCurrency(resumoClientes.totalPendente)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Conciliação Clientes */}
      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Conciliação com Clientes
            </CardTitle>
            <Button
              onClick={() => setShowNewReconciliationForm(!showNewReconciliationForm)}
              className="flex items-center gap-2 rounded-lg"
            >
              <Plus className="h-4 w-4" />
              Nova Conciliação
            </Button>
          </div>
        </CardHeader>
        {showNewReconciliationForm && (
          <CardContent className="py-4 bg-muted/30 rounded-lg mx-4 mb-4">
            <NewReconciliationInlineForm
              clients={clients}
              aircraft={aircraft}
              onClose={() => setShowNewReconciliationForm(false)}
              onSuccess={() => {
                setShowNewReconciliationForm(false);
                fetchReconciliations();
              }}
            />
          </CardContent>
        )}
        <CardContent>
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-cyan-500 scrollbar-track-slate-700/20">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Aeronave</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Prazo de Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : conciliacaoClientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nenhuma conciliação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  conciliacaoClientes.map((item) => (
                    <React.Fragment key={item.id}>
                      <TableRow className="hover:bg-muted/50">
                        <TableCell>{item.date ? format(new Date(item.date + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell>
                          <Badge className={`${getIdBadgeColor(getShortUserId(item.created_by || ''))} font-semibold`}>
                            {getShortUserId(item.created_by || '')}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(item.status)}
                            <span className="truncate">{item.description}</span>
                          </div>
                        </TableCell>
                        <TableCell>{item.clients?.company_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.aircraft?.registration || '-'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{formatCategoryName(item.category)}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-primary font-medium">
                            {formatCurrency(Math.abs(Number(item.amount)))}
                          </span>
                        </TableCell>
                        <TableCell>
                          {item.status?.toLowerCase() !== 'enviado' && item.status?.toLowerCase() !== 'conferido' ? (
                            <PaymentTermEditor
                              reconciliation={item}
                              onSave={fetchReconciliations}
                            />
                          ) : item.payment_term ? (
                            <span className="text-sm">{format(new Date(item.payment_term + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>
                          {item.status?.toLowerCase() !== 'recebido' ? (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedReconciliation(item);
                                  setOpenStatusDialog(true);
                                }}
                                title="Enviar por email"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Recebido</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedId === item.id && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={9} className="py-4">
                            <AddDespesaForm
                              parentReconciliation={item}
                              clients={clients}
                              aircraft={aircraft}
                              onClose={() => setExpandedId(null)}
                              onSuccess={fetchReconciliations}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedReconciliation && (
        <StatusUpdateDialog
          reconciliation={selectedReconciliation}
          open={openStatusDialog}
          onOpenChange={setOpenStatusDialog}
          onUpdate={fetchReconciliations}
        />
      )}
    </div>
  );
}

interface PaymentTermEditorProps {
  reconciliation: BankReconciliation;
  onSave: () => void;
}

function PaymentTermEditor({ reconciliation, onSave }: PaymentTermEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    reconciliation.payment_term ? new Date(reconciliation.payment_term) : undefined
  );
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!selectedDate) {
      toast({
        title: "Erro",
        description: "Selecione uma data.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Update bank_reconciliations
      const { error } = await supabase
        .from('bank_reconciliations')
        .update({ payment_term: dateStr } as any)
        .eq('id', reconciliation.id as any);

      if (error) {
        // If column doesn't exist, provide helpful message
        if (error.message?.includes('payment_term') || error.code === '42703') {
          throw new Error(
            'Campo "payment_term" não existe na tabela. Execute as migrações do Supabase: supabase db push'
          );
        }
        throw error;
      }

      // If this reconciliation is related to a travel report, also sync the payment_term back
      if (reconciliation.description?.includes('RELATORIO DE VIAGEM')) {
        // Extract report_number from description (format: "RELATORIO DE VIAGEM - {report_number} - STATUS PENDENTE")
        const reportNumberMatch = reconciliation.description.match(/RELATORIO DE VIAGEM - (.+?) - /);
        if (reportNumberMatch && reportNumberMatch[1]) {
          const reportNumber = reportNumberMatch[1];

          // Find and update the related travel_expense_report
          const { data: relatedReport } = await supabase
            .from('travel_expense_reports')
            .select('id')
            .eq('report_number', reportNumber as any)
            .eq('client_id', reconciliation.client_id as any)
            .maybeSingle();

          if (relatedReport) {
            await supabase
              .from('travel_expense_reports')
              .update({ payment_term: dateStr } as any)
              .eq('id', (relatedReport as any).id as any);
          }
        }
      }

      toast({
        title: "Sucesso",
        description: "Prazo de pagamento atualizado.",
      });
      setIsEditing(false);
      onSave();
    } catch (error: any) {
      console.error('Erro ao atualizar prazo:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar o prazo.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="text-sm hover:text-blue-600 hover:underline"
      >
        {reconciliation.payment_term ? (
          format(new Date(reconciliation.payment_term + 'T12:00:00'), 'dd/MM/yyyy')
        ) : (
          <span className="text-xs text-muted-foreground">Clique para adicionar</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="justify-start text-left font-normal w-32"
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-white" />
            {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecione"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
      <Button
        size="sm"
        onClick={handleSave}
        disabled={isSaving}
        className="h-8"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsEditing(false)}
        disabled={isSaving}
        className="h-8"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface AddDespesaFormProps {
  parentReconciliation: BankReconciliation;
  clients: Client[];
  aircraft: Aircraft[];
  onClose: () => void;
  onSuccess: () => void;
}

function AddDespesaForm({
  parentReconciliation,
  clients,
  aircraft,
  onClose,
  onSuccess,
}: AddDespesaFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<AddDespesaFormValues>({
    resolver: zodResolver(addDespesaSchema),
    defaultValues: {
      date: new Date().toLocaleDateString('en-CA'),
      description: "",
      amount: "",
      category: parentReconciliation.category || "",
      status: "pendente",
    },
  });

  const onSubmit = async (data: AddDespesaFormValues) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from("bank_reconciliations")
        .insert([{
          type: "cliente",
          date: data.date,
          description: data.description,
          amount: parseFloat(data.amount),
          category: data.category,
          status: data.status,
          client_id: parentReconciliation.client_id,
          aircraft_id: parentReconciliation.aircraft_id,
          created_by: user.id,
        }] as any);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Despesa adicionada com sucesso.",
      });

      form.reset();
      onClose();
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao adicionar despesa:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível adicionar a despesa.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Adicionar Nova Despesa</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Cliente: <strong>{parentReconciliation.clients?.company_name}</strong> | 
            Aeronave: <strong>{parentReconciliation.aircraft?.registration}</strong>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => {
                const dateValue = field.value ? new Date(field.value) : undefined;
                return (
                  <FormItem>
                    <FormLabel>Data *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-white" />
                          {dateValue ? format(dateValue, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateValue}
                          onSelect={(date) => {
                            if (date) {
                              field.onChange(format(date, "yyyy-MM-dd"));
                            }
                          }}
                          disabled={(date) => date > new Date()}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Combustível" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$) *</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: combustivel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="conferido">Conferido</SelectItem>
                      <SelectItem value="enviado">Enviado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Adicionando..." : "Adicionar Despesa"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

interface NewReconciliationInlineFormProps {
  clients: Client[];
  aircraft: Aircraft[];
  onClose: () => void;
  onSuccess: () => void;
}

const newReconciliationSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  status: z.enum(["pendente", "conferido", "enviado"]),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  aircraftId: z.string().min(1, "Aeronave é obrigatória"),
});

type NewReconciliationFormValues = z.infer<typeof newReconciliationSchema>;

function NewReconciliationInlineForm({
  clients,
  aircraft,
  onClose,
  onSuccess,
}: NewReconciliationInlineFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<NewReconciliationFormValues>({
    resolver: zodResolver(newReconciliationSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      description: "",
      amount: "",
      category: "",
      status: "pendente",
      clientId: "",
      aircraftId: "",
    },
  });

  const onSubmit = async (data: NewReconciliationFormValues) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from("bank_reconciliations")
        .insert([{
          type: "cliente",
          date: data.date,
          description: data.description,
          amount: parseFloat(data.amount),
          category: data.category,
          status: data.status,
          client_id: data.clientId,
          aircraft_id: data.aircraftId,
          created_by: user.id,
        }] as any);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Conciliação adicionada com sucesso.",
      });

      form.reset();
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao adicionar conciliação:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível adicionar a conciliação.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => {
              const dateValue = field.value ? new Date(field.value) : undefined;
              return (
                <FormItem>
                  <FormLabel className="text-xs">Data</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-9 w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-white" />
                        {dateValue ? format(dateValue, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateValue}
                        onSelect={(date) => {
                          if (date) {
                            field.onChange(format(date, "yyyy-MM-dd"));
                          }
                        }}
                        disabled={(date) => date > new Date()}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage className="text-xs" />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Descrição</FormLabel>
                <FormControl>
                  <Input placeholder="Descrição" {...field} className="h-9" />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Cliente</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Cliente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="aircraftId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Aeronave</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Aeronave" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {aircraft.map((ac) => (
                      <SelectItem key={ac.id} value={ac.id}>
                        {ac.registration}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Categoria</FormLabel>
                <FormControl>
                  <Input placeholder="Categoria" {...field} className="h-9" />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Valor (R$)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} className="h-9" />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="conferido">Conferido</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={submitting}
          >
            {submitting ? "Adicionando..." : "Adicionar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
