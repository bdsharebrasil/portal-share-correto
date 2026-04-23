import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, CreditCard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayExpenseDialog } from "./PayExpenseDialog";
import { EXPENSE_TYPES, type PartnerExpense, type PartnerAccount } from "@/hooks/useFinanceiroSocios";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "destructive" },
  paid: { label: "Pago", variant: "default" },
  cancelled: { label: "Cancelado", variant: "secondary" },
};

function ExpenseRow({ exp, accounts, onPay }: { exp: PartnerExpense; accounts: PartnerAccount[]; onPay: (e: PartnerExpense) => void }) {
  const st = statusMap[exp.status] || { label: exp.status, variant: "outline" as const };
  const typeLabel = EXPENSE_TYPES.find((t) => t.value === exp.tipo_despesa)?.label || exp.tipo_despesa;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
          <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
          {(exp as any).percentual_socio != null && Number((exp as any).percentual_socio) < 100 && (
            <Badge variant="secondary" className="text-xs">{Number((exp as any).percentual_socio).toFixed(0)}%</Badge>
          )}
        </div>
        <p className="text-sm font-medium text-foreground">{exp.descricao}</p>
        <p className="text-xs text-muted-foreground">
          {exp.nome_fornecedor && `${exp.nome_fornecedor} • `}
          {exp.data_vencimento && `Venc: ${format(new Date(exp.data_vencimento + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })} • `}
          {exp.nome_socio && `Pago por: ${exp.nome_socio}`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-bold text-foreground">{fmt(Number(exp.valor_total))}</span>
        {exp.status === "pending" && (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => onPay(exp)}>
            <CreditCard className="h-3 w-3" />
            Pagar
          </Button>
        )}
      </div>
    </div>
  );
}

export function ExpensesTable({ expenses, accounts, clienteId }: { expenses: PartnerExpense[]; accounts: PartnerAccount[]; clienteId: string }) {
  const [payExpense, setPayExpense] = useState<PartnerExpense | null>(null);

  const pending = expenses.filter((e) => e.status === "pending");
  const paid = expenses.filter((e) => e.status === "paid");

  return (
    <>
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" />
            Despesas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
              <TabsTrigger value="paid">Pagas ({paid.length})</TabsTrigger>
              <TabsTrigger value="all">Todas ({expenses.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="space-y-2 mt-3">
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma despesa pendente</p>
              ) : pending.map((e) => <ExpenseRow key={e.id} exp={e} accounts={accounts} onPay={setPayExpense} />)}
            </TabsContent>
            <TabsContent value="paid" className="space-y-2 mt-3">
              {paid.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma despesa paga</p>
              ) : paid.map((e) => <ExpenseRow key={e.id} exp={e} accounts={accounts} onPay={setPayExpense} />)}
            </TabsContent>
            <TabsContent value="all" className="space-y-2 mt-3">
              {expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma despesa</p>
              ) : expenses.map((e) => <ExpenseRow key={e.id} exp={e} accounts={accounts} onPay={setPayExpense} />)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <PayExpenseDialog
        expense={payExpense}
        accounts={accounts}
        clienteId={clienteId}
        open={!!payExpense}
        onOpenChange={(v) => !v && setPayExpense(null)}
      />
    </>
  );
}
