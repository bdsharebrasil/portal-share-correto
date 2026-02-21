import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BankReconciliation {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  status: string;
  category: string | null;
  client_id: string | null;
  aircraft_id: string | null;
  receiver_id: string | null;
  payment_term: string | null;
  reference_id: string | null;
  reference_type: string | null;
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
  clients?: { company_name: string } | null;
  aircraft?: { registration: string } | null;
  user_profiles?: { full_name: string } | null;
}

export function useBankReconciliations(type?: string) {
  return useQuery({
    queryKey: ["bank-reconciliations", type],
    queryFn: async () => {
      let query = supabase
        .from("bank_reconciliations")
        .select(`
          *,
          clients:client_id (company_name),
          aircraft:aircraft_id (registration),
          user_profiles:receiver_id (full_name)
        `)
        .order("date", { ascending: false });

      if (type) {
        query = query.eq("type", type);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as BankReconciliation[];
    },
  });
}
