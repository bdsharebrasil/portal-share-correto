// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClienteCard } from "@/components/agenda/ClienteCard";
import {
  Plus, Search, Building2, FileText, X, ImageIcon, ChevronLeft, Pencil,
  Phone, Mail, MapPin, Folder, LayoutGrid, List, Trash2, Users, Wallet,
  IdCard, Plane, ClipboardList, RefreshCw, AlertTriangle, Loader2, Percent
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ---------------------------------------------------------------------------
// Design tokens — palette: slate ink/surfaces, cyan→blue signature accent,
// emerald (ativo) / amber (inativo) / rose (destrutivo). Radius: lg for
// controls, xl for panels, 2xl reserved for the profile hero only.
// ---------------------------------------------------------------------------
const FIELD =
  "bg-slate-950/60 border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 " +
  "focus-visible:border-cyan-500/60 focus-visible:ring-1 focus-visible:ring-cyan-500/30 transition-colors";
const PANEL = "bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 sm:p-6 space-y-4";
const LABEL = "text-slate-300 font-medium mb-2 block text-sm";
const EYEBROW = "flex items-center gap-2 mb-1";
const AVATAR_FALLBACK =
  "bg-gradient-to-br from-cyan-500/80 to-blue-500/80 text-white font-semibold";

interface ClientDocument {
  nome?: string;
  legenda?: string;
  url?: string;
  tipo?: string;
  enviado_em?: string;
}

interface AeronavePropriedade {
  aircraft: string;
  aircraft_registration?: string;
  aircraft_model?: string;
  ownership_percentage: number;
}

interface Cliente {
  id: string;
  razao_social: string;
  cnpj: string;
  proprietario?: string;
  inscricao_estadual?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  telefone?: string;
  email?: string;
  emails?: string[];
  contato_financeiro?: string;
  observacoes?: string;
  aeronave_ownerships?: AeronavePropriedade[];
  url_logo?: string;
  documents?: ClientDocument[];
  status?: string | null;
  tem_socio?: boolean;
  codigo_cliente?: string | null;
  partners?: Array<{ nome: string; cpf: string; percentual_participacao: number; codigo_cliente?: string }>;
}

interface AeronaveOpcao {
  id: string;
  matricula: string;
  modelo: string;
}

const toFolder = (s: string) => (s || 'sem_cliente').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]/g, '_');

// MÁSCARAS E FORMATAÇÕES
const formatCPF = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length === 0) return '';
  if (digitsOnly.length <= 3) return digitsOnly;
  if (digitsOnly.length <= 6) return `${digitsOnly.slice(0, 3)}.${digitsOnly.slice(3)}`;
  if (digitsOnly.length <= 9) return `${digitsOnly.slice(0, 3)}.${digitsOnly.slice(3, 6)}.${digitsOnly.slice(6)}`;
  return `${digitsOnly.slice(0, 3)}.${digitsOnly.slice(3, 6)}.${digitsOnly.slice(6, 9)}-${digitsOnly.slice(9, 11)}`;
};

const formatCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

const formatIE = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`; // Formato comum XXX.XXX.XXX.XXX
};

const formatPhoneNumber = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length === 0) return '';
  if (digitsOnly.length <= 2) return `(${digitsOnly}`;
  if (digitsOnly.length <= 7) return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2)}`;
  return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 7)}-${digitsOnly.slice(7, 11)}`;
};

const ensureTravelReportsFolder = async (name: string) => {
  const folder = toFolder(name);
  const emptyBlob = new Blob([''], { type: 'text/plain' });
  await supabase.storage.from('travel-reports').upload(`${folder}/.keep`, emptyBlob, {
    upsert: true,
    contentType: 'text/plain'
  });
};

interface FormData {
  razao_social: string;
  cnpj: string;
  proprietario: string;
  inscricao_estadual: string;
  endereco: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  contato_financeiro: string;
  observacoes: string;
  status: string;
  codigo_cliente?: string | null;
}

const emptyFormData: FormData = {
  razao_social: "",
  cnpj: "",
  proprietario: "",
  inscricao_estadual: "",
  endereco: "",
  cidade: "",
  uf: "",
  telefone: "",
  email: "",
  contato_financeiro: "",
  observacoes: "",
  status: "ativo",
  codigo_cliente: null
};

const initials = (name: string) =>
  (name || '').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

const getDocumentTitle = (doc?: Partial<ClientDocument>) => doc?.legenda || doc?.nome || 'Documento sem nome';

const isPdfDocument = (doc?: Partial<ClientDocument>) => {
  const tipo = String(doc?.tipo || '').toLowerCase();
  const nome = String(doc?.nome || '').toLowerCase();
  return tipo.includes('pdf') || nome.endsWith('.pdf');
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingCliente, setViewingCliente] = useState<Cliente | null>(null);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [emailsExtras, setEmailsExtras] = useState<string[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem('clientesViewMode') as 'card' | 'list' | null;
    if (saved) setViewMode(saved);
  }, []);

  const handleViewModeChange = (mode: 'card' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('clientesViewMode', mode);
  };

  const [formData, setFormData] = useState<FormData>({ ...emptyFormData });
  const [aircraftOwnerships, setAircraftOwnerships] = useState<AeronavePropriedade[]>([]);
  const [aircraftOptions, setAircraftOptions] = useState<AeronaveOpcao[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const [documentLegends, setDocumentLegends] = useState<string[]>([]);
  const [loadingAircraft, setLoadingAircraft] = useState(false);
  const [hasPartner, setHasPartner] = useState(false);
  const [partners, setPartners] = useState<Array<{ nome: string; cpf: string; percentual_participacao: number; codigo_cliente?: string }>>([]);

  useEffect(() => {
    loadClientes();
    loadAircraftOptions();
  }, []);

  useEffect(() => {
    if (isDialogOpen && aircraftOptions.length === 0) {
      loadAircraftOptions();
    }
  }, [isDialogOpen]);

  const loadClientes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("clientes").select("*");
      if (error) throw error;
      const rows = data as any[] || [];
      const clientIds = rows.map(r => r.id).filter(Boolean);

      let clientAircraftMap: Record<string, AeronavePropriedade[]> = {};
      let clientPartnersMap: Record<string, Array<{ nome: string; cpf: string; percentual_participacao: number; codigo_cliente?: string }>> = {};

      if (clientIds.length > 0) {
        const { data: clientAircraftData, error: caError } = await supabase
          .from("cotistas_aeronave")
          .select('id_clientes, id_aeronave, percentual_sociedade, aircraft:id_aeronave(id, matricula, modelo)')
          .in("id_clientes", clientIds);

        if (!caError && Array.isArray(clientAircraftData)) {
          clientAircraftData.forEach((ca: any) => {
            if (!clientAircraftMap[ca.id_clientes]) clientAircraftMap[ca.id_clientes] = [];
            clientAircraftMap[ca.id_clientes].push({
              aircraft: ca.id_aeronave,
              aircraft_registration: ca.aircraft?.matricula,
              aircraft_model: ca.aircraft?.modelo,
              ownership_percentage: ca.percentual_sociedade
            });
          });
        }

        const { data: clientPartnersData, error: cpError } = await supabase
          .from("socios")
          .select("clientes_id, nome, cpf, percentual_participacao, codigo_cliente")
          .in("clientes_id", clientIds);

        if (!cpError && Array.isArray(clientPartnersData)) {
          clientPartnersData.forEach((cp: any) => {
            if (!clientPartnersMap[cp.clientes_id]) clientPartnersMap[cp.clientes_id] = [];
            clientPartnersMap[cp.clientes_id].push({
              nome: cp.nome,
              cpf: cp.cpf,
              percentual_participacao: cp.percentual_participacao || 0,
              codigo_cliente: cp.codigo_cliente || null
            });
          });
        }
      }

      const mapped: Cliente[] = rows.map((row: any) => ({
        ...row,
        aeronave_ownerships: clientAircraftMap[row.id] || [],
        documents: Array.isArray(row.documentos) ? (row.documentos as ClientDocument[]) : [],
        partners: clientPartnersMap[row.id] || []
      })).sort((a, b) => (a.razao_social || '').localeCompare(b.razao_social || '', 'pt-BR'));
      setClientes(mapped);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      toast({ title: "Erro", description: "Erro ao carregar clientes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadAircraftOptions = async () => {
    try {
      setLoadingAircraft(true);
      const { data, error } = await supabase
        .from('aeronave')
        .select('id, matricula, modelo')
        .neq("status", "inativa")
        .order("matricula");
      if (error) {
        toast({ title: "Erro ao carregar aeronaves", description: error.message, variant: "destructive" });
        setAircraftOptions([]);
        return;
      }
      setAircraftOptions(data || []);
    } catch (error) {
      console.error("Erro inesperado ao carregar aeronaves:", error);
      setAircraftOptions([]);
    } finally {
      setLoadingAircraft(false);
    }
  };

  const handleViewCliente = (cliente: Cliente) => setViewingCliente(cliente);
  const handleCloseView = () => setViewingCliente(null);

  const handleOpenDialog = (cliente?: Cliente) => {
    setViewingCliente(null);
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        razao_social: cliente.razao_social || "",
        cnpj: cliente.cnpj || "",
        proprietario: cliente.proprietario || "",
        inscricao_estadual: cliente.inscricao_estadual || "",
        endereco: cliente.endereco || "",
        cidade: cliente.cidade || "",
        uf: cliente.uf || "",
        telefone: cliente.telefone || "",
        email: cliente.email || "",
        contato_financeiro: cliente.contato_financeiro || "",
        observacoes: cliente.observacoes || "",
        status: (cliente.status as string) || "ativo",
        codigo_cliente: cliente.codigo_cliente || null
      });
      setEmailsExtras(((cliente.emails as string[] | undefined) || []).filter((e) => e && e.trim() && e.trim() !== (cliente.email || "").trim()));
      setAircraftOwnerships(cliente.aeronave_ownerships || []);
      setLogoPreview(cliente.url_logo || null);
      setHasPartner(cliente.tem_socio || false);
      if (cliente.tem_socio && cliente.partners && Array.isArray(cliente.partners)) {
        setPartners(cliente.partners);
      } else {
        setPartners([]);
      }
    } else {
      setEditingCliente(null);
      setFormData({ ...emptyFormData });
      setEmailsExtras([]);
      setAircraftOwnerships([]);
      setLogoPreview(null);
      setHasPartner(false);
      setPartners([]);
    }
    setLogoFile(null);
    setDocumentFiles([]);
    setDocumentLegends([]);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCliente(null);
    setAircraftOwnerships([]);
    setHasPartner(false);
    setPartners([]);
    setDocumentFiles([]);
    setDocumentLegends([]);
  };

  const addAircraftOwnership = () => {
    setAircraftOwnerships([...aircraftOwnerships, { aircraft: "", ownership_percentage: 0 }]);
  };

  const removeAircraftOwnership = (index: number) => {
    setAircraftOwnerships(aircraftOwnerships.filter((_, i) => i !== index));
  };

  const updateAircraftOwnership = (index: number, field: string, value: any) => {
    const updated = [...aircraftOwnerships];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'aircraft') {
      const ac = aircraftOptions.find(a => a.id === value);
      if (ac) {
        updated[index].aircraft_registration = ac.matricula;
        updated[index].aircraft_model = ac.modelo;
      }
    }
    setAircraftOwnerships(updated);
  };

  const calculateTotalOwnership = () => aircraftOwnerships.reduce((sum, o) => sum + (o.ownership_percentage || 0), 0);

  const getTotalOwnershipColor = () => {
    const total = calculateTotalOwnership();
    if (total === 100) return 'text-emerald-400';
    if (total > 100) return 'text-rose-400';
    return 'text-amber-400';
  };

  const addPartner = () => setPartners([...partners, { nome: "", cpf: "", percentual_participacao: 0, codigo_cliente: "" }]);
  const removePartner = (index: number) => setPartners(partners.filter((_, i) => i !== index));
  const updatePartner = (index: number, field: string, value: any) => {
    const updated = [...partners];
    updated[index] = { ...updated[index], [field]: value };
    setPartners(updated);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setDocumentFiles(prev => [...prev, ...files]);
    setDocumentLegends(prev => [...prev, ...files.map(() => "")]);
  };

  const removeDocument = (index: number) => {
    setDocumentFiles(prev => prev.filter((_, i) => i !== index));
    setDocumentLegends(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: File, path: string) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${path}/${fileName}`;
    const { error: uploadError } = await supabase.storage.from("client-documents").upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from("client-documents").getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const deleteDocumentFile = async (documentUrl: string) => {
    try {
      const urlParts = documentUrl.split("/");
      const bucketPath = urlParts.slice(urlParts.indexOf("client-documents") + 1).join("/");
      if (!bucketPath) return;
      await supabase.storage.from("client-documents").remove([bucketPath]);
    } catch (error) {
      console.error("Erro ao deletar arquivo:", error);
    }
  };

  const deleteClientDocuments = async (documents: ClientDocument[] = []) => {
    for (const doc of documents) {
      await deleteDocumentFile(doc.url);
    }
  };

  const removeDocumentFromEditing = async (index: number) => {
    const docToRemove = editingCliente?.documents?.[index];
    if (!docToRemove) return;
    try {
      await deleteDocumentFile(docToRemove.url);
      if (editingCliente?.documents) {
        const updatedDocs = editingCliente.documents.filter((_, i) => i !== index);
        setEditingCliente({ ...editingCliente, documents: updatedDocs });
        toast({ title: "Sucesso", description: "Documento removido" });
      }
    } catch (error) {
      console.error("Erro ao remover documento:", error);
      toast({ title: "Erro", description: "Erro ao remover documento", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.razao_social || !formData.cnpj) {
        toast({ title: "Campos obrigatórios", description: "Nome da empresa e CNPJ são obrigatórios", variant: "destructive" });
        return;
      }

      if (aircraftOwnerships.length > 0) {
        const missingAircraft = aircraftOwnerships.some(o => !o.aircraft);
        if (missingAircraft) {
          toast({ title: "Aviso", description: "Algumas aeronaves não foram selecionadas e serão ignoradas", variant: "default" });
        }
      }

      setUploadingFiles(true);

      let logoUrl = editingCliente?.url_logo || null;
      const existingDocs = editingCliente?.documents || [];

      if (logoFile) {
        const fileExt = logoFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `logos/${fileName}`;
        const { error: uploadError } = await supabase.storage.from("company-logos").upload(filePath, logoFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("company-logos").getPublicUrl(filePath);
        logoUrl = urlData.publicUrl;
      }

      const newDocs: ClientDocument[] = [];
      for (let i = 0; i < documentFiles.length; i++) {
        const file = documentFiles[i];
        const url = await uploadFile(file, "documentos");
        newDocs.push({
          nome: file.name,
          legenda: (documentLegends[i] || "").trim() || undefined,
          url,
          tipo: file.type,
          enviado_em: new Date().toISOString(),
        });
      }

      const normalizeStatus = (s?: string | null) => {
        const st = String(s ?? '').trim().toLowerCase();
        if (!st) return 'ativo';
        if (st === 'active') return 'ativo';
        if (st === 'inactive') return 'inativo';
        return st;
      };

      const updatedData: any = {
        razao_social: formData.razao_social,
        cnpj: formData.cnpj,
        proprietario: formData.proprietario,
        inscricao_estadual: formData.inscricao_estadual,
        endereco: formData.endereco,
        cidade: formData.cidade,
        uf: formData.uf,
        telefone: formData.telefone,
        email: formData.email,
        emails: Array.from(
          new Set([formData.email, ...emailsExtras].map((e) => (e || "").trim()).filter(Boolean)),
        ),
        contato_financeiro: formData.contato_financeiro,
        observacoes: formData.observacoes,
        status: normalizeStatus(formData.status),
        url_logo: logoUrl,
        documentos: [...existingDocs, ...newDocs],
        tem_socio: hasPartner,
        codigo_cliente: formData.codigo_cliente || null
      };

      let clientId = editingCliente?.id;

      if (editingCliente) {
        const { error } = await supabase.from("clientes").update(updatedData).eq("id", editingCliente.id);
        if (error) throw error;

        const { error: deleteError } = await supabase.from("cotistas_aeronave").delete().eq("id_clientes", editingCliente.id);
        if (deleteError) throw deleteError;

        const prevStatus = String(editingCliente.status || '').toLowerCase();
        const newStatus = normalizeStatus(formData.status);
        if (prevStatus !== 'ativo' && newStatus === 'ativo') {
          try { await ensureTravelReportsFolder(updatedData.razao_social); } catch (e) { console.warn('Falha ao criar pasta:', e); }
        }
        toast({ title: "Sucesso", description: "Cliente atualizado com sucesso" });
      } else {
        const { data: insertData, error } = await supabase.from("clientes").insert([updatedData]).select().single();
        if (error) throw error;
        clientId = insertData?.id;

        if (normalizeStatus(formData.status) === 'ativo') {
          try {
            const folder = toFolder(updatedData.razao_social);
            const emptyBlob = new Blob([''], { type: 'text/plain' });
            await supabase.storage.from('travel-reports').upload(`${folder}/.keep`, emptyBlob, { upsert: true, contentType: 'text/plain' });
          } catch (e) { console.warn('Não foi possível criar pasta:', e); }
        }
        toast({ title: "Sucesso", description: "Cliente cadastrado com sucesso" });
      }

      // Save partners
      if (clientId && hasPartner && partners.length > 0) {
        await supabase.from("socios").delete().eq("clientes_id", clientId);
        const partnersData = partners.map(p => ({
          clientes_id: clientId,
          nome: p.nome,
          cpf: p.cpf.replace(/\D/g, ''),
          percentual_participacao: p.percentual_participacao,
          codigo_cliente: p.codigo_cliente || null
        })) as any;
        const { error: partnersError } = await supabase.from("socios").insert(partnersData);
        if (partnersError) {
          toast({ title: "Aviso", description: `Erro ao salvar sócios: ${partnersError.message}`, variant: "destructive" });
        }
      } else if (clientId && !hasPartner) {
        await supabase.from("socios").delete().eq("clientes_id", clientId);
      }

      // Save aircraft relationships
      if (clientId && aircraftOwnerships.length > 0) {
        const aircraftData = aircraftOwnerships.filter(o => o.aircraft).map(o => ({
          id_clientes: clientId,
          id_aeronave: o.aircraft,
          percentual_sociedade: Math.max(0, Math.min(100, o.ownership_percentage || 0))
        }));
        if (aircraftData.length > 0) {
          const { error: aircraftError } = await supabase.from("cotistas_aeronave").insert(aircraftData);
          if (aircraftError) {
            toast({ title: "Aviso", description: `Erro ao salvar aeronaves: ${aircraftError.message}`, variant: "destructive" });
          }
        }
      }

      handleCloseDialog();
      loadClientes();
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      toast({ title: "Erro", description: error instanceof Error ? error.message : "Erro ao salvar cliente", variant: "destructive" });
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const clienteToDelete = clientes.find(c => c.id === deleteId);
      if (clienteToDelete?.documents && clienteToDelete.documents.length > 0) {
        await deleteClientDocuments(clienteToDelete.documents);
      }
      const { error } = await supabase.from("clientes").delete().eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Cliente excluído com sucesso" });
      loadClientes();
    } catch (error) {
      console.error("Erro ao excluir cliente:", error);
      toast({ title: "Erro", description: "Erro ao excluir cliente", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const filteredClientes = clientes.filter(
    cliente =>
      cliente.razao_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isActive = (status?: string | null) => {
    const s = String(status ?? '').toLowerCase();
    return s === 'active' || s === 'ativo' || s === '';
  };

  const activeClientes = filteredClientes.filter(c => isActive(c.status));
  const inactiveClientes = filteredClientes.filter(c => !isActive(c.status));

  const ClienteRow = ({ cliente }: { cliente: Cliente }) => (
    <button
      onClick={() => handleViewCliente(cliente)}
      className="w-full p-4 flex items-center gap-4 hover:bg-slate-800/60 transition-colors text-left group first:rounded-t-xl last:rounded-b-xl"
    >
      <Avatar className="h-10 w-10 flex-shrink-0 ring-1 ring-slate-700/60">
        {cliente.url_logo && <AvatarImage src={cliente.url_logo} alt={cliente.razao_social} className="object-contain" />}
        <AvatarFallback className={`${AVATAR_FALLBACK} text-xs`}>{initials(cliente.razao_social)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-slate-100 group-hover:text-cyan-400 transition-colors truncate">{cliente.razao_social}</h3>
        {cliente.aeronave_ownerships && cliente.aeronave_ownerships.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {cliente.aeronave_ownerships.map((ownership, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs font-medium px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700/60 rounded-md">
                {ownership.aircraft_registration}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <ChevronLeft className="h-4 w-4 rotate-180 text-slate-600 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
    </button>
  );

  return (
    <>
      {!viewingCliente && (
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-white mt-1 text-sm sm:text-base">Gerencie o cadastro de clientes e cotistas</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex border border-slate-800 bg-slate-900/60 rounded-lg p-1">
                <Button
                  onClick={() => handleViewModeChange('card')}
                  variant="ghost"
                  size="sm"
                  className={`h-9 w-9 p-0 rounded-md ${viewMode === 'card' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
                  title="Cards"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => handleViewModeChange('list')}
                  variant="ghost"
                  size="sm"
                  className={`h-9 w-9 p-0 rounded-md ${viewMode === 'list' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
                  title="Lista"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Button
                onClick={() => handleOpenDialog()}
                size="lg"
                className="gap-2 rounded-lg px-4 bg-[rgba(2,44,97,1)] hover:bg-[rgba(2,44,97,1)] text-white shadow-lg shadow-cyan-500/10 border-0"
              >
                <Plus className="h-4 w-4" />
                Novo Cadastro
              </Button>
            </div>
          </div>

          <div className="flex items-stretch gap-4">
            <Card
              onClick={() => setShowInactive(true)}
              className={`mx-[52px] flex min-h-0 items-stretch justify-end overflow-auto px-[6px] cursor-pointer transition-all duration-200 rounded-xl bg-slate-900/50 border ${showInactive ? 'border-amber-500/50 shadow-lg shadow-amber-500/5' : 'border-slate-800/80 hover:border-slate-700'}`}
            >
              <CardContent className="m-0 flex items-stretch justify-end overflow-auto p-5 px-[22px]">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 rounded-xl  flex items-center justify-center flex-shrink-0">
                    <Folder className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-slate-50">{inactiveClientes.length}</p>
                    <p className="text-sm text-slate-400">Clientes Inativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Buscar por nome, CNPJ ou e-mail..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`${FIELD} pl-10 h-11`}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-7 w-7 text-cyan-400 animate-spin" />
                <p className="text-slate-400 text-sm">Carregando clientes...</p>
              </div>
            </div>
          ) : filteredClientes.length === 0 ? (
            <Card className="border-dashed border-slate-800 bg-slate-900/30 rounded-xl">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-16 w-16 rounded-xl bg-slate-800/70 flex items-center justify-center mb-4">
                  <Building2 className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-100 mb-1">Nenhum cliente cadastrado</h3>
                <p className="text-slate-400 text-sm mb-4">Comece adicionando seu primeiro cliente</p>
                <Button onClick={() => handleOpenDialog()} variant="outline" className="gap-2 rounded-lg bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-slate-100">
                  <Plus className="h-4 w-4" />
                  Cadastrar Cliente
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {!showInactive && activeClientes.length > 0 && viewMode === 'card' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeClientes.map(cliente => <ClienteCard key={cliente.id} cliente={cliente} onView={handleViewCliente} onEdit={handleOpenDialog} onDelete={setDeleteId} />)}
                </div>
              )}
              {!showInactive && activeClientes.length > 0 && viewMode === 'list' && (
                <div className="border border-slate-800/80 bg-slate-900/40 rounded-xl divide-y divide-slate-800/80 overflow-hidden">
                  {activeClientes.map(cliente => <ClienteRow key={cliente.id} cliente={cliente} />)}
                </div>
              )}

              {showInactive && inactiveClientes.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Folder className="h-5 w-5 text-slate-500" />
                    <h2 className="text-lg font-semibold text-slate-100">Clientes Inativos</h2>
                    <Badge variant="secondary" className="bg-slate-800 text-slate-300 border border-slate-700/60 rounded-md">{inactiveClientes.length}</Badge>
                  </div>
                  {viewMode === 'card' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {inactiveClientes.map(cliente => <ClienteCard key={cliente.id} cliente={cliente} onView={handleViewCliente} onEdit={handleOpenDialog} onDelete={setDeleteId} />)}
                    </div>
                  )}
                  {viewMode === 'list' && (
                    <div className="border border-slate-800/80 bg-slate-900/40 rounded-xl divide-y divide-slate-800/80 overflow-hidden">
                      {inactiveClientes.map(cliente => <ClienteRow key={cliente.id} cliente={cliente} />)}
                    </div>
                  )}
                </div>
              )}

              {showInactive && inactiveClientes.length === 0 && (
                <Card className="border-dashed border-slate-800 bg-slate-900/30 rounded-xl">
                  <CardContent className="py-12 text-center">
                    <p className="text-slate-400">Nenhum cliente inativo</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* Perfil do Cliente */}
      {viewingCliente && (
        <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
          <Button variant="ghost" onClick={handleCloseView} className="gap-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 -ml-2 rounded-lg">
            <ChevronLeft className="h-4 w-4" />
            Voltar para Clientes
          </Button>

          <Card className="overflow-hidden border border-slate-800/80 shadow-xl rounded-2xl">
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent" />
              <CardContent className="relative p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-4 ring-cyan-400/30 shadow-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                      {viewingCliente.url_logo && <AvatarImage src={viewingCliente.url_logo} alt={viewingCliente.razao_social} className="object-contain p-2" />}
                      <AvatarFallback className={`${AVATAR_FALLBACK} text-2xl`}>{initials(viewingCliente.razao_social)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight">{viewingCliente.razao_social}</h1>
                      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                        <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-md font-medium">
                          Ativo
                        </Badge>
                        <Badge variant="outline" className="font-mono text-xs bg-slate-800/60 border-slate-700 rounded-md text-slate-300">{viewingCliente.cnpj}</Badge>
                        {viewingCliente.codigo_cliente && (
                          <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-md font-mono text-xs">
                            {viewingCliente.codigo_cliente}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleOpenDialog(viewingCliente)}
                    className="gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-lg shadow-cyan-500/10 border-0 w-full sm:w-auto"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                </div>
              </CardContent>
            </div>
          </Card>

          {(viewingCliente.telefone || viewingCliente.email || viewingCliente.endereco || viewingCliente.cidade || viewingCliente.uf || viewingCliente.contato_financeiro) && (
            <Card className="bg-slate-900/50 border border-slate-800/80 rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-3 text-slate-100">
                  <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center"><Phone className="h-4 w-4 text-cyan-400" /></div>
                  Informações de Contato
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {viewingCliente.telefone && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5"><Phone className="h-3 w-3" />Telefone</p>
                      <p className="text-sm font-medium text-slate-200">{viewingCliente.telefone}</p>
                    </div>
                  )}
                  {(viewingCliente.email || (viewingCliente.emails || []).length > 0) && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5"><Mail className="h-3 w-3" />E-mail</p>
                      {Array.from(new Set([viewingCliente.email, ...(viewingCliente.emails || [])].filter(Boolean) as string[])).map((mail) => (
                        <p key={mail} className="text-sm font-medium text-slate-200 break-all">{mail}</p>
                      ))}
                    </div>
                  )}
                  {(viewingCliente.endereco || viewingCliente.cidade || viewingCliente.uf) && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5"><MapPin className="h-3 w-3" />Endereço</p>
                      <p className="text-sm font-medium text-slate-200">{[viewingCliente.endereco, [viewingCliente.cidade, viewingCliente.uf].filter(Boolean).join(' - ')].filter(Boolean).join(', ')}</p>
                    </div>
                  )}
                  {viewingCliente.contato_financeiro && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5"><Wallet className="h-3 w-3" />Contato Financeiro</p>
                      <p className="text-sm font-medium text-slate-200">{viewingCliente.contato_financeiro}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {(viewingCliente.proprietario || viewingCliente.inscricao_estadual || viewingCliente.aeronave_ownerships?.length || viewingCliente.tem_socio || viewingCliente.observacoes) && (
            <Card className="bg-slate-900/50 border border-slate-800/80 rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-3 text-slate-100">
                  <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center"><Building2 className="h-4 w-4 text-cyan-400" /></div>
                  Informações Adicionais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {viewingCliente.proprietario && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Proprietário ou Responsável</p>
                      <p className="text-sm font-medium text-slate-200">{viewingCliente.proprietario}</p>
                    </div>
                  )}
                  {viewingCliente.inscricao_estadual && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Inscrição Estadual</p>
                      <p className="text-sm font-medium text-slate-200 font-mono">{viewingCliente.inscricao_estadual}</p>
                    </div>
                  )}
                </div>
                {viewingCliente.aeronave_ownerships && viewingCliente.aeronave_ownerships.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5"><Plane className="h-3 w-3" />Aeronaves e Participação</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {viewingCliente.aeronave_ownerships.map((ownership, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-950/50 border border-slate-800/80 rounded-lg">
                          <span className="text-sm font-medium text-slate-200">{ownership.aircraft_registration} - {ownership.aircraft_model}</span>
                          <Badge variant="secondary" className="bg-slate-800 text-slate-200 border border-slate-700/60 rounded-md font-semibold">{ownership.ownership_percentage}%</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {viewingCliente.tem_socio && viewingCliente.partners && viewingCliente.partners.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5 font-medium"><Users className="h-3 w-3" />Sócios / Cotistas</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {viewingCliente.partners.map((partner, idx) => (
                        <div key={idx} className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-lg">
                          <p className="text-sm font-medium text-slate-200">{partner.nome}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <p className="text-xs text-slate-500 font-mono">CPF: {partner.cpf}</p>
                            {partner.codigo_cliente && (
                              <span className="text-xs font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded">
                                {partner.codigo_cliente}
                              </span>
                            )}
                          </div>
                          {partner.percentual_participacao && <p className="text-xs text-cyan-400 font-semibold mt-1">Participação: {partner.percentual_participacao}%</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {viewingCliente.observacoes && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Observações</p>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap bg-slate-950/50 border border-slate-800/80 p-3 rounded-lg">{viewingCliente.observacoes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="bg-slate-900/50 border border-slate-800/80 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-3 text-slate-100">
                <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center"><FileText className="h-4 w-4 text-cyan-400" /></div>
                Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {viewingCliente.documents && viewingCliente.documents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {viewingCliente.documents.map((doc, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="p-4 border border-slate-800/80 bg-slate-950/40 rounded-lg hover:bg-slate-800/50 hover:border-cyan-500/40 transition-all text-left group flex items-center gap-3"
                    >
                      <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors flex-shrink-0">
                        <FileText className="h-5 w-5 text-cyan-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-200 truncate group-hover:text-cyan-400 transition-colors">{getDocumentTitle(doc)}</p>
                        <p className="text-xs text-slate-500">{doc.legenda ? `${doc.nome || 'Documento'} · ` : ""}{doc.enviado_em ? new Date(doc.enviado_em).toLocaleDateString('pt-BR') : ""}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">Nenhum documento anexado</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Visualizador de Documento */}
      <Dialog open={!!previewDoc} onOpenChange={open => { if (!open) setPreviewDoc(null); }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-slate-950 border border-slate-800 rounded-xl">
          <div className="h-full w-full">
            {previewDoc && isPdfDocument(previewDoc) ? (
              <iframe src={`${previewDoc.url || '#'}#toolbar=1&navpanes=0`} className="w-full h-full" title={getDocumentTitle(previewDoc)} />
            ) : (
              <div className="p-6 space-y-3">
                <p className="text-sm text-slate-400">Visualização não suportada. Faça o download abaixo.</p>
                {previewDoc?.url ? (
                  <a href={previewDoc.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
                    Baixar arquivo
                  </a>
                ) : (
                  <p className="text-sm text-slate-500">Arquivo sem URL disponível.</p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Cadastro/Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-6">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-50 flex items-center gap-2.5">
              {editingCliente ? <Pencil className="h-5 w-5 text-cyan-400" /> : <Plus className="h-5 w-5 text-cyan-400" />}
              {editingCliente ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
            <DialogDescription className="text-slate-400 mt-1">
              {editingCliente ? "Atualize as informações do cliente / cotista" : "Preencha as informações do novo cliente / cotista"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="info" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2 bg-slate-900/70 border border-slate-800 rounded-lg p-1 h-auto">
              <TabsTrigger
                value="info"
                className="gap-2 py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-400 rounded-md transition-all"
              >
                <ClipboardList className="h-4 w-4" />
                Informações
              </TabsTrigger>
              <TabsTrigger
                value="files"
                className="gap-2 py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-400 rounded-md transition-all"
              >
                <Folder className="h-4 w-4" />
                Logo e Documentos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-5 mt-4">
              <div className={PANEL}>
                <div className={EYEBROW}>
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Informações Principais</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="razao_social" className={LABEL}>Nome da Empresa *</Label>
                    <Input 
                      id="razao_social" 
                      value={formData.razao_social} 
                      onChange={e => {
                        const val = e.target.value;
                        const updates: Partial<FormData> = { razao_social: val };
                        // Se o código_cliente estiver vazio, sugere as 3 primeiras letras
                        if (!formData.codigo_cliente && val) {
                          const lettersOnly = val.replace(/[^A-Za-z]/g, '');
                          updates.codigo_cliente = lettersOnly.slice(0, 3).toUpperCase() || null;
                        }
                        setFormData(prev => ({ ...prev, ...updates }));
                      }} 
                      placeholder="Razão Social" 
                      className={FIELD} 
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="proprietario" className={LABEL}>Proprietário ou Responsável</Label>
                    <Input id="proprietario" value={formData.proprietario} onChange={e => setFormData({ ...formData, proprietario: e.target.value })} placeholder="Nome do proprietário ou responsável" className={FIELD} />
                  </div>
                  <div>
                    <Label htmlFor="cnpj" className={LABEL}>CNPJ *</Label>
                    <Input 
                      id="cnpj" 
                      value={formData.cnpj} 
                      onChange={e => setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })} 
                      placeholder="00.000.000/0000-00" 
                      maxLength={18}
                      className={FIELD} 
                    />
                  </div>
                  <div>
                    <Label htmlFor="codigo_cliente" className={LABEL}>Código para identificação do cliente com 3 letras</Label>
                    <Input 
                      id="codigo_cliente" 
                      value={formData.codigo_cliente || ''} 
                      onChange={e => setFormData({ ...formData, codigo_cliente: e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || null })} 
                      placeholder="Codigo cliente" 
                      maxLength={3} 
                      className={`${FIELD} uppercase`} 
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="inscricao_estadual" className={LABEL}>Inscrição Estadual</Label>
                    <Input 
                      id="inscricao_estadual" 
                      value={formData.inscricao_estadual} 
                      onChange={e => setFormData({ ...formData, inscricao_estadual: formatIE(e.target.value) })} 
                      placeholder="000.000.000.000" 
                      maxLength={15}
                      className={FIELD} 
                    />
                  </div>
                </div>
              </div>

              <div className={PANEL}>
                <div className={EYEBROW}>
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Endereço</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="endereco" className={LABEL}>Endereço</Label>
                    <Input id="endereco" value={formData.endereco} onChange={e => setFormData({ ...formData, endereco: e.target.value })} placeholder="Rua, número, bairro" className={FIELD} />
                  </div>
                  <div>
                    <Label htmlFor="cidade" className={LABEL}>Cidade</Label>
                    <Input id="cidade" value={formData.cidade} onChange={e => setFormData({ ...formData, cidade: e.target.value })} placeholder="São Paulo" className={FIELD} />
                  </div>
                  <div>
                    <Label htmlFor="uf" className={LABEL}>UF</Label>
                    <Input id="uf" value={formData.uf} onChange={e => setFormData({ ...formData, uf: e.target.value.toUpperCase().slice(0, 2) })} placeholder="SP" maxLength={2} className={`${FIELD} uppercase`} />
                  </div>
                </div>
              </div>

              <div className={PANEL}>
                <div className={EYEBROW}>
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contato</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefone" className={`${LABEL} flex items-center gap-1.5`}><Phone className="h-3.5 w-3.5" />Telefone</Label>
                    <Input 
                      id="telefone" 
                      value={formData.telefone} 
                      onChange={e => setFormData({ ...formData, telefone: formatPhoneNumber(e.target.value) })} 
                      placeholder="(00) 00000-0000" 
                      maxLength={15} 
                      className={FIELD} 
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="email" className="text-slate-300 font-medium flex items-center gap-1.5 text-sm"><Mail className="h-3.5 w-3.5" />E-mail</Label>
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-md" onClick={() => setEmailsExtras(prev => [...prev, ""])}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                      </Button>
                    </div>
                    <Input id="email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="contato@empresa.com" className={FIELD} />
                    {emailsExtras.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {emailsExtras.map((mail, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Input
                              type="email"
                              value={mail}
                              onChange={e => setEmailsExtras(prev => prev.map((m, i) => (i === idx ? e.target.value : m)))}
                              placeholder={`e-mail adicional ${idx + 1}`}
                              className={FIELD}
                            />
                            <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg flex-shrink-0" onClick={() => setEmailsExtras(prev => prev.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="contato_financeiro" className={`${LABEL} flex items-center gap-1.5`}><Wallet className="h-3.5 w-3.5" />Contato Financeiro</Label>
                    <Input id="contato_financeiro" value={formData.contato_financeiro} onChange={e => setFormData({ ...formData, contato_financeiro: e.target.value })} placeholder="Nome do responsável financeiro" className={FIELD} />
                  </div>
                </div>
              </div>

              <div className={PANEL}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className={EYEBROW + " mb-0"}>
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Plane className="h-3.5 w-3.5" />Aeronaves</h3>
                  </div>
                  <div className="flex gap-2">
                    {aircraftOptions.length === 0 && (
                      <Button type="button" variant="outline" size="sm" onClick={loadAircraftOptions} disabled={loadingAircraft} className="gap-1.5 bg-slate-950/60 border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg">
                        <RefreshCw className="h-3.5 w-3.5" /> Recarregar
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={addAircraftOwnership} disabled={aircraftOptions.length === 0 || loadingAircraft} className="gap-1.5 bg-slate-950/60 border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg">
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar
                    </Button>
                  </div>
                </div>

                {loadingAircraft && (
                  <div className="p-3.5 border border-blue-500/20 bg-blue-500/5 rounded-lg text-sm text-blue-300 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando aeronaves...
                  </div>
                )}
                {!loadingAircraft && aircraftOptions.length === 0 && (
                  <div className="p-3.5 border border-amber-500/20 bg-amber-500/5 rounded-lg text-sm text-amber-300 space-y-1">
                    <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-3.5 w-3.5" />Nenhuma aeronave disponível</p>
                    <p className="text-amber-300/80">Cadastre uma aeronave em "Gestão de Aeronaves" para vincular a este cliente.</p>
                  </div>
                )}

                {aircraftOwnerships.length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-800 rounded-lg text-center text-slate-500">Nenhuma aeronave adicionada</div>
                ) : (
                  <div className="space-y-3">
                    {aircraftOwnerships.map((ownership, index) => (
                      <div key={index} className="space-y-3 p-4 border border-slate-800 rounded-lg bg-slate-950/40">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <Label className={LABEL}>Aeronave *</Label>
                            {loadingAircraft ? (
                              <div className="p-3 border border-slate-800 rounded-lg text-center text-sm text-slate-400 bg-slate-950/60">Carregando aeronaves...</div>
                            ) : aircraftOptions.length === 0 ? (
                              <div className="p-3 border border-amber-500/20 rounded-lg text-center text-sm text-amber-300 bg-amber-500/5">Nenhuma aeronave disponível</div>
                            ) : (
                              <Select value={ownership.aircraft} onValueChange={v => updateAircraftOwnership(index, 'aircraft', v)}>
                                <SelectTrigger className={`w-full ${FIELD}`}>
                                  <SelectValue placeholder="Selecione a aeronave..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-64 bg-slate-900 border-slate-800 rounded-lg">
                                  {aircraftOptions.map(a => (
                                    <SelectItem key={a.id} value={a.id} className="text-slate-100 rounded-md focus:bg-slate-800">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-cyan-400">{a.matricula}</span>
                                        <span className="text-slate-500">-</span>
                                        <span>{a.modelo}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeAircraftOwnership(index)} className="h-9 w-9 p-0 mt-7 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg flex-shrink-0" title="Remover">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div>
                          <Label className="text-slate-400 mb-1.5 block text-xs flex items-center gap-1.5"><Percent className="h-3 w-3" />Percentual de Participação — aceita decimais</Label>
                          <Input
                            type="number" min="0" max="100" step="0.01"
                            value={ownership.ownership_percentage}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0) updateAircraftOwnership(index, 'ownership_percentage', Math.min(val, 100));
                            }}
                            placeholder="Ex: 33.33"
                            className={`text-right ${FIELD}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {aircraftOwnerships.length > 0 && (
                  <div className="p-3.5 bg-slate-950/50 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Total de Participação:</span>
                      <span className={`text-lg font-semibold ${getTotalOwnershipColor()}`}>{calculateTotalOwnership().toFixed(2)}%</span>
                    </div>
                    {calculateTotalOwnership() !== 100 && (
                      <p className="text-xs text-slate-500 mt-1">
                        {calculateTotalOwnership() < 100 ? `Faltam ${(100 - calculateTotalOwnership()).toFixed(2)}%` : `Excesso de ${(calculateTotalOwnership() - 100).toFixed(2)}%`}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className={PANEL}>
                <div className={EYEBROW}>
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status e Observações</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="status" className={LABEL}>Status</Label>
                    <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                      <SelectTrigger className={FIELD}>
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 rounded-lg">
                        <SelectItem value="ativo" className="text-slate-100 rounded-md focus:bg-slate-800">
                          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Ativo</span>
                        </SelectItem>
                        <SelectItem value="inativo" className="text-slate-100 rounded-md focus:bg-slate-800">
                          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Inativo</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="observacoes" className={LABEL}>Observações</Label>
                    <Textarea id="observacoes" value={formData.observacoes} onChange={e => setFormData({ ...formData, observacoes: e.target.value })} placeholder="Informações adicionais sobre o cliente" rows={3} className={FIELD} />
                  </div>
                </div>
              </div>

              <div className={PANEL}>
                <div className={EYEBROW}>
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Sócios / Cotistas</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className={LABEL}>Esse cliente é uma empresa de sociedade de cotistas?</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="tem_socio" checked={!hasPartner} onChange={() => { setHasPartner(false); setPartners([]); }} className="w-4 h-4 accent-cyan-500" />
                        <span className="text-slate-300 text-sm">Não</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="tem_socio" checked={hasPartner} onChange={() => setHasPartner(true)} className="w-4 h-4 accent-cyan-500" />
                        <span className="text-slate-300 text-sm">Sim</span>
                      </label>
                    </div>
                  </div>

                  {hasPartner && (
                    <div className="space-y-3 mt-2">
                      {editingCliente?.tem_socio && editingCliente.partners && editingCliente.partners.length > 0 && (
                        <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg">
                          <p className="text-xs text-cyan-400 font-semibold mb-2 flex items-center gap-1.5"><IdCard className="h-3.5 w-3.5" />Sócios salvos no banco de dados</p>
                          <div className="space-y-1.5">
                            {editingCliente.partners.map((savedPartner, idx) => (
                              <div key={idx} className="text-xs text-slate-400 p-2 bg-slate-900/70 rounded-md">
                                <span className="font-medium text-slate-300">{savedPartner.nome}</span> · <span className="font-mono">{savedPartner.cpf}</span>
                                {savedPartner.percentual_participacao && <span className="text-cyan-400 ml-2">({savedPartner.percentual_participacao}%)</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="text-sm text-slate-400">Adicione os sócios/cotistas da empresa</p>

                      {partners.length === 0 ? (
                        <div className="p-4 border border-dashed border-slate-800 rounded-lg text-center text-slate-500">Nenhum sócio adicionado</div>
                      ) : (
                        <div className="space-y-3">
                          {partners.map((partner, index) => (
                            <div key={index} className="space-y-3 p-4 border border-slate-800 rounded-lg bg-slate-950/40">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div>
                                    <Label className="text-slate-400 mb-1.5 block text-xs">Nome</Label>
                                    <Input value={partner.nome} onChange={e => updatePartner(index, 'nome', e.target.value)} placeholder="Nome do sócio" className={FIELD} />
                                  </div>
                                  <div>
                                    <Label className="text-slate-400 mb-1.5 block text-xs">CPF/CNPJ</Label>
                                    <Input value={partner.cpf} onChange={e => updatePartner(index, 'cpf', formatCPF(e.target.value))} placeholder="000.000.000-00" className={FIELD} />
                                  </div>
                                  <div>
                                    <Label className="text-slate-400 mb-1.5 block text-xs">% Participação</Label>
                                    <Input type="number" step="0.01" min="0" max="100" value={partner.percentual_participacao} onChange={e => updatePartner(index, 'percentual_participacao', parseFloat(e.target.value) || 0)} placeholder="0.00" className={FIELD} />
                                  </div>
                                  <div>
                                    <Label className="text-slate-400 mb-1.5 block text-xs">Código</Label>
                                    <Input value={partner.codigo_cliente || ''} onChange={e => updatePartner(index, 'codigo_cliente', e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || null)} placeholder="Ex: DEJ" maxLength={3} className={`${FIELD} uppercase`} />
                                  </div>
                                </div>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removePartner(index)} className="h-9 w-9 p-0 mt-6 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg flex-shrink-0" title="Remover sócio">
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button type="button" variant="outline" onClick={addPartner} className="w-full gap-2 bg-slate-950/60 border-slate-800 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 rounded-lg">
                        <Plus className="h-4 w-4" />
                        Adicionar Sócio
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="files" className="space-y-5 mt-4">
              <div className={PANEL}>
                <div className={EYEBROW}>
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" />Logo da Empresa</h3>
                </div>
                <p className="text-sm text-slate-400">Envie a logo da empresa (formatos: PNG, JPG, SVG)</p>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {logoPreview && (
                    <Avatar className="h-24 w-24 border border-slate-800 ring-2 ring-cyan-400/20 flex-shrink-0">
                      <AvatarImage src={logoPreview} alt="Logo" className="object-contain" />
                      <AvatarFallback className="bg-slate-900"><ImageIcon className="h-8 w-8 text-slate-500" /></AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1 w-full">
                    <label className="block cursor-pointer">
                      <div className="border-2 border-dashed border-slate-800 rounded-xl p-6 hover:border-cyan-500/50 hover:bg-slate-900/30 transition-colors text-center">
                        <ImageIcon className="h-8 w-8 mx-auto mb-2 text-slate-500" />
                        <p className="text-sm text-slate-300 font-medium">Clique para upload</p>
                        <p className="text-xs text-slate-500 mt-1">PNG, JPG ou SVG</p>
                      </div>
                      <Input type="file" accept="image/*" onChange={handleLogoChange} className="hidden cursor-pointer" />
                    </label>
                  </div>
                </div>
              </div>

              <div className={PANEL}>
                <div className={EYEBROW}>
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Documentos</h3>
                </div>
                <p className="text-sm text-slate-400">Anexe documentos como CNPJ, contratos, certificados, etc.</p>
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-slate-800 rounded-xl p-8 hover:border-cyan-500/50 hover:bg-slate-900/30 transition-colors text-center">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-slate-500" />
                    <p className="text-sm text-slate-300 font-medium">Clique para upload ou arraste arquivos</p>
                    <p className="text-xs text-slate-500 mt-1">Todos os formatos são suportados</p>
                  </div>
                  <Input type="file" multiple onChange={handleDocumentChange} className="hidden cursor-pointer" />
                </label>

                {documentFiles.length > 0 && (
                  <div className="space-y-3 mt-2">
                    <h4 className="text-sm font-semibold text-slate-300">Novos documentos</h4>
                    <div className="space-y-2">
                      {documentFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border border-slate-800 rounded-lg bg-slate-950/40 hover:bg-slate-900/60 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <p className="text-sm text-slate-200 truncate">{file.name}</p>
                              <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                              <Input
                                value={documentLegends[index] || ""}
                                onChange={(e) => setDocumentLegends(prev => prev.map((l, i) => (i === index ? e.target.value : l)))}
                                placeholder="Legenda do documento (ex.: Contrato Social)"
                                className={`${FIELD} h-8 text-xs`}
                              />
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeDocument(index)} className="h-8 w-8 p-0 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg flex-shrink-0">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editingCliente?.documents && editingCliente.documents.length > 0 && (
                  <div className="space-y-3 mt-4 pt-5 border-t border-slate-800">
                    <h4 className="text-sm font-semibold text-slate-300">Documentos existentes</h4>
                    <div className="space-y-2">
                      {editingCliente.documents.map((doc, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border border-slate-800 rounded-lg bg-slate-950/40 hover:bg-slate-900/60 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm text-cyan-400 hover:text-cyan-300 hover:underline truncate block">{getDocumentTitle(doc)}</a>
                              <p className="text-xs text-slate-500">{doc.legenda ? `${doc.nome || 'Documento'} · ` : ""}{doc.enviado_em ? new Date(doc.enviado_em).toLocaleDateString('pt-BR') : ""}</p>
                            </div>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeDocumentFromEditing(index)} className="h-8 w-8 p-0 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg flex-shrink-0">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 pt-5 border-t border-slate-800 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <Button variant="outline" onClick={handleCloseDialog} className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100 rounded-lg">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={uploadingFiles}
              className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-lg shadow-lg shadow-cyan-500/10 border-0"
            >
              {uploadingFiles && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploadingFiles ? "Salvando..." : editingCliente ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-slate-950 border border-slate-800 rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-50 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              Excluir Cliente
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100 rounded-lg">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 text-white hover:bg-rose-500 rounded-lg">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}