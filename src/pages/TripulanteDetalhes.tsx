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
        .select("id, nome_completo, canac, data_nascimento, telefone, url_avatar, status")
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

  // ── Escala — usa lancamentos_diario_bordo (flight_schedules não existe) ────
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
      return { bg: "bg-gradient-to-r from-slate-500/10 to-slate-600/5", border: "border-slate-500/30 hover:border-slate-500/50" };

    const daysUntil = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return { bg: "bg-gradient-to-r from-red-500/10 to-red-600/5", border: "border-red-500/30 hover:border-red-500/50" };
    if (daysUntil <= 60) return { bg: "bg-gradient-to-r from-yellow-500/10 to-yellow-600/5", border: "border-yellow-500/30 hover:border-yellow-500/50" };
    return { bg: "bg-gradient-to-r from-green-500/10 to-green-600/5", border: "border-green-500/30 hover:border-green-500/50" };
  };

  // tipo_habilitacao — campo real
  const getLicenseColorClass = (licenseType: string) => {
    const type = (licenseType || "").toLowerCase().trim();
    const colorMap: Record<string, { bg: string; border: string; text: string; labelText: string }> = {
      ppl:       { bg: "bg-gradient-to-r from-blue-500/10 to-blue-600/5",    border: "border-blue-500/30",    text: "text-blue-300",    labelText: "text-blue-200" },
      comercial: { bg: "bg-gradient-to-r from-purple-500/10 to-purple-600/5", border: "border-purple-500/30",  text: "text-purple-300",  labelText: "text-purple-200" },
      ifr:       { bg: "bg-gradient-to-r from-emerald-500/10 to-emerald-600/5",border: "border-emerald-500/30",text: "text-emerald-300", labelText: "text-emerald-200" },
      mpl:       { bg: "bg-gradient-to-r from-orange-500/10 to-orange-600/5", border: "border-orange-500/30",  text: "text-orange-300",  labelText: "text-orange-200" },
      atpl:      { bg: "bg-gradient-to-r from-red-500/10 to-red-600/5",       border: "border-red-500/30",     text: "text-red-300",     labelText: "text-red-200" },
      cpl:       { bg: "bg-gradient-to-r from-violet-500/10 to-violet-600/5", border: "border-violet-500/30",  text: "text-violet-300",  labelText: "text-violet-200" },
      asel:      { bg: "bg-gradient-to-r from-cyan-500/10 to-cyan-600/5",     border: "border-cyan-500/30",    text: "text-cyan-300",    labelText: "text-cyan-200" },
      ases:      { bg: "bg-gradient-to-r from-teal-500/10 to-teal-600/5",     border: "border-teal-500/30",    text: "text-teal-300",    labelText: "text-teal-200" },
      mel:       { bg: "bg-gradient-to-r from-amber-500/10 to-amber-600/5",   border: "border-amber-500/30",   text: "text-amber-300",   labelText: "text-amber-200" },
      mes:       { bg: "bg-gradient-to-r from-yellow-500/10 to-yellow-600/5", border: "border-yellow-500/30",  text: "text-yellow-300",  labelText: "text-yellow-200" },
    };
    for (const [key, colors] of Object.entries(colorMap)) {
      if (type.includes(key) || key.includes(type)) return colors;
    }
    return { bg: "bg-gradient-to-r from-slate-500/10 to-slate-600/5", border: "border-slate-500/30", text: "text-slate-300", labelText: "text-slate-200" };
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
      <div className="p-6 space-y-6">
        {/* Header do tripulante */}
        <Card className="border-0 shadow-none bg-transparent">
          <CardContent className="p-0">
            <div className="relative rounded-xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-cyan-500/20 hover:border-cyan-500/40 text-white p-6">
              <Button
                variant="ghost"
                onClick={() => navigate("/tripulacao")}
                className="absolute right-4 top-4 h-10 w-10 p-0 bg-slate-700/50 hover:bg-slate-600 text-slate-200 rounded-full"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>

              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <Avatar className="h-24 w-24 ring-4 ring-cyan-500/30 flex-shrink-0">
                  {/* url_avatar — campo real do schema */}
                  <AvatarImage src={member.url_avatar || undefined} alt={member.nome_completo} className="object-cover" />
                  <AvatarFallback className="bg-slate-800 text-slate-300 font-bold text-2xl">
                    {(member.nome_completo || "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  {/* nome_completo — campo real */}
                  <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">{member.nome_completo}</h1>
                  <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-start sm:items-center">
                    <Badge className="bg-cyan-500/30 border-cyan-400 text-cyan-300 text-xs md:text-sm font-mono px-3 py-1 font-bold border">
                      ⚜ ANAC: {member.canac || "N/A"}
                    </Badge>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      {/* data_nascimento — campo real */}
                      <span>{member.data_nascimento ? formatBirthDateWithAge(member.data_nascimento) : "Data não informada"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <CrewMemberNav activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab)} />

              {/* Dados */}
              <TabsContent value="dados" className="mt-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Informações Pessoais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label>Nome Completo</Label>
                      {/* nome_completo — campo real */}
                      <Input value={member.nome_completo || "—"} readOnly className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>Data de Nascimento</Label>
                      {/* data_nascimento — campo real */}
                      <Input value={member.data_nascimento ? formatDateToBR(member.data_nascimento) : "—"} readOnly className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input value={member.telefone || "—"} readOnly className="bg-muted/50" />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Habilitações */}
              <TabsContent value="habilitacoes" className="mt-6 space-y-6">
                <div className="flex justify-end">
                  <Button onClick={() => setAddLicenseDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Nova Habilitação
                  </Button>
                </div>

                {isLicensesLoading ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">Carregando habilitações...</div>
                ) : licenses.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma habilitação cadastrada</div>
                ) : (
                  <div className="space-y-6">
                    {/* Habilitações técnicas (sem CMA) */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Habilitações Técnicas</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {licenses
                          .filter((lic: any) => !lic.CMA)
                          .map((lic: any) => {
                            const statusColor = getLicenseStatusColorClass(lic, false);
                            // tipo_habilitacao — campo real
                            const typeColor = getLicenseColorClass(lic.tipo_habilitacao);
                            return (
                              <div key={lic.id} className={`${statusColor.bg} border ${statusColor.border} rounded-lg p-4 transition-colors space-y-3`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className={`font-semibold ${typeColor.labelText}`}>{lic.tipo_habilitacao}</div>
                                  {getLicenseStatusBadge(lic, false, () => handleEditLicense(lic, false))}
                                </div>
                                <div className="space-y-2 text-sm">
                                  {/* data_validade — campo real */}
                                  {lic.data_validade && (
                                    <div className="flex justify-between text-xs border-t border-slate-700/50 pt-2 mt-2">
                                      <span className="text-slate-500">Validade:</span>
                                      <span className="text-slate-300 font-medium">{formatDateToBR(lic.data_validade)}</span>
                                    </div>
                                  )}
                                </div>
                                {/* observacao — campo real (não observacoes) */}
                                {lic.observacao && (
                                  <div className="text-xs text-slate-400 italic bg-slate-900/50 p-2 rounded border-l-2 border-cyan-500/50 mt-3">
                                    {lic.observacao}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                      {licenses.filter((lic: any) => !lic.CMA).length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">Nenhuma habilitação técnica cadastrada</div>
                      )}
                    </div>

                    {/* CMA */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Certificado Médico Aeronáutico</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {licenses
                          .filter((lic: any) => !!lic.CMA)
                          .map((lic: any) => {
                            const statusColor = getLicenseStatusColorClass(lic, true);
                            return (
                              <div key={`${lic.id}-cma`} className={`${statusColor.bg} border ${statusColor.border} rounded-lg p-4 transition-colors space-y-3`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-semibold text-cyan-300">CMA</div>
                                    <p className="text-xs text-cyan-200 mt-1">Certificado Médico Aeronáutico</p>
                                  </div>
                                  {getLicenseStatusBadge(lic, true, () => handleEditLicense(lic, true))}
                                </div>
                                <div className="space-y-2 text-sm">
                                  {lic.CMA && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-400">Classe:</span>
                                      <span className="text-cyan-300 font-semibold">
                                        {lic.CMA === 'primeira' ? '1° Classe' : lic.CMA === 'segunda' ? '2° Classe' : lic.CMA}
                                      </span>
                                    </div>
                                  )}
                                  {lic.validade_cma && (
                                    <div className="flex justify-between text-xs border-t border-cyan-500/20 pt-2 mt-2">
                                      <span className="text-slate-400">Validade:</span>
                                      <span className="text-slate-300 font-medium">{formatDateToBR(lic.validade_cma)}</span>
                                    </div>
                                  )}
                                  {lic.FS_RH && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-400">FS/RH:</span>
                                      <span className="text-slate-300 font-medium">{lic.FS_RH}</span>
                                    </div>
                                  )}
                                </div>
                                {lic.observacao && (
                                  <div className="text-xs text-slate-400 italic bg-slate-900/50 p-2 rounded border-l-2 border-cyan-500/50 mt-3">
                                    {lic.observacao}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                      {licenses.filter((lic: any) => !!lic.CMA).length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">Nenhum CMA cadastrado</div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Escala (lancamentos_diario_bordo) */}
              <TabsContent value="escala" className="mt-6 space-y-4">
                {isSchedulesLoading ? (
                  <div className="text-sm text-muted-foreground">Carregando...</div>
                ) : schedules.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhuma escala programada</div>
                ) : (
                  <div className="space-y-3">
                    {(schedules as any[]).map((s: any) => (
                      <div key={s.id} className="border rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            {/* data_registro — campo real */}
                            <p className="text-2xl font-bold">{new Date(s.data_registro + 'T00:00:00').getDate()}</p>
                            <p className="text-sm text-muted-foreground">{formatMonthShort(s.data_registro)}</p>
                          </div>
                          <div>
                            {/* aerodromo_partida / aerodromo_chegada — campos reais */}
                            <p className="font-semibold">{s.aerodromo_partida} → {s.aerodromo_chegada}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {s.natureza_voo}
                              {s.aeronave?.matricula && ` · ${s.aeronave.matricula}`}
                            </p>
                          </div>
                        </div>
                        {/* confirmado — campo real */}
                        <Badge variant={s.confirmado ? 'default' : 'secondary'}>
                          {s.confirmado ? 'Confirmado' : 'Pendente'}
                        </Badge>
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
                <div>
                  <h3 className="text-lg font-semibold mb-4">Relatórios para Aprovação</h3>
                  {isApprovalsLoading ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">Carregando relatórios pendentes...</div>
                  ) : pendingApprovals.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">Nenhum relatório pendente de aprovação</div>
                  ) : (
                    <div className="space-y-4">
                      {pendingApprovals.map((report: any) => (
                        <Card key={report.id} className="border-l-4 border-l-blue-500">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg mb-1">{report.numero_relatorio}</h4>
                                <p className="text-sm text-muted-foreground">{report.cliente?.razao_social}</p>
                                <div className="flex gap-4 mt-3 text-sm">
                                  <span className="text-muted-foreground">📅 {formatDateToBR(report.data_inicio)} até {formatDateToBR(report.data_fim)}</span>
                                  <span className="font-semibold text-green-600">R$ {Number(report.total_valor || 0).toFixed(2).replace('.', ',')}</span>
                                </div>
                              </div>
                              <Badge variant={report.crew_approval_status === 'pending' ? 'secondary' : 'destructive'}>
                                {report.crew_approval_status === 'pending' ? 'Pendente' : 'Rejeitado'}
                              </Badge>
                            </div>
                            {report.crew_approval_notes && (
                              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                                <strong>Motivo da devolução:</strong> {report.crew_approval_notes}
                              </div>
                            )}
                            {report.crew_approval_status === 'pending' && (
                              <Button onClick={() => window.open(`${window.location.origin}/#/aprovar-relatorio/${report.approval_token}`, '_blank')} className="w-full bg-blue-600 hover:bg-blue-700">
                                Revisar e Aprovar
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