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
  month: number;
  year: number;
  totalTime: number;
  ifrTime?: number;
  nightHours?: number;
  flightDay: string;
  operation: 'add' | 'remove';
}) {
  const { picId, sicId, aircraftId, month, year, totalTime, ifrTime = 0, nightHours = 0, flightDay, operation } = params;

  console.log(`🚀 updateCrewFlightHours called with:`, {
    picId,
    sicId,
    sicIdType: typeof sicId,
    sicIdLength: typeof sicId === 'string' ? sicId.length : 'N/A',
    aircraftId,
    month,
    year,
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
        .from('crew_flight_hours')
        .select('id, total_hours, ifr_hours, not_hours')
        .eq('crew_member_id', crewMemberId)
        .eq('aircraft_id', aircraftId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (fetchError) {
        console.error(`❌ Error fetching crew_flight_hours for ${crewMemberId}:`, fetchError);
        continue;
      }

      if (existing) {
        // Update existing record
        const currentTotalHours = Number(existing.total_hours) || 0;
        const currentIfrHours = Number(existing.ifr_hours) || 0;
        const currentNightHours = Number(existing.not_hours) || 0;

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
          .from('crew_flight_hours')
          .update({
            total_hours: newTotalHours,
            ifr_hours: newIfrHours,
            not_hours: newNightHours,
            updated_at: new Date().toISOString()
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
          .from('crew_flight_hours')
          .insert({
            crew_member_id: crewMemberId,
            aircraft_id: aircraftId,
            month,
            year,
            total_hours: totalTime,
            ifr_hours: ifrTime,
            not_hours: nightHours,
            flight_day: flightDay
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
  month: number,
  year: number
) {
  // Fetch all logbook entries for the period
  const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  const { data: entries, error } = await supabase
    .from('logbook_entries')
    .select('pic_canac, sic_canac, total_time, ifr_time, night_hours, entry_date')
    .eq('aircraft_id', aircraftId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate);

  if (error) {
    console.error('Error fetching logbook entries:', error);
    return;
  }

  // Aggregate hours by crew member
  const hoursByCrewMember: Record<string, { total: number; ifr: number; night: number; flightDay: string }> = {};

  for (const entry of entries || []) {
    const totalTime = Number(entry.total_time) || 0;
    const ifrTime = Number(entry.ifr_time) || 0;
    const nightTime = Number(entry.night_hours) || 0;

    if (entry.pic_canac) {
      if (!hoursByCrewMember[entry.pic_canac]) {
        hoursByCrewMember[entry.pic_canac] = { total: 0, ifr: 0, night: 0, flightDay: entry.entry_date };
      }
      hoursByCrewMember[entry.pic_canac].total += totalTime;
      hoursByCrewMember[entry.pic_canac].ifr += ifrTime;
      hoursByCrewMember[entry.pic_canac].night += nightTime;
    }
    if (entry.sic_canac) {
      if (!hoursByCrewMember[entry.sic_canac]) {
        hoursByCrewMember[entry.sic_canac] = { total: 0, ifr: 0, night: 0, flightDay: entry.entry_date };
      }
      hoursByCrewMember[entry.sic_canac].total += totalTime;
      hoursByCrewMember[entry.sic_canac].ifr += ifrTime;
      hoursByCrewMember[entry.sic_canac].night += nightTime;
    }
  }

  // Update crew_flight_hours for each crew member
  for (const [crewMemberId, hours] of Object.entries(hoursByCrewMember)) {
    const { data: existing } = await supabase
      .from('crew_flight_hours')
      .select('id')
      .eq('crew_member_id', crewMemberId)
      .eq('aircraft_id', aircraftId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('crew_flight_hours')
        .update({
          total_hours: hours.total,
          ifr_hours: hours.ifr,
          not_hours: hours.night,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('crew_flight_hours')
        .insert({
          crew_member_id: crewMemberId,
          aircraft_id: aircraftId,
          month,
          year,
          total_hours: hours.total,
          ifr_hours: hours.ifr,
          not_hours: hours.night,
          flight_day: hours.flightDay
        });
    }
  }

  console.log(`✅ Recalculated hours for ${Object.keys(hoursByCrewMember).length} crew members`);
}
