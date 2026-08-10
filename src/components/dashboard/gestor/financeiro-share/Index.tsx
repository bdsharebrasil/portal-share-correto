import { useState } from "react";
import {
  Wallet,
  Repeat,
  Users,
  Building2,
  ArrowUp,
  Settings,
  CircleDollarSign,
  Layers,
} from "lucide-react";
import FluxoCaixaTab from "./FluxoCaixaTab";
import ContasRecorrentesTab from "./ContasRecorrentesTab";
import SalariosTab from "./SalariosTab";
import PrestadoresPJTab from "./PrestadoresPJTab";
import NFSaidaTab from "./NFSaidaTab";
import ConfiguracoesTab from "./ConfiguracoesTab";
import DespesasParticularesTab from "./DespesasParticularesTab";
import { Layout } from "@/components/layout/Layout";

type TabKey =
  | "fluxo"
  | "despesas-particulares"
  | "contas-recorrentes"
  | "salarios"
  | "prestadores-pj"
  | "nf-saida"
  | "configuracoes";

const TABS: { key: TabKey; label: string; icon: React.FC<any> }[] = [
  { key: "fluxo",              label: "Gestão Fiscal",     icon: Wallet },
  { key: "despesas-particulares", label: "Despesas Particulares", icon: Layers },
  { key: "contas-recorrentes", label: "Contas Recorrentes", icon: Repeat },
  { key: "salarios",           label: "Salários CLT",      icon: Users },
  { key: "prestadores-pj",     label: "Prestadores PJ",     icon: Building2 },
  { key: "nf-saida",           label: "NF Saída",           icon: ArrowUp },
  { key: "configuracoes",      label: "Configurações",      icon: Settings },
];

export default function GestaoFiscal() {
  const [activeTab, setActiveTab] = useState<TabKey>("fluxo");

  return (
    <Layout>
      <div className="space-y-6 px-2">
        {/* Header */}
        <header className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20 text-primary">
            <CircleDollarSign className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-xl text-foreground leading-tight">
              Módulo Financeiro
            </h1>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Gestão e Controle Fiscal
            </span>
          </div>
        </header>

        {/* Tab navigation */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "bg-card/50 text-muted-foreground border-border/60 hover:text-foreground hover:bg-card/80"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="w-full">
          {activeTab === "fluxo" && <FluxoCaixaTab />}
          {activeTab === "despesas-particulares" && <DespesasParticularesTab />}
          {activeTab === "contas-recorrentes" && <ContasRecorrentesTab />}
          {activeTab === "salarios" && <SalariosTab />}
          {activeTab === "prestadores-pj" && <PrestadoresPJTab />}
          {activeTab === "nf-saida" && <NFSaidaTab />}
          {activeTab === "configuracoes" && <ConfiguracoesTab />}
        </div>
      </div>
    </Layout>
  );
}
