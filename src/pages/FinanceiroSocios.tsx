import React, { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Loader2, Users, Search, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Componentes ajustados para o contexto de Socios
import { PartnerCards } from "@/components/socios/PartnerCards";
import { DepositForm } from "@/components/socios/DepositForm";
import { ExpenseForm } from "@/components/socios/ExpenseForm";
import { TransactionsTable } from "@/components/socios/TransactionsTable";
import { ExpensesTable } from "@/components/socios/ExpensesTable";

// Hooks ajustados
import { useSocioAccounts, useSocioTransactions, useSocioExpenses } from "@/hooks/useFinanceiroSocios";
import { useClientesComSocios } from "@/hooks/useSocioBalanco";

export default function FinanceiroSocios() {
  const [searchTerm, setSearchTerm] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null);

  // 1. Carregar lista de clientes (Sempre carregado para a seleção)
  const { data: clientesComSocios = [], isLoading: loadingClientes } = useClientesComSocios();

  // 2. Carregar dados financeiros APENAS se houver um cliente selecionado
  // Passamos o ID do cliente para os hooks filtrarem os dados
  const { data: accounts = [], isLoading: loadingAccounts } = useSocioAccounts(clienteSelecionado);
  const { data: transactions = [], isLoading: loadingTx } = useSocioTransactions(clienteSelecionado);
  const { data: expenses = [], isLoading: loadingExp } = useSocioExpenses(clienteSelecionado);

  // Filtrar apenas clientes que têm partners configurados
  const clientesComPartners = clientesComSocios.filter(cliente =>
    cliente.socios && cliente.socios.length > 0
  );

  // Filtrar lista de seleção por termo de busca
  const clientesFiltrados = clientesComPartners.filter(cliente =>
    cliente.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.proprietario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.cnpj?.includes(searchTerm)
  );

  // Encontrar o objeto do cliente selecionado para exibir no Header
  const selectedClientData = clientesComSocios.find(c => c.id === clienteSelecionado);

  const isDashboardLoading = clienteSelecionado && (loadingAccounts || loadingTx || loadingExp);

  // --- TELA DE SELEÇÃO DE CLIENTE ---
  if (!clienteSelecionado) {
    return (
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Financeiro Sócios</h1>
            <p className="text-lg text-muted-foreground">
              Selecione um cliente para visualizar os dados de balanço e sócios
            </p>
          </div>

          {/* Search */}
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Buscar Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF/CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Grid de Clientes */}
          {loadingClientes ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {[...Array(6)].map((_, i) => (
               <Card key={i} className="border-border/50 bg-card/60">
                 <CardHeader>
                   <div className="h-6 bg-muted rounded w-3/4 animate-pulse" />
                 </CardHeader>
                 <CardContent>
                   <div className="space-y-3">
                     <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
                     <div className="h-10 bg-muted rounded animate-pulse" />
                   </div>
                 </CardContent>
               </Card>
             ))}
           </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientesFiltrados.map((cliente) => (
                <Card
                  key={cliente.id}
                  className="border-border/50 bg-card/60 backdrop-blur-sm hover:bg-card/80 transition-colors cursor-pointer group"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate group-hover:text-primary transition-colors">
                          {cliente.company_name || cliente.proprietario}
                        </CardTitle>
                        {cliente.cnpj && (
                          <p className="text-xs text-muted-foreground mt-1">
                            CNPJ: {cliente.cnpj}
                          </p>
                        )}
                      </div>
                      <Users className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Lista de Sócios (Badges) */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Sócios</p>
                      <div className="flex flex-wrap gap-2">
                        {cliente.socios.map((socio: any) => (
                          <Badge
                            key={socio.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            <span className="truncate">{socio.nome}</span>
                            <span className="ml-1 font-semibold">{socio.percentual?.toFixed(1)}%</span>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Footer do Card */}
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-3">
                        {cliente.socios.length} sócio{cliente.socios.length > 1 ? 's' : ''} registrado{cliente.socios.length > 1 ? 's' : ''}
                      </p>

                      <Button
                        onClick={() => setClienteSelecionado(cliente.id)}
                        className="w-full group/btn"
                        size="sm"
                      >
                        <span>Selecionar</span>
                        <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loadingClientes && clientesFiltrados.length === 0 && (
            <Card className="border-border/50 bg-card/60">
              <CardContent className="pt-12 pb-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente com sócios'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {searchTerm
                    ? 'Tente ajustar sua busca'
                    : 'Não há clientes com sócios registrados no sistema'
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    );
  }

  // --- LOADER DO DASHBOARD ---
  if (isDashboardLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // --- DASHBOARD DO CLIENTE ---
  return (
    <Layout>
      <div className="space-y-6">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Painel Financeiro</h1>
              <p className="text-sm text-muted-foreground">
                {selectedClientData?.company_name || selectedClientData?.proprietario || 'Cliente'} 
                {selectedClientData?.cnpj ? ` • ${selectedClientData.cnpj}` : ''}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
             <Button
              variant="outline"
              onClick={() => setClienteSelecionado(null)}
              size="sm"
            >
              ← Voltar para Seleção
            </Button>
            {/* Formulários recebem o clienteId e as contas carregadas */}
            <DepositForm accounts={accounts} clienteId={clienteSelecionado} />
            <ExpenseForm clienteId={clienteSelecionado} />
          </div>
        </div>

        {/* Cards de Resumo dos Sócios */}
        <PartnerCards accounts={accounts} />

        {/* Tabs de Conteúdo */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="deposits">Depósitos</TabsTrigger>
            <TabsTrigger value="expenses">Despesas</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TransactionsTable 
                transactions={transactions} 
                title="Últimas 5 Transações" 
                limit={5} 
              />
              <ExpensesTable 
                expenses={expenses.filter((e) => e.status === "pending").slice(0, 5)} 
                accounts={accounts} 
              />
            </div>
          </TabsContent>

          <TabsContent value="deposits" className="mt-4">
            <TransactionsTable
              transactions={transactions.filter((t) => t.transaction_type === "deposit")}
              title="Histórico de Depósitos"
            />
          </TabsContent>

          <TabsContent value="expenses" className="mt-4">
            <ExpensesTable expenses={expenses} accounts={accounts} />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <TransactionsTable transactions={transactions} title="Todas as Transações" />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
