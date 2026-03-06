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
}

export interface AircraftInfo {
  id: string;
  registration: string;
  model: string;
  manufacturer: string;
}

export interface MonthlyReportData {
  partners: PartnerInfo[];
  flights: FlightEntry[];
  fuels: FuelEntry[];
  expenses: ExpenseEntry[];
  aircraft: AircraftInfo | null;
  clientName: string;
  clientCnpj: string;
}

export function useMonthlyPartnerReport(clientId: string | null, month: string | null) {
  return useQuery({
    queryKey: ["monthly-partner-report", clientId, month],
    queryFn: async (): Promise<MonthlyReportData> => {
      if (!clientId || !month) {
        return { partners: [], flights: [], fuels: [], expenses: [], aircraft: null, clientName: "", clientCnpj: "" };
      }

      const [year, mon] = month.split("-");
      const startDate = `${year}-${mon}-01`;
      const endDate = new Date(parseInt(year), parseInt(mon), 0).toISOString().slice(0, 10);

      // Fetch all in parallel
      const [partnersRes, flightsRes, fuelsRes, expensesRes, clientRes] = await Promise.all([
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
          .select("id, data, trecho, local, litros, valor_unitario, valor_total, partner_name, tipo_faturamento, status_pagamento, observacao")
          .eq("client_id", clientId)
          .gte("data", startDate)
          .lte("data", endDate)
          .order("data"),

        supabase
          .from("partner_expenses")
          .select("id, expense_type, description, total_amount, assigned_partner_name, assigned_partner_cpf, status, due_date, paid_date, category, payment_method, prazo, invoice_number, bank_name")
          .eq("client_id", clientId)
          .gte("due_date", startDate)
          .lte("due_date", endDate)
          .order("due_date"),

        supabase
          .from("clients")
          .select("id, company_name, proprietario, cnpj")
          .eq("id", clientId)
          .single(),
      ]);

      // Get aircraft for client
      const { data: clientAircraftData } = await supabase
        .from("client_aircraft")
        .select("aircraft_id, aircraft:aircraft(id, registration, model, manufacturer)")
        .eq("client_id", clientId)
        .limit(1);

      const aircraft = clientAircraftData?.[0]?.aircraft as unknown as AircraftInfo | null;

      const flights: FlightEntry[] = (flightsRes.data || []).map((f: any) => ({
        ...f,
        pic_name: f.crew_members?.full_name || null,
      }));

      return {
        partners: (partnersRes.data || []) as PartnerInfo[],
        flights,
        fuels: (fuelsRes.data || []) as FuelEntry[],
        expenses: (expensesRes.data || []) as ExpenseEntry[],
        aircraft,
        clientName: clientRes.data?.company_name || clientRes.data?.proprietario || "",
        clientCnpj: clientRes.data?.cnpj || "",
      };
    },
    enabled: !!clientId && !!month,
  });
}
