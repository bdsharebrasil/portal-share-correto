import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail, Phone, MapPin, Plane, Building2 } from "lucide-react";

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
  status?: string | null;
  codigo_cliente?: string | null;
}

interface ClienteCardProps {
  cliente: Cliente;
  onView?: (cliente: Cliente) => void;
  onEdit?: (cliente: Cliente) => void;
  onDelete?: (id: string) => void;
}

export function ClienteCard({ cliente, onView }: ClienteCardProps) {
  const getInitials = (name: string) =>
    name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const location = [cliente.cidade, cliente.uf].filter(Boolean).join(", ");

  return (
    <Card
      className="group cursor-pointer border-slate-800 bg-slate-900/40 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-200"
      onClick={() => onView?.(cliente)}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar className="h-14 w-14 rounded-xl ring-2 ring-cyan-400/30 flex-shrink-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            {cliente.url_logo ? <AvatarImage src={cliente.url_logo} alt={cliente.razao_social || ""} className="object-contain p-1" /> : null}
            <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-500 text-white font-bold text-sm rounded-xl">
              {getInitials(cliente.razao_social || "?")}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-base truncate group-hover:text-cyan-400 transition-colors">
              {cliente.razao_social}
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{cliente.cnpj}</p>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {cliente.tem_socio && (
                <Badge variant="secondary" className="text-xs bg-violet-500/15 text-violet-300 border-violet-500/30">
                  Cotistas
                </Badge>
              )}
              {cliente.codigo_cliente && (
                <Badge variant="secondary" className="text-xs bg-blue-500/15 text-blue-300 border-blue-500/30 font-mono">
                  {cliente.codigo_cliente}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Contact details */}
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
          {cliente.telefone && (
            <div className="flex items-center gap-2.5 text-sm">
              <Phone className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
              <span className="text-slate-300 truncate">{cliente.telefone}</span>
            </div>
          )}
          {cliente.email && (
            <div className="flex items-center gap-2.5 text-sm">
              <Mail className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
              <span className="text-slate-300 truncate">{cliente.email}</span>
            </div>
          )}
          {location && (
            <div className="flex items-center gap-2.5 text-sm">
              <MapPin className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
              <span className="text-slate-400 truncate">{location}</span>
            </div>
          )}
          {cliente.contato_financeiro && (
            <div className="flex items-center gap-2.5 text-sm">
              <Building2 className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
              <span className="text-slate-400 truncate">{cliente.contato_financeiro}</span>
            </div>
          )}
        </div>

        {/* Aircraft */}
        {cliente.aircraft_ownerships && cliente.aircraft_ownerships.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Plane className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Aeronaves</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cliente.aircraft_ownerships.slice(0, 4).map((ownership, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs bg-slate-800 text-slate-300 border-slate-700">
                  {ownership.aircraft_registration} <span className="text-slate-500 ml-1">({ownership.ownership_percentage}%)</span>
                </Badge>
              ))}
              {cliente.aircraft_ownerships.length > 4 && (
                <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                  +{cliente.aircraft_ownerships.length - 4}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
