import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building, Mail, Phone, MapPin, FileText, Edit, Trash2 } from "lucide-react";

interface Cliente {
  id: string;
  company_name: string;
  cnpj: string;
  inscricao_estadual?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  financial_contact?: string;
  observations?: string;
  cnpj_card_url?: string;
  logo_url?: string;
}

interface ClienteCardProps {
  cliente: Cliente;
  onView?: (cliente: Cliente) => void;
  onEdit?: (cliente: Cliente) => void;
  onDelete?: (id: string) => void;
}

export function ClienteCard({ cliente, onView, onEdit, onDelete }: ClienteCardProps) {
  const handleCardClick = () => {
    if (onView) {
      onView(cliente);
    }
  };

  return (
    <Card className="hover:shadow-xl transition-all duration-300 group cursor-pointer relative overflow-hidden flex flex-col bg-gradient-card border-border shadow-card hover:border-primary" onClick={handleCardClick}>
      {/* Action Buttons */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(cliente);
            }}
            className="h-8 w-8 p-0 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 hover:text-blue-700"
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(cliente.id);
            }}
            className="h-8 w-8 p-0 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <CardContent className="p-5 space-y-4 flex-1 flex flex-col">
        {/* Logo e Nome */}
        <div className="space-y-3">
          <div className="flex items-center justify-center">
            {cliente.logo_url ? (
              <Avatar className="h-16 w-16 ring-4 ring-primary/30">
                <AvatarImage src={cliente.logo_url} alt={cliente.company_name} />
                <AvatarFallback className="bg-gradient-to-br from-primary/30 to-cyan-500/30">
                  <Building className="h-8 w-8 text-primary" />
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/30 to-cyan-500/30 flex items-center justify-center ring-4 ring-primary/30">
                <Building className="h-8 w-8 text-primary" />
              </div>
            )}
          </div>

          <div className="text-center space-y-1">
            <h3 className="font-bold text-base text-foreground line-clamp-2">
              {cliente.company_name}
            </h3>
            <Badge variant="secondary" className="text-xs justify-center w-full font-mono">
              {cliente.cnpj}
            </Badge>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />

        {/* Informações de Contato */}
        <div className="space-y-3 flex-1">
          {cliente.phone && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Phone className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Telefone</p>
                <p className="text-sm font-medium text-foreground break-all">{cliente.phone}</p>
              </div>
            </div>
          )}

          {cliente.email && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">E-mail</p>
                <p className="text-sm font-medium text-foreground truncate">{cliente.email}</p>
              </div>
            </div>
          )}

          {(cliente.address || cliente.city) && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Local</p>
                <p className="text-sm font-medium text-foreground">
                  {[cliente.address, cliente.city].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          )}

          {cliente.financial_contact && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Building className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Contato Financeiro</p>
                <p className="text-sm font-medium text-foreground truncate">{cliente.financial_contact}</p>
              </div>
            </div>
          )}

          {!cliente.phone && !cliente.email && !cliente.address && !cliente.city && !cliente.financial_contact && (
            <p className="text-sm text-muted-foreground text-center py-2">Sem informações de contato</p>
          )}
        </div>

        {/* Badges com informações adicionais */}
        {(cliente.inscricao_estadual || cliente.cnpj_card_url) && (
          <>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
            <div className="flex flex-wrap gap-2">
              {cliente.inscricao_estadual && (
                <Badge variant="secondary" className="text-xs px-2 py-1">
                  I/E: {cliente.inscricao_estadual}
                </Badge>
              )}
              {cliente.cnpj_card_url && (
                <Badge variant="outline" className="text-xs px-2 py-1 flex items-center gap-1 bg-green-50/50 dark:bg-green-900/10 border-green-200/50 dark:border-green-800/50 text-green-700 dark:text-green-400">
                  <FileText className="h-3 w-3" />
                  Documento
                </Badge>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
