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

  const [formData, setFormData] = useState({
    description: "",
    amount: 0,
    paymentDate: "",
    notes: "",
    bankName: "",
    prazo: "",
  })

  // Populate form when transaction changes
  useEffect(() => {
    if (transaction) {
      const paymentDate = transaction.payment_date || transaction.created_at
      const dateObj = new Date(paymentDate.includes("T") ? paymentDate : paymentDate + "T12:00:00")
      const formattedDate = dateObj.toISOString().split("T")[0]

      console.log("Carregando transação para edição:", {
        id: transaction.id,
        reference_type: transaction.reference_type,
        transaction_type: transaction.transaction_type,
        paymentDate: transaction.payment_date,
        created_at: transaction.created_at,
        formattedDate,
      });

      setFormData({
        description: transaction.description || "",
        amount: transaction.amount || 0,
        paymentDate: formattedDate,
        notes: transaction.notes || "",
        bankName: transaction.bank_name || "",
        prazo: transaction.prazo || "",
      })
    }
  }, [transaction, isOpen])

  const handleSave = async () => {
    if (!transaction) return

    // Validar data
    if (!formData.paymentDate) {
      alert("Selecione uma data para o lançamento")
      return
    }

    // Determinar corretamente o tipo para atualizar
    // Se temos reference_type, usar esse (partner_expense, abastecimento)
    // Senão, usar transaction_type (deposit, payment, etc)
    const transactionType = transaction.reference_type || transaction.transaction_type

    console.log("Salvando transação com tipo:", {
      reference_type: transaction.reference_type,
      transaction_type: transaction.transaction_type,
      send_type: transactionType,
    });

    try {
      await updateTransaction.mutateAsync({
        id: transaction.id,
        clientId,
        transactionType,
        description: formData.description,
        amount: formData.amount,
        paymentDate: formData.paymentDate,
        notes: formData.notes || null,
        bankName: formData.bankName || null,
        prazo: formData.prazo || null,
      })
      onClose()
    } catch (error) {
      console.error("Erro ao atualizar transação:", error)
    }
  }

  if (!transaction) return null

  const isExpense = transaction.reference_type === "partner_expense" || transaction.transaction_type === "expense"
  const isDeposit = transaction.transaction_type === "deposit"

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
          <DialogDescription>
            Modifique os dados do lançamento e clique em salvar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Descrição
            </Label>
            <Input
              id="description"
              placeholder="Ex: Depósito inicial, Combustível, etc"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="text-sm"
            />
          </div>

          {/* Valor */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm font-medium">
              Valor (R$)
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
              }
              className="text-sm"
            />
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label htmlFor="paymentDate" className="text-sm font-medium">
              Data do Lançamento
            </Label>
            <Input
              id="paymentDate"
              type="date"
              value={formData.paymentDate}
              onChange={(e) =>
                setFormData({ ...formData, paymentDate: e.target.value })
              }
              className="text-sm"
            />
          </div>

          {/* Método de Pagamento */}
          <div className="space-y-2">
            <Label htmlFor="bankName" className="text-sm font-medium">
              Banco / Instituição
            </Label>
            <Input
              id="bankName"
              placeholder="Ex: Banco do Brasil, Itaú, etc"
              value={formData.bankName}
              onChange={(e) =>
                setFormData({ ...formData, bankName: e.target.value })
              }
              className="text-sm"
            />
          </div>

          {/* Prazo */}
          <div className="space-y-2">
            <Label htmlFor="prazo" className="text-sm font-medium">
              Prazo
            </Label>
            <Select
              value={formData.prazo || "sem_prazo"}
              onValueChange={(value) =>
                setFormData({ ...formData, prazo: value === "sem_prazo" ? "" : value })
              }
            >
              <SelectTrigger id="prazo" className="text-sm">
                <SelectValue placeholder="Selecione o prazo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sem_prazo">Sem prazo</SelectItem>
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
            <Label htmlFor="notes" className="text-sm font-medium">
              Observações
            </Label>
            <Textarea
              id="notes"
              placeholder="Adicione observações adicionais"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="text-sm min-h-[100px] resize-none"
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
