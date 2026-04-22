import { useEffect, useState, useMemo } from 'react';
import { Clock, User, MapPin, TrendingUp, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface DiarioTabProps { aircraftId: string; registration: string; }

interface LogEntry {
  id: string;
  data_registro: string;
  aerodromo_partida: string;
  aerodromo_chegada: string;
  horas_totais: number;
  tempo_total: number;
  tempo_voo: number;
  pousos_total: number;
  celula: number;
  natureza_voo: string;
  pic_canac: string;
  sic_name: string;
  socios_nome: string;
  clientes_id: string;
  origem_pic: string;
  membros_tripulacao?: { nome_completo: string };
  clientes?: { proprietario: string; razao_social: string };
}

interface SocioStats {
  nome: string;
  clienteId: string;
  horas: number;
  pousos: number;
  percentual: number;
}

export function DiarioTab({ aircraftId, registration }: DiarioTabProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [cotistas, setCotistas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModoVariavel, setShowModoVariavel] = useState(false);
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [socioStats, setSocioStats] = useState<SocioStats[]>([]);
  const [totalHorasPeriodo, setTotalHorasPeriodo] = useState(0);

  useEffect(() => {
    Promise.all([
      supabase
        .from('lancamentos_diario_bordo')
        .select(`
          id, data_registro, aerodromo_partida, aerodromo_chegada,
          horas_totais, tempo_total, tempo_voo, pousos_total, celula,
          natureza_voo, pic_canac, sic_name, socios_nome, clientes_id, origem_pic,
          membros_tripulacao!lancamentos_diario_bordo_pic_canac_fkey(nome_completo),
          clientes(proprietario, razao_social)
        `)
        .eq('aeronave_id', aircraftId)
        .order('data_registro', { ascending: false })
        .limit(200),
      supabase
        .from('cotistas_aeronave')
        .select('*, clientes(id, proprietario, razao_social, cnpj)')
        .eq('id_aeronave', aircraftId),
    ]).then(([logRes, cotistasRes]) => {
      console.log('Diario:', logRes.data, logRes.error);
      console.log('Cotistas:', cotistasRes.data, cotistasRes.error);
      if (logRes.data) setEntries(logRes.data as any);
      if (cotistasRes.data) setCotistas(cotistasRes.data);
      setLoading(false);
    });
  }, [aircraftId]);

  const totalHoras = useMemo(() => entries.reduce((a, e) => a + Number(e.horas_totais || e.tempo_total || 0), 0), [entries]);
  const totalPousos = useMemo(() => entries.reduce((a, e) => a + Number(e.pousos_total || 0), 0), [entries]);
  const pilotos = useMemo(() => {
    const p = new Set<string>();
    entries.forEach(e => {
      if ((e.membros_tripulacao as any)?.nome_completo) p.add((e.membros_tripulacao as any).nome_completo);
      if (e.sic_name) p.add(e.sic_name);
    });
    return p;
  }, [entries]);

  function calcModoVariavel() {
    if (!periodoInicio || !periodoFim) return;

    const filtered = entries.filter(e => {
      const d = e.data_registro;
      return d >= periodoInicio && d <= periodoFim;
    });

    const totalH = filtered.reduce((a, e) => a + Number(e.horas_totais || e.tempo_total || 0), 0);
    setTotalHorasPeriodo(totalH);

    // Calcular por socio baseado no clientes_id e socios_nome
    const horasPorCliente: Record<string, number> = {};
    let horasTesteTranlado = 0;

    filtered.forEach(e => {
      const horas = Number(e.horas_totais || e.tempo_total || 0);
      const natureza = (e.natureza_voo || '').toUpperCase();
      const isTeste = natureza.includes('TESTE') || natureza.includes('TRANSLADO') || natureza.includes('FERRY');

      if (isTeste) {
        horasTesteTranlado += horas;
      } else if (e.clientes_id) {
        horasPorCliente[e.clientes_id] = (horasPorCliente[e.clientes_id] || 0) + horas;
      }
    });

    // Distribute test hours equally
    const horasTestePorSocio = cotistas.length > 0 ? horasTesteTranlado / cotistas.length : 0;

    const stats: SocioStats[] = cotistas.map(c => {
      const cliente = c.clientes;
      if (!cliente) return null;
      const hVoo = horasPorCliente[cliente.id] || 0;
      const hTotal = hVoo + horasTestePorSocio;
      return {
        nome: cliente.proprietario || cliente.razao_social || 'Sócio',
        clienteId: cliente.id,
        horas: hTotal,
        pousos: 0,
        percentual: totalH > 0 ? (hTotal / totalH) * 100 : 0,
      };
    }).filter(Boolean) as SocioStats[];

    setSocioStats(stats);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="section-accent">
          <h2 className="text-lg font-semibold">Diário Técnico — {registration}</h2>
        </div>
        <button
          onClick={() => setShowModoVariavel(!showModoVariavel)}
          className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--ctm-teal)/0.15)] border border-[hsl(var(--ctm-teal)/0.3)] teal-text rounded-lg text-sm font-medium hover:bg-[hsl(var(--ctm-teal)/0.25)] transition-colors"
        >
          <TrendingUp className="h-4 w-4" />
          Modo Variável
          {showModoVariavel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total de Horas" value={`${totalHoras.toFixed(1)}h`} color="teal" />
        <StatCard label="Total de Pousos" value={String(totalPousos)} color="blue" />
        <StatCard label="Pilotos Registrados" value={String(pilotos.size)} color="purple" />
      </div>

      {/* Modo Variável — Cálculo de Rateio por Horas Voadas */}
      {showModoVariavel && (
        <div className="ctm-card p-5 mb-6 border-[hsl(var(--ctm-teal)/0.3)]">
          <h3 className="font-semibold mb-4 teal-text flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Cálculo de Rateio por Período (Modo Variável)
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Selecione o período de análise. O sistema calculará automaticamente quantas horas cada sócio voou,
            gerando o percentual de uso para dividir os custos de manutenção.
            Voos de Teste/Translado são divididos igualmente entre todos os sócios.
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data Início</label>
              <input
                type="date"
                value={periodoInicio}
                onChange={e => setPeriodoInicio(e.target.value)}
                className="ctm-input"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data Fim</label>
              <input
                type="date"
                value={periodoFim}
                onChange={e => setPeriodoFim(e.target.value)}
                className="ctm-input"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={calcModoVariavel}
                disabled={!periodoInicio || !periodoFim}
                className="px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ctm-teal-light transition-colors"
              >
                Calcular
              </button>
            </div>
          </div>

          {socioStats.length > 0 && (
            <div className="space-y-3 mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Resultado do Rateio</p>
                <p className="text-xs text-muted-foreground">Total no período: {totalHorasPeriodo.toFixed(2)}h</p>
              </div>
              {socioStats.map(s => (
                <div key={s.clienteId} className="p-4 bg-secondary rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{s.nome}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{s.horas.toFixed(2)}h</span>
                      <span className="font-bold teal-text">{s.percentual.toFixed(2)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[hsl(var(--ctm-navy))] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ctm-teal rounded-full"
                      style={{ width: `${Math.min(s.percentual, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-2">
                * Voos de Teste/Translado são divididos igualmente entre os sócios
              </p>
            </div>
          )}
        </div>
      )}

      {/* Log table */}
      {entries.length === 0 ? (
        <div className="ctm-card flex flex-col items-center justify-center py-16 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
          <p className="text-muted-foreground">Nenhum lançamento no diário</p>
          <p className="text-xs text-muted-foreground mt-1">Os voos registrados aparecerão aqui</p>
        </div>
      ) : (
        <div className="ctm-card overflow-hidden">
          <div className="overflow-x-auto ctm-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">PIC</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Sócio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Trecho</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Natureza</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Horas</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Pousos</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Célula</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const pilotName = (entry.membros_tripulacao as any)?.nome_completo || entry.sic_name || entry.origem_pic || '—';
                  const socioNome = entry.socios_nome || (entry.clientes as any)?.proprietario || (entry.clientes as any)?.razao_social || '—';
                  const natureza = entry.natureza_voo || '—';
                  const isTeste = natureza.toUpperCase().includes('TESTE') || natureza.toUpperCase().includes('TRANSLADO');

                  return (
                    <tr key={entry.id} className={cn(
                      'border-b border-border/50 hover:bg-secondary/50 transition-colors',
                      isTeste && 'bg-blue-500/5'
                    )}>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {entry.data_registro ? new Date(entry.data_registro + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[120px]" title={pilotName}>{pilotName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="truncate max-w-[120px] block" title={socioNome}>{socioNome}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-mono text-xs">
                            {entry.aerodromo_partida || '—'} → {entry.aerodromo_chegada || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={isTeste ? 'badge-pending' : 'badge-teal'}>
                          {natureza}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono teal-text">
                        {Number(entry.horas_totais || entry.tempo_total || 0).toFixed(2)}h
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {entry.pousos_total || 0}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {entry.celula ? `${entry.celula}h` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    teal: 'text-[hsl(var(--ctm-teal))]',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
  };
  return (
    <div className="ctm-card p-4 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', colorMap[color] || colorMap.teal)}>{value}</p>
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
