import { useState } from "react";
import {
  Wallet,
  Repeat,
  Users,
  Building2,
  ArrowUp,
  Settings,
} from "lucide-react";
import FluxoCaixaTab from "./FluxoCaixaTab";
import ContasRecorrentesTab from "./ContasRecorrentesTab";
import SalariosTab from "./SalariosTab";
import PrestadoresPJTab from "./PrestadoresPJTab";
import NFSaidaTab from "./NFSaidaTab";
import ConfiguracoesTab from "./ConfiguracoesTab";

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
    <div
      className="min-h-screen font-sans text-slate-100"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(14,165,233,0.10), transparent 30%), linear-gradient(135deg, #030712 0%, #07111f 45%, #0f172a 100%)",
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 -my-[13px] px-4 py-[7px] flex items-center justify-between gap-4 border-b backdrop-blur-xl"
        style={{ borderColor: "rgba(30,41,59,0.8)", background: "rgba(2,6,23,0.7)", boxShadow: "0 10px 40px rgba(2,6,23,0.35)" }}
      >
        <div>
          <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Gestão e Controle Fiscal</span>
        </div>
      </header>

      {/* Tab navigation */}
      <div className="px-5 lg:px-6 pt-5 max-w-[1600px] mx-auto">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  active
                    ? "bg-slate-100 text-slate-900 border-slate-100"
                    : "bg-slate-900/70 text-slate-400 border-slate-700 hover:text-slate-100 hover:bg-slate-800"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <main className="px-[5px] py-5 lg:py-6 max-w-[1600px] mx-auto">
        {activeTab === "fluxo" && <FluxoCaixaTab />}
        {activeTab === "contas-recorrentes" && <ContasRecorrentesTab />}
        {activeTab === "salarios" && <SalariosTab />}
        {activeTab === "prestadores-pj" && <PrestadoresPJTab />}
        {activeTab === "nf-saida" && <NFSaidaTab />}
        {activeTab === "configuracoes" && <ConfiguracoesTab />}
      </main>
    </div>
  );
}
