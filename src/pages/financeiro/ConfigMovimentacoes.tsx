import React, { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CategoriasCrud } from "@/components/fiscal/CategoriasCrud";
import { ContasBancarias } from "@/components/fiscal/ContasBancarias";

export default function ConfigMovimentacoes() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"categorias" | "contas">("categorias");

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header com Botão de Voltar */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/financeiro/control-financeiro")}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold">Configuração de Movimentações</h1>
        </div>

        {/* Tabs */}
        <Card className="border-0 shadow-lg p-0">
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("categorias")}
              className={`flex-1 px-6 py-4 font-semibold border-b-2 transition-colors ${
                activeTab === "categorias"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Categorias
            </button>
            <button
              onClick={() => setActiveTab("contas")}
              className={`flex-1 px-6 py-4 font-semibold border-b-2 transition-colors ${
                activeTab === "contas"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Contas Bancárias
            </button>
          </div>
        </Card>

        {/* Tab Content */}
        <div>
          {activeTab === "categorias" && <CategoriasCrud />}
          {activeTab === "contas" && <ContasBancarias />}
        </div>
      </div>
    </Layout>
  );
}
