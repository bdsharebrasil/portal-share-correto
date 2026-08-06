import React from "react";
import { Colaboradores } from "@/components/dashboard/gestor/master/colaboradores/Colaboradores";
import { Layout } from "@/components/layout/Layout";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function MasterColaboradores() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="space-y-6 pb-8">
        {/* Header com botão voltar */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/gestor/master")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
        </div>

        {/* Componente Colaboradores */}
        <Colaboradores />
      </div>
    </Layout>
  );
}

export default MasterColaboradores;
