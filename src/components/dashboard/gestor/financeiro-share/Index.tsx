import React, { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowUp, 
  ArrowDown, 
  Wallet, 
  Users, 
  Settings, 
  Repeat, 
  Building2,
  AlertCircle,
  LucideIcon
} from "lucide-react";
import NFSaidaTab from "@/components/dashboard/gestor/financeiro-share/NFSaidaTab";
import GestaoFiscal from "@/components/dashboard/gestor/financeiro-share/GestaoFiscal";
import  ContasRecorrentesTab  from "@/components/dashboard/gestor/financeiro-share/ContasRecorrentesTab";
import { PagamentoSalarioTab } from "@/components/dashboard/gestor/financeiro-share/PagamentoSalarioTab";
import PrestadoresPJTab  from "@/components/dashboard/gestor/financeiro-share/PrestadoresPJTab";
import { ConfiguracoesFiscais } from "@/components/dashboard/gestor/financeiro-share/ConfiguracoesFiscais";
import { ContasPagar } from "@/components/dashboard/gestor/financeiro-share/ContasPagar";
import { ContasReceber } from "@/components/dashboard/gestor/financeiro-share/ContasReceber";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface Tab {
  value: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const allTabs: Tab[] = [
  {
    value: "fluxo",
    label: "Gestão Fiscal",
    icon: Wallet,
  },
  {
    value: "contas-recorrentes",
    label: "Contas Recorrentes",
    icon: Repeat,
  },
  {
    value: "pagamento-salario",
    label: "Salários CLT",
    icon: Users,
  },
  {
    value: "prestadores-pj",
    label: "Prestadores PJ",
    icon: Building2,
  },
  {
    value: "saida",
    label: "NF Saída",
    icon: ArrowUp,
  },
  {
    value: "contas-pagar",
    label: "Contas a Pagar",
    icon: ArrowUp,
  },
  {
    value: "contas-receber",
    label: "Contas a Receber",
    icon: ArrowDown,
  },
  {
    value: "configuracoes",
    label: "Configurações",
    icon: Settings,
    adminOnly: true,
  },
];

export default function GestaoFiscalIndex() {
  const navigate = useNavigate();
  
  const {
    isAdmin,
    isGestorMaster,
    isFinanceiroMaster
  } = useUserRole();
  
  const isAuthorized = isAdmin || isGestorMaster || isFinanceiroMaster;

  // Filtrar abas baseado em permissões
  const tabs = useMemo(() => {
    return allTabs.filter(tab => {
      if (tab.adminOnly) {
        return isAdmin || isFinanceiroMaster || isGestorMaster;
      }
      return true;
    });
  }, [isAdmin, isFinanceiroMaster, isGestorMaster]);

  if (!isAuthorized) {
    return (
      <Layout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-slate-50"
        >
          <Card className="border-red-200 bg-white shadow-sm max-w-md w-full">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">Acesso Restrito</p>
                <p className="text-sm text-slate-500 mt-1">Você não tem permissão para acessar este módulo. Contate um administrador.</p>
              </div>
              <Button onClick={() => navigate(-1)} variant="outline" className="mt-4 text-xs font-semibold">
                Voltar
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col w-full min-h-screen bg-[#01050a] mx-[7px] -my-2 px-0 py-0 font-sans">
        {/* Main Tabs Component */}
        <Tabs defaultValue="fluxo" className="flex flex-col w-full flex-1">
          
          {/* Desktop Tab Navigation (Pill Style) */}
          <div className="w-full hidden xl:block mb-6">
            <TabsList className="h-auto p-1 bg-slate-200/60 rounded-xl border border-slate-200 flex justify-start gap-1 overflow-x-auto scrollbar-hide shadow-inner">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-lg py-2 px-4 text-[13px] font-semibold transition-all whitespace-nowrap flex items-center gap-2
                      data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-slate-700 data-[state=inactive]:hover:bg-slate-300/50
                      data-[state=active]:bg-white data-[state=active]:text-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200"
                  >
                    <IconComponent className="w-3.5 h-3.5 opacity-70" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Tab Content Areas */}
          <div className="w-full flex-1">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <TabsContent value="fluxo" className="mt-0 h-full focus-visible:outline-none">
                <GestaoFiscal />
              </TabsContent>

              <TabsContent value="contas-recorrentes" className="mt-0 h-full focus-visible:outline-none">
                <ContasRecorrentesTab />
              </TabsContent>

              <TabsContent value="pagamento-salario" className="mt-0 h-full focus-visible:outline-none">
                <PagamentoSalarioTab />
              </TabsContent>

              <TabsContent value="prestadores-pj" className="mt-0 h-full focus-visible:outline-none">
                <PrestadoresPJTab />
              </TabsContent>

              <TabsContent value="saida" className="mt-0 h-full focus-visible:outline-none">
                <NFSaidaTab />
              </TabsContent>

              <TabsContent value="contas-pagar" className="mt-0 h-full focus-visible:outline-none">
                <ContasPagar />
              </TabsContent>

              <TabsContent value="contas-receber" className="mt-0 h-full focus-visible:outline-none">
                <ContasReceber />
              </TabsContent>

              <TabsContent value="configuracoes" className="mt-0 h-full focus-visible:outline-none">
                <ConfiguracoesFiscais />
              </TabsContent>
            </motion.div>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
}
