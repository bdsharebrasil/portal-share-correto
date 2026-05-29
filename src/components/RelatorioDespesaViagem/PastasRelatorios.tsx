import { useMemo, useState, useEffect } from 'react';
import { Folder, FileText, Send, Eye, Edit, CheckCheck, Clock, ArrowLeft, Pen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AircraftFolderButton } from './AircraftFolderButton';
import { SearchInput } from './SearchInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Extrai o prefixo fixo (REL-XXX-) do número do relatório
function extractPrefixFromNumber(reportNumber: string): string {
  const match = reportNumber.match(/^REL-[A-Z]{3}-/);
  return match ? match[0] : 'REL-XXX-';
}

// Extrai a parte editável (número, ano, aeronave) do número do relatório
function extractEditablePartFromNumber(reportNumber: string): string {
  return reportNumber.replace(/^REL-[A-Z]{3}-/, '');
}

// Prepara o número completo adicionando o prefixo à parte editável
function prependPrefixToNumber(originalNumber: string, editablePart: string): string {
  const prefix = extractPrefixFromNumber(originalNumber);
  return prefix + editablePart;
}

export interface PastaReportItem {
  id?: string;
  report_number: string;
  client: string;
  aircraft_registration: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  status: 'Rascunho' | 'Finalizado' | 'Ag. Conferência' | 'Assinado' | 'Enviado';
  clientes_id?: string;
  numero_relatorio_modificado_por?: string | null;
  numero_relatorio_modificado_em?: string | null;
  criado_por?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface PastasRelatoriosProps {
  reports: PastaReportItem[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string | undefined) => void;
  onSend: (report: PastaReportItem, type: 'conferencia' | 'cliente') => void | Promise<void>;
  onEditReportNumber?: (reportId: string, newNumber: string) => void | Promise<void>;
  initialClientSearchQuery?: string;
}

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Rascunho: { dot: '#fbbf24', bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', ring: 'rgba(245,158,11,0.3)', label: 'Rascunho' },
  Finalizado: { dot: '#818cf8', bg: 'rgba(99,102,241,0.15)', color: '#818cf8', ring: 'rgba(99,102,241,0.3)', label: 'Finalizado' },
  'Ag. Conferência': { dot: '#fb923c', bg: 'rgba(251,146,60,0.15)', color: '#fb923c', ring: 'rgba(251,146,60,0.3)', label: 'Ag. Conferência' },
  Assinado: { dot: '#34d399', bg: 'rgba(16,185,129,0.15)', color: '#34d399', ring: 'rgba(16,185,129,0.3)', label: 'Assinado' },
  Enviado: { dot: '#22d3ee', bg: 'rgba(6,182,212,0.15)', color: '#22d3ee', ring: 'rgba(6,182,212,0.3)', label: 'Enviado' },
};

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatDate(iso: string, withYear = false): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const mo = MONTHS_PT[m - 1];
  return withYear ? `${String(d).padStart(2, '0')} ${mo} ${y}` : `${String(d).padStart(2, '0')} ${mo}`;
}

// ─── Animated Delete Button ────────────────────────────────────────────────────
function DeleteButton({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      title="Excluir"
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: h ? 96 : 32,
        height: 32,
        borderRadius: h ? 50 : '50%',
        background: h ? 'rgb(220,50,50)' : 'rgb(28,28,34)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'width .28s cubic-bezier(.4,0,.2,1), border-radius .28s, background .2s',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        padding: 0,
        gap: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: h ? 3 : -20,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: 'white',
          fontSize: h ? 11 : 1,
          opacity: h ? 1 : 0,
          transition: 'font-size .22s, opacity .18s, top .22s',
          whiteSpace: 'nowrap',
          fontFamily: 'system-ui,sans-serif',
          fontWeight: 700,
          letterSpacing: '0.04em',
          pointerEvents: 'none',
        }}
      >
        Excluir
      </span>

      <svg
        viewBox="0 0 24 24"
        fill="none"
        style={{
          width: h ? 20 : 13,
          position: 'relative',
          zIndex: 1,
          transition: 'width .25s, transform .25s',
          transform: h ? 'translateY(55%)' : 'translateY(0%)',
          flexShrink: 0,
        }}
      >
        <path d="M3 6H21M8 6V4H16V6M19 6L18 20H6L5 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 11V17M14 11V17" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// ─── Icon Button ───────────────────────────────────────────────────────────────
function IconBtn({ children, title, onClick, hoverColor, hoverBg }: { children: React.ReactNode; title: string; onClick: () => void; hoverColor: string; hoverBg: string }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: 32,
        height: 32,
        border: 'none',
        borderRadius: 7,
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all .15s',
        background: h ? hoverBg : 'transparent',
        color: h ? hoverColor : 'rgba(255,255,255,0.28)',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PastaReportItem['status'] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['Rascunho'];
  const StatusIcon = status === 'Ag. Conferência' ? Clock : status === 'Assinado' ? CheckCheck : null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        fontWeight: 800,
        padding: '2px 8px',
        borderRadius: 999,
        letterSpacing: '0.04em',
        background: cfg.bg,
        color: cfg.color,
        boxShadow: `0 0 0 1px ${cfg.ring}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
      {StatusIcon && <StatusIcon size={9} style={{ flexShrink: 0 }} />}
    </span>
  );
}

// ─── Action Button (com estilo moderno) ────────────────────────────────────────
function ActionButton({ children, onClick, gradient, title }: { children: React.ReactNode; onClick: () => void; gradient: string; title?: string }) {
  const [isActive, setIsActive] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      style={{
        fontFamily: 'inherit',
        fontSize: '15px',
        fontWeight: 500,
        background: gradient,
        color: 'white',
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: '28px',
        boxShadow: isActive ? '0px 2px 8px rgba(0, 0, 0, 0.15)' : '0px 5px 15px rgba(0, 0, 0, 0.2)',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        cursor: 'pointer',
        transform: isActive ? 'scale(0.96)' : 'translateY(0px)',
        gap: '8px',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0px 8px 20px rgba(0, 0, 0, 0.25)';
        }
      }}
      onMouseLeave={(e) => {
        setIsActive(false);
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0px)';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0px 5px 15px rgba(0, 0, 0, 0.2)';
      }}
    >
      {children}
    </button>
  );
}

// ─── Report Card ───────────────────────────────────────────────────────────────
function ReportCard({ report, onSend, onEdit, onView, onDelete, onEditReportNumber }: { report: PastaReportItem; onSend: (rep: PastaReportItem, type: string) => void; onEdit: (id: string) => void; onView: (id: string) => void; onDelete: (id: string | undefined) => void; onEditReportNumber?: (reportId: string, newNumber: string) => void | Promise<void> }) {
  const [h, setH] = useState(false);
  const [editingNumber, setEditingNumber] = useState(false);
  const [newNumber, setNewNumber] = useState(report.report_number);
  const [isSaving, setIsSaving] = useState(false);

  const amount = `R$ ${report.total_amount.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  const dateRange = `${formatDate(report.start_date)} a ${formatDate(report.end_date, true)}`;

  const handleSaveNumber = async () => {
    if (!newNumber.trim() || newNumber === report.report_number) {
      setEditingNumber(false);
      setNewNumber(report.report_number);
      return;
    }

    try {
      setIsSaving(true);
      if (onEditReportNumber) {
        await onEditReportNumber(report.id!, newNumber);
        setEditingNumber(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNewNumber(report.report_number);
    setEditingNumber(false);
  };

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '14px',
        borderRadius: 10,
        transition: 'background .15s',
        background: h ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Linha principal: informações + botões topo */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
          <FileText size={15} style={{ color: 'rgba(255,255,255,0.28)', marginTop: 2, flexShrink: 0 }} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: '"JetBrains Mono","Fira Code",monospace',
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: '0.03em',
                  color: 'rgba(255,255,255,0.9)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {report.report_number}
              </p>

              {report.status === 'Finalizado' && (
                <button
                  onClick={() => setEditingNumber(true)}
                  title="Editar número do relatório"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = '#818cf8';
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.28)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                  style={{
                    width: 20,
                    height: 20,
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all .15s',
                    color: 'rgba(255,255,255,0.28)',
                    background: 'transparent',
                    flexShrink: 0,
                  }}
                >
                  <Pen size={13} />
                </button>
              )}
            </div>

            <p
              style={{
                margin: '3px 0 6px',
                fontSize: 10.5,
                color: 'rgba(255,255,255,0.32)',
                fontFamily: 'system-ui,sans-serif',
                letterSpacing: '0.01em',
              }}
            >
              {dateRange}
            </p>

            <StatusBadge status={report.status} />

            <p
              style={{
                margin: '5px 0 0',
                fontFamily: '"JetBrains Mono","Fira Code",monospace',
                fontSize: 11.5,
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.02em',
              }}
            >
              {amount}
            </p>

            {report.numero_relatorio_modificado_por && (
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.25)',
                  fontFamily: 'system-ui,sans-serif',
                  fontStyle: 'italic',
                }}
              >
                Número modificado por: {report.numero_relatorio_modificado_por}{report.numero_relatorio_modificado_em ? ` em ${formatDate(report.numero_relatorio_modificado_em, true)}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Botões topo: Visualizar e Excluir */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          <IconBtn title="Visualizar PDF" onClick={() => onView(report.id!)} hoverColor="#818cf8" hoverBg="rgba(99,102,241,0.15)">
            <Eye size={14} />
          </IconBtn>

          <DeleteButton onClick={() => onDelete(report.id)} />
        </div>
      </div>

      {/* Modal para editar número */}
      <Dialog open={editingNumber} onOpenChange={setEditingNumber}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Número do Relatório</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Número do Relatório</Label>
              <div className="flex gap-2">
                <div className="flex-shrink-0 flex items-center px-3 py-2 bg-muted border border-input rounded-md text-sm font-mono text-muted-foreground">
                  {extractPrefixFromNumber(report.report_number)}
                </div>
                <Input
                  id="newNumber"
                  value={extractEditablePartFromNumber(newNumber)}
                  onChange={(e) => setNewNumber(prependPrefixToNumber(report.report_number, e.target.value))}
                  placeholder={extractEditablePartFromNumber(report.report_number)}
                  disabled={isSaving}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                O prefixo com código do cliente é fixo. Edite apenas o número e aeronave.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveNumber} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Botões ação (Enviar ao Cliente e Enviar para Tripulante) */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
        {/* Enviar para Tripulante - Finalizado → Ag. Conferência (Laranja) */}
        {report.status === 'Finalizado' && (
          <ActionButton
            onClick={() => onSend(report, 'conferencia')}
            gradient="linear-gradient(135deg, #ff9a56 0%, #ff7f2f 100%)"
            title="Gera link para tripulante assinar"
          >
            <Send size={16} style={{ strokeWidth: 2.5 }} />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Enviar Tripulante</span>
          </ActionButton>
        )}

        {/* Enviar ao Cliente - sempre disponível (Azul) */}
        <ActionButton
          onClick={() => onSend(report, 'cliente')}
          gradient="linear-gradient(135deg, #4dc7d9 0%, #47a3c0 100%)"
          title="Envia relatório para o cliente"
        >
          <Send size={16} style={{ strokeWidth: 2.5 }} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Enviar Cliente</span>
        </ActionButton>

        {/* Editar - apenas Rascunho (Roxo) */}
        {report.status === 'Rascunho' && (
          <ActionButton
            onClick={() => onEdit(report.id!)}
            gradient="linear-gradient(135deg, #9f7aea 0%, #805ad5 100%)"
            title="Editar relatório"
          >
            <Edit size={16} style={{ strokeWidth: 2.5 }} />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Editar</span>
          </ActionButton>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Bone({ style }: { style?: React.CSSProperties }) {
  return <div style={{ background: 'rgba(255,255,255,0.08)', animation: 'bpulse 1.8s ease-in-out infinite alternate', borderRadius: 4, ...style }} />;
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <Bone style={{ width: 14, height: 14, borderRadius: 3, marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Bone style={{ width: '52%', height: 13 }} />
        <Bone style={{ width: '38%', height: 10 }} />
        <Bone style={{ width: 82, height: 18, borderRadius: 999, marginTop: 2 }} />
        <Bone style={{ width: '28%', height: 11 }} />
      </div>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        <Bone style={{ width: 32, height: 32, borderRadius: 7 }} />
        <Bone style={{ width: 32, height: 32, borderRadius: 7 }} />
        <Bone style={{ width: 32, height: 32, borderRadius: '50%' }} />
      </div>
    </div>
  );
}

// ─── Status flow legend ────────────────────────────────────────────────────────
const FLOW = [
  { s: 'Rascunho', desc: 'Em edição' },
  { s: 'Finalizado', desc: 'Pronto' },
  { s: 'Ag. Conferência', desc: 'Aguarda assinatura' },
  { s: 'Assinado', desc: 'Tripulante confirmou' },
  { s: 'Enviado', desc: 'Aguarda pagamento' },
];

export function PastasRelatorios({ reports, onView, onEdit, onDelete, onSend, onEditReportNumber, initialClientSearchQuery = '' }: PastasRelatoriosProps) {
  const [openAircraft, setOpenAircraft] = useState<Record<string, boolean>>({});
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState(initialClientSearchQuery);

  // Sincronizar a busca de cliente quando a prop mudar
  useEffect(() => {
    setClientSearchQuery(initialClientSearchQuery);
  }, [initialClientSearchQuery]);

  // Estrutura: cliente -> matrícula -> relatórios
  const tree = useMemo(() => {
    const map = new Map<string, Map<string, PastaReportItem[]>>();
    for (const r of reports) {
      const c = (r.client || 'Sem Cliente').trim();
      const a = (r.aircraft_registration || 'Sem Aeronave').trim().toUpperCase();
      if (!map.has(c)) map.set(c, new Map());
      const aMap = map.get(c)!;
      if (!aMap.has(a)) aMap.set(a, []);
      aMap.get(a)!.push(r);
    }
    return Array.from(map.entries())
      .map(([client, aMap]) => ({
        client,
        numAircraft: aMap.size,
        totalReports: Array.from(aMap.values()).reduce((s, l) => s + l.length, 0),
        aircraft: Array.from(aMap.entries())
          .map(([reg, list]) => ({
            reg,
            reports: [...list].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || '')),
          }))
          .sort((a, b) => a.reg.localeCompare(b.reg)),
      }))
      .sort((a, b) => a.client.localeCompare(b.client));
  }, [reports]);

  const toggleAircraft = (key: string) => setOpenAircraft((p) => ({ ...p, [key]: !p[key] }));

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Folder className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">Nenhum relatório encontrado.</p>
      </div>
    );
  }

  // View dedicada por cliente
  if (selectedClient) {
    const clientData = tree.find((t) => t.client === selectedClient);
    if (!clientData) return null;

    // Filtrar relatórios baseado na busca
    const filteredAircraft = clientData.aircraft
      .map((aircraft) => ({
        ...aircraft,
        reports: aircraft.reports.filter((report) => {
          const searchLower = searchQuery.toLowerCase();
          return (
            report.report_number.toLowerCase().includes(searchLower) ||
            report.aircraft_registration.toLowerCase().includes(searchLower) ||
            report.start_date.includes(searchQuery) ||
            report.total_amount.toString().includes(searchQuery) ||
            report.status.toLowerCase().includes(searchLower)
          );
        }),
      }))
      .filter((aircraft) => aircraft.reports.length > 0);

    return (
      <div className="space-y-6">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
          @keyframes bpulse { to { opacity: 0.25; } }
        `}</style>

        {/* Header com botão voltar */}
        <div className="flex items-center gap-3 pb-4 border-b border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedClient(null);
              setSearchQuery('');
              setClientSearchQuery('');
            }}
            className="gap-2 text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h2 className="text-2xl font-bold text-foreground">{selectedClient}</h2>
          <span className="ml-auto text-sm text-muted-foreground">
            {clientData.numAircraft} {clientData.numAircraft === 1 ? 'aeronave' : 'aeronaves'} · {clientData.totalReports} {clientData.totalReports === 1 ? 'relatório' : 'relatórios'}
          </span>
        </div>

        {/* Filtro de busca */}
        <div className="flex justify-center">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por número, data, valor..." />
        </div>

        {/* Flow legend */}
        <div style={{ marginBottom: 22, padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ margin: '0 0 9px', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>
            Fluxo de Status
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 0' }}>
            {FLOW.map((f, i) => {
              const cfg = STATUS_CONFIG[f.s as keyof typeof STATUS_CONFIG];
              return (
                <div key={f.s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {i > 0 && <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10, margin: '0 4px' }}>→</span>}
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot }} />
                  <span style={{ fontSize: 10, color: cfg.color, fontWeight: 700 }}>{f.s}</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)' }}>({f.desc})</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pastas por aeronave */}
        {filteredAircraft.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum relatório encontrado</p>
            <p className="text-muted-foreground text-sm">Tente usar outro termo de busca</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {filteredAircraft.map(({ reg, reports: list }) => {
              const key = `${selectedClient}::${reg}`;
              const acOpen = !!openAircraft[key];
              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Botão de pasta com animação 3D */}
                  <AircraftFolderButton label={reg} count={list.length} isOpen={acOpen} onClick={() => toggleAircraft(key)} />

                  {/* Lista de relatórios da aeronave */}
                  {acOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {list.map((report) => (
                        <ReportCard
                          key={report.id}
                          report={report}
                          onSend={(rep, type) => onSend(rep, type)}
                          onEdit={(id) => onEdit(id)}
                          onView={(id) => onView(id)}
                          onDelete={(id) => onDelete(id)}
                          onEditReportNumber={onEditReportNumber}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // View principal com grid de pastas de clientes
  const filteredTree = tree.filter(({ client }) => client.toLowerCase().includes(clientSearchQuery.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* SearchInput no topo da lista de clientes */}
      <div className="flex justify-center">
        <SearchInput value={clientSearchQuery} onChange={setClientSearchQuery} placeholder="Buscar cliente..." />
      </div>

      {/* Grid de pastas */}
      {filteredTree.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Folder className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum cliente encontrado</p>
          <p className="text-muted-foreground text-sm">Tente usar outro termo de busca</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filteredTree.map(({ client, numAircraft, totalReports }) => (
            <button
              key={client}
              onClick={() => setSelectedClient(client)}
              className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all duration-200"
            >
              {/* Ícone de pasta estilizado */}
              <div className="w-24 h-20 relative group-hover:scale-105 transition-transform duration-200">
                <svg viewBox="0 0 120 100" className="w-full h-full drop-shadow-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 25 L10 15 Q10 8 17 8 L42 8 Q46 8 48 12 L54 22 Q56 25 60 25 Z" fill="#06b6d4" opacity="0.9" />
                  <rect x="6" y="25" width="108" height="68" rx="8" fill="#06b6d4" />
                </svg>
              </div>
              <div className="text-center w-full">
                <p className="text-sm font-semibold text-foreground truncate">{client}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {numAircraft} {numAircraft === 1 ? 'aeronave' : 'aeronaves'} • {totalReports} {totalReports === 1 ? 'relatório' : 'relatórios'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
