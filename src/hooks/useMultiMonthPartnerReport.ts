import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MonthlyReportData, PartnerInfo, FlightEntry, FuelEntry, ExpenseEntry, TravelReportEntry, BankControlEntry, AeronaveInfo } from "./useMonthlyPartnerReport";

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
      .from("socios_cliente")
      .select("id, nome, cpf, percentual_participacao")
      .eq("cliente_id", clientId)
      .order("nome"),

    supabase
      .from("lancamentos_diario_bordo")
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
      .select("id, data, data_pagamento, trecho, local, litros, valor_unitario, valor_total, socio_nome, partner_index, tipo_faturamento, status_pagamento, observacao, comanda, nf, comanda_url, nota_url, boleto_url, comprovante_pagamento, abastecedor, abastecimento_galoes")
      .eq("id_clientes", clientId)
      .order("data"),

    supabase
      .from("partner_expenses")
      .select("id, tipo_despesa, descricao, valor_total, nome_socio, cpf_socio, status, data_vencimento, data_pagamento, categoria, metodo_pagamento, prazo, numero_fatura, nome_banco, id_referencia, tipo_referencia")
      .eq("clientes_id", clientId)
      .gte("data_vencimento", startDate)
      .lte("data_vencimento", endDate)
      .not("nome_socio", "is", null)
      .order("data_vencimento"),

    supabase
      .from("partner_expenses")
      .select("id, tipo_despesa, descricao, valor_total, nome_socio, cpf_socio, status, data_vencimento, data_pagamento, categoria, metodo_pagamento, prazo, numero_fatura, nome_banco, id_referencia, tipo_referencia")
      .eq("clientes_id", clientId)
      .gte("data_vencimento", startDate)
      .lte("data_vencimento", endDate)
      .is("nome_socio", null)
      .neq("tipo_despesa", "DESPESAS DE VIAGEM")
      .order("data_vencimento"),

    supabase
      .from("clientes")
      .select("id, razao_social, proprietario, cnpj")
      .eq("id", clientId)
      .single(),

    supabase
      .from("travel_expense_reports")
      .select('id, numero_relatorio, data_inicio, data_fim, rota, dias_count, status, total_fuel, total_lodging, total_food, total_transport, total_other, total_client, total_crew, total_crew1, total_crew2, total_sharebrasil, socios_cliente_id, nome_tripulante, nome_tripulante_2, crew_member_id, crew_member_id2, aeronave_matricula, observacoes, url_pdf')
      .eq("clientes_id", clientId)
      .gte("data_inicio", startDate)
      .lte("data_inicio", endDate)
      .order("data_inicio"),

    supabase
      .from("controle_bancario")
      .select("id, data, tipo_movimento, descricao, valor, conta_banco, numero_documento, status, socios_cliente_id, aeronave_id, aeronave_registro, categoria_id, grupo_categoria, comprovante_url, nf_url, boleto_url, recibo_url")
      .eq("clientes_id", clientId)
      .gte("data", startDate)
      .lte("data", endDate)
      .not("socios_cliente_id", "is", null)
      .order("data"),
  ]);

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
