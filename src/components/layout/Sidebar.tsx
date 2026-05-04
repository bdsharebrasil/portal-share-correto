import { useState, useMemo, useEffect } from "react";
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
  CheckSquare
} from
  "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
  subItems?: { title: string; href: string; }[];
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
      { title: "Minhas Tarefas", icon: CheckSquare, href: "/minhas-tarefas" }]

  },
  {
    title: "Agenda & Contatos",
    items: [
      {
        title: "Agenda",
        icon: Calendar,
        href: "/agenda"
      }]

  },
  {
    title: "Financeiro & Cartões",
    items: [
      {
        title: "Solicitação de Compras",
        icon: CreditCard,
        href: "/financeiro/compras"
      },
      {
        title: "Cartões Corporativos",
        icon: Wallet,
        href: "/cartoes-corporativos"
      }]

  }];


interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { userRoles } = useUserRole();
  const { count: unviewedCount } = useUnviewedTasks(userId);

  // Obter user ID
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    })();
  }, []);

  // Obter a rota correta do dashboard baseado nas roles do usuário
  const dashboardRoute = useMemo(() => {
    const { route } = getDashboardRouteFromRoles(userRoles as string[]);
    return route;
  }, [userRoles]);

  // Fechar sidebar expandido ao clicar em um item
  const handleItemClick = () => {
    if (onClose) {
      onClose();
    }
  };

  // Fechar menu ao rolar a página
  useEffect(() => {
    const handleScroll = () => {
      if (onClose) {
        onClose();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [onClose]);

  // Filtrar menu baseado em permissões
  const filteredMenuGroups = useMemo(() => {
    const groups = baseMenuGroups.map((g) => ({
      ...g,
      items: g.items.map((it) => {
        // Atualizar o href do item "Início" para apontar ao dashboard correto
        if (it.title === "Início") {
          return { ...it, href: dashboardRoute };
        }
        return { ...it };
      })
    }));

    // Remover grupos vazios
    return groups.filter((group) => group.items.length > 0);
  }, [dashboardRoute]);

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title]
    );
  };

  // Renderizar conteúdo do menu (compartilhado entre desktop e mobile)
  const renderMenuContent = () => (
    <nav className="space-y-4">
      {filteredMenuGroups.map((group) =>
        <Card
          key={group.title}
          className="bg-slate-800/40 border-slate-700/50 shadow-none">

          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground flex items-center">
              {group.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {group.items.map((item) =>
              <div key={item.title}>
                {item.isExternal ?
                  <a
                    href={item.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleItemClick}
                    className="flex items-center px-3 py-2 rounded-md text-sm font-medium border border-slate-700/50 hover:bg-slate-800/70 hover:border-primary/50 transition-smooth text-foreground">

                    {item.icon && <item.icon className="mr-3 h-4 w-4 text-primary" />}
                    {item.title}
                  </a> :
                  item.isExpandable ?
                    <Collapsible
                      open={expandedItems.includes(item.title)}
                      onOpenChange={() => toggleExpanded(item.title)}>

                      <CollapsibleTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between border-slate-700/50 hover:bg-slate-800/70 hover:border-primary/50 transition-smooth rounded-md">

                          <div className="flex items-center">
                            {item.icon && <item.icon className="mr-3 h-4 w-4 text-primary" />}
                            {item.title}
                          </div>
                          {expandedItems.includes(item.title) ?
                            <ChevronDown className="h-4 w-4" /> :

                            <ChevronRight className="h-4 w-4" />
                          }
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="ml-4 mt-1 space-y-1">
                        {item.subItems?.map((subItem) =>
                          <NavLink
                            key={subItem.href}
                            to={subItem.href}
                            className={({ isActive }) =>
                              cn(
                                "block px-4 py-2 text-sm rounded-md border transition-smooth",
                                isActive ?
                                  "bg-primary/40 text-white shadow-primary border-primary/50" :
                                  "text-foreground border-slate-700/50 hover:bg-slate-800/70 hover:border-primary/50"
                              )
                            }
                            onClick={handleItemClick}>

                            {subItem.title}
                          </NavLink>
                        )}
                      </CollapsibleContent>
                    </Collapsible> :

                    <NavLink
                      to={item.href || "#"}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center px-3 py-2 rounded-md text-sm font-medium border transition-smooth",
                          isActive ?
                            "bg-primary/40 text-white shadow-primary border-primary/50" :
                            "text-foreground border-slate-700/50 hover:bg-slate-800/70 hover:border-primary/50"
                        )
                      }
                      onClick={handleItemClick}>

                      {item.icon && <item.icon className="mr-3 h-4 w-4 text-primary" />}
                      {item.title}
                    </NavLink>
                }
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </nav>
  );

  return (
    <>
      {/* Desktop Icon-only sidebar (hidden on mobile, visible on md+) */}
      <aside className="hidden md:fixed md:left-0 md:top-16 md:w-20 md:h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-950/95 backdrop-blur-sm border-r border-slate-800/50 z-50 md:flex flex-col items-center py-6 gap-4 bg-[#0f121a]">
        {/* Main navigation icons */}
        <nav className="flex flex-col w-full px-3.5" style={{ gap: '22px', margin: '59px 0' }}>
          {filteredMenuGroups.flatMap((group) =>
            group.items.map((item) =>
              <motion.div
                key={item.title}
                onMouseEnter={() => setHoveredItem(item.title)}
                onMouseLeave={() => setHoveredItem(null)}
                animate={{
                  scale: hoveredItem === item.title ? 1.2 : 1,
                  y: hoveredItem === item.title ? -5 : 0
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20
                }}>

                {item.isExternal ?
                  <a
                    href={item.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleItemClick}
                    className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 hover:border-primary/50 transition-all duration-300"
                    title={item.title}>

                    {item.icon && <item.icon className="h-5 w-5 text-foreground group-hover:text-primary transition-colors" />}
                    <motion.div
                      className="absolute left-20 px-3 py-1.5 bg-slate-800 rounded-lg text-xs font-medium text-foreground pointer-events-none whitespace-nowrap z-10"
                      animate={{
                        opacity: hoveredItem === item.title ? 1 : 0
                      }}
                      transition={{ duration: 0.2 }}>

                      {item.title}
                    </motion.div>
                  </a> :

                  <NavLink
                    to={item.href || "#"}
                    onClick={handleItemClick}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center justify-center w-14 h-14 rounded-full border transition-all duration-300",
                        isActive ?
                          "bg-primary/40 border-primary/50 text-primary" :
                          "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/70 hover:border-primary/50 text-foreground hover:text-primary"
                      )
                    }
                    title={item.title}>

                    {item.icon && <item.icon className="h-5 w-5 transition-colors" />}

                    {/* Badge de tarefas não visualizadas */}
                    {item.title === "Minhas Tarefas" && unviewedCount > 0 && (
                      <motion.div
                        className="absolute top-0 right-0 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                      >
                        {unviewedCount > 99 ? "99+" : unviewedCount}
                      </motion.div>
                    )}

                    <motion.div
                      className="absolute left-20 px-3 py-1.5 bg-slate-800 rounded-lg text-xs font-medium text-foreground pointer-events-none whitespace-nowrap z-10"
                      animate={{
                        opacity: hoveredItem === item.title ? 1 : 0
                      }}
                      transition={{ duration: 0.2 }}>

                      {item.title}
                    </motion.div>
                  </NavLink>
                }
              </motion.div>
            )
          )}
        </nav>

      </aside>

      {/* Mobile drawer menu - visible only on mobile */}
      <Sheet open={isOpen} onOpenChange={(open) => {
        if (!open && onClose) {
          onClose();
        }
      }}>
        <SheetContent side="left" className="w-80 bg-gradient-to-b from-slate-900/98 via-slate-950/98 to-slate-950/98 border-r border-slate-800/50 p-0">
          <div className="h-full overflow-y-auto custom-scrollbar p-4 pt-6">
            {renderMenuContent()}
          </div>
        </SheetContent>
      </Sheet>
    </>);

};
