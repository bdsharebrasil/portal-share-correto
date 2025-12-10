import { useState, useMemo } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Calendar,
  Users,
  FileText,
  CreditCard,
  DollarSign,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
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
  itemId?: string;
  isSSOLink?: boolean;
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
      { title: "Minhas Tarefas", icon: CheckSquare, href: "/minhas-tarefas" },
      {
    title: "Gestão Fiscal",
    icon: BarChart3,
    href: "/financeiro/gestao-fiscal",
    itemId: "gestao_fiscal",
  },
  {
    title: "Dashboard Gestor",
    icon: BarChart3,
    href: "/financeiro/dashboard-gestor",
    itemId: "dashboard_gestor",
  },
  {
    title: "Acesso Gestor",
    icon: ExternalLink,
    isSSOLink: true,
    itemId: "acesso_gestor",
  },
    ],
  },
  {
    title: "Agenda & Contatos",
    items: [
      {
        title: "Agenda",
        icon: Calendar,
        isExpandable: true,
        subItems: [
          { title: "Contatos", href: "/agenda/contatos" },
          { title: "Clientes/Cotistas", href: "/agenda/clientes" },
          { title: "Aniversários", href: "/agenda/aniversarios" },
          { title: "Calendário de Férias", href: "/agenda/calendario-ferias" },
        ],
      },
    ],
  },
  {
    title: "Financeiro & Cartões",
    items: [
      {
        title: "Portal Financeiro",
        icon: CreditCard,
        isExpandable: true,
        subItems: [
          { title: "Conciliação Bancária", href: "/financeiro/conciliacao" },
          { title: "Config. Empresa", href: "/financeiro/config" },
          { title: "Emissão de Recibo", href: "/financeiro/recibo" },
          { title: "Relatório de Viagem", href: "/financeiro/viagem" },
          { title: "Solicitação de Compras/Serviço", href: "/financeiro/compras" },
        ],
      },
      {
        title: "Saldo Cartão",
        icon: DollarSign,
        isExpandable: true,
        subItems: [
          { title: "Cartão Alimentação", href: "/cartao/alimentacao" },
          { title: "Cartão Combustível", href: "/cartao/combustivel" },
        ],
      },
    ],
  },
  {
    title: "Comunicação",
    items: [
      {
        title: "Recados",
        icon: MessageSquare,
        href: "/recados",
      },
    ],
  },
  {
    title: "Administração",
    groupId: "admin",
    items: [
      {
        title: "Usuários",
        icon: Users,
        href: "/gerenciar-usuarios",
        itemId: "admin_usuarios",
      },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
}

// URL da aplicação do gestor
const GESTOR_APP_URL = "https://financeiro-gestor.vercel.app/";

export const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const [expandedItems, setExpandedItems] = useState<string[]>(["Agenda", "Portal Financeiro", "Saldo Cartão"]);

  const { isAdmin, isGestorMaster, isFinanceiroMaster } = useUserRole();

  // Variáveis de permissão
  const canManageUsersGlobal = useMemo(() => isAdmin || isGestorMaster, [isAdmin, isGestorMaster]);
  const canAccessFinancialControl = useMemo(() => isAdmin || isGestorMaster || isFinanceiroMaster, [isAdmin, isGestorMaster, isFinanceiroMaster]);

  // Função para acessar o app do gestor com SSO
  const handleGestorAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Redireciona com os tokens de acesso
        const gestorUrl = `${GESTOR_APP_URL}auth?access_token=${session.access_token}&refresh_token=${session.refresh_token}`;
        window.open(gestorUrl, "_blank");
      }
    } catch (error) {
      console.error("Erro ao acessar app do gestor:", error);
    }
  };

  // Filtrar menu baseado em permissões
  const filteredMenuGroups = useMemo(() => {
    const groups = baseMenuGroups.map((g) => ({
      ...g,
      items: g.items.map((it) => ({ ...it }))
    }));

    // Filtrar itens de acordo com permissões
    groups.forEach((group) => {
      group.items = group.items.filter((item) => {
        // Gestão Fiscal - apenas para roles específicas
        if (item.itemId === "gestao_fiscal") {
          return canAccessFinancialControl;
        }

        // Dashboard Gestor - apenas para admin/gestor_master
        if (item.itemId === "dashboard_gestor") {
          return canManageUsersGlobal;
        }

        // Acesso Gestor - apenas para admin/gestor_master
        if (item.itemId === "acesso_gestor") {
          return canManageUsersGlobal;
        }

        // Usuários - apenas para admin/gestor
        if (item.itemId === "admin_usuarios") {
          return canManageUsersGlobal;
        }

        return true;
      });
    });

    // Remover grupos vazios
    return groups.filter((group) => group.items.length > 0);
  }, [canManageUsersGlobal, canAccessFinancialControl]);

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title]
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-16 h-[calc(100vh-4rem)] aviation-gradient-card border-r border-border transition-all duration-300 custom-scrollbar overflow-y-auto z-50",
        isOpen ? "w-64" : "w-0"
      )}
    >
      {isOpen && (
        <>
          <div className="p-4 border-b border-border bg-gradient-card">
            <h2 className="text-foreground font-semibold text-primary">Menu Principal</h2>
          </div>

          <nav className="p-3 space-y-4">
            {filteredMenuGroups.map((group) => (
              <Card
                key={group.title}
                className="bg-gradient-card border-border shadow-card static-card rounded-lg"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-foreground flex items-center">
                    {group.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {group.items.map((item) => (
                    <div key={item.title}>
                      {item.isSSOLink ? (
                        // Link SSO para app do gestor
                        <button
                          onClick={handleGestorAccess}
                          className="flex items-center w-full px-3 py-2 rounded-md text-sm font-medium border border-border hover:bg-amber-600/20 hover:border-amber-500/50 transition-smooth text-amber-400"
                        >
                          {item.icon && <item.icon className="mr-3 h-4 w-4" />}
                          {item.title}
                        </button>
                      ) : item.isExternal ? (
                        // Link Externo (Controle Financeiro)
                        <a
                          href={item.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center px-3 py-2 rounded-md text-sm font-medium border border-border hover:bg-accent hover:border-primary transition-smooth text-foreground"
                        >
                          {item.icon && <item.icon className="mr-3 h-4 w-4 text-primary" />}
                          {item.title}
                        </a>
                      ) : item.isExpandable ? (
                        // Item Expansível
                        <Collapsible
                          open={expandedItems.includes(item.title)}
                          onOpenChange={() => toggleExpanded(item.title)}
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-between border-border hover:bg-accent hover:border-primary transition-smooth rounded-md"
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
                                      ? "bg-cyan-700 text-white shadow-primary border-primary"
                                      : "text-foreground border-border hover:bg-accent hover:border-primary"
                                  )
                                }
                              >
                                {subItem.title}
                              </NavLink>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      ) : (
                        // Link Simples
                        <NavLink
                          to={item.href || "#"}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center px-3 py-2 rounded-md text-sm font-medium border transition-smooth",
                              isActive
                                ? "bg-cyan-700 text-white shadow-primary border-primary"
                                : "text-foreground border-border hover:bg-accent hover:border-primary"
                            )
                          }
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
        </>
      )}
    </aside>
  );
};
