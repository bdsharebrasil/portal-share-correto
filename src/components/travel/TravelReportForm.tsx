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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, Save, Send, Upload, Eye, FileText, AlertTriangle, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useClientes } from "@/hooks/useClientes";
import { useAeronaves } from "@/hooks/useAeronaves";
import { useTripulantes } from "@/hooks/useTripulantes";
import { calculateReportTotals, extractPayerTotals, getValidExpenses } from "@/lib/travelReportUtils";
import { draftStorage } from "@/lib/travelReportDraft";
import type { TravelReportDraft } from "@/lib/travelReportDraft";

const EXPENSE_CATEGORIES = ['Combustível', 'Hospedagem', 'Alimentação', 'Transporte', 'Outros'];

interface Expense {
  id?: string;
  category: string;
  description: string;
  amount: number;
  paid_by: string;
  receipt_url?: string;
}

interface TravelReport {
  id?: string;
  report_number: string;
  client_id: string;
  client: string;
  partner_name: string;
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
      partner_name: '',
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

  const [showSecondCrew, setShowSecondCrew] = useState(!!currentReport.crew_member_name_2);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

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
    setCurrentReport(prev => ({
      ...prev,
      expenses: [...prev.expenses, {
        category: '',
        description: '',
        amount: 0,
        paid_by: ''
      }]
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
      <Alert className="border-yellow-600/50 bg-yellow-950/50">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertTitle className="text-yellow-500 font-semibold">Regras para Lançamento de Despesas:</AlertTitle>
        <AlertDescription className="text-yellow-100/80 mt-2 space-y-2">
          <ul className="list-disc list-inside space-y-1">
            <li>É obrigatório anexar o comprovante de pagamento para cada despesa.</li>
            <li>Cupons de crédito não são aceitos como comprovante de pagamento.</li>
            <li>Não serão reembolsadas despesas com bebidas alcoólicas.</li>
          </ul>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Viagem</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <AutocompleteInput
                label={`Cliente * ${isLoadingClientes ? '⏳ Carregando...' : ''}`}
                value={currentReport.client || ''}
                onChange={(value) => handleInputChange('client', value)}
                options={clientes.map(c => ({
                  id: c.id,
                  label: c.company_name
                }))}
                placeholder="Digite o nome do cliente ou selecione"
                isLoading={isLoadingClientes}
                onSelect={(option) => {
                  const selectedClient = clientes.find(c => c.id === option.id);
                  if (selectedClient) {
                    handleInputChange('client_id', option.id);
                    handleInputChange('client', selectedClient.company_name);
                    handleInputChange('partner_name', '');
                  }
                }}
              />
              {!currentReport.client_id && currentReport.client && (
                <p className="text-xs text-yellow-600">⚠️ Entrada manual</p>
              )}
              {currentReport.client_id && (
                <p className="text-xs text-green-600">✓ Cliente selecionado</p>
              )}
              {currentReport.partner_name && (
                <p className="text-xs text-amber-500">
                  👤 Sócio: <span className="font-semibold">{currentReport.partner_name}</span>
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
              <AutocompleteInput
                label={`Aeronave * ${isLoadingAeronaves ? '⏳ Carregando...' : ''}`}
                value={currentReport.aircraft_registration || ''}
                onChange={(value) => handleInputChange('aircraft_registration', value)}
                options={Array.isArray(aeronaves) ? aeronaves.map(a => ({
                  id: a.id,
                  label: `${a.registration} - ${a.model || ''}`
                })) : []}
                placeholder="Digite a matrícula ou selecione"
                isLoading={isLoadingAeronaves}
                onSelect={(option) => {
                  const selectedAircraft = Array.isArray(aeronaves) ? aeronaves.find(a => a.id === option.id) : undefined;
                  if (selectedAircraft) {
                    handleInputChange('aircraft_id', option.id);
                    handleInputChange('aircraft_registration', selectedAircraft.registration);
                  }
                }}
              />
              {!currentReport.aircraft_id && currentReport.aircraft_registration && (
                <p className="text-xs text-yellow-600">⚠️ Entrada manual</p>
              )}
              {currentReport.aircraft_id && (
                <p className="text-xs text-green-600">✓ Aeronave selecionada</p>
              )}
            </div>

            <div className="space-y-2">
              <AutocompleteInput
                label={`Tripulante 1 * ${isLoadingTripulantes ? '⏳ Carregando...' : ''}`}
                value={currentReport.crew_member_name || ''}
                onChange={(value) => handleInputChange('crew_member_name', value)}
                options={tripulantes.map(t => ({
                  id: t.id,
                  label: t.full_name
                }))}
                placeholder="Digite o nome ou selecione"
                isLoading={isLoadingTripulantes}
                onSelect={(option) => {
                  const selectedCrew = tripulantes.find(t => t.id === option.id);
                  if (selectedCrew) {
                    handleInputChange('crew_member_id', option.id);
                    handleInputChange('crew_member_name', selectedCrew.full_name);
                  }
                }}
              />
              {!currentReport.crew_member_id && currentReport.crew_member_name && (
                <p className="text-xs text-yellow-600">⚠️ Entrada manual</p>
              )}
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
                <AutocompleteInput
                  label="Tripulante 2"
                  value={currentReport.crew_member_name_2 || ''}
                  onChange={(value) => handleInputChange('crew_member_name_2', value)}
                  options={tripulantes.map(t => ({
                    id: t.id,
                    label: t.full_name
                  }))}
                  placeholder="Digite o nome ou selecione"
                  isLoading={isLoadingTripulantes}
                  onSelect={(option) => {
                    const selectedCrew = tripulantes.find(t => t.id === option.id);
                    if (selectedCrew) {
                      handleInputChange('crew_member_name_2', selectedCrew.full_name);
                    }
                  }}
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
              <Label>Data Início *</Label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-white" />
                    {currentReport.start_date
                      ? format(new Date(currentReport.start_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione a data"}
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
              <Label>Data Fim *</Label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-white" />
                    {currentReport.end_date
                      ? format(new Date(currentReport.end_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione a data"}
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
                <p className="text-sm text-green-600 font-semibold mt-2 p-2 bg-green-50 rounded">
                  ✓ Duração da Viagem: <strong>{calculateDays(currentReport.start_date, currentReport.end_date)} dia(s)</strong>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={currentReport.observations || ''}
            onChange={(e) => handleInputChange('observations', e.target.value)}
            className="h-32"
            placeholder="Adicione observações importantes sobre a viagem ou despesas..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Despesas da Viagem</CardTitle>
          <Button onClick={addExpense} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Despesa
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentReport.expenses?.map((expense, index) => (
            <div key={expense.id || index} className="border p-4 rounded-lg shadow-sm relative">
              <h3 className="text-md font-medium mb-3">Item de Despesa #{index + 1}</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Categoria *</Label>
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
                  <Label>Valor (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expense.amount}
                    onChange={(e) => handleExpenseChange(index, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Pago Por *</Label>
                  <ControlledSelect
                    value={expense.paid_by}
                    onValueChange={(value) => handleExpenseChange(index, 'paid_by', value)}
                    placeholder="Selecione"
                  >
                    <ControlledSelectItem value="Tripulante 1">
                      {currentReport.crew_member_name ? `Tripulante 1 (${currentReport.crew_member_name})` : 'Tripulante 1'}
                    </ControlledSelectItem>
                    {(showSecondCrew || currentReport.crew_member_name_2) && (
                      <ControlledSelectItem value="Tripulante 2">
                        {currentReport.crew_member_name_2 ? `Tripulante 2 (${currentReport.crew_member_name_2})` : 'Tripulante 2'}
                      </ControlledSelectItem>
                    )}
                    <ControlledSelectItem value="Cliente">Cliente</ControlledSelectItem>
                    <ControlledSelectItem value="ShareBrasil">ShareBrasil</ControlledSelectItem>
                  </ControlledSelect>
                </div>

                <div className="space-y-2">
                  <Label>Comprovante</Label>
                  <div className="flex items-center space-x-2">
                    <label htmlFor={`receipt-upload-${index}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center space-x-2 px-3 py-2 border rounded-md hover:bg-accent transition-colors">
                        {uploadingIndex === index ? (
                          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                        ) : expense.receipt_url ? (
                          <FileText className="h-5 w-5 text-green-600" />
                        ) : (
                          <Upload className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span className="text-sm truncate">
                          {expense.receipt_url ? 'Comprovante Anexado' : 'Fazer Upload'}
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
                        className="p-1.5 rounded-full hover:bg-accent transition-colors"
                        title="Ver Comprovante"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label>Descrição Detalhada</Label>
                <Input
                  value={expense.description}
                  onChange={(e) => handleExpenseChange(index, 'description', e.target.value)}
                  placeholder="Breve descrição da despesa"
                />
              </div>

              {currentReport.expenses.length > 0 && (
                <button
                  onClick={() => removeExpense(index)}
                  className="absolute top-4 right-4 text-destructive hover:text-destructive/80 p-1 rounded-full"
                  title="Remover Despesa"
                >
                  <Trash2 className="h-5 w-5" />
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
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Salvando...' : 'Salvar Rascunho'}
        </Button>
        <Button
          onClick={() => handleSave('Finalizado')}
          disabled={isSaving}
          className="w-full md:w-auto"
          size="lg"
        >
          <Send className="h-4 w-4 mr-2" />
          {isSaving ? 'Salvando...' : 'FINALIZAR RELATORIO'}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Voltar ao Histórico
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Por Pagador (R$)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 p-3 border rounded-md bg-muted/50">
              <div className="flex justify-between text-sm">
                <span>{currentReport.crew_member_name ? `Tripulante 1 (${currentReport.crew_member_name}):` : 'Tripulante 1:'}</span>
                <span className="font-medium">R$ {(currentReport.total_crew1 || 0).toFixed(2)}</span>
              </div>
              {(showSecondCrew || currentReport.crew_member_name_2) && (
                <div className="flex justify-between text-sm">
                  <span>{currentReport.crew_member_name_2 ? `Tripulante 2 (${currentReport.crew_member_name_2}):` : 'Tripulante 2:'}</span>
                  <span className="font-medium">R$ {(currentReport.total_crew2 || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>Cliente:</span>
                <span className="font-medium">R$ {currentReport.total_client.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>ShareBrasil:</span>
                <span className="font-medium">R$ {currentReport.total_sharebrasil.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                <span>TOTAL:</span>
                <span className="text-green-600">R$ {currentReport.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Por Categoria (R$)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 p-3 border rounded-md bg-muted/50">
              <div className="flex justify-between text-sm">
                <span>Combustível:</span>
                <span className="font-medium">R$ {currentReport.total_fuel.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Hospedagem:</span>
                <span className="font-medium">R$ {currentReport.total_lodging.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Alimentação:</span>
                <span className="font-medium">R$ {currentReport.total_food.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Transporte:</span>
                <span className="font-medium">R$ {currentReport.total_transport.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Outros:</span>
                <span className="font-medium">R$ {currentReport.total_other.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                <span>TOTAL:</span>
                <span className="text-green-600">R$ {currentReport.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
