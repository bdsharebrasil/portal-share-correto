// @ts-nocheck
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
import { useFuelSuppliers } from "@/hooks/useFuelSuppliers"
import { EXPENSE_CATEGORIES, IMPOSTOS_SUBTYPES, BANK_EXPENSE_CATEGORIES } from "@/components/dashboard/gestor/socios/ExpenseForm"
import { formatCPF } from "@/lib/formatters"
import { supabase } from "@/integrations/supabase/client"

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
  aeronave_id?: string | null
  reference_id?: string | null
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
  const { data: fuelSuppliers = [] } = useFuelSuppliers()

  const isAbastecimento = transaction?.tipo_referencia === "abastecimento" || transaction?.expense_type === "abastecimento"
  const isExpense = transaction?.tipo_referencia === "partner_expense" || transaction?.transaction_type === "expense"

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

  const normalizeCategoryValue = (value?: string | null) => {
    if (!value) return ""

    const normalized = value.toUpperCase()
    const knownCategories = [...EXPENSE_CATEGORIES, ...BANK_EXPENSE_CATEGORIES]
    const directMatch = knownCategories.find((item) => item.id === normalized || item.label === normalized)
    if (directMatch) return directMatch.id

    if (normalized.includes("ABASTEC")) return "ABASTECIMENTO"
    if (normalized.includes("MANUTEN")) return "MANUTENÇÃO"
    if (normalized.includes("VIAGEM")) return "DESPESAS DE VIAGEM"

    return value
  }

  const resolvePartnerCpf = (partnerName?: string | null, partnerCpf?: string | null) => {
    if (partnerCpf) return partnerCpf
    if (!partnerName) return "none"

    const normalizedTarget = partnerName.trim().toLowerCase()
    const matchedPartner = partners.find(
      (partner) => partner.nome.trim().toLowerCase() === normalizedTarget
    )

    return matchedPartner?.cpf || "none"
  }

  useEffect(() => {
    if (!transaction) return

    const loadRelatedData = async () => {
      let sourceTransaction: any = { ...transaction }

      if (isAbastecimento) {
        const fuelId = transaction.referencia_id || transaction.id
        const { data: fuel } = await supabase
          .from("abastecimentos")
          .select("id, data, data_pagamento, data_vencimento_boleto, descricao, local, observacao, abastecedor, status_pagamento, socio_nome, nf, nota_url, banco")
          .eq("id", fuelId)
          .maybeSingle()

        if (fuel) {
          sourceTransaction = {
            ...sourceTransaction,
            description: fuel.descricao || sourceTransaction.descricao || `Abastecimento - ${fuel.local || ""}`.trim(),
            payment_date: fuel.data_pagamento || fuel.data || sourceTransaction.payment_date,
            due_date: fuel.data_vencimento_boleto || null,
            notes: fuel.observacao || "",
            bank_name: fuel.banco || "",
            category: "ABASTECIMENTO",
            expense_type: "ABASTECIMENTO",
            supplier_name: fuel.abastecedor || "",
            status: fuel.status_pagamento || sourceTransaction.status,
            assigned_partner_name: fuel.nome_socio || null,
            assigned_partner_cpf: resolvePartnerCpf(fuel.nome_socio, sourceTransaction.assigned_partner_cpf),
            invoice_number: fuel.nf || "",
            invoice_url: fuel.nota_url || "",
          }
        }
      } else if (isExpense) {
        const { data: expense } = await supabase
          .from("partner_expenses")
          .select("descricao, valor_total, data_pagamento, data_vencimento, observacoes, nome_banco, prazo, categoria, tipo_despesa, nome_fornecedor, metodo_pagamento, status, cpf_socio, nome_socio, numero_fatura, url_fatura, id_referencia, tipo_referencia, id_aeronave")
          .eq("id", transaction.id)
          .maybeSingle()

        if (expense) {
          sourceTransaction = {
            ...sourceTransaction,
            ...expense,
            amount: expense.valor_total,
            payment_date: expense.data_pagamento || transaction.payment_date || expense.data_vencimento,
          }
        }
      }

      const rawPaymentDate = sourceTransaction.paid_date || sourceTransaction.payment_date || sourceTransaction.criado_em
      const dateObj = new Date(rawPaymentDate.includes("T") ? rawPaymentDate : rawPaymentDate + "T12:00:00")
      const formattedDate = dateObj.toISOString().split("T")[0]

      let dueDateFormatted = ""
      if (sourceTransaction.data_vencimento) {
        const dueDateObj = new Date(sourceTransaction.data_vencimento.includes("T") ? sourceTransaction.data_vencimento : sourceTransaction.data_vencimento + "T12:00:00")
        dueDateFormatted = dueDateObj.toISOString().split("T")[0]
      }

      let bankId = ""
      if (sourceTransaction.bank_name) {
        const matchedConta = contasBancarias.find((c) => c.banco === sourceTransaction.bank_name)
        bankId = matchedConta ? matchedConta.id : sourceTransaction.bank_name
      }

      setFormData({
        description: sourceTransaction.descricao || "",
        amount: Number(sourceTransaction.valor || sourceTransaction.total_amount || 0),
        paymentDate: formattedDate,
        dueDate: dueDateFormatted,
        notes: sourceTransaction.notes || "",
        bankName: bankId,
        prazo: sourceTransaction.prazo || "",
        category: normalizeCategoryValue(sourceTransaction.categoria || sourceTransaction.expense_type || (isAbastecimento ? "ABASTECIMENTO" : "")),
        expenseType: normalizeCategoryValue(sourceTransaction.expense_type || sourceTransaction.categoria || (isAbastecimento ? "ABASTECIMENTO" : "")),
        supplierName: sourceTransaction.supplier_name || "",
        paymentMethod: sourceTransaction.payment_method || "nao_informado",
        status: sourceTransaction.status || "pago",
        assignedPartnerCpf: resolvePartnerCpf(sourceTransaction.assigned_partner_name, sourceTransaction.assigned_partner_cpf),
        invoiceNumber: sourceTransaction.invoice_number || "",
        invoiceUrl: sourceTransaction.invoice_url || "",
      })
    }

    loadRelatedData()
  }, [transaction, isOpen, contasBancarias, clientId, partners, isAbastecimento, isExpense])

  const handleSave = async () => {
    if (!transaction) return

    if (!formData.paymentDate) {
      alert("Selecione uma data para o lançamento")
      return
    }

    const transactionType = transaction.tipo_referencia || transaction.transaction_type

    const selectedConta = contasBancarias.find((c) => c.id === formData.bankName)
    const bankNameResolved = selectedConta ? selectedConta.banco : formData.bankName || null

    const assignedPartner = formData.assignedPartnerCpf !== "none"
      ? partners.find((p) => p.cpf === formData.assignedPartnerCpf)
      : null

    const finalAssignedPartnerName = isAbastecimento
      ? assignedPartner?.nome || null
      : assignedPartner?.nome || (bankNameResolved ? bankNameResolved.toUpperCase() : null)

    try {
      await updateTransaction.mutateAsync({
        id: transaction.id,
        clientId,
        transactionType,
        description: formData.descricao,
        amount: formData.valor,
        paymentDate: formData.paymentDate,
        dueDate: formData.dueDate || null,
        notes: formData.notes || null,
        bankName: bankNameResolved,
        prazo: formData.prazo || null,
        category: formData.categoria || null,
        expenseType: formData.expenseType || null,
        supplierName: formData.supplierName || null,
        paymentMethod: formData.paymentMethod === "nao_informado" ? null : formData.paymentMethod || null,
        status: formData.status || null,
        assignedPartnerCpf: assignedPartner?.cpf || null,
        assignedPartnerName: finalAssignedPartnerName,
        invoiceNumber: formData.invoiceNumber || null,
        invoiceUrl: formData.invoiceUrl || null,
        referenceType: transaction.tipo_referencia || null,
        referenceId: transaction.referencia_id || null,
      })

      onClose()
    } catch (error) {
      console.error("Erro ao atualizar transação:", error)
    }
  }

  if (!transaction) return null

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
                        <span className="font-medium text-sm">{partner.nome}</span>
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
                value={formData.categoria}
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
                  {BANK_EXPENSE_CATEGORIES.map((cat) => (
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
            <Label htmlFor="descricao" className="text-sm font-medium">
              Descrição
            </Label>
            <Input
              id="descricao"
              placeholder="Ex: Depósito inicial, Combustível, etc"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="text-sm"
            />
          </div>

          {/* Valor + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor" className="text-sm font-medium">Valor (R$)</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.valor}
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
                type="data"
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
                  type="data"
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
                {isAbastecimento ? (
                  <Select
                    value={fuelSuppliers.find((f: any) => f.supplier_name === formData.supplierName)?.id || "manual"}
                    onValueChange={(v) => {
                      if (v === "manual") return;
                      const supplier = fuelSuppliers.find((f: any) => f.id === v);
                      setFormData({ ...formData, supplierName: supplier?.supplier_name || "" });
                    }}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Selecione o fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {fuelSuppliers.map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.supplier_name} - {f.cidade_name} ({f.icao_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Nome do fornecedor"
                    value={formData.supplierName}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    className="text-sm"
                  />
                )}
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
              <Label className="text-sm font-medium">Conta Bancaria</Label>
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