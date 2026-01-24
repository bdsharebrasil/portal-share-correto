import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

export function NovaFormularioDespesaDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  aircraftId,
  aircraftRegistration,
  onSuccess
}: NovaFormularioDespesaDialogProps) {
  const [categorias, setCategorias] = useState<CategoriaMovimentacao[]>([]);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState("");
  
  const [formData, setFormData] = useState({
    descricao: "",
    valor: "",
    dataVencimento: "",
    fornecedorNome: "",
    fornecedorCnpj: "",
  });
  
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [notaFiscalFile, setNotaFiscalFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadCategorias();
      resetForm();
    }
  }, [open]);

  const loadCategorias = async () => {
    try {
      // Simulação de dados - substitua pela sua chamada real ao Supabase
      const mockCategorias: CategoriaMovimentacao[] = [
        { id: "1", nome: "Manutenção", tipo: "despesa", grupo_categoria: "Operacional" },
        { id: "2", nome: "Combustível", tipo: "despesa", grupo_categoria: "Operacional" },
        { id: "3", nome: "Hangaragem", tipo: "despesa", grupo_categoria: "Infraestrutura" },
        { id: "4", nome: "Seguro", tipo: "despesa", grupo_categoria: "Administrativo" },
        { id: "5", nome: "Taxas Aeroportuárias", tipo: "despesa", grupo_categoria: "Operacional" },
      ];
      
      setCategorias(mockCategorias);
      
      // Código real comentado - descomente e ajuste conforme necessário:
      /*
      const { data, error } = await supabase
        .from('categorias_movimentacao')
        .select('*')
        .eq('tipo', 'despesa')
        .order('nome');
      
      if (error) throw error;
      setCategorias(data || []);
      */
    } catch (error) {
      console.error('Error loading categorias:', error);
      toast.error('Erro ao carregar categorias');
    }
  };

  const resetForm = () => {
    setFormData({
      descricao: "",
      valor: "",
      dataVencimento: "",
      fornecedorNome: "",
      fornecedorCnpj: "",
    });
    setSelectedCategoria("");
    setBoletoFile(null);
    setNotaFiscalFile(null);
  };

  const handleSubmit = async () => {
    // Validações
    if (!selectedCategoria) {
      toast.error('Selecione uma categoria');
      return;
    }
    if (!formData.valor || parseFloat(formData.valor) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    if (!formData.dataVencimento) {
      toast.error('Informe a data de vencimento');
      return;
    }
    if (!formData.fornecedorNome) {
      toast.error('Informe o nome do fornecedor');
      return;
    }

    try {
      setSaving(true);

      // Aqui você faria o upload dos arquivos e salvaria no banco
      // Por enquanto, apenas simulamos o sucesso
      
      // Simular delay de salvamento
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success('Despesa cadastrada com sucesso!');
      onSuccess();
      onOpenChange(false);
      
      // Código real comentado:
      /*
      let boletoUrl = null;
      let notaFiscalUrl = null;

      if (boletoFile) {
        boletoUrl = await uploadFile(boletoFile, 'boletos');
      }
      if (notaFiscalFile) {
        notaFiscalUrl = await uploadFile(notaFiscalFile, 'notas_fiscais');
      }

      const categoriaObj = categorias.find(c => c.id === selectedCategoria);

      const { error } = await supabase
        .from('despesas_cliente_direto')
        .insert({
          client_id: clientId,
          client_name: clientName,
          aeronave_id: aircraftId,
          aeronave_registro: aircraftRegistration,
          categoria_id: selectedCategoria,
          categoria_nome: categoriaObj?.nome,
          descricao: formData.descricao,
          valor: parseFloat(formData.valor),
          data_vencimento: formData.dataVencimento,
          fornecedor_nome: formData.fornecedorNome,
          fornecedor_cnpj: formData.fornecedorCnpj || null,
          status: 'pendente_envio',
          boleto_url: boletoUrl,
          nota_fiscal_url: notaFiscalUrl,
        });

      if (error) throw error;
      */
    } catch (error) {
      console.error('Error saving despesa:', error);
      toast.error('Erro ao cadastrar despesa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Despesa para o Cliente</DialogTitle>
          <DialogDescription>
            Cadastre uma nova despesa para {clientName} - {aircraftRegistration}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Categoria - COMBOBOX CORRIGIDO */}
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full justify-between"
                >
                  {selectedCategoria
                    ? categorias.find((cat) => cat.id === selectedCategoria)?.nome
                    : "Selecione uma categoria..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar categoria..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                    <CommandGroup>
                      {categorias.map((categoria) => (
                        <CommandItem
                          key={categoria.id}
                          value={categoria.nome}
                          onSelect={() => {
                            setSelectedCategoria(categoria.id);
                            setOpenCombobox(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCategoria === categoria.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {categoria.nome}
                          {categoria.grupo_categoria && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({categoria.grupo_categoria})
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              placeholder="Descreva a despesa..."
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={3}
            />
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Vencimento *</Label>
              <Input
                type="date"
                value={formData.dataVencimento}
                onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })}
              />
            </div>
          </div>

          {/* Fornecedor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Fornecedor *</Label>
              <Input
                placeholder="Ex: Petrobras"
                value={formData.fornecedorNome}
                onChange={(e) => setFormData({ ...formData, fornecedorNome: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ do Fornecedor</Label>
              <Input
                placeholder="00.000.000/0000-00"
                value={formData.fornecedorCnpj}
                onChange={(e) => setFormData({ ...formData, fornecedorCnpj: e.target.value })}
              />
            </div>
          </div>

          {/* Upload de Arquivos */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Boleto</Label>
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
                    size="sm"
                    onClick={() => setBoletoFile(null)}
                  >
                    Remover
                  </Button>
                )}
              </div>
              {boletoFile && (
                <p className="text-xs text-muted-foreground">{boletoFile.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Nota Fiscal</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.xml"
                  onChange={(e) => setNotaFiscalFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {notaFiscalFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNotaFiscalFile(null)}
                  >
                    Remover
                  </Button>
                )}
              </div>
              {notaFiscalFile && (
                <p className="text-xs text-muted-foreground">{notaFiscalFile.name}</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : 'Cadastrar Despesa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
