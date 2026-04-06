import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { usePayslips, getPayslipPublicUrl } from "@/hooks/usePayslips";
import { toast } from "sonner";
import { Upload, Trash2, Eye, Loader2, AlertCircle } from "lucide-react";

interface PayslipUploadData {
  employee_id: string;
  month: number;
  year: number;
  file: File | null;
}

export function PayslipsManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const months = [
    { value: "1", label: "Janeiro" },
    { value: "2", label: "Fevereiro" },
    { value: "3", label: "Março" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Maio" },
    { value: "6", label: "Junho" },
    { value: "7", label: "Julho" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" }
  ];

  const years = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - 2 + i;
    return { value: year.toString(), label: year.toString() };
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-payslips"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true });

      if (error) throw error;

      const filteredProfiles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: rolesData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);

          const roles = rolesData?.map((r: any) => r.role) || [];
          const excludedRoles = ["admin", "gestor_master", "cliente_cotista"];

          const hasExcludedRole = roles.some((role) => excludedRoles.includes(role));

          return { ...profile, roles, excluded: hasExcludedRole };
        })
      );

      return filteredProfiles.filter((p: any) => !p.excluded).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
      }));
    },
  });

  const { data: payslips = [] } = usePayslips(selectedEmployee || undefined);

  const uploadPayslipMutation = useMutation({
    mutationFn: async (uploadData: PayslipUploadData) => {
      if (!uploadData.file || !uploadData.employee_id) {
        throw new Error("Arquivo e funcionário são obrigatórios");
      }

      const fileName = `${uploadData.employee_id}/${uploadData.year}/${String(uploadData.month).padStart(2, "0")}_${uploadData.file.nome}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from("holerites")
        .upload(fileName, uploadData.file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("holerites")
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from("employee_payslips")
        .upsert({
          employee_id: uploadData.employee_id,
          month: uploadData.month,
          year: uploadData.year,
          file_path: fileName,
          uploaded_at: new Date().toISOString(),
          uploaded_by: user?.id,
        }, {
          onConflict: "employee_id,month,year",
        });

      if (dbError) throw dbError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
      setUploadFile(null);
      toast.success("Holerite enviado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar holerite: ${error.message}`);
    },
  });

  const deletePayslipMutation = useMutation({
    mutationFn: async (payslipId: string) => {
      const payslip = payslips.find((p: any) => p.id === payslipId);
      if (!payslip) throw new Error("Holerite não encontrado");

      const { error: storageError } = await supabase.storage
        .from("holerites")
        .remove([payslip.caminho_arquivo]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("employee_payslips")
        .delete()
        .eq("id", payslipId);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
      toast.success("Holerite removido com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover holerite: ${error.message}`);
    },
  });

  const handleUpload = async () => {
    if (!selectedEmployee || !uploadFile || !selectedMonth || !selectedYear) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    uploadPayslipMutation.mutate({
      employee_id: selectedEmployee,
      month: parseInt(selectedMonth),
      year: parseInt(selectedYear),
      file: uploadFile,
    });
  };


  const groupedPayslips = payslips.reduce((acc: any, payslip: any) => {
    const key = `${payslip.year}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(payslip);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Holerites</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="employee-select">Funcionário</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger id="employee-select" className="mt-2">
                  <SelectValue placeholder="Selecione um funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="month-select">Mês</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger id="month-select" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="year-select">Ano</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger id="year-select" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="file-upload">Arquivo do Holerite (PDF ou Imagem)</Label>
            <div className="mt-2 flex gap-2">
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                disabled={uploadPayslipMutation.isPending}
                className="flex-1"
              />
              <Button
                onClick={handleUpload}
                disabled={!selectedEmployee || !uploadFile || uploadPayslipMutation.isPending}
                className="gap-2"
              >
                {uploadPayslipMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Formatos aceitos: PDF, PNG, JPG, JPEG, GIF
            </p>
          </div>
        </CardContent>
      </Card>

      {selectedEmployee && (
        <Card>
          <CardHeader>
            <CardTitle>
              Holerites de {employees.find((e: any) => e.id === selectedEmployee)?.full_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payslips.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum holerite enviado para este funcionário.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedPayslips)
                  .sort(([yearA], [yearB]) => parseInt(yearB) - parseInt(yearA))
                  .map(([year, yearPayslips]: [string, any]) => (
                    <div key={year}>
                      <h3 className="text-lg font-semibold mb-3">{year}</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mês</TableHead>
                            <TableHead>Data do Envio</TableHead>
                            <TableHead>Arquivo</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {yearPayslips
                            .sort((a: any, b: any) => b.month - a.month)
                            .map((payslip: any) => (
                              <TableRow key={payslip.id}>
                                <TableCell className="font-medium">
                                  {months[payslip.month - 1]?.label}
                                </TableCell>
                                <TableCell>
                                  {payslip.enviado_em
                                    ? new Date(payslip.enviado_em).toLocaleDateString("pt-BR")
                                    : "—"}
                                </TableCell>
                                <TableCell>
                                  {payslip.caminho_arquivo
                                    ? payslip.caminho_arquivo.split("/").pop()
                                    : "—"}
                                </TableCell>
                                <TableCell className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    asChild
                                    title="Visualizar holerite"
                                  >
                                    <a
                                      href={getPayslipPublicUrl(payslip.caminho_arquivo)}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </a>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deletePayslipMutation.mutate(payslip.id)}
                                    disabled={deletePayslipMutation.isPending}
                                    title="Deletar holerite"
                                  >
                                    {deletePayslipMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    )}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
