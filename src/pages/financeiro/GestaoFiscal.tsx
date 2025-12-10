import React from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, ArrowUp, ArrowDown, Wallet, Calendar, Users, DollarSign, Receipt, Settings, Repeat } from "lucide-react";
import { NotasFiscaisSaida } from "@/components/fiscal/NotasFiscaisSaida";
import { FluxoCaixa } from "@/components/fiscal/FluxoCaixa";
import { ContasRecorrentesTab } from "@/components/fiscal/ContasRecorrentesTab";
import { PagamentoSalarioTab } from "@/components/fiscal/PagamentoSalarioTab";
import { ConfiguracoesFiscais } from "@/components/fiscal/ConfiguracoesFiscais";
import { ContasPagar } from "@/components/fiscal/ContasPagar";
import { ContasReceber } from "@/components/fiscal/ContasReceber";
import { useUserRole } from "@/hooks/useUserRole";
export default function GestaoFiscal() {
  const {
    isAdmin,
    isGestorMaster,
    isFinanceiroMaster
  } = useUserRole();
  const isAuthorized = isAdmin || isGestorMaster || isFinanceiroMaster;
  if (!isAuthorized) {
    return <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-destructive font-semibold">Acesso negado</p>
              <p className="text-sm text-muted-foreground mt-2">Você não tem permissão para acessar esta página.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>;
  }
  return <Layout>
      <div className="min-h-[calc(100vh-4rem)] flex-col bg-background flex items-start justify-center mb-[3px] pb-[19px] mt-0 my-[10px] py-0">
        {/* Header */}
        <div className="space-y-6 pb-8 mb-[80px] my-0 py-[2px]">
          <div className="flex items-center justify-between py-0 my-0 px-[13px]">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/15 to-primary/5 border border-primary/30 shadow-lg shadow-primary/10">
                <DollarSign className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Gestão Fiscal e Financeira</h1>
                <p className="text-sm text-muted-foreground mt-1">Controle completo de caixa, notas fiscais e pagamentos</p>
              </div>
            </div>
          </div>

          {/* Tabs Container */}
          <Tabs defaultValue="fluxo" className="flex flex-col">
            {/* Modern Tab Navigation */}
            <div className="w-full">
              <TabsList className="bg-gradient-to-r from-card/80 to-card/40 backdrop-blur-xl rounded-2xl p-2 border border-border/40 shadow-lg w-full inline-flex flex-wrap gap-2 h-auto justify-start">
                <TabsTrigger value="fluxo" className="rounded-lg py-2.5 px-4 text-sm font-medium transition-all duration-300
                    data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/40
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/95 data-[state=active]:to-primary/85 data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/30">
                  <Wallet className="w-4 h-4 mr-2" />
                  Fluxo de Caixa
                </TabsTrigger>

                <TabsTrigger value="contas-recorrentes" className="rounded-lg py-2.5 px-4 text-sm font-medium transition-all duration-300
                    data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/40
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600/95 data-[state=active]:to-emerald-500/85 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-emerald-500/30">
                  <Repeat className="w-4 h-4 mr-2" />
                  Contas Recorrentes
                </TabsTrigger>

                <TabsTrigger value="pagamento-salario" className="rounded-lg py-2.5 px-4 text-sm font-medium transition-all duration-300
                    data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/40
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600/95 data-[state=active]:to-emerald-500/85 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-emerald-500/30">
                  <Users className="w-4 h-4 mr-2" />
                  Salários
                </TabsTrigger>

                <TabsTrigger value="saida" className="rounded-lg py-2.5 px-4 text-sm font-medium transition-all duration-300
                    data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/40
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-600/95 data-[state=active]:to-sky-500/85 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-sky-500/30">
                  <ArrowUp className="w-4 h-4 mr-2" />
                  NF Saída
                </TabsTrigger>

                <TabsTrigger value="contas-pagar" className="rounded-lg py-2.5 px-4 text-sm font-medium transition-all duration-300
                    data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/40
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600/95 data-[state=active]:to-blue-500/85 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-blue-500/30">
                  <ArrowUp className="w-4 h-4 mr-2" />
                  Contas a Pagar
                </TabsTrigger>

                <TabsTrigger value="contas-receber" className="rounded-lg py-2.5 px-4 text-sm font-medium transition-all duration-300
                    data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/40
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600/95 data-[state=active]:to-purple-500/85 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/30">
                  <ArrowDown className="w-4 h-4 mr-2" />
                  Contas a Receber
                </TabsTrigger>

                <TabsTrigger value="configuracoes" className="rounded-lg py-2.5 px-4 text-sm font-medium transition-all duration-300
                    data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/40
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-600/95 data-[state=active]:to-slate-500/85 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-slate-500/30">
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Content */}
            <div className="flex-1 pt-6">
              <TabsContent value="fluxo" className="mt-0">
                <FluxoCaixa />
              </TabsContent>

              <TabsContent value="contas-recorrentes" className="mt-0">
                <ContasRecorrentesTab />
              </TabsContent>

              <TabsContent value="pagamento-salario" className="mt-0">
                <PagamentoSalarioTab />
              </TabsContent>

              <TabsContent value="saida" className="mt-0">
                <NotasFiscaisSaida />
              </TabsContent>

              <TabsContent value="contas-pagar" className="mt-0">
                <ContasPagar />
              </TabsContent>

              <TabsContent value="contas-receber" className="mt-0">
                <ContasReceber />
              </TabsContent>

              <TabsContent value="configuracoes" className="mt-0">
                <ConfiguracoesFiscais className="py-[23px]" />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </Layout>;
}