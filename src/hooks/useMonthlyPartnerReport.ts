import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PartnerInfo {
  id: string;
  name: string;
  cpf: string;
  percentual_sociedade: number | null;
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
  data_pagamento?: string | null;
  trecho: string;
  local: string;
  litros: number;
  valor_unitario: number;
  valor_total: number | null;
  partner_name: string | null;
  partner_index?: number | null;
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
  effective_date?: string;
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
  numero_relatorio: string;
  data_inicio: string;
  data_fim: string;
  rota: string | null;
  dias_count: number;
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
  socios_cliente_id: string | null;
  crew_member_name: string | null;
  crew_member_name2: string | null;
  crew_member_id: string | null;
  crew_member_id2: string | null;
  aircraft_registration: string | null;
  observations: string | null;
  url_pdf: string | null;
}

export interface AeronaveInfo {
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
  socios_cliente_id: string | null;
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
  aircraft: AeronaveInfo | null;
  clientName: string;
  clientCnpj: string;
  dateRange: { startDate: string; endDate: string; firstEntryDate: string | null; lastEntryDate: string | null };
  hourlyRate: number | null;
}

function normalizePartnerName(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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
          .from("socios_cliente")
          .select("id, nome, cpf, percentual_participacao")
          .eq("cliente_id", clientId)
          .order("nome"),

        supabase
          .from("logbook_entries")
          .select(`
            id, entry_date, departure_aerodrome, arrival_aerodrome, trecho,
            total_time, day_time, night_hours, ifr_time, pousos,
            fuel_liters, fuel_consu, distance_nm, passengers, cargo_kg,
            flight_nature, pic_canac, client_partner_id,
            is_equal_split, is_loan, loan_recipient_partner_id,
            socios_nome
          `)
          .eq("cliente_id", clientId)
          .gte("entry_date", startDate)
          .lte("entry_date", endDate)
          .order("entry_date"),

        supabase
          .from("abastecimentos")
          .select("id, data, data_pagamento, trecho, local, litros, valor_unitario, valor_total, partner_name, partner_index, tipo_faturamento, status_pagamento, observacao, comanda, nf, comanda_url, nota_url, boleto_url, comprovante_pagamento, abastecedor, abastecimento_galoes")
          .eq("id_clientes", clientId)
          .order("data"),

        // Despesas atribuídas a sócios (incluindo despesas de viagem)
        supabase
          .from("partner_expenses")
          .select("id, expense_type, description, total_amount, assigned_partner_name, assigned_partner_cpf, status, due_date, paid_date, category, payment_method, prazo, invoice_number, bank_name, reference_id, reference_type")
          .eq("cliente_id", clientId)
          .gte("data_vencimento", startDate)
          .lte("data_vencimento", endDate)
          .not("assigned_partner_name", "is", null)
          .order("data_vencimento"),

        // Despesas compartilhadas (sem sócio atribuído) - banco, impostos, taxas (excluindo despesas de viagem)
        supabase
          .from("partner_expenses")
          .select("id, expense_type, description, total_amount, assigned_partner_name, assigned_partner_cpf, status, due_date, paid_date, category, payment_method, prazo, invoice_number, bank_name, reference_id, reference_type")
          .eq("cliente_id", clientId)
          .gte("data_vencimento", startDate)
          .lte("data_vencimento", endDate)
          .is("assigned_partner_name", null)
          .neq("expense_type", "DESPESAS DE VIAGEM")
          .order("data_vencimento"),

        supabase
          .from("clientes")
          .select("id, razao_social, proprietario, cnpj")
          .eq("id", clientId)
          .single(),

        supabase
          .from("travel_expense_reports")
          .select('id, numero_relatorio, data_inicio, data_fim, rota, dias_count, status, total_amount, total_fuel, total_lodging, total_food, total_transport, total_other, total_client, total_crew, total_crew1, total_crew2, total_sharebrasil, socios_cliente_id, crew_member_name, crew_member_name2, crew_member_id, crew_member_id2, aircraft_matricula, observations, url_pdf')
          .eq("clientes_id", clientId)
          .gte("data_inicio", startDate)
          .lte("data_inicio", endDate)
          .order("data_inicio"),

        // Despesas do controle_bancario relacionadas a aeronaves e sócios
        supabase
          .from("controle_bancario")
          .select("id, data, tipo_movimento, descricao, valor, conta_banco, numero_documento, status, socios_cliente_id, aeronave_id, aeronave_registro, categoria_id, grupo_categoria, comprovante_url, nf_url, boleto_url, recibo_url")
          .eq("clientes_id", clientId)
          .gte("data", startDate)
          .lte("data", endDate)
          .not("socios_cliente_id", "is", null)
          .order("data"),
      ]);

      // Get aircraft for client
      const { data: clientAircraftData } = await supabase
        .from("cotistas_aeronave")
        .select('id_aeronave, aeronave!id_aeronave(id, matricula, modelo, fabricante, preco_hora)')
        .eq("id_clientes", clientId)
        .limit(1);

      const aircraftRaw = clientAircraftData?.[0]?.aeronave as any;
      const aircraft = aircraftRaw ? { id: aircraftRaw.id, registration: aircraftRaw.registration, model: aircraftRaw.model, manufacturer: aircraftRaw.manufacturer } as AeronaveInfo : null;
      const hourlyRate = aircraftRaw?.hourly_price ? parseFloat(aircraftRaw.hourly_price) : null;

      const flights: FlightEntry[] = (flightsRes.data || []).map((f: any) => ({
        ...f,
        pic_name: f.socios_nome || null,
      }));

      const partners = (partnersRes.data || []) as PartnerInfo[];
      const partnerNameMap = new Map(
        partners.map((partner) => [normalizePartnerName(partner.nome), partner.nome])
      );

      const fuels: FuelEntry[] = ((fuelsRes.data || []) as any[])
        .map((fuel) => {
          let resolvedPartnerName = fuel.nome_socio?.trim() || null;

          if (!resolvedPartnerName && fuel.partner_index && partners[fuel.partner_index - 1]) {
            resolvedPartnerName = partners[fuel.partner_index - 1].nome;
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

      // Determine actual date range from entries
      const allDates = [
        ...flights.map(f => f.entry_date),
        ...fuels.map((f) => f.effective_date || f.data),
        ...(expensesRes.data || []).map((e: any) => e.data_vencimento).filter(Boolean),
        ...(sharedExpensesRes.data || []).map((e: any) => e.data_vencimento).filter(Boolean),
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
        clientName: clientRes.data?.razao_social || clientRes.data?.proprietario || "",
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
