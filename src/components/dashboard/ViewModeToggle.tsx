import { cn } from "@/lib/utils";
import { useViewMode, ViewMode } from "@/contexts/ViewModeContext";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

const modes: { id: ViewMode; label: string; path: string; separator?: boolean; allowedRoles?: string[] }[] = [
  { id: 'portal-cliente', label: 'Portal Cliente', path: '/portal-cliente' },
  { id: 'operacoes', label: 'Operações', path: '/operacoes', separator: true },
  { id: 'financeiro', label: 'Financeiro', path: '/financeiro' },
  { id: 'gestor', label: 'Gestor', path: '/gestor', allowedRoles: ['admin', 'financeiro_master', 'gestor_master'] },
];

export function ViewModeToggle() {
  const { viewMode, setViewMode } = useViewMode();
  const navigate = useNavigate();
  const { userRoles } = useUserRole();

  const handleModeChange = (mode: ViewMode, path: string) => {
    setViewMode(mode);
    navigate(path);
  };

  // Filter modes based on user roles
  const availableModes = modes.filter((mode) => {
    if (!mode.allowedRoles) return true; // Show mode if no role restriction
    return mode.allowedRoles.some((role) => (userRoles as string[]).includes(role));
  });

  return (
    <div className="flex items-center bg-background/50 rounded-lg p-1 border border-border gap-1">
      {availableModes.map((mode, index) => (
        <div key={mode.id} className="flex items-center gap-1">
          {mode.separator && <div className="h-6 w-px bg-border mx-1" />}
          <button
            onClick={() => handleModeChange(mode.id, mode.path)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
              viewMode === mode.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            {mode.label}
          </button>
        </div>
      ))}
    </div>
  );
}
