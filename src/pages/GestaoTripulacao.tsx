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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { User, Plane, Calendar, Award, AlertTriangle, Plus, Edit, Trash2, Phone, Mail, MapPin, Clock, FileText, Eye, Lock, Users, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CrewMemberCard } from "@/components/tripulacao/TripulacaoCard";
interface CrewMember {
  id: string;
  full_name: string;
  canac: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  status: string;
  photo_url?: string;
  user_id?: string;
  role?: string;
  cpf?: string;
  rg?: string;
  address?: string;
}
interface CrewFlightHours {
  id: string;
  crew_member_id: string;
  aircraft_id: string;
  total_hours: number;
  aircraft?: {
    registration: string;
    model: string;
  };
}
interface CrewLicense {
  id: string;
  crew_member_id: string;
  license_type: string;
  expiry_date?: string;
  status?: string;
  observacao?: string;
  CMA?: string;
  FS_RH?: string;
  validade_cma?: string;
}
interface FlightSchedule {
  id: string;
  flight_date: string;
  flight_time: string;
  origin: string;
  destination: string;
  status: string;
  aircraft_id?: string;
  client_id?: string;
}
export default function GestaoDeTripulacao() {
  const navigate = useNavigate();
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [selectedCrew, setSelectedCrew] = useState<CrewMember | null>(null);
  const [flightHours, setFlightHours] = useState<CrewFlightHours[]>([]);
  const [licenses, setLicenses] = useState<CrewLicense[]>([]);
  const [schedules, setSchedules] = useState<FlightSchedule[]>([]);
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<CrewLicense | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'ativo' | 'inativo'>('ativo');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editingProfileData, setEditingProfileData] = useState<CrewMember | null>(null);
  const { hasRole, userRoles, isLoading: rolesLoading } = useUserRole();

  const canEditProfile = hasRole('piloto_chefe') || hasRole('admin') || hasRole('gestor_master') || hasRole('financeiro_master');
  const canEditHabilitacoes = hasRole('admin') || hasRole('gestor_master') || hasRole('piloto_chefe') || hasRole('coordenador_voo');
  useEffect(() => {
    loadCrewMembers();
  }, [statusFilter]);
  useEffect(() => {
    if (selectedCrew) {
      loadCrewDetails(selectedCrew.id);
    }
  }, [selectedCrew]);
  const loadCrewMembers = async () => {
    const {
      data,
      error
    } = await supabase.from('crew_members').select('*').eq('status', statusFilter).order('full_name');
    if (error) {
      toast({
        title: "Erro ao carregar tripulantes",
        variant: "destructive"
      });
      return;
    }

    // Carregar roles e dados adicionais dos tripulantes
    const crewWithDetails = await Promise.all((data || []).map(async crew => {
      let crewData: CrewMember = {
        ...crew,
        role: 'Tripulante'
      };

      if (crew.user_id) {
        const {
          data: roleData
        } = await supabase.from('user_roles').select('role').eq('user_id', crew.user_id);
        const isPilotChief = roleData?.some(r => r.role === 'piloto_chefe');
        crewData.role = isPilotChief ? 'Piloto Chefe' : 'Tripulante';

        // Tentar carregar CPF, RG, Endereço e Avatar URL do user_profiles
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('cpf, rg, address, avatar_url')
          .eq('id', crew.user_id)
          .single();

        if (profileData) {
          crewData.cpf = profileData.cpf || undefined;
          crewData.rg = profileData.rg || undefined;
          crewData.address = profileData.address || undefined;
          // Usar avatar_url como fallback se photo_url não estiver preenchido
          if (!crewData.photo_url && profileData.avatar_url) {
            crewData.photo_url = profileData.avatar_url;
          }
        }
      }

      return crewData;
    }));
    setCrewMembers(crewWithDetails);
  };
  const loadCrewDetails = async (crewId: string) => {
    // Carregar horas de voo
    const {
      data: hoursData
    } = await supabase.from('crew_flight_hours').select(`
        *,
        aircraft:aircraft_id (
          registration,
          model
        )
      `).eq('crew_member_id', crewId);
    setFlightHours(hoursData || []);

    // Carregar licenças
    const {
      data: licensesData
    } = await (supabase as any).from('crew_licenses').select('*').eq('crew_member_id', crewId).order('created_at', { ascending: false });
    setLicenses(licensesData || []);

    // Carregar escalas de voo
    const {
      data: schedulesData
    } = await supabase.from('flight_schedules').select('*').eq('crew_member_id', crewId).gte('flight_date', new Date().toISOString().split('T')[0]).order('flight_date', {
      ascending: true
    }).limit(10);
    setSchedules(schedulesData || []);
  };
  const getLicenseStatusBadge = (license: CrewLicense, onEdit?: () => void) => {
    // Para CMA, usar validade_cma; para outros, usar expiry_date
    const dateStr = license.license_type === 'CMA' ? license.validade_cma : license.expiry_date;

    if (!dateStr) {
      return <Badge className="bg-gray-500">Sem data de validade</Badge>;
    }

    const expiryDate = new Date(dateStr);
    const today = new Date();
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const badgeClass = "flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity";

    if (daysUntilExpiry < 0) {
      return <Badge variant="destructive" className={badgeClass} onClick={onEdit}>
        <AlertTriangle size={14} /> Vencida
      </Badge>;
    } else if (daysUntilExpiry <= 60) {
      return <Badge className={`bg-yellow-500 ${badgeClass}`} onClick={onEdit}>
        <AlertTriangle size={14} /> Vence em {daysUntilExpiry} dias
      </Badge>;
    } else {
      return <Badge className={`bg-green-500 ${badgeClass}`} onClick={onEdit}>Válida</Badge>;
    }
  };
  const saveLicense = async (licenseData: Partial<CrewLicense>) => {
    if (!selectedCrew || !canEditHabilitacoes) {
      toast({
        title: "Sem permissão",
        description: "Você não tem permissão para editar habilitações.",
        variant: "destructive"
      });
      return;
    }
    const payload = {
      crew_member_id: selectedCrew.id,
      license_number: "", // Campo obrigatório no banco
      ...licenseData
    };
    if (editingLicense) {
      const {
        error
      } = await (supabase as any).from('crew_licenses').update(payload).eq('id', editingLicense.id);
      if (error) {
        toast({
          title: "Erro ao atualizar licença",
          variant: "destructive"
        });
        return;
      }
    } else {
      const {
        error
      } = await (supabase as any).from('crew_licenses').insert([payload]);
      if (error) {
        toast({
          title: "Erro ao criar licença",
          variant: "destructive"
        });
        return;
      }
    }
    toast({
      title: "Licença salva com sucesso!"
    });
    setIsLicenseDialogOpen(false);
    setEditingLicense(null);
    loadCrewDetails(selectedCrew.id);
  };
  const deleteLicense = async (licenseId: string) => {
    if (!canEditHabilitacoes) {
      toast({
        title: "Sem permissão",
        description: "Você não tem permissão para deletar habilitações.",
        variant: "destructive"
      });
      return;
    }
    if (!confirm('Deseja realmente excluir esta licença?')) return;
    const {
      error
    } = await (supabase as any).from('crew_licenses').delete().eq('id', licenseId);
    if (error) {
      toast({
        title: "Erro ao excluir licença",
        variant: "destructive"
      });
      return;
    }
    toast({
      title: "Licença excluída com sucesso!"
    });
    if (selectedCrew) loadCrewDetails(selectedCrew.id);
  };
  const filteredCrewMembers = crewMembers.filter(crew => crew.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || crew.canac.toLowerCase().includes(searchTerm.toLowerCase()));
  const formatDate = formatDateToBR;
  return <Layout>
    <div className="p-4 md:p-6 space-y-6 bg-background min-h-screen">
      {/* Header com busca integrada */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="h-10 w-10 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
            title="Voltar ao dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Gestão de Tripulação</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredCrewMembers.length} tripulante{filteredCrewMembers.length !== 1 ? 's' : ''} {statusFilter === 'ativo' ? 'ativos' : 'inativos'}
            </p>
          </div>
        </div>

        {/* Barra de busca e filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CANAC..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 bg-zinc-900/50 border-zinc-700/50 focus:border-primary h-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStatusFilter('ativo')}
              className={`h-10 px-4 ${statusFilter === 'ativo'
                ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                : 'bg-zinc-900/50 border-zinc-700/50 text-muted-foreground hover:text-foreground hover:bg-zinc-800'}`}
            >
              Ativos
            </Button>
            <Button
              variant="outline"
              onClick={() => setStatusFilter('inativo')}
              className={`h-10 px-4 ${statusFilter === 'inativo'
                ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                : 'bg-zinc-900/50 border-zinc-700/50 text-muted-foreground hover:text-foreground hover:bg-zinc-800'}`}
            >
              Inativos
            </Button>
          </div>
        </div>
      </div>

      {/* Grid de Cards de Tripulantes */}
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

      {/* Dialog de Detalhes do Tripulante */}
      <Dialog open={!!selectedCrew} onOpenChange={open => !open && setSelectedCrew(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User size={24} />
              Perfil Completo - {selectedCrew?.full_name}
            </DialogTitle>
          </DialogHeader>
          {selectedCrew ? <Tabs defaultValue="profile" className="space-y-4">
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
                    <CardTitle className="flex items-center gap-2">
                      <User size={20} />
                      Dados Pessoais e Profissionais
                    </CardTitle>
                    {canEditProfile ? (
                      <Button
                        size="sm"
                        variant={isEditingProfile ? "default" : "outline"}
                        onClick={() => {
                          if (isEditingProfile) {
                            setEditingProfileData(null);
                          } else {
                            setEditingProfileData(selectedCrew);
                          }
                          setIsEditingProfile(!isEditingProfile);
                        }}
                        className="gap-2"
                      >
                        <Edit size={16} />
                        {isEditingProfile ? 'Cancelar' : 'Editar'}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Lock size={14} />
                        Sem permissão
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
                          if (!editingProfileData.user_id) {
                            toast({
                              title: "Erro",
                              description: "Tripulante sem usuário associado",
                              variant: "destructive"
                            });
                            return;
                          }

                          const { error } = await supabase
                            .from('user_profiles')
                            .update({
                              cpf: editingProfileData.cpf || null,
                              rg: editingProfileData.rg || null,
                              address: editingProfileData.address || null
                            })
                            .eq('id', editingProfileData.user_id);

                          if (error) throw error;

                          setSelectedCrew({ ...selectedCrew, ...editingProfileData });
                          setIsEditingProfile(false);
                          setEditingProfileData(null);
                          toast({
                            title: "Sucesso",
                            description: "Perfil atualizado com sucesso"
                          });
                          loadCrewDetails(selectedCrew.id);
                        } catch (error: any) {
                          toast({
                            title: "Erro ao salvar",
                            description: error.message,
                            variant: "destructive"
                          });
                        }
                      }}
                    />
                  ) : (
                    <div className="flex items-center gap-6">
                      {selectedCrew.photo_url ? <img src={selectedCrew.photo_url} alt={selectedCrew.full_name} className="w-32 h-32 rounded-full object-cover" /> : <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
                        <User size={48} className="text-primary" />
                      </div>}
                      <div className="space-y-3 flex-1">
                        <h2 className="text-2xl font-bold">{selectedCrew.full_name}</h2>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Award className="text-primary" size={16} />
                            <span><strong>CANAC:</strong> {selectedCrew.canac}</span>
                          </div>
                          {selectedCrew.cpf && <div className="flex items-center gap-2">
                            <FileText className="text-primary" size={16} />
                            <span><strong>CPF:</strong> {selectedCrew.cpf}</span>
                          </div>}
                          {selectedCrew.rg && <div className="flex items-center gap-2">
                            <FileText className="text-primary" size={16} />
                            <span><strong>RG:</strong> {selectedCrew.rg}</span>
                          </div>}
                          {selectedCrew.email && <div className="flex items-center gap-2">
                            <Mail className="text-primary" size={16} />
                            <span>{selectedCrew.email}</span>
                          </div>}
                          {selectedCrew.phone && <div className="flex items-center gap-2">
                            <Phone className="text-primary" size={16} />
                            <span>{selectedCrew.phone}</span>
                          </div>}
                          {selectedCrew.birth_date && <div className="flex items-center gap-2">
                            <Calendar className="text-primary" size={16} />
                            <span><strong>Nascimento:</strong> {formatDate(selectedCrew.birth_date)}</span>
                          </div>}
                          {selectedCrew.address && <div className="flex items-center gap-2 col-span-2">
                            <MapPin className="text-primary" size={16} />
                            <span><strong>Endereço:</strong> {selectedCrew.address}</span>
                          </div>}
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
                  <CardTitle className="flex items-center gap-2">
                    <Clock size={20} />
                    Horas de Voo por Aeronave
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {flightHours.length > 0 ? <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aeronave</TableHead>
                        <TableHead className="text-right">Total de Horas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flightHours.map(hours => <TableRow key={hours.id}>
                        <TableCell className="font-medium">
                          {(hours.aircraft as any)?.registration} - {(hours.aircraft as any)?.model}
                        </TableCell>
                        <TableCell className="text-right">{hours.total_hours.toFixed(1)}h</TableCell>
                      </TableRow>)}
                      <TableRow className="font-bold bg-muted">
                        <TableCell>TOTAL GERAL</TableCell>
                        <TableCell className="text-right">
                          {flightHours.reduce((acc, h) => acc + h.total_hours, 0).toFixed(1)}h
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table> : <div className="text-center py-8 text-muted-foreground">
                    Nenhuma hora de voo registrada
                  </div>}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Habilitações */}
            <TabsContent value="licenses">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Award size={20} />
                      Habilitações e Licenças
                    </CardTitle>
                    <Dialog open={isLicenseDialogOpen} onOpenChange={setIsLicenseDialogOpen}>
                      <DialogTrigger asChild>
                        <Button onClick={() => setEditingLicense(null)} disabled={!canEditHabilitacoes}>
                          <Plus className="mr-2" size={16} />
                          Nova Habilitação
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>
                            {editingLicense ? 'Editar Habilitação' : 'Nova Habilitação'}
                          </DialogTitle>
                        </DialogHeader>
                        <LicenseForm license={editingLicense} onSave={saveLicense} onCancel={() => {
                          setIsLicenseDialogOpen(false);
                          setEditingLicense(null);
                        }} />
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {licenses.length > 0 ? <div className="space-y-4">
                    {licenses.map(license => <div key={license.id} className="relative border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">{license.license_type}</h3>
                            {getLicenseStatusBadge(license, canEditHabilitacoes ? () => {
                              setEditingLicense(license);
                              setIsLicenseDialogOpen(true);
                            } : undefined)}
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {license.license_type === 'CMA' ? (
                              <>
                                {license.CMA && <div><strong>Classe:</strong> {license.CMA}</div>}
                                {license.FS_RH && <div><strong>FS/RH:</strong> {license.FS_RH}</div>}
                                {license.validade_cma && <div className="col-span-2"><strong>Validade CMA:</strong> {formatDate(license.validade_cma)}</div>}
                              </>
                            ) : (
                              <>
                                {license.expiry_date && <div className="col-span-2"><strong>Validade:</strong> {formatDate(license.expiry_date)}</div>}
                              </>
                            )}
                          </div>
                          {license.observacao && <p className="text-sm text-muted-foreground">{license.observacao}</p>}
                        </div>
                        <div className="flex gap-2 ml-4">
                          {canEditHabilitacoes && (
                            <Button variant="ghost" size="sm" onClick={() => deleteLicense(license.id)}>
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>)}
                  </div> : <div className="text-center py-8 text-muted-foreground">
                    Nenhuma habilitação cadastrada
                  </div>}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Escala de Voo */}
            <TabsContent value="schedule">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar size={20} />
                    Próximas Escalas de Voo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {schedules.length > 0 ? <div className="space-y-3">
                    {schedules.map(schedule => <div key={schedule.id} className="border rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold">
                            {new Date(schedule.flight_date).getDate()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(schedule.flight_date).toLocaleDateString('pt-BR', {
                              month: 'short'
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold">
                            {schedule.origin} → {schedule.destination}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Horário: {schedule.flight_time}
                          </p>
                        </div>
                      </div>
                      <Badge variant={schedule.status === 'confirmado' ? 'default' : 'secondary'}>
                        {schedule.status}
                      </Badge>
                    </div>)}
                  </div> : <div className="text-center py-8 text-muted-foreground">
                    Nenhuma escala programada
                  </div>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs> : null}
        </DialogContent>
      </Dialog>
    </div>
  </Layout>;
}

// Componente de formulário de licença
function LicenseForm({
  license,
  onSave,
  onCancel
}: {
  license: CrewLicense | null;
  onSave: (data: Partial<CrewLicense>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Partial<CrewLicense>>(license || {
    license_type: '',
    expiry_date: '',
    observacao: '',
    CMA: '',
    FS_RH: '',
    validade_cma: ''
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.license_type) {
      toast({
        title: "Informe o tipo de licença",
        variant: "destructive"
      });
      return;
    }

    // Para CMA, validar validade_cma; para outros, validar expiry_date
    if (formData.license_type === 'CMA') {
      if (!formData.validade_cma && !formData.expiry_date) {
        toast({
          title: "Preencha a validade para CMA",
          variant: "destructive"
        });
        return;
      }
    } else if (!formData.expiry_date) {
      toast({
        title: "Preencha a data de validade",
        variant: "destructive"
      });
      return;
    }

    onSave(formData);
  };
  return <form onSubmit={handleSubmit} className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <Label>Tipo de Licença *</Label>
        <Input value={formData.license_type} onChange={e => setFormData({
          ...formData,
          license_type: e.target.value
        })} placeholder="Ex: PP, PC, CMA, IFR" />
      </div>

      {formData.license_type === 'CMA' ? (
        <>
          <div>
            <Label>Classe CMA</Label>
            <Input value={formData.CMA || ''} onChange={e => setFormData({
              ...formData,
              CMA: e.target.value
            })} placeholder="Ex: Primeira, Segunda, Terceira" />
          </div>
          <div>
            <Label>FS/RH</Label>
            <Input value={formData.FS_RH || ''} onChange={e => setFormData({
              ...formData,
              FS_RH: e.target.value
            })} />
          </div>
          <div className="col-span-2">
            <Label>Validade CMA</Label>
            <Input type="date" value={formData.validade_cma || ''} onChange={e => setFormData({
              ...formData,
              validade_cma: e.target.value
            })} />
          </div>
        </>
      ) : (
        <div>
          <Label>Data de Validade *</Label>
          <Input type="date" value={formData.expiry_date} onChange={e => setFormData({
            ...formData,
            expiry_date: e.target.value
          })} required />
        </div>
      )}

      <div className="col-span-2">
        <Label>Observações</Label>
        <Textarea value={formData.observacao || ''} onChange={e => setFormData({
          ...formData,
          observacao: e.target.value
        })} rows={3} />
      </div>
    </div>
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit">
        Salvar
      </Button>
    </div>
  </form>;
}

// Componente de formulário de edição de perfil
function EditProfileForm({
  crew,
  onChange,
  onSave
}: {
  crew: CrewMember;
  onChange: (crew: CrewMember) => void;
  onSave: () => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>CPF</Label>
          <Input
            value={crew.cpf || ''}
            onChange={(e) => onChange({ ...crew, cpf: e.target.value })}
            placeholder="000.000.000-00"
          />
        </div>
        <div className="space-y-2">
          <Label>RG</Label>
          <Input
            value={crew.rg || ''}
            onChange={(e) => onChange({ ...crew, rg: e.target.value })}
            placeholder="00.000.000-0"
          />
        </div>
        <div className="col-span-2 space-y-2">
          <Label>Endereço</Label>
          <Input
            value={crew.address || ''}
            onChange={(e) => onChange({ ...crew, address: e.target.value })}
            placeholder="Rua, número, bairro, cidade"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          type="button"
          variant="default"
          onClick={handleSave}
          disabled={isSaving}
          className="gap-2"
        >
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
}
