import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Info, Wrench, Package, Users, DollarSign, FileText, Scale,
  Weight, TrendingUp, ChevronLeft, Download, Plus, Settings, MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDateToBR } from '@/lib/date-utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useCTMServiceOrders } from '@/hooks/useCTMServiceOrders';
import { useCTMBudgetTracking } from '@/hooks/useCTMBudgetTracking';
import { useCTMDocumentGeneration } from '@/hooks/useCTMDocumentGeneration';
import { CTMOASDetail } from '@/components/ctm/CTMOASDetail';
import { CTMBudgetFromOAS } from '@/components/ctm/CTMBudgetFromOAS';
import { CTMOASDocumentGenerator } from '@/components/ctm/CTMOASDocumentGenerator';

interface CTMOASDetailPageProps {
  oasId: string;
  aircraftId: string;
  aircraftRegistration?: string;
  onBack?: () => void;
  isEmbedded?: boolean;
}

type TabId = 'informacoes' | 'servicos' | 'pecas' | 'rateio' | 'financeiro' | 'orcamentos' | 'documentos';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

export function CTMOASDetailPage({
  oasId,
  aircraftId,
  aircraftRegistration = '',
  onBack,
  isEmbedded = false,
}: CTMOASDetailPageProps) {
  const navigate = useNavigate();
  const { loadServiceOrderDetails, getLinkedBudgets } = useCTMServiceOrders();
  const { getOASBudgetLinks } = useCTMBudgetTracking();
  const { listGeneratedDocuments } = useCTMDocumentGeneration();

  const [activeTab, setActiveTab] = useState<TabId>('informacoes');
  const [oasData, setOasData] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [linkedBudgets, setLinkedBudgets] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);
  const [aircraft, setAircraft] = useState<any>(null);

  const tabs: Tab[] = [
    { id: 'informacoes', label: 'Informações', icon: <Info className="h-4 w-4" /> },
    { id: 'servicos', label: 'Serviços', icon: <Wrench className="h-4 w-4" />, count: details?.services?.length || 0 },
    { id: 'pecas', label: 'Peças', icon: <Package className="h-4 w-4" />, count: details?.parts?.length || 0 },
    { id: 'rateio', label: 'Rateio', icon: <Users className="h-4 w-4" />, count: details?.costSharing?.length || 0 },
    { id: 'financeiro', label: 'Financeiro', icon: <DollarSign className="h-4 w-4" /> },
    { id: 'orcamentos', label: 'Orçamentos', icon: <TrendingUp className="h-4 w-4" />, count: linkedBudgets.length },
    { id: 'documentos', label: 'Documentos', icon: <FileText className="h-4 w-4" />, count: documents.length },
  ];

  useEffect(() => {
    loadData();
  }, [oasId, aircraftId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load OAS details
      const detailsData = await loadServiceOrderDetails(oasId);
      setDetails(detailsData);
      setOasData(detailsData.order);

      // Load aircraft info
      if (aircraftId) {
        const { data: aircraftData } = await supabase
          .from('aeronave')
          .select('*')
          .eq('id', aircraftId)
          .single();
        setAircraft(aircraftData);
      }

      // Load linked budgets
      const budgets = await getOASBudgetLinks(oasId);
      setLinkedBudgets(budgets);

      // Load documents
      const docs = await listGeneratedDocuments(oasId);
      setDocuments(docs);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Error loading data:', errorMessage);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [oasId, aircraftId, loadServiceOrderDetails, getOASBudgetLinks, listGeneratedDocuments]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  if (loading || !oasData) {
    const loadingContent = (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin">
          <Wrench className="w-8 h-8 text-primary" />
        </div>
      </div>
    );
    if (isEmbedded) return loadingContent;
    return <Layout>{loadingContent}</Layout>;
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planejada: 'bg-slate-500/20 text-slate-200 border-slate-500/30',
      executando: 'bg-blue-500/20 text-blue-200 border-blue-500/30',
      concluida: 'bg-green-500/20 text-green-200 border-green-500/30',
      pausada: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30',
      cancelada: 'bg-red-500/20 text-red-200 border-red-500/30',
    };
    return colors[status] || 'bg-slate-500/20 text-slate-200 border-slate-500/30';
  };

  const pageContent = (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6">
        <div className="flex items-start gap-4 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="mt-1 text-slate-400 hover:text-white hover:bg-white/5"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{oasData.numero}</h1>
              <Badge className={`${getStatusColor(oasData.situacao)}`}>
                {oasData.situacao || 'N/A'}
              </Badge>
            </div>
            <p className="text-sm text-slate-400">
              {aircraftRegistration || aircraft?.matricula} · {oasData.tipo_manutencao}
              {oasData.data_entrada && ` · ${formatDateToBR(oasData.data_entrada)}`}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 flex-wrap justify-end">
          <Button
            onClick={() => setShowBudgetForm(true)}
            className="bg-cyan-600 hover:bg-cyan-700 gap-2 h-9 text-sm"
          >
            <Plus className="h-4 w-4" />
            Gerar Orçamento
          </Button>
          <Button
            onClick={() => setShowDocumentGenerator(true)}
            variant="outline"
            className="gap-2 h-9 text-sm"
          >
            <Download className="h-4 w-4" />
            Gerar Documentos
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="px-6 overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-min">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-cyan-500/30 text-cyan-300' : 'bg-white/10 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {/* Informações */}
        {activeTab === 'informacoes' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Oficina', value: oasData.oficina_nome },
              { label: 'Contato', value: oasData.oficina_contato },
              { label: 'Horas Célula', value: oasData.horas_celula ? `${oasData.horas_celula}H` : undefined },
              { label: 'Dias Previstos', value: oasData.dias_previstos },
              { label: 'Dias Efetivos', value: oasData.dias_efetivos },
              { label: 'Objetivo', value: oasData.objetivo },
              { label: 'Tipo Rateio', value: oasData.tipo_rateio },
              { label: 'Data Entrada', value: oasData.data_entrada ? formatDateToBR(oasData.data_entrada) : undefined },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-800/40 border border-white/5 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="font-semibold text-white">{value || '—'}</p>
              </div>
            ))}
          </div>
        )}

        {/* Servicos, Pecas, Rateio, Financeiro - Use CTMOASDetail component */}
        {['servicos', 'pecas', 'rateio', 'financeiro'].includes(activeTab) && (
          <CTMOASDetail
            orderId={oasId}
            onClose={() => {}}
            forcedSection={activeTab === 'financeiro' ? 'resumo' : activeTab}
            hideHeader={true}
          />
        )}

        {/* Orçamentos */}
        {activeTab === 'orcamentos' && (
          <div className="space-y-4">
            {linkedBudgets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-800/20 rounded-lg border border-white/5">
                <TrendingUp className="h-12 w-12 text-slate-600 mb-3" />
                <p className="text-slate-400 text-sm">Nenhum orçamento vinculado</p>
                <p className="text-xs text-slate-500 mb-4">Gere um orçamento de forma automática a partir desta OAS</p>
                <Button onClick={() => setShowBudgetForm(true)} className="bg-cyan-600 hover:bg-cyan-700 gap-2">
                  <Plus className="h-4 w-4" />
                  Gerar Orçamento
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {linkedBudgets.map(link => (
                  <div key={link.id} className="border border-white/5 rounded-lg p-4 bg-slate-800/20">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white">{link.budget?.titulo || 'Orçamento'}</h3>
                        <p className="text-xs text-slate-500">Versão {link.version}</p>
                      </div>
                      <Badge className={`text-xs ${
                        link.situacao === 'approved' ? 'bg-green-500/20 text-green-300' :
                        link.situacao === 'rejected' ? 'bg-red-500/20 text-red-300' :
                        'bg-slate-500/20 text-slate-300'
                      }`}>
                        {link.situacao}
                      </Badge>
                    </div>
                    {link.budget?.total_estimado && (
                      <p className="text-sm text-cyan-400 font-mono">
                        R$ {link.budget.total_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    {link.budget?.id && (
                      <p className="text-xs text-muted-foreground mt-2">ID: {link.budget.id.slice(0,8)}...</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Documentos */}
        {activeTab === 'documentos' && (
          <div className="space-y-4">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-800/20 rounded-lg border border-white/5">
                <FileText className="h-12 w-12 text-slate-600 mb-3" />
                <p className="text-slate-400 text-sm">Nenhum documento gerado</p>
                <p className="text-xs text-slate-500 mb-4">Gere documentos e relatórios desta OAS</p>
                <Button onClick={() => setShowDocumentGenerator(true)} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Gerar Documento
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {documents.map(doc => (
                  <div key={doc.id} className="border border-white/5 rounded-lg p-3 bg-slate-800/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <div>
                        <p className="text-sm font-medium text-white">{doc.nome_arquivo}</p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(doc.generated_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="gap-2">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showBudgetForm && (
        <CTMBudgetFromOAS
          oasId={oasId}
          onClose={() => setShowBudgetForm(false)}
          onSuccess={() => {
            loadData();
            setShowBudgetForm(false);
          }}
        />
      )}

      {showDocumentGenerator && (
        <CTMOASDocumentGenerator
          oasId={oasId}
          oasData={oasData}
          isOpen={showDocumentGenerator}
          onClose={() => setShowDocumentGenerator(false)}
        />
      )}
    </div>
  );

  return isEmbedded ? pageContent : <Layout>{pageContent}</Layout>;
}
