import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inadimplencia } from "@/components/master/relatorio/Inadimplencia";
import { RelatorioBalancete } from "@/components/master/relatorio/RelatorioBalancete";
import { RelatorioDRE } from "@/components/master/relatorio/RelatorioDRE";
import { RelatorioFluxoCaixa } from "@/components/master/relatorio/RelatorioFluxoCaixa";
import { BarChart3, Scale, DollarSign, AlertTriangle, ArrowLeft } from "lucide-react";

type RelatorioType = "balancete" | "dre" | "fluxo" | "inadimplencia";

const relatorios = [
  {
    id: "balancete",
    titulo: "Balancete Mensal",
    descricao: "Visualize todas as transações agrupadas por categoria",
    icone: Scale,
  },
  {
    id: "dre",
    titulo: "Demonstração de Resultado (DRE)",
    descricao: "Demonstração detalhada de receitas e despesas",
    icone: BarChart3,
  },
  {
    id: "fluxo",
    titulo: "Fluxo de Caixa",
    descricao: "Análise diária do fluxo de caixa e movimentações",
    icone: DollarSign,
  },
  {
    id: "inadimplencia",
    titulo: "Inadimplência",
    descricao: "Contas em atraso e controle de cobranças",
    icone: AlertTriangle,
  },
];

export default function RelatoriosFinanceiros() {
  const [selecionado, setSelecionado] = useState<RelatorioType | null>(null);

  const renderRelatorio = () => {
    switch (selecionado) {
      case "balancete":
        return <RelatorioBalancete onBack={() => setSelecionado(null)} />;
      case "dre":
        return <RelatorioDRE onBack={() => setSelecionado(null)} />;
      case "fluxo":
        return <RelatorioFluxoCaixa onBack={() => setSelecionado(null)} />;
      case "inadimplencia":
        return <Inadimplencia onBack={() => setSelecionado(null)} />;
      default:
        return null;
    }
  };

  if (selecionado) {
    return (
      <div className="min-h-screen bg-background p-6">
        <button
          onClick={() => setSelecionado(null)}
          className="flex items-center gap-2 text-foreground hover:text-primary transition-colors group mb-6"
        >
          <ArrowLeft className="h-6 w-6 text-primary group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Voltar</span>
        </button>
        {renderRelatorio()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Relatórios Financeiros</h1>
        <p className="text-muted-foreground">Acesse os relatórios financeiros e análises da empresa</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {relatorios.map((relatorio) => {
          const Icon = relatorio.icone;
          return (
            <Card
              key={relatorio.id}
              className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group"
              onClick={() => setSelecionado(relatorio.id as RelatorioType)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {relatorio.titulo}
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  {relatorio.descricao}
                </p>
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => setSelecionado(relatorio.id as RelatorioType)}
                >
                  Abrir Relatório
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
