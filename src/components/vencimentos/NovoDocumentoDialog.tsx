// @ts-nocheck
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { fetchAircrafts } from "@/services/maintenance";
import { createFlightDocument } from "@/services/flightDocuments";
import { useToast } from "@/hooks/use-toast";

interface Aircraft {
  id: string;
  registration?: string;
  matricula?: string;
}

interface NovoDocumentoDialogProps {
  onSave?: () => void;
}

export function NovoDocumentoDialog({ onSave }: NovoDocumentoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aircrafts, setAircrafts] = useState<Aircraft[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    aeronave_id: "",
    name: "",
    document_type: "",
    expiry_date: "",
  });

  useEffect(() => {
    if (open) {
      loadAircrafts();
    }
  }, [open]);

  const loadAircrafts = async () => {
    try {
      const list = await fetchAircrafts();
      setAircrafts(list as unknown as Aircraft[]);
    } catch (error) {
      console.error("Erro ao carregar aeronaves:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as aeronaves.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.aeronave_id || !formData.name || !formData.expiry_date) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos obrigatórios.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      await createFlightDocument({
        aeronave_id: formData.aeronave_id,
        nome: formData.name,
        tipo_documento: formData.document_type || undefined,
        data_validade: formData.expiry_date,
        caminho_arquivo: "placeholder",
      });

      toast({
        title: "Sucesso",
        description: "Documento cadastrado com sucesso.",
      });

      setFormData({
        aeronave_id: "",
        name: "",
        document_type: "",
        expiry_date: "",
      });

      onSave?.();
      setOpen(false);
    } catch (error) {
      console.error("Erro ao salvar documento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o documento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const documentTypes = [
    "Certificado de Aeronavegabilidade (CA)",
    "Seguro",
    "Revisão Técnica",
    "RVSM",
    "Licença de Estação",
    "Certificado de Ruído",
    "Documento de Manutenção",
    "Outro",
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Documento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-slate-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Novo Documento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aeronave" className="text-gray-300">
              Aeronave *
            </Label>
            <Select
              value={formData.aeronave_id}
              onValueChange={(value) =>
                setFormData({ ...formData, aeronave_id: value })
              }
            >
              <SelectTrigger
                id="aeronave"
                className="bg-slate-800 border-white/10 text-white"
              >
                <SelectValue placeholder="Selecione uma aeronave" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-white/10">
                {aircrafts.map((aircraft) => (
                  <SelectItem
                    key={aircraft.id}
                    value={aircraft.id}
                    className="text-white"
                  >
                    {aircraft.matricula || aircraft.registration}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="document_type" className="text-gray-300">
              Tipo de Documento *
            </Label>
            <Select
              value={formData.document_type}
              onValueChange={(value) =>
                setFormData({ ...formData, document_type: value })
              }
            >
              <SelectTrigger
                id="document_type"
                className="bg-slate-800 border-white/10 text-white"
              >
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-white/10">
                {documentTypes.map((type) => (
                  <SelectItem key={type} value={type} className="text-white">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome" className="text-gray-300">
              Nome/Descrição *
            </Label>
            <Input
              id="nome"
              placeholder="Ex: Seguro Responsabilidade Civil"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-slate-800 border-white/10 text-white placeholder-gray-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry_date" className="text-gray-300">
              Data de Vencimento *
            </Label>
            <Input
              id="expiry_date"
              type="data"
              value={formData.expiry_date}
              onChange={(e) =>
                setFormData({ ...formData, expiry_date: e.target.value })
              }
              className="bg-slate-800 border-white/10 text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="bg-slate-800 border-white/10 text-gray-300 hover:bg-slate-700"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {loading ? "Salvando..." : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
