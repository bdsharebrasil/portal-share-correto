import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Download, Edit, Trash2, ChevronLeft, Plane, TrendingUp, FileUp, X, Eye, FileText, Image as ImageIcon, FileCheck, DollarSign, BookOpen } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModernFileUpload } from "@/components/ui/modern-file-upload";
import { ExportFuelRecordsModal } from "./ExportFuelRecordsModal";
interface Client {
  id: string;
  company_name: string;
}
interface Aircraft {
  id: string;
  registration: string;
  year: number | null;
}
interface Partner {
  id: string;
  name: string;
  cpf?: string;
  isMainClient?: boolean;
  share_percentage?: number;
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
  partner_name?: string | null;
}
interface FuelSupplier {
  id: string;
  supplier_name: string;
  city_name: string;
  icao_code: string;
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
const formatDateBrazil = (dateValue: string | Date, formatStr: string = "dd/MM/yyyy"): string => {
  let dateObj: Date;
  if (typeof dateValue === 'string') {
    // If it's a date-only string (YYYY-MM-DD), parse it directly without timezone conversion
    if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateValue.split('-').map(Number);
      dateObj = new Date(year, month - 1, day);
    } else {
      // If it's an ISO timestamp, extract the date part
      const datePart = dateValue.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      dateObj = new Date(year, month - 1, day);
    }
  } else {
    dateObj = dateValue;
  }
  return format(dateObj, formatStr);
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

  const [formData, setFormData] = useState({
    data: "",
    trecho: "",
    local: "",
    comanda: "",
    litros: "",
    valor_unitario: "",
    abastecimento_galoes: "",
    abastecedor_id: "",
    client_id: "",
    partner_selected: "",
    status_pagamento: "em aberto",
    tipo_faturamento: "",
    observacao: "",
    comanda_file: null as File | null,
    nota_file: null as File | null,
    boleto_file: null as File | null,
    comanda_url: "",
    nota_url: "",
    boleto_url: ""
  });
  const [uploadedFiles, setUploadedFiles] = useState({
    comanda_url: "",
    nota_url: "",
    boleto_url: ""
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
    if (linkToLogbook && aircraft.id) {
      loadLogbookFlights();
    }
  }, [linkToLogbook, aircraft.id, formData.client_id]);

  const loadLogbookFlights = async () => {
    setLoadingFlights(true);
    try {
      // Get IDs of flights already linked to abastecimentos
      const { data: linkedAbast } = await supabase
        .from('abastecimentos')
        .select('logbook_entry_id')
        .eq('aeronave_id', aircraft.id)
        .not('logbook_entry_id', 'is', null);

      const linkedIds = (linkedAbast || []).map(a => a.logbook_entry_id).filter(Boolean);

      // Get flights with fuel_added > 0 for this aircraft
      let query = supabase
        .from('logbook_entries')
        .select('id, entry_date, departure_aerodrome, arrival_aerodrome, trecho, fuel_added, fuel_liters, client_id, total_time')
        .eq('aircraft_id', aircraft.id)
        .gt('fuel_added', 0)
        .order('entry_date', { ascending: false })
        .limit(50);

      // Filter by client if selected
      const effectiveClientId = formData.client_id || client.id;
      if (effectiveClientId) {
        query = query.eq('client_id', effectiveClientId);
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

  const handleFlightSelect = (flightId: string) => {
    setSelectedFlightId(flightId);
    const flight = logbookFlights.find(f => f.id === flightId);
    if (flight) {
      const trecho = flight.trecho || `${flight.departure_aerodrome} → ${flight.arrival_aerodrome}`;
      setFormData(prev => ({
        ...prev,
        trecho,
        data: flight.entry_date,
        litros: flight.fuel_liters?.toString() || flight.fuel_added?.toString() || prev.litros,
      }));
    }
  };

  useEffect(() => {
    loadRecords();
    loadSuppliers();
    loadClients();
    loadClientPartners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraft.id, currentClientId]);

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
      } = await supabase.from("fuel_suppliers").select("id, supplier_name, city_name, icao_code").order("supplier_name", {
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
      share_percentage: 0
    }];
  };
  const loadPartnerPercentages = async (partnersData: Partner[]): Promise<Partner[]> => {
    try {
      const {
        data,
        error
      } = await supabase.from("client_aircraft").select("client_id, share_percentage").eq("aircraft_id", aircraft.id);
      if (error) {
        console.error("Error loading partner percentages:", error);
        return partnersData;
      }

      const percentageMap: {
        [key: string]: number;
      } = {};
      (data || []).forEach(item => {
        percentageMap[item.client_id] = item.share_percentage;
      });

      return partnersData.map(partner => ({
        ...partner,
        share_percentage: percentageMap[partner.id.split('-')[0]] || 0
      }));
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      console.error(`Error loading percentages: ${errorMessage}`);
      return partnersData;
    }
  };
  const loadClients = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("clients").select("id, company_name").order("company_name", {
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
      setDisplayClient({ id: "all", company_name: "Todos os Clientes" });
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
    let partners = getClientPartners(clientData.id, clientData.company_name);
    const { data: aircraftData, error: aircraftError } = await supabase
      .from('client_aircraft')
      .select('share_percentage, aircraft_id')
      .eq('client_id', clientData.id);
    if (aircraftError) {
      console.error('Error loading aircraft shares:', aircraftError);
    } else {
      partners = partners.map(partner => {
        const share = aircraftData.find(a => a.aircraft_id === aircraft.id);
        return { ...partner, share_percentage: share?.share_percentage || partner.share_percentage };
      });
    }
    const partnersWithPercentages = partners.map(partner => ({
      ...partner,
      share_percentage: aircraftData.find(a => a.aircraft_id === aircraft.id)?.share_percentage || partner.share_percentage
    }));
    setClientPartners(partnersWithPercentages);
  };
  const loadRecords = async () => {
    let query = supabase.from("abastecimentos").select("*").eq("aeronave_id", aircraft.id);
    if (currentClientId !== "all") {
      query = query.eq("client_id", currentClientId);
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
        filtered = filtered.filter(record => !record.partner_name);
      } else {
        filtered = filtered.filter(record => record.partner_name === filterPartner);
      }
    }
    
    // Filter by month/year
    if (filterMonth !== "all" && filterYear) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.data);
        const recordMonth = (recordDate.getMonth() + 1).toString().padStart(2, '0');
        const recordYear = recordDate.getFullYear().toString();
        return recordMonth === filterMonth && recordYear === filterYear;
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
  const uploadFile = async (file: File | null, fieldName: string): Promise<string | null> => {
    if (!file) return null;
    try {
      const timestamp = Date.now();
      const sanitizedFileName = file.name
        .replace(/[^a-zA-Z0-9.\-_]/g, "_")
        .substring(0, 100);
      const fileName = `${client.id}/${aircraft.id}/${timestamp}-${fieldName}-${sanitizedFileName}`;
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
      return data.publicUrl;
    } catch (err: any) {
      const errorMessage = getErrorMessage(err);
      toast.error(`Erro de upload - ${fieldName}: ${errorMessage}`);
      console.error(`Upload exception for ${fieldName}:`, err);
      return null;
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.comanda.trim() && !editingRecord) {
      setShowConfirmation(true);
      return;
    }
    await saveRecord();
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
      const valorUnitario = parseFloat(formData.valor_unitario);
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
      if (formData.comanda_file && !comandaUrl) {
        comandaUrl = (await uploadFile(formData.comanda_file, "comanda")) || "";
      }
      if (formData.nota_file && !notaUrl) {
        notaUrl = (await uploadFile(formData.nota_file, "nota-fiscal")) || "";
      }
      if (formData.boleto_file && !boletoUrl) {
        boletoUrl = (await uploadFile(formData.boleto_file, "boleto")) || "";
      }

      const dateStr = formData.data;
      const dateParts = dateStr.split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10);
      const day = parseInt(dateParts[2], 10);

      // Create a date at midnight Brazil time (UTC-3 = 03:00 UTC)
      const brazilDate = new Date(year, month - 1, day, 3, 0, 0, 0);
      const isoDateString = brazilDate.toISOString();

      if (!formData.client_id.trim()) {
        toast.error("Selecione um cliente para o abastecimento");
        setIsUploading(false);
        return;
      }
      const supplierName = formData.abastecedor_id ? suppliers.find(s => s.id === formData.abastecedor_id)?.supplier_name || null : null;

      const observacaoFinal = formData.observacao || null;
      const selectedPartner = clientPartners.find(p => p.id === formData.client_id);
      const partnerNameValue = (selectedPartner && !selectedPartner.isMainClient) ? selectedPartner.name : null;

      let partnerIndex: number | null = null;
      if (selectedPartner && !selectedPartner.isMainClient) {
        if (formData.client_id.includes('-partner1')) partnerIndex = 1;
        else if (formData.client_id.includes('-partner2')) partnerIndex = 2;
        else if (formData.client_id.includes('-partner3')) partnerIndex = 3;
      }

      const recordData: any = {
        client_id: client.id,
        aeronave_id: aircraft.id,
        data: isoDateString,
        trecho: formData.trecho || "",
        local: formData.local || null,
        comanda: formData.comanda || null,
        litros: litros,
        valor_unitario: valorUnitario,
        abastecimento_galoes: formData.abastecimento_galoes ? parseFloat(formData.abastecimento_galoes) : null,
        abastecedor: supplierName,
        status_pagamento: formData.status_pagamento || "em aberto",
        tipo_faturamento: formData.tipo_faturamento || null,
        observacao: observacaoFinal,
        partner_name: partnerNameValue ? partnerNameValue.replace(/^\[|\]$/g, "") : null,
        partner_index: partnerIndex,
        comanda_url: comandaUrl || null,
        nota_url: notaUrl || null,
        boleto_url: boletoUrl || null,
        criado_por: currentUserName || null,
        logbook_entry_id: (linkToLogbook && selectedFlightId) ? selectedFlightId : null,
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
      const partners = getClientPartners(selectedClient.id, selectedClient.company_name);
      const partnersWithPercentages = await loadPartnerPercentages(partners);
      setClientPartners(partnersWithPercentages);
    }
  };
  const handleEdit = (record: FuelRecord) => {
    const supplierRecord = suppliers.find(s => s.supplier_name === record.abastecedor);
    setEditingRecord(record);
    setFormData({
      data: record.data,
      trecho: record.trecho || "",
      local: record.local || "",
      comanda: record.comanda,
      litros: record.litros.toString(),
      valor_unitario: record.valor_unitario.toString(),
      abastecimento_galoes: record.abastecimento_galoes?.toString() || "",
      abastecedor_id: supplierRecord?.id || "",
      client_id: record.client_id || client.id,
      partner_selected: record.observacao?.includes("[Partner:") ? record.observacao.match(/\[Partner:([^\]]+)\]/)?.[1] || "" : "",
      status_pagamento: record.status_pagamento || "em aberto",
      tipo_faturamento: record.tipo_faturamento || "",
      observacao: record.observacao?.replace(/\[Partner:[^\]]+\]\s*/, "") || "",
      comanda_file: null,
      nota_file: null,
      boleto_file: null,
      comanda_url: record.comanda_url || "",
      nota_url: record.nota_url || "",
      boleto_url: record.boleto_url || ""
    });
    setUploadedFiles({
      comanda_url: record.comanda_url || "",
      nota_url: record.nota_url || "",
      boleto_url: record.boleto_url || ""
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
      comanda: "",
      litros: "",
      valor_unitario: "",
      abastecimento_galoes: "",
      abastecedor_id: "",
      client_id: client.id,
      partner_selected: "",
      status_pagamento: "em aberto",
      tipo_faturamento: "",
      observacao: "",
      comanda_file: null,
      nota_file: null,
      boleto_file: null,
      comanda_url: "",
      nota_url: "",
      boleto_url: ""
    });
    setUploadedFiles({
      comanda_url: "",
      nota_url: "",
      boleto_url: ""
    });
    setEditingRecord(null);
    setLinkToLogbook(false);
    setSelectedFlightId("");
    setLogbookFlights([]);
  };

  const handleExportPDF = (month: number | null, year: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Filter records by month and year
    let exportRecords = records;
    if (month !== null) {
      exportRecords = records.filter((r) => {
        const recordDate = new Date(r.data + "T00:00:00");
        return recordDate.getMonth() + 1 === month && recordDate.getFullYear() === parseInt(year);
      });
    } else {
      exportRecords = records.filter((r) => {
        const recordDate = new Date(r.data + "T00:00:00");
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
        <td>${r.partner_name || "-"}</td>
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
          <title>Controle de Abastecimento - ${displayClient.company_name} - ${aircraft.registration} - ${periodLabel}</title>
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
              <p>${displayClient.company_name}</p>
              <p>${aircraft.registration}</p>
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
    printWindow.document.close();
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
        <p className="text-sm text-muted-foreground mt-0.5">{displayClient.company_name} • {aircraft.registration}</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
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
                const uniquePartners = Array.from(new Set(records.map(r => r.partner_name).filter(Boolean))) as string[];
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
      {(filterMonth || filterYear !== new Date().getFullYear().toString() || filterPartner !== "all") && <Button variant="outline" size="sm" onClick={() => {
        setFilterMonth("");
        setFilterYear(new Date().getFullYear().toString());
        setFilterPartner("all");
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
        <DialogContent className="flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingRecord ? "Editar Registro" : "Novo Registro"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-2 sm:pr-4 -mx-2 sm:-mx-4 px-2 sm:px-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Data</Label>
              <Input type="date" value={formData.data} onChange={e => setFormData({
                ...formData,
                data: e.target.value
              })} required className="mt-1 h-9 text-sm" />
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">Cliente e Sócios</Label>
              <div className="space-y-2">
                {clientPartners.length > 0 && <div className="space-y-2 border-l-2 border-primary/30 pl-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Cliente</p>
                  {clientPartners.filter(p => p.isMainClient).map(partner => <div key={partner.id} className="w-full p-3 rounded-lg border-2 bg-primary-foreground border-primary-dark">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        {partner.name}
                      </p>
                      {partner.share_percentage !== undefined && partner.share_percentage > 0 && <span className="text-xs font-semibold px-2 py-1 rounded bg-primary/20 text-primary">
                        {partner.share_percentage}%
                      </span>}
                    </div>
                  </div>)}
                </div>}

                {clientPartners.length > 1 && <div className="space-y-2 border-l-2 border-accent/30 pl-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Sócios</p>
                  {clientPartners.filter(p => !p.isMainClient).map(partner => {
                    const isSelected = formData.partner_selected === partner.name;
                    return <button key={partner.id} type="button" onClick={() => setFormData({
                      ...formData,
                      client_id: partner.id,
                      partner_selected: partner.name
                    })} className={`w-full p-3 rounded-lg text-left transition-all ${isSelected ? 'border-[3px] border-emerald-500 bg-emerald-500/15 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/30' : 'border-2 border-border/50 hover:border-accent/50'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {isSelected && <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />}
                          <p className={`text-sm font-medium ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                            {partner.name}
                          </p>
                        </div>
                        {partner.share_percentage !== undefined && partner.share_percentage > 0 && <span className={`text-xs font-semibold px-2 py-1 rounded ${isSelected ? 'bg-emerald-500/30 text-emerald-700 dark:text-emerald-300' : 'bg-accent/20 text-accent'}`}>
                          {partner.share_percentage}%
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
                    label: c.company_name
                  }))} value={formData.client_id === client.id || clientPartners.some(p => p.id === formData.client_id) ? "" : formData.client_id} onValueChange={value => handleClientChange(value)} placeholder="Buscar outro cliente" searchPlaceholder="Buscar cliente..." emptyText="Nenhum outro cliente encontrado" className="mt-1 h-9 text-sm" />
                </div>}
              </div>
            </div>

            {/* ── Vincular ao Diário de Bordo ── */}
            {!editingRecord && (
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
                  <div className="pl-7 space-y-2">
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
                                <span className="font-medium">{flight.entry_date}</span>
                                {' · '}
                                <span>{flight.trecho || `${flight.departure_aerodrome} → ${flight.arrival_aerodrome}`}</span>
                                {flight.fuel_added && (
                                  <span className="text-muted-foreground"> · {flight.fuel_added}L</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-sm font-semibold mb-2 block">Rota</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Trecho <span className="text-red-500">*</span></Label>
                  <Input value={formData.trecho} onChange={e => setFormData({
                    ...formData,
                    trecho: e.target.value
                  })} placeholder="SBSP X SBRJ" className="mt-1 h-9 text-sm" required />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Local</Label>
                  <Input value={formData.local} onChange={e => setFormData({
                    ...formData,
                    local: e.target.value
                  })} placeholder="CUIABA" className="mt-1 h-9 text-sm" />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Nº Comanda</Label>
              <Input value={formData.comanda} onChange={e => setFormData({
                ...formData,
                comanda: e.target.value
              })} placeholder="Número da comanda" className="mt-1 h-9 text-sm" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                <Combobox options={suppliers.map(s => ({
                  value: s.id,
                  label: `${s.supplier_name} (${s.city_name})`
                }))} value={formData.abastecedor_id} onValueChange={value => setFormData({
                  ...formData,
                  abastecedor_id: value
                })} placeholder="Selecione um fornecedor" searchPlaceholder="Buscar fornecedor..." emptyText="Nenhum fornecedor encontrado" className="mt-1 h-9 text-sm" />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Status de Pagamento</Label>
                <Select value={formData.status_pagamento} onValueChange={value => setFormData({
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

            <div>
              <Label className="text-xs text-muted-foreground">Tipo de Faturamento</Label>
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
              <Label className="text-sm font-semibold mb-2 block">Combustível</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Litros</Label>
                  <Input type="number" step="0.01" value={formData.litros} onChange={e => setFormData({
                    ...formData,
                    litros: e.target.value
                  })} required className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Valor Unit. (R$)</Label>
                  <Input type="number" step="0.0001" value={formData.valor_unitario} onChange={e => setFormData({
                    ...formData,
                    valor_unitario: e.target.value
                  })} required className="mt-1 h-9 text-sm" />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Galões</Label>
              <Input type="number" step="0.01" value={formData.abastecimento_galoes} onChange={e => setFormData({
                ...formData,
                abastecimento_galoes: e.target.value
              })} className="mt-1 h-9 text-sm" />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <textarea value={formData.observacao} onChange={e => setFormData({
                ...formData,
                observacao: e.target.value
              })} placeholder="Adicione observações sobre este abastecimento..." className="mt-1 w-full min-h-24 p-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background" />
            </div>

            {formData.litros && formData.valor_unitario && <div className="bg-gradient-to-r from-success/10 to-success/5 border border-success/20 p-2 rounded-lg">
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-lg font-bold text-success">
                R$ {(parseFloat(formData.litros) * parseFloat(formData.valor_unitario)).toFixed(2)}
              </p>
            </div>}

            <div>
              <Label className="text-sm font-semibold mb-4 block">Anexos</Label>
              <div className="space-y-3">
                <ModernFileUpload label="Comanda" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp" onChange={file => {
                  setFormData({
                    ...formData,
                    comanda_file: file
                  });
                  if (!file) {
                    setUploadedFiles({
                      ...uploadedFiles,
                      comanda_url: ""
                    });
                  }
                }} currentFile={formData.comanda_file} uploadedUrl={formData.comanda_url} disabled={isUploading} allowedFormats={["PDF", "PNG", "JPG", "JPEG", "GIF", "WEBP"]} />

                <ModernFileUpload label="Nota Fiscal" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp" onChange={file => {
                  setFormData({
                    ...formData,
                    nota_file: file
                  });
                  if (!file) {
                    setUploadedFiles({
                      ...uploadedFiles,
                      nota_url: ""
                    });
                  }
                }} currentFile={formData.nota_file} uploadedUrl={formData.nota_url} disabled={isUploading} allowedFormats={["PDF", "PNG", "JPG", "JPEG", "GIF", "WEBP"]} />

                <ModernFileUpload label="Boleto" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp" onChange={file => {
                  setFormData({
                    ...formData,
                    boleto_file: file
                  });
                  if (!file) {
                    setUploadedFiles({
                      ...uploadedFiles,
                      boleto_url: ""
                    });
                  }
                }} currentFile={formData.boleto_file} uploadedUrl={formData.boleto_url} disabled={isUploading} allowedFormats={["PDF", "PNG", "JPG", "JPEG", "GIF", "WEBP"]} />
              </div>
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

      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Comanda não preenchida</AlertDialogTitle>
            <AlertDialogDescription>
              Você está criando um registro sem informar a comanda. Embora não seja obrigatório, é importante ter esse dado para rastreamento. Deseja continuar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Voltar e Preencher</AlertDialogCancel>
            <AlertDialogAction onClick={saveRecord}>
              Continuar sem Comanda
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <ExportFuelRecordsModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        records={records}
        clientName={displayClient.company_name}
        aircraftRegistration={aircraft.registration}
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
                  <TableCell className="font-mono text-foreground">{record.comanda}</TableCell>
                  <TableCell className="text-muted-foreground">{record.abastecedor || "-"}</TableCell>
                  <TableCell className="text-muted-foreground font-medium">{record.partner_name || "-"}</TableCell>
                  <TableCell>
                    {record.status_pagamento === "pago" ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
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
                      {record.comanda_url && <Button variant="ghost" size="sm" onClick={() => setViewingAttachment({
                        url: record.comanda_url!,
                        type: record.comanda_url?.endsWith('.pdf') ? 'pdf' : 'image',
                        name: 'Comanda'
                      })} className="h-7 px-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 font-semibold text-xs gap-1" title="Visualizar Comanda">
                        <FileText className="h-4 w-4" />
                        Comanda
                      </Button>}
                      {record.nota_url && <Button variant="ghost" size="sm" onClick={() => setViewingAttachment({
                        url: record.nota_url!,
                        type: record.nota_url?.endsWith('.pdf') ? 'pdf' : 'image',
                        name: 'Nota Fiscal'
                      })} className="h-7 px-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 font-semibold text-xs gap-1" title="Visualizar Nota Fiscal">
                        <FileCheck className="h-4 w-4" />
                        NF
                      </Button>}
                      {record.boleto_url && <Button variant="ghost" size="sm" onClick={() => setViewingAttachment({
                        url: record.boleto_url!,
                        type: record.boleto_url?.endsWith('.pdf') ? 'pdf' : 'image',
                        name: 'Boleto'
                      })} className="h-7 px-2 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 font-semibold text-xs gap-1" title="Visualizar Boleto">
                        <DollarSign className="h-4 w-4" />
                        Boleto
                      </Button>}
                      {!record.comanda_url && !record.nota_url && !record.boleto_url && <span className="text-xs text-muted-foreground">—</span>}
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
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-2">
            {viewingAttachment.name === 'Comanda' && <FileText className="h-5 w-5 text-blue-600" />}
            {viewingAttachment.name === 'Nota Fiscal' && <FileCheck className="h-5 w-5 text-green-600" />}
            {viewingAttachment.name === 'Boleto' && <DollarSign className="h-5 w-5 text-orange-600" />}
            Visualizando: {viewingAttachment.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/30 rounded-lg p-6">
          {viewingAttachment.type === 'pdf' ? <div className="flex flex-col items-center justify-center gap-6 w-full">
            <div className="flex flex-col items-center gap-3">
              <FileText className="h-20 w-20 text-primary/40" />
              <p className="text-lg font-semibold text-foreground">Arquivo PDF</p>
              <p className="text-sm text-muted-foreground">Para visualizar o PDF completo, abra em uma nova aba</p>
            </div>
            <Button onClick={() => window.open(viewingAttachment.url, '_blank')} className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold">
              <Download className="h-4 w-4" />
              Abrir em Nova Aba
            </Button>
          </div> : <div className="w-full flex flex-col items-center gap-4">
            <img src={viewingAttachment.url} alt={viewingAttachment.name} className="max-w-full max-h-[600px] object-contain rounded-lg shadow-lg" />
            <p className="text-xs text-muted-foreground">Clique para fechar</p>
          </div>}
        </div>
      </DialogContent>
    </Dialog>}
  </div>;
}
