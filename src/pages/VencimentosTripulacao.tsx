import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useVencimentosSync } from '@/contexts/VencimentosSyncContext';
import { Search, Users, AlertCircle, AlertTriangle, CheckCircle, Clock, Plus, Calendar, Award, Eye, X, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ModernNotification } from '@/components/notifications/ModernNotification';

interface CrewMember {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  canac?: string;
  employment_status?: string;
}

interface CrewLicense {
  id: string;
  crew_member_id: string;
  license_type: string;
  expiry_date?: string;
  status?: string;
  validade_cma?: string;
  observacao?: string;
}

interface Habilitacao {
  id: string;
  licenseId: string;
  habilitacao: string;
  dataVencimento: string;
  diasRestantes: number;
  status: 'vencido' | 'proximo' | 'ok';
  tipo: 'habilitacao' | 'cma';
}

interface TripulanteVencimento {
  tripulanteId: string;
  tripulanteName: string;
  tripulanteAvatar?: string;
  habilitacoes: Habilitacao[];
  statusGeral: 'vencido' | 'proximo' | 'ok'; // Status do primeiro vencimento
}

export default function VencimentosTripulacao() {
  const { toast } = useToast();
  const { subscribe } = useVencimentosSync();
  const [vencimentos, setVencimentos] = useState<TripulanteVencimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatus, setActiveStatus] = useState<'todos' | 'vencidos' | 'proximos' | 'ok'>('todos');
  const [editingHabilitacao, setEditingHabilitacao] = useState<{ habilitacao: Habilitacao; tripulanteName: string } | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; title: string; description?: string } | null>(null);

  useEffect(() => {
    loadVencimentos();

    // Inscrever para mudanças em tempo real
    const unsubscribe = subscribe((event) => {
      if (event.entityType === 'crew_license') {
        loadVencimentos();
      }
    });

    return unsubscribe;
  }, [subscribe]);

  const loadVencimentos = async () => {
    setLoading(true);
    try {
      // Carregar membros da tripulação
      const { data: crew, error: crewError } = await supabase
        .from('membros_tripulacao')
        .select('*')
        .eq('status', 'ativo')
        .order('nome_completo');

      if (crewError) throw crewError;

      const vencimentosTemp: TripulanteVencimento[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Para cada membro da tripulação, carregar suas habilitações
      for (const member of crew || []) {
        const { data: licenses, error: licenseError } = await supabase
          .from('habilitacoes_tripulante')
          .select('*')
          .eq('membro_tripulacao_id', member.id);

        if (licenseError) {
          console.error('Erro ao carregar habilitações:', licenseError);
          continue;
        }

        const habilitacoes: Habilitacao[] = [];
        let statusGeral: 'vencido' | 'proximo' | 'ok' = 'ok';

        // Processar habilitações
        for (const license of licenses || []) {
          if (license.expiry_date) {
            const expiryDate = new Date(license.expiry_date);
            expiryDate.setHours(0, 0, 0, 0);
            const diasRestantes = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            let status: 'vencido' | 'proximo' | 'ok';
            if (diasRestantes < 0) status = 'vencido';
            else if (diasRestantes <= 60) status = 'proximo';
            else status = 'ok';

            // Atualizar status geral (prioridade: vencido > proximo > ok)
            if (status === 'vencido') statusGeral = 'vencido';
            else if (status === 'proximo' && statusGeral !== 'vencido') statusGeral = 'proximo';

            habilitacoes.push({
              id: `${member.id}-${license.id}-hab`,
              licenseId: license.id,
              habilitacao: license.license_type || 'Habilitação',
              dataVencimento: license.expiry_date,
              diasRestantes,
              status,
              tipo: 'habilitacao',
            });
          }

          // Processar CMA se existir
          if (license.validade_cma) {
            const expiryDate = new Date(license.validade_cma);
            expiryDate.setHours(0, 0, 0, 0);
            const diasRestantes = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            let status: 'vencido' | 'proximo' | 'ok';
            if (diasRestantes < 0) status = 'vencido';
            else if (diasRestantes <= 60) status = 'proximo';
            else status = 'ok';

            // Atualizar status geral
            if (status === 'vencido') statusGeral = 'vencido';
            else if (status === 'proximo' && statusGeral !== 'vencido') statusGeral = 'proximo';

            habilitacoes.push({
              id: `${member.id}-${license.id}-cma`,
              licenseId: license.id,
              habilitacao: `CMA (${license.license_type})`,
              dataVencimento: license.validade_cma,
              diasRestantes,
              status,
              tipo: 'cma',
            });
          }
        }

        // Adicionar tripulante com suas habilitações (mesmo sem habilitações)
        vencimentosTemp.push({
          tripulanteId: member.id,
          tripulanteName: member.full_name,
          tripulanteAvatar: member.avatar_url,
          habilitacoes,
          statusGeral: habilitacoes.length > 0 ? statusGeral : 'ok',
        });
      }

      setVencimentos(vencimentosTemp);
    } catch (error) {
      console.error('Erro ao carregar vencimentos:', error);
      setNotification({
        type: 'error',
        title: 'Erro ao carregar vencimentos',
        description: 'Tente novamente mais tarde'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDate = async () => {
    if (!editingHabilitacao || !newDate) return;

    try {
      const { error } = await supabase
        .from('habilitacoes_tripulante')
        .update({
          [editingHabilitacao.habilitacao.tipo === 'habilitacao' ? 'data_validade' : 'validade_cma']: newDate
        })
        .eq('id', editingHabilitacao.habilitacao.licenseId);

      if (error) throw error;

      setNotification({
        type: 'success',
        title: 'Data atualizada com sucesso!',
        description: `${editingHabilitacao.habilitacao.habilitacao} de ${editingHabilitacao.tripulanteName} atualizada`
      });

      setEditDialogOpen(false);
      setEditingHabilitacao(null);
      setNewDate('');
      loadVencimentos();
    } catch (error) {
      console.error('Erro ao atualizar data:', error);
      setNotification({
        type: 'error',
        title: 'Erro ao atualizar data',
        description: 'Tente novamente'
      });
    }
  };

  const filteredVencimentos = useMemo(() => {
    return vencimentos.filter(tripulante => {
      // Filtrar por nome
      const matchSearch = tripulante.tripulanteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tripulante.habilitacoes.some(h => h.habilitacao.toLowerCase().includes(searchTerm.toLowerCase()));

      // Filtrar por status: verifica se tripulante tem habilitações do status selecionado
      let matchStatus = true;
      if (activeStatus !== 'todos') {
        matchStatus = tripulante.habilitacoes.some(h => h.status === activeStatus);
      }

      return matchSearch && matchStatus;
    });
  }, [vencimentos, searchTerm, activeStatus]);

  const stats = useMemo(() => {
    // Contar habilitações por status
    let vencidosCount = 0;
    let proximosCount = 0;
    let okCount = 0;

    vencimentos.forEach(tripulante => {
      tripulante.habilitacoes.forEach(hab => {
        if (hab.status === 'vencido') vencidosCount++;
        else if (hab.status === 'proximo') proximosCount++;
        else if (hab.status === 'ok') okCount++;
      });
    });

    return {
      vencidos: vencidosCount,
      proximos: proximosCount,
      ok: okCount,
      total: vencimentos.length
    };
  }, [vencimentos]);

  const getStatusInfo = (status: 'vencido' | 'proximo' | 'ok') => {
    const statusMap = {
      vencido: {
        label: 'Vencido',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        textColor: 'text-red-400',
        badgeClass: 'bg-red-500/20 text-red-400 border-red-500',
        icon: AlertCircle
      },
      proximo: {
        label: 'Vence em Breve',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        textColor: 'text-yellow-400',
        badgeClass: 'bg-yellow-500/20 text-yellow-400 border-yellow-500',
        icon: AlertTriangle
      },
      ok: {
        label: 'Em Dia',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        textColor: 'text-green-400',
        badgeClass: 'bg-green-500/20 text-green-400 border-green-500',
        icon: CheckCircle
      }
    };
    return statusMap[status];
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Carregando vencimentos...</span>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        {/* Background gradient orbs */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-pink-500/5 rounded-full blur-[120px] mix-blend-screen" />
        </div>

        <div className="relative z-10">
          {/* Sticky Header */}
          <header className="sticky top-0 z-40 w-full bg-slate-950/80 backdrop-blur-[12px] border-b border-white/5">
            <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20 ring-1 ring-white/10 group cursor-pointer hover:scale-105 transition-transform">
                  <Users className="text-white text-xl" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white leading-tight">Vencimentos de Tripulação</h1>
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    Habilitações e CMA
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
            {/* Notification */}
            {notification && (
              <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
                <ModernNotification
                  type={notification.tipo}
                  title={notification.title}
                  description={notification.descricao}
                  duration={4000}
                  onClose={() => setNotification(null)}
                />
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-slate-800/30 backdrop-blur-[12px] border border-white/5 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:bg-slate-800/50 hover:border-white/10">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity pointer-events-none">
                  <AlertCircle className="text-8xl text-red-400 transform rotate-12" />
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-red-400">Vencidos</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white tracking-tight">{stats.vencidos}</span>
                      <span className="text-sm text-gray-400 font-medium">itens</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                    <span>Ação imediata</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-[12px] border border-white/5 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:bg-slate-800/50 hover:border-white/10 max-lg:bg-cyan-500 max-lg:bg-cover max-lg:bg-center max-lg:bg-no-repeat" style={{ backgroundImage: 'url(https://cdn.builder.io/api/v1/image/assets%2F25cf751450f841169c5b78d468379b00%2F9730745efc0547d9adf3f15857247c42)' }}>
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity pointer-events-none">
                  <AlertTriangle className="text-8xl text-yellow-400 transform -rotate-12" />
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-yellow-400"><p>Próximos 60 dias</p></span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white tracking-tight">{stats.proximos}</span>
                      <span className="text-sm text-gray-400 font-medium">itens</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                    <span>Requer atenção</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-[12px] border border-white/5 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:bg-slate-800/50 hover:border-white/10">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity pointer-events-none">
                  <CheckCircle className="text-8xl text-green-400 transform rotate-6" />
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-green-400">Em dia</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white tracking-tight">{stats.ok}</span>
                      <span className="text-sm text-gray-400 font-medium">itens</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                    <span>Regular</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-slate-800 rounded-2xl p-6 border border-purple-500/20 relative overflow-hidden shadow-lg shadow-purple-900/10 group hover:shadow-purple-500/10 transition-all duration-300 w-full text-left hover:border-purple-500/40 hover:from-purple-500/20">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl" />
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="text-purple-400 text-sm" size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Tripulação</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white tracking-tight">{stats.total}</span>
                      <span className="text-sm text-gray-400 font-medium">tripulantes</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-purple-500/10 flex items-center justify-between text-xs text-purple-400/80 font-medium">
                    <span>Gerenciar equipe</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="space-y-4">
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="text-gray-500 group-focus-within:text-purple-400 transition-colors" size={20} />
                </span>
                <input
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-800/60 border border-white/10 text-gray-200 placeholder-gray-500 rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-slate-800 transition-all text-sm font-medium"
                  placeholder="Buscar tripulante ou habilitação..."
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Status Filter Tabs */}
              <Tabs value={activeStatus} onValueChange={(v) => setActiveStatus(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-slate-800/30 border border-white/5 rounded-xl p-1">
                  <TabsTrigger value="todos" className="rounded-lg data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
                    Todos ({vencimentos.length})
                  </TabsTrigger>
                  <TabsTrigger value="vencidos" className="rounded-lg data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
                    Vencidos ({stats.vencidos})
                  </TabsTrigger>
                  <TabsTrigger value="proximos" className="rounded-lg data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">
                    Próximos ({stats.proximos})
                  </TabsTrigger>
                  <TabsTrigger value="ok" className="rounded-lg data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
                    Em Dia ({stats.ok})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Vencimentos Grid */}
            {filteredVencimentos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 min-h-[300px] flex flex-col items-center justify-center">
                <div className="flex flex-col items-center max-w-md mx-auto text-center p-6">
                  <Award className="w-12 h-12 text-purple-400/40 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Nenhum resultado encontrado</h3>
                  <p className="text-gray-400 text-sm">Ajuste os filtros para visualizar vencimentos</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredVencimentos.map((tripulante) => {
                  const statusInfo = getStatusInfo(tripulante.statusGeral);
                  const StatusIcon = statusInfo.icon;

                  return (
                    <div
                      key={tripulante.tripulanteId}
                      className={`rounded-xl border backdrop-blur-sm transition-all hover:shadow-lg ${statusInfo.bgColor} ${statusInfo.borderColor} p-5 group`}
                    >
                      {/* Header com Tripulante */}
                      <div className="flex items-start gap-4 mb-5 pb-4 border-b border-white/10">
                        <Avatar className="w-14 h-14 ring-2 ring-white/10 flex-shrink-0">
                          <AvatarImage src={tripulante.tripulanteAvatar} alt={tripulante.tripulanteName} />
                          <AvatarFallback className="bg-slate-700 text-sm font-semibold">
                            {tripulante.tripulanteName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-white truncate">{tripulante.tripulanteName}</p>
                          <p className="text-xs text-gray-400 mt-1">{tripulante.habilitacoes.length} habilitação{tripulante.habilitacoes.length !== 1 ? 's' : ''}</p>
                        </div>
                        <Badge className={statusInfo.badgeClass}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>

                      {/* Lista de Habilitações */}
                      <div className="space-y-3">
                        {tripulante.habilitacoes.length === 0 ? (
                          <div className="rounded-lg px-4 py-6 border border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center text-center">
                            <Award className="h-8 w-8 text-gray-500 mb-2 opacity-50" />
                            <p className="text-sm text-gray-400 font-medium">Sem habilitações cadastradas</p>
                            <p className="text-xs text-gray-500 mt-1">Clique em "Nova Habilitação" no tripulante para adicionar</p>
                          </div>
                        ) : (
                          tripulante.habilitacoes.map((hab) => {
                            const habStatusInfo = getStatusInfo(hab.status);
                            return (
                              <div key={hab.id} className={`rounded-lg px-3 py-2 border ${habStatusInfo.borderColor} ${habStatusInfo.bgColor}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-white">{hab.habilitacao}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Calendar className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                      <span className="text-xs text-gray-400">
                                        {new Date(hab.dataVencimento).toLocaleDateString('pt-BR')}
                                      </span>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 hover:bg-white/10"
                                    onClick={() => {
                                      setEditingHabilitacao({ habilitacao: hab, tripulanteName: tripulante.tripulanteName });
                                      setNewDate(hab.dataVencimento);
                                      setEditDialogOpen(true);
                                    }}
                                    title="Editar data de vencimento"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </div>

                                {/* Status Badge */}
                                {hab.status === 'vencido' ? (
                                  <div className="bg-red-500/20 rounded px-2 py-1 border border-red-500/30 inline-block">
                                    <p className="text-red-300 font-semibold text-xs">Vencido há {Math.abs(hab.diasRestantes)} dias</p>
                                  </div>
                                ) : (
                                  <div className="inline-block">
                                    <p className={`${habStatusInfo.textColor} font-semibold text-xs`}>
                                      {hab.diasRestantes} dias restantes
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Edit className="h-5 w-5 text-purple-400" />
              Atualizar Data de Vencimento
            </DialogTitle>
          </DialogHeader>
          {editingHabilitacao && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-white/5">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{editingHabilitacao.tripulanteName}</p>
                  <p className="text-xs text-gray-400">{editingHabilitacao.habilitacao.habilitacao}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Nova Data de Vencimento</label>
                <input
                  type="data"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditingHabilitacao(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  onClick={handleUpdateDate}
                >
                  Atualizar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
