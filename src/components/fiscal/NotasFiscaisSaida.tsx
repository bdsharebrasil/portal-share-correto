import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, FileUp, DollarSign, Search, X, Upload, FileText, Eye, CalendarIcon, Building2, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCategoriasFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { useAeronaves } from "@/hooks/useAeronaves";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer';
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";

// --- CONFIGURAÇÃO DO PDF (APENAS PARA RECIBOS) ---

const getLogoUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/logo.share.png`;
  }
  return '/logo.share.png';
};

const logoUrl = getLogoUrl();

// Estilos do PDF
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  headerLeft: { flexDirection: 'column', justifyContent: 'center' },
  logoHeader: { width: 120, height: 50, objectFit: 'contain', marginBottom: 5 },
  reciboTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 5 },
  headerRight: { alignItems: 'flex-end' },
  label: { color: '#666', fontSize: 8, marginBottom: 2, textTransform: 'uppercase' },
  valueBox: { border: '1px solid #000', padding: 8, width: 150, alignItems: 'center', marginTop: 10, alignSelf: 'flex-end' },
  valueText: { fontSize: 14, fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 20 },
  column: { width: '48%' },
  bold: { fontWeight: 'bold', fontSize: 10, marginBottom: 2 },
  text: { fontSize: 9, marginBottom: 2, color: '#333' },
  sectionHeader: { backgroundColor: '#F3F4F6', padding: 6, marginTop: 10, marginBottom: 10, fontWeight: 'bold', fontSize: 9 },
  description: { fontSize: 9, lineHeight: 1.5, minHeight: 100 },
  footer: { marginTop: 40, borderTop: '1px solid #eee', paddingTop: 20 },
  disclaimer: { fontSize: 8, color: '#888', fontStyle: 'italic', marginBottom: 30 },
  signatureArea: { marginTop: 40, alignItems: 'center' },
  line: { width: 200, borderBottom: '1px solid #000', marginBottom: 5 },
  signatureName: { fontWeight: 'bold' },
  logoSignature: { width: 80, height: 30, objectFit: 'contain', marginTop: 10, opacity: 0.8 }
});

// Componente do Documento PDF (APENAS PARA RECIBOS)
const ReciboDocument = ({ data }: { data: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image src={logoUrl} style={styles.logoHeader} />
          <Text style={styles.reciboTitle}>RECIBO</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.label}>NÚMERO DO RECIBO</Text>
          <Text style={{ fontSize: 12 }}>{data.numero_recibo}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.label}>VALOR TOTAL</Text>
        <View style={styles.valueBox}>
          <Text style={styles.valueText}>
            R$ {parseFloat(data.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={styles.label}>EMISSOR (PRESTADOR)</Text>
          <Text style={styles.bold}>SHARE BRASIL</Text>
          <Text style={styles.text}>CNPJ: 30.898.549.0001/06</Text>
          <Text style={styles.text}>(65) 93618-0312</Text>
          <Text style={styles.text}>END: AV. PRESIDENTE ARTHUR BERNARDES, 1457 - VÁRZEA GRANDE - MT</Text>
        </View>
        <View style={styles.column}>
          <Text style={styles.label}>PAGADOR (CLIENTE)</Text>
          <Text style={styles.bold}>{data.cliente_nome}</Text>
          <Text style={styles.text}>CPF/CNPJ: {data.cliente_cnpj || "Não informado"}</Text>
        </View>
      </View>
      <View>
        <Text style={styles.sectionHeader}>DESCRIÇÃO DO SERVIÇO</Text>
        <Text style={styles.descricao}>
          {data.descricao}
          {data.aeronave_registro ? `\nReferente à aeronave: ${data.aeronave_registro}` : ''}
        </Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.disclaimer}>
          Este documento serve como comprovante de prestação de serviço e só terá validade após quitação do valor acima discriminado.
        </Text>
        <View style={styles.signatureArea}>
          <Text style={{ marginBottom: 40 }}>
            {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <View style={styles.line} />
          <Text style={styles.signatureName}>SHARE BRASIL</Text>
          <Image src={logoUrl} style={styles.logoSignature} />
        </View>
      </View>
    </Page>
  </Document>
);

// --- TIPAGENS ---

interface NotaFiscalSaida {
  aeronave_id: string;
  id: string;
  numero: string;
  cliente_nome: string;
  cliente_cnpj: string;
  client_id: string | null;
  data_criacao: string;
  data_vencimento: string;
  valor: number;
  categoria: string;
  descricao: string | null;
  status: string;
  arquivo_pdf_url: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  criado_por: string | null;
  aeronave: string | null;
  aeronave_id?: string | null;
  aeronave_registro?: string | null;
}

interface Cliente {
  id: string;
  nome: string;
  documento: string;
}

// --- FUNÇÕES DE VALIDAÇÃO ---

const validarNotaFiscal = (formData: any): string | null => {
  if (!formData.numero || formData.numero.trim() === "") return "Número da nota fiscal é obrigatório";
  if (!formData.cliente_nome || formData.cliente_nome.trim() === "") return "Cliente/Empresa é obrigatório";
  if (!formData.cliente_id || formData.cliente_id.trim() === "") return "Selecione um cliente válido";
  if (!formData.cliente_cnpj || formData.cliente_cnpj.trim() === "") return "CNPJ/CPF do cliente é obrigatório";
  if (!formData.valor || formData.valor.trim() === "") return "Valor é obrigatório";

  const valorNumerico = parseFloat(formData.valor);
  if (isNaN(valorNumerico) || valorNumerico <= 0) return "Valor deve ser um número maior que zero";

  if (!formData.data_criacao || formData.data_criacao.trim() === "") return "Data de criação é obrigatória";
  if (!formData.data_vencimento || formData.data_vencimento.trim() === "") return "Data de vencimento é obrigatória";
  if (!formData.categoria || formData.categoria.trim() === "") return "Categoria é obrigatória";

  // Validação de aeronave: se registro foi preenchido, ID deve estar presente
  if (formData.aeronave_registro && formData.aeronave_registro.trim() !== "" && (!formData.aeronave_id || formData.aeronave_id.trim() === "")) {
    return "Selecione uma aeronave válida ou limpe o campo de registro";
  }

  const statusValidos = ["pendente", "recebido", "cancelado"];
  if (!statusValidos.includes(formData.situacao)) return "Status inválido. Valores permitidos: pendente, recebido, cancelado";

  return null;
};

// --- FUNÇÕES AUXILIARES ---

const getStatusBadge = (status: string) => {
  const statusConfig: { [key: string]: { label: string; color: string } } = {
    pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
    recebido: { label: "Recebido", color: "bg-green-100 text-green-800" },
    cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800" },
  };

  const config = statusConfig[status] || { label: status, color: "bg-gray-100 text-gray-800" };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

// --- COMPONENTE PRINCIPAL ---

export function NotasFiscaisSaida() {
  const { getCategoriasReceita } = useCategoriasFinanceiro();
  let categoriasReceita = getCategoriasReceita();
  const { aeronaves, isLoadingAeronaves } = useAeronaves();

  const categoriasNFSaidaIds = [
    'b5143aad-88ed-4649-9f17-3ff15904bda2',
    'd95ca1cc-a6c9-4d07-97a6-eb18f542a333',
    'a7555994-103d-4739-96a5-001c3bec1424',
    '2874b45b-a3bb-4bec-8f7e-74b328f8693c',
    '352095f3-a97a-4539-ad1a-b1471e577583',
    '643fd58f-ae2f-4269-9d5a-93345d613fb9',
    '73355581-c479-4a5d-b90b-90b3332f198e',
  ];

  categoriasReceita = categoriasReceita.filter(cat => categoriasNFSaidaIds.includes(cat.id));

  // Filter only receipt categories (must end with "- RECIBO")
  const categoriasRecibo = categoriasReceita.filter(cat => 
    cat.nome && cat.nome.toUpperCase().endsWith("- RECIBO")
  );

  const [notas, setNotas] = useState<NotaFiscalSaida[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingNota, setEditingNota] = useState<NotaFiscalSaida | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [showReciboDialog, setShowReciboDialog] = useState(false);
  const [showReciboViewer, setShowReciboViewer] = useState(false);
  const [reciboViewUrl, setReciboViewUrl] = useState<string>("");
  const [reciboData, setReciboData] = useState({
    cliente_id: "",
    cliente_nome: "",
    cliente_cnpj: "",
    aeronave_registro: "",
    valor: "",
    data_vencimento: new Date().toISOString().split("T")[0],
    descricao: "",
    categoriaRecibo: "",
  });
  const [isGeneratingRecibo, setIsGeneratingRecibo] = useState(false);

  const [recibos, setRecibos] = useState<any[]>([]);
  const [isLoadingRecibos, setIsLoadingRecibos] = useState(false);
  const [editingRecibo, setEditingRecibo] = useState<any | null>(null);
  const [deleteReciboId, setDeleteReciboId] = useState<string | null>(null);
  const [showReciboEditDialog, setShowReciboEditDialog] = useState(false);
  const [reciboEditData, setReciboEditData] = useState({
    amount: "",
    service_description: "",
    max_payment_date: "",
    status: "pendente",
    category_name: "",
  });

  const [showPdfConfirmDialog, setShowPdfConfirmDialog] = useState(false);
  const [isGeneratingPdfEdit, setIsGeneratingPdfEdit] = useState(false);
  const [pendingReciboUpdate, setPendingReciboUpdate] = useState<any | null>(null);

  // Estados para confirmação de recebimento de NF
  const [showRecebimentoDialog, setShowRecebimentoDialog] = useState(false);
  const [pendingNotaRecebimento, setPendingNotaRecebimento] = useState<{ notaId: string; numeroNota: string } | null>(null);
  const [recebimentoData, setRecebimentoData] = useState({
    banco: "",
    data_recebimento: new Date().toISOString().split("T")[0],
    comprovante_url: "",
  });
  const [isUploadingComprovante, setIsUploadingComprovante] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();

  const defaultCategoria = categoriasReceita.length > 0 ? categoriasReceita[0].id : "";

  const [formData, setFormData] = useState({
    numero: "",
    cliente_nome: "",
    cliente_cnpj: "",
    client_id: "",
    data_criacao: new Date().toISOString().split("T")[0],
    data_vencimento: "",
    valor: "",
    categoria: defaultCategoria,
    descricao: "",
    status: "pendente",
    aeronave_id: "",
    aeronave_registro: "",
  });

  useEffect(() => {
    loadNotas();
    loadClientes();
    loadRecibos();
  }, []);

  const loadClientes = async () => {
    try {
      let { data: clientsData, error } = await supabase
        .from("clientes")
        .select("id, razao_social, cnpj, proprietario, status");

      if (error) {
        console.error("Erro ao carregar clientes:", error);
        clientsData = [];
      }

      const clientesList: Cliente[] = [];

      if (clientsData) {
        clientsData.forEach(client => {
          const nomeCliente = client.razao_social || client.proprietario || client.cnpj || "Cliente";
          if (nomeCliente && nomeCliente !== "Cliente") {
            clientesList.push({
              id: client.id,
              nome: nomeCliente,
              documento: client.cnpj || ""
            });
          }
        });
      }

      clientesList.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      setClientes(clientesList);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
    }
  };

  const loadNotas = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("notas_fiscais_saida")
        .select("*")
        .order("data_criacao", { ascending: false });

      if (error) throw error;
      setNotas((data || []) as unknown as NotaFiscalSaida[]);
    } catch (error) {
      console.error("Erro ao carregar notas:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar notas fiscais",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecibos = async () => {
    try {
      setIsLoadingRecibos(true);

      const { data, error } = await supabase
        .from("conciliacoes_bancarias")
        .select(`
          *,
          clientes:clientes_id (id, razao_social, cnpj),
          aircraft:aeronave_id (id, matricula)
        `)
        .eq("tipo", "cliente")
        .eq("tipo_referencia", "contas_areceber")
        .order("criado_em", { ascending: false });

      if (error) throw error;
      setRecibos(data || []);
    } catch (error) {
      console.error("Erro ao carregar recibos:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar recibos de saída",
        variant: "destructive",
      });
    } finally {
      setIsLoadingRecibos(false);
    }
  };


  const handleSave = async () => {
    const erroValidacao = validarNotaFiscal(formData);
    if (erroValidacao) {
      toast({
        title: "Validação",
        description: erroValidacao,
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser || !currentUser.id) {
        console.error("Erro de autenticação:", { currentUser });
        toast({
          title: "Erro",
          description: "Usuário não autenticado ou ID não disponível",
          variant: "destructive",
        });
        return;
      }

      // Validar se categoria está preenchida
      if (!formData.categoria || formData.categoria.trim() === "") {
        toast({
          title: "Erro",
          description: "Por favor, selecione uma categoria",
          variant: "destructive",
        });
        return;
      }

      // **BUSCAR O NOME DA CATEGORIA PRIMEIRO**
      const categoriaId = formData.categoria.trim();

      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(categoriaId)) {
        toast({
          title: "Erro",
          description: "Categoria inválida. Por favor, selecione novamente.",
          variant: "destructive",
        });
        return;
      }

      const { data: categoriaData, error: categoriaError } = await supabase
        .from("categorias_movimentacao")
        .select("nome, grupo_categoria")
        .eq("id", categoriaId)
        .single();

      if (categoriaError) {
        toast({
          title: "Erro",
          description: `Erro ao buscar informações da categoria: ${categoriaError.message}`,
          variant: "destructive",
        });
        return;
      }

      const categoriaNome = categoriaData?.nome?.trim() || "NF de Saída";

      const clientId = formData.cliente_id?.trim() || null;
      const aircraftId = formData.aeronave_id?.trim() || null;

      if (clientId && !uuidPattern.test(clientId)) {
        toast({
          title: "Erro",
          description: "ID do cliente inválido. Por favor, selecione um cliente válido.",
          variant: "destructive",
        });
        return;
      }

      if (aircraftId && !uuidPattern.test(aircraftId)) {
        toast({
          title: "Erro",
          description: "ID da aeronave inválido. Por favor, selecione uma aeronave válida.",
          variant: "destructive",
        });
        return;
      }

      const notaData: any = {
        numero: formData.numero.trim(),
        cliente_nome: formData.cliente_nome.trim(),
        cliente_cnpj: formData.cliente_cnpj.trim(),
        client_id: clientId,
        data_criacao: formData.data_criacao,
        data_vencimento: formData.data_vencimento,
        valor: parseFloat(formData.valor),
        categoria: categoriaNome,
        descricao: formData.descricao || null,
        status: formData.situacao,
        arquivo_pdf_url: pdfUrl || null,
        aeronave: formData.aeronave_registro || null,
        aeronave_id: aircraftId,
        criado_por: currentUser.id,
      };

      if (editingNota) {
        const editingNotaId = String(editingNota.id).trim();

        if (!uuidPattern.test(editingNotaId)) {
          toast({
            title: "Erro",
            description: "ID da nota inválido. Recarregue a página e tente novamente.",
            variant: "destructive",
          });
          return;
        }

        const { error } = await supabase
          .from("notas_fiscais_saida")
          .update({
            ...notaData,
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", editingNotaId);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Nota fiscal atualizada com sucesso",
        });
      } else {
        const { error } = await supabase
          .from("notas_fiscais_saida")
          .insert([notaData])
          .select();

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Nota fiscal criada com sucesso",
        });
      }

      setOpenDialog(false);
      resetForm();
      loadNotas();
      loadRecibos();
    } catch (error: any) {
      console.error("Erro ao salvar nota:", error);
      const errorMsg = error?.message || "Erro ao salvar nota fiscal";
      toast({
        title: "Erro",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const deleteUuid = String(deleteId).trim();
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidPattern.test(deleteUuid)) {
        toast({
          title: "Erro",
          description: "ID da nota inválido. Recarregue a página e tente novamente.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("notas_fiscais_saida")
        .delete()
        .eq("id", deleteUuid);

      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Nota fiscal deletada com sucesso",
      });
      setDeleteId(null);
      loadNotas();
    } catch (error: any) {
      console.error("Erro ao deletar nota:", error);
      const errorMsg = error?.message || "Erro ao deletar nota fiscal";
      toast({
        title: "Erro",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (nota: NotaFiscalSaida) => {
    setEditingNota(nota);
    setFormData({
      numero: nota.numero,
      cliente_nome: nota.cliente_nome,
      cliente_cnpj: nota.cliente_cnpj,
      client_id: nota.cliente_id || "",
      data_criacao: nota.data_criacao,
      data_vencimento: nota.data_vencimento,
      valor: nota.valor.toString(),
      categoria: nota.categoria,
      descricao: nota.descricao || "",
      status: nota.situacao,
      aeronave_id: nota.aeronave_id || nota.aeronave_id || "",
      aeronave_registro: nota.aeronave || nota.aeronave_registro || "",
    });
    setPdfUrl(nota.arquivo_pdf_url || "");
    setOpenDialog(true);
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.tipo !== "application/pdf") {
      toast({
        title: "Erro",
        description: "Por favor, selecione um arquivo PDF",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPDF(true);
    try {
      const fileName = `nf_${Date.now()}_${formData.numero || 'sem_numero'}.pdf`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("nfs-share-saida")
        .upload(filePath, file);

      if (uploadError) {
        toast({
          title: "Erro",
          description: `Erro ao fazer upload: ${uploadError.message}`,
          variant: "destructive",
        });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("nfs-share-saida")
        .getPublicUrl(filePath);

      setPdfUrl(publicUrlData.publicUrl);
      toast({
        title: "Sucesso",
        description: "Nota Fiscal enviada com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar arquivo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPDF(false);
    }
  };

  const resetForm = () => {
    setFormData({
      numero: "",
      cliente_nome: "",
      cliente_cnpj: "",
      client_id: "",
      data_criacao: new Date().toISOString().split("T")[0],
      data_vencimento: "",
      valor: "",
      categoria: defaultCategoria,
      descricao: "",
      status: "pendente",
      aeronave_id: "",
      aeronave_registro: "",
    });
    setEditingNota(null);
    setPdfUrl("");
  };

  const handleChangeStatus = async (notaId: string, newStatus: string) => {
    if (!notaId || typeof notaId !== 'string' || notaId.trim() === '') {
      toast({
        title: "Erro",
        description: "ID de nota inválido",
        variant: "destructive",
      });
      return;
    }

    const idLimpo = notaId.trim();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(idLimpo)) {
      toast({
        title: "Erro",
        description: `ID inválido: "${idLimpo}"`,
        variant: "destructive",
      });
      return;
    }

    const statusValidos = ["pendente", "recebido", "cancelado"];
    if (!statusValidos.includes(newStatus)) {
      toast({
        title: "Erro",
        description: "Status inválido",
        variant: "destructive",
      });
      return;
    }

    if (newStatus === "recebido") {
      const nota = notas.find(n => n.id === idLimpo);
      if (nota) {
        setPendingNotaRecebimento({ notaId: idLimpo, numeroNota: nota.numero });
        setRecebimentoData({
          banco: "",
          data_recebimento: new Date().toISOString().split("T")[0],
          comprovante_url: "",
        });
        setShowRecebimentoDialog(true);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from("notas_fiscais_saida")
        .update({
          status: newStatus,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", idLimpo)
        .select();

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Status atualizado para ${newStatus === 'cancelado' ? 'Cancelado' : 'Pendente'}`,
      });

      loadNotas();
    } catch (error: any) {
      let errorMsg = error?.message || "Erro ao atualizar status";
      if (errorMsg.includes("uuid = text") || errorMsg.includes("operator does not exist")) {
        errorMsg = "Erro no banco de dados: incompatibilidade de tipos.";
      }

      toast({
        title: "Erro",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const generateReciboNumber = async (clienteNome: string) => {
    const clienteLetras = clienteNome.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '').padEnd(3, 'X');
    const ano = new Date().getFullYear().toString().slice(-2);

    const { data: existingRecibos } = await supabase
      .from("controle_bancario")
      .select("numero_documento")
      .like("numero_documento", `REC-${clienteLetras}%/${ano}`)
      .eq("tipo_movimento", "entrada")
      .order("numero_documento", { ascending: false });

    let numero = 1;
    if (existingRecibos && existingRecibos.length > 0) {
      const ultimoRecibo = existingRecibos[0];
      const match = ultimoRecibo.numero_documento.match(/REC-[A-Z]{3}(\d+)\/\d{2}/);
      if (match) {
        numero = parseInt(match[1]) + 1;
      }
    }

    const numeroFormatado = numero.toString().padStart(3, "0");
    return `REC-${clienteLetras}${numeroFormatado}/${ano}`;
  };

  const handleGenerarRecibo = async () => {
    if (!reciboData.cliente_nome || !reciboData.valor || !reciboData.data_vencimento) {
      toast({ title: "Validação", description: "Preencha cliente, valor e data de vencimento", variant: "destructive" });
      return;
    }
    if (!reciboData.aeronave_registro) {
      toast({ title: "Validação", description: "Selecione uma aeronave", variant: "destructive" });
      return;
    }
    if (!reciboData.categoriaRecibo) {
      toast({ title: "Validação", description: "Selecione a categoria do recibo", variant: "destructive" });
      return;
    }

    try {
      setIsGeneratingRecibo(true);

      const numeroRecibo = await generateReciboNumber(reciboData.cliente_nome);

      const dadosParaPDF = {
        numero_recibo: numeroRecibo,
        valor: reciboData.valor,
        cliente_nome: reciboData.cliente_nome,
        cliente_cnpj: reciboData.cliente_cnpj,
        descricao: reciboData.descricao || "Prestação de serviços aeronáuticos",
        aeronave_registro: reciboData.aeronave_registro,
        data_atual: new Date()
      };

      const blob = await pdf(<ReciboDocument data={dadosParaPDF} />).toBlob();
      const pdfFile = new File([blob], `${numeroRecibo}.pdf`, { type: "application/pdf" });
      const fileName = `recibo_${numeroRecibo}_${Date.now()}.pdf`;
      const filePath = `recibos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("nfs-share-saida")
        .upload(filePath, pdfFile);

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage
        .from("nfs-share-saida")
        .getPublicUrl(filePath);

      const reciboUrl = publicUrlData.publicUrl;

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Usuário não autenticado");

      const CATEGORIA_ID = "2874b45b-a3bb-4bec-8f7e-74b328f8693c";

      // make sure we always have a client id selected from the combobox
      const clientId = reciboData.cliente_id?.trim();
      if (!clientId) {
        throw new Error("Cliente é obrigatório. Por favor, selecione um cliente válido.");
      }

      let aeronaveId = null;
      const { data: aeroData } = await supabase.from('aeronave').select("id").eq('matricula', reciboData.aeronave_registro).single();
      aeronaveId = aeroData?.id || null;

      const { data: categoriaData } = await supabase.from("categorias_movimentacao").select("grupo_categoria").eq("id", CATEGORIA_ID).single();
      const grupoCategoria = categoriaData?.grupo_categoria || null;

      const { error: controleBancarioError } = await supabase
        .from("controle_bancario")
        .insert({
          data: new Date().toISOString().split("T")[0],
          data_vencimento: reciboData.data_vencimento,
          tipo_movimento: "entrada",
          status: "pendente",
          numero_documento: numeroRecibo,
          valor: parseFloat(reciboData.valor),
          categoria_id: CATEGORIA_ID,
          descricao: reciboData.descricao || "Recibo de Saída - Serviços",
          recibo_url: reciboUrl,
          client_id: clientId,
          client_name: reciboData.cliente_nome,
          aeronave_id: aeronaveId,
          aeronave_registro: reciboData.aeronave_registro,
          grupo_categoria: grupoCategoria,
          criado_por: currentUser.id,
        })
        .select()
        .single();

      if (controleBancarioError) throw new Error(`Erro controle_bancario: ${controleBancarioError.message}`);

      // Insert into bank_reconciliations to populate the receipts history
      const { error: bankReconciliationError } = await supabase
        .from("conciliacoes_bancarias")
        .insert({
          documento: numeroRecibo,
          data: new Date().toISOString().split("T")[0],
          descricao: reciboData.descricao || "Recibo de Saída - Serviços",
          valor: parseFloat(reciboData.valor),
          tipo: "cliente",
          tipo_referencia: "contas_areceber",
          status: "pendente",
          categoria: reciboData.categoriaRecibo || "Recibo de Serviço",
          clientes_id: clientId,
          aeronave_id: aeronaveId,
          nf_url: reciboUrl,
          prazo_pagamento: reciboData.data_vencimento,
          criado_por: currentUser.id,
        });

      if (bankReconciliationError) {
        console.warn("Aviso ao inserir em bank_reconciliations:", bankReconciliationError.message);
      }

      if (reciboData.aeronave_registro) {
        const { error: contasAreceberError } = await supabase.from("contas_areceber").insert({
          numero: numeroRecibo,
          cliente_nome: reciboData.cliente_nome,
          cliente_cnpj: reciboData.cliente_cnpj || "000.000.000-00",
          data_criacao: new Date().toISOString().split("T")[0],
          data_vencimento: reciboData.data_vencimento,
          valor: parseFloat(reciboData.valor),
          categoria: reciboData.categoriaRecibo || "Recibo de Serviço",
          descricao: reciboData.descricao || "Recibo de Serviço",
          status: "pendente",
          aeronave: reciboData.aeronave_registro,
          arquivo_pdf_url: reciboUrl,
          criado_por: currentUser.id,
          fornecedor_tipo: "cliente",
        });

        if (contasAreceberError) {
          console.warn("Aviso ao inserir em contas_areceber:", contasAreceberError.message);
        }
      }

      setReciboViewUrl(reciboUrl);
      setShowReciboViewer(true);

      toast({ title: "Sucesso", description: `Recibo ${numeroRecibo} gerado com sucesso!` });
      setShowReciboDialog(false);
      resetReciboForm();
      loadRecibos();

    } catch (error: any) {
      console.error("Erro ao gerar recibo:", error);
      let message = error.message || "Erro ao gerar recibo";
      // if the backend complained about contas_areceber constraint, we likely missed the cliente
      if (message.includes("contas_areceber_fornecedor_tipo_check")) {
        message = "Falha ao criar movimento bancário. Verifique se o cliente foi selecionado corretamente.";
      }
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setIsGeneratingRecibo(false);
    }
  };

  const resetReciboForm = () => {
    setReciboData({
      cliente_id: "",
      cliente_nome: "",
      cliente_cnpj: "",
      aeronave_registro: "",
      valor: "",
      data_vencimento: new Date().toISOString().split("T")[0],
      descricao: "",
      categoriaRecibo: "",
    });
  };

  const notasExibicao = notas.filter((n) => n.situacao !== "recebido");

  const totalPendente = notas
    .filter((n) => n.situacao === "pendente")
    .reduce((acc, n) => acc + n.valor, 0);

  const totalRecebido = notas
    .filter((n) => n.situacao === "recebido")
    .reduce((acc, n) => acc + n.valor, 0);

  const formatDateSafe = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr + "T12:00:00");
      if (isNaN(date.getTime())) return "-";
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch (error) {
      return "-";
    }
  };

  const handleEditRecibo = (recibo: any) => {
    setEditingRecibo(recibo);
    setReciboEditData({
      amount: recibo.valor.toString(),
      service_description: recibo.descricao,
      max_payment_date: recibo.prazo_pagamento || "",
      status: recibo.situacao || "enviado",
      category_name: recibo.categoria || "",
    });
    setShowReciboEditDialog(true);
  };

  const handleSaveReciboEdit = async () => {
    if (!editingRecibo) return;

    setPendingReciboUpdate({
      id: editingRecibo.id,
      amount: parseFloat(reciboEditData.valor),
      description: reciboEditData.service_description,
      prazo_pagamento: reciboEditData.max_payment_date || null,
      status: reciboEditData.situacao,
      category: reciboEditData.categoria_name,
    });

    setShowPdfConfirmDialog(true);
  };

  const handleGenerateNewPdf = async (generatePdf: boolean) => {
    if (!pendingReciboUpdate) return;

    try {
      let nfUrl = editingRecibo.nf_url;

      if (generatePdf) {
        setIsGeneratingPdfEdit(true);

        const dadosParaPDF = {
          numero_recibo: editingRecibo.documento,
          cliente_nome: editingRecibo.clients?.razao_social || "Não informado",
          cliente_cnpj: editingRecibo.clients?.cnpj || "Não informado",
          descricao: pendingReciboUpdate.descricao,
          aeronave_registro: editingRecibo.aeronave?.matricula || "",
          valor: pendingReciboUpdate.valor,
        };

        const blob = await pdf(<ReciboDocument data={dadosParaPDF} />).toBlob();
        const timestamp = Date.now();
        const pdfFileName = `recibos/recibo_${pendingReciboUpdate.id}_${timestamp}.pdf`;

        const { error: uploadError } = await supabase.storage
          .from("nfs-share-saida")
          .upload(pdfFileName, blob, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("nfs-share-saida")
          .getPublicUrl(pdfFileName);

        if (urlData?.publicUrl) {
          nfUrl = urlData.publicUrl;
        }

        setIsGeneratingPdfEdit(false);
      }

      const { error } = await supabase
        .from("conciliacoes_bancarias")
        .update({
          valor: pendingReciboUpdate.valor,
          descricao: pendingReciboUpdate.descricao,
          prazo_pagamento: pendingReciboUpdate.prazo_pagamento,
          status: pendingReciboUpdate.situacao,
          categoria: pendingReciboUpdate.categoria,
          nf_url: nfUrl,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", String(pendingReciboUpdate.id).trim());

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: generatePdf
          ? "Recibo atualizado e novo PDF gerado com sucesso"
          : "Recibo atualizado com sucesso",
      });

      setShowReciboEditDialog(false);
      setShowPdfConfirmDialog(false);
      setEditingRecibo(null);
      setPendingReciboUpdate(null);
      loadRecibos();
    } catch (error: any) {
      console.error("Erro ao atualizar recibo:", error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao atualizar recibo",
        variant: "destructive",
      });
      setIsGeneratingPdfEdit(false);
    }
  };

  const handleDeleteRecibo = async () => {
    if (!deleteReciboId) return;

    try {
      const { error } = await supabase
        .from("conciliacoes_bancarias")
        .delete()
        .eq("id", String(deleteReciboId).trim());

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Recibo deletado com sucesso",
      });

      setDeleteReciboId(null);
      loadRecibos();
    } catch (error: any) {
      console.error("Erro ao deletar recibo:", error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao deletar recibo",
        variant: "destructive",
      });
    }
  };

  const handleUpdateReciboStatus = async (reciboId: string, newStatus: string) => {
    if (!reciboId || typeof reciboId !== 'string' || reciboId.trim() === '') {
      toast({
        title: "Erro",
        description: "ID de recibo inválido",
        variant: "destructive",
      });
      return;
    }

    const idLimpo = reciboId.trim();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(idLimpo)) {
      toast({
        title: "Erro",
        description: `ID inválido: "${idLimpo}". Esperado um UUID válido.`,
        variant: "destructive",
      });
      return;
    }

    const statusValidos = ["enviado", "pendente", "recebido", "aprovado", "pago", "cancelado", "reembolsado"];
    if (!statusValidos.includes(newStatus)) {
      toast({
        title: "Erro",
        description: `Status inválido: "${newStatus}".`,
        variant: "destructive",
      });
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from("conciliacoes_bancarias")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", idLimpo);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Sucesso",
        description: `Status atualizado com sucesso`,
      });

      loadRecibos();
    } catch (error: any) {
      let errorMsg = error?.message || "Erro ao atualizar status";
      toast({
        title: "Erro",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleComprovanteUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingComprovante(true);

      const fileName = `comprovantes/recebimento_${pendingNotaRecebimento?.numeroNota}_${Date.now()}${file.nome.substring(file.nome.lastIndexOf("."))}`;

      const { error: uploadError } = await supabase.storage
        .from("nfs-share-saida")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("nfs-share-saida")
        .getPublicUrl(fileName);

      setRecebimentoData({
        ...recebimentoData,
        comprovante_url: urlData.publicUrl,
      });

      toast({
        title: "Sucesso",
        description: "Comprovante anexado com sucesso",
      });
    } catch (error: any) {
      console.error("Erro ao upload do comprovante:", error);
      toast({
        title: "Erro",
        description: "Erro ao anexar comprovante",
        variant: "destructive",
      });
    } finally {
      setIsUploadingComprovante(false);
    }
  };

  const handleConfirmRecebimento = async () => {
    if (!pendingNotaRecebimento) return;

    if (!recebimentoData.banco.trim()) {
      toast({
        title: "Erro",
        description: "Banco é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!recebimentoData.data_recebimento) {
      toast({
        title: "Erro",
        description: "Data de recebimento é obrigatória",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("notas_fiscais_saida")
        .update({
          status: "recebido",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", pendingNotaRecebimento.notaId);

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Nota Fiscal marcada como recebida com sucesso",
      });

      setShowRecebimentoDialog(false);
      setPendingNotaRecebimento(null);
      loadNotas();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message || "Erro ao confirmar recebimento",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <Tabs defaultValue="notas-fiscais" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-2 bg-background/30 backdrop-blur-sm border-2 border-border/30 p-2 rounded-xl gap-2">
          <TabsTrigger
            value="notas-fiscais"
            className="rounded-lg py-3 px-6 font-semibold text-base data-[state=active]:bg-blue-500/20 data-[state=active]:border-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20 transition-all duration-300 hover:bg-blue-500/10"
          >
            Notas Fiscais de Saída
          </TabsTrigger>
          <TabsTrigger
            value="recibos-saida"
            className="rounded-lg py-3 px-6 font-semibold text-base data-[state=active]:bg-green-500/20 data-[state=active]:border-2 data-[state=active]:border-green-500 data-[state=active]:text-green-600 data-[state=active]:shadow-lg data-[state=active]:shadow-green-500/20 transition-all duration-300 hover:bg-green-500/10"
          >
            Histórico de Recibos
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Notas Fiscais de Saída */}
        <TabsContent value="notas-fiscais" className="space-y-6 mt-6">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-500/10 via-card to-card border-blue-500/20 shadow-lg shadow-blue-500/5 hover:shadow-lg hover:shadow-blue-500/10 transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-sm font-medium">Total de Notas</p>
                    <div className="p-2.5 rounded-lg bg-blue-500/20 border border-blue-500/30">
                      <FileUp className="w-5 h-5 text-blue-500" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-foreground">{notas.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-500/10 via-card to-card border-yellow-500/20 shadow-lg shadow-yellow-500/5 hover:shadow-lg hover:shadow-yellow-500/10 transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-sm font-medium">Total Pendente</p>
                    <div className="p-2.5 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                      <DollarSign className="w-5 h-5 text-yellow-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-yellow-500">
                    R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 via-card to-card border-green-500/20 shadow-lg shadow-green-500/5 hover:shadow-lg hover:shadow-green-500/10 transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-sm font-medium">Total Recebido</p>
                    <div className="p-2.5 rounded-lg bg-green-500/20 border border-green-500/30">
                      <DollarSign className="w-5 h-5 text-green-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-green-500">
                    R$ {totalRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Formulário para Nova/Editar Nota - Renderizado Inline */}
          {openDialog && (
            <Card className="bg-gradient-to-br from-blue-600/10 to-card border-blue-500/30 shadow-lg mb-6">
              <CardHeader className="border-b border-border/40 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground">
                    {editingNota ? "Editar Nota Fiscal" : "Nova Nota Fiscal de Saída"}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    onClick={() => { setOpenDialog(false); resetForm(); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-foreground">Número da NF *</Label>
                      <Input
                        value={formData.numero}
                        onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                        placeholder="NF-001/2025"
                        className="bg-background border-border"
                      />
                    </div>
                    <div>
                      <Label className="text-foreground">Data de Criação *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal bg-background border-border",
                              !formData.data_criacao && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.data_criacao
                              ? format(parse(formData.data_criacao, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")
                              : "Selecione a data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.data_criacao ? parse(formData.data_criacao, "yyyy-MM-dd", new Date()) : undefined}
                            onSelect={(date) => setFormData({ ...formData, data_criacao: date ? format(date, "yyyy-MM-dd") : "" })}
                            locale={ptBR}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-foreground">Cliente/Empresa *</Label>
                      <SearchableCombobox
                        items={clientes.map(c => ({ id: c.id, label: c.nome }))}
                        value={formData.cliente_id}
                        onChange={(id, label) => {
                          const clienteSelecionado = clientes.find(c => c.id === id);
                          setFormData({
                            ...formData,
                            client_id: id,
                            cliente_nome: label,
                            cliente_cnpj: clienteSelecionado?.documentoumento || ""
                          });
                        }}
                        icon={<Building2 className="h-4 w-4" />}
                        placeholder="Selecione um cliente..."
                        searchPlaceholder="Buscar cliente pelo nome..."
                        emptyMessage="Nenhum cliente encontrado."
                      />
                    </div>
                    <div>
                      <Label className="text-foreground">CNPJ/CPF *</Label>
                      <Input
                        value={formData.cliente_cnpj}
                        onChange={(e) => setFormData({ ...formData, cliente_cnpj: e.target.value, client_id: "" })}
                        placeholder="00.000.000/0000-00"
                        className="bg-background border-border"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-foreground">Aeronave </Label>
                      <SearchableCombobox
                        items={(Array.isArray(aeronaves) ? aeronaves : []).map(a => ({ 
                          id: a.id, 
                          label: a.registration 
                        }))}
                        value={formData.aeronave_id}
                        onChange={(id, label) => {
                          setFormData({
                            ...formData,
                            aeronave_id: id,
                            aeronave_registro: label
                          });
                        }}
                        icon={<Plane className="h-4 w-4" />}
                        placeholder="Selecione a aeronave..."
                        searchPlaceholder="Buscar por prefixo..."
                        emptyMessage="Aeronave não encontrada."
                      />
                    </div>
                    <div className="flex items-end">
                      {formData.aeronave_registro && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              aeronave_id: "",
                              aeronave_registro: ""
                            });
                          }}
                          className="w-full h-10"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Limpar Aeronave
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-foreground">Data de Vencimento *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal bg-background border-border",
                              !formData.data_vencimento && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.data_vencimento
                              ? format(parse(formData.data_vencimento, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")
                              : "Selecione a data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.data_vencimento ? parse(formData.data_vencimento, "yyyy-MM-dd", new Date()) : undefined}
                            onSelect={(date) => setFormData({ ...formData, data_vencimento: date ? format(date, "yyyy-MM-dd") : "" })}
                            locale={ptBR}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="text-foreground">Valor (R$) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.valor}
                        onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                        placeholder="0.00"
                        className="bg-background border-border"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-foreground">Categoria *</Label>
                      <Select value={formData.categoria} onValueChange={(value) => setFormData({ ...formData, categoria: value })}>
                        <SelectTrigger className="w-full bg-background border-border">
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border" align="start">
                          {categoriasReceita.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.nome}
                            </SelectItem>
                          ))}
                          {categoriasReceita.length === 0 && (
                            <div className="text-center py-3 text-muted-foreground text-sm">
                              Nenhuma categoria disponível
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-foreground">Status *</Label>
                      <Select value={formData.situacao} onValueChange={(value) => setFormData({ ...formData, status: value as any })}>
                        <SelectTrigger className="w-full bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border" align="start">
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="recebido">Recebido</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-foreground">Descrição</Label>
                    <Input
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Descrição da nota fiscal"
                      className="bg-background border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">Nota Fiscal (PDF)</Label>
                    {pdfUrl ? (
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <FileText className="h-5 w-5 text-primary" />
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex-1 truncate"
                        >
                          NF anexada
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPdfUrl("")}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".pdf"
                          onChange={handlePDFUpload}
                          disabled={isUploadingPDF}
                          className="hidden"
                          id="pdf-upload"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('pdf-upload')?.click()}
                          disabled={isUploadingPDF}
                          className="w-full"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {isUploadingPDF ? "Enviando..." : "Anexar Nota Fiscal (PDF)"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => { setOpenDialog(false); resetForm(); }} disabled={isUploadingPDF}>
                      Cancelar
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={isUploadingPDF}>
                      {editingNota ? "Atualizar" : "Criar"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botões de Ação */}
          {!openDialog && !showReciboDialog && (
            <div className="flex gap-3 mb-6">
              <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30 flex items-center gap-2 font-medium" onClick={() => setOpenDialog(true)}>
                <Plus className="w-4 h-4" />
                Nova Nota Fiscal de Saída
              </Button>
              <Button className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-500/30 flex items-center gap-2 font-medium" onClick={() => setShowReciboDialog(true)}>
                <Plus className="w-4 h-4" />
                Novo Recibo Saída
              </Button>
            </div>
          )}

          {/* Formulário para Novo Recibo - Renderizado Inline */}
          {showReciboDialog && (
            <Card className="bg-gradient-to-br from-emerald-600/10 to-card border-emerald-500/30 shadow-lg mb-6">
              <CardHeader className="border-b border-border/40 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground">Novo Recibo Saída</CardTitle>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowReciboDialog(false);
                      setReciboData({
                        cliente_id: "",
                        cliente_nome: "",
                        cliente_cnpj: "",
                        aeronave_registro: "",
                        valor: "",
                        data_vencimento: new Date().toISOString().split("T")[0],
                        descricao: "",
                        categoriaRecibo: "",
                      });
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-foreground font-medium mb-2 block">Cliente/Empresa *</Label>
                      <SearchableCombobox
                        items={clientes.map(c => ({ id: c.id, label: c.nome }))}
                        value={reciboData.cliente_id}
                        onChange={(id, label) => {
                          const clienteSelecionado = clientes.find(c => c.id === id);
                          setReciboData({
                            ...reciboData,
                            cliente_id: id,
                            cliente_nome: label,
                            cliente_cnpj: clienteSelecionado?.documentoumento || ""
                          });
                        }}
                        icon={<Building2 className="h-4 w-4" />}
                        placeholder="Selecione um cliente..."
                        searchPlaceholder="Buscar cliente pelo nome..."
                        emptyMessage="Nenhum cliente encontrado."
                      />
                    </div>

                    <div>
                      <Label className="text-foreground font-medium mb-2 block">Aeronave * (Obrigatório)</Label>
                      <SearchableCombobox
                        items={(Array.isArray(aeronaves) ? aeronaves : []).map(a => ({ 
                          id: a.registration, 
                          label: a.registration 
                        }))}
                        value={reciboData.aeronave_registro}
                        onChange={(val, label) => {
                          setReciboData({
                            ...reciboData,
                            aeronave_registro: label
                          });
                        }}
                        icon={<Plane className="h-4 w-4" />}
                        placeholder="Selecione a aeronave..."
                        searchPlaceholder="Buscar por prefixo..."
                        emptyMessage="Aeronave não encontrada."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-foreground font-medium mb-2 block">Valor (R$) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={reciboData.valor}
                        onChange={(e) => setReciboData({ ...reciboData, valor: e.target.value })}
                        placeholder="0.00"
                        className="bg-background border-border"
                      />
                    </div>

                    <div>
                      <Label className="text-foreground font-medium mb-2 block">Data de Vencimento *</Label>
                      <Input
                        type="data"
                        value={reciboData.data_vencimento}
                        onChange={(e) => setReciboData({ ...reciboData, data_vencimento: e.target.value })}
                        className="bg-background border-border"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-foreground font-medium mb-2 block">Descrição do Serviço</Label>
                    <Textarea
                      value={reciboData.descricao}
                      onChange={(e) => setReciboData({ ...reciboData, descricao: e.target.value })}
                      placeholder="Ex: Prestação de serviços de administração e pilotagem"
                      className="bg-background border-border resize-none"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label className="text-foreground font-medium mb-2 block">Categoria do Recibo *</Label>
                    <Select
                      value={reciboData.categoriaRecibo}
                      onValueChange={(value) => setReciboData({ ...reciboData, categoriaRecibo: value })}
                    >
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriasRecibo.length > 0 ? (
                          categoriasRecibo.map((cat) => (
                            <SelectItem key={cat.id} value={cat.nome}>
                              {cat.nome}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="text-center py-2 text-muted-foreground text-sm">
                            Nenhuma categoria de recibo encontrada
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 justify-end mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowReciboDialog(false);
                        setReciboData({
                          cliente_id: "",
                          cliente_nome: "",
                          cliente_cnpj: "",
                          aeronave_registro: "",
                          valor: "",
                          data_vencimento: new Date().toISOString().split("T")[0],
                          descricao: "",
                          categoriaRecibo: "",
                        });
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={handleGenerarRecibo}
                      disabled={isGeneratingRecibo}
                    >
                      {isGeneratingRecibo ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <FileUp className="w-4 h-4 mr-2" />
                          Gerar Recibo
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela de Notas */}
          <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/60 shadow-lg">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-lg font-semibold text-foreground">Notas Fiscais de Saída</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
                  Carregando...
                </div>
              ) : notasExibicao.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileUp className="w-12 h-12 opacity-20 mx-auto mb-3" />
                  Nenhuma nota fiscal aguardando recebimento
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader className="bg-muted border-b border-border">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-foreground font-semibold px-4 py-4 text-sm">Número</TableHead>
                        <TableHead className="text-foreground font-semibold px-4 py-4 text-sm">Cliente</TableHead>
                        <TableHead className="text-foreground font-semibold px-4 py-4 text-sm">Aeronave</TableHead>
                        <TableHead className="text-foreground font-semibold px-4 py-4 text-sm">Emissão</TableHead>
                        <TableHead className="text-foreground font-semibold px-4 py-4 text-sm">Vencimento</TableHead>
                        <TableHead className="text-foreground font-semibold px-4 py-4 text-sm text-right">Valor</TableHead>
                        <TableHead className="text-foreground font-semibold px-4 py-4 text-sm">Categoria</TableHead>
                        <TableHead className="text-foreground font-semibold px-4 py-4 text-sm">Status</TableHead>
                        <TableHead className="text-foreground font-semibold px-4 py-4 text-sm text-center">PDF</TableHead>
                        <TableHead className="text-foreground font-semibold px-4 py-4 text-sm text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notasExibicao.map((nota) => (
                        <TableRow key={nota.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                          <TableCell className="font-medium text-foreground px-4 py-4 text-sm">{nota.numero}</TableCell>
                          <TableCell className="text-foreground px-4 py-4 text-sm">{nota.cliente_nome}</TableCell>
                          <TableCell className="text-muted-foreground px-4 py-4 text-sm">
                            {nota.aeronave || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground px-4 py-4 text-sm">
                            {formatDateSafe(nota.data_criacao)}
                          </TableCell>
                          <TableCell className="text-muted-foreground px-4 py-4 text-sm">
                            {formatDateSafe(nota.data_vencimento)}
                          </TableCell>
                          <TableCell className="text-foreground font-semibold px-4 py-4 text-right text-sm">
                            R$ {nota.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-muted-foreground px-4 py-4 text-sm">{nota.categoria}</TableCell>
                          <TableCell className="px-4 py-4 text-sm">
                            {getStatusBadge(nota.situacao)}
                          </TableCell>
                          <TableCell className="px-4 py-4 text-center">
                            {nota.arquivo_pdf_url ? (
                              <a
                                href={nota.arquivo_pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center text-primary hover:text-primary/80 transition-colors"
                                title="Ver PDF"
                              >
                                <FileText className="w-4 h-4" />
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(nota)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                onClick={() => setDeleteId(nota.id)}
                                title="Deletar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dialog de Confirmação de Exclusão */}
          <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Confirmar Exclusão</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground">Tem certeza que deseja excluir esta nota fiscal?</p>
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="outline" onClick={() => setDeleteId(null)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Excluir
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dialog para Visualizar Recibo */}
          <Dialog open={showReciboViewer} onOpenChange={setShowReciboViewer}>
            <DialogContent className="bg-card border-border max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-foreground">Recibo Gerado</DialogTitle>
              </DialogHeader>
              {reciboViewUrl && (
                <div className="space-y-4">
                  <div className="w-full h-[600px] border border-border rounded-lg overflow-hidden bg-background">
                    <iframe
                      src={reciboViewUrl}
                      className="w-full h-full"
                      title="Visualizar Recibo"
                      allow="fullscreen"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowReciboViewer(false)}
                    >
                      Fechar
                    </Button>
                    <Button
                      className="bg-primary hover:bg-primary/90"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = reciboViewUrl;
                        link.download = "recibo.pdf";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      Download
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* TAB 2: Histórico de Recibos de Saída */}
        <TabsContent value="recibos-saida" className="space-y-6 mt-6">
          {/* Tabela de Recibos de Saída */}
          <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/60 shadow-lg">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-lg font-semibold text-foreground">Histórico de Recibos de Saída</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {isLoadingRecibos ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
                  Carregando recibos...
                </div>
              ) : recibos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileUp className="w-12 h-12 opacity-20 mx-auto mb-3" />
                  Nenhum recibo de saída criado
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border/40">
                  <Table>
                    <TableHeader className="bg-muted/30 border-b border-border/40">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-muted-foreground font-semibold px-4 py-3">Número</TableHead>
                        <TableHead className="text-muted-foreground font-semibold px-4 py-3">Cliente</TableHead>
                        <TableHead className="text-muted-foreground font-semibold px-4 py-3">Aeronave</TableHead>
                        <TableHead className="text-muted-foreground font-semibold px-4 py-3">Data de Criação</TableHead>
                        <TableHead className="text-muted-foreground font-semibold px-4 py-3">Vencimento</TableHead>
                        <TableHead className="text-muted-foreground font-semibold px-4 py-3 text-right">Valor</TableHead>
                        <TableHead className="text-muted-foreground font-semibold px-4 py-3">Categoria</TableHead>
                        <TableHead className="text-muted-foreground font-semibold px-4 py-3">Status</TableHead>
                        <TableHead className="text-muted-foreground font-semibold px-4 py-3 text-center">PDF</TableHead>
                        <TableHead className="text-muted-foreground font-semibold px-4 py-3 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recibos.map((recibo, idx) => (
                        <TableRow key={recibo.id} className={`border-b border-border/30 hover:bg-muted/40 transition-colors ${idx % 2 === 0 ? 'bg-muted/10' : ''}`}>
                          <TableCell className="font-semibold text-foreground px-4 py-3">{recibo.documento}</TableCell>
                          <TableCell className="text-foreground px-4 py-3">{recibo.clients?.razao_social || "-"}</TableCell>
                          <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                            {recibo.aeronave?.matricula || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                            {formatDateSafe(recibo.data)}
                          </TableCell>
                          <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                            {formatDateSafe(recibo.prazo_pagamento)}
                          </TableCell>
                          <TableCell className="text-foreground font-semibold px-4 py-3 text-right text-emerald-500">
                            R$ {parseFloat(recibo.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-muted-foreground px-4 py-3 text-sm">{recibo.categoria || "-"}</TableCell>
                          <TableCell className="px-4 py-3">
                            <Select
                              value={recibo.situacao || "enviado"}
                              onValueChange={(newStatus) => handleUpdateReciboStatus(recibo.id, newStatus)}
                            >
                              <SelectTrigger className={`w-[130px] h-8 text-xs font-medium border rounded-lg ${recibo.situacao === "enviado" ? "bg-green-500/10 text-green-600 border-green-500/30" :
                                  recibo.situacao === "pendente" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" :
                                  recibo.situacao === "recebido" ? "bg-blue-500/10 text-blue-600 border-blue-500/30" :
                                    "bg-gray-500/10 text-gray-600 border-gray-500/30"
                                }`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                <SelectItem value="pendente">Pendente</SelectItem>
                                <SelectItem value="enviado">Enviado</SelectItem>
                                <SelectItem value="aprovado">Aprovado</SelectItem>
                                <SelectItem value="recebido">Recebido</SelectItem>
                                <SelectItem value="pago">Pago</SelectItem>
                                <SelectItem value="reembolsado">Reembolsado</SelectItem>
                                <SelectItem value="cancelado">Cancelado</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            {recibo.nf_url ? (
                              <a
                                href={recibo.nf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                                title="Ver PDF"
                              >
                                <Eye className="w-4 h-4" />
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditRecibo(recibo)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
                                onClick={() => setDeleteReciboId(recibo.id)}
                                title="Deletar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Edição de Recibo */}
      <Dialog open={showReciboEditDialog} onOpenChange={setShowReciboEditDialog}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Recibo</DialogTitle>
          </DialogHeader>
          {editingRecibo && (
            <div className="space-y-4">
              {/* Informações de Cliente e Aeronave (somente leitura) */}
              <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Cliente</p>
                    <p className="text-foreground font-medium">{editingRecibo.clients?.razao_social || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Aeronave</p>
                    <p className="text-foreground font-medium">{editingRecibo.aeronave?.matricula || "-"}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground mb-2 block">Valor (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={reciboEditData.valor}
                    onChange={(e) => setReciboEditData({ ...reciboEditData, amount: e.target.value })}
                    className="bg-background border-border"
                  />
                </div>
                <div>
                  <Label className="text-foreground mb-2 block">Data de Vencimento</Label>
                  <Input
                    type="data"
                    value={reciboEditData.max_payment_date}
                    onChange={(e) => setReciboEditData({ ...reciboEditData, max_payment_date: e.target.value })}
                    className="bg-background border-border"
                  />
                </div>
              </div>
              <div>
                <Label className="text-foreground mb-2 block">Descrição do Serviço *</Label>
                <Textarea
                  value={reciboEditData.service_description}
                  onChange={(e) => setReciboEditData({ ...reciboEditData, service_description: e.target.value })}
                  className="bg-background border-border resize-none"
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-foreground mb-2 block">Categoria</Label>
                <Input
                  value={reciboEditData.categoria_name}
                  onChange={(e) => setReciboEditData({ ...reciboEditData, category_name: e.target.value })}
                  placeholder="Categoria"
                  className="bg-background border-border"
                />
              </div>
              <div>
                <Label className="text-foreground mb-2 block">Status</Label>
                <Select value={reciboEditData.situacao} onValueChange={(value) => setReciboEditData({ ...reciboEditData, status: value })}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="recebido">Recebido</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="reembolsado">Reembolsado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowReciboEditDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleSaveReciboEdit}
                >
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão de Recibo */}
      <Dialog open={!!deleteReciboId} onOpenChange={() => setDeleteReciboId(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">Tem certeza que deseja excluir este recibo?</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteReciboId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteRecibo}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Geração de PDF */}
      <Dialog open={showPdfConfirmDialog} onOpenChange={setShowPdfConfirmDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Gerar Novo PDF do Recibo?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Deseja gerar um novo PDF do recibo com as informações atualizadas? O PDF anterior será substituído.
          </p>
          <div className="flex gap-2 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => handleGenerateNewPdf(false)}
              disabled={isGeneratingPdfEdit}
            >
              Não
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => handleGenerateNewPdf(true)}
              disabled={isGeneratingPdfEdit}
            >
              {isGeneratingPdfEdit ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Gerando...
                </>
              ) : (
                "Sim, Gerar PDF"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Recebimento de NF */}
      <Dialog open={showRecebimentoDialog} onOpenChange={setShowRecebimentoDialog}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirmar Recebimento da NF</DialogTitle>
          </DialogHeader>
          {pendingNotaRecebimento && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
                <p className="text-sm text-muted-foreground">Número da NF</p>
                <p className="text-lg font-semibold text-foreground">{pendingNotaRecebimento.numeroNota}</p>
              </div>

              <div>
                <Label className="text-foreground mb-2 block">Banco *</Label>
                <Input
                  value={recebimentoData.banco}
                  onChange={(e) => setRecebimentoData({ ...recebimentoData, banco: e.target.value })}
                  placeholder="Ex: Itaú, Bradesco, etc."
                  className="bg-background border-border"
                />
              </div>

              <div>
                <Label className="text-foreground mb-2 block">Data de Recebimento *</Label>
                <Input
                  type="data"
                  value={recebimentoData.data_recebimento}
                  onChange={(e) => setRecebimentoData({ ...recebimentoData, data_recebimento: e.target.value })}
                  className="bg-background border-border"
                />
              </div>

              <div>
                <Label className="text-foreground mb-2 block">Comprovante de Recebimento</Label>
                {recebimentoData.comprovante_url ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="h-5 w-5 text-primary" />
                    <a
                      href={recebimentoData.comprovante_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex-1 truncate"
                    >
                      Comprovante anexado
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRecebimentoData({ ...recebimentoData, comprovante_url: "" })}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      onChange={handleComprovanteUpload}
                      disabled={isUploadingComprovante}
                      className="hidden"
                      id="comprovante-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("comprovante-upload")?.click()}
                      disabled={isUploadingComprovante}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isUploadingComprovante ? "Enviando..." : "Anexar Comprovante"}
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRecebimentoDialog(false);
                    setPendingNotaRecebimento(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleConfirmRecebimento}
                >
                  Confirmar Recebimento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
