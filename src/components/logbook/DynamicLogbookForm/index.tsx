import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, ChevronRight, ChevronLeft, Plane } from 'lucide-react';
import { format } from 'date-fns';
import { useLogbookForm } from '@/hooks/useLogbookForm';
import { FormHeader } from './components/FormHeader';
import { Step1Form } from './components/Step1Form';
import { Step2Form } from './components/Step2Form';
import { PartnerSelectDialog } from './components/PartnerSelectDialog';
import { useFlightValidation } from './hooks/useFlightValidation';
import { useFlightSubmit } from './hooks/useFlightSubmit';
import { usePartners } from './hooks/usePartners';
import { useFlightQueries } from './hooks/useFlightQueries';
import type { DynamicLogbookFormProps, FlightCategory } from './types';

export function DynamicLogbookForm({
  open,
  onOpenChange,
  aircraftId,
  prefilledDate,
  onSuccess,
  logbookMonthId,
  inline = false,
}: DynamicLogbookFormProps) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const [date, setDate] = useState<Date | undefined>(() => prefilledDate ?? new Date());
  const [dateText, setDateText] = useState(() => format(prefilledDate ?? new Date(), 'dd/MM/yyyy'));

  const [dailyCount, setDailyCount] = useState('');
  const [flightCategory, setFlightCategory] = useState<FlightCategory>('cliente');
  const [specialFlightType, setSpecialFlightType] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedBorrowerClient, setSelectedBorrowerClient] = useState('');

  const [selectedLenderPartner, setSelectedLenderPartner] = useState<string | null>(null);
  const [selectedBorrowerPartner, setSelectedBorrowerPartner] = useState<string | null>(null);
  const [selectedClientPartner, setSelectedClientPartner] = useState<string | null>(null);
  const [lenderPartnerModalOpen, setLenderPartnerModalOpen] = useState(false);
  const [borrowerPartnerModalOpen, setBorrowerPartnerModalOpen] = useState(false);
  const [clientPartnerModalOpen, setClientPartnerModalOpen] = useState(false);

  const [selectedPic, setSelectedPic] = useState('');
  const [selectedSic, setSelectedSic] = useState('');
  const [sicName, setSicName] = useState('');

  const [passengers, setPassengers] = useState('');
  const [cargoKg, setCargoKg] = useState('');
  const [occurrences, setOccurrences] = useState('');
  const [discrepancies, setDiscrepancies] = useState('');

  // Hooks
  const { allCrew, aerodromes, clients, allClients, logbookMonth, getClientName } = useFlightQueries(aircraftId, logbookMonthId);
  const { formData, updateField, resetForm } = useLogbookForm(aerodromes);
  const { validateStep1, validateStep2 } = useFlightValidation();
  const { handleSubmit: submitFlight } = useFlightSubmit(aircraftId, logbookMonthId, onSuccess);
  const { clientPartners, lenderPartners, borrowerPartners } = usePartners(selectedClient, selectedBorrowerClient, flightCategory);

  const hasDailyRate = logbookMonth?.has_daily_rate ?? true;
  const baseAerodrome = logbookMonth?.base_aerodrome ?? null;
  const aircraftDailyRate = logbookMonth?.daily_rate ?? null;

  // Reset partner when client changes
  useEffect(() => { setSelectedClientPartner(null); setSelectedLenderPartner(null); }, [selectedClient]);
  useEffect(() => { setSelectedBorrowerPartner(null); }, [selectedBorrowerClient]);

  // Date sync
  useEffect(() => {
    if (!open) return;
    const initial = prefilledDate ?? new Date();
    setDate(initial);
    setDateText(format(initial, 'dd/MM/yyyy'));
  }, [open, prefilledDate]);

  useEffect(() => {
    if (prefilledDate) {
      setDate(prefilledDate);
      setDateText(format(prefilledDate, 'dd/MM/yyyy'));
      updateField('entry_date', format(prefilledDate, 'yyyy-MM-dd'));
    }
  }, [prefilledDate, updateField]);

  useEffect(() => {
    if (date) {
      updateField('entry_date', format(date, 'yyyy-MM-dd'));
      setDateText(format(date, 'dd/MM/yyyy'));
    } else {
      setDateText('');
    }
  }, [date, updateField]);

  // Auto daily count
  useEffect(() => {
    if (!hasDailyRate || !baseAerodrome || !formData.departure_airport || !formData.arrival_airport) {
      if (!hasDailyRate) setDailyCount('');
      return;
    }
    const isOutOfBase =
      (formData.departure_airport !== baseAerodrome && formData.arrival_airport !== baseAerodrome) ||
      (formData.departure_airport === baseAerodrome && formData.arrival_airport !== baseAerodrome) ||
      (formData.departure_airport !== baseAerodrome && formData.arrival_airport === baseAerodrome);
    if (isOutOfBase && !dailyCount) setDailyCount('1');
  }, [baseAerodrome, formData.departure_airport, formData.arrival_airport, aircraftDailyRate, dailyCount, hasDailyRate]);

  const handleCategoryChange = (category: FlightCategory) => {
    setFlightCategory(category);
    if (category === 'cliente') { setSpecialFlightType(''); setSelectedBorrowerClient(''); }
    if (category === 'rateio') { setSelectedClient(''); setSelectedBorrowerClient(''); }
    if (category === 'emprestimo') { setSpecialFlightType(''); }
  };

  const nextStep = () => {
    if (validateStep1(date, formData, flightCategory, selectedPic, selectedClient, selectedBorrowerClient, specialFlightType)) {
      setStep(2);
    }
  };

  const resetAll = () => {
    setStep(1);
    setDailyCount('');
    setFlightCategory('cliente');
    setSpecialFlightType('');
    setSelectedClient('');
    setSelectedBorrowerClient('');
    setSelectedClientPartner(null);
    setSelectedLenderPartner(null);
    setSelectedBorrowerPartner(null);
    setSelectedPic('');
    setSelectedSic('');
    setSicName('');
    setPassengers('');
    setCargoKg('');
    setOccurrences('');
    setDiscrepancies('');
    resetForm();
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2(formData) || !date) return;

    setLoading(true);
    try {
      await submitFlight({
        formData, date, flightCategory, specialFlightType,
        selectedClient, selectedBorrowerClient,
        selectedClientPartner, selectedBorrowerPartner,
        selectedPic, selectedSic, sicName,
        dailyCount, aircraftDailyRate, hasDailyRate,
        passengers, cargoKg, occurrences, discrepancies,
        allCrew, allClients,
      });
      setSaved(true);
      setTimeout(() => { onOpenChange(false); resetAll(); }, 700);
    } catch (error: any) {
      // Error is handled inside useFlightSubmit
    } finally {
      setLoading(false);
    }
  };

  // Shared form props
  const step1Props = {
    formData, updateField, date, dateText,
    onDateChange: setDate, onDateTextChange: setDateText,
    flightCategory, onFlightCategoryChange: handleCategoryChange,
    specialFlightType, onSpecialFlightTypeChange: setSpecialFlightType,
    selectedClient, onSelectedClientChange: setSelectedClient,
    selectedBorrowerClient, onSelectedBorrowerClientChange: setSelectedBorrowerClient,
    selectedPic, onSelectedPicChange: setSelectedPic,
    selectedSic, onSelectedSicChange: setSelectedSic,
    sicName, onSicNameChange: setSicName,
    selectedClientPartner, onClientPartnerModalOpen: () => setClientPartnerModalOpen(true),
    selectedLenderPartner, onLenderPartnerModalOpen: () => setLenderPartnerModalOpen(true),
    selectedBorrowerPartner, onBorrowerPartnerModalOpen: () => setBorrowerPartnerModalOpen(true),
    aerodromes, allCrew, clients, allClients,
    clientPartners, lenderPartners, borrowerPartners, getClientName,
  };

  const step2Props = {
    formData, updateField, date, flightCategory, specialFlightType,
    selectedClient, selectedPic,
    dailyCount, onDailyCountChange: setDailyCount,
    aircraftDailyRate, hasDailyRate,
    passengers, onPassengersChange: setPassengers,
    cargoKg, onCargoKgChange: setCargoKg,
    occurrences, onOccurrencesChange: setOccurrences,
    discrepancies, onDiscrepanciesChange: setDiscrepancies,
    allCrew, getClientName,
  };

  const navigationButtons = (
    <div className="flex justify-between gap-2 pt-4 border-t border-border/50">
      <Button type="button" variant="ghost" onClick={() => { onOpenChange(false); resetAll(); }} disabled={loading || saved}>
        Cancelar
      </Button>
      <div className="flex gap-2">
        {step > 1 && (
          <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={loading || saved} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
        )}
        {step === 1 ? (
          <Button type="button" onClick={nextStep} disabled={loading || saved} className="gap-1">
            Próximo <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" onClick={handleSubmit} disabled={loading || saved} className="gap-2 min-w-32">
            {loading ? (
              <><div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Salvando...</>
            ) : saved ? (
              <><Check className="h-4 w-4" /> Salvo!</>
            ) : (
              'Salvar Trecho'
            )}
          </Button>
        )}
      </div>
    </div>
  );

  const savedOverlay = saved && (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-background/80 backdrop-blur-sm">
      <div className="bg-success/20 rounded-full p-6 shadow-lg flex items-center justify-center animate-in zoom-in-50">
        <div className="h-16 w-16 rounded-full bg-success text-success-foreground flex items-center justify-center">
          <Check className="h-8 w-8" />
        </div>
      </div>
    </div>
  );

  const partnerModals = (
    <>
      <PartnerSelectDialog
        open={clientPartnerModalOpen}
        onOpenChange={setClientPartnerModalOpen}
        partners={clientPartners}
        selectedPartner={selectedClientPartner}
        onSelect={setSelectedClientPartner}
        title="Selecionar Parceiro do Cliente"
      />
      <PartnerSelectDialog
        open={lenderPartnerModalOpen}
        onOpenChange={setLenderPartnerModalOpen}
        partners={lenderPartners}
        selectedPartner={selectedLenderPartner}
        onSelect={setSelectedLenderPartner}
        title="Selecionar Parceiro do Cotista"
      />
      <PartnerSelectDialog
        open={borrowerPartnerModalOpen}
        onOpenChange={setBorrowerPartnerModalOpen}
        partners={borrowerPartners}
        selectedPartner={selectedBorrowerPartner}
        onSelect={setSelectedBorrowerPartner}
        title="Selecionar Parceiro do Cliente"
      />
    </>
  );

  // Inline rendering
  if (inline && open) {
    return (
      <>
        <div className="bg-card border-2 border-primary/20 rounded-3xl p-8 shadow-xl space-y-8 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center gap-3 mb-6">
            <Plane className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Novo Trecho de Voo</h2>
            <button onClick={() => onOpenChange(false)} className="ml-auto p-2 hover:bg-muted rounded-xl text-muted-foreground">✕</button>
          </div>
          <FormHeader step={step} inline />
          {savedOverlay}
          <form className="space-y-6">
            {step === 1 && <Step1Form {...step1Props} />}
            {step === 2 && <Step2Form {...step2Props} />}
            {navigationButtons}
          </form>
        </div>
        {partnerModals}
      </>
    );
  }

  // Dialog rendering
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
          <FormHeader step={step} />
          {savedOverlay}
          <form className="p-6 space-y-6">
            {step === 1 && <Step1Form {...step1Props} />}
            {step === 2 && <Step2Form {...step2Props} />}
            {navigationButtons}
          </form>
        </DialogContent>
      </Dialog>
      {partnerModals}
    </>
  );
}
