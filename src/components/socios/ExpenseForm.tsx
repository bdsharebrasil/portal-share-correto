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
  SelectValue } from
"@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger } from
"@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Receipt, Plus, ChevronRight, ArrowLeft, Fuel, CalendarIcon, UserPlus } from "lucide-react";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { useCreateExpense } from "@/hooks/useFinanceiroSocios";
import { useClientPartners } from "@/hooks/useClientPartners";
import { useClientAbastecimentos } from "@/hooks/useAbastecimentos";
import { useFornecedoresFavoritos } from "@/hooks/useFornecedoresFavoritos";
import { useFuelSuppliers } from "@/hooks/useFuelSuppliers";
import { useContasBancarias } from "@/hooks/useContasBancarias";
import { AddFornecedorDialog } from "@/components/fiscal/contas-pagar/AddFornecedorDialog";
import { useQueryClient } from "@tanstack/react-query";
import { formatCPF } from "@/lib/formatters";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// ─── Categorias ───────────────────────────────────────────────────────────────
export const EXPENSE_CATEGORIES = [
{ id: "abastecimento", label: "Abastecimento", icon: "⛽" },
{ id: "hangaragem", label: "Hangaragem", icon: "🏠" },
{ id: "manutencao", label: "Manutenção", icon: "🔧" },
{ id: "pouso_decolagem", label: "Tarifa de Pouso/Decolagem", icon: "✈️" },
{ id: "atendimento_pista", label: "Atendimento de Pista", icon: "🛬" },
{ id: "subscricoes", label: "Assinaturas/Subscrições", icon: "📋" },
{ id: "contabilidade", label: "Honorários Contabilidade", icon: "📊" },
{ id: "ressarcimento", label: "Ressarcimento/Reembolso", icon: "💸" },
{ id: "viagem", label: "Despesas de Viagem", icon: "🧳" },
{ id: "infraero", label: "INFRAERO", icon: "🏛️" },
{ id: "impostos", label: "Impostos", icon: "🏦" },
{ id: "outros", label: "Outros", icon: "📎" }] as
const;

export const IMPOSTOS_SUBTYPES = [
  { value: "fgts", label: "FGTS" },
  { value: "inss", label: "INSS" },
  { value: "pis", label: "PIS" },
  { value: "cofins", label: "COFINS" },
  { value: "das", label: "DAS" },
  { value: "irpj", label: "IRPJ" },
  { value: "csll", label: "CSLL" },
  { value: "iss", label: "ISS" },
  { value: "outros_impostos", label: "Outros Impostos" },
] as const;

export type ExpenseCategoryId = typeof EXPENSE_CATEGORIES[number]["id"];

const EMPTY_FORM = {
  description: "",
  totalAmount: "",
  category: "" as ExpenseCategoryId | "",
  expenseType: "",
  assignedPartnerCpf: "none",
  paidDate: format(new Date(), "yyyy-MM-dd"),
  dueDate: format(new Date(), "yyyy-MM-dd"),
  supplierName: "",
  invoiceNumber: "",
  invoiceUrl: "",
  paymentMethod: "nao_informado",
  notes: "",
  status: "pago",
  abastecimentoId: "",
  criarNovoAbastecimento: false,
  bankName: "",
  prazo: "extra" as "mensal" | "extra",
  isInstallment: false,
  installmentCount: "1",
  installmentStartDate: format(new Date(), "yyyy-MM-dd")
};

interface ExpenseFormProps {
  clienteId: string;
}

export function ExpenseForm({ clienteId }: ExpenseFormProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showAddFornecedor, setShowAddFornecedor] = useState(false);
  const queryClient = useQueryClient();

  const addExpense = useCreateExpense();
  const { data: partners = [], isLoading: loadingPartners } = useClientPartners(clienteId);
  const { data: abastecimentos = [] } = useClientAbastecimentos(clienteId);
  const { data: fornecedoresFavoritos = [] } = useFornecedoresFavoritos();
  const { data: fuelSuppliers = [] } = useFuelSuppliers();
  const { data: contasBancarias = [], isLoading: loadingContas } = useContasBancarias();

  // Filtrar apenas fornecedores da categoria 'share'
  const fornecedoresShare = fornecedoresFavoritos.filter(f => f.categoria === 'share');

  const set = (key: keyof typeof EMPTY_FORM) => (value: string | boolean) =>
  setForm((prev) => ({ ...prev, [key]: value }));

  // Fetch aircraft_id for this client
  const getAircraftId = async (): Promise<string | null> => {
    try {
      const { data } = await supabase
        .from("client_aircraft")
        .select("aircraft_id")
        .eq("client_id", clienteId)
        .limit(1)
        .single();
      return data?.aircraft_id || null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.totalAmount || !form.category) return;

    const assignedPartnerCpf =
    form.assignedPartnerCpf === "none" ? null : form.assignedPartnerCpf;
    const assignedPartner = assignedPartnerCpf ?
    partners.find((p) => p.cpf === assignedPartnerCpf) :
    null;

    // Resolve bank name from ID
    const selectedConta = contasBancarias.find((c) => c.id === form.bankName);
    const bankNameResolved = selectedConta ? selectedConta.banco : form.bankName || null;

    // Fetch aircraft_id
    const aircraftId = await getAircraftId();

    // If no partner assigned, split equally among all partners
    if (!assignedPartnerCpf && partners.length > 1) {
      const splitAmount = parseFloat(form.totalAmount) / partners.length;
      const splitAmountRounded = Math.round(splitAmount * 100) / 100;

      for (const partner of partners) {
        await addExpense.mutateAsync({
          clientId: clienteId,
          description: form.description,
          totalAmount: splitAmountRounded,
          category: form.category,
          expenseType: form.expenseType || form.category,
          assignedPartnerCpf: partner.cpf,
          assignedPartnerName: partner.name,
          dueDate: form.dueDate,
          supplierName: form.supplierName || null,
          invoiceNumber: form.invoiceNumber || null,
          invoiceUrl: form.invoiceUrl || null,
          paymentMethod: form.paymentMethod === "nao_informado" ? null : form.paymentMethod || null,
          notes: form.notes || null,
          bankName: bankNameResolved,
          prazo: form.prazo || "extra",
          isInstallment: form.isInstallment && form.paymentMethod === "cartao",
          installmentCount: form.isInstallment && form.paymentMethod === "cartao" ? parseInt(form.installmentCount) : 1,
          installmentStartDate: form.isInstallment && form.paymentMethod === "cartao" ? form.installmentStartDate : null,
          aircraftId,
          status: form.status,
        });
      }
    } else {
      await addExpense.mutateAsync({
        clientId: clienteId,
        description: form.description,
        totalAmount: parseFloat(form.totalAmount),
        category: form.category,
        expenseType: form.expenseType || form.category,
        assignedPartnerCpf,
        assignedPartnerName: assignedPartner?.name || null,
        dueDate: form.dueDate,
        supplierName: form.supplierName || null,
        invoiceNumber: form.invoiceNumber || null,
        invoiceUrl: form.invoiceUrl || null,
        paymentMethod: form.paymentMethod === "nao_informado" ? null : form.paymentMethod || null,
        notes: form.notes || null,
        bankName: bankNameResolved,
        prazo: form.prazo || "extra",
        isInstallment: form.isInstallment && form.paymentMethod === "cartao",
        installmentCount: form.isInstallment && form.paymentMethod === "cartao" ? parseInt(form.installmentCount) : 1,
        installmentStartDate: form.isInstallment && form.paymentMethod === "cartao" ? form.installmentStartDate : null,
        aircraftId,
        status: form.status,
      });
    }

    setOpen(false);
    setForm(EMPTY_FORM);
  };

  const selectedCategory = EXPENSE_CATEGORIES.find((c) => c.id === form.category);
  const isAbastecimento = form.category === "abastecimento";
  const isValid = !!form.description && !!form.totalAmount && !!form.category;

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="gap-2 h-11 px-5 text-sm font-semibold rounded-xl
                     bg-red-600 hover:bg-red-500 text-white border-0
                     transition-all duration-200 hover:-translate-y-px hover:shadow-md">
          
          <Receipt className="h-4 w-4" />
          Nova Despesa
        </Button>
      </DialogTrigger>

      <DialogContent
        className="
          w-full max-w-5xl
          max-h-[92vh] overflow-y-auto
          rounded-2xl border border-border/60
          bg-background/95 backdrop-blur-sm
          shadow-2xl p-0
        ">
        
        {/* ── Header ── */}
        <div className="relative px-8 pt-8 pb-6 border-b border-red-700/40 bg-gradient-to-br from-red-700 to-rose-800 rounded-t-2xl overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-8 -right-8 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-white/10" />
          </div>
          <DialogHeader className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-white">
                  Registrar Despesa
                </DialogTitle>
                <p className="text-sm text-red-100/80 mt-0.5">
                  Informe os dados da movimentação de saída
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* ── Body ── */}
        <div className="px-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Categoria */}
            <FormSection label="Categoria" required>
              <Select value={form.category} onValueChange={set("category")}>
                <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                  <SelectValue placeholder="Selecione a categoria da despesa" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {EXPENSE_CATEGORIES.map((cat) =>
                  <SelectItem key={cat.id} value={cat.id} className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg leading-none">{cat.icon}</span>
                        <span className="font-medium text-sm">{cat.label}</span>
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              {selectedCategory &&
              <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm mt-2 bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800/50 dark:text-red-300">
                  <span className="text-base">{selectedCategory.icon}</span>
                  <span className="font-medium">{selectedCategory.label} selecionada</span>
                  <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-50" />
                </div>
              }
            </FormSection>

            {/* Abastecimento */}
            {isAbastecimento &&
            <div className="rounded-2xl bg-amber-950/40 border border-amber-700/50 p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/60">
                    <Fuel className="h-4 w-4 text-amber-400" />
                  </div>
                  <p className="font-semibold text-sm text-amber-200">
                    Vincular com Abastecimento
                  </p>
                </div>

                {!form.criarNovoAbastecimento ?
              <>
                    <Select value={form.abastecimentoId} onValueChange={(v) => set("abastecimentoId")(v)}>
                      <SelectTrigger className="h-12 rounded-xl border-amber-700/50 bg-zinc-900 text-sm">
                        <SelectValue placeholder="Selecione um abastecimento registrado" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {abastecimentos.length === 0 ?
                    <div className="p-4 text-sm text-muted-foreground text-center">
                            Nenhum abastecimento não pago
                          </div> :

                    abastecimentos.map((abast) =>
                    <SelectItem key={abast.id} value={abast.id} className="py-3">
                              <div className="text-sm space-y-0.5">
                                <div>{format(new Date(abast.data), "dd/MM/yyyy")} · {abast.local} · R$ {Number(abast.valor_total).toFixed(2)}</div>
                                <div className="text-xs text-muted-foreground flex gap-2">
                                  {abast.comanda && <span>Comanda: {abast.comanda}</span>}
                                  {abast.partner_name && <span>Sócio: {abast.partner_name}</span>}
                                </div>
                              </div>
                            </SelectItem>
                    )
                    }
                      </SelectContent>
                    </Select>
                    <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2 text-amber-400 hover:bg-amber-900/30 rounded-xl h-10"
                  onClick={() => set("criarNovoAbastecimento")(true)}>
                  
                      <Plus className="h-4 w-4" />
                      Criar novo abastecimento
                    </Button>
                  </> :

              <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormSection label="Data do Abastecimento">
                        <Input type="date" defaultValue={format(new Date(), "yyyy-MM-dd")} className="h-12 rounded-xl border-amber-200 bg-white dark:bg-zinc-900 text-sm" disabled={addExpense.isPending} />
                      </FormSection>
                      <FormSection label="Local">
                        <Input placeholder="Ex: Portimão, Portugal" className="h-12 rounded-xl border-amber-200 bg-white dark:bg-zinc-900 text-sm" disabled={addExpense.isPending} />
                      </FormSection>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormSection label="Litros">
                        <Input type="number" step="0.01" placeholder="0,00" className="h-12 rounded-xl border-amber-200 bg-white dark:bg-zinc-900 text-sm" disabled={addExpense.isPending} />
                      </FormSection>
                      <FormSection label="Valor Unitário">
                        <Input type="number" step="0.01" placeholder="0,00" className="h-12 rounded-xl border-amber-200 bg-white dark:bg-zinc-900 text-sm" disabled={addExpense.isPending} />
                      </FormSection>
                    </div>
                    <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2 text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30 rounded-xl h-10"
                  onClick={() => set("criarNovoAbastecimento")(false)}>
                  
                      <ArrowLeft className="h-4 w-4" />
                      Usar abastecimento existente
                    </Button>
                  </>
              }
              </div>
            }

            {/* Descrição */}
            <FormSection label="Descrição" required>
              <Input
                value={form.description}
                onChange={(e) => set("description")(e.target.value)}
                placeholder={selectedCategory ? `Ex: ${selectedCategory.label} - detalhe da despesa` : "Descreva a despesa"}
                required
                disabled={addExpense.isPending}
                className="h-12 rounded-xl border-border/70 text-sm" />
              
            </FormSection>

            {/* Impostos subtype */}
            {form.category === "impostos" && (
              <div className="rounded-2xl bg-blue-950/40 border border-blue-700/50 p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-900/60">
                    <span className="text-base">🏦</span>
                  </div>
                  <p className="font-semibold text-sm text-blue-200">
                    Tipo de Imposto
                  </p>
                </div>
                <Select value={form.expenseType} onValueChange={set("expenseType")}>
                  <SelectTrigger className="h-12 rounded-xl border-blue-700/50 bg-zinc-900 text-sm">
                    <SelectValue placeholder="Selecione o tipo de imposto" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {IMPOSTOS_SUBTYPES.map((imp) => (
                      <SelectItem key={imp.value} value={imp.value} className="py-3">
                        <span className="font-medium text-sm">{imp.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Valor + Datas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <FormSection label="Valor (R$)" required>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground select-none">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.totalAmount}
                    onChange={(e) => set("totalAmount")(e.target.value)}
                    placeholder="0,00"
                    required
                    disabled={addExpense.isPending}
                    className="h-12 rounded-xl border-border/70 text-sm pl-10 font-mono" />
                  
                </div>
              </FormSection>
              <FormSection label="Data de Pagamento" required>
                <DateFieldWithInput
                  value={form.paidDate}
                  onChange={(v) => set("paidDate")(v)}
                />
              </FormSection>
              <FormSection label="Data de Vencimento">
                <DateFieldWithInput
                  value={form.dueDate}
                  onChange={(v) => set("dueDate")(v)}
                />
              </FormSection>
            </div>

            {/* Sócio Responsável */}
            <FormSection label="Sócio Responsável">
              <Select value={form.assignedPartnerCpf} onValueChange={set("assignedPartnerCpf")} disabled={loadingPartners}>
                <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                  <SelectValue placeholder={loadingPartners ? "Carregando sócios..." : "Atribuir a um sócio (opcional)"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="none" className="py-3">
                    <span className="text-muted-foreground text-sm">— Sem atribuição —</span>
                  </SelectItem>
                  {partners.map((partner) =>
                  <SelectItem key={partner.id} value={partner.cpf} className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                          {partner.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{partner.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {formatCPF(partner.cpf)}{partner.share_percentage && ` · ${partner.share_percentage}%`}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </FormSection>

            {/* Fornecedor + NF */}
            <div className="space-y-4">
              <FormSection label="Fornecedor">
                {isAbastecimento ? (
                  // Para abastecimento, mostrar fornecedores de combustível
                  <SearchableCombobox
                    items={fuelSuppliers.map((f) => ({
                      id: f.supplier_name,
                      label: `${f.supplier_name} - ${f.city_name} (${f.icao_code})`
                    }))}
                    value={form.supplierName}
                    onChange={(id, label) => set("supplierName")(id)}
                    placeholder="Selecione um fornecedor de combustível..."
                    searchPlaceholder="Buscar fornecedor..."
                    emptyMessage="Nenhum fornecedor de combustível cadastrado"
                    disabled={addExpense.isPending}
                  />
                ) : (
                  // Para outras categorias, mostrar apenas fornecedores favoritos categoria 'share'
                  <>
                    <SearchableCombobox
                      items={fornecedoresShare.map((f) => ({
                        id: f.nome_completo,
                        label: `${f.nome_completo}${f.documento ? ` (${f.documento})` : ""}`
                      }))}
                      value={form.supplierName}
                      onChange={(id, label) => set("supplierName")(id)}
                      placeholder="Selecione ou digite o fornecedor..."
                      searchPlaceholder="Buscar fornecedor..."
                      emptyMessage="Nenhum fornecedor encontrado"
                      disabled={addExpense.isPending}
                      allowFreeText={true}
                    />
                    {/* Botão para adicionar fornecedor favorito se digitou texto livre */}
                    {form.supplierName && !fornecedoresShare.some(f => f.nome_completo === form.supplierName) && (
                      <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg mt-2">
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex-1">
                          Fornecedor não encontrado nos favoritos.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddFornecedor(true)}
                          className="h-7 text-xs"
                        >
                          <UserPlus className="h-3 w-3 mr-1" /> Adicionar
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </FormSection>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormSection label="Nº Nota / NF">
                  <Input value={form.invoiceNumber} onChange={(e) => set("invoiceNumber")(e.target.value)} placeholder="Ex: 2025180" disabled={addExpense.isPending} className="h-12 rounded-xl border-border/70 text-sm" />
                </FormSection>
                <FormSection label="URL Nota Fiscal">
                  <Input type="url" value={form.invoiceUrl} onChange={(e) => set("invoiceUrl")(e.target.value)} placeholder="https://..." disabled={addExpense.isPending} className="h-12 rounded-xl border-border/70 text-sm" />
                </FormSection>
              </div>
            </div>

            {/* Status + Forma de Pagamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormSection label="Status da Despesa">
                <Select value={form.status} onValueChange={set("status")}>
                  <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="pago" className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                        <span className="text-sm font-medium">Pago</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="pendente" className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
                        <span className="text-sm font-medium">Pendente</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="cancelado" className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-zinc-400 flex-shrink-0" />
                        <span className="text-sm font-medium">Cancelado</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormSection>
              <FormSection label="Forma de Pagamento">
                <Select value={form.paymentMethod} onValueChange={set("paymentMethod")}>
                  <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="nao_informado" className="py-2">— Não informado —</SelectItem>
                    <SelectItem value="pix" className="py-2">PIX</SelectItem>
                    <SelectItem value="ted" className="py-2">TED</SelectItem>
                    <SelectItem value="boleto" className="py-2">Boleto</SelectItem>
                    <SelectItem value="cartao" className="py-2">Cartão</SelectItem>
                    <SelectItem value="dinheiro" className="py-2">Dinheiro</SelectItem>
                    <SelectItem value="outros" className="py-2">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </FormSection>
            </div>

            {/* Parcelamento em Cartão */}
            {form.paymentMethod === "cartao" &&
            <div className="rounded-2xl bg-slate-500 border border-slate-900 dark:bg-slate-600 dark:border-slate-900 p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                    <span className="text-base">💳</span>
                  </div>
                  <p className="font-semibold text-sm text-white">
                    Pagamento em Cartão
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                    type="checkbox"
                    checked={form.isInstallment}
                    onChange={(e) => set("isInstallment")(e.target.checked)}
                    disabled={addExpense.isPending}
                    className="w-4 h-4 rounded border-white/50 cursor-pointer accent-white" />
                  
                    <span className="text-sm font-medium text-white">
                      Parcelar despesa
                    </span>
                  </label>
                </div>

                {form.isInstallment &&
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/20 [&_label]:text-white">
                    <FormSection label="Nº de Parcelas" required>
                      <Select value={form.installmentCount} onValueChange={set("installmentCount")}>
                        <SelectTrigger className="h-12 rounded-xl border-white/30 bg-white/10 dark:bg-white/5 text-sm text-white">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) =>
                      <SelectItem key={num} value={String(num)} className="py-3">
                              <span className="text-sm font-medium">{num}x</span>
                            </SelectItem>
                      )}
                        </SelectContent>
                      </Select>
                      {form.installmentCount !== "1" &&
                  <div className="mt-3 p-3 rounded-lg bg-white/15 text-sm text-white/90">
                          <p className="font-medium">Resumo do parcelamento:</p>
                          <p className="mt-1">
                            <strong>{form.description || "Despesa"}</strong> {parseInt(form.installmentCount)}X{" "}
                            <strong>R$ {(parseFloat(form.totalAmount || "0") / parseInt(form.installmentCount)).toFixed(2)}</strong>
                          </p>
                          <div className="mt-2 space-y-1 text-xs">
                            {Array.from({ length: Math.min(parseInt(form.installmentCount), 3) }).map((_, i) => {
                        const months = i + 1;
                        const date = new Date(form.installmentStartDate);
                        date.setMonth(date.getMonth() + i);
                        return (
                          <p key={i}>
                                  Mês {months}/{form.installmentCount}: R${" "}
                                  {(parseFloat(form.totalAmount || "0") / parseInt(form.installmentCount)).toFixed(2)} - {format(date, "MMM/yyyy", { locale: ptBR })}
                                </p>);

                      })}
                            {parseInt(form.installmentCount) > 3 &&
                      <p className="italic opacity-75">... +{parseInt(form.installmentCount) - 3} parcelas</p>
                      }
                          </div>
                        </div>
                  }
                    </FormSection>

                    <FormSection label="Data 1ª Parcela" required>
                      <Input
                    type="date"
                    value={form.installmentStartDate}
                    onChange={(e) => set("installmentStartDate")(e.target.value)}
                    disabled={addExpense.isPending}
                    className="h-12 rounded-xl border-white/30 bg-white/10 dark:bg-white/5 text-sm text-white" />
                  
                    </FormSection>
                  </div>
              }
              </div>
            }

            {/* Conta Bancária + Prazo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormSection label="Conta Bancária">
                <Select value={form.bankName} onValueChange={set("bankName")} disabled={loadingContas}>
                  <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                    <SelectValue placeholder={loadingContas ? "Carregando contas..." : "Selecione a conta"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {contasBancarias.length === 0 && !loadingContas ?
                    <div className="p-4 text-sm text-muted-foreground text-center">
                        Nenhuma conta bancária cadastrada
                      </div> :

                    contasBancarias.map((conta) =>
                    <SelectItem key={conta.id} value={conta.id} className="py-3">
                          <div>
                            <div className="font-medium text-sm">{conta.banco}</div>
                            {conta.numero_conta &&
                        <div className="text-xs text-muted-foreground font-mono">
                                Cta: {conta.numero_conta}{conta.tipo_conta ? ` · ${conta.tipo_conta}` : ""}
                              </div>
                        }
                          </div>
                        </SelectItem>
                    )
                    }
                  </SelectContent>
                </Select>
              </FormSection>
              <FormSection label="Prazo" required>
                <Select value={form.prazo} onValueChange={(v) => set("prazo")(v as "mensal" | "extra")}>
                  <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                    <SelectValue placeholder="Selecione o tipo" />
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
                          <div className="text-xs text-muted-foreground">Evento ou gasto avulso</div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormSection>
            </div>

            {/* Observações */}
            <FormSection label="Observações">
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes")(e.target.value)}
                placeholder="Informações adicionais sobre a despesa..."
                rows={3}
                disabled={addExpense.isPending}
                className="rounded-xl border-border/70 text-sm resize-none" />
              
            </FormSection>

            {/* Submit */}
            <Button
              type="submit"
              className="
                w-full h-12 rounded-xl font-semibold text-sm
                bg-gradient-to-r from-red-600 to-rose-600
                hover:from-red-500 hover:to-rose-500
                text-white shadow-red-500/20
                transition-all duration-200 hover:-translate-y-px hover:shadow-md
                disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none
              "
              disabled={addExpense.isPending || !isValid}>
              
              {addExpense.isPending ?
              <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Registrando Despesa...
                </span> :

              <span className="flex items-center gap-2">
                  
                  {selectedCategory ? `${selectedCategory.icon} Registrar ${selectedCategory.label}` : "Registrar Despesa"}
                </span>
              }
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>

    <AddFornecedorDialog
      open={showAddFornecedor}
      onOpenChange={setShowAddFornecedor}
      initialName={form.supplierName}
      onSaved={(forn) => {
        set("supplierName")(forn.nome_completo);
      }}
      onFornecedorAdded={() => {
        queryClient.invalidateQueries({ queryKey: ["fornecedores-favoritos"] });
      }}
    />
    </>);

}

// ─── FormSection ─────────────────────────────────────────────────────────────
function FormSection({
  label, required, children




}: {label: string;required?: boolean;children: React.ReactNode;}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground/80 flex items-center gap-1">
        {label}
        {required && <span className="text-red-500 text-base leading-none">*</span>}
      </Label>
      {children}
    </div>);

}

function DateFieldWithInput({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
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
