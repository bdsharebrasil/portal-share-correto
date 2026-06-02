import { ArrowLeft } from "lucide-react";

export default function RelatoriosFinanceiros() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => window.history.back()}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios Financeiros</h1>
          <p className="text-sm text-muted-foreground">
            Esta página foi removida do fluxo legado de `controle_bancario` e o hook antigo não existe mais.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-3">Limpeza de código legado</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          O hook `useRelatorioFinanceiro` foi removido como parte da limpeza do trilho legado `controle_bancario`.
          Se precisar reimplementá-lo em uma versão atualizada, crie um hook novo com dados de `movimentacoes`.
        </p>
      </div>
    </div>
  );
}
