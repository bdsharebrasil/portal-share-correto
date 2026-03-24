import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PartnerInfo {
  id: string;
  name: string;
  cpf: string;
  share_percentage: number | null;
}

export interface FlightEntry {
  id: string;
  entry_date: string;
  departure_aerodrome: string;
  arrival_aerodrome: string;
  trecho: string | null;
  total_time: number | null;
  day_time: number | null;
  night_hours: number | null;
  ifr_time: number | null;
  pousos: number | null;
  fuel_liters: number | null;
  fuel_consu: number | null;
  distance_nm: number | null;
  passengers: number | null;
  cargo_kg: number | null;
  flight_nature: string;
  pic_name: string | null;
  pic_canac: string;
  client_partner_id: string | null;
  is_equal_split: boolean | null;
  is_loan: boolean | null;
  loan_recipient_partner_id: string | null;
}

export interface FuelEntry {
  id: string;
  data: string;
  trecho: string;
  local: string;
  litros: number;
  valor_unitario: number;
  valor_total: number | null;
  partner_name: string | null;
  tipo_faturamento: string | null;
  status_pagamento: string | null;
  observacao: string | null;
  comanda: string | null;
  nf: string | null;
  comanda_url: string | null;
  nota_url: string | null;
  boleto_url: string | null;
  comprovante_pagamento: string | null;
  abastecedor: string | null;
  abastecimento_galoes: number | null;
}

export interface ExpenseEntry {
  id: string;
  expense_type: string;
  description: string;
  total_amount: number;
  assigned_partner_name: string | null;
  assigned_partner_cpf: string | null;
  status: string | null;
  due_date: string | null;
  paid_date: string | null;
  category: string | null;
  payment_method: string | null;
  prazo: string | null;
  invoice_number: string | null;
  bank_name: string | null;
  reference_id?: string | null;
  reference_type?: string | null;
}

export interface TravelReportEntry {
  id: string;
  report_number: string;
  start_date: string;
  end_date: string;
  route: string | null;
  days_count: number;
  status: string | null;
  total_amount: number | null;
  total_fuel: number | null;
  total_lodging: number | null;
  total_food: number | null;
  total_transport: number | null;
  total_other: number | null;
  total_client: number | null;
  total_crew: number | null;
  total_sharebrasil: number | null;
  total_crew1: number | null;
  total_crew2: number | null;
  client_partner: string | null;
  crew_member_name: string | null;
  crew_member_name2: string | null;
  crew_member_id: string | null;
  crew_member_id2: string | null;
  aircraft_registration: string | null;
  observations: string | null;
  pdf_url: string | null;
}

export interface AircraftInfo {
  id: string;
  registration: string;
  model: string;
  manufacturer: string;
}

export interface BankControlEntry {
  id: string;
  data: string;
  tipo_movimento: string;
  descricao: string;
  valor: number;
  conta_banco: string | null;
  numero_documento: string | null;
  status: string | null;
  client_partner_id: string | null;
  aeronave_id: string | null;
  aeronave_registro: string | null;
  categoria_id: string;
  grupo_categoria: string | null;
  comprovante_url: string | null;
  nf_url: string | null;
  boleto_url: string | null;
  recibo_url: string | null;
}

export interface MonthlyReportData {
  partners: PartnerInfo[];
  flights: FlightEntry[];
  fuels: FuelEntry[];
  expenses: ExpenseEntry[];
  sharedExpenses: ExpenseEntry[];
  bankControlExpenses: BankControlEntry[];
  travelReports: TravelReportEntry[];
  aircraft: AircraftInfo | null;
  clientName: string;
  clientCnpj: string;
  dateRange: { startDate: string; endDate: string; firstEntryDate: string | null; lastEntryDate: string | null };
  hourlyRate: number | null;
}

export function useMonthlyPartnerReport(clientId: string | null, month: string | null) {
  return useQuery({
    queryKey: ["monthly-partner-report", clientId, month],
    queryFn: async (): Promise<MonthlyReportData> => {
      if (!clientId || !month) {
        return { partners: [], flights: [], fuels: [], expenses: [], sharedExpenses: [], bankControlExpenses: [], travelReports: [], aircraft: null, clientName: "", clientCnpj: "", dateRange: { startDate: "", endDate: "", firstEntryDate: null, lastEntryDate: null }, hourlyRate: null };
      }

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
          .select("id, data, trecho, local, litros, valor_unitario, valor_total, partner_name, tipo_faturamento, status_pagamento, observacao, comanda, nf, comanda_url, nota_url, boleto_url, comprovante_pagamento, abastecedor, abastecimento_galoes")
          .eq("client_id", clientId)
          .gte("data", startDate)
          .lte("data", endDate)
          .order("data"),

        // Despesas atribuídas a sócios (incluindo despesas de viagem)
        supabase
          .from("partner_expenses")
          .select("id, expense_type, description, total_amount, assigned_partner_name, assigned_partner_cpf, status, due_date, paid_date, category, payment_method, prazo, invoice_number, bank_name, reference_id, reference_type")
          .eq("client_id", clientId)
          .gte("due_date", startDate)
          .lte("due_date", endDate)
          .not("assigned_partner_name", "is", null)
          .order("due_date"),

        // Despesas compartilhadas (sem sócio atribuído) - banco, impostos, taxas (excluindo despesas de viagem)
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

        // Despesas do controle_bancario relacionadas a aeronaves e sócios
        supabase
          .from("controle_bancario")
          .select("id, data, tipo_movimento, descricao, valor, conta_banco, numero_documento, status, client_partner_id, aeronave_id, aeronave_registro, categoria_id, grupo_categoria, comprovante_url, nf_url, boleto_url, recibo_url")
          .eq("client_id", clientId)
          .gte("data", startDate)
          .lte("data", endDate)
          .not("client_partner_id", "is", null)
          .order("data"),
      ]);

      // Get aircraft for client
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

      // Determine actual date range from entries
      const allDates = [
        ...flights.map(f => f.entry_date),
        ...(fuelsRes.data || []).map((f: any) => f.data),
        ...(expensesRes.data || []).map((e: any) => e.due_date).filter(Boolean),
        ...(sharedExpensesRes.data || []).map((e: any) => e.due_date).filter(Boolean),
      ].filter(Boolean).sort();

      return {
        partners: (partnersRes.data || []) as PartnerInfo[],
        flights,
        fuels: (fuelsRes.data || []) as FuelEntry[],
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
    },
    enabled: !!clientId && !!month,
  });
}
