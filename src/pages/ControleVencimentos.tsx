import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Plane, AlertCircle, CheckCheck, AlertTriangle, Clock, CheckCircle, Plus, Calendar, Wrench, FileText, Upload, Eye, X } from "lucide-react";
import { DocumentViewer } from "@/components/DocumentViewer";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useAeronaves } from "@/hooks/useAeronaves";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ManutencaoDialog } from "@/components/manutencao/ManutencaoDialog";
import { NovoVencimentoDialog } from "@/components/vencimentos/NovoVencimentoDialog";
import { NovoDocumentoDialog } from "@/components/vencimentos/NovoDocumentoDialog";
import { MaintenanceDashboard } from "@/components/maintenance";
import { supabase } from "@/integrations/supabase/client";
import { getFlightDocumentPublicUrl } from "@/lib/storageHelper";

interface Vencimento {
  id: string;
  item: string;
  aeronave: string;
  aeronaveId: string;
  dataVencimento: string;
  diasRestantes: number;
  diasAlerta: number;
  status: string;
  tipo: "manutencao" | "documento";
  comprovanteUrl?: string;
  fileType?: string;
  valorPago?: number;
}

interface Aeronave {
  id: string;
  registration: string;
  model: string;
  manufacturer: string;
}

export default function ControleVencimentos() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { aeronaves, isLoadingAeronaves } = useAeronaves();
  
  const [vencimentos, setVencimentos] = useState<Vencimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAeronave, setSelectedAeronave] = useState<string>("todas");
  const [activeTab, setActiveTab] = useState<"manutencao" | "documento" | "preventiva">("manutencao");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedVencimento, setSelectedVencimento] = useState<Vencimento | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewDocumentOpen, setViewDocumentOpen] = useState(false);
  const [documentToView, setDocumentToView] = useState<{ url: string; name: string; fileType: string } | null>(null);
  const [aeronavesComHoras, setAeronavesComHoras] = useState<Set<string>>(new Set());

  const aeronavesAtivas = useMemo(() => {
    return aeronaves.filter(a => {
      const isAtiva = a.status?.toLowerCase() === "ativa" || a.status?.toLowerCase() === "ativo";
      const temHoras = aeronavesComHoras.has(a.id);
      return isAtiva && temHoras;
    });
  }, [aeronaves, aeronavesComHoras]);

  useEffect(() => {
    loadVencimentos();
  }, [toast]);

  const loadVencimentos = async () => {
    setLoading(true);
    try {
      // Carregar aeronaves com horas no diário de bordo
      const { data: logbookData, error: logbookError } = await supabase
        .from("logbook_months")
        .select("aircraft_id, celula_atual")
        .gt("celula_atual", 0);

      const aircraftWithHours = new Set<string>();
      if (!logbookError && logbookData) {
        logbookData.forEach(entry => {
          aircraftWithHours.add(entry.aircraft_id);
        });
      }
      setAeronavesComHoras(aircraftWithHours);

      const { fetchManutencoesWithAircraft } = await import("@/services/manutencoes");
      const rows = await fetchManutencoesWithAircraft();
      const today = new Date().getTime();
      const mapped = rows.map(m => {
        const dt = new Date(m.data_programada).getTime();
        const diasRestantes = Math.ceil((dt - today) / (1000 * 60 * 60 * 24));
        return {
          id: m.id,
          item: m.tipo,
          aeronave: m.aeronave_registration || "-",
          aeronaveId: m.aeronave_id || "",
          dataVencimento: m.data_programada,
          diasRestantes,
          diasAlerta: 30,
          status: m.etapa === "concluida" ? "concluido" : m.etapa === "em_andamento" ? "programado" : "pendente",
          tipo: "manutencao" as const
        };
      });

      // Load documents - only those with expiry_date
      const { data: documents, error: docError } = await supabase
        .from("flight_documents")
        .select("*")
        .not("expiry_date", "is", null)
        .order("expiry_date", { ascending: true });

      if (!docError && documents) {
        const mappedDocs = documents.map((doc: any) => {
          const dt = new Date(doc.expiry_date).getTime();
          const diasRestantes = Math.ceil((dt - today) / (1000 * 60 * 60 * 24));
          const aircraft = aeronaves.find(a => a.id === doc.aircraft_id);

          // Converter file_path para URL pública
          const publicUrl = doc.file_path ? getFlightDocumentPublicUrl(doc.file_path) : undefined;

          return {
            id: doc.id,
            item: doc.name,
            aeronave: aircraft?.registration || "-",
            aeronaveId: doc.aircraft_id || "",
            dataVencimento: doc.expiry_date,
            diasRestantes,
            diasAlerta: doc.alert_days || 30,
            status: diasRestantes < 0 ? "vencido" : "pendente",
            tipo: "documento" as const,
            comprovanteUrl: publicUrl,
            fileType: doc.file_type || "application/pdf"
          };
        });
        setVencimentos([...mapped, ...mappedDocs]);

        console.log('📄 Documentos carregados:', mappedDocs.length);
        if (mappedDocs.length > 0) {
          console.log('🔗 Primeiro documento:', {
            name: mappedDocs[0].item,
            url: mappedDocs[0].comprovanteUrl,
            fileType: mappedDocs[0].fileType
          });
        }
      } else {
        setVencimentos(mapped);
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Erro ao carregar",
        description: "Falha ao buscar vencimentos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (diasRestantes: number, diasAlerta: number, status: string) => {
    if (status === "concluido" || status === "pago") {
      return {
        label: status === "pago" ? "Pago" : "Concluído",
        bgColor: "bg-emerald-500/10",
        textColor: "text-emerald-400",
        borderColor: "border-emerald-500/30",
        icon: CheckCircle,
        badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500",
        iconName: "check_circle"
      };
    }
    if (status === "programado") {
      return {
        label: "Programado",
        bgColor: "bg-blue-500/10",
        textColor: "text-blue-400",
        borderColor: "border-blue-500/30",
        icon: Clock,
        badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500",
        iconName: "hourglass_top"
      };
    }
    if (diasRestantes < 0) {
      return {
        label: "Vencido",
        bgColor: "bg-red-500/10",
        textColor: "text-red-400",
        borderColor: "border-red-500/30",
        icon: AlertCircle,
        badgeClass: "bg-red-500/20 text-red-400 border-red-500",
        iconName: "priority_high"
      };
    }
    if (diasRestantes <= diasAlerta) {
      return {
        label: "Vencimento Próximo",
        bgColor: "bg-yellow-500/10",
        textColor: "text-yellow-400",
        borderColor: "border-yellow-500/30",
        icon: AlertTriangle,
        badgeClass: "bg-yellow-500/20 text-yellow-400 border-yellow-500",
        iconName: "hourglass_top"
      };
    }
    return {
      label: "Dentro do Prazo",
      bgColor: "bg-green-500/10",
      textColor: "text-green-400",
      borderColor: "border-green-500/30",
      icon: CheckCheck,
      badgeClass: "bg-green-500/20 text-green-400 border-green-500",
      iconName: "check_circle"
    };
  };

  const handleSaveManutencao = () => {
    loadVencimentos();
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setVencimentos(vencimentos.map(v => v.id === id ? { ...v, status: newStatus } : v));
    const statusLabels: Record<string, string> = {
      pendente: "Pendente",
      programado: "Programado",
      concluido: "Concluído",
      pago: "Pago"
    };
    toast({
      title: "Status atualizado",
      description: `Item marcado como ${statusLabels[newStatus]}`
    });
  };

  const handleUploadComprovante = async (file: File) => {
    if (!selectedVencimento) return;
    setUploading(true);
    try {
      const fileName = `${selectedVencimento.aeronaveId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("flight-documents")
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from("flight-documents")
        .getPublicUrl(fileName);
      
      setVencimentos(vencimentos.map(v => v.id === selectedVencimento.id ? {
        ...v,
        comprovanteUrl: urlData.publicUrl,
        status: "pago"
      } : v));
      
      toast({
        title: "Comprovante anexado",
        description: "Arquivo salvo com sucesso"
      });
      setUploadDialogOpen(false);
      setSelectedVencimento(null);
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro no upload",
        description: "Falha ao enviar arquivo",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const filteredVencimentos = useMemo(() => {
    return vencimentos.filter(v => {
      const matchesSearch = v.item.toLowerCase().includes(searchTerm.toLowerCase()) || v.aeronave.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesAeronave = selectedAeronave === "todas" || v.aeronaveId === selectedAeronave;
      const matchesTipo = v.tipo === activeTab;
      const temHoras = aeronavesComHoras.has(v.aeronaveId);
      return matchesSearch && matchesAeronave && matchesTipo && temHoras;
    });
  }, [vencimentos, searchTerm, selectedAeronave, activeTab, aeronavesComHoras]);

  const vencimentosPorAeronave = useMemo(() => {
    const grouped: Record<string, { aeronave: string; aeronaveId: string; vencimentos: Vencimento[] }> = {};
    filteredVencimentos.forEach(v => {
      if (!grouped[v.aeronaveId]) {
        grouped[v.aeronaveId] = { aeronaveId: v.aeronaveId, aeronave: v.aeronave, vencimentos: [] };
      }
      grouped[v.aeronaveId].vencimentos.push(v);
    });
    return Object.values(grouped).sort((a, b) => a.aeronave.localeCompare(b.aeronave));
  }, [filteredVencimentos]);

  const stats = useMemo(() => ({
    vencidos: filteredVencimentos.filter(v => v.diasRestantes < 0).length,
    proximos: filteredVencimentos.filter(v => v.diasRestantes > 0 && v.diasRestantes <= 30).length,
    dentroPrazo: filteredVencimentos.filter(v => v.diasRestantes > 30).length,
    total: new Set(filteredVencimentos.map(v => v.aeronaveId)).size
  }), [filteredVencimentos]);

  if (loading || isLoadingAeronaves) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Carregando...</span>
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
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] mix-blend-screen" />
        </div>

        <div className="relative z-10">
          {/* Sticky Header */}
          <header className="sticky top-0 z-40 w-full bg-slate-950/80 backdrop-blur-[12px] border-b border-white/5">
            <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10 group cursor-pointer hover:scale-105 transition-transform">
                  <Plane className="text-white text-xl" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white leading-tight">Controle de Vencimentos</h1>
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    Sistema Operacional
                  </div>
                </div>
              </div>
              <ManutencaoDialog onSave={handleSaveManutencao} mode="create" />
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
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
                    <span>→</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-[12px] border border-white/5 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:bg-slate-800/50 hover:border-white/10">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity pointer-events-none">
                  <Clock className="text-8xl text-yellow-400 transform -rotate-12" />
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">Próximos 30d</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white tracking-tight">{stats.proximos}</span>
                      <span className="text-sm text-gray-400 font-medium">itens</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                    <span>Requer atenção</span>
                    <span>→</span>
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
                      <span className="text-4xl font-bold text-white tracking-tight">{stats.dentroPrazo}</span>
                      <span className="text-sm text-gray-400 font-medium">itens</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                    <span>Regular</span>
                    <span>→</span>
                  </div>
                </div>
              </div>

              <button onClick={() => navigate("/aeronaves")} className="bg-gradient-to-br from-blue-500/10 to-slate-800 rounded-2xl p-6 border border-blue-500/20 relative overflow-hidden shadow-lg shadow-blue-900/10 group hover:shadow-blue-500/10 transition-all duration-300 w-full text-left hover:border-blue-500/40 hover:from-blue-500/20">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl" />
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Plane className="text-blue-400 text-sm" size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Aeronaves</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white tracking-tight">{aeronavesAtivas.length}</span>
                      <span className="text-sm text-gray-400 font-medium">em operação</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-blue-500/10 flex items-center justify-between text-xs text-blue-400/80 font-medium">
                    <span>Gerenciar frota</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </button>
            </div>

            {/* Navigation and Filters */}
            <div className="flex flex-col xl:flex-row gap-6 xl:items-end justify-between">
              <div className="flex-1 w-full space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <nav className="flex gap-6 border-b border-white/5 flex-1">
                    <button onClick={() => setActiveTab("manutencao")} className="relative pb-4 text-sm font-bold text-white flex items-center gap-2 group outline-none">
                      <span className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                        <Wrench size={18} />
                      </span>
                      Vencimentos
                      <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">{filteredVencimentos.filter(v => v.tipo === 'manutencao').length}</span>
                      {activeTab === "manutencao" && <span className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />}
                    </button>
                    <button onClick={() => setActiveTab("documento")} className={`relative pb-4 text-sm font-medium flex items-center gap-2 group transition-colors outline-none ${activeTab === "documento" ? "text-white" : "text-gray-400 hover:text-white"}`}>
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${activeTab === "documento" ? "bg-blue-500/10 text-blue-400" : "bg-white/5 text-gray-400 group-hover:text-gray-200 group-hover:bg-white/10"}`}>
                        <FileText size={18} />
                      </span>
                      Documentos
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${activeTab === "documento" ? "bg-blue-500 text-white" : "bg-white/10 text-gray-400 border border-white/5"}`}>{filteredVencimentos.filter(v => v.tipo === 'documento').length}</span>
                      {activeTab === "documento" && <span className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />}
                    </button>
                    <button onClick={() => setActiveTab("preventiva")} className={`relative pb-4 text-sm font-medium flex items-center gap-2 group transition-colors outline-none ${activeTab === "preventiva" ? "text-white" : "text-gray-400 hover:text-white"}`}>
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${activeTab === "preventiva" ? "bg-blue-500/10 text-blue-400" : "bg-white/5 text-gray-400 group-hover:text-gray-200 group-hover:bg-white/10"}`}>
                        <AlertTriangle size={18} />
                      </span>
                      Preventiva
                      {activeTab === "preventiva" && <span className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />}
                    </button>
                  </nav>
                  <div className="flex gap-2">
                    {activeTab === "manutencao" && <NovoVencimentoDialog onSave={loadVencimentos} />}
                    {activeTab === "documento" && <NovoDocumentoDialog onSave={loadVencimentos} />}
                    {activeTab === "preventiva" && <ManutencaoDialog onSave={loadVencimentos} mode="create" />}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                <div className="relative group min-w-[300px]">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="text-gray-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                  </span>
                  <input className="w-full pl-11 pr-4 py-2.5 bg-slate-800/60 border border-white/10 text-gray-200 placeholder-gray-500 rounded-xl focus:outline-none focus:border-blue-500/50 focus:bg-slate-800 transition-all text-sm font-medium" placeholder="Buscar item, descrição ou código..." type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="relative min-w-[220px]">
                  <select className="w-full pl-4 pr-10 py-2.5 bg-slate-800/60 border border-white/10 text-gray-200 rounded-xl focus:outline-none focus:border-blue-500/50 focus:bg-slate-800 appearance-none cursor-pointer text-sm font-medium transition-all" value={selectedAeronave} onChange={e => setSelectedAeronave(e.target.value)}>
                    <option value="todas">Todas as Aeronaves</option>
                    {aeronavesAtivas.map(a => <option key={a.id} value={a.id}>{a.registration} ({a.model})</option>)}
                  </select>
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">▼</span>
                  </span>
                </div>
                <button aria-label="Filters" className="bg-slate-800/60 hover:bg-slate-700 text-gray-400 hover:text-white px-3 py-2.5 rounded-xl border border-white/10 transition-colors flex items-center justify-center">
                  <span>⋮</span>
                </button>
              </div>
            </div>

            {/* Preventiva Tab */}
            {activeTab === "preventiva" ? (
              <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-[12px] overflow-hidden">
                <MaintenanceDashboard aircraftWithHours={aeronavesComHoras} />
              </div>
            ) : vencimentosPorAeronave.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 min-h-[450px] flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: "linear-gradient(rgb(148,163,184) 1px, transparent 1px), linear-gradient(to right, rgb(148,163,184) 1px, transparent 1px)",
                  backgroundSize: "32px 32px"
                }} />
                <div className="relative z-10 flex flex-col items-center max-w-md mx-auto text-center p-6">
                  <h3 className="text-xl font-bold text-white mb-2">Resultados filtrados</h3>
                  <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                    Nenhum item crítico encontrado para os filtros atuais. <br />
                    A segurança da sua frota está em conformidade.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button onClick={() => { setSearchTerm(""); setSelectedAeronave("todas"); }} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-300 bg-white/5 hover:bg-white/10 border border-white/5 transition-colors w-full sm:w-auto">
                      Limpar filtros
                    </button>
                    <button onClick={() => {}} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all w-full sm:w-auto">
                      Adicionar Registro
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                {vencimentosPorAeronave.map(grupo => {
                  const aeronaveData = aeronaves.find(a => a.id === grupo.aeronaveId);
                  return (
                    <div key={grupo.aeronaveId} className="rounded-2xl border border-white/5 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-[12px] overflow-hidden hover:border-white/10 transition-all shadow-xl flex flex-col">
                      {/* Aeronave Header Card */}
                      <div className="p-5 md:p-6 bg-gradient-to-r from-blue-500/10 via-transparent to-cyan-500/5 border-b border-white/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
                          <Plane size={80} className="text-blue-400" />
                        </div>

                        <div className="flex gap-4 items-start relative z-10">
                          {/* Aircraft Image Section - Compact */}
                          <div className="w-28 h-28 flex-shrink-0">
                            <div className="w-full h-full rounded-lg overflow-hidden border border-white/10 bg-slate-900/50 flex items-center justify-center">
                              {aeronaveData?.image_url ? (
                                <img
                                  src={aeronaveData.image_url}
                                  alt={grupo.aeronave}
                                  className="w-full h-full object-cover hover:scale-110 transition-transform duration-300 cursor-pointer"
                                  onClick={() => window.open(aeronaveData.image_url, '_blank')}
                                />
                              ) : (
                                <div className="flex items-center justify-center text-center">
                                  <Plane className="h-6 w-6 text-blue-400/40" />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Aircraft Info Section */}
                          <div className="flex-1 flex flex-col justify-center gap-2">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mb-1.5">Matrícula da Aeronave</p>
                              <h2 className="text-4xl font-extrabold text-white tracking-tight font-mono">
                                {grupo.aeronave && grupo.aeronave !== "-" ? grupo.aeronave : (aeronaveData?.registration || "N/A")}
                              </h2>
                              {grupo.aeronave === "-" && aeronaveData?.registration && (
                                <p className="text-xs text-blue-300 mt-1">Registrado: {aeronaveData.registration}</p>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-1">
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Modelo</p>
                                <p className="text-xs font-medium text-gray-200">{aeronaveData?.model || "-"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Fabricante</p>
                                <p className="text-xs font-medium text-gray-200">{aeronaveData?.manufacturer || "-"}</p>
                              </div>
                            </div>

                            {/* Status Badges */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {grupo.vencimentos.filter(v => v.diasRestantes < 0).length > 0 && (
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-2 py-0.5">
                                  <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                                  {grupo.vencimentos.filter(v => v.diasRestantes < 0).length}
                                </Badge>
                              )}
                              {grupo.vencimentos.filter(v => v.diasRestantes > 0 && v.diasRestantes <= 30).length > 0 && (
                                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] px-2 py-0.5">
                                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                  {grupo.vencimentos.filter(v => v.diasRestantes > 0 && v.diasRestantes <= 30).length}
                                </Badge>
                              )}
                              {grupo.vencimentos.filter(v => v.diasRestantes > 30).length > 0 && (
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-2 py-0.5">
                                  <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                                  {grupo.vencimentos.filter(v => v.diasRestantes > 30).length}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Vencimentos Grid */}
                      <div className="p-5 md:p-6 flex-1 flex flex-col">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-400" />
                          Vencimentos ({grupo.vencimentos.length})
                        </h3>

                        <div className="grid grid-cols-1 gap-3 flex-1">
                          {grupo.vencimentos.sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime()).map(vencimento => {
                            const info = getStatusInfo(vencimento.diasRestantes, vencimento.diasAlerta, vencimento.status);
                            const StatusIcon = info.icon;

                            return (
                              <div
                                key={vencimento.id}
                                className={`rounded-lg p-3 border backdrop-blur-sm transition-all hover:scale-[1.01] ${info.bgColor} ${info.borderColor} group cursor-default`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className={`p-1.5 rounded-md ${info.bgColor} group-hover:scale-110 transition-transform flex-shrink-0`}>
                                    <StatusIcon className={`h-4 w-4 ${info.textColor}`} />
                                  </div>
                                  <Badge className={`text-[10px] font-bold ${info.badgeClass}`}>
                                    {info.label}
                                  </Badge>
                                </div>

                                <div className="mb-2">
                                  <p className="font-semibold text-white text-xs line-clamp-1">{vencimento.item}</p>
                                  <div className="flex items-center gap-1 mt-1">
                                    <Calendar className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                    <span className="text-[10px] text-gray-400">
                                      {new Date(vencimento.dataVencimento).toLocaleDateString("pt-BR")}
                                    </span>
                                  </div>
                                </div>

                                <div className="bg-white/5 rounded-md p-2 mb-2">
                                  <p className={`text-lg font-bold ${info.textColor}`}>
                                    {vencimento.diasRestantes < 0 ? (
                                      <span className="text-red-400 text-sm">Vencido</span>
                                    ) : (
                                      <span>{vencimento.diasRestantes}<span className="text-xs">d</span></span>
                                    )}
                                  </p>
                                  {vencimento.diasRestantes >= 0 && (
                                    <p className="text-[10px] text-gray-400">dias</p>
                                  )}
                                </div>

                                <div className="flex gap-1 flex-wrap">
                                  {activeTab === "documento" && vencimento.status !== "pago" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="bg-slate-700/50 border-white/10 text-gray-300 hover:bg-slate-600 text-[10px] px-2 py-1 h-auto flex-1"
                                      onClick={() => {
                                        setSelectedVencimento(vencimento);
                                        setUploadDialogOpen(true);
                                      }}
                                    >
                                      <Upload className="h-3 w-3 mr-0.5" />
                                      Anexar
                                    </Button>
                                  )}

                                  {vencimento.comprovanteUrl && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="bg-slate-700/50 border-white/10 text-gray-300 hover:bg-slate-600 text-[10px] px-2 py-1 h-auto flex-1"
                                      onClick={() => {
                                        console.log('📖 Abrindo documento:', {
                                          name: vencimento.item,
                                          url: vencimento.comprovanteUrl,
                                          fileType: vencimento.fileType
                                        });
                                        setDocumentToView({
                                          url: vencimento.comprovanteUrl!,
                                          name: vencimento.item,
                                          fileType: vencimento.fileType || "application/pdf"
                                        });
                                        setViewDocumentOpen(true);
                                      }}
                                    >
                                      <Eye className="h-3 w-3 mr-0.5" />
                                      Ver
                                    </Button>
                                  )}

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className={`${info.bgColor} ${info.textColor} ${info.borderColor} border text-[10px] px-2 py-1 h-auto flex-1`}
                                      >
                                        <Clock className="h-3 w-3 mr-0.5" />
                                        Status
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="bg-slate-800 border-white/10">
                                      <DropdownMenuItem className="text-gray-300 focus:bg-slate-700 text-sm" onClick={() => handleStatusChange(vencimento.id, "pendente")}>
                                        <Clock className="h-4 w-4 mr-2" />
                                        Pendente
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-gray-300 focus:bg-slate-700 text-sm" onClick={() => handleStatusChange(vencimento.id, "programado")}>
                                        <AlertTriangle className="h-4 w-4 mr-2" />
                                        Programado
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-gray-300 focus:bg-slate-700 text-sm" onClick={() => handleStatusChange(vencimento.id, activeTab === "documento" ? "pago" : "concluido")}>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        {activeTab === "documento" ? "Pago" : "Concluído"}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Upload className="h-5 w-5 text-blue-400" />
              Anexar Comprovante de Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              {selectedVencimento?.item} - {selectedVencimento?.aeronave}
            </p>
            <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center">
              <input type="file" accept="image/*,.pdf" className="hidden" id="comprovante-upload" onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleUploadComprovante(file);
              }} />
              <label htmlFor="comprovante-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-gray-500" />
                <span className="text-sm text-gray-400">
                  {uploading ? "Enviando..." : "Clique para selecionar arquivo"}
                </span>
                <span className="text-xs text-gray-500">
                  PDF ou imagem (max 10MB)
                </span>
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Viewer Dialog */}
      <Dialog open={viewDocumentOpen} onOpenChange={setViewDocumentOpen}>
        <DialogContent className="w-[95vw] max-w-5xl h-[90vh] bg-slate-900 border-white/10 flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b border-white/10 flex-shrink-0">
            <DialogTitle className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <span className="truncate">{documentToView?.name}</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-gray-400 hover:text-white hover:bg-slate-700 flex-shrink-0 ml-2"
                onClick={() => setViewDocumentOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-6">
            {documentToView && (
              (() => {
                const url = documentToView.url.toLowerCase();
                const isImage = url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)/i);
                
                if (isImage) {
                  return (
                    <div className="flex flex-col items-center justify-center h-full">
                      <img 
                        src={documentToView.url} 
                        alt={documentToView.name} 
                        className="max-w-full max-h-[70vh] object-contain rounded-lg"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const sibling = e.currentTarget.nextElementSibling;
                          if (sibling) sibling.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden text-center text-gray-400">
                        <p>Não foi possível carregar a imagem</p>
                        <Button 
                          variant="outline" 
                          className="mt-4"
                          onClick={() => window.open(documentToView.url, "_blank")}
                        >
                          Abrir em nova aba
                        </Button>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <DocumentViewer
                    url={documentToView.url}
                    fileName={documentToView.name}
                    fileType="application/pdf"
                    onDownload={() => window.open(documentToView.url, "_blank")}
                  />
                );
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
