import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users, TrendingUp, Landmark } from "lucide-react";
import { useAddDeposit, type PartnerAccount } from "@/hooks/useFinanceiroSocios";
import { useClientPartners } from "@/hooks/useClientPartners";
import { formatCPF, formatMoney } from "@/lib/formatters";
import { format } from "date-fns";

// ─── Lookup: Bancos ───────────────────────────────────────────────────────────
const BANK_OPTIONS = [
  { id: "bradesco",  label: "Bradesco" },
  { id: "itau",      label: "Itaú" },
  { id: "santander", label: "Santander" },
  { id: "bb",        label: "Banco do Brasil" },
  { id: "caixa",     label: "Caixa Econômica" },
  { id: "nubank",    label: "Nubank" },
  { id: "inter",     label: "Inter" },
  { id: "btg",       label: "BTG Pactual" },
  { id: "xp",        label: "XP Investimentos" },
  { id: "sicoob",    label: "Sicoob" },
  { id: "sicredi",   label: "Sicredi" },
  { id: "outros",    label: "Outros" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface DepositFormProps {
  accounts: PartnerAccount[];
  clienteId: string;
}

// ─── Estado inicial reutilizável ──────────────────────────────────────────────
const EMPTY_DEPOSIT = {
  cpf: "",
  amount: "",
  description: "",
  date: format(new Date(), "yyyy-MM-dd"),
  bankName: "",
};

const EMPTY_INTEREST = {
  amount: "",
  date: format(new Date(), "yyyy-MM-dd"),
  bankName: "",
  notes: "",
};

// ─── Componente Principal ─────────────────────────────────────────────────────
export function DepositForm({ accounts, clienteId }: DepositFormProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"deposit" | "interest">("deposit");

  // Formulário de Depósito
  const [deposit, setDeposit] = useState(EMPTY_DEPOSIT);

  // Formulário de Rendimento
  const [interest, setInterest] = useState(EMPTY_INTEREST);

  const addDeposit = useAddDeposit();
  const { data: partners = [], isLoading: loadingPartners } = useClientPartners(clienteId);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getAccount = (cpf: string) => accounts.find((a) => a.partner_cpf === cpf);
  const getPartner = (cpf: string) => partners.find((p) => p.cpf === cpf);

  const resetAndClose = () => {
    setOpen(false);
    setDeposit(EMPTY_DEPOSIT);
    setInterest(EMPTY_INTEREST);
    setTab("deposit");
  };

  // ── Submit: Depósito comum ─────────────────────────────────────────────────
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deposit.cpf || !deposit.amount || !deposit.description) return;

    const partner = getPartner(deposit.cpf);
    const account = getAccount(deposit.cpf);

    await addDeposit.mutateAsync({
      clientId: clienteId,
      partnerCpf: deposit.cpf,
      partnerName: partner?.name || account?.partner_name || "",
      amount: parseFloat(deposit.amount),
      description: deposit.description,
      paymentDate: deposit.date,
      bankName: deposit.bankName || null,
      transactionSubtype: "deposit",
    });

    resetAndClose();
  };

  // ── Submit: Rendimento Bancário ────────────────────────────────────────────
  const handleInterestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interest.amount || !interest.bankName) return;

    const bankLabel = BANK_OPTIONS.find(b => b.id === interest.bankName)?.label ?? interest.bankName;

    await addDeposit.mutateAsync({
      clientId: clienteId,
      partnerCpf: null,        // conta compartilhada — sem sócio específico
      partnerName: "Conta Compartilhada",
      amount: parseFloat(interest.amount),
      description: `Rendimento bancário - ${bankLabel}${interest.notes ? ` (${interest.notes})` : ""}`,
      paymentDate: interest.date,
      bankName: interest.bankName,
      transactionSubtype: "bank_interest",
    });

    resetAndClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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
            Registrar Entrada
          </DialogTitle>
        </DialogHeader>

        {/* Tabs: Depósito | Rendimento */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as "deposit" | "interest")}>
          <TabsList className="w-full">
            <TabsTrigger value="deposit" className="flex-1 gap-2">
              <Landmark className="h-4 w-4" />
              Depósito
            </TabsTrigger>
            <TabsTrigger value="interest" className="flex-1 gap-2">
              <TrendingUp className="h-4 w-4" />
              Rendimento Bancário
            </TabsTrigger>
          </TabsList>

          {/* ── TAB: DEPÓSITO ─────────────────────────────────────────────── */}
          <TabsContent value="deposit">
            <form onSubmit={handleDepositSubmit} className="space-y-4 mt-2">
              {/* Sócio */}
              <PartnerSelect
                value={deposit.cpf}
                onChange={(v) => setDeposit((p) => ({ ...p, cpf: v }))}
                partners={partners}
                accounts={accounts}
                loading={loadingPartners}
              />

              {/* Info do sócio selecionado */}
              <PartnerSummaryCard
                partner={getPartner(deposit.cpf)}
                account={getAccount(deposit.cpf)}
              />

              {/* Banco */}
              <BankSelect
                value={deposit.bankName}
                onChange={(v) => setDeposit((p) => ({ ...p, bankName: v }))}
                disabled={!deposit.cpf}
              />

              {/* Valor */}
              <AmountField
                value={deposit.amount}
                onChange={(v) => setDeposit((p) => ({ ...p, amount: v }))}
                disabled={!deposit.cpf}
              />

              {/* Data */}
              <DateField
                value={deposit.date}
                onChange={(v) => setDeposit((p) => ({ ...p, date: v }))}
              />

              {/* Descrição */}
              <div>
                <Label htmlFor="dep-desc" className="font-semibold">Descrição *</Label>
                <Input
                  id="dep-desc"
                  value={deposit.description}
                  onChange={(e) => setDeposit((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Ex: Depósito referente ao mês de janeiro"
                  required
                  disabled={addDeposit.isPending}
                  className="mt-2"
                />
              </div>

              <SubmitButton
                loading={addDeposit.isPending}
                disabled={!deposit.cpf || !deposit.amount || !deposit.description}
                label="Confirmar Depósito"
              />
            </form>
          </TabsContent>

          {/* ── TAB: RENDIMENTO ───────────────────────────────────────────── */}
          <TabsContent value="interest">
            <form onSubmit={handleInterestSubmit} className="space-y-4 mt-2">
              {/* Aviso informativo */}
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-700 dark:text-amber-400">
                <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Rendimento da <strong>conta compartilhada</strong> entre os sócios.
                  O valor é registrado no centro de custo do cliente, sem vínculo individual.
                </span>
              </div>

              {/* Banco (obrigatório para rendimento) */}
              <BankSelect
                value={interest.bankName}
                onChange={(v) => setInterest((p) => ({ ...p, bankName: v }))}
                required
              />

              {/* Valor */}
              <AmountField
                value={interest.amount}
                onChange={(v) => setInterest((p) => ({ ...p, amount: v }))}
                label="Valor do Rendimento (R$) *"
                placeholder="0,00"
              />

              {/* Data */}
              <DateField
                value={interest.date}
                onChange={(v) => setInterest((p) => ({ ...p, date: v }))}
                label="Data do Rendimento *"
              />

              {/* Observação */}
              <div>
                <Label htmlFor="int-notes" className="font-semibold">Observação</Label>
                <Input
                  id="int-notes"
                  value={interest.notes}
                  onChange={(e) => setInterest((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Ex: Rendimento FacilCred Janeiro"
                  disabled={addDeposit.isPending}
                  className="mt-2"
                />
              </div>

              <SubmitButton
                loading={addDeposit.isPending}
                disabled={!interest.amount || !interest.bankName}
                label="Registrar Rendimento"
                variant="interest"
              />
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-componentes reutilizáveis ────────────────────────────────────────────

function PartnerSelect({
  value,
  onChange,
  partners,
  accounts,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  partners: any[];
  accounts: PartnerAccount[];
  loading: boolean;
}) {
  return (
    <div>
      <Label className="font-semibold">Sócio *</Label>
      <Select value={value} onValueChange={onChange} disabled={loading}>
        <SelectTrigger className="mt-2">
          <SelectValue
            placeholder={loading ? "Carregando sócios..." : "Selecione o sócio"}
          />
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
                      {partner.share_percentage &&
                        ` • Participação: ${partner.share_percentage}%`}
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
  );
}

function BankSelect({
  value,
  onChange,
  disabled,
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div>
      <Label className="font-semibold">
        Instituição Bancária {required ? "*" : "(opcional)"}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="mt-2">
          <SelectValue placeholder="Selecione o banco" />
        </SelectTrigger>
        <SelectContent>
          {BANK_OPTIONS.map((bank) => (
            <SelectItem key={bank.id} value={bank.id}>
              {bank.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AmountField({
  value,
  onChange,
  disabled,
  label = "Valor (R$) *",
  placeholder = "0,00",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor="amount" className="font-semibold">{label}</Label>
      <Input
        id="amount"
        type="number"
        step="0.01"
        min="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        disabled={disabled}
        className="mt-2"
      />
    </div>
  );
}

function DateField({
  value,
  onChange,
  label = "Data *",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div>
      <Label htmlFor="date" className="font-semibold">{label}</Label>
      <Input
        id="date"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="mt-2"
      />
    </div>
  );
}

function PartnerSummaryCard({
  partner,
  account,
  showInterest = false,
}: {
  partner: any;
  account: PartnerAccount | undefined;
  showInterest?: boolean;
}) {
  if (!partner) return null;

  return (
    <Card className="bg-muted/30 border-primary/20 p-3">
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Nome:</span>
          <span className="font-medium">{partner.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">CPF:</span>
          <span className="font-mono">{formatCPF(partner.cpf)}</span>
        </div>
        {partner.share_percentage && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Participação:</span>
            <span className="font-medium">{partner.share_percentage}%</span>
          </div>
        )}
        {account && (
          <>
            <div className="border-t border-muted my-1" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo Atual:</span>
              <span className="font-semibold text-green-600">
                {formatMoney(account.current_balance)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Depositado:</span>
              <span className="font-medium">{formatMoney(account.total_deposited)}</span>
            </div>
            {showInterest && (account as any).total_interest_earned !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground text-amber-600">Rendimentos:</span>
                <span className="font-medium text-amber-600">
                  {formatMoney((account as any).total_interest_earned ?? 0)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function SubmitButton({
  loading,
  disabled,
  label,
  variant = "default",
}: {
  loading: boolean;
  disabled: boolean;
  label: string;
  variant?: "default" | "interest";
}) {
  return (
    <Button
      type="submit"
      className={`w-full mt-2 ${
        variant === "interest"
          ? "bg-amber-600 hover:bg-amber-700 text-white"
          : ""
      }`}
      disabled={loading || disabled}
      size="lg"
    >
      {loading ? (
        <>
          <span className="animate-spin mr-2">⏳</span>
          Registrando...
        </>
      ) : (
        label
      )}
    </Button>
  );
}