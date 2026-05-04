import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import {
  syncPartnerToMovimentacoes,
  deletePartnerMovimentacaoMirror,
  type PartnerRefType,
} from "@/lib/partnerFinanceSync";

// --- TIPOS ---
// partner_accounts schema: id, clientes_id, socio_cpf, socio_nome, saldo_atual,
//   total_depositado, total_gasto, criado_em, atualizado_em, nome_banco,
//   juros_totais_ganhos, socios_cliente_id

type PartnerAccountRow = {
  id: string;
  clientes_id: string;
  socio_cpf: string;
  socio_nome: string;
  saldo_atual: number | null;
  total_depositado: number | null;
  total_gasto: number | null;
  criado_em: string | null;
  atualizado_em: string | null;
  nome_banco: string | null;
  juros_totais_ganhos: number | null;
  socios_cliente_id: string | null;
};

type PartnerTransactionRow = Database["public"]["Tables"]["partner_transactions"]["Row"];

export type PartnerAccount = PartnerAccountRow & {
  // Aliases para compatibilidade com o restante do código
  client_id: string;
  client_partner_id: string | null;
  partner_cpf: string;
  partner_name: string;
  nome_socio: string;
};

export type PartnerTransaction = PartnerTransactionRow & {
  // Aliases em inglês
  client_id: string;
  partner_cpf: string;
  partner_name: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  reference_type: string | null;
  payment_date: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Aliases em PT (espelham as colunas reais)
  nome_socio: string;
  socio_cpf: string;
  tipo: string;
  valor: number;
  saldo_antes: number;
  saldo_depois: number;
  descricao: string | null;
  tipo_referencia: string | null;
  data_pagamento: string | null;
  url_comprovante: string | null;
  observacoes: string | null;
  criado_por: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  status: string | null;
  banco_nome: string | null;
  documento: string | null;
  subtipo: string | null;
};

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
  categoria: string | null;
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
}

// --- HELPERS ---

function normalizeCpf(value?: string | null) {
  return value?.replace(/\D/g, "") || "";
}

function normalizeDisplayPartnerName(value?: string | null) {
  const normalized = (value || "").trim();
  const lower = normalized.toLowerCase();
  if (!normalized || lower === "conta compartilhada" || lower === "geral" || lower === "outros" || lower === "n/a") {
    return "CONTA BANCARIA";
  }
  return normalized;
}

function normalizePartnerAccount(account: PartnerAccountRow): PartnerAccount {
  const partnerName = normalizeDisplayPartnerName(account.socio_nome);
  return {
    ...account,
    // Aliases
    client_id: account.clientes_id,         // clientes_id → client_id
    client_partner_id: account.socios_cliente_id,
    partner_cpf: account.socio_cpf,
    partner_name: partnerName,
    nome_socio: partnerName,
  };
}

function normalizePartnerTransaction(transaction: Record<string, any>): PartnerTransaction {
  const partnerName = normalizeDisplayPartnerName(
    transaction.partner_name ?? transaction.nome_socio ?? transaction.socio_nome
  );
  const transactionType = transaction.transaction_type ?? transaction.tipo ?? "expense";
  const amount = Number(transaction.amount ?? transaction.valor ?? 0);
  const balanceBefore = Number(transaction.balance_before ?? transaction.saldo_antes ?? 0);
  const balanceAfter = Number(transaction.balance_after ?? transaction.saldo_depois ?? 0);
  const description = transaction.description ?? transaction.descricao ?? null;
  const referenceType = transaction.reference_type ?? transaction.tipo_referencia ?? null;
  const paymentDate = transaction.payment_date ?? transaction.data_pagamento ?? null;
  const receiptUrl = transaction.receipt_url ?? transaction.url_comprovante ?? null;
  const notes = transaction.notes ?? transaction.observacoes ?? null;
  const createdBy = transaction.created_by ?? transaction.criado_por ?? null;
  const createdAt = transaction.created_at ?? transaction.criado_em ?? null;
  const updatedAt = transaction.updated_at ?? transaction.atualizado_em ?? null;
  const status = transaction.status ?? null;
  const bankName = transaction.bank_name ?? transaction.banco_nome ?? null;
  const doc = transaction.doc ?? transaction.documento ?? null;
  const subtype = transaction.transaction_subtype ?? transaction.subtipo ?? null;
  const partnerCpf = transaction.partner_cpf ?? transaction.socio_cpf ?? "";
  const clientId = transaction.client_id ?? transaction.clientes_id ?? transaction.cliente_id ?? "";

  return {
    ...transaction,
    // Campos EN (aliases)
    client_id: clientId,
    partner_cpf: partnerCpf,
    partner_name: partnerName,
    transaction_type: transactionType,
    amount,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    description,
    reference_type: referenceType,
    payment_date: paymentDate,
    receipt_url: receiptUrl,
    notes,
    created_by: createdBy,
    created_at: createdAt,
    updated_at: updatedAt,
    // Campos PT (colunas reais do banco)
    clientes_id: transaction.clientes_id ?? clientId,
    socio_cpf: transaction.socio_cpf ?? partnerCpf,
    nome_socio: partnerName,
    tipo: transactionType,
    valor: amount,
    saldo_antes: balanceBefore,
    saldo_depois: balanceAfter,
    descricao: description,
    tipo_referencia: referenceType,
    data_pagamento: paymentDate,
    url_comprovante: receiptUrl,
    observacoes: notes,
    criado_por: createdBy,
    criado_em: createdAt,
    atualizado_em: updatedAt,
    status,
    banco_nome: bankName,
    bank_name: bankName,
    payment_method: transaction.payment_method ?? transaction.metodo_pagamento ?? null,
    metodo_pagamento: transaction.metodo_pagamento ?? transaction.payment_method ?? null,
    prazo: transaction.prazo ?? null,
    doc,
    documento: doc,
    transaction_subtype: subtype,
    subtipo: subtype,
  } as unknown as PartnerTransaction;
}

function mapPartnerExpenseStatusToBankReconciliationStatus(status?: string): string | null {
  if (!status) return null;
  const normalized = status.toLowerCase().trim();
  if (normalized === "paid" || normalized === "pago" || normalized === "reembolsado") return "reembolsado";
  if (normalized === "pending" || normalized === "pendente") return "pendente";
  if (normalized === "aguardando_reembolso" || normalized === "aguardando reembolso") return "aguardando_reembolso";
  return null;
}

// --- HOOKS DE LEITURA (QUERIES) ---

export function useSocioAccounts(clientId: string | null) {
  return useQuery({
    queryKey: ["partner-accounts", clientId],
    queryFn: async () => {
      if (!clientId) return [];

      // partner_accounts usa clientes_id (não cliente_id)
      const { data, error } = await supabase
        .from("partner_accounts")
        .select("*")
        .eq("clientes_id", clientId)
        .order("socio_nome", { ascending: true });

      if (error) throw error;

      const accounts = ((data || []) as PartnerAccountRow[]).map(normalizePartnerAccount);
      const seenByPartner = new Set<string>();
      const seenById = new Set<string | null>();

      const deduplicated = accounts.filter((account) => {
        const partnerId = account.client_partner_id || account.id;
        const cpfKey = normalizeCpf(account.partner_cpf);

        if (partnerId && seenById.has(partnerId)) return false;
        if (partnerId) seenById.add(partnerId);

        if (!account.client_partner_id && cpfKey && seenByPartner.has(cpfKey)) return false;
        if (!account.client_partner_id && cpfKey) seenByPartner.add(cpfKey);

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

      // 1. Buscar socios_cliente
      const { data: clientPartners, error: cpError } = await supabase
        .from("socios_cliente")
        .select("id, nome, cpf, percentual_participacao")
        .eq("cliente_id", clientId);

      if (cpError) console.warn("Erro ao carregar socios_cliente:", cpError);
      const partnersMap = new Map((clientPartners || []).map((cp: any) => [cp.id, cp]));
      const partnersByCpf = new Map(
        (clientPartners || []).map((cp: any) => [cp.cpf?.replace(/\D/g, ""), cp])
      );

      // 2. Buscar partner_transactions (usa clientes_id e criado_em)
      let query = supabase
        .from("partner_transactions")
        .select("*")
        .eq("clientes_id", clientId)
        .order("criado_em", { ascending: false });

      if (filters?.partnerCpf) query = query.eq("socio_cpf", filters.partnerCpf);
      if (filters?.startDate) query = query.gte("criado_em", filters.startDate);
      if (filters?.endDate) query = query.lte("criado_em", filters.endDate);
      if (filters?.type) query = query.eq("tipo", filters.type);

      const { data: transactions, error } = await query;
      if (error) throw error;

      // 3. Buscar partner_expenses (usa clientes_id e criado_em)
      const { data: expenses, error: expenseError } = await supabase
        .from("partner_expenses")
        .select("*")
        .eq("clientes_id", clientId);

      if (expenseError) console.warn("Erro ao carregar despesas:", expenseError);

      // 4. Buscar relatórios de viagem vinculados
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
        (reports || []).forEach((r: any) => travelReportsMap.set(r.id, r));
      }

      // 5. Mapear partner_expenses → formato de transação
      const expensesAsTransactions = (expenses || []).map((exp: any) => {
        const cpfClean = (exp.cpf_socio || "").replace(/\D/g, "");
        const partnerFromTable = partnersByCpf.get(cpfClean);
        const resolvedPartnerName = partnerFromTable?.nome ?? exp.nome_socio ?? "CONTA BANCARIA";

        let notesWithReport = exp.observacoes || null;
        let finalReferenceType = exp.tipo_referencia || "partner_expense";
        let finalReferenceId = exp.id_referencia || exp.id;

        if (exp.tipo_despesa === "abastecimento" || exp.categoria === "abastecimento") {
          finalReferenceType = "abastecimento";
          if (!exp.id_referencia) finalReferenceId = exp.id;
        } else if (
          exp.tipo_referencia === "travel_expense_report" ||
          exp.tipo_referencia === "viagem" ||
          exp.tipo_referencia === "travel_report" ||
          exp.tipo_despesa === "viagem"
        ) {
          finalReferenceType = "travel_expense_report";
        }

        if (exp.id_referencia && finalReferenceType === "travel_expense_report") {
          const linkedReport = travelReportsMap.get(exp.id_referencia);
          if (linkedReport?.numero_relatorio) {
            const reportTag = `Relatório de Viagem: ${linkedReport.numero_relatorio}`;
            notesWithReport = notesWithReport ? `${notesWithReport}\n${reportTag}` : reportTag;

            if (linkedReport.socios_cliente_id) {
              const partnerFromReport = partnersMap.get(linkedReport.socios_cliente_id);
              if (partnerFromReport) {
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
            observations: exp.observacoes || null,
          }),
        };
      });

      // 6. Buscar abastecimentos
      const { data: fuels, error: fuelError } = await supabase
        .from("abastecimentos")
        .select("*")
        .eq("id_clientes", clientId);

      if (fuelError) console.warn("Erro ao carregar abastecimentos:", fuelError);

      const fuelsAsTransactions = (fuels || []).map((f: any) => {
        const partnerByName = (clientPartners || []).find(
          (cp: any) => cp.nome?.toLowerCase() === (f.nome_socio || "").toLowerCase()
        );
        const effectiveDate = f.data_pagamento || f.data;

        return {
          id: f.id,
          client_id: f.id_clientes || clientId,
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
          created_at: f.created_at || f.criado_em || null,
          expense_type: "abastecimento",
          status: f.status_pagamento || null,
          bank_name: f.banco || null,
          prazo: f.prazo || null,
          payment_method: f.forma_pagamento || null,
          doc: f.comanda || null,
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

      // 7. Combinar, normalizar e ordenar
      const combined = [
        ...(transactions || []),
        ...expensesAsTransactions,
        ...fuelsAsTransactions,
      ]
        .map((t) => {
          const normalized = normalizePartnerTransaction(t);
          if (!normalized.status) {
            normalized.status =
              normalized.transaction_type === "deposit"
                ? "recebido"
                : normalized.transaction_type === "payment"
                  ? "pago"
                  : "pendente";
          }
          return normalized;
        })
        .sort((a, b) => {
          const dateA = new Date(a.payment_date || a.created_at || a.criado_em || 0).getTime();
          const dateB = new Date(b.payment_date || b.created_at || b.criado_em || 0).getTime();
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
    type?: string; // corrigido: era filters?.tipo mas o param se chama type
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

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.partnerCpf) query = query.eq("cpf_socio", filters.partnerCpf);
      if (filters?.type) query = query.eq("tipo_despesa", filters.type); // corrigido: filters.tipo → filters.type

      const { data, error } = await query;
      if (error) throw error;

      const expenses = (data || []) as PartnerExpense[];

      const { data: clientPartners } = await supabase
        .from("socios_cliente")
        .select("id, nome, cpf, percentual_participacao")
        .eq("cliente_id", clientId);

      const partnersByCpf = new Map(
        (clientPartners || []).map((cp: any) => [cp.cpf?.replace(/\D/g, ""), cp])
      );

      const travelReportIds = [
        ...new Set(
          expenses
            .filter(
              (exp) =>
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
      amount: number;       // ← EN
      description: string;
      receiptUrl?: string;
      paymentDate: string;
      bankName?: string | null;
      transactionSubtype?: string;
      prazo?: string;
      referenceId?: string;
      referenceType?: string;
      paymentMethod?: string | null;
      clientPartnerId?: string | null;
      documento?: string | null;
      notes?: string | null;
      createdBy?: string | null;
    }) => {
      let balanceBefore = 0;
      let balanceAfter = 0;

      if (data.partnerCpf) {
        let clientPartnerId = data.clientPartnerId;
        if (!clientPartnerId) {
          const { data: partnerData, error: pErr } = await supabase
            .from("socios_cliente")
            .select("id")
            .eq("cliente_id", data.clientId)
            .eq("cpf", data.partnerCpf)
            .single();
          if (pErr) throw pErr;
          clientPartnerId = partnerData.id;
        }

        // partner_accounts usa clientes_id (não cliente_id)
        const { data: account, error: accErr } = await supabase
          .from("partner_accounts")
          .select("id, saldo_atual, total_depositado, socios_cliente_id")
          .eq("clientes_id", data.clientId)
          .eq("socios_cliente_id", clientPartnerId)
          .maybeSingle();
        if (accErr) throw accErr;

        if (account) {
          balanceBefore = Number(account.saldo_atual);
          balanceAfter = balanceBefore + data.amount;

          const { error: updErr } = await supabase
            .from("partner_accounts")
            .update({
              saldo_atual: balanceAfter,
              total_depositado: Number(account.total_depositado) + data.amount,
            })
            .eq("id", account.id);
          if (updErr) throw updErr;
        } else {
          balanceBefore = 0;
          balanceAfter = data.amount;

          const { error: insErr } = await supabase
            .from("partner_accounts")
            .insert({
              clientes_id: data.clientId,
              socios_cliente_id: clientPartnerId,
              socio_cpf: data.partnerCpf,
              socio_nome: data.partnerName,
              saldo_atual: balanceAfter,
              total_depositado: data.amount,
              total_gasto: 0,
            })
            .select("id")
            .single();
          if (insErr) throw insErr;
        }
      } else {
        balanceAfter = data.amount;
      }

      const { data: txInserted, error: txErr } = await supabase
        .from("partner_transactions")
        .insert({
          clientes_id: data.clientId,
          socio_cpf: data.partnerCpf || "00000000000",
          socio_nome: data.partnerName,
          tipo: "deposit",
          valor: parseFloat(data.amount.toFixed(2)),
          saldo_antes: parseFloat(balanceBefore.toFixed(2)),
          saldo_depois: parseFloat(balanceAfter.toFixed(2)),
          descricao: data.description,
          url_comprovante: data.receiptUrl || null,
          data_pagamento: data.paymentDate,
          banco_nome: data.bankName?.toUpperCase() || null,
          subtipo: data.transactionSubtype?.toUpperCase() || "deposit",
          tipo_referencia: data.referenceType || null,
          referencia_id: data.referenceId || null,
          status: "recebido",
          metodo_pagamento: data.paymentMethod?.toUpperCase() || null,
          documento: data.documento || null,
          observacoes: data.notes || null,
          criado_por: data.createdBy || null,
          prazo: (data.prazo || "extra").toLowerCase() as "mensal" | "extra",
        })
        .select("id")
        .single();
      if (txErr) throw txErr;

      // Espelho em movimentacoes (Fase 4)
      if (txInserted?.id) {
        await syncPartnerToMovimentacoes({
          refType: "partner_deposit",
          refId: txInserted.id,
          tipo: "receita",
          descricao: data.description,
          valor: data.amount,
          data_competencia: data.paymentDate,
          data_pagamento: data.paymentDate,
          status: "pago",
          clientes_id: data.clientId,
          banco_nome: data.bankName?.toUpperCase() || null,
          forma_pagamento: data.paymentMethod?.toUpperCase() || null,
          fornecedor_nome: data.partnerName,
          numero_doc: data.documento || null,
          comprovante_url: data.receiptUrl || null,
          observacoes: data.notes || null,
          criado_por: data.createdBy || null,
        });
      }

      return data.clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ["partner-accounts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["partner-transactions", clientId] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      if (showToast) toast.success("Depósito registrado com sucesso!");
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
      amount: number;       // ← EN
      paymentDate: string;
    }) => {
      const { data: expense } = await supabase
        .from("partner_expenses")
        .select("tipo_despesa, categoria")
        .eq("id", data.expenseId)
        .single();

      if (expense && (expense.tipo_despesa === "abastecimento" || expense.categoria === "abastecimento")) {
        throw new Error("Abastecimentos devem ser pagos via Controle de Abastecimentos, não aqui.");
      }

      // partner_accounts usa clientes_id (não cliente_id)
      const { data: account, error: accErr } = await supabase
        .from("partner_accounts")
        .select("id, saldo_atual, total_gasto")
        .eq("clientes_id", data.clientId)
        .eq("socio_cpf", data.partnerCpf)
        .single();
      if (accErr) throw accErr;

      const balanceBefore = Number(account.saldo_atual);
      if (balanceBefore < data.amount) {
        throw new Error(`Saldo insuficiente. Disponível: R$ ${balanceBefore.toFixed(2)}`);
      }

      const balanceAfter = balanceBefore - data.amount;

      const { data: txInserted, error: txErr } = await supabase
        .from("partner_transactions")
        .insert({
          clientes_id: data.clientId,
          socio_cpf: data.partnerCpf,
          socio_nome: data.partnerName,
          tipo: "payment",
          valor: parseFloat(data.amount.toFixed(2)),
          saldo_antes: parseFloat(balanceBefore.toFixed(2)),
          saldo_depois: parseFloat(balanceAfter.toFixed(2)),
          descricao: "Pagamento de despesa",
          tipo_referencia: "expense",
          referencia_id: data.expenseId,
          data_pagamento: data.paymentDate,
          status: "pago",
          subtipo: "payment",
          prazo: "extra",
        })
        .select("id")
        .single();
      if (txErr) throw txErr;

      // Espelho em movimentacoes (Fase 4)
      if (txInserted?.id) {
        await syncPartnerToMovimentacoes({
          refType: "partner_payment",
          refId: txInserted.id,
          tipo: "despesa",
          descricao: `Pagamento de despesa (${data.partnerName})`,
          valor: data.amount,
          data_competencia: data.paymentDate,
          data_pagamento: data.paymentDate,
          status: "pago",
          clientes_id: data.clientId,
          fornecedor_nome: data.partnerName,
          observacoes: `partner_expense_id=${data.expenseId}`,
          criado_por: null,
        });
      }

      const { error: updErr } = await supabase
        .from("partner_accounts")
        .update({
          saldo_atual: balanceAfter,
          total_gasto: Number(account.total_gasto) + data.amount,
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
      if (data.expenseType === "abastecimento" || data.category === "abastecimento") {
        if (data.abastecimentoId) {
          const updatePayload: any = {
            status_pagamento:
              data.status === "paid" || data.status === "pago" ? "pago" : "pendente",
            partner_name: (data.assignedPartnerName || "").replace(/^\[|\]$/g, "") || null,
            updated_at: new Date().toISOString(),
          };
          if ((data.status === "paid" || data.status === "pago") && data.dueDate) {
            updatePayload.data_pagamento = data.dueDate;
          }
          const { error } = await supabase
            .from("abastecimentos")
            .update(updatePayload)
            .eq("id", data.abastecimentoId);
          if (error) throw error;
          return data.clientId;
        } else {
          throw new Error(
            "Abastecimento deve ser criado diretamente na tabela abastecimentos, não via partner_expenses"
          );
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

      const normalizedPaymentMethod = data.paymentMethod?.toUpperCase() || null;
      const normalizedStatus = data.status?.toUpperCase() || "PENDING";
      const normalizedPrazo = data.prazo?.toUpperCase() || null;
      const normalizedBankName = data.bankName?.toUpperCase() || null;
      const normalizedSupplierName = data.supplierName?.toUpperCase() || null;

      // Campos mapeados para o schema real de partner_expenses
      const baseExpenseFields = {
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
        status: normalizedStatus,
        prazo: normalizedPrazo || "extra",         // prazo NOT NULL no schema
        nome_banco: normalizedBankName,
        tipo_referencia: data.referenceType || null,
        id_referencia: data.referenceId || null,
        percentual_socio: data.percentualSocio ?? null,
        categoria: data.category || null,          // corrigido: data.categoria → data.category
        doc: data.doc || null,
        boleto_url: data.boletoUrl || null,
        demonstrativo_url: data.demonstrativoUrl || null,
      };

      if (isInstallment) {
        const originalExpense = {
          ...baseExpenseFields,
          valor_total: data.totalAmount,
          observacoes:
            `${data.notes || ""}${data.notes ? "\n" : ""}Parcelado em ${installmentCount}x de R$ ${installmentAmount.toFixed(2)}`,
          quantidade_parcelas: installmentCount,
          numero_parcela: 0,
          data_inicio_parcelamento: startDate?.toISOString().split("T")[0] || null,
          id_despesa_pai: null,
        };

        const { data: createdOriginal, error: originalError } = await supabase
          .from("partner_expenses")
          .insert([originalExpense])
          .select()
          .single();
        if (originalError) throw originalError;

        const installments = [];
        for (let i = 1; i <= installmentCount; i++) {
          const installmentDate = new Date(startDate!);
          installmentDate.setMonth(installmentDate.getMonth() + (i - 1));
          installments.push({
            ...baseExpenseFields,
            descricao: `${data.description} (${i}/${installmentCount})`,
            valor_total: installmentAmount,
            observacoes: data.notes || null,
            quantidade_parcelas: installmentCount,
            numero_parcela: i,
            data_vencimento: installmentDate.toISOString().split("T")[0],
            data_inicio_parcelamento: startDate?.toISOString().split("T")[0] || null,
            id_despesa_pai: createdOriginal.id,
          });
        }

        if (installments.length > 0) {
          const { error: installmentsError } = await supabase
            .from("partner_expenses")
            .insert(installments);
          if (installmentsError) throw installmentsError;
        }
      } else {
        const { data: createdExp, error } = await supabase
          .from("partner_expenses")
          .insert({
            ...baseExpenseFields,
            observacoes: data.notes || null,
            quantidade_parcelas: 1,
            numero_parcela: 1,
          })
          .select("id")
          .single();
        if (error) throw error;

        // Espelho em movimentacoes (Fase 4)
        if (createdExp?.id) {
          const isPaid = (data.status || "").toLowerCase() === "paid" || (data.status || "").toLowerCase() === "pago";
          await syncPartnerToMovimentacoes({
            refType: "partner_expense",
            refId: createdExp.id,
            tipo: "despesa",
            descricao: data.description,
            valor: data.totalAmount,
            data_competencia: data.dueDate || new Date().toISOString().split("T")[0],
            data_vencimento: data.dueDate || null,
            data_pagamento: isPaid ? (data.dueDate || new Date().toISOString().split("T")[0]) : null,
            status: isPaid ? "pago" : "pendente",
            clientes_id: data.clientId,
            aeronave_id: data.aircraftId || null,
            banco_nome: normalizedBankName,
            forma_pagamento: normalizedPaymentMethod,
            fornecedor_nome: normalizedSupplierName,
            numero_doc: data.doc || null,
            numero_nf: data.invoiceNumber || null,
            nf_url: data.invoiceUrl || null,
            boleto_url: data.boletoUrl || null,
            observacoes: data.notes || null,
            reembolsavel: !!data.assignedPartnerCpf,
            criado_por: null,
          });
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
      if (showToast) toast.success("Despesa criada com sucesso!");
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
        valor: parseFloat(data.amount.toFixed(2)),
        saldo_antes: 0,
        saldo_depois: 0,
        descricao: data.description,
        data_pagamento: data.paymentDate,
        banco_nome: data.bankName?.toUpperCase() || null,
        subtipo: "interest",
        metodo_pagamento: "outros",
        status: "recebido",
        prazo: "extra",
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
      amount: number;      // ← EN (era data.valor em vários lugares)
      referenceType?: string;
    }) => {
      if (data.referenceType === "abastecimento" || data.transactionType === "abastecimento") {
        const { error } = await supabase.from("abastecimentos").delete().eq("id", data.id);
        if (error) throw error;
      } else if (
        data.transactionType === "expense" ||
        data.referenceType === "partner_expense"
      ) {
        const { data: despesasManutencao, error: fetchError } = await supabase
          .from("despesas_manutencao")
          .select("id")
          .eq("partner_expense_id", data.id);
        if (fetchError) throw fetchError;

        if (despesasManutencao && despesasManutencao.length > 0) {
          const despesaIds = despesasManutencao.map((d) => d.id);

          const { error: rateioError } = await supabase
            .from("despesas_manutencao_rateio")
            .delete()
            .in("despesa_manutencao_id", despesaIds);
          if (rateioError) throw rateioError;

          const { error: despesaError } = await supabase
            .from("despesas_manutencao")
            .delete()
            .in("id", despesaIds);
          if (despesaError) throw despesaError;
        }

        const { error } = await supabase.from("partner_expenses").delete().eq("id", data.id);
        if (error) throw error;
      } else {
        if (data.partnerCpf && data.partnerCpf !== "00000000000") {
          // partner_accounts usa clientes_id (não cliente_id)
          const { data: account, error: accErr } = await supabase
            .from("partner_accounts")
            .select("id, saldo_atual, total_depositado, total_gasto")
            .eq("clientes_id", data.clientId)
            .eq("socio_cpf", data.partnerCpf)
            .single();
          if (accErr) throw accErr;

          const updates: any = {};
          if (data.transactionType === "deposit") {
            updates.saldo_atual = Number(account.saldo_atual) - data.amount;
            updates.total_depositado = Number(account.total_depositado) - data.amount;
          } else if (data.transactionType === "payment") {
            updates.saldo_atual = Number(account.saldo_atual) + data.amount;
            updates.total_gasto = Number(account.total_gasto) - data.amount;
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
      if (
        data.transactionType === "partner_expense" ||
        data.transactionType === "travel_report" ||
        data.transactionType === "travel_expense_report"
      ) {
        const normBankName = data.bankName?.toUpperCase() || null;
        const normPrazo = data.prazo?.toUpperCase() || null;
        const normSupplierName = data.supplierName?.toUpperCase() || null;
        const normPaymentMethod = data.paymentMethod?.toUpperCase() || null;
        const normStatus = data.status?.toUpperCase() || null;

        // Campos mapeados para o schema real de partner_expenses (todos em PT)
        const { error } = await supabase
          .from("partner_expenses")
          .update({
            descricao: data.description,           // corrigido: description → descricao
            valor_total: data.amount,              // corrigido: total_amount → valor_total
            data_vencimento: data.dueDate || data.paymentDate,  // corrigido: due_date → data_vencimento
            data_pagamento: data.paymentDate,      // corrigido: paid_date → data_pagamento
            observacoes: data.notes || null,       // corrigido: notes → observacoes
            nome_banco: normBankName,              // corrigido: bank_name → nome_banco
            prazo: normPrazo,
            categoria: data.category || null,      // corrigido: category → categoria
            tipo_despesa: data.expenseType || data.category || undefined, // corrigido: expense_type → tipo_despesa
            nome_fornecedor: normSupplierName,     // corrigido: supplier_name → nome_fornecedor
            metodo_pagamento: normPaymentMethod,   // corrigido: payment_method → metodo_pagamento
            status: normStatus,
            cpf_socio: data.assignedPartnerCpf || null,         // corrigido: assigned_partner_cpf → cpf_socio
            nome_socio: data.assignedPartnerName || null,        // corrigido: assigned_partner_name → nome_socio
            numero_fatura: data.invoiceNumber || null,           // corrigido: invoice_number → numero_fatura
            url_fatura: data.invoiceUrl || null,                 // corrigido: invoice_url → url_fatura
            tipo_referencia: data.referenceType || null,         // corrigido: reference_type → tipo_referencia
            id_referencia: data.referenceId || null,             // corrigido: reference_id → id_referencia
            id_aeronave: data.aircraftId || null,                // corrigido: aeronave_id → id_aeronave
          })
          .eq("id", data.id);
        if (error) throw error;

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
              console.warn("Falha ao sincronizar status em conciliacoes_bancarias:", reconError.message);
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
          updatePayload.valor_unitario = Number((data.amount / litros).toFixed(10)); // corrigido: data.valor → data.amount
        }

        if (data.status === "paid" || data.status === "pago") {
          updatePayload.status_pagamento = "pago";
          updatePayload.data_pagamento = data.paymentDate;
        } else if (data.status === "pendente" || data.status === "pending") {
          updatePayload.status_pagamento = "pendente";
          updatePayload.data_pagamento = null;
        } else {
          updatePayload.status_pagamento = data.status || "pendente";
          if (data.paymentDate) updatePayload.data_pagamento = data.paymentDate;
        }

        const { error } = await supabase
          .from("abastecimentos")
          .update(updatePayload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        // partner_transactions: campos em PT
        const { error } = await supabase
          .from("partner_transactions")
          .update({
            descricao: data.description,
            valor: parseFloat(data.amount.toFixed(2)),
            data_pagamento: data.paymentDate,
            observacoes: data.notes || null,
            banco_nome: data.bankName || null,
            prazo: data.prazo ? (data.prazo.toLowerCase() as "mensal" | "extra") : "extra",
            metodo_pagamento: data.paymentMethod?.toUpperCase() || null,
            status: data.status?.toLowerCase() || null,
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
