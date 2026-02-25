import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { ControlledSelect, SelectItem as ControlledSelectItem } from "@/components/ui/controlled-select";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, Save, Send, Upload, Eye, FileText, AlertTriangle, CalendarIcon, Building2, Plane, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useClientes } from "@/hooks/useClientes";
import { useAeronaves } from "@/hooks/useAeronaves";
import { useTripulantes } from "@/hooks/useTripulantes";
import { calculateReportTotals, extractPayerTotals, getValidExpenses } from "@/lib/travelReportUtils";
import { draftStorage } from "@/lib/travelReportDraft";
import type { TravelReportDraft } from "@/lib/travelReportDraft";
import { cn } from "@/lib/utils";

const EXPENSE_CATEGORIES = ['Combustível', 'Hospedagem', 'Alimentação', 'Transporte', 'Outros'];

interface Expense {
  id?: string;
  category: string;
  description: string;
  amount: number;
  paid_by: string;
  receipt_url?: string;
  expense_date?: string;
}

interface TravelReport {
  id?: string;
  report_number: string;
  client_id: string;
  client: string;
  client_partner?: string | null;
  aircraft_id: string;
  aircraft_registration: string;
  crew_member_id: string;
  crew_member_name: string;
  crew_member_name_2: string;
  route: string;
  start_date: string;
  end_date: string;
  days_count: number;
  observations: string;
  expenses: Expense[];
  total_amount: number;
  total_fuel: number;
  total_lodging: number;
  total_food: number;
  total_transport: number;
  total_other: number;
  total_crew: number;
  total_crew1: number;
  total_crew2: number;
  total_client: number;
  total_sharebrasil: number;
  status: 'Rascunho' | 'Finalizado' | 'Enviado';
}

interface TravelReportFormProps {
  report?: TravelReport | null;
  onSave: (report: TravelReport, status: 'Rascunho' | 'Finalizado') => Promise<void>;
  onCancel: () => void;
  onAutoSave?: (report: TravelReportDraft) => void;
  showPartnerModal?: () => void;
  onReceiptView?: (url: string) => void;
}

export function TravelReportForm({ 
  report, 
  onSave, 
  onCancel, 
  onAutoSave,
  showPartnerModal, 
  onReceiptView 
}: TravelReportFormProps) {
  const { clientes, isLoadingClientes } = useClientes();
  const { aeronaves, isLoadingAeronaves } = useAeronaves();
  const { tripulantes, isLoadingTripulantes } = useTripulantes();

  const [currentReport, setCurrentReport] = useState<TravelReport>(
    report || {
      report_number: 'R-0001',
      client_id: '',
      client: '',
      client_partner: null,
      aircraft_id: '',
      aircraft_registration: '',
      crew_member_id: '',
      crew_member_name: '',
      crew_member_name_2: '',
      route: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(new Date(), 'yyyy-MM-dd'),
      days_count: 1,
      observations: '',
      expenses: [],
      total_amount: 0,
      total_fuel: 0,
      total_lodging: 0,
      total_food: 0,
      total_transport: 0,
      total_other: 0,
      total_crew: 0,
      total_crew1: 0,
      total_crew2: 0,
      total_client: 0,
      total_sharebrasil: 0,
      status: 'Rascunho'
    }
  );

  const [partners, setPartners] = useState<{id?: string; name: string; cpf?: string; index: number}[]>([]);

  const [showSecondCrew, setShowSecondCrew] = useState(!!currentReport.crew_member_name_2);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [expenseDateOpenIndex, setExpenseDateOpenIndex] = useState<number | null>(null);

  // Auto-save draft
  useEffect(() => {
    if (!report && onAutoSave) {
      const autoSaveInterval = setInterval(() => {
        onAutoSave(currentReport as TravelReportDraft);
      }, 30000);
      return () => clearInterval(autoSaveInterval);
    }
  }, [currentReport, onAutoSave, report]);

  const handleInputChange = (field: keyof TravelReport, value: any) => {
    setCurrentReport(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const fetchPartnersForClient = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_partners')
        .select('id, name, cpf')
        .eq('client_id', clientId)
        .order('name');

      if (error || !data) {
        setPartners([]);
        return [];
      }

      const mapped = data.map((p: any, i: number) => ({ id: p.id, name: p.name, cpf: p.cpf || undefined, index: i }));
      setPartners(mapped);
      return mapped;
    } catch (err) {
      setPartners([]);
      return [];
    }
  };

  const handleExpenseChange = (index: number, field: keyof Expense, value: any) => {
    const newExpenses = [...currentReport.expenses];
    newExpenses[index] = { ...newExpenses[index], [field]: value };
    setCurrentReport(prev => ({
      ...prev,
      expenses: newExpenses
    }));
  };

  const calculateDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const addExpense = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setCurrentReport(prev => ({
      ...prev,
      expenses: [{
        category: '',
        description: '',
        amount: 0,
        paid_by: '',
        expense_date: today
      }, ...prev.expenses]
    }));
  };

  const removeExpense = (index: number) => {
    setCurrentReport(prev => ({
      ...prev,
      expenses: prev.expenses.filter((_, i) => i !== index)
    }));
  };

  const handleFileUpload = async (index: number, file: File | undefined) => {
    if (!file) return;

    setUploadingIndex(index);
    const toastId = toast.loading('📤 Enviando comprovante...');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('travel-reports')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('travel-reports')
        .getPublicUrl(filePath);

      handleExpenseChange(index, 'receipt_url', publicUrl);
      toast.success('✓ Comprovante enviado com sucesso!', { id: toastId });
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error(`❌ Erro ao fazer upload: ${error?.message || 'Tente novamente'}`, { id: toastId });
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleSave = async (status: 'Rascunho' | 'Finalizado') => {
    if (!currentReport.client_id && (!currentReport.client || currentReport.client.trim() === '')) {
      toast.error('⚠️ Preencha o campo obrigatório: Cliente');
      return;
    }

    if (!currentReport.aircraft_id && (!currentReport.aircraft_registration || currentReport.aircraft_registration.trim() === '')) {
      toast.error('⚠️ Preencha o campo obrigatório: Aeronave');
      return;
    }

    if (!currentReport.route || currentReport.route.trim() === '') {
      toast.error('⚠️ Preencha o campo obrigatório: Trecho');
      return;
    }

    if (!currentReport.crew_member_id && (!currentReport.crew_member_name || currentReport.crew_member_name.trim() === '')) {
      toast.error('⚠️ Preencha o campo obrigatório: Tripulante 1');
      return;
    }

    if (!currentReport.start_date || !currentReport.end_date) {
      toast.error('⚠️ Preencha as datas de início e fim');
      return;
    }

    if (new Date(currentReport.start_date) > new Date(currentReport.end_date)) {
      toast.error('⚠️ A data final deve ser igual ou posterior à data inicial');
      return;
    }

    if (status !== 'Rascunho') {
      const validExpenses = currentReport.expenses.filter(e => e.category && e.amount > 0);
      if (validExpenses.length === 0) {
        toast.error('⚠️ Adicione pelo menos uma despesa válida');
        return;
      }
    }

    setIsSaving(true);
    try {
      const days = calculateDays(currentReport.start_date, currentReport.end_date);
      
      // Recalculate totals
      const validExpenses = getValidExpenses(currentReport.expenses);
      const recalculatedTotals = calculateReportTotals(validExpenses);
      
      const reportToSave: TravelReport = {
        ...currentReport,
        days_count: days,
        expenses: validExpenses,
        total_amount: recalculatedTotals.total_amount,
        total_fuel: recalculatedTotals.total_fuel,
        total_lodging: recalculatedTotals.total_lodging,
        total_food: recalculatedTotals.total_food,
        total_transport: recalculatedTotals.total_transport,
        total_other: recalculatedTotals.total_other,
        total_crew: recalculatedTotals.total_crew,
        total_crew1: recalculatedTotals.total_crew1,
        total_crew2: recalculatedTotals.total_crew2,
        total_client: recalculatedTotals.total_client,
        total_sharebrasil: recalculatedTotals.total_sharebrasil,
        status
      };

      await onSave(reportToSave, status);
      toast.success(`✓ Relatório ${status === 'Finalizado' ? 'finalizado' : 'salvo como rascunho'} com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error(error.message || 'Erro ao salvar relatório');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="border-amber-200/50 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm rounded-xl">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-100/50 flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <AlertTitle className="text-amber-900 font-bold text-base">Regras para Lançamento de Despesas</AlertTitle>
            <AlertDescription className="text-amber-700/80 mt-3 space-y-2 leading-relaxed">
              <ul className="list-disc list-inside space-y-2">
                <li>É obrigatório anexar o comprovante de pagamento para cada despesa.</li>
                <li>Cupons de crédito não são aceitos como comprovante de pagamento.</li>
                <li>Não serão reembolsadas despesas com bebidas alcoólicas.</li>
              </ul>
            </AlertDescription>
          </div>
        </div>
      </Alert>

      <Card className="shadow-md rounded-xl border-border/50">
        <CardHeader className="p-6 border-b border-border/30">
          <CardTitle className="text-xl font-bold text-foreground">Informações da Viagem</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Cliente</Label>
              <SearchableCombobox
                items={clientes.map(c => ({ id: c.id, label: c.company_name || c.name || '' }))}
                value={currentReport.client_id}
                onChange={(id, label) => {
                  handleInputChange('client_id', id);
                  handleInputChange('client', label);
                  handleInputChange('client_partner', null);
                  fetchPartnersForClient(id);
                }}
                icon={<Building2 className="h-4 w-4" />}
                placeholder="Selecione um cliente..."
                searchPlaceholder="Buscar cliente pelo nome..."
                emptyMessage="Nenhum cliente encontrado."
              />
              {partners.length > 0 && (
                <div className="mt-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Sócio</Label>
                  <ControlledSelect
                    value={currentReport.client_partner || ''}
                    onValueChange={(val) => {
                      const sel = partners.find(p => p.id === val);
                      if (sel) {
                        handleInputChange('client_partner', sel.id || null);
                        handleInputChange('client', sel.name);
                      }
                    }}
                    placeholder="Selecione o sócio"
                  >
                    {partners.map(p => (
                      <ControlledSelectItem key={p.id || p.index} value={p.id as string}>
                        {p.name}
                      </ControlledSelectItem>
                    ))}
                  </ControlledSelect>
                </div>
              )}
              {currentReport.client_id && (
                <p className="text-xs text-green-600">✓ Cliente selecionado</p>
              )}
              {currentReport.client_partner && (
                <p className="text-xs text-amber-500">
                  👤 Sócio: <span className="font-semibold">{currentReport.client}</span>
                  {showPartnerModal && (
                    <button
                      type="button"
                      className="ml-1 underline text-amber-400 hover:text-amber-300"
                      onClick={showPartnerModal}
                    >
                      alterar
                    </button>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Aeronave</Label>
              <SearchableCombobox
                items={Array.isArray(aeronaves) ? aeronaves.map(a => ({ id: a.id, label: a.registration || '' })) : []}
                value={currentReport.aircraft_id}
                onChange={(id, label) => {
                  handleInputChange('aircraft_id', id);
                  handleInputChange('aircraft_registration', label);
                }}
                icon={<Plane className="h-4 w-4" />}
                placeholder="Selecione a aeronave..."
                searchPlaceholder="Buscar por prefixo..."
                emptyMessage="Aeronave não encontrada."
              />
              {currentReport.aircraft_id && (
                <p className="text-xs text-green-600">✓ Aeronave selecionada</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Comandante</Label>
              <SearchableCombobox
                items={tripulantes.map(t => ({ id: t.id, label: t.full_name || t.name || '' }))}
                value={currentReport.crew_member_id}
                onChange={(id, label) => {
                  handleInputChange('crew_member_id', id);
                  handleInputChange('crew_member_name', label);
                }}
                icon={<User className="h-4 w-4" />}
                placeholder="Selecione o comandante..."
                searchPlaceholder="Buscar tripulante..."
                emptyMessage="Tripulante não encontrado."
                allowFreeText={true}
              />
              {currentReport.crew_member_id && (
                <p className="text-xs text-green-600">✓ Tripulante selecionado</p>
              )}
            </div>

            <div className="space-y-2 flex items-end">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showSecondCrew"
                  checked={showSecondCrew || !!currentReport.crew_member_name_2}
                  onCheckedChange={(checked) => setShowSecondCrew(!!checked)}
                />
                <Label htmlFor="showSecondCrew" className="cursor-pointer">
                  Adicionar Segundo Tripulante
                </Label>
              </div>
            </div>

            {(showSecondCrew || currentReport.crew_member_name_2) && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Co-piloto</Label>
                <SearchableCombobox
                  items={tripulantes.map(t => ({ id: t.id, label: t.full_name || t.name || '' }))}
                  value={tripulantes.find(t => t.full_name === currentReport.crew_member_name_2 || t.name === currentReport.crew_member_name_2)?.id || currentReport.crew_member_name_2 || ''}
                  onChange={(id, label) => {
                    handleInputChange('crew_member_name_2', label);
                  }}
                  icon={<User className="h-4 w-4" />}
                  placeholder="Selecione o co-piloto..."
                  searchPlaceholder="Buscar tripulante..."
                  emptyMessage="Tripulante não encontrado."
                  allowFreeText={true}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Trecho (Ex: SBPF-SBGR) *</Label>
              <Input
                value={currentReport.route || ''}
                onChange={(e) => handleInputChange('route', e.target.value)}
                placeholder="Trecho"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Data Início *</Label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-11 rounded-lg border-border/50 focus-visible:ring-2 focus-visible:ring-primary transition-all duration-200"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1">
                      {currentReport.start_date
                        ? format(new Date(currentReport.start_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione a data"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                  <UICalendar
                    mode="single"
                    selected={currentReport.start_date ? new Date(currentReport.start_date + 'T00:00:00') : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const formattedDate = `${year}-${month}-${day}`;
                        handleInputChange('start_date', formattedDate);
                        if (currentReport.end_date && new Date(formattedDate) > new Date(currentReport.end_date)) {
                          handleInputChange('end_date', formattedDate);
                        }
                        setStartDateOpen(false);
                      }
                    }}
                    disabled={(date) => date > new Date()}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Data Fim *</Label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-11 rounded-lg border-border/50 focus-visible:ring-2 focus-visible:ring-primary transition-all duration-200"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1">
                      {currentReport.end_date
                        ? format(new Date(currentReport.end_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione a data"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                  <UICalendar
                    mode="single"
                    selected={currentReport.end_date ? new Date(currentReport.end_date + 'T00:00:00') : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const formattedDate = `${year}-${month}-${day}`;

                        if (currentReport.start_date && new Date(formattedDate) < new Date(currentReport.start_date)) {
                          toast.error('A data final deve ser igual ou posterior à data inicial');
                          return;
                        }

                        handleInputChange('end_date', formattedDate);
                        setEndDateOpen(false);
                      }
                    }}
                    disabled={(date) => date > new Date() || (currentReport.start_date ? date < new Date(currentReport.start_date) : false)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {currentReport.start_date && currentReport.end_date && (
              <div className="md:col-span-2">
                <div className="text-sm font-semibold p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 rounded-lg">
                  <span className="text-green-700">
                    ✓ Duração da Viagem: <strong className="text-lg text-green-600">{calculateDays(currentReport.start_date, currentReport.end_date)}</strong> dia{calculateDays(currentReport.start_date, currentReport.end_date) > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md rounded-xl border-border/50">
        <CardHeader className="p-6 border-b border-border/30">
          <CardTitle className="text-xl font-bold text-foreground">Observações</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Textarea
            value={currentReport.observations || ''}
            onChange={(e) => handleInputChange('observations', e.target.value)}
            className="h-32 rounded-lg border-border/50 focus-visible:ring-2 focus-visible:ring-primary resize-none"
            placeholder="Adicione observações importantes sobre a viagem ou despesas..."
          />
        </CardContent>
      </Card>

      <Card className="shadow-md rounded-xl border-border/50">
        <CardHeader className="flex flex-row items-center justify-between p-6 border-b border-border/30">
          <CardTitle className="text-xl font-bold text-foreground">Despesas da Viagem</CardTitle>
          <Button onClick={addExpense} size="sm" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Despesa
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {currentReport.expenses?.map((expense, index) => (
            <div key={expense.id || index} className="border border-border/50 p-5 rounded-xl bg-card/50 shadow-sm hover:shadow-md transition-all duration-200 relative">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {index + 1}
                </span>
                Item de Despesa
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Categoria *</Label>
                  <ControlledSelect
                    value={expense.category}
                    onValueChange={(value) => handleExpenseChange(index, 'category', value)}
                    placeholder="Selecione"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <ControlledSelectItem key={cat} value={cat}>
                        {cat}
                      </ControlledSelectItem>
                    ))}
                  </ControlledSelect>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Data da Despesa</Label>
                  <Popover open={expenseDateOpenIndex === index} onOpenChange={(open) => setExpenseDateOpenIndex(open ? index : null)}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal h-11 rounded-lg border-border/50 focus-visible:ring-2 focus-visible:ring-primary transition-all duration-200"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 truncate">
                          {expense.expense_date
                            ? format(new Date(expense.expense_date + 'T00:00:00'), "dd/MM", { locale: ptBR })
                            : "Data"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                      <UICalendar
                        mode="single"
                        selected={expense.expense_date ? new Date(expense.expense_date + 'T00:00:00') : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            const formattedDate = `${year}-${month}-${day}`;
                            handleExpenseChange(index, 'expense_date', formattedDate);
                            setExpenseDateOpenIndex(null);
                          }
                        }}
                        disabled={(date) => date > new Date()}
                        locale={ptBR}
                        defaultMonth={expense.expense_date ? new Date(expense.expense_date + 'T00:00:00') : new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Valor (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expense.amount}
                    onChange={(e) => handleExpenseChange(index, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="h-11 rounded-lg border-border/50 focus-visible:ring-2 focus-visible:ring-primary font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Pago Por *</Label>
                  <ControlledSelect
                    value={expense.paid_by}
                    onValueChange={(value) => handleExpenseChange(index, 'paid_by', value)}
                    placeholder="Selecione"
                  >
                    <ControlledSelectItem value="Tripulante 1">
                      {currentReport.crew_member_name ? `T1 (${currentReport.crew_member_name.split(' ')[0]})` : 'Tripulante 1'}
                    </ControlledSelectItem>
                    {(showSecondCrew || currentReport.crew_member_name_2) && (
                      <ControlledSelectItem value="Tripulante 2">
                        {currentReport.crew_member_name_2 ? `T2 (${currentReport.crew_member_name_2.split(' ')[0]})` : 'Tripulante 2'}
                      </ControlledSelectItem>
                    )}
                    <ControlledSelectItem value="Cliente">Cliente</ControlledSelectItem>
                    <ControlledSelectItem value="ShareBrasil">ShareBrasil</ControlledSelectItem>
                  </ControlledSelect>
                </div>

              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Descrição Detalhada</Label>
                  <Input
                    value={expense.description}
                    onChange={(e) => handleExpenseChange(index, 'description', e.target.value)}
                    placeholder="Breve descrição"
                    className="h-11 rounded-lg border-border/50 focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Comprovante</Label>
                  <div className="flex items-center gap-2">
                    <label htmlFor={`receipt-upload-${index}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 px-3 h-11 border border-border/50 rounded-lg hover:bg-accent/50 transition-all duration-200">
                        {uploadingIndex === index ? (
                          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                        ) : expense.receipt_url ? (
                          <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <Upload className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-sm truncate">
                          {expense.receipt_url ? 'Anexado' : 'Enviar'}
                        </span>
                      </div>
                    </label>
                    <input
                      id={`receipt-upload-${index}`}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => handleFileUpload(index, e.target.files?.[0])}
                      disabled={uploadingIndex !== null}
                    />
                    {expense.receipt_url && (
                      <button
                        onClick={() => {
                          if (onReceiptView) {
                            onReceiptView(expense.receipt_url!);
                          }
                        }}
                        className="p-2 rounded-lg hover:bg-accent transition-all duration-200"
                        title="Ver Comprovante"
                      >
                        <Eye className="h-4 w-4 text-primary" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {currentReport.expenses.length > 0 && (
                <button
                  onClick={() => removeExpense(index)}
                  className="absolute top-4 right-4 text-destructive/60 hover:text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-all duration-200 active:scale-[0.95]"
                  title="Remover Despesa"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-4 flex-wrap">
        <Button
          onClick={() => handleSave('Rascunho')}
          disabled={isSaving}
          variant="outline"
          className="rounded-lg border-border/50 hover:bg-accent transition-all duration-200 active:scale-[0.98]"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Salvando...' : 'Salvar Rascunho'}
        </Button>
        <Button
          onClick={() => handleSave('Finalizado')}
          disabled={isSaving}
          className="flex-1 md:flex-initial bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] font-semibold"
          size="lg"
        >
          <Send className="h-4 w-4 mr-2" />
          {isSaving ? 'Salvando...' : 'Finalizar Relatório'}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-lg border-border/50 hover:bg-accent transition-all duration-200 active:scale-[0.98]"
        >
          Voltar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-md rounded-xl border-border/50">
          <CardHeader className="p-6 border-b border-border/30">
            <CardTitle className="text-lg font-bold">Por Pagador</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{currentReport.crew_member_name ? `Tripulante 1` : 'Tripulante 1'}</span>
                <span className="font-semibold text-foreground font-mono">R$ {(currentReport.total_crew1 || 0).toFixed(2).replace('.', ',')}</span>
              </div>
              {(showSecondCrew || currentReport.crew_member_name_2) && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tripulante 2</span>
                  <span className="font-semibold text-foreground font-mono">R$ {(currentReport.total_crew2 || 0).toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-semibold text-foreground font-mono">R$ {currentReport.total_client.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ShareBrasil</span>
                <span className="font-semibold text-foreground font-mono">R$ {currentReport.total_sharebrasil.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex justify-between pt-3 mt-3 border-t border-border/30">
                <span className="font-bold text-foreground">TOTAL</span>
                <span className="font-bold text-lg text-green-600 font-mono">R$ {currentReport.total_amount.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md rounded-xl border-border/50">
          <CardHeader className="p-6 border-b border-border/30">
            <CardTitle className="text-lg font-bold">Por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Combustível</span>
                <span className="font-semibold text-foreground font-mono">R$ {currentReport.total_fuel.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hospedagem</span>
                <span className="font-semibold text-foreground font-mono">R$ {currentReport.total_lodging.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Alimentação</span>
                <span className="font-semibold text-foreground font-mono">R$ {currentReport.total_food.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transporte</span>
                <span className="font-semibold text-foreground font-mono">R$ {currentReport.total_transport.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Outros</span>
                <span className="font-semibold text-foreground font-mono">R$ {currentReport.total_other.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex justify-between pt-3 mt-3 border-t border-border/30">
                <span className="font-bold text-foreground">TOTAL</span>
                <span className="font-bold text-lg text-green-600 font-mono">R$ {currentReport.total_amount.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
