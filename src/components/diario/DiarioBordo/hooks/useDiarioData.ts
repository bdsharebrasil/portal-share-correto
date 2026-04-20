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
        const sb: any = supabase;
        const [acRes, crewMembersRes, aeroRes, clientRes, entriesRes, monthsRes, partnersRes, clientPartnersRes] = await Promise.all([
          sb.from('aeronave').select('*').eq('status', 'ativa').eq('id', aircraftId).single(),
          sb.from('membros_tripulacao').select('*').eq('status', 'ativo').order('nome_completo', { ascending: true }),
          sb.from('aerodromes').select('*').order('designativo'),
          sb.from('clientes').select('id, razao_social, cnpj, cotistas_aeronave(id_aeronave, percentual_sociedade)').order('razao_social'),
          sb.from('lancamentos_diario_bordo').select('*').eq('aeronave_id', aircraftId).order('numero_sequencial', { ascending: true }),
          sb.from('diario_mes').select('mes, ano').eq('aeronave_id', aircraftId).eq('fechado', false).order('ano', { ascending: false }).order('mes', { ascending: false }),
          sb.from('cotistas_aeronave').select('*, clientes!cotistas_aeronave_id_clientes_fkey(id, razao_social)').eq('id_aeronave', aircraftId),
          sb.from('socios_cliente').select('id, nome, cpf, id_clientes').order('nome')
        ]);

        if (acRes.data) {
          setAircraft(acRes.data);
        } else {
          toast.error('Aeronave não encontrada ou não está ativa');
          onBack?.();
          return;
        }

        const crewMembersData = (crewMembersRes.data || []).map((m: any) => ({
          id: m.id,
          full_name: m.nome_completo,
          canac: m.canac,
          status: m.status
        }));
        setCrew(crewMembersData);

        if (aeroRes.data) setAerodromes(aeroRes.data || []);
        if (clientRes.data) {
          logSuccess('Clientes carregados', { count: clientRes.data.length });
          setClients(clientRes.data || []);
        }
        if (entriesRes.data) {
          logSuccess('Entradas carregadas', { count: entriesRes.data.length });
          setEntries(entriesRes.data || []);
        }
        if (monthsRes.data) {
          setAvailableMonths(
            (monthsRes.data || []).map((m: any) => ({ month: m.mes, year: m.ano }))
          );
        }
        if (partnersRes.data) setPartners(partnersRes.data || []);

        if (clientPartnersRes.data) {
          const partnerMap: Record<string, any> = {};
          const partnersByClientId: Record<string, any[]> = {};
          clientPartnersRes.data.forEach((p: any) => {
            partnerMap[p.id] = p;
            const clientKey = p.id_clientes;
            if (clientKey) {
              if (!partnersByClientId[clientKey]) {
                partnersByClientId[clientKey] = [];
              }
              partnersByClientId[clientKey].push(p);
            }
          });
          setClientPartners(partnerMap);
          setClientPartnersByClientId(partnersByClientId);
        }

        const loansRes = await sb
          .from('emprestimos_aeronave')
          .select('*')
          .eq('aeronave_id', aircraftId)
          .order('data_lancamento', { ascending: false });
        if (loansRes.data) setLoans(loansRes.data || []);

        const { data: monthData } = await sb
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
          const { data: lastMonthData } = await sb
            .from('diario_mes')
            .select('*')
            .eq('aeronave_id', aircraftId)
            .order('ano', { ascending: false })
            .order('mes', { ascending: false })
            .limit(1)
            .maybeSingle();

          let celulaAnterior = 0;
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