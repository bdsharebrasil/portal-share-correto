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
  nome_completo?: string;
  canac: string;
  email?: string;
  telefone?: string;
  url_avatar?: string;
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

const getInitials = (name: string | undefined): string => {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
};

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
  active: { label: "ATIVA", badgeColor: "bg-emerald-500/20 border-emerald-500/40", textColor: "text-emerald-300", cardBg: "bg-slate-900/80", cardBorder: "border-emerald-500/20", Icon: CheckCircle },
  expiring: { label: "VENCENDO", badgeColor: "bg-amber-500/20 border-amber-500/40", textColor: "text-amber-300", cardBg: "bg-slate-900/80", cardBorder: "border-amber-500/20", Icon: Clock },
  expired: { label: "VENCIDA", badgeColor: "bg-red-500/20 border-red-500/40", textColor: "text-red-300", cardBg: "bg-slate-900/80", cardBorder: "border-red-500/20", Icon: XCircle },
};

export function CrewMemberCard({ member }: CrewMemberCardProps) {
  const navigate = useNavigate();
  const [licenses, setLicenses] = useState<CrewLicense[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve campos com fallback para compatibilidade retroativa
  const displayName = member.nome_completo ?? member.full_name ?? "";
  const displayAvatar = member.url_avatar ?? member.avatar_url;
  const displayPhone = member.telefone ?? member.phone;
  const formattedPhone = formatPhone(displayPhone);

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
      className="group cursor-pointer bg-slate-950/80 border border-slate-800/70 hover:border-slate-700/80 hover:shadow-sm transition-all duration-200 overflow-hidden"
      onClick={() => navigate(`/tripulacao/${member.id}?tab=dados`)}
    >
      {/* Header */}
      <div className="p-3 pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 ring-1 ring-slate-700/70 flex-shrink-0">
            <AvatarImage src={displayAvatar} alt={displayName} className="object-cover" />
            <AvatarFallback className="bg-slate-800 text-slate-300 font-semibold text-base">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-100 text-base leading-tight line-clamp-1">
              {displayName}
            </h3>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className="bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold px-2.5 py-1 rounded-full">
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
        <div className="px-4 py-3 border-b border-slate-800/60">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-semibold mb-3">
            Habilitações
          </p>

          <div className="grid grid-cols-2 gap-2">
            {displayLicenses.map((license) => {
              const expiryDate = license.tipo_habilitacao === 'CMA' ? license.validade_cma : license.data_validade;
              const status = getLicenseStatus(expiryDate);
              const config = statusConfig[status];

              return (
                <div
                  key={license.id}
                  className={`${config.cardBg} border ${config.cardBorder} rounded-2xl p-3 transition-colors`}
                >
                  <p className="text-xs font-semibold text-slate-200 mb-1">{license.tipo_habilitacao}</p>
                  <p className="text-[11px] text-slate-400 mb-2">{formatDateToBR(expiryDate)}</p>
                  <Badge className={`${config.badgeColor} ${config.textColor} text-[10px] font-semibold w-full justify-center border`}>
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
        <div className={`px-4 py-3 border-b ${statusConfig[getLicenseStatus(cmaLicense.validade_cma)].cardBg} border-slate-800/60`}>
          <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300">
            <div className="text-center">
              <p className="uppercase tracking-[0.24em] text-slate-500 font-semibold mb-1">CMA</p>
              <p className="font-semibold text-slate-100">
                {cmaLicense.CMA === 'primeira' ? '1° Classe' : cmaLicense.CMA === 'segunda' ? '2° Classe' : cmaLicense.CMA}
              </p>
            </div>
            <div className="text-center border-l border-r border-slate-800/60 px-2">
              <p className="uppercase tracking-[0.24em] text-slate-500 font-semibold mb-1">Validade</p>
              <p className={`font-semibold ${statusConfig[getLicenseStatus(cmaLicense.validade_cma)].textColor}`}>
                {formatDateToBR(cmaLicense.validade_cma)}
              </p>
            </div>
            <div className="text-center">
              <p className="uppercase tracking-[0.24em] text-slate-500 font-semibold mb-1">FS/RH</p>
              <p className="font-semibold text-slate-100">
                {cmaLicense.FS_RH || '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-slate-800/20 text-center border-t border-slate-800/50">
        <p className="text-[10px] text-slate-400/70 uppercase tracking-wider font-bold transition-colors">
          Clique para ver mais
        </p>
      </div>
    </Card>
  );
}