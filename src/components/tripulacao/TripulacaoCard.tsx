import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail, Phone, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { CrewMember, CrewRole } from "@/services/crew";
import { ROLE_LABELS } from "@/lib/roles";
import type { AppRole } from "@/lib/roles";

interface TripulacaoCardProps {
  member: CrewMember;
}

const ROLE_BADGE_VARIANT: Partial<Record<AppRole, "default" | "secondary">> = {
  tripulante: "secondary",
  piloto_chefe: "default",
  admin: "default",
  financeiro: "secondary",
  financeiro_master: "default",
  operacoes: "secondary",
  gestor_master: "default",
  cotista: "secondary",
  adm: "default",
  cliente: "secondary",
  coordenador_de_voo: "secondary",
};

const formatPhone = (phone: string | null) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

export function TripulacaoCard({ member }: TripulacaoCardProps) {
  const navigate = useNavigate();
  const formattedPhone = formatPhone(member.phone);

  return (
    <Card
      className="h-full cursor-pointer transition hover:shadow-lg"
      onClick={() => {
        navigate(`/tripulacao/${member.id}`, { state: { member } });
      }}
    >
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 flex-shrink-0">
            <AvatarImage src={member.avatar_url ?? undefined} alt={member.full_name} />
            <AvatarFallback className="bg-primary text-primary-foreground">{getInitials(member.full_name)}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{member.full_name}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {member.roles.map((role) => (
                <Badge key={role} variant={ROLE_BADGE_VARIANT[role] || "secondary"} className="text-xs">
                  {ROLE_LABELS[role]}
                </Badge>
              ))}
            </div>

            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {member.email && (
                <div className="flex items-center gap-2 truncate">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="truncate">{member.email}</span>
                </div>
              )}

              {formattedPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <span>{formattedPhone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
