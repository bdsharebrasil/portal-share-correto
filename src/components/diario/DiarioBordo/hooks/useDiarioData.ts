import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logSuccess, logError } from '@/utils/logger';

interface DiarioDataState {
  aircraft: any | null;
  crew: any[];
  aerodromes: any[];
  clients: any[];
  partners: any[];
  clientPartners: Record<string, any>;
  clientPartnersByClientId: Record<string, any[]>;
  entries: any[];
  availableMonths: Array<{ month: number; year: number }>;
  loans: any[];
  logbookMonth: any | null;
  lastCelula: number;
  loading: boolean;
}

export const useDiarioData = (
  aircraftId: string,
  selectedMonth: number,
  selectedYear: number,
  onBack?: () => void
): DiarioDataState => {
  const [loading, setLoading] = useState(true);
  const [aircraft, setAircraft] = useState<any>(null);
  const [crew, setCrew] = useState<any[]>([]);
  const [aerodromes, setAerodromes] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [clientPartners, setClientPartners] = useState<Record<string, any>>({});
  const [clientPartnersByClientId, setClientPartnersByClientId] = useState<Record<string, any[]>>({});
  const [entries, setEntries] = useState<any[]>([]);
  const [availableMonths, setAvailableMonths] = useState<Array<{ month: number; year: number }>>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [logbookMonth, setLogbookMonth] = useState<any>(null);
  const [lastCelula, setLastCelula] = useState(0);

  // Load aircraft and related data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [acRes, crewMembersRes, crewTableRes, aeroRes, clientRes, entriesRes, monthsRes, partnersRes, clientPartnersRes] = await Promise.all([
          supabase.from('aeronave').select('*').eq('status', 'ativa').eq('id', aircraftId).single(),
          supabase.from('membros_tripulacao').select('*').eq('status', 'ativo').order('full_name', { ascending: true }),
          supabase.from('crew').select('id, nome_completo, canac, status').eq('status', 'ativo').order('full_name', { ascending: true }),
          supabase.from('aerodromes').select('*').order('designativo'),
          supabase.from('clientes').select('id, razao_social, cnpj, client_aircraft(aircraft_id, share_percentage)').order('razao_social'),
          supabase.from('lancamentos_diario_bordo').select('*').eq('aeronave_id', aircraftId).order('numero_sequencial', { ascending: true }),
          supabase.from('diario_mes').select('mes, ano').eq('aeronave_id', aircraftId).eq('fechado', false).order('ano', { ascending: false }).order('mes', { ascending: false }),
          supabase.from('aircraft_partners').select('*, clients(id, razao_social)').eq('aeronave_id', aircraftId),
          supabase.from('socios_cliente').select('id, name, cpf, client_id').order('name')
        ]);

        if (acRes.data) {
          setAircraft(acRes.data);
          setLastCelula(acRes.data.cell_hours_current || 0);
        } else {
          toast.error('Aeronave não encontrada ou não está ativa');
          onBack?.();
          return;
        }

        const crewMembersData = crewMembersRes.data || [];
        const crewTableData = (crewTableRes.data || []).map((p: any) => ({
          id: p.id,
          full_name: p.nome_completo,
          canac: p.canac,
          status: p.status
        }));
        const existingIds = new Set(crewMembersData.map((c: any) => c.id));
        const mergedCrew = [
          ...crewMembersData,
          ...crewTableData.filter((c: any) => !existingIds.has(c.id))
        ];
        setCrew(mergedCrew);

        if (aeroRes.data) setAerodromes(aeroRes.data || []);
        if (clientRes.data) {
          logSuccess('Clientes carregados', { count: clientRes.data.length });
          setClients(clientRes.data || []);
        }
        if (entriesRes.data) {
          logSuccess('Entradas carregadas', { count: entriesRes.data.length });
          setEntries(entriesRes.data || []);
        }
        if (monthsRes.data) setAvailableMonths(monthsRes.data || []);
        if (partnersRes.data) setPartners(partnersRes.data || []);

        if (clientPartnersRes.data) {
          const partnerMap: Record<string, any> = {};
          const partnersByClientId: Record<string, any[]> = {};
          clientPartnersRes.data.forEach((p: any) => {
            partnerMap[p.id] = p;
            if (!partnersByClientId[p.client_id]) {
              partnersByClientId[p.client_id] = [];
            }
            partnersByClientId[p.client_id].push(p);
          });
          setClientPartners(partnerMap);
          setClientPartnersByClientId(partnersByClientId);
        }

        const loansRes = await (supabase as any)
          .from('aircraft_loans')
          .select('*')
          .eq('lender_aircraft_id', aircraftId)
          .order('entry_date', { ascending: false });
        if (loansRes.data) setLoans(loansRes.data || []);

        let { data: monthData } = await supabase
          .from('diario_mes')
          .select('*')
          .eq('aeronave_id', aircraftId)
          .eq('mes', selectedMonth)
          .eq('ano', selectedYear)
          .maybeSingle();

        if (monthData) {
          setLogbookMonth(monthData);
          setLastCelula(monthData.celula_anterior_ttotal || 0);
        } else {
          const { data: lastMonthData } = await supabase
            .from('diario_mes')
            .select('*')
            .eq('aeronave_id', aircraftId)
            .order('ano', { ascending: false })
            .order('mes', { ascending: false })
            .limit(1)
            .maybeSingle();

          let celulaAnterior = acRes.data?.cell_hours_current || 0;
          if (lastMonthData && lastMonthData.celula_atual_ttotal) {
            celulaAnterior = lastMonthData.celula_atual_ttotal;
          }
          setLastCelula(celulaAnterior);
          setLogbookMonth(null);
        }
      } catch (error) {
        logError("Erro ao carregar dados", error);
        toast.error("Erro ao carregar dados do sistema");
      } finally {
        setLoading(false);
      }
    };

    if (aircraftId) loadData();
  }, [aircraftId, selectedMonth, selectedYear, onBack]);

  return {
    aircraft,
    crew,
    aerodromes,
    clients,
    partners,
    clientPartners,
    clientPartnersByClientId,
    entries,
    availableMonths,
    loans,
    logbookMonth,
    lastCelula,
    loading
  };
};
