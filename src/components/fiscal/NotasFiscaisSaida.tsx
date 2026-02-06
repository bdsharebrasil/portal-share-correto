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
import { Plus, Edit2, Trash2, FileUp, DollarSign, Search, X, Upload, FileText, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCategoriasFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { useAeronaves } from "@/hooks/useAeronaves";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer';

// --- CONFIGURAÇÃO DO PDF ---

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
  
  logoHeader: { 
    width: 120,
    height: 50, 
    objectFit: 'contain',
    marginBottom: 5 
  },

  reciboTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 5 },
  headerRight: { alignItems: 'flex-end' },
  
  label: { color: '#666', fontSize: 8, marginBottom: 2, textTransform: 'uppercase' },
  
  valueBox: { 
    border: '1px solid #000', 
    padding: 8, 
    width: 150, 
    alignItems: 'center', 
    marginTop: 10,
    alignSelf: 'flex-end'
  },
  valueText: { fontSize: 14, fontWeight: 'bold' },
  
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 20 },
  column: { width: '48%' },
  bold: { fontWeight: 'bold', fontSize: 10, marginBottom: 2 },
  text: { fontSize: 9, marginBottom: 2, color: '#333' },
  
  sectionHeader: { 
    backgroundColor: '#F3F4F6',
    padding: 6, 
    marginTop: 10,
    marginBottom: 10,
    fontWeight: 'bold',
    fontSize: 9
  },
  
  description: { fontSize: 9, lineHeight: 1.5, minHeight: 100 },
  
  footer: { marginTop: 40, borderTop: '1px solid #eee', paddingTop: 20 },
  disclaimer: { fontSize: 8, color: '#888', fontStyle: 'italic', marginBottom: 30 },
  
  signatureArea: { marginTop: 40, alignItems: 'center' },
  line: { width: 200, borderBottom: '1px solid #000', marginBottom: 5 },
  signatureName: { fontWeight: 'bold' },
  
  logoSignature: {
    width: 80,
    height: 30,
    objectFit: 'contain',
    marginTop: 10,
    opacity: 0.8
  }
});

// Componente do Documento PDF
const ReciboDocument = ({ data }: { data: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Cabeçalho */}
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

      {/* Valor */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.label}>VALOR TOTAL</Text>
        <View style={styles.valueBox}>
          <Text style={styles.valueText}>
            R$ {parseFloat(data.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* Dados das Partes */}
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

      {/* Descrição */}
      <View>
        <Text style={styles.sectionHeader}>DESCRIÇÃO DO SERVIÇO</Text>
        <Text style={styles.description}>
          {data.descricao}
          {data.aeronave_registro ? `\nReferente à aeronave: ${data.aeronave_registro}` : ''}
        </Text>
      </View>

      {/* Rodapé e Assinatura */}
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
  id: string;
  numero: string;
  cliente_nome: string;
  cliente_cnpj: string;
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
}

interface Cliente {
  id: string;
  nome: string;
  documento: string;
}

// --- FUNÇÕES DE VALIDAÇÃO ---

const validarNotaFiscal = (formData: any): string | null => {
  // Validar número da NF
  if (!formData.numero || formData.numero.trim() === "") {
    return "Número da nota fiscal é obrigatório";
  }

  // Validar cliente
  if (!formData.cliente_nome || formData.cliente_nome.trim() === "") {
    return "Cliente/Empresa é obrigatório";
  }

  // Validar CNPJ/CPF (obrigatório na tabela)
  if (!formData.cliente_cnpj || formData.cliente_cnpj.trim() === "") {
    return "CNPJ/CPF do cliente é obrigatório";
  }

  // Validar valor
  if (!formData.valor || formData.valor.trim() === "") {
    return "Valor é obrigatório";
  }

  const valorNumerico = parseFloat(formData.valor);
  if (isNaN(valorNumerico) || valorNumerico <= 0) {
    return "Valor deve ser um número maior que zero";
  }

  // Validar data de criação
  if (!formData.data_criacao || formData.data_criacao.trim() === "") {
    return "Data de criação é obrigatória";
  }

  // Validar data de vencimento (obrigatória na tabela)
  if (!formData.data_vencimento || formData.data_vencimento.trim() === "") {
    return "Data de vencimento é obrigatória";
  }

  // Validar categoria (obrigatória na tabela)
  if (!formData.categoria || formData.categoria.trim() === "") {
    return "Categoria é obrigatória";
  }

  // Validar status (apenas pendente, recebido, cancelado)
  const statusValidos = ["pendente", "recebido", "cancelado"];
  if (!statusValidos.includes(formData.status)) {
    return "Status inválido. Valores permitidos: pendente, recebido, cancelado";
  }

  return null;
};

// --- COMPONENTE PRINCIPAL ---

export function NotasFiscaisSaida() {
  const { getCategoriasReceita } = useCategoriasFinanceiro();
  let categoriasReceita = getCategoriasReceita();
  const { aeronaves, isLoadingAeronaves } = useAeronaves();

  // Filtrar apenas as categorias especificadas para NF de Saída
  const categoriasNFSaidaIds = [
    'b5143aad-88ed-4649-9f17-3ff15904bda2', // N.F DIARIAS DE VOO
    'd95ca1cc-a6c9-4d07-97a6-eb18f542a333', // RESSARCIMENTOS gerais
    'a7555994-103d-4739-96a5-001c3bec1424', // REEMBOLSO RELATORIO DE DESPESA DE VIAGENS recebido
    '2874b45b-a3bb-4bec-8f7e-74b328f8693c', // ADM E PILOTAGEM - RECIBO
    '352095f3-a97a-4539-ad1a-b1471e577583', // N.F ADM - Somente adm de aeronaves
    '643fd58f-ae2f-4269-9d5a-93345d613fb9', // ADM E PILOTAGEM - N.F
    '73355581-c479-4a5d-b90b-90b3332f198e', // ADM SHARE - RECIBO
  ];

  categoriasReceita = categoriasReceita.filter(cat => categoriasNFSaidaIds.includes(cat.id));

  const [notas, setNotas] = useState<NotaFiscalSaida[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingNota, setEditingNota] = useState<NotaFiscalSaida | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [openClientePopover, setOpenClientePopover] = useState(false);
  const [aeronaveSearch, setAeronaveSearch] = useState("");
  const [openAeronavePopover, setOpenAeronavePopover] = useState(false);
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
  });
  const [isGeneratingRecibo, setIsGeneratingRecibo] = useState(false);

  // Estados para Histórico de Recibos de Saída
  const [recibos, setRecibos] = useState<any[]>([]);
  const [isLoadingRecibos, setIsLoadingRecibos] = useState(false);
  const [editingRecibo, setEditingRecibo] = useState<any | null>(null);
  const [deleteReciboId, setDeleteReciboId] = useState<string | null>(null);
  const [showReciboEditDialog, setShowReciboEditDialog] = useState(false);
  const [viewingReciboId, setViewingReciboId] = useState<string | null>(null);
  const [reciboEditData, setReciboEditData] = useState({
    amount: "",
    service_description: "",
    max_payment_date: "",
    status: "pendente",
    category_name: "",
  });

  const { toast } = useToast();
  const { user } = useAuth();

  const defaultCategoria = categoriasReceita.length > 0 ? categoriasReceita[0].nome : "";

  const [formData, setFormData] = useState({
    numero: "",
    cliente_nome: "",
    cliente_cnpj: "",
    data_criacao: new Date().toISOString().split("T")[0],
    data_vencimento: "",
    valor: "",
    categoria: defaultCategoria,
    descricao: "",
    status: "pendente",
    aeronave: "",
  });

  useEffect(() => {
    loadNotas();
    loadClientes();
    loadRecibos();
  }, []);

  const loadClientes = async () => {
    try {
      let { data: clientsData, error } = await supabase
        .from("clients")
        .select("id, company_name, cnpj, proprietario, status");

      if (error) {
        console.error("Erro ao carregar clientes:", error);
        clientsData = [];
      }

      const clientesList: Cliente[] = [];

      if (clientsData) {
        clientsData.forEach(client => {
          const nomeCliente = client.company_name || client.proprietario || client.cnpj || "Cliente";

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
      setNotas(data || []);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("user_id", user.id)
        .eq("receipt_type", "pagamento")
        .order("created_at", { ascending: false });

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
    // VALIDAÇÃO COMPLETA
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
      const { data: { user } } = await supabase.auth.getUser();

      // Preparar dados com todos os campos obrigatórios
      const notaData: any = {
        numero: formData.numero.trim(),
        cliente_nome: formData.cliente_nome.trim(),
        cliente_cnpj: formData.cliente_cnpj.trim(),
        data_criacao: formData.data_criacao,
        data_vencimento: formData.data_vencimento, // OBRIGATÓRIO
        valor: parseFloat(formData.valor),
        categoria: formData.categoria,
        descricao: formData.descricao || null,
        status: formData.status,
        arquivo_pdf_url: pdfUrl || null,
        aeronave: formData.aeronave || null,
        criado_por: user?.id || null,
        criado_em: new Date().toISOString(), // ADICIONAR TIMESTAMP
        atualizado_em: new Date().toISOString(), // ADICIONAR TIMESTAMP
      };

      if (editingNota) {
        const { error } = await supabase
          .from("notas_fiscais_saida")
          .update({
            ...notaData,
            atualizado_em: new Date().toISOString(), // ATUALIZAR TIMESTAMP
          })
          .eq("id", editingNota.id);

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
    } catch (error) {
      console.error("Erro ao salvar nota:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar nota fiscal",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("notas_fiscais_saida")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Nota fiscal deletada com sucesso",
      });
      setDeleteId(null);
      loadNotas();
    } catch (error) {
      console.error("Erro ao deletar nota:", error);
      toast({
        title: "Erro",
        description: "Erro ao deletar nota fiscal",
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
      data_criacao: nota.data_criacao,
      data_vencimento: nota.data_vencimento,
      valor: nota.valor.toString(),
      categoria: nota.categoria,
      descricao: nota.descricao || "",
      status: nota.status,
      aeronave: nota.aeronave || "",
    });
    setPdfUrl(nota.arquivo_pdf_url || "");
    setOpenDialog(true);
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
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
      data_criacao: new Date().toISOString().split("T")[0],
      data_vencimento: "",
      valor: "",
      categoria: defaultCategoria,
      descricao: "",
      status: "pendente",
      aeronave: "",
    });
    setEditingNota(null);
    setArquivo(null);
    setClienteSearch("");
    setAeronaveSearch("");
    setPdfUrl("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "recebido":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "pendente":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "cancelado":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleChangeStatus = async (notaId: string, newStatus: string) => {
    // Validar que o novo status é válido
    const statusValidos = ["pendente", "recebido", "cancelado"];
    if (!statusValidos.includes(newStatus)) {
      toast({
        title: "Erro",
        description: "Status inválido",
        variant: "destructive",
      });
      return;
    }

    try {
      const nota = notas.find(n => n.id === notaId);
      if (!nota) return;

      const { error } = await supabase
        .from("notas_fiscais_saida")
        .update({
          status: newStatus,
          atualizado_em: new Date().toISOString(), // ATUALIZAR TIMESTAMP
        })
        .eq("id", notaId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Status atualizado com sucesso",
      });

      loadNotas();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status",
        variant: "destructive",
      });
    }
  };

  const generateReciboNumber = async (clienteNome: string) => {
    const clienteLetras = clienteNome.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '').padEnd(3, 'X');
    const ano = new Date().getFullYear().toString().slice(-2);
    
    const { data: existingRecibos, error } = await supabase
      .from("controle_bancario")
      .select("numero_documento", { count: "exact" })
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
      
      let clientId = reciboData.cliente_id || null;
      if (!clientId) {
        const { data: clientData } = await supabase.from("clients").select("id").eq("company_name", reciboData.cliente_nome).single();
        clientId = clientData?.id || null;
      }

      let aeronaveId = null;
      const { data: aeroData } = await supabase.from("aircraft").select("id").eq("registration", reciboData.aeronave_registro).single();
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
          criado_por: currentUser.id,
          descricao: reciboData.descricao || "Recibo de Saída - Serviços",
          comprovante_url: reciboUrl,
          client_id: clientId,
          client_name: reciboData.cliente_nome,
          aeronave_id: aeronaveId,
          aeronave_registro: reciboData.aeronave_registro,
          grupo_categoria: grupoCategoria,
          colaborador_id: currentUser.id,
        });

      if (controleBancarioError) throw new Error(`Erro controle_bancario: ${controleBancarioError.message}`);

      // CORREÇÃO: Apenas inserir em contas_areceber se aeronave estiver presente (campo obrigatório nessa tabela)
      if (reciboData.aeronave_registro) {
        const { error: contasAreceberError } = await supabase.from("contas_areceber").insert({
          numero: numeroRecibo,
          cliente_nome: reciboData.cliente_nome,
          cliente_cnpj: reciboData.cliente_cnpj || "000.000.000-00",
          data_criacao: new Date().toISOString().split("T")[0],
          data_vencimento: reciboData.data_vencimento,
          valor: parseFloat(reciboData.valor),
          categoria: "Recibo de Serviço",
          descricao: reciboData.descricao || "Recibo de Serviço",
          status: "pendente",
          aeronave: reciboData.aeronave_registro,
          criado_por: currentUser.id,
          arquivo_pdf_url: reciboUrl,
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
      loadNotas();

    } catch (error: any) {
      console.error("Erro ao gerar recibo:", error);
      toast({ title: "Erro", description: error.message || "Erro ao gerar recibo", variant: "destructive" });
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
    });
  }

  const handleSelectCliente = (cliente: Cliente) => {
    setReciboData({
      ...reciboData,
      cliente_id: cliente.id,
      cliente_nome: cliente.nome,
      cliente_cnpj: cliente.documento,
    });
    setOpenClientePopover(false);
  };

  const filteredClientes = clientes.filter(c =>
    c.nome.toLowerCase().includes(clienteSearch.toLowerCase()) ||
    c.documento.includes(clienteSearch)
  );

  // CORRIGIR: Usar apenas 'recebido' em vez de 'pago'
  const totalPendente = notas
    .filter((n) => n.status === "pendente")
    .reduce((acc, n) => acc + n.valor, 0);

  const totalRecebido = notas
    .filter((n) => n.status === "recebido") // CORREÇÃO: usar apenas 'recebido'
    .reduce((acc, n) => acc + n.valor, 0);

  // Função auxiliar para formatar datas com segurança
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

  // Funções para Histórico de Recibos
  const handleEditRecibo = (recibo: any) => {
    setEditingRecibo(recibo);
    setReciboEditData({
      amount: recibo.amount.toString(),
      service_description: recibo.service_description,
      max_payment_date: recibo.max_payment_date || "",
      status: recibo.status || "pendente",
      category_name: recibo.category_name || "",
    });
    setShowReciboEditDialog(true);
  };

  const handleSaveReciboEdit = async () => {
    if (!editingRecibo) return;

    try {
      const { error } = await supabase
        .from("receipts")
        .update({
          amount: parseFloat(reciboEditData.amount),
          service_description: reciboEditData.service_description,
          max_payment_date: reciboEditData.max_payment_date || null,
          status: reciboEditData.status,
          category_name: reciboEditData.category_name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingRecibo.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Recibo atualizado com sucesso",
      });

      setShowReciboEditDialog(false);
      setEditingRecibo(null);
      loadRecibos();
    } catch (error) {
      console.error("Erro ao atualizar recibo:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar recibo",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRecibo = async () => {
    if (!deleteReciboId) return;

    try {
      const { error } = await supabase
        .from("receipts")
        .delete()
        .eq("id", deleteReciboId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Recibo deletado com sucesso",
      });

      setDeleteReciboId(null);
      loadRecibos();
    } catch (error) {
      console.error("Erro ao deletar recibo:", error);
      toast({
        title: "Erro",
        description: "Erro ao deletar recibo",
        variant: "destructive",
      });
    }
  };

  const handleViewReciboPDF = (recibo: any) => {
    if (!recibo.pdf_url) {
      toast({
        title: "Aviso",
        description: "PDF não disponível para este recibo",
        variant: "default",
      });
      return;
    }
    setViewingReciboId(recibo.id);
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <Tabs defaultValue="notas-fiscais" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-card/50 backdrop-blur-sm border border-border/50 p-1 rounded-lg">
          <TabsTrigger value="notas-fiscais" className="rounded-md">Notas Fiscais de Saída</TabsTrigger>
          <TabsTrigger value="recibos-saida" className="rounded-md">Histórico de Recibos</TabsTrigger>
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
                  <Input
                    type="date"
                    value={formData.data_criacao}
                    onChange={(e) => setFormData({ ...formData, data_criacao: e.target.value })}
                    className="bg-background border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground">Cliente/Empresa *</Label>
                  <Popover open={openClientePopover} onOpenChange={setOpenClientePopover}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          value={formData.cliente_nome}
                          onChange={(e) => {
                            setFormData({ ...formData, cliente_nome: e.target.value });
                            setClienteSearch(e.target.value);
                            setOpenClientePopover(true);
                          }}
                          onFocus={() => setOpenClientePopover(true)}
                          placeholder="Buscar cliente..."
                          className="bg-background border-border pr-10"
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 bg-card border-border" align="start">
                      <Command className="bg-card">
                        <CommandInput
                          placeholder="Buscar..."
                          value={clienteSearch}
                          onValueChange={setClienteSearch}
                          className="bg-background"
                        />
                        <CommandList>
                          <CommandEmpty className="text-muted-foreground py-3 text-center text-sm">
                            Nenhum cliente encontrado
                          </CommandEmpty>
                          <CommandGroup heading="Clientes" className="text-muted-foreground">
                            {filteredClientes.length > 0 ? (
                              filteredClientes.slice(0, 50).map((c) => (
                                <CommandItem
                                  key={c.id}
                                  onSelect={() => {
                                    setFormData({
                                      ...formData,
                                      cliente_nome: c.nome,
                                      cliente_cnpj: c.documento
                                    });
                                    setOpenClientePopover(false);
                                  }}
                                  className="cursor-pointer hover:bg-muted"
                                >
                                  <div>
                                    <p className="font-medium text-foreground">{c.nome}</p>
                                    {c.documento && <p className="text-xs text-muted-foreground">{c.documento}</p>}
                                  </div>
                                </CommandItem>
                              ))
                            ) : null}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-foreground">CNPJ/CPF *</Label>
                  <Input
                    value={formData.cliente_cnpj}
                    onChange={(e) => setFormData({ ...formData, cliente_cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                    className="bg-background border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground">Aeronave (Opcional)</Label>
                  <Popover open={openAeronavePopover} onOpenChange={setOpenAeronavePopover}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          value={formData.aeronave}
                          onChange={(e) => {
                            setAeronaveSearch(e.target.value);
                            setOpenAeronavePopover(true);
                          }}
                          onFocus={() => setOpenAeronavePopover(true)}
                          placeholder="Buscar aeronave..."
                          className="bg-background border-border pr-10"
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 bg-card border-border" align="start">
                      <Command className="bg-card">
                        <CommandInput
                          placeholder="Buscar por prefixo, modelo..."
                          value={aeronaveSearch}
                          onValueChange={setAeronaveSearch}
                          className="bg-background"
                        />
                        <CommandList>
                          {isLoadingAeronaves ? (
                            <div className="text-center py-3 text-muted-foreground text-sm">
                              Carregando aeronaves...
                            </div>
                          ) : (
                            <>
                              <CommandEmpty className="text-muted-foreground py-3 text-center text-sm">
                                Nenhuma aeronave encontrada
                              </CommandEmpty>
                              <CommandGroup heading="Aeronaves" className="text-muted-foreground">
                                {(Array.isArray(aeronaves) ? aeronaves : []).filter(a =>
                                  a.registration.toLowerCase().includes(aeronaveSearch.toLowerCase()) ||
                                  a.model.toLowerCase().includes(aeronaveSearch.toLowerCase()) ||
                                  a.manufacturer.toLowerCase().includes(aeronaveSearch.toLowerCase())
                                ).slice(0, 10).map((aero) => (
                                  <CommandItem
                                    key={aero.id}
                                    onSelect={() => {
                                      setFormData({
                                        ...formData,
                                        aeronave: aero.registration
                                      });
                                      setOpenAeronavePopover(false);
                                      setAeronaveSearch("");
                                    }}
                                    className="cursor-pointer hover:bg-muted"
                                  >
                                    <div>
                                      <p className="font-medium text-foreground">{aero.registration}</p>
                                      <p className="text-xs text-muted-foreground">{aero.manufacturer} {aero.model}</p>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-end">
                  {formData.aeronave && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          aeronave: ""
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
                  <Input
                    type="date"
                    value={formData.data_vencimento}
                    onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                    className="bg-background border-border"
                  />
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
                        <SelectItem key={cat.id} value={cat.nome}>
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
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as any })}>
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
                  });
                  setClienteSearch("");
                  setAeronaveSearch("");
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
                  <Popover open={openClientePopover} onOpenChange={setOpenClientePopover}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          value={reciboData.cliente_nome}
                          onChange={(e) => {
                            setReciboData({ ...reciboData, cliente_nome: e.target.value });
                            setClienteSearch(e.target.value);
                            if (!openClientePopover) setOpenClientePopover(true);
                          }}
                          onFocus={() => setOpenClientePopover(true)}
                          placeholder="Buscar cliente..."
                          className="bg-background border-border pr-10"
                          autoComplete="off"
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 bg-card border-border" align="start">
                      <Command className="bg-card">
                        <CommandInput
                          placeholder="Buscar..."
                          value={clienteSearch}
                          onValueChange={setClienteSearch}
                          className="bg-background"
                          autoComplete="off"
                        />
                        <CommandList>
                          <CommandEmpty className="text-muted-foreground py-3 text-center text-sm">
                            Nenhum cliente encontrado
                          </CommandEmpty>
                          <CommandGroup heading="Clientes" className="text-muted-foreground">
                            {filteredClientes.length > 0 ? (
                              filteredClientes.slice(0, 50).map((c) => (
                                <CommandItem
                                  key={c.id}
                                  onSelect={() => handleSelectCliente(c)}
                                  className="cursor-pointer hover:bg-muted"
                                >
                                  <div>
                                    <p className="font-medium text-foreground">{c.nome}</p>
                                    {c.documento && <p className="text-xs text-muted-foreground">{c.documento}</p>}
                                  </div>
                                </CommandItem>
                              ))
                            ) : null}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label className="text-foreground font-medium mb-2 block">Aeronave * (Obrigatório)</Label>
                  <Popover open={openAeronavePopover} onOpenChange={setOpenAeronavePopover}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          value={reciboData.aeronave_registro}
                          onChange={(e) => {
                            setAeronaveSearch(e.target.value);
                            if (!openAeronavePopover) setOpenAeronavePopover(true);
                          }}
                          onFocus={() => setOpenAeronavePopover(true)}
                          placeholder="Buscar aeronave..."
                          className="bg-background border-border pr-10"
                          autoComplete="off"
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 bg-card border-border" align="start">
                      <Command className="bg-card">
                        <CommandInput
                          placeholder="Buscar por prefixo, modelo..."
                          value={aeronaveSearch}
                          onValueChange={setAeronaveSearch}
                          className="bg-background"
                          autoComplete="off"
                        />
                        <CommandList>
                          {isLoadingAeronaves ? (
                            <div className="text-center py-3 text-muted-foreground text-sm">
                              Carregando aeronaves...
                            </div>
                          ) : (
                            <>
                              <CommandEmpty className="text-muted-foreground py-3 text-center text-sm">
                                Nenhuma aeronave encontrada
                              </CommandEmpty>
                              <CommandGroup heading="Aeronaves" className="text-muted-foreground">
                                {(Array.isArray(aeronaves) ? aeronaves : []).filter(a =>
                                  a.registration.toLowerCase().includes(aeronaveSearch.toLowerCase()) ||
                                  a.model.toLowerCase().includes(aeronaveSearch.toLowerCase()) ||
                                  a.manufacturer.toLowerCase().includes(aeronaveSearch.toLowerCase())
                                ).slice(0, 10).map((aero) => (
                                  <CommandItem
                                    key={aero.id}
                                    onSelect={() => {
                                      setReciboData({
                                        ...reciboData,
                                        aeronave_registro: aero.registration,
                                      });
                                      setOpenAeronavePopover(false);
                                      setAeronaveSearch("");
                                    }}
                                    className="cursor-pointer hover:bg-muted"
                                  >
                                    <div>
                                      <p className="font-medium text-foreground">{aero.registration}</p>
                                      <p className="text-xs text-muted-foreground">{aero.manufacturer} {aero.model}</p>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                    type="date"
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
                  });
                  setClienteSearch("");
                  setAeronaveSearch("");
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
          ) : notas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileUp className="w-12 h-12 opacity-20 mx-auto mb-3" />
              Nenhuma nota fiscal criada
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <Table>
                <TableHeader className="bg-muted/30 border-b border-border/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Número</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Cliente</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Aeronave</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Criação</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Vencimento</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3 text-right">Valor</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Categoria</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Status</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3 text-center">PDF</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notas.map((nota, idx) => (
                    <TableRow key={nota.id} className={`border-b border-border/30 hover:bg-muted/40 transition-colors ${idx % 2 === 0 ? 'bg-muted/10' : ''}`}>
                      <TableCell className="font-semibold text-foreground px-4 py-3">{nota.numero}</TableCell>
                      <TableCell className="text-foreground px-4 py-3">{nota.cliente_nome}</TableCell>
                      <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                        {nota.aeronave || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                        {formatDateSafe(nota.data_criacao)}
                      </TableCell>
                      <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                        {formatDateSafe(nota.data_vencimento)}
                      </TableCell>
                      <TableCell className="text-foreground font-semibold px-4 py-3 text-right text-emerald-500">
                        R$ {nota.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-muted-foreground px-4 py-3 text-sm">{nota.categoria}</TableCell>
                      <TableCell className="px-4 py-3">
                        <Select
                          value={nota.status}
                          onValueChange={(value) => handleChangeStatus(nota.id, value)}
                        >
                          <SelectTrigger className={`w-[130px] h-8 text-xs font-medium border rounded-lg ${getStatusColor(nota.status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="recebido">Recebido</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {nota.arquivo_pdf_url ? (
                          <a
                            href={nota.arquivo_pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                            title="Ver PDF"
                          >
                            <FileText className="w-4 h-4" />
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
                            onClick={() => handleEdit(nota)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
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
                          <TableCell className="font-semibold text-foreground px-4 py-3">{recibo.receipt_number}</TableCell>
                          <TableCell className="text-foreground px-4 py-3">{recibo.payer_name}</TableCell>
                          <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                            {recibo.aircraft_id ? "Vinculada" : "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                            {formatDateSafe(recibo.created_at)}
                          </TableCell>
                          <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                            {formatDateSafe(recibo.max_payment_date)}
                          </TableCell>
                          <TableCell className="text-foreground font-semibold px-4 py-3 text-right text-emerald-500">
                            R$ {recibo.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-muted-foreground px-4 py-3 text-sm">{recibo.category_name || "-"}</TableCell>
                          <TableCell className="px-4 py-3">
                            <Select
                              value={recibo.status || "pendente"}
                              onValueChange={() => {}}
                            >
                              <SelectTrigger className={`w-[130px] h-8 text-xs font-medium border rounded-lg ${
                                recibo.status === "pagamento" ? "bg-green-500/10 text-green-600 border-green-500/30" :
                                recibo.status === "pendente" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" :
                                "bg-red-500/10 text-red-600 border-red-500/30"
                              }`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                <SelectItem value="pagamento">Pagamento</SelectItem>
                                <SelectItem value="reembolso">Reembolso</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            {recibo.pdf_url ? (
                              <a
                                href={recibo.pdf_url}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground mb-2 block">Valor (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={reciboEditData.amount}
                    onChange={(e) => setReciboEditData({ ...reciboEditData, amount: e.target.value })}
                    className="bg-background border-border"
                  />
                </div>
                <div>
                  <Label className="text-foreground mb-2 block">Data de Vencimento</Label>
                  <Input
                    type="date"
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
                  value={reciboEditData.category_name}
                  onChange={(e) => setReciboEditData({ ...reciboEditData, category_name: e.target.value })}
                  placeholder="Categoria"
                  className="bg-background border-border"
                />
              </div>
              <div>
                <Label className="text-foreground mb-2 block">Status</Label>
                <Select value={reciboEditData.status} onValueChange={(value) => setReciboEditData({ ...reciboEditData, status: value })}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pagamento">Pagamento</SelectItem>
                    <SelectItem value="reembolso">Reembolso</SelectItem>
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
    </div>
  );
}
