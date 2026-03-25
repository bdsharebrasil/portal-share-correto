import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MonthlyReportData, PartnerInfo, FlightEntry, FuelEntry, ExpenseEntry, TravelReportEntry, BankControlEntry, AircraftInfo } from "./useMonthlyPartnerReport";

interface Result {
  dataByMonth: Map<string, MonthlyReportData>;
  isLoading: boolean;
  isError: boolean;
}

function normalizePartnerName(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

async function fetchMonthlyReportData(clientId: string, month: string): Promise<MonthlyReportData> {
  const [year, mon] = month.split("-");
  const startDate = `${year}-${mon}-01`;
  const endDate = new Date(parseInt(year), parseInt(mon), 0).toISOString().slice(0, 10);

  const [partnersRes, flightsRes, fuelsRes, expensesRes, sharedExpensesRes, clientRes, travelRes, bankControlRes] = await Promise.all([
    supabase
      .from("client_partners")
      .select("id, name, cpf, share_percentage")
      .eq("client_id", clientId)
      .order("name"),

    supabase
      .from("logbook_entries")
      .select(`
        id, entry_date, departure_aerodrome, arrival_aerodrome, trecho,
        total_time, day_time, night_hours, ifr_time, pousos,
        fuel_liters, fuel_consu, distance_nm, passengers, cargo_kg,
        flight_nature, pic_canac, client_partner_id,
        is_equal_split, is_loan, loan_recipient_partner_id,
        crew_members!logbook_entries_pic_canac_fkey(full_name)
      `)
      .eq("client_id", clientId)
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .order("entry_date"),

    supabase
      .from("abastecimentos")
      .select("id, data, data_pagamento, trecho, local, litros, valor_unitario, valor_total, partner_name, partner_index, tipo_faturamento, status_pagamento, observacao, comanda, nf, comanda_url, nota_url, boleto_url, comprovante_pagamento, abastecedor, abastecimento_galoes")
      .eq("client_id", clientId)
      .order("data"),

    supabase
      .from("partner_expenses")
      .select("id, expense_type, description, total_amount, assigned_partner_name, assigned_partner_cpf, status, due_date, paid_date, category, payment_method, prazo, invoice_number, bank_name, reference_id, reference_type")
      .eq("client_id", clientId)
      .gte("due_date", startDate)
      .lte("due_date", endDate)
      .not("assigned_partner_name", "is", null)
      .order("due_date"),

    supabase
      .from("partner_expenses")
      .select("id, expense_type, description, total_amount, assigned_partner_name, assigned_partner_cpf, status, due_date, paid_date, category, payment_method, prazo, invoice_number, bank_name, reference_id, reference_type")
      .eq("client_id", clientId)
      .gte("due_date", startDate)
      .lte("due_date", endDate)
      .is("assigned_partner_name", null)
      .neq("expense_type", "DESPESAS DE VIAGEM")
      .order("due_date"),

    supabase
      .from("clients")
      .select("id, company_name, proprietario, cnpj")
      .eq("id", clientId)
      .single(),

    supabase
      .from("travel_expense_reports")
      .select("id, report_number, start_date, end_date, route, days_count, status, total_amount, total_fuel, total_lodging, total_food, total_transport, total_other, total_client, total_crew, total_crew1, total_crew2, total_sharebrasil, client_partner, crew_member_name, crew_member_name2, crew_member_id, crew_member_id2, aircraft_registration, observations, pdf_url")
      .eq("client_id", clientId)
      .gte("start_date", startDate)
      .lte("start_date", endDate)
      .order("start_date"),

    supabase
      .from("controle_bancario")
      .select("id, data, tipo_movimento, descricao, valor, conta_banco, numero_documento, status, client_partner_id, aeronave_id, aeronave_registro, categoria_id, grupo_categoria, comprovante_url, nf_url, boleto_url, recibo_url")
      .eq("client_id", clientId)
      .gte("data", startDate)
      .lte("data", endDate)
      .not("client_partner_id", "is", null)
      .order("data"),
  ]);

  const { data: clientAircraftData } = await supabase
    .from("client_aircraft")
    .select("aircraft_id, aircraft:aircraft(id, registration, model, manufacturer, hourly_price)")
    .eq("client_id", clientId)
    .limit(1);

  const aircraftRaw = clientAircraftData?.[0]?.aircraft as any;
  const aircraft = aircraftRaw ? { id: aircraftRaw.id, registration: aircraftRaw.registration, model: aircraftRaw.model, manufacturer: aircraftRaw.manufacturer } as AircraftInfo : null;
  const hourlyRate = aircraftRaw?.hourly_price ? parseFloat(aircraftRaw.hourly_price) : null;

  const flights: FlightEntry[] = (flightsRes.data || []).map((f: any) => ({
    ...f,
    pic_name: f.crew_members?.full_name || null,
  }));

  const partners = (partnersRes.data || []) as PartnerInfo[];
  const partnerNameMap = new Map(
    partners.map((partner) => [normalizePartnerName(partner.name), partner.name])
  );

  const fuels: FuelEntry[] = ((fuelsRes.data || []) as any[])
    .map((fuel) => {
      let resolvedPartnerName = fuel.partner_name?.trim() || null;

      if (!resolvedPartnerName && fuel.partner_index && partners[fuel.partner_index - 1]) {
        resolvedPartnerName = partners[fuel.partner_index - 1].name;
      }

      if (!resolvedPartnerName && fuel.observacao) {
        const partnerMatch = fuel.observacao.match(/\[Partner:([^\]]+)\]/i);
        resolvedPartnerName = partnerMatch?.[1]?.trim() || null;
      }

      if (resolvedPartnerName) {
        resolvedPartnerName =
          partnerNameMap.get(normalizePartnerName(resolvedPartnerName)) || resolvedPartnerName;
      }

      const effectiveDate = (fuel.data_pagamento || fuel.data || "").slice(0, 10);

      return {
        ...fuel,
        partner_name: resolvedPartnerName,
        effective_date: effectiveDate,
      } as FuelEntry;
    })
    .filter((fuel) => {
      const effectiveDate = fuel.effective_date || "";
      return effectiveDate >= startDate && effectiveDate <= endDate;
    });

  const allDates = [
    ...flights.map(f => f.entry_date),
    ...fuels.map((f) => f.effective_date || f.data),
    ...(expensesRes.data || []).map((e: any) => e.due_date).filter(Boolean),
    ...(sharedExpensesRes.data || []).map((e: any) => e.due_date).filter(Boolean),
  ].filter(Boolean).sort();

  return {
    partners,
    flights,
    fuels,
    expenses: (expensesRes.data || []) as ExpenseEntry[],
    sharedExpenses: (sharedExpensesRes.data || []) as ExpenseEntry[],
    bankControlExpenses: (bankControlRes.data || []) as BankControlEntry[],
    travelReports: (travelRes.data || []) as TravelReportEntry[],
    aircraft,
    clientName: clientRes.data?.company_name || clientRes.data?.proprietario || "",
    clientCnpj: clientRes.data?.cnpj || "",
    dateRange: {
      startDate,
      endDate,
      firstEntryDate: allDates[0] || null,
      lastEntryDate: allDates[allDates.length - 1] || null,
    },
    hourlyRate,
  };
}

export function useMultiMonthPartnerReport(
  clientId: string,
  months: string[]
): Result {
  const results = useQueries({
    queries: months.map((month) => ({
      queryKey: ["monthly-partner-report", clientId, month],
      queryFn: () => fetchMonthlyReportData(clientId, month),
      enabled: !!clientId && !!month,
    })),
  });

  const dataByMonth = new Map<string, MonthlyReportData>();
  let isLoading = false;
  let isError = false;

  results.forEach((result, index) => {
    if (result.isLoading) isLoading = true;
    if (result.isError) isError = true;
    if (result.data) {
      dataByMonth.set(months[index], result.data);
    }
  });

  return { dataByMonth, isLoading, isError };
}
