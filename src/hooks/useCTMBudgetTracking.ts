import { useCallback } from 'react';
import { fromUntyped } from '@/lib/supabase-helpers';
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

  const getBudgetHistory = useCallback(async (budgetId: string): Promise<BudgetVersion[]> => {
    try {
      const { data, error } = await fromUntyped('ctm_budget_versions')
        .select('*')
        .eq('budget_id', budgetId)
        .order('version', { ascending: true });

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Error loading budget history:', error);
      toast.error('Erro ao carregar histórico de versões');
      return [];
    }
  }, []);

  const createBudgetVersion = useCallback(
    async (
      budgetId: string,
      payload: any,
      changedFields?: Record<string, any>,
      userId?: string
    ): Promise<BudgetVersion | null> => {
      try {
        const { data: lastVersion, error: versionError } = await fromUntyped('ctm_budget_versions')
          .select('version')
          .eq('budget_id', budgetId)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle(); // 🔥 evita erro quando não existe

        if (versionError) throw versionError;

        const nextVersion = (lastVersion?.version || 0) + 1;

        const { data: newVersion, error: insertError } = await fromUntyped('ctm_budget_versions')
          .insert([{
            budget_id: budgetId,
            version: nextVersion,
            data: payload,
            changed_fields: changedFields || {},
            changed_by: userId,
            changed_at: new Date().toISOString(),
          }])
          .select()
          .single();

        if (insertError) throw insertError;

        return newVersion;

      } catch (error) {
        console.error('Error creating budget version:', error);
        toast.error('Erro ao criar versão de orçamento');
        return null;
      }
    },
    []
  );

  const approveBudget = useCallback(
    async (
      budgetId: string,
      oasId: string,
      userId?: string,
      notes?: string
    ): Promise<ServiceOrderBudgetLink | null> => {
      try {
        const updates = {
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: userId,
          approval_notes: notes,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await fromUntyped('ctm_service_order_budgets')
          .update(updates)
          .eq('budget_id', budgetId)
          .eq('service_order_id', oasId)
          .select()
          .single();

        if (error) throw error;

        toast.success('Orçamento aprovado com sucesso');
        return data;

      } catch (error) {
        console.error('Error approving budget:', error);
        toast.error('Erro ao aprovar orçamento');
        return null;
      }
    },
    []
  );

  const rejectBudget = useCallback(
    async (
      budgetId: string,
      oasId: string,
      userId?: string,
      notes?: string
    ): Promise<ServiceOrderBudgetLink | null> => {
      try {
        const updates = {
          status: 'rejected',
          approved_at: new Date().toISOString(),
          approved_by: userId,
          approval_notes: notes,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await fromUntyped('ctm_service_order_budgets')
          .update(updates)
          .eq('budget_id', budgetId)
          .eq('service_order_id', oasId)
          .select()
          .single();

        if (error) throw error;

        toast.success('Orçamento rejeitado');
        return data;

      } catch (error) {
        console.error('Error rejecting budget:', error);
        toast.error('Erro ao rejeitar orçamento');
        return null;
      }
    },
    []
  );

  const getLinkedOAS = useCallback(async (budgetId: string) => {
    try {
      const { data, error } = await fromUntyped('ctm_service_order_budgets')
        .select(`
          *,
          service_order:ctm_ordem_acompanhamento_servico(*)
        `)
        .eq('budget_id', budgetId);

      if (error) throw error;

      return data || [];

    } catch (error) {
      console.error('Error loading linked OAS:', error);
      return [];
    }
  }, []);

  const getOASBudgetLinks = useCallback(async (oasId: string): Promise<ServiceOrderBudgetLink[]> => {
    try {
      const { data, error } = await fromUntyped('ctm_service_order_budgets')
        .select('*')
        .eq('service_order_id', oasId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];

    } catch (error) {
      console.error('Error loading OAS budget links:', error);
      return [];
    }
  }, []);

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

        const { data, error } = await fromUntyped('ctm_service_order_budgets')
          .update(updates)
          .eq('id', linkId)
          .select()
          .single();

        if (error) throw error;

        toast.success('Status do orçamento atualizado com sucesso');
        return data;

      } catch (error) {
        console.error('Error updating budget link status:', error);
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