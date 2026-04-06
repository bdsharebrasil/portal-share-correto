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
  clientes_id: string;
  id_aeronave: string | null;
  tipo_despesa: string;
  descricao: string;
  valor_total: number;
  cpf_socio: string | null;
  nome_socio: string | null;
  status: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  nome_fornecedor: string | null;
  numero_fatura: string | null;
  url_fatura: string | null;
  metodo_pagamento: string | null;
  observacoes: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string | null;
  prazo: string;
  nome_banco: string | null;
  doc: string | null;
  quantidade_parcelas: number | null;
  numero_parcela: number | null;
  id_despesa_pai: string | null;
  data_inicio_parcelamento: string | null;
  tipo_referencia: string | null;
  id_referencia: string | null;
  boleto_url: string | null;
  demonstrativo_url: string | null;
  nf_url: string | null;
  percentual_socio: number | null;
  categoria: string | null;
}

function mapPartnerExpenseStatusToBankReconciliationStatus(status?: string): string | null {
  if (!status) return null;
  const normalized = status.toLowerCase().trim();

  if (normalized === "paid" || normalized === "pago" || normalized === "reembolsado") {
    return "reembolsado";
  }
  if (normalized === "pending" || normalized === "pendente") {
    return "pendente";
  }
  if (normalized === "aguardando_reembolso" || normalized === "aguardando reembolso") {
    return "aguardando_reembolso";
  }

  return null;
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
        .eq("cliente_id", clientId)
        .order("socio_nome");

      if (error) throw error;

      // Deduplicate by client_partner_id (primary) or partner_cpf (fallback)
      const accounts = (data || []) as PartnerAccount[];
      const seenByPartner = new Set<string>();
      const seenById = new Set<string | null>();

      const deduplicated = accounts.filter((account) => {
        const partnerId = account.socio_cliente_id_id || account.id;
        const cpfKey = account.partner_cpf;

        // Prefer deduplication by client_partner_id
        if (partnerId && seenById.has(partnerId)) return false;
        if (partnerId) seenById.add(partnerId);

        // Fallback: deduplicate by CPF if client_partner_id is null
        if (!account.socio_cliente_id_id && cpfKey && seenByPartner.has(cpfKey)) {
          return false;
        }
        if (!account.socio_cliente_id_id && cpfKey) {
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
        .from("socios_cliente")
        .select("id, nome, cpf, percentual_participacao")
        .eq("cliente_id", clientId);

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
        .eq("clientes_id", clientId)
        .order("criado_em", { ascending: false });

      if (filters?.partnerCpf) query = query.eq("socio_cpf", filters.partnerCpf);
      if (filters?.startDate) query = query.gte("criado_em", filters.startDate);
      if (filters?.endDate) query = query.lte("criado_em", filters.endDate);
      if (filters?.tipo) query = query.eq("transaction_type", filters.tipo);

      const { data: transactions, error } = await query;
      if (error) throw error;

      // ── 3. Buscar despesas ───────────────────────────────────────────────────
      const { data: expenses, error: expenseError } = await supabase
        .from("partner_expenses")
        .select("*")
        .eq("clientes_id", clientId);

      if (expenseError) console.warn("Erro ao carregar despesas:", expenseError);

      // ── 4. Buscar relatórios de viagem vinculados às despesas ────────────────
      //    (para exibir o número do relatório no campo de obs)
      const travelReportIds = [
        ...new Set(
          (expenses || [])
            .filter(
              (exp: any) =>
                exp.tipo_referencia === "travel_expense_report" ||
                exp.tipo_referencia === "viagem" ||
                exp.tipo_referencia === "travel_report"
            )
            .map((exp: any) => exp.id_referencia)
            .filter(Boolean)
        ),
      ];

      let travelReportsMap = new Map<string, any>();

      if (travelReportIds.length > 0) {
        const { data: reports, error: rError } = await supabase
          .from("travel_expense_reports")
          .select("id, numero_relatorio, socios_cliente_id")
          .in("id", travelReportIds as string[]);

        if (rError) console.warn("Erro ao carregar relatórios de viagem:", rError);

        (reports || []).forEach((r: any) => {
          travelReportsMap.set(r.id, r);
        });
      }

      // ── 5. Mapear despesas → formato de transação ────────────────────────────
      const expensesAsTransactions = (expenses || []).map((exp: any) => {
        // Resolver nome do parceiro: primeiro tenta pelo CPF na tabela client_partners
        const cpfClean = (exp.cpf_socio || "").replace(/\D/g, "");
        const partnerFromTable = partnersByCpf.get(cpfClean);
        const resolvedPartnerName =
          partnerFromTable?.nome ?? exp.nome_socio ?? "CONTA BANCARIA";

        // Resolver número do relatório de viagem (para o campo de obs)
        let notesWithReport = exp.observacoes || null;
        let finalReferenceType = exp.tipo_referencia || "partner_expense";
        let finalReferenceId = exp.referencia_id || exp.id;

        // Se a despesa é de abastecimento, deve ter reference_type "abastecimento"
        if (exp.expense_type === "abastecimento" || exp.categoria === "abastecimento") {
          finalReferenceType = "abastecimento";
          // Mantém reference_id se já tiver, senão usa exp.id
          if (!exp.referencia_id) {
            finalReferenceId = exp.id;
          }
        }
        // Se é viagem, garante que reference_type seja travel_expense_report
        else if (
          exp.tipo_referencia === "travel_expense_report" ||
          exp.tipo_referencia === "viagem" ||
          exp.tipo_referencia === "travel_report" ||
          exp.expense_type === "viagem"
        ) {
          finalReferenceType = "travel_expense_report";
        }

        if (
          exp.referencia_id &&
          (finalReferenceType === "travel_expense_report")
        ) {
          const linkedReport = travelReportsMap.get(exp.referencia_id);
          if (linkedReport?.numero_relatorio) {
            const reportTag = `Relatório de Viagem: ${linkedReport.numero_relatorio}`;
            notesWithReport = notesWithReport
              ? `${notesWithReport}\n${reportTag}`
              : reportTag;

            // Se o relatório tem socios_cliente_id, resolver o nome pela tabela
            if (linkedReport.socios_cliente_id) {
              const partnerFromReport = partnersMap.get(linkedReport.socios_cliente_id);
              if (partnerFromReport) {
                // Sobrescreve com o parceiro correto do relatório
                Object.assign(exp, {
                  _resolved_partner_name: partnerFromReport.nome,
                  _resolved_partner_cpf: partnerFromReport.cpf,
                });
              }
            }
          }
        }

        return {
          id: exp.id,
          client_id: exp.clientes_id,
          partner_cpf: exp._resolved_partner_cpf ?? exp.cpf_socio ?? "N/A",
          partner_name: exp._resolved_partner_name ?? resolvedPartnerName,
          transaction_type: "expense",
          amount: exp.valor_total,
          balance_before: 0,
          balance_after: 0,
          description: exp.descricao,
          reference_type: finalReferenceType,
          reference_id: finalReferenceId,
          payment_date: exp.data_vencimento,
          receipt_url: null,
          notes: notesWithReport,
          created_by: null,
          created_at: exp.criado_em,
          expense_type: exp.tipo_despesa,
          status: exp.status,
          bank_name: exp.nome_banco || null,
          prazo: exp.prazo || null,
          payment_method: exp.metodo_pagamento || null,
          doc: exp.numero_fatura || null,
          aeronave_id: exp.id_aeronave || null,
          // Campos adicionais para abastecimentos (quando vêm de partner_expenses)
          ...(exp.tipo_despesa === "abastecimento" && {
            comanda: exp.comanda || null,
            nf: exp.nf || null,
            trecho: exp.trecho || null,
            local: exp.local || null,
            litros: exp.litros || 0,
            abastecedor: exp.abastecedor || exp.nome_fornecedor || null,
            abastecimento_galoes: exp.abastecimento_galoes || null,
            comanda_url: exp.comanda_url || null,
            nota_url: exp.nota_url || null,
            boleto_url: exp.boleto_url || null,
            comprovante_pagamento: exp.comprovante_url || null,
            observacao: exp.observacoes || null,
          }),
          // Campos adicionais para viagens (quando vêm de partner_expenses)
          ...(exp.tipo_despesa === "viagem" && {
            numero_relatorio: exp.numero_fatura || null,
            rota: exp.nome_fornecedor || null,
            dias_count: 0,
            crew_member_name: exp.nome_fornecedor || null,
            crew_member_name2: null,
            aircraft_registration: null,
            total_crew: 0,
            total_crew1: 0,
            total_crew2: 0,
            total_sharebrasil: 0,
            total_client: 0,
            url_pdf: null,
            spent_crew: 0,
            remaining_crew: 0,
            spent_sharebrasil: 0,
            remaining_sharebrasil: 0,
            data_inicio: exp.data_vencimento,
            data_fim: exp.data_vencimento,
            observations: exp.notes || null,
          }),
        };
      });

      // ── 6. Buscar abastecimentos ─────────────────────────────────────────────
      const { data: fuels, error: fuelError } = await supabase
        .from("abastecimentos")
        .select("*")
        .eq("id_clientes", clientId);

      if (fuelError) console.warn("Erro ao carregar abastecimentos:", fuelError);

      const fuelsAsTransactions = (fuels || []).map((f: any) => {
        // Resolver parceiro pelo nome armazenado no abastecimento (busca por nome na tabela)
        const partnerByName = (clientPartners || []).find(
          (cp: any) =>
            cp.nome?.toLowerCase() === (f.nome_socio || "").toLowerCase()
        );

        // Use data_pagamento as the date that matters for monthly reports
        // Fall back to data (date of fueling) if no payment date
        const effectiveDate = f.data_pagamento || f.data;

        return {
          id: f.id,
          client_id: f.cliente_id,
          partner_cpf: partnerByName?.cpf ?? "N/A",
          partner_name: partnerByName?.nome ?? f.nome_socio ?? "CONTA BANCARIA",
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
          created_at: f.criado_em,
          expense_type: "abastecimento",
          status: f.situacao_pagamento || null,
          bank_name: f.banco || null,
          prazo: f.prazo || null,
          payment_method: f.forma_pagamento || null,
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
        let defaultStatus = t.situacao;
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
          partner_name: normalizePartnerName(t.nome_socio),
          status: defaultStatus,
        };
      }).sort((a, b) => {
        const dateA = new Date(a.criado_em).getTime();
        const dateB = new Date(b.criado_em).getTime();
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
        .eq("clientes_id", clientId)
        .order("criado_em", { ascending: false });

      if (filters?.situacao) query = query.eq("status", filters.situacao);
      if (filters?.partnerCpf) query = query.eq("cpf_socio", filters.partnerCpf);
      if (filters?.tipo) query = query.eq("tipo_despesa", filters.tipo);

      const { data, error } = await query;
      if (error) throw error;

      const expenses = (data || []) as PartnerExpense[];

      // Buscar client_partners para resolver nomes
      const { data: clientPartners } = await supabase
        .from("socios_cliente")
        .select("id, nome, cpf, percentual_participacao")
        .eq("cliente_id", clientId);

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
                (exp as any).tipo_referencia === "travel_expense_report" ||
                (exp as any).tipo_referencia === "viagem"
            )
            .map((exp: any) => exp.id_referencia)
            .filter(Boolean)
        ),
      ];

      let travelReportsMap = new Map<string, any>();
      if (travelReportIds.length > 0) {
        const { data: reports } = await supabase
          .from("travel_expense_reports")
          .select("id, numero_relatorio, socios_cliente_id")
          .in("id", travelReportIds as string[]);

        (reports || []).forEach((r: any) => travelReportsMap.set(r.id, r));
      }

      return expenses.map((exp: any) => {
        const cpfClean = (exp.cpf_socio || "").replace(/\D/g, "");
        const partnerFromTable = partnersByCpf.get(cpfClean);

        let notes = exp.observacoes || null;
        if (
          exp.id_referencia &&
          (exp.tipo_referencia === "travel_expense_report" ||
            exp.tipo_referencia === "viagem" ||
            exp.tipo_referencia === "travel_report")
        ) {
          const linkedReport = travelReportsMap.get(exp.id_referencia);
          if (linkedReport?.numero_relatorio) {
            const reportTag = `Relatório de Viagem: ${linkedReport.numero_relatorio}`;
            notes = notes ? `${notes}\n${reportTag}` : reportTag;
          }
        }

        return {
          ...exp,
          assigned_partner_name: partnerFromTable?.nome ?? exp.nome_socio,
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
          .eq("cliente_id", data.clientId);

        let clientPartnerId = data.clientPartnerId;
        if (!clientPartnerId) {
          // Fetch client_partner_id from client_partners
          const { data: partnerData, error: pErr } = await supabase
            .from("socios_cliente")
            .select("id")
            .eq("cliente_id", data.clientId)
            .eq("cpf", data.partnerCpf)
            .single();
          if (pErr) throw pErr;
          clientPartnerId = partnerData.id;
        }

        accountQuery = accountQuery.eq("socios_cliente_id", clientPartnerId);

        const { data: account, error: accErr } = await accountQuery.maybeSingle();
        if (accErr) throw accErr;

        let accountId: string;
        if (account) {
          balanceBefore = Number(account.current_balance);
          balanceAfter = balanceBefore + data.valor;
          accountId = account.id;

          const { error: updErr } = await supabase
            .from("partner_accounts")
            .update({
              current_balance: balanceAfter,
              total_deposited: Number(account.total_deposited) + data.valor,
            })
            .eq("id", account.id);
          if (updErr) throw updErr;
        } else {
          // Create new account
          balanceBefore = 0;
          balanceAfter = data.valor;

          const { data: newAccount, error: insErr } = await supabase
            .from("partner_accounts")
            .insert({
              cliente_id: data.clientId,
              socios_cliente_id: clientPartnerId,
              socio_cpf: data.partnerCpf,
              socio_nome: data.partnerName,
              current_balance: balanceAfter,
              total_deposited: data.valor,
              total_spent: 0,
            })
            .select("id")
            .single();
          if (insErr) throw insErr;
          accountId = newAccount.id;
        }
      } else {
        balanceAfter = data.valor;
      }

      const { error: txErr } = await supabase
        .from("partner_transactions")
        .insert({
          clientes_id: data.clientId,
          socio_cpf: data.partnerCpf || "00000000000",
          socio_nome: data.partnerName,
          tipo: "deposit",
          valor: data.valor,
          saldo_antes: balanceBefore,
          saldo_depois: balanceAfter,
          descricao: data.descricao,
          url_comprovante: data.receiptUrl || null,
          data_pagamento: data.paymentDate,
          banco_nome: data.bankName?.toUpperCase() || null,
          subtipo: data.transactionSubtype?.toUpperCase() || "DEPOSIT",
          tipo_referencia: data.referenceId ? "partner_expense" : null,
          referencia_id: data.referenceId || null,
          status: "RECEBIDO",
          metodo_pagamento: data.paymentMethod?.toUpperCase() || null,
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
        .select("tipo_despesa, categoria")
        .eq("id", data.expenseId)
        .single();

      if (expense && (expense.tipo_despesa === "abastecimento" || expense.categoria === "abastecimento")) {
        throw new Error("Abastecimentos devem ser pagos via Controle de Abastecimentos, não aqui.");
      }

      const { data: account, error: accErr } = await supabase
        .from("partner_accounts")
        .select("id, current_balance, total_spent")
        .eq("cliente_id", data.clientId)
        .eq("socio_cpf", data.partnerCpf)
        .single();
      if (accErr) throw accErr;

      const balanceBefore = Number(account.current_balance);
      if (balanceBefore < data.valor) {
        throw new Error(`Saldo insuficiente. Disponível: R$ ${balanceBefore.toFixed(2)}`);
      }

      const balanceAfter = balanceBefore - data.valor;

      const { error: txErr } = await supabase
        .from("partner_transactions")
        .insert({
          clientes_id: data.clientId,
          socio_cpf: data.partnerCpf,
          socio_nome: data.partnerName,
          tipo: "payment",
          valor: data.valor,
          saldo_antes: balanceBefore,
          saldo_depois: balanceAfter,
          descricao: `Pagamento de despesa`,
          tipo_referencia: "expense",
          referencia_id: data.expenseId,
          data_pagamento: data.paymentDate,
          status: "pago",
        });
      if (txErr) throw txErr;

      const { error: updErr } = await supabase
        .from("partner_accounts")
        .update({
          current_balance: balanceAfter,
          total_spent: Number(account.total_spent) + data.valor,
        })
        .eq("id", account.id);
      if (updErr) throw updErr;

      const { error: expErr } = await supabase
        .from("partner_expenses")
        .update({
          status: "paid",
          cpf_socio: data.partnerCpf,
          nome_socio: data.partnerName,
          data_pagamento: data.paymentDate,
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
      percentualSocio?: number | null;
      doc?: string | null;
      boletoUrl?: string | null;
      demonstrativoUrl?: string | null;
    }) => {
      // Se for abastecimento, NUNCA criar em partner_expenses - apenas atualizar abastecimentos
      if (data.expenseType === "abastecimento" || data.categoria === "abastecimento") {
        if (data.abastecimentoId) {
          // Atualizar abastecimento existente
          try {
            const updatePayload: any = {
              status_pagamento:
                data.situacao === "paid" || data.situacao === "pago" ? "pago" : "pendente",
              partner_name: (data.assignedPartnerName || "").replace(/^\[|\]$/g, "") || null,
              updated_at: new Date().toISOString(),
            };

            // Se a despesa foi marcada como paga, sincroniza a data_pagamento
            if ((data.situacao === "paid" || data.situacao === "pago") && data.dueDate) {
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

      // Normalize fields to UPPERCASE
      const normalizedPaymentMethod = data.paymentMethod?.toUpperCase() || null;
      const normalizedStatus = data.situacao?.toUpperCase() || "PENDING";
      const normalizedPrazo = data.prazo?.toUpperCase() || null;
      const normalizedBankName = data.bankName?.toUpperCase() || null;
      const normalizedSupplierName = data.supplierName?.toUpperCase() || null;

      const expenses = [];

      if (isInstallment) {
        const originalExpense: any = {
          clientes_id: data.clientId,
          id_aeronave: data.aircraftId || null,
          tipo_despesa: data.expenseType,
          descricao: data.description,
          valor_total: data.totalAmount,
          cpf_socio: data.assignedPartnerCpf || null,
          nome_socio: data.assignedPartnerName || null,
          nome_fornecedor: normalizedSupplierName,
          data_vencimento: data.dueDate || null,
          numero_fatura: data.invoiceNumber || null,
          url_fatura: data.invoiceUrl || null,
          metodo_pagamento: normalizedPaymentMethod,
          observacoes:
            `${data.notes || ""}${data.notes ? "\n" : ""}Parcelado em ${installmentCount}x de R$ ${installmentAmount.toFixed(2)}` ||
            null,
          status: normalizedStatus,
          prazo: normalizedPrazo,
          nome_banco: normalizedBankName,
          tipo_referencia: data.referenceType || null,
          id_referencia: data.referenceId || null,
          quantidade_parcelas: installmentCount,
          numero_parcela: 0,
          data_inicio_parcelamento: startDate?.toISOString().split("T")[0] || null,
          id_despesa_pai: null,
          percentual_socio: data.percentualSocio ?? null,
          categoria: data.categoria || null,
          doc: data.doc || null,
          boleto_url: data.boletoUrl || null,
          demonstrativo_url: data.demonstrativoUrl || null,
        };

        expenses.push(originalExpense);

        for (let i = 1; i <= installmentCount; i++) {
          const installmentDate = new Date(startDate!);
          installmentDate.setMonth(installmentDate.getMonth() + (i - 1));

          expenses.push({
            clientes_id: data.clientId,
            id_aeronave: data.aircraftId || null,
            tipo_despesa: data.expenseType,
            descricao: `${data.description} (${i}/${installmentCount})`,
            valor_total: installmentAmount,
            cpf_socio: data.assignedPartnerCpf || null,
            nome_socio: data.assignedPartnerName || null,
            nome_fornecedor: normalizedSupplierName,
            data_vencimento: installmentDate.toISOString().split("T")[0],
            numero_fatura: data.invoiceNumber || null,
            url_fatura: data.invoiceUrl || null,
            metodo_pagamento: normalizedPaymentMethod,
            observacoes: data.notes || null,
            status: normalizedStatus,
            prazo: normalizedPrazo,
            nome_banco: normalizedBankName,
            tipo_referencia: data.referenceType || null,
            id_referencia: data.referenceId || null,
            quantidade_parcelas: installmentCount,
            numero_parcela: i,
            data_inicio_parcelamento: startDate?.toISOString().split("T")[0] || null,
            id_despesa_pai: null,
            percentual_socio: data.percentualSocio ?? null,
            categoria: data.categoria || null,
            doc: data.doc || null,
            boleto_url: data.boletoUrl || null,
            demonstrativo_url: data.demonstrativoUrl || null,
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
          clientes_id: data.clientId,
          id_aeronave: data.aircraftId || null,
          tipo_despesa: data.expenseType,
          descricao: data.description,
          valor_total: data.totalAmount,
          cpf_socio: data.assignedPartnerCpf || null,
          nome_socio: data.assignedPartnerName || null,
          nome_fornecedor: normalizedSupplierName,
          data_vencimento: data.dueDate || null,
          numero_fatura: data.invoiceNumber || null,
          url_fatura: data.invoiceUrl || null,
          metodo_pagamento: normalizedPaymentMethod,
          observacoes: data.notes || null,
          status: normalizedStatus,
          prazo: normalizedPrazo,
          nome_banco: normalizedBankName,
          tipo_referencia: data.referenceType || null,
          id_referencia: data.referenceId || null,
          quantidade_parcelas: 1,
          numero_parcela: 1,
          percentual_socio: data.percentualSocio ?? null,
          categoria: data.categoria || null,
          doc: data.doc || null,
          boleto_url: data.boletoUrl || null,
          demonstrativo_url: data.demonstrativoUrl || null,
        });
        if (error) throw error;
      }

      if (data.referenceType && data.referenceId) {
        const reconcStatus = mapPartnerExpenseStatusToBankReconciliationStatus(data.situacao || undefined);
        if (reconcStatus) {
          const bankUpdate: any = {
            status: reconcStatus,
            updated_at: new Date().toISOString(),
          };
          if (reconcStatus === "reembolsado") {
            bankUpdate.data_reembolso = data.dueDate || new Date().toISOString().split("T")[0];
          }

          const { error: reconError } = await supabase
            .from("conciliacoes_bancarias")
            .update(bankUpdate)
            .eq("tipo_referencia", data.referenceType)
            .eq("referencia_id", data.referenceId);

          if (reconError) {
            console.warn("Falha ao sincronizar status de partner_expense em bank_reconciliations:", reconError.message);
          }
        }
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
        clientes_id: data.clientId,
        socio_cpf: "00000000000",
        socio_nome: data.bankName ? data.bankName.toUpperCase() : "CONTA BANCARIA",
        tipo: "deposit",
        valor: data.amount,
        saldo_antes: 0,
        saldo_depois: 0,
        descricao: data.description,
        data_pagamento: data.paymentDate,
        banco_nome: data.bankName?.toUpperCase() || null,
        subtipo: "INTEREST",
        metodo_pagamento: "OUTROS",
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
        .eq("cliente_id", data.clientId)
        .eq("socio_cpf", data.partnerCpf)
        .single();
          if (accErr) throw accErr;

          const updates: any = {};
          if (data.transactionType === "deposit") {
            updates.current_balance = Number(account.current_balance) - data.valor;
            updates.total_deposited = Number(account.total_deposited) - data.valor;
          } else if (data.transactionType === "payment") {
            updates.current_balance = Number(account.current_balance) + data.valor;
            updates.total_spent = Number(account.total_spent) - data.valor;
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
        // Normalize fields to UPPERCASE
        const normBankName = data.bankName?.toUpperCase() || null;
        const normPrazo = data.prazo?.toUpperCase() || null;
        const normSupplierName = data.supplierName?.toUpperCase() || null;
        const normPaymentMethod = data.paymentMethod?.toUpperCase() || null;
        const normStatus = data.situacao?.toUpperCase() || null;

        const { error } = await supabase
          .from("partner_expenses")
          .update({
            description: data.descricao,
            total_amount: data.valor,
            due_date: data.dueDate || data.paymentDate,
            paid_date: data.paymentDate,
            notes: data.notes || null,
            bank_name: normBankName,
            prazo: normPrazo,
            category: data.categoria || null,
            expense_type: data.expenseType || data.categoria || undefined,
            supplier_name: normSupplierName,
            payment_method: normPaymentMethod,
            status: normStatus,
            assigned_partner_cpf: data.assignedPartnerCpf || null,
            assigned_partner_name: data.assignedPartnerName || null,
            invoice_number: data.invoiceNumber || null,
            invoice_url: data.invoiceUrl || null,
            reference_type: data.referenceType || null,
            reference_id: data.referenceId || null,
            aeronave_id: data.aeronaveId || null,
          })
          .eq("id", data.id);
        if (error) throw error;

        // Sincronizar status na conciliação bancária quando é um relatório de viagem referenciado
        if (data.referenceType && data.referenceId) {
          const reconcStatus = mapPartnerExpenseStatusToBankReconciliationStatus(normStatus || undefined);
          if (reconcStatus) {
            const bankUpdate: any = {
              status: reconcStatus,
              updated_at: new Date().toISOString(),
            };
            if (reconcStatus === "reembolsado") {
              bankUpdate.data_reembolso = data.paymentDate || new Date().toISOString().split("T")[0];
            }

            const { error: reconError } = await supabase
              .from("conciliacoes_bancarias")
              .update(bankUpdate)
              .eq("tipo_referencia", data.referenceType)
              .eq("referencia_id", data.referenceId);

            if (reconError) {
              console.warn("Falha ao sincronizar status de partner_expense em bank_reconciliations:", reconError.message);
            }
          }
        }
      } else if (data.transactionType === "abastecimento") {
        const { data: fuelRecord, error: fuelFetchError } = await supabase
          .from("abastecimentos")
          .select("litros")
          .eq("id", data.id)
          .single();

        if (fuelFetchError) throw fuelFetchError;

        const litros = Number(fuelRecord?.litros || 0);
        const updatePayload: any = {
          descricao: data.descricao,
          observacao: data.notes || null,
          abastecedor: data.supplierName || null,
          banco: data.bankName || null,
          partner_name: data.assignedPartnerName || null,
          nf: data.invoiceNumber || null,
          nota_url: data.invoiceUrl || null,
          data_vencimento_boleto: data.dueDate || null,
          updated_at: new Date().toISOString(),
        };

        if (litros > 0 && Number.isFinite(data.valor)) {
          updatePayload.valor_unitario = Number((data.valor / litros).toFixed(10));
        }

        // Update status and payment date
        if (data.situacao === "paid" || data.situacao === "pago") {
          updatePayload.situacao_pagamento = "pago";
          updatePayload.data_pagamento = data.paymentDate;
        } else if (data.situacao === "pendente" || data.situacao === "pending") {
          updatePayload.situacao_pagamento = "pendente";
          updatePayload.data_pagamento = null;
        } else {
          updatePayload.situacao_pagamento = data.situacao || "pendente";
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
            descricao: data.descricao,
            valor: data.valor,
            data_pagamento: data.paymentDate,
            observacoes: data.notes || null,
            banco_nome: data.bankName || null,
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
