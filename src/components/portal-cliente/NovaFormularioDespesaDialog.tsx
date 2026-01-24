import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Calendar, Building2, Tag, Upload, X, Command, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface NovaFormularioDespesaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  aircraftId: string;
  aircraftRegistration: string;
  onSuccess: () => void;
}

interface CategoriaMovimentacao {
  id: string;
  nome: string;
  tipo: string;
  grupo_categoria: string | null;
}

interface FornecedorFavorito {
  id: string;
  nome_completo: string;
  documento?: string;
  categoria?: string;
  apelido?: string;
}

export function NovaFormularioDespesaDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  aircraftId,
  aircraftRegistration,
  onSuccess
}: NovaFormularioDespesaDialogProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<CategoriaMovimentacao[]>([]);
  const [fornecedoresFavoritos, setFornecedoresFavoritos] = useState<FornecedorFavorito[]>([]);
  
  // Form state
  const [categoriaId, setCategoriaId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [fornecedorCnpj, setFornecedorCnpj] = useState("");
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [notaFiscalFile, setNotaFiscalFile] = useState<File | null>(null);
  const [openCombobox, setOpenCombobox] = useState(false);

  // Carregar categorias e fornecedores ao abrir o dialog
  useEffect(() => {
    if (open) {
      loadCategories();
      loadFornecedoresFavoritos();
      setDataVencimento(new Date().toISOString().split('T')[0]);
    }
  }, [open]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias_movimentacao')
        .select('id, nome, tipo, grupo_categoria')
        .eq('ativo', true)
        .or('grupo_categoria.eq.Despesas Aeronave,reembolsavel.eq.true')
        .order('grupo_categoria', { ascending: true })
        .order('nome', { ascending: true });

      if (error) throw error;
      setCategories((data || []) as CategoriaMovimentacao[]);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const loadFornecedoresFavoritos = async () => {
    try {
      const { data, error } = await supabase
        .from('fornecedores_favoritos')
        .select('id, nome_completo, documento, categoria, apelido')
        .eq('categoria', 'share')
        .order('nome_completo', { ascending: true });

      if (error) throw error;
      setFornecedoresFavoritos((data || []) as FornecedorFavorito[]);
    } catch (error) {
      console.error('Erro ao carregar fornecedores favoritos:', error);
      toast.error('Erro ao carregar fornecedores');
    }
  };

  const handleSelectFornecedor = (fornecedor: FornecedorFavorito) => {
    setFornecedorId(fornecedor.id);
    setFornecedorNome(fornecedor.nome_completo);
    setFornecedorCnpj(fornecedor.documento || "");
    setOpenCombobox(false);
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${clientId}/${Date.now()}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('client-documents')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('client-documents')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!valor || parseFloat(valor.replace(',', '.')) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    if (!categoriaId) {
      toast.error('Selecione uma categoria');
      return;
    }

    if (!descricao.trim()) {
      toast.error('Informe uma descrição');
      return;
    }

    if (!dataVencimento) {
      toast.error('Informe a data de vencimento');
      return;
    }

    if (!fornecedorNome.trim()) {
      toast.error('Selecione ou informe o fornecedor');
      return;
    }

    try {
      setSubmitting(true);

      let boletoUrl = null;
      let notaFiscalUrl = null;

      // Upload files if provided
      if (boletoFile) {
        boletoUrl = await uploadFile(boletoFile, 'boletos');
      }
      if (notaFiscalFile) {
        notaFiscalUrl = await uploadFile(notaFiscalFile, 'notas-fiscais');
      }

      const valorNum = parseFloat(valor.replace(',', '.'));
      const categoria = categories.find(c => c.id === categoriaId);

      const { error } = await (supabase as any)
        .from('despesas_cliente_direto')
        .insert({
          client_id: clientId,
          client_name: clientName,
          aeronave_id: aircraftId || null,
          aeronave_registro: aircraftRegistration || null,
          categoria_id: categoriaId,
          categoria_nome: categoria?.nome || 'Despesa',
          descricao: descricao,
          valor: valorNum,
          data_vencimento: dataVencimento,
          fornecedor_nome: fornecedorNome,
          fornecedor_cnpj: fornecedorCnpj || null,
          status: 'pendente_envio',
          boleto_url: boletoUrl,
          nota_fiscal_url: notaFiscalUrl,
          criado_por: user?.id || null
        } as any);

      if (error) throw error;

      toast.success('Despesa cadastrada com sucesso!');
      
      // Reset form
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao cadastrar despesa:', error);
      toast.error('Erro ao cadastrar despesa');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCategoriaId("");
    setDescricao("");
    setValor("");
    setDataVencimento(new Date().toISOString().split('T')[0]);
    setFornecedorId("");
    setFornecedorNome("");
    setFornecedorCnpj("");
    setBoletoFile(null);
    setNotaFiscalFile(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Group categories by grupo_categoria
  const groupedCategories = categories.reduce((acc, cat) => {
    const group = cat.grupo_categoria || 'Outras';
    if (!acc[group]) acc[group] = [];
    acc[group].push(cat);
    return acc;
  }, {} as Record<string, CategoriaMovimentacao[]>);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Despesa</DialogTitle>
          <DialogDescription>
            Cadastre uma nova despesa para {clientName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria *</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {Object.entries(groupedCategories).map(([group, cats]) => (
                    <div key={group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                        {group}
                      </div>
                      {cats.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <span className="flex items-center gap-2">
                            <Tag className="h-3 w-3" />
                            {cat.nome}
                          </span>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor (R$) *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="valor"
                  type="text"
                  placeholder="0,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataVencimento">Data Vencimento *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dataVencimento"
                  type="date"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Combobox para Fornecedor */}
          <div className="space-y-2">
            <Label>Fornecedor *</Label>
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2 flex-1 text-left">
                    <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">
                      {fornecedorNome || "Selecione um fornecedor..."}
                    </span>
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Buscar fornecedor..."
                    className="h-8"
                    value={fornecedorNome}
                    onChange={(e) => setFornecedorNome(e.target.value)}
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {fornecedoresFavoritos.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum fornecedor encontrado
                    </div>
                  ) : (
                    fornecedoresFavoritos
                      .filter(f => 
                        fornecedorNome === "" || 
                        f.nome_completo.toLowerCase().includes(fornecedorNome.toLowerCase())
                      )
                      .map((fornecedor) => (
                        <button
                          key={fornecedor.id}
                          className={cn(
                            "w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2",
                            fornecedorId === fornecedor.id && "bg-muted"
                          )}
                          onClick={() => handleSelectFornecedor(fornecedor)}
                          type="button"
                        >
                          <Check
                            className={cn(
                              "h-4 w-4",
                              fornecedorId === fornecedor.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{fornecedor.nome_completo}</p>
                            {fornecedor.apelido && (
                              <p className="text-xs text-muted-foreground">{fornecedor.apelido}</p>
                            )}
                          </div>
                        </button>
                      ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fornecedorCnpj">CNPJ do Fornecedor</Label>
            <Input
              id="fornecedorCnpj"
              placeholder="00.000.000/0000-00"
              value={fornecedorCnpj}
              onChange={(e) => setFornecedorCnpj(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              placeholder="Descrição detalhada da despesa..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Boleto (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setBoletoFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {boletoFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setBoletoFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {boletoFile && (
                <p className="text-xs text-muted-foreground">{boletoFile.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Nota Fiscal (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setNotaFiscalFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {notaFiscalFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setNotaFiscalFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {notaFiscalFile && (
                <p className="text-xs text-muted-foreground">{notaFiscalFile.name}</p>
              )}
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Salvando...' : 'Cadastrar Despesa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
