import React, { useCallback, useMemo, useState, lazy, Suspense } from 'react';
import { Menu, LogOut, User, UserPlus, Users, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { useUserProfile } from '@/hooks/useUserProfile';
import { WeatherDisplay } from '@/components/weather/WeatherDisplay';

const NotificationBell = lazy(() =>
  import("@/components/notifications/NotificationBell").then(m => ({ default: m.NotificationBell }))
);

interface HeaderProps {
  onMenuClick: () => void;
  onRightMenuClick: () => void;
}

const getInitials = (input: string | null | undefined) => {
  if (!input) {
    return "";
  }

  const parts = input
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return input.slice(0, 2).toUpperCase();
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
};

export const Header: React.FC<HeaderProps> = ({ onMenuClick, onRightMenuClick }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, roles, signOut } = useAuth();
  const { isAdmin, isGestorMaster } = useUserRole();
  const { profile } = useUserProfile(user, { skipCreation: Boolean(isAdmin || isGestorMaster) });

  const [searchQuery, setSearchQuery] = React.useState("");

  // Regras de acesso refinadas
  const canManageUsersGlobal = useMemo(
    () => roles.includes("admin") || roles.includes("gestor_master"),
    [roles]
  );

  const canAccessEmployeePayroll = useMemo(
    () => roles.includes("admin") || roles.includes("gestor_master") || roles.includes("financeiro_master"),
    [roles]
  );

  const displayName = useMemo(
    () => profile?.display_name ?? profile?.full_name ?? user?.email ?? "Usuário",
    [profile?.display_name, profile?.full_name, user?.email]
  );

  const email = profile?.email ?? user?.email ?? "";
  const avatarInitials = useMemo(() => getInitials(displayName), [displayName]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      toast({ title: "Sessão encerrada", description: "Você saiu do portal com sucesso." });
      navigate("/login", { replace: true });
    } catch (error) {
      toast({ title: "Erro ao sair", description: "Não foi possível encerrar a sessão. Tente novamente.", variant: "destructive" });
    }
  }, [navigate, toast, signOut]);

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-gradient-to-r from-primary/5 to-secondary/5 border-b border-border z-50 shadow-lg">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Seção Esquerda */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onMenuClick}
            className="text-foreground hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            <img 
              src="https://cdn.builder.io/api/v1/image/assets%2Fc800a4ee1bbb404a92b07d7f3888df82%2Fbfc4d2f155334c849630cbcdfa5ac038?format=webp&width=800" 
              alt="Share Brasil" 
              className="h-8 w-8" 
            />
            <div className="hidden sm:block">
              <span className="text-lg lg:text-xl font-bold text-foreground">Gestão Share Brasil</span>
              <p className="text-xs text-muted-foreground">Portal do Colaborador</p>
            </div>
          </div>
        </div>

        {/* Barra de Pesquisa Central */}
        <div className="hidden md:flex flex-1 max-w-xl mx-8">
          <div className="relative w-full">
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <Input
              placeholder="Pesquisar no portal..."
              className="pl-10 bg-background/50 border-border"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Seção Direita */}
        <div className="flex items-center gap-2 lg:gap-4">
          <WeatherDisplay />

          <Suspense fallback={null}>
            <NotificationBell />
          </Suspense>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 border-2 border-primary hover:bg-accent">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    {avatarInitials || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 bg-card border-border shadow-elevated" align="end">
              <DropdownMenuLabel className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{displayName}</p>
                {email && <p className="text-xs text-muted-foreground">{email}</p>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />

              <DropdownMenuItem
                className="text-foreground hover:bg-accent cursor-pointer"
                onSelect={(event) => {
                  event.preventDefault();
                  navigate("/perfil");
                }}
              >
                <User className="mr-2 h-4 w-4" />
                Meu Perfil
              </DropdownMenuItem>

              {canManageUsersGlobal && (
                <DropdownMenuItem
                  className="text-foreground hover:bg-accent cursor-pointer"
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate("/gerenciar-usuarios");
                  }}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Gestão de Usuário
                </DropdownMenuItem>
              )}

              {canAccessEmployeePayroll && (
                <DropdownMenuItem
                  className="text-foreground hover:bg-accent cursor-pointer"
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate("/gestao-funcionarios");
                  }}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Gestão de Funcionários
                </DropdownMenuItem>
              )}

              {canAccessEmployeePayroll && (
                <DropdownMenuItem
                  className="text-foreground hover:bg-accent cursor-pointer"
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate("/gestao-salarios");
                  }}
                >
                  <Briefcase className="mr-2 h-4 w-4" />
                  Holerites e Salário
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator className="bg-border" />

              <DropdownMenuItem
                className="text-destructive hover:bg-destructive/10 cursor-pointer"
                onSelect={(event) => {
                  event.preventDefault();
                  void handleLogout();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={onRightMenuClick}
            className="text-foreground hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};
