import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users } from "lucide-react";
import { useAddDeposit, type PartnerAccount } from "@/hooks/useFinanceiroSocios";
import { useClientPartners, type ClientPartner } from "@/hooks/useClientPartners";
import { formatCPF, formatMoney } from "@/lib/formatters";
import { format } from "date-fns";

export function DepositForm({ accounts, clienteId }: { accounts: PartnerAccount[]; clienteId: string }) {
  const [open, setOpen] = useState(false);
  const [cpf, setCpf] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const addDeposit = useAddDeposit();

  // Buscar parceiros do cliente diretamente de client_partners
  const { data: partners = [], isLoading: loadingPartners } = useClientPartners(clienteId);

  const selectedAccount = accounts.find((a) => a.partner_cpf === cpf);
  const selectedPartner = partners.find((p) => p.cpf === cpf);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpf || !amount || !description) return;
    await addDeposit.mutateAsync({
      clientId: clienteId,
      partnerCpf: cpf,
      partnerName: selectedPartner?.name || selectedAccount?.partner_name || "",
      amount: parseFloat(amount),
      description,
      paymentDate: date,
    });
    setOpen(false);
    setCpf("");
    setAmount("");
    setDescription("");
    setDate(format(new Date(), "yyyy-MM-dd"));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Depósito
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Registrar Depósito
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sócio Selecionado */}
          <div>
            <Label className="font-semibold">Sócio *</Label>
            <Select value={cpf} onValueChange={setCpf} disabled={loadingPartners}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={loadingPartners ? "Carregando sócios..." : "Selecione o sócio"} />
              </SelectTrigger>
              <SelectContent>
                {partners.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Nenhum sócio cadastrado para este cliente
                  </div>
                ) : (
                  partners.map((partner) => {
                    const account = accounts.find((a) => a.partner_cpf === partner.cpf);
                    return (
                      <SelectItem key={partner.id} value={partner.cpf}>
                        <div className="flex flex-col">
                          <span className="font-medium">{partner.name}</span>
                          <span className="text-xs text-muted-foreground">
                            CPF: {formatCPF(partner.cpf)}
                            {partner.share_percentage && ` • Participação: ${partner.share_percentage}%`}
                          </span>
                          {account && (
                            <span className="text-xs text-green-600 font-semibold">
                              Saldo: {formatMoney(account.current_balance)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Dados do Sócio Selecionado */}
          {selectedPartner && (
            <Card className="bg-muted/30 border-primary/20 p-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="font-medium">{selectedPartner.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPF:</span>
                  <span className="font-mono">{formatCPF(selectedPartner.cpf)}</span>
                </div>
                {selectedPartner.share_percentage && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Participação:</span>
                    <span className="font-medium">{selectedPartner.share_percentage}%</span>
                  </div>
                )}
                {selectedAccount && (
                  <>
                    <div className="border-t border-muted my-2" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Saldo Atual:</span>
                      <span className="font-semibold text-green-600">{formatMoney(selectedAccount.current_balance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Depositado:</span>
                      <span className="font-medium">{formatMoney(selectedAccount.total_deposited)}</span>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}
          {/* Valor do Depósito */}
          <div>
            <Label htmlFor="amount" className="font-semibold">
              Valor (R$) *
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              required
              disabled={addDeposit.isPending || !cpf}
              className="mt-2"
            />
          </div>

          {/* Data */}
          <div>
            <Label htmlFor="date" className="font-semibold">
              Data *
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              disabled={addDeposit.isPending}
              className="mt-2"
            />
          </div>

          {/* Descrição */}
          <div>
            <Label htmlFor="description" className="font-semibold">
              Descrição *
            </Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Depósito referente ao mês de janeiro"
              required
              disabled={addDeposit.isPending}
              className="mt-2"
            />
          </div>

          {/* Botão Submit */}
          <Button
            type="submit"
            className="w-full mt-6"
            disabled={addDeposit.isPending || !cpf || !amount || !description}
            size="lg"
          >
            {addDeposit.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Registrando Depósito...
              </>
            ) : (
              "Confirmar Depósito"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
