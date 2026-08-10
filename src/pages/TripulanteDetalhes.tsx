import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowLeft, UploadCloud, AlertTriangle, Clock, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import CrewFlightHoursTable from "@/components/tripulacao/CrewFlightHoursTable";
import { formatBirthDateWithAge, formatDateToBR, formatMonthShort } from "@/lib/date-utils";
import { CrewMemberNav } from "@/components/tripulacao/CrewMemberNav";
import { StackedCardsUpload, type UploadFile } from "@/components/ui/stacked-cards-upload";
import { LicenseExpiryDialog } from "@/components/tripulacao/LicenseExpiryDialog";
import { AddLicenseDialog } from "@/components/tripulacao/AddLicenseDialog";

export default function TripulanteDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = (
    searchParams.get("tab") === "anexos" ? "anexos" :
    searchParams.get("tab") === "horas-voo" ? "horas-voo" :
    searchParams.get("tab") === "escala" ? "escala" :
    searchParams.get("tab") === "habilitacoes" ? "habilitacoes" :
    searchParams.get("tab") === "aprovacoes-pendentes" ? "aprovacoes-pendentes" :
    "dados"
  ) as "dados" | "anexos" | "horas-voo" | "escala" | "habilitacoes" | "aprovacoes-pendentes";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<any>(null);
  const [isCMAEdit, setIsCMAEdit] = useState(false);
  const [addLicenseDialogOpen, setAddLicenseDialogOpen] = useState(false);

  // ── Query do membro ────────────────────────────────────────────────────────
  // Todos os campos usam nomes reais do schema; sem alias incorretos
  const { data: member, isLoading, refetch } = useQuery({
    queryKey: ["crew_member", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membros_tripulacao")
        .select("id, nome_completo, canac, data_nascimento, data_admissao, telefone, rg, cpf, endereco, url_avatar, status, tipo_licenca")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // ── Habilitações ───────────────────────────────────────────────────────────
  const { data: licenses = [], isLoading: isLicensesLoading, refetch: refetchLicenses } = useQuery({
    queryKey: ["crew_licenses", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("habilitacoes_tripulante")
        .select("id, membro_tripulacao_id, tipo_habilitacao, data_validade, observacao, CMA, FS_RH, validade_cma")
        .eq("membro_tripulacao_id", id)
        .order("data_validade", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Escala — usa lançamentos do diário de bordo ───────────────────────────
  const { data: schedules = [], isLoading: isSchedulesLoading } = useQuery({
    queryKey: ["crew_schedules", id],
    enabled: !!id,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("lancamentos_diario_bordo")
        .select(`
          id, data_registro, aerodromo_partida, aerodromo_chegada,
          tempo_total, natureza_voo, confirmado,
          aeronave:aeronave_id(matricula, modelo)
        `)
        .or(`pic_canac.eq.${id},sic_canac.eq.${id}`)
        .gte("data_registro", today)
        .order("data_registro", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Aprovações pendentes ───────────────────────────────────────────────────
  const { data: pendingApprovals = [], isLoading: isApprovalsLoading } = useQuery({
    queryKey: ["pending_approvals", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("travel_expense_reports")
        .select("id, numero_relatorio, clientes_id, cliente:clientes_id(razao_social), data_inicio, data_fim, total_valor, crew_approval_status, crew_approved_at, crew_approval_notes, approval_token")
        .eq("tripulacao_id", id)
        .in("crew_approval_status", ["pending", "rejected"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleEditLicense = (lic: any, isCMA = false) => {
    setSelectedLicense(lic);
    setIsCMAEdit(isCMA);
    setEditDialogOpen(true);
  };

  const getLicenseStatusBadge = (lic: any, isCMA = false, onClick?: () => void) => {
    // data_validade / validade_cma — campos reais
    const expiryDate = isCMA && lic.validade_cma
      ? new Date(lic.validade_cma)
      : lic.data_validade
        ? new Date(lic.data_validade)
        : null;

    if (!expiryDate || isNaN(expiryDate.getTime())) {
      return <Badge variant="secondary" className="cursor-pointer hover:opacity-80" onClick={onClick}>Indefinido</Badge>;
    }

    const daysUntil = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0)
      return <Badge variant="destructive" className="flex items-center gap-1 cursor-pointer hover:opacity-80" onClick={onClick}><AlertTriangle className="h-2 w-2" /> Vencida</Badge>;
    if (daysUntil <= 60)
      return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30 flex items-center gap-1 cursor-pointer hover:opacity-80" onClick={onClick}><AlertTriangle className="h-3 w-3" /> Vence em {daysUntil} dias</Badge>;
    return <Badge className="bg-green-500 text-white cursor-pointer hover:opacity-80" onClick={onClick}>Válida</Badge>;
  };

  const getLicenseStatusColorClass = (lic: any, isCMA = false) => {
    const expiryDate = isCMA && lic.validade_cma
      ? new Date(lic.validade_cma)
      : lic.data_validade
        ? new Date(lic.data_validade)
        : null;

    if (!expiryDate || isNaN(expiryDate.getTime()))
      return { bg: "bg-slate-900/80", border: "border-slate-700/60" };

    const daysUntil = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return { bg: "bg-slate-900/80", border: "border-red-500/30" };
    if (daysUntil <= 60) return { bg: "bg-slate-900/80", border: "border-amber-500/30" };
    return { bg: "bg-slate-900/80", border: "border-emerald-500/30" };
  };

  // tipo_habilitacao — campo real
  const getLicenseColorClass = (licenseType: string) => {
    const type = (licenseType || "").toLowerCase().trim();
    const colorMap: Record<string, { bg: string; border: string; text: string; labelText: string }> = {
      ppl:       { bg: "bg-slate-900/80", border: "border-slate-700/60", text: "text-slate-300", labelText: "text-slate-400" },
      comercial: { bg: "bg-slate-900/80", border: "border-slate-700/60", text: "text-slate-300", labelText: "text-slate-400" },
      ifr:       { bg: "bg-slate-900/80", border: "border-slate-700/60", text: "text-slate-300", labelText: "text-slate-400" },
      mpl:       { bg: "bg-slate-900/80", border: "border-slate-700/60", text: "text-slate-300", labelText: "text-slate-400" },
      atpl:      { bg: "bg-slate-900/80", border: "border-slate-700/60", text: "text-slate-300", labelText: "text-slate-400" },
      cpl:       { bg: "bg-slate-900/80", border: "border-slate-700/60", text: "text-slate-300", labelText: "text-slate-400" },
      asel:      { bg: "bg-slate-900/80", border: "border-slate-700/60", text: "text-slate-300", labelText: "text-slate-400" },
      ases:      { bg: "bg-slate-900/80", border: "border-slate-700/60", text: "text-slate-300", labelText: "text-slate-400" },
      mel:       { bg: "bg-slate-900/80", border: "border-slate-700/60", text: "text-slate-300", labelText: "text-slate-400" },
      mes:       { bg: "bg-slate-900/80", border: "border-slate-700/60", text: "text-slate-300", labelText: "text-slate-400" },
    };
    for (const [key, colors] of Object.entries(colorMap)) {
      if (type.includes(key) || key.includes(type)) return colors;
    }
    return { bg: "bg-slate-900/80", border: "border-slate-700/60", text: "text-slate-300", labelText: "text-slate-400" };
  };

  // ── Documentos (storage) ───────────────────────────────────────────────────
  const [uploadingFiles, setUploadingFiles] = useState<UploadFile[]>([]);
  const [docs, setDocs] = useState<{ name: string; url: string }[]>([]);

  const loadDocs = async () => {
    if (!id) return;
    const { data, error } = await supabase.storage.from("crew-docs").list(id, { limit: 100 });
    if (error) return setDocs([]);
    const items = await Promise.all(
      (data ?? []).map(async (f) => {
        // f.name — propriedade correta do objeto retornado pelo storage
        const { data: pub } = await supabase.storage.from("crew-docs").getPublicUrl(`${id}/${f.name}`);
        return { name: f.name, url: pub.publicUrl };
      })
    );
    setDocs(items);
  };

  useEffect(() => { void loadDocs(); }, [id]);
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", activeTab);
    setSearchParams(params);
  }, [activeTab]);

  const handleUpload = async (file: File) => {
    if (!id) return;
    const fileId = crypto.randomUUID();
    const uploadFile: UploadFile = { id: fileId, file, progress: 0, status: "uploading" };
    setUploadingFiles(prev => [...prev, uploadFile]);

    try {
      // file.name — propriedade correta do objeto File do JS
      const path = `${id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("crew-docs").upload(path, file, { upsert: false });
      if (error) throw error;

      setUploadingFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress: 100, status: "done" as const } : f));
      setTimeout(() => { setUploadingFiles(prev => prev.filter(f => f.id !== fileId)); loadDocs(); }, 1000);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
    }
  };

  const handleRemoveUpload = (fileId: string) => setUploadingFiles(prev => prev.filter(f => f.id !== fileId));

  const handleDelete = async (name: string) => {
    if (!id) return;
    const { error } = await supabase.storage.from("crew-docs").remove([`${id}/${name}`]);
    if (!error) await loadDocs();
  };

  if (isLoading || !member) {
    return (
      <Layout>
        <div className="p-6 text-center text-muted-foreground">Carregando...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-8">
        {/* Header do tripulante */}
        <Card className="border border-slate-800/70 bg-slate-950/80 shadow-sm">
          <CardContent className="p-0 overflow-hidden rounded-3xl">
            <div className="relative bg-slate-950 border border-slate-800/70 p-5 md:p-6">
              <Button
                variant="ghost"
                onClick={() => navigate("/tripulacao")}
                className="absolute right-4 top-4 h-10 w-10 p-0 bg-slate-900/80 hover:bg-slate-800 text-slate-200 rounded-full"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>

              <div className="flex flex-col xl:flex-row items-start xl:items-center gap-5">
                <Avatar className="h-24 w-24 ring-1 ring-slate-700/70 flex-shrink-0">
                  <AvatarImage src={member.url_avatar || undefined} alt={member.nome_completo} className="object-cover" />
                  <AvatarFallback className="bg-slate-800 text-slate-300 font-bold text-2xl">
                    {(member.nome_completo || "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-3">{member.nome_completo}</h1>
                  <div className="flex flex-wrap gap-3 items-center text-sm text-slate-300">
                    <Badge className="bg-slate-900/80 border border-slate-700/60 text-slate-200 text-xs font-semibold px-3 py-1 rounded-full">
                       ANAC: {member.canac || "N/A"}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>{member.data_nascimento ? formatBirthDateWithAge(member.data_nascimento) : "Data de nascimento não informada"}</span>
                    </div>

                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Habilitações</p>
                  <p className="mt-2 text-lg font-semibold text-white">{licenses.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Escalas futuras</p>
                  <p className="mt-2 text-lg font-semibold text-white">{schedules.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Aprovações pendentes</p>
                  <p className="mt-2 text-lg font-semibold text-white">{pendingApprovals.length}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-800/70 bg-slate-950/80 shadow-sm">
          <CardContent className="p-5">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <CrewMemberNav activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab)} />

              {/* Dados */}
              <TabsContent value="dados" className="mt-6 space-y-6">
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-5">
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-xl md:text-2xl font-semibold text-white">Informações Pessoais</h3>
                      <p className="text-sm text-slate-400">Visão consolidada dos dados básicos e contato.</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                      <span className="rounded-full bg-slate-900/80 px-3 py-2">Perfil</span>
                    </div>
                  </div>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                      <dt className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Nome completo</dt>
                      <dd className="mt-3 text-lg font-semibold text-white">{member.nome_completo || <span className="text-slate-600 italic text-base font-normal">Sem informação</span>}</dd>
                    </div>
                    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                      <dt className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">CANAC</dt>
                      <dd className="mt-3 text-lg font-semibold text-white">{member.canac || <span className="text-slate-600 italic text-base font-normal">Sem informação</span>}</dd>
                    </div>
                    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                      <dt className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Data de nascimento</dt>
                      <dd className="mt-3 text-lg font-semibold text-white">{member.data_nascimento ? formatDateToBR(member.data_nascimento) : <span className="text-slate-600 italic text-base font-normal">Sem informação</span>}</dd>
                    </div>
                    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                      <dt className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Data de admissão</dt>
                      <dd className="mt-3 text-lg font-semibold text-white">{(member as any).data_admissao ? formatDateToBR((member as any).data_admissao) : <span className="text-slate-600 italic text-base font-normal">Sem informação</span>}</dd>
                    </div>
                    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                      <dt className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Telefone</dt>
                      <dd className="mt-3 text-lg font-semibold text-white">{member.telefone || <span className="text-slate-600 italic text-base font-normal">Sem informação</span>}</dd>
                    </div>
                    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                      <dt className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">RG</dt>
                      <dd className="mt-3 text-lg font-semibold text-white">{(member as any).rg || <span className="text-slate-600 italic text-base font-normal">Sem informação</span>}</dd>
                    </div>
                    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                      <dt className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">CPF</dt>
                      <dd className="mt-3 text-lg font-semibold text-white">{(member as any).cpf || <span className="text-slate-600 italic text-base font-normal">Sem informação</span>}</dd>
                    </div>
                    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4 md:col-span-2">
                      <dt className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Endereço</dt>
                      <dd className="mt-3 text-lg font-semibold text-white">{(member as any).endereco || <span className="text-slate-600 italic text-base font-normal">Sem informação</span>}</dd>
                    </div>
                  </dl>
                </div>
              </TabsContent>

              {/* Habilitações */}
              <TabsContent value="habilitacoes" className="mt-6 space-y-6">
                <div className="flex justify-end">
                  <Button onClick={() => setAddLicenseDialogOpen(true)} className="bg-slate-700/90 hover:bg-slate-600/90 text-white shadow-sm">
                    <Plus className="mr-2 h-4 w-4" /> Nova Habilitação
                  </Button>
                </div>

                {isLicensesLoading ? (
                  <div className="text-center py-12 text-sm text-slate-400">Carregando habilitações...</div>
                ) : licenses.length === 0 ? (
                  <div className="text-center py-12 text-sm text-slate-400">Nenhuma habilitação cadastrada</div>
                ) : (
                  <div className="space-y-8">
                    {/* Habilitações técnicas (sem CMA) */}
                    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-4 mb-5">
                        <div>
                          <h3 className="text-lg font-semibold text-white">Habilitações Técnicas</h3>
                          <p className="text-sm text-slate-400">Todas as licenças ativas e em acompanhamento.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {licenses
                          .filter((lic: any) => !lic.CMA)
                          .map((lic: any) => {
                            const statusColor = getLicenseStatusColorClass(lic, false);
                            const typeColor = getLicenseColorClass(lic.tipo_habilitacao);
                            return (
                              <div key={lic.id} className={`${statusColor.bg} border ${statusColor.border} rounded-2xl p-4 transition-colors`}> 
                                        <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-100">{lic.tipo_habilitacao}</div>
                                    <p className="text-xs text-slate-400 mt-1">Licença técnica</p>
                                  </div>
                                  {getLicenseStatusBadge(lic, false, () => handleEditLicense(lic, false))}
                                </div>
                                <div className="mt-4 text-sm space-y-3 text-slate-200">
                                  {lic.data_validade ? (
                                    <div className="flex justify-between text-xs text-slate-400">
                                      <span>Validade</span>
                                      <span className="font-medium text-slate-100">{formatDateToBR(lic.data_validade)}</span>
                                    </div>
                                  ) : null}
                                </div>
                                {lic.observacao ? (
                                  <div className="mt-4 text-xs text-slate-400 italic bg-slate-900/60 p-3 rounded-2xl border border-slate-800/60">
                                    {lic.observacao}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* CMA */}
                    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-4 mb-5">
                        <div>
                          <h3 className="text-lg font-semibold text-white">Certificado Médico Aeronáutico</h3>
                          <p className="text-sm text-slate-400">Controle de validade e informações complementares.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {licenses
                          .filter((lic: any) => !!lic.CMA)
                          .map((lic: any) => {
                            const statusColor = getLicenseStatusColorClass(lic, true);
                            return (
                              <div key={`${lic.id}-cma`} className={`${statusColor.bg} border ${statusColor.border} rounded-2xl p-4 transition-colors`}> 
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-100">CMA</div>
                                    <p className="text-xs text-slate-400 mt-1">Certificado Médico Aeronáutico</p>
                                  </div>
                                  {getLicenseStatusBadge(lic, true, () => handleEditLicense(lic, true))}
                                </div>
                                <div className="mt-4 text-sm space-y-3 text-slate-200">
                                  {lic.CMA ? (
                                    <div className="flex justify-between text-xs text-slate-400">
                                      <span>Classe</span>
                                      <span className="font-medium text-slate-100">{lic.CMA === 'primeira' ? '1° Classe' : lic.CMA === 'segunda' ? '2° Classe' : lic.CMA}</span>
                                    </div>
                                  ) : null}
                                  {lic.validade_cma ? (
                                    <div className="flex justify-between text-xs text-slate-400">
                                      <span>Validade</span>
                                      <span className="font-medium text-slate-100">{formatDateToBR(lic.validade_cma)}</span>
                                    </div>
                                  ) : null}
                                  {lic.FS_RH ? (
                                    <div className="flex justify-between text-xs text-slate-400">
                                      <span>FS/RH</span>
                                      <span className="font-medium text-slate-100">{lic.FS_RH}</span>
                                    </div>
                                  ) : null}
                                </div>
                                {lic.observacao ? (
                                  <div className="mt-4 text-xs text-slate-400 italic bg-slate-900/60 p-3 rounded-2xl border border-slate-800/60">
                                    {lic.observacao}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Escala (lancamentos_diario_bordo) */}
              <TabsContent value="escala" className="mt-6 space-y-4">
                {isSchedulesLoading ? (
                  <div className="text-sm text-slate-400">Carregando...</div>
                ) : schedules.length === 0 ? (
                  <div className="text-sm text-slate-400">Nenhuma escala programada</div>
                ) : (
                  <div className="space-y-4">
                    {(schedules as any[]).map((s: any) => (
                      <div key={s.id} className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4 shadow-sm">
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="rounded-2xl bg-slate-900/80 p-3 text-center min-w-[70px]">
                              <p className="text-3xl font-semibold text-white">{new Date(s.data_registro + 'T00:00:00').getDate()}</p>
                              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{formatMonthShort(s.data_registro)}</p>
                            </div>
                            <div>
                              <p className="text-lg font-semibold text-white">{s.aerodromo_partida} → {s.aerodromo_chegada}</p>
                              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                                <span className="inline-flex items-center gap-2">
                                  <Clock className="h-4 w-4" />
                                  {s.natureza_voo}
                                </span>
                                {s.aeronave?.matricula && <span>{s.aeronave.matricula}</span>}
                              </div>
                            </div>
                          </div>
                          <Badge variant={s.confirmado ? 'default' : 'secondary'}>
                            {s.confirmado ? 'Confirmado' : 'Pendente'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Horas de Voo */}
              <TabsContent value="horas-voo" className="mt-6 space-y-6">
                <CrewFlightHoursTable crewMemberId={member.id} />
              </TabsContent>

              {/* Aprovações pendentes */}
              <TabsContent value="aprovacoes-pendentes" className="mt-6 space-y-6">
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white">Relatórios para Aprovação</h3>
                      <p className="text-sm text-slate-400">Acompanhe as pendências e aprove no fluxo de voo.</p>
                    </div>
                  </div>
                  {isApprovalsLoading ? (
                    <div className="text-center py-12 text-sm text-slate-400">Carregando relatórios pendentes...</div>
                  ) : pendingApprovals.length === 0 ? (
                    <div className="text-center py-12 text-sm text-slate-400">Nenhum relatório pendente de aprovação</div>
                  ) : (
                    <div className="space-y-4">
                      {pendingApprovals.map((report: any) => (
                        <Card key={report.id} className="border border-slate-800/70 bg-slate-950/85 shadow-sm rounded-2xl">
                          <CardContent className="p-5">
                            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-lg text-white mb-1">{report.numero_relatorio}</h4>
                                <p className="text-sm text-slate-400 truncate">{report.cliente?.razao_social}</p>
                                <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-400">
                                  <span>📅 {formatDateToBR(report.data_inicio)} até {formatDateToBR(report.data_fim)}</span>
                                  <span className="font-semibold text-slate-100">R$ {Number(report.total_valor || 0).toFixed(2).replace('.', ',')}</span>
                                </div>
                              </div>
                              <Badge variant={report.crew_approval_status === 'pending' ? 'secondary' : 'destructive'}>
                                {report.crew_approval_status === 'pending' ? 'Pendente' : 'Rejeitado'}
                              </Badge>
                            </div>
                            {report.crew_approval_notes && (
                              <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                                <strong className="text-amber-200">Motivo da devolução:</strong> {report.crew_approval_notes}
                              </div>
                            )}
                            {report.crew_approval_status === 'pending' && (
                              <Button onClick={() => window.open(`${window.location.origin}/#/aprovar-relatorio/${report.approval_token}`, '_blank')} className="w-full bg-slate-700/90 hover:bg-slate-600/90 text-white shadow-sm">
                                Visualizar resumo relatório
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Anexos */}
              <TabsContent value="anexos" className="mt-6 space-y-6">
                <div>
                  <input
                    id="doc-file" type="file" accept="application/pdf,image/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) { void handleUpload(f); e.target.value = ''; } }}
                    className="hidden"
                  />
                  <Button disabled={uploadingFiles.length > 0} onClick={() => document.getElementById("doc-file")?.click()} className="gap-2">
                    <UploadCloud className="h-4 w-4" />
                    {uploadingFiles.length > 0 ? "Enviando..." : "Anexar arquivos"}
                  </Button>
                </div>

                {uploadingFiles.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Enviando arquivos</h4>
                    <StackedCardsUpload files={uploadingFiles} onRemove={handleRemoveUpload} />
                  </div>
                )}

                <div className="space-y-3">
                  {docs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Nenhum documento enviado ainda.</div>
                  ) : (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Documentos enviados</h4>
                      <div className="space-y-2">
                        {docs.map((d) => (
                          <div key={d.name} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                            <a href={d.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex-1 truncate">
                              {d.name}
                            </a>
                            <Button variant="ghost" size="icon" className="h-8 w-8 ml-2" onClick={() => void handleDelete(d.name)}>
                              <UploadCloud className="h-4 w-4 rotate-180" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <LicenseExpiryDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          license={selectedLicense}
          isCMA={isCMAEdit}
          onSuccess={() => refetchLicenses()}
        />

        {id && (
          <AddLicenseDialog
            open={addLicenseDialogOpen}
            onOpenChange={setAddLicenseDialogOpen}
            crewMemberId={id}
            onSuccess={() => refetchLicenses()}
          />
        )}
      </div>
    </Layout>
  );
}
