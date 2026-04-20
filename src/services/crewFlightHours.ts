import { supabase } from '@/integrations/supabase/client';

/**
 * Update crew flight hours when a logbook entry is saved.
 * This will either create or update the crew_flight_hours record for the given month/year.
 * Also updates IFR hours and night (NOT) hours.
 * IMPORTANT: Updates both PIC and SIC if provided.
 */
export async function updateCrewFlightHours(params: {
  picId: string;
  sicId?: string | null;
  aircraftId: string;
  mes: number;
  ano: number;
  totalTime: number;
  ifrTime?: number;
  nightHours?: number;
  diaVoo: string;
  operation: 'add' | 'remove';
}) {
  const { picId, sicId, aircraftId, mes, ano, totalTime, ifrTime = 0, nightHours = 0, diaVoo, operation } = params;

  console.log(`🚀 updateCrewFlightHours called with:`, {
    picId,
    sicId,
    sicIdType: typeof sicId,
    sicIdLength: typeof sicId === 'string' ? sicId.length : 'N/A',
    aircraftId,
    mes,
    ano,
    totalTime,
    ifrTime,
    nightHours,
    operation
  });

  const crewToUpdate = [picId];

  // Validate and add SIC if it exists and is not empty
  const sicIdValid = sicId && typeof sicId === 'string' && sicId.trim().length > 0;

  if (sicIdValid) {
    crewToUpdate.push(sicId!);
    console.log(`✈️ SIC found and valid: "${sicId}" - will be updated alongside PIC`);
  } else {
    console.log(`⚠️ SIC not provided, is null, undefined, or empty string (sicId: ${JSON.stringify(sicId)})`);
  }

  for (const crewMemberId of crewToUpdate) {
    console.log(`\n📝 Processing crew member: ${crewMemberId}`);

    try {
      // Check if record exists
      const { data: existing, error: fetchError } = await supabase
        .from('horas_voo_tripulante')
        .select('id, horas_totais, horas_ifr, horas_noturnas')
        .eq('membro_tripulacao_id', crewMemberId)
        .eq('aeronave_id', aircraftId)
        .eq('mes', mes)
        .eq('ano', ano)
        .maybeSingle();

      if (fetchError) {
        console.error(`❌ Error fetching horas_voo_tripulante for ${crewMemberId}:`, fetchError);
        continue;
      }

      if (existing) {
        // Update existing record
        const currentTotalHours = Number(existing.horas_totais) || 0;
        const currentIfrHours = Number(existing.horas_ifr) || 0;
        const currentNightHours = Number(existing.horas_noturnas) || 0;

        const newTotalHours = operation === 'add'
          ? currentTotalHours + totalTime
          : Math.max(0, currentTotalHours - totalTime);

        const newIfrHours = operation === 'add'
          ? currentIfrHours + ifrTime
          : Math.max(0, currentIfrHours - ifrTime);

        const newNightHours = operation === 'add'
          ? currentNightHours + nightHours
          : Math.max(0, currentNightHours - nightHours);

        console.log(`📊 Updating existing record for ${crewMemberId}:`, {
          currentTotal: currentTotalHours,
          currentIfr: currentIfrHours,
          currentNight: currentNightHours,
          newTotal: newTotalHours,
          newIfr: newIfrHours,
          newNight: newNightHours
        });

        const { error: updateError } = await supabase
          .from('horas_voo_tripulante')
          .update({
            horas_totais: newTotalHours,
            horas_ifr: newIfrHours,
            horas_noturnas: newNightHours,
            atualizado_em: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error(`❌ Error updating crew_flight_hours for ${crewMemberId}:`, updateError);
        } else {
          console.log(`✅ Successfully updated crew ${crewMemberId} hours:`, {
            total: `${currentTotalHours} -> ${newTotalHours}`,
            ifr: `${currentIfrHours} -> ${newIfrHours}`,
            night: `${currentNightHours} -> ${newNightHours}`
          });
        }
      } else if (operation === 'add') {
        // Create new record only for 'add' operation
        console.log(`📊 Creating new record for ${crewMemberId}:`, {
          total: totalTime,
          ifr: ifrTime,
          night: nightHours
        });

        const { error: insertError } = await supabase
          .from('horas_voo_tripulante')
          .insert({
            membro_tripulacao_id: crewMemberId,
            aeronave_id: aircraftId,
            mes,
            ano,
            horas_totais: totalTime,
            horas_ifr: ifrTime,
            horas_noturnas: nightHours,
            dia_voo: diaVoo
          });

        if (insertError) {
          console.error(`❌ Error inserting crew_flight_hours for ${crewMemberId}:`, insertError);
        } else {
          console.log(`✅ Successfully created new hours record for crew ${crewMemberId}:`, {
            total: totalTime,
            ifr: ifrTime,
            night: nightHours
          });
        }
      } else {
        console.log(`⚠️ No record found for ${crewMemberId} and operation is '${operation}' (remove) - skipping`);
      }
    } catch (error) {
      console.error(`❌ Unexpected error updating crew flight hours for ${crewMemberId}:`, error);
    }
  }

  console.log(`\n✨ updateCrewFlightHours completed for PIC: ${picId}${sicId ? `, SIC: ${sicId}` : ' (no SIC)'}`);
}

/**
 * Recalculate all crew flight hours for a specific month from logbook entries.
 * Useful for data consistency checks. Includes IFR and night hours.
 */
export async function recalculateCrewFlightHoursForMonth(
  aircraftId: string,
  mes: number,
  ano: number
) {
  // Fetch all logbook entries for the period
  const startDate = new Date(ano, mes - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(ano, mes, 0).toISOString().split('T')[0];

  const { data: entries, error } = await supabase
    .from('lancamentos_diario_bordo')
    .select('pic_canac, sic_canac, tempo_total, tempo_ifr, horas_noturnas, data_registro')
    .eq('aeronave_id', aircraftId)
    .gte('data_registro', startDate)
    .lte('data_registro', endDate);

  if (error) {
    console.error('Error fetching lancamentos_diario_bordo for recalculation:', error);
    return;
  }

  // Aggregate hours by crew member
  const hoursByCrewMember: Record<string, { total: number; ifr: number; night: number; flightDay: string }> = {};

  for (const entry of entries || []) {
    const totalTime = Number(entry.tempo_total) || 0;
    const ifrTime = Number(entry.tempo_ifr) || 0;
    const nightTime = Number(entry.horas_noturnas) || 0;

    if (entry.pic_canac) {
      if (!hoursByCrewMember[entry.pic_canac]) {
        hoursByCrewMember[entry.pic_canac] = { total: 0, ifr: 0, night: 0, flightDay: entry.data_registro };
      }
      hoursByCrewMember[entry.pic_canac].total += totalTime;
      hoursByCrewMember[entry.pic_canac].ifr += ifrTime;
      hoursByCrewMember[entry.pic_canac].night += nightTime;
    }
    if (entry.sic_canac) {
      if (!hoursByCrewMember[entry.sic_canac]) {
        hoursByCrewMember[entry.sic_canac] = { total: 0, ifr: 0, night: 0, flightDay: entry.data_registro };
      }
      hoursByCrewMember[entry.sic_canac].total += totalTime;
      hoursByCrewMember[entry.sic_canac].ifr += ifrTime;
      hoursByCrewMember[entry.sic_canac].night += nightTime;
    }
  }

  // Update horas_voo_tripulante for each crew member
  for (const [crewMemberId, hours] of Object.entries(hoursByCrewMember)) {
    const { data: existing } = await supabase
      .from('horas_voo_tripulante')
      .select('id')
      .eq('membro_tripulacao_id', crewMemberId)
      .eq('aeronave_id', aircraftId)
      .eq('mes', mes)
      .eq('ano', ano)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('horas_voo_tripulante')
        .update({
          horas_totais: hours.total,
          horas_ifr: hours.ifr,
          horas_noturnas: hours.night,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('horas_voo_tripulante')
        .insert({
          membro_tripulacao_id: crewMemberId,
          aeronave_id: aircraftId,
          mes,
          ano,
          horas_totais: hours.total,
          horas_ifr: hours.ifr,
          horas_noturnas: hours.night,
          dia_voo: hours.flightDay
        });
    }
  }

  console.log(`✅ Recalculated hours for ${Object.keys(hoursByCrewMember).length} crew members`);
}
