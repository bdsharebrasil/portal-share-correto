import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClienteCard } from "@/components/clientes/ClienteCard";
import { Plus, Search, Building, Upload, FileText, X, Image, ChevronLeft, Edit, Phone, Mail, MapPin, Folder, Grid3x3, List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ClientDocument {
  nome: string;
  url: string;
  tipo?: string;
  enviado_em: string;
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
  contato_financeiro?: string;
  observacoes?: string;
  aeronave_ownerships?: AeronavePropriedade[];
  url_logo?: string;
  documents?: ClientDocument[];
  status?: string | null;
  tem_socio?: boolean;
  partners?: Array<{nome: string; cpf: string; percentual_participacao: number}>;
}

interface AeronaveOpcao {
  id: string;
  matricula: string;
  modelo: string;
}

const toFolder = (s: string) => (s || 'sem_cliente').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]/g, '_');

const formatCPF = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length === 0) return '';
  if (digitsOnly.length <= 3) return digitsOnly;
  if (digitsOnly.length <= 6) return `${digitsOnly.slice(0, 3)}.${digitsOnly.slice(3)}`;
  if (digitsOnly.length <= 9) return `${digitsOnly.slice(0, 3)}.${digitsOnly.slice(3, 6)}.${digitsOnly.slice(6)}`;
  return `${digitsOnly.slice(0, 3)}.${digitsOnly.slice(3, 6)}.${digitsOnly.slice(6, 9)}-${digitsOnly.slice(9, 11)}`;
};

const ensureTravelReportsFolder = async (name: string) => {
  const folder = toFolder(name);
  const emptyBlob = new Blob([''], { type: 'text/plain' });
  await supabase.storage.from('travel-reports').upload(`${folder}/.keep`, emptyBlob, {
    upsert: true,
    contentType: 'text/plain'
  });
};

const formatPhoneNumber = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length === 0) return '';
  if (digitsOnly.length <= 2) return `(${digitsOnly}`;
  if (digitsOnly.length <= 7) return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2)}`;
  return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 7)}-${digitsOnly.slice(7, 11)}`;
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
  status: "ativo"
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingCliente, setViewingCliente] = useState<Cliente | null>(null);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
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
  const [loadingAircraft, setLoadingAircraft] = useState(false);
  const [hasPartner, setHasPartner] = useState(false);
  const [partners, setPartners] = useState<Array<{nome: string; cpf: string; percentual_participacao: number}>>([]);

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
      let clientPartnersMap: Record<string, Array<{nome: string; cpf: string; percentual_participacao: number}>> = {};

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
          .from("socios_cliente")
          .select("cliente_id, nome, cpf, percentual_participacao")
          .in("cliente_id", clientIds);

        if (!cpError && Array.isArray(clientPartnersData)) {
          clientPartnersData.forEach((cp: any) => {
            if (!clientPartnersMap[cp.cliente_id]) clientPartnersMap[cp.cliente_id] = [];
            clientPartnersMap[cp.cliente_id].push({
              nome: cp.nome,
              cpf: cp.cpf,
              percentual_participacao: cp.percentual_participacao || 0
            });
          });
        }
      }

      const mapped: Cliente[] = rows.map((row: any) => ({
        ...row,
        aeronave_ownerships: clientAircraftMap[row.id] || [],
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
        status: (cliente.status as string) || "ativo"
      });
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
      setAircraftOwnerships([]);
      setLogoPreview(null);
      setHasPartner(false);
      setPartners([]);
    }
    setLogoFile(null);
    setDocumentFiles([]);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCliente(null);
    setAircraftOwnerships([]);
    setHasPartner(false);
    setPartners([]);
    setDocumentFiles([]);
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
    if (total === 100) return 'text-green-400';
    if (total > 100) return 'text-red-400';
    return 'text-yellow-400';
  };

  const addPartner = () => setPartners([...partners, {nome: "", cpf: "", percentual_participacao: 0}]);
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
  };

  const removeDocument = (index: number) => setDocumentFiles(prev => prev.filter((_, i) => i !== index));

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
      for (const file of documentFiles) {
        const url = await uploadFile(file, "documentos");
        newDocs.push({ nome: file.name, url, tipo: file.type, enviado_em: new Date().toISOString() });
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
        contato_financeiro: formData.contato_financeiro,
        observacoes: formData.observacoes,
        status: normalizeStatus(formData.status),
        url_logo: logoUrl,
        documentos: [...existingDocs, ...newDocs],
        tem_socio: hasPartner
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
        await supabase.from("socios_cliente").delete().eq("cliente_id", clientId);
        const partnersData = partners.map(p => ({
          cliente_id: clientId,
          nome: p.nome,
          cpf: p.cpf.replace(/\D/g, ''),
          percentual_participacao: p.percentual_participacao
        }));
        const { error: partnersError } = await supabase.from("socios_cliente").insert(partnersData);
        if (partnersError) {
          toast({ title: "Aviso", description: `Erro ao salvar sócios: ${partnersError.message}`, variant: "destructive" });
        }
      } else if (clientId && !hasPartner) {
        await supabase.from("socios_cliente").delete().eq("cliente_id", clientId);
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

  return (
    <>
      {!viewingCliente && <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Clientes / Cotistas</h1>
            <p className="text-muted-foreground mt-1">Gerencie o cadastro de clientes e cotistas</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-border rounded-lg p-1">
              <Button onClick={() => handleViewModeChange('card')} variant={viewMode === 'card' ? 'default' : 'ghost'} size="sm" className="h-9 w-9 p-0" title="Cards">
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button onClick={() => handleViewModeChange('list')} variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" className="h-9 w-9 p-0" title="Lista">
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => handleOpenDialog()} size="lg" className="gap-2 shadow-md rounded-lg px-[4px] bg-teal-700 hover:bg-teal-600">
              <Plus className="h-4 w-4" />
              Novo Cadastro
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card onClick={() => setShowInactive(false)} className={`cursor-pointer transition-all duration-200 hover:shadow-md ${!showInactive ? 'ring-2 ring-primary shadow-md' : 'hover:border-primary/50'}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{activeClientes.length}</p>
                  <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card onClick={() => setShowInactive(true)} className={`cursor-pointer transition-all duration-200 hover:shadow-md ${showInactive ? 'ring-2 ring-muted-foreground/50 shadow-md' : 'hover:border-muted-foreground/30'}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-orange-900">
                  <Folder className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground text-orange-400">{inactiveClientes.length}</p>
                  <p className="text-sm text-muted-foreground">Clientes Inativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CNPJ ou cidade..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-11" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm">Carregando clientes...</p>
            </div>
          </div>
        ) : filteredClientes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Building className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum cliente cadastrado</h3>
              <p className="text-muted-foreground text-sm mb-4">Comece adicionando seu primeiro cliente</p>
              <Button onClick={() => handleOpenDialog()} variant="outline" className="gap-2">
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
              <div className="space-y-2 border border-border rounded-lg divide-y divide-border">
                {activeClientes.map(cliente => (
                  <button key={cliente.id} onClick={() => handleViewCliente(cliente)} className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left group">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      {cliente.url_logo && <AvatarImage src={cliente.url_logo} alt={cliente.razao_social} className="object-contain" />}
                      <AvatarFallback className="bg-white text-primary font-bold text-xs">
                        {cliente.razao_social.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">{cliente.razao_social}</h3>
                      {cliente.aeronave_ownerships && cliente.aeronave_ownerships.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {cliente.aeronave_ownerships.map((ownership, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs font-medium px-2 py-0.5">{ownership.aircraft_registration}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showInactive && inactiveClientes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Folder className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">Clientes Inativos</h2>
                  <Badge variant="secondary">{inactiveClientes.length}</Badge>
                </div>
                {viewMode === 'card' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inactiveClientes.map(cliente => <ClienteCard key={cliente.id} cliente={cliente} onView={handleViewCliente} onEdit={handleOpenDialog} onDelete={setDeleteId} />)}
                  </div>
                )}
                {viewMode === 'list' && (
                  <div className="space-y-2 border border-border rounded-lg divide-y divide-border">
                    {inactiveClientes.map(cliente => (
                      <button key={cliente.id} onClick={() => handleViewCliente(cliente)} className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left group">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          {cliente.url_logo && <AvatarImage src={cliente.url_logo} alt={cliente.razao_social} className="object-contain" />}
                          <AvatarFallback className="bg-white text-primary font-bold text-xs">
                            {cliente.razao_social.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">{cliente.razao_social}</h3>
                          {cliente.aeronave_ownerships && cliente.aeronave_ownerships.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {cliente.aeronave_ownerships.map((ownership, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs font-medium px-2 py-0.5">{ownership.aircraft_registration}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showInactive && inactiveClientes.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Nenhum cliente inativo</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>}

      {/* Perfil do Cliente */}
      {viewingCliente && (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          <Button variant="ghost" onClick={handleCloseView} className="gap-2 text-muted-foreground hover:text-foreground -ml-2 text-slate-100">
            <ChevronLeft className="h-4 w-4" />
            Voltar para Clientes
          </Button>

          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent" />
              <CardContent className="relative p-6 sm:p-8 shadow-sm rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-4 ring-cyan-400/50 shadow-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                      {viewingCliente.url_logo && <AvatarImage src={viewingCliente.url_logo} alt={viewingCliente.razao_social} className="object-contain p-2" />}
                      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-500 text-white text-2xl font-bold">
                        {viewingCliente.razao_social.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{viewingCliente.razao_social}</h1>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/40 px-[6px] rounded-md font-semibold">✓ ativo</Badge>
                        <Badge variant="outline" className="font-mono text-xs shadow-xl bg-slate-800/50 border-slate-600 rounded-lg text-slate-300">{viewingCliente.cnpj}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => handleOpenDialog(viewingCliente)} className="gap-2 shadow-md bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white">
                    <Edit className="h-4 w-4" />
                    Editar
                  </Button>
                </div>
              </CardContent>
            </div>
          </Card>

          {(viewingCliente.telefone || viewingCliente.email || viewingCliente.endereco || viewingCliente.cidade || viewingCliente.uf || viewingCliente.contato_financeiro) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Phone className="h-4 w-4 text-primary" /></div>
                  Informações de Contato
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {viewingCliente.telefone && <div><p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Phone className="h-3 w-3" />Telefone</p><p className="text-sm font-medium text-foreground">{viewingCliente.telefone}</p></div>}
                  {viewingCliente.email && <div><p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Mail className="h-3 w-3" />E-mail</p><p className="text-sm font-medium text-foreground break-all">{viewingCliente.email}</p></div>}
                  {(viewingCliente.endereco || viewingCliente.cidade || viewingCliente.uf) && <div><p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><MapPin className="h-3 w-3" />Endereço</p><p className="text-sm font-medium text-foreground">{[viewingCliente.endereco, [viewingCliente.cidade, viewingCliente.uf].filter(Boolean).join(' - ')].filter(Boolean).join(', ')}</p></div>}
                  {viewingCliente.contato_financeiro && <div><p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Building className="h-3 w-3" />Contato Financeiro</p><p className="text-sm font-medium text-foreground">{viewingCliente.contato_financeiro}</p></div>}
                </div>
              </CardContent>
            </Card>
          )}

          {(viewingCliente.proprietario || viewingCliente.inscricao_estadual || viewingCliente.aeronave_ownerships?.length || viewingCliente.tem_socio || viewingCliente.observacoes) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Building className="h-4 w-4 text-primary" /></div>
                  Informações Adicionais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {viewingCliente.proprietario && <div><p className="text-xs text-muted-foreground mb-1">Proprietário ou Responsável</p><p className="text-sm font-medium text-foreground">{viewingCliente.proprietario}</p></div>}
                  {viewingCliente.inscricao_estadual && <div><p className="text-xs text-muted-foreground mb-1">Inscrição Estadual</p><p className="text-sm font-medium text-foreground font-mono">{viewingCliente.inscricao_estadual}</p></div>}
                </div>
                {viewingCliente.aeronave_ownerships && viewingCliente.aeronave_ownerships.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-3">Aeronaves e Participação</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {viewingCliente.aeronave_ownerships.map((ownership, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-muted/50 rounded-xl opacity-90 bg-[#080817]/[0.78] shadow-xl border-slate-400">
                          <span className="text-sm font-medium text-foreground">{ownership.aircraft_registration} - {ownership.aircraft_model}</span>
                          <Badge variant="secondary" className="font-semibold">{ownership.ownership_percentage}%</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {viewingCliente.tem_socio && viewingCliente.partners && viewingCliente.partners.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-3 font-semibold">👥 Sócios / Cotistas</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {viewingCliente.partners.map((partner, idx) => (
                        <div key={idx} className="p-3 bg-muted/50 rounded-lg border border-border">
                          <p className="text-sm font-medium text-foreground">{partner.nome}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-1">CPF: {partner.cpf}</p>
                          {partner.percentual_participacao && <p className="text-xs text-cyan-400 font-semibold mt-1">Participação: {partner.percentual_participacao}%</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {viewingCliente.observacoes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Observações</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{viewingCliente.observacoes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><FileText className="h-4 w-4 text-primary" /></div>
                Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {viewingCliente.documents && viewingCliente.documents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-[13px]">
                  {viewingCliente.documents.map((doc, index) => (
                    <button key={index} type="button" onClick={() => setPreviewDoc(doc)} className="p-4 border border-border rounded-lg hover:bg-muted/50 hover:border-primary/50 transition-all text-left group mx-0 my-[2px] flex items-center justify-start gap-[30px] text-lg px-[9px] py-[28px]">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{doc.nome}</p>
                        <p className="text-xs text-muted-foreground">{new Date(doc.enviado_em).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento anexado</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Visualizador de Documento */}
      <Dialog open={!!previewDoc} onOpenChange={open => { if (!open) setPreviewDoc(null); }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden">
          <div className="h-full w-full">
            {previewDoc && (previewDoc.tipo?.includes("pdf") || previewDoc.nome.toLowerCase().endsWith(".pdf")) ? (
              <iframe src={`${previewDoc.url}#toolbar=1&navpanes=0`} className="w-full h-full" title={previewDoc.nome} />
            ) : (
              <div className="p-6 space-y-3">
                <p className="text-sm text-muted-foreground">Visualização não suportada. Faça o download abaixo.</p>
                <a href={previewDoc?.url} target="_blank" rel="noopener noreferrer" className="underline">Baixar arquivo</a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Cadastro/Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900 border-slate-800">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {editingCliente ? "✏️ Editar Cliente" : "➕ Novo Cliente"}
            </DialogTitle>
            <DialogDescription className="text-slate-400 mt-1">
              {editingCliente ? "Atualize as informações do cliente / cotista" : "Preencha as informações do novo cliente / cotista"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="info" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border border-slate-700 rounded-lg p-1">
              <TabsTrigger value="info" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white rounded-md transition-all">📋 Informações</TabsTrigger>
              <TabsTrigger value="files" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white rounded-md transition-all">📁 Logo e Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-6 mt-4">
              <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 rounded-full bg-cyan-400"></div>
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Informações Principais</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="razao_social" className="text-slate-300 font-semibold mb-2 block">Nome da Empresa *</Label>
                    <Input id="razao_social" value={formData.razao_social} onChange={e => setFormData({...formData, razao_social: e.target.value})} placeholder="Razão Social" className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100 placeholder-slate-500" />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="proprietario" className="text-slate-300 font-semibold mb-2 block">Proprietário ou Responsável</Label>
                    <Input id="proprietario" value={formData.proprietario} onChange={e => setFormData({...formData, proprietario: e.target.value})} placeholder="Nome do proprietário ou responsável" className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100 placeholder-slate-500" />
                  </div>
                  <div>
                    <Label htmlFor="cnpj" className="text-slate-300 font-semibold mb-2 block">CNPJ *</Label>
                    <Input id="cnpj" value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} placeholder="00.000.000/0000-00" className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100 placeholder-slate-500" />
                  </div>
                  <div>
                    <Label htmlFor="inscricao_estadual" className="text-slate-300 font-semibold mb-2 block">Inscrição Estadual</Label>
                    <Input id="inscricao_estadual" value={formData.inscricao_estadual} onChange={e => setFormData({...formData, inscricao_estadual: e.target.value})} placeholder="000.000.000.000" className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100 placeholder-slate-500" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 rounded-full bg-cyan-400"></div>
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Endereço</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="endereco" className="text-slate-300 font-semibold mb-2 block">Endereço</Label>
                    <Input id="endereco" value={formData.endereco} onChange={e => setFormData({...formData, endereco: e.target.value})} placeholder="Rua, número, bairro" className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100 placeholder-slate-500" />
                  </div>
                  <div>
                    <Label htmlFor="cidade" className="text-slate-300 font-semibold mb-2 block">Cidade</Label>
                    <Input id="cidade" value={formData.cidade} onChange={e => setFormData({...formData, cidade: e.target.value})} placeholder="São Paulo" className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100 placeholder-slate-500" />
                  </div>
                  <div>
                    <Label htmlFor="uf" className="text-slate-300 font-semibold mb-2 block">UF</Label>
                    <Input id="uf" value={formData.uf} onChange={e => setFormData({...formData, uf: e.target.value.toUpperCase().slice(0, 2)})} placeholder="SP" maxLength={2} className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100 placeholder-slate-500 uppercase" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 rounded-full bg-cyan-400"></div>
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Contato</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefone" className="text-slate-300 font-semibold mb-2 block">📱 Telefone</Label>
                    <Input id="telefone" value={formData.telefone} onChange={e => setFormData({...formData, telefone: formatPhoneNumber(e.target.value)})} placeholder="(00) 00000-0000" maxLength={15} className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100 placeholder-slate-500" />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-slate-300 font-semibold mb-2 block">📧 E-mail</Label>
                    <Input id="email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="contato@empresa.com" className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100 placeholder-slate-500" />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="contato_financeiro" className="text-slate-300 font-semibold mb-2 block">💼 Contato Financeiro</Label>
                    <Input id="contato_financeiro" value={formData.contato_financeiro} onChange={e => setFormData({...formData, contato_financeiro: e.target.value})} placeholder="Nome do responsável financeiro" className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100 placeholder-slate-500" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-cyan-400"></div>
                    <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">✈️ Aeronaves</h3>
                  </div>
                  <div className="flex gap-2">
                    {aircraftOptions.length === 0 && (
                      <Button type="button" variant="outline" size="sm" onClick={loadAircraftOptions} disabled={loadingAircraft} className="flex items-center gap-2 bg-slate-900 border-slate-600 hover:bg-slate-800 text-slate-200">🔄 Recarregar</Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={addAircraftOwnership} disabled={aircraftOptions.length === 0 || loadingAircraft} className="flex items-center gap-2 bg-slate-900 border-slate-600 hover:bg-slate-800 text-slate-200">
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>
                </div>

                {loadingAircraft && <div className="p-4 border border-blue-500/30 bg-blue-500/10 rounded-lg text-sm text-blue-300 mb-3">⏳ Carregando aeronaves...</div>}
                {!loadingAircraft && aircraftOptions.length === 0 && <div className="p-4 border border-yellow-500/30 bg-yellow-500/10 rounded-lg text-sm text-yellow-300 mb-3 space-y-2"><p>⚠️ <strong>Nenhuma aeronave disponível</strong></p><p>Cadastre uma aeronave em "Gestão de Aeronaves" para vincular a este cliente.</p></div>}

                {aircraftOwnerships.length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-600 rounded-lg text-center text-slate-400">Nenhuma aeronave adicionada</div>
                ) : (
                  <div className="space-y-3">
                    {aircraftOwnerships.map((ownership, index) => (
                      <div key={index} className="space-y-3 p-4 border border-slate-600 rounded-lg bg-slate-900/50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <Label className="text-sm font-medium text-slate-300 mb-2 block">Aeronave *</Label>
                            {loadingAircraft ? (
                              <div className="p-3 border border-slate-600 rounded text-center text-sm text-slate-400 bg-slate-900">Carregando aeronaves...</div>
                            ) : aircraftOptions.length === 0 ? (
                              <div className="p-3 border border-yellow-500/30 rounded text-center text-sm text-yellow-300 bg-yellow-500/10">Nenhuma aeronave disponível</div>
                            ) : (
                              <Select value={ownership.aircraft} onValueChange={v => updateAircraftOwnership(index, 'aircraft', v)}>
                                <SelectTrigger className="w-full bg-slate-900 border-slate-600 text-slate-100">
                                  <SelectValue placeholder="Selecione a aeronave..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-64 bg-slate-900 border-slate-600">
                                  {aircraftOptions.map(a => (
                                    <SelectItem key={a.id} value={a.id} className="text-slate-100">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-cyan-400">{a.matricula}</span>
                                        <span className="text-slate-400">-</span>
                                        <span>{a.modelo}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          <Button type="button" variant="destructive" size="sm" onClick={() => removeAircraftOwnership(index)} className="h-9 w-9 p-0 mt-7" title="Remover">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400 mb-1 block">Percentual de Participação (%) - Aceita decimais</Label>
                          <Input
                            type="number" min="0" max="100" step="0.01"
                            value={ownership.ownership_percentage}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0) updateAircraftOwnership(index, 'ownership_percentage', Math.min(val, 100));
                            }}
                            placeholder="Ex: 33.33"
                            className="text-right bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {aircraftOwnerships.length > 0 && (
                  <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-600">
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

              <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 rounded-full bg-cyan-400"></div>
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Status e Observações</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="status" className="text-slate-300 font-semibold mb-2 block">Status</Label>
                    <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                      <SelectTrigger className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-600">
                        <SelectItem value="ativo" className="text-slate-100">✅ Ativo</SelectItem>
                        <SelectItem value="inativo" className="text-slate-100">❌ Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="observacoes" className="text-slate-300 font-semibold mb-2 block">Observações</Label>
                    <Textarea id="observacoes" value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})} placeholder="Informações adicionais sobre o cliente" rows={3} className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100 placeholder-slate-500" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 rounded-full bg-cyan-400"></div>
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">👥 Sócios / Cotistas</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-300 font-semibold mb-3 block">Esse cliente é uma empresa de sociedade de cotistas?</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="tem_socio" checked={!hasPartner} onChange={() => { setHasPartner(false); setPartners([]); }} className="w-4 h-4" />
                        <span className="text-slate-300">Não</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="tem_socio" checked={hasPartner} onChange={() => setHasPartner(true)} className="w-4 h-4" />
                        <span className="text-slate-300">Sim</span>
                      </label>
                    </div>
                  </div>

                  {hasPartner && (
                    <div className="space-y-3 mt-4">
                      {editingCliente?.tem_socio && editingCliente.partners && editingCliente.partners.length > 0 && (
                        <div className="p-3 bg-slate-900/70 border border-slate-600 rounded-lg">
                          <p className="text-xs text-cyan-400 font-semibold mb-2">📋 Sócios Salvos no Banco de Dados:</p>
                          <div className="space-y-2">
                            {editingCliente.partners.map((savedPartner, idx) => (
                              <div key={idx} className="text-xs text-slate-400 p-2 bg-slate-800 rounded">
                                <span className="font-medium text-slate-300">{savedPartner.nome}</span> - <span className="font-mono">{savedPartner.cpf}</span>
                                {savedPartner.percentual_participacao && <span className="text-cyan-400 ml-2">({savedPartner.percentual_participacao}%)</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="text-sm text-slate-400">Adicione os sócios/cotistas da empresa</p>

                      {partners.length === 0 ? (
                        <div className="p-4 border border-dashed border-slate-600 rounded-lg text-center text-slate-400">Nenhum sócio adicionado</div>
                      ) : (
                        <div className="space-y-3">
                          {partners.map((partner, index) => (
                            <div key={index} className="space-y-3 p-4 border border-slate-600 rounded-lg bg-slate-900/50">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 grid grid-cols-3 gap-3">
                                  <div>
                                    <Label className="text-slate-300 mb-2 block text-xs">Nome</Label>
                                    <Input value={partner.nome} onChange={e => updatePartner(index, 'nome', e.target.value)} placeholder="Nome do sócio" className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100 placeholder-slate-500" />
                                  </div>
                                  <div>
                                    <Label className="text-slate-300 mb-2 block text-xs">CPF/CNPJ</Label>
                                    <Input value={partner.cpf} onChange={e => updatePartner(index, 'cpf', formatCPF(e.target.value))} placeholder="000.000.000-00" className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100 placeholder-slate-500" />
                                  </div>
                                  <div>
                                    <Label className="text-slate-300 mb-2 block text-xs">% Participação</Label>
                                    <Input type="number" step="0.01" min="0" max="100" value={partner.percentual_participacao} onChange={e => updatePartner(index, 'percentual_participacao', parseFloat(e.target.value) || 0)} placeholder="0.00" className="bg-slate-900 border-slate-600 focus:border-cyan-400 text-slate-100 placeholder-slate-500" />
                                  </div>
                                </div>
                                <Button type="button" variant="destructive" size="sm" onClick={() => removePartner(index)} className="h-9 w-9 p-0 mt-7 flex-shrink-0" title="Remover sócio">
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button type="button" variant="outline" onClick={addPartner} className="w-full bg-slate-900 border-slate-600 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Sócio
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="files" className="space-y-6 mt-4">
              <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 rounded-full bg-cyan-400"></div>
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">🎨 Logo da Empresa</h3>
                </div>
                <p className="text-sm text-slate-400 mb-4">Envie a logo da empresa (formatos: PNG, JPG, SVG)</p>
                <div className="flex items-center gap-6">
                  {logoPreview && (
                    <div className="flex-shrink-0">
                      <Avatar className="h-24 w-24 border-2 border-cyan-400/50">
                        <AvatarImage src={logoPreview} alt="Logo" className="object-contain" />
                        <AvatarFallback className="bg-slate-900"><Image className="h-8 w-8 text-slate-400" /></AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="block cursor-pointer">
                      <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 hover:border-cyan-400 transition-colors text-center">
                        <Image className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                        <p className="text-sm text-slate-300 font-medium">Clique para upload</p>
                        <p className="text-xs text-slate-500 mt-1">PNG, JPG ou SVG</p>
                      </div>
                      <Input type="file" accept="image/*" onChange={handleLogoChange} className="hidden cursor-pointer" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 rounded-full bg-cyan-400"></div>
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">📄 Documentos</h3>
                </div>
                <p className="text-sm text-slate-400 mb-4">Anexe documentos como CNPJ, contratos, certificados, etc.</p>
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 hover:border-cyan-400 transition-colors text-center">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm text-slate-300 font-medium">Clique para upload ou arraste arquivos</p>
                    <p className="text-xs text-slate-500 mt-1">Todos os formatos são suportados</p>
                  </div>
                  <Input type="file" multiple onChange={handleDocumentChange} className="hidden cursor-pointer" />
                </label>

                {documentFiles.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <h4 className="text-sm font-semibold text-slate-300">📥 Novos documentos:</h4>
                    <div className="space-y-2">
                      {documentFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border border-slate-600 rounded-lg bg-slate-900/50 hover:bg-slate-900 transition-colors">
                          <div className="flex items-center gap-3 flex-1">
                            <FileText className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-slate-200 truncate">{file.name}</p>
                              <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeDocument(index)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-400/10 flex-shrink-0">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editingCliente?.documents && editingCliente.documents.length > 0 && (
                  <div className="space-y-3 mt-6 pt-6 border-t border-slate-700">
                    <h4 className="text-sm font-semibold text-slate-300">📎 Documentos existentes:</h4>
                    <div className="space-y-2">
                      {editingCliente.documents.map((doc, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border border-slate-600 rounded-lg bg-slate-900/50 hover:bg-slate-900 transition-colors">
                          <div className="flex items-center gap-3 flex-1">
                            <FileText className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm text-cyan-400 hover:text-cyan-300 hover:underline truncate block">{doc.nome}</a>
                              <p className="text-xs text-slate-500">{new Date(doc.enviado_em).toLocaleDateString('pt-BR')}</p>
                            </div>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeDocumentFromEditing(index)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-400/10 flex-shrink-0">
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

          <DialogFooter className="mt-6 pt-6 border-t border-slate-700 flex gap-3 justify-end">
            <Button variant="outline" onClick={handleCloseDialog} className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-200">❌ Cancelar</Button>
            <Button onClick={handleSave} disabled={uploadingFiles} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white">
              {uploadingFiles ? "⏳ Salvando..." : editingCliente ? "✅ Atualizar" : "➕ Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
