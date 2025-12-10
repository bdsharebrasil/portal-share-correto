import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Download, Edit, Trash2, ChevronLeft, Plane, TrendingUp, FileUp, X } from "lucide-react";
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
  comanda_url: string | null;
  nota_url: string | null;
  boleto_url: string | null;
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
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    data: "",
    trecho: "",
    local: "",
    comanda: "",
    litros: "",
    valor_unitario: "",
    abastecimento_galoes: "",
    ano: new Date().getFullYear().toString(),
    comanda_file: null as File | null,
    nota_file: null as File | null,
    boleto_file: null as File | null,
    comanda_url: "",
    nota_url: "",
    boleto_url: "",
  });
  const [uploadedFiles, setUploadedFiles] = useState({
    comanda_url: "",
    nota_url: "",
    boleto_url: "",
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

  const uploadFile = async (file: File | null, fieldName: string): Promise<string | null> => {
    if (!file) return null;

    try {
      const timestamp = Date.now();
      const fileName = `${client.id}/${aircraft.id}/${timestamp}-${fieldName}-${file.name}`;

      const { error } = await supabase.storage
        .from("abastecimento")
        .upload(fileName, file);

      if (error) {
        toast.error(`Erro ao fazer upload do ${fieldName}`);
        return null;
      }

      const { data } = supabase.storage
        .from("abastecimento")
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (err) {
      toast.error(`Erro ao processar upload do ${fieldName}`);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verificar se comanda está preenchida
    if (!formData.comanda.trim() && !editingRecord) {
      setShowConfirmation(true);
      return;
    }

    await saveRecord();
  };

  const saveRecord = async () => {
    setIsUploading(true);
    setShowConfirmation(false);

    try {
      const litros = parseFloat(formData.litros);
      const valorUnitario = parseFloat(formData.valor_unitario);
      const valorTotal = litros * valorUnitario;

      // Fazer upload dos arquivos
      let comandaUrl = uploadedFiles.comanda_url;
      let notaUrl = uploadedFiles.nota_url;
      let boletoUrl = uploadedFiles.boleto_url;

      if (formData.comanda_file && !comandaUrl) {
        comandaUrl = await uploadFile(formData.comanda_file, "comanda") || "";
      }
      if (formData.nota_file && !notaUrl) {
        notaUrl = await uploadFile(formData.nota_file, "nota-fiscal") || "";
      }
      if (formData.boleto_file && !boletoUrl) {
        boletoUrl = await uploadFile(formData.boleto_file, "boleto") || "";
      }

      const recordData = {
        client_id: client.id,
        aeronave_id: aircraft.id,
        data: formData.data,
        trecho: formData.trecho || null,
        local: formData.local || null,
        comanda: formData.comanda || null,
        litros: litros,
        valor_unitario: valorUnitario,
        valor_total: valorTotal,
        abastecimento_galoes: formData.abastecimento_galoes ? parseFloat(formData.abastecimento_galoes) : null,
        ano: formData.ano,
        abastecedor: "Sistema",
        comanda_url: comandaUrl || null,
        nota_url: notaUrl || null,
        boleto_url: boletoUrl || null,
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
    } finally {
      setIsUploading(false);
    }
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
      comanda_file: null,
      nota_file: null,
      boleto_file: null,
      comanda_url: "",
      nota_url: "",
      boleto_url: "",
    });
    setUploadedFiles({
      comanda_url: "",
      nota_url: "",
      boleto_url: "",
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

  const totalRecords = records.length;
  const totalLitros = records.reduce((sum, r) => sum + r.litros, 0);
  const totalValue = records.reduce((sum, r) => sum + r.valor_total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Plane className="h-6 w-6 text-primary" />
            Registros de Abastecimento
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{client.company_name} • {aircraft.registration}</p>
        </div>
      </div>

      {totalRecords > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-border/50 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total de Registros</p>
                  <p className="text-3xl font-bold text-foreground">{totalRecords}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/50 bg-gradient-to-br from-success/5 via-transparent to-transparent">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total de Litros</p>
                  <p className="text-3xl font-bold text-foreground">{totalLitros.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">litros</p>
                </div>
                <TrendingUp className="h-8 w-8 text-success/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/50 bg-gradient-to-br from-accent/5 via-transparent to-transparent">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Gasto Total</p>
                  <p className="text-3xl font-bold text-foreground">R$ {totalValue.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">valor total</p>
                </div>
                <TrendingUp className="h-8 w-8 text-accent/30" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex gap-2">
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-primary to-primary-dark hover:from-primary hover:to-primary-dark">
              <Plus className="h-4 w-4" />
              Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRecord ? "Editar Registro" : "Novo Registro"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="text-base font-semibold mb-3 block">Data</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Data do Abastecimento</Label>
                    <Input
                      type="date"
                      value={formData.data}
                      onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Ano</Label>
                    <Input
                      value={formData.ano}
                      onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                      required
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">Rota e Local</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Trecho</Label>
                    <Input
                      value={formData.trecho}
                      onChange={(e) => setFormData({ ...formData, trecho: e.target.value })}
                      placeholder="Ex: SBSP X SBRJ"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Local de Abastecimento</Label>
                    <Input
                      value={formData.local}
                      onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                      placeholder="Ex: CUIABA"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm">Nº Comanda</Label>
                <Input
                  value={formData.comanda}
                  onChange={(e) => setFormData({ ...formData, comanda: e.target.value })}
                  placeholder="Número da comanda"
                  required
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">Quantidades e Valores</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm">Litros Abastecidos</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.litros}
                      onChange={(e) => setFormData({ ...formData, litros: e.target.value })}
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Valor Unitário (R$)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={formData.valor_unitario}
                      onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })}
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Abastecimento Galões</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.abastecimento_galoes}
                      onChange={(e) => setFormData({ ...formData, abastecimento_galoes: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              {formData.litros && formData.valor_unitario && (
                <div className="bg-gradient-to-r from-success/10 to-success/5 border border-success/20 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Valor Total</p>
                  <p className="text-2xl font-bold text-success">
                    R$ {(parseFloat(formData.litros) * parseFloat(formData.valor_unitario)).toFixed(2)}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary-dark">
                  {editingRecord ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <Button
          variant="outline"
          onClick={handleExportPDF}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
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

      <Card className="border border-border/50 shadow-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-b border-border/50 hover:bg-transparent">
                  <TableHead className="font-semibold text-foreground">Data</TableHead>
                  <TableHead className="font-semibold text-foreground">Trecho</TableHead>
                  <TableHead className="font-semibold text-foreground">Local</TableHead>
                  <TableHead className="font-semibold text-foreground">Comanda</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Litros</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Valor Unit.</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Valor Total</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Galões</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow
                    key={record.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="font-medium text-foreground">
                      {format(new Date(record.data), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{record.trecho || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{record.local || "-"}</TableCell>
                    <TableCell className="font-mono text-foreground">{record.comanda}</TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {record.litros.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      R$ {record.valor_unitario.toFixed(5)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-success">
                      R$ {record.valor_total.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {record.abastecimento_galoes?.toFixed(2) || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(record)}
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(record.id)}
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {records.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="font-medium">Nenhum registro de abastecimento</p>
                <p className="text-sm mt-1">Comece criando um novo registro</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
