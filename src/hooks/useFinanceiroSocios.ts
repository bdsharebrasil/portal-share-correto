import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Interfaces mantidas
export interface PartnerAccount {
  id: string;
  client_id: string;
  client_partner_id: string | null;
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
    queryKey: ["partner-accounts", clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from("partner_accounts")
        .select("*")
        .eq("client_id", clientId)
        .order("partner_name");

      if (error) throw error;

      // Deduplicate by client_partner_id (primary) or partner_cpf (fallback)
      const accounts = (data || []) as PartnerAccount[];
      const seenByPartner = new Set<string>();
      const seenById = new Set<string | null>();

      const deduplicated = accounts.filter((account) => {
        const partnerId = account.client_partner_id || account.id;
        const cpfKey = account.partner_cpf;

        // Prefer deduplication by client_partner_id
        if (partnerId && seenById.has(partnerId)) return false;
        if (partnerId) seenById.add(partnerId);

        // Fallback: deduplicate by CPF if client_partner_id is null
        if (!account.client_partner_id && cpfKey && seenByPartner.has(cpfKey)) {
          return false;
        }
        if (!account.client_partner_id && cpfKey) {
          seenByPartner.add(cpfKey);
        }

        return true;
      });

      return deduplicated;
    },
    enabled: !!clientId,
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

      // ── 1. Buscar client_partners da tabela (fonte de verdade) ──────────────
      const { data: clientPartners, error: cpError } = await supabase
        .from("client_partners")
        .select("id, name, cpf, share_percentage")
        .eq("client_id", clientId);

      if (cpError) console.warn("Erro ao carregar client_partners:", cpError);
      const partnersMap = new Map(
        (clientPartners || []).map((cp: any) => [cp.id, cp])
      );
      const partnersByCpf = new Map(
        (clientPartners || []).map((cp: any) => [cp.cpf?.replace(/\D/g, ""), cp])
      );

      // ── 2. Buscar transações de movimentação ────────────────────────────────
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

      // ── 3. Buscar despesas ───────────────────────────────────────────────────
      const { data: expenses, error: expenseError } = await supabase
        .from("partner_expenses")
        .select("*")
        .eq("client_id", clientId);

      if (expenseError) console.warn("Erro ao carregar despesas:", expenseError);

      // ── 4. Buscar relatórios de viagem vinculados às despesas ────────────────
      //    (para exibir o número do relatório no campo de obs)
      const travelReportIds = [
        ...new Set(
          (expenses || [])
            .filter(
              (exp: any) =>
                exp.reference_type === "travel_expense_report" ||
                exp.reference_type === "viagem" ||
                exp.reference_type === "travel_report"
            )
            .map((exp: any) => exp.reference_id)
            .filter(Boolean)
        ),
      ];

      let travelReportsMap = new Map<string, any>();

      if (travelReportIds.length > 0) {
        const { data: reports, error: rError } = await supabase
          .from("travel_expense_reports")
          .select("id, report_number, client_partner")
          .in("id", travelReportIds as string[]);

        if (rError) console.warn("Erro ao carregar relatórios de viagem:", rError);

        (reports || []).forEach((r: any) => {
          travelReportsMap.set(r.id, r);
        });
      }

      // ── 5. Mapear despesas → formato de transação ────────────────────────────
      const expensesAsTransactions = (expenses || []).map((exp: any) => {
        // Resolver nome do parceiro: primeiro tenta pelo CPF na tabela client_partners
        const cpfClean = (exp.assigned_partner_cpf || "").replace(/\D/g, "");
        const partnerFromTable = partnersByCpf.get(cpfClean);
        const resolvedPartnerName =
          partnerFromTable?.name ?? exp.assigned_partner_name ?? "CONTA BANCARIA";

        // Resolver número do relatório de viagem (para o campo de obs)
        let notesWithReport = exp.notes || null;
        let finalReferenceType = exp.reference_type || "partner_expense";
        let finalReferenceId = exp.reference_id || exp.id;

        // Se a despesa é de abastecimento, deve ter reference_type "abastecimento"
        if (exp.expense_type === "abastecimento" || exp.category === "abastecimento") {
          finalReferenceType = "abastecimento";
          // Mantém reference_id se já tiver, senão usa exp.id
          if (!exp.reference_id) {
            finalReferenceId = exp.id;
          }
        }
        // Se é viagem, garante que reference_type seja travel_expense_report
        else if (
          exp.reference_type === "travel_expense_report" ||
          exp.reference_type === "viagem" ||
          exp.reference_type === "travel_report" ||
          exp.expense_type === "viagem"
        ) {
          finalReferenceType = "travel_expense_report";
        }

        if (
          exp.reference_id &&
          (finalReferenceType === "travel_expense_report")
        ) {
          const linkedReport = travelReportsMap.get(exp.reference_id);
          if (linkedReport?.report_number) {
            const reportTag = `Relatório de Viagem: ${linkedReport.report_number}`;
            notesWithReport = notesWithReport
              ? `${notesWithReport}\n${reportTag}`
              : reportTag;

            // Se o relatório tem client_partner, resolver o nome pela tabela
            if (linkedReport.client_partner) {
              const partnerFromReport = partnersMap.get(linkedReport.client_partner);
              if (partnerFromReport) {
                // Sobrescreve com o parceiro correto do relatório
                Object.assign(exp, {
                  _resolved_partner_name: partnerFromReport.name,
                  _resolved_partner_cpf: partnerFromReport.cpf,
                });
              }
            }
          }
        }

        return {
          id: exp.id,
          client_id: exp.client_id,
          partner_cpf: exp._resolved_partner_cpf ?? exp.assigned_partner_cpf ?? "N/A",
          partner_name: exp._resolved_partner_name ?? resolvedPartnerName,
          transaction_type: "expense",
          amount: exp.total_amount,
          balance_before: 0,
          balance_after: 0,
          description: exp.description,
          reference_type: finalReferenceType,
          reference_id: finalReferenceId,
          payment_date: exp.due_date,
          receipt_url: null,
          notes: notesWithReport,
          created_by: null,
          created_at: exp.created_at,
          expense_type: exp.expense_type,
          status: exp.status,
          bank_name: exp.bank_name || null,
          prazo: exp.prazo || null,
          payment_method: exp.payment_method || null,
          doc: exp.invoice_number || null,
          aircraft_id: exp.aircraft_id || null,
          // Campos adicionais para abastecimentos (quando vêm de partner_expenses)
          ...(exp.expense_type === "abastecimento" && {
            comanda: exp.comanda || null,
            nf: exp.nf || null,
            trecho: exp.trecho || null,
            local: exp.local || null,
            litros: exp.litros || 0,
            abastecedor: exp.abastecedor || exp.supplier_name || null,
            abastecimento_galoes: exp.abastecimento_galoes || null,
            comanda_url: exp.comanda_url || null,
            nota_url: exp.nota_url || null,
            boleto_url: exp.boleto_url || null,
            comprovante_pagamento: exp.comprovante_url || null,
            observacao: exp.notes || null,
          }),
          // Campos adicionais para viagens (quando vêm de partner_expenses)
          ...(exp.expense_type === "viagem" && {
            report_number: exp.invoice_number || null,
            route: exp.supplier_name || null,
            days_count: 0,
            crew_member_name: exp.supplier_name || null,
            crew_member_name2: null,
            aircraft_registration: null,
            total_crew: 0,
            total_crew1: 0,
            total_crew2: 0,
            total_sharebrasil: 0,
            total_client: 0,
            pdf_url: null,
            spent_crew: 0,
            remaining_crew: 0,
            spent_sharebrasil: 0,
            remaining_sharebrasil: 0,
            start_date: exp.due_date,
            end_date: exp.due_date,
            observations: exp.notes || null,
          }),
        };
      });

      // ── 6. Buscar abastecimentos ─────────────────────────────────────────────
      const { data: fuels, error: fuelError } = await supabase
        .from("abastecimentos")
        .select("*")
        .eq("client_id", clientId);

      if (fuelError) console.warn("Erro ao carregar abastecimentos:", fuelError);

      const fuelsAsTransactions = (fuels || []).map((f: any) => {
        // Resolver parceiro pelo nome armazenado no abastecimento (busca por nome na tabela)
        const partnerByName = (clientPartners || []).find(
          (cp: any) =>
            cp.name?.toLowerCase() === (f.partner_name || "").toLowerCase()
        );

        // Use data_pagamento as the date that matters for monthly reports
        // Fall back to data (date of fueling) if no payment date
        const effectiveDate = f.data_pagamento || f.data;

        return {
          id: f.id,
          client_id: f.client_id,
          partner_cpf: partnerByName?.cpf ?? "N/A",
          partner_name: partnerByName?.name ?? f.partner_name ?? "CONTA BANCARIA",
          transaction_type: "expense",
          amount: f.valor_total || 0,
          balance_before: 0,
          balance_after: 0,
          description: `Abastecimento${f.local ? ` - ${f.local}` : ""}`,
          reference_type: "abastecimento",
          reference_id: f.id,
          payment_date: effectiveDate,
          receipt_url: f.nota_url || null,
          notes: f.observacao,
          created_by: null,
          created_at: f.created_at,
          expense_type: "abastecimento",
          status: f.status_pagamento || null,
          bank_name: null,
          prazo: null,
          payment_method: null,
          doc: f.comanda || null,
          // Campos adicionais de abastecimento para exibição detalhada
          comanda: f.comanda || null,
          nf: f.nf || null,
          trecho: f.trecho || null,
          local: f.local || null,
          litros: f.litros || 0,
          abastecedor: f.abastecedor || null,
          abastecimento_galoes: f.abastecimento_galoes || null,
          comanda_url: f.comanda_url || null,
          nota_url: f.nota_url || null,
          boleto_url: f.boleto_url || null,
          comprovante_pagamento: f.comprovante_pagamento || null,
          observacao: f.observacao || null,
          supplier_name: f.abastecedor || null,
        };
      });

      // ── 7. Relatórios de viagem já estão representados em partner_expenses ───
      // Não criar transações artificiais - a dupla contagem é evitada mantendo
      // apenas as despesas (partner_expenses) que têm reference_type="travel_expense_report"

      // ── 8. Combinar, normalizar e ordenar ──────────────────────────────────
      const normalizePartnerName = (name: string) => {
        const lower = (name || "").toLowerCase();
        if (!name || lower === "conta compartilhada" || lower === "geral" || lower === "outros" || lower === "n/a") {
          return "CONTA BANCARIA";
        }
        return name;
      };

      const combined = [
        ...(transactions || []),
        ...expensesAsTransactions,
        ...fuelsAsTransactions,
      ].map((t) => {
        // Adicionar status padrão se não existir
        let defaultStatus = t.status;
        if (!defaultStatus) {
          if (t.transaction_type === "deposit") {
            defaultStatus = "recebido";
          } else if (t.transaction_type === "payment") {
            defaultStatus = "pago";
          } else if (t.transaction_type === "expense") {
            defaultStatus = "pendente";
          }
        }

        return {
          ...t,
          partner_name: normalizePartnerName(t.partner_name),
          status: defaultStatus,
        };
      }).sort((a, b) => {
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

      const expenses = (data || []) as PartnerExpense[];

      // Buscar client_partners para resolver nomes
      const { data: clientPartners } = await supabase
        .from("client_partners")
        .select("id, name, cpf, share_percentage")
        .eq("client_id", clientId);

      const partnersByCpf = new Map(
        (clientPartners || []).map((cp: any) => [cp.cpf?.replace(/\D/g, ""), cp])
      );

      // Buscar relatórios de viagem vinculados
      const travelReportIds = [
        ...new Set(
          expenses
            .filter(
              (exp) =>
                exp.notes?.includes("travel") ||
                (exp as any).reference_type === "travel_expense_report" ||
                (exp as any).reference_type === "viagem"
            )
            .map((exp: any) => exp.reference_id)
            .filter(Boolean)
        ),
      ];

      let travelReportsMap = new Map<string, any>();
      if (travelReportIds.length > 0) {
        const { data: reports } = await supabase
          .from("travel_expense_reports")
          .select("id, report_number, client_partner")
          .in("id", travelReportIds as string[]);

        (reports || []).forEach((r: any) => travelReportsMap.set(r.id, r));
      }

      return expenses.map((exp: any) => {
        const cpfClean = (exp.assigned_partner_cpf || "").replace(/\D/g, "");
        const partnerFromTable = partnersByCpf.get(cpfClean);

        let notes = exp.notes || null;
        if (
          exp.reference_id &&
          (exp.reference_type === "travel_expense_report" ||
            exp.reference_type === "viagem" ||
            exp.reference_type === "travel_report")
        ) {
          const linkedReport = travelReportsMap.get(exp.reference_id);
          if (linkedReport?.report_number) {
            const reportTag = `Relatório de Viagem: ${linkedReport.report_number}`;
            notes = notes ? `${notes}\n${reportTag}` : reportTag;
          }
        }

        return {
          ...exp,
          assigned_partner_name: partnerFromTable?.name ?? exp.assigned_partner_name,
          notes,
        };
      });
    },
    enabled: !!clientId,
  });
}

// --- HOOKS DE ESCRITA (MUTATIONS) ---

export function useAddDeposit(showToast = true) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      clientId: string;
      partnerCpf: string | null;
      partnerName: string;
      amount: number;
      description: string;
      receiptUrl?: string;
      paymentDate: string;
      bankName?: string | null;
      transactionSubtype?: string;
      prazo?: string;
      referenceId?: string;
      paymentMethod?: string | null;
      clientPartnerId?: string | null;
    }) => {
      let balanceBefore = 0;
      let balanceAfter = 0;

      if (data.partnerCpf) {
        // Try to find by client_partner_id first, fallback to CPF
        let accountQuery = supabase
          .from("partner_accounts")
          .select("id, current_balance, total_deposited, client_partner_id")
          .eq("client_id", data.clientId);

        let clientPartnerId = data.clientPartnerId;
        if (!clientPartnerId) {
          // Fetch client_partner_id from client_partners
          const { data: partnerData, error: pErr } = await supabase
            .from("client_partners")
            .select("id")
            .eq("client_id", data.clientId)
            .eq("cpf", data.partnerCpf)
            .single();
          if (pErr) throw pErr;
          clientPartnerId = partnerData.id;
        }

        accountQuery = accountQuery.eq("client_partner_id", clientPartnerId);

        const { data: account, error: accErr } = await accountQuery.maybeSingle();
        if (accErr) throw accErr;

        let accountId: string;
        if (account) {
          balanceBefore = Number(account.current_balance);
          balanceAfter = balanceBefore + data.amount;
          accountId = account.id;

          const { error: updErr } = await supabase
            .from("partner_accounts")
            .update({
              current_balance: balanceAfter,
              total_deposited: Number(account.total_deposited) + data.amount,
            })
            .eq("id", account.id);
          if (updErr) throw updErr;
        } else {
          // Create new account
          balanceBefore = 0;
          balanceAfter = data.amount;

          const { data: newAccount, error: insErr } = await supabase
            .from("partner_accounts")
            .insert({
              client_id: data.clientId,
              client_partner_id: clientPartnerId,
              partner_cpf: data.partnerCpf,
              partner_name: data.partnerName,
              current_balance: balanceAfter,
              total_deposited: data.amount,
              total_spent: 0,
            })
            .select("id")
            .single();
          if (insErr) throw insErr;
          accountId = newAccount.id;
        }
      } else {
        balanceAfter = data.amount;
      }

      const { error: txErr } = await supabase
        .from("partner_transactions")
        .insert({
          client_id: data.clientId,
          partner_cpf: data.partnerCpf || "00000000000",
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
          reference_type: data.referenceId ? "partner_expense" : null,
          reference_id: data.referenceId || null,
          status: "recebido",
          payment_method: data.paymentMethod || null,
        });
      if (txErr) throw txErr;

      return data.clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ["partner-accounts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-transactions", clientId] });
      if (showToast) {
        toast.success("Depósito registrado com sucesso!");
      }
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
      clientId: string;
      expenseId: string;
      partnerCpf: string;
      partnerName: string;
      amount: number;
      paymentDate: string;
    }) => {
      // Validar que a despesa não é um abastecimento
      const { data: expense } = await supabase
        .from("partner_expenses")
        .select("expense_type, category")
        .eq("id", data.expenseId)
        .single();

      if (expense && (expense.expense_type === "abastecimento" || expense.category === "abastecimento")) {
        throw new Error("Abastecimentos devem ser pagos via Controle de Abastecimentos, não aqui.");
      }

      const { data: account, error: accErr } = await supabase
        .from("partner_accounts")
        .select("id, current_balance, total_spent")
        .eq("client_id", data.clientId)
        .eq("partner_cpf", data.partnerCpf)
        .single();
      if (accErr) throw accErr;

      const balanceBefore = Number(account.current_balance);
      if (balanceBefore < data.amount) {
        throw new Error(`Saldo insuficiente. Disponível: R$ ${balanceBefore.toFixed(2)}`);
      }

      const balanceAfter = balanceBefore - data.amount;

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
          status: "pago",
        });
      if (txErr) throw txErr;

      const { error: updErr } = await supabase
        .from("partner_accounts")
        .update({
          current_balance: balanceAfter,
          total_spent: Number(account.total_spent) + data.amount,
        })
        .eq("id", account.id);
      if (updErr) throw updErr;

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

export function useCreateExpense(showToast = true) {
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
      isInstallment?: boolean;
      installmentCount?: number;
      installmentStartDate?: string | null;
      aircraftId?: string | null;
      status?: string | null;
      abastecimentoId?: string | null;
    }) => {
      // Se for abastecimento, NUNCA criar em partner_expenses - apenas atualizar abastecimentos
      if (data.expenseType === "abastecimento" || data.category === "abastecimento") {
        if (data.abastecimentoId) {
          // Atualizar abastecimento existente
          try {
            const updatePayload: any = {
              status_pagamento:
                data.status === "paid" || data.status === "pago" ? "pago" : "pendente",
              partner_name: (data.assignedPartnerName || "").replace(/^\[|\]$/g, "") || null,
              updated_at: new Date().toISOString(),
            };

            // Se a despesa foi marcada como paga, sincroniza a data_pagamento
            if ((data.status === "paid" || data.status === "pago") && data.dueDate) {
              updatePayload.data_pagamento = data.dueDate;
            }

            const { error } = await supabase
              .from("abastecimentos")
              .update(updatePayload)
              .eq("id", data.abastecimentoId);

            if (error) throw error;
            return data.clientId;
          } catch (syncErr) {
            console.error("Erro ao atualizar abastecimento:", syncErr);
            throw syncErr;
          }
        } else {
          // Para abastecimento sem ID, retornar erro - deve ser criado direto na tabela
          throw new Error("Abastecimento deve ser criado diretamente na tabela abastecimentos, não via partner_expenses");
        }
      }

      const isInstallment =
        data.isInstallment &&
        data.paymentMethod === "cartao" &&
        (data.installmentCount || 1) > 1;
      const installmentCount = isInstallment ? data.installmentCount || 1 : 1;
      const installmentAmount = data.totalAmount / installmentCount;
      const startDate = isInstallment
        ? new Date(
          data.installmentStartDate ||
          data.dueDate ||
          new Date().toISOString().split("T")[0]
        )
        : null;

      const expenses = [];

      if (isInstallment) {
        const originalExpense: any = {
          client_id: data.clientId,
          aircraft_id: data.aircraftId || null,
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
          notes:
            `${data.notes || ""}${data.notes ? "\n" : ""}Parcelado em ${installmentCount}x de R$ ${installmentAmount.toFixed(2)}` ||
            null,
          status: data.status || "pending",
          prazo: data.prazo || null,
          bank_name: data.bankName || null,
          reference_type: data.referenceType || null,
          reference_id: data.referenceId || null,
          installment_count: installmentCount,
          installment_number: 0,
          installment_start_date: startDate?.toISOString().split("T")[0] || null,
          parent_expense_id: null,
        };

        expenses.push(originalExpense);

        for (let i = 1; i <= installmentCount; i++) {
          const installmentDate = new Date(startDate!);
          installmentDate.setMonth(installmentDate.getMonth() + (i - 1));

          expenses.push({
            client_id: data.clientId,
            aircraft_id: data.aircraftId || null,
            expense_type: data.expenseType,
            description: `${data.description} (${i}/${installmentCount})`,
            total_amount: installmentAmount,
            assigned_partner_cpf: data.assignedPartnerCpf || null,
            assigned_partner_name: data.assignedPartnerName || null,
            supplier_name: data.supplierName || null,
            due_date: installmentDate.toISOString().split("T")[0],
            invoice_number: data.invoiceNumber || null,
            invoice_url: data.invoiceUrl || null,
            payment_method: data.paymentMethod || null,
            notes: data.notes || null,
            status: data.status || "pending",
            prazo: data.prazo || null,
            bank_name: data.bankName || null,
            reference_type: data.referenceType || null,
            reference_id: data.referenceId || null,
            installment_count: installmentCount,
            installment_number: i,
            installment_start_date: startDate?.toISOString().split("T")[0] || null,
            parent_expense_id: null,
          });
        }

        const { data: createdOriginal, error: originalError } = await supabase
          .from("partner_expenses")
          .insert([expenses[0]])
          .select()
          .single();

        if (originalError) throw originalError;

        const installmentsWithParent = expenses
          .slice(1)
          .map((exp) => ({ ...exp, parent_expense_id: createdOriginal.id }));

        if (installmentsWithParent.length > 0) {
          const { error: installmentsError } = await supabase
            .from("partner_expenses")
            .insert(installmentsWithParent);
          if (installmentsError) throw installmentsError;
        }
      } else {
        const { error } = await supabase.from("partner_expenses").insert({
          client_id: data.clientId,
          aircraft_id: data.aircraftId || null,
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
          status: data.status || "pending",
          prazo: data.prazo || null,
          bank_name: data.bankName || null,
          reference_type: data.referenceType || null,
          reference_id: data.referenceId || null,
          installment_count: 1,
          installment_number: 1,
        });
        if (error) throw error;
      }

      return data.clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ["partner-expenses", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-accounts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-transactions", clientId] });
      queryClient.invalidateQueries({ queryKey: ["abastecimentos"] });
      queryClient.invalidateQueries({ queryKey: ["client-abastecimentos"] });
      if (showToast) {
        toast.success("Despesa criada com sucesso!");
      }
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
      const { error } = await supabase.from("partner_transactions").insert({
        client_id: data.clientId,
        partner_cpf: "00000000000",
        partner_name: data.bankName ? data.bankName.toUpperCase() : "CONTA BANCARIA",
        transaction_type: "deposit",
        amount: data.amount,
        balance_before: 0,
        balance_after: 0,
        description: data.description,
        payment_date: data.paymentDate,
        bank_name: data.bankName || null,
        transaction_subtype: "interest",
        payment_method: "OUTROS",
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
    mutationFn: async (data: {
      id: string;
      clientId: string;
      transactionType: string;
      partnerCpf: string;
      amount: number;
      referenceType?: string;
    }) => {
      if (
        data.referenceType === "abastecimento" ||
        data.transactionType === "abastecimento"
      ) {
        const { error } = await supabase
          .from("abastecimentos")
          .delete()
          .eq("id", data.id);
        if (error) throw error;
      } else if (
        data.transactionType === "expense" ||
        data.referenceType === "partner_expense"
      ) {
        // 1. Buscar despesas de manutenção vinculadas a esta partner_expense
        const { data: despesasManutencao, error: fetchError } = await supabase
          .from("despesas_manutencao")
          .select("id")
          .eq("partner_expense_id", data.id);

        if (fetchError) throw fetchError;

        // 2. Deletar rateios dessas despesas de manutenção
        if (despesasManutencao && despesasManutencao.length > 0) {
          const despesaIds = despesasManutencao.map((d) => d.id);
          const { error: rateioError } = await supabase
            .from("despesas_manutencao_rateio")
            .delete()
            .in("despesa_manutencao_id", despesaIds);

          if (rateioError) throw rateioError;

          // 3. Deletar as despesas de manutenção
          const { error: despesaError } = await supabase
            .from("despesas_manutencao")
            .delete()
            .in("id", despesaIds);

          if (despesaError) throw despesaError;
        }

        // 4. Deletar a partner_expense
        const { error } = await supabase
          .from("partner_expenses")
          .delete()
          .eq("id", data.id);
        if (error) throw error;
      } else {
        if (data.partnerCpf && data.partnerCpf !== "00000000000") {
          const { data: account, error: accErr } = await supabase
            .from("partner_accounts")
            .select("id, current_balance, total_deposited, total_spent")
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
            .eq("id", account.id);
          if (updErr) throw updErr;
        }

        const { error } = await supabase
          .from("partner_transactions")
          .delete()
          .eq("id", data.id);
        if (error) throw error;
      }

      return data.clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ["partner-accounts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-transactions", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-expenses", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client-abastecimentos"] });
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
      dueDate?: string | null;
      notes?: string | null;
      bankName?: string | null;
      prazo?: string | null;
      category?: string | null;
      expenseType?: string | null;
      supplierName?: string | null;
      paymentMethod?: string | null;
      status?: string | null;
      assignedPartnerCpf?: string | null;
      assignedPartnerName?: string | null;
      invoiceNumber?: string | null;
      invoiceUrl?: string | null;
      referenceType?: string | null;
      referenceId?: string | null;
      aircraftId?: string | null;
    }) => {
      // Handle partner expenses (including travel_report type)
      if (data.transactionType === "partner_expense" || data.transactionType === "travel_report" || data.transactionType === "travel_expense_report") {
        const { error } = await supabase
          .from("partner_expenses")
          .update({
            description: data.description,
            total_amount: data.amount,
            due_date: data.dueDate || data.paymentDate,
            paid_date: data.paymentDate,
            notes: data.notes || null,
            bank_name: data.bankName || null,
            prazo: data.prazo || null,
            category: data.category || null,
            expense_type: data.expenseType || data.category || undefined,
            supplier_name: data.supplierName || null,
            payment_method: data.paymentMethod || null,
            status: data.status || null,
            assigned_partner_cpf: data.assignedPartnerCpf || null,
            assigned_partner_name: data.assignedPartnerName || null,
            invoice_number: data.invoiceNumber || null,
            invoice_url: data.invoiceUrl || null,
            reference_type: data.referenceType || null,
            reference_id: data.referenceId || null,
            aircraft_id: data.aircraftId || null,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else if (data.transactionType === "abastecimento") {
        const { data: fuelRecord, error: fuelFetchError } = await supabase
          .from("abastecimentos")
          .select("litros")
          .eq("id", data.id)
          .single();

        if (fuelFetchError) throw fuelFetchError;

        const litros = Number(fuelRecord?.litros || 0);
        const updatePayload: any = {
          descricao: data.description,
          observacao: data.notes || null,
          abastecedor: data.supplierName || null,
          banco: data.bankName || null,
          partner_name: data.assignedPartnerName || null,
          nf: data.invoiceNumber || null,
          nota_url: data.invoiceUrl || null,
          data_vencimento_boleto: data.dueDate || null,
          updated_at: new Date().toISOString(),
        };

        if (litros > 0 && Number.isFinite(data.amount)) {
          updatePayload.valor_unitario = Number((data.amount / litros).toFixed(10));
        }

        // Update status and payment date
        if (data.status === "paid" || data.status === "pago") {
          updatePayload.status_pagamento = "pago";
          updatePayload.data_pagamento = data.paymentDate;
        } else if (data.status === "pendente" || data.status === "pending") {
          updatePayload.status_pagamento = "pendente";
          updatePayload.data_pagamento = null;
        } else {
          updatePayload.status_pagamento = data.status || "pendente";
          if (data.paymentDate) {
            updatePayload.data_pagamento = data.paymentDate;
          }
        }

        // Always update payment method if provided
        if (data.paymentMethod) {
          // Store in observacao since abastecimentos doesn't have payment_method column
        }

        const { error } = await supabase
          .from("abastecimentos")
          .update(updatePayload)
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
      queryClient.invalidateQueries({ queryKey: ["abastecimentos"] });
      queryClient.invalidateQueries({ queryKey: ["client-abastecimentos"] });
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
  { value: "impostos", label: "Impostos" },
  { value: "fgts", label: "FGTS" },
  { value: "inss", label: "INSS" },
  { value: "pis", label: "PIS" },
  { value: "cofins", label: "COFINS" },
  { value: "das", label: "DAS" },
  { value: "outros", label: "Outros" },
];
