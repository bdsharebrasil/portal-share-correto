import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchInvoices,
  createInvoiceService,
  fetchAccountsReceivable,
  Invoice,
  AccountsReceivable,
} from "@/modules/core-finance/services/invoices";

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      return await fetchInvoices();
    },
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceData: any) => {
      return await createInvoiceService(invoiceData);
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
      return await fetchAccountsReceivable();
    },
  });
}
