import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePayslips, getPayslipPublicUrl } from "@/hooks/usePayslips";
import { readHolerite } from "@/lib/holeriteOCR";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Eye, FileText, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";

interface PayslipUploadData { employee_id: string; month: number; year: number; file: File | null; }
interface PayslipsManagementProps { employeeId?: string; employeeName?: string; }

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const YEARS = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - 3 + index);
const money = (value: unknown) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PayslipsManagement({ employeeId, employeeName }: PayslipsManagementProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState(employeeId || "");
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const activeEmployeeId = employeeId || selectedEmployee;
  const { data: payslips = [], isLoading, refetch } = usePayslips(activeEmployeeId || undefined);

  const uploadMutation = useMutation({
    mutationFn: async ({ employee_id, month, year, file }: PayslipUploadData) => {
      if (!file || !employee_id) throw new Error("Colaborador e arquivo são obrigatórios.");
      if (file.size > 15 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 15 MB.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${employee_id}/${year}/${String(month).padStart(2, "0")}_${safeName}`;

      const { error: uploadError } = await supabase.storage.from("holerites").upload(filePath, file, { upsert: true, contentType: file.type || undefined });
      if (uploadError) throw uploadError;

      const { data: savedPayslip, error: dbError } = await (supabase as any).from("employee_payslips").upsert({ employee_id, month, year, file_path: filePath, uploaded_at: new Date().toISOString(), uploaded_by: user?.id, ocr_status: "processando" }, { onConflict: "employee_id,month,year" }).select("id").single();
      if (dbError) throw dbError;

      try {
        const extraction = await readHolerite(file);
        const { error: ocrError } = await (supabase as any).from("employee_payslips").update({ salario_bruto: extraction.salarioBruto, salario_liquido: extraction.salarioLiquido, desconto_inss: extraction.descontoInss, desconto_irrf: extraction.descontoIrrf, outros_descontos: extraction.outrosDescontos, valor_ferias: extraction.valorFerias, total_descontos: extraction.totalDescontos, ocr_raw_text: extraction.rawText, ocr_confidence: extraction.confidence, ocr_status: "concluido", ocr_processed_at: new Date().toISOString() }).eq("id", savedPayslip.id);
        if (ocrError) throw ocrError;

        const { error: syncError } = await supabase.rpc("sync_employee_payslip_to_salary_history", { p_payslip_id: savedPayslip.id });
        if (syncError) throw syncError;
      } catch (error) {
        await (supabase as any).from("employee_payslips").update({ ocr_status: "erro", ocr_processed_at: new Date().toISOString() }).eq("id", savedPayslip.id);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payslips", activeEmployeeId] });
      queryClient.invalidateQueries({ queryKey: ["accounting-employee-payments", activeEmployeeId] });
      queryClient.invalidateQueries({ queryKey: ["employee-salaries-monthly"] });
      setUploadFile(null);
      toast.success("Holerite processado e sincronizado com o histórico salarial.");
    },
    onError: (error: any) => { toast.error(error?.message || "Não foi possível processar o holerite."); void refetch(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (payslip: any) => {
      if (payslip.file_path) {
        const { error } = await supabase.storage.from("holerites").remove([payslip.file_path]);
        if (error) throw error;
      }
      const { error } = await supabase.from("employee_payslips").delete().eq("id", payslip.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payslips", activeEmployeeId] });
      queryClient.invalidateQueries({ queryKey: ["accounting-employee-payments", activeEmployeeId] });
      toast.success("Holerite removido.");
    },
    onError: (error: any) => toast.error(error?.message || "Não foi possível remover o holerite."),
  });

  const handleUpload = () => {
    if (!activeEmployeeId || !uploadFile) return void toast.error("Selecione o colaborador e o arquivo.");
    uploadMutation.mutate({ employee_id: activeEmployeeId, month: Number(selectedMonth), year: Number(selectedYear), file: uploadFile });
  };

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl border-border/70">
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Holerites mensais</CardTitle><p className="mt-1 text-xs text-muted-foreground">Upload → leitura OCR → sincronização automática com Salários.</p></div>
            <Button variant="ghost" size="icon" onClick={() => refetch()} title="Atualizar"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {employeeId ? <div className="rounded-xl border border-border bg-muted/30 px-4 py-3"><p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Colaborador</p><p className="mt-1 font-semibold">{employeeName || "Colaborador selecionado"}</p></div> : <div><Label>Colaborador</Label><Input value={selectedEmployee} onChange={(event) => setSelectedEmployee(event.target.value)} placeholder="ID do colaborador" className="mt-2" /></div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label>Mês de referência</Label><Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Ano</Label><Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div><Label>PDF ou imagem do holerite</Label><div className="mt-2 flex flex-col gap-3 sm:flex-row"><Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} disabled={uploadMutation.isPending} className="h-11" /><Button onClick={handleUpload} disabled={!activeEmployeeId || !uploadFile || uploadMutation.isPending} className="h-11 shrink-0"><Upload className="mr-2 h-4 w-4" />{uploadMutation.isPending ? "Processando..." : "Enviar e ler"}</Button></div><p className="mt-2 text-xs text-muted-foreground">A leitura identifica bruto, líquido, INSS, IRRF, outros descontos e valor de férias quando disponíveis.</p></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70">
        <CardHeader><CardTitle className="text-base">Histórico por competência</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : payslips.length === 0 ? <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Nenhum holerite cadastrado para este colaborador.</AlertDescription></Alert> : <div className="space-y-3">
            {payslips.map((payslip: any) => {
              const url = payslip.file_path ? getPayslipPublicUrl(payslip.file_path) : "#";
              const complete = payslip.ocr_status === "concluido";
              return <div key={payslip.id} className="rounded-xl border border-border/60 p-4"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><FileText className="h-5 w-5" /></div><div className="min-w-0"><p className="font-semibold">{MONTHS[(Number(payslip.month) || 1) - 1]} / {payslip.year}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{complete ? <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><CheckCircle2 className="mr-1 h-3 w-3" /> OCR concluído</Badge> : <Badge variant="outline">{payslip.ocr_status}</Badge>}<span>{payslip.uploaded_at ? new Date(payslip.uploaded_at).toLocaleDateString("pt-BR") : "—"}</span></div></div></div><div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4 xl:text-right"><div><span className="block text-muted-foreground">Bruto</span><strong>{money(payslip.salario_bruto)}</strong></div><div><span className="block text-muted-foreground">INSS</span><strong>{money(payslip.desconto_inss)}</strong></div><div><span className="block text-muted-foreground">IRRF</span><strong>{money(payslip.desconto_irrf)}</strong></div><div><span className="block text-muted-foreground">Líquido</span><strong className="text-emerald-500">{money(payslip.salario_liquido)}</strong></div></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" asChild disabled={!payslip.file_path}><a href={url} target="_blank" rel="noreferrer"><Eye className="mr-2 h-4 w-4" />Visualizar</a></Button><Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(payslip)} disabled={deleteMutation.isPending} title="Excluir"><Trash2 className="h-4 w-4" /></Button></div></div></div>;
            })}
          </div>}
        </CardContent>
      </Card>
    </div>
  );
}
