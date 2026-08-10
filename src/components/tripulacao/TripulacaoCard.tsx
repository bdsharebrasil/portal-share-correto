import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, Clock, XCircle } from "lucide-react";
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
  cpf?: string;
  data_nascimento?: string;
  tipo_licenca?: string; // tipo de licença vindo de membros_tripulacao
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
  active: { label: "ATIVA", badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", textColor: "text-emerald-400", cardBg: "bg-slate-900/60", cardBorder: "border-emerald-500/30", Icon: CheckCircle },
  expiring: { label: "VENCENDO", badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30", textColor: "text-amber-400", cardBg: "bg-slate-900/60", cardBorder: "border-amber-500/30", Icon: Clock },
  expired: { label: "VENCIDA", badgeColor: "bg-red-500/20 text-red-400 border-red-500/30", textColor: "text-red-400", cardBg: "bg-slate-900/60", cardBorder: "border-red-500/30", Icon: XCircle },
};

export function CrewMemberCard({ member }: CrewMemberCardProps) {
  const navigate = useNavigate();
  const [licenses, setLicenses] = useState<CrewLicense[]>([]);
  const [loading, setLoading] = useState(true);

  const displayName = member.nome_completo ?? member.full_name ?? "NOME NÃO INFORMADO";
  const displayAvatar = member.url_avatar ?? member.avatar_url;
  const displayCpf = member.cpf;
  const displayNascimento = member.data_nascimento;

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

  // Não exibe o card se não houver data de nascimento cadastrada
  if (!displayNascimento) {
    return null;
  }

  const displayLicenses = licenses.filter(l => l.tipo_habilitacao !== 'CMA');
  const cmaLicense = licenses.find(l => l.CMA && l.validade_cma);

  const hasExpired = licenses.some(l => getLicenseStatus(l.tipo_habilitacao === 'CMA' ? l.validade_cma : l.data_validade) === 'expired');
  const avatarRingColor = hasExpired ? 'from-red-500 to-red-700' : 'from-emerald-500 to-emerald-700';

  return (
    <Card
      className="group cursor-pointer bg-slate-950 border border-slate-800 hover:border-slate-700 hover:shadow-xl transition-all duration-300 overflow-hidden w-full max-w-md mx-auto flex flex-col relative rounded-3xl"
      onClick={() => navigate(`/tripulacao/${member.id}?tab=dados`)}
    >
      <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-slate-800/40 to-transparent pointer-events-none" />

      {/* Foto de Perfil / Avatar */}
      <div className="flex justify-center mt-8 mb-3 relative z-10">
        <div className={`p-1 rounded-full bg-gradient-to-tr ${avatarRingColor}`}>
          <Avatar className="h-24 w-24 border-4 border-slate-950">
            <AvatarImage src={displayAvatar} alt={displayName} className="object-cover" />
            <AvatarFallback className="bg-slate-800 text-slate-300 font-bold text-2xl">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Nome e Código ANAC */}
      <div className="text-center px-6 mb-6">
        <h3 className="text-lg font-bold text-slate-100 uppercase tracking-wide leading-tight">
          {displayName}
        </h3>
        <p className="text-sm text-slate-400 mt-1 font-medium">
          Código ANAC: <span className="text-slate-200">{member.canac}</span>
        </p>
        {member.tipo_licenca && (
          <Badge className="mt-2 bg-slate-800/80 text-slate-200 border-slate-700 text-[10px] font-bold uppercase tracking-wide">
            {member.tipo_licenca}
          </Badge>
        )}
      </div>

      <div className="px-4 flex-1 flex flex-col gap-4 pb-6">
        {/* Bloco de Dados Pessoais */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800/60">
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">CPF</p>
            <p className="text-sm font-semibold text-slate-200">{displayCpf ?? "-"}</p>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800/60">
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Data de Nasc.</p>
            <p className="text-sm font-semibold text-slate-200">{formatDateToBR(displayNascimento)}</p>
          </div>
        </div>

        {/* Habilitações e Licenças */}
        {!loading && displayLicenses.length > 0 && (
          <div className="mt-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-semibold mb-2 ml-1">
              Licenças e Habilitações
            </p>
            <div className="grid grid-cols-2 gap-3">
              {displayLicenses.map((license) => {
                const status = getLicenseStatus(license.data_validade);
                const config = statusConfig[status];

                return (
                  <div
                    key={license.id}
                    className={`${config.cardBg} border ${config.cardBorder} rounded-2xl p-3 flex flex-col items-center text-center`}
                  >
                    <p className="text-xs font-bold text-slate-200 mb-1 uppercase break-words w-full">
                      {license.tipo_habilitacao}
                    </p>
                    <div className="mt-auto w-full">
                      <p className="text-[10px] text-slate-400 mb-1">
                        Validade: <span className="text-slate-300 font-medium">{formatDateToBR(license.data_validade)}</span>
                      </p>
                      <Badge className={`${config.badgeColor} text-[9px] font-bold w-full justify-center border uppercase rounded-md py-0.5`}>
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CMA Info */}
        {cmaLicense && (
          <div className="mt-2">
            <div className={`p-4 rounded-2xl border ${statusConfig[getLicenseStatus(cmaLicense.validade_cma)].cardBg} ${statusConfig[getLicenseStatus(cmaLicense.validade_cma)].cardBorder}`}>
              <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-semibold mb-3 text-center">
                CMA - Certificado Médico Aeronáutico
              </p>
              <div className="grid grid-cols-3 gap-2 text-center divide-x divide-slate-700/50">
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Classe</p>
                  <p className="text-xs font-bold text-slate-100">
                    {cmaLicense.CMA === 'primeira' ? '1ª Classe' : cmaLicense.CMA === 'segunda' ? '2ª Classe' : cmaLicense.CMA}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Validade</p>
                  <p className={`text-xs font-bold ${statusConfig[getLicenseStatus(cmaLicense.validade_cma)].textColor}`}>
                    {formatDateToBR(cmaLicense.validade_cma)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">FS/RH</p>
                  <p className="text-xs font-bold text-slate-100">
                    {cmaLicense.FS_RH || '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
