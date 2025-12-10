import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClienteCard } from "@/components/clientes/ClienteCard";
import { Plus, Search, Building, Upload, FileText, X, Image, ChevronLeft, Edit, Phone, Mail, MapPin, Folder } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
interface ClientDocument {
  name: string;
  url: string;
  type: string;
  uploaded_at: string;
}
interface AircraftOwnership {
  aircraft: string;
  aircraft_registration?: string;
  aircraft_model?: string;
  ownership_percentage: number;
}
interface Cliente {
  id: string;
  company_name: string;
  cnpj: string;
  inscricao_estadual?: string;
  address?: string;
  city?: string;
  uf?: string;
  phone?: string;
  email?: string;
  financial_contact?: string;
  observations?: string;
  cnpj_card_url?: string;
  aircraft_ownerships?: AircraftOwnership[];
  logo_url?: string;
  documents?: ClientDocument[];
  status?: string | null;
}
interface AircraftOption {
  id: string;
  registration: string;
  model: string;
}
const toFolder = (s: string) => (s || 'sem_cliente').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]/g, '_');
const ensureTravelReportsFolder = async (name: string) => {
  const folder = toFolder(name);
  const emptyBlob = new Blob([''], {
    type: 'text/plain'
  });
  await supabase.storage.from('travel-reports').upload(`${folder}/.keep`, emptyBlob, {
    upsert: true,
    contentType: 'text/plain'
  });
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
  const {
    toast
  } = useToast();
  const [formData, setFormData] = useState({
    company_name: "",
    cnpj: "",
    inscricao_estadual: "",
    address: "",
    city: "",
    uf: "",
    phone: "",
    email: "",
    financial_contact: "",
    observations: "",
    status: "ativo"
  });
  const [aircraftOwnerships, setAircraftOwnerships] = useState<AircraftOwnership[]>([]);
  const [aircraftOptions, setAircraftOptions] = useState<AircraftOption[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const [loadingAircraft, setLoadingAircraft] = useState(false);
  useEffect(() => {
    loadClientes();
    loadAircraftOptions();
  }, []);

  // Recarregar aeronaves quando o diálogo abre
  useEffect(() => {
    if (isDialogOpen && aircraftOptions.length === 0) {
      loadAircraftOptions();
    }
  }, [isDialogOpen]);
  const loadClientes = async () => {
    try {
      setLoading(true);
      // Primeiro buscamos os clientes
      const {
        data,
        error
      } = await supabase.from("clients").select("*");
      if (error) throw error;
      const rows = data as any[] || [];
      const clientIds = rows.map(r => r.id).filter(Boolean);

      // Buscar as relações de aeronaves
      let clientAircraftMap: Record<string, AircraftOwnership[]> = {};
      if (clientIds.length > 0) {
        const {
          data: clientAircraftData,
          error: caError
        } = await supabase.from("client_aircraft").select("client_id, aircraft_id, share_percentage, aircraft:aircraft_id(id, registration, model)").in("client_id", clientIds);
        if (!caError && Array.isArray(clientAircraftData)) {
          clientAircraftData.forEach((ca: any) => {
            if (!clientAircraftMap[ca.client_id]) {
              clientAircraftMap[ca.client_id] = [];
            }
            clientAircraftMap[ca.client_id].push({
              aircraft: ca.aircraft_id,
              aircraft_registration: ca.aircraft?.registration,
              aircraft_model: ca.aircraft?.model,
              ownership_percentage: ca.share_percentage
            });
          });
        }
      }
      const mapped: Cliente[] = rows.map((row: any) => ({
        ...row,
        aircraft_ownerships: clientAircraftMap[row.id] || []
      })).sort((a, b) => (a.company_name || '').localeCompare(b.company_name || '', 'pt-BR'));
      setClientes(mapped);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar clientes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const loadAircraftOptions = async () => {
    try {
      setLoadingAircraft(true);
      console.log("Carregando aeronaves...");
      const {
        data,
        error
      } = await supabase.from("aircraft").select("id, registration, model").neq("status", "inativa").order("registration");
      if (error) {
        console.error("Erro ao carregar aeronaves:", error);
        toast({
          title: "Erro ao carregar aeronaves",
          description: error.message || "Não foi possível carregar as aeronaves disponíveis",
          variant: "destructive"
        });
        setAircraftOptions([]);
        return;
      }
      const aircraftData = data as any || [];
      console.log("Aeronaves carregadas:", aircraftData.length, aircraftData);
      setAircraftOptions(aircraftData);
      if (aircraftData.length === 0) {
        console.warn("Nenhuma aeronave ativa encontrada no banco de dados");
      }
    } catch (error) {
      console.error("Erro inesperado ao carregar aeronaves:", error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar aeronaves",
        variant: "destructive"
      });
      setAircraftOptions([]);
    } finally {
      setLoadingAircraft(false);
    }
  };
  const handleViewCliente = (cliente: Cliente) => {
    setViewingCliente(cliente);
  };
  const handleCloseView = () => {
    setViewingCliente(null);
  };
  const handleOpenDialog = (cliente?: Cliente) => {
    setViewingCliente(null);
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        company_name: cliente.company_name || "",
        cnpj: cliente.cnpj || "",
        inscricao_estadual: cliente.inscricao_estadual || "",
        address: cliente.address || "",
        city: cliente.city || "",
        uf: cliente.uf || "",
        phone: cliente.phone || "",
        email: cliente.email || "",
        financial_contact: cliente.financial_contact || "",
        observations: cliente.observations || "",
        status: cliente.status as string | null ?? "ativo"
      });
      setAircraftOwnerships(cliente.aircraft_ownerships || []);
      setLogoPreview(cliente.logo_url || null);
    } else {
      setEditingCliente(null);
      setFormData({
        company_name: "",
        cnpj: "",
        inscricao_estadual: "",
        address: "",
        city: "",
        uf: "",
        phone: "",
        email: "",
        financial_contact: "",
        observations: "",
        status: "ativo"
      });
      setAircraftOwnerships([]);
      setLogoPreview(null);
    }
    setLogoFile(null);
    setDocumentFiles([]);
    setIsDialogOpen(true);
  };
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCliente(null);
    setAircraftOwnerships([]);
  };
  const addAircraftOwnership = () => {
    setAircraftOwnerships([...aircraftOwnerships, {
      aircraft: "",
      ownership_percentage: 0
    }]);
  };
  const removeAircraftOwnership = (index: number) => {
    setAircraftOwnerships(aircraftOwnerships.filter((_, i) => i !== index));
  };
  const updateAircraftOwnership = (index: number, field: string, value: any) => {
    const updated = [...aircraftOwnerships];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    if (field === 'aircraft') {
      const aircraft = aircraftOptions.find(a => a.id === value);
      if (aircraft) {
        updated[index].aircraft_registration = aircraft.registration;
        updated[index].aircraft_model = aircraft.model;
      }
    }
    setAircraftOwnerships(updated);
  };
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setDocumentFiles(prev => [...prev, ...files]);
  };
  const removeDocument = (index: number) => {
    setDocumentFiles(prev => prev.filter((_, i) => i !== index));
  };
  const uploadFile = async (file: File, path: string) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${path}/${fileName}`;
    const {
      error: uploadError,
      data
    } = await supabase.storage.from("client-documents").upload(filePath, file);
    if (uploadError) throw uploadError;
    const {
      data: urlData
    } = supabase.storage.from("client-documents").getPublicUrl(filePath);
    return urlData.publicUrl;
  };
  const deleteDocumentFile = async (documentUrl: string) => {
    try {
      const urlParts = documentUrl.split("/");
      const bucketPath = urlParts.slice(urlParts.indexOf("client-documents") + 1).join("/");
      if (!bucketPath) return;
      const {
        error
      } = await supabase.storage.from("client-documents").remove([bucketPath]);
      if (error) throw error;
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
        setEditingCliente({
          ...editingCliente,
          documents: updatedDocs
        });
        toast({
          title: "Sucesso",
          description: "Documento removido"
        });
      }
    } catch (error) {
      console.error("Erro ao remover documento:", error);
      toast({
        title: "Erro",
        description: "Erro ao remover documento",
        variant: "destructive"
      });
    }
  };
  const handleSave = async () => {
    try {
      if (!formData.company_name || !formData.cnpj) {
        toast({
          title: "Campos obrigatórios",
          description: "Nome da empresa e CNPJ são obrigatórios",
          variant: "destructive"
        });
        return;
      }
      setUploadingFiles(true);
      let logoUrl = editingCliente?.logo_url;
      let existingDocs = editingCliente?.documents || [];
      if (logoFile) {
        const fileExt = logoFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `logos/${fileName}`;
        const {
          error: uploadError
        } = await supabase.storage.from("company-logos").upload(filePath, logoFile);
        if (uploadError) throw uploadError;
        const {
          data: urlData
        } = supabase.storage.from("company-logos").getPublicUrl(filePath);
        logoUrl = urlData.publicUrl;
      }
      const newDocs: ClientDocument[] = [];
      for (const file of documentFiles) {
        const url = await uploadFile(file, "documents");
        newDocs.push({
          name: file.name,
          url,
          type: file.type,
          uploaded_at: new Date().toISOString()
        });
      }
      const updatedData = {
        company_name: formData.company_name,
        cnpj: formData.cnpj,
        inscricao_estadual: formData.inscricao_estadual,
        address: formData.address,
        city: formData.city,
        uf: formData.uf,
        phone: formData.phone,
        email: formData.email,
        financial_contact: formData.financial_contact,
        observations: formData.observations,
        status: (formData as any).status ?? "ativo",
        logo_url: logoUrl,
        documents: [...existingDocs, ...newDocs]
      };
      let clientId = editingCliente?.id;
      if (editingCliente) {
        const {
          error
        } = await supabase.from("clients").update(updatedData as any).eq("id", editingCliente.id);
        if (error) throw error;

        // Delete existing aircraft relationships
        const {
          error: deleteError
        } = await supabase.from("client_aircraft").delete().eq("client_id", editingCliente.id);
        if (deleteError) throw deleteError;
        const prevActive = String(editingCliente.status as any || '').toLowerCase();
        const newActive = String((updatedData as any).status || '').toLowerCase();
        const becameActive = !(prevActive === 'ativo' || prevActive === 'active' || prevActive === '') && (newActive === 'ativo' || newActive === 'active' || newActive === '');
        if (becameActive) {
          try {
            await ensureTravelReportsFolder(updatedData.company_name);
          } catch (e) {
            console.warn('Falha ao criar pasta do cliente (ativação):', e);
          }
        }
        toast({
          title: "Sucesso",
          description: "Cliente atualizado com sucesso"
        });
      } else {
        const {
          data: insertData,
          error
        } = await supabase.from("clients").insert([updatedData as any]).select().single();
        if (error) throw error;
        clientId = insertData?.id;
        const isActive = String((updatedData as any).status || '').toLowerCase() === 'ativo' || String((updatedData as any).status || '').toLowerCase() === 'active';
        if (isActive) {
          try {
            const folder = toFolder(updatedData.company_name);
            const emptyBlob = new Blob([''], {
              type: 'text/plain'
            });
            await supabase.storage.from('travel-reports').upload(`${folder}/.keep`, emptyBlob, {
              upsert: true,
              contentType: 'text/plain'
            });
          } catch (e) {
            console.warn('Não foi possível criar a pasta do cliente em travel-reports:', e);
          }
        }
        toast({
          title: "Sucesso",
          description: "Cliente cadastrado com sucesso"
        });
      }

      // Save aircraft relationships
      if (clientId && aircraftOwnerships.length > 0) {
        const aircraftData = aircraftOwnerships.filter(ownership => ownership.aircraft).map(ownership => ({
          client_id: clientId,
          aircraft_id: ownership.aircraft,
          share_percentage: Math.max(0, Math.min(100, ownership.ownership_percentage || 0))
        }));
        if (aircraftData.length > 0) {
          const {
            error: aircraftError
          } = await supabase.from("client_aircraft").insert(aircraftData);
          if (aircraftError) {
            console.error("Erro ao salvar aeronaves:", aircraftError);
            toast({
              title: "Aviso",
              description: "Cliente salvo, mas houve erro ao salvar as aeronaves",
              variant: "destructive"
            });
          }
        }
      }
      handleCloseDialog();
      loadClientes();
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar cliente",
        variant: "destructive"
      });
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
      const {
        error
      } = await supabase.from("clients").delete().eq("id", deleteId);
      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Cliente excluído com sucesso"
      });
      loadClientes();
    } catch (error) {
      console.error("Erro ao excluir cliente:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir cliente",
        variant: "destructive"
      });
    } finally {
      setDeleteId(null);
    }
  };
  const filteredClientes = clientes.filter(cliente => cliente.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) || cliente.cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) || cliente.email?.toLowerCase().includes(searchTerm.toLowerCase()));
  const isActive = (status?: string | null) => {
    const s = String(status ?? '').toLowerCase();
    return s === 'active' || s === 'ativo' || s === '';
  };
  const activeClientes = filteredClientes.filter(c => isActive(c.status));
  const inactiveClientes = filteredClientes.filter(c => !isActive(c.status));
  return <Layout>
      {!viewingCliente && <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Clientes / Cotistas
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie o cadastro de clientes e cotistas
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} size="lg" className="gap-2 shadow-md rounded-lg px-[4px] bg-teal-700 hover:bg-teal-600">
            <Plus className="h-4 w-4" />
            Novo Cadastro
          </Button>
        </div>

        {/* Stats Cards */}
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

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CNPJ ou cidade..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-11" />
        </div>

        {/* Content */}
        {loading ? <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm">Carregando clientes...</p>
            </div>
          </div> : filteredClientes.length === 0 ? <Card className="border-dashed">
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
          </Card> : <div className="space-y-6">
            {/* Active Clients */}
            {!showInactive && activeClientes.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeClientes.map(cliente => <ClienteCard key={cliente.id} cliente={cliente} onView={handleViewCliente} onEdit={handleOpenDialog} onDelete={setDeleteId} />)}
              </div>}

            {/* Inactive Clients */}
            {showInactive && inactiveClientes.length > 0 && <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Folder className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">Clientes Inativos</h2>
                  <Badge variant="secondary">{inactiveClientes.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inactiveClientes.map(cliente => <ClienteCard key={cliente.id} cliente={cliente} onView={handleViewCliente} onEdit={handleOpenDialog} onDelete={setDeleteId} />)}
                </div>
              </div>}

            {showInactive && inactiveClientes.length === 0 && <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Nenhum cliente inativo</p>
                </CardContent>
              </Card>}
          </div>}
      </div>}

      {/* Perfil do Cliente */}
      {viewingCliente && <div className="p-6 space-y-6 max-w-5xl mx-auto">
          {/* Back Button */}
          <Button variant="ghost" onClick={handleCloseView} className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
            <ChevronLeft className="h-4 w-4" />
            Voltar para Clientes
          </Button>

          {/* Header Card */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="relative">
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
              
              <CardContent className="relative p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-4 ring-background shadow-xl">
                      {viewingCliente.logo_url && <AvatarImage src={viewingCliente.logo_url} alt={viewingCliente.company_name} className="object-cover" />}
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-2xl font-bold">
                        {viewingCliente.company_name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                        {viewingCliente.company_name}
                      </h1>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                          Cliente Ativo
                        </Badge>
                        <Badge variant="outline" className="font-mono text-xs">
                          {viewingCliente.cnpj}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => handleOpenDialog(viewingCliente)} className="gap-2 shadow-md">
                    <Edit className="h-4 w-4" />
                    Editar
                  </Button>
                </div>
              </CardContent>
            </div>
          </Card>

          {/* Info Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  Informações de Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {viewingCliente.phone && <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Telefone</p>
                      <p className="text-sm font-medium text-foreground">{viewingCliente.phone}</p>
                    </div>
                  </div>}
                {viewingCliente.email && <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">E-mail</p>
                      <p className="text-sm font-medium text-foreground break-all">{viewingCliente.email}</p>
                    </div>
                  </div>}
                {(viewingCliente.address || viewingCliente.city || viewingCliente.uf) && <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Endereço</p>
                      <p className="text-sm font-medium text-foreground">
                        {[viewingCliente.address, [viewingCliente.city, viewingCliente.uf].filter(Boolean).join(' - ')].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>}
                {viewingCliente.financial_contact && <div className="flex items-start gap-3">
                    <Building className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Contato Financeiro</p>
                      <p className="text-sm font-medium text-foreground">{viewingCliente.financial_contact}</p>
                    </div>
                  </div>}
                {!viewingCliente.phone && !viewingCliente.email && !viewingCliente.address && !viewingCliente.city && !viewingCliente.uf && !viewingCliente.financial_contact && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma informação de contato</p>}
              </CardContent>
            </Card>

            {/* Additional Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building className="h-4 w-4 text-primary" />
                  </div>
                  Informações Adicionais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {viewingCliente.inscricao_estadual && <div>
                    <p className="text-xs text-muted-foreground mb-1">Inscrição Estadual</p>
                    <p className="text-sm font-medium text-foreground font-mono">{viewingCliente.inscricao_estadual}</p>
                  </div>}
                {viewingCliente.aircraft_ownerships && viewingCliente.aircraft_ownerships.length > 0 && <div>
                    <p className="text-xs text-muted-foreground mb-2">Aeronaves e Participação</p>
                    <div className="space-y-2">
                      {viewingCliente.aircraft_ownerships.map((ownership, idx) => <div key={idx} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm font-medium text-foreground">
                            {ownership.aircraft_registration} - {ownership.aircraft_model}
                          </span>
                          <Badge variant="secondary" className="font-semibold">
                            {ownership.ownership_percentage}%
                          </Badge>
                        </div>)}
                    </div>
                  </div>}
                {viewingCliente.observations && <div>
                    <p className="text-xs text-muted-foreground mb-2">Observações</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                      {viewingCliente.observations}
                    </p>
                  </div>}
                {!viewingCliente.inscricao_estadual && !viewingCliente.aircraft_ownerships?.length && !viewingCliente.observations && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma informação adicional</p>}
              </CardContent>
            </Card>
          </div>

          {/* Documents Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {viewingCliente.documents && viewingCliente.documents.length > 0 ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {viewingCliente.documents.map((doc, index) => <button key={index} type="button" onClick={() => setPreviewDoc(doc)} className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted/50 hover:border-primary/50 transition-all text-left group">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {doc.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(doc.uploaded_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </button>)}
                </div> : <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento anexado</p>}
            </CardContent>
          </Card>
        </div>}

      {/* Visualizador de Documento */}
      <Dialog open={!!previewDoc} onOpenChange={open => {
      if (!open) setPreviewDoc(null);
    }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden">
          <div className="h-full w-full">
            {previewDoc && (previewDoc.type?.includes("pdf") || previewDoc.name.toLowerCase().endsWith(".pdf")) ? <iframe src={`${previewDoc.url}#toolbar=1&navpanes=0`} className="w-full h-full" title={previewDoc.name} /> : <div className="p-6 space-y-3">
                <p className="text-sm text-muted-foreground">Visualização não suportada. Faça o download abaixo.</p>
                <a href={previewDoc?.url} target="_blank" rel="noopener noreferrer" className="underline">Baixar arquivo</a>
              </div>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Cadastro/Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCliente ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do cliente / cotista
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="files">Logo e Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="company_name">Nome da Empresa *</Label>
                <Input id="company_name" value={formData.company_name} onChange={e => setFormData({
                  ...formData,
                  company_name: e.target.value
                })} placeholder="Razão Social" />
              </div>

              <div>
                <Label htmlFor="cnpj">CNPJ *</Label>
                <Input id="cnpj" value={formData.cnpj} onChange={e => setFormData({
                  ...formData,
                  cnpj: e.target.value
                })} placeholder="00.000.000/0000-00" />
              </div>

              <div>
                <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                <Input id="inscricao_estadual" value={formData.inscricao_estadual} onChange={e => setFormData({
                  ...formData,
                  inscricao_estadual: e.target.value
                })} placeholder="000.000.000.000" />
              </div>

              <div className="col-span-2">
                <Label htmlFor="address">Endereço</Label>
                <Input id="address" value={formData.address} onChange={e => setFormData({
                  ...formData,
                  address: e.target.value
                })} placeholder="Rua, número, bairro" />
              </div>

              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" value={formData.city} onChange={e => setFormData({
                  ...formData,
                  city: e.target.value
                })} placeholder="São Paulo" />
              </div>

              <div>
                <Label htmlFor="uf">UF</Label>
                <Input id="uf" value={formData.uf} onChange={e => setFormData({
                  ...formData,
                  uf: e.target.value.toUpperCase().slice(0, 2)
                })} placeholder="SP" maxLength={2} />
              </div>

              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" value={formData.phone} onChange={e => setFormData({
                  ...formData,
                  phone: e.target.value
                })} placeholder="(00) 00000-0000" />
              </div>

              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => setFormData({
                  ...formData,
                  email: e.target.value
                })} placeholder="contato@empresa.com" />
              </div>

              <div>
                <Label htmlFor="financial_contact">Contato Financeiro</Label>
                <Input id="financial_contact" value={formData.financial_contact} onChange={e => setFormData({
                  ...formData,
                  financial_contact: e.target.value
                })} placeholder="Nome do responsável financeiro" />
              </div>

              <div className="col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Aeronaves e Percentual de Sociedade</Label>
                  <div className="flex gap-2">
                    {aircraftOptions.length === 0 && <Button type="button" variant="outline" size="sm" onClick={loadAircraftOptions} disabled={loadingAircraft} className="flex items-center gap-2">
                        🔄 Recarregar
                      </Button>}
                    <Button type="button" variant="outline" size="sm" onClick={addAircraftOwnership} disabled={aircraftOptions.length === 0 || loadingAircraft} className="flex items-center gap-2" title={aircraftOptions.length === 0 ? "Nenhuma aeronave disponível para vincular" : "Adicionar aeronave"}>
                      <Plus className="h-4 w-4" />
                      Adicionar Aeronave
                    </Button>
                  </div>
                </div>

                {loadingAircraft && <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg text-sm text-blue-800 mb-3">
                    ⏳ Carregando aeronaves...
                  </div>}

                {!loadingAircraft && aircraftOptions.length === 0 && <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg text-sm text-yellow-800 mb-3 space-y-2">
                    <p>⚠️ <strong>Nenhuma aeronave disponível</strong></p>
                    <p>Cadastre uma aeronave em "Gestão de Aeronaves" para vincular a este cliente.</p>
                    <p className="text-xs">Se já cadastrou, clique em "Recarregar" acima.</p>
                  </div>}

                {aircraftOwnerships.length === 0 ? <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
                    Nenhuma aeronave adicionada. Clique em "Adicionar Aeronave" para começar.
                  </div> : <div className="space-y-3">
                    {aircraftOwnerships.map((ownership, index) => <div key={index} className="space-y-3 p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <Label className="text-sm font-medium text-foreground mb-2 block">Aeronave *</Label>
                            {loadingAircraft ? <div className="p-3 border rounded text-center text-sm text-muted-foreground bg-muted">
                                Carregando aeronaves...
                              </div> : aircraftOptions.length === 0 ? <div className="p-3 border border-yellow-300 rounded text-center text-sm text-yellow-700 bg-yellow-50">
                                Nenhuma aeronave disponível
                              </div> : <Select value={ownership.aircraft} onValueChange={v => updateAircraftOwnership(index, 'aircraft', v)}>
                                <SelectTrigger className="w-full bg-background">
                                  <SelectValue placeholder="Selecione a aeronave..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-64">
                                  {aircraftOptions.length === 0 ? <div className="p-2 text-sm text-muted-foreground text-center">
                                      Nenhuma aeronave disponível
                                    </div> : aircraftOptions.map(a => <SelectItem key={a.id} value={a.id}>
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-primary">{a.registration}</span>
                                          <span className="text-muted-foreground">-</span>
                                          <span>{a.model}</span>
                                        </div>
                                      </SelectItem>)}
                                </SelectContent>
                              </Select>}
                          </div>

                          <Button type="button" variant="destructive" size="sm" onClick={() => removeAircraftOwnership(index)} className="h-9 w-9 p-0 mt-7" title="Remover">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div>
                          <Label className="text-sm text-muted-foreground mb-1 block">Percentual de Participação (%)</Label>
                          <Input type="number" min="0" max="100" step="0.01" value={ownership.ownership_percentage} onChange={e => updateAircraftOwnership(index, 'ownership_percentage', parseFloat(e.target.value) || 0)} placeholder="Ex: 50" className="text-right" />
                          <p className="text-xs text-muted-foreground mt-1">Sua participação nesta aeronave</p>
                        </div>
                      </div>)}
                  </div>}
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={(formData as any).status} onValueChange={v => setFormData({
                  ...formData,
                  status: v
                })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label htmlFor="observations">Observações</Label>
                <Textarea id="observations" value={formData.observations} onChange={e => setFormData({
                  ...formData,
                  observations: e.target.value
                })} placeholder="Informações adicionais sobre o cliente" rows={3} />
              </div>
            </div>
          </TabsContent>

            <TabsContent value="files" className="space-y-4 mt-4">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label>Logo da Empresa</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                       upload da logo da empresa (formatos: PNG, JPG, SVG)
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    {logoPreview && <Avatar className="h-20 w-20">
                        <AvatarImage src={logoPreview} alt="Logo" />
                        <AvatarFallback>
                          <Image className="h-8 w-8" />
                        </AvatarFallback>
                      </Avatar>}
                    <div className="flex-1">
                      <Input type="file" accept="image/*" onChange={handleLogoChange} className="cursor-pointer" />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div>
                    <Label>Documentos</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Anexe documentos como CNPJ, contratos, etc.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Input type="file" multiple onChange={handleDocumentChange} className="cursor-pointer" />
                  </div>

                  {documentFiles.length > 0 && <div className="space-y-2">
                      <Label className="text-sm">Novos documentos:</Label>
                      {documentFiles.map((file, index) => <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeDocument(index)} className="h-6 w-6 p-0">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>)}
                    </div>}

                  {editingCliente?.documents && editingCliente.documents.length > 0 && <div className="space-y-2">
                      <Label className="text-sm">Documentos existentes:</Label>
                      {editingCliente.documents.map((doc, index) => <div key={index} className="flex items-center justify-between p-2 border rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">
                              {doc.name}
                            </a>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeDocumentFromEditing(index)} className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>)}
                    </div>}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={uploadingFiles}>
              {uploadingFiles ? "Salvando..." : editingCliente ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este cliente? Esta ação n��o pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>;
}