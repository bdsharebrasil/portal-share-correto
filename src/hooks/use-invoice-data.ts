// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientDocument: string;
  clientEmail: string;
  clientAddress: string;
  serviceDescription: string;
  value: string;
  issueDate: string;
  dueDate: string | null;
  observations: string;
  status: "issued" | "paid" | "cancelled";
  pdfUrl?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AccountsReceivable {
  id: string;
  invoiceId: string;
  amount: number;
  dueDate: string;
  status: "open" | "partial" | "paid";
  created_at?: string;
  updated_at?: string;
}

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("user_id", user.id)
        .order("criado_em", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar notas fiscais");
        console.error("Error loading invoices:", error);
        return [];
      }

      return (data || []) as unknown as Invoice[];
    },
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceData: any) => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // Gerar número de nota fiscal
      const invoiceNumber = `NF-${Date.now()}`;

      // Inserir nota fiscal
      const { data: invoiceInsert, error: invoiceError } = await supabase
        .from("invoices")
        .insert([
          {
            user_id: user.id,
            invoice_number: invoiceNumber,
            client_name: invoiceData.clientName,
            client_document: invoiceData.clientDocument,
            client_email: invoiceData.clientEmail,
            client_address: invoiceData.clientAddress,
            service_description: invoiceData.serviceDescription,
            value: parseFloat(invoiceData.value),
            issue_date: invoiceData.issueDate.toISOString().split('T')[0],
            due_date: invoiceData.dueDate ? invoiceData.dueDate.toISOString().split('T')[0] : null,
            observations: invoiceData.observacoes,
            status: "issued",
          },
        ])
        .select();

      if (invoiceError) {
        throw invoiceError;
      }

      // Criar conta a receber e movimentação automaticamente
      if (invoiceInsert && invoiceInsert.length > 0) {
        const invoiceId = invoiceInsert[0].id;
        const amount = parseFloat(invoiceData.value);
        const dueDate = invoiceData.dueDate || invoiceData.issueDate;
        const dueDateStr = dueDate.toISOString().split('T')[0];
        const issueDateStr = invoiceData.issueDate.toISOString().split('T')[0];

        const { error: receivableError } = await supabase
          .from("accounts_receivable")
          .insert([
            {
              invoice_id: invoiceId,
              amount,
              due_date: dueDateStr,
              status: "open",
            },
          ]);

        if (receivableError) {
          console.error("Error creating accounts receivable:", receivableError);
        }

        // Fase 3: lançamento canônico em movimentacoes (reference_type='invoice')
        const { error: movError } = await supabase
          .from("movimentacoes")
          .insert([
            {
              descricao: `NF ${invoiceNumber} - ${invoiceData.clientName}`,
              tipo: "receita",
              valor_rateado: amount,
              data_emissao: issueDateStr,
              data_vencimento: dueDateStr,
              status: "pendente",
              numero_nf: invoiceNumber,
              fornecedor_nome: invoiceData.clientName,
              reference_type: "invoice",
              reference_id: invoiceId,
              criado_por: user.id,
            },
          ]);
        if (movError) {
          console.error("Error creating movimentacao:", movError);
        }
      }

      return invoiceInsert?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["accounts_receivable"] });
    },
  });
}

export function useAccountsReceivable() {
  return useQuery({
    queryKey: ["accounts_receivable"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from("accounts_receivable")
        .select("*")
        .order("data_vencimento", { ascending: true });

      if (error) {
        toast.error("Erro ao carregar contas a receber");
        console.error("Error loading accounts receivable:", error);
        return [];
      }

      return (data || []).map(d => ({
        ...d,
        invoiceId: d.invoice_id,
        dueDate: d.data_vencimento,
      })) as unknown as AccountsReceivable[];
    },
  });
}
