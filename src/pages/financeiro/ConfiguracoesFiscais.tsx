import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { CategoriasCrud } from "@/components/fiscal/CategoriasCrud";
import { ContasBancarias } from "@/components/fiscal/ContasBancarias";
import { FornecedoresFavoritos } from "@/components/fiscal/FornecedoresFavoritos";

export function ConfiguracoesFiscais() {
  const [activeTab, setActiveTab] = useState<"categorias" | "contas" | "fornecedores">("categorias");

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header com Botão de Voltar */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/financeiro/gestao-fiscal")}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold">Configuração</h1>
        </div>

      {/* Tabs */}
      <Card className="bg-card border-border/50">
        <div className="flex border-b border-border/50">
          <button
            onClick={() => setActiveTab("categorias")}
            className={`flex-1 px-4 sm:px-6 py-4 font-semibold border-b-2 transition-colors text-sm sm:text-base ${
              activeTab === "categorias"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Categorias
          </button>
          <button
            onClick={() => setActiveTab("contas")}
            className={`flex-1 px-4 sm:px-6 py-4 font-semibold border-b-2 transition-colors text-sm sm:text-base ${
              activeTab === "contas"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Contas Bancárias
          </button>
          <button
            onClick={() => setActiveTab("fornecedores")}
            className={`flex-1 px-4 sm:px-6 py-4 font-semibold border-b-2 transition-colors text-sm sm:text-base ${
              activeTab === "fornecedores"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Fornecedores
          </button>
        </div>
      </Card>

      {/* Tab Content */}
      <div>
        {activeTab === "categorias" && <CategoriasCrud />}
        {activeTab === "contas" && <ContasBancarias />}
        {activeTab === "fornecedores" && <FornecedoresFavoritos />}
    </div>
      </div>
    </Layout>
  );
}
