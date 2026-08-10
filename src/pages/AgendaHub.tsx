import { useState, lazy, Suspense, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Users, Building, Cake, Calendar, Hotel, LucideIcon } from "lucide-react";
import { Layout } from "@/components/layout/Layout";

// Lazy load components
const Contatos = lazy(() => import("./agenda/Contatos"));
const Clientes = lazy(() => import("./agenda/Clientes"));
const Aniversarios = lazy(() => import("./agenda/Aniversarios"));
const Hoteis = lazy(() => import("./agenda/Hoteis"));
const Ferias = lazy(() => import("./Ferias").then((m) => ({ default: m.FeriasContent })));
type TabId = "contatos" | "clientes" | "hoteis" | "aniversarios" | "ferias";
interface TabItem {
  id: TabId;
  title: string;
  icon: LucideIcon;
  component: React.LazyExoticComponent<() => React.JSX.Element>;
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
  id: "hoteis",
  title: "Hotéis",
  icon: Hotel,
  component: Hoteis
}, {
  id: "aniversarios",
  title: "Aniversários",
  icon: Cake,
  component: Aniversarios
}, {
  id: "ferias",
  title: "Férias",
  icon: Calendar,
  component: Ferias
}];
export default function AgendaHub() {
  const [activeTab, setActiveTab] = useState<TabId>("contatos");
  const [isMenuVisible, setIsMenuVisible] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLDivElement;
      const currentScrollY = target.scrollTop;

      // Se está descendo (scroll para baixo), esconde o menu
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setIsMenuVisible(false);
      } else {
        // Se está subindo ou no topo, mostra o menu
        setIsMenuVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return <Layout>
      <div
        ref={scrollContainerRef}
        className="relative mx-[-9px] my-[-26px] h-[calc(100vh-4rem)] overflow-y-auto bg-[#040a17] px-[8px] py-0 text-slate-100"
      >
        <div
          className="sticky top-0 z-30 my-[6px] flex flex-col gap-0 py-[10px] text-[18px] font-medium text-[rgba(17,204,131,1)] transition-all duration-300"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={{
            transform: isMenuVisible || isHovering ? 'translateY(0)' : 'translateY(-100%)',
            opacity: isMenuVisible || isHovering ? 1 : 0.7,
          }}
        >
          <div className="my-[1px] border-b border-white/10 bg-[#040a17]/80 backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-4">
              <div
                role="tablist"
                aria-label="Seções da agenda"
                className="no-scrollbar flex gap-6 overflow-x-auto sm:gap-8"
                style={{ alignItems: "flex-start", justifyContent: "center", backgroundColor: "#040a17" }}
              >
                {DEFAULT_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`tab-${tab.id}`}
                      aria-selected={active}
                      aria-controls={`panel-${tab.id}`}
                      onClick={() => setActiveTab(tab.id)}
                      className={[
                        "group inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-all duration-200",
                        active
                          ? tab.id === "clientes"
                            ? "rounded-[6px] border-[rgba(63,61,209,1)] text-[rgba(174,238,200,1)] shadow-[1px_1px_5px_0_rgba(12,11,11,1)] overflow-hidden"
                            : tab.id === "hoteis"
                              ? "rounded-[6px] border-[rgba(209,144,61,1)] text-[rgba(174,238,200,1)] shadow-[1px_1px_5px_0_rgba(12,11,11,1)] overflow-hidden"
                              : tab.id === "aniversarios"
                                ? "rounded-[6px] border-[rgba(5,0,255,1)] text-[rgba(174,238,200,1)] shadow-[1px_1px_5px_0_rgba(12,11,11,1)] overflow-hidden"
                                : tab.id === "ferias"
                                  ? "rounded-[6px] border-[rgba(255,251,34,1)] text-[rgba(174,238,200,1)] shadow-[1px_1px_5px_0_rgba(12,11,11,1)] overflow-hidden"
                                  : "rounded-[6px] border-[rgba(61,209,100,1)] text-[rgba(174,238,200,1)] shadow-[1px_1px_5px_0_rgba(12,11,11,1)] overflow-hidden"
                          : "border-transparent text-slate-400 hover:text-slate-200",
                      ].join(" ")}
                    >
                      <Icon className={`h-4 w-4 ${active ? "text-cyan-300" : "text-slate-400 group-hover:text-slate-200"}`} />
                      <span>{tab.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6">
          {DEFAULT_TABS.map((tab) => (
            <motion.div
              key={tab.id}
              id={`panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab.id}`}
              initial={{ opacity: 0, y: 16 }}
              animate={activeTab === tab.id ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: 0.25 }}
              className={activeTab === tab.id ? "block" : "hidden"}
            >
              <Suspense fallback={<div className="flex justify-center py-20 text-gray-400">Carregando...</div>}>
                <tab.component />
              </Suspense>
            </motion.div>
          ))}
        </div>
      </div>
    </Layout>;
}
