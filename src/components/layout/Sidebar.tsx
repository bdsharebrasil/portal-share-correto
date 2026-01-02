import { useState, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home,
  Calendar,
  FileText,
  CreditCard,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Key,
  Menu,
  X,
  Wallet,
  PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MenuItem {
  title: string;
  icon?: any;
  href?: string;
  isMain?: boolean;
  isExpandable?: boolean;
  isExternal?: boolean;
  externalUrl?: string;
  subItems?: { title: string; href: string }[];
  itemId?: string;
}

interface MenuGroup {
  title: string;
  groupId?: string;
  items: MenuItem[];
}

// Definição base dos grupos de menu (SEM LÓGICA DE PERMISSÃO AQUI)
const baseMenuGroups: MenuGroup[] = [
  {
    title: "Navegação Principal",
    items: [
      { title: "Início", icon: Home, href: "/", isMain: true },
      { title: "Documentos", icon: FileText, href: "/documentos" },
      { title: "Senhas", icon: Key, href: "/senhas" },
    ],
  },
  {
    title: "Agenda & Contatos",
    items: [
      {
        title: "Agenda",
        icon: Calendar,
        href: "/agenda",
      },
    ],
  },
  {
    title: "Financeiro & Cartões",
    items: [
      {
        title: "Solicitação de Compras",
        icon: CreditCard,
        href: "/financeiro/compras",
      },
      {
        title: "Cartões Corporativos",
        icon: Wallet,
        href: "/cartoes-corporativos",
      },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [expandedMenu, setExpandedMenu] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Filtrar menu baseado em permissões
  const filteredMenuGroups = useMemo(() => {
    const groups = baseMenuGroups.map((g) => ({
      ...g,
      items: g.items.map((it) => ({ ...it }))
    }));

    // Remover grupos vazios
    return groups.filter((group) => group.items.length > 0);
  }, []);

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title]
    );
  };

  // Collapse sidebar quando expandedMenu fecha
  const handleMenuToggle = () => {
    setExpandedMenu(!expandedMenu);
  };

  return (
    <>
      {/* Icon-only sidebar (always visible) */}
      <aside className="fixed left-0 top-16 w-20 h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-950/95 backdrop-blur-sm border-r border-slate-800/50 z-50 flex flex-col items-center py-6 gap-4">
        {/* Main navigation icons */}
        <nav className="flex flex-col gap-3 w-full px-2">
          {filteredMenuGroups.flatMap((group) =>
            group.items.map((item) => (
              <motion.div
                key={item.title}
                onMouseEnter={() => setHoveredItem(item.title)}
                onMouseLeave={() => setHoveredItem(null)}
                animate={{
                  scale: hoveredItem === item.title ? 1.2 : 1,
                  y: hoveredItem === item.title ? -5 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                }}
              >
                {item.isExternal ? (
                  <a
                    href={item.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 hover:border-primary/50 transition-all duration-300"
                    title={item.title}
                  >
                    {item.icon && <item.icon className="h-5 w-5 text-foreground group-hover:text-primary transition-colors" />}
                    <motion.div
                      className="absolute left-20 px-3 py-1.5 bg-slate-800 rounded-lg text-xs font-medium text-foreground pointer-events-none whitespace-nowrap z-10"
                      animate={{
                        opacity: hoveredItem === item.title ? 1 : 0,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      {item.title}
                    </motion.div>
                  </a>
                ) : item.isExpandable ? (
                  <button
                    onClick={handleMenuToggle}
                    className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 hover:border-primary/50 transition-all duration-300"
                    title={item.title}
                  >
                    {item.icon && <item.icon className="h-5 w-5 text-foreground group-hover:text-primary transition-colors" />}
                    <motion.div
                      className="absolute left-20 px-3 py-1.5 bg-slate-800 rounded-lg text-xs font-medium text-foreground pointer-events-none whitespace-nowrap z-10"
                      animate={{
                        opacity: hoveredItem === item.title ? 1 : 0,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      {item.title}
                    </motion.div>
                  </button>
                ) : (
                  <NavLink
                    to={item.href || "#"}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center justify-center w-14 h-14 rounded-full border transition-all duration-300",
                        isActive
                          ? "bg-primary/40 border-primary/50 text-primary"
                          : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/70 hover:border-primary/50 text-foreground hover:text-primary"
                      )
                    }
                    title={item.title}
                  >
                    {item.icon && <item.icon className="h-5 w-5 transition-colors" />}
                    <motion.div
                      className="absolute left-20 px-3 py-1.5 bg-slate-800 rounded-lg text-xs font-medium text-foreground pointer-events-none whitespace-nowrap z-10"
                      animate={{
                        opacity: hoveredItem === item.title ? 1 : 0,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      {item.title}
                    </motion.div>
                  </NavLink>
                )}
              </motion.div>
            ))
          )}
        </nav>

      </aside>

      {/* Expandable menu panel */}
      {expandedMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 top-16"
            onClick={() => setExpandedMenu(false)}
          />

          {/* Expanded menu */}
          <div className="fixed left-20 top-16 w-64 h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-900/98 via-slate-950/98 to-slate-950/98 backdrop-blur-md border-r border-slate-800/50 z-40 overflow-y-auto custom-scrollbar p-4">
            <nav className="space-y-4">
              {filteredMenuGroups.map((group) => (
                <Card
                  key={group.title}
                  className="bg-slate-800/40 border-slate-700/50 shadow-none"
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-foreground flex items-center">
                      {group.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {group.items.map((item) => (
                      <div key={item.title}>
                        {item.isExternal ? (
                          <a
                            href={item.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center px-3 py-2 rounded-md text-sm font-medium border border-slate-700/50 hover:bg-slate-800/70 hover:border-primary/50 transition-smooth text-foreground"
                          >
                            {item.icon && <item.icon className="mr-3 h-4 w-4 text-primary" />}
                            {item.title}
                          </a>
                        ) : item.isExpandable ? (
                          <Collapsible
                            open={expandedItems.includes(item.title)}
                            onOpenChange={() => toggleExpanded(item.title)}
                          >
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between border-slate-700/50 hover:bg-slate-800/70 hover:border-primary/50 transition-smooth rounded-md"
                              >
                                <div className="flex items-center">
                                  {item.icon && <item.icon className="mr-3 h-4 w-4 text-primary" />}
                                  {item.title}
                                </div>
                                {expandedItems.includes(item.title) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="ml-4 mt-1 space-y-1">
                              {item.subItems?.map((subItem) => (
                                <NavLink
                                  key={subItem.href}
                                  to={subItem.href}
                                  className={({ isActive }) =>
                                    cn(
                                      "block px-4 py-2 text-sm rounded-md border transition-smooth",
                                      isActive
                                        ? "bg-primary/40 text-white shadow-primary border-primary/50"
                                        : "text-foreground border-slate-700/50 hover:bg-slate-800/70 hover:border-primary/50"
                                    )
                                  }
                                  onClick={() => setExpandedMenu(false)}
                                >
                                  {subItem.title}
                                </NavLink>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        ) : (
                          <NavLink
                            to={item.href || "#"}
                            className={({ isActive }) =>
                              cn(
                                "flex items-center px-3 py-2 rounded-md text-sm font-medium border transition-smooth",
                                isActive
                                  ? "bg-primary/40 text-white shadow-primary border-primary/50"
                                  : "text-foreground border-slate-700/50 hover:bg-slate-800/70 hover:border-primary/50"
                              )
                            }
                            onClick={() => setExpandedMenu(false)}
                          >
                            {item.icon && <item.icon className="mr-3 h-4 w-4 text-primary" />}
                            {item.title}
                          </NavLink>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
};
