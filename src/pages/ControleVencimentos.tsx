// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle, 
  Users, 
  FileText, 
  Wrench, 
  ChevronRight,
  TrendingUp 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useVencimentosSync } from '@/contexts/VencimentosSyncContext';

export default function ControleVencimentos() {
  const navigate = useNavigate();
  const { subscribe } = useVencimentosSync();
  const [loading, setLoading] = useState(true);
  const [tripulacaoStats, setTripulacaoStats] = useState({ vencidos: 0, proximos: 0, total: 0 });
  const [documentosStats, setDocumentosStats] = useState({ vencidos: 0, proximos: 0, total: 0 });
  const [manutencaoStats, setManutencaoStats] = useState({ preventivas: 0, corretivas: 0, pendentes: 0 });

  useEffect(() => {
    loadStats();
    
    const unsubscribe = subscribe(() => {
      loadStats();
    });

    return unsubscribe;
  }, [subscribe]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Carregar estatísticas de tripulação
      const { data: crew } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('employment_status', 'ativo');

      let tripulacaoVencidos = 0;
      let tripulacaoProximos = 0;
      let tripulacaoTotal = 0;

      if (crew) {
        for (const member of crew) {
          const { data: licenses } = await supabase
            .from('habilitacoes_tripulante')
            .select('*')
            .eq('membro_tripulacao_id', member.id);

          for (const license of licenses || []) {
            if (license.data_validade) {
              const expiryDate = new Date(license.data_validade);
              expiryDate.setHours(0, 0, 0, 0);
              const diasRestantes = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              tripulacaoTotal++;
              if (diasRestantes < 0) tripulacaoVencidos++;
              else if (diasRestantes <= 60) tripulacaoProximos++;
            }

            if (license.validade_cma) {
              const expiryDate = new Date(license.validade_cma);
              expiryDate.setHours(0, 0, 0, 0);
              const diasRestantes = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              tripulacaoTotal++;
              if (diasRestantes < 0) tripulacaoVencidos++;
              else if (diasRestantes <= 60) tripulacaoProximos++;
            }
          }
        }
      }

      setTripulacaoStats({
        vencidos: tripulacaoVencidos,
        proximos: tripulacaoProximos,
        total: tripulacaoTotal
      });

      // Carregar estatísticas de documentos
      const { data: documents } = await supabase
        .from('documentos_voo')
        .select('*')
        .not('data_validade', 'is', null);

      let documentosVencidos = 0;
      let documentosProximos = 0;

      if (documents) {
        documents.forEach(doc => {
          const expiryDate = new Date(doc.data_validade);
          expiryDate.setHours(0, 0, 0, 0);
          const diasRestantes = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diasRestantes < 0) documentosVencidos++;
          else if (diasRestantes <= 60) documentosProximos++;
        });
      }

      setDocumentosStats({
        vencidos: documentosVencidos,
        proximos: documentosProximos,
        total: documents?.length || 0
      });

      // Carregar estatísticas de manutenção
      const { data: manutencoes } = await supabase
        .from('manutencoes')
        .select('*');

      let preventivas = 0;
      let corretivas = 0;
      let pendentes = 0;

      if (manutencoes) {
        manutencoes.forEach(m => {
          if (m.tipo === 'preventiva') preventivas++;
          else if (m.tipo === 'corretiva') corretivas++;
          if (m.etapa === 'pendente' || m.etapa === 'aguardando') pendentes++;
        });
      }

      setManutencaoStats({
        preventivas,
        corretivas,
        pendentes
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalCriticos = tripulacaoStats.vencidos + documentosStats.vencidos;
  const totalProximos = tripulacaoStats.proximos + documentosStats.proximos;

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
      <div className="min-h-screen bg-gradient-to-b from-background via-card to-background relative overflow-hidden">
        {/* Background gradient orbs */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] mix-blend-screen" />
        </div>

        <div className="relative z-10">
          {/* Sticky Header */}
          <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-[12px] border-b border-white/5">
            <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10 group cursor-pointer hover:scale-105 transition-transform">
                  <AlertCircle className="text-white text-xl" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white leading-tight">Controle de Vencimentos</h1>
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    Hub de Vencimentos Integrado
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
            {/* Alert Cards - Critical Items */}
            {(totalCriticos > 0 || totalProximos > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {totalCriticos > 0 && (
                  <div className="bg-red-500/10 backdrop-blur-[12px] border border-red-500/30 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <AlertCircle className="text-8xl text-red-400" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
                        </span>
                        <span className="text-sm font-bold uppercase tracking-wider text-red-400">Atenção Imediata</span>
                      </div>
                      <p className="text-4xl font-bold text-white mb-2">{totalCriticos}</p>
                      <p className="text-sm text-gray-300">
                        {totalCriticos === 1 ? 'item vencido' : 'itens vencidos'} requerem ação urgente
                      </p>
                    </div>
                  </div>
                )}

                {totalProximos > 0 && (
                  <div className="bg-yellow-500/10 backdrop-blur-[12px] border border-yellow-500/30 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <AlertTriangle className="text-8xl text-yellow-400" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full bg-yellow-400" />
                        <span className="text-sm font-bold uppercase tracking-wider text-yellow-400">Próximos 60 dias</span>
                      </div>
                      <p className="text-4xl font-bold text-white mb-2">{totalProximos}</p>
                      <p className="text-sm text-gray-300">
                        {totalProximos === 1 ? 'item vence' : 'itens vencem'} em breve
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Main Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tripulação Card */}
              <div 
                onClick={() => navigate('/vencimentos/tripulacao')}
                className="rounded-2xl border border-white/5 bg-gradient-to-br from-card-secondary/40 to-card/40 backdrop-blur-[12px] overflow-hidden hover:border-white/10 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] cursor-pointer group"
              >
                <div className="p-6 bg-gradient-to-r from-purple-500/10 via-transparent to-pink-500/5 border-b border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
                    <Users size={100} className="text-purple-400" />
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <Users className="w-6 h-6 text-purple-400" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-colors" />
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-1">Vencimentos de Tripulação</h2>
                    <p className="text-sm text-gray-400">Habilitações e CMA</p>
                  </div>
                </div>

                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-sm text-gray-400">Total</span>
                    <span className="text-2xl font-bold text-white">{tripulacaoStats.total}</span>
                  </div>

                  {tripulacaoStats.vencidos > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-red-300">Vencidos</span>
                      </div>
                      <span className="text-lg font-bold text-red-400">{tripulacaoStats.vencidos}</span>
                    </div>
                  )}

                  {tripulacaoStats.proximos > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-yellow-300">Próximos 60d</span>
                      </div>
                      <span className="text-lg font-bold text-yellow-400">{tripulacaoStats.proximos}</span>
                    </div>
                  )}

                  <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700 gap-2">
                    Ver Detalhes
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Documentos Card */}
              <div 
                onClick={() => navigate('/vencimentos/documentos')}
                className="rounded-2xl border border-white/5 bg-gradient-to-br from-card-secondary/40 to-card/40 backdrop-blur-[12px] overflow-hidden hover:border-white/10 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] cursor-pointer group"
              >
                <div className="p-6 bg-gradient-to-r from-cyan-500/10 via-transparent to-blue-500/5 border-b border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
                    <FileText size={100} className="text-cyan-400" />
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-cyan-400" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-cyan-400 transition-colors" />
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-1">Documentos de Aeronaves</h2>
                    <p className="text-sm text-gray-400">Certificados e Registros</p>
                  </div>
                </div>

                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-sm text-gray-400">Total</span>
                    <span className="text-2xl font-bold text-white">{documentosStats.total}</span>
                  </div>

                  {documentosStats.vencidos > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-red-300">Vencidos</span>
                      </div>
                      <span className="text-lg font-bold text-red-400">{documentosStats.vencidos}</span>
                    </div>
                  )}

                  {documentosStats.proximos > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-yellow-300">Próximos 60d</span>
                      </div>
                      <span className="text-lg font-bold text-yellow-400">{documentosStats.proximos}</span>
                    </div>
                  )}

                  <Button className="w-full mt-4 bg-cyan-600 hover:bg-cyan-700 gap-2">
                    Ver Detalhes
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Manutenção Card */}
              <div 
                onClick={() => navigate('/manutencao/aeronaves')}
                className="rounded-2xl border border-white/5 bg-gradient-to-br from-card-secondary/40 to-card/40 backdrop-blur-[12px] overflow-hidden hover:border-white/10 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] cursor-pointer group"
              >
                <div className="p-6 bg-gradient-to-r from-orange-500/10 via-transparent to-red-500/5 border-b border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
                    <Wrench size={100} className="text-orange-400" />
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                        <Wrench className="w-6 h-6 text-orange-400" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-400 transition-colors" />
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-1">Manutenção de Aeronaves</h2>
                    <p className="text-sm text-gray-400">Preventiva e Corretiva</p>
                  </div>
                </div>

                <div className="p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 p-3 rounded-lg bg-white/5 border border-white/5">
                      <p className="text-xs text-gray-400 mb-1">Preventivas</p>
                      <p className="text-xl font-bold text-orange-400">{manutencaoStats.preventivas}</p>
                    </div>
                    <div className="flex-1 p-3 rounded-lg bg-white/5 border border-white/5">
                      <p className="text-xs text-gray-400 mb-1">Corretivas</p>
                      <p className="text-xl font-bold text-red-400">{manutencaoStats.corretivas}</p>
                    </div>
                  </div>

                  {manutencaoStats.pendentes > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-blue-300">Pendentes</span>
                      </div>
                      <span className="text-lg font-bold text-blue-400">{manutencaoStats.pendentes}</span>
                    </div>
                  )}

                  <Button className="w-full mt-4 bg-orange-600 hover:bg-orange-700 gap-2">
                    Ver Detalhes
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Info Section */}
            <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-card-secondary/40 to-card/40 backdrop-blur-[12px] p-6">
              <h3 className="text-lg font-semibold text-white mb-4">ℹ️ Sistema de Vencimentos</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-xs text-gray-400 mb-2">Tripulação</p>
                  <p className="text-sm text-gray-200">Monitore habilitações e CMA de todos os tripulantes. Alertas com 60 dias de antecedência.</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-xs text-gray-400 mb-2">Documentos</p>
                  <p className="text-sm text-gray-200">Gerencie documentos de aeronaves com datas de vencimento. Atualizações sincronizadas em tempo real.</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-xs text-gray-400 mb-2">Manutenção</p>
                  <p className="text-sm text-gray-200">Preventiva (50/100h) e corretiva. Integração com horas do diário de bordo.</p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
}
