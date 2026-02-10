import { useState, useEffect } from "react";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, Clock, Send, Users, Mail, Check, ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, Plane } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Select as GroupedSelect,
  SelectContent as GroupedSelectContent,
  SelectItem as GroupedSelectItem,
  SelectLabel,
  SelectTrigger as GroupedSelectTrigger,
  SelectValue as GroupedSelectValue,
  SelectGroup,
} from "@/components/ui/grouped-select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { getShortUserId, getIdBadgeColor } from "@/lib/user-id";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useGroupedCategories } from "@/hooks/useGroupedCategories";
import { StatusUpdateDialog } from "./StatusUpdateDialog";
import { AddBankReconciliationForm } from "./AddBankReconciliationForm";
import { syncBankReconciliationToFinancial } from "@/services/financialSyncClient";

// --- Interfaces ---
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

// --- Schemas ---
const addDespesaSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  status: z.enum(["pendente", "enviado", "recebido"]),
  payment_term: z.string().optional().nullable(),
});

type AddDespesaFormValues = z.infer<typeof addDespesaSchema>;


// --- Componente Principal ---
export function ConciliacaoClientes() {
  const [conciliacaoClientes, setConciliacaoClientes] = useState<BankReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const { toast } = useToast();
  const { roles, user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  // Removed dialog state - now using inline form
  const [openStatusDialog, setOpenStatusDialog] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<BankReconciliation | null>(null);
  
  // Filtro de Viagens/Ressarcimentos
  const [showTravelDebtsOnly, setShowTravelDebtsOnly] = useState(false);

  // Permissão: Apenas Financeiro pode dar "Baixa" (status Recebido)
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
          aircraft:aircraft_id (registration),
          categorias_movimentacao(grupo_categoria)
        `)
        .eq('type', 'cliente' as any)
        .not('categorias_movimentacao.grupo_categoria', 'eq', 'RECEITAS OPERACIONAIS')
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
        return <Badge className="bg-green-100 text-green-800 border-green-200">Recebido</Badge>;
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
      case "recebido":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "enviado":
        return <Send className="h-4 w-4 text-blue-600" />;
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
    totalEnviado: conciliacaoClientes
      .filter(item => item.status?.toLowerCase() === 'enviado')
      .reduce((sum, item) => sum + Number(item.amount), 0),
    totalPendente: conciliacaoClientes
      .filter(item => item.status?.toLowerCase() === 'pendente')
      .reduce((sum, item) => sum + Number(item.amount), 0),
  };

  // --- Lógica de Filtro ---
  const filteredData = showTravelDebtsOnly 
    ? conciliacaoClientes.filter(item => {
        const isDebt = item.status?.toLowerCase() !== 'recebido'; // Ainda não recebido
        // Verifica palavras chaves de viagem e reembolso
        const textToSearch = (item.category || '') + ' ' + (item.description || '');
        const keywords = ['viagem', 'reembolso', 'ressarcimento', 'combustivel', 'relatorio', 'hospedagem', 'alimentacao'];
        const isTravelRelated = keywords.some(key => textToSearch.toLowerCase().includes(key));
        
        return isDebt && isTravelRelated;
      })
    : conciliacaoClientes;

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
                <p className="text-sm text-muted-foreground font-medium">Total Enviado</p>
                <p className="text-2xl font-bold text-blue-500 mt-1">
                  {formatCurrency(resumoClientes.totalEnviado)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Send className="h-6 w-6 text-blue-500" />
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

      {/* Tabela de Conciliação */}
      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Conciliação com Clientes
            </CardTitle>
            
            <div className="flex gap-2 w-full md:w-auto">
                {/* Botão de Filtro de Viagens */}
                <Button 
                    variant={showTravelDebtsOnly ? "default" : "outline"}
                    onClick={() => setShowTravelDebtsOnly(!showTravelDebtsOnly)}
                    className={`flex-1 md:flex-none items-center gap-2 rounded-lg ${showTravelDebtsOnly ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`}
                >
                    <Plane className="h-4 w-4" />
                    {showTravelDebtsOnly ? "Filtrando Viagens" : "Filtrar Viagens"}
                </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Formulário Inline para Nova Conciliação */}
          <div className="mb-6">
            <AddBankReconciliationForm
              onSuccess={() => {
                fetchReconciliations();
              }}
            />
          </div>
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
                  <TableHead>Prazo</TableHead>
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
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {showTravelDebtsOnly 
                        ? "Nenhuma despesa de viagem encontrada para este período." 
                        : "Nenhuma conciliação encontrada"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item) => {
                    // Verifica se o Financeiro já deu baixa
                    const isFinalized = item.status?.toLowerCase() === 'recebido';
                    
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
                              <div className="flex items-center gap-2">
                                {getStatusIcon(item.status)}
                                <span className="truncate" title={item.description}>{item.description}</span>
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
                              {item.status?.toLowerCase() === 'pendente' ? (
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
                            
                            {/* --- COLUNA DE AÇÕES COM LÓGICA DE ESPELHO --- */}
                            <TableCell>
                              {isFinalized ? (
                                // Modo Espelho: Só mostra que foi concluído
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 text-green-600 border border-green-500/20 w-fit" title="Baixa realizada pelo Financeiro">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-bold uppercase tracking-wide">Concluído</span>
                                </div>
                              ) : item.status?.toLowerCase() === 'enviado' ? (
                                // Modo Enviado: Mostra que foi enviado para financeiro
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20 w-fit" title="Aguardando recebimento">
                                    <Send className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-bold uppercase tracking-wide">Enviado</span>
                                </div>
                              ) : (
                                // Modo Ação: Permite editar status (Enviar)
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedReconciliation(item);
                                    setOpenStatusDialog(true);
                                  }}
                                  className="h-8 border-dashed hover:border-solid hover:bg-primary/5 hover:text-primary transition-all"
                                  title="Enviar para Financeiro"
                                >
                                  <Send className="h-3.5 w-3.5 mr-1.5" />
                                  <span className="text-xs">Enviar</span>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          
                          {/* Permite abrir formulário de edição apenas se não estiver finalizado */}
                          {expandedId === item.id && !isFinalized && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={10} className="py-4">
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
  reconciliation: BankReconciliation;
  onSave: () => void;
}

function PaymentTermEditor({ reconciliation, onSave }: PaymentTermEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  
  // Parse date correctly to avoid timezone issues
  const parseLocalDate = (dateStr: string | null | undefined): Date | undefined => {
    if (!dateStr) return undefined;
    // Add T12:00:00 to avoid timezone shift issues
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    parseLocalDate(reconciliation.payment_term)
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
      // Format date correctly using local date components
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const { error } = await supabase
        .from('bank_reconciliations')
        .update({ payment_term: dateStr } as any)
        .eq('id', reconciliation.id as any);

      if (error) throw error;

      // Sincronizar com travel_expense_reports se aplicável
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
            await supabase
              .from('travel_expense_reports')
              .update({ payment_term: dateStr } as any)
              .eq('id', (relatedReport as any).id as any);
          }
        }
      }

      toast({ title: "Sucesso", description: "Prazo atualizado." });
      setIsEditing(false);
      onSave();
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao atualizar prazo.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Format date for display
  const formatDateForDisplay = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  };
  
  // Format date for input value
  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Handle input change - parse without timezone issues
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      const [year, month, day] = value.split('-').map(Number);
      setSelectedDate(new Date(year, month - 1, day));
    } else {
      setSelectedDate(undefined);
    }
  };

  if (!isEditing) {
    return (
      <button onClick={() => setIsEditing(true)} className="text-sm hover:text-blue-600 hover:underline flex items-center gap-1">
        {reconciliation.payment_term ? formatDateForDisplay(reconciliation.payment_term) : <span className="text-xs text-muted-foreground italic flex items-center gap-1"><Plus className="w-3 h-3"/>Prazo</span>}
      </button>
    );
  }

  return (
    <div className="flex gap-1 items-center z-50">
      <Input 
        type="date" 
        className="h-8 w-[130px] text-xs" 
        value={formatDateForInput(selectedDate)}
        onChange={handleDateChange}
      />
      <Button size="icon" className="h-8 w-8" onClick={handleSave} disabled={isSaving}><Check className="h-3 w-3" /></Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditing(false)}><X className="h-3 w-3" /></Button>
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

function AddDespesaForm({ parentReconciliation, clients, aircraft, onClose, onSuccess }: AddDespesaFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const groupedCategories = useGroupedCategories("despesa", true);

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
    if (!user) return;
    try {
      setSubmitting(true);
      
      const { data: inserted, error } = await supabase.from("bank_reconciliations").insert([{
          type: "cliente",
          date: data.date,
          description: data.description,
          amount: parseFloat(data.amount),
          category: data.category,
          status: data.status,
          client_id: parentReconciliation.client_id,
          aircraft_id: parentReconciliation.aircraft_id,
          created_by: user.id,
        }] as any)
        .select()
        .single();

      if (error) throw error;

      // Criar conta a receber para gestão fiscal
      if (parentReconciliation.client_id && inserted) {
        try {
          const { data: clientData } = await supabase
            .from("clients")
            .select("company_name, cnpj")
            .eq("id", parentReconciliation.client_id)
            .single();

          let aircraftRegistration = "";
          if (parentReconciliation.aircraft_id) {
            const { data: aircraftData } = await supabase
              .from("aircraft")
              .select("registration")
              .eq("id", parentReconciliation.aircraft_id)
              .single();
            if (aircraftData) aircraftRegistration = aircraftData.registration;
          }

          const numeroDocumento = `REIMB-${Date.now().toString().slice(-6)}`;
          const clienteNome = clientData?.company_name || "Cliente";
          await supabase.from("contas_areceber").insert({
            numero: numeroDocumento,
            referencia: clienteNome,
            cliente_nome: clienteNome,
            cliente_cnpj: clientData?.cnpj || "",
            data_criacao: data.date,
            data_vencimento: data.payment_term || data.date,
            valor: parseFloat(data.amount),
            categoria: data.category || "Reembolso de Despesa",
            descricao: data.description || "Conta a receber",
            status: "pendente",
            arquivo_pdf_url: null,
            aeronave: aircraftRegistration,
            criado_por: user.id
          });
        } catch (err) {
          console.error("Erro ao criar conta a receber:", err);
        }
      }

      // Sincronizar com controle_bancario
      if (inserted?.id) {
        await syncBankReconciliationToFinancial(inserted.id, user.id);
      }

      toast({ title: "Sucesso", description: "Despesa adicionada." });
      form.reset();
      onClose();
      onSuccess();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background rounded-lg border p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Adicionar Item Vinculado</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0"><X className="h-4 w-4" /></Button>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
             {/* Campos simplificados para brevidade, mas funcionais */}
             <FormField control={form.control} name="date" render={({field}) => (
                 <FormItem><FormLabel>Data</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
             )} />
             <FormField control={form.control} name="description" render={({field}) => (
                 <FormItem><FormLabel>Descrição</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
             )} />
             <FormField control={form.control} name="amount" render={({field}) => (
                 <FormItem><FormLabel>Valor</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
             )} />
             <FormField control={form.control} name="category" render={({field}) => (
                 <FormItem>
                     <FormLabel>Categoria</FormLabel>
                     <FormControl>
                         <GroupedSelect value={field.value} onValueChange={field.onChange}>
                             <GroupedSelectTrigger>
                                 <GroupedSelectValue placeholder="Selecione uma categoria" />
                             </GroupedSelectTrigger>
                             <GroupedSelectContent>
                                 {groupedCategories.map((group) => (
                                     <SelectGroup key={group.grupo}>
                                         <SelectLabel className="text-xs font-bold uppercase tracking-wider">{group.grupo}</SelectLabel>
                                         {group.categorias.map((cat) => (
                                             <GroupedSelectItem key={cat.id} value={cat.nome}>
                                                 {cat.nome}
                                             </GroupedSelectItem>
                                         ))}
                                     </SelectGroup>
                                 ))}
                             </GroupedSelectContent>
                         </GroupedSelect>
                     </FormControl>
                 </FormItem>
             )} />
             <FormField control={form.control} name="status" render={({field}) => (
                 <FormItem>
                     <FormLabel>Status</FormLabel>
                     <Select value={field.value} onValueChange={field.onChange}>
                         <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
            <Button type="submit" size="sm" disabled={submitting}>Adicionar</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
