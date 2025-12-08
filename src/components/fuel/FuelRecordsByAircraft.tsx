import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Download, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Client {
  id: string;
  company_name: string;
}

interface Aircraft {
  id: string;
  registration: string;
  year: number | null;
}

interface FuelRecord {
  id: string;
  data: string;
  trecho: string | null;
  local: string | null;
  comanda: string;
  litros: number;
  valor_unitario: number;
  valor_total: number;
  abastecimento_galoes: number | null;
  ano: string | null;
}

interface Props {
  client: Client;
  aircraft: Aircraft;
  onBack: () => void;
}

export function FuelRecordsByAircraft({ client, aircraft, onBack }: Props) {
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FuelRecord | null>(null);
  const [formData, setFormData] = useState({
    data: "",
    trecho: "",
    local: "",
    comanda: "",
    litros: "",
    valor_unitario: "",
    abastecimento_galoes: "",
    ano: new Date().getFullYear().toString(),
  });
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraft.id]);

  const loadRecords = async () => {
    const { data, error } = await supabase
      .from("abastecimentos")
      .select("*")
      .eq("aeronave_id", aircraft.id)
      .eq("client_id", client.id)
      .order("data", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar registros");
      return;
    }

    setRecords(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const litros = parseFloat(formData.litros);
    const valorUnitario = parseFloat(formData.valor_unitario);
    const valorTotal = litros * valorUnitario;

    const recordData = {
      client_id: client.id,
      aeronave_id: aircraft.id,
      data: formData.data,
      trecho: formData.trecho || null,
      local: formData.local || null,
      comanda: formData.comanda,
      litros: litros,
      valor_unitario: valorUnitario,
      valor_total: valorTotal,
      abastecimento_galoes: formData.abastecimento_galoes ? parseFloat(formData.abastecimento_galoes) : null,
      ano: formData.ano,
      abastecedor: "Sistema",
    };

    if (editingRecord) {
      const { error } = await supabase.from("abastecimentos").update(recordData).eq("id", editingRecord.id);

      if (error) {
        toast.error("Erro ao atualizar registro");
        return;
      }
      toast.success("Registro atualizado com sucesso");
    } else {
      const { error } = await supabase.from("abastecimentos").insert(recordData);

      if (error) {
        toast.error("Erro ao criar registro");
        return;
      }
      toast.success("Registro criado com sucesso");
    }

    resetForm();
    setIsDialogOpen(false);
    loadRecords();
  };

  const handleEdit = (record: FuelRecord) => {
    setEditingRecord(record);
    setFormData({
      data: record.data,
      trecho: record.trecho || "",
      local: record.local || "",
      comanda: record.comanda,
      litros: record.litros.toString(),
      valor_unitario: record.valor_unitario.toString(),
      abastecimento_galoes: record.abastecimento_galoes?.toString() || "",
      ano: record.ano || new Date().getFullYear().toString(),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este registro?")) return;

    const { error } = await supabase.from("abastecimentos").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir registro");
      return;
    }

    toast.success("Registro excluído com sucesso");
    loadRecords();
  };

  const resetForm = () => {
    setFormData({
      data: "",
      trecho: "",
      local: "",
      comanda: "",
      litros: "",
      valor_unitario: "",
      abastecimento_galoes: "",
      ano: new Date().getFullYear().toString(),
    });
    setEditingRecord(null);
  };

  const handleExportPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const content = printRef.current?.innerHTML || "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Controle de Abastecimento - ${client.company_name} - ${aircraft.registration}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .logo { max-width: 150px; }
            .title { text-align: center; flex: 1; }
            .title h1 { margin: 0; font-size: 24px; }
            .title p { margin: 5px 0; color: #666; }
            .year { text-align: right; font-size: 20px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f4f4f4; font-weight: bold; }
            .text-right { text-align: right; }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const currentYear = formData.ano || new Date().getFullYear().toString();

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRecord ? "Editar Registro" : "Novo Registro"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={formData.data} onChange={(e) => setFormData({ ...formData, data: e.target.value })} required />
                </div>
                <div>
                  <Label>Ano</Label>
                  <Input value={formData.ano} onChange={(e) => setFormData({ ...formData, ano: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Trecho</Label>
                  <Input value={formData.trecho} onChange={(e) => setFormData({ ...formData, trecho: e.target.value })} placeholder="Ex: SBSP X SBRJ" />
                </div>
                <div>
                  <Label>Local</Label>
                  <Input value={formData.local} onChange={(e) => setFormData({ ...formData, local: e.target.value })} placeholder="Ex: CUIABA" />
                </div>
              </div>
              <div>
                <Label>Nº Comanda</Label>
                <Input value={formData.comanda} onChange={(e) => setFormData({ ...formData, comanda: e.target.value })} required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Litros Abastecidos</Label>
                  <Input type="number" step="0.01" value={formData.litros} onChange={(e) => setFormData({ ...formData, litros: e.target.value })} required />
                </div>
                <div>
                  <Label>Valor Unitário (R$)</Label>
                  <Input type="number" step="0.0001" value={formData.valor_unitario} onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })} required />
                </div>
                <div>
                  <Label>Abastecimento Galões</Label>
                  <Input type="number" step="0.01" value={formData.abastecimento_galoes} onChange={(e) => setFormData({ ...formData, abastecimento_galoes: e.target.value })} />
                </div>
              </div>
              {formData.litros && formData.valor_unitario && (
                <div className="bg-muted p-3 rounded">
                  <p className="text-sm font-medium">
                    Valor Total: R$ {(parseFloat(formData.litros) * parseFloat(formData.valor_unitario)).toFixed(2)}
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">{editingRecord ? "Atualizar" : "Criar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <Button variant="outline" onClick={handleExportPDF}>
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <div style={{ display: "none" }}>
        <div ref={printRef}>
          <div className="header">
            <img src="/placeholder.svg" alt="Logo" className="logo" />
            <div className="title">
              <h1>CONTROLE DE COMBUSTÍVEL</h1>
              <p>{client.company_name}</p>
              <p>{aircraft.registration}</p>
            </div>
            <div className="year">{currentYear.slice(-2)}/{(parseInt(currentYear) + 1).toString().slice(-2)}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>DATA</th>
                <th>TRECHOS</th>
                <th>LOCAL ABAST</th>
                <th>COMANDI</th>
                <th className="text-right">ABAST. LITR</th>
                <th className="text-right">VALOR LITR</th>
                <th className="text-right">VALOR TOTAL</th>
                <th className="text-right">ABASTECIMENTO GALÕES</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{format(new Date(record.data), "dd/MM/yyyy")}</td>
                  <td>{record.trecho || "-"}</td>
                  <td>{record.local || "-"}</td>
                  <td>{record.comanda}</td>
                  <td className="text-right">{record.litros.toFixed(2)}</td>
                  <td className="text-right">R$ {record.valor_unitario.toFixed(5)}</td>
                  <td className="text-right">R$ {record.valor_total.toFixed(2)}</td>
                  <td className="text-right">{record.abastecimento_galoes?.toFixed(2) || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Controle de Abastecimento - {client.company_name} - {aircraft.registration}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Trecho</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Comanda</TableHead>
                  <TableHead className="text-right">Litros</TableHead>
                  <TableHead className="text-right">Valor Unit.</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Galões</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{format(new Date(record.data), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{record.trecho || "-"}</TableCell>
                    <TableCell>{record.local || "-"}</TableCell>
                    <TableCell>{record.comanda}</TableCell>
                    <TableCell className="text-right">{record.litros.toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {record.valor_unitario.toFixed(5)}</TableCell>
                    <TableCell className="text-right">R$ {record.valor_total.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{record.abastecimento_galoes?.toFixed(2) || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(record)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {records.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">Nenhum registro de abastecimento encontrado</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
