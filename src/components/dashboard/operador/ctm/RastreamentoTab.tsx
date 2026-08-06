import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface RastreamentoTabProps { aircraftId: string; }

export function RastreamentoTab({ aircraftId }: RastreamentoTabProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ tipo: '', ano: '', mes: '' });

  useEffect(() => {
    loadRastreamento();
  }, [aircraftId]);

  async function loadRastreamento() {
    const { data, error } = await supabase
      .from('ctm_rastreamento')
      .select('*')
      .eq('aeronave_id', aircraftId)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('Erro ao carregar rastreamento:', error);
    }

    if (data) setItems(data);
    setLoading(false);
  }

  const tipos = [...new Set(items.map(i => i.tipo_controle).filter(Boolean))];
  const anos = [...new Set(items.map(i => String(i.ano)).filter(Boolean))].sort((a, b) => b.localeCompare(a));

  const filtered = items.filter(i => {
    if (filters.tipo && i.tipo_controle !== filters.tipo) return false;
    if (filters.ano && String(i.ano) !== filters.ano) return false;
    if (filters.mes && String(i.mes) !== filters.mes) return false;
    return true;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="section-accent mb-6">
        <h2 className="text-lg font-semibold">Rastreamento de Componentes</h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          className="ctm-input"
          value={filters.tipo}
          onChange={e => setFilters(f => ({ ...f, tipo: e.target.value }))}
        >
          <option value="">Todos os tipos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          className="ctm-input"
          value={filters.ano}
          onChange={e => setFilters(f => ({ ...f, ano: e.target.value }))}
        >
          <option value="">Todos os anos</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          className="ctm-input"
          value={filters.mes}
          onChange={e => setFilters(f => ({ ...f, mes: e.target.value }))}
        >
          <option value="">Todos os meses</option>
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
            <option key={m} value={m}>{new Date(2000, m-1).toLocaleString('pt-BR', { month: 'long' })}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptySection icon={RotateCcw} text="Nenhum rastreamento registrado" />
      ) : (
        <div className="ctm-card overflow-hidden">
          <div className="overflow-x-auto ctm-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Tipo Controle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Período</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Última Troca</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Hrs Última</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Hrs Após</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Hrs Restantes</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">O.S</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">NF</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Orçamento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Sócio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Valor Esq.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Valor Dir.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="badge-teal">{item.tipo_controle || '—'}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{item.nome_item || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.mes != null && item.ano != null ? `${item.mes}/${item.ano}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {item.data_ultima_troca ? new Date(item.data_ultima_troca).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{item.horas_ultima_troca ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">{item.horas_apos ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={Number(item.horas_restantes ?? 0) < 10 ? 'text-red-400 font-bold' : 'teal-text'}>
                        {item.horas_restantes ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.numero_ordem_servico || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.numero_nota_fiscal || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.orcamento || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.nome_socio || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.valor_esquerdo || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.valor_direito || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Non-controlled items */}
      <NonControlledItems aircraftId={aircraftId} />
    </div>
  );
}

function NonControlledItems({ aircraftId }: { aircraftId: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('ctm_itens_nao_controlados').select('*').eq('aeronave_id', aircraftId)
      .then(({ data }) => { if (data) setItems(data); });
  }, [aircraftId]);

  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="font-semibold mb-3 text-muted-foreground">Itens Não Controlados</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(item => (
          <div key={item.id} className="ctm-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-sm">{item.tipo_controle}</p>
              {item.posicao && <span className="text-xs text-muted-foreground">{item.posicao}</span>}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              {item.marca && <span>Marca: {item.marca}</span>}
              {item.media_horas && <span>Média: {item.media_horas}h</span>}
              {item.horas_restantes && <span className="text-ctm-teal">Restam: {item.horas_restantes}h</span>}
            </div>
            {item.observacoes && <p className="text-xs text-muted-foreground mt-2">{item.observacoes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptySection({ icon: Icon, text }: { icon: typeof RotateCcw; text: string }) {
  return (
    <div className="ctm-card flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 border-2 border-ctm-teal border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
