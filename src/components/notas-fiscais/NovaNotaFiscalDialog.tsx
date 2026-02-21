
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface NovaNotaFiscalDialogProps {
  onSave: (notaFiscal: any) => void;
  clientes: Array<{ id: number; nome: string; documento: string }>;
}

export function NovaNotaFiscalDialog({ onSave, clientes }: NovaNotaFiscalDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    cliente: "",
    clienteCnpj: "",
    descricao: "",
    valor: "",
    dataEmissao: undefined as Date | undefined,
    dataVencimento: undefined as Date | undefined,
    categoria: "",
    metodoPagamento: "",
  });

  const handleClienteChange = (clienteId: string) => {
    const cliente = clientes.find(c => c.id.toString() === clienteId);
    setFormData(prev => ({
      ...prev,
      cliente: cliente?.nome || "",
      clienteCnpj: cliente?.documento || "",
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.cliente || !formData.valor || !formData.dataEmissao || !formData.dataVencimento) {
      alert("Preencha todos os campos obrigatórios");
      return;
    }

    const novaNotaFiscal = {
      number: `NF-${String(Date.now()).slice(-3)}/${new Date().getFullYear()}`,
      client: formData.cliente,
      clientCnpj: formData.clienteCnpj,
      value: parseFloat(formData.valor),
      date: format(formData.dataEmissao, "dd/MM/yyyy"),
      dueDate: format(formData.dataVencimento, "dd/MM/yyyy"),
      status: "Pendente",
      category: formData.categoria,
      description: formData.descricao,
      paymentMethod: formData.metodoPagamento,
    };

    // Gerar conta a receber automaticamente
    const contaReceber = {
      id: Date.now(),
      vencimento: format(formData.dataVencimento, "yyyy-MM-dd"),
      cliente: formData.cliente,
      descricao: `Nota Fiscal ${novaNotaFiscal.number} - ${formData.descricao}`,
      valor: parseFloat(formData.valor),
      status: "Pendente"
    };

    onSave({ notaFiscal: novaNotaFiscal, contaReceber });
    
    // Reset form
    setFormData({
      cliente: "",
      clienteCnpj: "",
      descricao: "",
      valor: "",
      dataEmissao: undefined,
      dataVencimento: undefined,
      categoria: "",
      metodoPagamento: "",
    });
    
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Nota Fiscal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">Emissão de Nota Fiscal</DialogTitle>
          <DialogDescription className="text-gray-400">
            Crie e gerencie suas notas fiscais e despesas para ressarcimento.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cliente" className="text-gray-300">Cliente *</Label>
              <Select onValueChange={handleClienteChange}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id.toString()} className="text-white">
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj" className="text-gray-300">CNPJ/CPF</Label>
              <Input
                id="cnpj"
                value={formData.clienteCnpj}
                className="bg-gray-700 border-gray-600 text-white"
                readOnly
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao" className="text-gray-300">Descrição do Serviço / Despesa *</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              className="bg-gray-700 border-gray-600 text-white"
              placeholder="Descreva o serviço ou despesa"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor" className="text-gray-300">Valor (R$) *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                value={formData.valor}
                onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria" className="text-gray-300">Categoria</Label>
              <Select onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="Serviços" className="text-white">Serviços</SelectItem>
                  <SelectItem value="Contratos" className="text-white">Contratos</SelectItem>
                  <SelectItem value="Taxas" className="text-white">Taxas</SelectItem>
                  <SelectItem value="Produtos" className="text-white">Produtos</SelectItem>
                  <SelectItem value="Outros" className="text-white">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Data de Emissão *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-gray-700 border-gray-600 text-white",
                      !formData.dataEmissao && "text-gray-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.dataEmissao ? format(formData.dataEmissao, "dd/MM/yyyy") : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-gray-700 border-gray-600">
                  <Calendar
                    mode="single"
                    selected={formData.dataEmissao}
                    onSelect={(date) => setFormData(prev => ({ ...prev, dataEmissao: date }))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Data de Vencimento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-gray-700 border-gray-600 text-white",
                      !formData.dataVencimento && "text-gray-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.dataVencimento ? format(formData.dataVencimento, "dd/MM/yyyy") : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-gray-700 border-gray-600">
                  <Calendar
                    mode="single"
                    selected={formData.dataVencimento}
                    onSelect={(date) => setFormData(prev => ({ ...prev, dataVencimento: date }))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metodoPagamento" className="text-gray-300">Método de Pagamento</Label>
            <Select onValueChange={(value) => setFormData(prev => ({ ...prev, metodoPagamento: value }))}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Selecione o método" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="Boleto" className="text-white">Boleto</SelectItem>
                <SelectItem value="PIX" className="text-white">PIX</SelectItem>
                <SelectItem value="Débito Automático" className="text-white">Débito Automático</SelectItem>
                <SelectItem value="Transferência" className="text-white">Transferência</SelectItem>
                <SelectItem value="Dinheiro" className="text-white">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-gray-600 text-gray-300">
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              💾 Salvar e Gerar Despesa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
