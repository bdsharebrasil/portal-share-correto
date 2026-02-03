import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, FileUp, DollarSign, Search, X, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCategoriasFinanceiro, useCategoriasConta } from "@/hooks/useCategoriasFinanceiro";
import { useAeronaves } from "@/hooks/useAeronaves";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
// CORREÇÃO: Adicionado 'pdf' na importação abaixo
import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer';
import { insertReceiptToBankReconciliations } from "@/services/receiptSubmitHandler";

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
  
  // Estilo da Logo no Cabeçalho
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
  
  // Estilo da Logo na Assinatura
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
          {/* Logo no canto esquerdo superior */}
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
          
          {/* Logo na assinatura */}
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

// --- COMPONENTE PRINCIPAL ---

export function NotasFiscaisSaida() {
  const { getCategoriasReceita } = useCategoriasFinanceiro();
  const categoriasReceita = getCategoriasReceita();
  const { aeronaves, isLoadingAeronaves } = useAeronaves();

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
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [selectedBankForStatus, setSelectedBankForStatus] = useState<string>("");
  const [notaBeingStatusChanged, setNotaBeingStatusChanged] = useState<NotaFiscalSaida | null>(null);
  const [showReciboDialog, setShowReciboDialog] = useState(false);
  const [showReciboViewer, setShowReciboViewer] = useState(false);
  const [reciboViewUrl, setReciboViewUrl] = useState<string>("");
  const [reciboData, setReciboData] = useState({
    cliente_id: "",
    cliente_nome: "",
    cliente_cnpj: "",
    aeronave_id: "",
    aeronave_registro: "",
    valor: "",
    data_vencimento: new Date().toISOString().split("T")[0],
    descricao: "",
  });
  const [isGeneratingRecibo, setIsGeneratingRecibo] = useState(false);
  const { contas } = useCategoriasConta();
  const bancos = Array.from(new Set(contas.map(c => c.banco).filter(Boolean))) as string[];
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
    aircraft_id: "",
    aeronave_registration: "",
  });

  useEffect(() => {
    loadNotas();
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      // First try to load with status filter (for active clients)
      let { data: clientsData, error } = await supabase
        .from("clients")
        .select("id, company_name, cnpj, proprietario, status");

      // Handle potential errors
      if (error) {
        console.error("Erro ao carregar clientes:", error);
        clientsData = [];
      }

      const clientesList: Cliente[] = [];

      if (clientsData) {
        clientsData.forEach(client => {
          // Use company_name if available, fallback to proprietario, or use cnpj as last resort
          const nomeCliente = client.company_name || client.proprietario || client.cnpj || "Cliente";

          // Include client if it has a valid name/identifier
          if (nomeCliente && nomeCliente !== "Cliente") {
            clientesList.push({
              id: client.id,
              nome: nomeCliente,
              documento: client.cnpj || ""
            });
          }
        });
      }

      // Sort by name for consistent display
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

  const handleSave = async () => {
    if (!formData.numero || !formData.cliente_nome || !formData.valor) {
      toast({
        title: "Validação",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const notaData: any = {
        numero: formData.numero,
        cliente_nome: formData.cliente_nome,
        cliente_cnpj: formData.cliente_cnpj || "",
        data_criacao: formData.data_criacao,
        data_vencimento: formData.data_vencimento || formData.data_criacao,
        valor: parseFloat(formData.valor),
        categoria: formData.categoria || "Serviços",
        descricao: formData.descricao || null,
        status: formData.status,
        arquivo_pdf_url: pdfUrl || null,
        aeronave: formData.aeronave_registration || null,
      };

      const { data: { user } } = await supabase.auth.getUser();

      if (editingNota) {
        const { error } = await supabase
          .from("notas_fiscais_saida")
          .update(notaData)
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
      aircraft_id: "",
      aeronave_registration: nota.aeronave || "",
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
      aircraft_id: "",
      aeronave_registration: "",
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
    try {
      const nota = notas.find(n => n.id === notaId);
      if (!nota) return;

      const previousStatus = nota.status;

      // Se mudando para "recebido", mostrar diálogo de seleção de banco
      if (newStatus === "recebido") {
        setNotaBeingStatusChanged(nota);
        setSelectedBankForStatus("");
        setShowBankDialog(true);
        return;
      }

      // Para outros status, atualizar diretamente
      const { error } = await supabase
        .from("notas_fiscais_saida")
        .update({ status: newStatus })
        .eq("id", notaId);

      if (error) throw error;

      // ESTORNO: Se estava "recebido" e mudou para outro status, deletar do controle_bancario
      if (previousStatus === "recebido" && (newStatus === "pendente" || newStatus === "cancelado")) {
        const { error: deleteError } = await supabase
          .from("controle_bancario")
          .delete()
          .eq("numero_documento", nota.numero)
          .eq("tipo_movimento", "entrada");

        if (deleteError) {
          console.error("Erro ao remover do fluxo de caixa:", deleteError);
          toast({
            title: "Aviso",
            description: "Status atualizado, mas houve erro ao remover do fluxo de caixa",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sucesso",
            description: `Status atualizado para ${newStatus === "pendente" ? "Pendente" : "Cancelado"} e entrada removida do fluxo de caixa`,
          });
        }
      } else {
        toast({
          title: "Sucesso",
          description: newStatus === "pendente" ? "Status atualizado para Pendente" : "Nota fiscal cancelada",
        });
      }

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

  const handleConfirmBankSelection = async () => {
    if (!selectedBankForStatus || !notaBeingStatusChanged) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um banco",
        variant: "destructive",
      });
      return;
    }

    try {
      const nota = notaBeingStatusChanged;

      // Atualizar status para "recebido"
      const { error: updateError } = await supabase
        .from("notas_fiscais_saida")
        .update({ status: "recebido" })
        .eq("id", nota.id);

      if (updateError) throw updateError;

      // Criar entrada no controle_bancario
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const descricao = `NF Saída ${nota.numero} - ${nota.cliente_nome}${nota.aeronave_registration ? ` (${nota.aeronave_registration})` : ""}`;

        const { error: fluxoError } = await supabase
          .from("controle_bancario")
          .insert({
            descricao: descricao,
            valor: nota.valor,
            data: new Date().toISOString().split("T")[0],
            data_vencimento: nota.data_vencimento,
            categoria_id: "2874b45b-a3bb-4bec-8f7e-74b328f8693c",
            tipo_movimento: "entrada",
            status: "confirmado",
            numero_documento: nota.numero,
            conta_banco: selectedBankForStatus,
            criado_por: user.id
          });

        if (fluxoError) {
          console.error("Erro ao criar entrada no controle:", fluxoError);
          toast({
            title: "Aviso",
            description: "Status atualizado, mas houve um erro ao registrar no fluxo de caixa",
            variant: "destructive",
          });
        } else {
          // Inserir também em bank_reconciliations
          const bankRecResult = await insertReceiptToBankReconciliations(
            {
              descricao: descricao,
              valor: nota.valor,
              data: new Date().toISOString().split("T")[0],
              data_vencimento: nota.data_vencimento,
              numero_documento: nota.numero,
              status: "pendente",
              client_id: nota.client_id || undefined,
              client_name: nota.cliente_nome,
              aeronave_id: nota.aircraft_id || undefined,
              aeronave_registro: nota.aeronave_registration || undefined,
              categoria_id: "2874b45b-a3bb-4bec-8f7e-74b328f8693c",
              nf_url: nota.arquivo_pdf_url || undefined,
              tipo: "nf",
            },
            user.id
          );

          if (!bankRecResult.success) {
            console.error("Erro ao inserir em bank_reconciliations:", bankRecResult.error);
            toast({
              title: "Aviso",
              description: "NF registrada no fluxo, mas houve um erro ao registrar na reconciliação bancária",
              variant: "default",
            });
          }
        }
      }

      toast({
        title: "Sucesso",
        description: "Nota fiscal marcada como recebida e registrada no fluxo bancário",
      });

      setShowBankDialog(false);
      setNotaBeingStatusChanged(null);
      setSelectedBankForStatus("");
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
    // Extrair 3 primeiras letras do cliente em maiúsculas
    const clienteLetras = clienteNome.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '').padEnd(3, 'X');
    
    // Obter ano atual (últimos 2 dígitos)
    const ano = new Date().getFullYear().toString().slice(-2);
    
    const { data: existingRecibos, error } = await supabase
      .from("controle_bancario")
      .select("numero_documento", { count: "exact" })
      .like("numero_documento", `REC-${clienteLetras}%/${ano}`)
      .eq("tipo_movimento", "entrada")
      .order("numero_documento", { ascending: false });
    
    let numero = 1;
    if (existingRecibos && existingRecibos.length > 0) {
      // Extrair o número sequencial do recibo existente
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
    // 1. Validações Básicas
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

      // 2. Gerar Número do Recibo
      const numeroRecibo = await generateReciboNumber(reciboData.cliente_nome);

      // 3. Preparar dados para o PDF
      const dadosParaPDF = {
        numero_recibo: numeroRecibo,
        valor: reciboData.valor,
        cliente_nome: reciboData.cliente_nome,
        cliente_cnpj: reciboData.cliente_cnpj,
        descricao: reciboData.descricao || "Prestação de serviços aeronáuticos",
        aeronave_registro: reciboData.aeronave_registro,
        data_atual: new Date()
      };

      // 4. GERAR O PDF LOCALMENTE (ECONOMIA DE TOKENS DE EXECUÇÃO)
      // Aqui criamos o blob diretamente na memória do navegador usando o componente criado acima
      const blob = await pdf(<ReciboDocument data={dadosParaPDF} />).toBlob();

      // 5. Upload do PDF para o Storage
      const pdfFile = new File([blob], `${numeroRecibo}.pdf`, { type: "application/pdf" });
      const fileName = `recibo_${numeroRecibo}_${Date.now()}.pdf`;
      const filePath = `recibos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("nfs-share-saida")
        .upload(filePath, pdfFile);

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      // 6. Obter URL pública
      const { data: publicUrlData } = supabase.storage
        .from("nfs-share-saida")
        .getPublicUrl(filePath);

      const reciboUrl = publicUrlData.publicUrl;

      // 7. Salvar no Banco de Dados
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Usuário não autenticado");

      const CATEGORIA_ID = "2874b45b-a3bb-4bec-8f7e-74b328f8693c";
      
      // Busca IDs auxiliares (Cliente, Aeronave, Categoria)
      let clientId = reciboData.cliente_id || null;
      if (!clientId) {
        const { data: clientData } = await supabase.from("clients").select("id").eq("company_name", reciboData.cliente_nome).single();
        clientId = clientData?.id || null;
      }

      let aeronaveId = reciboData.aeronave_id || null;
      if (!aeronaveId) {
        const { data: aeroData } = await supabase.from("aircraft").select("id").eq("registration", reciboData.aeronave_registro).single();
        aeronaveId = aeroData?.id || null;
      }

      const { data: categoriaData } = await supabase.from("categorias_movimentacao").select("grupo_categoria").eq("id", CATEGORIA_ID).single();
      const grupoCategoria = categoriaData?.grupo_categoria || null;

      // Inserção no Controle Bancário
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
          recibo_url: reciboUrl,
          client_id: clientId,
          client_name: reciboData.cliente_nome,
          aeronave_id: aeronaveId,
          aeronave_registro: reciboData.aeronave_registro,
          grupo_categoria: grupoCategoria,
          colaborador_id: currentUser.id,
        });

      if (controleBancarioError) throw new Error(`Erro controle_bancario: ${controleBancarioError.message}`);

      // Inserção em Bank Reconciliations
      const descricaoRecibo = reciboData.descricao || "Recibo de Saída - Serviços";
      const bankRecResult = await insertReceiptToBankReconciliations(
        {
          descricao: descricaoRecibo,
          valor: parseFloat(reciboData.valor),
          data: new Date().toISOString().split("T")[0],
          data_vencimento: reciboData.data_vencimento,
          numero_documento: numeroRecibo,
          status: "pendente",
          client_id: clientId || undefined,
          client_name: reciboData.cliente_nome,
          aeronave_id: aeronaveId || undefined,
          aeronave_registro: reciboData.aeronave_registro,
          categoria_id: CATEGORIA_ID,
          recibo_url: reciboUrl,
          tipo: "recibo",
        },
        currentUser.id
      );

      if (!bankRecResult.success) {
        console.error("Erro ao inserir em bank_reconciliations:", bankRecResult.error);
        // Não lançar erro aqui, apenas avisar, pois o recibo já foi criado em controle_bancario
        toast({
          title: "Aviso",
          description: "Recibo criado, mas houve um erro ao registrar na reconciliação bancária",
          variant: "default",
        });
      }

      // Inserção em Contas a Receber
      await supabase.from("contas_areceber").insert({
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

      // 8. Finalização
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

  // Helper para limpar form
  const resetReciboForm = () => {
    setReciboData({
      cliente_id: "",
      cliente_nome: "",
      cliente_cnpj: "",
      aeronave_id: "",
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

  const totalPendente = notas
    .filter((n) => n.status === "pendente")
    .reduce((acc, n) => acc + n.valor, 0);

  const totalPago = notas
    .filter((n) => n.status === "pago" || n.status === "recebido")
    .reduce((acc, n) => acc + n.valor, 0);

  return (
    <div className="space-y-6">
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
                R$ {totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
                  <Label className="text-foreground">Data de Criação</Label>
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
                  <Label className="text-foreground">CNPJ/CPF</Label>
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
                          value={formData.aeronave_registration}
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
                                        aircraft_id: aero.id,
                                        aeronave_registration: aero.registration
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
                  {formData.aircraft_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          aircraft_id: "",
                          aeronave_registration: ""
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
                  <Label className="text-foreground">Data de Vencimento</Label>
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
                  <Label className="text-foreground">Categoria</Label>
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
                  <Label className="text-foreground">Status</Label>
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
                    aeronave_id: "",
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
                {/* Cliente */}
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

                {/* Aeronave */}
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
                                        aeronave_id: aero.id,
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
                {/* Valor */}
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

                {/* Data de Vencimento */}
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

              {/* Descrição */}
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
                      aeronave_id: "",
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
                        {nota.aeronave || nota.aeronave_registration || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                        {format(new Date(nota.data_criacao + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                        {nota.data_vencimento && format(new Date(nota.data_vencimento + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
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

      {/* Dialog de Seleção de Banco para Recebido */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Selecionar Banco</DialogTitle>
          </DialogHeader>
          {notaBeingStatusChanged && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Nota Fiscal</p>
                <p className="font-semibold text-foreground">{notaBeingStatusChanged.numero}</p>
                <p className="text-sm text-muted-foreground mt-2">{notaBeingStatusChanged.cliente_nome}</p>
                <p className="text-sm text-foreground font-semibold mt-2">
                  R$ {notaBeingStatusChanged.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div>
                <Label className="text-foreground font-semibold mb-2 block">
                  Selecione o Banco de Recebimento *
                </Label>
                <Select value={selectedBankForStatus} onValueChange={setSelectedBankForStatus}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecione um banco" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {bancos.length > 0 ? (
                      bancos.map((banco) => (
                        <SelectItem key={banco} value={banco}>
                          {banco}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Nenhum banco disponível
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowBankDialog(false);
                setNotaBeingStatusChanged(null);
                setSelectedBankForStatus("");
              }}
            >
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleConfirmBankSelection}
            >
              Confirmar Recebimento
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
    </div>
  );
}
