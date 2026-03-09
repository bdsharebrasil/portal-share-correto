import { useCallback } from 'react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { parseBRL } from '@/lib/utils';
import { updateCrewFlightHours } from '@/services/crewFlightHours';
import type { FlightFormData, FlightCategory, CrewMember } from '../types';

interface SubmitParams {
  formData: FlightFormData;
  date: Date;
  flightCategory: FlightCategory;
  specialFlightType: string;
  selectedClient: string;
  selectedBorrowerClient: string;
  selectedClientPartner: string | null;
  selectedBorrowerPartner: string | null;
  selectedPic: string;
  selectedSic: string;
  sicName: string;
  dailyCount: string;
  aircraftDailyRate: number | null;
  hasDailyRate: boolean;
  passengers: string;
  cargoKg: string;
  occurrences: string;
  discrepancies: string;
  allCrew: CrewMember[];
  allClients: { id: string; company_name: string; proprietario?: string }[];
}

export function useFlightSubmit(
  aircraftId: string,
  logbookMonthId?: string | null,
  onSuccess?: () => void
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = useCallback(async (params: SubmitParams) => {
    const {
      formData, date, flightCategory, specialFlightType,
      selectedClient, selectedBorrowerClient,
      selectedClientPartner, selectedBorrowerPartner,
      selectedPic, selectedSic, sicName,
      dailyCount, aircraftDailyRate, hasDailyRate,
      passengers, cargoKg, occurrences, discrepancies,
      allCrew, allClients,
    } = params;

    // Calculate flight time
    const flightHours = parseFloat(formData.flight_time_hours) || 0;
    const flightMinutes = parseFloat(formData.flight_time_minutes) || 0;
    const flightTime = flightHours + flightMinutes / 60;

    // Calculate block time
    const acTimeParts = formData.ac_time.split(':').map(Number);
    const corTimeParts = formData.cor_time.split(':').map(Number);
    const acTotalMinutes = acTimeParts[0] * 60 + acTimeParts[1];
    const corTotalMinutes = corTimeParts[0] * 60 + corTimeParts[1];
    let blockMinutes = corTotalMinutes - acTotalMinutes;
    if (blockMinutes < 0) blockMinutes += 24 * 60;
    const totalBlockTime = blockMinutes / 60;

    // Night time
    const nightHours = parseFloat(formData.night_time_hours) || 0;
    const nightMinutes = parseFloat(formData.night_time_minutes) || 0;
    const totalNight = nightHours + nightMinutes / 60;
    const totalDay = Math.max(0, totalBlockTime - totalNight);

    // Daily rate - calcular apenas se tem diária configurada e quantidade > 0
    let finalDailyRate: number | null = null;
    const dailyQty = parseInt(dailyCount) || 0;
    if (hasDailyRate && dailyQty > 0 && aircraftDailyRate && aircraftDailyRate > 0) {
      finalDailyRate = dailyQty * aircraftDailyRate;
    }

    // Flight nature
    const flightNature = flightCategory === 'rateio'
      ? specialFlightType.toUpperCase()
      : flightCategory === 'emprestimo'
        ? 'EP'
        : 'PV';

    // Partner fields
    let entryClientPartnerId: string | null = null;
    let entryLoanRecipientClientId: string | null = null;
    let entryLoanRecipientPartnerId: string | null = null;

    if (flightCategory === 'cliente') {
      entryClientPartnerId = selectedClientPartner || null;
    } else if (flightCategory === 'emprestimo') {
      entryLoanRecipientClientId = selectedBorrowerClient || null;
      entryLoanRecipientPartnerId = selectedBorrowerPartner || null;
    }

    let borrowerPartnerName = '';
    if (flightCategory === 'emprestimo' && selectedBorrowerClient) {
      const borrowerClient = allClients.find(c => c.id === selectedBorrowerClient);
      borrowerPartnerName = borrowerClient?.company_name || '';
    }

    const { data: insertedEntry, error } = await supabase.from('logbook_entries').insert([
      {
        logbook_month_id: typeof logbookMonthId !== 'undefined' ? logbookMonthId : null,
        aircraft_id: aircraftId,
        entry_date: format(date, 'yyyy-MM-dd'),
        departure_aerodrome: formData.departure_airport,
        arrival_aerodrome: formData.arrival_airport,
        flight_nature: flightNature,
        client_id: selectedClient,
        partner_name: flightCategory === 'emprestimo' ? borrowerPartnerName : null,
        is_equal_split: flightCategory === 'rateio',
        is_loan: flightCategory === 'emprestimo',
        pic_canac: selectedPic,
        sic_canac: selectedSic || null,
        sic_name: sicName || null,
        ac_time: formData.ac_time,
        dep_time: formData.departure_time,
        pou_time: formData.pou_time,
        cor_time: formData.cor_time,
        crew_checkin_time: formData.crew_checkin_time,
        time: flightTime,
        total_time: totalBlockTime,
        day_time: totalDay,
        night_hours: totalNight,
        ifr_time: parseFloat(formData.ifr_count) || 0,
        pousos: parseInt(formData.landings) || 1,
        fuel_added: parseFloat(formData.fuel_added) || 0,
        celula: parseFloat(formData.fuel_cell) || 0,
        daily_rate: finalDailyRate || (formData.daily_rate ? parseBRL(formData.daily_rate) : null),
        distance_nm: parseFloat(formData.distance_nm) || 0,
        passengers: parseInt(passengers) || 0,
        cargo_kg: parseFloat(cargoKg) || 0,
        occurrences: occurrences || null,
        discrepancies: discrepancies || null,
        trecho: `${formData.departure_airport || ''} → ${formData.arrival_airport || ''}`,
      },
    ]).select().single();

    if (error) throw error;

    // Update crew flight hours
    if (insertedEntry) {
      try {
        await updateCrewFlightHours({
          picId: selectedPic,
          sicId: selectedSic || null,
          aircraftId,
          month: date.getMonth() + 1,
          year: date.getFullYear(),
          totalTime: totalBlockTime,
          ifrTime: parseFloat(formData.ifr_count) || 0,
          nightHours: totalNight,
          flightDay: format(date, 'yyyy-MM-dd'),
          operation: 'add',
        });
      } catch (error) {
        console.error('Erro ao atualizar horas de voo:', error);
        toast({
          title: 'Aviso',
          description: 'Voo registrado, mas houve erro ao atualizar horas de voo da tripulação.',
          variant: 'destructive',
        });
      }
    }

    // Handle loan
    if (flightCategory === 'emprestimo' && insertedEntry) {
      const picName = selectedPic ? (allCrew.find(p => p.id === selectedPic)?.full_name || null) : null;

      const { error: loanError } = await supabase.from('aircraft_loans').insert([{
        lender_aircraft_id: aircraftId,
        lender_client_id: selectedClient,
        borrower_client_id: selectedBorrowerClient,
        hours_borrowed: totalBlockTime,
        entry_date: format(date, 'yyyy-MM-dd'),
        departure_aerodrome: formData.departure_airport || '',
        arrival_aerodrome: formData.arrival_airport || '',
        trecho: `${formData.departure_airport || ''} → ${formData.arrival_airport || ''}`,
        fuel_added: parseFloat(formData.fuel_added) || null,
        pic_name: picName,
        logbook_entry_id: insertedEntry.id,
        status: 'active',
        notes: `Empréstimo registrado via diário de bordo - ${formData.departure_airport} → ${formData.arrival_airport}`,
      }]);

      if (loanError) {
        console.error('❌ Erro ao registrar empréstimo:', loanError);
      }

      const { error: transactionError } = await supabase.from('hour_transactions').insert([{
        aircraft_id: aircraftId,
        from_partner_id: selectedBorrowerClient,
        to_partner_id: selectedClient,
        hours: totalBlockTime,
        type: 'loan',
        description: `Empréstimo: ${formData.departure_airport} → ${formData.arrival_airport} - Cliente usou aeronave emprestada`,
        logbook_entry_id: insertedEntry.id,
      }]);

      if (transactionError && transactionError.code !== '403') {
        console.error('Erro ao registrar transação no banco de horas:', transactionError);
        toast({
          title: 'Atenção',
          description: 'Voo registrado, mas houve erro ao registrar no banco de horas.',
          variant: 'destructive',
        });
      }
    }

    toast({ title: 'Sucesso!', description: 'Registro adicionado com sucesso.' });
    queryClient.invalidateQueries({ queryKey: ['logbook-entries'] });
    queryClient.invalidateQueries({ queryKey: ['aircraft'] });
    onSuccess?.();
  }, [aircraftId, logbookMonthId, onSuccess, toast, queryClient]);

  return { handleSubmit };
}
