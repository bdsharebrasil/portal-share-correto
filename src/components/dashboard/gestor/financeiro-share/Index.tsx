import { useState } from "react";
import {
  Wallet,
  Repeat,
  Users,
  Building2,
  ArrowUp,
  Settings,
  Layers,
} from "lucide-react";
import FluxoCaixaTab from "./FluxoCaixaTab";
import ContasRecorrentesTab from "./ContasRecorrentesTab";
import SalariosTab from "./SalariosTab";
import PrestadoresPJTab from "./PrestadoresPJTab";
import NFSaidaTab from "./NFSaidaTab";
import ConfiguracoesTab from "./ConfiguracoesTab";
import { Layout } from "@/components/layout/Layout";

type TabKey =
  | "fluxo"
  | "contas-recorrentes"
  | "salarios"
  | "prestadores-pj"
  | "nf-saida"
  | "configuracoes";

const TABS: { key: TabKey; label: string; icon: React.FC<any> }[] = [
  { key: "fluxo",              label: "Gestão Fiscal",     icon: Wallet },
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
      <div className="mx-[-20px] space-y-6 border border-[rgba(12,17,27,0.24)] px-2 text-[#becbe6]">
        {/* Header */}
        <header className="flex items-center gap-3">
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
                    ? t.key === "fluxo"
                      ? "bg-[rgba(38,181,217,0.19)] text-[rgba(215,219,228,1)] border-[rgba(40,108,126,1)] shadow-md"
                      : "bg-primary text-primary-foreground border-primary shadow-md"
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
        <div className="!mt-[2px] mr-0 w-full ml-[-5px] rounded-[5px] border border-[#05080e] bg-[rgba(3,10,22,1)] px-[8px] py-[18px] text-[15px] shadow-[1px_1px_3px_1px_rgba(0,0,0,1)] overflow-hidden">
          {activeTab === "fluxo" && <FluxoCaixaTab />}
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
