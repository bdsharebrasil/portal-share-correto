import React, { useCallback, useMemo, useState, lazy, Suspense, useEffect } from 'react';
import { Menu, LogOut, User, Users, Clock, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { useUserProfile } from '@/hooks/useUserProfile';
import WeatherWidget from '@/components/weather/WeatherWidget';
import { ViewModeToggle } from '@/components/dashboard/ViewModeToggle';
import { BirthdayAlert } from '@/components/notificacoes/BirthdayAlert';

const NotificationBell = lazy(() => import("@/components/notificacoes/NotificationBell"));

interface HeaderProps {
  onMenuClick: () => void;
}

const getInitials = (input: string | null | undefined) => {
  if (!input) {
    return "";
  }
  const parts = input.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return input.slice(0, 2).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
};

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, roles, signOut } = useAuth();
  const { isAdmin, isGestorMaster } = useUserRole();
  const { profile } = useUserProfile(user, {
    skipCreation: Boolean(isAdmin || isGestorMaster)
  });

  const [searchQuery, setSearchQuery] = React.useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatUtcTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC'
    });
  };

  const canManageUsersGlobal = useMemo(() => roles.includes("admin") || roles.includes("gestor_master"), [roles]);
  const displayName = useMemo(() => profile?.display_name ?? profile?.full_name ?? user?.email ?? "Usuário", [profile?.display_name, profile?.full_name, user?.email]);
  const email = profile?.email ?? user?.email ?? "";
  const avatarInitials = useMemo(() => getInitials(displayName), [displayName]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      toast({
        title: "Sessão encerrada",
        description: "Você saiu do portal com sucesso."
      });
      navigate("/login", {
        replace: true
      });
    } catch (error) {
      toast({
        title: "Erro ao sair",
        description: "Não foi possível encerrar a sessão. Tente novamente.",
        variant: "destructive"
      });
    }
  }, [navigate, toast, signOut]);

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 border-b border-border/40 bg-background/70 backdrop-blur-md shadow-sm transition-all">
      <div className="flex items-center justify-between h-full px-3 sm:px-6 max-w-[100vw] overflow-visible">
        
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden h-10 w-10 p-0 hover:bg-secondary/50 rounded-full transition-colors"
          onClick={onMenuClick}
          title="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="md:hidden flex-1 min-w-0 mx-2 overflow-x-auto">
          <ViewModeToggle />
        </div>

        {/* View Mode & Search - Desktop */}
        <div className="hidden lg:flex items-center gap-4 flex-1">
          <ViewModeToggle />
        </div>

        {/* View Mode Toggle (Tablet) */}
        <div className="hidden md:flex lg:hidden items-center gap-2">
          <ViewModeToggle />
        </div>

        {/* Right Section: Widgets & Profile */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 ml-auto shrink-0 relative z-[60]">
          
          {/* Combined Clock Widget */}
          <div className="hidden xl:flex items-center bg-secondary/30 rounded-full border border-border/50 p-1 shadow-inner backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-background shadow-sm border border-border/40">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <p className="text-sm font-semibold text-foreground font-mono tracking-tight">
                {formatTime(currentTime)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1">
              <span className="text-[10px] font-bold tracking-widest text-primary/80">UTC</span>
              <p className="text-sm font-medium text-muted-foreground font-mono">
                {formatUtcTime(currentTime)}
              </p>
            </div>
          </div>

          {/* METAR / Weather Widget Wrapper */}
<div className="hidden md:flex items-center justify-center shrink-0 relative z-[70] overflow-visible">
            <WeatherWidget />
          </div>

          <BirthdayAlert />

          <Suspense fallback={<div className="w-8 h-8 rounded-full bg-secondary/50 animate-pulse" />}>
            <div className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-secondary/40 transition-colors cursor-pointer">
              <NotificationBell />
            </div>
          </Suspense>

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 ring-2 ring-transparent hover:ring-primary/30 transition-all">
                <Avatar className="h-9 w-9 border border-border/50 shadow-sm">
                  <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold text-xs">
                    {avatarInitials || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 bg-background/95 backdrop-blur-xl border-border/60 shadow-2xl rounded-xl p-1 mt-2" align="end">
              <DropdownMenuLabel className="space-y-1.5 p-3">
                <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
                {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/50 mx-2" />

              <div className="p-1 space-y-0.5">
                <DropdownMenuItem className="text-foreground rounded-lg hover:bg-secondary/60 cursor-pointer py-2.5 transition-colors" onSelect={(event) => {
                  event.preventDefault();
                  navigate("/perfil");
                }}>
                  <User className="mr-2.5 h-4 w-4 text-primary/70" />
                  Meu Perfil
                </DropdownMenuItem>

                {canManageUsersGlobal && (
                  <DropdownMenuItem className="text-foreground rounded-lg hover:bg-secondary/60 cursor-pointer py-2.5 transition-colors" onSelect={(event) => {
                    event.preventDefault();
                    navigate("/gerenciar-usuarios");
                  }}>
                    <Users className="mr-2.5 h-4 w-4 text-primary/70" />
                    Gestão de Usuário
                  </DropdownMenuItem>
                )}
              </div>

              <DropdownMenuSeparator className="bg-border/50 mx-2" />

              <div className="p-1">
                <DropdownMenuItem className="text-destructive rounded-lg hover:bg-destructive/15 cursor-pointer py-2.5 transition-colors focus:bg-destructive/15" onSelect={(event) => {
                  event.preventDefault();
                  void handleLogout();
                }}>
                  <LogOut className="mr-2.5 h-4 w-4" />
                  Sair da Conta
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>
    </header>
  );
};