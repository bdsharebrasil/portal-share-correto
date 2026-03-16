import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useVencimentosSync } from '@/contexts/VencimentosSyncContext';
import { Search, Wrench, AlertCircle, AlertTriangle, CheckCircle, Plus, Calendar, Zap, AlertTriangle as Warning, Edit, Trash2, Eye, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModernNotification } from '@/components/notifications/ModernNotification';
import { SearchableCombobox } from '@/components/ui/SearchableCombobox';

interface Aircraft {
  id: string;
  registration: string;
  model: string;
  manufacturer: string;
  image_url?: string;
}

interface Oficina {
  id: string;
  razao_social: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  mecanico_responsavel?: string;
  tipo_aeronave?: string;
  ativo?: boolean;
}

interface ManutencaoItem {
  id: string;
  aeronaveId: string;
  aeronaveRegistro: string;
  tipo: 'preventiva' | 'corretiva';
  subtipo?: 'preventiva_50h' | 'preventiva_100h';
  descricao: string;
  statusExecutado: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  dataProximaManutencao?: string;
  horasProximaManutencao?: number;
  horasAtuais?: number;
  mecanico?: string;
  observacoes?: string;
  custoPrevisto?: number;
  oficina?: string;
  createdAt: string;
}

export default function ManutencaoAeronave() {
  const { toast } = useToast();
  const { subscribe } = useVencimentosSync();
  const [manutencoes, setManutencoes] = useState<ManutencaoItem[]>([]);
  const [aeronaves, setAeronaves] = useState<Aircraft[]>([]);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAeronave, setSelectedAeronave] = useState<string>('todas');
  const [activeTab, setActiveTab] = useState<'preventiva' | 'corretiva'>('preventiva');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; title: string; description?: string } | null>(null);

  const [newManutencaoDialogOpen, setNewManutencaoDialogOpen] = useState(false);
  const [newManutencao, setNewManutencao] = useState({
    tipo: 'corretiva' as 'preventiva' | 'corretiva',
    subtipo: 'corretiva' as any,
    aeronaveId: '',
    descricao: '',
    mecanico: '',
    oficinaSelecionada: '',
    dataProxima: '',
    horasProxima: ''
  });

  const [editingManutencao, setEditingManutencao] = useState<ManutencaoItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    descricao: '',
    mecanico: '',
    statusExecutado: 'pendente' as string,
    horasProximaManutencao: '',
    dataProximaManutencao: '',
    observacoes: '',
    oficina: ''
  });

  useEffect(() => {
    loadData();

    // Inscrever para mudanças em tempo real
    const unsubscribe = subscribe((event) => {
      if (event.entityType === 'manutencao') {
        loadData();
      }
    });

    return unsubscribe;
  }, [subscribe]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar aeronaves
      const { data: aircraftData, error: aircraftError } = await supabase
        .from('aircraft')
        .select('*')
        .eq('status', 'ativa');

      if (aircraftError) throw aircraftError;
      setAeronaves(aircraftData || []);

      // Carregar oficinas
      const { data: oficinasData, error: oficinasError } = await supabase
        .from('oficinas')
        .select('*')
        .eq('ativo', true);

      if (oficinasError) throw oficinasError;
      setOficinas(oficinasData || []);

      // Carregar horas atuais de cada aeronave
      const { data: logbookData } = await supabase
        .from('logbook_months')
        .select('aircraft_id, celula_atual');

      const hoursMap = new Map((logbookData || []).map(entry => [entry.aircraft_id, entry.celula_atual]));

      // Carregar manutenções
      const { data: manutencaoData, error: manutencaoError } = await supabase
        .from('manutencoes')
        .select('*')
        .order('created_at', { ascending: false });

      if (manutencaoError) throw manutencaoError;

      const aircraftMap = new Map(aircraftData?.map(a => [a.id, a]) || []);

      const manutencoesList = (manutencaoData || []).map((m: any) => {
        const aircraft = aircraftMap.get(m.aeronave_id);
        const currentHours = hoursMap.get(m.aeronave_id) || 0;

        return {
          id: m.id,
          aeronaveId: m.aeronave_id,
          aeronaveRegistro: aircraft?.registration || '-',
          tipo: m.tipo === 'preventiva' ? 'preventiva' : 'corretiva',
          subtipo: m.vencimento_horas === 50 ? 'preventiva_50h' : m.vencimento_horas === 100 ? 'preventiva_100h' : m.tipo,
          descricao: m.observacoes || m.tipo,
          statusExecutado: (['pendente', 'em_andamento', 'concluida', 'cancelada'].includes(m.etapa) ? m.etapa : 'pendente') as 'pendente' | 'em_andamento' | 'concluida' | 'cancelada',
          dataProximaManutencao: m.data_programada,
          horasProximaManutencao: m.vencimento_horas,
          horasAtuais: currentHours,
          mecanico: m.mecanico,
          observacoes: m.observacoes,
          custoPrevisto: m.custo_estimado,
          oficina: m.oficina,
          createdAt: m.created_at
        } as ManutencaoItem;
      });

      setManutencoes(manutencoesList);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setNotification({
        type: 'error',
        title: 'Erro ao carregar dados',
        description: 'Tente novamente mais tarde'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddManutencao = async () => {
    if (!newManutencao.aeronaveId) {
      setNotification({
        type: 'warning',
        title: 'Campo obrigatório',
        description: 'Selecione uma aeronave'
      });
      return;
    }

    try {
      const tipoManutencao = newManutencao.tipo === 'preventiva' ? 'preventiva' : 'corretiva';
      const vencimentoHoras = newManutencao.subtipo === 'preventiva_50h' ? 50 : newManutencao.subtipo === 'preventiva_100h' ? 100 : null;

      // Criar registro em manutencoes
      const { data: manutencaoData, error: manutencaoError } = await supabase.from('manutencoes').insert([{
        aeronave_id: newManutencao.aeronaveId,
        tipo: tipoManutencao,
        mecanico: newManutencao.mecanico || 'A designar',
        data_programada: newManutencao.dataProxima || new Date().toISOString().split('T')[0],
        vencimento_horas: vencimentoHoras,
        etapa: 'aguardando',
        observacoes: newManutencao.descricao || '',
        oficina_id: newManutencao.oficinaSelecionada || null
      }]).select();

      if (manutencaoError) throw manutencaoError;

      // Sincronizar com CTM: criar service order
      if (manutencaoData && manutencaoData.length > 0) {
        const manutencao = manutencaoData[0];
        const serviceOrderType =
          tipoManutencao === 'preventiva' && vencimentoHoras === 100 ? 'REVISAO_100H' :
          tipoManutencao === 'preventiva' && vencimentoHoras === 50 ? 'REVISAO_50H' :
          tipoManutencao === 'preventiva' ? 'PREVENTIVA' : 'CORRETIVA';

        const vencimentoLabel = vencimentoHoras ? `${vencimentoHoras}HORAS` : 'CORRETIVO';
        const { error: ctmError } = await supabase.from('ctm_service_orders').insert([{
          aircraft_id: newManutencao.aeronaveId,
          numero: `MNT-${Date.now().toString().slice(-6)}`,
          tipo_manutencao: vencimentoLabel,
          description: newManutencao.descricao || serviceOrderType,
          data_entrada: newManutencao.dataProxima || new Date().toISOString().split('T')[0],
          status: 'em_andamento',
          observacoes: newManutencao.descricao || '',
          oficina_nome: '',
        }]);

        if (ctmError) {
          console.warn('Aviso: Não foi possível sincronizar com CTM', ctmError);
          // Não impedir a conclusão da operação se CTM falhar
        }
      }

      setNotification({
        type: 'success',
        title: 'Manutenção adicionada!',
        description: `${tipoManutencao} registrada com sucesso`
      });

      setNewManutencaoDialogOpen(false);
      setNewManutencao({
        tipo: 'corretiva',
        subtipo: 'corretiva',
        aeronaveId: '',
        descricao: '',
        mecanico: '',
        oficinaSelecionada: '',
        dataProxima: '',
        horasProxima: ''
      });

      loadData();
    } catch (error) {
      console.error('Erro ao adicionar manutenção:', error);
      setNotification({
        type: 'error',
        title: 'Erro ao adicionar manutenção',
        description: 'Tente novamente'
      });
    }
  };

  const handleEditManutencao = (manutencao: ManutencaoItem) => {
    setEditingManutencao(manutencao);
    setEditFormData({
      descricao: manutencao.descricao || '',
      mecanico: manutencao.mecanico || '',
      statusExecutado: manutencao.statusExecutado,
      horasProximaManutencao: manutencao.horasProximaManutencao?.toString() || '',
      dataProximaManutencao: manutencao.dataProximaManutencao || '',
      observacoes: manutencao.observacoes || '',
      oficina: manutencao.oficina || ''
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingManutencao) return;
    try {
      const { error } = await supabase
        .from('manutencoes')
        .update({
          observacoes: editFormData.descricao,
          mecanico: editFormData.mecanico,
          etapa: editFormData.statusExecutado,
          vencimento_horas: editFormData.horasProximaManutencao ? parseInt(editFormData.horasProximaManutencao) : null,
          data_programada: editFormData.dataProximaManutencao || undefined,
          oficina: editFormData.oficina || null,
        })
        .eq('id', editingManutencao.id);
      if (error) throw error;
      setNotification({ type: 'success', title: 'Manutenção atualizada!' });
      setEditDialogOpen(false);
      setEditingManutencao(null);
      loadData();
    } catch (error) {
      console.error('Erro ao editar manutenção:', error);
      setNotification({ type: 'error', title: 'Erro ao editar manutenção' });
    }
  };

  const handleDeleteManutencao = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta manutenção?')) return;
    try {
      const { error } = await supabase.from('manutencoes').delete().eq('id', id);
      if (error) throw error;
      setNotification({ type: 'success', title: 'Manutenção excluída!' });
      loadData();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      setNotification({ type: 'error', title: 'Erro ao excluir manutenção' });
    }
  };

  const filteredManutencoes = useMemo(() => {
    return manutencoes.filter(m => {
      const matchSearch = m.aeronaveRegistro.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         m.descricao.toLowerCase().includes(searchTerm.toLowerCase());
      const matchAeronave = selectedAeronave === 'todas' || m.aeronaveId === selectedAeronave;
      const matchTab = m.tipo === activeTab;
      return matchSearch && matchAeronave && matchTab;
    });
  }, [manutencoes, searchTerm, selectedAeronave, activeTab]);

  const stats = useMemo(() => ({
    preventivas: manutencoes.filter(m => m.tipo === 'preventiva').length,
    corretivas: manutencoes.filter(m => m.tipo === 'corretiva').length,
    pendentes: manutencoes.filter(m => m.statusExecutado === 'pendente').length,
    emAndamento: manutencoes.filter(m => m.statusExecutado === 'em_andamento').length,
    concluidas: manutencoes.filter(m => m.statusExecutado === 'concluida').length
  }), [manutencoes]);

  const preventivas50h = useMemo(() => {
    return manutencoes.filter(m => m.subtipo === 'preventiva_50h');
  }, [manutencoes]);

  const preventivas100h = useMemo(() => {
    return manutencoes.filter(m => m.subtipo === 'preventiva_100h');
  }, [manutencoes]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Carregando manutenções...</span>
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
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[120px] mix-blend-screen" />
        </div>

        <div className="relative z-10">
          {/* Sticky Header */}
          <header className="sticky top-0 z-40 w-full bg-slate-950/80 backdrop-blur-[12px] border-b border-white/5">
            <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20 ring-1 ring-white/10 group cursor-pointer hover:scale-105 transition-transform">
                  <Wrench className="text-white text-xl" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white leading-tight">Manutenção de Aeronaves</h1>
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    Preventiva e Corretiva
                  </div>
                </div>
              </div>
              <Dialog open={newManutencaoDialogOpen} onOpenChange={setNewManutencaoDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-orange-600 hover:bg-orange-700 gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Manutenção
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md bg-slate-900 border-white/10">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                      <Plus className="h-5 w-5 text-orange-400" />
                      Nova Manutenção
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Tipo</label>
                      <select
                        value={newManutencao.tipo}
                        onChange={(e) => {
                          setNewManutencao({...newManutencao, tipo: e.target.value as any, subtipo: e.target.value === 'preventiva' ? 'preventiva_50h' : 'corretiva'});
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm"
                      >
                        <option value="preventiva">Preventiva</option>
                        <option value="corretiva">Corretiva</option>
                      </select>
                    </div>

                    {newManutencao.tipo === 'preventiva' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-white">Horas</label>
                        <select
                          value={newManutencao.subtipo}
                          onChange={(e) => setNewManutencao({...newManutencao, subtipo: e.target.value})}
                          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm"
                        >
                          <option value="preventiva_50h">50 Horas</option>
                          <option value="preventiva_100h">100 Horas</option>
                        </select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Aeronave *</label>
                      <select
                        value={newManutencao.aeronaveId}
                        onChange={(e) => setNewManutencao({...newManutencao, aeronaveId: e.target.value})}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm"
                      >
                        <option value="">Selecione...</option>
                        {aeronaves.map(a => (
                          <option key={a.id} value={a.id}>{a.registration}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Oficina</label>
                      <SearchableCombobox
                        items={oficinas.map(o => ({
                          id: o.id,
                          label: o.razao_social
                        }))}
                        value={newManutencao.oficinaSelecionada}
                        onChange={(id) => setNewManutencao({...newManutencao, oficinaSelecionada: id})}
                        placeholder="Selecione uma oficina..."
                        searchPlaceholder="Buscar oficina..."
                        emptyMessage="Nenhuma oficina encontrada"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Descrição</label>
                      <textarea
                        value={newManutencao.descricao}
                        onChange={(e) => setNewManutencao({...newManutencao, descricao: e.target.value})}
                        placeholder="Descreva o serviço..."
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm min-h-[80px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Mecânico</label>
                      <input
                        type="text"
                        value={newManutencao.mecanico}
                        onChange={(e) => setNewManutencao({...newManutencao, mecanico: e.target.value})}
                        placeholder="Nome do mecânico"
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setNewManutencaoDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                        onClick={handleAddManutencao}
                      >
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
            {/* Notification */}
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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              <div className="bg-slate-800/30 backdrop-blur-[12px] border border-white/5 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:bg-slate-800/50 hover:border-white/10">
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="text-orange-400 text-sm" size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Preventivas</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white tracking-tight">{stats.preventivas}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-[12px] border border-white/5 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:bg-slate-800/50 hover:border-white/10">
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Warning className="text-red-400 text-sm" size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider text-red-400">Corretivas</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white tracking-tight">{stats.corretivas}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-[12px] border border-white/5 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:bg-slate-800/50 hover:border-white/10">
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="text-yellow-400 text-sm" size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">Pendentes</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white tracking-tight">{stats.pendentes}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-[12px] border border-white/5 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:bg-slate-800/50 hover:border-white/10">
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="text-blue-400 text-sm" size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Em Andamento</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white tracking-tight">{stats.emAndamento}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-[12px] border border-white/5 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:bg-slate-800/50 hover:border-white/10">
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="text-green-400 text-sm" size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider text-green-400">Concluídas</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white tracking-tight">{stats.concluidas}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="space-y-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-800/30 border border-white/5 rounded-xl p-1">
                  <TabsTrigger value="preventiva" className="rounded-lg data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
                    Preventiva ({stats.preventivas})
                  </TabsTrigger>
                  <TabsTrigger value="corretiva" className="rounded-lg data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
                    Corretiva ({stats.corretivas})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="text-gray-500 group-focus-within:text-orange-400 transition-colors" size={20} />
                </span>
                <input
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-800/60 border border-white/10 text-gray-200 placeholder-gray-500 rounded-xl focus:outline-none focus:border-orange-500/50 focus:bg-slate-800 transition-all text-sm font-medium"
                  placeholder="Buscar aeronave ou descrição..."
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className="w-full px-4 py-2.5 bg-slate-800/60 border border-white/10 text-gray-200 rounded-xl focus:outline-none focus:border-orange-500/50 focus:bg-slate-800 text-sm font-medium"
                value={selectedAeronave}
                onChange={(e) => setSelectedAeronave(e.target.value)}
              >
                <option value="todas">Todas as Aeronaves</option>
                {aeronaves.map(a => (
                  <option key={a.id} value={a.id}>{a.registration} ({a.model})</option>
                ))}
              </select>
            </div>

            {/* Manutenções Grid */}
            {filteredManutencoes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 min-h-[300px] flex flex-col items-center justify-center">
                <div className="flex flex-col items-center max-w-md mx-auto text-center p-6">
                  <Wrench className="w-12 h-12 text-orange-400/40 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Nenhuma manutenção encontrada</h3>
                  <p className="text-gray-400 text-sm">Adicione uma nova manutenção para começar</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredManutencoes.map((manutencao) => {
                  const statusColors = {
                    pendente: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', label: 'Pendente' },
                    aguardando: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', label: 'Aguardando' },
                    em_andamento: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', label: 'Em Andamento' },
                    concluida: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', label: 'Concluída' },
                    cancelada: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', label: 'Cancelada' }
                  };

                  const statusInfo = statusColors[manutencao.statusExecutado as keyof typeof statusColors] || statusColors.pendente;

                  return (
                    <div
                      key={manutencao.id}
                      className={`rounded-xl border backdrop-blur-sm transition-all hover:scale-[1.01] ${statusInfo.bg} ${statusInfo.border} p-4`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{manutencao.aeronaveRegistro}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{manutencao.descricao}</p>
                        </div>
                        <Badge className={`${statusInfo.bg} ${statusInfo.text} border ${statusInfo.border}`}>
                          {statusInfo.label}
                        </Badge>
                      </div>

                      {manutencao.tipo === 'preventiva' && (
                        <div className="bg-white/5 rounded-lg p-2 mb-3">
                          <p className="text-xs text-gray-400">Próxima manutenção</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Zap className="h-3 w-3 text-orange-400" />
                            <p className="text-sm font-semibold text-white">
                              {manutencao.horasProximaManutencao}h
                            </p>
                            {manutencao.horasAtuais && (
                              <span className="text-xs text-gray-400 ml-auto">
                                ({manutencao.horasAtuais}h atual)
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {manutencao.mecanico && (
                        <p className="text-xs text-gray-400 mb-3">
                          <span className="font-medium">Mecânico:</span> {manutencao.mecanico}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 bg-slate-700/50 border-white/10 text-gray-300 hover:bg-slate-600 text-xs h-8"
                          onClick={() => handleEditManutencao(manutencao)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-red-900/30 border-red-500/30 text-red-400 hover:bg-red-900/50 text-xs h-8"
                          onClick={() => handleDeleteManutencao(manutencao.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent className="max-w-md bg-slate-900 border-white/10">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-white">
                    <Edit className="h-5 w-5 text-orange-400" />
                    Editar Manutenção - {editingManutencao?.aeronaveRegistro}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">Descrição</label>
                    <textarea
                      value={editFormData.descricao}
                      onChange={(e) => setEditFormData({...editFormData, descricao: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">Mecânico</label>
                    <input
                      type="text"
                      value={editFormData.mecanico}
                      onChange={(e) => setEditFormData({...editFormData, mecanico: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">Oficina</label>
                    <Select
                      value={editFormData.oficina}
                      onValueChange={(value) => setEditFormData({...editFormData, oficina: value})}
                    >
                      <SelectTrigger className="bg-slate-800 border-white/10 text-white">
                        <SelectValue placeholder="Selecione uma oficina" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-white/10">
                        {oficinas.map((oficina) => (
                          <SelectItem key={oficina.id} value={oficina.razao_social}>
                            {oficina.razao_social}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">Status</label>
                    <select
                      value={editFormData.statusExecutado}
                      onChange={(e) => setEditFormData({...editFormData, statusExecutado: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="aguardando">Aguardando</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="concluida">Concluída</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Horas Vencimento</label>
                      <input
                        type="number"
                        value={editFormData.horasProximaManutencao}
                        onChange={(e) => setEditFormData({...editFormData, horasProximaManutencao: e.target.value})}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Data Programada</label>
                      <input
                        type="date"
                        value={editFormData.dataProximaManutencao}
                        onChange={(e) => setEditFormData({...editFormData, dataProximaManutencao: e.target.value})}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button className="flex-1 bg-orange-600 hover:bg-orange-700" onClick={handleSaveEdit}>
                      Salvar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </main>
        </div>
      </div>
    </Layout>
  );
}
