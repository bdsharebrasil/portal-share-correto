import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { formatDateToBR } from "@/lib/date-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import {
  User, Plane, Calendar, Award, AlertTriangle, Plus, Edit, Trash2,
  Phone, Mail, MapPin, Clock, FileText, Lock, Users, ArrowLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CrewMemberCard } from "@/components/tripulacao/TripulacaoCard";
import { CrewRegistrationForm } from "@/components/tripulacao/CrewRegistrationForm";

// ── Tipos alinhados ao schema real ────────────────────────────────────────────
interface CrewMember {
  id: string;
  nome_completo: string;        // membros_tripulacao.nome_completo
  canac: string;
  email?: string;
  telefone?: string;
  data_nascimento?: string;     // membros_tripulacao.data_nascimento
  status: string;
  url_avatar?: string;          // membros_tripulacao.url_avatar
  user_id?: string;             // membros_tripulacao.user_id
  role?: string;
  cpf?: string;                 // membros_tripulacao.cpf
  rg?: string;                  // membros_tripulacao.rg
  endereco?: string;            // membros_tripulacao.endereco
}

interface CrewFlightHours {
  id: string;
  membro_tripulacao_id: string;
  aeronave_id: string;
  horas_totais: number;         // horas_voo_tripulante.horas_totais
  aeronave?: {
    matricula: string;          // aeronave.matricula
    modelo: string;             // aeronave.modelo
  };
}

interface CrewLicense {
  id: string;
  membro_tripulacao_id: string; // habilitacoes_tripulante.membro_tripulacao_id
  tipo_habilitacao: string;     // habilitacoes_tripulante.tipo_habilitacao
  data_validade?: string;       // habilitacoes_tripulante.data_validade
  observacao?: string;          // habilitacoes_tripulante.observacao
  CMA?: string;
  FS_RH?: string;
  validade_cma?: string;
}

// Voo do logbook usado como "escala"
interface LogbookFlight {
  id: string;
  data_registro: string;        // lancamentos_diario_bordo.data_registro
  aerodromo_partida: string;
  aerodromo_chegada: string;
  tempo_total: number;
  natureza_voo: string;
  confirmado: boolean;
}

export default function GestaoDeTripulacao() {
  const navigate = useNavigate();
  const [activeMainTab, setActiveMainTab] = useState<'members' | 'registration'>('members');
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [selectedCrew, setSelectedCrew] = useState<CrewMember | null>(null);
  const [flightHours, setFlightHours] = useState<CrewFlightHours[]>([]);
  const [licenses, setLicenses] = useState<CrewLicense[]>([]);
  const [schedules, setSchedules] = useState<LogbookFlight[]>([]);
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<CrewLicense | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'ativo' | 'inativo'>('ativo');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editingProfileData, setEditingProfileData] = useState<CrewMember | null>(null);
  const { hasRole } = useUserRole();

  const canEditProfile = hasRole('piloto_chefe') || hasRole('admin') || hasRole('gestor_master') || hasRole('financeiro_master');
  const canEditHabilitacoes = true;

  useEffect(() => { loadCrewMembers(); }, [statusFilter]);
  useEffect(() => { if (selectedCrew) loadCrewDetails(selectedCrew.id); }, [selectedCrew]);

  const loadCrewMembers = async () => {
    // cpf, rg, endereco, url_avatar estão direto em membros_tripulacao
    const { data, error } = await supabase
      .from('membros_tripulacao')
      .select('id, nome_completo, canac, telefone, data_nascimento, status, url_avatar, user_id, cpf, rg, endereco')
      .eq('status', statusFilter)
      .order('nome_completo');

    if (error) {
      toast({ title: "Erro ao carregar tripulantes", variant: "destructive" });
      return;
    }

    const crewWithRoles = await Promise.all((data || []).map(async (crew: CrewMember) => {
      let crewData: CrewMember = { ...crew, role: 'Tripulante' };

      // Buscar role pelo user_id (coluna correta do schema)
      if (crew.user_id) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', crew.user_id);

        const isPilotChief = roleData?.some(r => r.role === 'piloto_chefe');
        crewData.role = isPilotChief ? 'Piloto Chefe' : 'Tripulante';
      }

      return crewData;
    }));

    setCrewMembers(crewWithRoles);
  };

  const loadCrewDetails = async (crewId: string) => {
    // Horas de voo — join com coluna correta da aeronave
    const { data: hoursData } = await supabase
      .from('horas_voo_tripulante')
      .select(`
        id, membro_tripulacao_id, aeronave_id, horas_totais,
        aeronave:aeronave_id(matricula, modelo)
      `)
      .eq('membro_tripulacao_id', crewId);
    setFlightHours(hoursData || []);

    // Habilitações — colunas corretas
    const { data: licensesData } = await (supabase as any)
      .from('habilitacoes_tripulante')
      .select('id, membro_tripulacao_id, tipo_habilitacao, data_validade, observacao, CMA, FS_RH, validade_cma')
      .eq('membro_tripulacao_id', crewId)
      .order('criado_em', { ascending: false });
    setLicenses(licensesData || []);

    // Voos futuros do diário de bordo (substitui flight_schedules inexistente)
    const today = new Date().toISOString().slice(0, 10);
    const { data: schedulesData } = await supabase
      .from('lancamentos_diario_bordo')
      .select('id, data_registro, aerodromo_partida, aerodromo_chegada, tempo_total, natureza_voo, confirmado')
      .or(`pic_canac.eq.${crewId},sic_canac.eq.${crewId}`)
      .gte('data_registro', today)
      .order('data_registro', { ascending: true })
      .limit(10);
    setSchedules(schedulesData || []);
  };

  const getLicenseStatusBadge = (license: CrewLicense, onEdit?: () => void) => {
    // Para CMA usar validade_cma; para outros usar data_validade
    const dateStr = license.CMA ? license.validade_cma : license.data_validade;
    if (!dateStr) return <Badge className="bg-gray-500">Sem data de validade</Badge>;

    const daysUntilExpiry = Math.floor(
      (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const cls = "flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity";

    if (daysUntilExpiry < 0)
      return <Badge variant="destructive" className={cls} onClick={onEdit}><AlertTriangle size={14} /> Vencida</Badge>;
    if (daysUntilExpiry <= 60)
      return <Badge className={`bg-yellow-500 ${cls}`} onClick={onEdit}><AlertTriangle size={14} /> Vence em {daysUntilExpiry} dias</Badge>;
    return <Badge className={`bg-green-500 ${cls}`} onClick={onEdit}>Válida</Badge>;
  };

  const saveLicense = async (licenseData: Partial<CrewLicense>) => {
    if (!selectedCrew) return;

    // Payload com nomes de coluna corretos do schema
    const payload = {
      membro_tripulacao_id: selectedCrew.id,   // ✓ FK correta
      ...licenseData,
    };

    try {
      if (editingLicense) {
        const { error } = await (supabase as any)
          .from('habilitacoes_tripulante')
          .update(payload)
          .eq('id', editingLicense.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('habilitacoes_tripulante')
          .insert([payload]);
        if (error) throw error;
      }
      toast({ title: "Licença salva com sucesso!" });
      setIsLicenseDialogOpen(false);
      setEditingLicense(null);
      loadCrewDetails(selectedCrew.id);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar licença",
        description: error?.message ?? "Erro inesperado",
        variant: "destructive",
      });
    }
  };

  const deleteLicense = async (licenseId: string) => {
    if (!confirm('Deseja realmente excluir esta licença?')) return;
    try {
      const { error } = await (supabase as any)
        .from('habilitacoes_tripulante')
        .delete()
        .eq('id', licenseId);
      if (error) throw error;
      toast({ title: "Licença excluída com sucesso!" });
      if (selectedCrew) loadCrewDetails(selectedCrew.id);
    } catch (error: any) {
      toast({ title: "Erro ao excluir licença", description: error?.message, variant: "destructive" });
    }
  };

  // Filtro usa nome_completo (campo real do schema)
  const filteredCrewMembers = crewMembers.filter(crew =>
    (crew.nome_completo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (crew.canac || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 bg-background min-h-screen">
        <div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost" size="icon"
              onClick={() => navigate('/')}
              className="h-10 w-10 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Gestão de Tripulação</h1>
              <p className="text-sm text-muted-foreground mt-1">Gerencie membros da equipe e tripulantes externos</p>
            </div>
          </div>
        </div>

        <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as any)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members">Gerenciar Tripulantes</TabsTrigger>
            <TabsTrigger value="registration">Cadastro de Tripulantes</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-6">
            {/* Busca e filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou CANAC..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStatusFilter('ativo')}
                  className={`h-10 px-4 ${statusFilter === 'ativo' ? 'bg-primary/10 text-primary border-primary/30' : ''}`}>
                  Ativos
                </Button>
                <Button variant="outline" onClick={() => setStatusFilter('inativo')}
                  className={`h-10 px-4 ${statusFilter === 'inativo' ? 'bg-red-500/10 text-red-400 border-red-500/30' : ''}`}>
                  Inativos
                </Button>
              </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredCrewMembers.length === 0 ? (
                <div className="col-span-full text-center py-20">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800/50 flex items-center justify-center">
                    <Users className="h-8 w-8 text-zinc-600" />
                  </div>
                  <p className="text-foreground font-medium">Nenhum tripulante encontrado</p>
                  <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou adicione novos tripulantes</p>
                </div>
              ) : (
                filteredCrewMembers.map(crew => (
                  <CrewMemberCard key={crew.id} member={crew} />
                ))
              )}
            </div>

            {/* Dialog de detalhes */}
            <Dialog open={!!selectedCrew} onOpenChange={open => !open && setSelectedCrew(null)}>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <User size={24} />
                    {/* nome_completo — campo real */}
                    Perfil Completo — {selectedCrew?.nome_completo}
                  </DialogTitle>
                </DialogHeader>

                {selectedCrew && (
                  <Tabs defaultValue="profile" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="profile">Perfil</TabsTrigger>
                      <TabsTrigger value="hours">Horas de Voo</TabsTrigger>
                      <TabsTrigger value="licenses">Habilitações</TabsTrigger>
                      <TabsTrigger value="schedule">Escala</TabsTrigger>
                    </TabsList>

                    {/* Perfil */}
                    <TabsContent value="profile">
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2"><User size={20} /> Dados Pessoais</CardTitle>
                            {canEditProfile ? (
                              <Button size="sm" variant={isEditingProfile ? "default" : "outline"}
                                onClick={() => {
                                  setEditingProfileData(isEditingProfile ? null : selectedCrew);
                                  setIsEditingProfile(!isEditingProfile);
                                }} className="gap-2">
                                <Edit size={16} />
                                {isEditingProfile ? 'Cancelar' : 'Editar'}
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Lock size={14} /> Sem permissão
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {isEditingProfile && editingProfileData ? (
                            <EditProfileForm
                              crew={editingProfileData}
                              onChange={setEditingProfileData}
                              onSave={async () => {
                                try {
                                  // Atualiza direto em membros_tripulacao (cpf/rg/endereco estão lá)
                                  const { error } = await supabase
                                    .from('membros_tripulacao')
                                    .update({
                                      cpf: editingProfileData.cpf || null,
                                      rg: editingProfileData.rg || null,
                                      endereco: editingProfileData.endereco || null,
                                    })
                                    .eq('id', editingProfileData.id);
                                  if (error) throw error;

                                  setSelectedCrew({ ...selectedCrew, ...editingProfileData });
                                  setIsEditingProfile(false);
                                  setEditingProfileData(null);
                                  toast({ title: "Perfil atualizado com sucesso" });
                                  loadCrewMembers();
                                } catch (error: any) {
                                  toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
                                }
                              }}
                            />
                          ) : (
                            <div className="flex items-center gap-6">
                              {selectedCrew.url_avatar
                                ? <img src={selectedCrew.url_avatar} alt={selectedCrew.nome_completo} className="w-32 h-32 rounded-full object-cover" />
                                : <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center"><User size={48} className="text-primary" /></div>
                              }
                              <div className="space-y-3 flex-1">
                                {/* nome_completo — campo real */}
                                <h2 className="text-2xl font-bold">{selectedCrew.nome_completo}</h2>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="flex items-center gap-2">
                                    <Award className="text-primary" size={16} />
                                    <span><strong>CANAC:</strong> {selectedCrew.canac}</span>
                                  </div>
                                  {selectedCrew.cpf && (
                                    <div className="flex items-center gap-2">
                                      <FileText className="text-primary" size={16} />
                                      <span><strong>CPF:</strong> {selectedCrew.cpf}</span>
                                    </div>
                                  )}
                                  {selectedCrew.rg && (
                                    <div className="flex items-center gap-2">
                                      <FileText className="text-primary" size={16} />
                                      <span><strong>RG:</strong> {selectedCrew.rg}</span>
                                    </div>
                                  )}
                                  {selectedCrew.email && (
                                    <div className="flex items-center gap-2">
                                      <Mail className="text-primary" size={16} />
                                      <span>{selectedCrew.email}</span>
                                    </div>
                                  )}
                                  {selectedCrew.telefone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="text-primary" size={16} />
                                      <span>{selectedCrew.telefone}</span>
                                    </div>
                                  )}
                                  {selectedCrew.data_nascimento && (
                                    <div className="flex items-center gap-2">
                                      <Calendar className="text-primary" size={16} />
                                      <span><strong>Nascimento:</strong> {formatDateToBR(selectedCrew.data_nascimento)}</span>
                                    </div>
                                  )}
                                  {selectedCrew.endereco && (
                                    <div className="flex items-center gap-2 col-span-2">
                                      <MapPin className="text-primary" size={16} />
                                      <span><strong>Endereço:</strong> {selectedCrew.endereco}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Horas de Voo */}
                    <TabsContent value="hours">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2"><Clock size={20} /> Horas de Voo por Aeronave</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {flightHours.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Aeronave</TableHead>
                                  <TableHead className="text-right">Total de Horas</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {flightHours.map(h => (
                                  <TableRow key={h.id}>
                                    <TableCell className="font-medium">
                                      {/* matricula/modelo — colunas reais da aeronave */}
                                      {(h.aeronave as any)?.matricula} — {(h.aeronave as any)?.modelo}
                                    </TableCell>
                                    {/* horas_totais — coluna real */}
                                    <TableCell className="text-right">{Number(h.horas_totais || 0).toFixed(1)}h</TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="font-bold bg-muted">
                                  <TableCell>TOTAL GERAL</TableCell>
                                  <TableCell className="text-right">
                                    {flightHours.reduce((acc, h) => acc + Number(h.horas_totais || 0), 0).toFixed(1)}h
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">Nenhuma hora de voo registrada</div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Habilitações */}
                    <TabsContent value="licenses">
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2"><Award size={20} /> Habilitações e Licenças</CardTitle>
                            <Dialog open={isLicenseDialogOpen} onOpenChange={setIsLicenseDialogOpen}>
                              <DialogTrigger asChild>
                                <Button onClick={() => setEditingLicense(null)}>
                                  <Plus className="mr-2" size={16} /> Nova Habilitação
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>{editingLicense ? 'Editar Habilitação' : 'Nova Habilitação'}</DialogTitle>
                                </DialogHeader>
                                <LicenseForm
                                  license={editingLicense}
                                  onSave={saveLicense}
                                  onCancel={() => { setIsLicenseDialogOpen(false); setEditingLicense(null); }}
                                />
                              </DialogContent>
                            </Dialog>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {licenses.length > 0 ? (
                            <div className="space-y-4">
                              {licenses.map(license => (
                                <div key={license.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 space-y-3">
                                      <div className="flex items-center gap-3">
                                        {/* tipo_habilitacao — campo real */}
                                        <h3 className="font-semibold text-lg">{license.tipo_habilitacao}</h3>
                                        {getLicenseStatusBadge(license, canEditHabilitacoes ? () => {
                                          setEditingLicense(license);
                                          setIsLicenseDialogOpen(true);
                                        } : undefined)}
                                      </div>
                                      <div className="grid grid-cols-2 gap-3 text-sm">
                                        {license.CMA ? (
                                          <>
                                            {license.CMA && <div><strong>Classe:</strong> {license.CMA}</div>}
                                            {license.FS_RH && <div><strong>FS/RH:</strong> {license.FS_RH}</div>}
                                            {license.validade_cma && <div className="col-span-2"><strong>Validade CMA:</strong> {formatDateToBR(license.validade_cma)}</div>}
                                          </>
                                        ) : (
                                          // data_validade — campo real
                                          license.data_validade && (
                                            <div className="col-span-2"><strong>Validade:</strong> {formatDateToBR(license.data_validade)}</div>
                                          )
                                        )}
                                      </div>
                                      {license.observacao && <p className="text-sm text-muted-foreground">{license.observacao}</p>}
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                      <Button variant="ghost" size="sm" onClick={() => deleteLicense(license.id)}>
                                        <Trash2 size={16} />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">Nenhuma habilitação cadastrada</div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Escala (usa lancamentos_diario_bordo) */}
                    <TabsContent value="schedule">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2"><Calendar size={20} /> Próximas Escalas de Voo</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {schedules.length > 0 ? (
                            <div className="space-y-3">
                              {schedules.map(s => (
                                <div key={s.id} className="border rounded-lg p-4 flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <div className="text-center">
                                      <p className="text-2xl font-bold">{new Date(s.data_registro + 'T00:00:00').getDate()}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {new Date(s.data_registro + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-semibold">{s.aerodromo_partida} → {s.aerodromo_chegada}</p>
                                      <p className="text-sm text-muted-foreground">{s.natureza_voo}</p>
                                    </div>
                                  </div>
                                  <Badge variant={s.confirmado ? 'default' : 'secondary'}>
                                    {s.confirmado ? 'Confirmado' : 'Pendente'}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">Nenhuma escala programada</div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="registration">
            <CrewRegistrationForm />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

// ── Formulário de licença ──────────────────────────────────────────────────────
// Usa os nomes de campo reais do schema: tipo_habilitacao, data_validade
function LicenseForm({
  license,
  onSave,
  onCancel,
}: {
  license: CrewLicense | null;
  onSave: (data: Partial<CrewLicense>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Partial<CrewLicense>>(
    license || { tipo_habilitacao: '', data_validade: '', observacao: '', CMA: '', FS_RH: '', validade_cma: '' }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tipo_habilitacao) {
      toast({ title: "Informe o tipo de habilitação", variant: "destructive" });
      return;
    }
    if (formData.tipo_habilitacao === 'CMA') {
      if (!formData.validade_cma) {
        toast({ title: "Preencha a validade do CMA", variant: "destructive" });
        return;
      }
    } else if (!formData.data_validade) {
      toast({ title: "Preencha a data de validade", variant: "destructive" });
      return;
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label>Tipo de Habilitação *</Label>
          <Input
            value={formData.tipo_habilitacao}
            onChange={e => setFormData({ ...formData, tipo_habilitacao: e.target.value })}
            placeholder="Ex: PP, PC, CMA, IFR"
          />
        </div>

        {formData.tipo_habilitacao === 'CMA' ? (
          <>
            <div>
              <Label>Classe CMA</Label>
              <Select value={formData.CMA || ''} onValueChange={v => setFormData({ ...formData, CMA: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a classe" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primeira">1ª Classe</SelectItem>
                  <SelectItem value="segunda">2ª Classe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo Sanguíneo (FS/RH)</Label>
              <Select value={formData.FS_RH || ''} onValueChange={v => setFormData({ ...formData, FS_RH: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Validade CMA</Label>
              {/* type="date" — corrigido de "data" */}
              <Input type="date" value={formData.validade_cma || ''} onChange={e => setFormData({ ...formData, validade_cma: e.target.value })} />
            </div>
          </>
        ) : (
          <div className="sm:col-span-2">
            <Label>Data de Validade *</Label>
            {/* type="date" — corrigido de "data" */}
            <Input type="date" value={formData.data_validade || ''} onChange={e => setFormData({ ...formData, data_validade: e.target.value })} required />
          </div>
        )}

        <div className="sm:col-span-2">
          <Label>Observações</Label>
          <Textarea value={formData.observacao || ''} onChange={e => setFormData({ ...formData, observacao: e.target.value })} rows={4} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">Cancelar</Button>
        <Button type="submit" className="w-full sm:w-auto">Salvar</Button>
      </div>
    </form>
  );
}

// ── Formulário de edição de perfil ────────────────────────────────────────────
function EditProfileForm({
  crew,
  onChange,
  onSave,
}: {
  crew: CrewMember;
  onChange: (crew: CrewMember) => void;
  onSave: () => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>CPF</Label>
          <Input value={crew.cpf || ''} onChange={e => onChange({ ...crew, cpf: e.target.value })} placeholder="000.000.000-00" />
        </div>
        <div className="space-y-2">
          <Label>RG</Label>
          <Input value={crew.rg || ''} onChange={e => onChange({ ...crew, rg: e.target.value })} placeholder="00.000.000-0" />
        </div>
        <div className="col-span-2 space-y-2">
          <Label>Endereço</Label>
          {/* onChange usa endereco — campo real */}
          <Input value={crew.endereco || ''} onChange={e => onChange({ ...crew, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" onClick={async () => { setIsSaving(true); try { await onSave(); } finally { setIsSaving(false); } }} disabled={isSaving} className="gap-2">
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
}