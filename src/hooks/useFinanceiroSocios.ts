import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Interfaces mantidas
export interface PartnerAccount {
  id: string;
  client_id: string;
  partner_cpf: string;
  partner_name: string;
  current_balance: number;
  total_deposited: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface PartnerTransaction {
  id: string;
  client_id: string;
  partner_cpf: string;
  partner_name: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  payment_date: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PartnerExpense {
  id: string;
  client_id: string;
  aircraft_id: string | null;
  expense_type: string;
  description: string;
  total_amount: number;
  assigned_partner_cpf: string | null;
  assigned_partner_name: string | null;
  status: string;
  due_date: string | null;
  paid_date: string | null;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  payment_method: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// --- HOOKS DE LEITURA (QUERIES) ---

export function useSocioAccounts(clientId: string | null) {
  return useQuery({
    queryKey: ["partner-accounts", clientId], // A chave muda por cliente
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from("partner_accounts")
        .select("*")
        .eq("client_id", clientId)
        .order("partner_name");
      
      if (error) throw error;
      return (data || []) as PartnerAccount[];
    },
    enabled: !!clientId, // Só busca se tiver cliente selecionado
  });
}

export function useSocioTransactions(
  clientId: string | null,
  filters?: {
    partnerCpf?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
  }
) {
  return useQuery({
    queryKey: ["partner-transactions", clientId, filters],
    queryFn: async () => {
      if (!clientId) return [];

      let query = supabase
        .from("partner_transactions")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (filters?.partnerCpf) query = query.eq("partner_cpf", filters.partnerCpf);
      if (filters?.startDate) query = query.gte("created_at", filters.startDate);
      if (filters?.endDate) query = query.lte("created_at", filters.endDate);
      if (filters?.type) query = query.eq("transaction_type", filters.type);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PartnerTransaction[];
    },
    enabled: !!clientId,
  });
}

export function useSocioExpenses(
  clientId: string | null,
  filters?: {
    status?: string;
    partnerCpf?: string;
    type?: string;
  }
) {
  return useQuery({
    queryKey: ["partner-expenses", clientId, filters],
    queryFn: async () => {
      if (!clientId) return [];

      let query = supabase
        .from("partner_expenses")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.partnerCpf) query = query.eq("assigned_partner_cpf", filters.partnerCpf);
      if (filters?.type) query = query.eq("expense_type", filters.type);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PartnerExpense[];
    },
    enabled: !!clientId,
  });
}

// --- HOOKS DE ESCRITA (MUTATIONS) ---

export function useAddDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      clientId: string; // Obrigatório passar o ID do cliente
      partnerCpf: string;
      partnerName: string;
      amount: number;
      description: string;
      receiptUrl?: string;
      paymentDate: string;
    }) => {
      // Get current balance
      const { data: account, error: accErr } = await supabase
        .from("partner_accounts")
        .select("current_balance, total_deposited")
        .eq("client_id", data.clientId)
        .eq("partner_cpf", data.partnerCpf)
        .single();
      
      if (accErr) throw accErr;

      const balanceBefore = Number(account.current_balance);
      const balanceAfter = balanceBefore + data.amount;

      // Create transaction
      const { error: txErr } = await supabase
        .from("partner_transactions")
        .insert({
          client_id: data.clientId,
          partner_cpf: data.partnerCpf,
          partner_name: data.partnerName,
          transaction_type: "deposit",
          amount: data.amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description: data.description,
          receipt_url: data.receiptUrl || null,
          payment_date: data.paymentDate,
        });
      if (txErr) throw txErr;

      // Update account balance
      const { error: updErr } = await supabase
        .from("partner_accounts")
        .update({
          current_balance: balanceAfter,
          total_deposited: Number(account.total_deposited) + data.amount,
        })
        .eq("client_id", data.clientId)
        .eq("partner_cpf", data.partnerCpf);
      if (updErr) throw updErr;

      return data.clientId; // Retorna para usar no onSuccess
    },
    onSuccess: (clientId) => {
      // Invalida as queries específicas daquele cliente
      queryClient.invalidateQueries({ queryKey: ["partner-accounts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-transactions", clientId] });
      toast.success("Depósito registrado com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao registrar depósito: " + err.message);
    },
  });
}

export function usePayExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      clientId: string; // Obrigatório
      expenseId: string;
      partnerCpf: string;
      partnerName: string;
      amount: number;
      paymentDate: string;
    }) => {
      // Get current balance
      const { data: account, error: accErr } = await supabase
        .from("partner_accounts")
        .select("current_balance, total_spent")
        .eq("client_id", data.clientId)
        .eq("partner_cpf", data.partnerCpf)
        .single();
      if (accErr) throw accErr;

      const balanceBefore = Number(account.current_balance);
      if (balanceBefore < data.amount) {
        throw new Error(`Saldo insuficiente. Disponível: R$ ${balanceBefore.toFixed(2)}`);
      }

      const balanceAfter = balanceBefore - data.amount;

      // Create transaction
      const { error: txErr } = await supabase
        .from("partner_transactions")
        .insert({
          client_id: data.clientId,
          partner_cpf: data.partnerCpf,
          partner_name: data.partnerName,
          transaction_type: "payment",
          amount: data.amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description: `Pagamento de despesa`,
          reference_type: "expense",
          reference_id: data.expenseId,
          payment_date: data.paymentDate,
        });
      if (txErr) throw txErr;

      // Update account
      const { error: updErr } = await supabase
        .from("partner_accounts")
        .update({
          current_balance: balanceAfter,
          total_spent: Number(account.total_spent) + data.amount,
        })
        .eq("client_id", data.clientId)
        .eq("partner_cpf", data.partnerCpf);
      if (updErr) throw updErr;

      // Update expense
      const { error: expErr } = await supabase
        .from("partner_expenses")
        .update({
          status: "paid",
          assigned_partner_cpf: data.partnerCpf,
          assigned_partner_name: data.partnerName,
          paid_date: data.paymentDate,
        })
        .eq("id", data.expenseId);
      if (expErr) throw expErr;

      return data.clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ["partner-accounts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-transactions", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-expenses", clientId] });
      toast.success("Pagamento registrado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      clientId: string; // Obrigatório
      expenseType: string;
      description: string;
      totalAmount: number;
      supplierName?: string;
      dueDate?: string;
      invoiceUrl?: string;
      notes?: string;
    }) => {
      const { error } = await supabase.from("partner_expenses").insert({
        client_id: data.clientId,
        expense_type: data.expenseType,
        description: data.description,
        total_amount: data.totalAmount,
        supplier_name: data.supplierName || null,
        due_date: data.dueDate || null,
        invoice_url: data.invoiceUrl || null,
        notes: data.notes || null,
        status: "pending",
      });
      if (error) throw error;
      
      return data.clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ["partner-expenses", clientId] });
      toast.success("Despesa criada com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao criar despesa: " + err.message);
    },
  });
}

export const EXPENSE_TYPES = [
  { value: "combustivel", label: "Combustível" },
  { value: "manutencao", label: "Manutenção" },
  { value: "hangar", label: "Hangar" },
  { value: "seguro", label: "Seguro" },
  { value: "tripulacao", label: "Tripulação" },
  { value: "outros", label: "Outros" },
];