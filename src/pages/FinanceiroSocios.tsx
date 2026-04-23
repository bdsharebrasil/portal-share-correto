"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Layout } from "@/components/layout/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, ArrowRight, Loader2, Users, Building2, BarChart3 } from "lucide-react"

// Componentes
import { PartnerCards } from "@/components/dashboard/gestor/socios/PartnerCards"
import { TransactionsTable } from "@/components/dashboard/gestor/socios/TransactionsTable"
import { DepositForm } from "@/components/dashboard/gestor/socios/DepositForm"
import { ExpenseForm } from "@/components/dashboard/gestor/socios/ExpenseForm"

// Hooks
import { useSocioAccounts, useSocioTransactions } from "@/hooks/useFinanceiroSocios"
import { useClientesComSocios } from "@/hooks/useSocioBalanco"
import { useClientPartners } from "@/hooks/useClientPartners"

export default function FinanceiroSocios() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState("")
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null)

  // Restaurar cliente selecionado se voltando do relatório
  useEffect(() => {
    const state = location.state as any
    if (state?.selectedClientId) {
      setClienteSelecionado(state.selectedClientId)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location, navigate])

  // ========================
  // CARREGAMENTO DE DADOS
  // ========================

  const { data: clientesComSocios = [], isLoading: loadingClientes } = useClientesComSocios()
  const { data: accounts = [], isLoading: loadingAccounts } = useSocioAccounts(clienteSelecionado)
  const { data: partners = [], isLoading: loadingPartners } = useClientPartners(clienteSelecionado)
  const { data: transactions = [], isLoading: loadingTransactions } = useSocioTransactions(clienteSelecionado)

  // ========================
  // COMPUTAÇÕES
  // ========================

  const clientesComPartners = useMemo(
    () => clientesComSocios.filter((cliente) => cliente.socios && cliente.socios.length > 0),
    [clientesComSocios]
  )

  const clientesFiltrados = useMemo(
    () => clientesComPartners.filter((cliente) =>
      cliente.razao_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.proprietario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.cnpj?.includes(searchTerm)
    ),
    [clientesComPartners, searchTerm]
  )

  const selectedClientData = useMemo(
    () => clientesComSocios.find((c) => c.id === clienteSelecionado),
    [clientesComSocios, clienteSelecionado]
  )

  const isDashboardLoading = clienteSelecionado && (loadingAccounts || loadingPartners || loadingTransactions)

  // ========================
  // TELA DE SELEÇÃO
  // ========================

  if (!clienteSelecionado) {
    return (
      <Layout>
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Financeiro de Sócios</h1>
            <p className="text-base text-muted-foreground">
              Selecione um cliente para visualizar dados de balanço e sócios
            </p>
          </div>

          {/* Barra de Busca */}
          <Card className="border border-border bg-background">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Buscar Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, proprietário ou CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background border-border"
                />
              </div>
            </CardContent>
          </Card>

          {/* Grid de Clientes */}
          {loadingClientes ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="border border-border bg-background">
                  <CardHeader>
                    <div className="h-5 bg-muted rounded w-3/4 animate-pulse" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="h-4 bg-muted rounded w-full animate-pulse" />
                    <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
                    <div className="h-10 bg-muted rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientesFiltrados.map((cliente) => (
                <ClienteCard
                  key={cliente.id}
                  cliente={cliente}
                  onSelect={() => setClienteSelecionado(cliente.id)}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loadingClientes && clientesFiltrados.length === 0 && (
            <Card className="border border-border bg-background">
              <CardContent className="pt-16 pb-16 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente com sócios"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  {searchTerm
                    ? "Tente ajustar sua busca com um nome ou CNPJ diferente"
                    : "Não há clientes com sócios registrados no sistema"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    )
  }

  // ========================
  // LOADING DO DASHBOARD
  // ========================

  if (isDashboardLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Carregando dados...</p>
          </div>
        </div>
      </Layout>
    )
  }

  // ========================
  // DASHBOARD
  // ========================

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header do Dashboard */}
        <DashboardHeader
          cliente={selectedClientData}
          onBack={() => setClienteSelecionado(null)}
        />

        {/* Ações Rápidas */}
        <div className="flex flex-col sm:flex-row gap-3">
          <DepositForm accounts={accounts} clienteId={clienteSelecionado} />
          <ExpenseForm clienteId={clienteSelecionado} />
          <Button
            onClick={() => navigate(`/financeiro/relatorio-mensal/${clienteSelecionado}`)}
            className="gap-2"
            size="sm"
          >
            <BarChart3 className="h-4 w-4" />
            Relatório Mensal
          </Button>
        </div>

        {/* Cards de Resumo dos Sócios */}
        <PartnerCards
          accounts={accounts}
          transactions={transactions}
          clienteId={clienteSelecionado}
        />

        {/* Transações Recentes */}
        {!loadingTransactions && transactions.length > 0 && (
          <TransactionsTable
            transactions={transactions}
            limit={5}
            clienteId={clienteSelecionado}
            clienteName={selectedClientData?.razao_social || selectedClientData?.proprietario || "Cliente"}
          />
        )}
      </div>
    </Layout>
  )
}

// ========================
// COMPONENTES AUXILIARES
// ========================

interface ClienteCardProps {
  cliente: any
  onSelect: () => void
}

function ClienteCard({ cliente, onSelect }: ClienteCardProps) {
  return (
    <Card className="border border-border bg-background hover:border-primary/30 transition-colors duration-200 group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate group-hover:text-primary transition-colors">
              {cliente.razao_social || cliente.proprietario}
            </CardTitle>
            {cliente.cnpj && (
              <p className="text-xs text-muted-foreground mt-1.5">CNPJ: {cliente.cnpj}</p>
            )}
          </div>
          <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0 opacity-60" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sócios */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Sócios ({cliente.socios.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {cliente.socios.slice(0, 3).map((socio: any) => (
              <Badge
                key={socio.id}
                variant="secondary"
                className="text-xs font-normal bg-muted/50"
              >
                <span className="truncate">{socio.nome}</span>
                <span className="ml-2 font-semibold">{socio.percentual?.toFixed(1)}%</span>
              </Badge>
            ))}
            {cliente.socios.length > 3 && (
              <Badge variant="secondary" className="text-xs bg-muted/50">
                +{cliente.socios.length - 3} mais
              </Badge>
            )}
          </div>
        </div>

        {/* Botão de Seleção */}
        <Button
          onClick={onSelect}
          className="w-full mt-2"
          size="sm"
        >
          <span>Acessar</span>
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  )
}

interface DashboardHeaderProps {
  cliente?: any
  onBack: () => void
}

function DashboardHeader({ cliente, onBack }: DashboardHeaderProps) {
  const clientName = cliente?.razao_social || cliente?.proprietario || "Cliente"
  const clientCnpj = cliente?.cnpj

  return (
    <div className="border-b border-border pb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">{clientName}</h1>
          {clientCnpj && (
            <p className="text-sm text-muted-foreground">CNPJ: {clientCnpj}</p>
          )}
        </div>

        <Button
          onClick={onBack}
          variant="outline"
          size="sm"
          className="w-fit"
        >
          ← Voltar
        </Button>
      </div>
    </div>
  )
}
