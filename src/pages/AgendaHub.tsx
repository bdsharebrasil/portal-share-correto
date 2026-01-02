import { useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { Users, Building, Cake, Calendar, LucideIcon } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { CircularNavButton } from "@/components/agenda/CircularNavButton";

// Lazy load components
const Contatos = lazy(() => import("./agenda/Contatos"));
const Clientes = lazy(() => import("./agenda/Clientes"));
const Aniversarios = lazy(() => import("./agenda/Aniversarios"));
const CalendarioFerias = lazy(() => import("./CalendarioFerias"));
type TabId = "contatos" | "clientes" | "aniversarios" | "ferias";
interface TabItem {
  id: TabId;
  title: string;
  icon: LucideIcon;
  component: React.LazyExoticComponent<() => JSX.Element>;
}
const DEFAULT_TABS: TabItem[] = [{
  id: "contatos",
  title: "Contatos",
  icon: Users,
  component: Contatos
}, {
  id: "clientes",
  title: "Clientes",
  icon: Building,
  component: Clientes
}, {
  id: "aniversarios",
  title: "Aniversários",
  icon: Cake,
  component: Aniversarios
}, {
  id: "ferias",
  title: "Férias",
  icon: Calendar,
  component: CalendarioFerias
}];
export default function AgendaHub() {
  const [activeTab, setActiveTab] = useState<TabId>("contatos");
  const getTabColor = (tabId: TabId): "blue" | "purple" | "green" | "amber" => {
    switch (tabId) {
      case "contatos":
        return "blue";
      case "clientes":
        return "purple";
      case "aniversarios":
        return "green";
      case "ferias":
        return "amber";
    }
  };
  return <Layout>
      {/* ⬇️ ESTE é o container que SCROLLA */}
      <div className="h-[calc(100vh-4rem)] overflow-y-auto bg-gray-950 text-gray-100">

        {/* 🔒 MENU TRAVADO NO TOPO DO CONTEÚDO */}
        <div className="
            sticky top-0 z-30
            bg-gray-950/70
            backdrop-blur-xl
            border-b border-white/10
          ">
          <div className="max-w-7xl mx-auto px-4 py-0">
            <div className="flex justify-center gap-8 md:gap-12 overflow-x-auto no-scrollbar">
              {DEFAULT_TABS.map(tab => <CircularNavButton key={tab.id} onClick={() => setActiveTab(tab.id)} icon={tab.icon} label={tab.title} color={getTabColor(tab.id)} isActive={activeTab === tab.id} />)}
            </div>
          </div>
        </div>

        {/* 📦 CONTEÚDO COM SCROLL */}
        <div className="max-w-7xl mx-auto px-4 py-[12px]">
          {DEFAULT_TABS.map(tab => <motion.div key={tab.id} initial={{
          opacity: 0,
          y: 20
        }} animate={activeTab === tab.id ? {
          opacity: 1,
          y: 0
        } : {
          opacity: 0,
          y: 20
        }} transition={{
          duration: 0.3
        }} className={activeTab === tab.id ? "block" : "hidden"}>
              <Suspense fallback={<div className="flex justify-center py-20 text-gray-400">
                    Carregando...
                  </div>}>
                <tab.component />
              </Suspense>
            </motion.div>)}
        </div>

      </div>
    </Layout>;
}