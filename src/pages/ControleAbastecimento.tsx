import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupplierDirectory } from "@/components/fuel/SupplierDirectory";
import { ClientFuelRecords } from "@/components/fuel/ClientFuelRecords";
import { PartnerExpenseReport } from "@/components/reports/PartnerExpenseReport";
import { Fuel, Users, BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ControleAbastecimento() {
  const location = useLocation();
  const navigationState = (location.state as any) || {};
  const [selectedAbastecimentoId, setSelectedAbastecimentoId] = useState<string | null>(
    navigationState.selectedAbastecimentoId || null
  );
  const [activeTab, setActiveTab] = useState("records");

  // Se foi navegado de RelatorioMensal com um abastecimento específico, abrir a aba de registros
  useEffect(() => {
    if (selectedAbastecimentoId) {
      setActiveTab("records");
    }
  }, [selectedAbastecimentoId]);

  return (
    <Layout>
      <div className="p-6 space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
              <Fuel className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Controle de Abastecimento
            </h1>
          </div>
          <p className="text-muted-foreground ml-12 text-base">
            Gerencie fornecedores, rastreie consumo de combustível e mantenha registros detalhados de abastecimento
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl bg-muted/50 p-1 rounded-lg">
            <TabsTrigger value="suppliers" className="gap-2 text-base">
              <Fuel className="h-4 w-4" />
              Fornecedores
            </TabsTrigger>
            <TabsTrigger value="records" className="gap-2 text-base">
              <Users className="h-4 w-4" />
              Registros por Cliente
            </TabsTrigger>
            <TabsTrigger value="partner-report" className="gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Relatório Sócios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suppliers" className="mt-8">
            <SupplierDirectory />
          </TabsContent>

          <TabsContent value="records" className="mt-8">
            <ClientFuelRecords selectedAbastecimentoId={selectedAbastecimentoId} />
          </TabsContent>

          <TabsContent value="partner-report" className="mt-8">
            <PartnerExpenseReport />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
