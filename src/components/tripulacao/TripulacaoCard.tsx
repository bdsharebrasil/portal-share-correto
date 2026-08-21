import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, Clock, XCircle, ChevronDown, Phone, MapPin, FileText, Calendar, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToBR } from "@/lib/date-utils";
import { useNavigate } from "react-router-dom";

interface CrewLicense {
  id: string;
  tipo_habilitacao: string;
  data_validade: string | null;
  CMA?: string;
  validade_cma?: string | null;
  FS_RH?: string | null;
}

interface CrewMember {
  id: string;
  nome_completo?: string;
  canac: string;
  cpf?: string;
  data_nascimento?: string;
  tipo_licenca?: string;
  telefone?: string;
  url_avatar?: string;
  status?: string;
  user_id?: string;
}

interface CrewMemberCardProps {
  member: CrewMember;
  licenses?: CrewLicense[];
  loadingLicenses?: boolean;
}

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

const statusConfig: Record<LicenseStatus, { label: string; badgeColor: string; textColor: string; Icon: typeof CheckCircle }> = {
  active: { label: "VÁLIDA", badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", textColor: "text-emerald-400", Icon: CheckCircle },
  expiring: { label: "VENCENDO", badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30", textColor: "text-amber-400", Icon: Clock },
  expired: { label: "VENCIDA", badgeColor: "bg-red-500/20 text-red-400 border-red-500/30", textColor: "text-red-400", Icon: XCircle },
};

const InfoRow = ({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value?: string | null }) => (
  <div className="flex items-start gap-2">
    <Icon className="text-muted-foreground min-w-[16px] mt-0.5" size={15} />
    <div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</span>
      <p className="text-sm text-foreground">{value || <span className="text-muted-foreground italic">Sem informação</span>}</p>
    </div>
  </div>
);

export function CrewMemberCard({ member, licenses: propLicenses, loadingLicenses }: CrewMemberCardProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [licenses, setLicenses] = useState<CrewLicense[]>(propLicenses ?? []);
  const [loading, setLoading] = useState(loadingLicenses ?? !propLicenses);

  const displayName = member.nome_completo ?? "NOME NÃO INFORMADO";
  const displayAvatar = member.url_avatar;

  useEffect(() => {
    if (propLicenses) {
      setLicenses(propLicenses);
      setLoading(false);
      return;
    }

    const fetchLicenses = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("habilitacoes_tripulante")
          .select("id, tipo_habilitacao, data_validade, CMA, validade_cma, FS_RH")
          .eq("membro_tripulacao_id", member.id)
          .order("data_validade", { ascending: true });
        if (!error && data) setLicenses(data);
      } catch (e) {
        console.error("Error fetching licenses:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchLicenses();
  }, [member.id, propLicenses]);

  const displayLicenses = licenses.filter(l => l.tipo_habilitacao !== 'CMA');
  const cmaLicense = licenses.find(l => l.CMA && l.validade_cma);

  // Only show licenses that are expired or expiring (<=60 days)
  const alertLicenses = displayLicenses.filter(l => {
    const status = getLicenseStatus(l.data_validade);
    return status === 'expired' || status === 'expiring';
  });
  const cmaStatus = cmaLicense ? getLicenseStatus(cmaLicense.validade_cma) : null;
  const cmaIsAlert = cmaStatus === 'expired' || cmaStatus === 'expiring';

  const hasExpired = licenses.some(l => getLicenseStatus(l.tipo_habilitacao === 'CMA' ? l.validade_cma : l.data_validade) === 'expired');
  const avatarRingColor = hasExpired ? 'from-red-500 to-red-700' : 'from-emerald-500 to-emerald-700';

  return (
    <div
      className="group cursor-pointer bg-background border border-border hover:border-border hover:shadow-xl shadow-[1px_1px_11px_0_rgba(0,0,0,1)] transition-all duration-300 overflow-hidden w-full mx-auto flex flex-col relative rounded-2xl"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Collapsed view */}
      <div className="flex items-center gap-3 p-3">
        <div className={`p-0.5 rounded-full bg-gradient-to-tr ${avatarRingColor} shrink-0`}>
          <Avatar className="h-14 w-14 border-2 border-slate-950">
            <AvatarImage src={displayAvatar} alt={displayName} className="object-cover" />
            <AvatarFallback className="bg-card-secondary text-muted-foreground font-bold text-lg">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wide leading-tight truncate">
            {displayName}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            CANAC: <span className="text-foreground font-medium">{member.canac}</span>
          </p>
        </div>

        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition-transform duration-300 shrink-0 ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Alert licenses (expired / expiring) — always visible */}
      {!loading && (alertLicenses.length > 0 || cmaIsAlert) && (
        <div className="px-3 pb-3 flex flex-wrap gap-1.5">
          {alertLicenses.map(lic => {
            const status = getLicenseStatus(lic.data_validade);
            const cfg = statusConfig[status];
            const { Icon } = cfg;
            return (
              <Badge key={lic.id} className={`${cfg.badgeColor} text-[9px] font-bold border flex items-center gap-1 rounded-md px-2 py-0.5`}>
                <Icon size={10} />
                {lic.tipo_habilitacao}
              </Badge>
            );
          })}
          {cmaIsAlert && cmaLicense && (
            <Badge className={`${statusConfig[cmaStatus!].badgeColor} text-[9px] font-bold border flex items-center gap-1 rounded-md px-2 py-0.5`}>
              {(() => {
                const StatusIcon = statusConfig[cmaStatus!].Icon;
                return <StatusIcon size={10} />;
              })()}
              CMA
            </Badge>
          )}
        </div>
      )}

      {/* Expanded view */}
      {expanded && (
        <div
          className="border-t border-border bg-card/40 p-4 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Personal data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoRow icon={FileText} label="CPF" value={member.cpf} />
            <InfoRow icon={Calendar} label="Nascimento" value={member.data_nascimento ? formatDateToBR(member.data_nascimento) : null} />
            <InfoRow icon={Phone} label="Telefone" value={member.telefone} />
          </div>

          {/* All licenses */}
          {!loading && licenses.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-semibold mb-2">
                Licenças e Habilitações
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {displayLicenses.map(lic => {
                  const status = getLicenseStatus(lic.data_validade);
                  const cfg = statusConfig[status];
                  return (
                    <div key={lic.id} className="bg-card/80 border border-border/60 rounded-xl p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground uppercase">{lic.tipo_habilitacao}</span>
                        <Badge className={`${cfg.badgeColor} text-[8px] font-bold border rounded-md px-1.5 py-0.5`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      {lic.data_validade && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Validade: {formatDateToBR(lic.data_validade)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* CMA */}
              {cmaLicense && (
                <div className="mt-2 bg-card/80 border border-border/60 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-foreground uppercase">CMA</span>
                    {cmaStatus && (
                      <Badge className={`${statusConfig[cmaStatus].badgeColor} text-[8px] font-bold border rounded-md px-1.5 py-0.5`}>
                        {statusConfig[cmaStatus].label}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[8px] text-muted-foreground uppercase">Classe</p>
                      <p className="text-xs font-bold text-foreground">
                        {cmaLicense.CMA === 'primeira' ? '1ª' : cmaLicense.CMA === 'segunda' ? '2ª' : cmaLicense.CMA || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[8px] text-muted-foreground uppercase">Validade</p>
                      <p className={`text-xs font-bold ${cmaStatus ? statusConfig[cmaStatus].textColor : 'text-foreground'}`}>
                        {cmaLicense.validade_cma ? formatDateToBR(cmaLicense.validade_cma) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[8px] text-muted-foreground uppercase">FS/RH</p>
                      <p className="text-xs font-bold text-foreground">{cmaLicense.FS_RH || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Link to full profile */}
          <button
            onClick={() => navigate(`/tripulacao/${member.id}?tab=dados`)}
            className="w-full text-xs text-muted-foreground hover:text-foreground py-2 border-t border-border/60 transition-colors"
          >
            Ver perfil completo →
          </button>
        </div>
      )}
    </div>
  );
}
