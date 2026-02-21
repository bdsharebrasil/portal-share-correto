import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, BarChart3, FileText, Download, TrendingUp } from "lucide-react";
import { RelatoriosAvancados } from "@/components/relatorios/RelatoriosAvancados";
import { RelatorioDRE } from "@/components/relatorios/RelatorioDRE";
import { RelatorioFluxoCaixa } from "@/components/relatorios/RelatorioFluxoCaixa";
import { RelatorioBalancete } from "@/components/relatorios/RelatorioBalancete";
import { RelatorioCentroCusto } from "@/components/relatorios/RelatorioCentroCusto";

type RelatorioAtivo = "lista" | "dre" | "fluxo-caixa" | "balancete" | "centro-custo";

const RelatoriosPage = () => {
  const [relatorioAtivo, setRelatorioAtivo] = useState<RelatorioAtivo>("lista");

  const reports = [
    {
      id: "dre" as const,
      title: "Demonstração de Resultado",
      description: "DRE completo com análise de receitas e despesas",
      icon: PieChart,
      color: "bg-blue-500"
    },
    {
      id: "fluxo-caixa" as const,
      title: "Fluxo de Caixa",
      description: "Análise detalhada do fluxo de caixa mensal",
      icon: BarChart3,
      color: "bg-green-500"
    },
    {
      id: "balancete" as const,
      title: "Balancete Mensal",
      description: "Relatório completo de contas e saldos",
      icon: FileText,
      color: "bg-purple-500"
    },
    {
      id: "centro-custo" as const,
      title: "Análise por Centro de Custo",
      description: "Distribuição de custos por centro",
      icon: TrendingUp,
      color: "bg-orange-500"
    }
  ];

  const handleBack = () => setRelatorioAtivo("lista");

  const renderRelatorioAtivo = () => {
    switch (relatorioAtivo) {
      case "dre":
        return <RelatorioDRE onBack={handleBack} />;
      case "fluxo-caixa":
        return <RelatorioFluxoCaixa onBack={handleBack} />;
      case "balancete":
        return <RelatorioBalancete onBack={handleBack} />;
      case "centro-custo":
        return <RelatorioCentroCusto onBack={handleBack} />;
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Relatórios</h1>
          <p className="text-gray-400 mt-1">Acesse e gere relatórios financeiros detalhados</p>
        </div>

        <Tabs defaultValue="relatorios-avancados" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800 border-gray-700">
            <TabsTrigger value="relatorios-avancados" className="data-[state=active]:bg-blue-600">
              Relatórios Avançados
            </TabsTrigger>
            <TabsTrigger value="relatorios-predefinidos" className="data-[state=active]:bg-blue-600">
              Relatórios Predefinidos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="relatorios-avancados">
            <RelatoriosAvancados />
          </TabsContent>

          <TabsContent value="relatorios-predefinidos">
            {relatorioAtivo === "lista" ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {reports.map((report) => (
                    <Card key={report.id} className="cursor-pointer hover:shadow-lg transition-shadow bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <div className="flex items-center space-x-4">
                          <div className={`p-3 rounded-lg ${report.color}`}>
                            <report.icon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-lg text-white">{report.title}</CardTitle>
                            <p className="text-sm text-gray-400">{report.description}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex space-x-2">
                          <Button 
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                            onClick={() => setRelatorioAtivo(report.id)}
                          >
                            Visualizar
                          </Button>
                          <Button variant="outline" className="border-gray-600 text-gray-300">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              renderRelatorioAtivo()
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default RelatoriosPage;
