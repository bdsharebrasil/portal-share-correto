import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, XCircle } from "lucide-react";
import { usePayExpense, type PartnerAccount, type PartnerExpense } from "../hooks/useFinanceiroSocios";
import { format } from "date-fns";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PayExpenseDialog({
  expense,
  accounts,
  clienteId,
  open,
  onOpenChange,
}: {
  expense: PartnerExpense | null;
  accounts: PartnerAccount[];
  clienteId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [selectedCpf, setSelectedCpf] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const payExpense = usePayExpense();

  if (!expense) return null;
  const amount = Number(expense.total_amount);

  const handlePay = async () => {
    if (!selectedCpf) return;
    const acc = accounts.find((a) => a.partner_cpf === selectedCpf);
    if (!acc) return;
    await payExpense.mutateAsync({
      clientId: clienteId,
      expenseId: expense.id,
      partnerCpf: selectedCpf,
      partnerName: acc.partner_name,
      amount,
      paymentDate: payDate,
    });
    onOpenChange(false);
    setSelectedCpf(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar Despesa — {fmt(amount)}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-2">{expense.description}</p>

        <div className="space-y-2">
          <Label>Selecione o sócio pagador:</Label>
          {accounts.map((acc) => {
            const bal = Number(acc.current_balance);
            const canPay = bal >= amount;
            return (
              <button
                key={acc.partner_cpf}
                type="button"
                onClick={() => canPay && setSelectedCpf(acc.partner_cpf)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                  selectedCpf === acc.partner_cpf
                    ? "border-primary bg-primary/10"
                    : canPay
                    ? "border-border hover:border-primary/50 cursor-pointer"
                    : "border-border opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="text-left">
                  <p className="font-medium text-foreground">{acc.partner_name}</p>
                  <p className="text-sm text-muted-foreground">Saldo: {fmt(bal)}</p>
                </div>
                {canPay ? (
                  <CheckCircle className={`h-5 w-5 ${selectedCpf === acc.partner_cpf ? "text-primary" : "text-emerald-500"}`} />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </button>
            );
          })}
        </div>

        <div>
          <Label>Data do Pagamento</Label>
          <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
        </div>

        <Button
          onClick={handlePay}
          className="w-full"
          disabled={!selectedCpf || payExpense.isPending}
        >
          {payExpense.isPending ? "Processando..." : "Confirmar Pagamento"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
