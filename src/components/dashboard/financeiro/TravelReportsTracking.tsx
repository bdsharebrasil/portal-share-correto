// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client'; // Ajuste o caminho se necessário
import {
  ClockIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  SendIcon,
  FileTextIcon,
  SearchIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  XIcon,
  BadgeCheckIcon,
  BuildingIcon,
  PlaneIcon,
  UsersIcon,
  LinkIcon,
  ExternalLinkIcon,
  CopyIcon,
  Loader2Icon
} from 'lucide-react';

// ============================================================================
// TIPAGENS & UTILS
// ============================================================================
type ReportStatus = 'aguardando_aprovacao_tripulante' | 'em_revisao' | 'aprovado_tripulante' | 'enviado_cliente';

const STATUS_META: Record<string, any> = {
  aguardando_aprovacao_tripulante: {
    label: 'Aguardando tripulante',
    pill: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    rail: 'bg-amber-500',
    accent: 'text-amber-400',
    iconBg: 'border-amber-500/20 bg-amber-500/10',
    hint: 'Esperando resposta',
    icon: ClockIcon,
  },
  em_revisao: {
    label: 'Em revisão',
    pill: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
    rail: 'bg-rose-500',
    accent: 'text-rose-400',
    iconBg: 'border-rose-500/20 bg-rose-500/10',
    hint: 'Requer atenção',
    icon: AlertTriangleIcon,
  },
  aprovado_tripulante: {
    label: 'Pronto p/ cliente',
    pill: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    rail: 'bg-emerald-500',
    accent: 'text-emerald-400',
    iconBg: 'border-emerald-500/20 bg-emerald-500/10',
    hint: 'Revisado',
    icon: CheckCircle2Icon,
  },
  enviado_cliente: {
    label: 'Enviado ao cliente',
    pill: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    rail: 'bg-blue-500',
    accent: 'text-blue-400',
    iconBg: 'border-blue-500/20 bg-blue-500/10',
    hint: 'Finalizado',
    icon: SendIcon,
  },
};

const TRACKED_STATUSES = Object.keys(STATUS_META) as ReportStatus[];
const SOURCE_STATUSES = [...TRACKED_STATUSES, "Finalizado", "Enviado"];

const norm = (v: any) => String(v ?? "").trim().toLowerCase();
const isPendingCrew = (v: any) => ["pending", "pendente"].includes(norm(v));
const isApprovedCrew = (v: any) => ["approved", "aprovado"].includes(norm(v));
const isRejectedCrew = (v: any) => ["rejected", "rejeitado", "recusado", "em_revisao", "revisao"].includes(norm(v));

const resolveStatus = (report: any): ReportStatus | null => {
  if (TRACKED_STATUSES.includes(report.status)) return report.status;
  if (report.status !== "Finalizado" && report.status !== "Enviado") return null;
  if (isApprovedCrew(report.crew_approval_status)) return "aprovado_tripulante";
  if (isRejectedCrew(report.crew_approval_status)) return "em_revisao";
  if (isPendingCrew(report.crew_approval_status) && report.approval_token)
    return "aguardando_aprovacao_tripulante";
  return null;
};

// Funções de formatação
const formatCurrency = (val: any) => Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const formatDateTime = (val: any) => val ? format(new Date(val), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—';
const formatRelative = (val: any) => val ? formatDistanceToNow(new Date(val), { locale: ptBR, addSuffix: true }) : '—';
const daysSince = (val: any) => val ? differenceInDays(new Date(), new Date(val)) : null;
const compactCurrency = (value: number) => value.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const emptyByStatus = <T,>(value: T) => TRACKED_STATUSES.reduce((acc, status) => ({ ...acc, [status]: value }), {} as Record<ReportStatus, T>);

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================
function ReportsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="portal-row h-[120px] skeleton-shimmer rounded-xl"></div>
      ))}
    </div>
  );
}

function StatusFilterCards({ counts, totals, active, loading, onSelect }: any) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {TRACKED_STATUSES.map((status) => {
        const meta = STATUS_META[status];
        const Icon = meta.icon;
        const isActive = active === status;

        return (
          <button
            key={status}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(status)}
            className="portal-kpi group p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
            data-active={isActive}
          >
            <span
              aria-hidden="true"
              className={`absolute left-4 right-4 top-0 h-px ${meta.rail} opacity-0 transition-opacity duration-200 ease-out group-data-[active=true]:opacity-60`}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="portal-section-label truncate">{meta.label}</p>
                {loading ? (
                  <div className="skeleton-shimmer mt-2 h-8 w-12 rounded-md" />
                ) : (
                  <p className={`portal-value-mono mt-1 text-3xl leading-none ${meta.accent}`}>
                    {counts[status]}
                  </p>
                )}
                <p className="mt-2 truncate text-[11px] text-ink-400 text-muted-foreground">
                  {loading ? meta.hint : `R$ ${compactCurrency(totals[status])} · ${meta.hint}`}
                </p>
              </div>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${meta.iconBg}`}>
                <Icon className={`h-4 w-4 ${meta.accent}`} strokeWidth={2} />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ReportListItem({ report, link, busyAction, onCopyLink, onResend, onSendToClient }: any) {
  const meta = STATUS_META[report.status];
  const StatusIcon = meta.icon;
  const waitingDays = daysSince(report.enviado_tripulante_em);
  const isStalled = report.status === 'aguardando_aprovacao_tripulante' && waitingDays !== null && waitingDays >= 5;

  return (
    <article className="portal-row overflow-hidden pl-4">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${meta.rail}`} />
      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="portal-value-mono truncate text-[15px] font-semibold text-foreground">
              {report.numero_relatorio}
            </h3>
            <span className={`portal-pill ${meta.pill}`}>
              <StatusIcon className="h-3 w-3" strokeWidth={2.5} /> {meta.label}
            </span>
            {isApprovedCrew(report.crew_approval_status) && report.status !== 'enviado_cliente' && (
              <span className="portal-pill border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                <BadgeCheckIcon className="h-3 w-3" strokeWidth={2.5} /> Trip confirmou
              </span>
            )}
            {isStalled && (
              <span className="portal-pill border-amber-500/30 bg-amber-500/10 text-amber-400">
                {waitingDays} dias sem resposta
              </span>
            )}
          </div>

          <dl className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-muted-foreground">
            <div className="flex min-w-0 items-center gap-1.5">
              <BuildingIcon className="h-3.5 w-3.5 shrink-0" />
              <dd className="truncate">{report.clientes_id_rel?.razao_social || '—'}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <PlaneIcon className="h-3.5 w-3.5 shrink-0" />
              <dd className="portal-value-mono text-[11.5px] tracking-wide text-teal-400">
                {report.matricula_aeronave || '—'}
              </dd>
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <UsersIcon className="h-3.5 w-3.5 shrink-0" />
              <dd className="truncate">
                {report.nome_tripulante} {report.nome_tripulante_2 ? ` + ${report.nome_tripulante_2}` : ''}
              </dd>
            </div>
          </dl>

          <p className="mt-1.5 text-[11.5px] text-muted-foreground/70">
            Enviado ao tripulante em {formatDateTime(report.enviado_tripulante_em)} ({formatRelative(report.enviado_tripulante_em)})
            {report.enviado_cliente_em ? ` · Enviado ao cliente em ${formatDateTime(report.enviado_cliente_em)}` : ''}
          </p>

          {report.status === 'em_revisao' && report.crew_approval_notes && (
            <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.07] p-3">
              <p className="portal-section-label text-rose-400/80">Justificativa do tripulante</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-rose-200/85">
                {report.crew_approval_notes}
              </p>
            </div>
          )}

          {link && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1.5">
              <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <a href={link} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground transition-colors hover:text-teal-400">
                {link}
              </a>
              <ExternalLinkIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-white/[0.06] pt-3 lg:min-w-[248px] lg:items-end lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div className="lg:text-right">
            <p className="portal-section-label">Total do relatório</p>
            <p className="portal-value-mono mt-0.5 text-2xl text-foreground">
              <span className="mr-1 text-sm font-semibold text-muted-foreground">R$</span>
              {formatCurrency(report.total_valor)}
            </p>
            {report.nome_tripulante_2 && (
              <p className="mt-1 text-[11px] text-muted-foreground/70">
                {formatCurrency(report.total_trip)} + {formatCurrency(report.total_trip2)}
              </p>
            )}
          </div>

          <div className="mt-auto flex flex-wrap gap-2 lg:justify-end">
            {report.approval_token && (
              <button type="button" className="portal-btn" onClick={() => onCopyLink(report)} disabled={busyAction !== null}>
                {busyAction === 'copy' ? <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-400" /> : <CopyIcon className="h-3.5 w-3.5" />}
                {busyAction === 'copy' ? 'Copiado' : 'Copiar link'}
              </button>
            )}

            {(report.status === 'em_revisao' || report.status === 'aguardando_aprovacao_tripulante') && (
              <button type="button" className="portal-btn" onClick={() => onResend(report)} disabled={busyAction !== null}>
                {busyAction === 'resend' ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <RefreshCwIcon className="h-3.5 w-3.5" />}
                Reenviar
              </button>
            )}

            {report.status === 'aprovado_tripulante' && (
              <button type="button" className="portal-btn portal-btn-primary" onClick={() => onSendToClient(report)} disabled={busyAction !== null}>
                {busyAction === 'send' ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <SendIcon className="h-3.5 w-3.5" />}
                Enviar ao cliente
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function TravelReportsTracking() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ReportStatus | 'todos'>('todos');
  const [busy, setBusy] = useState<Record<string, string | null>>({});
  const [lastSync, setLastSync] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const { data, error } = await supabase
        .from("travel_expense_reports")
        .select("id, numero_relatorio, nome_tripulante, nome_tripulante_2, matricula_aeronave, total_valor, total_trip, total_trip2, status, crew_approval_status, crew_approval_notes, crew_approved_at, enviado_tripulante_em, enviado_cliente_em, approval_token, clientes_id, clientes_id_rel:clientes_id(razao_social), created_at")
        .in("status", SOURCE_STATUSES)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const processed = (data || []).map((report) => {
        const status = resolveStatus(report);
        return status ? { ...report, status } : null;
      }).filter(Boolean);

      setReports(processed);
      setLastSync(new Date().toISOString());
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar relatórios");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (filter !== 'todos' && r.status !== filter) return false;
      if (!q) return true;
      return [r.numero_relatorio, r.nome_tripulante, r.nome_tripulante_2, r.matricula_aeronave, r.clientes_id_rel?.razao_social]
        .some((field) => field?.toLowerCase().includes(q));
    });
  }, [reports, search, filter]);

  const { counts, totals } = useMemo(() => {
    const c = emptyByStatus(0);
    const t = emptyByStatus(0);
    reports.forEach((r) => {
      c[r.status] += 1;
      t[r.status] += Number(r.total_valor || 0);
    });
    return { counts: c, totals: t };
  }, [reports]);

  const filteredTotal = useMemo(() => filtered.reduce((sum, r) => sum + Number(r.total_valor || 0), 0), [filtered]);
  const buildLink = (token: string) => `${window.location.origin}/#/aprovar-relatorio/${token}`;
  const setReportBusy = (id: string, action: string | null) => setBusy((prev) => ({ ...prev, [id]: action }));

  const copyLink = async (report: any) => {
    if (!report.approval_token) return;
    try {
      await navigator.clipboard.writeText(buildLink(report.approval_token));
      setReportBusy(report.id, 'copy');
      toast.success('Link copiado', { description: report.numero_relatorio });
      setTimeout(() => setReportBusy(report.id, null), 1400);
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  };

  const resendToCrew = async (report: any) => {
    setReportBusy(report.id, 'resend');
    try {
      const { error } = await supabase.from("travel_expense_reports").update({
        status: 'aguardando_aprovacao_tripulante',
        crew_approval_status: 'pending',
        enviado_tripulante_em: new Date().toISOString(),
      }).eq("id", report.id);
      if (error) throw error;
      toast.success('Relatório reenviado', { description: `${report.numero_relatorio} · ${report.nome_tripulante}` });
      await load(true);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao reenviar');
    } finally {
      setReportBusy(report.id, null);
    }
  };

  const sendToClient = async (report: any) => {
    setReportBusy(report.id, 'send');
    try {
      const { error } = await supabase.from("travel_expense_reports").update({
        status: 'enviado_cliente',
        enviado_cliente_em: new Date().toISOString(),
      }).eq("id", report.id);
      if (error) throw error;
      toast.success('Enviado ao cliente', { description: `${report.numero_relatorio} · ${report.clientes_id_rel?.razao_social ?? ''}` });
      await load(true);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao marcar envio');
    } finally {
      setReportBusy(report.id, null);
    }
  };

  const hasFilters = filter !== 'todos' || search.trim().length > 0;

  return (
    <div className="space-y-5 portal-shell p-4 rounded-xl">
      <StatusFilterCards
        counts={counts}
        totals={totals}
        active={filter}
        loading={loading}
        onSelect={(status: ReportStatus) => setFilter((prev) => (prev === status ? 'todos' : status))}
      />

      <section className="portal-card" aria-labelledby="reports-heading">
        <header className="portal-card-header flex flex-wrap items-center justify-between gap-3">
          <div className="section-accent">
            <h2 id="reports-heading" className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <FileTextIcon className="h-4 w-4 text-teal-400" />
              Relatórios de viagem em fluxo
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {loading
                ? 'Sincronizando com o Portal…'
                : `${filtered.length} de ${reports.length} relatórios · R$ ${formatCurrency(filteredTotal)} em acompanhamento`}
            </p>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Número, tripulante, aeronave..."
                className="portal-input w-full pl-9 pr-3"
              />
            </div>
            <button type="button" onClick={() => load(true)} className="portal-btn h-[38px]" disabled={refreshing || loading}>
              <RefreshCwIcon className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </header>

        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-5 py-2.5">
            <SlidersHorizontalIcon className="h-3.5 w-3.5 text-muted-foreground" />
            {filter !== 'todos' && (
              <span className={`portal-pill ${STATUS_META[filter].pill}`}>
                {STATUS_META[filter].label}
              </span>
            )}
            {search.trim() && (
              <span className="portal-pill border-white/10 bg-white/[0.04] text-muted-foreground">
                “{search.trim()}”
              </span>
            )}
            <button
              type="button"
              onClick={() => { setFilter('todos'); setSearch(''); }}
              className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:text-teal-400"
            >
              <XIcon className="h-3 w-3" /> Limpar filtros
            </button>
          </div>
        )}

        <div className="ctm-scroll max-h-[640px] overflow-y-auto p-4">
          {loading ? (
            <ReportsSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
                <FileTextIcon className="h-5 w-5 text-muted-foreground" />
              </span>
              <p className="text-sm font-semibold text-foreground">Nenhum relatório neste recorte</p>
              <p className="max-w-xs text-[12.5px] text-muted-foreground">
                Ajuste a busca ou selecione outro status para ver os relatórios.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              <AnimatePresence initial={false}>
                {filtered.map((report, index) => (
                  <motion.li
                    key={report.id}
                    layout={!reduceMotion}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1], delay: reduceMotion ? 0 : Math.min(index, 5) * 0.04 }}
                  >
                    <ReportListItem
                      report={report}
                      link={report.approval_token ? buildLink(report.approval_token) : null}
                      busyAction={busy[report.id] ?? null}
                      onCopyLink={copyLink}
                      onResend={resendToCrew}
                      onSendToClient={sendToClient}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-white/[0.06] px-5 py-2.5 text-[11px] text-muted-foreground">
          <span>Última sincronização {lastSync ? formatRelative(lastSync) : '—'}</span>
          <span className="portal-value-mono text-foreground font-semibold">R$ {formatCurrency(filteredTotal)}</span>
        </footer>
      </section>
    </div>
  );
}