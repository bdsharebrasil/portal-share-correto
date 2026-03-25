import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save, Send, Loader2, FileUp, Download, AlertCircle, X, Trash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";

interface ServiceItem {
  id?: string;
  ordenacao: number;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
}

interface CTMServiceItemsFormProps {
  orderId: string;
  serviceNumber?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

export function CTMServiceItemsForm({
  orderId,
  serviceNumber = "SRV-001",
  onSaved,
  onCancel,
}: CTMServiceItemsFormProps) {
  const [loading, setLoading] = useState(false);
  const [oficinas, setOficinas] = useState<any[]>([]);
  const [showNewFornecedor, setShowNewFornecedor] = useState(false);
  const [draftId] = useState(() => `draft-${orderId}-${Date.now()}`);
  const [draftLastSaved, setDraftLastSaved] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [newFornecedorData, setNewFornecedorData] = useState({
    razao_social: "",
    cnpj: "",
    endereco: "",
    telefone: "",
  });

  // Formulário de itens
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [newItem, setNewItem] = useState<ServiceItem>({
    ordenacao: 1,
    descricao: "",
    quantidade: 1,
    valor_unitario: "" as any,
    subtotal: 0,
  });

  // Cabeçalho do serviço
  const [serviceHeader, setServiceHeader] = useState({
    descricao: "",
    modelo: "",
    p_n: "", // Part Number
    n_s: "", // Serial Number
  });

  // Dados financeiros
  const [financialData, setFinancialData] = useState({
    numero_servico: "",
    oficina_id: "",
    oficina_nome: "",
    modo_pagamento: "",
    condicoes_pagamento: "",
    dados_pagamento: "",
    observacoes: "",
  });

  // Arquivo PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // ─── Funções de Rascunho ─────────────────────────────────────────────────────
  const saveDraft = () => {
    try {
      const draftData = {
        orderId,
        items,
        newItem,
        serviceHeader,
        financialData,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftId, JSON.stringify(draftData));
      setDraftLastSaved(new Date());
      toast.success("Rascunho salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar rascunho:", error);
      toast.error("Erro ao salvar rascunho");
    }
  };

  const loadDraft = () => {
    try {
      const draftData = localStorage.getItem(draftId);
      if (draftData) {
        const data = JSON.parse(draftData);
        setItems(data.items || []);
        setNewItem(data.newItem || { ordenacao: 1, descricao: "", quantidade: 1, valor_unitario: "" as any, subtotal: 0 });
        setServiceHeader(data.serviceHeader || { descricao: "", modelo: "", p_n: "", n_s: "" });
        setFinancialData(data.financialData || { numero_servico: "", oficina_id: "", oficina_nome: "", modo_pagamento: "", condicoes_pagamento: "", dados_pagamento: "", observacoes: "" });
        setDraftLastSaved(new Date(data.savedAt));
        toast.success("Rascunho recuperado!");
      }
    } catch (error) {
      console.error("Erro ao carregar rascunho:", error);
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftId);
      setHasDraft(false);
      setDraftLastSaved(null);
      toast.success("Rascunho descartado");
    } catch (error) {
      console.error("Erro ao descartar rascunho:", error);
    }
  };

  const checkForDraft = () => {
    const draft = localStorage.getItem(draftId);
    if (draft) {
      setHasDraft(true);
      const data = JSON.parse(draft);
      setDraftLastSaved(new Date(data.savedAt));
    }
  };

  useEffect(() => {
    loadOficinas();
    checkForDraft();
  }, []);

  const loadOficinas = async () => {
    try {
      const { data } = await supabase
        .from("oficinas")
        .select("id, razao_social, cnpj")
        .eq("ativo", true)
        .order("razao_social");
      
      if (data && data.length > 0) {
        const comboboxItems = data.map((o: any) => ({
          id: o.id,
          label: `${o.razao_social} ${o.cnpj ? `(${o.cnpj})` : ""}`,
        }));
        setOficinas(comboboxItems);
      }
    } catch (error) {
      console.error("Erro ao carregar oficinas:", error);
    }
  };

  const handleCreateNewFornecedor = async () => {
    if (!newFornecedorData.razao_social.trim()) {
      toast.error("Razão social é obrigatória");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("oficinas")
        .insert([
          {
            razao_social: newFornecedorData.razao_social,
            cnpj: newFornecedorData.cnpj || null,
            endereco: newFornecedorData.endereco || null,
            telefone: newFornecedorData.telefone || null,
            ativo: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Atualizar lista de oficinas
      await loadOficinas();

      // Selecionar o novo fornecedor
      setFinancialData({
        ...financialData,
        oficina_id: data.id,
        oficina_nome: data.razao_social,
      });

      setShowNewFornecedor(false);
      setNewFornecedorData({
        razao_social: "",
        cnpj: "",
        endereco: "",
        telefone: "",
      });

      toast.success("Oficina criada com sucesso!");
    } catch (error: any) {
      console.error("Erro ao criar oficina:", error);
      toast.error(error.message || "Erro ao criar oficina");
    }
  };

  const handleAddItem = () => {
    if (!newItem.descricao.trim()) {
      toast.error("Descrição do item é obrigatória");
      return;
    }

    const subtotal = newItem.quantidade * newItem.valor_unitario;
    const novoItem: ServiceItem = {
      ...newItem,
      ordenacao: items.length + 1,
      subtotal,
    };

    setItems([...items, novoItem]);
    setNewItem({
      ordenacao: items.length + 2,
      descricao: "",
      quantidade: 1,
      valor_unitario: "" as any,
      subtotal: 0,
    });
    toast.success("Item adicionado");
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    // Reordenar
    const reordered = newItems.map((item, idx) => ({
      ...item,
      ordenacao: idx + 1,
    }));
    setItems(reordered);
  };

  const handleUpdateItem = (index: number, field: keyof ServiceItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalcular subtotal se quantidade ou valor unitário mudou
    if (field === "quantidade" || field === "valor_unitario") {
      updated[index].subtotal = updated[index].quantidade * updated[index].valor_unitario;
    }
    
    setItems(updated);
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      toast.success("PDF selecionado com sucesso");
    } else {
      toast.error("Por favor, selecione um arquivo PDF válido");
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }

    if (!financialData.oficina_nome) {
      toast.error("Selecione uma oficina");
      return;
    }

    if (!financialData.numero_servico.trim()) {
      toast.error("Digite o número do serviço");
      return;
    }

    setLoading(true);
    try {
      const totalServico = calculateTotal();

      // 1. Criar/atualizar registro de serviço
      const { data: serviceData, error: serviceError } = await (supabase as any)
        .from("ctm_services")
        .insert([
          {
            service_order_id: orderId,
            descricao: `${serviceHeader.descricao || "Serviço Múltiplos Itens"} - ${financialData.numero_servico}`,
            fornecedor: financialData.oficina_nome,
            fornecedor_id: financialData.oficina_id,
            valor: totalServico,
            modelo: serviceHeader.modelo || null,
            p_n: serviceHeader.p_n || null,
            n_s: serviceHeader.n_s || null,
            modo_pagamento: financialData.modo_pagamento || null,
            dados_pagamento: financialData.dados_pagamento || null,
            condicoes_pagamento: financialData.condicoes_pagamento || null,
            observacoes: financialData.observacoes || null,
            status: "pendente",
            quantidade: items.length,
          },
        ])
        .select()
        .single();

      if (serviceError) throw serviceError;

      const serviceId = serviceData.id;

      // 2. Criar itens do serviço
      const itemsToInsert = items.map((item) => ({
        service_id: serviceId,
        ordenacao: item.ordenacao,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        subtotal: item.subtotal,
      }));

      const { error: itemsError } = await (supabase as any)
        .from("ctm_service_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // 3. Upload do PDF se houver
      if (pdfFile) {
        const fileName = `${serviceId}_${Date.now()}_${pdfFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("ctm-pdfs")
          .upload(`services/${fileName}`, pdfFile);

        if (uploadError) {
          console.warn("Erro ao upload PDF:", uploadError);
        } else {
          // Associar PDF ao serviço
          await (supabase as any).from("ctm_service_attachments").insert([
            {
              service_id: serviceId,
              arquivo_nome: pdfFile.name,
              arquivo_path: `services/${fileName}`,
              tipo: "pdf",
            },
          ]);
        }
      }

      toast.success("Serviço com múltiplos itens criado com sucesso!");
      if (onSaved) onSaved();

      // Limpar formulário
      setItems([]);
      setNewItem({
        ordenacao: 1,
        descricao: "",
        quantidade: 1,
        valor_unitario: 0,
        subtotal: 0,
      });
      setServiceHeader({
        descricao: "",
        modelo: "",
        p_n: "",
        n_s: "",
      });
      setFinancialData({
        numero_servico: "",
        oficina_id: "",
        oficina_nome: "",
        modo_pagamento: "",
        condicoes_pagamento: "",
        dados_pagamento: "",
        observacoes: "",
      });
      setPdfFile(null);
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(error.message || "Erro ao salvar serviço");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndSendApproval = async () => {
    if (items.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }

    if (!financialData.oficina_nome) {
      toast.error("Selecione uma oficina");
      return;
    }

    if (!financialData.numero_servico.trim()) {
      toast.error("Digite o número do serviço");
      return;
    }

    setLoading(true);
    try {
      const totalServico = calculateTotal();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Você precisa estar logado"); return; }

      // Get user profile name
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      // 1. Create service record
      const { data: serviceData, error: serviceError } = await (supabase as any)
        .from("ctm_services")
        .insert([{
          service_order_id: orderId,
          descricao: `${serviceHeader.descricao || "Serviço"} - ${financialData.numero_servico}`,
          fornecedor: financialData.oficina_nome,
          fornecedor_id: financialData.oficina_id,
          valor: totalServico,
          modelo: serviceHeader.modelo || null,
          p_n: serviceHeader.p_n || null,
          n_s: serviceHeader.n_s || null,
          modo_pagamento: financialData.modo_pagamento || null,
          dados_pagamento: financialData.dados_pagamento || null,
          condicoes_pagamento: financialData.condicoes_pagamento || null,
          observacoes: financialData.observacoes || null,
          status: "pendente_aprovacao",
          quantidade: items.length,
          approval_status: "pendente_aprovacao",
          submitted_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (serviceError) throw serviceError;

      // 2. Create service items
      const itemsToInsert = items.map((item) => ({
        service_id: serviceData.id,
        ordenacao: item.ordenacao,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        subtotal: item.subtotal,
      }));

      await (supabase as any).from("ctm_service_items").insert(itemsToInsert);

      // 3. Create budget for approval notification
      const budgetPayload = {
        aircraft_id: (serviceData as any).service_order_id ? null : null,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        status: "submitted",
        approval_status: "pendente_aprovacao",
        created_by: user.id,
        supplier_name: financialData.oficina_nome,
        supplier_type: "oficina",
        notes: financialData.observacoes || null,
        total_value: totalServico,
        description: `${serviceHeader.descricao || "Serviço"} - ${financialData.numero_servico}`,
        submitted_at: new Date().toISOString(),
        budget_items: items.map(i => ({
          description: i.descricao,
          quantity: i.quantidade,
          unit_value: i.valor_unitario,
          total: i.subtotal,
        })),
        budget_details: {
          supplier_name: financialData.oficina_nome,
          supplier_type: "oficina",
          items: items.map(i => ({
            code: "",
            description: i.descricao,
            quantity: i.quantidade,
            unit_value: i.valor_unitario,
            total: i.subtotal,
          })),
          notes: financialData.observacoes || null,
          service_id: serviceData.id,
          service_number: financialData.numero_servico,
        },
        service_order_id: orderId,
      };

      // Get aircraft_id from service order
      const { data: orderData } = await (supabase as any)
        .from("ctm_service_orders")
        .select("aircraft_id")
        .eq("id", orderId)
        .single();

      if (orderData) {
        (budgetPayload as any).aircraft_id = orderData.aircraft_id;
      }

      const { error: budgetError } = await (supabase as any)
        .from("ctm_budgets")
        .insert([budgetPayload]);

      if (budgetError) {
        console.warn("Erro ao criar orçamento para aprovação:", budgetError);
      }

      // 4. Upload PDF if present
      if (pdfFile) {
        const fileName = `${serviceData.id}_${Date.now()}_${pdfFile.name}`;
        await supabase.storage.from("ctm-pdfs").upload(`services/${fileName}`, pdfFile);
      }

      toast.success("Serviço salvo e enviado para aprovação!");
      if (onSaved) onSaved();

      // Reset form
      setItems([]);
      setNewItem({ ordenacao: 1, descricao: "", quantidade: 1, valor_unitario: "" as any, subtotal: 0 });
      setServiceHeader({ descricao: "", modelo: "", p_n: "", n_s: "" });
      setFinancialData({ numero_servico: "", oficina_id: "", oficina_nome: "", modo_pagamento: "", condicoes_pagamento: "", dados_pagamento: "", observacoes: "" });
      setPdfFile(null);
    } catch (error: any) {
      console.error("Erro ao salvar e enviar para aprovação:", error);
      toast.error(error.message || "Erro ao salvar serviço");
    } finally {
      setLoading(false);
    }
  };

  const totalServico = calculateTotal();

  return (
    <div className="space-y-6">
      {/* Draft Status Alert */}
      {hasDraft && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                Rascunho disponível
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">
                Salvo em {draftLastSaved?.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={loadDraft} className="text-xs">
                Carregar
              </Button>
              <Button size="sm" variant="ghost" onClick={clearDraft} className="text-xs text-destructive">
                <Trash className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-save indicator */}
      {draftLastSaved && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/5 border border-green-500/20 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <p className="text-xs text-green-700 dark:text-green-400">
            Rascunho atualizado em {draftLastSaved.toLocaleTimeString('pt-BR')}
          </p>
        </div>
      )}

      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-xl">ORDEM DE SERVIÇO </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">

          </p>
        </CardHeader>
      </Card>

      {/* Número do Serviço e Oficina */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número O.S</Label>
              <Input
                value={financialData.numero_servico}
                onChange={(e) => setFinancialData({ ...financialData, numero_servico: e.target.value })}
                placeholder="Ex: SRV-001, OS-2026-001"
                className="font-mono text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Oficina *</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableCombobox
                    items={oficinas}
                    value={financialData.oficina_id}
                    onChange={(id, label) => {
                      setFinancialData({
                        ...financialData,
                        oficina_id: id,
                        oficina_nome: label,
                      });
                    }}
                    placeholder="Selecione uma oficina"
                    searchPlaceholder="Buscar oficina..."
                    emptyMessage="Nenhuma oficina encontrada"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewFornecedor(!showNewFornecedor)}
                  className="mt-7"
                  title="Criar nova oficina"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Form para criar nova oficina */}
          {showNewFornecedor && (
            <div className="border-t pt-4 space-y-4 bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Criar Nova Oficina</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowNewFornecedor(false)}
                  className="h-6 w-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Razão Social *</Label>
                  <Input
                    value={newFornecedorData.razao_social}
                    onChange={(e) => setNewFornecedorData({ ...newFornecedorData, razao_social: e.target.value })}
                    placeholder="Nome da oficina"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CNPJ</Label>
                  <Input
                    value={newFornecedorData.cnpj}
                    onChange={(e) => setNewFornecedorData({ ...newFornecedorData, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Endereço</Label>
                  <Input
                    value={newFornecedorData.endereco}
                    onChange={(e) => setNewFornecedorData({ ...newFornecedorData, endereco: e.target.value })}
                    placeholder="Rua, número, cidade"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    value={newFornecedorData.telefone}
                    onChange={(e) => setNewFornecedorData({ ...newFornecedorData, telefone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    className="text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCreateNewFornecedor} size="sm" className="w-full gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    Criar Oficina
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cabeçalho do Serviço */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Descrição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={serviceHeader.descricao}
              onChange={(e) => setServiceHeader({ ...serviceHeader, descricao: e.target.value })}
              placeholder="Descrição geral do serviço"
              className="text-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input
                value={serviceHeader.modelo}
                onChange={(e) => setServiceHeader({ ...serviceHeader, modelo: e.target.value })}
                placeholder="Modelo do equipamento"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>P/N (Part Number)</Label>
              <Input
                value={serviceHeader.p_n}
                onChange={(e) => setServiceHeader({ ...serviceHeader, p_n: e.target.value })}
                placeholder="Número da peça"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>N/S (Serial Number)</Label>
              <Input
                value={serviceHeader.n_s}
                onChange={(e) => setServiceHeader({ ...serviceHeader, n_s: e.target.value })}
                placeholder="Número de série"
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Itens do Serviço */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Itens do Serviço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Items Table */}
          {items.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-10">Ord.</TableHead>
                    <TableHead>Descrição do Serviço</TableHead>
                    <TableHead className="text-center w-20">Qtde</TableHead>
                    <TableHead className="text-right w-28">Valor Unit. R$</TableHead>
                    <TableHead className="text-right w-28">Subtotal R$</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/30">
                      <TableCell className="font-bold text-center text-xs">{item.ordenacao.toString().padStart(2, "0")}</TableCell>
                      <TableCell>
                        <Input
                          value={item.descricao}
                          onChange={(e) => handleUpdateItem(idx, "descricao", e.target.value)}
                          placeholder="Descrição"
                          className="text-xs h-8"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantidade}
                          onChange={(e) => handleUpdateItem(idx, "quantidade", parseFloat(e.target.value) || 1)}
                          className="text-center text-xs h-8"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={item.valor_unitario || ""}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.,]/g, '');
                            handleUpdateItem(idx, "valor_unitario", parseFloat(val.replace(',', '.')) || 0);
                          }}
                          className="text-right text-xs h-8"
                        />
                      </TableCell>
                      <TableCell className="text-right font-bold text-xs">
                        R$ {item.subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(idx)}
                          className="h-7 w-7"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="bg-muted/50 font-bold border-t-2">
                    <TableCell colSpan={4} className="text-right pr-4 text-sm">
                      Total do Serviço:
                    </TableCell>
                    <TableCell className="text-right text-lg text-primary">
                      R$ {totalServico.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {/* Add New Item Form */}
          <div className="space-y-3 pt-4 border-t">
            <h4 className="text-sm font-semibold">Adicionar Novo Item</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div>
                <Label className="text-xs">Descrição *</Label>
                <Input
                  value={newItem.descricao}
                  onChange={(e) => setNewItem({ ...newItem, descricao: e.target.value })}
                  placeholder="Ex: REVISÃO"
                  className="text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Qtde</Label>
                <Input
                  type="number"
                  min="1"
                  value={newItem.quantidade}
                  onChange={(e) => setNewItem({ ...newItem, quantidade: parseFloat(e.target.value) || 1 })}
                  className="text-center text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Valor Unit.</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={newItem.valor_unitario || ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.,]/g, '');
                    setNewItem({ ...newItem, valor_unitario: parseFloat(val.replace(',', '.')) || 0 });
                  }}
                  className="text-right text-xs h-8"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddItem} className="w-full gap-1.5 h-8 text-xs">
                  <Plus className="h-3 w-3" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>

          {items.length === 0 && (
            <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Nenhum item adicionado. Comece a adicionar itens acima.
            </div>
          )}
        </CardContent>
      </Card>

      {/* PDF Attachment Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Anexar Documento (PDF)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pdf-upload" className="flex items-center gap-2 cursor-pointer text-sm">
              <FileUp className="h-4 w-4" />
              Selecionar PDF
            </Label>
            <input
              id="pdf-upload"
              type="file"
              accept=".pdf"
              onChange={handlePdfUpload}
              className="hidden"
            />
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                pdfFile
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-border/50 hover:border-primary/50 bg-muted/20"
              )}
              onClick={() => document.getElementById("pdf-upload")?.click()}
            >
              {pdfFile ? (
                <div className="space-y-2">
                  <Download className="h-6 w-6 mx-auto text-green-500" />
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">{pdfFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <FileUp className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Clique para selecionar um PDF
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Observações e Dados Financeiros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Observações e Dados Financeiros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={financialData.observacoes}
              onChange={(e) => setFinancialData({ ...financialData, observacoes: e.target.value })}
              placeholder="Informações adicionais sobre o serviço..."
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modo de Pagamento</Label>
              <Input
                value={financialData.modo_pagamento}
                onChange={(e) => setFinancialData({ ...financialData, modo_pagamento: e.target.value })}
                placeholder="Ex: Boleto, Transferência"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Condições de Pagamento</Label>
              <Input
                value={financialData.condicoes_pagamento}
                onChange={(e) => setFinancialData({ ...financialData, condicoes_pagamento: e.target.value })}
                placeholder="Ex: À vista, 30 dias"
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dados Bancários / Pagamento</Label>
            <Textarea
              value={financialData.dados_pagamento}
              onChange={(e) => setFinancialData({ ...financialData, dados_pagamento: e.target.value })}
              placeholder="Banco: 001 | Agência: 0000-0 | Conta: 00000-0 | Titular: ..."
              rows={3}
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Total Summary */}
      {items.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total do Serviço</p>
                <p className="text-3xl font-black text-primary">
                  R$ {totalServico.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs text-muted-foreground">{items.length} item(ns)</p>
                <Badge variant="outline">{items.length} linha(s) de serviço</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end flex-wrap">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button
          variant="outline"
          onClick={saveDraft}
          disabled={loading}
          className="gap-2"
          title="Salva fornecimento no navegador para retomar depois"
        >
          <Save className="h-4 w-4" />
          Salvar Rascunho
        </Button>
        <Button
          variant="outline"
          onClick={handleSaveAndSendApproval}
          disabled={loading || items.length === 0}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          Salvar e Enviar Aprovação
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading || items.length === 0}
          className="gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}