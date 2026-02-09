import React, { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Loader2, Users, Search, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DGAPartnerCards } from "@/components/dga/DGAPartnerCards";
import { DGADepositForm } from "@/components/dga/DGADepositForm";
import { DGAExpenseForm } from "@/components/dga/DGAExpenseForm";
import { DGATransactionsTable } from "@/components/dga/DGATransactionsTable";
import { DGAExpensesTable } from "@/components/dga/DGAExpensesTable";
import { useDGAAccounts, useDGATransactions, useDGAExpenses } from "@/hooks/useDGAFinanceiro";
import { useClientesComSocios } from "@/hooks/useSocioBalanco";

export default function FinanceiroDGA() {
  const [searchTerm, setSearchTerm] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null);

  const { data: accounts = [], isLoading: loadingAccounts } = useDGAAccounts();
  const { data: transactions = [], isLoading: loadingTx } = useDGATransactions();
  const { data: expenses = [], isLoading: loadingExp } = useDGAExpenses();

  // Carregar clientes com sócios
  const { data: clientesComSocios = [], isLoading: loadingClientes } = useClientesComSocios();

  // Filtrar apenas clientes que têm partners
  const clientesComPartners = clientesComSocios.filter(cliente =>
    cliente.socios && cliente.socios.length > 0
  );

  // Filtrar por termo de busca
  const clientesFiltrados = clientesComPartners.filter(cliente =>
    cliente.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.proprietario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.cnpj?.includes(searchTerm)
  );

  const isLoading = loadingAccounts || loadingTx || loadingExp;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Painel Financeiro DGA</h1>
              <p className="text-sm text-muted-foreground">Aeronave PR-LRM • DGA ADMINISTRADORA</p>
            </div>
          </div>
          <div className="flex gap-2">
            <DGADepositForm accounts={accounts} />
            <DGAExpenseForm />
          </div>
        </div>

        <DGAPartnerCards accounts={accounts} />

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="deposits">Depósitos</TabsTrigger>
            <TabsTrigger value="expenses">Despesas</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DGATransactionsTable transactions={transactions} title="Últimas 5 Transações" limit={5} />
              <DGAExpensesTable expenses={expenses.filter((e) => e.status === "pending").slice(0, 5)} accounts={accounts} />
            </div>
          </TabsContent>

          <TabsContent value="deposits" className="mt-4">
            <DGATransactionsTable
              transactions={transactions.filter((t) => t.transaction_type === "deposit")}
              title="Histórico de Depósitos"
            />
          </TabsContent>

          <TabsContent value="expenses" className="mt-4">
            <DGAExpensesTable expenses={expenses} accounts={accounts} />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <DGATransactionsTable transactions={transactions} title="Todas as Transações" />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
