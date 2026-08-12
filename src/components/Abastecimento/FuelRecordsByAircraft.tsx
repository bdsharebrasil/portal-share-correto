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
import { Plus, Download, Edit, Trash2, ChevronLeft, ChevronDown, ChevronUp, Plane, Search, FileUp, X, Eye, FileText, Image as ImageIcon, FileCheck, DollarSign, BookOpen, Calendar as CalendarIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import AnexosDinamicosField, { AnexoLinha } from "@/components/dashboard/gestor/FinanceiroCotista/AnexosDinamicosField";
import { format } from "date-fns";
import { Combobox } from "@/components/ui/combobox";
import { AerodromeCombobox } from "@/components/plano-voo/AerodromeCombobox";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExportFuelRecordsModal } from "./ExportFuelRecordsModal";
import { resolveFuelRecordPartnerName } from "./fuelRecordsUtils";

interface Client {
  id: string;
  razao_social: string;
}

interface Aircraft {
  id: string;
  matricula: string;
  ano: number | null;
}

interface Partner {
  id: string;
  nome: string;
  cpf?: string;
  isMainClient?: boolean;
  percentual_participacao?: number;
  percentual_sociedade?: number;
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
  desconto?: number | null;
  abastecimento_galoes: number | null;
  comanda_url: string | null;
  nota_url: string | null;
  boleto_url: string | null;
  abastecedor?: string | null;
  abastecedor_id?: string | null;
  client_id?: string | null;
  id_clientes?: string | null;
  status?: string | null;
  tipo_faturamento?: string | null;
  observacao?: string | null;
  nf?: string | null;
  partner_name?: string | null;
  socio_nome?: string | null;
  comprovante_pagamento?: string | null;
  comprovante_url?: string | null;
  data_pagamento?: string | null;
  tipo_combustivel?: string | null;
  descricao?: string | null;
  banco?: string | null;
  forma_pagamento?: string | null;
  data_vencimento_boleto?: string | null;
}

interface FuelSupplier {
  id: string;
  nome_fornecedor: string;
  nome_cidade: string;
  codigo_icao: string;
  preco_avgas?: number | null;
  preco_jet?: number | null;
}

interface BankInstitution {
  id: string;
  banco: string;
  numero_conta: string | null;
  tipo_conta: string | null;
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
  if (typeof error === "string") return error;
  if (error.message && typeof error.message === "string") return error.message;
  if (error.hint && typeof error.hint === "string") return error.hint;
  if (error.details && typeof error.details === "string") return error.details;
  if (error.details && typeof error.details === "object") {
    try {
      return JSON.stringify(error.details);
    } catch {
      return "Erro nos detalhes da resposta";
    }
  }
  try {
    return String(error);
  } catch {
    return "Erro ao processar";
  }
};

/**
 * Parser seguro de data. As datas em `abastecimentos.data` são salvas como
 * timestamp ISO completo (ex: "2026-08-09T03:00:00.000Z"), então NÃO se pode
 * concatenar "T00:00:00" nelas (isso gera uma string inválida tipo
 * "2026-08-09T03:00:00.000ZT00:00:00" e produz Invalid Date, quebrando
 * filtros por mês/ano). Esta função extrai só a parte "yyyy-MM-dd" e monta
 * a data local corretamente, funcionando tanto com timestamps completos
 * quanto com datas simples ("yyyy-MM-dd").
 */
const parseDateSafe = (dateValue: string | null | undefined): Date | null => {
  if (!dateValue) return null;
  const datePart = dateValue.split("T")[0];
  if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
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
      const parsed = parseDateSafe(dateValue);
      if (!parsed) return "—";
      dateObj = parsed;
    } else {
      dateObj = dateValue;
    }
    if (isNaN(dateObj.getTime())) return "—";
    return format(dateObj, formatStr);
  } catch {
    return "—";
  }
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
  const [isUploading, setIsUploading] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterPartner, setFilterPartner] = useState<string>("all");
  const [searchText, setSearchText] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateSortAsc, setDateSortAsc] = useState<boolean>(false);
  const [dateColumnType, setDateColumnType] = useState<'data' | 'data_pagamento'>('data');

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [currentClientId, setCurrentClientId] = useState<string>(client.id);
  const [displayClient, setDisplayClient] = useState<Client>(client);

  const [linkToLogbook, setLinkToLogbook] = useState(false);
  const [logbookFlights, setLogbookFlights] = useState<any[]>([]);
  const [selectedFlightId, setSelectedFlightId] = useState<string>("");
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [paymentDateCalendarOpen, setPaymentDateCalendarOpen] = useState(false);
  const [dueDateCalendarOpen, setDueDateCalendarOpen] = useState(false);

  const { aerodromes, isLoadingAerodromes } = useAerodromes();
  const aerodromeItems = (aerodromes || []).map((a: any) => ({
    id: a.designativo as string,
    label: `${a.designativo}${a.nome ? ` — ${a.nome}` : ""}`,
  }));

  // Regra: o trecho é sempre "Nome do aeródromo x Nome do aeródromo"
  const nomeAerodromo = (token?: string | null) => {
    const t = (token || "").trim();
    if (!t) return "";
    const found = (aerodromes || []).find(
      (a: any) => String(a.designativo || "").toUpperCase() === t.toUpperCase(),
    ) as any;
    return found?.nome || t;
  };
  const trechoComNomes = (origem?: string | null, destino?: string | null) => {
    const o = nomeAerodromo(origem);
    const d = nomeAerodromo(destino);
    if (!o && !d) return "";
    return `${o} x ${d}`;
  };
  const [bankInstitutions, setBankInstitutions] = useState<BankInstitution[]>([]);

  const [selectedFlightInfo, setSelectedFlightInfo] = useState<any>(null);
  const [previousDayFlightInfo, setPreviousDayFlightInfo] = useState<any>(null);

  const [formData, setFormData] = useState({
    data: "",
    trecho: "",
    local: "",
    origem_aerodromo: "",
    destino_aerodromo: "",
    comanda: "",
    litros: "",
    valor_unitario: "",
    desconto: "",
    valor_total: "",
    valor_total_manual: false,
    abastecimento_galoes: "",
    abastecedor_id: "",
    combustivel_tipo: "",
    client_id: "",
    partner_selected: "",
    status: "pendente",
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

  const [anexos, setAnexos] = useState<AnexoLinha[]>([]);

  // As linhas de anexo são a fonte da verdade. Nada é sobrescrito aqui —
  // a conversão para as colunas do banco acontece apenas no momento de salvar.
  const handleAnexosChange = (next: AnexoLinha[]) => {
    setAnexos(next);
  };

  const anexoUrlPorTipo = (lista: AnexoLinha[], tipo: string) =>
    lista.find((a) => a.tipo === tipo && a.url)?.url || "";
  const anexoNumeroPorTipo = (lista: AnexoLinha[], tipo: string) =>
    lista.find((a) => a.tipo === tipo && a.numero?.trim())?.numero?.trim() || "";

  const [viewingAttachment, setViewingAttachment] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);


  useEffect(() => {
    const loadUserName = async () => {
      if (!user?.id) return;
      const { data } = await (supabase as any)
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (data?.full_name) setCurrentUserName(data.full_name);
    };
    loadUserName();
  }, [user?.id]);

  useEffect(() => {
    if (linkToLogbook && aircraft.id) {
      loadLogbookFlights();
    }
  }, [linkToLogbook, aircraft.id, formData.client_id]);

  const loadLogbookFlights = async () => {
    setLoadingFlights(true);
    try {
      const { data: linkedAbast } = await (supabase as any)
        .from('abastecimentos')
        .select('logbook_entry_id')
        .eq('aeronave_id', aircraft.id)
        .not('logbook_entry_id', 'is', null);

      const linkedIds = (linkedAbast || []).map((a: any) => a.logbook_entry_id).filter(Boolean);

      // Colunas conferidas contra o schema real da tabela lancamentos_diario_bordo.
      // "fuel_liters" foi removido daqui pois não existe na tabela — ele fazia o
      // select inteiro falhar silenciosamente e a lista de voos ficava sempre vazia.
      const baseSelect =
        'id, data_registro, departure_aerodrome:aerodromo_partida, arrival_aerodrome:aerodromo_chegada, trecho, combustivel_adicionado, litros_combustivel_inicio_voo, clientes_id, tempo_total';

      const buildQuery = (clientId?: string) => {
        let q = (supabase as any)
          .from('lancamentos_diario_bordo')
          .select(baseSelect)
          .eq('aeronave_id', aircraft.id)
          .order('data_registro', { ascending: false })
          .limit(100);
        if (clientId) q = q.eq('clientes_id', clientId);
        return q;
      };

      const effectiveClientId = formData.client_id || client.id;
      let { data: flights, error } = await buildQuery(effectiveClientId);
      if (error) {
        console.error('Error loading logbook flights:', error);
        toast.error(`Erro ao carregar voos do diário de bordo: ${getErrorMessage(error)}`);
        setLogbookFlights([]);
        return;
      }

      // Se o filtro por cliente não retornar voos, mostra todos os voos da aeronave.
      if (!flights || flights.length === 0) {
        const fallback = await buildQuery();
        if (fallback.error) {
          console.error('Error loading logbook flights (fallback):', fallback.error);
          toast.error(`Erro ao carregar voos do diário de bordo: ${getErrorMessage(fallback.error)}`);
          setLogbookFlights([]);
          return;
        }
        flights = fallback.data || [];
      }

      const availableFlights = (flights || []).filter((f: any) => !linkedIds.includes(f.id));
      setLogbookFlights(availableFlights);
    } catch (err) {
      console.error('Error loading logbook flights:', err);
      toast.error(`Erro ao carregar voos do diário de bordo: ${getErrorMessage(err)}`);
      setLogbookFlights([]);
    } finally {
      setLoadingFlights(false);
    }
  };

  const handleFlightSelect = async (flightId: string) => {
    setSelectedFlightId(flightId);
    const flight = logbookFlights.find(f => f.id === flightId);
    if (flight) {
      const trecho = trechoComNomes(flight.departure_aerodrome, flight.arrival_aerodrome) || flight.trecho || "";
      setSelectedFlightInfo(flight);

      setFormData(prev => ({
        ...prev,
        trecho,
        data: flight.data_registro,
        litros: flight.combustivel_adicionado?.toString() || prev.litros,
        origem_aerodromo: flight.departure_aerodrome || "",
        destino_aerodromo: flight.arrival_aerodrome || "",
      }));

      try {
        const { data: previousFlights, error } = await (supabase as any)
          .from('lancamentos_diario_bordo')
          .select('id, data_registro, departure_aerodrome:aerodromo_partida, arrival_aerodrome:aerodromo_chegada, trecho')
          .eq('aeronave_id', aircraft.id)
          .lt('data_registro', flight.data_registro)
          .order('data_registro', { ascending: false })
          .limit(1);

        if (!error && previousFlights && previousFlights.length > 0) {
          setPreviousDayFlightInfo(previousFlights[0]);
        } else {
          setPreviousDayFlightInfo(null);
        }
      } catch (err) {
        console.error('Error loading previous flight:', err);
        setPreviousDayFlightInfo(null);
      }
    }
  };

  useEffect(() => {
    if (!linkToLogbook && formData.origem_aerodromo && formData.destino_aerodromo) {
      setFormData(prev => ({
        ...prev,
        trecho: trechoComNomes(formData.origem_aerodromo, formData.destino_aerodromo),
      }));
    }
  }, [linkToLogbook, formData.origem_aerodromo, formData.destino_aerodromo, aerodromes]);

  useEffect(() => {
    const itens = formData.litros && formData.valor_unitario ? parseFloat(formData.litros) * parseFloat(formData.valor_unitario) : 0;
    const descontoNum = formData.desconto ? parseFloat(formData.desconto) : 0;
    const itensComDesconto = Math.max(0, itens - descontoNum);
    if (!formData.valor_total_manual) {
      setFormData(prev => ({
        ...prev,
        valor_total: itensComDesconto > 0 ? itensComDesconto.toFixed(2) : "",
      }));
    }
  }, [formData.litros, formData.valor_unitario, formData.desconto, formData.valor_total_manual]);

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

  useEffect(() => {
    if (linkToLogbook || !formData.data) {
      setPreviousDayFlightInfo(null);
      return;
    }

    const loadPreviousFlight = async () => {
      try {
        const { data: previousFlights, error } = await (supabase as any)
          .from('lancamentos_diario_bordo')
          .select('id, data_registro, departure_aerodrome:aerodromo_partida, arrival_aerodrome:aerodromo_chegada, trecho')
          .eq('aeronave_id', aircraft.id)
          .lt('data_registro', formData.data)
          .order('data_registro', { ascending: false })
          .limit(1);

        if (!error && previousFlights && previousFlights.length > 0) {
          setPreviousDayFlightInfo(previousFlights[0]);
        } else {
          setPreviousDayFlightInfo(null);
        }
      } catch (err) {
        console.error('Error loading previous flight:', err);
        setPreviousDayFlightInfo(null);
      }
    };

    loadPreviousFlight();
  }, [formData.data, linkToLogbook, aircraft.id]);

  const loadBankInstitutions = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("contas_bancarias")
        .select("id, banco, numero_conta, tipo_conta")
        .eq("ativo", true)
        .order("banco", { ascending: true });

      if (error) {
        console.error("Erro ao carregar instituições bancárias:", error);
        return;
      }
      setBankInstitutions((data || []) as BankInstitution[]);
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
  }, [aircraft.id, currentClientId]);

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
      const { data, error } = await supabase.from("fornecedores_combustivel").select("id, nome_fornecedor, nome_cidade, codigo_icao, preco_avgas, preco_jet").order("nome_fornecedor", {
        ascending: true
      });
      if (error) {
        toast.error(`Erro ao carregar fornecedores: ${getErrorMessage(error)}`);
        return;
      }
      const uniqueSuppliers = Array.from(new Map((data || []).map((s: any) => [s.id, s])).values()) as FuelSupplier[];
      setSuppliers(uniqueSuppliers);
    } catch (err) {
      toast.error(`Erro ao carregar fornecedores: ${getErrorMessage(err)}`);
    }
  };

  const getClientPartners = (clientId: string, clientName: string): Partner[] => {
    return [{
      id: clientId,
      nome: clientName,
      isMainClient: true,
      percentual_sociedade: 0
    }];
  };

  const getClientPartnersFromDB = async (clientId: string): Promise<Partner[]> => {
    try {
      const { data, error } = await (supabase as any)
        .from("socios")
        .select("id, nome, cpf, percentual_participacao")
        .eq("clientes_id", clientId)
        .order("nome");

      if (error) {
        console.error("Error loading client partners:", error);
        return [];
      }

      return (data || []).map((partner: any) => ({
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
      const { data, error } = await supabase.from("clientes").select("id, razao_social").order("razao_social", {
        ascending: true
      });
      if (error) {
        toast.error(`Erro ao carregar clientes: ${getErrorMessage(error)}`);
        return;
      }
      setAllClients((data as any) || []);
    } catch (err) {
      toast.error(`Erro ao carregar clientes: ${getErrorMessage(err)}`);
    }
  };

  const loadClientPartners = async () => {
    if (currentClientId === "all") {
      setDisplayClient({ id: "all", razao_social: "Todos os Clientes" });
      setClientPartners([]);
      return;
    }
    const { data: clientData, error: clientError } = await (supabase as any)
      .from('clientes')
      .select('*')
      .eq('id', currentClientId)
      .single();
    if (clientError) {
      console.error('Error loading client:', clientError);
      return;
    }
    setDisplayClient(clientData as any);

    const mainClient = getClientPartners(clientData.id, (clientData as any).razao_social || clientData.company_name);
    const dbPartners = await getClientPartnersFromDB(clientData.id);
    let allPartners = [...mainClient, ...dbPartners];

    const { data: aircraftData, error: aircraftError } = await (supabase as any)
      .from('cotistas_aeronave')
      .select('id_clientes, percentual_sociedade')
      .eq('id_aeronave', aircraft.id);

    if (!aircraftError) {
      const percentageMap: { [key: string]: number } = {};
      (aircraftData || []).forEach((item: any) => {
        percentageMap[item.id_clientes] = item.percentual_sociedade;
      });

      allPartners = allPartners.map(partner => ({
        ...partner,
        percentual_sociedade: percentageMap[partner.id] !== undefined ? percentageMap[partner.id] : partner.percentual_participacao
      }));
    }

    setClientPartners(allPartners);
  };

  const loadRecords = async () => {
    let query = supabase.from("abastecimentos").select("*").eq("aeronave_id", aircraft.id);
    if (currentClientId !== "all") {
      query = query.eq("id_clientes", currentClientId);
    }
    const { data, error } = await query.order("data", {
      ascending: false
    });
    if (error) {
      toast.error(`Erro ao carregar: ${getErrorMessage(error)}`);
      return;
    }
    setRecords(data || []);
    setCurrentPage(1);
  };

  const getRecordDateValue = (record: FuelRecord): string | null => {
    if (dateColumnType === 'data_pagamento') {
      return record.data_pagamento || record.data;
    }
    return record.data;
  };

  const getRecordSortTime = (record: FuelRecord) => {
    const dateToUse = getRecordDateValue(record);
    const parsed = parseDateSafe(dateToUse);
    return parsed ? parsed.getTime() : 0;
  };

  const getFilteredRecords = () => {
    let filtered = records;

    if (filterPartner && filterPartner !== "all") {
      if (filterPartner === "__no_partner__") {
        filtered = filtered.filter(record => !resolveFuelRecordPartnerName(record));
      } else {
        filtered = filtered.filter(record => resolveFuelRecordPartnerName(record) === filterPartner);
      }
    }

    if (filterMonth !== "all" && filterYear) {
      filtered = filtered.filter(record => {
        const dateToUse = getRecordDateValue(record);
        const recordDate = parseDateSafe(dateToUse);
        if (!recordDate) return false;
        const recordMonth = (recordDate.getMonth() + 1).toString().padStart(2, '0');
        const recordYear = recordDate.getFullYear().toString();
        return recordMonth === filterMonth && recordYear === filterYear;
      });
    }

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
          resolveFuelRecordPartnerName(record).toLowerCase().includes(lowerSearchText) ||
          record.litros?.toString().includes(lowerSearchText) ||
          record.valor_total?.toString().includes(lowerSearchText)
        );
      });
    }

    filtered = [...filtered].sort((a, b) => {
      const diff = getRecordSortTime(a) - getRecordSortTime(b);
      return dateSortAsc ? diff : -diff;
    });

    return filtered;
  };

  const filteredRecords = getFilteredRecords();
  const hasPartnerColumn = records.some(record => Boolean(resolveFuelRecordPartnerName(record)));
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  const filteredTotalRecords = filteredRecords.length;
  const filteredTotalLitros = filteredRecords.reduce((sum, r) => sum + r.litros, 0);
  const filteredTotalValue = filteredRecords.reduce((sum, r) => sum + r.valor_total, 0);

  const getFileExtension = (file: File): string => {
    const name = file.name.toLowerCase();
    const ext = name.split('.').pop() || '';
    return ext;
  };

  const uploadFile = async (file: File | null, fieldName: string): Promise<string | null> => {
    if (!file) return null;
    try {
      const timestamp = Date.now();
      const extension = getFileExtension(file);
      const sanitizedFileName = file.name
        .replace(/[^a-zA-Z0-9.\-_]/g, "_")
        .substring(0, 100);
      const fileName = `${client.id}/${aircraft.id}/${timestamp}-${fieldName}-${sanitizedFileName}`;
      const { error } = await supabase.storage.from("abastecimento").upload(fileName, file);
      if (error) {
        toast.error(`Upload falhou - ${fieldName}: ${getErrorMessage(error)}`);
        return null;
      }
      const { data } = supabase.storage.from("abastecimento").getPublicUrl(fileName);
      return `${data.publicUrl}||${extension}`;
    } catch (err: any) {
      toast.error(`Erro de upload - ${fieldName}: ${getErrorMessage(err)}`);
      return null;
    }
  };

  const parseFileUrl = (urlWithExt: string | null | undefined, fieldName?: string): { url: string; extension: string } => {
    if (!urlWithExt) return { url: '', extension: '' };
    const parts = urlWithExt.split('||');
    if (parts.length === 2) {
      return { url: parts[0], extension: parts[1].toLowerCase() };
    }
    if (fieldName && ['nota', 'boleto'].includes(fieldName)) {
      return { url: urlWithExt, extension: 'pdf' };
    }
    return { url: urlWithExt, extension: '' };
  };

  const getFileType = (extension: string): 'pdf' | 'image' => {
    return ['pdf'].includes(extension) ? 'pdf' : 'image';
  };

  const clearAttachment = (
    fileKey: 'comanda_file' | 'nota_file' | 'boleto_file' | 'comprovante_file',
    urlKey: 'comanda_url' | 'nota_url' | 'boleto_url' | 'comprovante_url'
  ) => {
    setFormData(prev => ({ ...prev, [fileKey]: null, [urlKey]: "" }));
    setUploadedFiles(prev => ({ ...prev, [urlKey]: "" }));
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    fileKey: 'comanda_file' | 'nota_file' | 'boleto_file' | 'comprovante_file',
    urlKey: 'comanda_url' | 'nota_url' | 'boleto_url' | 'comprovante_url'
  ) => {
    const file = e.target.files?.[0] ?? null;
    setFormData(prev => ({ ...prev, [fileKey]: file }));
    if (file) {
      try {
        const preview = URL.createObjectURL(file);
        setUploadedFiles(prev => ({ ...prev, [urlKey]: preview }));
      } catch (err) {
        // ignore preview errors
      }
    } else {
      setUploadedFiles(prev => ({ ...prev, [urlKey]: "" }));
    }
  };

  // Submit simplificado: antes havia uma etapa de "confirmação" quando a comanda
  // vinha vazia, mas o AlertDialog correspondente nunca era renderizado — então
  // o botão "Criar" parecia sem ação. Agora o submit salva diretamente.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveRecord();
  };

  const criarLancamentosRateio = async (
    abastecimentoId: string,
    valorTotal: number,
    notaUrl: string,
    boletoUrl: string,
    comprovanteUrl: string
  ) => {
    try {
      const selectedPartner = clientPartners.find(p => p.id === formData.client_id);
      if (!selectedPartner) return;

      const mainClientEntry = clientPartners.find(p => p.isMainClient);
      const clienteIdParaRateio = mainClientEntry?.id || client.id;

      const sociosParaRateio = selectedPartner.isMainClient
        ? clientPartners.filter(p => !p.isMainClient)
        : [selectedPartner];

      if (sociosParaRateio.length === 0) {
        toast.warning("Cliente sem sócios cadastrados — nenhum rateio foi gerado, apenas o abastecimento.");
        return;
      }

      const descricao = `Abastecimento ${formData.trecho || ""}`.trim();
      const fornecedorNome = formData.abastecedor_id
        ? suppliers.find(s => s.id === formData.abastecedor_id)?.nome_fornecedor || null
        : null;
      const dataVencimento = formData.status === "pendente"
        ? (formData.data_vencimento_boleto || formData.data)
        : formData.data;
      const pago = formData.status === "pago";

      const { data: contaApagar, error: capError } = await (supabase as any)
        .from("contas_apagar")
        .insert({
          clientes_id: clienteIdParaRateio,
          aeronave_registro: aircraft.matricula,
          descricao,
          valor: valorTotal,
          categoria: "Combustível",
          status: pago ? "pago" : "pendente",
          data_vencimento: dataVencimento,
          data_pagamento: pago ? formData.data_pagamento : null,
          fornecedor_nome: fornecedorNome,
          nf_numero: formData.nf || null,
          possui_nf: !!formData.nf,
          nf_url: notaUrl || null,
          possui_boleto: !!boletoUrl,
          boleto_url: boletoUrl || null,
          comprovante_pagamento_url: comprovanteUrl || null,
          criado_por: user?.id || null,
        })
        .select("id")
        .single();

      if (capError || !contaApagar) {
        console.error("Erro ao criar contas a pagar:", capError);
        toast.error("Abastecimento salvo, mas houve erro ao gerar o contas a pagar");
        return;
      }

      const valorPorSocio = valorTotal / sociosParaRateio.length;

      for (const socio of sociosParaRateio) {
        const { data: movimentacao, error: movError } = await (supabase as any)
          .from("movimentacoes")
          .insert({
            descricao,
            tipo: "despesa",
            tipo_caixa: "cliente",
            valor_rateado: valorPorSocio,
            data_emissao: formData.data,
            data_vencimento: dataVencimento,
            data_pagamento: pago ? formData.data_pagamento : null,
            aeronave_id: aircraft.id,
            clientes_id: clienteIdParaRateio,
            socio_id: socio.id,
            contas_apagar_id: contaApagar.id,
            status: pago ? "pago" : "pendente",
            forma_pagamento: formData.tipo_faturamento || null,
            fornecedor_nome: fornecedorNome,
            numero_nf: formData.nf || null,
            nf_url: notaUrl || null,
            boleto_url: boletoUrl || null,
            comprovante_url: comprovanteUrl || null,
            criado_por: user?.id || null,
          })
          .select("id")
          .single();

        if (movError || !movimentacao) {
          console.error("Erro ao criar movimentação:", movError);
          continue;
        }

        const { error: ratError } = await (supabase as any)
          .from("rateio_despesas")
          .insert({
            despesa_id: movimentacao.id,
            fonte_despesa: "abastecimento",
            tipo_rateio: "VARIAVEL_POR_HORA",
            fluxo: "SAIDA",
            data_vencimento: dataVencimento,
            data_pagamento: pago ? formData.data_pagamento : null,
            fornecedor_nome: fornecedorNome,
            cliente_id: clienteIdParaRateio,
            socio_id: socio.id,
            aeronave_id: aircraft.id,
            aeronave_registro: aircraft.matricula,
            descricao_despesa: descricao,
            valor_total: valorTotal,
            valor_rateado: valorPorSocio,
            pago_por: "CLIENTE",
            status: "pendente",
            numero_nf: formData.nf || null,
            nf_url: notaUrl || null,
            boleto_url: boletoUrl || null,
            comprovante_url: comprovanteUrl || null,
            abastecimento_id: abastecimentoId,
          });

        if (ratError) console.error("Erro ao criar rateio:", ratError);
      }
    } catch (err) {
      console.error("Erro ao gerar rateio do abastecimento:", err);
      toast.error("Abastecimento salvo, mas houve erro ao gerar o rateio entre os sócios");
    }
  };

  /**
   * Propaga a edição do abastecimento (valores, datas, status e anexos)
   * para o rateio de despesas, as movimentações e o contas a pagar ligados a ele.
   */
  const atualizarLancamentosRateio = async (
    abastecimentoId: string,
    valorTotal: number,
    notaUrl: string,
    boletoUrl: string,
    comprovanteUrl: string
  ) => {
    try {
      const { data: rateios, error: rateioFetchError } = await (supabase as any)
        .from("rateio_despesas")
        .select("id, despesa_id")
        .eq("abastecimento_id", abastecimentoId);

      if (rateioFetchError) {
        console.error("Erro ao buscar rateios do abastecimento:", rateioFetchError);
        return;
      }
      if (!rateios || rateios.length === 0) return;

      const descricao = `Abastecimento ${formData.trecho || ""}`.trim();
      const fornecedorNome = formData.abastecedor_id
        ? suppliers.find(s => s.id === formData.abastecedor_id)?.nome_fornecedor || null
        : null;
      const pago = formData.status === "pago";
      const dataVencimento = formData.status === "pendente"
        ? (formData.data_vencimento_boleto || formData.data)
        : formData.data;
      const dataPagamento = pago ? formData.data_pagamento : null;
      const valorPorSocio = valorTotal / rateios.length;

      const comuns = {
        data_vencimento: dataVencimento,
        data_pagamento: dataPagamento,
        fornecedor_nome: fornecedorNome,
        descricao_despesa: descricao,
        valor_total: valorTotal,
        valor_rateado: valorPorSocio,
        status: pago ? "pago" : "pendente",
        numero_nf: formData.nf || null,
        nf_url: notaUrl || null,
        boleto_url: boletoUrl || null,
        comprovante_url: comprovanteUrl || null,
      };

      const { error: ratUpdError } = await (supabase as any)
        .from("rateio_despesas")
        .update(comuns)
        .eq("abastecimento_id", abastecimentoId);
      if (ratUpdError) console.error("Erro ao atualizar rateio:", ratUpdError);

      const movIds = rateios.map((r: any) => r.despesa_id).filter(Boolean);
      if (movIds.length) {
        const { data: movs, error: movUpdError } = await (supabase as any)
          .from("movimentacoes")
          .update({
            descricao,
            valor_rateado: valorPorSocio,
            data_emissao: formData.data,
            data_vencimento: dataVencimento,
            data_pagamento: dataPagamento,
            status: pago ? "pago" : "pendente",
            forma_pagamento: formData.tipo_faturamento || null,
            fornecedor_nome: fornecedorNome,
            numero_nf: formData.nf || null,
            nf_url: notaUrl || null,
            boleto_url: boletoUrl || null,
            comprovante_url: comprovanteUrl || null,
          })
          .in("id", movIds)
          .select("contas_apagar_id");
        if (movUpdError) console.error("Erro ao atualizar movimentações:", movUpdError);

        const capIds = Array.from(
          new Set((movs || []).map((m: any) => m.contas_apagar_id).filter(Boolean))
        );
        if (capIds.length) {
          const { error: capUpdError } = await (supabase as any)
            .from("contas_apagar")
            .update({
              descricao,
              valor: valorTotal,
              status: pago ? "pago" : "pendente",
              data_vencimento: dataVencimento,
              data_pagamento: dataPagamento,
              fornecedor_nome: fornecedorNome,
              nf_numero: formData.nf || null,
              possui_nf: !!formData.nf,
              nf_url: notaUrl || null,
              possui_boleto: !!boletoUrl,
              boleto_url: boletoUrl || null,
              comprovante_pagamento_url: comprovanteUrl || null,
            })
            .in("id", capIds);
          if (capUpdError) console.error("Erro ao atualizar contas a pagar:", capUpdError);
        }
      }
    } catch (err) {
      console.error("Erro ao sincronizar rateio do abastecimento:", err);
      toast.error("Abastecimento atualizado, mas houve erro ao sincronizar o rateio");
    }
  };



  async function saveRecord() {
    setIsUploading(true);
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

      // Anexos adicionados manualmente pelo usuário têm prioridade; caso a linha
      // não exista, mantém o arquivo que já estava salvo no registro.
      let comandaUrl = anexoUrlPorTipo(anexos, "comanda") || uploadedFiles.comanda_url;
      let notaUrl = anexoUrlPorTipo(anexos, "nf") || uploadedFiles.nota_url;
      let boletoUrl = anexoUrlPorTipo(anexos, "boleto") || uploadedFiles.boleto_url;
      let comprovanteUrl =
        anexoUrlPorTipo(anexos, "comprovante") ||
        anexoUrlPorTipo(anexos, "recibo") ||
        uploadedFiles.comprovante_url;

      const comandaNumero = anexoNumeroPorTipo(anexos, "comanda") || formData.comanda;
      const nfNumero = anexoNumeroPorTipo(anexos, "nf") || formData.nf;


      let statusFinal = formData.status || "pendente";
      if (statusFinal === "pago") {
        const temComprovante = comprovanteUrl || (editingRecord as any)?.comprovante_pagamento || (editingRecord as any)?.comprovante_url;
        const temDataPagamento = formData.data_pagamento;
        if (!temComprovante || !temDataPagamento) {
          toast.warning("Não é possível marcar como pago sem comprovante e data de pagamento. Salvando como 'pendente'.");
          statusFinal = "pendente";
        }
      }

      const dateStr = formData.data;
      const dateParts = dateStr.split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10);
      const day = parseInt(dateParts[2], 10);

      const brazilDate = new Date(year, month - 1, day, 3, 0, 0, 0);
      const isoDateString = brazilDate.toISOString();

      if (!formData.client_id.trim()) {
        toast.error("Selecione um cliente para o abastecimento");
        setIsUploading(false);
        return;
      }

      const supplierName = formData.abastecedor_id ? suppliers.find(s => s.id === formData.abastecedor_id)?.nome_fornecedor || null : null;
      const observacaoFinal = formData.observacao || null;
      const selectedPartner = clientPartners.find(p => p.id === formData.client_id);
      const partnerNameValue = (selectedPartner && !selectedPartner.isMainClient) ? selectedPartner.nome : null;
      const totalFromField = formData.valor_total ? parseFloat(formData.valor_total) : NaN;
      const baseTotal = !isNaN(totalFromField) ? totalFromField : litros * valorUnitario;
      const descontoField = formData.desconto ? parseFloat(formData.desconto) : NaN;
      const desconto = !isNaN(descontoField)
        ? descontoField
        : Math.max(0, litros * valorUnitario - baseTotal);
      const valorTotal = baseTotal;

      // Colunas corretas do schema da tabela abastecimentos:
      const recordData: any = {
        id_clientes: client.id,
        aeronave_id: aircraft.id,
        abastecedor_id: formData.abastecedor_id || null,
        data: isoDateString,
        trecho: formData.trecho || "",
        local: formData.local || "",
        comanda: comandaNumero || null,
        litros: litros,
        valor_unitario: valorUnitario,
        desconto: desconto || 0,
        abastecimento_galoes: formData.abastecimento_galoes ? parseFloat(formData.abastecimento_galoes) : null,
        abastecedor: supplierName,
        status: statusFinal,
        tipo_faturamento: formData.tipo_faturamento || null,
        forma_pagamento: formData.tipo_faturamento || null,
        banco: formData.banco || null,
        data_vencimento_boleto: statusFinal === "pendente" ? formData.data_vencimento_boleto || null : null,
        observacao: observacaoFinal,
        socio_nome: partnerNameValue ? partnerNameValue.replace(/^\[|\]$/g, "") : null,
        comanda_url: comandaUrl || null,
        nota_url: notaUrl || null,
        boleto_url: boletoUrl || null,
        comprovante_pagamento: comprovanteUrl || null,
        comprovante_url: comprovanteUrl || null,
        data_pagamento: statusFinal === "pago" ? formData.data_pagamento : null,
        criado_por: currentUserName || null,
        logbook_entry_id: (linkToLogbook && selectedFlightId) ? selectedFlightId : null,
        nf: nfNumero || null,
        tipo_combustivel: formData.combustivel_tipo || null,
        descricao: formData.combustivel_tipo ? `Combustível: ${formData.combustivel_tipo.toUpperCase()}` : null,
      };

      if (editingRecord) {
        const { error } = await supabase.from("abastecimentos").update(recordData).eq("id", editingRecord.id);
        if (error) {
          toast.error(`Erro ao atualizar: ${getErrorMessage(error)}`);
          return;
        }
        await atualizarLancamentosRateio(editingRecord.id, litros * valorUnitario, notaUrl, boletoUrl, comprovanteUrl);
        toast.success("Registro atualizado com sucesso");
      } else {
        const { data: inserted, error } = await supabase
          .from("abastecimentos")
          .insert(recordData)
          .select("id")
          .single();
        if (error) {
          toast.error(`Erro ao salvar: ${getErrorMessage(error)}`);
          return;
        }
        toast.success("Registro criado com sucesso");
        if (inserted?.id) {
          await criarLancamentosRateio(inserted.id, litros * valorUnitario, notaUrl, boletoUrl, comprovanteUrl);
        }
      }
      resetForm();
      setIsDialogOpen(false);
      loadRecords();
    } catch (err: any) {
      toast.error(`Erro: ${getErrorMessage(err)}`);
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
      const mainClient = getClientPartners(selectedClient.id, selectedClient.razao_social);
      const dbPartners = await getClientPartnersFromDB(selectedClient.id);
      let allPartners = [...mainClient, ...dbPartners];

      const { data: aircraftData, error: aircraftError } = await (supabase as any)
        .from('cotistas_aeronave')
        .select('id_clientes, percentual_sociedade')
        .eq('id_aeronave', aircraft.id);

      if (!aircraftError) {
        const percentageMap: { [key: string]: number } = {};
        (aircraftData || []).forEach((item: any) => {
          percentageMap[item.id_clientes] = item.percentual_sociedade;
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
    let supplierRecord = suppliers.find(s => s.id === record.abastecedor_id) || suppliers.find(s => s.nome_fornecedor === record.abastecedor);
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
      origem_aerodromo: (record.trecho || "").split(/\s*[xX]\s*/)[0]?.trim() || "",
      destino_aerodromo: (record.trecho || "").split(/\s*[xX]\s*/)[1]?.trim() || "",
      comanda: record.comanda || "",
      litros: record.litros.toString(),
      valor_unitario: record.valor_unitario.toString(),
      desconto: Math.max(0, (record.litros * record.valor_unitario) - (record.valor_total || 0)).toFixed(2),
      valor_total: (record.valor_total || (record.litros * record.valor_unitario)).toString(),
      valor_total_manual: true,
      abastecimento_galoes: record.abastecimento_galoes?.toString() || "",
      abastecedor_id: record.abastecedor_id || supplierRecord?.id || "",
      combustivel_tipo: record.tipo_combustivel || (record.descricao?.toLowerCase().includes("avgas") ? "avgas" : record.descricao?.toLowerCase().includes("jet") ? "jet" : ""),
      client_id: record.id_clientes || record.client_id || client.id,
      partner_selected: record.socio_nome || (record.observacao?.includes("[Partner:") ? record.observacao.match(/\[Partner:([^\]]+)\]/)?.[1] || "" : ""),
      status: record.status || "pendente",
      tipo_faturamento: record.tipo_faturamento || record.forma_pagamento || "",
      banco: record.banco || "",
      data_vencimento_boleto: record.data_vencimento_boleto || "",
      observacao: record.observacao?.replace(/\[Partner:[^\]]+\]\s*/, "") || "",
      nf: record.nf || "",
      comanda_file: null,
      nota_file: null,
      boleto_file: null,
      comprovante_file: null,
      comanda_url: record.comanda_url || "",
      nota_url: record.nota_url || "",
      boleto_url: record.boleto_url || "",
      comprovante_url: record.comprovante_pagamento || record.comprovante_url || "",
      data_pagamento: record.data_pagamento || ""
    });
    setUploadedFiles({
      comanda_url: record.comanda_url || "",
      nota_url: record.nota_url || "",
      boleto_url: record.boleto_url || "",
      comprovante_url: record.comprovante_pagamento || record.comprovante_url || ""
    });
    // Só cria linhas de anexo para os documentos que realmente existem.
    const linhas: AnexoLinha[] = [];
    const push = (tipo: AnexoLinha["tipo"], url: string | null | undefined, numero?: string | null) => {
      if (!url) return;
      linhas.push({ id: crypto.randomUUID(), tipo, numero: numero || "", url, file: null, uploading: false });
    };
    push("comanda", record.comanda_url, record.comanda);
    push("nf", record.nota_url, record.nf);
    push("boleto", record.boleto_url);
    push("comprovante", record.comprovante_pagamento || record.comprovante_url);
    setAnexos(linhas);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este registro?")) return;
    const { error } = await supabase.from("abastecimentos").delete().eq("id", id);
    if (error) {
      toast.error(`Erro ao excluir: ${getErrorMessage(error)}`);
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
      desconto: "",
      valor_total: "",
      valor_total_manual: false,
      abastecimento_galoes: "",
      abastecedor_id: "",
      combustivel_tipo: "",
      client_id: client.id,
      partner_selected: "",
      status: "pendente",
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
    setAnexos([]);
    setLinkToLogbook(false);
    setSelectedFlightId("");
    setLogbookFlights([]);
    setSelectedFlightInfo(null);
    setPreviousDayFlightInfo(null);
  };

  /**
   * Exporta o relatório em PDF. Suporta dois modos:
   * - Mês/Ano: `month` = 1-12, ou null para "todos os meses do ano informado"
   * - Período personalizado: `dateFrom`/`dateTo` (yyyy-MM-dd) sobrepõem o filtro por mês/ano
   *   quando informados. Ambos são opcionais — se só um for passado, filtra pendente
   *   naquela ponta (ex: só dateFrom = "a partir dessa data").
   */
  const handleExportPDF = (month: number | null, year: string, dateFrom?: string | null, dateTo?: string | null) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const fromDate = dateFrom ? parseDateSafe(dateFrom) : null;
    const toDate = dateTo ? parseDateSafe(dateTo) : null;
    const useRange = Boolean(fromDate || toDate);

    let exportRecords = records.filter((r) => {
      const dateToUse = (r.status === "pago" && r.data_pagamento) ? r.data_pagamento : r.data;
      const recordDate = parseDateSafe(dateToUse);
      if (!recordDate) return false;

      if (useRange) {
        if (fromDate && recordDate < fromDate) return false;
        if (toDate && recordDate > toDate) return false;
        return true;
      }

      if (month !== null) {
        return recordDate.getMonth() + 1 === month && recordDate.getFullYear() === parseInt(year);
      }
      return recordDate.getFullYear() === parseInt(year);
    });

    const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    let periodLabel: string;
    if (useRange) {
      const fromLabel = fromDate ? formatDateBrazil(dateFrom) : "início";
      const toLabel = toDate ? formatDateBrazil(dateTo) : "hoje";
      periodLabel = `${fromLabel} até ${toLabel}`;
    } else {
      const monthLabel = month === null ? "Todos os meses" : MONTHS_PT[month - 1] || "Todos os meses";
      periodLabel = month !== null ? `${monthLabel} / ${year}` : year;
    }

    const totalLitros = exportRecords.reduce((sum, r) => sum + r.litros, 0);
    const totalValue = exportRecords.reduce((sum, r) => sum + r.valor_total, 0);

    const hasExportPartnerColumn = exportRecords.some(r => Boolean(resolveFuelRecordPartnerName(r)));
    const rowsHtml = exportRecords.map(r => `
      <tr>
        <td>${formatDateBrazil(r.data, "dd/MM/yyyy")}</td>
        <td>${r.trecho || "-"}</td>
        <td>${r.local || "-"}</td>
        <td>${r.comanda || "-"}</td>
        ${hasExportPartnerColumn ? `<td>${resolveFuelRecordPartnerName(r) || "-"}</td>` : ""}
        <td class="text-right">${r.litros.toFixed(2)}</td>
        <td class="text-right">R$ ${r.valor_unitario.toFixed(2)}</td>
        <td class="text-right">R$ ${r.valor_total.toFixed(2)}</td>
        <td class="text-right">${r.abastecimento_galoes?.toFixed(2) || "-"}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Controle de Abastecimento - ${displayClient.razao_social} - ${aircraft.matricula} - ${periodLabel}</title>
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
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">
              <h1>CONTROLE DE COMBUSTÍVEL</h1>
              <p>${displayClient.razao_social}</p>
              <p>${aircraft.matricula}</p>
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
                ${hasExportPartnerColumn ? `<th>CLIENTE</th>` : ""}
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
                <td colspan="${hasExportPartnerColumn ? 5 : 4}" class="text-right">TOTAIS</td>
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
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
            <Plane className="h-5 w-5 text-primary" />
            Registros de Abastecimento
          </h2>
          <p className="mt-0.5 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            {displayClient.razao_social} • {aircraft.matricula}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Exibir data</span>
          <Select value={dateColumnType} onValueChange={(value) => setDateColumnType(value as 'data' | 'data_pagamento')}>
            <SelectTrigger className="h-9 w-48 text-sm">
              <SelectValue placeholder="Data" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="data">Data do Abastecimento</SelectItem>
              <SelectItem value="data_pagamento">Data do Pagamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-border/60 bg-slate-950/45 shadow-none">
        <CardContent className="p-4 md:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Buscar</Label>
              <div className="relative mt-1.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Trecho, local, fornecedor, comanda, NF..."
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 border-border/70 bg-background/50 pl-9 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">CLIENTE</Label>
              <Select value={filterPartner} onValueChange={value => {
                setFilterPartner(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="!my-0 mt-1.5 h-9 border-border/70 bg-background/50 text-sm">
                  <SelectValue placeholder="Todos os sócios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="__no_partner__">Sem sócio (Cliente)</SelectItem>
                  {(() => {
                    const uniquePartners = Array.from(new Set(records.map(r => resolveFuelRecordPartnerName(r)).filter(Boolean))) as string[];
                    return uniquePartners.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mês</Label>
              <Select value={filterMonth} onValueChange={value => {
                setFilterMonth(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="!my-0 mt-1.5 h-9 border-border/70 bg-background/50 text-sm">
                  <SelectValue placeholder="Selecione um mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
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
              <Label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ano</Label>
              <Select value={filterYear} onValueChange={value => {
                setFilterYear(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="!my-0 mt-1.5 h-9 border-border/70 bg-background/50 text-sm">
                  <SelectValue placeholder="Selecione um ano" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => {
                    const year = (new Date().getFullYear() - i).toString();
                    return <SelectItem key={year} value={year}>{year}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Dialog open={isDialogOpen} onOpenChange={open => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="h-9 gap-2 bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-none hover:bg-primary-dark">
              <Plus className="h-5 w-5" />
              Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent className="flex flex-col max-w-2xl w-[95vw] max-h-[90vh]" style={{ zIndex: 1001 }}>
            <DialogHeader>
              <DialogTitle>{editingRecord ? "Editar Registro" : "Novo Registro"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-2 sm:pr-4 -mx-2 sm:-mx-4 px-2 sm:px-4">
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
                        setSelectedFlightInfo(null);
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
                                <span className="font-medium">{formatDateBrazil(flight.data_registro, "dd/MM/yy")}</span>
                                {' · '}
                                <span>{`${flight.departure_aerodrome} x ${flight.arrival_aerodrome}`}</span>
                                {flight.combustivel_adicionado && (
                                  <span className="text-muted-foreground"> · {flight.combustivel_adicionado}L</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {selectedFlightInfo && (
                      <div className="mt-3 p-3 rounded-lg space-y-2 bg-muted/50 border border-border">
                        <div>
                          <p className="text-xs font-semibold mb-1 text-primary">📅 Data Selecionada</p>
                          <p className="text-sm font-medium text-foreground">{formatDateBrazil(selectedFlightInfo.data_registro, "dd/MM/yy")}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold mb-1 text-primary">✈️ Trecho Selecionado</p>
                          <p className="text-sm font-medium text-foreground">{selectedFlightInfo.trecho || `${selectedFlightInfo.departure_aerodrome} x ${selectedFlightInfo.arrival_aerodrome}`}</p>
                        </div>
                        {(selectedFlightInfo.litros_combustivel_inicio_voo !== null && selectedFlightInfo.litros_combustivel_inicio_voo !== undefined) && (
                          <div>
                            <p className="text-xs font-semibold mb-1 text-primary">⛽ Combustível Antes do Abastecimento</p>
                            <p className="text-sm font-medium text-foreground">{selectedFlightInfo.litros_combustivel_inicio_voo}L</p>
                          </div>
                        )}
                        {(selectedFlightInfo.combustivel_adicionado !== null && selectedFlightInfo.combustivel_adicionado !== undefined) && (
                          <div>
                            <p className="text-xs font-semibold mb-1 text-primary">⛽ Litros Abastecidos</p>
                            <p className="text-sm font-medium text-foreground">{selectedFlightInfo.combustivel_adicionado}L</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-semibold mb-2 block">Data do Abastecimento</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={formData.data ? formatDateBrazil(formData.data, "dd/MM/yyyy") : ""} readOnly
                    placeholder="dd/mm/aaaa"
                    className="mt-1 h-9 text-sm"
                  />
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="mt-1" type="button">
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <UICalendar
                        mode="single"
                        selected={formData.data ? new Date(formData.data + "T00:00:00") : undefined}
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
                {linkToLogbook && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Preenchida automaticamente ao selecionar um voo — ajuste aqui se necessário.
                  </p>
                )}
              </div>

              <div>
                <Label className="text-sm font-semibold mb-2 block">Cliente</Label>
                <div className="space-y-2">
                  {clientPartners.length > 0 && (
                    <div className="space-y-2 border-l-2 border-primary/30 pl-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Cliente</p>
                      {clientPartners.filter(p => p.isMainClient).map(partner => {
                        const isSelected = formData.client_id === partner.id;
                        return (
                          <button
                            key={partner.id}
                            type="button"
                            onClick={() => setFormData({
                              ...formData,
                              client_id: partner.id,
                              partner_selected: ""
                            })}
                            className={`w-full p-3 rounded-lg text-left transition-all ${isSelected ? 'border-[3px] border-emerald-500 bg-emerald-500/15 shadow-lg' : 'border-2 bg-card border-border'}`}
                          >
                            <div className="flex items-center justify-between">
                              <p className={`text-sm font-medium ${isSelected ? 'text-emerald-600' : 'text-foreground'}`}>
                                {partner.nome}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {clientPartners.length > 1 && (
                    <div className="space-y-2 border-l-2 border-accent/30 pl-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Sócios</p>
                      {clientPartners.filter(p => !p.isMainClient).map(partner => {
                        const isSelected = formData.client_id === partner.id;
                        return (
                          <button
                            key={partner.id}
                            type="button"
                            onClick={() => setFormData({
                              ...formData,
                              client_id: partner.id,
                              partner_selected: partner.nome
                            })}
                            className={`w-full p-3 rounded-lg text-left transition-all ${isSelected ? 'border-[3px] border-emerald-500 bg-emerald-500/15 shadow-lg' : 'border-2 border-border'}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className={`text-sm font-medium ${isSelected ? 'text-emerald-600' : 'text-foreground'}`}>
                                {partner.nome}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Origem <span className="text-red-500">*</span></Label>
                  <SearchableCombobox
                    items={aerodromeItems}
                    value={formData.origem_aerodromo}
                    onChange={(id) => setFormData(prev => ({ ...prev, origem_aerodromo: id || "" }))}
                    placeholder={isLoadingAerodromes ? "Carregando..." : "Selecione o aeródromo"}
                    searchPlaceholder="Buscar por designativo ou nome..."
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Destino <span className="text-red-500">*</span></Label>
                  <SearchableCombobox
                    items={aerodromeItems}
                    value={formData.destino_aerodromo}
                    onChange={(id) => setFormData(prev => ({ ...prev, destino_aerodromo: id || "" }))}
                    placeholder={isLoadingAerodromes ? "Carregando..." : "Selecione o aeródromo"}
                    searchPlaceholder="Buscar por designativo ou nome..."
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Trecho <span className="text-red-500">*</span></Label>
                <Input value={formData.trecho} readOnly placeholder="Preenchido automaticamente" className="mt-1 h-9 text-sm bg-muted/40" required />
                {(nomeAerodromo(formData.origem_aerodromo) || nomeAerodromo(formData.destino_aerodromo)) && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {nomeAerodromo(formData.origem_aerodromo) || formData.origem_aerodromo}
                    {" → "}
                    {nomeAerodromo(formData.destino_aerodromo) || formData.destino_aerodromo}
                  </p>
                )}
              </div>


              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Fornecedor <span className="text-red-500">*</span></Label>
                  <Combobox options={suppliers.map(s => ({
                    value: s.id,
                    label: `${s.nome_fornecedor} (${s.nome_cidade})`
                  }))} value={formData.abastecedor_id} onValueChange={value => {
                    const selectedSupplier = suppliers.find(s => s.id === value);
                    setFormData({
                      ...formData,
                      abastecedor_id: value,
                      local: selectedSupplier?.nome_cidade || formData.local
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

              <div>
                <Label className="text-xs text-muted-foreground">Tipo de Combustível <span className="text-red-500">*</span></Label>
                <Select value={formData.combustivel_tipo} onValueChange={value => {
                  setFormData({
                    ...formData,
                    combustivel_tipo: value
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

              <div>
                <Label className="text-xs text-muted-foreground">Valor Unit. (R$) <span className="text-red-500">*</span></Label>
                <Input type="number" step="0.0001" value={formData.valor_unitario} onChange={e => setFormData({
                  ...formData,
                  valor_unitario: e.target.value,
                  valor_total_manual: false,
                })} placeholder="Preço do combustível" className="mt-1 h-9 text-sm" required />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Tipo de Faturamento <span className="text-red-500">*</span></Label>
                  <Select value={formData.tipo_faturamento} onValueChange={value => setFormData({
                    ...formData,
                    tipo_faturamento: value
                  })}>
                    <SelectTrigger className="mt-1 h-9 text-sm">
                      <SelectValue placeholder="Selecione" />
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
                  <Select value={formData.status} onValueChange={value => setFormData({
                    ...formData,
                    status: value
                  })}>
                    <SelectTrigger className="mt-1 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.status === "pago" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Data do Pagamento <span className="text-red-500">*</span></Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="text"
                        readOnly
                        placeholder="dd/mm/aaaa"
                        value={formData.data_pagamento ? formatDateBrazil(formData.data_pagamento, "dd/MM/yyyy") : ""}
                        className="h-9 text-sm"
                      />
                      <Popover open={paymentDateCalendarOpen} onOpenChange={setPaymentDateCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="icon">
                            <CalendarIcon className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <UICalendar
                            mode="single"
                            selected={formData.data_pagamento ? new Date(formData.data_pagamento + "T00:00:00") : undefined}
                            onSelect={(date) => {
                              if (!date) return;
                              setFormData(prev => ({ ...prev, data_pagamento: format(date, "yyyy-MM-dd") }));
                              setPaymentDateCalendarOpen(false);
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
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
                        {bankInstitutions.map(bank => {
                          const label = `${bank.banco}${bank.numero_conta ? ` • ${bank.numero_conta.trim()}` : ""}`;
                          return <SelectItem key={bank.id} value={label}>{label}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Total em Litros <span className="text-red-500">*</span></Label>
                  <Input type="number" step="0.01" value={formData.litros} onChange={e => setFormData({
                    ...formData,
                    litros: e.target.value
                  })} placeholder="0.00" required className="mt-1 h-9 text-sm" />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Desconto (R$)</Label>
                  <Input type="number" step="0.01" value={formData.desconto} onChange={e => setFormData({
                    ...formData,
                    desconto: e.target.value,
                    valor_total_manual: false,
                  })} placeholder="0.00" className="mt-1 h-9 text-sm" />
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

              <div>
                <Label className="text-xs text-muted-foreground">Observações</Label>
                <textarea
                  value={formData.observacao}
                  onChange={e => setFormData({
                    ...formData,
                    observacao: e.target.value
                  })}
                  placeholder="Adicione observações..."
                  className="mt-1 w-full min-h-20 p-2 text-sm border border-input rounded-md bg-background text-foreground"
                />
              </div>

              <div className="rounded-lg border border-border/50 p-4">
                <AnexosDinamicosField
                  anexos={anexos}
                  onChange={handleAnexosChange}
                  storagePrefix={`abastecimento/${editingRecord?.id || 'new'}`}
                  bucket="abastecimento"
                  onView={(url, name, type) => setViewingAttachment({ url, type: type || 'pdf', name: name || 'Anexo' })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isUploading}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isUploading}>
                  {isUploading ? "Salvando..." : editingRecord ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Visualizador de anexos em tela cheia (fora do dialog de edição) */}
        <Dialog open={!!viewingAttachment} onOpenChange={(open) => !open && setViewingAttachment(null)}>
          <DialogContent className="z-[1100] max-w-[96vw] w-[96vw] h-[94vh] p-0 flex flex-col overflow-hidden">
            <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between gap-3 space-y-0">
              <DialogTitle className="truncate text-base">{viewingAttachment?.name || "Anexo"}</DialogTitle>
              <div className="flex items-center gap-2 pr-8">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => viewingAttachment && window.open(viewingAttachment.url, "_blank")}
                >
                  Abrir em nova aba
                </Button>
              </div>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-auto bg-muted/30 flex items-center justify-center p-2">
              {viewingAttachment?.type === "pdf" ? (
                <iframe
                  src={viewingAttachment.url}
                  title={viewingAttachment.name}
                  className="w-full h-full border-0 bg-white rounded"
                />
              ) : viewingAttachment ? (
                <img
                  src={viewingAttachment.url}
                  alt={viewingAttachment.name}
                  className="max-w-full max-h-full object-contain rounded shadow-lg"
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>



        <Button
          onClick={() => setIsExportModalOpen(true)}
          variant="outline"
          className="h-9 gap-2 border-border/70 bg-background/50 px-3 text-sm font-medium shadow-none hover:bg-muted/60"
        >
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <Card className="overflow-hidden border-border/60 bg-slate-950/30 shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1120px] overflow-hidden rounded-lg">
              <TableHeader className="bg-slate-950/75">
                <TableRow className="border-b border-border/60 hover:bg-transparent">
                  <TableHead className="h-10 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setDateSortAsc(prev => !prev)}
                      className="inline-flex items-center gap-2 text-left"
                    >
                      Data
                      {dateSortAsc ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </TableHead>
                  <TableHead className="h-10 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Trecho</TableHead>
                  <TableHead className="h-10 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Local</TableHead>
                  <TableHead className="h-10 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Comanda</TableHead>
                  <TableHead className="h-10 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">N.F</TableHead>
                  <TableHead className="h-10 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Fornecedor</TableHead>
                  {hasPartnerColumn && <TableHead className="h-10 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cliente</TableHead>}
                  <TableHead className="h-10 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Status</TableHead>
                  <TableHead className="h-10 px-4 text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Litros</TableHead>
                  <TableHead className="h-10 px-4 text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Valor Unit.</TableHead>
                  <TableHead className="h-10 px-4 text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Valor Total</TableHead>
                  <TableHead className="h-10 px-4 text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRecords.map(record => (
                  <TableRow
                    key={record.id}
                    id={`fuel-record-${record.id}`}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <TableCell className="px-4 py-3 text-xs font-medium text-foreground">
                      {formatDateBrazil(getRecordDateValue(record), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-muted-foreground">{record.trecho || "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-xs text-muted-foreground">{record.local || "-"}</TableCell>
                    <TableCell className="px-4 py-3 font-mono text-xs text-foreground">
                      {record.comanda_url ? (
                        <button
                          type="button"
                          onClick={() => setViewingAttachment({ url: record.comanda_url!, type: 'pdf', name: 'Comanda' })}
                          className="text-sky-400 hover:text-sky-200 hover:underline"
                        >
                          {record.comanda || "-"}
                        </button>
                      ) : (
                        record.comanda || "-"
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-mono text-xs text-foreground">
                      {record.nota_url ? (
                        <button
                          type="button"
                          onClick={() => setViewingAttachment({ url: record.nota_url!, type: 'pdf', name: 'Nota Fiscal' })}
                          className="text-sky-400 hover:text-sky-200 hover:underline"
                        >
                          {record.nf || "-"}
                        </button>
                      ) : (
                        record.nf || "-"
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-muted-foreground">{record.abastecedor || "-"}</TableCell>
                    {hasPartnerColumn && (
                      <TableCell className="px-4 py-3 text-xs font-medium text-muted-foreground">{resolveFuelRecordPartnerName(record) || "-"}</TableCell>
                    )}
                    <TableCell>
                      {record.status === "pago" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                          <FileCheck className="h-4 w-4" /> Pago
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
                          <DollarSign className="h-4 w-4" /> Pendente
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono text-xs font-medium text-foreground">{record.litros.toFixed(2)}</TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">R$ {record.valor_unitario.toFixed(2)}</TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono text-xs font-semibold text-success">R$ {record.valor_total.toFixed(2)}</TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(record)} className="h-8 w-8">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)} className="h-8 w-8">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ExportFuelRecordsModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        records={records}
        clientName={displayClient.razao_social}
        aircraftRegistration={aircraft.matricula}
        onExportPDF={handleExportPDF}
      />
    </div>
  );
}
