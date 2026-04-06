import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAerodromes } from "@/hooks/useAerodromes";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Download, Edit, Trash2, ChevronLeft, Plane, TrendingUp, FileUp, X, Eye, FileText, Image as ImageIcon, FileCheck, DollarSign, BookOpen, Calendar as CalendarIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Combobox } from "@/components/ui/combobox";
import { AerodromeCombobox } from "@/components/plano-voo/AerodromeCombobox";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModernFileUpload } from "@/components/ui/modern-file-upload";
import { ExportFuelRecordsModal } from "./ExportFuelRecordsModal";
interface Client {
  id: string;
  razao_social: string;
}
interface Aircraft {
  id: string;
  registration: string;
  year: number | null;
}
interface Partner {
  id: string;
  nome: string;
  cpf?: string;
  isMainClient?: boolean;
  percentual_participacao?: number;
}
interface FuelRecord {
  id: string;
  data: string;
  trecho: string | null;
  local: string | null;
  comanda: string;
  litros: number;
  valor_unitario: number;
  valor_total: number;
  abastecimento_galoes: number | null;
  comanda_url: string | null;
  nota_url: string | null;
  boleto_url: string | null;
  abastecedor?: string | null;
  client_id?: string | null;
  status_pagamento?: string | null;
  tipo_faturamento?: string | null;
  observacao?: string | null;
  nf?: string | null;
  partner_name?: string | null;
  comprovante_pagamento?: string | null;
  data_pagamento?: string | null;
  tipo_combustivel?: string | null;
  descricao?: string | null;
  banco?: string | null;
}
interface FuelSupplier {
  id: string;
  nome_fornecedor: string;
  nome_cidade: string;
  codigo_icao: string;
  preco_avgas?: number | null;
  preco_jet?: number | null;
}
interface Props {
  client: Client;
  aircraft: Aircraft;
  onBack: () => void;
  selectedAbastecimentoId?: string | null;
}

/**
 * Converte um objeto de erro do Supabase para uma mensagem de string legível
 */
const getErrorMessage = (error: any): string => {
  if (!error) return "Erro desconhecido";

  // Se é uma string, retorna diretamente
  if (typeof error === "string") return error;

  // Tenta extrair mensagem dos campos conhecidos do erro do Supabase
  if (error.message && typeof error.message === "string") return error.message;
  if (error.hint && typeof error.hint === "string") return error.hint;
  if (error.details && typeof error.details === "string") return error.details;

  // Se details é um objeto, tenta converter
  if (error.details && typeof error.details === "object") {
    try {
      return JSON.stringify(error.details);
    } catch {
      return "Erro nos detalhes da resposta";
    }
  }

  // Último recurso: converte para string
  try {
    return String(error);
  } catch {
    return "Erro ao processar";
  }
};

/**
 * Format date avoiding timezone shifts for Brazil (UTC-3)
 * Handles both ISO timestamps and date-only strings
 */
const formatDateBrazil = (dateValue: string | Date | null | undefined, formatStr: string = "dd/MM/yyyy"): string => {
  if (!dateValue) return "—";

  let dateObj: Date;

  try {
    if (typeof dateValue === 'string') {
      if (!dateValue.trim()) return "—";

      // Date-only string (YYYY-MM-DD)
      if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateValue.split('-').map(Number);
        dateObj = new Date(year, month - 1, day);
      } else {
        // ISO timestamp — extract only the date part
        const datePart = dateValue.split('T')[0];
        if (!datePart || !datePart.match(/^\d{4}-\d{2}-\d{2}$/)) return "—";
        const [year, month, day] = datePart.split('-').map(Number);
        dateObj = new Date(year, month - 1, day);
      }
    } else {
      dateObj = dateValue;
    }

    // Guard against invalid Date objects
    if (isNaN(dateObj.getTime())) return "—";

    return format(dateObj, formatStr);
  } catch {
    return "—";
  }
};

/**
 * Calculate previous day date safely from a YYYY-MM-DD string
 */
const getPreviousDay = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);

  const prevYear = date.getFullYear();
  const prevMonth = String(date.getMonth() + 1).padStart(2, '0');
  const prevDay = String(date.getDate()).padStart(2, '0');

  return `${prevYear}-${prevMonth}-${prevDay}`;
};
export function FuelRecordsByAircraft({
  client,
  aircraft,
  onBack,
  selectedAbastecimentoId
}: Props) {
  const { user } = useAuth();
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [suppliers, setSuppliers] = useState<FuelSupplier[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [clientPartners, setClientPartners] = useState<Partner[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FuelRecord | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterPartner, setFilterPartner] = useState<string>("all");
  const [searchText, setSearchText] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [currentClientId, setCurrentClientId] = useState<string>(client.id);

  const [displayClient, setDisplayClient] = useState<Client>(client);

  // Logbook flight linking state
  const [linkToLogbook, setLinkToLogbook] = useState(false);
  const [logbookFlights, setLogbookFlights] = useState<any[]>([]);
  const [selectedFlightId, setSelectedFlightId] = useState<string>("");
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { aerodromes, isLoadingAerodromes } = useAerodromes();
  const [bankInstitutions, setBankInstitutions] = useState<{id:string;label:string;}[]>([]);

  // State para rastrear informações do voo selecionado e do dia anterior
  const [selectedFlightInfo, setSelectedFlightInfo] = useState<any>(null);
  const [previousDayFlightInfo, setPreviousDayFlightInfo] = useState<any>(null);
  const [showConfirmationSummary, setShowConfirmationSummary] = useState(false);

  const [formData, setFormData] = useState({
    data: "",
    trecho: "",
    local: "",
    origem_aerodromo: "",
    destino_aerodromo: "",
    comanda: "",
    litros: "",
    valor_unitario: "",
    valor_total: "",
    valor_total_manual: false,
    abastecimento_galoes: "",
    abastecedor_id: "",
    combustivel_tipo: "",
    client_id: "",
    partner_selected: "",
    status_pagamento: "em aberto",
    tipo_faturamento: "",
    banco: "",
    data_vencimento_boleto: "",
    observacao: "",
    nf: "",
    comanda_file: null as File | null,
    nota_file: null as File | null,
    boleto_file: null as File | null,
    comprovante_file: null as File | null,
    comanda_url: "",
    nota_url: "",
    boleto_url: "",
    comprovante_url: "",
    data_pagamento: ""
  });
  const [uploadedFiles, setUploadedFiles] = useState({
    comanda_url: "",
    nota_url: "",
    boleto_url: "",
    comprovante_url: ""
  });
  const [viewingAttachment, setViewingAttachment] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Load current user name for criado_por
  useEffect(() => {
    const loadUserName = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (data?.full_name) setCurrentUserName(data.full_name);
    };
    loadUserName();
  }, [user?.id]);

  // Load logbook flights when linking is enabled
  useEffect(() => {
    if (linkToLogbook && aeronave.id) {
      loadLogbookFlights();
    }
  }, [linkToLogbook, aeronave.id, formData.cliente_id]);

  const loadLogbookFlights = async () => {
    setLoadingFlights(true);
    try {
      // Get IDs of flights already linked to abastecimentos
      const { data: linkedAbast } = await supabase
        .from('abastecimentos')
        .select('logbook_entry_id')
        .eq('id_aeronave', aeronave.id)
        .not('logbook_entry_id', 'is', null);

      const linkedIds = (linkedAbast || []).map(a => a.logbook_entry_id).filter(Boolean);

      // Get flights with fuel_added > 0 for this aircraft
      let query = supabase
        .from('logbook_entries')
        .select('id, entry_date, departure_aerodrome, arrival_aerodrome, trecho, fuel_added, fuel_liters, client_id, total_time')
        .eq('id_aeronave', aeronave.id)
        .gt('fuel_added', 0)
        .order('entry_date', { ascending: false })
        .limit(50);

      // Filter by client if selected
      const effectiveClientId = formData.cliente_id || client.id;
      if (effectiveClientId) {
        query = query.eq('cliente_id', effectiveClientId);
      }

      const { data: flights, error } = await query;

      if (error) {
        console.error('Error loading logbook flights:', error);
        setLogbookFlights([]);
        return;
      }

      // Filter out already linked flights
      const availableFlights = (flights || []).filter(f => !linkedIds.includes(f.id));
      setLogbookFlights(availableFlights);
    } catch (err) {
      console.error('Error loading logbook flights:', err);
      setLogbookFlights([]);
    } finally {
      setLoadingFlights(false);
    }
  };

  const handleFlightSelect = async (flightId: string) => {
    setSelectedFlightId(flightId);
    const flight = logbookFlights.find(f => f.id === flightId);
    if (flight) {
      const trecho = flight.trecho || `${flight.departure_aerodrome} x ${flight.arrival_aerodrome}`;
      setSelectedFlightInfo(flight);

      // Armazena informações do voo selecionado
      setFormData(prev => ({
        ...prev,
        trecho,
        data: flight.entry_date,
        litros: flight.fuel_added?.toString() || prev.litros,
        origem_aerodromo: flight.departure_aerodrome || "",
        destino_aerodromo: flight.arrival_aerodrome || "",
      }));

      // Busca o lançamento anterior do logbook (não apenas o dia anterior)
      try {
        const { data: previousFlights, error } = await supabase
          .from('logbook_entries')
          .select('id, entry_date, departure_aerodrome, arrival_aerodrome, trecho')
          .eq('id_aeronave', aeronave.id)
          .lt('entry_date', flight.entry_date)
          .order('entry_date', { ascending: false })
          .limit(1);

        if (!error && previousFlights && previousFlights.length > 0) {
          const previousFlight = previousFlights[0];
          console.log('🛫 Lançamento anterior encontrado:', previousFlight);
          setPreviousDayFlightInfo(previousFlight);
        } else {
          console.log('❌ Nenhum lançamento anterior encontrado');
          setPreviousDayFlightInfo(null);
        }
      } catch (err) {
        console.error('Error loading previous flight:', err);
        setPreviousDayFlightInfo(null);
      }
    }
  };

  useEffect(() => {
    // Se NÃO está vinculado ao diário, derive trecho de origem/destino
    if (!linkToLogbook && formData.origem_aerodromo && formData.destino_aerodromo) {
      setFormData(prev => ({
        ...prev,
        trecho: `${formData.origem_aerodromo} X ${formData.destino_aerodromo}`,
      }));
    }
  }, [linkToLogbook, formData.origem_aerodromo, formData.destino_aerodromo]);

  useEffect(() => {
    const itens = formData.litros && formData.valor_unitario ? parseFloat(formData.litros) * parseFloat(formData.valor_unitario) : 0;

    if (!formData.valor_total_manual) {
      setFormData(prev => ({
        ...prev,
        valor_total: itens > 0 ? itens.toFixed(2) : "",
      }));
    }
  }, [formData.litros, formData.valor_unitario, formData.valor_total_manual]);

  useEffect(() => {
    if (!formData.abastecedor_id || !formData.combustivel_tipo) return;
    const fornecedor = suppliers.find(s => s.id === formData.abastecedor_id);
    if (!fornecedor) return;

    const preco = formData.combustivel_tipo === "avgas" ? fornecedor.preco_avgas : fornecedor.preco_jet;
    if (preco !== null && preco !== undefined && !formData.valor_unitario) {
      setFormData(prev => ({
        ...prev,
        valor_unitario: preco.toString(),
      }));
    }
  }, [formData.abastecedor_id, formData.combustivel_tipo, suppliers]);

  // Busca o lançamento anterior quando a data é alterada (sem estar vinculado ao diário)
  useEffect(() => {
    if (linkToLogbook || !formData.data) {
      setPreviousDayFlightInfo(null);
      return;
    }

    const loadPreviousFlight = async () => {
      try {
        const { data: previousFlights, error } = await supabase
          .from('logbook_entries')
          .select('id, entry_date, departure_aerodrome, arrival_aerodrome, trecho')
          .eq('id_aeronave', aeronave.id)
          .lt('entry_date', formData.data)
          .order('entry_date', { ascending: false })
          .limit(1);

        if (!error && previousFlights && previousFlights.length > 0) {
          const previousFlight = previousFlights[0];
          console.log('🛫 Lançamento anterior encontrado:', previousFlight);
          setPreviousDayFlightInfo(previousFlight);
        } else {
          console.log('❌ Nenhum lançamento anterior encontrado');
          setPreviousDayFlightInfo(null);
        }
      } catch (err) {
        console.error('Error loading previous flight:', err);
        setPreviousDayFlightInfo(null);
      }
    };

    loadPreviousFlight();
  }, [formData.data, linkToLogbook, aeronave.id]);

  const loadBankInstitutions = async () => {
    try {
      const { data, error } = await supabase
        .from("instituicoes_bancarias")
        .select("id, label")
        .order("ordem", { ascending: true });

      if (error) {
        console.error("Erro ao carregar instituições bancárias:", error);
        return;
      }
      setBankInstitutions((data || []) as { id: string; label: string }[]);
    } catch (err) {
      console.error("Erro ao carregar instituições bancárias:", err);
    }
  };

  useEffect(() => {
    loadRecords();
    loadSuppliers();
    loadClients();
    loadClientPartners();
    loadBankInstitutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aeronave.id, currentClientId]);

  // Scroll para o abastecimento selecionado quando disponível
  useEffect(() => {
    if (selectedAbastecimentoId && records.length > 0) {
      const selectedRow = document.getElementById(`fuel-record-${selectedAbastecimentoId}`);
      if (selectedRow) {
        selectedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedAbastecimentoId, records.length]);


  const loadSuppliers = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("fornecedores_combustivel").select("id, nome_fornecedor, nome_cidade, codigo_icao, preco_avgas, preco_jet").order("nome_fornecedor", {
        ascending: true
      });
      if (error) {
        const errorMessage = getErrorMessage(error);
        toast.error(`Erro ao carregar fornecedores: ${errorMessage}`);
        console.error("Error loading suppliers:", error);
        return;
      }
      const uniqueSuppliers = Array.from(new Map((data || []).map((s: any) => [s.id, s])).values()) as FuelSupplier[];
      setSuppliers(uniqueSuppliers);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      toast.error(`Erro ao carregar fornecedores: ${errorMessage}`);
      console.error("Exception loading suppliers:", err);
    }
  };
  const getClientPartners = (clientId: string, clientName: string): Partner[] => {
    // Main client is always included
    return [{
      id: clientId,
      name: clientName,
      isMainClient: true,
      percentual_sociedade: 0
    }];
  };
  const loadPartnerPercentages = async (partnersData: Partner[]): Promise<Partner[]> => {
    try {
      const {
        data,
        error
      } = await supabase.from("cotistas_aeronave").select("cliente_id, percentual_participacao").eq("id_aeronave", aeronave.id);
      if (error) {
        console.error("Error loading partner percentages:", error);
        return partnersData;
      }

      const percentageMap: {
        [key: string]: number;
      } = {};
      (data || []).forEach(item => {
        percentageMap[item.id_cliente] = item.percentual_sociedade;
      });

      return partnersData.map(partner => ({
        ...partner,
        percentual_sociedade: percentageMap[partner.id.split('-')[0]] || 0
      }));
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      console.error(`Error loading percentages: ${errorMessage}`);
      return partnersData;
    }
  };
  const getClientPartnersFromDB = async (clientId: string): Promise<Partner[]> => {
    try {
      const { data, error } = await supabase
        .from("socios_cliente")
        .select("id, nome, cpf, percentual_participacao")
        .eq("cliente_id", clientId)
        .order("nome");

      if (error) {
        console.error("Error loading client partners:", error);
        return [];
      }

      return (data || []).map(partner => ({
        id: partner.id,
        nome: partner.nome,
        cpf: partner.cpf,
        isMainClient: false,
        percentual_participacao: partner.percentual_participacao || 0
      }));
    } catch (err) {
      console.error("Exception loading client partners:", err);
      return [];
    }
  };
  const loadClients = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("clientes").select("id, razao_social").order("razao_social", {
        ascending: true
      });
      if (error) {
        const errorMessage = getErrorMessage(error);
        toast.error(`Erro ao carregar clientes: ${errorMessage}`);
        console.error("Error loading clients:", error);
        return;
      }
      setAllClients((data as any) || []);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      toast.error(`Erro ao carregar clientes: ${errorMessage}`);
      console.error("Exception loading clients:", err);
    }
  };
  const loadClientPartners = async () => {
    if (currentClientId === "all") {
      setDisplayClient({ id: "all", razao_social: "Todos os Clientes" });
      setClientPartners([]);
      return;
    }
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', currentClientId)
      .single();
    if (clientError) {
      console.error('Error loading client:', clientError);
      return;
    }
    setDisplayClient(clientData);

    // Get main client
    const mainClient = getClientPartners(clientData.id, clientData.razao_social);

    // Get partners from client_partners table
    const dbPartners = await getClientPartnersFromDB(clientData.id);

    // Combine main client with partners
    let allPartners = [...mainClient, ...dbPartners];

    // Load aircraft share percentages
    const { data: aircraftData, error: aircraftError } = await supabase
      .from('cotistas_aeronave')
      .select('id_cliente, percentual_sociedade')
      .eq('id_aeronave', aeronave.id);

    if (aircraftError) {
      console.error('Error loading aircraft shares:', aircraftError);
    } else {
      const percentageMap: { [key: string]: number } = {};
      (aircraftData || []).forEach(item => {
        percentageMap[item.id_cliente] = item.percentual_sociedade;
      });

      allPartners = allPartners.map(partner => ({
        ...partner,
        percentual_sociedade: percentageMap[partner.id] !== undefined ? percentageMap[partner.id] : partner.percentual_participacao
      }));
    }

    setClientPartners(allPartners);
  };
  const loadRecords = async () => {
    let query = supabase.from("abastecimentos").select("*").eq("id_aeronave", aeronave.id);
    if (currentClientId !== "all") {
      query = query.eq("id_clientes", currentClientId);
    }
    const {
      data,
      error
    } = await query.order("data", {
      ascending: false
    });
    if (error) {
      const errorMessage = getErrorMessage(error);
      toast.error(`Erro ao carregar: ${errorMessage}`);
      console.error("Load error:", error);
      return;
    }
    setRecords(data || []);
    setCurrentPage(1);
  };

  const getFilteredRecords = () => {
    let filtered = records;

    // Filter by partner
    if (filterPartner && filterPartner !== "all") {
      if (filterPartner === "__no_partner__") {
        filtered = filtered.filter(record => !record.nome_socio);
      } else {
        filtered = filtered.filter(record => record.nome_socio === filterPartner);
      }
    }

    // Filter by month/year
    if (filterMonth !== "all" && filterYear) {
      filtered = filtered.filter(record => {
        // Use data_pagamento if status is "pago", otherwise use data (data do abastecimento)
        const dateToUse = (record.situacao_pagamento === "pago" && record.data_pagamento)
          ? record.data_pagamento
          : record.data;
        const recordDate = new Date(dateToUse);
        const recordMonth = (recordDate.getMonth() + 1).toString().padStart(2, '0');
        const recordYear = recordDate.getFullYear().toString();
        return recordMonth === filterMonth && recordYear === filterYear;
      });
    }

    // Filter by search text
    if (searchText) {
      const lowerSearchText = searchText.toLowerCase();
      filtered = filtered.filter(record => {
        return (
          record.trecho?.toLowerCase().includes(lowerSearchText) ||
          record.local?.toLowerCase().includes(lowerSearchText) ||
          record.abastecedor?.toLowerCase().includes(lowerSearchText) ||
          record.comanda?.toLowerCase().includes(lowerSearchText) ||
          record.nf?.toLowerCase().includes(lowerSearchText) ||
          record.observacao?.toLowerCase().includes(lowerSearchText) ||
          record.nome_socio?.toLowerCase().includes(lowerSearchText) ||
          record.litros?.toString().includes(lowerSearchText) ||
          record.valor_total?.toString().includes(lowerSearchText)
        );
      });
    }

    return filtered;
  };
  const filteredRecords = getFilteredRecords();
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  const filteredTotalRecords = filteredRecords.length;
  const filteredTotalLitros = filteredRecords.reduce((sum, r) => sum + r.litros, 0);
  const filteredTotalValue = filteredRecords.reduce((sum, r) => sum + r.valor_total, 0);
  const getFileExtension = (file: File): string => {
    const name = file.nome.toLowerCase();
    const ext = name.split('.').pop() || '';
    return ext;
  };

  const uploadFile = async (file: File | null, fieldName: string): Promise<string | null> => {
    if (!file) return null;
    try {
      const timestamp = Date.now();
      const extension = getFileExtension(file);
      const sanitizedFileName = file.nome
        .replace(/[^a-zA-Z0-9.\-_]/g, "_")
        .substring(0, 100);
      const fileName = `${client.id}/${aeronave.id}/${timestamp}-${fieldName}-${sanitizedFileName}`;
      const {
        error
      } = await supabase.storage.from("abastecimento").upload(fileName, file);
      if (error) {
        const errorMessage = getErrorMessage(error);
        toast.error(`Upload falhou - ${fieldName}: ${errorMessage}`);
        console.error(`Upload error for ${fieldName}:`, error);
        return null;
      }
      const {
        data
      } = supabase.storage.from("abastecimento").getPublicUrl(fileName);
      // Store extension with URL using a separator
      return `${data.publicUrl}||${extension}`;
    } catch (err: any) {
      const errorMessage = getErrorMessage(err);
      toast.error(`Erro de upload - ${fieldName}: ${errorMessage}`);
      console.error(`Upload exception for ${fieldName}:`, err);
      return null;
    }
  };

  const parseFileUrl = (urlWithExt: string | null | undefined, fieldName?: string): { url: string; extension: string } => {
    if (!urlWithExt) return { url: '', extension: '' };
    const parts = urlWithExt.split('||');
    if (parts.length === 2) {
      return { url: parts[0], extension: parts[1].toLowerCase() };
    }
    // Fallback: try to detect from field name for backwards compatibility
    if (fieldName && ['nota', 'boleto'].includes(fieldName)) {
      return { url: urlWithExt, extension: 'pdf' };
    }
    return { url: urlWithExt, extension: '' };
  };

  const getFileType = (extension: string): 'pdf' | 'image' => {
    return ['pdf'].includes(extension) ? 'pdf' : 'image';
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.comanda.trim() && !editingRecord) {
      setShowConfirmation(true);
      return;
    }

    // Mostrar resumo antes de salvar
    setShowConfirmationSummary(true);
  };
  const saveRecord = async () => {
    setIsUploading(true);
    setShowConfirmation(false);
    try {
      if (!formData.data || !formData.data.trim()) {
        toast.error("Campo obrigatório: Data não pode estar vazia");
        setIsUploading(false);
        return;
      }
      if (!formData.trecho || formData.trecho.trim() === "") {
        toast.error("Campo obrigatório: Trecho deve ser preenchido");
        setIsUploading(false);
        return;
      }
      if (!formData.litros || formData.litros.trim() === "") {
        toast.error("Campo obrigatório: Litros deve ser preenchido");
        setIsUploading(false);
        return;
      }
      if (!formData.valor_unitario || formData.valor_unitario.trim() === "") {
        toast.error("Campo obrigatório: Valor unitário deve ser preenchido");
        setIsUploading(false);
        return;
      }
      const litros = parseFloat(formData.litros);
      let valorUnitario = parseFloat(formData.valor_unitario);
      const valorTotalFromField = formData.valor_total ? parseFloat(formData.valor_total) : NaN;

      if (!isNaN(valorTotalFromField) && !isNaN(litros) && litros > 0) {
        const calculated = valorTotalFromField / litros;
        if (!isNaN(calculated) && isFinite(calculated)) {
          valorUnitario = calculated;
        }
      }

      if (isNaN(litros) || litros <= 0) {
        toast.error("Valor inválido: Litros deve ser um número maior que zero");
        setIsUploading(false);
        return;
      }
      if (isNaN(valorUnitario) || valorUnitario < 0) {
        toast.error("Valor inválido: Valor unitário deve ser um número não negativo");
        setIsUploading(false);
        return;
      }

      let comandaUrl = uploadedFiles.comanda_url;
      let notaUrl = uploadedFiles.nota_url;
      let boletoUrl = uploadedFiles.boleto_url;
      let comprovanteUrl = uploadedFiles.comprovante_url;
      if (formData.comanda_file) {
        comandaUrl = (await uploadFile(formData.comanda_file, "comanda")) || "";
      }
      if (formData.nota_file) {
        notaUrl = (await uploadFile(formData.nota_file, "nota-fiscal")) || "";
      }
      if (formData.boleto_file) {
        boletoUrl = (await uploadFile(formData.boleto_file, "boleto")) || "";
      }
      if (formData.comprovante_file) {
        comprovanteUrl = (await uploadFile(formData.comprovante_file, "comprovante-pagamento")) || "";
      }

      // Validação: se status é "pago", precisa de comprovante e data de pagamento
      let statusFinal = formData.status_pagamento || "em aberto";
      if (statusFinal === "pago") {
        const temComprovante = comprovanteUrl || (editingRecord as any)?.comprovante_pagamento;
        const temDataPagamento = formData.data_pagamento;
        if (!temComprovante || !temDataPagamento) {
          toast.warning("Não é possível marcar como pago sem comprovante e data de pagamento. Salvando como 'em aberto'.");
          statusFinal = "em aberto";
        }
      }

      const dateStr = formData.data;
      const dateParts = dateStr.split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10);
      const day = parseInt(dateParts[2], 10);

      // Create a date at midnight Brazil time (UTC-3 = 03:00 UTC)
      const brazilDate = new Date(year, month - 1, day, 3, 0, 0, 0);
      const isoDateString = brazilDate.toISOString();

      if (!formData.cliente_id.trim()) {
        toast.error("Selecione um cliente para o abastecimento");
        setIsUploading(false);
        return;
      }
      const supplierName = formData.abastecedor_id ? suppliers.find(s => s.id === formData.abastecedor_id)?.nome_fornecedor || null : null;

      const observacaoFinal = formData.observacao || null;
      const selectedPartner = clientPartners.find(p => p.id === formData.cliente_id);
      const partnerNameValue = (selectedPartner && !selectedPartner.isMainClient) ? selectedPartner.nome : null;

      let partnerIndex: number | null = null;
      if (selectedPartner && !selectedPartner.isMainClient) {
        if (formData.cliente_id.includes('-partner1')) partnerIndex = 1;
        else if (formData.cliente_id.includes('-partner2')) partnerIndex = 2;
        else if (formData.cliente_id.includes('-partner3')) partnerIndex = 3;
      }

      const recordData: any = {
        client_id: client.id,
        aeronave_id: aeronave.id,
        data: isoDateString,
        trecho: formData.trecho || "",
        local: formData.local || null,
        comanda: formData.comanda || null,
        litros: litros,
        valor_unitario: valorUnitario,
        abastecimento_galoes: formData.abastecimento_galoes ? parseFloat(formData.abastecimento_galoes) : null,
        abastecedor: supplierName,
        status_pagamento: statusFinal,
        tipo_faturamento: formData.tipo_faturamento || null,
        banco: formData.banco || null,
        data_vencimento_boleto: statusFinal === "em aberto" ? formData.data_vencimento_boleto || null : null,
        observacao: observacaoFinal,
        partner_name: partnerNameValue ? partnerNameValue.replace(/^\[|\]$/g, "") : null,
        partner_index: partnerIndex,
        comanda_url: comandaUrl || null,
        nota_url: notaUrl || null,
        boleto_url: boletoUrl || null,
        comprovante_pagamento: comprovanteUrl || null,
        data_pagamento: statusFinal === "pago" ? formData.data_pagamento : null,
        criado_por: currentUserName || null,
        logbook_entry_id: (linkToLogbook && selectedFlightId) ? selectedFlightId : null,
        nf: formData.nf || null,
        tipo_combustivel: formData.combustivel_tipo || null,
        descricao: formData.combustivel_tipo ? `Combustível: ${formData.combustivel_tipo.toUpperCase()}` : null,
      };

      if (editingRecord) {
        const {
          error
        } = await supabase.from("abastecimentos").update(recordData).eq("id", editingRecord.id);
        if (error) {
          const errorMessage = getErrorMessage(error);
          toast.error(`Erro ao atualizar: ${errorMessage}`);
          console.error("Update error:", error);
          return;
        }
        toast.success("Registro atualizado com sucesso");
      } else {
        const {
          error
        } = await supabase.from("abastecimentos").insert(recordData);
        if (error) {
          const errorMessage = getErrorMessage(error);
          toast.error(`Erro ao salvar: ${errorMessage}`);
          console.error("Insert error:", error);
          return;
        }
        toast.success("Registro criado com sucesso");
      }
      resetForm();
      setIsDialogOpen(false);
      loadRecords();
    } catch (err: any) {
      const errorMessage = getErrorMessage(err);
      toast.error(`Erro: ${errorMessage}`);
      console.error("Save error:", err);
    } finally {
      setIsUploading(false);
    }
  };
  const handleClientChange = async (clientId: string) => {
    setFormData(prev => ({
      ...prev,
      client_id: clientId,
      partner_selected: ""
    }));

    const selectedClient = allClients.find(c => c.id === clientId);
    if (selectedClient) {
      // Get main client
      const mainClient = getClientPartners(selectedClient.id, selectedClient.razao_social);

      // Get partners from client_partners table
      const dbPartners = await getClientPartnersFromDB(selectedClient.id);

      // Combine main client with partners
      let allPartners = [...mainClient, ...dbPartners];

      // Load aircraft share percentages
      const { data: aircraftData, error: aircraftError } = await supabase
        .from('cotistas_aeronave')
        .select('id_cliente, percentual_sociedade')
        .eq('id_aeronave', aeronave.id);

      if (!aircraftError) {
        const percentageMap: { [key: string]: number } = {};
        (aircraftData || []).forEach(item => {
          percentageMap[item.id_cliente] = item.percentual_sociedade;
        });

        allPartners = allPartners.map(partner => ({
          ...partner,
          percentual_sociedade: percentageMap[partner.id] !== undefined ? percentageMap[partner.id] : partner.percentual_participacao
        }));
      }

      setClientPartners(allPartners);
    }
  };
  const handleEdit = (record: FuelRecord) => {
    // Try to find supplier by name, or by matching the nome_fornecedor field
    let supplierRecord = suppliers.find(s => s.nome_fornecedor === record.abastecedor);
    // If not found, try to find any supplier that matches case-insensitive
    if (!supplierRecord && record.abastecedor) {
      supplierRecord = suppliers.find(s =>
        s.nome_fornecedor?.toLowerCase() === record.abastecedor?.toLowerCase()
      );
    }
    setEditingRecord(record);
    setFormData({
      data: record.data,
      trecho: record.trecho || "",
      local: record.local || "",
      origem_aerodromo: "",
      destino_aerodromo: "",
      comanda: record.comanda,
      litros: record.litros.toString(),
      valor_unitario: record.valor_unitario.toString(),
      valor_total: (record.valor_total || (record.litros * record.valor_unitario)).toString(),
      valor_total_manual: true,
      abastecimento_galoes: record.abastecimento_galoes?.toString() || "",
      abastecedor_id: supplierRecord?.id || "",
      combustivel_tipo: record.tipo_combustivel || (record.descricao?.toLowerCase().includes("avgas") ? "avgas" : record.descricao?.toLowerCase().includes("jet") ? "jet" : ""),
      client_id: record.cliente_id || client.id,
      partner_selected: record.observacao?.includes("[Partner:") ? record.observacao.match(/\[Partner:([^\]]+)\]/)?.[1] || "" : "",
      status_pagamento: record.status_pagamento || "em aberto",
      tipo_faturamento: record.tipo_faturamento || "",
      banco: record.banco || "",
      data_vencimento_boleto: (record as any).data_vencimento_boleto || "",
      observacao: record.observacao?.replace(/\[Partner:[^\]]+\]\s*/, "") || "",
      nf: record.nf || "",
      comanda_file: null,
      nota_file: null,
      boleto_file: null,
      comprovante_file: null,
      comanda_url: record.comanda_url || "",
      nota_url: record.nota_url || "",
      boleto_url: record.boleto_url || "",
      comprovante_url: (record as any).comprovante_pagamento || "",
      data_pagamento: (record as any).data_pagamento || ""
    });
    setUploadedFiles({
      comanda_url: record.comanda_url || "",
      nota_url: record.nota_url || "",
      boleto_url: record.boleto_url || "",
      comprovante_url: (record as any).comprovante_pagamento || ""
    });
    setIsDialogOpen(true);
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este registro?")) return;
    const {
      error
    } = await supabase.from("abastecimentos").delete().eq("id", id);
    if (error) {
      const errorMessage = getErrorMessage(error);
      toast.error(`Erro ao excluir: ${errorMessage}`);
      console.error("Delete error:", error);
      return;
    }
    toast.success("Registro excluído com sucesso");
    loadRecords();
  };
  const resetForm = () => {
    setFormData({
      data: "",
      trecho: "",
      local: "",
      origem_aerodromo: "",
      destino_aerodromo: "",
      comanda: "",
      litros: "",
      valor_unitario: "",
      valor_total: "",
      valor_total_manual: false,
      abastecimento_galoes: "",
      abastecedor_id: "",
      combustivel_tipo: "",
      client_id: client.id,
      partner_selected: "",
      status_pagamento: "em aberto",
      tipo_faturamento: "",
      banco: "",
      data_vencimento_boleto: "",
      observacao: "",
      nf: "",
      comanda_file: null,
      nota_file: null,
      boleto_file: null,
      comprovante_file: null,
      comanda_url: "",
      nota_url: "",
      boleto_url: "",
      comprovante_url: "",
      data_pagamento: ""
    });
    setUploadedFiles({
      comanda_url: "",
      nota_url: "",
      boleto_url: "",
      comprovante_url: ""
    });
    setEditingRecord(null);
    setLinkToLogbook(false);
    setSelectedFlightId("");
    setLogbookFlights([]);
    setSelectedFlightInfo(null);
    setPreviousDayFlightInfo(null);
  };

  const handleExportPDF = (month: number | null, year: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Filter records by month and year
    let exportRecords = records;
    if (month !== null) {
      exportRecords = records.filter((r) => {
        // Use data_pagamento if status is "pago", otherwise use data (data do abastecimento)
        const dateToUse = (r.status_pagamento === "pago" && r.data_pagamento)
          ? r.data_pagamento
          : r.data;
        const recordDate = new Date(dateToUse + "T00:00:00");
        return recordDate.getMonth() + 1 === month && recordDate.getFullYear() === parseInt(year);
      });
    } else {
      exportRecords = records.filter((r) => {
        // Use data_pagamento if status is "pago", otherwise use data (data do abastecimento)
        const dateToUse = (r.status_pagamento === "pago" && r.data_pagamento)
          ? r.data_pagamento
          : r.data;
        const recordDate = new Date(dateToUse + "T00:00:00");
        return recordDate.getFullYear() === parseInt(year);
      });
    }

    const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthLabel = month === null ? "Todos os meses" : MONTHS_PT[month - 1] || "Todos os meses";
    const periodLabel = month !== null ? `${monthLabel} / ${year}` : year;

    const totalLitros = exportRecords.reduce((sum, r) => sum + r.litros, 0);
    const totalValue = exportRecords.reduce((sum, r) => sum + r.valor_total, 0);

    const rowsHtml = exportRecords.map(r => `
      <tr>
        <td>${formatDateBrazil(r.data, "dd/MM/yyyy")}</td>
        <td>${r.trecho || "-"}</td>
        <td>${r.local || "-"}</td>
        <td>${r.comanda || "-"}</td>
        <td>${r.nome_socio || "-"}</td>
        <td class="text-right">${r.litros.toFixed(2)}</td>
        <td class="text-right">R$ ${r.valor_unitario.toFixed(2)}</td>
        <td class="text-right">R$ ${r.valor_total.toFixed(2)}</td>
        <td class="text-right">${r.abastecimento_galoes?.toFixed(2) || "-"}</td>
      </tr>
    `).join("");

    printWindow.documento.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Controle de Abastecimento - ${displayClient.razao_social} - ${aeronave.matricula} - ${periodLabel}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .logo { max-width: 150px; max-height: 80px; object-fit: contain; }
            .title { text-align: center; flex: 1; }
            .title h1 { margin: 0; font-size: 22px; }
            .title p { margin: 4px 0; color: #666; font-size: 14px; }
            .period { text-align: right; font-size: 16px; font-weight: bold; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; }
            th { background-color: #f4f4f4; font-weight: bold; }
            .text-right { text-align: right; }
            .totals { margin-top: 20px; font-size: 13px; }
            .totals td { font-weight: bold; background-color: #f9f9f9; }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="/logo.share.png" alt="Logo" class="logo" />
            <div class="title">
              <h1>CONTROLE DE COMBUSTÍVEL</h1>
              <p>${displayClient.razao_social}</p>
              <p>${aeronave.matricula}</p>
            </div>
            <div class="period">${periodLabel}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>DATA</th>
                <th>TRECHOS</th>
                <th>LOCAL ABAST</th>
                <th>COMANDA</th>
                <th>SÓCIO</th>
                <th class="text-right">LITROS</th>
                <th class="text-right">VALOR LITRO</th>
                <th class="text-right">VALOR TOTAL</th>
                <th class="text-right">GALÕES</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot class="totals">
              <tr>
                <td colspan="5" class="text-right">TOTAIS</td>
                <td class="text-right">${totalLitros.toFixed(2)}</td>
                <td></td>
                <td class="text-right">R$ ${totalValue.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `);
    printWindow.documento.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const displayTotalRecords = filterMonth !== "all" && filterYear ? filteredTotalRecords : records.length;
  const displayTotalLitros = filterMonth !== "all" && filterYear ? filteredTotalLitros : records.reduce((sum, r) => sum + r.litros, 0);
  const displayTotalValue = filterMonth !== "all" && filterYear ? filteredTotalValue : records.reduce((sum, r) => sum + r.valor_total, 0);
  return <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
        <ChevronLeft className="h-4 w-4" />
        Voltar
      </Button>
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Plane className="h-6 w-6 text-primary" />
          Registros de Abastecimento
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">{displayClient.razao_social} • {aeronave.matricula}</p>
      </div>
    </div>

    {records.length > 0 && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border border-border/50 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total de Registros</p>
              <p className="text-3xl font-bold text-foreground">{displayTotalRecords}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-primary/30" />
          </div>
        </CardContent>
      </Card>
      <Card className="border border-border/50 bg-gradient-to-br from-success/5 via-transparent to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total de Litros</p>
              <p className="text-3xl font-bold text-foreground">{displayTotalLitros.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">litros</p>
            </div>
            <TrendingUp className="h-8 w-8 text-success/30" />
          </div>
        </CardContent>
      </Card>
      <Card className="border border-border/50 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-amber-500/20 opacity-0 hover:opacity-100 transition-opacity" />
        <CardContent className="p-5 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Gasto Total</p>
              <p className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">R$ {displayTotalValue.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-2">valor total</p>
            </div>
            <TrendingUp className="h-10 w-10 text-orange-500/40" />
          </div>
        </CardContent>
      </Card>
    </div>}

    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-1">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Buscar</Label>
          <Input
            type="text"
            placeholder="Buscar por qualquer campo..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setCurrentPage(1);
            }}
            className="mt-1 h-9 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Filtrar por Sócio</Label>
          <Select value={filterPartner} onValueChange={value => {
            setFilterPartner(value);
            setCurrentPage(1);
          }}>
            <SelectTrigger className="mt-1 h-9 text-sm">
              <SelectValue placeholder="Todos os sócios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="__no_partner__">Sem sócio (Cliente)</SelectItem>
              {(() => {
                const uniquePartners = Array.from(new Set(records.map(r => r.nome_socio).filter(Boolean))) as string[];
                return uniquePartners.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ));
              })()}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Filtrar por Mês</Label>
          <Select value={filterMonth} onValueChange={value => {
            setFilterMonth(value);
            setCurrentPage(1);
          }}>
            <SelectTrigger className="mt-1 h-9 text-sm">
              <SelectValue placeholder="Selecione um mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="01">Janeiro</SelectItem>
              <SelectItem value="02">Fevereiro</SelectItem>
              <SelectItem value="03">Março</SelectItem>
              <SelectItem value="04">Abril</SelectItem>
              <SelectItem value="05">Maio</SelectItem>
              <SelectItem value="06">Junho</SelectItem>
              <SelectItem value="07">Julho</SelectItem>
              <SelectItem value="08">Agosto</SelectItem>
              <SelectItem value="09">Setembro</SelectItem>
              <SelectItem value="10">Outubro</SelectItem>
              <SelectItem value="11">Novembro</SelectItem>
              <SelectItem value="12">Dezembro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Filtrar por Ano</Label>
          <Select value={filterYear} onValueChange={value => {
            setFilterYear(value);
            setCurrentPage(1);
          }}>
            <SelectTrigger className="mt-1 h-9 text-sm">
              <SelectValue placeholder="Selecione um ano" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({
                length: 10
              }, (_, i) => {
                const year = (new Date().getFullYear() - i).toString();
                return <SelectItem key={year} value={year}>{year}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
      {(filterMonth || filterYear !== new Date().getFullYear().toString() || filterPartner !== "all" || searchText) && <Button variant="outline" size="sm" onClick={() => {
        setFilterMonth("");
        setFilterYear(new Date().getFullYear().toString());
        setFilterPartner("all");
        setSearchText("");
        setCurrentPage(1);
      }} className="h-9 text-sm">
        Limpar Filtros
      </Button>}
    </div>

    <div className="flex gap-2">
      <Dialog open={isDialogOpen} onOpenChange={open => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogTrigger asChild>
          <Button className="gap-2 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200">
            <Plus className="h-5 w-5" />
            Novo Registro
          </Button>
        </DialogTrigger>
        <DialogContent className="flex flex-col max-w-2xl" style={{zIndex: 1001}}>
          <DialogHeader>
            <DialogTitle>{editingRecord ? "Editar Registro" : "Novo Registro"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-2 sm:pr-4 -mx-2 sm:-mx-4 px-2 sm:px-4">
            {/* ── Vincular ao Diário de Bordo ── */}
            <div className="rounded-lg border border-border/50 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="link-logbook"
                    checked={linkToLogbook}
                    onCheckedChange={(checked) => {
                      setLinkToLogbook(!!checked);
                      if (!checked) {
                        setSelectedFlightId("");
                        setLogbookFlights([]);
                      }
                    }}
                  />
                  <Label htmlFor="link-logbook" className="text-sm font-semibold cursor-pointer flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Vincular a um registro no Diário de Bordo?
                  </Label>
                </div>

                {linkToLogbook && (
                  <div className="pl-7 space-y-3">
                    {loadingFlights ? (
                      <p className="text-xs text-muted-foreground">Carregando voos...</p>
                    ) : logbookFlights.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum voo com abastecimento não vinculado encontrado</p>
                    ) : (
                      <Select value={selectedFlightId} onValueChange={handleFlightSelect}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Selecione um voo" />
                        </SelectTrigger>
                        <SelectContent>
                          {logbookFlights.map((flight) => (
                            <SelectItem key={flight.id} value={flight.id} className="py-2">
                              <div className="text-sm">
                                <span className="font-medium">{formatDateBrazil(flight.entry_date, "dd/MM/yy")}</span>
                                {' · '}
                                <span>{`${flight.departure_aerodrome} x ${flight.arrival_aerodrome}`}</span>
                                {flight.fuel_added && (
                                  <span className="text-muted-foreground"> · {flight.fuel_added}L</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {selectedFlightInfo && (
                      <div className="mt-3 p-3 rounded-lg space-y-2" style={{backgroundColor: 'rgba(16, 33, 56, 1)', borderColor: 'rgba(33, 87, 156, 1)', borderWidth: '1px'}}>
                        <div>
                          <p className="text-xs font-semibold mb-1" style={{color: 'rgba(155, 182, 239, 1)'}}>📅 Data Selecionada</p>
                          <p className="text-sm font-medium text-foreground">{formatDateBrazil(selectedFlightInfo.entry_date, "dd/MM/yy")}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold mb-1" style={{color: 'rgba(162, 188, 244, 1)'}}>✈️ Trecho Selecionado</p>
                          <p className="text-sm font-medium text-foreground">{selectedFlightInfo.trecho || `${selectedFlightInfo.departure_aerodrome} x ${selectedFlightInfo.arrival_aerodrome}`}</p>
                        </div>
                        {previousDayFlightInfo && (
                          <div className="border-t border-blue-200 dark:border-blue-800 pt-2 mt-2 bg-green-500/10 border-l-4 border-l-green-500 p-3 rounded">
                            <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">✓ Rota anterior</p>
                            <p className="text-sm font-medium text-foreground">{previousDayFlightInfo.departure_aerodrome} x {previousDayFlightInfo.arrival_aerodrome}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

            {!linkToLogbook && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">Data do Abastecimento</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={formData.data ? formatDateBrazil(formData.data, "dd/MM/yyyy") : ""}                    readOnly
                    placeholder="dd/mm/aaaa"
                    className="mt-1 h-9 text-sm"
                  />
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="mt-1">
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <UICalendar
                        mode="single"
                        selected={formData.data ? new Date(formData.data) : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          setFormData(prev => ({
                            ...prev,
                            data: format(date, "yyyy-MM-dd"),
                          }));
                          setCalendarOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm font-semibold mb-2 block">Cliente e Sócios</Label>
              <div className="space-y-2">
                {clientPartners.length > 0 && <div className="space-y-2 border-l-2 border-primary/30 pl-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Cliente</p>
                  {clientPartners.filter(p => p.isMainClient).map(partner => <div key={partner.id} className="w-full p-3 rounded-lg border-2 bg-primary-foreground border-primary-dark">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        {partner.nome}
                      </p>
                      {partner.percentual_participacao !== undefined && partner.percentual_participacao > 0 && <span className="text-xs font-semibold px-2 py-1 rounded bg-primary/20 text-primary">
                        {partner.percentual_participacao}%
                      </span>}
                    </div>
                  </div>)}
                </div>}

                {clientPartners.length > 1 && <div className="space-y-2 border-l-2 border-accent/30 pl-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Sócios</p>
                  {clientPartners.filter(p => !p.isMainClient).map(partner => {
                    const isSelected = formData.partner_selected === partner.nome;
                    return <button key={partner.id} type="button" onClick={() => setFormData({
                      ...formData,
                      client_id: partner.id,
                      partner_selected: partner.nome
                    })} className={`w-full p-3 rounded-lg text-left transition-all ${isSelected ? 'border-[3px] border-emerald-500 bg-emerald-500/15 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/30' : 'border-2 border-border/50 hover:border-accent/50'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {isSelected && <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />}
                          <p className={`text-sm font-medium ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                            {partner.nome}
                          </p>
                        </div>
                        {partner.percentual_participacao !== undefined && partner.percentual_participacao > 0 && <span className={`text-xs font-semibold px-2 py-1 rounded ${isSelected ? 'bg-emerald-500/30 text-emerald-700 dark:text-emerald-300' : 'bg-accent/20 text-accent'}`}>
                          {partner.percentual_participacao}%
                        </span>}
                      </div>
                      {partner.cpf && <p className="text-xs text-muted-foreground">CPF: {partner.cpf}</p>}
                    </button>;
                  })}
                </div>}

                {allClients.length > 0 && <div className="border-t pt-2 mt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Outros Clientes</p>
                  <Combobox options={allClients.filter(c => c.id !== client.id).map(c => ({
                    value: c.id,
                    label: c.razao_social
                  }))} value={formData.cliente_id === client.id || clientPartners.some(p => p.id === formData.cliente_id) ? "" : formData.cliente_id} onValueChange={value => handleClientChange(value)} placeholder="Buscar outro cliente" searchPlaceholder="Buscar cliente..." emptyText="Nenhum outro cliente encontrado" className="mt-1 h-9 text-sm" />
                </div>}
              </div>
            </div>

            {/* Rota - Origem e Destino (Reorganizado) */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Rota</Label>
              {!linkToLogbook && (
                <div className="space-y-2 mb-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Origem</Label>
                      <AerodromeCombobox
                        aerodromes={aerodromes}
                        value={formData.origem_aerodromo}
                        onChange={(value) => setFormData(prev => ({
                          ...prev,
                          origem_aerodromo: value,
                        }))}
                        disabled={isLoadingAerodromes}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Destino</Label>
                      <AerodromeCombobox
                        aerodromes={aerodromes}
                        value={formData.destino_aerodromo}
                        onChange={(value) => setFormData(prev => ({
                          ...prev,
                          destino_aerodromo: value,
                        }))}
                        disabled={isLoadingAerodromes}
                      />
                    </div>
                  </div>
                  {previousDayFlightInfo && (
                    <div className="border-t border-blue-200 dark:border-blue-800 pt-2 mt-2">
                      <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">Rota anterior</p>
                      <p className="text-sm font-medium text-foreground">{previousDayFlightInfo.departure_aerodrome} x {previousDayFlightInfo.arrival_aerodrome}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Trecho <span className="text-red-500">*</span></Label>
                  {linkToLogbook ? (
                    <div className="flex gap-2 items-end">
                      <AerodromeCombobox
                        aerodromes={aerodromes}
                        value={formData.trecho?.split(' x ')?.[0] || ''}
                        onChange={(value) => {
                          const destino = formData.trecho?.split(' x ')?.[1] || '';
                          setFormData(prev => ({
                            ...prev,
                            trecho: destino ? `${value} x ${destino}` : value,
                          }));
                        }}
                        disabled={isLoadingAerodromes}
                        placeholder="De"
                      />
                      <span className="text-sm text-muted-foreground">x</span>
                      <AerodromeCombobox
                        aerodromes={aerodromes}
                        value={formData.trecho?.split(' x ')?.[1] || ''}
                        onChange={(value) => {
                          const origem = formData.trecho?.split(' x ')?.[0] || '';
                          setFormData(prev => ({
                            ...prev,
                            trecho: origem ? `${origem} x ${value}` : value,
                          }));
                        }}
                        disabled={isLoadingAerodromes}
                        placeholder="Para"
                      />
                    </div>
                  ) : (
                    <Input value={formData.trecho} onChange={e => setFormData({
                      ...formData,
                      trecho: e.target.value
                    })} placeholder="SBSP X SBRJ" className="mt-1 h-9 text-sm" required />
                  )}
                </div>
              </div>
            </div>

            {/* Fornecedor e Local (lado a lado) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Fornecedor <span className="text-red-500">*</span></Label>
                <Combobox options={suppliers.map(s => ({
                  value: s.id,
                  label: `${s.nome_fornecedor} (${s.cidade_name})`
                }))} value={formData.abastecedor_id} onValueChange={value => {
                  const selectedSupplier = suppliers.find(s => s.id === value);
                  setFormData({
                    ...formData,
                    abastecedor_id: value,
                    local: selectedSupplier?.cidade_name || formData.local
                  });
                }} placeholder="Selecione um fornecedor" searchPlaceholder="Buscar fornecedor..." emptyText="Nenhum fornecedor encontrado" className="mt-1 h-9 text-sm" />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Local</Label>
                <Input value={formData.local} onChange={e => setFormData({
                  ...formData,
                  local: e.target.value
                })} placeholder="CUIABA" className="mt-1 h-9 text-sm" />
              </div>
            </div>

            {/* Tipo de Combustível */}
            <div>
              <Label className="text-xs text-muted-foreground">Tipo de Combustível <span className="text-red-500">*</span></Label>
              <Select value={formData.combustivel_tipo} onValueChange={value => {
                const selectedSupplier = suppliers.find(s => s.id === formData.abastecedor_id);
                let novoValorUnitario = formData.valor_unitario;

                if (selectedSupplier) {
                  if (value === "avgas") {
                    novoValorUnitario = selectedSupplier.preco_avgas?.toString() || "";
                  } else if (value === "jet") {
                    novoValorUnitario = selectedSupplier.preco_jet?.toString() || "";
                  }
                }

                setFormData({
                  ...formData,
                  combustivel_tipo: value,
                  valor_unitario: novoValorUnitario
                });
              }}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avgas">AVGAS</SelectItem>
                  <SelectItem value="jet">JET</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Valor Unit. */}
            <div>
              <Label className="text-xs text-muted-foreground">Valor Unit. (R$) <span className="text-red-500">*</span></Label>
              <Input type="number" step="0.0001" value={formData.valor_unitario} onChange={e => setFormData({
                ...formData,
                valor_unitario: e.target.value,
                valor_total_manual: false,
              })} placeholder="Preço do combustível" className="mt-1 h-9 text-sm" required />
            </div>

            {/* Tipo de Faturamento e Status de Pagamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Tipo de Faturamento <span className="text-red-500">*</span></Label>
                <Select value={formData.tipo_faturamento} onValueChange={value => setFormData({
                  ...formData,
                  tipo_faturamento: value
                })}>
                  <SelectTrigger className="mt-1 h-9 text-sm">
                    <SelectValue placeholder="Selecione o tipo de faturamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pagamento a vista">Pagamento à Vista</SelectItem>
                    <SelectItem value="a vista cartao de credito">À Vista Cartão de Crédito</SelectItem>
                    <SelectItem value="a vista transferencia pix">À Vista Transferência (PIX)</SelectItem>
                    <SelectItem value="faturado boleto">Faturado Boleto</SelectItem>
                    <SelectItem value="faturado nota fiscal">Faturado Nota Fiscal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Status de Pagamento <span className="text-red-500">*</span></Label>
                <Select value={formData.situacao_pagamento} onValueChange={value => setFormData({
                  ...formData,
                  status_pagamento: value
                })}>
                  <SelectTrigger className="mt-1 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em aberto">Em Aberto</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campos condicionais de Pagamento */}
            {formData.status_pagamento === "pago" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Data do Pagamento <span className="text-red-500">*</span></Label>
                  <Input type="data" value={formData.data_pagamento} onChange={e => setFormData({
                    ...formData,
                    data_pagamento: e.target.value
                  })} className="mt-1 h-9 text-sm" required />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Banco</Label>
                  <Select value={formData.banco} onValueChange={value => setFormData({
                    ...formData,
                    banco: value
                  })}>
                    <SelectTrigger className="mt-1 h-9 text-sm">
                      <SelectValue placeholder="Selecione banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankInstitutions.map(bank => (
                        <SelectItem key={bank.id} value={bank.label}>{bank.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {formData.status_pagamento === "em aberto" && (
              <div>
                <Label className="text-xs text-muted-foreground">Data de Vencimento</Label>
                <Input type="data" value={formData.data_vencimento_boleto} onChange={e => setFormData({
                  ...formData,
                  data_vencimento_boleto: e.target.value
                })} className="mt-1 h-9 text-sm" />
              </div>
            )}

            {formData.situacao_pagamento === "pago" && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <Label className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2 block">
                  ⚠️ Para marcar como pago, é obrigatório anexar o comprovante de pagamento e informar a data.
                </Label>
                <ModernFileUpload
                  label="Comprovante de Pagamento"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                  onChange={file => {
                    setFormData({
                      ...formData,
                      comprovante_file: file,
                      comprovante_url: file ? formData.comprovante_url : ""
                    });
                    if (!file) {
                      setUploadedFiles({
                        ...uploadedFiles,
                        comprovante_url: ""
                      });
                    }
                  }}
                  currentFile={formData.comprovante_file}
                  uploadedUrl={formData.comprovante_url}
                  disabled={isUploading}
                  allowedFormats={["PDF", "PNG", "JPG", "JPEG", "GIF", "WEBP"]}
                />
              </div>
            )}

            {/* Litros e Valor Total */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Total em Litros <span className="text-red-500">*</span></Label>
                <Input type="number" step="0.01" value={formData.litros} onChange={e => setFormData({
                  ...formData,
                  litros: e.target.value
                })} placeholder="0.00" required className="mt-1 h-9 text-sm" />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Valor Total (R$) <span className="text-red-500">*</span></Label>
                <Input type="number" step="0.01" value={formData.valor_total} onChange={e => {
                  const total = e.target.value;
                  const litrosNum = parseFloat(formData.litros);
                  const totalNum = parseFloat(total);
                  let valorUnitarioUpdate = formData.valor_unitario;
                  if (!Number.isNaN(litrosNum) && litrosNum > 0 && !Number.isNaN(totalNum)) {
                    valorUnitarioUpdate = (totalNum / litrosNum).toFixed(4);
                  }
                  setFormData({
                    ...formData,
                    valor_total: total,
                    valor_total_manual: true,
                    valor_unitario: valorUnitarioUpdate,
                  });
                }} placeholder="0.00" required className="mt-1 h-9 text-sm" />
              </div>
            </div>

            {(formData.litros && formData.valor_unitario) && <div className="bg-gradient-to-r from-success/10 to-success/5 border border-success/20 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Cálculo Automático</p>
              <p className="text-sm font-semibold text-success">
                {formData.litros} L × R$ {parseFloat(formData.valor_unitario).toFixed(4)} = R$ {formData.valor_total ? parseFloat(formData.valor_total).toFixed(2) : (parseFloat(formData.litros) * parseFloat(formData.valor_unitario)).toFixed(2)}
              </p>
            </div>}

            <div>
              <Label className="text-xs text-muted-foreground">Galões</Label>
              <Input type="number" step="0.01" value={formData.abastecimento_galoes} onChange={e => setFormData({
                ...formData,
                abastecimento_galoes: e.target.value
              })} placeholder="0.00 (opcional)" className="mt-1 h-9 text-sm" />
            </div>

            {/* Comanda */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Nº Comanda</Label>
                <Input value={formData.comanda} onChange={e => setFormData({
                  ...formData,
                  comanda: e.target.value
                })} placeholder="Comanda" className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 block">Anexo da Comanda</Label>
                <ModernFileUpload
                  label=""
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                  onChange={file => {
                    setFormData({
                      ...formData,
                      comanda_file: file,
                      comanda_url: file ? formData.comanda_url : ""
                    });
                    if (!file) {
                      setUploadedFiles({
                        ...uploadedFiles,
                        comanda_url: ""
                      });
                    }
                  }}
                  currentFile={formData.comanda_file}
                  uploadedUrl={formData.comanda_url}
                  disabled={isUploading}
                  allowedFormats={["PDF", "PNG", "JPG", "JPEG", "GIF", "WEBP"]}
                />
              </div>
            </div>

            {/* Nota Fiscal */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Nº NF</Label>
                <Input type="text" value={formData.nf} onChange={e => setFormData({
                  ...formData,
                  nf: e.target.value
                })} placeholder="NF" className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 block">Anexo da NF</Label>
                <ModernFileUpload
                  label=""
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                  onChange={file => {
                    setFormData({
                      ...formData,
                      nota_file: file,
                      nota_url: file ? formData.nota_url : ""
                    });
                    if (!file) {
                      setUploadedFiles({
                        ...uploadedFiles,
                        nota_url: ""
                      });
                    }
                  }}
                  currentFile={formData.nota_file}
                  uploadedUrl={formData.nota_url}
                  disabled={isUploading}
                  allowedFormats={["PDF", "PNG", "JPG", "JPEG", "GIF", "WEBP"]}
                />
              </div>
            </div>

            {/* Boleto */}
            <div>
              <Label className="text-xs text-muted-foreground">Boleto (Opcional)</Label>
              <ModernFileUpload
                label=""
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                onChange={file => {
                  setFormData({
                    ...formData,
                    boleto_file: file,
                    boleto_url: file ? formData.boleto_url : ""
                  });
                  if (!file) {
                    setUploadedFiles({
                      ...uploadedFiles,
                      boleto_url: ""
                    });
                  }
                }}
                currentFile={formData.boleto_file}
                uploadedUrl={formData.boleto_url}
                disabled={isUploading}
                allowedFormats={["PDF", "PNG", "JPG", "JPEG", "GIF", "WEBP"]}
              />
            </div>

            {/* Observações */}
            <div>
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <textarea
                value={formData.observacao}
                onChange={e => setFormData({
                  ...formData,
                  observacao: e.target.value
                })}
                placeholder="Adicione observações sobre este abastecimento..."
                className="mt-1 w-full min-h-20 p-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t sticky bottom-0 bg-background -mx-4 sm:-mx-0 px-4 sm:px-0 py-4 sm:py-0">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isUploading} className="w-full sm:w-auto hover:bg-muted transition-colors">
                Cancelar
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 w-full sm:w-auto" disabled={isUploading}>
                {isUploading ? "Salvando..." : editingRecord ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmationSummary} onOpenChange={setShowConfirmationSummary}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{zIndex: 9999}}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Resumo do Abastecimento</AlertDialogTitle>
            <AlertDialogDescription>
              Revise as informações e confirme para salvar
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            {/* Data e Cliente */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Data</p>
                <p className="text-sm font-medium text-foreground">{formatDateBrazil(formData.data)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Cliente</p>
                <p className="text-sm font-medium text-foreground">{displayClient.razao_social}</p>
              </div>
            </div>

            {/* Partner (Sócio) */}
            {(() => {
              const selectedPartner = clientPartners.find(p => p.id === formData.cliente_id);
              const partnerNameValue = (selectedPartner && !selectedPartner.isMainClient) ? selectedPartner.nome : null;
              if (partnerNameValue) {
                return (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Sócio</p>
                    <p className="text-sm font-medium text-foreground">{partnerNameValue.replace(/^\[|\]$/g, "")}</p>
                  </div>
                );
              }
              return null;
            })()}

            {/* Rota */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Rota</p>
              <p className="text-sm font-medium text-foreground">{formData.trecho}</p>
            </div>

            {/* Fornecedor e Local */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Fornecedor</p>
                <p className="text-sm font-medium text-foreground">{suppliers.find(s => s.id === formData.abastecedor_id)?.nome_fornecedor || "Não selecionado"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Local</p>
                <p className="text-sm font-medium text-foreground">{formData.local || "—"}</p>
              </div>
            </div>

            {/* Combustível e Valor Unitário */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Tipo de Combustível</p>
                <p className="text-sm font-medium text-foreground uppercase">{formData.combustivel_tipo || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Valor Unit. (R$)</p>
                <p className="text-sm font-medium text-foreground">R$ {parseFloat(formData.valor_unitario || "0").toFixed(4)}</p>
              </div>
            </div>

            {/* Litros e Valor Total */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Litros</p>
                <p className="text-sm font-medium text-foreground">{formData.litros} L</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Valor Total (R$)</p>
                <p className="text-sm font-semibold text-success">R$ {parseFloat(formData.valor_total || "0").toFixed(2)}</p>
              </div>
            </div>

            {/* Faturamento e Pagamento */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Tipo de Faturamento</p>
                <p className="text-sm font-medium text-foreground">{formData.tipo_faturamento || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Status de Pagamento</p>
                <p className={`text-sm font-medium ${formData.situacao_pagamento === "pago" ? "text-green-600" : "text-amber-600"}`}>
                  {formData.situacao_pagamento === "pago" ? "✓ Pago" : "⏱ Em Aberto"}
                </p>
              </div>
            </div>

            {/* Comanda e NF */}
            {(formData.comanda || formData.nf) && (
              <div className="grid grid-cols-2 gap-4">
                {formData.comanda && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Comanda</p>
                    <p className="text-sm font-medium text-foreground">{formData.comanda}</p>
                  </div>
                )}
                {formData.nf && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Nota Fiscal</p>
                    <p className="text-sm font-medium text-foreground">{formData.nf}</p>
                  </div>
                )}
              </div>
            )}

            {/* Observações */}
            {formData.observacao && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Observações</p>
                <p className="text-sm font-medium text-foreground">{formData.observacao}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Voltar e Editar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowConfirmationSummary(false);
              saveRecord();
            }} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
              Confirmar e Salvar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent style={{zIndex: 9999}}>
          <AlertDialogHeader>
            <AlertDialogTitle>Comanda não preenchida</AlertDialogTitle>
            <AlertDialogDescription>
              Você está criando um registro sem informar a comanda. Embora não seja obrigatório, é importante ter esse dado para rastreamento. Deseja continuar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Voltar e Preencher</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowConfirmation(false);
              setShowConfirmationSummary(true);
            }}>
              Continuar sem Comanda
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <ExportFuelRecordsModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        records={records}
        clientName={displayClient.razao_social}
        aircraftRegistration={aeronave.matricula}
        onExportPDF={handleExportPDF}
      />

      <Button
        onClick={() => setIsExportModalOpen(true)}
        className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
      >
        <Download className="h-5 w-5" />
        Exportar PDF
      </Button>
    </div>


    <Card className="border border-border/50 shadow-card">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-b border-border/50 hover:bg-transparent">
                <TableHead className="font-semibold text-foreground">Data</TableHead>
                <TableHead className="font-semibold text-foreground">Trecho</TableHead>
                <TableHead className="font-semibold text-foreground">Local</TableHead>
                <TableHead className="font-semibold text-foreground">Comanda</TableHead>
                <TableHead className="font-semibold text-foreground">N.F</TableHead>
                <TableHead className="font-semibold text-foreground">Fornecedor</TableHead>
                <TableHead className="font-semibold text-foreground">Sócio</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-foreground">Litros</TableHead>
                <TableHead className="text-right font-semibold text-foreground">Valor Unit.</TableHead>
                <TableHead className="text-right font-semibold text-foreground">Valor Total</TableHead>
                <TableHead className="text-right font-semibold text-foreground">Galões</TableHead>
                <TableHead className="font-semibold text-foreground">Observações</TableHead>
                
                <TableHead className="text-right font-semibold text-foreground">Anexos</TableHead>
                <TableHead className="text-right font-semibold text-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRecords.map(record => (
                <TableRow
                  key={record.id}
                  id={`fuel-record-${record.id}`}
                  className={`border-b border-border/50 transition-all duration-300 ${
                    selectedAbastecimentoId === record.id
                      ? 'bg-primary/8 dark:bg-primary/12 border-l-4 border-l-primary ring-1 ring-primary/20 hover:bg-primary/12 dark:hover:bg-primary/16 shadow-md'
                      : 'hover:bg-muted/30'
                  }`}
                >
                  <TableCell className="font-medium text-foreground">
                    {formatDateBrazil(record.data, "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{record.trecho || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{record.local || "-"}</TableCell>
                  <TableCell className="font-mono text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{record.comanda || "-"}</span>
                      {record.comanda_url && (
                        <button
                          onClick={() => {
                            const parsed = parseFileUrl(record.comanda_url, 'comanda');
                            setViewingAttachment({
                              url: parsed.url,
                              type: getFileType(parsed.extension),
                              name: 'Comanda'
                            });
                          }}
                          className="text-blue-500 hover:text-blue-400 transition-colors"
                          title="Ver comanda"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{record.nf || "-"}</span>
                      {record.nota_url && (
                        <button
                          onClick={() => {
                            const parsed = parseFileUrl(record.nota_url, 'nota');
                            setViewingAttachment({
                              url: parsed.url,
                              type: getFileType(parsed.extension),
                              name: 'Nota Fiscal'
                            });
                          }}
                          className="text-green-500 hover:text-green-400 transition-colors"
                          title="Ver nota fiscal"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{record.abastecedor || "-"}</TableCell>
                  <TableCell className="text-muted-foreground font-medium">{record.nome_socio || "-"}</TableCell>
                  <TableCell>
                    {record.situacao_pagamento === "pago" ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                      <FileCheck className="h-4 w-4" />
                      Pago
                    </span> : <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-semibold">
                      <DollarSign className="h-4 w-4" />
                      Em Aberto
                    </span>}
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    {record.litros.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    R$ {record.valor_unitario.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-success">
                    R$ {record.valor_total.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {record.abastecimento_galoes?.toFixed(2) || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs">
                    <div className="truncate" title={record.observacao || ""}>
                      {(record.observacao && record.observacao.replace(/\[Partner:[^\]]*\]\s*/g, '').trim()) || "-"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {record.boleto_url && <Button variant="ghost" size="sm" onClick={() => {
                        const parsed = parseFileUrl(record.boleto_url, 'boleto');
                        setViewingAttachment({
                          url: parsed.url,
                          type: getFileType(parsed.extension),
                          name: 'Boleto'
                        });
                      }} className="h-7 px-2 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 font-semibold text-xs gap-1" title="Visualizar Boleto">
                        <DollarSign className="h-4 w-4" />
                        Boleto
                      </Button>}
                      {(record as any).comprovante_pagamento && <Button variant="ghost" size="sm" onClick={() => {
                        const parsed = parseFileUrl((record as any).comprovante_pagamento, 'comprovante');
                        setViewingAttachment({
                          url: parsed.url,
                          type: getFileType(parsed.extension),
                          name: 'Comprovante'
                        });
                      }} className="h-7 px-2 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 font-semibold text-xs gap-1" title="Visualizar Comprovante">
                        <FileCheck className="h-4 w-4" />
                        Comprovante
                      </Button>}
                      {!record.boleto_url && !(record as any).comprovante_pagamento && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(record)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {records.length === 0 && <div className="text-center py-16 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium">Nenhum registro de abastecimento</p>
            <p className="text-sm mt-1">Comece criando um novo registro</p>
          </div>}
          {filteredRecords.length === 0 && records.length > 0 && <div className="text-center py-16 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium">Nenhum registro encontrado para o período selecionado</p>
          </div>}
        </div>
        {filteredRecords.length > 0 && <div className="border-t border-border/50 px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Mostrando <span className="font-semibold text-foreground">{startIndex + 1}</span> a <span className="font-semibold text-foreground">{Math.min(startIndex + itemsPerPage, filteredRecords.length)}</span> de <span className="font-semibold text-foreground">{filteredRecords.length}</span> registros
          </p>
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 px-3 text-sm">
              Anterior
            </Button>
            <div className="flex items-center gap-1 px-3 py-1 bg-muted rounded-md">
              <span className="text-sm font-semibold text-foreground">{currentPage}</span>
              <span className="text-sm text-muted-foreground">/</span>
              <span className="text-sm text-muted-foreground">{totalPages}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 px-3 text-sm">
              Próximo
            </Button>
          </div>
        </div>}
      </CardContent>
    </Card>

    {viewingAttachment && <Dialog open={!!viewingAttachment} onOpenChange={open => !open && setViewingAttachment(null)}>
      <DialogContent className="max-w-7xl w-[98vw] h-[95vh] flex flex-col" style={{zIndex: 1001}}>
        <DialogHeader className="border-b pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {viewingAttachment.nome === 'Comanda' && <FileText className="h-5 w-5 text-blue-600" />}
            {viewingAttachment.nome === 'Nota Fiscal' && <FileCheck className="h-5 w-5 text-green-600" />}
            {viewingAttachment.nome === 'Boleto' && <DollarSign className="h-5 w-5 text-orange-600" />}
            Visualizando: {viewingAttachment.nome}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/30 rounded-lg p-6">
          {viewingAttachment.tipo === 'pdf' ? <div className="w-full h-full flex flex-col gap-3">
            <embed src={viewingAttachment.url + '#toolbar=1'} type="application/pdf" className="w-full flex-1 rounded-lg" style={{ minHeight: '600px' }} />
            <Button onClick={() => window.open(viewingAttachment.url, '_blank')} variant="outline" className="gap-2 self-center">
              <Download className="h-4 w-4" />
              Abrir em Nova Aba
            </Button>
          </div> : <div className="w-full flex flex-col items-center gap-4">
            <img src={viewingAttachment.url} alt={viewingAttachment.nome} className="max-w-full max-h-[600px] object-contain rounded-lg shadow-lg" />
            <p className="text-xs text-muted-foreground">Clique para fechar</p>
          </div>}
        </div>
      </DialogContent>
    </Dialog>}
  </div>;
}
