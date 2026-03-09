// index.tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

// Components
import { FormHeader } from './components/FormHeader';
import { Step1Form } from './components/Step1Form';
import { Step2Form } from './components/Step2Form';
import { PartnerSelectDialog } from './components/PartnerSelectDialog';

// Hooks
import { useLogbookForm } from '@/hooks/useLogbookForm';
import { useFlightQueries } from './hooks/useFlightQueries';
import { useFlightValidation } from './hooks/useFlightValidation';
import { usePartners } from './hooks/usePartners';
import { useFlightSubmit } from './hooks/useFlightSubmit';

// Types
import type { FlightCategory } from './types';

interface DynamicLogbookFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  logbookMonthId?: string | null;
  prefilledDate?: Date;
  onSuccess?: () => void;
  inline?: boolean;
  lastArrivalAerodrome?: string;
}

export function DynamicLogbookForm({
  open,
  onOpenChange,
  aircraftId,
  logbookMonthId,
  prefilledDate,
  onSuccess,
  inline = false,
  lastArrivalAerodrome,
}: DynamicLogbookFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Date
  const [date, setDate] = useState<Date | undefined>(() => prefilledDate ?? new Date());
  const [dateText, setDateText] = useState<string>(() =>
    format(prefilledDate ?? new Date(), 'dd/MM/yyyy')
  );

  // Flight category
  const [flightCategory, setFlightCategory] = useState<FlightCategory>('cliente');
  const [specialFlightType, setSpecialFlightType] = useState<string>('');

  // Clients
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedBorrowerClient, setSelectedBorrowerClient] = useState<string>('');

  // Partners
  const [selectedClientPartner, setSelectedClientPartner] = useState<string | null>(null);
  const [selectedLenderPartner, setSelectedLenderPartner] = useState<string | null>(null);
  const [selectedBorrowerPartner, setSelectedBorrowerPartner] = useState<string | null>(null);
  const [clientPartnerModalOpen, setClientPartnerModalOpen] = useState(false);
  const [lenderPartnerModalOpen, setLenderPartnerModalOpen] = useState(false);
  const [borrowerPartnerModalOpen, setBorrowerPartnerModalOpen] = useState(false);

  // Crew
  const [selectedPic, setSelectedPic] = useState<string>('');
  const [selectedSic, setSelectedSic] = useState<string>('');
  const [sicName, setSicName] = useState<string>('');

  // Additional fields
  const [passengers, setPassengers] = useState<string>('');
  const [cargoKg, setCargoKg] = useState<string>('');
  const [occurrences, setOccurrences] = useState<string>('');
  const [discrepancies, setDiscrepancies] = useState<string>('');
  const [dailyCount, setDailyCount] = useState<string>('');
  const [baseAerodrome, setBaseAerodrome] = useState<string | null>(null);
  const [aircraftDailyRate, setAircraftDailyRate] = useState<number | null>(null);

  // Custom hooks
  const { formData, updateField, resetForm } = useLogbookForm(
    useFlightQueries(aircraftId, logbookMonthId).aerodromes
  );

  const {
    allCrew,
    aerodromes,
    clients,
    allClients,
    logbookMonth,
    getClientName,
  } = useFlightQueries(aircraftId, logbookMonthId);

  const { validateStep1, validateStep2 } = useFlightValidation();

  const { clientPartners, lenderPartners, borrowerPartners } = usePartners(
    selectedClient,
    selectedBorrowerClient,
    flightCategory
  );

  const { handleSubmit: submitFlight } = useFlightSubmit(
    aircraftId,
    logbookMonthId,
    onSuccess
  );

  // Check if aircraft has daily rate
  const hasDailyRate = logbookMonth?.has_daily_rate ?? true;

  // Update base_aerodrome and daily_rate when logbookMonth changes
  useEffect(() => {
    if (logbookMonth) {
      setBaseAerodrome(logbookMonth.base_aerodrome);
      setAircraftDailyRate(logbookMonth.daily_rate);
    }
  }, [logbookMonth]);

  // Reset partner when client changes
  useEffect(() => {
    setSelectedClientPartner(null);
    setSelectedLenderPartner(null);
  }, [selectedClient]);

  useEffect(() => {
    setSelectedBorrowerPartner(null);
  }, [selectedBorrowerClient]);

  // Auto-fill daily count if out of base
  useEffect(() => {
    if (!hasDailyRate) {
      setDailyCount('');
      return;
    }

    if (!baseAerodrome || !formData.departure_airport || !formData.arrival_airport) {
      setDailyCount('');
      return;
    }

    const isOutOfBase =
      (formData.departure_airport !== baseAerodrome && formData.arrival_airport !== baseAerodrome) ||
      (formData.departure_airport === baseAerodrome && formData.arrival_airport !== baseAerodrome) ||
      (formData.departure_airport !== baseAerodrome && formData.arrival_airport === baseAerodrome);

    if (isOutOfBase && !dailyCount) {
      setDailyCount('1');
    }
  }, [baseAerodrome, formData.departure_airport, formData.arrival_airport, aircraftDailyRate, dailyCount, hasDailyRate]);

  // Initialize date when form opens
  useEffect(() => {
    if (!open) return;
    const initial = prefilledDate ?? new Date();
    setDate(initial);
    setDateText(format(initial, 'dd/MM/yyyy'));
  }, [open, prefilledDate]);

  // Update entry_date when date changes
  useEffect(() => {
    if (date) {
      updateField('entry_date', format(date, 'yyyy-MM-dd'));
      setDateText(format(date, 'dd/MM/yyyy'));
    } else {
      setDateText('');
    }
  }, [date, updateField]);

  // Navigation
  const nextStep = () => {
    const isValid = validateStep1(
      date,
      formData,
      flightCategory,
      selectedPic,
      selectedClient,
      selectedBorrowerClient,
      specialFlightType
    );

    if (isValid) {
      setStep(2);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(1);
    }
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep2(formData)) return;

    setLoading(true);

    try {
      await submitFlight({
        formData,
        date: date!,
        flightCategory,
        specialFlightType,
        selectedClient,
        selectedBorrowerClient,
        selectedClientPartner,
        selectedBorrowerPartner,
        selectedPic,
        selectedSic,
        sicName,
        dailyCount,
        aircraftDailyRate,
        hasDailyRate,
        passengers,
        cargoKg,
        occurrences,
        discrepancies,
        allCrew,
        allClients,
      });

      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['logbook-entries'] });
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });

      setTimeout(() => {
        handleClose();
      }, 700);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao adicionar registro.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Close and reset
  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setDate(undefined);
      setDateText('');
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
      setLoading(false);
    }, 300);
  };

  // Render content
  const renderContent = () => (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {step === 1 && (
        <Step1Form
          date={date}
          dateText={dateText}
          onDateChange={setDate}
          onDateTextChange={setDateText}
          formData={formData}
          onFieldChange={updateField}
          flightCategory={flightCategory}
          onFlightCategoryChange={setFlightCategory}
          specialFlightType={specialFlightType}
          onSpecialFlightTypeChange={setSpecialFlightType}
          selectedClient={selectedClient}
          onClientChange={setSelectedClient}
          selectedBorrowerClient={selectedBorrowerClient}
          onBorrowerClientChange={setSelectedBorrowerClient}
          clients={clients}
          allClients={allClients}
          getClientName={getClientName}
          clientPartners={clientPartners}
          lenderPartners={lenderPartners}
          borrowerPartners={borrowerPartners}
          selectedClientPartner={selectedClientPartner}
          selectedLenderPartner={selectedLenderPartner}
          selectedBorrowerPartner={selectedBorrowerPartner}
          onClientPartnerModalOpen={() => setClientPartnerModalOpen(true)}
          onLenderPartnerModalOpen={() => setLenderPartnerModalOpen(true)}
          onBorrowerPartnerModalOpen={() => setBorrowerPartnerModalOpen(true)}
          selectedPic={selectedPic}
          onPicChange={setSelectedPic}
          selectedSic={selectedSic}
          sicName={sicName}
          onSicChange={(sicId, sicNameValue) => {
            setSelectedSic(sicId ?? '');
            setSicName(sicNameValue ?? '');
          }}
          allCrew={allCrew}
          aerodromes={aerodromes}
        />
      )}

      {step === 2 && (
        <Step2Form
          formData={formData}
          onFieldChange={updateField}
          passengers={passengers}
          onPassengersChange={setPassengers}
          cargoKg={cargoKg}
          onCargoKgChange={setCargoKg}
          occurrences={occurrences}
          onOccurrencesChange={setOccurrences}
          discrepancies={discrepancies}
          onDiscrepanciesChange={setDiscrepancies}
          dailyCount={dailyCount}
          onDailyCountChange={setDailyCount}
          aircraftDailyRate={aircraftDailyRate}
          hasDailyRate={hasDailyRate}
          baseAerodrome={baseAerodrome}
          date={date}
          selectedClient={selectedClient}
          selectedPic={selectedPic}
          flightCategory={flightCategory}
          specialFlightType={specialFlightType}
          allCrew={allCrew}
          getClientName={getClientName}
        />
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between gap-2 pt-4 border-t border-border/50">
        <Button
          type="button"
          variant="ghost"
          onClick={handleClose}
          disabled={loading || saved}
        >
          Cancelar
        </Button>

        <div className="flex gap-2">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={loading || saved}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}

          {step === 1 ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={loading || saved}
              className="gap-1"
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={loading || saved}
              className="gap-2 min-w-32"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : saved ? (
                <>
                  <Check className="h-4 w-4" />
                  Salvo!
                </>
              ) : (
                'Salvar Trecho'
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  );

  // Render inline or dialog
  if (inline && open) {
    return (
      <div className="bg-slate-900 border-2 border-sky-500/20 rounded-3xl p-8 shadow-3xl space-y-8 max-h-[85vh] overflow-y-auto">
        <FormHeader step={step} saved={saved} />
        {renderContent()}

        {/* Partner Modals */}
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
      </div>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
          <FormHeader step={step} saved={saved} />
          {renderContent()}
        </DialogContent>
      </Dialog>

      {/* Partner Modals */}
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
}
