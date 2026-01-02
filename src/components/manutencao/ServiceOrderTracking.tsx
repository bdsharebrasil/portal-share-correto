import React, { useState, useEffect } from 'react';
import {
  Plus, X, Edit3, Trash2, Save, Loader2, AlertCircle, TrendingUp, ChevronDown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ServiceItem {
  id: string;
  description: string;
  provider: string;
  period: string;
  value: number;
  nfse: string;
  status: 'pendente' | 'concluído' | 'cancelado';
}

interface ServiceOrder {
  id: string;
  order_number: string;
  aircraft_id: string;
  service_type: string;
  description: string;
  supplier: string;
  period: string;
  value: number;
  status: 'pendente' | 'concluído' | 'cancelado';
  created_at: string;
  updated_at: string;
}

interface Props {
  aircraftId: string;
  registration: string;
}

const ServiceOrderTracking: React.FC<Props> = ({ aircraftId, registration }) => {
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [selectedOS, setSelectedOS] = useState<ServiceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingOS, setIsCreatingOS] = useState(false);
  const [expandedOS, setExpandedOS] = useState<string | null>(null);

  const [newOSForm, setNewOSForm] = useState({
    order_number: '',
    service_type: '',
    description: '',
    supplier: '',
    period: '',
    value: '',
  });

  useEffect(() => {
    loadServiceOrders();
  }, [aircraftId]);

  const loadServiceOrders = async () => {
    try {
      setLoading(true);

      // Buscar Service Orders
      const { data: osData, error: osError } = await supabase
        .from('service_orders')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('created_at', { ascending: false });

      if (osError) throw osError;

      setServiceOrders(osData || []);

      if (osData && osData.length > 0) {
        setSelectedOS(osData[0]);
        
        // Buscar items para a primeira OS
        const { data: itemsData, error: itemsError } = await supabase
          .from('service_items')
          .select('*')
          .eq('service_order_id', osData[0].id)
          .order('created_at', { ascending: false });

        if (!itemsError) {
          setServiceItems(itemsData || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar OS:', error);
      toast.error('Erro ao carregar ordens de serviço');
    } finally {
      setLoading(false);
    }
  };

  const loadServiceItems = async (osId: string) => {
    try {
      const { data, error } = await supabase
        .from('service_items')
        .select('*')
        .eq('service_order_id', osId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServiceItems(data || []);
    } catch (error) {
      console.error('Erro ao carregar items:', error);
      toast.error('Erro ao carregar items da OS');
    }
  };

  const handleSelectOS = (os: ServiceOrder) => {
    setSelectedOS(os);
    loadServiceItems(os.id);
  };

  const handleCreateOS = async () => {
    if (!newOSForm.order_number || !newOSForm.service_type) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('service_orders')
        .insert([{
          order_number: newOSForm.order_number,
          aircraft_id: aircraftId,
          service_type: newOSForm.service_type,
          description: newOSForm.description,
          supplier: newOSForm.supplier,
          period: newOSForm.period,
          value: parseFloat(newOSForm.value) || 0,
          status: 'pendente'
        }])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setServiceOrders([data[0], ...serviceOrders]);
        setSelectedOS(data[0]);
        setIsCreatingOS(false);
        setNewOSForm({
          order_number: '',
          service_type: '',
          description: '',
          supplier: '',
          period: '',
          value: '',
        });
        toast.success('Ordem de Serviço criada com sucesso');
      }
    } catch (error) {
      console.error('Erro ao criar OS:', error);
      toast.error('Erro ao criar ordem de serviço');
    }
  };

  const handleDeleteOS = async (osId: string) => {
    try {
      const { error } = await supabase
        .from('service_orders')
        .delete()
        .eq('id', osId);

      if (error) throw error;

      setServiceOrders(serviceOrders.filter(os => os.id !== osId));
      if (selectedOS?.id === osId) {
        setSelectedOS(serviceOrders.length > 1 ? serviceOrders[0] : null);
      }
      toast.success('Ordem de Serviço deletada');
    } catch (error) {
      console.error('Erro ao deletar OS:', error);
      toast.error('Erro ao deletar ordem de serviço');
    }
  };

  const totalValue = selectedOS?.value || 0;
  const totalItems = serviceItems.reduce((sum, item) => sum + item.value, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-slate-400">Carregando ordens de serviço...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Ordem de Acompanhamento de Serviço</h2>
          <p className="text-slate-500 text-sm mt-1">Gerenciamento de serviços e itens por ordem de serviço</p>
        </div>
        <button
          onClick={() => setIsCreatingOS(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all text-sm border border-blue-700"
        >
          <Plus className="w-5 h-5" /> Nova OS
        </button>
      </div>

      {serviceOrders.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">Nenhuma Ordem de Serviço criada para esta aeronave</p>
          <button
            onClick={() => setIsCreatingOS(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl inline-flex items-center gap-2 font-bold"
          >
            <Plus className="w-4 h-4" /> Criar primeira OS
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Lista de Ordens de Serviço */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">Ordens de Serviço</h3>
            {serviceOrders.map((os) => (
              <div
                key={os.id}
                className={`bg-slate-900 border-2 rounded-2xl transition-all cursor-pointer ${
                  selectedOS?.id === os.id
                    ? 'border-blue-600 shadow-lg shadow-blue-900/30'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <button
                  onClick={() => handleSelectOS(os)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 rounded-2xl transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center">
                      <span className="font-bold text-blue-400">#{os.order_number}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-100">{os.service_type}</p>
                      <p className="text-xs text-slate-500">{os.supplier || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-100">R$ {os.value?.toFixed(2) || '0.00'}</p>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        os.status === 'concluído' ? 'bg-emerald-500/20 text-emerald-400' :
                        os.status === 'cancelado' ? 'bg-red-500/20 text-red-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {os.status}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${
                    expandedOS === os.id ? 'rotate-180' : ''
                  }`} />
                </button>

                {expandedOS === os.id && (
                  <div className="border-t border-slate-800 p-4 bg-slate-950/50">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Descrição</p>
                        <p className="text-slate-300">{os.description || '—'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Período</p>
                          <p className="text-slate-300">{os.period || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Data Criação</p>
                          <p className="text-slate-300">{new Date(os.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteOS(os.id)}
                        className="w-full mt-4 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-700/30 text-red-400 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" /> Deletar OS
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {selectedOS && (
            <>
              {/* Detalhes da OS Selecionada */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: 'Nº Ordem', value: selectedOS.order_number },
                  { label: 'Tipo de Serviço', value: selectedOS.service_type },
                  { label: 'Período', value: selectedOS.period || '—' },
                  { label: 'Status', value: selectedOS.status },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{item.label}</p>
                    <p className="text-lg font-bold text-slate-100">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Tabela de Itens */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-yellow-600 to-yellow-700">
                  <h3 className="text-lg font-bold text-white flex items-center gap-3">
                    🔧 ITENS DA ORDEM
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/50">
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase">Descrição</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase">Fornecedor</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase">Período</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase">Valor</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase">NFSe</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {serviceItems.length > 0 ? (
                        serviceItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-800/40 transition-all">
                            <td className="px-6 py-4 text-slate-100">{item.description}</td>
                            <td className="px-6 py-4 text-slate-100">{item.provider}</td>
                            <td className="px-6 py-4 text-slate-100">{item.period || '—'}</td>
                            <td className="px-6 py-4 font-bold text-slate-100">R$ {item.value.toFixed(2)}</td>
                            <td className="px-6 py-4 text-slate-400 text-xs">{item.nfse || '—'}</td>
                            <td className="px-6 py-4">
                              <span className={`text-xs font-bold px-2 py-1 rounded ${
                                item.status === 'concluído' ? 'bg-emerald-500/20 text-emerald-400' :
                                item.status === 'cancelado' ? 'bg-red-500/20 text-red-400' :
                                'bg-amber-500/20 text-amber-400'
                              }`}>
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                            Nenhum item registrado nesta ordem
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-between items-center">
                  <span className="font-bold text-slate-300">TOTAL ITENS:</span>
                  <span className="text-2xl font-black text-yellow-400">R$ {totalItems.toFixed(2)}</span>
                </div>
              </div>

              {/* Resumo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl">
                  <h3 className="text-lg font-bold text-slate-100 mb-6">📋 Resumo da OS</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                      <span className="text-slate-400">Valor Principal</span>
                      <span className="text-2xl font-black text-blue-400">R$ {totalValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                      <span className="text-slate-400">Total de Itens</span>
                      <span className="text-2xl font-black text-yellow-400">R$ {totalItems.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 bg-slate-700/30 p-4 rounded-xl">
                      <span className="text-slate-200 font-bold text-lg">TOTAL</span>
                      <span className="text-3xl font-black text-emerald-400">
                        R$ {(totalValue + totalItems).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl">
                  <h3 className="text-lg font-bold text-slate-100 mb-6">📊 Informações</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">Fornecedor Principal</p>
                      <p className="text-slate-100 font-bold">{selectedOS.supplier || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">Total de Itens Associados</p>
                      <p className="text-2xl font-black text-blue-400">{serviceItems.length}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">Criada em</p>
                      <p className="text-slate-100">{new Date(selectedOS.created_at).toLocaleDateString('pt-BR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal de Nova OS */}
      {isCreatingOS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6">
            <h3 className="text-xl font-bold mb-4">Nova Ordem de Serviço</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Nº da Ordem"
                value={newOSForm.order_number}
                onChange={(e) => setNewOSForm({ ...newOSForm, order_number: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Tipo de Serviço"
                value={newOSForm.service_type}
                onChange={(e) => setNewOSForm({ ...newOSForm, service_type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="Descrição"
                value={newOSForm.description}
                onChange={(e) => setNewOSForm({ ...newOSForm, description: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
              />
              <input
                type="text"
                placeholder="Fornecedor"
                value={newOSForm.supplier}
                onChange={(e) => setNewOSForm({ ...newOSForm, supplier: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Período"
                value={newOSForm.period}
                onChange={(e) => setNewOSForm({ ...newOSForm, period: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Valor"
                step="0.01"
                value={newOSForm.value}
                onChange={(e) => setNewOSForm({ ...newOSForm, value: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsCreatingOS(false)}
                  className="flex-1 p-3 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateOS}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 p-3 rounded-xl font-bold text-white transition-colors"
                >
                  Criar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceOrderTracking;
