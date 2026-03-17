import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BudgetVersion {
  id: string;
  budget_id: string;
  version: number;
  data: any;
  changed_fields?: any;
  changed_by?: string;
  changed_at: string;
  created_at: string;
}

export interface ServiceOrderBudgetLink {
  id: string;
  service_order_id: string;
  budget_id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  created_at: string;
  created_by?: string;
  approved_at?: string;
  approved_by?: string;
  approval_notes?: string;
  version: number;
  updated_at: string;
}

export function useCTMBudgetTracking() {
  /**
   * Get full history of budget versions
   */
  const getBudgetHistory = useCallback(async (budgetId: string): Promise<BudgetVersion[]> => {
    try {
      const { data, error } = await supabase
        .from('ctm_budget_versions')
        .select('*')
        .eq('budget_id', budgetId)
        .order('version', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error loading budget history:', errorMessage);
      toast.error('Erro ao carregar histórico de versões');
      return [];
    }
  }, []);

  /**
   * Create a new budget version (tracks changes)
   */
  const createBudgetVersion = useCallback(
    async (
      budgetId: string,
      data: any,
      changedFields?: Record<string, any>,
      userId?: string
    ): Promise<BudgetVersion | null> => {
      try {
        // Get the next version number
        const { data: lastVersion, error: versionError } = await supabase
          .from('ctm_budget_versions')
          .select('version')
          .eq('budget_id', budgetId)
          .order('version', { ascending: false })
          .limit(1)
          .single();

        if (versionError && versionError.code !== 'PGRST116') {
          throw versionError;
        }

        const nextVersion = (lastVersion?.version || 0) + 1;

        // Insert new version record
        const { data: newVersion, error: insertError } = await supabase
          .from('ctm_budget_versions')
          .insert([
            {
              budget_id: budgetId,
              version: nextVersion,
              data,
              changed_fields: changedFields || {},
              changed_by: userId,
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;

        return newVersion;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error creating budget version:', errorMessage);
        toast.error('Erro ao criar versão de orçamento');
        return null;
      }
    },
    []
  );

  /**
   * Approve a budget and link it to OAS
   */
  const approveBudget = useCallback(
    async (
      budgetId: string,
      oasId: string,
      userId?: string,
      notes?: string
    ): Promise<ServiceOrderBudgetLink | null> => {
      try {
        // Get the linking record
        const { data: link, error: linkError } = await supabase
          .from('ctm_service_order_budgets')
          .select('*')
          .eq('budget_id', budgetId)
          .eq('service_order_id', oasId)
          .single();

        if (linkError && linkError.code !== 'PGRST116') {
          throw linkError;
        }

        // Update status to approved
        const { data: updated, error: updateError } = await supabase
          .from('ctm_service_order_budgets')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: userId,
            approval_notes: notes,
          })
          .eq('budget_id', budgetId)
          .eq('service_order_id', oasId)
          .select()
          .single();

        if (updateError) throw updateError;

        toast.success('Orçamento aprovado com sucesso');
        return updated;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error approving budget:', errorMessage);
        toast.error('Erro ao aprovar orçamento');
        return null;
      }
    },
    []
  );

  /**
   * Reject a budget
   */
  const rejectBudget = useCallback(
    async (
      budgetId: string,
      oasId: string,
      userId?: string,
      notes?: string
    ): Promise<ServiceOrderBudgetLink | null> => {
      try {
        const { data: updated, error } = await supabase
          .from('ctm_service_order_budgets')
          .update({
            status: 'rejected',
            approved_at: new Date().toISOString(),
            approved_by: userId,
            approval_notes: notes,
          })
          .eq('budget_id', budgetId)
          .eq('service_order_id', oasId)
          .select()
          .single();

        if (error) throw error;

        toast.success('Orçamento rejeitado');
        return updated;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error rejecting budget:', errorMessage);
        toast.error('Erro ao rejeitar orçamento');
        return null;
      }
    },
    []
  );

  /**
   * Get OAS linked to a budget
   */
  const getLinkedOAS = useCallback(async (budgetId: string) => {
    try {
      const { data, error } = await supabase
        .from('ctm_service_order_budgets')
        .select('*, service_order:ctm_service_orders(*)')
        .eq('budget_id', budgetId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error loading linked OAS:', errorMessage);
      return [];
    }
  }, []);

  /**
   * Get all budget links for an OAS
   */
  const getOASBudgetLinks = useCallback(async (oasId: string): Promise<ServiceOrderBudgetLink[]> => {
    try {
      const { data, error } = await supabase
        .from('ctm_service_order_budgets')
        .select('*')
        .eq('service_order_id', oasId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error loading OAS budget links:', errorMessage);
      return [];
    }
  }, []);

  /**
   * Update budget link status
   */
  const updateBudgetLinkStatus = useCallback(
    async (
      linkId: string,
      status: 'draft' | 'submitted' | 'approved' | 'rejected',
      userId?: string,
      notes?: string
    ): Promise<ServiceOrderBudgetLink | null> => {
      try {
        const updates: any = {
          status,
          updated_at: new Date().toISOString(),
        };

        if (status === 'approved' || status === 'rejected') {
          updates.approved_at = new Date().toISOString();
          updates.approved_by = userId;
          if (notes) updates.approval_notes = notes;
        }

        const { data, error } = await supabase
          .from('ctm_service_order_budgets')
          .update(updates)
          .eq('id', linkId)
          .select()
          .single();

        if (error) throw error;

        toast.success('Status do orçamento atualizado com sucesso');
        return data;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error updating budget link status:', errorMessage);
        toast.error('Erro ao atualizar status do orçamento');
        return null;
      }
    },
    []
  );

  return {
    getBudgetHistory,
    createBudgetVersion,
    approveBudget,
    rejectBudget,
    getLinkedOAS,
    getOASBudgetLinks,
    updateBudgetLinkStatus,
  };
}
