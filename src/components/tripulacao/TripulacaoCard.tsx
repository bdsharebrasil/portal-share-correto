import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, CheckCircle, Clock, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToBR } from "@/lib/date-utils";

interface CrewLicense {
  id: string;
  tipo_habilitacao: string;
  data_validade: string | null;
  CMA?: string;
  validade_cma?: string | null;
  FS_RH?: string | null;
  // Backward compatibility
  license_type?: string;
  expiry_date?: string | null;
}

interface CrewMember {
  id: string;
  nome_completo: string;
  canac: string;
  email?: string;
  telefone?: string;
  url_avatar?: string;
  status: string;
  // Backward compatibility
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  status?: string;
  user_id?: string;
}

interface CrewMemberCardProps {
  member: CrewMember;
}

const formatPhone = (phone: string | undefined) => {
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

type LicenseStatus = "active" | "expiring" | "expired";

const getLicenseStatus = (expiryDate: string | null | undefined): LicenseStatus => {
  if (!expiryDate) return "expired";
  const expiry = new Date(expiryDate);
  const today = new Date();
  const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 60) return "expiring";
  return "active";
};

const statusConfig: Record<LicenseStatus, { label: string; badgeColor: string; textColor: string; cardBg: string; cardBorder: string; Icon: typeof CheckCircle }> = {
  active: { label: "ATIVA", badgeColor: "bg-emerald-500/20 border-emerald-500/50", textColor: "text-emerald-400", cardBg: "bg-gradient-to-r from-emerald-500/10 to-emerald-600/5", cardBorder: "border-emerald-500/30", Icon: CheckCircle },
  expiring: { label: "VENCENDO", badgeColor: "bg-amber-500/20 border-amber-500/50", textColor: "text-amber-400", cardBg: "bg-gradient-to-r from-amber-500/10 to-amber-600/5", cardBorder: "border-amber-500/30", Icon: Clock },
  expired: { label: "VENCIDA", badgeColor: "bg-red-500/20 border-red-500/50", textColor: "text-red-400", cardBg: "bg-gradient-to-r from-red-500/10 to-red-600/5", cardBorder: "border-red-500/30", Icon: XCircle },
};

export function CrewMemberCard({ member }: CrewMemberCardProps) {
  const navigate = useNavigate();
  const [licenses, setLicenses] = useState<CrewLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const formattedPhone = formatPhone(member.telefone);

  useEffect(() => {
    const fetchLicenses = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("habilitacoes_tripulante")
          .select("id, tipo_habilitacao, data_validade, CMA, validade_cma, FS_RH")
          .eq("membro_tripulacao_id", member.id)
          .order("data_validade", { ascending: true });

        if (!error && data) {
          setLicenses(data);
        }
      } catch (e) {
        console.error("Error fetching licenses:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchLicenses();
  }, [member.id]);

  const displayLicenses = licenses;
  const cmaLicense = licenses.find(l => l.CMA && l.validade_cma);

  return (
    <Card
      className="group cursor-pointer bg-gradient-to-br from-slate-900/80 to-slate-950/80 border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300 overflow-hidden"
      onClick={() => navigate(`/tripulacao/${member.id}?tab=dados`)}
    >
      {/* Header */}
      <div className="p-4 pb-3 border-b border-slate-800/50">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-cyan-500/30 group-hover:ring-cyan-500/50 transition-all flex-shrink-0">
            <AvatarImage src={member.avatar_url} alt={member.full_name} className="object-cover" />
            <AvatarFallback className="bg-slate-800 text-slate-300 font-semibold text-lg">
              {getInitials(member.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground text-base leading-tight line-clamp-1 group-hover:text-cyan-400 transition-colors">
              {member.full_name}
            </h3>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className="bg-cyan-500/30 border-cyan-400 text-cyan-300 text-xs font-mono px-2.5 py-1 font-bold border">
                ⚜ ANAC: {member.canac}
              </Badge>
            </div>

            {formattedPhone && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
                <Phone className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{formattedPhone}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Habilitações */}
      {!loading && displayLicenses.length > 0 && (
        <div className="px-4 py-4 border-b border-slate-800/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">
            Habilitações
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {displayLicenses.map((license) => {
              const expiryDate = license.tipo_habilitacao === 'CMA' ? license.validade_cma : license.data_validade;
              const status = getLicenseStatus(expiryDate);
              const config = statusConfig[status];

              return (
                <div
                  key={license.id}
                  className={`${config.cardBg} border ${config.cardBorder} rounded-lg p-3 hover:border-opacity-50 transition-colors`}
                >
                  <p className="text-xs font-semibold text-slate-300 mb-2">{license.tipo_habilitacao}</p>
                  <p className="text-xs text-slate-400 mb-2">{formatDateToBR(expiryDate)}</p>
                  <Badge className={`${config.badgeColor} ${config.textColor} text-xs font-semibold w-full justify-center border`}>
                    {config.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CMA Info */}
      {cmaLicense && (
        <div className={`px-4 py-4 border-b ${statusConfig[getLicenseStatus(cmaLicense.validade_cma)].cardBg} border-slate-800/50`}>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-2">CMA</p>
              <p className="text-sm font-bold text-slate-200">
                {cmaLicense.CMA === 'primeira' ? '1° Classe' : cmaLicense.CMA === 'segunda' ? '2° Classe' : cmaLicense.CMA}
              </p>
            </div>
            <div className="text-center border-l border-r border-slate-700/50">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-2">Validade</p>
              <p className={`text-sm font-bold ${statusConfig[getLicenseStatus(cmaLicense.validade_cma)].textColor}`}>
                {formatDateToBR(cmaLicense.validade_cma)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-2">FS/RH</p>
              <p className="text-sm font-bold text-slate-200">
                {cmaLicense.FS_RH || '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-slate-800/20 text-center border-t border-slate-800/50">
        <p className="text-[10px] text-cyan-400/70 uppercase tracking-wider font-bold group-hover:text-cyan-300 transition-colors">
          Clique para ver mais
        </p>
      </div>
    </Card>
  );
}
