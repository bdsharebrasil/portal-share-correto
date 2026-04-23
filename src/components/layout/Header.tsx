import React, { useCallback, useMemo, useState, lazy, Suspense, useEffect } from 'react';
import { Menu, LogOut, User, Users, Clock } from 'lucide-react';
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
export const Header: React.FC<HeaderProps> = ({
  onMenuClick
}) => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    user,
    roles,
    signOut
  } = useAuth();
  const {
    isAdmin,
    isGestorMaster
  } = useUserRole();
  const {
    profile
  } = useUserProfile(user, {
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

  // Regras de acesso refinadas
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
  return <header className="fixed top-0 left-0 right-0 h-16 bg-gradient-to-r from-primary/5 to-secondary/5 border z-50 shadow-lg" style={{ borderColor: 'rgba(45, 52, 67, 0.09)' }}>
    <div className="flex items-center justify-between h-full px-4 lg:px-6 shadow-card bg-[#0f121a]/[0.86]">
      {/* Seção Esquerda */}
      <div className="flex items-center gap-4">
      </div>

      {/* View Mode Toggle - Center */}
      <div className="hidden md:flex items-center gap-4">
        <ViewModeToggle />
        <div className="relative w-64">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input placeholder="Buscar aeronave, tripulante..." className="pl-10 bg-background/50 border-border" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Clock */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-background/40 border border-border/50 backdrop-blur-sm">
        <Clock className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground font-mono">
          {formatTime(currentTime)}
        </p>
      </div>

      {/* Seção Direita */}
      <div className="flex items-center gap-2 lg:gap-4">
        <BirthdayAlert />

<WeatherWidget />
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

            <DropdownMenuItem className="text-foreground hover:bg-accent cursor-pointer" onSelect={(event) => {
              event.preventDefault();
              navigate("/perfil");
            }}>
              <User className="mr-2 h-4 w-4" />
              Meu Perfil
            </DropdownMenuItem>

            {canManageUsersGlobal && <DropdownMenuItem className="text-foreground hover:bg-accent cursor-pointer" onSelect={(event) => {
              event.preventDefault();
              navigate("/gerenciar-usuarios");
            }}>
              <Users className="mr-2 h-4 w-4" />
              Gestão de Usuário
            </DropdownMenuItem>}

            <DropdownMenuSeparator className="bg-border" />

            <DropdownMenuItem className="text-destructive hover:bg-destructive/10 cursor-pointer" onSelect={(event) => {
              event.preventDefault();
              void handleLogout();
            }}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </div>
  </header>;
};