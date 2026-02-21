
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransacoesTab } from "./TransacoesTab";
import { ContasPagarTab } from "./ContasPagarTab";
import { ContasReceberTab } from "./ContasReceberTab";
import { QuadroMensalTab } from "./QuadroMensalTab";

export function Financeiro() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Financeiro</h1>
        <p className="text-gray-400 mt-1">Controle completo das suas finanças</p>
      </div>

      <Tabs defaultValue="transacoes" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800 border-gray-700">
          <TabsTrigger value="transacoes" className="data-[state=active]:bg-blue-600">
            Transações
          </TabsTrigger>
          <TabsTrigger value="contas-pagar" className="data-[state=active]:bg-blue-600">
            Contas a Pagar
          </TabsTrigger>
          <TabsTrigger value="contas-receber" className="data-[state=active]:bg-blue-600">
            Contas a Receber
          </TabsTrigger>
          <TabsTrigger value="quadro-mensal" className="data-[state=active]:bg-blue-600">
            Quadro Mensal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transacoes">
          <TransacoesTab />
        </TabsContent>

        <TabsContent value="contas-pagar">
          <ContasPagarTab />
        </TabsContent>

        <TabsContent value="contas-receber">
          <ContasReceberTab />
        </TabsContent>

        <TabsContent value="quadro-mensal">
          <QuadroMensalTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
