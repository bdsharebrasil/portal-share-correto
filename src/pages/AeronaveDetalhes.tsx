import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Edit, Plane, Calendar, MapPin, Users, Fuel, FileText, Upload, Trash2, Download, Eye, Shield, Radio, Scale, Wrench, FileCheck, BookOpen, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AddAircraftDialog } from "@/components/diario/AddAircraftDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
interface AircraftDocument {
  id: string;
  aircraft_id: string | null;
  document_type: string | null;
  name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  expiry_date: string | null;
  alert_days: number | null;
  description: string | null;
  created_at: string | null;
  uploaded_by: string | null;
}
const DOCUMENT_TYPES = [{
  key: "apolice_seguro",
  label: "Apólice de Seguro",
  icon: Shield,
  color: "text-blue-500"
}, {
  key: "certificado_matricula",
  label: "Certificado de Matrícula (CM)",
  icon: FileCheck,
  color: "text-green-500"
}, {
  key: "certificado_aeronavegabilidade",
  label: "Certificado de Aeronavegabilidade (CA)",
  icon: FileCheck,
  color: "text-emerald-500"
}, {
  key: "manual_voo",
  label: "Manual de Voo e Checklists",
  icon: BookOpen,
  color: "text-purple-500"
}, {
  key: "licenca_anatel",
  label: "Licença de Estação (ANATEL)",
  icon: Radio,
  color: "text-orange-500"
}, {
  key: "seguro_reta",
  label: "Apólice de Seguro RETA",
  icon: Shield,
  color: "text-cyan-500"
}, {
  key: "fiam",
  label: "Ficha de Inspeção Anual (FIAM)",
  icon: Wrench,
  color: "text-rose-500"
}, {
  key: "pesagem_balanceamento",
  label: "Ficha de Pesagem e Balanceamento",
  icon: Scale,
  color: "text-amber-500"
}];
export default function AeronaveDetalhes() {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [alertDays, setAlertDays] = useState("30");
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const {
    data: aircraft,
    isLoading
  } = useQuery({
    queryKey: ["aircraft-detail", id],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("aircraft").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });
  const {
    data: clients
  } = useQuery({
    queryKey: ["clients-for-aircraft", id],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("client_aircraft").select(`
          share_percentage,
          clients:client_id(id, company_name)
        `).eq("aircraft_id", id);
      if (error) throw error;
      return data as Array<{
        share_percentage: number;
        clients: {
          id: string;
          company_name: string | null;
        };
      }>;
    },
    enabled: !!id
  });
  const {
    data: documents,
    refetch: refetchDocuments
  } = useQuery({
    queryKey: ["aircraft-documents", id],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("flight_documents").select("*").eq("aircraft_id", id).order("document_type");
      if (error) throw error;
      return data as AircraftDocument[];
    },
    enabled: !!id
  });
  const handleUploadDocument = async () => {
    if (!uploadFile || !selectedDocType || !id) return;
    setIsUploading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${id}/${selectedDocType}_${Date.now()}.${fileExt}`;
      const {
        error: uploadError
      } = await supabase.storage.from("flight-documents").upload(fileName, uploadFile);
      if (uploadError) throw uploadError;

      // Delete existing document of same type if exists
      const existingDoc = documents?.find(d => d.document_type === selectedDocType);
      if (existingDoc) {
        await supabase.storage.from("flight-documents").remove([existingDoc.file_path]);
        await supabase.from("flight_documents").delete().eq("id", existingDoc.id);
      }
      const {
        error: insertError
      } = await supabase.from("flight_documents").insert({
        aircraft_id: id,
        document_type: selectedDocType,
        name: uploadFile.name,
        file_path: fileName,
        file_size: uploadFile.size,
        file_type: uploadFile.type,
        description: notes || null,
        expiry_date: expiryDate || null,
        alert_days: alertDays ? parseInt(alertDays) : 30
      });
      if (insertError) throw insertError;
      toast.success("Documento enviado com sucesso!");
      setUploadDialogOpen(false);
      setUploadFile(null);
      setNotes("");
      setExpiryDate("");
      setAlertDays("30");
      setSelectedDocType(null);
      refetchDocuments();
    } catch (error: any) {
      toast.error(`Erro ao enviar documento: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };
  const handleDeleteDocument = async () => {
    if (!deleteConfirmId) return;
    try {
      const doc = documents?.find(d => d.id === deleteConfirmId);
      if (doc) {
        await supabase.storage.from("flight-documents").remove([doc.file_path]);
      }
      const {
        error
      } = await supabase.from("flight_documents").delete().eq("id", deleteConfirmId);
      if (error) throw error;
      toast.success("Documento excluído!");
      setDeleteConfirmId(null);
      refetchDocuments();
    } catch (error: any) {
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };
  const handleViewDocument = async (doc: AircraftDocument) => {
    const {
      data
    } = await supabase.storage.from("flight-documents").createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };
  const handleDownloadDocument = async (doc: AircraftDocument) => {
    const {
      data
    } = await supabase.storage.from("flight-documents").download(doc.file_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  const getDocumentByType = (type: string) => {
    return documents?.find(d => d.document_type === type);
  };
  const isDocumentExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };
  const isDocumentExpiringSoon = (expiryDate: string | null, alertDays: number | null = 30) => {
    if (!expiryDate) return false;
    const daysToAlert = alertDays || 30;
    const alertDate = new Date();
    alertDate.setDate(alertDate.getDate() + daysToAlert);
    const expiry = new Date(expiryDate);
    return expiry > new Date() && expiry <= alertDate;
  };
  if (isLoading) {
    return <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Plane className="h-12 w-12 mx-auto text-muted-foreground/40 animate-pulse" />
            <p className="text-muted-foreground">Carregando informações...</p>
          </div>
        </div>
      </Layout>;
  }
  if (!aircraft) {
    return <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <p className="text-muted-foreground">Aeronave não encontrada</p>
            <Button onClick={() => navigate("/aeronaves")}>Voltar</Button>
          </div>
        </div>
      </Layout>;
  }
  return <Layout>
      <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6 lg:p-8 rounded-3xl shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-xl" onClick={() => navigate("/aeronaves")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="h-16 w-16 lg:h-20 lg:w-20 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                <Plane className="h-8 w-8 lg:h-10 lg:w-10 text-white" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold tracking-wider uppercase">
                  {aircraft.registration}
                </h1>
                <p className="text-white/70 mt-1">{aircraft.model} • {aircraft.manufacturer}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`px-4 py-2 text-sm font-medium rounded-xl ${aircraft.status === "inativa" ? "bg-red-500/20 text-red-200 border-red-400/30" : "bg-emerald-500/20 text-emerald-200 border-emerald-400/30"}`} variant="outline">
                {aircraft.status === "inativa" ? "Inativa" : "Ativa"}
              </Badge>
              <Button variant="secondary" className="rounded-xl" onClick={() => setEditDialogOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
          </div>
        </div>

        {/* Info Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-blue-900/30 to-blue-800/20 hover:from-blue-900/40 hover:to-blue-800/30 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-7 w-7 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-blue-300/80 uppercase tracking-widest font-semibold mb-1">Ano de Fabricação</p>
                  <p className="text-2xl font-bold text-blue-100">{aircraft.year || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 hover:from-emerald-900/40 hover:to-emerald-800/30 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-7 w-7 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-emerald-300/80 uppercase tracking-widest font-semibold mb-1">Base </p>
                  <p className="text-2xl font-bold text-emerald-100">{(aircraft.base || "—").toUpperCase()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-orange-900/30 to-orange-800/20 hover:from-orange-900/40 hover:to-orange-800/30 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <Fuel className="h-7 w-7 text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-orange-300/80 uppercase tracking-widest font-semibold mb-1">Consumo Combustível</p>
                  <p className="text-2xl font-bold text-orange-100">{aircraft.fuel_consumption ? `${aircraft.fuel_consumption} L/H` : "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Clients Line */}
        {clients && clients.length > 0 && <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <Users className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-3">Clientes Vinculados</p>
                  <div className="flex flex-wrap gap-2">
                    {clients.map((c, i) => <Badge key={i} className="rounded-xl bg-gradient-to-r from-cyan-600/30 to-blue-600/30 text-cyan-200 border-cyan-500/50 text-xs font-medium px-3 py-1.5 hover:from-cyan-600/40 hover:to-blue-600/40 transition-colors">
                        {c.clients?.company_name || "Sem nome"}
                        <span className="ml-1.5 font-bold text-cyan-300">({c.share_percentage}%)</span>
                      </Badge>)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>}

        {/* Informações Técnicas */}
        <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl text-white">
              <Wrench className="h-5 w-5 text-purple-400" />
              Informações Técnicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-0 px-0 my-0 mx-[3px]">
              <div className="p-4 bg-gradient-to-br from-slate-800/60 to-slate-700/40 rounded-xl border border-slate-700/50 hover:border-slate-600/70 transition-colors">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">Nº Série</p>
                <p className="text-base font-bold text-slate-100">{aircraft.serial_number || "N/A"}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-slate-800/60 to-slate-700/40 rounded-xl border border-slate-700/50 hover:border-slate-600/70 transition-colors">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">Fabricante</p>
                <p className="text-base font-bold text-slate-100">{aircraft.manufacturer || "N/A"}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-slate-800/60 to-slate-700/40 rounded-xl border border-slate-700/50 hover:border-slate-600/70 transition-colors">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">Modelo</p>
                <p className="text-base font-bold text-slate-100">{aircraft.model || "N/A"}</p>
              </div>
              
              
              <div className="p-4 bg-gradient-to-br from-slate-800/60 to-slate-700/40 rounded-xl border border-slate-700/50 hover:border-slate-600/70 transition-colors">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">Proprietário</p>
                <p className="text-base font-bold text-slate-100 truncate">{aircraft.owner_name || "N/A"}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-amber-900/30 to-amber-800/20 rounded-xl border border-amber-700/50 hover:border-amber-600/70 transition-colors">
                <p className="text-xs text-amber-300 uppercase tracking-wider font-medium mb-2">Valor Hora</p>
                <p className="text-base font-bold text-amber-100">{aircraft.hourly_price ? `R$ ${aircraft.hourly_price}` : "N/A"}</p>
              </div>
              
            </div>
          </CardContent>
        </Card>

        {/* Documents Section */}
        <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
          <CardHeader className="pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl text-white">
                  <FileText className="h-6 w-6 text-cyan-400" />
                  Documentos da Aeronave
                </CardTitle>
                <CardDescription className="mt-2 text-slate-400">
                  Gerencie os documentos obrigatórios e certificados
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 my-0 mx-[20px] py-[17px] px-[47px]">
              {DOCUMENT_TYPES.map(docType => {
              const doc = getDocumentByType(docType.key);
              const Icon = docType.icon;
              const expired = doc ? isDocumentExpired(doc.expiry_date) : false;
              const expiringSoon = doc ? isDocumentExpiringSoon(doc.expiry_date, doc.alert_days) : false;
              return <div key={docType.key} className={`p-6 rounded-2xl border-2 transition-all flex flex-col h-full ${doc ? expired ? "border-red-500/40 bg-gradient-to-br from-red-950/40 to-red-900/20 hover:border-red-500/60" : expiringSoon ? "border-amber-500/40 bg-gradient-to-br from-amber-950/40 to-amber-900/20 hover:border-amber-500/60" : "border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 hover:border-emerald-500/60" : "border-dashed border-slate-600/50 bg-slate-800/30 hover:border-cyan-500/50 hover:bg-slate-800/50"}`}>
                    {/* Icon and Title */}
                    <div className="mb-4">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 mb-3 ${doc ? expired ? "bg-red-500/20" : expiringSoon ? "bg-amber-500/20" : "bg-emerald-500/20" : "bg-slate-700/50"}`}>
                        <Icon className={`h-6 w-6 ${doc ? expired ? "text-red-400" : expiringSoon ? "text-amber-400" : "text-emerald-400" : docType.color}`} />
                      </div>
                      <p className="font-semibold text-sm text-white">{docType.label}</p>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      {doc ? <div className="space-y-3">
                          <div className="space-y-1">
                            <p className="text-xs text-slate-400 uppercase tracking-wide">Arquivo</p>
                            <p className="text-xs text-slate-300 font-medium truncate">{doc.name}</p>
                          </div>
                          {doc.expiry_date && <div className="pt-2 border-t border-slate-700/50">
                              {expired ? <Badge variant="destructive" className="text-xs rounded-lg w-full text-center justify-center">
                                  Vencido em {format(new Date(doc.expiry_date), "dd/MM/yyyy")}
                                </Badge> : expiringSoon ? <Badge className="text-xs rounded-lg w-full text-center justify-center bg-amber-500/20 text-amber-300 border-amber-500/30">
                                  Vence em {format(new Date(doc.expiry_date), "dd/MM/yyyy")}
                                </Badge> : <Badge className="text-xs rounded-lg w-full text-center justify-center bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                  Válido até {format(new Date(doc.expiry_date), "dd/MM/yyyy")}
                                </Badge>}
                            </div>}
                        </div> : <div className="text-center py-2">
                          <p className="text-xs text-slate-500">Nenhum documento anexado</p>
                        </div>}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2">
                      {doc && <div className="flex gap-2">
                          <Button size="sm" variant="ghost" className="h-8 px-2 rounded-lg text-xs flex-1" onClick={() => handleViewDocument(doc)}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Ver
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 px-2 rounded-lg text-xs flex-1" onClick={() => handleDownloadDocument(doc)}>
                            <Download className="h-3.5 w-3.5 mr-1" />
                            Download
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 px-2 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30" onClick={() => setDeleteConfirmId(doc.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>}
                      <Button size="sm" className={`w-full rounded-xl font-medium transition-all ${doc ? "bg-slate-700/50 hover:bg-slate-600/70 text-slate-200" : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20"}`} onClick={() => {
                    setSelectedDocType(docType.key);
                    setUploadDialogOpen(true);
                  }}>
                        <Upload className="h-4 w-4 mr-2" />
                        {doc ? "Atualizar" : "Anexar"}
                      </Button>
                    </div>
                  </div>;
            })}
            </div>
          </CardContent>
        </Card>

        {/* Edit Aircraft Dialog */}
        <AddAircraftDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} aircraft={aircraft} />

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Enviar Documento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo de Documento</Label>
                <p className="text-sm text-muted-foreground">
                  {DOCUMENT_TYPES.find(d => d.key === selectedDocType)?.label}
                </p>
              </div>
              <div>
                <Label htmlFor="file">Arquivo</Label>
                <Input id="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expiryDate">Data de Vencimento (opcional)</Label>
                  <Input 
                    id="expiryDate" 
                    type="date" 
                    value={expiryDate} 
                    onChange={e => setExpiryDate(e.target.value)} 
                    className="mt-1" 
                  />
                </div>
                <div>
                  <Label htmlFor="alertDays">Alertar com quantos dias?</Label>
                  <Input 
                    id="alertDays" 
                    type="number" 
                    min="1"
                    max="365"
                    value={alertDays} 
                    onChange={e => setAlertDays(e.target.value)} 
                    placeholder="30"
                    className="mt-1" 
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Adicione observações sobre o documento..." className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUploadDocument} disabled={!uploadFile || isUploading}>
                {isUploading ? "Enviando..." : "Enviar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmId} onOpenChange={open => !open && setDeleteConfirmId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Deseja realmente excluir este documento? Esta ação não pode ser desfeita.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeleteDocument}>
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>;
}