import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, Clock, Send, Users, Check, Plus, X, Plane } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
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
} from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { getShortUserId, getIdBadgeColor } from "@/lib/user-id";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useGroupedCategories } from "@/hooks/useGroupedCategories";
import { StatusUpdateDialog } from "./StatusUpdateDialog";
import { AddBankReconciliationForm } from "./AddBankReconciliationForm";
import { MonthSelector } from "./MonthSelector";
import { syncBankReconciliationToFinancial } from "@/services/financialSyncClient";

// --- Interfaces ---
interface Client {
  id: string;
  razao_social: string;
}

interface Aircraft {
  id: string;
  matricula: string;
}

interface BankReconciliation {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  status: string;
  categoria: string | null;
  categoria_movimentacao_id?: string | null;
  clientes_id: string | null;
  aeronave_id: string | null;
  prazo_pagamento: string | null;
  criado_por?: string;
  socio_cliente_id: string | null;
  nome_socio: string | null;
  clientes: { razao_social: string } | null;
  socios_cliente: { nome: string; cpf?: string } | null;
  aircraft: { matricula: string } | null;
  forma_pagamento?: string | null;
  saldo_pendente?: number | null;
}

/**
 * Determina o status de exibição no frontend.
 * No banco, "enviado" é armazenado como "pendente" com prazo_pagamento preenchido.
 */
function getDisplayStatus(item: BankReconciliation): string {
  if (item.status?.toLowerCase() === 'pendente' && item.prazo_pagamento) {
    return 'enviado';
  }
  return item.status?.toLowerCase() || 'pendente';
}

// --- Schemas ---
const addDespesaSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  status: z.enum(["pendente", "enviado", "recebido"]),
  prazo_pagamento: z.string().optional().nullable(),
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
  const [currentDate, setCurrentDate] = useState(new Date());

  const [openStatusDialog, setOpenStatusDialog] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<BankReconciliation | null>(null);

  const [showTravelDebtsOnly, setShowTravelDebtsOnly] = useState(false);

  useEffect(() => {
    fetchReconciliations();
    loadClientsAndAircraft();
  }, [currentDate]);

  const loadClientsAndAircraft = async () => {
    try {
      const [clientsResponse, aircraftResponse] = await Promise.all([
        supabase.from("clientes").select("id, razao_social").order("razao_social"),
        supabase.from('aeronave').select('id, matricula').order("matricula"),
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

      const { data: categoriasProtegidas } = await supabase
        .from('categorias_movimentacao')
        .select('id, nome')
        .eq('grupo_categoria', 'RECEITAS OPERACIONAIS');

      const idsCategoriasProtegidas = new Set(categoriasProtegidas?.map(c => c.id) || []);
      const nomesCategoriasProtegidas = new Set(categoriasProtegidas?.map(c => c.nome?.toLowerCase()) || []);

      const { data, error } = await supabase
        .from('conciliacoes_bancarias')
        .select(`
          *,
          clientes:clientes_id (razao_social),
          socios_cliente:socio_cliente_id (nome, cpf),
          aircraft:aeronave_id (matricula)
        `)
        .eq('tipo', 'cliente' as any)
        .gte('data', startDate.toISOString().split('T')[0])
        .lte('data', endDate.toISOString().split('T')[0])
        .order('data', { ascending: false });

      if (error) throw error;

      const filteredData = (data || []).filter(item => {
        if (item.categoria_movimentacao_id && idsCategoriasProtegidas.has(item.categoria_movimentacao_id)) {
          return false;
        }
        const categoryName = item.categoria?.toLowerCase() || '';
        if (nomesCategoriasProtegidas.has(categoryName)) {
          return false;
        }
        const description = item.descricao?.toLowerCase() || '';
        if (description.includes('receita operacional')) {
          return false;
        }
        return true;
      });

      setConciliacaoClientes(filteredData as any);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Erro ao buscar conciliações:', errorMessage);
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
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20 shadow-none whitespace-nowrap">Recebido</Badge>;
      case "enviado":
        return <Badge className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20 shadow-none whitespace-nowrap">Enviado</Badge>;
      case "pendente":
        return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20 shadow-none whitespace-nowrap">Pendente</Badge>;
      default:
        return <Badge variant="secondary" className="whitespace-nowrap">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case "recebido":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "enviado":
        return <Send className="h-4 w-4 text-blue-400" />;
      case "pendente":
        return <Clock className="h-4 w-4 text-yellow-500" />;
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


  const today = new Date();
  const isCurrentMonth = currentDate.getFullYear() === today.getFullYear() && currentDate.getMonth() === today.getMonth();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const resumoClientes = {
    totalRecebido: conciliacaoClientes
      .filter(item => getDisplayStatus(item) === 'recebido')
      .reduce((sum, item) => sum + Number(item.valor), 0),
    totalEnviado: conciliacaoClientes
      .filter(item => getDisplayStatus(item) === 'enviado')
      .reduce((sum, item) => sum + Number(item.valor), 0),
    totalPendente: conciliacaoClientes
      .filter(item => getDisplayStatus(item) === 'pendente')
      .reduce((sum, item) => sum + Number(item.valor), 0),
  };

  const filteredData = showTravelDebtsOnly
    ? conciliacaoClientes.filter(item => {
      const isDebt = item.status?.toLowerCase() !== 'recebido';
      const textToSearch = (item.categoria || '') + ' ' + (item.descricao || '');
      const keywords = ['viagem', 'reembolso', 'ressarcimento', 'combustivel', 'relatorio', 'hospedagem', 'alimentacao'];
      const isTravelRelated = keywords.some(key => textToSearch.toLowerCase().includes(key));

      return isDebt && isTravelRelated;
    })
    : conciliacaoClientes;

  return (
    <div className="space-y-6">
      <MonthSelector
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        isCurrentMonth={isCurrentMonth}
      />

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

      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Conciliação com Clientes
            </CardTitle>

            <div className="flex gap-2 w-full md:w-auto">
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

        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <div className="mb-6 px-4 sm:px-0">
            <AddBankReconciliationForm onSuccess={fetchReconciliations} />
          </div>

          <div className="overflow-x-auto pb-4 custom-scrollbar">
            <Table className="w-full text-sm text-left border-collapse">
              <TableHeader className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider border-y border-border/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[100px] max-w-[200px] resize-x overflow-hidden">Data</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[80px] max-w-[150px] resize-x overflow-hidden">ID</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[250px] max-w-[500px] resize-x overflow-hidden">Descrição</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[200px] max-w-[400px] resize-x overflow-hidden">Cliente</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[120px] max-w-[200px] resize-x overflow-hidden">Aeronave</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[180px] max-w-[300px] resize-x overflow-hidden">Categoria</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[120px] max-w-[200px] resize-x overflow-hidden">Valor</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[120px] max-w-[200px] resize-x overflow-hidden">Prazo</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[120px] max-w-[200px] resize-x overflow-hidden">Status</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[120px]">Ações</div></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/50">
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
                    const isFinalized = getDisplayStatus(item) === 'recebido';

                    return (
                      <React.Fragment key={item.id}>
                        <TableRow className={`hover:bg-accent/30 transition-colors group ${isFinalized ? 'bg-muted/10 opacity-80' : ''}`}>
                          <TableCell className="px-4 py-4 whitespace-nowrap">
                            {item.data ? format(new Date(item.data + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <Badge className={`${getIdBadgeColor(getShortUserId(item.criado_por || ''))} font-semibold shadow-none border-border/50`}>
                              {getShortUserId(item.criado_por || '')}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-4 max-w-xs">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(getDisplayStatus(item))}
                              <span className="truncate" title={item.descricao}>{item.descricao}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="font-medium text-foreground whitespace-normal break-words leading-tight">
                                {item.socio_cliente_id && item.socios_cliente?.nome
                                  ? item.socios_cliente.nome
                                  : item.clientes?.razao_social || '-'}
                              </span>
                              {item.socio_cliente_id && item.socios_cliente?.nome && (
                                <Badge variant="secondary" className="w-fit text-[10px] h-5 px-1.5 rounded-md">
                                  Sócio
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <Badge variant="outline" className="rounded-md border-border/80">
                              {item.aircraft?.matricula || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20 whitespace-normal break-words max-w-full text-center leading-snug">
                              {formatCategoryName(item.categoria)}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-4 text-primary font-medium whitespace-nowrap">
                            {formatCurrency(Math.abs(Number(item.valor)))}
                          </TableCell>
                          <TableCell className="px-4 py-4 whitespace-nowrap">
                            {item.status?.toLowerCase() === 'pendente' ? (
                              <PaymentTermEditor
                                reconciliation={item}
                                onSave={fetchReconciliations}
                              />
                            ) : item.prazo_pagamento ? (
                              <span className="text-sm">{format(new Date(item.prazo_pagamento + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            {getStatusBadge(getDisplayStatus(item))}
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {isFinalized ? (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 text-green-500 border border-green-500/20 w-fit" title="Baixa realizada pelo Financeiro">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  <span className="text-[10px] font-bold uppercase tracking-wide">Concluído</span>
                                </div>
                              ) : getDisplayStatus(item) === 'enviado' ? (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 w-fit" title="Aguardando recebimento">
                                  <Send className="h-3.5 w-3.5" />
                                  <span className="text-[10px] font-bold uppercase tracking-wide">Enviado</span>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedReconciliation(item);
                                    setOpenStatusDialog(true);
                                  }}
                                  className="h-8 border-dashed hover:border-solid hover:bg-primary/5 hover:text-primary transition-all rounded-lg"
                                  title="Enviar para Financeiro"
                                >
                                  <Send className="h-3.5 w-3.5 mr-1.5" />
                                  <span className="text-xs">Enviar</span>
                                </Button>
                              )}

                              {!isFinalized && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                  className={`h-8 w-8 transition-colors rounded-lg ${expandedId === item.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}
                                  title={expandedId === item.id ? "Fechar" : "Adicionar item vinculado"}
                                >
                                  <Plus className={`h-4 w-4 transition-transform duration-200 ${expandedId === item.id ? 'rotate-45' : ''}`} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

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

  const parseLocalDate = (dateStr: string | null | undefined): Date | undefined => {
    if (!dateStr) return undefined;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    parseLocalDate(reconciliation.prazo_pagamento)
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
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const { error } = await supabase
        .from('conciliacoes_bancarias')
        .update({ prazo_pagamento: dateStr } as any)
        .eq('id', reconciliation.id as any);

      if (error) throw error;

      if (reconciliation.descricao?.includes('RELATORIO DE VIAGEM')) {
        const reportNumberMatch = reconciliation.descricao.match(/RELATORIO DE VIAGEM - (.+?) - /);
        if (reportNumberMatch && reportNumberMatch[1]) {
          const reportNumber = reportNumberMatch[1];
          const { data: relatedReport } = await supabase
            .from('travel_expense_reports')
            .select('id')
            .eq('numero_relatorio', reportNumber as any)
            .eq('clientes_id', reconciliation.clientes_id as any)
            .maybeSingle();

          if (relatedReport) {
            await supabase
              .from('travel_expense_reports')
              .update({ prazo_pagamento: dateStr } as any)
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

  const formatDateForDisplay = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  };

  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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
      <button onClick={() => setIsEditing(true)} className="text-sm hover:text-blue-600 hover:underline flex items-center gap-1 whitespace-nowrap">
        {reconciliation.prazo_pagamento ? formatDateForDisplay(reconciliation.prazo_pagamento) : <span className="text-xs text-muted-foreground italic flex items-center gap-1"><Plus className="w-3 h-3" />Prazo</span>}
      </button>
    );
  }

  return (
    <div className="flex gap-1 items-center z-50">
      <Input
        type="date"
        className="h-8 w-[130px] text-xs rounded-lg"
        value={formatDateForInput(selectedDate)}
        onChange={handleDateChange}
      />
      <Button size="icon" className="h-8 w-8 rounded-lg" onClick={handleSave} disabled={isSaving}><Check className="h-3 w-3" /></Button>
      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => setIsEditing(false)}><X className="h-3 w-3" /></Button>
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

function AddDespesaForm({ parentReconciliation, onClose, onSuccess }: AddDespesaFormProps) {
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
      category: parentReconciliation.categoria || "",
      status: "pendente",
    },
  });

  const onSubmit = async (data: AddDespesaFormValues) => {
    if (!user) return;
    try {
      setSubmitting(true);

      const { data: inserted, error } = await supabase.from("conciliacoes_bancarias").insert([{
        tipo: "cliente",
        data: data.date,
        descricao: data.description,
        valor: parseFloat(data.amount),
        categoria: data.category,
        status: data.status,
        clientes_id: parentReconciliation.clientes_id,
        aeronave_id: parentReconciliation.aeronave_id,
        socio_cliente_id: parentReconciliation.socio_cliente_id,
        criado_por: user.id,
      }] as any)
        .select()
        .single();

      if (error) throw error;

      if ((parentReconciliation.clientes_id || parentReconciliation.socio_cliente_id) && inserted) {
        try {
          let clienteNome = "Cliente";
          let clienteCnpj = "";

          if (parentReconciliation.socio_cliente_id) {
            const { data: partnerData } = await supabase
              .from("socios_cliente")
              .select("nome, cpf")
              .eq("id", parentReconciliation.socio_cliente_id)
              .single();
            if (partnerData) {
              clienteNome = partnerData.nome || "Cliente";
              clienteCnpj = partnerData.cpf || "";
            }
          } else if (parentReconciliation.clientes_id) {
            const { data: clientData } = await supabase
              .from("clientes")
              .select("razao_social, cnpj")
              .eq("id", parentReconciliation.clientes_id)
              .single();
            if (clientData) {
              clienteNome = clientData?.razao_social || "Cliente";
              clienteCnpj = clientData.cnpj || "";
            }
          }

          let aircraftRegistration = "";
          if (parentReconciliation.aeronave_id) {
            const { data: aircraftData } = await supabase
              .from('aeronave')
              .select('matricula')
              .eq("id", parentReconciliation.aeronave_id)
              .single();
            if (aircraftData) aircraftRegistration = aircraftData?.matricula;
          }

          const numeroDocumento = `REIMB-${Date.now().toString().slice(-6)}`;

          await (supabase.from("contas_areceber") as any).insert({
            numero: numeroDocumento,
            cliente_nome: clienteNome,
            cliente_cnpj: clienteCnpj,
            data_criacao: data.date,
            data_vencimento: data.prazo_pagamento || data.date,
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
    <div className="bg-background rounded-xl border border-border/50 p-4 shadow-sm relative z-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Adicionar Item Vinculado</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0 rounded-md hover:bg-accent"><X className="h-4 w-4" /></Button>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem><FormLabel>Data</FormLabel><FormControl><Input type="date" className="rounded-lg" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Descrição</FormLabel><FormControl><Input className="rounded-lg" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem><FormLabel>Valor</FormLabel><FormControl><Input type="number" step="0.01" className="rounded-lg" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <FormControl>
                  <GroupedSelect value={field.value} onValueChange={field.onChange}>
                    <GroupedSelectTrigger className="rounded-lg">
                      <GroupedSelectValue placeholder="Selecione..." />
                    </GroupedSelectTrigger>
                    <GroupedSelectContent className="rounded-lg">
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
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-lg border-border/50">Cancelar</Button>
            <Button type="submit" size="sm" disabled={submitting} className="rounded-lg">Adicionar</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
