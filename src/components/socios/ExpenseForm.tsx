import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Receipt } from "lucide-react";
import { useCreateExpense } from "@/hooks/useFinanceiroSocios";
import { useClientPartners } from "@/hooks/useClientPartners";
import { formatCPF } from "@/lib/formatters";
import { format } from "date-fns";

// ─── Categorias de Despesa ────────────────────────────────────────────────────
export const EXPENSE_CATEGORIES = [
  { id: "abastecimento",     label: "Abastecimento",             icon: "⛽" },
  { id: "hangaragem",        label: "Hangaragem",                icon: "🏠" },
  { id: "manutencao",        label: "Manutenção",                icon: "🔧" },
  { id: "pouso_decolagem",   label: "Tarifa de Pouso/Decolagem", icon: "✈️" },
  { id: "atendimento_pista", label: "Atendimento de Pista",      icon: "🛬" },
  { id: "subscricoes",       label: "Assinaturas/Subscrições",   icon: "📋" },
  { id: "contabilidade",     label: "Honorários Contabilidade",  icon: "📊" },
  { id: "ressarcimento",     label: "Ressarcimento/Reembolso",   icon: "💸" },
  { id: "viagem",            label: "Despesas de Viagem",        icon: "🧳" },
  { id: "infraero",          label: "INFRAERO",                  icon: "🏛️" },
  { id: "outros",            label: "Outros",                    icon: "📎" },
] as const;

export type ExpenseCategoryId = typeof EXPENSE_CATEGORIES[number]["id"];

// ─── Estado inicial ───────────────────────────────────────────────────────────
const EMPTY_FORM = {
  description: "",
  totalAmount: "",
  category: "" as ExpenseCategoryId | "",
  expenseType: "",
  assignedPartnerCpf: "none",
  dueDate: format(new Date(), "yyyy-MM-dd"),
  supplierName: "",
  invoiceNumber: "",
  paymentMethod: "nao_informado",
  notes: "",
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface ExpenseFormProps {
  clienteId: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function ExpenseForm({ clienteId }: ExpenseFormProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const addExpense = useCreateExpense();
  const { data: partners = [], isLoading: loadingPartners } = useClientPartners(clienteId);

  const set = (key: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.totalAmount || !form.category) return;

    const assignedPartnerCpf = form.assignedPartnerCpf === "none" ? null : form.assignedPartnerCpf;
    const assignedPartner = assignedPartnerCpf ? partners.find((p) => p.cpf === assignedPartnerCpf) : null;

    await addExpense.mutateAsync({
      clientId: clienteId,
      description: form.description,
      totalAmount: parseFloat(form.totalAmount),
      category: form.category,
      expenseType: form.expenseType || form.category,
      assignedPartnerCpf: assignedPartnerCpf,
      assignedPartnerName: assignedPartner?.name || null,
      dueDate: form.dueDate,
      supplierName: form.supplierName || null,
      invoiceNumber: form.invoiceNumber || null,
      paymentMethod: form.paymentMethod || null,
      notes: form.notes || null,
    });

    setOpen(false);
    setForm(EMPTY_FORM);
  };

  const selectedCategory = EXPENSE_CATEGORIES.find((c) => c.id === form.category);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Receipt className="h-4 w-4" />
          Nova Despesa
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-destructive" />
            Registrar Despesa
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* ── Categoria ─────────────────────────────────────────────────── */}
          <div>
            <Label className="font-semibold">Categoria *</Label>
            <Select value={form.category} onValueChange={set("category")}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecione a categoria da despesa" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategory && (
              <p className="text-xs text-muted-foreground mt-1 pl-1">
                {selectedCategory.icon} {selectedCategory.label} selecionada
              </p>
            )}
          </div>

          {/* ── Descrição ─────────────────────────────────────────────────── */}
          <div>
            <Label htmlFor="exp-desc" className="font-semibold">Descrição *</Label>
            <Input
              id="exp-desc"
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder={
                selectedCategory
                  ? `Ex: ${selectedCategory.label} - detalhe da despesa`
                  : "Descreva a despesa"
              }
              required
              disabled={addExpense.isPending}
              className="mt-2"
            />
          </div>

          {/* ── Valor + Vencimento ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="exp-amount" className="font-semibold">Valor (R$) *</Label>
              <Input
                id="exp-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={form.totalAmount}
                onChange={(e) => set("totalAmount")(e.target.value)}
                placeholder="0,00"
                required
                disabled={addExpense.isPending}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="exp-due" className="font-semibold">Vencimento *</Label>
              <Input
                id="exp-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => set("dueDate")(e.target.value)}
                required
                disabled={addExpense.isPending}
                className="mt-2"
              />
            </div>
          </div>

          {/* ── Sócio Responsável (opcional) ─────────────────────────────── */}
          <div>
            <Label className="font-semibold">
              Sócio Responsável{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Select
              value={form.assignedPartnerCpf}
              onValueChange={set("assignedPartnerCpf")}
              disabled={loadingPartners}
            >
              <SelectTrigger className="mt-2">
                <SelectValue
                  placeholder={
                    loadingPartners ? "Carregando sócios..." : "Atribuir a um sócio"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem atribuição —</SelectItem>
                {partners.map((partner) => (
                  <SelectItem key={partner.id} value={partner.cpf}>
                    <div className="flex flex-col">
                      <span className="font-medium">{partner.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatCPF(partner.cpf)}
                        {partner.share_percentage &&
                          ` • ${partner.share_percentage}%`}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Fornecedor + Nº Nota ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="exp-supplier" className="font-semibold">
                Fornecedor
              </Label>
              <Input
                id="exp-supplier"
                value={form.supplierName}
                onChange={(e) => set("supplierName")(e.target.value)}
                placeholder="Nome do fornecedor"
                disabled={addExpense.isPending}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="exp-invoice" className="font-semibold">
                Nº Nota/NF
              </Label>
              <Input
                id="exp-invoice"
                value={form.invoiceNumber}
                onChange={(e) => set("invoiceNumber")(e.target.value)}
                placeholder="Ex: 2025180"
                disabled={addExpense.isPending}
                className="mt-2"
              />
            </div>
          </div>

          {/* ── Forma de Pagamento ────────────────────────────────────────── */}
          <div>
            <Label className="font-semibold">Forma de Pagamento</Label>
            <Select value={form.paymentMethod} onValueChange={set("paymentMethod")}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nao_informado">— Não informado —</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="ted">TED</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Observações ───────────────────────────────────────────────── */}
          <div>
            <Label htmlFor="exp-notes" className="font-semibold">Observações</Label>
            <Textarea
              id="exp-notes"
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
              placeholder="Informações adicionais sobre a despesa..."
              rows={2}
              disabled={addExpense.isPending}
              className="mt-2 resize-none"
            />
          </div>

          {/* ── Submit ────────────────────────────────────────────────────── */}
          <Button
            type="submit"
            variant="destructive"
            className="w-full mt-2"
            disabled={
              addExpense.isPending ||
              !form.description ||
              !form.totalAmount ||
              !form.category
            }
            size="lg"
          >
            {addExpense.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Registrando Despesa...
              </>
            ) : (
              <>
                {selectedCategory?.icon} Registrar Despesa
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
