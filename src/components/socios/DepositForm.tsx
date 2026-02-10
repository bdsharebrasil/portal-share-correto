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
import { Plus, TrendingUp, Landmark, ArrowDownCircle } from "lucide-react";
import { useAddDeposit, type PartnerAccount } from "@/hooks/useFinanceiroSocios";
import { useClientPartners } from "@/hooks/useClientPartners";
import { formatCPF, formatMoney } from "@/lib/formatters";
import { format } from "date-fns";

// tipos de entrada — requires_partner controla se exibe seletor de sócio
export const ENTRY_TYPES = [
  {
    id: "deposit_partner",
    label: "Depósito de Sócio",
    icon: "👤",
    description: "Aporte realizado por um sócio",
    requires_partner: true,
    subtype: "deposit",
  },
  {
    id: "transfer",
    label: "Transferência (TED/PIX)",
    icon: "🔁",
    description: "Transferência recebida de conta externa",
    requires_partner: false,
    subtype: "transfer",
  },
  {
    id: "reversal",
    label: "Estorno",
    icon: "↩️",
    description: "Devolução ou estorno de pagamento anterior",
    requires_partner: false,
    subtype: "reversal",
  },
  {
    id: "acquisition_refund",
    label: "Devolução de Aquisição",
    icon: "📦",
    description: "Reembolso de compra ou aquisição cancelada",
    requires_partner: false,
    subtype: "acquisition_refund",
  },
  {
    id: "reimbursement",
    label: "Ressarcimento Recebido",
    icon: "💸",
    description: "Ressarcimento recebido de terceiros",
    requires_partner: false,
    subtype: "reimbursement",
  },
  {
    id: "other_income",
    label: "Outros",
    icon: "📎",
    description: "Outras entradas não categorizadas",
    requires_partner: false,
    subtype: "other_income",
  },
] as const;

export type EntryTypeId = typeof ENTRY_TYPES[number]["id"];

const BANK_OPTIONS = [
  { id: "bradesco", label: "Bradesco" },
  { id: "caixa", label: "Caixa Econômica" },
  { id: "sicoob", label: "Sicoob" },
  { id: "sicredi", label: "Sicredi" },
  { id: "outros", label: "Outros" },
];

interface DepositFormProps {
  accounts: PartnerAccount[];
  clienteId: string;
}

const EMPTY_ENTRY = {
  entryType: "" as EntryTypeId | "",
  cpf: "",
  amount: "",
  description: "",
  date: format(new Date(), "yyyy-MM-dd"),
  bankName: "",
  prazo: "extra" as "mensal" | "extra",
};

const EMPTY_INTEREST = {
  amount: "",
  date: format(new Date(), "yyyy-MM-dd"),
  bankName: "",
  notes: "",
  prazo: "mensal" as "mensal" | "extra",
};

export function DepositForm({ accounts, clienteId }: DepositFormProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"entry" | "interest">("entry");
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const [interest, setInterest] = useState(EMPTY_INTEREST);

  const addDeposit = useAddDeposit();
  const { data: partners = [], isLoading: loadingPartners } = useClientPartners(clienteId);

  const getAccount = (cpf: string) => accounts.find((a) => a.partner_cpf === cpf);
  const getPartner = (cpf: string) => partners.find((p) => p.cpf === cpf);

  const selectedEntryType = ENTRY_TYPES.find((t) => t.id === entry.entryType);
  const requiresPartner = selectedEntryType?.requires_partner ?? false;

  const handleEntryTypeChange = (value: EntryTypeId) => {
    const type = ENTRY_TYPES.find((t) => t.id === value);
    setEntry((p) => ({
      ...p,
      entryType: value,
      cpf: type?.requires_partner ? p.cpf : "",
    }));
  };

  const resetAndClose = () => {
    setOpen(false);
    setEntry(EMPTY_ENTRY);
    setInterest(EMPTY_INTEREST);
    setTab("entry");
  };

  const isEntryValid = () => {
    if (!entry.entryType || !entry.amount || !entry.description) return false;
    if (requiresPartner && !entry.cpf) return false;
    return true;
  };

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEntryValid()) return;

    const partner = getPartner(entry.cpf);
    const account = getAccount(entry.cpf);

    await addDeposit.mutateAsync({
      clientId: clienteId,
      partnerCpf: requiresPartner ? entry.cpf : null,
      partnerName: requiresPartner
        ? (partner?.name || account?.partner_name || "")
        : (selectedEntryType?.label ?? "Conta Geral"),
      amount: parseFloat(entry.amount),
      description: entry.description,
      paymentDate: entry.date,
      bankName: entry.bankName || null,
      transactionSubtype: selectedEntryType?.subtype ?? "deposit",
      prazo: entry.prazo,
    });

    resetAndClose();
  };

  const handleInterestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interest.amount || !interest.bankName) return;

    const bankLabel =
      BANK_OPTIONS.find((b) => b.id === interest.bankName)?.label ?? interest.bankName;

    await addDeposit.mutateAsync({
      clientId: clienteId,
      partnerCpf: null,
      partnerName: "Conta Compartilhada",
      amount: parseFloat(interest.amount),
      description: `Rendimento bancário - ${bankLabel}${interest.notes ? ` (${interest.notes})` : ""}`,
      paymentDate: interest.date,
      bankName: interest.bankName,
      transactionSubtype: "bank_interest",
      prazo: interest.prazo,
    });

    resetAndClose();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Entrada
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownCircle className="w-5 h-5 text-green-500" />
            Registrar Entrada
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "entry" | "interest")}>
          <TabsList className="w-full">
            <TabsTrigger value="entry" className="flex-1 gap-2">
              <Landmark className="h-4 w-4" />
              Entrada
            </TabsTrigger>
            <TabsTrigger value="interest" className="flex-1 gap-2">
              <TrendingUp className="h-4 w-4" />
              Rendimento Bancário
            </TabsTrigger>
          </TabsList>

          {/* TAB: ENTRADA */}
          <TabsContent value="entry">
            <form onSubmit={handleEntrySubmit} className="space-y-4 mt-2">

              {/* Tipo de Entrada */}
              <div>
                <Label className="font-semibold">Tipo de Entrada *</Label>
                <Select
                  value={entry.entryType}
                  onValueChange={(v) => handleEntryTypeChange(v as EntryTypeId)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione o tipo de entrada" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex flex-col">
                          <span>{type.icon} {type.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {type.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Badge informativo */}
              {selectedEntryType && (
                <div className={`flex items-center gap-2 rounded-lg p-3 text-sm border ${requiresPartner
                    ? "bg-primary/5 border-primary/20 text-primary"
                    : "bg-muted/40 border-border/50 text-muted-foreground"
                  }`}>
                  <span className="text-base">{selectedEntryType.icon}</span>
                  <span>
                    {requiresPartner
                      ? "Entrada vinculada a um sócio"
                      : "Entrada da conta geral"}
                  </span>
                </div>
              )}

              {/* Sócio — apenas quando o tipo exige */}
              {requiresPartner && (
                <>
                  <PartnerSelect
                    value={entry.cpf}
                    onChange={(v) => setEntry((p) => ({ ...p, cpf: v }))}
                    partners={partners}
                    accounts={accounts}
                    loading={loadingPartners}
                  />
                  <PartnerSummaryCard
                    partner={getPartner(entry.cpf)}
                    account={getAccount(entry.cpf)}
                  />
                </>
              )}

              {/* Banco */}
              <BankSelect
                value={entry.bankName}
                onChange={(v) => setEntry((p) => ({ ...p, bankName: v }))}
                disabled={!entry.entryType}
              />

              {/* Prazo */}
              <PrazoSelect
                value={entry.prazo}
                onChange={(v) => setEntry((p) => ({ ...p, prazo: v as "mensal" | "extra" }))}
                disabled={!entry.entryType}
              />

              {/* Valor */}
              <AmountField
                value={entry.amount}
                onChange={(v) => setEntry((p) => ({ ...p, amount: v }))}
                disabled={!entry.entryType}
              />

              {/* Data */}
              <DateField
                value={entry.date}
                onChange={(v) => setEntry((p) => ({ ...p, date: v }))}
              />

              {/* Descrição */}
              <div>
                <Label htmlFor="entry-desc" className="font-semibold">Descrição *</Label>
                <Input
                  id="entry-desc"
                  value={entry.description}
                  onChange={(e) => setEntry((p) => ({ ...p, description: e.target.value }))}
                  placeholder={
                    selectedEntryType
                      ? `Ex: ${selectedEntryType.label} referente a...`
                      : "Descreva a entrada"
                  }
                  required
                  disabled={addDeposit.isPending || !entry.entryType}
                  className="mt-2"
                />
              </div>

              <SubmitButton
                loading={addDeposit.isPending}
                disabled={!isEntryValid()}
                label={selectedEntryType ? `Confirmar ${selectedEntryType.label}` : "Confirmar Entrada"}
              />
            </form>
          </TabsContent>

          {/* TAB: RENDIMENTO */}
          <TabsContent value="interest">
            <form onSubmit={handleInterestSubmit} className="space-y-4 mt-2">
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-700 dark:text-amber-400">
                <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Rendimento da <strong>conta compartilhada</strong> entre os sócios.
                  O valor é registrado no centro de custo do cliente.
                </span>
              </div>

              <BankSelect
                value={interest.bankName}
                onChange={(v) => setInterest((p) => ({ ...p, bankName: v }))}
                required
              />

              <PrazoSelect
                value={interest.prazo}
                onChange={(v) => setInterest((p) => ({ ...p, prazo: v as "mensal" | "extra" }))}
              />

              <AmountField
                value={interest.amount}
                onChange={(v) => setInterest((p) => ({ ...p, amount: v }))}
                label="Valor do Rendimento (R$) *"
                placeholder="0,00"
              />

              <DateField
                value={interest.date}
                onChange={(v) => setInterest((p) => ({ ...p, date: v }))}
                label="Data do Rendimento *"
              />

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

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function PartnerSelect({
  value, onChange, partners, accounts, loading,
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
          <SelectValue placeholder={loading ? "Carregando sócios..." : "Selecione o sócio"} />
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
  );
}

function PrazoSelect({
  value, onChange, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label className="font-semibold">Prazo *</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="mt-2">
          <SelectValue placeholder="Selecione o prazo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mensal">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
              Mensal
            </span>
          </SelectItem>
          <SelectItem value="extra">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />
              Extra
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function BankSelect({
  value, onChange, disabled, required = false,
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
  value, onChange, disabled, label = "Valor (R$) *", placeholder = "0,00",
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
  value, onChange, label = "Data *",
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
  partner, account,
}: {
  partner: any;
  account: PartnerAccount | undefined;
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
          </>
        )}
      </div>
    </Card>
  );
}

function SubmitButton({
  loading, disabled, label, variant = "default",
}: {
  loading: boolean;
  disabled: boolean;
  label: string;
  variant?: "default" | "interest";
}) {
  return (
    <Button
      type="submit"
      className={`w-full mt-2 ${variant === "interest" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
      disabled={loading || disabled}
      size="lg"
    >
      {loading ? (
        <><span className="animate-spin mr-2">⏳</span>Registrando...</>
      ) : label}
    </Button>
  );
}