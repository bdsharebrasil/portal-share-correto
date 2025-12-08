import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { CategoriasCrud } from "@/components/fiscal/CategoriasCrud";
import { ContasBancarias } from "@/components/fiscal/ContasBancarias";

export function ConfiguracoesFiscais() {
  const [activeTab, setActiveTab] = useState<"categorias" | "contas">("categorias");

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <Card className="bg-card border-border/50">
        <div className="flex border-b border-border/50">
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
  );
}
