import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export interface PartnerInfo {
  index: number;
  name: string;
  cpf?: string;
  percentage: number;
}

export interface PartnerExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
  partner_index: number | null;
  type: 'direct' | 'shared';
  category?: string;
}

export interface PartnerExpenseSummary {
  partner: PartnerInfo;
  directExpenses: number;
  sharedExpenses: number;
  totalExpenses: number;
  realPercentage: number;
  difference: number; // realPercentage - configuredPercentage
}

export interface ClientExpenseSummary {
  client: {
    id: string;
    company_name: string;
    cnpj: string;
  };
  partners: PartnerInfo[];
  totalExpenses: number;
  sharedExpenses: number;
  partnerSummaries: PartnerExpenseSummary[];
  period: {
    start: string;
    end: string;
  };
}

interface UsePartnerExpensesOptions {
  clientId: string | null;
  aircraftId?: string | null;
  startDate?: Date;
  endDate?: Date;
}

export function usePartnerExpenses({ clientId, aircraftId, startDate, endDate }: UsePartnerExpensesOptions) {
  const start = startDate || startOfMonth(new Date());
  const end = endDate || endOfMonth(new Date());

  return useQuery({
    queryKey: ['partner-expenses', clientId, aircraftId, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
    queryFn: async (): Promise<ClientExpenseSummary | null> => {
      if (!clientId) return null;

      // 1. Fetch client information
      const { data: clientData, error: clientError } = await supabase
        .from('clientes')
        .select('id, razao_social, cnpj')
        .eq('id', clientId)
        .single();

      if (clientError || !clientData) {
        console.error('Error fetching client:', clientError);
        return null;
      }

      // 2. Fetch partners from socios_cliente table
      const { data: partnersData, error: partnersError } = await supabase
        .from('socios')
        .select('id, nome, cpf, percentual_participacao')
        .eq('cliente_id', clientId)
        .order('criado_em');

      if (partnersError) {
        console.error('Error fetching partners:', partnersError);
        return null;
      }

      // Build partners list
      const partners: PartnerInfo[] = (partnersData || []).map((partner, index) => ({
        index: index + 1,
        name: partner.nome,
        cpf: partner.cpf || undefined,
        percentage: partner.percentual_participacao || 33.33
      }));

      // 2. Fetch fuel expenses (abastecimentos)
      let fuelQuery = supabase
        .from('abastecimentos')
        .select('id, data, trecho, local, valor_total, partner_index, observacao')
        .eq('id_clientes', clientId)
        .gte('data', format(start, 'yyyy-MM-dd'))
        .lte('data', format(end, 'yyyy-MM-dd'));

      if (aircraftId) {
        fuelQuery = fuelQuery.eq('aeronave_id', aircraftId);
      }

      const { data: fuelData, error: fuelError } = await fuelQuery;

      if (fuelError) {
        console.error('Error fetching fuel expenses:', fuelError);
      }

      // Process expenses
      const expenses: PartnerExpense[] = (fuelData || []).map(item => {
        // Try to extract partner from observacao if partner_index is null
        let partnerIndex = item.partner_index;
        if (!partnerIndex && item.observacao) {
          const match = item.observacao.match(/\[Partner:([^\]]+)\]/);
          if (match) {
            const partnerName = match[1];
            const foundPartner = partners.find(p => p.nome === partnerName);
            if (foundPartner) {
              partnerIndex = foundPartner.index;
            }
          }
        }

        return {
          id: item.id,
          date: item.data,
          description: `Abastecimento - ${item.local || item.trecho || 'N/A'}`,
          amount: item.valor_total || 0,
          partner_index: partnerIndex,
          type: partnerIndex ? 'direct' as const : 'shared' as const,
          category: 'Abastecimento'
        };
      });

      // Calculate totals
      const totalExpenses = expenses.reduce((sum, e) => sum + e.valor, 0);
      const sharedExpenses = expenses
        .filter(e => e.tipo === 'shared')
        .reduce((sum, e) => sum + e.valor, 0);

      // Calculate per-partner summaries
      const partnerSummaries: PartnerExpenseSummary[] = partners.map(partner => {
        const directExpenses = expenses
          .filter(e => e.partner_index === partner.index)
          .reduce((sum, e) => sum + e.valor, 0);
        
        // Shared expenses are split according to configured percentage
        const sharedPortion = sharedExpenses * (partner.percentage / 100);
        const partnerTotal = directExpenses + sharedPortion;
        
        // Real percentage = (direct + shared portion) / total
        const realPercentage = totalExpenses > 0 
          ? (partnerTotal / totalExpenses) * 100 
          : 0;

        return {
          partner,
          directExpenses,
          sharedExpenses: sharedPortion,
          totalExpenses: partnerTotal,
          realPercentage: Math.round(realPercentage * 100) / 100,
          difference: Math.round((realPercentage - partner.percentage) * 100) / 100
        };
      });

      return {
        client: {
          id: clientData.id,
          company_name: clientData.razao_social || '',
          cnpj: clientData.cnpj || ''
        },
        partners,
        totalExpenses,
        sharedExpenses,
        partnerSummaries,
        period: {
          start: format(start, 'yyyy-MM-dd'),
          end: format(end, 'yyyy-MM-dd')
        }
      };
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000
  });
}

export function useAllClientsWithPartners() {
  return useQuery({
    queryKey: ['clients-with-partners'],
    queryFn: async () => {
      // Fetch all clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clientes')
        .select('id, razao_social, cnpj')
        .order('razao_social');

      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        return [];
      }

      // Fetch clients that have partners
      const { data: partnersData, error: partnersError } = await supabase
        .from('socios')
        .select('cliente_id');

      if (partnersError) {
        console.error('Error fetching partners:', partnersError);
        return clientsData || [];
      }

      const clientsWithPartners = new Set((partnersData || []).map(p => p.cliente_id));

      // Filter clients to only those with partners
      return (clientsData || []).filter(client => clientsWithPartners.has(client.id));
    },
    staleTime: 5 * 60 * 1000
  });
}
