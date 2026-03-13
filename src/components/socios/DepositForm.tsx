import { useState, useEffect, useMemo } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, TrendingUp, Landmark, ArrowDownCircle, Sparkles, ChevronRight, CalendarIcon } from "lucide-react";
import { useAddDeposit, useSocioExpenses, type PartnerAccount } from "@/hooks/useFinanceiroSocios";
import { useClientPartners } from "@/hooks/useClientPartners";
import { formatCPF, formatMoney } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/modern-toast";

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
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>("");
  const [customReversalAmount, setCustomReversalAmount] = useState<string>("");

  // Use two instances: one with toasts for simple deposits, one without for ratios
  const addDepositWithToast = useAddDeposit(true);
  const addDepositSilent = useAddDeposit(false);
  const { data: partners = [], isLoading: loadingPartners } = useClientPartners(clienteId);
  const { data: expenses = [] } = useSocioExpenses(clienteId);

  const getAccount = (cpf: string) => accounts.find((a) => a.partner_cpf === cpf);
  const getPartner = (cpf: string) => partners.find((p) => p.cpf === cpf);

  const selectedEntryType = ENTRY_TYPES.find((t) => t.id === entry.entryType);
  const requiresPartner = selectedEntryType?.requires_partner ?? false;
  const isReversal = entry.entryType === "reversal";

  // Expenses available for reversal (only paid/completed ones)
  const reversableExpenses = useMemo(() => {
    return expenses.filter((exp) => exp.status === "paid" || exp.status === "pago");
  }, [expenses]);

  // Selected expense for reversal
  const selectedExpense = useMemo(() => {
    if (!isReversal || !selectedExpenseId) return null;
    return expenses.find((exp) => exp.id === selectedExpenseId) || null;
  }, [isReversal, selectedExpenseId, expenses]);

  // Find all related expenses (for ratios/installments) based on description and date
  const relatedExpenses = useMemo(() => {
    if (!selectedExpense) return [];

    // Find expenses with same base description and created around the same time
    const baseDescription = selectedExpense.description;
    const selectedDate = new Date(selectedExpense.created_at);
    const timeTolerance = 5 * 60 * 1000; // 5 minutes tolerance

    return expenses.filter((exp) => {
      // Check if descriptions match (ignoring installment numbers like "(1/3)")
      const expBaseDesc = exp.description.replace(/\s*\(\d+\/\d+\)$/, "");
      const selectedBaseDesc = baseDescription.replace(/\s*\(\d+\/\d+\)$/, "");

      const descMatches = expBaseDesc === selectedBaseDesc;
      const expDate = new Date(exp.created_at);
      const dateMatches = Math.abs(selectedDate.getTime() - expDate.getTime()) < timeTolerance;

      return descMatches && dateMatches && (exp.status === "paid" || exp.status === "pago");
    });
  }, [selectedExpense, expenses]);

  const handleEntryTypeChange = (value: EntryTypeId) => {
    const type = ENTRY_TYPES.find((t) => t.id === value);
    setEntry((p) => ({
      ...p,
      entryType: value,
      cpf: type?.requires_partner ? p.cpf : "",
    }));
    setSelectedExpenseId("");
  };

  // Auto-fill fields when an expense is selected for reversal
  useEffect(() => {
    if (selectedExpense) {
      setEntry((p) => ({
        ...p,
        amount: String(selectedExpense.total_amount),
        description: `Estorno: ${selectedExpense.description}`,
      }));
      setCustomReversalAmount("");
    }
  }, [selectedExpense]);

  const resetAndClose = () => {
    setOpen(false);
    setEntry(EMPTY_ENTRY);
    setInterest(EMPTY_INTEREST);
    setTab("entry");
    setSelectedExpenseId("");
  };

  const isEntryValid = () => {
    if (!entry.entryType || !entry.amount || !entry.description) return false;
    if (requiresPartner && !entry.cpf) return false;
    if (isReversal && !selectedExpenseId) return false;
    return true;
  };

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEntryValid()) return;

    if (isReversal && selectedExpense && relatedExpenses.length > 1) {
      // Reversal with ratio distribution (multiple partners)
      const reversalAmount = customReversalAmount ? parseFloat(customReversalAmount) : parseFloat(entry.amount);
      const amountPerPartner = reversalAmount / relatedExpenses.length;
      const amountPerPartnerRounded = Math.round(amountPerPartner * 100) / 100;

      // Get unique partners involved in this reversal
      const partnersInvolved = new Map<string, string>();
      relatedExpenses.forEach((exp) => {
        if (exp.assigned_partner_cpf) {
          partnersInvolved.set(
            exp.assigned_partner_cpf,
            exp.assigned_partner_name || "Conta Bancária"
          );
        }
      });

      // If no specific partners, add to shared account
      if (partnersInvolved.size === 0) {
        await addDepositWithToast.mutateAsync({
          clientId: clienteId,
          partnerCpf: null,
          partnerName: "Conta Bancária",
          amount: reversalAmount,
          description: entry.description,
          paymentDate: entry.date,
          bankName: entry.bankName || null,
          transactionSubtype: selectedEntryType?.subtype ?? "deposit",
          prazo: entry.prazo,
          referenceId: selectedExpenseId,
        });
      } else {
        // Create reversals for each partner involved (without toast)
        for (const [cpf, name] of partnersInvolved.entries()) {
          await addDepositSilent.mutateAsync({
            clientId: clienteId,
            partnerCpf: cpf,
            partnerName: name,
            amount: amountPerPartnerRounded,
            description: entry.description,
            paymentDate: entry.date,
            bankName: entry.bankName || null,
            transactionSubtype: selectedEntryType?.subtype ?? "deposit",
            prazo: entry.prazo,
            referenceId: selectedExpenseId,
          });
        }
        // Show single success toast after all reversals
        toast.success("Estorno registrado com sucesso!");
      }
    } else {
      // Standard entry (non-reversal or single reversal)
      let partnerCpf: string | null = null;
      let partnerName = "Conta Bancária";

      if (isReversal && selectedExpense) {
        // Single reversal: credit goes back to whoever the original expense was for
        if (selectedExpense.assigned_partner_cpf) {
          partnerCpf = selectedExpense.assigned_partner_cpf;
          partnerName = selectedExpense.assigned_partner_name || "Conta Bancária";
        }
      } else if (requiresPartner) {
        const partner = getPartner(entry.cpf);
        const account = getAccount(entry.cpf);
        partnerCpf = entry.cpf;
        partnerName = partner?.name || account?.partner_name || "";
      }

      await addDepositWithToast.mutateAsync({
        clientId: clienteId,
        partnerCpf,
        partnerName,
        amount: parseFloat(entry.amount),
        description: entry.description,
        paymentDate: entry.date,
        bankName: entry.bankName || null,
        transactionSubtype: selectedEntryType?.subtype ?? "deposit",
        prazo: entry.prazo,
        referenceId: isReversal ? selectedExpenseId : undefined,
      });
    }

    resetAndClose();
  };

  const handleInterestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interest.amount || !interest.bankName) return;

    await addDepositWithToast.mutateAsync({
      clientId: clienteId,
      partnerCpf: null,
      partnerName: "Conta Bancária",
      amount: parseFloat(interest.amount),
      description: `Rendimento bancário - ${interest.bankName}${interest.notes ? ` (${interest.notes})` : ""}`,
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
        <Button
          className="gap-2 h-11 px-5 text-sm font-semibold rounded-xl shadow-sm
                     bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500
                     text-white border-0 transition-all duration-200 hover:shadow-md hover:-translate-y-px"
        >
          <Plus className="h-4 w-4" />
          Nova Entrada
        </Button>
      </DialogTrigger>

      {/* ── Modal ── */}
      <DialogContent
        className="
          w-full max-w-5xl
          max-h-[92vh] overflow-y-auto
          rounded-2xl border border-border/60
          bg-background/95 backdrop-blur-sm
          shadow-2xl p-0
        "
      >
        {/* Header gradient strip */}
        <div className="relative px-8 pt-8 pb-6 border-b border-emerald-700/40 bg-gradient-to-br from-emerald-700 to-teal-800 rounded-t-2xl overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-8 -right-8 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-white/10" />
          </div>
          <DialogHeader className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                <ArrowDownCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-white">
                  Registrar Entrada
                </DialogTitle>
                <p className="text-sm text-emerald-100/80 mt-0.5">
                  Informe os dados da nova movimentação financeira
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "entry" | "interest")}>
            <TabsList className="w-full h-11 rounded-xl bg-muted/60 p-1 mb-8">
              <TabsTrigger
                value="entry"
                className="flex-1 gap-2 h-9 rounded-lg text-sm font-medium
                           data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800
                           data-[state=active]:shadow-sm data-[state=active]:text-emerald-700
                           dark:data-[state=active]:text-emerald-400 transition-all"
              >
                <Landmark className="h-4 w-4" />
                Entrada
              </TabsTrigger>
              <TabsTrigger
                value="interest"
                className="flex-1 gap-2 h-9 rounded-lg text-sm font-medium
                           data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800
                           data-[state=active]:shadow-sm data-[state=active]:text-amber-700
                           dark:data-[state=active]:text-amber-400 transition-all"
              >
                <TrendingUp className="h-4 w-4" />
                Rendimento Bancário
              </TabsTrigger>
            </TabsList>

            {/* ── TAB: ENTRADA ── */}
            <TabsContent value="entry">
              <form onSubmit={handleEntrySubmit} className="space-y-6">

                {/* Tipo de entrada */}
                <FormSection label="Tipo de Entrada" required>
                  <Select
                    value={entry.entryType}
                    onValueChange={(v) => handleEntryTypeChange(v as EntryTypeId)}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                      <SelectValue placeholder="Selecione o tipo de entrada" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {ENTRY_TYPES.map((type) => (
                        <SelectItem key={type.id} value={type.id} className="py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-lg leading-none">{type.icon}</span>
                            <div>
                              <div className="font-medium text-sm">{type.label}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{type.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Badge informativo */}
                  {selectedEntryType && (
                    <div
                      className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm mt-2 border transition-all
                        ${requiresPartner
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-300"
                          : "bg-muted/50 border-border/50 text-muted-foreground"
                        }`}
                    >
                      <span className="text-base">{selectedEntryType.icon}</span>
                      <span className="font-medium">
                        {requiresPartner ? "Entrada vinculada a um sócio" : "Entrada da Conta Bancária"}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-50" />
                    </div>
                  )}
                </FormSection>

                {/* Despesa vinculada (Estorno) */}
                {isReversal && (
                <FormSection label="Despesa Original" required>
                    <SearchableCombobox
                      items={reversableExpenses.map((exp) => ({
                        id: exp.id,
                        label: `${exp.description} — ${exp.assigned_partner_name || "Conta Bancária"} • R$ ${Number(exp.total_amount).toFixed(2)}`,
                      }))}
                      value={selectedExpenseId}
                      onChange={(val) => setSelectedExpenseId(val)}
                      placeholder="Busque a despesa a ser estornada"
                      searchPlaceholder="Buscar por descrição, sócio ou valor..."
                      emptyMessage="Nenhuma despesa paga encontrada"
                    />

                    {selectedExpense && relatedExpenses.length > 1 && (
                      <div className="flex items-start gap-2.5 rounded-xl px-4 py-4 text-sm mt-2 border bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800/50 dark:text-blue-300">
                        <span className="text-base flex-shrink-0">💡</span>
                        <div>
                          <p className="font-semibold mb-1">Despesa Rateada</p>
                          <p>Esta despesa foi dividida entre {relatedExpenses.length} sócios. O estorno será distribuído igualmente entre eles.</p>
                        </div>
                      </div>
                    )}

                    {selectedExpense && relatedExpenses.length === 1 && (
                      <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm mt-2 border bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800/50 dark:text-amber-300">
                        <span className="text-base">↩️</span>
                        <span className="font-medium">
                          Estorno será creditado para: {selectedExpense.assigned_partner_name || "Conta Bancária"}
                        </span>
                      </div>
                    )}
                  </FormSection>
                )}

                {/* Valor customizado do estorno */}
                {isReversal && selectedExpense && relatedExpenses.length > 1 && (
                  <FormSection label="Valor do Estorno (R$)">
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        <p>Deixe em branco para estornar o valor total: <span className="font-semibold text-foreground">R$ {Number(entry.amount).toFixed(2)}</span></p>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground select-none">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={customReversalAmount}
                          onChange={(e) => setCustomReversalAmount(e.target.value)}
                          placeholder={entry.amount}
                          disabled={addDepositWithToast.isPending}
                          className="h-12 rounded-xl border-border/70 text-sm pl-10 font-mono"
                        />
                      </div>
                    </div>
                  </FormSection>
                )}

                {/* Prévia de distribuição */}
                {isReversal && selectedExpense && relatedExpenses.length > 1 && (customReversalAmount || entry.amount) && (
                  <FormSection label="Distribuição do Estorno">
                    <div className="space-y-2">
                      {Array.from(
                        new Map(relatedExpenses.map((exp) => [
                          exp.assigned_partner_cpf,
                          exp.assigned_partner_name || "Conta Bancária"
                        ])).entries()
                      ).map(([cpf, name]) => {
                        const reversalAmount = customReversalAmount ? parseFloat(customReversalAmount) : parseFloat(entry.amount);
                        const amountPerPartner = Math.round((reversalAmount / relatedExpenses.length) * 100) / 100;
                        return (
                          <div key={cpf} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                            <span className="font-medium text-foreground">{name}</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              + R$ {amountPerPartner.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </FormSection>
                )}

                {/* Sócio */}
                {requiresPartner && !isReversal && (
                  <FormSection label="Sócio" required>
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
                  </FormSection>
                )}

                {/* Banco + Prazo side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormSection label="Instituição Bancária">
                    <BankSelect
                      value={entry.bankName}
                      onChange={(v) => setEntry((p) => ({ ...p, bankName: v }))}
                      disabled={!entry.entryType}
                    />
                  </FormSection>
                  <FormSection label="Prazo" required>
                    <PrazoSelect
                      value={entry.prazo}
                      onChange={(v) => setEntry((p) => ({ ...p, prazo: v as "mensal" | "extra" }))}
                      disabled={!entry.entryType}
                    />
                  </FormSection>
                </div>

                {/* Valor + Data side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormSection label="Valor (R$)" required>
                    <AmountField
                      value={entry.amount}
                      onChange={(v) => setEntry((p) => ({ ...p, amount: v }))}
                      disabled={!entry.entryType}
                    />
                  </FormSection>
                  <FormSection label="Data" required>
                    <DateField
                      value={entry.date}
                      onChange={(v) => setEntry((p) => ({ ...p, date: v }))}
                    />
                  </FormSection>
                </div>

                {/* Descrição */}
                <FormSection label="Descrição" required>
                  <Input
                    value={entry.description}
                    onChange={(e) => setEntry((p) => ({ ...p, description: e.target.value }))}
                    placeholder={
                      selectedEntryType
                        ? `Ex: ${selectedEntryType.label} referente a...`
                        : "Descreva a entrada"
                    }
                    required
                    disabled={addDeposit.isPending || !entry.entryType}
                    className="h-12 rounded-xl border-border/70 text-sm"
                  />
                </FormSection>

                <SubmitButton
                  loading={addDeposit.isPending}
                  disabled={!isEntryValid()}
                  label={selectedEntryType ? `Confirmar ${selectedEntryType.label}` : "Confirmar Entrada"}
                />
              </form>
            </TabsContent>

            {/* ── TAB: RENDIMENTO ── */}
            <TabsContent value="interest">
              <form onSubmit={handleInterestSubmit} className="space-y-6">
                {/* Info banner */}
                <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-300">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
                    <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold mb-0.5">Conta Bancária</p>
                    <p className="text-amber-700/80 dark:text-amber-400/70">
                      Rendimento registrado na conta bancária do cliente.
                    </p>
                  </div>
                </div>

                {/* Banco + Prazo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormSection label="Instituição Bancária" required>
                    <BankSelect
                      value={interest.bankName}
                      onChange={(v) => setInterest((p) => ({ ...p, bankName: v }))}
                      required
                    />
                  </FormSection>
                  <FormSection label="Prazo" required>
                    <PrazoSelect
                      value={interest.prazo}
                      onChange={(v) => setInterest((p) => ({ ...p, prazo: v as "mensal" | "extra" }))}
                    />
                  </FormSection>
                </div>

                {/* Valor + Data */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormSection label="Valor do Rendimento (R$)" required>
                    <AmountField
                      value={interest.amount}
                      onChange={(v) => setInterest((p) => ({ ...p, amount: v }))}
                      placeholder="0,00"
                    />
                  </FormSection>
                  <FormSection label="Data do Rendimento" required>
                    <DateField
                      value={interest.date}
                      onChange={(v) => setInterest((p) => ({ ...p, date: v }))}
                    />
                  </FormSection>
                </div>

                {/* Observação */}
                <FormSection label="Observação">
                  <Input
                    value={interest.notes}
                    onChange={(e) => setInterest((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Ex: Rendimento FacilCred Janeiro"
                    disabled={addDeposit.isPending}
                    className="h-12 rounded-xl border-border/70 text-sm"
                  />
                </FormSection>

                <SubmitButton
                  loading={addDeposit.isPending}
                  disabled={!interest.amount || !interest.bankName}
                  label="Registrar Rendimento"
                  variant="interest"
                />
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Wrapper de seção com label ──────────────────────────────────────────────

function FormSection({
  label, required, children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground/80 flex items-center gap-1">
        {label}
        {required && <span className="text-emerald-500 text-base leading-none">*</span>}
      </Label>
      {children}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

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
    <Select value={value} onValueChange={onChange} disabled={loading}>
      <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
        <SelectValue placeholder={loading ? "Carregando sócios..." : "Selecione o sócio"} />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {partners.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            Nenhum sócio cadastrado para este cliente
          </div>
        ) : (
          partners.map((partner) => {
            const account = accounts.find((a) => a.partner_cpf === partner.cpf);
            return (
              <SelectItem key={partner.id} value={partner.cpf} className="py-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                    {partner.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{partner.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      CPF: {formatCPF(partner.cpf)}
                      {partner.share_percentage && ` · ${partner.share_percentage}%`}
                    </div>
                    {account && (
                      <div className="text-xs text-emerald-600 font-semibold mt-0.5">
                        Saldo: {formatMoney(account.current_balance)}
                      </div>
                    )}
                  </div>
                </div>
              </SelectItem>
            );
          })
        )}
      </SelectContent>
    </Select>
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
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
        <SelectValue placeholder="Selecione o prazo" />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        <SelectItem value="mensal" className="py-3">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 flex-shrink-0" />
            <div>
              <div className="font-medium text-sm">Mensal</div>
              <div className="text-xs text-muted-foreground">Ciclo mensal regular</div>
            </div>
          </div>
        </SelectItem>
        <SelectItem value="extra" className="py-3">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500 flex-shrink-0" />
            <div>
              <div className="font-medium text-sm">Extra</div>
              <div className="text-xs text-muted-foreground">Aporte ou evento avulso</div>
            </div>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
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
  const [contas, setContas] = useState<{ id: string; banco: string; numero_conta: string | null; tipo_conta: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContas = async () => {
      const { data } = await supabase
        .from("contas_bancarias")
        .select("id, banco, numero_conta, tipo_conta")
        .eq("ativo", true)
        .order("banco");
      setContas(data || []);
      setLoading(false);
    };
    fetchContas();
  }, []);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || loading}>
      <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
        <SelectValue placeholder={loading ? "Carregando..." : "Selecione o banco"} />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {contas.map((conta) => (
          <SelectItem key={conta.id} value={conta.banco} className="py-3">
            <div>
              <div className="font-medium text-sm">{conta.banco}</div>
              {conta.numero_conta && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Conta: {conta.numero_conta}
                  {conta.tipo_conta ? ` (${conta.tipo_conta})` : ""}
                </div>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AmountField({
  value, onChange, disabled, label, placeholder = "0,00",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground select-none">
        R$
      </span>
      <Input
        type="number"
        step="0.01"
        min="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        disabled={disabled}
        className="h-12 rounded-xl border-border/70 text-sm pl-10 font-mono"
      />
    </div>
  );
}

function DateField({
  value, onChange, label,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const [inputValue, setInputValue] = useState(
    value ? format(new Date(value + "T12:00:00"), "dd/MM/yyyy") : ""
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const dateValue = value ? new Date(value + "T12:00:00") : undefined;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 8) v = v.slice(0, 8);
    if (v.length >= 5) v = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4);
    else if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
    setInputValue(v);

    if (v.length === 10) {
      const [dd, mm, yyyy] = v.split("/");
      const parsed = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      if (!isNaN(parsed.getTime())) {
        onChange(format(parsed, "yyyy-MM-dd"));
      }
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
      setInputValue(format(date, "dd/MM/yyyy"));
      setCalendarOpen(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder="dd/mm/aaaa"
        className="h-12 rounded-xl border-border/70 text-sm flex-1"
        maxLength={10}
      />
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-border/70 flex-shrink-0">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[9999]" align="end" sideOffset={4}>
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleCalendarSelect}
            locale={ptBR}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
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
    <Card className="bg-gradient-to-br from-emerald-50/60 to-teal-50/40 dark:from-emerald-950/30 dark:to-teal-950/20 border-emerald-200/60 dark:border-emerald-800/40 p-4 mt-2">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-base font-bold flex-shrink-0">
          {partner.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="font-semibold text-sm">{partner.name}</div>
          <div className="text-xs text-muted-foreground font-mono">{formatCPF(partner.cpf)}</div>
        </div>
        {partner.share_percentage && (
          <div className="ml-auto text-right">
            <div className="text-xs text-muted-foreground">Participação</div>
            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              {partner.share_percentage}%
            </div>
          </div>
        )}
      </div>

      {account && (
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-emerald-200/50 dark:border-emerald-800/30">
          <div className="rounded-lg bg-white/60 dark:bg-zinc-900/40 px-3 py-2">
            <div className="text-xs text-muted-foreground mb-0.5">Saldo Atual</div>
            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              {formatMoney(account.current_balance)}
            </div>
          </div>
          <div className="rounded-lg bg-white/60 dark:bg-zinc-900/40 px-3 py-2">
            <div className="text-xs text-muted-foreground mb-0.5">Total Depositado</div>
            <div className="text-sm font-semibold">
              {formatMoney(account.total_deposited)}
            </div>
          </div>
        </div>
      )}
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
  const base =
    "w-full h-12 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none";

  const colorClass =
    variant === "interest"
      ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-amber-500/20"
      : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20";

  return (
    <Button
      type="submit"
      className={`${base} ${colorClass}`}
      disabled={loading || disabled}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          Registrando...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          {label}
        </span>
      )}
    </Button>
  );
}
