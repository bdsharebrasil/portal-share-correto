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
      className="group cursor-pointer relative overflow-hidden border-white/30 bg-slate-900/30 hover:shadow-lg transition-shadow"
      onClick={() => {
        navigate(`/tripulacao/${member.id}`, { state: { member } });
      }}
    >
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header with Name and Role */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <User className="h-5 w-5 text-slate-300 flex-shrink-0" />
                <h3 className="font-bold text-white text-lg uppercase">
                  {member.full_name}
                </h3>
              </div>
              {member.roles.length > 0 && (
                <div className="ml-8 flex flex-wrap gap-2">
                  {member.roles.map((role) => (
                    <Badge key={role} variant={ROLE_BADGE_VARIANT[role] || "secondary"} className="text-xs font-medium">
                      {ROLE_LABELS[role]}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Email */}
          {member.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-300">{member.email}</span>
            </div>
          )}

          {/* Phone */}
          {formattedPhone && (
            <div className="border-t border-white/20 pt-3">
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span>{formattedPhone}</span>
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
