import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useVencimentosSync } from '@/contexts/VencimentosSyncContext';
import { Search, Users, AlertCircle, AlertTriangle, CheckCircle, Calendar, Award, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ModernNotification } from '@/components/notificacoes/ModernNotification';

// ── Interfaces alinhadas ao schema ─────────────────────────────────────────────
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
  statusGeral: 'vencido' | 'proximo' | 'ok';
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
    const unsubscribe = subscribe((event) => {
      if (event.entityType === 'crew_license') loadVencimentos();
    });
    return unsubscribe;
  }, [subscribe]);

  const loadVencimentos = async () => {
    setLoading(true);
    try {
      // Campos corretos: nome_completo, url_avatar (não full_name, avatar_url)
      const { data: crew, error: crewError } = await supabase
        .from('membros_tripulacao')
        .select('id, nome_completo, url_avatar')
        .eq('status', 'ativo')
        .order('nome_completo');

      if (crewError) throw crewError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const vencimentosTemp: TripulanteVencimento[] = [];

      for (const member of crew || []) {
        // Campos corretos: tipo_habilitacao, data_validade (não license_type, expiry_date)
        const { data: licenses, error: licenseError } = await supabase
          .from('habilitacoes_tripulante')
          .select('id, tipo_habilitacao, data_validade, validade_cma, CMA')
          .eq('membro_tripulacao_id', member.id);

        if (licenseError) {
          console.error('Erro ao carregar habilitações:', licenseError);
          continue;
        }

        const habilitacoes: Habilitacao[] = [];
        let statusGeral: 'vencido' | 'proximo' | 'ok' = 'ok';

        for (const license of licenses || []) {
          // data_validade — campo real (não expiry_date)
          if (license.data_validade) {
            const expiryDate = new Date(license.data_validade);
            expiryDate.setHours(0, 0, 0, 0);
            const diasRestantes = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            const status: 'vencido' | 'proximo' | 'ok' =
              diasRestantes < 0 ? 'vencido' : diasRestantes <= 60 ? 'proximo' : 'ok';

            if (status === 'vencido') statusGeral = 'vencido';
            else if (status === 'proximo' && statusGeral !== 'vencido') statusGeral = 'proximo';

            habilitacoes.push({
              id: `${member.id}-${license.id}-hab`,
              licenseId: license.id,
              // tipo_habilitacao — campo real
              habilitacao: license.tipo_habilitacao || 'Habilitação',
              dataVencimento: license.data_validade,
              diasRestantes,
              status,
              tipo: 'habilitacao',
            });
          }

          // validade_cma — campo real
          if (license.validade_cma) {
            const expiryDate = new Date(license.validade_cma);
            expiryDate.setHours(0, 0, 0, 0);
            const diasRestantes = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            const status: 'vencido' | 'proximo' | 'ok' =
              diasRestantes < 0 ? 'vencido' : diasRestantes <= 60 ? 'proximo' : 'ok';

            if (status === 'vencido') statusGeral = 'vencido';
            else if (status === 'proximo' && statusGeral !== 'vencido') statusGeral = 'proximo';

            habilitacoes.push({
              id: `${member.id}-${license.id}-cma`,
              licenseId: license.id,
              // tipo_habilitacao — campo real
              habilitacao: `CMA (${license.tipo_habilitacao})`,
              dataVencimento: license.validade_cma,
              diasRestantes,
              status,
              tipo: 'cma',
            });
          }
        }

        vencimentosTemp.push({
          tripulanteId: member.id,
          tripulanteName: member.nome_completo,    // nome_completo — campo real
          tripulanteAvatar: member.url_avatar,      // url_avatar — campo real
          habilitacoes,
          statusGeral: habilitacoes.length > 0 ? statusGeral : 'ok',
        });
      }

      setVencimentos(vencimentosTemp);
    } catch (error) {
      console.error('Erro ao carregar vencimentos:', error);
      setNotification({ type: 'error', title: 'Erro ao carregar vencimentos', description: 'Tente novamente mais tarde' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDate = async () => {
    if (!editingHabilitacao || !newDate) return;
    try {
      // Atualiza data_validade ou validade_cma conforme o tipo
      const field = editingHabilitacao.habilitacao.tipo === 'habilitacao' ? 'data_validade' : 'validade_cma';
      const { error } = await supabase
        .from('habilitacoes_tripulante')
        .update({ [field]: newDate } as never)
        .eq('id', editingHabilitacao.habilitacao.licenseId);

      if (error) throw error;

      setNotification({
        type: 'success',
        title: 'Data atualizada com sucesso!',
        description: `${editingHabilitacao.habilitacao.habilitacao} de ${editingHabilitacao.tripulanteName} atualizada`,
      });
      setEditDialogOpen(false);
      setEditingHabilitacao(null);
      setNewDate('');
      loadVencimentos();
    } catch (error) {
      console.error('Erro ao atualizar data:', error);
      setNotification({ type: 'error', title: 'Erro ao atualizar data', description: 'Tente novamente' });
    }
  };

  const filteredVencimentos = useMemo(() => {
    return vencimentos.filter(tripulante => {
      const matchSearch =
        (tripulante.tripulanteName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        tripulante.habilitacoes.some(h => (h.habilitacao || '').toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus =
        activeStatus === 'todos' ? true :
        tripulante.habilitacoes.some(h => h.status === activeStatus);

      return matchSearch && matchStatus;
    });
  }, [vencimentos, searchTerm, activeStatus]);

  const stats = useMemo(() => {
    let vencidosCount = 0, proximosCount = 0, okCount = 0;
    vencimentos.forEach(t => t.habilitacoes.forEach(h => {
      if (h.status === 'vencido') vencidosCount++;
      else if (h.status === 'proximo') proximosCount++;
      else okCount++;
    }));
    return { vencidos: vencidosCount, proximos: proximosCount, ok: okCount, total: vencimentos.length };
  }, [vencimentos]);

  const getStatusInfo = (status: 'vencido' | 'proximo' | 'ok') => ({
    vencido:  { label: 'Vencido',       bgColor: 'bg-red-500/10',    borderColor: 'border-red-500/30',    textColor: 'text-red-400',    badgeClass: 'bg-red-500/20 text-red-400 border-red-500',    icon: AlertCircle },
    proximo:  { label: 'Vence em Breve',bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', textColor: 'text-yellow-400', badgeClass: 'bg-yellow-500/20 text-yellow-400 border-yellow-500', icon: AlertTriangle },
    ok:       { label: 'Em Dia',        bgColor: 'bg-green-500/10',  borderColor: 'border-green-500/30',  textColor: 'text-green-400',  badgeClass: 'bg-green-500/20 text-green-400 border-green-500', icon: CheckCircle },
  }[status]);

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
        {/* Background orbs */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-pink-500/5 rounded-full blur-[120px] mix-blend-screen" />
        </div>

        <div className="relative z-10">
          <header className="sticky top-0 z-40 w-full bg-slate-950/80 backdrop-blur-[12px] border-b border-white/5">
            <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20 ring-1 ring-white/10">
                  <Users className="text-white" size={20} />
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

          <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
            {notification && (
              <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
                <ModernNotification
                  type={notification.type}
                  title={notification.title}
                  description={notification.description}
                  duration={4000}
                  onClose={() => setNotification(null)}
                />
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { label: 'Vencidos', value: stats.vencidos, color: 'red', note: 'Ação imediata', icon: AlertCircle, ping: true },
                { label: 'Próximos 60 dias', value: stats.proximos, color: 'yellow', note: 'Requer atenção', icon: AlertTriangle, ping: false },
                { label: 'Em dia', value: stats.ok, color: 'green', note: 'Regular', icon: CheckCircle, ping: false },
              ].map(({ label, value, color, note, icon: Icon, ping }) => (
                <div key={label} className="bg-slate-800/30 backdrop-blur-[12px] border border-white/5 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:bg-slate-800/50 hover:border-white/10">
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        {ping ? (
                          <span className="flex h-2 w-2 relative">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-${color}-400 opacity-75`} />
                            <span className={`relative inline-flex rounded-full h-2 w-2 bg-${color}-400`} />
                          </span>
                        ) : (
                          <span className={`w-2 h-2 rounded-full bg-${color}-400`} />
                        )}
                        <span className={`text-xs font-bold uppercase tracking-wider text-${color}-400`}>{label}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-white tracking-tight">{value}</span>
                        <span className="text-sm text-gray-400 font-medium">itens</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5 text-xs text-gray-400">{note}</div>
                  </div>
                </div>
              ))}

              <div className="bg-gradient-to-br from-purple-500/10 to-slate-800 rounded-2xl p-6 border border-purple-500/20 relative overflow-hidden shadow-lg shadow-purple-900/10 group hover:shadow-purple-500/10 transition-all duration-300 hover:border-purple-500/40 hover:from-purple-500/20">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl" />
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="text-purple-400" size={16} />
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

            {/* Busca e filtros */}
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

              <Tabs value={activeStatus} onValueChange={(v) => setActiveStatus(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-slate-800/30 border border-white/5 rounded-xl p-1">
                  <TabsTrigger value="todos" className="rounded-lg data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">Todos ({vencimentos.length})</TabsTrigger>
                  <TabsTrigger value="vencidos" className="rounded-lg data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">Vencidos ({stats.vencidos})</TabsTrigger>
                  <TabsTrigger value="proximos" className="rounded-lg data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">Próximos ({stats.proximos})</TabsTrigger>
                  <TabsTrigger value="ok" className="rounded-lg data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">Em Dia ({stats.ok})</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Grid de vencimentos */}
            {filteredVencimentos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 min-h-[300px] flex flex-col items-center justify-center">
                <Award className="w-12 h-12 text-purple-400/40 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Nenhum resultado encontrado</h3>
                <p className="text-gray-400 text-sm">Ajuste os filtros para visualizar vencimentos</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredVencimentos.map((tripulante) => {
                  const statusInfo = getStatusInfo(tripulante.statusGeral);
                  const StatusIcon = statusInfo.icon;

                  return (
                    <div key={tripulante.tripulanteId} className={`rounded-xl border backdrop-blur-sm transition-all hover:shadow-lg ${statusInfo.bgColor} ${statusInfo.borderColor} p-5 group`}>
                      <div className="flex items-start gap-4 mb-5 pb-4 border-b border-white/10">
                        <Avatar className="w-14 h-14 ring-2 ring-white/10 flex-shrink-0">
                          {/* url_avatar — campo real */}
                          <AvatarImage src={tripulante.tripulanteAvatar} alt={tripulante.tripulanteName} />
                          <AvatarFallback className="bg-slate-700 text-sm font-semibold">
                            {tripulante.tripulanteName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          {/* nome_completo — campo real */}
                          <p className="text-base font-bold text-white truncate">{tripulante.tripulanteName}</p>
                          <p className="text-xs text-gray-400 mt-1">{tripulante.habilitacoes.length} habilitação{tripulante.habilitacoes.length !== 1 ? 's' : ''}</p>
                        </div>
                        <Badge className={statusInfo.badgeClass}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        {tripulante.habilitacoes.length === 0 ? (
                          <div className="rounded-lg px-4 py-6 border border-dashed border-white/20 bg-white/5 flex flex-col items-center text-center">
                            <Award className="h-8 w-8 text-gray-500 mb-2 opacity-50" />
                            <p className="text-sm text-gray-400 font-medium">Sem habilitações cadastradas</p>
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
                                    variant="ghost" size="sm"
                                    className="h-7 w-7 p-0 hover:bg-white/10"
                                    onClick={() => { setEditingHabilitacao({ habilitacao: hab, tripulanteName: tripulante.tripulanteName }); setNewDate(hab.dataVencimento); setEditDialogOpen(true); }}
                                    title="Editar data de vencimento"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </div>
                                {hab.status === 'vencido' ? (
                                  <div className="bg-red-500/20 rounded px-2 py-1 border border-red-500/30 inline-block">
                                    <p className="text-red-300 font-semibold text-xs">Vencido há {Math.abs(hab.diasRestantes)} dias</p>
                                  </div>
                                ) : (
                                  <p className={`${habStatusInfo.textColor} font-semibold text-xs`}>{hab.diasRestantes} dias restantes</p>
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

      {/* Dialog de edição de data */}
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
                {/* type="date" — corrigido de "data" */}
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setEditDialogOpen(false); setEditingHabilitacao(null); }}>
                  Cancelar
                </Button>
                <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={handleUpdateDate}>
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