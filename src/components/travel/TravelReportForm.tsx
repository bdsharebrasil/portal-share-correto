import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, Save, Upload, X, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Expense {
  category: string;
  description: string;
  amount: string;
  paid_by: string;
  date?: string;
  receipt_url?: string;
  receipt_file?: File;
}

interface TravelReportFormProps {
  onSave: () => void;
  onCancel: () => void;
}

interface CrewMember {
  id: string;
  full_name: string;
  canac: string;
}

export function TravelReportForm({ onSave, onCancel }: TravelReportFormProps) {
  const [clients, setClients] = useState<any[]>([]);
  const [aircraft, setAircraft] = useState<any[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [filteredCrew1, setFilteredCrew1] = useState<CrewMember[]>([]);
  const [filteredCrew2, setFilteredCrew2] = useState<CrewMember[]>([]);
  const [showCrewDropdown1, setShowCrewDropdown1] = useState(false);
  const [showCrewDropdown2, setShowCrewDropdown2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const [formData, setFormData] = useState({
    cotista: "",
    aeronave: "",
    tripulante: "",
    tripulante_id: "",
    tripulante2: "",
    tripulante2_id: "",
    destination: "",
    route: "",
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    description: ""
  });

  const [expenses, setExpenses] = useState<Expense[]>([
    { category: "", description: "", amount: "", paid_by: "", date: "" }
  ]);

  const [totals, setTotals] = useState({
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
    total_amount: 0
  });

  useEffect(() => {
    loadClients();
    loadAircraft();
    loadCrewMembers();
  }, []);

  useEffect(() => {
    calculateTotals();
  }, [expenses]);

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('status', 'ativo')
      .order('company_name');
    if (data) setClients(data);
  };

  const loadAircraft = async () => {
    const { data } = await supabase
      .from('aircraft')
      .select('*')
      .eq('status', 'ativa')
      .order('registration');
    if (data) setAircraft(data);
  };

  const loadCrewMembers = async () => {
    const { data } = await supabase
      .from('crew_members')
      .select('id, full_name, canac')
      .eq('status', 'ativo')
      .order('full_name');
    if (data) {
      setCrewMembers(data);
      setFilteredCrew1(data);
      setFilteredCrew2(data);
    }
  };

  const handleCrewSearch1 = (value: string) => {
    setFormData(prev => ({ ...prev, tripulante: value }));

    if (value.trim()) {
      const filtered = crewMembers.filter(crew =>
        crew.full_name.toLowerCase().includes(value.toLowerCase()) ||
        crew.canac.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCrew1(filtered);
      setShowCrewDropdown1(true);
    } else {
      setFilteredCrew1(crewMembers);
      setShowCrewDropdown1(false);
    }
  };

  const handleCrewSearch2 = (value: string) => {
    setFormData(prev => ({ ...prev, tripulante2: value }));

    if (value.trim()) {
      const filtered = crewMembers.filter(crew =>
        crew.full_name.toLowerCase().includes(value.toLowerCase()) ||
        crew.canac.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCrew2(filtered);
      setShowCrewDropdown2(true);
    } else {
      setFilteredCrew2(crewMembers);
      setShowCrewDropdown2(false);
    }
  };

  const selectCrewMember1 = (crew: CrewMember) => {
    setFormData(prev => ({ ...prev, tripulante: crew.full_name, tripulante_id: crew.id }));
    setShowCrewDropdown1(false);
  };

  const selectCrewMember2 = (crew: CrewMember) => {
    setFormData(prev => ({ ...prev, tripulante2: crew.full_name, tripulante2_id: crew.id }));
    setShowCrewDropdown2(false);
  };

  const clearCrewMember2 = () => {
    setFormData(prev => ({ ...prev, tripulante2: '', tripulante2_id: '' }));
  };

  const addExpense = () => {
    setExpenses([...expenses, { category: "", description: "", amount: "", paid_by: "", date: "" }]);
  };

  const removeExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  const updateExpense = (index: number, field: keyof Expense, value: string | File) => {
    const newExpenses = [...expenses];
    if (field === 'receipt_file' && value instanceof File) {
      newExpenses[index] = { ...newExpenses[index], receipt_file: value };
    } else if (typeof value === 'string') {
      newExpenses[index] = { ...newExpenses[index], [field]: value } as Expense;
    }
    setExpenses(newExpenses);
  };

  const handleFileUpload = async (file: File, expenseIndex: number): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('travel-reports')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('travel-reports')
        .getPublicUrl(filePath);

      // Store metadata for later use when creating attachments table entry
      return publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao fazer upload do comprovante');
      return null;
    }
  };

  const saveAttachment = async (reportId: string, expenseIndex: number, file: File, fileUrl: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `receipts/${Math.random()}.${fileExt}`;

      const { error } = await supabase
        .from('travel_report_attachments')
        .insert([{
          travel_report_id: reportId,
          expense_index: expenseIndex,
          file_name: file.name,
          file_path: filePath,
          file_url: fileUrl,
          file_type: file.type,
          file_size: file.size
        }]);

      if (error) {
        console.warn('Aviso ao salvar attachment:', error);
      }
    } catch (error) {
      console.error('Erro ao salvar attachment:', error);
    }
  };

  const calculateTotals = () => {
    const newTotals = {
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
      total_amount: 0
    };

    expenses.forEach(expense => {
      const amount = parseFloat(expense.amount) || 0;

      switch (expense.category) {
        case 'Combustível':
          newTotals.total_fuel += amount;
          break;
        case 'Hospedagem':
          newTotals.total_lodging += amount;
          break;
        case 'Alimentação':
          newTotals.total_food += amount;
          break;
        case 'Transporte':
          newTotals.total_transport += amount;
          break;
        default:
          newTotals.total_other += amount;
      }

      switch (expense.paid_by) {
        case 'Tripulante 1':
          newTotals.total_crew1 += amount;
          newTotals.total_crew += amount;
          break;
        case 'Tripulante 2':
          newTotals.total_crew2 += amount;
          newTotals.total_crew += amount;
          break;
        case 'Cliente':
          newTotals.total_client += amount;
          break;
        case 'ShareBrasil':
          newTotals.total_sharebrasil += amount;
          break;
      }
    });

    newTotals.total_amount = newTotals.total_crew + newTotals.total_client + newTotals.total_sharebrasil;
    setTotals(newTotals);
  };

  const calculateDays = () => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return 1;
  };

  // Get paid_by options based on whether tripulante 2 is selected
  const getPaidByOptions = () => {
    const options = [
      { value: 'Tripulante 1', label: formData.tripulante ? `Tripulante 1 - ${formData.tripulante}` : 'Tripulante 1' },
    ];

    if (formData.tripulante2) {
      options.push({ value: 'Tripulante 2', label: `Tripulante 2 - ${formData.tripulante2}` });
    }

    options.push(
      { value: 'Cliente', label: 'Cliente' },
      { value: 'ShareBrasil', label: 'ShareBrasil' }
    );

    return options;
  };

  const handleSave = async () => {
    if (!formData.cotista || !formData.aeronave || !formData.tripulante) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (!formData.destination) {
      toast.error("Destino é obrigatório");
      return;
    }

    if (expenses.every(e => !e.description || !e.amount)) {
      toast.error("Adicione pelo menos uma despesa");
      return;
    }

    setLoading(true);

    try {
      const expensesWithReceipts = await Promise.all(
        expenses.map(async (expense) => {
          if (expense.receipt_file) {
            const url = await handleFileUpload(expense.receipt_file, 0);
            return { ...expense, receipt_url: url || undefined, receipt_file: undefined };
          }
          return expense;
        })
      );

      const year = new Date().getFullYear();
      const currentClient = clients.find(c => c.id === formData.cotista);

      const { data: existingReports, count } = await supabase
        .from('travel_expense_reports')
        .select('*', { count: 'exact', head: false })
        .order('created_at', { ascending: false });

      let nextNumber = (count || 0) + 1;

      const reportNumber = `REL ${String(nextNumber).padStart(3, '0')}/${String(year).slice(-2)}`;

      const despesasData = expensesWithReceipts
        .filter(e => e.description && e.amount)
        .map(e => ({
          categoria: e.category,
          descricao: e.description,
          valor: parseFloat(e.amount) || 0,
          pago_por: e.paid_by,
          comprovante_url: e.receipt_url || ''
        }));

      const { data: report, error: reportError } = await supabase
        .from('travel_expense_reports')
        .insert([{
          report_number: reportNumber,
          client_id: formData.cotista,
          client: currentClient?.company_name || formData.cotista,
          aircraft_id: formData.aeronave,
          aircraft_registration: formData.aeronave,
          crew_member_id: formData.tripulante_id,
          crew_member_name: formData.tripulante,
          crew_member_name_2: formData.tripulante2 || '',
          route: formData.route || '',
          start_date: formData.start_date,
          end_date: formData.end_date,
          days_count: calculateDays(),
          observations: formData.description,
          total_fuel: totals.total_fuel,
          total_lodging: totals.total_lodging,
          total_food: totals.total_food,
          total_transport: totals.total_transport,
          total_other: totals.total_other,
          total_crew: totals.total_crew,
          total_client: totals.total_client,
          total_sharebrasil: totals.total_sharebrasil,
          total_amount: totals.total_amount
        }])
        .select()
        .single();

      if (reportError) throw reportError;

      // Salvar attachments das despesas
      if (report && report.id) {
        for (let i = 0; i < expensesWithReceipts.length; i++) {
          const expense = expensesWithReceipts[i];
          if (expense.receipt_url && expenses[i].receipt_file) {
            await saveAttachment(report.id, i, expenses[i].receipt_file, expense.receipt_url);
          }
        }
      }

      // Criar entrada na conciliação bancária com categoria "RELATORIO DE DESPESA DE VIAGEM"
      if (report && report.id) {
        const creationDate = new Date().toISOString().split('T')[0];
        // Formato padrão da descrição para sincronização de payment_term
        const standardDescription = `RELATORIO DE VIAGEM - ${reportNumber} - STATUS PENDENTE`;

        const { error: reconciliationError } = await supabase
          .from('bank_reconciliations')
          .insert([{
            type: 'cliente',
            date: creationDate,
            description: standardDescription,
            amount: totals.total_amount,
            category: 'RELATORIO DE DESPESA DE VIAGEM',
            client_id: formData.cotista,
            aircraft_id: formData.aeronave,
            status: 'pendente',
            prazo_pagamento: null,
            criado_por: ''
          }]);

        if (reconciliationError) {
          console.warn('Aviso: Entrada de conciliação não criada:', reconciliationError);
        }
      }

      toast.success("Relatório salvo como rascunho com sucesso!");
      onSave();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error(error.message || "Erro ao salvar relatório");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Novo Relatório de Viagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client">Cliente *</Label>
              <Select value={formData.cotista} onValueChange={(value) => setFormData({ ...formData, cotista: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aircraft">Aeronave *</Label>
              <Select value={formData.aeronave} onValueChange={(value) => setFormData({ ...formData, aeronave: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a aeronave" />
                </SelectTrigger>
                <SelectContent>
                  {aircraft.map(ac => (
                    <SelectItem key={ac.id} value={ac.id}>
                      {ac.registration}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="crew1">Tripulante 1 *</Label>
              <Input
                id="crew1"
                value={formData.tripulante}
                onChange={(e) => handleCrewSearch1(e.target.value)}
                onFocus={() => setShowCrewDropdown1(true)}
                placeholder="Digite para buscar..."
                autoComplete="off"
              />
              {showCrewDropdown1 && filteredCrew1.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredCrew1.map((crew) => (
                    <div
                      key={crew.id}
                      className="px-4 py-2 hover:bg-accent cursor-pointer"
                      onClick={() => selectCrewMember1(crew)}
                    >
                      <div className="font-medium">{crew.full_name}</div>
                      <div className="text-sm text-muted-foreground">CANAC: {crew.canac}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="crew2">Tripulante 2 (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  id="crew2"
                  value={formData.tripulante2}
                  onChange={(e) => handleCrewSearch2(e.target.value)}
                  onFocus={() => setShowCrewDropdown2(true)}
                  placeholder="Digite para buscar..."
                  autoComplete="off"
                  className="flex-1"
                />
                {formData.tripulante2 && (
                  <Button type="button" variant="ghost" size="icon" onClick={clearCrewMember2}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {showCrewDropdown2 && filteredCrew2.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredCrew2.map((crew) => (
                    <div
                      key={crew.id}
                      className="px-4 py-2 hover:bg-accent cursor-pointer"
                      onClick={() => selectCrewMember2(crew)}
                    >
                      <div className="font-medium">{crew.full_name}</div>
                      <div className="text-sm text-muted-foreground">CANAC: {crew.canac}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="route">Trecho</Label>
              <Input
                id="route"
                value={formData.route}
                onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                placeholder="Ex: Cuiabá x Campo Novo do Parecis"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination">Destino *</Label>
              <Input
                id="destination"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Data Início *</Label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-white" />
                    {formData.start_date
                      ? format(new Date(formData.start_date), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                  <UICalendar
                    mode="single"
                    selected={formData.start_date ? new Date(formData.start_date) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const formattedDate = `${year}-${month}-${day}`;
                        setFormData({ ...formData, start_date: formattedDate });
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
              <Label htmlFor="end_date">Data Fim *</Label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-white" />
                    {formData.end_date
                      ? format(new Date(formData.end_date), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                  <UICalendar
                    mode="single"
                    selected={formData.end_date ? new Date(formData.end_date) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const formattedDate = `${year}-${month}-${day}`;
                        setFormData({ ...formData, end_date: formattedDate });
                        setEndDateOpen(false);
                      }
                    }}
                    disabled={(date) => date > new Date() || (formData.start_date ? date < new Date(formData.start_date) : false)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Período: {calculateDays()} dia(s)</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Observações</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Despesas</CardTitle>
            <Button onClick={addExpense} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Despesa
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor (R$)</TableHead>
                <TableHead>Pago Por</TableHead>
                <TableHead>Comprovante</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Select
                      value={expense.category}
                      onValueChange={(value) => updateExpense(index, 'category', value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Combustível">Combustível</SelectItem>
                        <SelectItem value="Hospedagem">Hospedagem</SelectItem>
                        <SelectItem value="Alimentação">Alimentação</SelectItem>
                        <SelectItem value="Transporte">Transporte</SelectItem>
                        <SelectItem value="Outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={expense.date || ''}
                      onChange={(e) => updateExpense(index, 'date', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={expense.description}
                      onChange={(e) => updateExpense(index, 'description', e.target.value)}
                      placeholder="Descrição"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={expense.amount}
                      onChange={(e) => updateExpense(index, 'amount', e.target.value)}
                      placeholder="0,00"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={expense.paid_by}
                      onValueChange={(value) => updateExpense(index, 'paid_by', value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pago por" />
                      </SelectTrigger>
                      <SelectContent>
                        {getPaidByOptions().map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) updateExpense(index, 'receipt_file', file);
                        }}
                        className="hidden"
                        id={`file-${index}`}
                      />
                      <Label htmlFor={`file-${index}`} className="cursor-pointer">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <div>
                            <Upload className="h-4 w-4 mr-1" />
                            {expense.receipt_file ? 'Arquivo anexado' : 'Anexar'}
                          </div>
                        </Button>
                      </Label>
                      {expense.receipt_file && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => updateExpense(index, 'receipt_file', '')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeExpense(index)}
                      disabled={expenses.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumo Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3">Totais por Categoria</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Combustível:</span>
                  <span>R$ {totals.total_fuel.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hospedagem:</span>
                  <span>R$ {totals.total_lodging.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Alimentação:</span>
                  <span>R$ {totals.total_food.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transporte:</span>
                  <span>R$ {totals.total_transport.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Outros:</span>
                  <span>R$ {totals.total_other.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>TOTAL:</span>
                  <span>R$ {totals.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Totais por Pagador</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>{formData.tripulante ? `Tripulante 1 (${formData.tripulante}):` : 'Tripulante 1:'}</span>
                  <span>R$ {totals.total_crew1.toFixed(2)}</span>
                </div>
                {formData.tripulante2 && (
                  <div className="flex justify-between">
                    <span>Tripulante 2 ({formData.tripulante2}):</span>
                    <span>R$ {totals.total_crew2.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Cliente:</span>
                  <span>R$ {totals.total_client.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ShareBrasil:</span>
                  <span>R$ {totals.total_sharebrasil.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>TOTAL:</span>
                  <span>R$ {totals.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4 justify-end">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? "Salvando..." : "Salvar Relatório"}
        </Button>
      </div>
    </div>
  );
}
