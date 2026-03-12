"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUpdateTransaction } from "@/hooks/useFinanceiroSocios"
import { useClientPartners } from "@/hooks/useClientPartners"
import { useContasBancarias } from "@/hooks/useContasBancarias"
import { EXPENSE_CATEGORIES, IMPOSTOS_SUBTYPES } from "@/components/socios/ExpenseForm"
import { formatCPF } from "@/lib/formatters"

interface Transaction {
  id: string
  description?: string | null
  amount: number
  payment_date?: string | null
  created_at: string
  notes?: string | null
  bank_name?: string | null
  prazo?: string | null
  transaction_type: string
  reference_type?: string | null
  status?: string
  expense_type?: string
  category?: string | null
  supplier_name?: string | null
  payment_method?: string | null
  assigned_partner_cpf?: string | null
  assigned_partner_name?: string | null
  invoice_number?: string | null
  invoice_url?: string | null
  due_date?: string | null
  paid_date?: string | null
}

interface TransactionEditModalProps {
  transaction: Transaction | null
  isOpen: boolean
  onClose: () => void
  clientId: string
}

export function TransactionEditModal({
  transaction,
  isOpen,
  onClose,
  clientId,
}: TransactionEditModalProps) {
  const updateTransaction = useUpdateTransaction()
  const { data: partners = [], isLoading: loadingPartners } = useClientPartners(clientId)
  const { data: contasBancarias = [], isLoading: loadingContas } = useContasBancarias()

  const [formData, setFormData] = useState({
    description: "",
    amount: 0,
    paymentDate: "",
    dueDate: "",
    notes: "",
    bankName: "",
    prazo: "",
    category: "",
    expenseType: "",
    supplierName: "",
    paymentMethod: "",
    status: "",
    assignedPartnerCpf: "none",
    invoiceNumber: "",
    invoiceUrl: "",
  })

  useEffect(() => {
    if (transaction) {
      const paymentDate = transaction.paid_date || transaction.payment_date || transaction.created_at
      const dateObj = new Date(paymentDate.includes("T") ? paymentDate : paymentDate + "T12:00:00")
      const formattedDate = dateObj.toISOString().split("T")[0]

      let dueDateFormatted = ""
      if (transaction.due_date) {
        const dd = new Date(transaction.due_date.includes("T") ? transaction.due_date : transaction.due_date + "T12:00:00")
        dueDateFormatted = dd.toISOString().split("T")[0]
      }

      // Try to match bank name to conta ID
      let bankId = ""
      if (transaction.bank_name) {
        const matchedConta = contasBancarias.find((c) => c.banco === transaction.bank_name)
        bankId = matchedConta ? matchedConta.id : transaction.bank_name
      }

      setFormData({
        description: transaction.description || "",
        amount: transaction.amount || 0,
        paymentDate: formattedDate,
        dueDate: dueDateFormatted,
        notes: transaction.notes || "",
        bankName: bankId,
        prazo: transaction.prazo || "",
        category: transaction.category || transaction.expense_type || "",
        expenseType: transaction.expense_type || "",
        supplierName: transaction.supplier_name || "",
        paymentMethod: transaction.payment_method || "nao_informado",
        status: transaction.status || "pago",
        assignedPartnerCpf: transaction.assigned_partner_cpf || "none",
        invoiceNumber: transaction.invoice_number || "",
        invoiceUrl: transaction.invoice_url || "",
      })
    }
  }, [transaction, isOpen, contasBancarias])

  const handleSave = async () => {
    if (!transaction) return

    if (!formData.paymentDate) {
      alert("Selecione uma data para o lançamento")
      return
    }

    const transactionType = transaction.reference_type || transaction.transaction_type

    // Resolve bank name from ID
    const selectedConta = contasBancarias.find((c) => c.id === formData.bankName)
    const bankNameResolved = selectedConta ? selectedConta.banco : formData.bankName || null

    const assignedPartner = formData.assignedPartnerCpf !== "none"
      ? partners.find((p) => p.cpf === formData.assignedPartnerCpf)
      : null

    try {
      await updateTransaction.mutateAsync({
        id: transaction.id,
        clientId,
        transactionType,
        description: formData.description,
        amount: formData.amount,
        paymentDate: formData.paymentDate,
        dueDate: formData.dueDate || null,
        notes: formData.notes || null,
        bankName: bankNameResolved,
        prazo: formData.prazo || null,
        category: formData.category || null,
        expenseType: formData.expenseType || null,
        supplierName: formData.supplierName || null,
        paymentMethod: formData.paymentMethod === "nao_informado" ? null : formData.paymentMethod || null,
        status: formData.status || null,
        assignedPartnerCpf: assignedPartner?.cpf || null,
        assignedPartnerName: assignedPartner?.name || null,
        invoiceNumber: formData.invoiceNumber || null,
        invoiceUrl: formData.invoiceUrl || null,
      })
      onClose()
    } catch (error) {
      console.error("Erro ao atualizar transação:", error)
    }
  }

  if (!transaction) return null

  const isExpense = transaction.reference_type === "partner_expense" || transaction.transaction_type === "expense"

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
          <DialogDescription>
            Modifique os dados do lançamento e clique em salvar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sócio Responsável */}
          {isExpense && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Sócio Responsável</Label>
              <Select
                value={formData.assignedPartnerCpf}
                onValueChange={(v) => setFormData({ ...formData, assignedPartnerCpf: v })}
                disabled={loadingPartners}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecione o sócio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">— Sem atribuição —</span>
                  </SelectItem>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.cpf}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{partner.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatCPF(partner.cpf)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Categoria */}
          {isExpense && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Categoria</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span className="text-sm">{cat.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="despesa_bancaria">
                    <div className="flex items-center gap-2">
                      <span>🏦</span>
                      <span className="text-sm">Despesa Bancária</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Descrição
            </Label>
            <Input
              id="description"
              placeholder="Ex: Depósito inicial, Combustível, etc"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="text-sm"
            />
          </div>

          {/* Valor + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm font-medium">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="text-sm"
              />
            </div>
            {isExpense && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recebido">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        Recebido
                      </div>
                    </SelectItem>
                    <SelectItem value="pago">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Pago
                      </div>
                    </SelectItem>
                    <SelectItem value="pendente">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Pendente
                      </div>
                    </SelectItem>
                    <SelectItem value="cancelado">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-zinc-400" />
                        Cancelado
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentDate" className="text-sm font-medium">
                Data do Lançamento
              </Label>
              <Input
                id="paymentDate"
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                className="text-sm"
              />
            </div>
            {isExpense && (
              <div className="space-y-2">
                <Label htmlFor="dueDate" className="text-sm font-medium">
                  Data de Vencimento
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="text-sm"
                />
              </div>
            )}
          </div>

          {/* Fornecedor + NF */}
          {isExpense && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Fornecedor</Label>
                <Input
                  placeholder="Nome do fornecedor"
                  value={formData.supplierName}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nº Nota / NF</Label>
                <Input
                  placeholder="Ex: 2025180"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          {/* Forma de Pagamento + Conta Bancária */}
          <div className="grid grid-cols-2 gap-4">
            {isExpense && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Forma de Pagamento</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(v) => setFormData({ ...formData, paymentMethod: v })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Selecione" />
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
            )}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Conta Bancária</Label>
              <Select
                value={formData.bankName}
                onValueChange={(v) => setFormData({ ...formData, bankName: v })}
                disabled={loadingContas}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder={loadingContas ? "Carregando..." : "Selecione a conta"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">— Nenhum —</SelectItem>
                  {contasBancarias.map((conta) => (
                    <SelectItem key={conta.id} value={conta.id}>
                      <div>
                        <span className="font-medium text-sm">{conta.banco}</span>
                        {conta.numero_conta && (
                          <span className="text-xs text-muted-foreground ml-1">
                            · {conta.numero_conta}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prazo */}
          <div className="space-y-2">
            <Label htmlFor="prazo" className="text-sm font-medium">Prazo</Label>
            <Select
              value={formData.prazo || "sem_prazo"}
              onValueChange={(value) => setFormData({ ...formData, prazo: value === "sem_prazo" ? "" : value })}
            >
              <SelectTrigger id="prazo" className="text-sm">
                <SelectValue placeholder="Selecione o prazo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sem_prazo">Sem prazo</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="extra">Extra</SelectItem>
                <SelectItem value="15_dias">15 dias</SelectItem>
                <SelectItem value="30_dias">30 dias</SelectItem>
                <SelectItem value="45_dias">45 dias</SelectItem>
                <SelectItem value="60_dias">60 dias</SelectItem>
                <SelectItem value="90_dias">90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Adicione observações adicionais"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="text-sm min-h-[80px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={updateTransaction.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={updateTransaction.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {updateTransaction.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
