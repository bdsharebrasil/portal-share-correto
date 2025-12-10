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
  return (
    <Card className="group cursor-pointer relative overflow-hidden border-white/30 bg-slate-900/30 hover:shadow-lg transition-shadow" onClick={handleCardClick}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header with Company Name and CNPJ */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="h-5 w-5 text-slate-300 flex-shrink-0" />
                <h3 className="font-bold text-white text-lg uppercase">
                  {cliente.company_name}
                </h3>
              </div>
              {cliente.cnpj && (
                <div className="ml-8">
                  <p className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">
                    {cliente.cnpj}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(cliente);
                  }}
                  className="h-8 w-8 p-0 hover:bg-slate-800"
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
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-slate-800"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Contact Information */}
          {cliente.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-300">{cliente.phone}</span>
            </div>
          )}

          {cliente.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-300">{cliente.email}</span>
            </div>
          )}

          {/* Location */}
          {location && (
            <div className="border-t border-white/20 pt-3">
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0 text-red-500" />
                <span>{location}</span>
              </p>
            </div>
          )}

          {/* Financial Contact */}
          {cliente.financial_contact && (
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-300">{cliente.financial_contact}</span>
            </div>
          )}

          {/* Aircrafts */}
          {cliente.aircraft_ownerships && cliente.aircraft_ownerships.length > 0 && (
            <div className="border-t border-white/20 pt-3">
              <p className="text-xs text-slate-400 mb-2 font-semibold uppercase flex items-center gap-2">
                <Plane className="h-4 w-4 flex-shrink-0" />
                Aeronaves
              </p>
              <div className="flex flex-wrap gap-2">
                {cliente.aircraft_ownerships.slice(0, 3).map((ownership, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs font-medium">
                    {ownership.aircraft_registration} ({ownership.ownership_percentage}%)
                  </Badge>
                ))}
                {cliente.aircraft_ownerships.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{cliente.aircraft_ownerships.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
