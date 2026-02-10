import { useState, useEffect } from "react";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, Clock, User, Mail, Check, ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, Lock } from "lucide-react";
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
import { syncBankReconciliationToFinancial } from "@/services/financialSyncClient";

// --- Interfaces ---
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

// --- Schemas ---
const addDespesaSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  status: z.enum(["pendente", "enviado", "pago"]),
});

type AddDespesaFormValues = z.infer<typeof addDespesaSchema>;

const newReconciliationSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  status: z.enum(["pendente", "enviado", "pago"]),
  receiverId: z.string().min(1, "Colaborador é obrigatório"),
});

type NewReconciliationFormValues = z.infer<typeof newReconciliationSchema>;

// --- Componente Principal ---
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

  // Permissão: Apenas Financeiro pode marcar como "Pago"
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
          user_profiles:receiver_id (full_name),
          categorias_movimentacao(grupo_categoria)
        `)
        .eq('type', 'colaborador' as any)
        .not('categorias_movimentacao.grupo_categoria', 'eq', 'RECEITAS OPERACIONAIS')
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
        return <Badge className="bg-green-100 text-green-800 border-green-200">Pago</Badge>;
      case "enviado":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Enviado</Badge>;
      case "pendente":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendente</Badge>;
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

      {/* Cards de Resumo */}
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

      {/* Tabela de Conciliação Colaborador */}
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
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-cyan-500 scrollbar-track-slate-700/20">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Prazo</TableHead>
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
                  colaboradorData.map((item) => {
                    // Verifica se já foi pago (status final)
                    const isFinalized = item.status?.toLowerCase() === 'pago';

                    return (
                      <React.Fragment key={item.id}>
                        <TableRow className={`hover:bg-muted/50 ${isFinalized ? 'bg-muted/10 opacity-80' : ''}`}>
                          <TableCell>{item.date ? format(new Date(item.date + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</TableCell>
                          <TableCell>
                            <Badge className={`${getIdBadgeColor(getShortUserId(item.created_by || ''))} font-semibold`}>
                              {getShortUserId(item.created_by || '')}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <span className="font-medium text-sm">{item.user_profiles?.full_name || '-'}</span>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(item.status)}
                              <span className="truncate" title={item.description}>{item.description}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`font-medium ${Number(item.amount) > 0 ? "text-green-600" : "text-red-600"}`}>
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
                          
                          {/* --- COLUNA DE AÇÕES COM LÓGICA DE ESPELHO --- */}
                          <TableCell>
                            {isFinalized ? (
                                // Modo Espelho: Só mostra que foi pago
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 text-green-600 border border-green-500/20 w-fit" title="Pago pelo Financeiro">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-bold uppercase tracking-wide">Pago</span>
                                </div>
                            ) : item.status?.toLowerCase() === 'enviado' ? (
                                // Modo Enviado: Mostra que foi enviado
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20 w-fit" title="Aguardando processamento">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-bold uppercase tracking-wide">Enviado</span>
                                </div>
                            ) : (
                                // Modo Ação: Permite Enviar
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedReconciliation(item);
                                    setOpenStatusDialog(true);
                                  }}
                                  className="h-8 border-dashed hover:border-solid hover:bg-primary/5 hover:text-primary transition-all"
                                  title="Enviar Solicitação"
                                >
                                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                                  <span className="text-xs">Enviar</span>
                                </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })
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

// --- Sub-componentes (Helpers) ---

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
      toast({ title: "Erro", description: "Selecione uma data.", variant: "destructive" });
      return;
    }

    try {
      setIsSaving(true);
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      const { error } = await supabase
        .from('bank_reconciliations')
        .update({ payment_term: dateStr } as any)
        .eq('id', reconciliation.id as any);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Prazo atualizado." });
      setIsEditing(false);
      onSave();
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao atualizar prazo.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <button onClick={() => setIsEditing(true)} className="text-sm hover:text-blue-600 hover:underline flex items-center gap-1">
        {reconciliation.payment_term ? format(new Date(reconciliation.payment_term + 'T12:00:00'), 'dd/MM/yyyy') : <span className="text-xs text-muted-foreground italic flex items-center gap-1"><Plus className="w-3 h-3"/>Prazo</span>}
      </button>
    );
  }

  return (
    <div className="flex gap-1 items-center z-50">
      <Input 
        type="date" 
        className="h-8 w-[130px] text-xs" 
        value={selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
        onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : undefined)}
      />
      <Button size="icon" className="h-8 w-8" onClick={handleSave} disabled={isSaving}><Check className="h-3 w-3" /></Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditing(false)}><X className="h-3 w-3" /></Button>
    </div>
  );
}

interface NewReconciliationInlineFormProps {
  users: UserProfile[];
  onClose: () => void;
  onSuccess: () => void;
}

function NewReconciliationInlineForm({ users, onClose, onSuccess }: NewReconciliationInlineFormProps) {
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
    if (!user) return;
    try {
      setSubmitting(true);
      if (!data.receiverId) throw new Error("Colaborador deve ser selecionado.");

      // Validação Extra
      const { data: receiverExists, error: checkError } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .eq("id", data.receiverId as any)
        .eq("employment_status", "ativo" as any)
        .single();

      if (checkError || !receiverExists) {
        throw new Error("Colaborador inválido ou inativo.");
      }

      const { data: inserted, error } = await supabase.from("bank_reconciliations").insert([{
          type: "colaborador",
          date: data.date,
          description: data.description,
          amount: parseFloat(data.amount),
          status: data.status,
          receiver_id: data.receiverId,
          created_by: user.id,
        }] as any)
        .select()
        .single();

      if (error) throw error;

      // Sincronizar com controle_bancario
      if (inserted?.id) {
        await syncBankReconciliationToFinancial(inserted.id, user.id);
      }

      toast({ title: "Sucesso", description: "Conciliação criada." });
      form.reset();
      onSuccess();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
             <FormField control={form.control} name="date" render={({field}) => (
                 <FormItem><FormControl><Input type="date" {...field} className="h-9" /></FormControl></FormItem>
             )} />
             <FormField control={form.control} name="receiverId" render={({field}) => (
                 <FormItem>
                     <Select value={field.value} onValueChange={field.onChange}>
                         <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Colaborador" /></SelectTrigger></FormControl>
                         <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
                     </Select>
                 </FormItem>
             )} />
             <FormField control={form.control} name="description" render={({field}) => (
                 <FormItem><FormControl><Input placeholder="Descrição" {...field} className="h-9" /></FormControl></FormItem>
             )} />
             <FormField control={form.control} name="amount" render={({field}) => (
                 <FormItem><FormControl><Input type="number" placeholder="Valor" {...field} className="h-9" /></FormControl></FormItem>
             )} />
             <FormField control={form.control} name="status" render={({field}) => (
                 <FormItem>
                     <Select value={field.value} onValueChange={field.onChange}>
                         <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                         <SelectContent>
                             <SelectItem value="pendente">Pendente</SelectItem>
                             <SelectItem value="enviado">Enviado</SelectItem>
                         </SelectContent>
                     </Select>
                 </FormItem>
             )} />
        </div>
        <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={submitting}>Salvar</Button>
        </div>
      </form>
    </Form>
  );
}
