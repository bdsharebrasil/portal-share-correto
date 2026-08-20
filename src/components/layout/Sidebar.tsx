import React, { useState, useMemo, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home,
  Calendar,
  FileText,
  CreditCard,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Key,
  Mail,
  Menu,
  Wallet,
  CheckSquare,
  BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useUserRole } from "@/hooks/useUserRole";
import { getDashboardRouteFromRoles } from "@/lib/dashboard-routing";
import { useUnviewedTasks } from "@/hooks/useUnviewedTasks";
import { supabase } from "@/integrations/supabase/client";

interface MenuItem {
  title: string;
  icon?: any;
  href?: string;
  isMain?: boolean;
  isExpandable?: boolean;
  isExternal?: boolean;
  externalUrl?: string;
  subItems?: { title: string; href: string }[];
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const baseMenuGroups: MenuGroup[] = [
  {
    title: "Navegação Principal",
    items: [
      { title: "Início", icon: Home, href: "/", isMain: true },
      { title: "Documentos", icon: FileText, href: "/documentos" },
      { title: "Senhas", icon: Key, href: "/senhas" },
      { title: "Mensagens", icon: Mail, href: "/mensagens", badgeKey: "unreadMessages" },

      { title: "Minhas Tarefas", icon: CheckSquare, href: "/minhas-tarefas" },
    ],
  },
  {
    title: "Agenda & Contatos",
    items: [{ title: "Agenda", icon: Calendar, href: "/agenda" }],
  },
  {
    title: "Financeiro & Cartões",
    items: [
      { title: "Solicitações compras/pagamentos", icon: CreditCard, href: "/financeiro/compras" },
      { title: "Cartões Corporativos", icon: Wallet, href: "/cartoes-corporativos" },
    ],
  },
  {
    title: "Ajuda",
    items: [
      { title: "Manual do Sistema", icon: BookOpen, href: "/manual" },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { userRoles } = useUserRole();
  const { count: unviewedCount } = useUnviewedTasks(userId);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
  }, []);

  const dashboardRoute = useMemo(() => {
    const { route } = getDashboardRouteFromRoles(userRoles as string[]);
    return route;
  }, [userRoles]);

  const handleItemClick = () => {
    if (onClose) onClose();
  };

  useEffect(() => {
    const handleScroll = () => { if (onClose) onClose(); };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [onClose]);

  const filteredMenuGroups = useMemo(() => {
    const groups = baseMenuGroups.map((g) => ({
      ...g,
      items: g.items.map((it) => (it.title === "Início" ? { ...it, href: dashboardRoute } : it)),
    }));
    return groups.filter((group) => group.items.length > 0);
  }, [dashboardRoute]);

  const toggleExpanded = (title: string) => setExpandedItems((prev) => (prev.includes(title) ? prev.filter((p) => p !== title) : [...prev, title]));

  const renderMenuContent = () => (
    <nav className="space-y-4">
      {filteredMenuGroups.map((group) => (
        <Card key={group.title} className="bg-slate-800/40 border-slate-700/50 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground flex items-center">{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {group.items.map((item) => (
              <div key={item.title}>
                {item.isExternal ? (
                  <a href={item.externalUrl} target="_blank" rel="noopener noreferrer" onClick={handleItemClick} className="flex items-center px-3 py-2 rounded-md text-sm font-medium border border-slate-700/50 hover:bg-slate-800/70 hover:border-primary/50 transition-smooth text-foreground">
                    {item.icon && <item.icon className="mr-3 h-4 w-4 text-primary" />}
                    {item.title}
                  </a>
                ) : item.isExpandable ? (
                  <Collapsible open={expandedItems.includes(item.title)} onOpenChange={() => toggleExpanded(item.title)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between border-slate-700/50 hover:bg-slate-800/70 hover:border-primary/50 transition-smooth rounded-md">
                        <div className="flex items-center">
                          {item.icon && <item.icon className="mr-3 h-4 w-4 text-primary" />}
                          {item.title}
                        </div>
                        {expandedItems.includes(item.title) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="ml-4 mt-1 space-y-1">
                      {item.subItems?.map((sub) => (
                        <NavLink key={sub.href} to={sub.href} className={({ isActive }) => cn("block px-4 py-2 text-sm rounded-md border transition-smooth", isActive ? "bg-primary/40 text-white shadow-primary border-primary/50" : "text-foreground border-slate-700/50 hover:bg-slate-800/70 hover:border-primary/50")} onClick={handleItemClick}>
                          {sub.title}
                        </NavLink>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <NavLink to={item.href || "#"} className={({ isActive }) => cn("flex items-center px-3 py-2 rounded-md text-sm font-medium border transition-smooth", isActive ? "bg-primary/40 text-white shadow-primary border-primary/50" : "text-foreground border-slate-700/50 hover:bg-slate-800/70 hover:border-primary/50")} onClick={handleItemClick}>
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
  );

  const allItems = useMemo(
    () => filteredMenuGroups.flatMap((g) => g.items),
    [filteredMenuGroups]
  );

  return (
    <>
      {collapsed ? (
        <div className="hidden md:flex md:fixed md:left-2 md:top-20 z-50">
          <button aria-label="Abrir menu" onClick={() => setCollapsed(false)} className="w-10 h-10 rounded-full bg-slate-800/70 border border-slate-700/50 flex items-center justify-center text-foreground hover:bg-slate-800/90 transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <aside className="hidden md:fixed md:left-0 md:top-16 md:w-20 md:h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-950/95 backdrop-blur-sm border-r border-slate-800/50 z-50 md:flex flex-col items-center py-4 gap-3 bg-[#0f121a] transition-all duration-200 ease-linear">
          <button aria-label="Fechar menu" onClick={() => setCollapsed(true)} className="w-9 h-9 rounded-full bg-slate-800/70 border border-slate-700/50 flex items-center justify-center text-foreground hover:bg-slate-800/90 transition-colors mb-2">
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* O overflow-y-auto foi removido aqui para permitir que o tooltip vaze para cima do conteúdo da página, tirando também o scroll indesejado. */}
          <nav className="flex flex-col items-center gap-3 w-full px-1 overflow-visible">
            {allItems.map((item) => {
              const iconEl = item.icon ? <item.icon className="h-5 w-5" /> : null;
              const baseCircle = "relative w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-200 group";
              const inactive = "bg-slate-800/50 border-slate-700/60 text-foreground hover:bg-slate-800/90 hover:border-primary/50 hover:text-primary hover:scale-105";
              const active = "bg-primary/20 border-primary/60 text-primary shadow-[0_0_0_3px_rgba(59,130,246,0.15)]";

              const tooltip = (
                <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900/95 border border-slate-700/60 px-2.5 py-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity z-[60] shadow-lg">
                  {item.title}
                </span>
              );

              if (item.isExternal) {
                return (
                  <a
                    key={item.title}
                    href={item.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleItemClick}
                    className={cn(baseCircle, inactive)}
                    onMouseEnter={() => setHoveredItem(item.title)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    {iconEl}
                    {tooltip}
                  </a>
                );
              }
              return (
                <NavLink
                  key={item.title}
                  to={item.href || '#'}
                  onClick={handleItemClick}
                  className={({ isActive }) => cn(baseCircle, isActive ? active : inactive)}
                  onMouseEnter={() => setHoveredItem(item.title)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {iconEl}
                  {tooltip}
                </NavLink>
              );
            })}
          </nav>
        </aside>
      )}

      <Sheet open={isOpen} onOpenChange={(open) => { if (!open && onClose) onClose(); }}>
        <SheetContent side="left" className="w-80 bg-gradient-to-b from-slate-900/98 via-slate-950/98 to-slate-950/98 border-r border-slate-800/50 p-0">
          <div className="h-full overflow-y-auto custom-scrollbar p-4 pt-6">
            {renderMenuContent()}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
