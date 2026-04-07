import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useVencimentosSync } from '@/contexts/VencimentosSyncContext';
import { Search, Plane, AlertCircle, AlertTriangle, CheckCircle, Plus, Calendar, FileText, Eye, Download, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModernNotification } from '@/components/notifications/ModernNotification';
import { getFlightDocumentPublicUrl } from '@/lib/storageHelper';

interface Aircraft {
  id: string;
  registration: string;
  model: string;
  manufacturer: string;
  image_url?: string;
}

interface DocumentoVencimento {
  id: string;
  aeronaveId: string;
  aeronaveRegistro: string;
  aeronaveModelo: string;
  aeronaveImagem?: string;
  nomeDocumento: string;
  dataVencimento: string;
  diasRestantes: number;
  status: 'vencido' | 'proximo' | 'ok';
  fileType?: string;
  filePath?: string;
}

export default function VencimentosDocumentos() {
  const { toast } = useToast();
  const { subscribe } = useVencimentosSync();
  const [documentos, setDocumentos] = useState<DocumentoVencimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatus, setActiveStatus] = useState<'todos' | 'vencidos' | 'proximos' | 'ok'>('todos');
  const [editingDocumento, setEditingDocumento] = useState<DocumentoVencimento | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; title: string; description?: string } | null>(null);

  useEffect(() => {
    loadDocumentos();

    // Inscrever para mudanças em tempo real
    const unsubscribe = subscribe((event) => {
      if (event.entityType === 'flight_document') {
        loadDocumentos();
      }
    });

    return unsubscribe;
  }, [subscribe]);

  const loadDocumentos = async () => {
    setLoading(true);
    try {
      // Carregar documentos com data de vencimento
      const { data: docs, error: docsError } = await supabase
        .from('documentos_voo')
        .select('*')
        .not('data_validade', 'is', null)
        .order('data_validade', { ascending: true });

      if (docsError) throw docsError;

      // Carregar aeronaves para obter informações
      const { data: aircraft, error: aircraftError } = await supabase
        .from('aeronave')
        .select('*')
        .eq('status', 'ativa');

      if (aircraftError) throw aircraftError;

      const aircraftMap = new Map(aircraft?.map(a => [a.id, a]) || []);
      const documentosTemp: DocumentoVencimento[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const doc of docs || []) {
        const expiryDate = new Date(doc.data_validade);
        expiryDate.setHours(0, 0, 0, 0);
        const diasRestantes = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let status: 'vencido' | 'proximo' | 'ok';
        if (diasRestantes < 0) status = 'vencido';
        else if (diasRestantes <= 60) status = 'proximo';
        else status = 'ok';

        const aeroInfo = aircraftMap.get(doc.aeronave_id);

        documentosTemp.push({
          id: doc.id,
          aeronaveId: doc.aeronave_id,
          aeronaveRegistro: aeroInfo?.registration || '-',
          aeronaveModelo: aeroInfo?.model || '-',
          aeronaveImagem: aeroInfo?.image_url,
          nomeDocumento: doc.nome,
          dataVencimento: doc.data_validade,
          diasRestantes,
          status,
          fileType: doc.tipo_arquivo,
          filePath: doc.caminho_arquivo
        });
      }

      setDocumentos(documentosTemp);
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      setNotification({
        type: 'error',
        title: 'Erro ao carregar documentos',
        description: 'Tente novamente mais tarde'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDate = async () => {
    if (!editingDocumento || !newDate) return;

    try {
      const { error } = await supabase
        .from('documentos_voo')
        .update({ data_validade: newDate })
        .eq('id', editingDocumento.id);

      if (error) throw error;

      setNotification({
        type: 'success',
        title: 'Data atualizada com sucesso!',
        description: `${editingDocumento.nomeDocumento} da ${editingDocumento.aeronaveRegistro} atualizada`
      });

      setEditDialogOpen(false);
      setEditingDocumento(null);
      setNewDate('');
      loadDocumentos();
    } catch (error) {
      console.error('Erro ao atualizar data:', error);
      setNotification({
        type: 'error',
        title: 'Erro ao atualizar data',
        description: 'Tente novamente'
      });
    }
  };

  const filteredDocumentos = useMemo(() => {
    return documentos.filter(d => {
      const matchSearch = d.aeronaveRegistro.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.nomeDocumento.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = activeStatus === 'todos' || d.status === activeStatus;
      return matchSearch && matchStatus;
    });
  }, [documentos, searchTerm, activeStatus]);

  const documentosPorAeronave = useMemo(() => {
    const grouped: Record<string, { aeronave: Aircraft & { id: string }; documentos: DocumentoVencimento[] }> = {};
    filteredDocumentos.forEach(d => {
      if (!grouped[d.aeronaveId]) {
        grouped[d.aeronaveId] = {
          aeronave: {
            id: d.aeronaveId,
            registration: d.aeronaveRegistro,
            model: d.aeronaveModelo,
            manufacturer: '',
            image_url: d.aeronaveImagem
          },
          documentos: []
        };
      }
      grouped[d.aeronaveId].documentos.push(d);
    });
    return Object.values(grouped).sort((a, b) => a.aeronave.registration.localeCompare(b.aeronave.registration));
  }, [filteredDocumentos]);

  const stats = useMemo(() => ({
    vencidos: documentos.filter(d => d.status === 'vencido').length,
    proximos: documentos.filter(d => d.status === 'proximo').length,
    ok: documentos.filter(d => d.status === 'ok').length,
    total: new Set(documentos.map(d => d.aeronaveId)).size
  }), [documentos]);

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
            <span>Carregando documentos...</span>
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
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] mix-blend-screen" />
        </div>

        <div className="relative z-10">
          {/* Sticky Header */}
          <header className="sticky top-0 z-40 w-full bg-slate-950/80 backdrop-blur-[12px] border-b border-white/5">
            <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/10 group cursor-pointer hover:scale-105 transition-transform">
                  <FileText className="text-white text-xl" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white leading-tight">Vencimentos de Documentos</h1>
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    Aeronaves
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
                  type={notification.type}
                  title={notification.title}
                  description={notification.description}
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

              <div className="bg-slate-800/30 backdrop-blur-[12px] border border-white/5 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:bg-slate-800/50 hover:border-white/10">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity pointer-events-none">
                  <AlertTriangle className="text-8xl text-yellow-400 transform -rotate-12" />
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">Próximos 60d</span>
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

              <div className="bg-gradient-to-br from-cyan-500/10 to-slate-800 rounded-2xl p-6 border border-cyan-500/20 relative overflow-hidden shadow-lg shadow-cyan-900/10 group hover:shadow-cyan-500/10 transition-all duration-300 w-full text-left hover:border-cyan-500/40 hover:from-cyan-500/20">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl" />
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Plane className="text-cyan-400 text-sm" size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Aeronaves</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white tracking-tight">{stats.total}</span>
                      <span className="text-sm text-gray-400 font-medium">com documentos</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-cyan-500/10 flex items-center justify-between text-xs text-cyan-400/80 font-medium">
                    <span>Gerenciar frota</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="space-y-4">
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="text-gray-500 group-focus-within:text-cyan-400 transition-colors" size={20} />
                </span>
                <input
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-800/60 border border-white/10 text-gray-200 placeholder-gray-500 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:bg-slate-800 transition-all text-sm font-medium"
                  placeholder="Buscar aeronave ou documento..."
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Status Filter Tabs */}
              <Tabs value={activeStatus} onValueChange={(v) => setActiveStatus(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-slate-800/30 border border-white/5 rounded-xl p-1">
                  <TabsTrigger value="todos" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                    Todos ({documentos.length})
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

            {/* Documentos Grid */}
            {documentosPorAeronave.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 min-h-[300px] flex flex-col items-center justify-center">
                <div className="flex flex-col items-center max-w-md mx-auto text-center p-6">
                  <FileText className="w-12 h-12 text-cyan-400/40 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Nenhum documento encontrado</h3>
                  <p className="text-gray-400 text-sm">Nenhum documento com data de vencimento foi adicionado às aeronaves</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {documentosPorAeronave.map((grupo) => (
                  <div
                    key={grupo.aeronave.id}
                    className="rounded-2xl border border-white/5 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-[12px] overflow-hidden hover:border-white/10 transition-all shadow-xl"
                  >
                    {/* Aircraft Header */}
                    <div className="p-5 md:p-6 bg-gradient-to-r from-cyan-500/10 via-transparent to-blue-500/5 border-b border-white/5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
                        <Plane size={80} className="text-cyan-400" />
                      </div>

                      <div className="flex gap-4 items-start relative z-10">
                        {/* Aircraft Image */}
                        <div className="w-28 h-28 flex-shrink-0">
                          <div className="w-full h-full rounded-lg overflow-hidden border border-white/10 bg-slate-900/50 flex items-center justify-center">
                            {grupo.aeronave.image_url ? (
                              <img
                                src={grupo.aeronave.image_url}
                                alt={grupo.aeronave.registration}
                                className="w-full h-full object-cover hover:scale-110 transition-transform duration-300 cursor-pointer"
                              />
                            ) : (
                              <Plane className="h-6 w-6 text-cyan-400/40" />
                            )}
                          </div>
                        </div>

                        {/* Aircraft Info */}
                        <div className="flex-1">
                          <p className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold mb-1.5">Matrícula</p>
                          <h2 className="text-4xl font-extrabold text-white tracking-tight font-mono">
                            {grupo.aeronave.registration}
                          </h2>
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Modelo</p>
                              <p className="text-xs font-medium text-gray-200">{grupo.aeronave.model}</p>
                            </div>
                          </div>

                          {/* Status Badges */}
                          <div className="flex flex-wrap gap-1.5 pt-3">
                            {grupo.documentoumentos.filter(d => d.status === 'vencido').length > 0 && (
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-2 py-0.5">
                                <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                                {grupo.documentoumentos.filter(d => d.status === 'vencido').length}
                              </Badge>
                            )}
                            {grupo.documentoumentos.filter(d => d.status === 'proximo').length > 0 && (
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] px-2 py-0.5">
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                {grupo.documentoumentos.filter(d => d.status === 'proximo').length}
                              </Badge>
                            )}
                            {grupo.documentoumentos.filter(d => d.status === 'ok').length > 0 && (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-2 py-0.5">
                                <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                                {grupo.documentoumentos.filter(d => d.status === 'ok').length}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Documentos Grid */}
                    <div className="p-5 md:p-6">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-cyan-400" />
                        Documentos ({grupo.documentos.length})
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {grupo.documentos.map((doc) => {
                          const statusInfo = getStatusInfo(doc.status);
                          const StatusIcon = statusInfo.icon;
                          const publicUrl = doc.filePath ? getFlightDocumentPublicUrl(doc.filePath) : null;

                          return (
                            <div
                              key={doc.id}
                              className={`rounded-lg p-3 border backdrop-blur-sm transition-all hover:scale-[1.01] ${statusInfo.bgColor} ${statusInfo.borderColor} group`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className={`p-1.5 rounded-md ${statusInfo.bgColor} flex-shrink-0`}>
                                  <StatusIcon className={`h-4 w-4 ${statusInfo.textColor}`} />
                                </div>
                                <Badge className={`text-[10px] font-bold ${statusInfo.badgeClass}`}>
                                  {statusInfo.label}
                                </Badge>
                              </div>

                              <div className="mb-2">
                                <p className="font-semibold text-white text-xs line-clamp-2">{doc.nomeDocumento}</p>
                                <div className="flex items-center gap-1 mt-1">
                                  <Calendar className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                  <span className="text-[10px] text-gray-400">
                                    {new Date(doc.dataVencimento).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                              </div>

                              <div className={`${statusInfo.bgColor} border ${statusInfo.borderColor} rounded-md p-2 mb-2`}>
                                <p className={`${statusInfo.textColor} font-semibold text-lg`}>
                                  {doc.status === 'vencido' ? (
                                    <span className="text-red-400 text-sm">Vencido</span>
                                  ) : (
                                    <>
                                      {doc.diasRestantes} <span className="text-xs">dias</span>
                                    </>
                                  )}
                                </p>
                              </div>

                              <div className="flex gap-1 flex-wrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 bg-slate-700/50 border-white/10 text-gray-300 hover:bg-slate-600 text-[10px] px-2 py-1 h-auto"
                                  onClick={() => {
                                    setEditingDocumento(doc);
                                    setNewDate(doc.dataVencimento);
                                    setEditDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-3 w-3 mr-0.5" />
                                  Editar
                                </Button>
                                {publicUrl && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 bg-slate-700/50 border-white/10 text-gray-300 hover:bg-slate-600 text-[10px] px-2 py-1 h-auto"
                                    onClick={() => window.open(publicUrl, '_blank')}
                                  >
                                    <Eye className="h-3 w-3 mr-0.5" />
                                    Ver
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
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
              <Edit className="h-5 w-5 text-cyan-400" />
              Atualizar Data de Vencimento
            </DialogTitle>
          </DialogHeader>
          {editingDocumento && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-white/5">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{editingDocumento.nomeDocumento}</p>
                  <p className="text-xs text-gray-400">{editingDocumento.aeronaveRegistro}</p>
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
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700"
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
