
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const transacaoSchema = z.object({
  data: z.date({
    required_error: "Data é obrigatória",
  }),
  documento: z.string().min(1, "Documento é obrigatório"),
  planoContas: z.string().min(1, "Plano de Contas é obrigatório"),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  fluxo: z.enum(["ENTRADA", "SAIDA"], {
    required_error: "Fluxo é obrigatório",
  }),
  prazo: z.string().min(1, "Prazo é obrigatório"),
  valor: z.string().min(1, "Valor é obrigatório"),
  instituicaoBancaria: z.string().optional(),
  responsavel: z.string().min(1, "Responsável é obrigatório"),
});

type TransacaoFormData = z.infer<typeof transacaoSchema>;

interface NovaTransacaoDialogProps {
  onTransacaoCreated: (transacao: any) => void;
}

export function NovaTransacaoDialog({ onTransacaoCreated }: NovaTransacaoDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<TransacaoFormData>({
    resolver: zodResolver(transacaoSchema),
    defaultValues: {
      fluxo: "SAIDA",
      prazo: "MENSAL",
    },
  });

  const onSubmit = (data: TransacaoFormData) => {
    const novaTransacao = {
      id: Date.now(),
      data: format(data.data, "yyyy-MM-dd"),
      tipo: data.fluxo === "ENTRADA" ? "Entrada" : "Saída",
      valor: parseFloat(data.valor.replace(",", ".")),
      nome: data.descricao,
      categoria: data.categoria,
      documento: data.documento,
      planoContas: data.planoContas,
      prazo: data.prazo,
      instituicaoBancaria: data.instituicaoBancaria || "",
      responsavel: data.responsavel,
      reembolso: false
    };

    onTransacaoCreated(novaTransacao);
    
    toast({
      title: "Transação criada",
      description: `${data.fluxo === "ENTRADA" ? "Entrada" : "Saída"} de R$ ${data.valor} foi criada com sucesso.`,
    });

    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700">
          Nova Transação
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-gray-900 text-white border-gray-700">
        <DialogHeader>
          <DialogTitle>Centro de Custos - Novo Lançamento</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal bg-gray-800 border-gray-600 text-white",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy")
                            ) : (
                              <span>Selecione a data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="documento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DOC (Documento)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: REL-05" 
                        className="bg-gray-800 border-gray-600 text-white"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="planoContas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plano de Conta</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: CARTÃO CAIXA HORTOLÂNDIA" 
                        className="bg-gray-800 border-gray-600 text-white"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição/Referência *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: MERCADO, PNEUS ONIX" 
                        className="bg-gray-800 border-gray-600 text-white"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: DESPESAS SHARE" 
                        className="bg-gray-800 border-gray-600 text-white"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fluxo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fluxo *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                          <SelectValue placeholder="Selecione o fluxo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ENTRADA">ENTRADA</SelectItem>
                        <SelectItem value="SAIDA">SAÍDA</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="prazo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prazo *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                          <SelectValue placeholder="Selecione o prazo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MENSAL">MENSAL</SelectItem>
                        <SelectItem value="TRIMESTRAL">TRIMESTRAL</SelectItem>
                        <SelectItem value="SEMESTRAL">SEMESTRAL</SelectItem>
                        <SelectItem value="ANUAL">ANUAL</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Pago *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="0,00" 
                        className="bg-gray-800 border-gray-600 text-white"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="instituicaoBancaria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instituição Bancária</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: SICRED" 
                        className="bg-gray-800 border-gray-600 text-white"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responsavel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome (Responsável)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: TED ERRADO, AERO SIAG HANGAR" 
                        className="bg-gray-800 border-gray-600 text-white"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="border-gray-600 text-gray-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
              >
                Salvar Lançamento
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
