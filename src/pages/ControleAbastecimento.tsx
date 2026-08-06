import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupplierDirectory } from "@/components/Abastecimento/SupplierDirectory";
import { ClientFuelRecords } from "@/components/Abastecimento/ClientFuelRecords";
import { Fuel, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ControleAbastecimento() {
  const location = useLocation();
  const navigationState = location.state as any || {};
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
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
             
              <h1 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-foreground">
                Controle de Abastecimento
              </h1>
              <p className="text-sm text-muted-foreground">
                Histórico de consumo, notas, comandas e pagamentos realizados
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b border-border/60 bg-transparent p-0">
            <TabsTrigger
              value="records"
              className="gap-2 rounded-[0.65rem] border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <Users className="h-4 w-4" />
              Histórico de Abastecimentos
            </TabsTrigger>
            <TabsTrigger
              value="suppliers"
              className="gap-2 rounded-[0.65rem] border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <Fuel className="h-4 w-4" />
              Fornecedores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suppliers" className="mt-8">
            <SupplierDirectory />
          </TabsContent>

          <TabsContent value="records" className="mt-8">
            <ClientFuelRecords selectedAbastecimentoId={selectedAbastecimentoId} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}