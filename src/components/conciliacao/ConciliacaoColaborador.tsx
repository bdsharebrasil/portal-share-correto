import { useState, useEffect } from "react";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, Clock, User, Mail, Check, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getShortUserId, getIdBadgeColor } from "@/lib/user-id";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { StatusUpdateDialog } from "./StatusUpdateDialog";
import { MonthSelector } from "./MonthSelector";
import { syncBankReconciliationToFinancial } from "@/services/financialSyncClient";

// --- Interfaces ---
interface ColaboradorReconciliation {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  category: string | null;
  receiver_id?: string | null;
  prazo_pagamento: string | null;
  criado_por?: string;
  user_profiles?: { full_name: string } | null;
}

interface UserProfile {
  id: string;
  full_name: string;
}

// --- Schemas ---
const newReconciliationSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  status: z.enum(["pendente", "enviado", "pago"]),
  receiverId: z.string().min(1, "Colaborador é obrigatório"),
});

type NewReconciliationFormValues = z.infer<typeof newReconciliationSchema>;

export function ConciliacaoColaborador() {
  const [colaboradorData, setColaboradorData] = useState<ColaboradorReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const { toast } = useToast();
  const { roles } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showNewReconciliationForm, setShowNewReconciliationForm] = useState(false);
  const [openStatusDialog, setOpenStatusDialog] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<ColaboradorReconciliation | null>(null);

  const canApprovePaid = roles.some(role =>
    ['admin', 'gestor_master', 'financeiro_master'].includes(role)
  );

  useEffect(() => {
    fetchReconciliations();
    loadUsers();
  }, [currentDate]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from("user_profiles")
      .select("id, full_name, employment_status")
      .eq("employment_status", "ativo" as any)
      .order("full_name");

    setUsers((data || []) as any);
  };

  const fetchReconciliations = async () => {
    try {
      setLoading(true);

      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('bank_reconciliations')
        .select(`
          *,
          user_profiles:receiver_id (full_name)
        `)
        .eq('type', 'colaborador' as any)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;

      setColaboradorData(data as any);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Função para padronizar as cores dos status no design novo
  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case "pago":
      case "recebido":
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20 shadow-none whitespace-nowrap">Pago</Badge>;
      case "enviado":
        return <Badge className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20 shadow-none whitespace-nowrap">Enviado</Badge>;
      case "pendente":
        return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20 shadow-none whitespace-nowrap">Pendente</Badge>;
      default:
        return <Badge variant="secondary" className="whitespace-nowrap">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <MonthSelector
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        isCurrentMonth={true}
      />

      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Conciliação com Colaborador</CardTitle>
        </CardHeader>

        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {/* Aqui está a mágica: div com overflow-x-auto abraçando a Table do shadcn */}
          <div className="overflow-x-auto pb-4 custom-scrollbar">
            <Table className="w-full text-sm text-left border-collapse">
              <TableHeader className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider border-y border-border/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[100px] max-w-[200px] resize-x overflow-hidden">Data</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[80px] max-w-[150px] resize-x overflow-hidden">ID</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[200px] max-w-[400px] resize-x overflow-hidden">Colaborador</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[250px] max-w-[500px] resize-x overflow-hidden">Descrição</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[120px] max-w-[200px] resize-x overflow-hidden">Valor</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[120px] max-w-[200px] resize-x overflow-hidden">Prazo</div></TableHead>
                  <TableHead className="px-4 py-4 font-semibold h-auto"><div className="min-w-[120px] max-w-[200px] resize-x overflow-hidden">Status</div></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/50">
                {colaboradorData.map((item) => (
                  <TableRow key={item.id} className="hover:bg-accent/30 transition-colors group">
                    <TableCell className="px-4 py-4 whitespace-nowrap">
                      {format(new Date(item.date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <Badge variant="outline" className={`${getIdBadgeColor(getShortUserId(item.criado_por || ''))} font-semibold shadow-none border-border/50`}>
                        {getShortUserId(item.criado_por || '')}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-4 font-medium text-foreground whitespace-normal break-words leading-tight">
                      {item.user_profiles?.full_name || "-"}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-muted-foreground truncate max-w-[300px]" title={item.description}>
                      {item.description}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-emerald-400 font-medium whitespace-nowrap">
                      {formatCurrency(Number(item.amount))}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-muted-foreground text-sm whitespace-nowrap">
                      {item.prazo_pagamento ? format(new Date(item.prazo_pagamento), 'dd/MM/yyyy') : "-"}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      {getStatusBadge(item.status)}
                    </TableCell>
                  </TableRow>
                ))}
                {colaboradorData.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nenhuma conciliação encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedReconciliation && (
        <StatusUpdateDialog
          reconciliation={selectedReconciliation}
          open={openStatusDialog}
          onOpenChange={setOpenStatusDialog}
          onUpdate={fetchReconciliations}
        />
      )}
    </div>
  );
}

// --- Editor de Prazo (MANTIDO INTACTO) ---
interface PrazoPagamentoEditorProps {
  reconciliation: ColaboradorReconciliation;
  onSave: () => void;
}

function PrazoPagamentoEditor({ reconciliation, onSave }: PrazoPagamentoEditorProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    reconciliation.prazo_pagamento ? new Date(reconciliation.prazo_pagamento) : undefined
  );
  const { toast } = useToast();

  const handleSave = async () => {
    if (!selectedDate) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    const { error } = await supabase
      .from('bank_reconciliations')
      .update({ prazo_pagamento: dateStr } as any)
      .eq('id', reconciliation.id);

    if (error) {
      toast({ title: "Erro", description: "Erro ao atualizar prazo.", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Prazo atualizado." });
      onSave();
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        type="date"
        value={selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
        onChange={(e) =>
          setSelectedDate(e.target.value ? new Date(e.target.value) : undefined)
        }
      />
      <Button size="sm" onClick={handleSave}>
        <Check className="h-4 w-4" />
      </Button>
    </div>
  );
}