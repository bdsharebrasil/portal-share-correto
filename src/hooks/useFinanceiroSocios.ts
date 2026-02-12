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
  bank_name?: string | null;
  prazo?: string | null;
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

      // Buscar transações de movimentação
      let query = supabase
        .from("partner_transactions")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (filters?.partnerCpf) query = query.eq("partner_cpf", filters.partnerCpf);
      if (filters?.startDate) query = query.gte("created_at", filters.startDate);
      if (filters?.endDate) query = query.lte("created_at", filters.endDate);
      if (filters?.type) query = query.eq("transaction_type", filters.type);

      const { data: transactions, error } = await query;
      if (error) throw error;

      // Buscar despesas também (para mostrar na lista de transações)
      const { data: expenses, error: expenseError } = await supabase
        .from("partner_expenses")
        .select("*")
        .eq("client_id", clientId);

      if (expenseError) console.warn("Erro ao carregar despesas:", expenseError);

      // Transformar despesas em formato de transação para exibição
      const expensesAsTransactions = (expenses || []).map((exp: any) => ({
        id: exp.id,
        client_id: exp.client_id,
        partner_cpf: exp.assigned_partner_cpf || "N/A",
        partner_name: exp.assigned_partner_name || "Geral",
        transaction_type: "expense",
        amount: exp.total_amount,
        balance_before: 0,
        balance_after: 0,
        description: exp.description,
        reference_type: "partner_expense",
        reference_id: exp.id,
        payment_date: exp.due_date,
        receipt_url: null,
        notes: exp.notes,
        created_by: null,
        created_at: exp.created_at,
        expense_type: exp.expense_type,
        status: exp.status,
      }));

      // Combinar e ordenar por data
      const combined = [
        ...(transactions || []),
        ...expensesAsTransactions,
      ].sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      return combined;
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
      partnerCpf: string | null;
      partnerName: string;
      amount: number;
      description: string;
      receiptUrl?: string;
      paymentDate: string;
      bankName?: string | null;
      transactionSubtype?: string;
      prazo?: string;
    }) => {
      let balanceBefore = 0;
      let balanceAfter = 0;

      // Get current balance only if there's a partner
      if (data.partnerCpf) {
        const { data: account, error: accErr } = await supabase
          .from("partner_accounts")
          .select("current_balance, total_deposited")
          .eq("client_id", data.clientId)
          .eq("partner_cpf", data.partnerCpf)
          .single();

        if (accErr) throw accErr;

        balanceBefore = Number(account.current_balance);
        balanceAfter = balanceBefore + data.amount;

        // Update account balance only if there's a partner
        const { error: updErr } = await supabase
          .from("partner_accounts")
          .update({
            current_balance: balanceAfter,
            total_deposited: Number(account.total_deposited) + data.amount,
          })
          .eq("client_id", data.clientId)
          .eq("partner_cpf", data.partnerCpf);
        if (updErr) throw updErr;
      } else {
        // For entries without a specific partner, don't update balance
        balanceAfter = data.amount;
      }

      // Create transaction
      const { error: txErr } = await supabase
        .from("partner_transactions")
        .insert({
          client_id: data.clientId,
          partner_cpf: data.partnerCpf || "00000000000", // Use special identifier for general account
          partner_name: data.partnerName,
          transaction_type: "deposit",
          amount: data.amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description: data.description,
          receipt_url: data.receiptUrl || null,
          payment_date: data.paymentDate,
          bank_name: data.bankName || null,
          transaction_subtype: data.transactionSubtype || "deposit",
        });
      if (txErr) throw txErr;

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
      clientId: string;
      expenseType: string;
      description: string;
      totalAmount: number;
      category?: string;
      assignedPartnerCpf?: string | null;
      assignedPartnerName?: string | null;
      supplierName?: string | null;
      dueDate?: string;
      invoiceNumber?: string | null;
      invoiceUrl?: string;
      paymentMethod?: string | null;
      notes?: string | null;
      referenceType?: string | null;
      referenceId?: string | null;
      bankName?: string | null;
      prazo?: string | null;
    }) => {
      const { error } = await supabase.from("partner_expenses").insert({
        client_id: data.clientId,
        expense_type: data.expenseType,
        description: data.description,
        total_amount: data.totalAmount,
        assigned_partner_cpf: data.assignedPartnerCpf || null,
        assigned_partner_name: data.assignedPartnerName || null,
        supplier_name: data.supplierName || null,
        due_date: data.dueDate || null,
        invoice_number: data.invoiceNumber || null,
        invoice_url: data.invoiceUrl || null,
        payment_method: data.paymentMethod || null,
        notes: data.notes || null,
        status: "pending",
        reference_type: data.referenceType || null,
        reference_id: data.referenceId || null,
        prazo: data.prazo || null,
      });
      if (error) throw error;

      return data.clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ["partner-expenses", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-accounts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-transactions", clientId] });
      toast.success("Despesa criada com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao criar despesa: " + err.message);
    },
  });
}

export function useAddBankInterest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      clientId: string;
      amount: number;
      description: string;
      bankName: string;
      paymentDate: string;
    }) => {
      // For shared account interest, use a special identifier (00000000000) to represent shared account
      const { error } = await supabase
        .from("partner_transactions")
        .insert({
          client_id: data.clientId,
          partner_cpf: "00000000000",  // Special identifier for shared account
          partner_name: "Conta Compartilhada",
          transaction_type: "deposit",
          amount: data.amount,
          balance_before: 0,  // Interest doesn't affect individual partner balance
          balance_after: 0,
          description: data.description,
          payment_date: data.paymentDate,
          bank_name: data.bankName || null,
          transaction_subtype: "interest",
        });

      if (error) throw error;
      return data.clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ["partner-transactions", clientId] });
      toast.success("Rendimento bancário registrado com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao registrar rendimento: " + err.message);
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; clientId: string; transactionType: string; partnerCpf: string; amount: number }) => {
      if (data.transactionType === "expense") {
        // Delete from partner_expenses
        const { error } = await supabase.from("partner_expenses").delete().eq("id", data.id);
        if (error) throw error;
      } else {
        // Reverse balance changes
        if (data.partnerCpf && data.partnerCpf !== "00000000000") {
          const { data: account, error: accErr } = await supabase
            .from("partner_accounts")
            .select("current_balance, total_deposited, total_spent")
            .eq("client_id", data.clientId)
            .eq("partner_cpf", data.partnerCpf)
            .single();
          if (accErr) throw accErr;

          const updates: any = {};
          if (data.transactionType === "deposit") {
            updates.current_balance = Number(account.current_balance) - data.amount;
            updates.total_deposited = Number(account.total_deposited) - data.amount;
          } else if (data.transactionType === "payment") {
            updates.current_balance = Number(account.current_balance) + data.amount;
            updates.total_spent = Number(account.total_spent) - data.amount;
          }

          const { error: updErr } = await supabase
            .from("partner_accounts")
            .update(updates)
            .eq("client_id", data.clientId)
            .eq("partner_cpf", data.partnerCpf);
          if (updErr) throw updErr;
        }

        const { error } = await supabase.from("partner_transactions").delete().eq("id", data.id);
        if (error) throw error;
      }

      return data.clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ["partner-accounts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-transactions", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-expenses", clientId] });
      toast.success("Transação excluída com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir: " + err.message);
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      clientId: string;
      transactionType: string;
      description: string;
      amount: number;
      paymentDate: string;
      notes?: string | null;
      bankName?: string | null;
      prazo?: string | null;
    }) => {
      if (data.transactionType === "expense") {
        const { error } = await supabase
          .from("partner_expenses")
          .update({
            description: data.description,
            total_amount: data.amount,
            due_date: data.paymentDate,
            notes: data.notes || null,
            prazo: data.prazo || null,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("partner_transactions")
          .update({
            description: data.description,
            amount: data.amount,
            payment_date: data.paymentDate,
            notes: data.notes || null,
            bank_name: data.bankName || null,
            prazo: data.prazo || null,
          })
          .eq("id", data.id);
        if (error) throw error;
      }

      return data.clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ["partner-accounts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-transactions", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-expenses", clientId] });
      toast.success("Transação atualizada com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar: " + err.message);
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
