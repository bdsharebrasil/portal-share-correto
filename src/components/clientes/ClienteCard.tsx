import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, Mail, Phone, MapPin, FileCheck, Edit, Trash2, Plane } from "lucide-react";
interface AircraftOwnership {
  aircraft: string;
  aircraft_registration?: string;
  aircraft_model?: string;
  ownership_percentage: number;
}
interface Cliente {
  id: string;
  company_name: string;
  cnpj: string;
  inscricao_estadual?: string;
  address?: string;
  city?: string;
  uf?: string;
  phone?: string;
  email?: string;
  financial_contact?: string;
  observations?: string;
  cnpj_card_url?: string;
  logo_url?: string;
  aircraft_ownerships?: AircraftOwnership[];
}
interface ClienteCardProps {
  cliente: Cliente;
  onView?: (cliente: Cliente) => void;
  onEdit?: (cliente: Cliente) => void;
  onDelete?: (id: string) => void;
}
export function ClienteCard({
  cliente,
  onView,
  onEdit,
  onDelete
}: ClienteCardProps) {
  const handleCardClick = () => {
    if (onView) {
      onView(cliente);
    }
  };
  const getInitials = (name: string) => {
    return name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  };
  const location = [cliente.city, cliente.uf].filter(Boolean).join(' - ');
  return <Card className="group cursor-pointer relative overflow-hidden border-border/50 bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300" onClick={handleCardClick}>
      {/* Gradient accent top */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* Action Buttons */}
      <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
        {onEdit && <Button variant="secondary" size="icon" onClick={e => {
        e.stopPropagation();
        onEdit(cliente);
      }} className="h-8 w-8 rounded-full shadow-md hover:shadow-lg">
            <Edit className="h-3.5 w-3.5" />
          </Button>}
        {onDelete && <Button variant="secondary" size="icon" onClick={e => {
        e.stopPropagation();
        onDelete(cliente.id);
      }} className="h-8 w-8 rounded-full shadow-md hover:shadow-lg hover:bg-destructive hover:text-destructive-foreground">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>}
      </div>

      <CardContent className="p-5">
        {/* Header com Avatar e Nome */}
        <div className="gap-4 mb-4 shadow-sm flex items-center justify-start bg-transparent">
          <Avatar className="h-14 w-14 ring-2 ring-border shadow-sm flex-shrink-0">
            {cliente.logo_url ? <AvatarImage src={cliente.logo_url} alt={cliente.company_name} className="object-cover" /> : null}
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-bold text-lg">
              {getInitials(cliente.company_name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {cliente.company_name}
            </h3>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {cliente.cnpj}
            </p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="space-y-2.5">
          {cliente.phone && <div className="flex items-center gap-2.5 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground truncate">{cliente.phone}</span>
            </div>}

          {cliente.email && <div className="flex items-center gap-2.5 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0 text-orange-400" />
              <span className="text-foreground truncate">{cliente.email}</span>
            </div>}

          {location && <div className="flex items-center gap-2.5 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 text-red-600" />
              <span className="text-foreground truncate">{location}</span>
            </div>}

          {cliente.financial_contact && <div className="flex items-center gap-2.5 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0 text-zinc-500" />
              <span className="text-foreground truncate">{cliente.financial_contact}</span>
            </div>}
        </div>

        {/* Aeronaves */}
        {cliente.aircraft_ownerships && cliente.aircraft_ownerships.length > 0 && <div className="mt-4 pt-3 border-t border-border/50 py-[36px]">
            <div className="flex items-center gap-2 mb-2">
              <Plane className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aeronaves</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cliente.aircraft_ownerships.slice(0, 3).map((ownership, idx) => <Badge key={idx} variant="secondary" className="text-xs font-medium px-2 py-0.5 rounded-lg border border-slate-900 bg-[#03121c]/[0.84]">
                  {ownership.aircraft_registration} <span className="text-muted-foreground ml-1">({ownership.ownership_percentage}%)</span>
                </Badge>)}
              {cliente.aircraft_ownerships.length > 3 && <Badge variant="outline" className="text-xs px-2 py-0.5">
                  +{cliente.aircraft_ownerships.length - 3}
                </Badge>}
            </div>
          </div>}

        {/* Footer badges */}
        {(cliente.inscricao_estadual || cliente.cnpj_card_url) && <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
            {cliente.inscricao_estadual && <Badge variant="outline" className="text-xs font-normal rounded-md">
                I/E: {cliente.inscricao_estadual}
              </Badge>}
            {cliente.cnpj_card_url && <Badge variant="outline" className="text-xs gap-1 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">
                <FileCheck className="h-3 w-3" />
                Doc
              </Badge>}
          </div>}

        {!cliente.phone && !cliente.email && !location && !cliente.financial_contact && !cliente.aircraft_ownerships?.length && <p className="text-sm text-muted-foreground text-center py-4">
            Clique para ver detalhes
          </p>}
      </CardContent>
    </Card>;
}