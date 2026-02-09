import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useAddDeposit, type PartnerAccount } from "@/hooks/useFinanceiroSocios";
import { format } from "date-fns";

export function DepositForm({ accounts }: { accounts: PartnerAccount[] }) {
  const [open, setOpen] = useState(false);
  const [cpf, setCpf] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const addDeposit = useAddDeposit();

  const selectedAccount = accounts.find((a) => a.partner_cpf === cpf);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpf || !amount || !description) return;
    await addDeposit.mutateAsync({
      partnerCpf: cpf,
      partnerName: selectedAccount?.partner_name || "",
      amount: parseFloat(amount),
      description,
      paymentDate: date,
    });
    setOpen(false);
    setCpf("");
    setAmount("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Depósito
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Depósito</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Sócio</Label>
            <Select value={cpf} onValueChange={setCpf}>
              <SelectTrigger><SelectValue placeholder="Selecione o sócio" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.partner_cpf} value={a.partner_cpf}>
                    {a.partner_name} — Saldo: R$ {Number(a.current_balance).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Depósito mensal" required />
          </div>
          <Button type="submit" className="w-full" disabled={addDeposit.isPending}>
            {addDeposit.isPending ? "Registrando..." : "Confirmar Depósito"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
