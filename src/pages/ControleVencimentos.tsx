import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { VencimentoDialog } from "@/components/vencimentos/VencimentoDialog";
import { AircraftMaintenanceCard } from "@/components/vencimentos/AircraftMaintenanceCard";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useAeronaves } from "@/hooks/useAeronaves";
import { useClientes } from "@/hooks/useClientes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Vencimento {
  id: string;
  item: string;
  aeronave: string;
  aeronaveId: string;
  clienteId?: string;
  dataVencimento: string;
  diasRestantes: number;
  diasAlerta: number;
  status: string;
  periodoTipo: string;
  periodoValor: any;
}

interface VencimentosPorAeronave {
  aeronaveId: string;
  aeronave: string;
  vencimentos: Vencimento[];
}

export default function ControleVencimentos() {
  const { toast } = useToast();
  const { aeronaves } = useAeronaves();
  const { clientes } = useClientes();

  const [vencimentos, setVencimentos] = useState<Vencimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<string>("todos");
  const [selectedAeronave, setSelectedAeronave] = useState<string>("todas");

  useEffect(() => {
    const load = async () => {
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
            periodoTipo: "dias",
            periodoValor: null,
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
    load();
  }, [toast]);

  const getStatusInfo = (diasRestantes: number, diasAlerta: number, status: string) => {
    if (status === "concluido") {
      return {
        label: "Concluído",
        color: "bg-emerald-500/20 text-emerald-600 border-emerald-300",
        icon: CheckCircle,
        severity: "normal",
        colorClass: "text-emerald-600",
      };
    }
    if (status === "programado") {
      return {
        label: "Programado",
        color: "bg-blue-500/20 text-blue-600 border-blue-300",
        icon: Clock,
        severity: "atencao",
        colorClass: "text-blue-600",
      };
    }
    if (diasRestantes < 0) {
      return {
        label: "Vencido",
        color: "bg-red-500/20 text-red-600 border-red-300",
        icon: AlertCircle,
        severity: "urgente",
        colorClass: "text-red-600",
      };
    }
    if (diasRestantes <= diasAlerta) {
      return {
        label: "Vencimento Próximo",
        color: "bg-yellow-500/20 text-yellow-600 border-yellow-300",
        icon: AlertTriangle,
        severity: "urgente",
        colorClass: "text-yellow-600",
      };
    }
    if (diasRestantes > 60) {
      return {
        label: "Dentro do Prazo",
        color: "bg-green-500/20 text-green-600 border-green-300",
        icon: CheckCheck,
        severity: "normal",
        colorClass: "text-green-600",
      };
    }
    return {
      label: "Normal",
      color: "bg-blue-500/20 text-blue-600 border-blue-300",
      icon: Clock,
      severity: "normal",
      colorClass: "text-blue-600",
    };
  };

  const handleAddVencimento = (_novoVencimento: any) => {
    // Integração de criação via Supabase pode ser adicionada depois.
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    setVencimentos(
      vencimentos.map((v: any) => (v.id === id ? { ...v, status: newStatus } : v))
    );

    const statusLabels: Record<string, string> = {
      pendente: "Pendente",
      programado: "Programado",
      concluido: "Concluído",
    };

    toast({
      title: "Status atualizado",
      description: `Manutenção marcada como ${statusLabels[newStatus]}`,
    });
  };

  // Filtrar vencimentos baseado em cliente e aeronave
  const filteredVencimentos = useMemo(() => {
    return vencimentos.filter((v) => {
      const matchesSearch =
        v.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.aeronave.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAeronave =
        selectedAeronave === "todas" || v.aeronaveId === selectedAeronave;

      // Se cliente foi selecionado, verificar se a aeronave pertence a ele
      let matchesCliente = true;
      if (selectedCliente !== "todos") {
        const cliente = clientes.find((c) => c.id === selectedCliente);
        if (cliente && cliente.client_aircraft) {
          const aircraftIds = cliente.client_aircraft.map((ca) => ca.aircraft_id);
          matchesCliente = aircraftIds.includes(v.aeronaveId);
        }
      }

      return matchesSearch && matchesAeronave && matchesCliente;
    });
  }, [vencimentos, searchTerm, selectedAeronave, selectedCliente, clientes]);

  // Agrupar vencimentos por aeronave
  const vencimentosPorAeronave = useMemo(() => {
    const grouped: Record<string, VencimentosPorAeronave> = {};

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

  const getCountByStatus = (severity: string) => {
    return filteredVencimentos.filter((v) => {
      const info = getStatusInfo(v.diasRestantes, v.diasAlerta, v.status);
      return info.severity === severity;
    }).length;
  };

  const getTotalAeronaves = () => {
    return new Set(filteredVencimentos.map((v) => v.aeronaveId)).size;
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <span className="text-muted-foreground">Carregando vencimentos...</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Controle de Vencimentos
            </h1>
            <p className="text-muted-foreground">
              Gerencie os vencimentos de certificados, inspeções e documentos das aeronaves
            </p>
          </div>
          <VencimentoDialog onAdd={handleAddVencimento} />
        </div>

        {/* Estatísticas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10 border-red-200 dark:border-red-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">
                Vencidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {filteredVencimentos.filter((v) => v.diasRestantes < 0).length}
              </div>
              <p className="text-xs text-red-600/70 mt-1">Ação imediata</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 border-yellow-200 dark:border-yellow-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                Próximos Vencimentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {filteredVencimentos.filter((v) => v.diasRestantes > 0 && v.diasRestantes <= 30).length}
              </div>
              <p className="text-xs text-yellow-600/70 mt-1">Até 30 dias</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200 dark:border-green-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
                Dentro do Prazo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {filteredVencimentos.filter((v) => v.diasRestantes > 60).length}
              </div>
              <p className="text-xs text-green-600/70 mt-1">Acima de 60 dias</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
                Aeronaves Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{getTotalAeronaves()}</div>
              <p className="text-xs text-blue-600/70 mt-1">Com vencimentos</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Filtrar por Cliente
            </label>
            <Select value={selectedCliente} onValueChange={setSelectedCliente}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os clientes</SelectItem>
                {clientes.map((cliente) => (
                  <SelectItem key={cliente.id} value={cliente.id}>
                    {cliente.company_name || "Cliente"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Filtrar por Aeronave
            </label>
            <Select value={selectedAeronave} onValueChange={setSelectedAeronave}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma aeronave" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as aeronaves</SelectItem>
                {aeronaves.map((aero) => (
                  <SelectItem key={aero.id} value={aero.id}>
                    {aero.registration} - {aero.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por item ou aeronave..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Listagem por Aeronave */}
        {vencimentosPorAeronave.length === 0 ? (
          <Card className="bg-gradient-card border-border shadow-card">
            <CardContent className="py-12 flex flex-col items-center justify-center">
              <Plane className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground text-center">
                Nenhuma aeronave com vencimentos encontrada.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {vencimentosPorAeronave.map((grupo) => (
              <AircraftMaintenanceCard
                key={grupo.aeronaveId}
                aeronave={grupo.aeronave}
                aeronaveId={grupo.aeronaveId}
                vencimentos={grupo.vencimentos}
                onStatusChange={handleStatusChange}
                getStatusInfo={getStatusInfo}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
