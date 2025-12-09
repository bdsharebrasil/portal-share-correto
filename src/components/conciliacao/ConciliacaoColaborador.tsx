import { useState, useEffect } from "react";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, Clock, User, Mail, Check, ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon } from "lucide-react";
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

interface ColaboradorReconciliation {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  category: string | null;
  receiver_id?: string | null;
  payment_term: string | null;
  created_by?: string;
  user_profiles?: { full_name: string } | null;
}

interface UserProfile {
  id: string;
  full_name: string;
}

const addDespesaSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  status: z.enum(["pendente", "enviado", "pago"]),
});

type AddDespesaFormValues = z.infer<typeof addDespesaSchema>;

export function ConciliacaoColaborador() {
  const [colaboradorData, setColaboradorData] = useState<ColaboradorReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const { toast } = useToast();
  const { roles, user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showNewReconciliationForm, setShowNewReconciliationForm] = useState(false);
  const [openStatusDialog, setOpenStatusDialog] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<ColaboradorReconciliation | null>(null);

  const canApprovePaid = roles.some(role => ['admin', 'gestor_master', 'financeiro_master'].includes(role));

  useEffect(() => {
    fetchReconciliations();
    loadUsers();
  }, [currentDate]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, employment_status")
        .eq("employment_status", "ativo" as any)
        .order("full_name");

      if (error) throw error;
      setUsers((data || []) as any);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
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
          user_profiles:receiver_id (full_name)
        `)
        .eq('type', 'colaborador' as any)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;
      setColaboradorData((data || []) as any);
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

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const reconciliation = colaboradorData.find(item => item.id === id);
      if (!reconciliation) return;

      const { error } = await supabase
        .from('bank_reconciliations')
        .update({ status: newStatus } as any)
        .eq('id', id as any);

      if (error) throw error;

      // Se status é "pago", criar saída no fluxo de caixa
      if (newStatus?.toLowerCase() === 'pago') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Verificar se já existe uma entrada no fluxo de caixa para essa conciliação
          const { data: existingEntry } = await supabase
            .from('controle_bancario')
            .select('id')
            .eq('referencia', `SAL-${reconciliation.id}` as any)
            .maybeSingle();

          if (!existingEntry) {
            const { error: insertError } = await supabase
              .from('controle_bancario')
              .insert({
                data: reconciliation.date,
                tipo_movimento: 'saída',
                categoria: reconciliation.category || 'Reembolso Colaborador',
                descricao: reconciliation.description,
                valor: reconciliation.amount,
                referencia: `SAL-${reconciliation.id}`,
                status: 'confirmado',
                criado_por: user.id,
                observacoes: `Pagamento ao colaborador - ${reconciliation.user_profiles?.full_name || 'N/A'}`
              } as any);

            if (insertError) {
              console.error('Erro ao criar saída no fluxo de caixa:', insertError);
            }
          }
        }
      }

      setColaboradorData(prev =>
        prev.map(item =>
          item.id === id ? { ...item, status: newStatus } : item
        )
      );

      const statusLabel = newStatus === 'enviado' ? 'Enviado' : 'Pago';
      toast({
        title: "Sucesso",
        description: `Status atualizado para ${statusLabel}. Saída no Fluxo de Caixa criada.`,
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

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case "pago":
        return <Badge className="bg-green-100 text-green-800">Pago</Badge>;
      case "enviado":
        return <Badge className="bg-blue-100 text-blue-800">Enviado</Badge>;
      case "pendente":
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case "pago":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "enviado":
        return <Mail className="h-4 w-4 text-blue-600" />;
      case "pendente":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const resumoColaborador = {
    totalPago: colaboradorData
      .filter(item => item.status?.toLowerCase() === 'pago')
      .reduce((sum, item) => sum + Number(item.amount), 0),
    totalEnviado: colaboradorData
      .filter(item => item.status?.toLowerCase() === 'enviado')
      .reduce((sum, item) => sum + Number(item.amount), 0),
    totalPendente: colaboradorData
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

      {/* Resumo Colaborador */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Pago</p>
                <p className="text-2xl font-bold text-green-500 mt-1">
                  {formatCurrency(resumoColaborador.totalPago)}
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
                <p className="text-sm text-muted-foreground font-medium">Total Enviado</p>
                <p className="text-2xl font-bold text-blue-500 mt-1">
                  {formatCurrency(resumoColaborador.totalEnviado)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-blue-500" />
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
                  {formatCurrency(resumoColaborador.totalPendente)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Movimentações Colaborador */}
      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Conciliação com Colaborador
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
          <CardContent className="py-4 bg-muted/30">
            <NewReconciliationInlineForm
              users={users}
              onClose={() => setShowNewReconciliationForm(false)}
              onSuccess={() => {
                setShowNewReconciliationForm(false);
                fetchReconciliations();
              }}
            />
          </CardContent>
        )}
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Prazo de Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : colaboradorData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma movimentação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                colaboradorData.map((item) => (
                  <React.Fragment key={item.id}>
                    <TableRow className="hover:bg-muted/50">
                      <TableCell>{item.date ? format(new Date(item.date + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</TableCell>
                      <TableCell>
                        <Badge className={`${getIdBadgeColor(getShortUserId(item.created_by || ''))} font-semibold`}>
                          {getShortUserId(item.created_by || '')}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="font-medium">{item.user_profiles?.full_name || '-'}</span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item.status)}
                          <span className="truncate">{item.description}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={Number(item.amount) > 0 ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(Number(item.amount))}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.status?.toLowerCase() !== 'enviado' && item.status?.toLowerCase() !== 'pago' ? (
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
                      <TableCell>
                        {getStatusBadge(item.status)}
                      </TableCell>
                      <TableCell>
                        {item.status?.toLowerCase() !== 'pago' ? (
                          <div className="flex gap-2">
                            {item.status?.toLowerCase() !== 'enviado' && (
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
                            )}
                            {canApprovePaid && item.status?.toLowerCase() !== 'pago' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedReconciliation(item);
                                  setOpenStatusDialog(true);
                                }}
                                title="Marcar como Pago"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Finalizado</span>
                        )}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

interface PaymentTermEditorProps {
  reconciliation: ColaboradorReconciliation;
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
  parentReconciliation: ColaboradorReconciliation;
  users: UserProfile[];
  onClose: () => void;
  onSuccess: () => void;
}

function AddDespesaForm({
  parentReconciliation,
  users,
  onClose,
  onSuccess,
}: AddDespesaFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<AddDespesaFormValues>({
    resolver: zodResolver(addDespesaSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      description: "",
      amount: "",
      status: "pendente",
    },
  });

  const receiverName = users.find(u => u.id === parentReconciliation.receiver_id)?.full_name ||
    parentReconciliation.user_profiles?.full_name ||
    "Colaborador";

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

      if (!parentReconciliation.receiver_id) {
        throw new Error("Colaborador não identificado.");
      }

      // Validar que o receiver_id ainda existe em user_profiles e está ativo
      const { data: receiverExists, error: checkError } = await supabase
        .from("user_profiles")
        .select("id, full_name, employment_status")
        .eq("id", parentReconciliation.receiver_id as any)
        .eq("employment_status", "ativo" as any)
        .single();

      if (checkError || !receiverExists) {
        throw new Error(
          "Colaborador associado está inativo ou foi removido. Não é possível adicionar despesa. Por favor, tente criar uma nova conciliação com um colaborador ativo."
        );
      }

      const { error } = await supabase
        .from("bank_reconciliations")
        .insert([{
          type: "colaborador",
          date: data.date,
          description: data.description,
          amount: parseFloat(data.amount),
          status: data.status,
          receiver_id: parentReconciliation.receiver_id,
          created_by: user.id,
        }] as any);

      if (error) {
        if (error.message?.includes("user_profiles")) {
          throw new Error(
            "Colaborador associado não existe mais. Por favor, tente criar uma nova conciliação."
          );
        }
        throw error;
      }

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
            Colaborador: <strong>{receiverName}</strong>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <Input placeholder="Ex: Reembolso" {...field} />
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
                      <SelectItem value="enviado">Enviado</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
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
  users: UserProfile[];
  onClose: () => void;
  onSuccess: () => void;
}

const newReconciliationSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  status: z.enum(["pendente", "enviado", "pago"]),
  receiverId: z.string().min(1, "Colaborador é obrigatório"),
});

type NewReconciliationFormValues = z.infer<typeof newReconciliationSchema>;

function NewReconciliationInlineForm({
  users,
  onClose,
  onSuccess,
}: NewReconciliationInlineFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<NewReconciliationFormValues>({
    resolver: zodResolver(newReconciliationSchema),
    defaultValues: {
      date: new Date().toLocaleDateString('en-CA'),
      description: "",
      amount: "",
      status: "pendente",
      receiverId: "",
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

      if (!data.receiverId) {
        throw new Error("Colaborador deve ser selecionado.");
      }

      // Validar que o receiver_id existe em user_profiles e está ativo
      const { data: receiverExists, error: checkError } = await supabase
        .from("user_profiles")
        .select("id, full_name, employment_status")
        .eq("id", data.receiverId as any)
        .eq("employment_status", "ativo" as any)
        .single();

      if (checkError || !receiverExists) {
        throw new Error(
          "Colaborador selecionado não existe, está inativo ou você não tem permissão para acessá-lo. Selecione um colaborador ativo da lista."
        );
      }

      const { error } = await supabase
        .from("bank_reconciliations")
        .insert([{
          type: "colaborador",
          date: data.date,
          description: data.description,
          amount: parseFloat(data.amount),
          status: data.status,
          receiver_id: data.receiverId,
          created_by: user.id,
        }] as any);

      if (error) {
        if (error.message?.includes("user_profiles")) {
          throw new Error(
            "Colaborador selecionado não existe. Por favor, selecione um colaborador válido da lista."
          );
        }
        throw error;
      }

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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
            name="receiverId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Colaborador</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Colaborador" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
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
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
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
