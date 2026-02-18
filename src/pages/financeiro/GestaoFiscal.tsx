import React, { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, ArrowUp, ArrowDown, Wallet, Calendar, Users, DollarSign, Receipt, Settings, Repeat, ArrowLeft, Building2, Menu, AlertCircle } from "lucide-react";
import { NotasFiscaisSaida } from "@/components/fiscal/NotasFiscaisSaida";
import { FluxoCaixa } from "@/components/fiscal/FluxoCaixa";
import { ContasRecorrentesTab } from "@/components/fiscal/ContasRecorrentesTab";
import { PagamentoSalarioTab } from "@/components/fiscal/PagamentoSalarioTab";
import { PrestadoresServicoTab } from "@/components/fiscal/PrestadoresServicoTab";
import { ConfiguracoesFiscais } from "@/components/fiscal/ConfiguracoesFiscais";
import { ContasPagar } from "@/components/fiscal/ContasPagar";
import { ContasReceber } from "@/components/fiscal/ContasReceber";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const tabs = [
  {
    value: "fluxo",
    label: "Fluxo de Caixa",
    icon: Wallet,
    color: "from-primary/95 to-primary/85",
  },
  {
    value: "contas-recorrentes",
    label: "Contas Recorrentes",
    icon: Repeat,
    color: "from-emerald-600/95 to-emerald-500/85",
  },
  {
    value: "pagamento-salario",
    label: "Salários CLT",
    icon: Users,
    color: "from-emerald-600/95 to-emerald-500/85",
  },
  {
    value: "prestadores-pj",
    label: "Prestadores PJ",
    icon: Building2,
    color: "from-orange-600/95 to-orange-500/85",
  },
  {
    value: "saida",
    label: "NF Saída",
    icon: ArrowUp,
    color: "from-sky-600/95 to-sky-500/85",
  },
  {
    value: "contas-pagar",
    label: "Contas a Pagar",
    icon: ArrowUp,
    color: "from-blue-600/95 to-blue-500/85",
  },
  {
    value: "contas-receber",
    label: "Contas a Receber",
    icon: ArrowDown,
    color: "from-purple-600/95 to-purple-500/85",
  },
  {
    value: "configuracoes",
    label: "Configurações",
    icon: Settings,
    color: "from-slate-600/95 to-slate-500/85",
  },
];

export default function GestaoFiscal() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {
    isAdmin,
    isGestorMaster,
    isFinanceiroMaster
  } = useUserRole();
  const isAuthorized = isAdmin || isGestorMaster || isFinanceiroMaster;

  if (!isAuthorized) {
    return <Layout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center min-h-[calc(100vh-4rem)]"
        >
          <Card className="border-destructive/50 bg-gradient-to-br from-destructive/10 to-destructive/5 backdrop-blur-sm max-w-md">
            <CardContent className="pt-8">
              <div className="space-y-3 text-center">
                <div className="inline-flex p-3 rounded-xl bg-destructive/20 border border-destructive/30">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <p className="text-lg font-semibold text-destructive">Acesso Negado</p>
                <p className="text-sm text-muted-foreground">Você não tem permissão para acessar este módulo. Contate um administrador.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </Layout>;
  }

  return <Layout>
    <div className="flex flex-col bg-background w-full min-h-full px-3 sm:px-4 lg:px-6 py-4 lg:py-6 space-y-6">
      {/* Back Button with Animation */}
      <motion.button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-foreground/70 hover:text-primary transition-colors group w-fit"
        whileHover={{ x: -4 }}
        whileTap={{ scale: 0.95 }}
      >
        <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Voltar</span>
      </motion.button>

      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 pb-4 w-full"
      >
        <div className="flex items-center justify-between w-full flex-wrap gap-4">
          <div className="flex items-center gap-3 lg:gap-4 flex-1 min-w-0">
            {/* Icon Badge */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex-shrink-0 shadow-lg shadow-primary/10">
              <DollarSign className="w-6 h-6 lg:w-7 lg:h-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
                Gestão Fiscal
              </h1>
              <p className="text-sm text-foreground/60 mt-1 hidden sm:block">
                Controle completo de caixa, notas fiscais e pagamentos
              </p>
            </div>
          </div>
        </div>

        {/* Tabs Container */}
        <Tabs defaultValue="fluxo" className="flex flex-col w-full">
          {/* Desktop Tab Navigation */}
          <div className="w-full hidden sm:block">
            <TabsList className="bg-gradient-to-r from-white/5 to-white/[0.02] backdrop-blur-xl rounded-xl p-2 border border-white/10 shadow-lg w-full justify-start overflow-x-auto h-auto gap-2">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-lg py-2.5 px-4 text-sm font-medium transition-all duration-300 whitespace-nowrap
                      data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-white/10
                      data-[state=active]:bg-gradient-to-r data-[state=active]:text-white data-[state=active]:shadow-md"
                  >
                    <IconComponent className="w-4 h-4 mr-2" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Mobile Menu */}
          <div className="sm:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 w-full">
                  <Menu className="w-4 h-4" />
                  Selecionar Seção
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px]">
                <div className="space-y-2 mt-6">
                  {tabs.map((tab) => {
                    const IconComponent = tab.icon;
                    return (
                      <button
                        key={tab.value}
                        onClick={() => {
                          const trigger = document.querySelector(
                            `[data-value="${tab.value}"]`
                          ) as HTMLElement;
                          trigger?.click();
                          setMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left text-sm font-medium text-foreground/80 hover:text-foreground"
                      >
                        <IconComponent className="w-4 h-4 flex-shrink-0" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Tab Content */}
          <div className="w-full pt-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <TabsContent value="fluxo" className="mt-0 w-full">
                <FluxoCaixa />
              </TabsContent>

              <TabsContent value="contas-recorrentes" className="mt-0">
                <ContasRecorrentesTab />
              </TabsContent>

              <TabsContent value="pagamento-salario" className="mt-0">
                <PagamentoSalarioTab />
              </TabsContent>

              <TabsContent value="prestadores-pj" className="mt-0">
                <PrestadoresServicoTab />
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
                <ConfiguracoesFiscais />
              </TabsContent>
            </motion.div>
          </div>
        </Tabs>
      </motion.div>
    </div>
  </Layout>;
}
