import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  DollarSign,
  Users,
  Landmark,
  AlertTriangle,
  FileText,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  UserCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Financeiro", href: "/financeiro", icon: DollarSign },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Colaboradores", href: "/colaboradores", icon: UserCheck },
  { name: "Conciliação Bancária", href: "/conciliacao-bancaria", icon: Landmark },
  { name: "Notas Fiscais", href: "/notas-fiscais", icon: FileText },
  { name: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { name: "Inadimplência", href: "/inadimplencia", icon: AlertTriangle },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className={cn(
      "h-screen bg-gray-950/95 backdrop-blur-sm text-white transition-all duration-300 relative border-r border-gray-800/50 flex flex-col flex-shrink-0",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="h-[73px] px-4 border-b border-gray-800/50 flex items-center">
        <div className="flex items-center justify-between w-full gap-2">
          {!collapsed && (
            <div className="flex items-center gap-3 min-w-0">
              <img 
                src="/lovable-uploads/c689fe46-5b0a-4c9e-bbe2-0b3b653344d2.png"
                alt="Share Brasil Logo" 
                className="h-10 w-auto flex-shrink-0"
              />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors border border-gray-700/50 hover:border-gray-600/50 flex-shrink-0"
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-6 flex-1">
        <ul className="space-y-2 px-3">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.name}>
                <NavLink
                  to={item.href}
                  className={cn(
                    "flex items-center px-3 py-3 rounded-xl transition-all duration-200 group relative",
                    isActive 
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25" 
                      : "text-gray-300 hover:bg-gray-800/50 hover:text-white"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 flex-shrink-0 transition-all duration-200",
                    isActive ? "text-white" : "text-gray-400 group-hover:text-white"
                  )} />
                  {!collapsed && (
                    <span className="ml-3 text-sm font-medium">{item.name}</span>
                  )}
                  {isActive && (
                    <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-white rounded-l-full" />
                  )}
                </NavLink>
              </li>
            );
          })}

        </ul>
      </nav>

      {/* Logout Button */}
      <div className="p-3 border-t border-gray-800/50">
        <button
          className="flex items-center w-full px-3 py-3 rounded-xl text-gray-300 hover:bg-red-600/20 hover:text-red-400 transition-all duration-200"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && (
            <span className="ml-3 text-sm font-medium">Sair</span>
          )}
        </button>
      </div>

    </div>
  );
}
