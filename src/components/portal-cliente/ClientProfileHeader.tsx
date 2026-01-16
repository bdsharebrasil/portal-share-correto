import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Download, Building } from "lucide-react";
import { Badge } from "@/components/ui/badge";
interface ClientProfileHeaderProps {
  clientName: string;
  clientStatus: string;
  clientSince?: string;
  logoUrl?: string;
  proprietario?: string;
  onBack: () => void;
  onEditProfile?: () => void;
  onGenerateReport?: () => void;
}
export function ClientProfileHeader({
  clientName,
  clientStatus,
  clientSince,
  logoUrl,
  proprietario,
  onBack,
  onEditProfile,
  onGenerateReport
}: ClientProfileHeaderProps) {
  return <div className="mb-8">
      <Button variant="outline" onClick={onBack} className="mb-6 gap-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      <div className="rounded-lg bg-slate-800/40 p-6 shadow-lg border border-white/10 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 flex-1">
            {/* Logo */}
            {logoUrl ? (
              <div className="flex-shrink-0">
                <div
                  className="h-16 w-16 rounded-lg border border-white/20 bg-cover bg-center"
                  style={{ backgroundImage: `url(${logoUrl})` }}
                />
              </div>
            ) : (
              <div className="flex-shrink-0 h-16 w-16 rounded-lg border border-white/20 bg-slate-700/50 flex items-center justify-center">
                <Building className="h-8 w-8 text-white/60" />
              </div>
            )}

            {/* Company Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white">
                {clientName}
              </h1>
              {proprietario && (
                <p className="text-sm text-muted-foreground mt-1">
                  Proprietário: <span className="text-white">{proprietario}</span>
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                {clientStatus === 'ativo' && (
                  <Badge className="bg-emerald-500 text-white">
                    Ativo
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap md:flex-nowrap">
            {onGenerateReport && (
              <Button
                onClick={onGenerateReport}
                className="gap-2 bg-slate-700 hover:bg-slate-600 text-white border-0"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Relatório</span>
              </Button>
            )}
            {onEditProfile && (
              <Button
                onClick={onEditProfile}
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                title="Editar Perfil"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>;
}
