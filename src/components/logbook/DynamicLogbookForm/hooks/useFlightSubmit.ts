import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FlightFormData, FlightCategory } from '../types';

export function useFlightSubmit() {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const submitFlight = async (
    aircraftId: string,
    logbookMonthId: string | null | undefined,
    formData: FlightFormData,
    flightCategory: FlightCategory,
    specialFlightType: string,
    selectedPic: string,
    selectedSic: string,
    onSuccess?: () => void
  ): Promise<boolean> => {
    setLoading(true);
    setSaved(false);

    try {
      // Validar dados mínimos
      if (!aircraftId || !selectedPic) {
        toast({
          title: 'Erro',
          description: 'Dados obrigatórios não preenchidos',
          variant: 'destructive',
        });
        return false;
      }

      // Calcular tempos
      const totalTimeHours = parseInt(formData.flight_time_hours || '0', 10);
      const totalTimeMinutes = parseInt(formData.flight_time_minutes || '0', 10);
      const totalTime = totalTimeHours + (totalTimeMinutes / 60);

      const nightTimeHours = parseInt(formData.night_time_hours || '0', 10);
      const nightTimeMinutes = parseInt(formData.night_time_minutes || '0', 10);
      const nightTime = nightTimeHours + (nightTimeMinutes / 60);

      // Determinar flight_nature baseado na categoria
      let flightNature = 'PV - Privado';
      if (flightCategory === 'rateio') {
        if (specialFlightType === 'voo_check') flightNature = 'CQ - Cheque';
        else if (specialFlightType === 'translado') flightNature = 'TR - Traslado';
        else if (specialFlightType === 'voo_teste') flightNature = 'TN - Teste';
      }

      // Preparar dados da entrada
      const entryData = {
        aircraft_id: aircraftId,
        logbook_month_id: logbookMonthId || null,
        entry_date: formData.entry_date,
        departure_aerodrome: formData.departure_airport,
        arrival_aerodrome: formData.arrival_airport,
        ac_time: formData.ac_time,
        dep_time: formData.departure_time,
        pou_time: formData.pou_time,
        cor_time: formData.cor_time,
        crew_checkin_time: formData.crew_checkin_time,
        pic_canac: selectedPic,
        sic_canac: selectedSic || null,
        sic_name: formData.sic_name || null,
        total_time: totalTime,
        day_time: totalTime - nightTime,
        night_hours: nightTime,
        ifr_time: parseFloat(formData.ifr_count || '0'),
        pousos: parseInt(formData.landings || '1', 10),
        fuel_added: parseFloat(formData.fuel_added || '0'),
        fuel_liters: parseFloat(formData.fuel_cell || '0'),
        fuel_type: formData.fuel_type || null,
        fuel_location: formData.fuel_location || null,
        fuel_price_per_liter: parseFloat(formData.fuel_price_per_liter || '0') || null,
        refueled: formData.refueled,
        distance_nm: parseInt(formData.distance_nm || '0', 10),
        passengers: parseInt(formData.passengers || '0', 10),
        cargo_kg: parseInt(formData.cargo_kg || '0', 10),
        flight_nature: flightNature,
        daily_rate: parseFloat(formData.daily_rate || '0'),
        is_equal_split: formData.is_equal_split,
        is_loan: formData.is_loan,
        client_id: formData.client_id || null,
        client_partner_id: formData.client_partner_id || null,
        loan_recipient_client_id: formData.loan_recipient_client_id || null,
        loan_recipient_partner_id: formData.loan_recipient_partner_id || null,
        occurrences: formData.remarks || null,
        discrepancies: null,
        corrective_actions: null,
      };

      // Inserir entrada
      const { data: insertedEntry, error: insertError } = await supabase
        .from('logbook_entries')
        .insert([entryData])
        .select()
        .single();

      if (insertError || !insertedEntry) {
        toast({
          title: 'Erro',
          description: 'Erro ao salvar lançamento: ' + (insertError?.message || 'Desconhecido'),
          variant: 'destructive',
        });
        return false;
      }

      // Se for empréstimo, criar registro em aircraft_loans
      if (formData.is_loan && formData.client_id && formData.loan_recipient_client_id) {
        const loanData = {
          lender_aircraft_id: aircraftId,
          lender_client_id: formData.client_id,
          borrower_client_id: formData.loan_recipient_client_id,
          borrower_partner_id: formData.loan_recipient_partner_id || null,
          hours_borrowed: totalTime,
          entry_date: formData.entry_date,
          departure_aerodrome: formData.departure_airport,
          arrival_aerodrome: formData.arrival_airport,
          fuel_added: parseFloat(formData.fuel_added || '0'),
          pic_name: selectedPic,
          logbook_entry_id: insertedEntry.id,
          status: 'active',
        };

        const { error: loanError } = await supabase
          .from('aircraft_loans')
          .insert([loanData]);

        if (loanError) {
          console.error('Erro ao criar registro de empréstimo:', loanError);
          // Não falha a transação, apenas log
        }
      }

      // Invalidar queries relacionadas
      await queryClient.invalidateQueries({ queryKey: ['logbook-entries', aircraftId] });
      await queryClient.invalidateQueries({ queryKey: ['logbook-month', logbookMonthId] });

      setSaved(true);
      toast({
        title: 'Sucesso',
        description: 'Lançamento salvo com sucesso!',
      });

      if (onSuccess) {
        onSuccess();
      }

      return true;
    } catch (error) {
      console.error('Erro ao submeter voo:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao processar lançamento. Tente novamente.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    submitFlight,
    loading,
    saved,
  };
}
