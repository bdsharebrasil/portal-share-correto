import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, Mail, Phone, MapPin, FileCheck, Plane } from "lucide-react";

interface AeronavePropriedade {
  aircraft: string;
  aircraft_registration?: string;
  aircraft_model?: string;
  ownership_percentage: number;
}

interface Cliente {
  id: string;
  razao_social: string | null;
  cnpj: string | null;
  proprietario?: string | null;
  inscricao_estadual?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  telefone?: string | null;
  email?: string | null;
  contato_financeiro?: string | null;
  observacoes?: string | null;
  url_logo?: string | null;
  aircraft_ownerships?: AeronavePropriedade[];
  tem_socio?: boolean;
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

  const location = [cliente.cidade, cliente.uf].filter(Boolean).join(' - ');

  return (
    <Card className="group cursor-pointer relative overflow-hidden border-border/50 bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300" onClick={handleCardClick}>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <CardContent className="p-5 my-0 py-0">
        <div className="mb-4 shadow-sm bg-transparent px-0 flex-col flex items-center justify-center pt-2 pb-3">
          <Avatar className="h-20 w-20 ring-2 ring-cyan-400/50 shadow-lg flex-shrink-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            {cliente.url_logo ? <AvatarImage src={cliente.url_logo} alt={cliente.razao_social} className="object-contain p-1" /> : null}
            <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-500 text-white font-bold text-lg">
              {getInitials(cliente.razao_social)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 w-full px-2 mt-3">
            <h3 className="font-bold text-foreground text-sm leading-snug text-center group-hover:text-cyan-400 transition-colors line-clamp-3">
              {cliente.razao_social}
            </h3>
            <p className="text-xs text-muted-foreground font-mono mt-1.5 text-center break-all">
              {cliente.cnpj}
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {cliente.tem_socio && (
            <div className="mt-2 pt-2 border-t border-border">
              <Badge variant="secondary" className="text-xs">
                👥 Sociedade de Cotistas
              </Badge>
            </div>
          )}

          {cliente.telefone && <div className="flex items-center gap-2.5 text-sm justify-center">
              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground truncate">{cliente.telefone}</span>
            </div>}

          {cliente.email && <div className="flex items-center gap-2.5 text-sm justify-center">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0 text-orange-400" />
              <span className="text-foreground truncate">{cliente.email}</span>
            </div>}

          {location && <div className="gap-2.5 text-sm flex items-center justify-center">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 text-red-600" />
              <span className="text-foreground truncate">{location}</span>
            </div>}

          {cliente.contato_financeiro && <div className="gap-2.5 text-sm flex items-center justify-center">
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0 text-zinc-500" />
              <span className="text-foreground truncate">{cliente.contato_financeiro}</span>
            </div>}
        </div>

        {(cliente as any).aircraft_ownerships && (cliente as any).aircraft_ownerships.length > 0 && <div className="mt-4 pt-3 border-t border-border/50 my-[15px] py-[14px]">
            <div className="gap-2 mb-2 flex items-center justify-center">
              <Plane className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aeronaves</span>
            </div>
            <div className="flex-wrap gap-1.5 rounded-md shadow-sm bg-transparent flex items-center justify-center">
              {(cliente as any).aircraft_ownerships.slice(0, 3).map((ownership: any, idx: number) => <Badge key={idx} variant="secondary" className="text-xs font-medium px-2 py-0.5 border border-slate-900 rounded-md shadow-sm bg-[#041a28]/[0.72]">
                  {ownership.aeronave_registration || ownership.aircraft_registration} <span className="text-muted-foreground ml-1">({ownership.ownership_percentage}%)</span>
                </Badge>)}
              {(cliente as any).aircraft_ownerships.length > 3 && <Badge variant="outline" className="text-xs px-2 py-0.5">
                  +{(cliente as any).aircraft_ownerships.length - 3}
                </Badge>}
            </div>
          </div>}

        {cliente.inscricao_estadual && <div className="gap-2 mt-4 pt-3 border-t border-border/50 flex items-center justify-center py-[22px]">
            <Badge variant="outline" className="text-xs font-normal rounded-md mx-[50px] px-[18px]">
                I/E: {cliente.inscricao_estadual}
              </Badge>
          </div>}

        {!cliente.tem_socio && !cliente.telefone && !cliente.email && !location && !cliente.contato_financeiro && !(cliente as any).aircraft_ownerships?.length && <p className="text-sm text-muted-foreground text-center py-4">
            Clique para ver detalhes
          </p>}
      </CardContent>
    </Card>
  );
}
