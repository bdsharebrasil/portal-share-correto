import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  Plane,
  AlertCircle,
  CheckCheck,
  AlertTriangle,
  Clock,
  CheckCircle,
  Plus,
  Calendar,
  Wrench,
  FileText,
  Upload,
  Eye,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useAeronaves } from "@/hooks/useAeronaves";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

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
  const { aeronaves, isLoadingAeronaves } = useAeronaves();

  const [vencimentos, setVencimentos] = useState<Vencimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAeronave, setSelectedAeronave] = useState<string>("todas");
  const [activeTab, setActiveTab] = useState<"manutencao" | "documento">("manutencao");

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedVencimento, setSelectedVencimento] = useState<Vencimento | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    aeronaveId: "",
    item: "",
    dataVencimento: "",
    periodoTipo: "dias",
    periodoValor: "",
    diasAlerta: "30",
  });

  // Aeronaves ativas para seleção - corrigindo o filtro
  const aeronavesAtivas = useMemo(() => {
    return aeronaves.filter((a) =>
      a.status?.toLowerCase() === "ativa" ||
      a.status?.toLowerCase() === "ativo"
    );
  }, [aeronaves]);

  const selectedAeronaveData = aeronavesAtivas.find((a) => a.id === formData.aeronaveId);

  useEffect(() => {
    loadVencimentos();
  }, [toast]);

  const loadVencimentos = async () => {
    setLoading(true);
    try {
      const { fetchManutencoesWithAircraft } = await import("@/services/manutencoes");
      const rows = await fetchManutencoesWithAircraft();
      const today = new Date().getTime();

      const mapped = rows.map((m) => {
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
          status:
            m.etapa === "concluida"
              ? "concluido"
              : m.etapa === "em_andamento"
                ? "programado"
                : "pendente",
          tipo: "manutencao" as const,
        };
      });

      setVencimentos(mapped);
    } catch (e) {
      console.error(e);
      toast({
        title: "Erro ao carregar",
        description: "Falha ao buscar vencimentos.",
        variant: "destructive",
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
      };
    }
    if (status === "programado") {
      return {
        label: "Programado",
        bgColor: "bg-primary/10",
        textColor: "text-primary",
        borderColor: "border-primary/30",
        icon: Clock,
      };
    }
    if (diasRestantes < 0) {
      return {
        label: "Vencido",
        bgColor: "bg-destructive/10",
        textColor: "text-destructive",
        borderColor: "border-destructive/30",
        icon: AlertCircle,
      };
    }
    if (diasRestantes <= diasAlerta) {
      return {
        label: "Vencimento Próximo",
        bgColor: "bg-warning/10",
        textColor: "text-warning",
        borderColor: "border-warning/30",
        icon: AlertTriangle,
      };
    }
    return {
      label: "Dentro do Prazo",
      bgColor: "bg-success/10",
      textColor: "text-success",
      borderColor: "border-success/30",
      icon: CheckCheck,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.aeronaveId || !formData.item || !formData.dataVencimento) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const aeronave = aeronavesAtivas.find((a) => a.id === formData.aeronaveId);
    const today = new Date().getTime();
    const dt = new Date(formData.dataVencimento).getTime();
    const diasRestantes = Math.ceil((dt - today) / (1000 * 60 * 60 * 24));

    if (activeTab === "manutencao") {
      // Criar manutenção usando o service
      try {
        const { createManutencao } = await import("@/services/manutencoes");
        await createManutencao({
          aeronave_id: formData.aeronaveId,
          tipo: formData.item,
          data_programada: formData.dataVencimento,
          descricao: `Periodicidade: ${formData.periodoValor} ${formData.periodoTipo}`,
          etapa: "pendente",
        });

        toast({
          title: "Manutenção programada",
          description: `Manutenção agendada para ${aeronave?.registration}`,
        });

        loadVencimentos();
      } catch (error) {
        toast({
          title: "Erro",
          description: "Falha ao criar manutenção",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Para documentos, criar localmente por agora
      const novoVencimento: Vencimento = {
        id: Date.now().toString(),
        aeronaveId: formData.aeronaveId,
        aeronave: aeronave?.registration || "",
        item: formData.item,
        dataVencimento: formData.dataVencimento,
        diasAlerta: parseInt(formData.diasAlerta),
        status: "pendente",
        diasRestantes,
        tipo: "documento",
      };

      setVencimentos([...vencimentos, novoVencimento]);

      toast({
        title: "Documento cadastrado",
        description: `Vencimento de documento adicionado para ${aeronave?.registration}`,
      });
    }

    setFormData({
      aeronaveId: "",
      item: "",
      dataVencimento: "",
      periodoTipo: "dias",
      periodoValor: "",
      diasAlerta: "30",
    });
    setDialogOpen(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setVencimentos(
      vencimentos.map((v) => (v.id === id ? { ...v, status: newStatus } : v))
    );

    const statusLabels: Record<string, string> = {
      pendente: "Pendente",
      programado: "Programado",
      concluido: "Concluído",
      pago: "Pago",
    };

    toast({
      title: "Status atualizado",
      description: `Item marcado como ${statusLabels[newStatus]}`,
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

      setVencimentos(
        vencimentos.map((v) =>
          v.id === selectedVencimento.id
            ? { ...v, comprovanteUrl: urlData.publicUrl, status: "pago" }
            : v
        )
      );

      toast({
        title: "Comprovante anexado",
        description: "Arquivo salvo com sucesso",
      });

      setUploadDialogOpen(false);
      setSelectedVencimento(null);
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro no upload",
        description: "Falha ao enviar arquivo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const filteredVencimentos = useMemo(() => {
    return vencimentos.filter((v) => {
      const matchesSearch =
        v.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.aeronave.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAeronave =
        selectedAeronave === "todas" || v.aeronaveId === selectedAeronave;

      const matchesTipo = v.tipo === activeTab;

      return matchesSearch && matchesAeronave && matchesTipo;
    });
  }, [vencimentos, searchTerm, selectedAeronave, activeTab]);

  const vencimentosPorAeronave = useMemo(() => {
    const grouped: Record<string, { aeronave: string; aeronaveId: string; vencimentos: Vencimento[] }> = {};

    filteredVencimentos.forEach((v) => {
      if (!grouped[v.aeronaveId]) {
        grouped[v.aeronaveId] = {
          aeronaveId: v.aeronaveId,
          aeronave: v.aeronave,
          vencimentos: [],
        };
      }
      grouped[v.aeronaveId].vencimentos.push(v);
    });

    return Object.values(grouped).sort((a, b) => a.aeronave.localeCompare(b.aeronave));
  }, [filteredVencimentos]);

  const stats = useMemo(() => ({
    vencidos: filteredVencimentos.filter((v) => v.diasRestantes < 0).length,
    proximos: filteredVencimentos.filter((v) => v.diasRestantes > 0 && v.diasRestantes <= 30).length,
    dentroPrazo: filteredVencimentos.filter((v) => v.diasRestantes > 30).length,
    total: new Set(filteredVencimentos.map((v) => v.aeronaveId)).size,
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
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Controle de Vencimentos
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gerencie manutenções e documentos das aeronaves
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {activeTab === "manutencao" ? "Programar Manutenção" : "Agendar Documento"}
                </span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] p-0">
              <DialogHeader className="p-4 md:p-6 pb-0">
                <DialogTitle className="text-lg flex items-center gap-2">
                  {activeTab === "manutencao" ? (
                    <>
                      <Wrench className="h-5 w-5 text-primary" />
                      Programar Manutenção
                    </>
                  ) : (
                    <>
                      <FileText className="h-5 w-5 text-primary" />
                      Agendar Pagamento de Documento
                    </>
                  )}
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="max-h-[calc(90vh-100px)]">
                <form onSubmit={handleSubmit} className="p-4 md:p-6 pt-4 space-y-4">
                  {/* Seleção de Aeronave */}
                  <div className="space-y-2">
                    <Label>Selecionar Aeronave Ativa *</Label>
                    <Select
                      value={formData.aeronaveId}
                      onValueChange={(value) => setFormData({ ...formData, aeronaveId: value })}
                    >
                      <SelectTrigger className="bg-card">
                        <SelectValue placeholder="Escolha uma aeronave" />
                      </SelectTrigger>
                      <SelectContent>
                        {aeronavesAtivas.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            Nenhuma aeronave ativa cadastrada
                          </div>
                        ) : (
                          aeronavesAtivas.map((aero) => (
                            <SelectItem key={aero.id} value={aero.id}>
                              <div className="flex items-center gap-2">
                                <Plane className="h-4 w-4 text-primary" />
                                <span className="font-medium">{aero.registration}</span>
                                <span className="text-muted-foreground">- {aero.model}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {selectedAeronaveData && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <Plane className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">{selectedAeronaveData.registration}</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedAeronaveData.manufacturer} {selectedAeronaveData.model}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Nome do Item */}
                  <div className="space-y-2">
                    <Label htmlFor="item">
                      {activeTab === "manutencao" ? "Tipo de Manutenção *" : "Nome do Documento *"}
                    </Label>
                    <Input
                      id="item"
                      placeholder={activeTab === "manutencao"
                        ? "Ex: Inspeção 100h, Revisão Geral..."
                        : "Ex: CVA, Seguro, RETA..."
                      }
                      className="bg-card"
                      value={formData.item}
                      onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                    />
                  </div>

                  {/* Data de Vencimento */}
                  <div className="space-y-2">
                    <Label htmlFor="dataVencimento">
                      {activeTab === "manutencao" ? "Data Programada *" : "Data de Vencimento *"}
                    </Label>
                    <Input
                      id="dataVencimento"
                      type="date"
                      className="bg-card"
                      value={formData.dataVencimento}
                      onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })}
                    />
                  </div>

                  {/* Período e Valor - apenas para manutenção */}
                  {activeTab === "manutencao" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Tipo de Período</Label>
                        <Select
                          value={formData.periodoTipo}
                          onValueChange={(value) => setFormData({ ...formData, periodoTipo: value })}
                        >
                          <SelectTrigger className="bg-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="horas">Horas de Voo</SelectItem>
                            <SelectItem value="dias">Dias Corridos</SelectItem>
                            <SelectItem value="meses">Meses</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="periodoValor">Periodicidade</Label>
                        <Input
                          id="periodoValor"
                          type="number"
                          placeholder="Ex: 50, 100"
                          className="bg-card"
                          value={formData.periodoValor}
                          onChange={(e) => setFormData({ ...formData, periodoValor: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Dias de Alerta */}
                  <div className="space-y-2">
                    <Label>Alertar com antecedência de</Label>
                    <Select
                      value={formData.diasAlerta}
                      onValueChange={(value) => setFormData({ ...formData, diasAlerta: value })}
                    >
                      <SelectTrigger className="bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 dias</SelectItem>
                        <SelectItem value="15">15 dias</SelectItem>
                        <SelectItem value="30">30 dias</SelectItem>
                        <SelectItem value="60">60 dias</SelectItem>
                        <SelectItem value="90">90 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Botões */}
                  <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1">
                      {activeTab === "manutencao" ? "Programar" : "Agendar"}
                    </Button>
                  </div>
                </form>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "manutencao" | "documento")}>
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-card/50">
            <TabsTrigger value="manutencao" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Wrench className="h-4 w-4" />
              Manutenção
            </TabsTrigger>
            <TabsTrigger value="documento" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="h-4 w-4" />
              Documentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-destructive">{stats.vencidos}</p>
                    <p className="text-xs text-muted-foreground">Vencidos</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-warning/5 border border-warning/20 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning">{stats.proximos}</p>
                    <p className="text-xs text-muted-foreground">Próximos 30d</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-success/5 border border-success/20 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <CheckCheck className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{stats.dentroPrazo}</p>
                    <p className="text-xs text-muted-foreground">Em dia</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Plane className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Aeronaves</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar item ou aeronave..."
                  className="pl-10 bg-card border-border"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={selectedAeronave} onValueChange={setSelectedAeronave}>
                <SelectTrigger className="w-full md:w-[250px] bg-card border-border">
                  <SelectValue placeholder="Aeronave" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as aeronaves</SelectItem>
                  {aeronavesAtivas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.registration} - {a.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lista de Vencimentos */}
            {vencimentosPorAeronave.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-card/50 border border-border/50">
                {activeTab === "manutencao" ? (
                  <Wrench className="h-12 w-12 text-muted-foreground/50 mb-4" />
                ) : (
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                )}
                <p className="text-muted-foreground text-center">
                  {activeTab === "manutencao"
                    ? "Nenhuma manutenção programada."
                    : "Nenhum documento cadastrado."
                  }
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {activeTab === "manutencao" ? "Programar Manutenção" : "Agendar Documento"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {vencimentosPorAeronave.map((grupo) => (
                  <div
                    key={grupo.aeronaveId}
                    className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden"
                  >
                    {/* Header da Aeronave */}
                    <div className="px-4 py-3 md:px-6 md:py-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Plane className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground text-lg">{grupo.aeronave}</h3>
                            <p className="text-xs text-muted-foreground">
                              {grupo.vencimentos.length} {activeTab === "manutencao" ? "manutenção" : "documento"}
                              {grupo.vencimentos.length !== 1 ? (activeTab === "manutencao" ? "ões" : "s") : ""}
                            </p>
                          </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                          {grupo.vencimentos.filter((v) => v.diasRestantes < 0).length > 0 && (
                            <Badge className="bg-destructive/10 text-destructive border-destructive/30">
                              {grupo.vencimentos.filter((v) => v.diasRestantes < 0).length} vencido
                            </Badge>
                          )}
                          {grupo.vencimentos.filter((v) => v.diasRestantes > 0 && v.diasRestantes <= 30).length > 0 && (
                            <Badge className="bg-warning/10 text-warning border-warning/30">
                              {grupo.vencimentos.filter((v) => v.diasRestantes > 0 && v.diasRestantes <= 30).length} próximo
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Lista de Vencimentos */}
                    <div className="divide-y divide-border/30">
                      {grupo.vencimentos
                        .sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime())
                        .map((vencimento) => {
                          const info = getStatusInfo(vencimento.diasRestantes, vencimento.diasAlerta, vencimento.status);
                          const StatusIcon = info.icon;

                          return (
                            <div
                              key={vencimento.id}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-accent/5 transition-colors`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`p-2 rounded-lg ${info.bgColor}`}>
                                  <StatusIcon className={`h-4 w-4 ${info.textColor}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-foreground truncate">{vencimento.item}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(vencimento.dataVencimento).toLocaleDateString("pt-BR")}
                                    </span>
                                    {vencimento.comprovanteUrl && (
                                      <Badge variant="outline" className="text-xs">
                                        <Upload className="h-3 w-3 mr-1" />
                                        Comprovante
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3">
                                <div className="text-right">
                                  <p className={`font-bold ${info.textColor}`}>
                                    {vencimento.diasRestantes < 0 ? "Vencido" : `${vencimento.diasRestantes}d`}
                                  </p>
                                  {vencimento.diasRestantes >= 0 && (
                                    <p className="text-xs text-muted-foreground">restantes</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {activeTab === "documento" && vencimento.status !== "pago" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedVencimento(vencimento);
                                        setUploadDialogOpen(true);
                                      }}
                                    >
                                      <Upload className="h-4 w-4" />
                                    </Button>
                                  )}

                                  {vencimento.comprovanteUrl && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.open(vencimento.comprovanteUrl, "_blank")}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  )}

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className={`${info.bgColor} ${info.textColor} ${info.borderColor} border hover:opacity-80`}
                                      >
                                        {info.label}
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleStatusChange(vencimento.id, "pendente")}>
                                        <Clock className="h-4 w-4 mr-2" />
                                        Pendente
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleStatusChange(vencimento.id, "programado")}>
                                        <AlertTriangle className="h-4 w-4 mr-2" />
                                        Programado
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleStatusChange(vencimento.id, activeTab === "documento" ? "pago" : "concluido")}>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        {activeTab === "documento" ? "Pago" : "Concluído"}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Anexar Comprovante de Pagamento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedVencimento?.item} - {selectedVencimento?.aeronave}
              </p>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  id="comprovante-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadComprovante(file);
                  }}
                />
                <label
                  htmlFor="comprovante-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? "Enviando..." : "Clique para selecionar arquivo"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    PDF ou imagem (max 10MB)
                  </span>
                </label>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
